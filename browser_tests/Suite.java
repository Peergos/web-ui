import java.nio.file.*;
import java.util.*;

/** Runs the browser tests against one engine, sharing a single server across them.
 *
 *  Usage: java -cp ../server/Peergos.jar Suite.java [firefox|chromium|webkit]
 */
public class Suite {

    public static void main(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();

        List<String> failures = new ArrayList<>();
        try (Server server = Server.start(serverDir)) {
            System.out.println("server at " + server.url() + ", engine " + engine);
            String[] args1 = {engine, server.url()};
            run(failures, "smoke", () -> SmokeTest.main(new String[]{engine, server.url() + "/"}));
            run(failures, "upload file", () -> UploadTest.run(args1));
            run(failures, "upload a group of files", () -> UploadGroupTest.run(args1));
            run(failures, "upload folder", () -> UploadFolderTest.run(args1));
            run(failures, "render a pdf in the pdf app", () -> PdfRenderTest.run(args1));
            run(failures, "follow markdown links", () -> MarkdownLinksTest.run(args1));
            run(failures, "html viewer links and images", () -> HtmlViewerTest.run(args1));

            // Neither WebKitWebDriver nor safaridriver can be told where downloads go, so
            // everything that asserts on a downloaded file runs on the engines that can. WebKit
            // download coverage belongs with the gtk host, which sets the destination itself.
            boolean canPlaceDownloads = ! engine.startsWith("webkit") && ! engine.equals("safari");
            if (canPlaceDownloads) {
                run(failures, "concurrent downloads", () -> ConcurrentDownloadTest.run(args1));
                run(failures, "download folder as zip", () -> ZipFolderDownloadTest.run(args1));
                run(failures, "download calendar event", () -> CalendarEventDownloadTest.run(args1));
            } else {
                System.out.println("\nSKIP the download tests on " + engine
                        + ": its driver has no download directory capability");
            }
        }

        System.out.println();
        if (failures.isEmpty()) {
            System.out.println("all tests passed on " + engine);
        } else {
            System.out.println(failures.size() + " failed on " + engine + ": " + failures);
            System.exit(1);
        }
    }

    private interface Test {
        void run() throws Exception;
    }

    private static void run(List<String> failures, String name, Test test) {
        System.out.println("\n--- " + name);
        long start = System.currentTimeMillis();
        try {
            test.run();
            System.out.println("--- " + name + " passed in " + (System.currentTimeMillis() - start) / 1000 + "s");
        } catch (Throwable t) {
            System.out.println("--- " + name + " FAILED: " + t);
            t.printStackTrace(System.out);
            failures.add(name);
        }
    }
}
