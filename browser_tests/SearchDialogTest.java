import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.storage.auth.Bat;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** The drive's search: what it finds in a nested folder, and that it ends when asked to.
 *
 *  Closing the dialog used to leave the search walking the rest of the drive, and a second search
 *  started over a running one was handed the first one's results as well. The search lists a few
 *  folders at a time; their listings are held back here, so each step lands while they are in flight
 *  every time, and what a search does after it was ended is counted rather than waited for.
 *
 *  Usage: java -cp ../server/Peergos.jar SearchDialogTest.java [engine] [url]
 */
public class SearchDialogTest {
    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String FOLDER = "search-" + RUN, OTHER = "other-" + RUN + ".txt";
    /** As many folders as the search lists at once, and how many the folder searched holds: some more than that. */
    static final int AT_ONCE = 24, SUBS = AT_ONCE + 4;

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
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        Fixtures.Account me = Fixtures.account(url);
        String folder = "/" + me.name() + "/" + FOLDER;
        List<String> needles = build(url, me, folder);
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-search-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            Page.gotoDrive(d);
            Page.openPath(d, folder, FOLDER);

            // --- what a search of a nested folder finds ------------------------------------------
            openSearch(d);
            search(d, "NEEDLE");
            awaitResults(d, needles, "'needle'");
            System.out.println("  ok   files and folders found by name down to five folders deep, each with the folder it is in,"
                    + " and not the hidden one");
            search(d, FOLDER);
            awaitResults(d, List.of("/" + me.name() + " | " + FOLDER), "the name of the folder searched");
            System.out.println("  ok   the folder searched is itself a result");

            // --- closing the dialog ends the search ----------------------------------------------
            holdListings(d);
            search(d, "needle");
            d.waitForScript("the search to be listing folders", "window.__searchGate.held.length >= " + AT_ONCE, 60_000);
            long listing = count(d, "window.__searchGate.held.length");
            d.script("document.querySelector('.search-dialog .pg-dialog__close').click(); return 1;");
            d.waitForScript("the search dialog to close", "!document.querySelector('.search-dialog')", 30_000);
            release(d, folder);
            long after = count(d, "window.__searchGate.started.filter(n => n.startsWith('in-')).length");
            if (after != 0)
                throw new AssertionError("The search went on after its dialog was closed: it listed " + after
                        + " more folders, below the " + listing + " it was listing then");
            System.out.println("  ok   closing the dialog ended the search: nothing listed below the " + listing
                    + " folders it was listing then");
            if (listing > AT_ONCE)
                throw new AssertionError("The search was listing " + listing + " folders at once");
            System.out.println("  ok   and it was listing " + listing + " of the " + SUBS + " folders at once, not all of them");

            // --- so does leaving it with the browser's Back, which closes it without its own button ---
            openSearch(d);
            d.script("window.__searchGate.hold = true; window.__searchGate.started = []; return 1;");
            search(d, "needle");
            d.waitForScript("the search to be listing folders", "window.__searchGate.held.length >= " + AT_ONCE, 60_000);
            d.script("history.back(); return 1;");
            d.waitForScript("the search dialog to go with Back", "!document.querySelector('.search-dialog')", 30_000);
            release(d, folder);
            after = count(d, "window.__searchGate.started.filter(n => n.startsWith('in-')).length");
            if (after != 0)
                throw new AssertionError("The search went on after Back took its dialog away: it listed " + after + " more folders");
            System.out.println("  ok   Back ended the search too");

            // --- a search started over a running one ---------------------------------------------
            Page.openPath(d, folder, FOLDER);
            openSearch(d);
            d.script("window.__searchGate.hold = true; return 1;");
            search(d, "needle");
            d.waitForScript("the first search to be listing folders", "window.__searchGate.held.length >= " + AT_ONCE, 60_000);
            d.script("window.__search.searchContains = arguments[0]; return 1;", "other-");
            d.waitForScript("the new text in the field", "document.querySelector('.search-query__value').value === 'other-'", 30_000);
            d.script("document.querySelector('.search-query__value').dispatchEvent("
                    + "new KeyboardEvent('keyup', {key: 'Enter', keyCode: 13, bubbles: true})); return 1;");
            release(d, folder);
            awaitResults(d, List.of(folder + " | " + OTHER), "a second search, started while the first ran");
            System.out.println("  ok   a search started while another ran shows its own results only");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** The folder searched: a row of folders with a folder each, one of those five folders deep, an empty
     *  folder, and a hidden file. Returns the rows a search for "needle" shows, as "folder | name". */
    static List<String> build(String url, Fixtures.Account me, String folder) throws Exception {
        Crypto crypto = Builder.initCrypto();
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        UserContext ctx = UserContext.signIn(me.name(), me.password(), mfa -> null, network, crypto).join();
        List<String> needles = new ArrayList<>();
        mkdir(ctx, "/" + me.name(), FOLDER);
        put(ctx, folder, OTHER);
        mkdir(ctx, folder, "empty");
        byte[] data = "hello".getBytes();
        ctx.getByPath(folder).join().get().uploadFileSection(".needle-hidden.txt", AsyncReader.build(data), true, 0, data.length,
                Optional.empty(), true, ctx.network, crypto, () -> false, x -> {}, crypto.random.randomBytes(32),
                Optional.empty(), Optional.of(Bat.random(crypto.random)), ctx.mirrorBatId()).join();
        for (int i = 0; i < SUBS; i++) {
            String sub = folder + "/sub" + i;
            mkdir(ctx, folder, "sub" + i);
            mkdir(ctx, sub, "in-" + i);
            if (i < 3) {
                put(ctx, sub + "/in-" + i, "Needle-" + i + ".txt");
                needles.add(sub + "/in-" + i + " | Needle-" + i + ".txt");
            }
        }
        String deep = folder + "/sub0/in-0";
        for (String name : List.of("deep", "deeper", "needle-deepest")) {
            mkdir(ctx, deep, name);
            deep += "/" + name;
        }
        needles.add(folder + "/sub0/in-0/deep/deeper | needle-deepest");
        put(ctx, deep, "needle-below.txt");
        needles.add(deep + " | needle-below.txt");
        return needles;
    }

    static void mkdir(UserContext ctx, String parent, String name) {
        ctx.getByPath(parent).join().get().mkdir(name, ctx.network, false, ctx.mirrorBatId(), ctx.crypto).join();
    }

    static void put(UserContext ctx, String dir, String name) {
        byte[] data = "hello".getBytes();
        FileWrapper parent = ctx.getByPath(dir).join().get();
        parent.uploadOrReplaceFile(name, new AsyncReader.ArrayBacked(data), data.length, ctx.network, ctx.crypto, () -> false, x -> {}).join();
    }

    static void openSearch(WebDriver d) {
        d.script("window.__search = null; window.__drive.openSearch(false); return 1;");
        d.waitForScript("the search dialog", "(window.__search = " + Page.VUE + ".find('stopSearch'))"
                + " && document.querySelector('#submit-search')", 30_000);
    }

    /** Fills in the text and presses Search, as a name search. */
    static void search(WebDriver d, String text) {
        d.script("window.__search.selectedSearchType = 'contains'; window.__search.searchContains = arguments[0]; return 1;", text);
        d.waitForScript("the text in the field", "document.querySelector('.search-query__value').value === '" + text + "'"
                + " && !document.querySelector('#submit-search').disabled", 60_000);
        d.script("document.querySelector('#submit-search').click(); return 1;");
    }

    /** Waits for the search to end showing exactly these rows, each "folder | name". */
    static void awaitResults(WebDriver d, List<String> expected, String what) {
        List<String> wanted = new ArrayList<>(expected);
        Collections.sort(wanted);
        String rows = "[...document.querySelectorAll('.search-table tbody tr')].map(r =>"
                + " r.querySelector('.search-table__path').textContent.trim() + ' | '"
                + " + r.querySelector('.search-table__name').textContent.trim()).sort().join('\\n')";
        try {
            d.waitUntil("the results of " + what, () -> Boolean.TRUE.equals(d.script("return !window.__search.showSpinner"
                    + " && !document.querySelector('#submit-search').disabled && " + rows + " === arguments[0];",
                    String.join("\n", wanted))), 60_000);
        } catch (IllegalStateException e) {
            throw new AssertionError("A search for " + what + " should end with " + wanted + ", and shows "
                    + d.scriptQuiet("return " + rows + ".split('\\n')") + " with its spinner "
                    + d.scriptQuiet("return window.__search.showSpinner ? 'still up' : 'down'"), e);
        }
    }

    /** From here the listing of each folder of the row is kept from answering until release, and every
     *  folder listed is noted by name. */
    static void holdListings(WebDriver d) {
        d.script("let proto = Object.getPrototypeOf(window.__drive.currentDir);"
                + "while (! Object.prototype.hasOwnProperty.call(proto, 'getChildren')) proto = Object.getPrototypeOf(proto);"
                + "const list = proto.getChildren; const gate = window.__searchGate = {hold: true, held: [], started: []};"
                + "proto.getChildren = function(hasher, network) {"
                + "  const name = String(this.getName()); gate.started.push(name);"
                + "  const listed = list.call(this, hasher, network);"
                + "  if (! gate.hold || ! name.startsWith('sub')) return listed;"
                + "  const answer = peergos.shared.util.Futures.incomplete();"
                + "  gate.held.push(() => listed.thenApply(kids => answer.complete(kids)));"
                + "  return answer; }; return 1;");
    }

    /** Lets the held listings answer, then lists the row of folders from here as well: a search still going
     *  has the answers it was waiting for and as long as these took to act on them. */
    static void release(WebDriver d, String folder) {
        d.script("const gate = window.__searchGate; gate.hold = false; gate.held.splice(0).forEach(answer => answer());"
                + "window.__listed = 0; const ctx = window.__drive.context;"
                + "for (let i = 0; i < " + SUBS + "; i++)"
                + "  ctx.getByPath(arguments[0] + '/sub' + i).thenCompose(o => o.get().getChildren(ctx.crypto.hasher, ctx.network))"
                + "    .thenApply(kids => { window.__listed++; }); return 1;", folder);
        d.waitForScript("the folders to be listed again", "window.__listed === " + SUBS, 120_000);
    }

    static long count(WebDriver d, String expression) {
        return ((Number) d.script("return " + expression + ";")).longValue();
    }
}
