import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.time.temporal.TemporalAdjusters;
import java.time.zone.ZoneOffsetTransition;
import java.util.*;

/** A weekend-long series, with the occurrence over a clock change deleted.
 *
 *  Deleting one occurrence rewrites the series with the length of the occurrence it was done
 *  from. Measured in real milliseconds, the weekend the clocks go forward is an hour short of
 *  two days, and the whole series became one day long. Only a zone with a clock change ahead
 *  can show this, so the test looks for the next one and says so if there is none.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarClockChangeTest.java [engine] [url]
 */
public class CalendarClockChangeTest {

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
        // a zone whose clocks change, whatever the runner's
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-"), headless, "Europe/Athens")) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            ZoneId zone = ZoneId.of(String.valueOf(d.script("return Intl.DateTimeFormat().resolvedOptions().timeZone;")));
            ZoneOffsetTransition change = zone.getRules().nextTransition(Instant.now());
            if (change == null || change.getInstant().isAfter(Instant.now().plus(Duration.ofDays(360)))) {
                System.out.println("  no clock change in the year ahead in the browser's " + zone + ", nothing to check");
                System.out.println("PASS");
                return;
            }
            LocalDate changeDay = change.getDateTimeBefore().toLocalDate();
            LocalDate weekend = changeDay.with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY));
            LocalDate first = weekend.minusWeeks(2);
            String recurring = calendar + "/recurring";
            CalendarApp.write(d, recurring, "weekend.ics", vevent("weekend", "Weekend away",
                    "DTSTART;VALUE=DATE:" + first.format(DateTimeFormatter.BASIC_ISO_DATE),
                    "DTEND;VALUE=DATE:" + first.plusDays(2).format(DateTimeFormatter.BASIC_ISO_DATE),
                    "RRULE:FREQ=WEEKLY"));
            reload(d, weekend);
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn("Weekend away"), 30_000);
            openOn(d, "Weekend away", weekend);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "this");
            String rewritten = CalendarApp.awaitStored(d, recurring, "weekend.ics", "EXDATE");
            String end = CalendarApp.property(rewritten, "DTEND");
            String expected = first.plusDays(2).format(DateTimeFormatter.BASIC_ISO_DATE);
            if (end == null || ! end.endsWith(expected))
                throw new AssertionError("Deleting the weekend of " + weekend + " (clocks change on " + changeDay
                        + ") rewrote the series to end " + end + ", not " + expected + ":\n" + rewritten);
            System.out.println("  ok   the series is still two days long: " + end);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Opens the popover of the occurrence drawn on one day. */
    static void openOn(WebDriver d, String title, LocalDate day) {
        CalendarApp.inFrame(d, "let chip = Array.from(document.querySelectorAll('[data-search-event-id]'))"
                + "  .filter(el => el.textContent.indexOf(arguments[0]) !== -1)"
                + "  .find(el => { let cell = el.closest('[data-date]');"
                + "    return cell && cell.getAttribute('data-date') === arguments[1]; });"
                + "if (!chip) throw new Error('no chip on ' + arguments[1]);"
                + "chip.click(); return 1;", title, day.toString());
        CalendarApp.waitInFrame(d, "the event popover",
                "document.getElementById('event-popover').classList.contains('open')", 30_000);
    }

    static void reload(WebDriver d, LocalDate month) {
        Page.gotoView(d, "Drive", "downloadFile", "__drive");
        CalendarApp.open(d);
        CalendarApp.gotoMonth(d, month.toString());
    }

    static String vevent(String uid, String summary, String... lines) {
        return String.join("\r\n", "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//test//EN", "BEGIN:VEVENT",
                "UID:" + uid, "DTSTAMP:20260101T000000Z", "SUMMARY:" + summary)
                + "\r\n" + String.join("\r\n", lines) + "\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    }
}
