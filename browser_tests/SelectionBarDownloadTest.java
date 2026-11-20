import java.nio.file.*;
import java.util.*;

/** Downloads a folder from the selection bar - "With 1 selected", then Download - and answers the
 *  question it asks with real clicks, hit-tested by the browser.
 *
 *  The drive asked whether to zip the folder with its full-screen spinner still up, and the spinner
 *  is drawn over dialogs: a person could click neither the answers nor the close button, and the
 *  spinner never came down. ZipFolderDownloadTest answers from script, which reaches the button
 *  through the spinner, and checks the zip itself; this checks that a person can answer.
 *
 *  Usage: java -cp ../server/Peergos.jar SelectionBarDownloadTest.java [engine] [url]
 */
public class SelectionBarDownloadTest {

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
        String url = own != null ? own.url() : given;
        Fixtures.Account me = Fixtures.account(url);
        String folder = "barzip";
        Path file = Temp.directory("peergos-barzip-").resolve("notes.txt");
        Files.writeString(file, "a folder downloaded from the selection bar\n");
        try {
            Fixtures.uploadInto(jar, url, me.name(), me.password(), folder, List.of(file));
            Fixtures.awaitListing(jar, url, me.name(), me.password(), folder, 300_000, "notes.txt");

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-barzip-dl-"), headless)) {
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, me.name(), me.password());
                Page.gotoDrive(d);
                Page.waitForInDrive(d, folder, 120_000);

                // closed first: a zip that finishes clears the selection, under a second question
                askToDownload(d, folder);
                click(d, ".pg-dialog .pg-dialog__close", "the close button");
                awaitIdle(d, "after closing the question");
                System.out.println("  ok   the question can be closed, and nothing is left spinning");

                askToDownload(d, folder);
                click(d, ".pg-dialog .pg-btn--primary", "Yes");
                d.waitForScript("the zip to go ahead", "window.__drive.zipAndDownloadFoldersCount > 0", 60_000);
                awaitIdle(d, "after answering Yes");
                System.out.println("  ok   Yes can be clicked, the zip goes ahead and the spinner comes down");
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Picks the folder, then opens the selection bar's menu and picks Download by real clicks. */
    private static void askToDownload(WebDriver d, String folder) {
        Object picked = d.script("const vm = window.__drive;"
                + "const f = vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0]);"
                + "if (! f) return 'no ' + arguments[0] + ' in the drive';"
                + "vm.pickFromList([f]); return true;", folder);
        if (! Boolean.TRUE.equals(picked))
            throw new IllegalStateException(String.valueOf(picked));
        d.waitForScript("the selection bar", "!!document.querySelector('.drive-selected .app-dropdown')", 10_000);
        click(d, ".drive-selected .app-dropdown > .app-button", "With 1 selected");
        d.waitForScript("the selection menu", "!!document.querySelector('.drive-selected li#download')", 10_000);
        click(d, ".drive-selected li#download", "Download");
        d.waitForScript("the zip question", "window.__drive.showConfirm", 60_000);
    }

    /** A real click, which the browser refuses when something else is on top of the element. */
    private static void click(WebDriver d, String css, String what) {
        Object element = d.find(css);
        if (element == null)
            throw new IllegalStateException("Nothing to click for " + what + " (" + css + ")");
        try {
            d.click(element);
        } catch (IllegalStateException e) {
            if (! String.valueOf(e.getMessage()).contains("click intercepted"))
                throw e;
            String onTop = String.valueOf(d.scriptQuiet("const r = document.querySelector(arguments[0])"
                    + ".getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2,"
                    + " r.top + r.height / 2); return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '');", css));
            throw new AssertionError("A person cannot click " + what + ": " + onTop + " is on top of it; "
                    + state(d));
        }
    }

    private static void awaitIdle(WebDriver d, String when) {
        long end = System.currentTimeMillis() + 60_000;
        while (System.currentTimeMillis() < end) {
            if (Boolean.TRUE.equals(d.script("return !window.__drive.showSpinner && !window.__drive.showConfirm;")))
                return;
            WebDriver.sleep(500);
        }
        throw new AssertionError("The drive is still busy a minute " + when + "; " + state(d));
    }

    private static String state(WebDriver d) {
        return String.valueOf(d.scriptQuiet("const vm = window.__drive;"
                + "return 'spinner=' + vm.showSpinner + ' question=' + vm.showConfirm;"));
    }
}
