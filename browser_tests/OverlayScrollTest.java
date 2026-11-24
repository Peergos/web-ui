import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** The drive stays put behind the search dialog and behind a phone's navigation panel.
 *
 *  A drag over either used to scroll the drive under it: every other dialog held the page, and
 *  these two never asked. The input is real input, which the browser scrolls for, where an event
 *  a script dispatches scrolls nothing: a finger where the driver has one that scrolls - chromium's
 *  W3C touch actions are the browser's own touch events, marionette's reach the page but never
 *  scroll it - and the wheel. Each is first shown to scroll the drive with nothing over it, then the
 *  search results with the dialog open, and is skipped where it doesn't: WebKitGTK's wheel reaches
 *  nothing in or behind a fixed layer, so it is left nothing to check. Chromium, the engine of
 *  Android's web view, and firefox are where it bites.
 *
 *  Usage: java -cp ../server/Peergos.jar OverlayScrollTest.java [engine] [url]
 */
public class OverlayScrollTest {
    /** A phone: under the app's mobile threshold. */
    static final int PHONE_WIDTH = 390, PHONE_HEIGHT = 844;
    /** Where the drive is held while something lies over it: room to move either way. */
    static final int AT = 300;
    static final int ROWS = 30;
    /** Nothing holds the page any more. */
    static final String LET_GO = "!document.body.classList.contains('pg-dialog-open')";

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
        fill(url, me);
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-overlay-scroll-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            Page.gotoDrive(d);
            d.setWindowRect(PHONE_WIDTH, PHONE_HEIGHT);
            d.waitForScript("the phone width to register", "window.__drive.$store.state.windowWidth < 1024", 30_000);
            d.waitForScript("a listing long enough to scroll",
                    "window.__drive.files.length >= " + ROWS + " && document.scrollingElement.scrollHeight - innerHeight > 2 * " + AT, 60_000);
            int checked = 0;
            for (boolean touch : List.of(true, false)) {
                String input = touch ? "a finger" : "the wheel";
                if (! scrollsTheDrive(d, touch)) {
                    // after a round that worked, this is the page still held by what was closed
                    if (checked > 0)
                        throw new AssertionError(input + " doesn't scroll the drive once everything over it has closed");
                    System.out.println("  skip " + input + ": on " + engine + " it doesn't scroll the drive even with nothing over it");
                    continue;
                }
                if (! search(d, touch, input))
                    continue;
                panel(d, touch, input);
                checked++;
            }
            if (checked == 0 && ! engine.startsWith("webkit") && ! engine.equals("safari"))
                throw new AssertionError("Neither a finger nor the wheel scrolls anything on " + engine + ", so nothing was checked");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** The search dialog: its results scroll, and beside it and on its head the drive stays put. Returns false where
     *  this input doesn't reach the results either, which leaves it nothing to say about what is behind them. */
    static boolean search(WebDriver d, boolean touch, String input) {
        hold(d);
        d.script("window.__search = null; window.__drive.openSearch(false); return 1;");
        d.waitForScript("the search dialog", "(window.__search = " + Page.VUE + ".find('stopSearch'))"
                + " && document.querySelector('#submit-search')", 30_000);
        d.script("window.__search.selectedSearchType = 'contains'; window.__search.searchContains = 'row-'; return 1;");
        d.waitForScript("the text in the field", "document.querySelector('.search-query__value').value === 'row-'"
                + " && !document.querySelector('#submit-search').disabled", 30_000);
        d.script("document.querySelector('#submit-search').click(); return 1;");
        d.waitForScript("the results", "document.querySelectorAll('.search-table tbody tr').length === " + ROWS
                + " && !window.__search.showSpinner", 60_000);
        if (((Number) d.script("const b = document.querySelector('.search-dialog .pg-dialog__body');"
                + " return b.scrollHeight - b.clientHeight;")).intValue() < 100)
            throw new AssertionError("The search results should be more than the dialog shows at once");
        Map<?, ?> body = rect(d, ".search-dialog .pg-dialog__body");
        push(d, touch, num(body, "x") + num(body, "width") / 2, num(body, "y") + num(body, "height") * 3 / 4, true);
        try {
            d.waitForScript("the results to scroll", "document.querySelector('.search-dialog .pg-dialog__body').scrollTop > 0", 10_000);
        } catch (IllegalStateException e) {
            System.out.println("  skip " + input + ": it doesn't scroll the search results here either");
            close(d);
            return false;
        }
        stays(d, input + " on the search results");
        System.out.println("  ok   the results scroll under " + input + ", and the drive behind them doesn't");

        // down the screen from here: the dialog now fills all but a strip above and below it, and these points are near its top
        Map<?, ?> dialog = rect(d, ".search-dialog");
        if (num(dialog, "y") < 8)
            throw new AssertionError("The search dialog leaves no page showing above it: " + dialog);
        push(d, touch, num(dialog, "x") + num(dialog, "width") / 2, num(dialog, "y") / 2, false);
        stays(d, input + " beside the search dialog");
        Map<?, ?> head = rect(d, ".search-dialog .pg-dialog__head");
        push(d, touch, num(head, "x") + 40, num(head, "y") + num(head, "height") / 2, false);
        stays(d, input + " on the search dialog's head");
        System.out.println("  ok   " + input + " beside the search dialog or on its head leaves the drive where it was");
        close(d);
        return true;
    }

    static void close(WebDriver d) {
        d.script("document.querySelector('.search-dialog .pg-dialog__close').click(); return 1;");
        d.waitForScript("the search dialog to close", "!document.querySelector('.search-dialog')", 30_000);
        d.waitForScript("the search dialog to let the page go", LET_GO, 10_000);
        stays(d, "closing the search dialog");
    }

    /** A phone's navigation panel: on it, and on the view beside it, where a tap would close it. */
    static void panel(WebDriver d, boolean touch, String input) {
        hold(d);
        d.script("window.__drive.$store.commit('SET_SIDEBAR', true); return 1;");
        d.waitForScript("the panel", "document.querySelector('.app-navigation.expanded .nav-dismiss')"
                + " && document.querySelector('.app-navigation.expanded .nav-dismiss').getBoundingClientRect().width > 0", 30_000);
        Map<?, ?> nav = rect(d, ".app-navigation");
        int width = ((Number) d.script("return innerWidth;")).intValue();
        int height = ((Number) d.script("return innerHeight;")).intValue();
        int right = num(nav, "x") + num(nav, "width");
        push(d, touch, (right + width) / 2, height * 2 / 3, true);
        stays(d, input + " on the view beside the navigation panel");
        push(d, touch, right / 2, height * 2 / 3, true);
        stays(d, input + " on the navigation panel");
        d.script("window.__drive.$store.commit('SET_SIDEBAR', false); return 1;");
        d.waitForScript("the panel to close", "!document.querySelector('.app-navigation.expanded')", 30_000);
        d.waitForScript("the panel to let the page go", LET_GO, 10_000);
        stays(d, "closing the navigation panel");
        System.out.println("  ok   " + input + " on a phone's navigation panel or beside it leaves the drive where it was");
    }

    /** Whether this input scrolls the drive at all here, with nothing over it. */
    static boolean scrollsTheDrive(WebDriver d, boolean touch) {
        hold(d);
        int width = ((Number) d.script("return innerWidth;")).intValue();
        int height = ((Number) d.script("return innerHeight;")).intValue();
        try {
            push(d, touch, width / 2, height * 2 / 3, true);
            d.waitForScript("the drive to scroll", "document.scrollingElement.scrollTop !== " + AT, 10_000);
        } catch (RuntimeException e) {
            return false;
        }
        // at rest before anything puts it back: a wheel can still be gliding to where it goes
        d.waitUntil("the drive to come to rest", () -> {
            long before = ((Number) d.script("return document.scrollingElement.scrollTop;")).longValue();
            frames(d);
            return before == ((Number) d.script("return document.scrollingElement.scrollTop;")).longValue();
        }, 30_000);
        return true;
    }

    /** Puts the drive part way down, where it has room to move either way. */
    static void hold(WebDriver d) {
        d.script("document.scrollingElement.scrollTop = " + AT + "; return 1;");
        stays(d, "a scroll still running as the drive was put part way down");
    }

    /** Asserts the drive is where hold() left it, once the page has drawn whatever the input before did. */
    static void stays(WebDriver d, String what) {
        frames(d);
        long at = ((Number) d.script("return document.scrollingElement.scrollTop;")).longValue();
        if (at != AT)
            throw new AssertionError(what + " scrolled the drive behind it from " + AT + " to " + at);
    }

    /** Waits for the page to draw ten frames. */
    static void frames(WebDriver d) {
        d.script("window.__frames = 0; const tick = () => { if (++window.__frames < 10) requestAnimationFrame(tick); };"
                + " requestAnimationFrame(tick); return 1;");
        d.waitForScript("ten frames drawn", "window.__frames >= 10", 30_000);
    }

    /** A finger drawn 150px up the screen from a point, or down it, slowly and held still before it lifts, so it
     *  starts no fling; or the wheel turned the same way at that point. */
    static void push(WebDriver d, boolean touch, int x, int y, boolean up) {
        int step = up ? -15 : 15;
        if (! touch) {
            d.performActions(List.of(Map.of("type", "wheel", "id", "wheel", "actions", List.of(Map.of("type", "scroll",
                    "x", x, "y", y, "deltaX", 0, "deltaY", -10 * step, "duration", 0, "origin", "viewport")))));
            return;
        }
        List<Object> steps = new ArrayList<>();
        steps.add(Map.of("type", "pointerMove", "x", x, "y", y, "duration", 0, "origin", "viewport"));
        steps.add(Map.of("type", "pointerDown", "button", 0));
        for (int i = 1; i <= 10; i++)
            steps.add(Map.of("type", "pointerMove", "x", x, "y", y + step * i, "duration", 30, "origin", "viewport"));
        steps.add(Map.of("type", "pause", "duration", 150));
        steps.add(Map.of("type", "pointerUp", "button", 0));
        d.performActions(List.of(Map.of("type", "pointer", "id", "finger",
                "parameters", Map.of("pointerType", "touch"), "actions", steps)));
    }

    static Map<?, ?> rect(WebDriver d, String css) {
        return (Map<?, ?>) d.script("const r = document.querySelector(arguments[0]).getBoundingClientRect();"
                + " return {x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height)};", css);
    }

    static int num(Map<?, ?> rect, String key) {
        return ((Number) rect.get(key)).intValue();
    }

    /** A drive long enough to scroll on a phone, and every row of it a result of the same search. */
    static void fill(String url, Fixtures.Account me) throws Exception {
        Crypto crypto = Builder.initCrypto();
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        UserContext ctx = UserContext.signIn(me.name(), me.password(), mfa -> null, network, crypto).join();
        byte[] data = "hello".getBytes();
        for (int i = 0; i < ROWS; i++) {
            FileWrapper home = ctx.getByPath("/" + me.name()).join().get();
            home.uploadOrReplaceFile(String.format("row-%02d.txt", i), new AsyncReader.ArrayBacked(data), data.length,
                    ctx.network, ctx.crypto, () -> false, x -> {}).join();
        }
    }
}
