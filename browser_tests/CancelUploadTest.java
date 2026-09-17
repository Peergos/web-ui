import java.nio.file.*;
import java.util.*;

/** Cancels an upload from its progress toast, part way through a file of many chunks.
 *
 *  What a cancel has to leave is nothing: no entry for the file, no upload transaction, and the
 *  chunks that did go up no longer counted against the account. The page has to carry on as
 *  though nothing went wrong - no error dialog - and the next upload has to work. Every one of
 *  those is read back from the server, not from the page.
 *
 *  Usage: java -cp ../server/Peergos.jar CancelUploadTest.java [engine] [url]
 */
public class CancelUploadTest {

    static final int SIZE = Integer.getInteger("upload.size", 120 * 1024 * 1024);
    static final int LATENCY_MILLIS = Integer.getInteger("latency.ms", 150);
    // directory metadata and the like, which a cancel does not have to give back
    static final long USAGE_TOLERANCE = 1024 * 1024;

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
        Path jar = serverDir.resolve("Peergos.jar");

        Server own = given == null ? Server.start(serverDir) : null;
        String upstream = own != null ? own.url() : given;
        Proxy proxy = new Proxy(0, java.net.URI.create(upstream));
        proxy.start();
        String url = "http://localhost:" + proxy.port();

        String name = "cancelled-" + System.currentTimeMillis() + ".bin";
        Path source = Fixtures.patternFile(name, SIZE);
        Path downloads = Temp.directory("peergos-cancel-upload-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            long initialUsage = usage(d);
            // the suite shares a server, so only what this upload leaves behind counts
            List<String> openBefore = Fixtures.listing(jar, upstream, Server.USERNAME, Server.PASSWORD, ".transactions");
            System.out.println("usage before " + initialUsage + ", open upload transactions " + openBefore);

            // slow enough that there is an upload in flight to cancel
            proxy.configure(LATENCY_MILLIS, 0, 0);
            upload(d, engine, source, name, SIZE);
            d.waitForScript("the upload to be part way",
                    "(() => { const bar = document.querySelector('.Vue-Toastification__toast .progress__bar span');"
                            + " return bar != null && parseFloat(bar.style.width) >= 10"
                            + "   && !!document.querySelector('.progress__cancel'); })()", 300_000);
            System.out.println("  progress " + d.script("return document.querySelector('.progress__bar span').style.width"));
            d.script("document.querySelector('.progress__cancel').click(); return 1;");

            d.waitForScript("the cancelled message",
                    "[...document.querySelectorAll('.Vue-Toastification__toast')].some(t => t.innerText.includes('Upload cancelled'))", 30_000);
            try {
                // the toast leaves with a transition
                d.waitForScript("the progress toast to go", "!document.querySelector('.app-progressbar')", 10_000);
            } catch (RuntimeException e) {
                throw new AssertionError("The progress toast is still up after cancelling: " + Page.inFlight(d));
            }
            System.out.println("  ok   toast says the upload was cancelled");
            proxy.configure(0, 0, 0);

            // the upload stops at the next chunk and then clears up after itself
            WebDriver.sleep(10_000);
            if (Page.errorShown(d))
                throw new AssertionError("A cancel was reported as an error: " + Page.errorText(d));
            System.out.println("  ok   no error dialog");
            List<String> root = Fixtures.listing(jar, upstream, Server.USERNAME, Server.PASSWORD);
            if (root.contains(name))
                throw new AssertionError("The cancelled file is in the drive: " + root);
            System.out.println("  ok   the file is not in the drive");
            List<String> open = new ArrayList<>(Fixtures.listing(jar, upstream, Server.USERNAME, Server.PASSWORD, ".transactions"));
            open.removeAll(openBefore);
            if (! open.isEmpty())
                throw new AssertionError("Upload transactions left open: " + open);
            System.out.println("  ok   no upload transaction left open");
            long after = usage(d);
            for (int i = 0; i < 60 && after >= initialUsage + USAGE_TOLERANCE; i++) {
                WebDriver.sleep(1_000);
                after = usage(d);
            }
            if (after >= initialUsage + USAGE_TOLERANCE)
                throw new AssertionError("Usage did not come back: " + initialUsage + " before, " + after + " after");
            System.out.println("  ok   usage back to " + after);

            // and the page can still upload
            String next = "after-cancel-" + System.currentTimeMillis() + ".bin";
            Path nextSource = Fixtures.patternFile(next, 6 * 1024 * 1024);
            upload(d, engine, nextSource, next, 6 * 1024 * 1024);
            Page.waitForInDrive(d, next, 300_000);
            Fixtures.awaitListing(jar, upstream, Server.USERNAME, Server.PASSWORD, null, 120_000, next);
            System.out.println("  ok   a later upload lands");
            System.out.println("PASS");
        } finally {
            proxy.stop();
            if (own != null)
                own.close();
        }
    }

    static void upload(WebDriver d, String engine, Path source, String name, int size) {
        if (Page.canDriveFilePicker(engine))
            d.sendKeys(d.find("#uploadFileInput"), source.toAbsolutePath().toString());
        else
            Page.handFiles(d, Map.of(name, size));
    }

    static long usage(WebDriver d) {
        d.script("window.__usage = null;"
                + "window.__drive.context.getSpaceUsage(false).thenApply(u => { window.__usage = Number(u.toString()); });"
                + "return 1;");
        Object value = d.waitUntil("the space usage", () -> d.scriptQuiet("return window.__usage"), 60_000);
        return ((Number) value).longValue();
    }
}
