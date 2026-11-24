import java.nio.file.*;

/** Opening Custom Apps: its page is looked up, then a viewer starts a sandbox and reads the page in,
 *  which on a first open over a slow connection takes seconds - with nothing on screen to say so.
 *  Now a spinner does: not at once, as a wait under 400 ms needs none and one that comes and
 *  goes only flashes, but from then until the page is in. Over the launcher while the page is looked
 *  up, then inside the viewer, clear of its close button, while the viewer starts. A lookup that
 *  fails takes it down and says why.
 *
 *  The waits are made rather than timed: the page's lookups are held until the test lets them go.
 *
 *  Usage: java -cp ../server/Peergos.jar CustomAppsSpinnerTest.java [engine] [peergos url]
 */
public class CustomAppsSpinnerTest {

    /** Holds every lookup of the Custom Apps page while window.__holding is set, until __release. */
    static final String HOLD = "const ctx = window.__launcher.context; const lookup = ctx.getByPath;"
            + " window.__held = []; window.__holding = true;"
            + " ctx.getByPath = function(path) {"
            + "   if (! window.__holding || ! String(path).endsWith('recommended-apps/index.html')) return lookup.apply(this, arguments);"
            + "   const f = peergos.shared.util.Futures.incomplete(); window.__held.push({self: this, path: path, f: f}); return f; };"
            + " window.__release = failure => { const held = window.__held; window.__held = [];"
            + "   held.forEach(h => failure ? h.f.completeExceptionally(failure)"
            + "     : lookup.call(h.self, h.path).thenApply(r => h.f.complete(r))); };"
            + " return 1;";
    /** What the page reads off a lookup that could not reach the server. */
    static final String OFFLINE = "{detailMessage: 'Failed to fetch', getMessage: () => 'Failed to fetch', toString: () => 'Failed to fetch'}";
    /** Notes whether the first spinner put up was hidden when it was - a spinner shown at once flashes -
     *  and when the sandbox said the page is in and when the viewer's spinner went, each on its own, so it
     *  is seen to come down for that word and not for the time it gives up waiting. A spinner the viewer
     *  puts up in its place for something else is not its going. */
    static final String WATCH = "window.__firstSpinner = null; window.__pageShownAt = null; window.__downAt = null; window.__seen = false;"
            + " new MutationObserver(() => {"
            + " const s = document.querySelector('.pg-spinner');"
            + " if (s != null && window.__firstSpinner == null) window.__firstSpinner = s.hidden ? 'hidden' : 'shown';"
            + " if (document.querySelector('.pg-viewer .pg-spinner')) window.__seen = true;"
            + " else if (window.__seen && window.__downAt == null) window.__downAt = Date.now();"
            + " }).observe(document.body, {childList: true, subtree: true});"
            + " window.addEventListener('message', e => {"
            + "   if (e.data != null && e.data.action == 'pageShown' && window.__pageShownAt == null) window.__pageShownAt = Date.now(); }); return 1;";
    static final String CLICK = "[...document.querySelectorAll('.launcher-bar button')].find(b => b.textContent.trim() === 'Custom Apps').click(); return 1;";
    static final String SHOWN = "[...document.querySelectorAll('.pg-spinner')].filter(s => ! s.hidden)";

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
        try {
            Fixtures.Account me = Fixtures.account(url);
            // the page is shown in the html viewer, which an account made in the web ui has
            Fixtures.installHtmlViewerApp(serverDir.resolve("Peergos.jar"), url, me.name(), me.password());

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-customappsspinner-"), headless)) {
                d.setWindowRect(1280, 900);
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, me.name(), me.password());
                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                d.waitForScript("the launcher", "!!document.querySelector('.launcher-view .launcher-bar') && ! window.__launcher.showSpinner", 60_000);

                d.script(HOLD);
                d.script(WATCH);
                d.script(CLICK);
                await(d, "a spinner over the launcher while Custom Apps is looked up",
                        SHOWN + ".some(s => ! s.closest('.pg-viewer'))");
                if (! "hidden".equals(d.script("return window.__firstSpinner;")))
                    throw new AssertionError("The spinner should wait a moment before it shows, not flash up at the click: "
                            + d.script("return window.__firstSpinner;"));
                System.out.println("  ok   a moment after the click, with Custom Apps still being looked up, a spinner is up");

                d.script("window.__release(); return 1;");
                await(d, "a spinner inside the viewer, under its close button, while the page is read",
                        "window.__held.length > 0 && " + SHOWN + ".length == 1 && !! " + SHOWN + "[0].closest('.pg-viewer__body')");
                System.out.println("  ok   once found, the viewer opens and keeps a spinner up in its frame while the page is read");

                d.script("window.__holding = false; window.__release(); return 1;");
                try {
                    d.waitUntil("Custom Apps' page", () -> CustomAppsThemeTest.inPage(d,
                            "return location.pathname.endsWith('/recommended-apps/index.html') && document.readyState != 'loading' ? 1 : null"), 60_000);
                } catch (IllegalStateException e) {
                    throw new AssertionError("Custom Apps never showed its page");
                }
                await(d, "the spinner down once the page is in", "window.__downAt != null && window.__pageShownAt != null && " + SHOWN + ".length == 0");
                Object after = d.script("return window.__downAt - window.__pageShownAt;");
                if (((Number) after).longValue() < 0)
                    throw new AssertionError("The spinner came down " + (- ((Number) after).longValue()) + " ms before the sandbox"
                            + " said the page is in: it gave up waiting rather than being told");
                if (((Number) after).longValue() >= 2000)
                    throw new AssertionError("The spinner should come down when the sandbox says the page is in, not "
                            + after + " ms later, when it gives up waiting");
                System.out.println("  ok   the page is in and the spinner is down, " + after + " ms after the sandbox said so");

                d.script("window.__launcher.closeAppSandbox(); return 1;");
                d.waitForScript("Custom Apps closed", "! window.__launcher.showAppSandbox", 10_000);
                d.script("window.__holding = true; return 1;");
                d.script(CLICK);
                await(d, "a spinner while Custom Apps is looked up again", SHOWN + ".length == 1");
                d.script("window.__release(" + OFFLINE + "); return 1;");
                await(d, "the spinner down and the reason up when the lookup fails", SHOWN + ".length == 0"
                        + " && [...document.querySelectorAll('.Vue-Toastification__toast')].some(t => t.textContent.includes(window.__launcher.translate('APP.OFFLINE')))"
                        + " && ! window.__launcher.showAppSandbox");
                System.out.println("  ok   a lookup that fails takes the spinner down and says why");
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    private static void await(WebDriver d, String what, String condition) {
        try {
            d.waitForScript(what, condition, 30_000);
        } catch (IllegalStateException e) {
            throw new AssertionError("Expected " + what + ", but the page has "
                    + d.scriptQuiet("return JSON.stringify({spinners: [...document.querySelectorAll('.pg-spinner')].map(s => (s.hidden ? 'hidden ' : 'shown ')"
                    + " + (s.closest('.pg-viewer') ? 'in the viewer' : 'over the launcher')), viewer: !! window.__launcher.showAppSandbox,"
                    + " held: (window.__held || []).length, pageShownAt: window.__pageShownAt, downAt: window.__downAt, toasts: [...document.querySelectorAll('.Vue-Toastification__toast')].map(t => t.textContent.trim())})"));
        }
    }
}
