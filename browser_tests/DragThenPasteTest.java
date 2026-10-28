import java.nio.file.*;
import java.util.*;

/** A file cut, another dragged and let go nowhere, then Paste.
 *
 *  A drag used the clipboard for what it carried, so it replaced the file that was cut, and
 *  with an entry that had no path: Paste then threw, left the spinner up for good, and moved
 *  nothing. A drag now carries its own, and the cut file is what Paste moves.
 *
 *  Usage: java -cp ../server/Peergos.jar DragThenPasteTest.java [engine] [url]
 */
public class DragThenPasteTest {
    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String FOLDER = "drag-paste-" + RUN, INTO = "into";
    static final String CUT = "cut-" + RUN + ".txt", DRAGGED = "dragged-" + RUN + ".txt";

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
        Fixtures.commands(serverDir.resolve("Peergos.jar"), url, Server.USERNAME, Server.PASSWORD,
                "mkdir " + FOLDER, "cd " + FOLDER, "mkdir " + INTO,
                "put " + Fixtures.patternFile(CUT, 64).toAbsolutePath(),
                "put " + Fixtures.patternFile(DRAGGED, 64).toAbsolutePath());
        String folder = "/" + Server.USERNAME + "/" + FOLDER, into = folder + "/" + INTO;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-drag-paste-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            Page.openPath(d, folder, FOLDER);
            Page.waitForInDrive(d, DRAGGED, 120_000);
            d.script("if (!window.__drive.isGrid) window.__drive.switchView(); return 1;");
            Page.select(d, CUT);
            d.script("window.__drive.cut(); window.__drive.selectedFiles = []; return 1;");
            // picked up and let go over nothing: a drag start and its end, with no drop between
            Object dragged = d.script("const vm = window.__drive;"
                    + "const i = vm.sortedFiles.findIndex(f => f.getFileProperties().name === arguments[0]);"
                    + "const card = document.querySelector('figure[draggable][id=\"' + i + '\"]');"
                    + "if (!card) return 'no card for ' + arguments[0];"
                    + "const dt = new DataTransfer();"
                    + "card.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: dt}));"
                    + "card.dispatchEvent(new DragEvent('dragend', {bubbles: true, dataTransfer: dt}));"
                    + "return 'dragged';", DRAGGED);
            if (! "dragged".equals(String.valueOf(dragged)))
                throw new IllegalStateException("Could not drag " + DRAGGED + ": " + dragged);
            Page.openPath(d, into, INTO);
            Object pasted = d.script("try { window.__drive.paste(); return 'pasted'; } catch (e) { return 'threw: ' + e; }");
            if (! "pasted".equals(String.valueOf(pasted)))
                throw new AssertionError("Paste after a drag that went nowhere " + pasted
                        + (Boolean.TRUE.equals(d.scriptQuiet("return window.__drive.showSpinner")) ? ", with the spinner left up" : ""));
            long end = System.currentTimeMillis() + 60_000;
            while (System.currentTimeMillis() < end && ! namesIn(d, into).contains(CUT) && ! Page.errorShown(d))
                WebDriver.sleep(500);
            List<String> inside = namesIn(d, into), beside = namesIn(d, folder);
            if (! inside.contains(CUT))
                throw new AssertionError("Paste after a drag that went nowhere did not move the cut file: "
                        + into + " holds " + inside + (Page.errorShown(d) ? ", the page says " + Page.errorText(d) : ""));
            if (! beside.contains(DRAGGED) || inside.contains(DRAGGED))
                throw new AssertionError("The file only dragged moved: " + folder + " holds " + beside + ", " + into + " " + inside);
            System.out.println("  ok   the cut file moved, the dragged one stayed: " + inside);
            d.waitForScript("the spinner to come down", "!window.__drive.showSpinner", 30_000);

            // --- dropped on a folder: the drop takes what the drag carried --------------------------
            // with no dragend after it, as when the move re-renders the card the drag started from
            Page.openPath(d, folder, FOLDER);
            Page.waitForInDrive(d, DRAGGED, 60_000);
            d.script("if (!window.__drive.isGrid) window.__drive.switchView(); return 1;");
            WebDriver.sleep(1000);
            Object dropped = d.script("const vm = window.__drive;"
                    + "const card = n => document.querySelector('figure[draggable][id=\"'"
                    + "  + vm.sortedFiles.findIndex(f => f.getFileProperties().name === n) + '\"]');"
                    + "const from = card(arguments[0]), to = card(arguments[1]);"
                    + "if (!from || !to) return 'no cards';"
                    + "const dt = new DataTransfer();"
                    + "from.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: dt}));"
                    + "to.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt}));"
                    + "return vm.dragged == null ? 'taken' : 'still carried';", DRAGGED, INTO);
            if (! "taken".equals(String.valueOf(dropped)))
                throw new AssertionError("After a drop on a folder, the drag is " + dropped
                        + ": a later drop of anything else onto a folder would move that file again");
            d.waitUntil(DRAGGED + " to arrive in " + INTO, () -> namesIn(d, into).contains(DRAGGED), 60_000);
            System.out.println("  ok   dropped on a folder, it moved there and the drop let go of it");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** What a folder holds now, read from the store rather than from the view. */
    static List<String> namesIn(WebDriver d, String path) {
        d.script("window.__names = null; const ctx = window.__drive.context;"
                + "ctx.getByPath(arguments[0]).thenApply(o => o.get().getChildren(ctx.crypto.hasher, ctx.network)"
                + "  .thenApply(kids => { window.__names = kids.toArray([]).map(f => String(f.getName())); }))"
                + ".exceptionally(t => { window.__names = ['error: ' + t]; });", path);
        d.waitForScript("a listing of " + path, "window.__names !== null", 60_000);
        List<String> names = new ArrayList<>();
        for (Object name : (List<?>) d.script("return window.__names;"))
            names.add(String.valueOf(name));
        return names;
    }
}
