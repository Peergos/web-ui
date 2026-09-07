import java.nio.file.*;
import java.nio.file.Paths;

/** Regression test for 3cee931b.
 *
 *  Starting a second download while a first is still running used to truncate the first, in
 *  Firefox only, and silently: the anchor click navigated the top level page, Firefox cancelled
 *  the page's in flight XHRs without firing load, error, abort or timeout on any of them, and
 *  every future waiting on one of those requests was stranded. The reader stopped mid file, the
 *  writer was never closed, and the user got a plausible looking file with no error at all.
 *
 *  It only reproduces with latency in front of the server. At zero added latency both downloads
 *  finish cleanly even on the broken build.
 *
 *  Usage: java -cp ../server/Peergos.jar ConcurrentDownloadTest.java [engine] [proxyPort] [upstream]
 */
public class ConcurrentDownloadTest {

    // Big enough that the first download is still running when the second starts, small enough
    // that uploading the fixtures does not dominate the run. With 2500ms of added latency a file
    // this size takes about a minute to come down.
    static final long SIZE = Long.getLong("fixture.size", 60L * 1024 * 1024);
    static final int LATENCY_MILLIS = Integer.getInteger("latency.ms", 2500);

    public static void main(String[] args) throws Exception {
        try {
            run(args);
        } catch (AssertionError e) {
            System.out.println(e.getMessage());
            System.exit(1);
        }
    }

    /** Throws AssertionError if the downloads are not intact, so Suite can keep going. */
    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String givenUpstream = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();

        // With no url given the test owns its server: its own port, its own PEERGOS_PATH, stopped
        // by process handle. Pass one to run against a server that is already up.
        Server own = givenUpstream == null ? Server.start(serverDir) : null;
        String upstream = own != null ? own.url() : givenUpstream;
        if (own != null)
            System.out.println("started a server at " + upstream);

        Path jar = Paths.get("..", "server", "Peergos.jar").toAbsolutePath().normalize();
        Path srcA = Fixtures.localFile("dlA.bin", SIZE);
        Path srcB = Fixtures.localFile("dlB.bin", SIZE);
        Fixtures.upload(jar, upstream, "peergos", "testpassword", srcA);
        Fixtures.upload(jar, upstream, "peergos", "testpassword", srcB);
        String fileA = "/peergos/dlA.bin", fileB = "/peergos/dlB.bin";

        Proxy proxy = new Proxy(0, java.net.URI.create(upstream));
        proxy.start();
        String url = "http://localhost:" + proxy.port() + "/";
        System.out.println("proxy " + url + " -> " + upstream);

        Path downloads = Files.createTempDirectory("peergos-dl-");
        int failures = 0;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url);
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, "peergos", "testpassword");
            Page.gotoDrive(d);
            Page.resolve(d, fileA);
            Page.resolve(d, fileB);
            long sizeA = Page.size(d, fileA), sizeB = Page.size(d, fileB);
            System.out.println("dlA.bin " + sizeA + " bytes, dlB.bin " + sizeB + " bytes");

            // Latency goes on only now. Signing in makes far too many round trips to sit behind
            // 1500ms each, and the bug is about downloads racing, not about a slow login.
            proxy.configure(LATENCY_MILLIS, 0, 0);
            System.out.println("added " + LATENCY_MILLIS + "ms latency to storage requests");

            Page.download(d, fileA);
            WebDriver.sleep(5_000);
            Page.download(d, fileB);       // the second download is what used to break the first
            // A download that never puts a file on disk has either not started in the page or
            // been dropped by the browser, and only the app's own progress says which.
            WebDriver.sleep(5_000);
            System.out.println("  in flight after starting both: " + Page.inFlight(d));

            Downloads.Result a = Downloads.await(downloads, "dlA.bin", 900_000, 45_000);
            Downloads.Result b = Downloads.await(downloads, "dlB.bin", 900_000, 45_000);
            System.out.println("  first  " + a);
            System.out.println("  second " + b);
            if (a.path == null || b.path == null) {
                System.out.println("  download directory holds: " + Downloads.listing(downloads));
                System.out.println("  in flight at that point: " + Page.inFlight(d));
                if (a.path == null)
                    System.out.println("  dlA anywhere: " + Downloads.findAnywhere(downloads.getParent(), "dlA"));
                if (b.path == null)
                    System.out.println("  dlB anywhere: " + Downloads.findAnywhere(downloads.getParent(), "dlB"));
            }
            if (b.path == null)
                System.out.println("  in flight when the second never arrived: " + Page.inFlight(d));

            failures += check("first download intact", a, sizeA, srcA);
            failures += check("second download intact", b, sizeB, srcB);

            if (Page.errorShown(d))
                System.out.println("  app reported: " + Page.errorText(d));
        } finally {
            proxy.stop();
            if (own != null)
                own.close();
        }
        if (failures > 0)
            throw new AssertionError("FAIL (" + failures + " of 2 downloads not intact)");
        System.out.println("PASS");
    }

    /** Without a source file to hash against, assert length and that it did not stall. */
    private static int check(String what, Downloads.Result r, long expected, Path source) {
        if (r.path == null) {
            System.out.println("  FAIL " + what + ": no file appeared");
            return 1;
        }
        if (r.stalled) {
            System.out.println("  FAIL " + what + ": stalled at " + r.size + " of " + expected);
            return 1;
        }
        if (r.size != expected) {
            System.out.println("  FAIL " + what + ": " + r.size + " bytes, expected " + expected);
            return 1;
        }
        String got = Downloads.sha256(r.path), want = Downloads.sha256(source);
        if (! got.equals(want)) {
            System.out.println("  FAIL " + what + ": hash " + got.substring(0, 16)
                    + " does not match source " + want.substring(0, 16));
            return 1;
        }
        System.out.println("  ok   " + what + " (" + r.size + " bytes, hash matches source)");
        return 0;
    }
}
