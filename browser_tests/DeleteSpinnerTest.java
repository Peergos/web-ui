import java.nio.file.*;
import java.util.*;

/** Deleting a selection when something on the way fails.
 *
 *  Both ways ended with the full-screen spinner up for good, over every control and over the
 *  error it should have let through: a usage request that failed after the delete never called
 *  back, and a delete that failed stopped on a name that does not exist before it took the
 *  spinner down.
 *
 *  Usage: java -cp ../server/Peergos.jar DeleteSpinnerTest.java [engine] [url]
 */
public class DeleteSpinnerTest {
    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String FOLDER = "del-spinner-" + RUN;
    static final String A = "a-" + RUN + ".bin", B = "b-" + RUN + ".bin", C = "c-" + RUN + ".bin", D = "d-" + RUN + ".bin",
            E = "e-" + RUN + ".bin", F = "f-" + RUN + ".bin";
    /** What the page reads off a failure that came from Java. */
    static final String FAILURE = "{detailMessage: 'refused', getMessage: () => 'refused', toString: () => 'refused'}";

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
        List<String> commands = new ArrayList<>(List.of("mkdir " + FOLDER, "cd " + FOLDER));
        for (String name : List.of(A, B, C, D, E, F))
            commands.add("put " + Fixtures.patternFile(name, 64).toAbsolutePath());
        Fixtures.commands(serverDir.resolve("Peergos.jar"), url, Server.USERNAME, Server.PASSWORD,
                commands.toArray(new String[0]));
        String folder = "/" + Server.USERNAME + "/" + FOLDER;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-del-spinner-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            Page.openPath(d, folder, FOLDER);
            Page.waitForInDrive(d, D, 120_000);

            // --- the usage request after the delete fails ------------------------------------
            d.script("const ctx = window.__drive.context; window.__usage = ctx.getSpaceUsage;"
                    + "ctx.getSpaceUsage = function() { const f = peergos.shared.util.Futures.incomplete();"
                    + "  f.completeExceptionally(" + FAILURE + "); return f; }; return 1;");
            deleteSelected(d, A, B);
            awaitGone(d, folder, A, B);
            awaitSpinnerDown(d, "deleted, with the usage request failing");
            System.out.println("  ok   deleted, and the spinner came down although usage could not be read");
            d.script("const ctx = window.__drive.context; ctx.getSpaceUsage = window.__usage; return 1;");

            // --- the delete itself fails ---------------------------------------------------------
            d.script("const fw = peergos.shared.user.fs.FileWrapper; window.__deleteChildren = fw.deleteChildren;"
                    + "fw.deleteChildren = function() { const f = peergos.shared.util.Futures.incomplete();"
                    + "  f.completeExceptionally(" + FAILURE + "); return f; }; return 1;");
            deleteSelected(d, C, D);
            d.waitForScript("the delete error", "window.__drive.showError", 30_000);
            awaitSpinnerDown(d, "the delete failed and its error is up");
            System.out.println("  ok   the failed delete says so: " + Page.errorText(d) + ", with no spinner over it");
            d.script("peergos.shared.user.fs.FileWrapper.deleteChildren = window.__deleteChildren; return 1;");
            List<String> left = namesIn(d, folder);
            if (! left.contains(C) || ! left.contains(D))
                throw new AssertionError("The refused delete still took files: " + left);

            // --- a delete picked before the listing has filled in --------------------------------
            // the listing hands out stand-ins first and fills them in later; a selection made from
            // those still has to delete the files
            d.script("const vm = window.__drive;"
                    + "vm.selectedFiles = arguments[0].split('\\n').map(n => {"
                    + "  const f = vm.sortedFiles.find(f => f.getFileProperties().name === n);"
                    + "  return {isWrapper: true, getName: () => f.getName(), isDirectory: () => false, getBase64Thumbnail: () => '',"
                    + "    getFileProperties: () => ({name: f.getName(), isDirectory: false}),"
                    + "    getFile: () => peergos.shared.util.Futures.of(f)}; });"
                    + "vm.deleteFilesMultiSelect(); return 1;", E + "\n" + F);
            d.waitForScript("the delete question", "window.__drive.showPrompt", 30_000);
            d.script("window.__drive.prompt_consumer_func(''); return 1;");
            awaitGone(d, folder, E, F);
            awaitSpinnerDown(d, "deleting from a listing still filling in");
            System.out.println("  ok   a delete picked before the listing filled in deletes the files");

            // --- a callback that fails is not answered again as if the request had ------------------
            d.script("window.__calls = 0; window.__drive.$store.dispatch('updateUsage',"
                    + " () => { window.__calls++; throw new Error('the callback failed'); }); return 1;");
            WebDriver.sleep(3000);
            long calls = ((Number) d.script("return window.__calls;")).longValue();
            if (calls != 1)
                throw new AssertionError("A usage callback that threw was called " + calls + " times");
            System.out.println("  ok   a usage callback that throws is called once");
            d.script("window.__calls = 0; window.__drive.$store.dispatch('updateQuota',"
                    + " () => { window.__calls++; throw new Error('the callback failed'); }); return 1;");
            WebDriver.sleep(3000);
            calls = ((Number) d.script("return window.__calls;")).longValue();
            if (calls != 1)
                throw new AssertionError("A quota callback that threw was called " + calls + " times");
            System.out.println("  ok   so is a quota callback");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Deletes a selection the way the selection bar does, answering its question with OK.
     *  While the question is up, a listing arrives and clears the selection, as one does on a
     *  slow machine: the answer still has to delete what the question was about. */
    static void deleteSelected(WebDriver d, String... names) {
        String picked = String.valueOf(d.script("const vm = window.__drive;"
                + "vm.selectedFiles = arguments[0].split('\\n').map(n => vm.sortedFiles.find(f => f.getFileProperties().name === n));"
                + "if (vm.selectedFiles.some(f => !f)) return 'listed: ' + vm.sortedFiles.map(f => f.getFileProperties().name).join(', ');"
                + "vm.deleteFilesMultiSelect(); return 'picked';", String.join("\n", names)));
        if (! picked.equals("picked"))
            throw new IllegalStateException("Not all of " + String.join(", ", names) + " are in the listing; " + picked);
        d.waitForScript("the delete question", "window.__drive.showPrompt", 30_000);
        d.script("window.__drive.selectedFiles = []; window.__drive.prompt_consumer_func(''); return 1;");
    }

    /** Waits for the names to be gone from the folder; if they are not, says what the drive shows. */
    static void awaitGone(WebDriver d, String folder, String... names) {
        try {
            d.waitUntil(String.join(" and ", names) + " to be deleted", () -> {
                List<String> left = namesIn(d, folder);
                return Arrays.stream(names).noneMatch(left::contains);
            }, 60_000);
        } catch (IllegalStateException e) {
            throw new IllegalStateException(e.getMessage() + "; the drive: " + d.scriptQuiet(
                    "const vm = window.__drive; return JSON.stringify({spinner: vm.showSpinner, prompt: vm.showPrompt,"
                    + " error: vm.showError ? vm.errorTitle + ' / ' + vm.errorBody : null,"
                    + " toasts: [...document.querySelectorAll('[class*=toast]')].map(t => t.textContent.trim()).filter(t => t),"
                    + " listed: vm.files.map(f => f.getName())})") + "; in the folder: " + namesIn(d, folder), e);
        }
    }

    static void awaitSpinnerDown(WebDriver d, String when) {
        long end = System.currentTimeMillis() + 30_000;
        while (System.currentTimeMillis() < end) {
            if (Boolean.FALSE.equals(d.scriptQuiet("return !!window.__drive.showSpinner")))
                return;
            WebDriver.sleep(250);
        }
        throw new AssertionError("The spinner is still up 30 s after " + when
                + ", covering the page" + (Page.errorShown(d) ? " and the error " + Page.errorText(d) : ""));
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
