import java.nio.file.*;
import java.util.*;

/** Cancels downloads part way: a file from its toast, the same file as the browser's own
 *  downloads list would, and a folder being zipped.
 *
 *  A cancelled download that keeps fetching and decrypting in the background looks exactly like
 *  one that stopped - the toast is gone either way - so what this counts is the storage requests
 *  reaching the server once the cancel has settled.
 *
 *  Usage: java -cp ../server/Peergos.jar CancelDownloadTest.java [engine] [url]
 */
public class CancelDownloadTest {

    // Big and slow enough that a download which ignored the cancel would still be fetching long
    // after the ones already in flight when it was pressed have landed.
    static final long SIZE = Long.getLong("fixture.size", 200L * 1024 * 1024);
    static final int LATENCY_MILLIS = Integer.getInteger("latency.ms", 1000);
    // a stray poll or two from the rest of the page, once what was in flight has landed
    static final int IDLE_ALLOWANCE = 4;

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
        Path source = Fixtures.localFile("cancel-dl.bin", SIZE);
        Fixtures.upload(jar, upstream, Server.USERNAME, Server.PASSWORD, source);
        String folder = "cancel-zip-" + System.currentTimeMillis();
        Fixtures.uploadInto(jar, upstream, Server.USERNAME, Server.PASSWORD, folder,
                List.of(Fixtures.localFile("cancel-zip-a.bin", SIZE / 2), Fixtures.localFile("cancel-zip-b.bin", SIZE / 2)));
        Fixtures.awaitListing(jar, upstream, Server.USERNAME, Server.PASSWORD, folder, 300_000,
                "cancel-zip-a.bin", "cancel-zip-b.bin");

        Proxy proxy = new Proxy(0, java.net.URI.create(upstream));
        proxy.start();
        String url = "http://localhost:" + proxy.port();
        Path downloads = Temp.directory("peergos-cancel-dl-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            String path = "/" + Server.USERNAME + "/cancel-dl.bin";
            Page.resolve(d, path);
            proxy.configure(LATENCY_MILLIS, 0, 0);

            // --- from the toast -------------------------------------------------------------
            System.out.println("cancelling a download from its toast");
            Page.download(d, path);
            awaitPartWay(d);
            int atCancel = cancelFromToast(d, proxy);
            awaitCancelledMessage(d);
            assertStopped(proxy, atCancel, "the cancelled download");
            assertNoCompleteFile(downloads, "cancel-dl", SIZE);
            dismissAll(d);

            // --- from the browser -----------------------------------------------------------
            // The downloads list is outside the page, so only firefox's driver can reach it.
            if (d instanceof MarionetteDriver) {
                System.out.println("cancelling a download in the browser's downloads list");
                Page.download(d, path);
                awaitPartWay(d);
                atCancel = cancelInBrowser((MarionetteDriver) d, proxy);
                awaitCancelledMessage(d);
                d.waitForScript("the progress toast to go", "!document.querySelector('.app-progressbar')", 30_000);
                assertStopped(proxy, atCancel, "the download the browser cancelled");
                assertNoCompleteFile(downloads, "cancel-dl", SIZE);
                dismissAll(d);
            }

            // --- a folder as a zip ----------------------------------------------------------
            System.out.println("cancelling a folder zip from its toast");
            startZip(d, proxy, folder);
            atCancel = cancelFromToast(d, proxy);
            awaitCancelledMessage(d);
            assertStopped(proxy, atCancel, "the cancelled zip");
            assertNoCompleteFile(downloads, "archive-", SIZE);
            dismissAll(d);

            if (d instanceof MarionetteDriver) {
                System.out.println("cancelling a folder zip in the browser's downloads list");
                startZip(d, proxy, folder);
                atCancel = cancelInBrowser((MarionetteDriver) d, proxy);
                awaitCancelledMessage(d);
                d.waitForScript("the progress toast to go", "!document.querySelector('.app-progressbar')", 30_000);
                assertStopped(proxy, atCancel, "the zip the browser cancelled");
                assertNoCompleteFile(downloads, "archive-", SIZE);
            }
            System.out.println("PASS");
        } finally {
            proxy.stop();
            if (own != null)
                own.close();
        }
    }

    static void startZip(WebDriver d, Proxy proxy, String folder) {
        proxy.configure(0, 0, 0);
        Page.waitForInDrive(d, folder, 120_000);
        Page.zipFolder(d, folder);
        Page.confirmYes(d, 120_000);
        proxy.configure(LATENCY_MILLIS, 0, 0);
        awaitPartWay(d);
    }

    static int cancelFromToast(WebDriver d, Proxy proxy) {
        int atCancel = proxy.stat("storage_requests");
        d.script("document.querySelector('.progress__cancel').click(); return 1;");
        return atCancel;
    }

    static int cancelInBrowser(MarionetteDriver d, Proxy proxy) {
        int atCancel = proxy.stat("storage_requests");
        Object cancelled = d.chromeScript(
                "const { Downloads } = ChromeUtils.importESModule('resource://gre/modules/Downloads.sys.mjs');"
                + "return Downloads.getList(Downloads.ALL).then(list => list.getAll()).then(all => {"
                + "  const running = all.filter(dl => ! dl.stopped);"
                + "  return Promise.all(running.map(dl => dl.cancel())).then(() => running.length);"
                + "});");
        System.out.println("  cancelled " + cancelled + " running download(s) in the browser");
        if (((Number) cancelled).intValue() == 0)
            throw new AssertionError("The browser had no running download to cancel");
        return atCancel;
    }

    static void awaitPartWay(WebDriver d) {
        d.waitForScript("the download to be part way",
                "(() => { const bar = document.querySelector('.Vue-Toastification__toast .progress__bar div');"
                        + " return bar != null && parseFloat(bar.style.width) >= 5"
                        + "   && !!document.querySelector('.progress__cancel'); })()", 300_000);
        System.out.println("  progress " + d.script("return document.querySelector('.progress__bar div').style.width"));
    }

    static void awaitCancelledMessage(WebDriver d) {
        d.waitForScript("the cancelled message",
                "[...document.querySelectorAll('.Vue-Toastification__toast')].some(t => t.innerText.includes('Download cancelled'))", 30_000);
        System.out.println("  ok   toast says the download was cancelled");
        if (Page.errorShown(d))
            throw new AssertionError("A cancel was reported as an error: " + Page.errorText(d));
    }

    /** The chunks already being fetched when it was cancelled - the reader fetches several ahead,
     *  each a handful of requests - get 15s to land. After that, nothing more. */
    static void assertStopped(Proxy proxy, int atCancel, String what) {
        WebDriver.sleep(15_000);
        int settled = proxy.stat("storage_requests");
        WebDriver.sleep(15_000);
        int later = proxy.stat("storage_requests") - settled;
        if (later > IDLE_ALLOWANCE)
            throw new AssertionError(what + " kept fetching: " + later + " storage requests between 15s and 30s after the cancel");
        System.out.println("  ok   " + what + " stopped fetching (" + (settled - atCancel)
                + " requests as it settled, " + later + " after)");
    }

    static void assertNoCompleteFile(Path downloads, String prefix, long size) throws Exception {
        try (var files = Files.list(downloads)) {
            for (Path f : files.toList()) {
                if (f.getFileName().toString().startsWith(prefix)
                        && ! f.getFileName().toString().endsWith(".part") && Files.size(f) >= size)
                    throw new AssertionError("A complete file landed for a cancelled download: " + f);
            }
        }
        System.out.println("  ok   no complete file in " + Downloads.listing(downloads));
    }

    static void dismissAll(WebDriver d) {
        d.script("window.__drive.$toast.clear(); return 1;");
        WebDriver.sleep(1_000);
    }
}
