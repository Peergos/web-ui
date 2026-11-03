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

    /** Opens the popover of the occurrence drawn on a day and presses Duplicate; the dialog is open on return. */
    static void duplicateOn(WebDriver d, String title, LocalDate day) {
        CalendarApp.inFrame(d, "let chip = Array.from(document.querySelectorAll('[data-search-event-id]'))"
                + "  .filter(el => el.textContent.indexOf(arguments[0]) !== -1)"
                + "  .find(el => { let cell = el.closest('[data-date]');"
                + "    return cell && cell.getAttribute('data-date') === arguments[1]; });"
                + "if (!chip) throw new Error('no chip on ' + arguments[1]);"
                + "chip.click(); return 1;", title, day.toString());
        CalendarApp.waitInFrame(d, "the event popover",
                "document.getElementById('event-popover').classList.contains('open')", 30_000);
        CalendarApp.inFrame(d, CalendarApp.click("popover-duplicate") + "return 1;");
        CalendarApp.waitInFrame(d, "the duplicate dialog",
                "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
    }

    /** The one file a directory gained. */
    static String newFileIn(WebDriver d, String dir, Set<String> before) throws Exception {
        for (int i = 0; i < 60; i++) {
            for (String name : CalendarApp.list(d, dir))
                if (! before.contains(name))
                    return name;
            Thread.sleep(500);
        }
        throw new AssertionError("No new file under " + dir + "; it has " + CalendarApp.list(d, dir));
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();

        // The first Monday of next month, and the fortnightly occurrence after it as the one to duplicate: noon
        // UTC, so it is that day in any zone the browser is in. The Saturday after the first is added.
        LocalDate first = LocalDate.now().withDayOfMonth(1).plusMonths(1)
                .with(java.time.temporal.TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY));
        LocalDate taken = first.plusWeeks(2);
        LocalDate saturday = first.plusDays(5);
        String ics = String.join("\r\n",
                "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//test//EN",
                "BEGIN:VEVENT",
                "UID:" + UID,
                "DTSTAMP:20260101T000000Z",
                "DTSTART:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T120000Z",
                "DTEND:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T123000Z",
                "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=8",
                "RDATE:" + saturday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T150000Z",
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

            duplicateOn(d, TITLE, taken);

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
            String stored = CalendarApp.read(d, recurring, newFileIn(d, recurring, before));
            CalendarApp.assertHas(stored, "SUMMARY", TITLE);
            CalendarApp.assertTimeIs(stored, "DTSTART", taken.atTime(12, 0).atZone(ZoneOffset.UTC)
                    .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime());
            String rule = CalendarApp.property(stored, "RRULE");
            if (rule == null || ! rule.contains("FREQ=WEEKLY") || ! rule.contains("INTERVAL=2") || ! rule.contains("COUNT=8"))
                throw new AssertionError("The copy should repeat as the original does, its rule is: " + rule + "\n" + stored);
            CalendarApp.assertHas(stored, "TRIGGER", "-PT30M");
            CalendarApp.assertHas(stored, "LOCATION", "Room 4");
            System.out.println("  ok   the copy repeats from the date it was taken, with the reminder: " + rule);

            // --- a rule the form can't show whole ---------------------------------------------------------------
            // every weekday: the copy of a Wednesday keeps the rule's text as it is
            String weekdays = "Weekday standup";
            LocalDate wednesday = first.plusDays(2);
            CalendarApp.write(d, recurring, "weekdays.ics", String.join("\r\n",
                    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//test//EN",
                    "BEGIN:VEVENT",
                    "UID:weekday-standup-to-duplicate",
                    "DTSTAMP:20260101T000000Z",
                    "DTSTART:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T120000Z",
                    "DTEND:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T121500Z",
                    "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
                    "SUMMARY:" + weekdays,
                    "END:VEVENT", "END:VCALENDAR", ""));
            Page.gotoView(d, "Drive", "downloadFile", "__drive");
            CalendarApp.open(d);
            CalendarApp.gotoMonth(d, wednesday.toString());
            CalendarApp.waitInFrame(d, "the weekday series on the grid", CalendarSeriesTest.drawn(weekdays), 30_000);
            before = new HashSet<>(CalendarApp.list(d, recurring));
            duplicateOn(d, weekdays, wednesday);
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String weekdayCopy = CalendarApp.read(d, recurring, newFileIn(d, recurring, before));
            CalendarApp.assertHas(weekdayCopy, "RRULE", "BYDAY=MO,TU,WE,TH,FR");
            CalendarApp.assertTimeIs(weekdayCopy, "DTSTART", wednesday.atTime(12, 0).atZone(ZoneOffset.UTC)
                    .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime());
            System.out.println("  ok   a rule the form can't show is copied as it is");

            // --- an added date --------------------------------------------------------------------------------
            // the Saturday added to the fortnightly series is one occurrence, so its copy is one event
            before = new HashSet<>(CalendarApp.list(d, recurring));
            duplicateOn(d, TITLE, saturday);
            String repeat = String.valueOf(CalendarApp.inFrame(d, "return document.getElementById('event-repeat-freq').value;"));
            if (! repeat.isEmpty())
                throw new AssertionError("The copy of an added date, one occurrence, should not repeat; the dialog offers: " + repeat);
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String month = calendar + "/" + saturday.getYear() + "/" + saturday.getMonthValue();
            String single = CalendarApp.read(d, month, CalendarApp.awaitFileSaying(d, month, "SUMMARY:" + TITLE));
            if (CalendarApp.property(single, "RRULE") != null)
                throw new AssertionError("The copy of an added date repeats: " + single);
            CalendarApp.assertTimeIs(single, "DTSTART", saturday.atTime(15, 0).atZone(ZoneOffset.UTC)
                    .withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime());
            if (CalendarApp.list(d, recurring).size() != before.size())
                throw new AssertionError("The copy of an added date was stored as a series: " + CalendarApp.list(d, recurring));
            System.out.println("  ok   an added date is copied as one event");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
