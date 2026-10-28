import java.nio.file.*;
import java.util.*;

/** A selection with an empty file in it, downloaded.
 *
 *  A download was finished by its last read, and an empty file has nothing to read: its
 *  download never completed and its toast stayed up. A selection downloads one file after
 *  another, so every file after the empty one never came. Checked on the files the browser saves.
 *
 *  Usage: java -cp ../server/Peergos.jar EmptyFileDownloadTest.java [engine] [url]
 */
public class EmptyFileDownloadTest {
    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String FOLDER = "empty-dl-" + RUN;
    static final String EMPTY = "empty-" + RUN + ".txt", AFTER = "after-" + RUN + ".bin";
    static final int AFTER_SIZE = 4096;

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
        Path empty = Fixtures.patternFile(EMPTY, 0);
        Path after = Fixtures.patternFile(AFTER, AFTER_SIZE);
        Fixtures.commands(serverDir.resolve("Peergos.jar"), url, Server.USERNAME, Server.PASSWORD,
                "mkdir " + FOLDER, "cd " + FOLDER, "put " + empty.toAbsolutePath(), "put " + after.toAbsolutePath());
        Path downloads = Temp.directory("peergos-empty-dl-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            Page.openPath(d, "/" + Server.USERNAME + "/" + FOLDER, FOLDER);
            Page.waitForInDrive(d, AFTER, 120_000);
            // the empty one first: a selection is downloaded in the order it was picked
            d.script("const vm = window.__drive;"
                    + "const byName = n => vm.sortedFiles.find(f => f.getFileProperties().name === n);"
                    + "vm.selectedFiles = [byName(arguments[0]), byName(arguments[1])];"
                    + "vm.downloadAllMultiSelect(); return 1;", EMPTY, AFTER);
            Downloads.Result second = Downloads.await(downloads, AFTER, 120_000, 30_000);
            if (second.path == null)
                throw new AssertionError("The file picked after the empty one was never downloaded. The page shows "
                        + Page.inFlight(d) + ", the download directory holds " + Downloads.listing(downloads));
            Downloads.assertMatches(second, after, AFTER_SIZE);
            System.out.println("  ok   the file after the empty one arrived intact");
            Path saved = downloads.resolve(EMPTY);
            if (! Files.exists(saved) || Files.size(saved) != 0)
                throw new AssertionError("The empty file was not saved as an empty file: " + Downloads.listing(downloads));
            System.out.println("  ok   the empty file was saved, 0 bytes");
            d.waitUntil("the empty file's toast to go", () -> ! Page.inFlight(d).contains(EMPTY), 30_000);
            System.out.println("  ok   and no toast is left for it");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
