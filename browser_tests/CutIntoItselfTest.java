import java.nio.file.*;
import java.util.*;

/** A folder cut with the selection bar and pasted into one of its own subfolders.
 *
 *  The move refuses a folder going into its own descendant, and it decides that from the path the
 *  folder was cut from. Handed the folder being pasted into instead, the check compares the target
 *  with a path that does not exist, passes, and the folder is linked inside itself and unlinked
 *  from its parent: nothing reaches it any more. The single-item Cut always refused this; the
 *  selection bar's Cut has to as well, and leave the view usable to say so.
 *
 *  Usage: java -cp ../server/Peergos.jar CutIntoItselfTest.java [engine] [url]
 */
public class CutIntoItselfTest {

    static final String HOME = "cut-into-itself";
    static final String FOLDER = "moving";
    static final String SUB = "inner";

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
                "mkdir " + HOME, "cd " + HOME, "mkdir " + FOLDER, "cd " + FOLDER, "mkdir " + SUB, "cd " + SUB,
                "put " + Fixtures.patternFile("kept.bin", 64).toAbsolutePath());
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-cut-into-itself-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            String home = "/" + Server.USERNAME + "/" + HOME;
            Page.openPath(d, home, HOME);
            Page.waitForInDrive(d, FOLDER, 120_000);

            // cut with the selection bar: pick it, Cut, and the selection let go. In one script:
            // a listing that arrives between the pick and the cut clears the selection, and the
            // cut then takes nothing
            d.script("const vm = window.__drive;"
                    + "const folder = vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0]);"
                    + "vm.toggleSelection(folder, false); vm.cutMultiSelect(); vm.selectedFiles = []; return 1;", FOLDER);

            Page.openPath(d, home + "/" + FOLDER + "/" + SUB, SUB);
            WebDriver.sleep(1200);
            // the header's add menu, the way a person pastes into the folder they are in
            d.script("document.querySelector('.upload > button').click(); return 1;");
            d.waitForScript("the add menu to offer Paste",
                    "[...document.querySelectorAll('.upload li')].some(li => li.textContent.trim() === 'Paste')", 30_000);
            d.script("[...document.querySelectorAll('.upload li')].find(li => li.textContent.trim() === 'Paste').click();"
                    + "return 1;");

            // Done when the refusal is up, or when the folder has gone from where it was: the
            // view itself never settles after that, as the folder it is showing is unreachable.
            d.waitUntil("the paste to finish", () -> Page.errorShown(d)
                    || ! namesIn(d, home).contains(FOLDER), 120_000);
            List<String> listing = namesIn(d, home);
            if (! listing.contains(FOLDER))
                throw new AssertionError("Pasting " + FOLDER + " into its own subfolder took it out of "
                        + home + ", which now holds " + listing + " - it is linked inside itself, out of reach");
            if (! Page.errorText(d).contains("descendant"))
                throw new AssertionError("The paste failed, but not as a folder going into itself: "
                        + Page.errorText(d));
            d.waitForScript("the spinner to clear, so the refusal can be read", "!window.__drive.showSpinner", 30_000);
            System.out.println("  ok   the paste is refused: " + Page.errorText(d));
            System.out.println("  ok   the folder is still where it was");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** What a folder holds now, read from the store rather than from the view. */
    private static List<String> namesIn(WebDriver d, String path) {
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
