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
        String serverLog = null;
        try (Server server = Server.start(serverDir)) {
            System.out.println("server at " + server.url() + ", engine " + engine);
            String[] args1 = {engine, server.url()};
            run(failures, "smoke", () -> SmokeTest.main(new String[]{engine, server.url() + "/"}));
            // Before anything uploads: if the browser's BLAKE3 disagreed with the Java one,
            // every later hash in the run is built on it, and the failure to look at is this.
            run(failures, "browser and java blake3 agree", () -> Blake3AgreementTest.run(args1));
            run(failures, "a secret link over several items", () -> MultiLinkCheck.run(args1));
            run(failures, "the links overview and adding to a link", () -> LinksOverviewCheck.run(args1));
            run(failures, "the secret link editor", () -> LinkEditorCheck.run(args1));
            run(failures, "upload file", () -> UploadTest.run(args1));
            run(failures, "upload a group of files", () -> UploadGroupTest.run(args1));
            run(failures, "upload folder", () -> UploadFolderTest.run(args1));
            run(failures, "render a pdf in the pdf app", () -> PdfRenderTest.run(args1));
            run(failures, "follow markdown links", () -> MarkdownLinksTest.run(args1));
            run(failures, "html viewer links and images", () -> HtmlViewerTest.run(args1));
            run(failures, "cancel an upload", () -> CancelUploadTest.run(args1));
            // The one thing a phone does differently: its panel must not decide how the next
            // desktop session opens. Cheap, and no engine here is too wide to be a phone.
            run(failures, "the drive on a phone", () -> MobileNavTest.run(args1));
            // Picking files out of the grid, which a pointer and a touch screen reach in
            // different ways and which the file menu must not be mistaken for.
            run(failures, "picking files in the grid", () -> GridSelectionTest.run(args1));
            // Sorting is shared state drawn by two views: the header's menu sets it, the
            // table's headings set it, and both views must follow whichever did.
            run(failures, "sorting a listing from either view", () -> GridSortTest.run(args1));

            // Neither WebKitWebDriver nor safaridriver can be told where downloads go, so
            // everything that asserts on a downloaded file runs on the engines that can. WebKit
            // download coverage belongs with the gtk host, which sets the destination itself.
            // The two downloads that predate the calendar keep their place near the start of
            // the run: they are timing-sensitive on the slower runners, and the calendar tests
            // are minutes of extra load on the shared server that they should not run behind.
            boolean canPlaceDownloads = ! engine.startsWith("webkit") && ! engine.equals("safari");
            if (canPlaceDownloads) {
                run(failures, "concurrent downloads", () -> ConcurrentDownloadTest.run(args1));
                run(failures, "download folder as zip", () -> ZipFolderDownloadTest.run(args1));
            }

            run(failures, "calendar event round trip", () -> CalendarEventTest.run(args1));
            run(failures, "calendar repeat and reminder", () -> CalendarRepeatTest.run(args1));
            run(failures, "calendar task", () -> CalendarTaskTest.run(args1));
            run(failures, "calendar sharing stays with the host", () -> CalendarSharingTest.run(args1));
            run(failures, "calendar repeat shapes", () -> CalendarRecurrenceTest.run(args1));
            run(failures, "calendar series edits", () -> CalendarSeriesTest.run(args1));
            run(failures, "calendar to and from the previous app", () -> CalendarLegacyTest.run(args1));
            run(failures, "calendar files read by another parser", () -> CalendarInteropTest.run(args1));
            run(failures, "calendar drag to move", () -> CalendarDragTest.run(args1));
            run(failures, "calendar shared read-only", () -> CalendarReadOnlyTest.run(args1));
            run(failures, "calendar writable link", () -> CalendarLinkWriteTest.run(args1));
            // Two accounts, a friendship and four sign-ins: minutes rather than seconds, and
            // the slow runners already spend most of their hour on the rest of this. WebKit
            // is left out for a different reason - it cannot be relied on here to bring the
            // calendar up for an account opening it for the first time, which is the driver
            // rather than the app, and the same reason downloads skip it. Every other engine
            // runs it, which is where most of the matrix is.
            if (canPlaceDownloads && ! "1".equals(System.getenv("PEERGOS_TEST_SLOW"))) {
                run(failures, "calendar entries shared between accounts", () -> CalendarLiveShareTest.run(args1));
                // A whole calendar rather than one entry, and the one people actually share:
                // the calendar their account came with, which the recipient has a namesake of.
                run(failures, "whole calendar shared between accounts", () -> CalendarWholeShareTest.run(args1));
                // Leaving has to be as complete as arriving: this one exports a calendar,
                // imports it into an account that has never seen it, and exports that.
                run(failures, "calendar moved to another account", () -> CalendarMigrationTest.run(args1));
                // Four downloads of a 200MiB file, each left 30s to show it stopped.
                run(failures, "cancel downloads", () -> CancelDownloadTest.run(args1));
            }
            run(failures, "calendar store safety", () -> CalendarStoreTest.run(args1));
            if (canPlaceDownloads) {
                run(failures, "download calendar event", () -> CalendarEventDownloadTest.run(args1));
                // The export half of this one downloads a file, so it belongs with the group
                // that can say where downloads land.
                run(failures, "calendar import and export", () -> CalendarImportExportTest.run(args1));
            } else {
                System.out.println("\nSKIP the download tests on " + engine
                        + ": its driver has no download directory capability");
            }
            if (! failures.isEmpty())
                serverLog = server.tailLog(120);
        }

        System.out.println();
        if (! failures.isEmpty() && serverLog != null) {
            System.out.println("--- the end of the server's log");
            System.out.println(serverLog);
            System.out.println("--- end of server log");
            System.out.println();
        }
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
