import java.nio.file.*;
import java.time.*;
import java.util.*;

/** Moving between this app and the one it replaces, in both directions.
 *
 *  The store is the same either way - one .ics per entry, in the same directories - so an upgrade
 *  has nothing to migrate. What this pins down is that the files that already exist still open:
 *  the shape the old app wrote, with its own VTIMEZONE, a series, a RECURRENCE-ID override of one
 *  occurrence, and properties this app has no idea about. Reading must not lose or rewrite any of
 *  it, so the file is read back afterwards and compared with what was put there.
 *
 *  The other direction is a user going back to the old app after using this one, so the last part
 *  checks the two conventions that make it possible: an entry's UID is the name it is filed under
 *  (the old app derives the filename it edits and deletes from the UID), and X-OWNER names who
 *  created it (the old app will not let anyone edit an entry that names nobody).
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarLegacyTest.java [engine] [url]
 */
public class CalendarLegacyTest {

    // Deliberately not a prefix of one another: the grid is read by title, and an override whose
    // name starts with the series' would be counted as one of its occurrences.
    static final String SERIES = "Legacy weekly";
    static final String OVERRIDE = "Moved just this once";
    static final String MADE_HERE = "Written by the new app";
    // A second series, left alone until one of its occurrences is deleted.
    static final String UNTOUCHED = "Never edited series";
    static final String DOOMED = "The occurrence to delete";

    static final String SECOND = String.join("\r\n",
            "BEGIN:VCALENDAR",
            "PRODID:-//peergos.v1",
            "VERSION:2.0",
            "BEGIN:VEVENT",
            "UID:legacy-two",
            "DTSTAMP:20260101T090000Z",
            "DTSTART:20260107T140000Z",
            "DTEND:20260107T150000Z",
            "SUMMARY:" + UNTOUCHED,
            "RRULE:FREQ=WEEKLY;BYDAY=WE",
            "END:VEVENT",
            "BEGIN:VEVENT",
            "UID:legacy-two",
            "RECURRENCE-ID:20260114T140000Z",
            "DTSTAMP:20260101T090000Z",
            "DTSTART:20260114T160000Z",
            "DTEND:20260114T170000Z",
            "SUMMARY:" + DOOMED,
            "END:VEVENT",
            "END:VCALENDAR",
            "");

    /** The shape the previous calendar wrote: one file holding a series and its overrides. */
    static final String LEGACY = String.join("\r\n",
            "BEGIN:VCALENDAR",
            "PRODID:-//peergos.v1",
            "VERSION:2.0",
            "BEGIN:VTIMEZONE",
            "TZID:Europe/London",
            "BEGIN:STANDARD",
            "DTSTART:20251026T020000",
            "TZOFFSETFROM:+0100",
            "TZOFFSETTO:+0000",
            "END:STANDARD",
            "END:VTIMEZONE",
            "BEGIN:VEVENT",
            "UID:legacy-series",
            "DTSTAMP:20260101T090000Z",
            "DTSTART;TZID=Europe/London:20260105T090000",
            "DTEND;TZID=Europe/London:20260105T093000",
            "SUMMARY:" + SERIES,
            "RRULE:FREQ=WEEKLY;BYDAY=MO",
            // An extra occurrence this app has no controls for, in a zone that is not the
            // browser's: both the property and the zone it names have to survive a save.
            "RDATE;TZID=Europe/London:20260203T090000",
            "ORGANIZER;CN=Someone:mailto:someone@example.com",
            "ATTENDEE;PARTSTAT=ACCEPTED:mailto:someone.else@example.com",
            "CATEGORIES:Work",
            "X-PEERGOS-LEGACY:kept",
            "END:VEVENT",
            "BEGIN:VEVENT",
            "UID:legacy-series",
            "RECURRENCE-ID;TZID=Europe/London:20260112T090000",
            "DTSTAMP:20260101T090000Z",
            "DTSTART;TZID=Europe/London:20260112T140000",
            "DTEND;TZID=Europe/London:20260112T143000",
            "SUMMARY:" + OVERRIDE,
            "END:VEVENT",
            "END:VCALENDAR",
            "");

    /** The old app reads the name of the file to edit or delete out of the UID inside it. */
    static void assertUidIsTheFilename(String ics, String filename) {
        String uid = CalendarApp.property(ics, "UID");
        String stem = filename.substring(0, filename.length() - ".ics".length());
        if (uid == null || ! uid.equals("UID:" + stem))
            throw new AssertionError(filename + " holds " + uid + ", so the old app would edit"
                    + " a different file");
    }

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
        Path downloads = Temp.directory("peergos-calendar-legacy-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            System.out.println("calendar open, files under " + calendar);

            // Written where the old app put a series, by the same App handle it used - no import,
            // no dialog: this is a store that already has the previous app's data in it.
            String recurring = calendar + "/recurring";
            CalendarApp.write(d, recurring, "legacy-series.ics", LEGACY);
            CalendarApp.write(d, recurring, "legacy-two.ics", SECOND);
            System.out.println("wrote two series into " + recurring + " as the old app would have");

            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);

            // January 2026 is behind us, so the grid is asked for the month the series starts in.
            CalendarApp.gotoMonth(d, "2026-01-05");
            CalendarApp.waitInFrame(d, "the legacy series on the grid",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(SERIES) + ") !== -1)",
                    60_000);
            List<String> series = CalendarApp.occurrenceDates(d, SERIES);
            System.out.println("  the old series runs on " + series);
            if (series.size() < 3)
                throw new AssertionError("The legacy series barely loaded: " + series);
            for (String each : series)
                if (each.endsWith("-12"))
                    throw new AssertionError("The overridden occurrence is still drawn by the series"
                            + " as well as on its own: " + series);

            CalendarApp.waitInFrame(d, "the overridden occurrence",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(OVERRIDE) + ") !== -1)",
                    30_000);
            System.out.println("  ok   the series and its one changed occurrence both show, once each");

            // Nothing was touched on the way in: opening a calendar is a read.
            String afterOpening = CalendarApp.read(d, recurring, "legacy-series.ics");
            if (! afterOpening.equals(LEGACY))
                throw new AssertionError("Opening the calendar rewrote the stored file:\n" + afterOpening);
            System.out.println("  ok   the file on disk is byte for byte what the old app left");

            // And an edit keeps what this app has no controls for - an entry from another
            // client would otherwise be trimmed to the fields shown in the dialog.
            CalendarApp.openPopover(d, SERIES);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", SERIES + " renamed") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            String edited = CalendarApp.awaitStored(d, recurring, "legacy-series.ics",
                    "SUMMARY:" + SERIES + " renamed");
            for (String line : new String[]{"ORGANIZER;CN=Someone:mailto:someone@example.com",
                    "ATTENDEE;PARTSTAT=ACCEPTED:mailto:someone.else@example.com",
                    "CATEGORIES:Work", "X-PEERGOS-LEGACY:kept",
                    "RDATE;TZID=Europe/London:20260203T090000"}) {
                if (! edited.contains(line))
                    throw new AssertionError("Editing the event dropped " + line + ":\n" + edited);
            }
            if (! edited.contains("TZID:Europe/London"))
                throw new AssertionError("The kept RDATE names a zone the file no longer defines:\n"
                        + edited);
            System.out.println("  ok   an edit kept the organiser, attendee, categories, X- and RDATE");

            // Saving the series is also what moves its override into a file of its own. Until
            // then it stays where the old app left it, inside the series file: opening a
            // calendar rewrites nothing, as the byte comparison above already showed.
            String january = calendar + "/2026/1";
            String overrideFile = CalendarApp.awaitFileSaying(d, january, "SUMMARY:" + OVERRIDE);
            String overrideIcs = CalendarApp.read(d, january, overrideFile);
            if (overrideIcs.contains("RECURRENCE-ID"))
                throw new AssertionError("The migrated override still claims to replace an"
                        + " occurrence of the series:\n" + overrideIcs);
            if (edited.split("BEGIN:VEVENT", -1).length - 1 != 1)
                throw new AssertionError("The series file still holds the override as well:\n" + edited);
            CalendarApp.waitInFrame(d, "the overridden occurrence after the series was saved",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(OVERRIDE) + ") !== -1)",
                    30_000);
            System.out.println("  ok   the changed occurrence moved to a file of its own, once");

            // --- and back: what the old app needs to be able to work on this one's files -------
            for (String[] each : new String[][]{{january, overrideFile}, {recurring, "legacy-series.ics"}})
                assertUidIsTheFilename(CalendarApp.read(d, each[0], each[1]), each[1]);

            LocalDate when = LocalDate.now().plusDays(5);
            String date = when.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE);
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", MADE_HERE)
                            + CalendarApp.setField("event-start-date", date)
                            + CalendarApp.setField("event-start-time", "11:00")
                            + CalendarApp.setField("event-end-date", date)
                            + CalendarApp.setField("event-end-time", "12:00")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String todayDir = calendar + "/" + when.getYear() + "/" + when.getMonthValue();
            String madeHere = CalendarApp.awaitFileSaying(d, todayDir, "SUMMARY:" + MADE_HERE);
            String madeHereIcs = CalendarApp.read(d, todayDir, madeHere);
            assertUidIsTheFilename(madeHereIcs, madeHere);
            CalendarApp.assertHas(madeHereIcs, "X-OWNER", Server.USERNAME);
            System.out.println("  ok   an entry made here is one the old app can still edit and delete");

            // --- deleting an occurrence that has no file of its own yet ------------------------
            // The second series was never saved, so its changed occurrence is still a block
            // inside it. Deleting that occurrence has to rewrite the series, or the block is
            // still there to be read back and the deleted occurrence returns.
            CalendarApp.gotoMonth(d, "2026-01-14");
            CalendarApp.openPopover(d, DOOMED);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.waitInFrame(d, "the delete confirmation",
                    "document.getElementById('confirm-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("confirm-ok") + "return 1;");

            String rewritten = d.waitUntil("the second series rewritten without it", () -> {
                String ics = CalendarApp.read(d, recurring, "legacy-two.ics");
                return ics != null && ! ics.contains("SUMMARY:" + DOOMED) ? ics : null;
            }, 60_000);
            CalendarApp.assertContains(rewritten, "SUMMARY:" + UNTOUCHED);
            CalendarApp.assertHas(rewritten, "EXDATE", "20260114");

            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.gotoMonth(d, "2026-01-14");
            CalendarApp.waitInFrame(d, "the second series back on the grid",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(UNTOUCHED) + ") !== -1)",
                    60_000);
            if (! CalendarApp.occurrenceDates(d, DOOMED).isEmpty())
                throw new AssertionError("The deleted occurrence came back after a reload");
            System.out.println("  ok   deleting an occurrence still inside its series file sticks");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
