import java.nio.file.*;
import java.util.*;

/** A file picked while its folder is still loading stays picked when the loading finishes.
 *
 *  A folder lists placeholder entries first and fills them in afterwards; filling them in used to
 *  empty the selection, so a Copy or Cut made in between silently took nothing. The filling in is
 *  held back here so the pick lands inside that window every time.
 *
 *  Usage: java -cp ../server/Peergos.jar PickDuringLoadTest.java [engine] [url]
 */
public class PickDuringLoadTest {
    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String FOLDER = "pick-load-" + RUN, NAME = "picked-" + RUN + ".txt";

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
                "mkdir " + FOLDER, "cd " + FOLDER, "put " + Fixtures.patternFile(NAME, 64).toAbsolutePath());
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
                    + "    const held = {accept: r => setTimeout(() => consumer.accept(r), 4000)};"
                    + "    return fill.call(this, caps, held, hasher, network); }; } return 1;");
            Page.openPath(d, root + FOLDER, FOLDER);
            d.waitForScript("the placeholder entry", "(window.__drive.files || []).some(f => f.getName() === '" + NAME + "' && f.isWrapper === true)", 60_000);
            Page.select(d, NAME);
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
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
