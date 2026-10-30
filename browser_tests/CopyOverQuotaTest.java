import java.nio.file.*;
import java.util.*;

/** Copying something bigger than the whole quota, one file and a selection.
 *
 *  The copy is refused with a toast, rightly, but the full-screen spinner raised for it stayed
 *  up for good, over every control. The quota is set in the page to a single byte, as an
 *  account would see a friend's file bigger than everything it has.
 *
 *  Usage: java -cp ../server/Peergos.jar CopyOverQuotaTest.java [engine] [url]
 */
public class CopyOverQuotaTest {
    static Fixtures.Account me;
    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String FOLDER = "over-quota-" + RUN, INTO = "into";
    static final String BIG = "big-" + RUN + ".bin";

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
        me = Fixtures.account(url);
        Fixtures.commands(serverDir.resolve("Peergos.jar"), url, me.name(), me.password(),
                "mkdir " + FOLDER, "cd " + FOLDER, "mkdir " + INTO,
                "put " + Fixtures.patternFile(BIG, 65536).toAbsolutePath());
        String folder = "/" + me.name() + "/" + FOLDER, into = folder + "/" + INTO;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-over-quota-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            Page.gotoDrive(d);
            Page.openPath(d, folder, FOLDER);
            Page.waitForInDrive(d, BIG, 120_000);
            // Sign-in's own quota requests can still be in flight under load, and their answer would
            // put the real quota back, so the context answers a single byte from here on too.
            d.script("const vm = window.__drive;"
                    + "vm.context.getQuota = () => peergos.shared.util.Futures.of(1);"
                    + "vm.$store.commit('SET_QUOTA', 1); return 1;");

            // --- one file: Copy, then Paste in the folder beside it ------------------------------
            Page.select(d, BIG);
            d.script("window.__drive.copy(); return 1;");
            Page.openPath(d, into, INTO);
            d.script("window.__drive.paste(); return 1;");
            awaitRefusal(d, "the file");
            System.out.println("  ok   one file: refused, and the spinner came down");

            // --- a selection: Copy from the selection bar, Paste into the folder -------------------
            Page.openPath(d, folder, FOLDER);
            Page.waitForInDrive(d, BIG, 60_000);
            d.script("const vm = window.__drive;"
                    + "vm.selectedFiles = [vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0])];"
                    + "vm.copyMultiSelect(); vm.selectedFiles = []; return 1;", BIG);
            Page.openPath(d, into, INTO);
            d.script("const vm = window.__drive; vm.multiSelectTargetFolder = vm.currentDir; vm.pasteMultiSelect(); return 1;");
            awaitRefusal(d, "the selection");
            System.out.println("  ok   a selection: refused, and the spinner came down");
            WebDriver.sleep(2000);
            if (Page.inFlight(d).contains("Copying"))
                throw new AssertionError("The refused copy left its progress toast up: " + Page.inFlight(d));
            System.out.println("  ok   and no progress toast is left for a copy that never started");

            List<String> inside = namesIn(d, into);
            if (inside.contains(BIG))
                throw new AssertionError("The copy over the quota went ahead: " + into + " holds " + inside);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** The quota toast, and then the page usable again. */
    static void awaitRefusal(WebDriver d, String what) {
        try {
            d.waitUntil("the quota refusal for " + what, () -> Page.inFlight(d).contains("exceeds total space"), 60_000);
        } catch (IllegalStateException e) {
            System.out.println("  in flight: " + Page.inFlight(d));
            System.out.println("  page: " + d.scriptQuiet("const vm = window.__drive; return JSON.stringify({"
                    + "quota: String(vm.quotaBytes), pinned: String(vm.context.getQuota).indexOf('Futures') !== -1,"
                    + "clipboard: vm.clipboard == null ? null : {op: vm.clipboard.op,"
                    + "  name: vm.clipboard.fileTreeNode == null ? null : String(vm.clipboard.fileTreeNode.getFileProperties().name)},"
                    + "spinner: vm.showSpinner, path: vm.getPath})"));
            throw e;
        }
        long end = System.currentTimeMillis() + 30_000;
        while (System.currentTimeMillis() < end) {
            if (Boolean.FALSE.equals(d.scriptQuiet("return !!window.__drive.showSpinner")))
                return;
            WebDriver.sleep(250);
        }
        throw new AssertionError("Copying " + what + " was refused for the quota, but the spinner is still up 30 s later, covering the page");
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
