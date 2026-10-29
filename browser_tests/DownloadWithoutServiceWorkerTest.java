import java.nio.file.*;

/** A download in a browser with no service worker to stream it through.
 *
 *  A page served over plain http from anywhere but localhost - a server on a home network - gets no
 *  service worker, and the downloader then reads the file into memory 5 MiB at a time and hands
 *  the browser the whole of it. The read count comes back as a boxed java Integer, and added to
 *  the offset as it is, it turns the offset into a string: the second read starts at "05242880"
 *  and the download fails. So a file of more than one block, checked byte for byte.
 *
 *  Usage: java -cp ../server/Peergos.jar DownloadWithoutServiceWorkerTest.java [engine] [url]
 */
public class DownloadWithoutServiceWorkerTest {

    static final long SIZE = 12L * 1024 * 1024 + 7;

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
        Path jar = serverDir.resolve("Peergos.jar");
        Path source = Fixtures.localFile("no-service-worker.bin", SIZE);
        Fixtures.upload(jar, url, Server.USERNAME, Server.PASSWORD, source);
        String path = "/" + Server.USERNAME + "/no-service-worker.bin";

        Path downloads = Temp.directory("peergos-no-sw-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            Page.resolve(d, path);
            // what the downloader asks before choosing how to save, answered as such a page would
            d.script("window.__drive.supportsStreaming = () => false; return 1;");
            Page.download(d, path);

            Downloads.Result result = Downloads.await(downloads, "no-service-worker.bin", 300_000, 15_000);
            System.out.println("  downloaded: " + result);
            if (result.path == null)
                System.out.println("  the page says: " + d.scriptQuiet(
                        "return window.__drive.errorTitle + ' / ' + window.__drive.errorBody"));
            Downloads.assertMatches(result, source, SIZE);
            System.out.println("  ok   all " + SIZE + " bytes, hash matches the source");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
