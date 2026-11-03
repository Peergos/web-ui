import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** Duplicate copies the whole event: a repeating event's rule and its reminder go with it, not
 *  only its title and text, so the copy repeats as the original does from the date it was taken.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarDuplicateTest.java [engine] [url]
 */
public class CalendarDuplicateTest {
    static Fixtures.Account me;

    static final String TITLE = "Weekly review";
    static final String UID = "weekly-review-to-duplicate";

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

        // The first Monday of next month, and the fortnightly occurrence after it as the one to duplicate: noon
        // UTC, so it is that day in any zone the browser is in.
        LocalDate first = LocalDate.now().withDayOfMonth(1).plusMonths(1)
                .with(java.time.temporal.TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY));
        LocalDate taken = first.plusWeeks(2);
        String ics = String.join("\r\n",
                "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//test//EN",
                "BEGIN:VEVENT",
                "UID:" + UID,
                "DTSTAMP:20260101T000000Z",
                "DTSTART:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T120000Z",
                "DTEND:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T123000Z",
                "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=8",
                "SUMMARY:" + TITLE,
                "LOCATION:Room 4",
                "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + TITLE, "TRIGGER:-PT30M", "END:VALARM",
                "END:VEVENT", "END:VCALENDAR", "");

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        me = Fixtures.account(url);
        Path downloads = Temp.directory("peergos-calendar-duplicate-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, me.name());
            String recurring = calendar + "/recurring";
            String filename = UID + ".ics";
            CalendarApp.write(d, recurring, filename, ics);

            // loaded from the store, as it would be after another client wrote it
            Page.gotoView(d, "Drive", "downloadFile", "__drive");
            CalendarApp.open(d);
            CalendarApp.gotoMonth(d, taken.toString());
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn(TITLE), 30_000);
            Set<String> before = new HashSet<>(CalendarApp.list(d, recurring));

            CalendarApp.inFrame(d, "let chip = Array.from(document.querySelectorAll('[data-search-event-id]'))"
                    + "  .filter(el => el.textContent.indexOf(arguments[0]) !== -1)"
                    + "  .find(el => { let cell = el.closest('[data-date]');"
                    + "    return cell && cell.getAttribute('data-date') === arguments[1]; });"
                    + "if (!chip) throw new Error('no chip on ' + arguments[1]);"
                    + "chip.click(); return 1;", TITLE, taken.toString());
            CalendarApp.waitInFrame(d, "the event popover",
                    "document.getElementById('event-popover').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("popover-duplicate") + "return 1;");
            CalendarApp.waitInFrame(d, "the duplicate dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);

            // the dialog shows what the original has, before anything is saved
            String shown = String.valueOf(CalendarApp.inFrame(d, "return document.getElementById('event-repeat-freq').value"
                    + " + ' every ' + document.getElementById('event-repeat-interval').value"
                    + " + ' ' + document.getElementById('event-repeat-end').value"
                    + " + ' ' + document.getElementById('event-repeat-count').value"
                    + " + ' reminder ' + document.getElementById('event-reminder').value"
                    + " + ' at ' + document.getElementById('event-location').value;"));
            if (! shown.equals("weekly every 2 count 8 reminder 30 at Room 4"))
                throw new AssertionError("The duplicate dialog should show the original's rule, reminder and place, shows: " + shown);
            System.out.println("  ok   the duplicate dialog shows the original's rule and reminder: " + shown);

            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String copy = null;
            for (int i = 0; i < 60 && copy == null; i++) {
                for (String name : CalendarApp.list(d, recurring))
                    if (! before.contains(name))
                        copy = name;
                if (copy == null) Thread.sleep(500);
            }
            if (copy == null)
                throw new AssertionError("The duplicate of a repeating event should be a repeating event of its own, stored under "
                        + recurring + "; it has " + CalendarApp.list(d, recurring));
            String stored = CalendarApp.read(d, recurring, copy);
            CalendarApp.assertHas(stored, "SUMMARY", TITLE);
            CalendarApp.assertTimeIs(stored, "DTSTART", taken.atTime(12, 0).atZone(ZoneOffset.UTC)
                    .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime());
            String rule = CalendarApp.property(stored, "RRULE");
            if (rule == null || ! rule.contains("FREQ=WEEKLY") || ! rule.contains("INTERVAL=2") || ! rule.contains("COUNT=8"))
                throw new AssertionError("The copy should repeat as the original does, its rule is: " + rule + "\n" + stored);
            CalendarApp.assertHas(stored, "TRIGGER", "-PT30M");
            CalendarApp.assertHas(stored, "LOCATION", "Room 4");
            System.out.println("  ok   the copy repeats from the date it was taken, with the reminder: " + rule);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
