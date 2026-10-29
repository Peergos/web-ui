import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/** "Edit -> This and following" on a series that ends after a count.
 *
 *  The dialog shows the occurrences left from the one it opened on, and the series it makes
 *  from there has to end after that many. Written with the original count instead, the two
 *  halves together run three occurrences past where the series ended.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarFollowingCountTest.java [engine] [url]
 */
public class CalendarFollowingCountTest {

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            String recurring = calendar + "/recurring";
            LocalDate first = LocalDate.now().withDayOfMonth(1).plusMonths(1)
                    .with(TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY));
            LocalDate fourth = first.plusWeeks(3);
            CalendarApp.write(d, recurring, "class.ics", vevent("class", "Class",
                    "DTSTART:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T120000Z",
                    "DTEND:" + first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T130000Z",
                    "RRULE:FREQ=WEEKLY;COUNT=10"));
            reload(d, fourth);
            openOn(d, "Class", fourth);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", "Class from the fourth") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            String cut = CalendarApp.awaitStored(d, recurring, "class.ics", "UNTIL=");
            System.out.println("  the first part ends: " + CalendarApp.property(cut, "RRULE"));
            String rest = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:Class from the fourth");
            String rule = CalendarApp.property(CalendarApp.read(d, recurring, rest), "RRULE");
            if (rule == null || ! rule.contains("COUNT=7"))
                throw new AssertionError("The series from the fourth occurrence should end after the 7 left, not: " + rule);
            System.out.println("  ok   the rest ends after the seven that were left: " + rule);
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
