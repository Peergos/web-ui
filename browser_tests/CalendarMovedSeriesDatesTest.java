import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** A series with a deleted occurrence, then moved to another time through Edit -> All events.
 *
 *  A deleted occurrence is an EXDATE naming its start. Moving the series moves every start,
 *  so the EXDATE has to move with it, or it names a time the series no longer has and the
 *  deleted occurrence comes back.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarMovedSeriesDatesTest.java [engine] [url]
 */
public class CalendarMovedSeriesDatesTest {

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
            LocalDate first = LocalDate.now().withDayOfMonth(1).plusMonths(1).withDayOfMonth(2);
            LocalDate deleted = first.plusWeeks(1);
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", "Shifted standup")
                            + CalendarApp.setField("event-start-date", first.toString())
                            + CalendarApp.setField("event-start-time", "10:00")
                            + CalendarApp.setField("event-end-date", first.toString())
                            + CalendarApp.setField("event-end-time", "10:30")
                            + CalendarApp.setField("event-repeat-freq", "weekly")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String file = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:Shifted standup");

            CalendarApp.gotoMonth(d, deleted.toString());
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn("Shifted standup"), 30_000);
            openOn(d, "Shifted standup", deleted);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "this");
            String excluded = CalendarApp.awaitStored(d, recurring, file, "EXDATE");
            System.out.println("  deleted one: " + CalendarApp.property(excluded, "EXDATE"));

            CalendarApp.waitInFrame(d, "the series still on the grid", CalendarSeriesTest.drawn("Shifted standup"), 30_000);
            CalendarApp.openPopover(d, "Shifted standup");
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-time", "11:00")
                    + CalendarApp.setField("event-end-time", "11:30") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String moved = CalendarApp.awaitStored(d, recurring, file, "T1100");
            String exdate = CalendarApp.property(moved, "EXDATE");
            if (exdate == null || ! exdate.contains("T1100"))
                throw new AssertionError("The series moved to 11:00 but its deleted occurrence did not: " + exdate);
            System.out.println("  ok   the deleted occurrence moved with the series: " + exdate);
            reload(d, deleted);
            CalendarApp.waitInFrame(d, "the series after a reload", CalendarSeriesTest.drawn("Shifted standup"), 30_000);
            List<String> drawn = CalendarApp.occurrenceDates(d, "Shifted standup");
            if (drawn.contains(deleted.toString()))
                throw new AssertionError("The deleted occurrence is back on " + deleted + ": " + drawn);
            System.out.println("  ok   and it stays deleted: " + drawn);
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
