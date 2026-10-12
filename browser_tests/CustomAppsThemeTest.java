import peergos.server.Builder;

import java.nio.file.*;
import java.util.*;

/** Custom Apps is Peergos' own page, shown in the html viewer rather than run as an app, and like
 *  an app it's told the theme in its address, so it can paint in it from the start. It's opened
 *  from the launcher in the theme Peergos is in, and again after the theme toggle.
 *
 *  Usage: java -cp ../server/Peergos.jar CustomAppsThemeTest.java [engine] [peergos url]
 */
public class CustomAppsThemeTest {

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
            String me = "theo" + (System.currentTimeMillis() % 100000);
            NoAppsYetTest.signUp(url, me, Builder.initCrypto());
            // the page is shown in the html viewer, which an account made in the web ui has
            Fixtures.installHtmlViewerApp(serverDir.resolve("Peergos.jar"), url, me, NoAppsYetTest.PASSWORD);

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-customappstheme-"), headless)) {
                d.setWindowRect(1280, 900);
                NewsFeedViewTest.signIn(d, url, me);
                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                d.waitForScript("the launcher", "!!document.querySelector('.launcher-view .launcher-bar')", 60_000);

                Set<String> themes = new HashSet<>();
                for (int i = 0; i < 2; i++) {
                    String theme = String.valueOf(d.script("return " + Page.VUE + ".root().$store.getters.currentTheme"));
                    themes.add(theme);
                    d.script("[...document.querySelectorAll('.launcher-bar button')].find(b => b.textContent.trim() === 'Custom Apps').click(); return 1;");
                    Object address;
                    try {
                        address = d.waitUntil("Custom Apps' address", () -> inPage(d,
                                "return location.pathname.endsWith('/recommended-apps/index.html') ? location.search : null"), 60_000);
                    } catch (IllegalStateException e) {
                        throw new AssertionError("Custom Apps never showed its page: " + diagnose(d));
                    }
                    if (! ("?theme=" + theme).equals(address))
                        throw new AssertionError("Custom Apps should be told the theme, '" + theme + "', in its address, not: " + address);
                    System.out.println("  ok   opened in " + (theme.isEmpty() ? "light" : "dark") + ", Custom Apps is told so in its address: " + address);
                    d.script("window.__launcher.closeAppSandbox(); return 1;");
                    d.waitForScript("Custom Apps closed", "!window.__launcher.showAppSandbox", 10_000);
                    d.script("document.querySelector('.toggle-theme').click(); return 1;");
                }
                if (! themes.equals(Set.of("", "dark-mode")))
                    throw new AssertionError("The toggle should have taken Peergos from one theme to the other: " + themes);
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Where opening it got to, so a failure on CI is readable: the viewer, its frames, any error shown, and the page's address. */
    private static String diagnose(WebDriver d) {
        return d.scriptQuiet("return 'viewer=' + window.__launcher.showAppSandbox"
                + " + ' frames=[' + [...document.querySelectorAll('iframe')].map(f => (f.id || '?') + ':' + (f.getAttribute('src') || '').substring(0, 60)).join(' | ') + ']'"
                + " + ' errors=' + JSON.stringify([...document.querySelectorAll('[class*=toast], [role=alert]')].map(e => e.innerText.trim()).filter(t => t).slice(0, 3))")
                + " page=" + inPage(d, "return location.href + ' ' + document.readyState");
    }

    /** Runs in the page itself, inside the sandbox's frame inside the viewer: null until both are there. */
    private static Object inPage(WebDriver d, String body) {
        try {
            d.switchToFrame("#sandboxId");
            d.switchToFrame("#appSandboxId");
            return d.script(body);
        } catch (RuntimeException e) {
            return null;
        } finally {
            d.switchToTop();
        }
    }
}
