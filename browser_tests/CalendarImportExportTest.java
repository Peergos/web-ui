import java.nio.file.*;
import java.util.*;

/** The two ways a calendar meets the outside world: reading a file another program wrote, and
 *  handing one back.
 *
 *  An imported file is untrusted - its UIDs become filenames here - and a second import of the
 *  same file must not double every entry. An export has to carry what the store holds, not what
 *  the grid happens to have loaded, which is why the exported file is compared against the
 *  entries the import put there.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarImportExportTest.java [engine] [url]
 */
public class CalendarImportExportTest {

    static final String[] TITLES = {"Imported standup", "Imported review", "Imported retro"};

    static String file() {
        StringBuilder ics = new StringBuilder("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//browser test//EN\r\n");
        for (int i = 0; i < TITLES.length; i++) {
            ics.append("BEGIN:VEVENT\r\nUID:imported-").append(i).append("\r\n")
                    .append("DTSTAMP:20260101T090000Z\r\n")
                    .append("DTSTART:2026061").append(i).append("T090000Z\r\n")
                    .append("DTEND:2026061").append(i).append("T100000Z\r\n")
                    .append("SUMMARY:").append(TITLES[i]).append("\r\nEND:VEVENT\r\n");
        }
        // No start at all: an entry nothing can place on a calendar, which the summary counts
        // rather than letting it stop the rest of the file.
        ics.append("BEGIN:VEVENT\r\nUID:imported-broken\r\nSUMMARY:No date\r\nEND:VEVENT\r\n");
        return ics.append("END:VCALENDAR\r\n").toString();
    }

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
        Path downloads = Temp.directory("peergos-calendar-io-");
        // Kept out of the download directory, so the only .ics that appears there is the export.
        Path source = Temp.directory("peergos-calendar-src-").resolve("browser-test.ics");
        Files.writeString(source, file());

        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            System.out.println("calendar open, files under " + calendar);

            // --- in ---------------------------------------------------------------------------
            handFile(d, source);
            String summary = importSummary(d);
            System.out.println("  summary: " + summary);
            if (! summary.contains("Imported " + TITLES.length + " events"))
                throw new AssertionError("Expected " + TITLES.length + " events imported: " + summary);
            if (! summary.contains("could not be read"))
                throw new AssertionError("The entry with no date was not reported: " + summary);
            CalendarApp.inFrame(d, CalendarApp.click("import-summary-ok") + "return 1;");

            // A month of its own, so what is counted here is what this test imported - the suite
            // shares one account, and other tests write to the months around today.
            String month = calendar + "/2026/6";
            List<String> stored = d.waitUntil("the imported files", () -> {
                List<String> names = CalendarApp.list(d, month);
                return names.size() == TITLES.length ? names : null;
            }, 60_000);
            System.out.println("  stored " + stored);
            for (String name : stored) {
                // The UID another program chose is what the file is named after, so the same
                // file read twice resolves to the same entry rather than a copy.
                if (! name.startsWith("imported-"))
                    throw new AssertionError("An imported entry lost its own identity: " + name);
            }
            Set<String> titles = new HashSet<>();
            for (String name : stored)
                titles.add(CalendarApp.property(CalendarApp.read(d, month, name), "SUMMARY"));
            for (String title : TITLES)
                if (! titles.contains("SUMMARY:" + title))
                    throw new AssertionError("Imported titles are " + titles + ", missing " + title);
            System.out.println("  ok   every entry stored under the UID it came with");

            // --- and again ---------------------------------------------------------------------
            handFile(d, source);
            String second = importSummary(d);
            System.out.println("  second summary: " + second);
            if (! second.contains("already existed"))
                throw new AssertionError("A second import did not recognise its own entries: " + second);
            CalendarApp.inFrame(d, CalendarApp.click("import-summary-ok") + "return 1;");
            List<String> afterSecond = CalendarApp.list(d, month);
            if (afterSecond.size() != TITLES.length)
                throw new AssertionError("A second import of the same file left " + afterSecond);
            System.out.println("  ok   importing it twice stores it once");

            // --- out --------------------------------------------------------------------------
            CalendarApp.inFrame(d,
                    "document.getElementById('sidebar-toggle-button').click();"
                            + "document.querySelector('.calendar-menu-button').click();"
                            + "let out = Array.from(document.querySelectorAll('.calendar-menu button'))"
                            + "  .filter(b => b.textContent.trim().indexOf('Export') !== -1)[0];"
                            + "if (!out) throw new Error('the calendar menu offers no Export');"
                            + "out.click(); return 1;");
            Downloads.Result exported = Downloads.awaitMatching(downloads, "", ".ics", 120_000, 20_000);
            if (exported.path == null)
                throw new AssertionError("No .ics was written to " + downloads
                        + ", saw " + Arrays.toString(downloads.toFile().list()));
            String out = Files.readString(exported.path);
            System.out.println("  exported " + exported.path.getFileName() + ", " + exported.size + " bytes");
            for (String title : TITLES)
                CalendarApp.assertContains(out, "SUMMARY:" + title);
            // One document holding every event of the calendar, not one per entry: the export
            // walks the whole store, so it carries at least what this test put there.
            int events = out.split("BEGIN:VEVENT", -1).length - 1;
            if (events < TITLES.length)
                throw new AssertionError("The export holds " + events + " events:\n" + out);
            if (out.split("BEGIN:VCALENDAR", -1).length - 1 != 1)
                throw new AssertionError("The export is not one calendar document:\n" + out);
            CalendarApp.assertContains(out, "END:VCALENDAR");
            System.out.println("  ok   one document, " + events + " events, all of them readable");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Hands the file picker a path, the way the upload tests do. */
    static void handFile(WebDriver d, Path source) {
        d.switchToFrame(CalendarApp.FRAME);
        try {
            Object input = d.find("#ics-file-input");
            if (input == null)
                throw new AssertionError("The app has no file input to import through");
            d.sendKeys(input, source.toAbsolutePath().toString());
        } finally {
            d.switchToTop();
        }
    }

    static String importSummary(WebDriver d) {
        CalendarApp.waitInFrame(d, "the import summary",
                "document.getElementById('import-summary-modal-backdrop').classList.contains('open')",
                60_000);
        return String.valueOf(CalendarApp.inFrame(d,
                "return document.getElementById('import-summary-message').textContent"));
    }
}
