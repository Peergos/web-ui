import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** An entry with two alarms, renamed in the dialog.
 *
 *  The dialog shows one reminder, the first alarm it can show, and that is the one it may
 *  rewrite. A second alarm of the same shape, a day before from another client, is not the
 *  dialog's to drop just because it has no box for it.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarOtherAlarmsTest.java [engine] [url]
 */
public class CalendarOtherAlarmsTest {

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
            LocalDate day = LocalDate.now().withDayOfMonth(1).plusMonths(1).withDayOfMonth(15);
            String month = calendar + "/" + day.getYear() + "/" + day.getMonthValue();
            CalendarApp.write(d, month, "dentist.ics", vevent("dentist", "Dentist",
                    "DTSTART:" + day.format(DateTimeFormatter.BASIC_ISO_DATE) + "T080000Z",
                    "DTEND:" + day.format(DateTimeFormatter.BASIC_ISO_DATE) + "T090000Z",
                    "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT15M", "DESCRIPTION:Dentist", "END:VALARM",
                    "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D", "DESCRIPTION:Dentist", "END:VALARM"));
            reload(d, day);
            CalendarApp.waitInFrame(d, "the entry on the grid", CalendarSeriesTest.drawn("Dentist"), 30_000);
            openOn(d, "Dentist", day);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", "Dentist renamed") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String saved = CalendarApp.awaitStored(d, month, "dentist.ics", "SUMMARY:Dentist renamed");
            if (! saved.contains("TRIGGER:-PT15M"))
                throw new AssertionError("The reminder the dialog showed is gone:\n" + saved);
            if (! saved.contains("TRIGGER:-P1D"))
                throw new AssertionError("The second alarm, a day before, is gone:\n" + saved);
            System.out.println("  ok   both alarms are still in the file");
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
