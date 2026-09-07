import java.nio.file.*;

/** Downloads a calendar event as an .ics file.
 *
 *  A third download mechanism, and the only one that does not go near the service worker: the
 *  calendar builds a blob url and clicks an anchor carrying a download attribute. That is the
 *  same shape as the change reverted in 760a66be, so it is worth its own coverage - and it is
 *  the path most likely to be broken by the page being cross origin isolated.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarEventDownloadTest.java [engine] [url]
 */
public class CalendarEventDownloadTest {

    static final String TITLE = "Test Event";

    static final String ICS = String.join("\r\n",
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Peergos//browser test//EN",
            "BEGIN:VEVENT",
            "UID:browser-test-event",
            "DTSTAMP:20260101T120000Z",
            "DTSTART:20260101T130000Z",
            "DTEND:20260101T140000Z",
            "SUMMARY:" + TITLE,
            "END:VEVENT",
            "END:VCALENDAR",
            "");

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

        Path downloads = Files.createTempDirectory("peergos-ics-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);

            Page.gotoView(d, "Calendar", "downloadEvent", "__cal");
            System.out.println("calendar open");

            // the name is built from a translated prefix, so read it rather than assume English
            String prefix = String.valueOf(d.script("return window.__cal.translate('CALENDAR.EVENT')"));
            String expectedName = prefix + " - " + TITLE + ".ics";
            System.out.println("expecting " + expectedName);

            d.script("window.__cal.downloadEvent('test-calendar', arguments[0], arguments[1]);",
                    TITLE, ICS);

            Downloads.Result ics = Downloads.await(downloads, expectedName, 120_000, 20_000);
            System.out.println("  " + ics);
            if (ics.path == null)
                throw new AssertionError("No .ics appeared in " + downloads
                        + ", saw " + java.util.Arrays.toString(downloads.toFile().list()));
            if (ics.stalled)
                throw new AssertionError("The .ics download stalled at " + ics.size + " bytes");

            String content = Files.readString(ics.path);
            if (! content.equals(ICS))
                throw new AssertionError("Downloaded ics differs from the event:\n" + content);
            System.out.println("  ok   " + ics.size + " bytes, contents match the event");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
