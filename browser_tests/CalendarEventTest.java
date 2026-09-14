import java.nio.file.*;
import java.time.*;
import java.time.format.*;

/** Creates an event the way a person does - through the app's own dialog - and reads back what
 *  was stored for it.
 *
 *  The assertion is on the file in the store, not on the grid: the app can show an event it never
 *  managed to write, and the point of a calendar is that another client reads the same .ics. The
 *  event is then found again after a full reload, which is the only proof that what came back off
 *  disk is what went in.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarEventTest.java [engine] [url]
 */
public class CalendarEventTest {

    static final String TITLE = "Quarterly review";
    static final String WHERE = "Room 2, upstairs";

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

        // Tomorrow, so the event is in the month the grid opens on and the day it lands on is
        // never yesterday by the time the assertions run.
        LocalDate day = LocalDate.now().plusDays(1);
        String date = day.format(DateTimeFormatter.ISO_LOCAL_DATE);

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Path downloads = Temp.directory("peergos-calendar-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            System.out.println("calendar open");

            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", TITLE)
                            + CalendarApp.setField("event-location", WHERE)
                            + CalendarApp.setField("event-start-date", date)
                            + CalendarApp.setField("event-start-time", "10:00")
                            + CalendarApp.setField("event-end-date", date)
                            + CalendarApp.setField("event-end-time", "11:00")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            String month = calendar + "/" + day.getYear() + "/" + day.getMonthValue();
            String filename = CalendarApp.awaitFileSaying(d, month, "SUMMARY:" + TITLE);
            System.out.println("stored as " + month + "/" + filename);
            if (! filename.endsWith(".ics"))
                throw new AssertionError("Stored under a name no other client would read: " + filename);

            String ics = CalendarApp.read(d, month, filename);
            CalendarApp.assertHas(ics, "BEGIN", "VCALENDAR");
            CalendarApp.assertHas(ics, "SUMMARY", TITLE);
            // RFC 5545 escapes the comma; a client reading this back must see one location.
            CalendarApp.assertHas(ics, "LOCATION", "Room 2\\, upstairs");
            CalendarApp.assertTimeIs(ics, "DTSTART", day.atTime(10, 0));
            CalendarApp.assertTimeIs(ics, "DTEND", day.atTime(11, 0));
            CalendarApp.assertContains(ics, "END:VCALENDAR");

            // Everything above could still be a page that never let go of its own state.
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.waitInFrame(d, "the event to come back from the store",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(e => e.textContent.indexOf(" + CalendarApp.quote(TITLE) + ") !== -1)",
                    60_000);
            System.out.println("  ok   on the grid again after a reload");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
