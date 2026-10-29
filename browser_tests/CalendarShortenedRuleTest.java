import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** A series whose rule the repeat form cannot show, cut short with "this and following".
 *
 *  "Every weekday" as many clients write it is FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR, and the form has no
 *  weekday boxes for a daily rule. Cutting the series short changes only where it ends, so the rule
 *  written back has to be the file's own with a new UNTIL: rebuilt from what the form shows, it
 *  loses its BYDAY and the series runs on weekends too.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarShortenedRuleTest.java [engine] [url]
 */
public class CalendarShortenedRuleTest {

    static final String TITLE = "Weekday standup";
    static final String UID = "weekday-standup-shortened";
    static final String RULE = "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR";

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

        // The first Monday of next month, and the Monday after as the day to cut from: noon UTC,
        // so it is that day in any zone the browser is in.
        LocalDate first = LocalDate.now().withDayOfMonth(1).plusMonths(1)
                .with(java.time.temporal.TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY));
        LocalDate cut = first.plusWeeks(1);
        String ics = String.join("\r\n",
                "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//test//EN",
                "BEGIN:VEVENT",
                "UID:" + UID,
                "DTSTAMP:20260101T000000Z",
                "DTSTART:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T120000Z",
                "DTEND:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T123000Z",
                "RRULE:" + RULE,
                "SUMMARY:" + TITLE,
                "END:VEVENT", "END:VCALENDAR", "");

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Path downloads = Temp.directory("peergos-calendar-shortened-rule-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            String recurring = calendar + "/recurring";
            String filename = UID + ".ics";
            CalendarApp.write(d, recurring, filename, ics);
            System.out.println("series written by another client as " + recurring + "/" + filename);

            // loaded from the store, as it would be after the other client wrote it
            Page.gotoView(d, "Drive", "downloadFile", "__drive");
            CalendarApp.open(d);
            CalendarApp.gotoMonth(d, cut.toString());
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn(TITLE), 30_000);
            List<String> drawn = CalendarApp.occurrenceDates(d, TITLE);
            for (String day : drawn) {
                DayOfWeek weekday = LocalDate.parse(day).getDayOfWeek();
                if (weekday == DayOfWeek.SATURDAY || weekday == DayOfWeek.SUNDAY)
                    throw new AssertionError("The weekday series is drawn on a " + weekday + ", " + day);
            }
            if (! drawn.contains(cut.toString()))
                throw new AssertionError("Expected an occurrence on " + cut + ", the grid has " + drawn);

            // the occurrence on the day to cut from, not the first one the grid has
            CalendarApp.inFrame(d, "let chip = Array.from(document.querySelectorAll('[data-search-event-id]'))"
                    + "  .filter(el => el.textContent.indexOf(arguments[0]) !== -1)"
                    + "  .find(el => { let cell = el.closest('[data-date]');"
                    + "    return cell && cell.getAttribute('data-date') === arguments[1]; });"
                    + "if (!chip) throw new Error('no chip on ' + arguments[1]);"
                    + "chip.click(); return 1;", TITLE, cut.toString());
            CalendarApp.waitInFrame(d, "the event popover",
                    "document.getElementById('event-popover').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "following");

            String ended = CalendarApp.awaitStored(d, recurring, filename, "UNTIL=");
            String rule = CalendarApp.property(ended, "RRULE");
            if (rule == null || ! rule.contains("BYDAY=MO,TU,WE,TH,FR"))
                throw new AssertionError("The shortened series lost the days its rule names: " + rule);
            if (! rule.contains("FREQ=DAILY"))
                throw new AssertionError("The shortened series is no longer daily: " + rule);
            System.out.println("  ok   cut short, it still runs on weekdays only: " + rule);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
