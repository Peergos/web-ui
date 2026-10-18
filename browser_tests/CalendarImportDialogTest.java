import java.nio.file.*;
import java.util.*;

/** The question an .ics import asks before it writes anything, once for each file: how many
 *  events and how many tasks the file holds, which of them to bring in, and into which calendar.
 *  Import is disabled while nothing is ticked, leaving the question leaves that file out, and the
 *  calendar one file went into is where the next question starts. What is checked is what lands
 *  in the store, file by file.
 *
 *  Files are handed to the app's own file input, several at once, the way a picker hands them -
 *  through DataTransfer, which every engine here has, rather than a native dialog only some
 *  drivers can fill. An .ics opened from the drive is asked about the same way, by its name.
 *
 *  An account of its own: it adds a calendar and imports into the one it came with.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarImportDialogTest.java [engine] [url]
 */
public class CalendarImportDialogTest {

    static final String TARGET = "Import target";

    static String event(String uid, String day, String summary) {
        return "BEGIN:VEVENT\r\nUID:" + uid + "\r\nDTSTAMP:20260101T090000Z\r\nDTSTART:" + day + "T090000Z\r\n"
                + "DTEND:" + day + "T100000Z\r\nSUMMARY:" + summary + "\r\nEND:VEVENT\r\n";
    }

    static String task(String uid, String day, String summary) {
        return "BEGIN:VTODO\r\nUID:" + uid + "\r\nDTSTAMP:20260101T090000Z\r\nDUE;VALUE=DATE:" + day + "\r\n"
                + "STATUS:NEEDS-ACTION\r\nSUMMARY:" + summary + "\r\nEND:VTODO\r\n";
    }

    static String calendar(String... entries) {
        return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//browser test//EN\r\n" + String.join("", entries) + "END:VCALENDAR\r\n";
    }

    // Three events and two tasks in March 2027, and one entry with no date at all.
    static final String TEAM = calendar(
            event("team-event-1", "20270301", "Team one"), event("team-event-2", "20270302", "Team two"),
            event("team-event-3", "20270303", "Team three"),
            task("team-task-1", "20270310", "Team task one"), task("team-task-2", "20270311", "Team task two"),
            "BEGIN:VEVENT\r\nUID:team-broken\r\nSUMMARY:No date\r\nEND:VEVENT\r\n");
    static final String SOLO = calendar(event("solo-event-1", "20270401", "Solo one"), event("solo-event-2", "20270402", "Solo two"));
    static final String MORE = calendar(event("more-event-1", "20270501", "More one"));
    static final String OPENED = calendar(event("opened-event", "20270601", "Opened one"), task("opened-task", "20270605", "Opened task"));

    public static void main(String[] args) throws Exception {
        try {
            run(args);
        } catch (AssertionError e) {
            System.out.println(e.getMessage());
            System.exit(1);
        }
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();
        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        String user = "importer" + (System.currentTimeMillis() % 100000);
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-import-"), headless)) {
            Fixtures.signUp(url, user, CalendarLiveShareTest.PASSWORD);
            // In the drive before the sign-in, for the last step: the page keeps what it read of
            // the drive for a while, and a file put there from outside afterwards is not in it.
            Path opened = Temp.directory("peergos-calendar-opened-").resolve("opened.ics");
            Files.writeString(opened, OPENED);
            Fixtures.commands(serverDir.resolve("Peergos.jar"), url, user, CalendarLiveShareTest.PASSWORD, "put " + opened.toAbsolutePath());
            CalendarLiveShareTest.signIn(d, url, user);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String main = CalendarApp.directoryOf(d, user);
            String target = CalendarWholeShareTest.addCalendar(d, TARGET, "Already in the target");

            // --- one file: counted apart, and only the tasks taken, into another calendar ---------
            hand(d, List.of(List.of("team.ics", TEAM)));
            expectQuestion(d, "team.ics", "3 events:on", "2 tasks:on", "My Calendar", "Cancel", true);
            CalendarApp.inFrame(d, untick("import-events") + untick("import-tasks") + "return 1;");
            if (! Boolean.TRUE.equals(CalendarApp.inFrame(d, "return document.getElementById('import-confirm').disabled;")))
                throw new AssertionError("Import should be disabled with nothing ticked");
            CalendarApp.inFrame(d, tick("import-tasks") + chooseCalendar(TARGET) + "return 1;");
            if (! Boolean.FALSE.equals(CalendarApp.inFrame(d, "return document.getElementById('import-confirm').disabled;")))
                throw new AssertionError("Import should be enabled again once tasks are ticked");
            System.out.println("  ok   Import is disabled while nothing is ticked, and back once something is");
            CalendarApp.inFrame(d, CalendarApp.click("import-confirm") + "return 1;");
            expectSummary(d, "Imported 2 tasks.", "Left out: 3 events.", "1 could not be read");
            awaitStored(d, target + "/tasks", "team-task-1.ics", "team-task-2.ics");
            expectNothingIn(d, main + "/2027/3", target + "/2027/3");
            System.out.println("  ok   the two tasks are in " + TARGET + ", and none of the events anywhere");

            // --- two files at once: the first left out by Escape, the second asked about after it -
            hand(d, List.of(List.of("only-events.ics", SOLO), List.of("team.ics", TEAM)));
            expectQuestion(d, "only-events.ics (1 of 2)", "2 events:on", "0 tasks:off,greyed", "My Calendar", "Skip", false);
            CalendarApp.inFrame(d, "document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); return 1;");
            expectQuestion(d, "team.ics (2 of 2)", "3 events:on", "2 tasks:on", "My Calendar", "Cancel", true);
            CalendarApp.inFrame(d, untick("import-tasks") + CalendarApp.click("import-confirm") + "return 1;");
            expectSummary(d, "only-events.ics: Not imported.", "team.ics: Imported 3 events.", "Left out: 2 tasks.");
            awaitStored(d, main + "/2027/3", "team-event-1.ics", "team-event-2.ics", "team-event-3.ics");
            expectNothingIn(d, main + "/2027/4");
            System.out.println("  ok   a file left out writes nothing, and the next is still asked about");

            // --- where one file went is where the next question starts ---------------------------
            hand(d, List.of(List.of("only-events.ics", SOLO), List.of("more-events.ics", MORE)));
            expectQuestion(d, "only-events.ics (1 of 2)", "2 events:on", "0 tasks:off,greyed", "My Calendar", "Skip", false);
            CalendarApp.inFrame(d, chooseCalendar(TARGET) + CalendarApp.click("import-confirm") + "return 1;");
            expectQuestion(d, "more-events.ics (2 of 2)", "1 event:on", "0 tasks:off,greyed", TARGET, "Cancel", false);
            CalendarApp.inFrame(d, CalendarApp.click("import-cancel") + "return 1;");
            expectSummary(d, "only-events.ics: Imported 2 events.", "more-events.ics: Not imported.");
            awaitStored(d, target + "/2027/4", "solo-event-1.ics", "solo-event-2.ics");
            expectNothingIn(d, main + "/2027/5", target + "/2027/5");
            System.out.println("  ok   the second question starts on " + TARGET + ", where the first file went");

            // --- every file left out: nothing to report -------------------------------------------
            hand(d, List.of(List.of("more-events.ics", MORE)));
            expectQuestion(d, "more-events.ics", "1 event:on", "0 tasks:off,greyed", "My Calendar", "Cancel", false);
            CalendarApp.inFrame(d, CalendarApp.click("import-cancel") + "return 1;");
            WebDriver.sleep(1500);
            if (Boolean.TRUE.equals(CalendarApp.inFrame(d,
                    "return document.getElementById('import-summary-modal-backdrop').classList.contains('open');")))
                throw new AssertionError("Leaving every file out should not be reported as an import");
            System.out.println("  ok   leaving the only file out says nothing");

            // --- a file opened from the drive is asked about the same way, by its name -----------
            Page.gotoDrive(d);
            // opened once the drive shows it, as a person would double-click it - not while the
            // view is still changing over
            Page.waitForInDrive(d, "opened.ics", 60_000);
            d.script("let stack = [" + Page.VUE + ".root()];"
                    + "while (stack.length) {"
                    + "  let c = stack.pop();"
                    + "  if (typeof c.openFileOrDir === 'function') { c.openFileOrDir('Calendar', arguments[0], {filename: 'opened.ics'}); return; }"
                    + "  " + Page.VUE + ".children(c).forEach(k => stack.push(k));"
                    + "}"
                    + "throw new Error('no component that opens a file in an app');", "/" + user);
            d.waitForScript("the calendar frame", "!!document.querySelector('" + CalendarApp.FRAME + "')", 120_000);
            expectQuestion(d, "opened.ics", "1 event:on", "1 task:on", "My Calendar", "Cancel", false);
            CalendarApp.inFrame(d, CalendarApp.click("import-confirm") + "return 1;");
            expectSummary(d, "Imported 1 event.", "Imported 1 task.");
            awaitStored(d, main + "/2027/6", "opened-event.ics");
            awaitStored(d, main + "/tasks", "opened-task.ics");
            System.out.println("  ok   an .ics opened from the drive is asked about by name, then imported");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Gives the app's file input these files - [name, contents] each - and tells it they changed. */
    static void hand(WebDriver d, List<List<String>> files) {
        CalendarApp.inFrame(d, "let dt = new DataTransfer();"
                + "arguments[0].forEach(f => dt.items.add(new File([f[1]], f[0], {type: 'text/calendar'})));"
                + "let input = document.getElementById('ics-file-input');"
                + "input.files = dt.files;"
                + "input.dispatchEvent(new Event('change', {bubbles: true})); return 1;", files);
    }

    static String tick(String id) {
        return "{ let b = document.getElementById('" + id + "'); if (!b.checked) b.click(); }";
    }

    static String untick(String id) {
        return "{ let b = document.getElementById('" + id + "'); if (b.checked) b.click(); }";
    }

    static String chooseCalendar(String name) {
        return "{ let s = document.getElementById('import-calendar');"
                + "  let o = Array.from(s.options).find(o => o.textContent === " + CalendarApp.quote(name) + ");"
                + "  if (!o) throw new Error('no calendar called ' + " + CalendarApp.quote(name) + " + ' to import into');"
                + "  s.value = o.value; s.dispatchEvent(new Event('change', {bubbles: true})); }";
    }

    /** Waits for the question and checks what it says: the file, each kind as "<count>:<on|off>[,greyed]",
     *  the calendar it starts on, the leave-out button's word, and whether the unreadable-entry note shows. */
    static void expectQuestion(WebDriver d, String file, String events, String tasks, String calendarName,
                               String leave, boolean note) {
        try {
            CalendarApp.waitInFrame(d, "the import question about " + file,
                    "document.getElementById('import-modal-backdrop').classList.contains('open')"
                            + " && document.getElementById('import-file').textContent === " + CalendarApp.quote(file), 60_000);
        } catch (IllegalStateException e) {
            System.out.println("  the frame: " + CalendarApp.inFrame(d, "return 'question ' + document.getElementById('import-modal-backdrop').classList.contains('open')"
                    + " + ' about ' + document.getElementById('import-file').textContent"
                    + " + ', summary ' + document.getElementById('import-summary-modal-backdrop').classList.contains('open')"
                    + " + ' ' + document.getElementById('import-summary-message').textContent;"));
            System.out.println("  the app: " + CalendarApp.appState(d));
            throw e;
        }
        String seen = String.valueOf(CalendarApp.inFrame(d,
                "let kind = (box, label) => document.getElementById(label).textContent + ':' + (document.getElementById(box).checked ? 'on' : 'off')"
                        + "  + (document.getElementById(box).disabled ? ',greyed' : '');"
                        + "let s = document.getElementById('import-calendar');"
                        + "return [kind('import-events', 'import-events-label'), kind('import-tasks', 'import-tasks-label'),"
                        + "  s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : 'none',"
                        + "  document.getElementById('import-cancel').textContent.trim(),"
                        + "  document.getElementById('import-note').hidden ? 'no note' : 'note',"
                        + "  Array.from(s.options).map(o => o.textContent).join('+')].join(' | ');"));
        String wanted = events + " | " + tasks + " | " + calendarName + " | " + leave + " | " + (note ? "note" : "no note");
        if (! seen.startsWith(wanted + " | "))
            throw new AssertionError("The question about " + file + " should read [" + wanted + "], not [" + seen + "]");
        System.out.println("  ok   asked about " + file + ": " + seen);
    }

    static void expectSummary(WebDriver d, String... parts) {
        String summary = CalendarImportExportTest.importSummary(d);
        for (String part : parts)
            if (! summary.contains(part))
                throw new AssertionError("The summary should say \"" + part + "\": " + summary);
        System.out.println("  ok   summary: " + summary.replace("\n", " / "));
        CalendarApp.inFrame(d, CalendarApp.click("import-summary-ok") + "return 1;");
    }

    static void awaitStored(WebDriver d, String dir, String... names) {
        d.waitUntil("" + Arrays.toString(names) + " in " + dir, () -> {
            List<String> there = listOrEmpty(d, dir);
            return there.containsAll(Arrays.asList(names)) ? there : null;
        }, 60_000);
    }

    static void expectNothingIn(WebDriver d, String... dirs) {
        for (String dir : dirs)
            if (! listOrEmpty(d, dir).isEmpty())
                throw new AssertionError(dir + " should hold nothing: " + listOrEmpty(d, dir));
    }

    static List<String> listOrEmpty(WebDriver d, String dir) {
        try {
            return CalendarApp.list(d, dir);
        } catch (IllegalStateException e) {
            return List.of();
        }
    }
}
