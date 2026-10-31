import java.nio.file.*;
import java.util.*;

/** A file picked while its folder is still loading stays picked when the loading finishes, and one
 *  cut while it is still a placeholder pastes.
 *
 *  A folder lists placeholder entries first and fills them in afterwards. Filling them in used to
 *  empty the selection, so a Copy or Cut made in between silently took nothing; and a placeholder
 *  cut before it was filled in failed at the paste, behind a spinner that never came down. The
 *  filling in is held back here so each step lands inside that window every time.
 *
 *  Usage: java -cp ../server/Peergos.jar PickDuringLoadTest.java [engine] [url]
 */
public class PickDuringLoadTest {
    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String FOLDER = "pick-load-" + RUN, INTO = "into", NAME = "picked-" + RUN + ".txt";
    static final int HELD_MS = 10_000;

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
        Fixtures.Account me = Fixtures.account(url);
        Fixtures.commands(serverDir.resolve("Peergos.jar"), url, me.name(), me.password(),
                "mkdir " + FOLDER, "cd " + FOLDER, "mkdir " + INTO, "put " + Fixtures.patternFile(NAME, 64).toAbsolutePath());
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-pick-load-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            Page.gotoDrive(d);
            String root = Page.currentPath(d);
            Page.waitForInDrive(d, FOLDER, 120_000);

            // hold the filling in of every listing back for a few seconds
            d.script("const proto = Object.getPrototypeOf(window.__drive.currentDir);"
                    + "if (!proto.__heldBack) { const fill = proto.getChildrenFromCaps; proto.__heldBack = true;"
                    + "  proto.getChildrenFromCaps = function(caps, consumer, hasher, network) {"
                    + "    const held = {accept: r => setTimeout(() => consumer.accept(r), " + HELD_MS + ")};"
                    + "    return fill.call(this, caps, held, hasher, network); }; } return 1;");
            Page.openPath(d, root + FOLDER, FOLDER);
            pickPlaceholder(d, "");
            d.waitForScript("the listing to fill in", "(window.__drive.files || []).every(f => f.isWrapper !== true)", 60_000);

            Object picked = d.script("return window.__drive.selectedFiles.map(f => String(f.getName()))");
            if (! String.valueOf(picked).contains(NAME))
                throw new AssertionError("The pick made while the folder loaded was dropped when it finished: " + picked);
            System.out.println("  ok   the pick made while the folder loaded is still there: " + picked);
            Object held = d.script("const vm = window.__drive; vm.copy();"
                    + "return vm.clipboard && vm.clipboard.fileTreeNode ? String(vm.clipboard.fileTreeNode.getFileProperties().name) : null;");
            if (! NAME.equals(held))
                throw new AssertionError("Copy after the folder loaded took " + held);
            System.out.println("  ok   and Copy takes it");

            // the folder listed again, its file cut while still a placeholder and pasted before it fills in
            Page.openPath(d, root, me.name());
            Page.waitForInDrive(d, FOLDER, 60_000);
            Page.openPath(d, root + FOLDER, FOLDER);
            pickPlaceholder(d, "vm.cut(); vm.selectedFiles = [];");
            Page.openPath(d, root + FOLDER + "/" + INTO, INTO);
            Object standIn = d.script("const vm = window.__drive; const was = vm.clipboard.fileTreeNode.isWrapper === true;"
                    + "vm.paste(); return was;");
            if (! Boolean.TRUE.equals(standIn))
                throw new AssertionError("The paste came after the placeholder filled in, so this proves nothing; hold it back longer");
            String into = "/" + me.name() + "/" + FOLDER + "/" + INTO;
            d.waitUntil(NAME + " in " + INTO, () -> namesIn(d, into).contains(NAME), 60_000);
            d.waitForScript("the spinner to come down", "!window.__drive.showSpinner", 30_000);
            System.out.println("  ok   a placeholder cut before it filled in pastes, and the spinner comes down");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Picks the file while it is still a placeholder, in one step so the filling in can't land between, then runs more. */
    static void pickPlaceholder(WebDriver d, String then) {
        d.waitForScript("the placeholder to pick", "(() => { const vm = window.__drive;"
                + "const f = (vm.files || []).find(x => x.getName() === '" + NAME + "' && x.isWrapper === true);"
                + "if (!f) return false; vm.selectedFiles = [f]; " + then + " return true; })()", 60_000);
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
