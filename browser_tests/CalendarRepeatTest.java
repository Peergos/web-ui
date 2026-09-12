import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** A repeating event with a reminder, set in the dialog and read back off disk.
 *
 *  Both of these are what another client actually reads: a phone shows the alarm because the file
 *  carries a VALARM, and every client works out the occurrences from the RRULE. So the assertions
 *  are on those two lines - and then on the dates the app itself puts on the grid, because a rule
 *  that is written correctly but expanded wrongly is just as broken.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarRepeatTest.java [engine] [url]
 */
public class CalendarRepeatTest {

    static final String TITLE = "Last Friday of the month";

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

        // The first of next month, so the series has a whole month ahead of it whenever it runs.
        LocalDate day = LocalDate.now().withDayOfMonth(1).plusMonths(1);
        String date = day.format(DateTimeFormatter.ISO_LOCAL_DATE);

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Path downloads = Temp.directory("peergos-calendar-repeat-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            System.out.println("calendar open, files under " + calendar);

            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", TITLE)
                            + CalendarApp.setField("event-start-date", date)
                            + CalendarApp.setField("event-start-time", "09:00")
                            + CalendarApp.setField("event-end-date", date)
                            + CalendarApp.setField("event-end-time", "09:30")
                            + CalendarApp.setField("event-reminder", "15")
                            + CalendarApp.setField("event-repeat-freq", "monthly")
                            + CalendarApp.setField("event-repeat-monthly-mode", "nthWeekday")
                            + CalendarApp.setField("event-repeat-ordinal", "-1")
                            + CalendarApp.setField("event-repeat-nth-weekday", "FR")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            // A repeating event is not filed under a month: every client has to find the series
            // wherever it starts, so it lives in the calendar's recurring directory.
            String recurring = calendar + "/recurring";
            String filename = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:" + TITLE);
            System.out.println("stored as " + recurring + "/" + filename);

            String ics = CalendarApp.read(d, recurring, filename);
            CalendarApp.assertHas(ics, "SUMMARY", TITLE);
            CalendarApp.assertHas(ics, "RRULE", "FREQ=MONTHLY;BYDAY=-1FR");
            // The alarm another client rings: relative to the start, so it travels with the event.
            CalendarApp.assertContains(ics, "BEGIN:VALARM");
            CalendarApp.assertHas(ics, "TRIGGER", "-PT15M");
            CalendarApp.assertHas(ics, "ACTION", "DISPLAY");

            // Written correctly is half of it - these are the days it lands on. The series
            // starts next month, so the grid is moved on to where the first one falls.
            CalendarApp.nextPeriod(d);
            CalendarApp.waitInFrame(d, "the series to be drawn",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(TITLE) + ") !== -1)",
                    30_000);
            List<String> shown = CalendarApp.occurrenceDates(d, TITLE);
            System.out.println("  grid shows " + shown);
            for (String each : shown) {
                LocalDate on = LocalDate.parse(each);
                if (on.getDayOfWeek() != DayOfWeek.FRIDAY)
                    throw new AssertionError("An occurrence landed on " + on.getDayOfWeek() + ": " + on);
                if (on.plusWeeks(1).getMonthValue() == on.getMonthValue())
                    throw new AssertionError("An occurrence is not the last Friday of its month: " + on);
            }
            if (shown.isEmpty())
                throw new AssertionError("The series never reached the grid");
            System.out.println("  ok   every occurrence is the last Friday of its month");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

}
