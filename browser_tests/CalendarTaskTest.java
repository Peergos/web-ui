import java.nio.file.*;
import java.time.*;
import java.time.format.*;

/** A task through its life: made in the dialog, stored as a VTODO, ticked off, stored again.
 *
 *  Tasks are the calendar's newest surface and the one most likely to drift from the format, so
 *  every assertion here is on the file: a VTODO another client can open, with the three
 *  completion properties clients disagree about all written, and in a directory of its own
 *  because a task may have no date to be filed under.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarTaskTest.java [engine] [url]
 */
public class CalendarTaskTest {
    static Fixtures.Account me;

    static final String TITLE = "Send the release notes";

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

        LocalDate due = LocalDate.now().plusDays(2);
        String date = due.format(DateTimeFormatter.ISO_LOCAL_DATE);

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        me = Fixtures.account(url);
        Path downloads = Temp.directory("peergos-calendar-task-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, me.name());
            System.out.println("calendar open, files under " + calendar);

            CalendarApp.newEntry(d, "add-menu-task", "task-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("task-title", TITLE)
                            + "document.getElementById('task-has-due').checked = true;"
                            + "document.getElementById('task-has-due')"
                            + "  .dispatchEvent(new Event('change', {bubbles: true}));"
                            + CalendarApp.setField("task-due-date", date)
                            + "return 1;");
            CalendarApp.save(d, "task-save", "task-modal-backdrop");

            String tasks = calendar + "/tasks";
            String filename = CalendarApp.awaitFileSaying(d, tasks, "SUMMARY:" + TITLE);
            System.out.println("stored as " + tasks + "/" + filename);

            String ics = CalendarApp.read(d, tasks, filename);
            CalendarApp.assertContains(ics, "BEGIN:VTODO");
            CalendarApp.assertHas(ics, "SUMMARY", TITLE);
            CalendarApp.assertHas(ics, "DUE", due.format(DateTimeFormatter.BASIC_ISO_DATE));
            CalendarApp.assertHas(ics, "STATUS", "NEEDS-ACTION");

            // Ticking it off in the sidebar is the way it is done, and it rewrites the file.
            CalendarApp.waitInFrame(d, "the task in the sidebar",
                    "document.querySelector('.task-check')", 30_000);
            CalendarApp.inFrame(d, "document.querySelector('.task-check').click(); return 1;");
            String done = CalendarApp.awaitStored(d, tasks, filename, "STATUS:COMPLETED");
            CalendarApp.assertHas(done, "STATUS", "COMPLETED");
            // Clients disagree on which of these means done, so all three are written.
            CalendarApp.assertHas(done, "PERCENT-COMPLETE", "100");
            CalendarApp.assertHas(done, "COMPLETED", "T");

            // A repeating task turned from all-day to a time: its due time is written in UTC, so the rule's
            // UNTIL, which RFC 5545 has take that type, becomes the last due date at that time in UTC.
            String zone = String.valueOf(d.script("return Intl.DateTimeFormat().resolvedOptions().timeZone;"));
            LocalDate until = due.plusWeeks(3);
            CalendarApp.write(d, tasks, "repeat.ics", String.join("\r\n", "BEGIN:VCALENDAR", "VERSION:2.0",
                    "PRODID:-//test//test//EN", "BEGIN:VTODO", "UID:repeat", "DTSTAMP:20260101T000000Z",
                    "SUMMARY:Water the plants", "DUE;VALUE=DATE:" + due.format(DateTimeFormatter.BASIC_ISO_DATE),
                    "RRULE:FREQ=WEEKLY;UNTIL=" + until.format(DateTimeFormatter.BASIC_ISO_DATE),
                    "STATUS:NEEDS-ACTION", "END:VTODO", "END:VCALENDAR", ""));
            CalendarClockChangeTest.reload(d, due);
            CalendarApp.waitInFrame(d, "the repeating task in the sidebar",
                    "Array.from(document.querySelectorAll('.task-open')).find(b => b.textContent.indexOf('Water the plants') !== -1)", 30_000);
            CalendarApp.inFrame(d, "Array.from(document.querySelectorAll('.task-open'))"
                    + "  .find(b => b.textContent.indexOf('Water the plants') !== -1).click(); return 1;");
            CalendarApp.waitInFrame(d, "the task dialog",
                    "document.getElementById('task-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("task-due-all-day")
                    + CalendarApp.setField("task-due-time", "09:00") + "return 1;");
            CalendarApp.save(d, "task-save", "task-modal-backdrop");
            String timed = CalendarApp.awaitStored(d, tasks, "repeat.ics", "DUE:");
            String untilUtc = until.atTime(9, 0).atZone(ZoneId.of(zone)).withZoneSameInstant(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
            CalendarApp.assertHas(timed, "RRULE", "UNTIL=" + untilUtc);
            System.out.println("  ok   turned to 09:00, the repeating task ends at " + untilUtc);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
