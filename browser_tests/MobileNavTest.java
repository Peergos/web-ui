import java.nio.file.*;

/** The drive on a phone, and the one preference a phone must not touch.
 *
 *  A phone shows the sidebar as a panel that opens over the view and closes with it; a desktop
 *  shows it as a rail whose open state is a preference worth keeping. Opening the panel on a
 *  phone used to write that preference, which decided how the next desktop session started.
 *
 *  Usage: java -cp ../server/Peergos.jar MobileNavTest.java [engine] [url]
 */
public class MobileNavTest {

    /** Anything under the app's own mobile threshold; every engine here can reach it. */
    static final int PHONE_WIDTH = 390, PHONE_HEIGHT = 844;
    static final int DESKTOP_WIDTH = 1280, DESKTOP_HEIGHT = 900;

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();
        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-mobile-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);

            // --- the desktop's rail, and the preference it keeps --------------------------------
            d.setWindowRect(DESKTOP_WIDTH, DESKTOP_HEIGHT);
            d.waitForScript("the desktop width to register",
                    "window.__drive.$store.state.windowWidth >= 1024", 30_000);
            toggleSidebar(d);
            String afterDesktopToggle = preference(d);
            if (afterDesktopToggle == null)
                throw new AssertionError("A desktop toggle should write the rail preference,"
                        + " but side-bar-open is unset");
            System.out.println("  ok   a desktop toggle keeps the rail state: " + afterDesktopToggle);

            // --- the same gesture on a phone -------------------------------------------------
            d.setWindowRect(PHONE_WIDTH, PHONE_HEIGHT);
            int width = viewport(d);
            if (width >= 1024)
                throw new AssertionError("This engine would not go below the app's mobile"
                        + " threshold - the viewport is " + width + "px, so there is no phone to test");
            d.waitForScript("the phone width to register",
                    "window.__drive.$store.state.windowWidth < 1024", 30_000);
            System.out.println("  the viewport is " + width + "px, which the app reads as a phone");

            // Once, not twice: two toggles put the panel back where it started, so a build that
            // wrongly writes the preference writes back the value it already had and the check
            // below passes on the bug it exists to catch.
            toggleSidebar(d);
            String afterPhoneToggles = preference(d);
            if (! afterDesktopToggle.equals(afterPhoneToggles))
                throw new AssertionError("Opening the panel on a phone rewrote the desktop's"
                        + " rail preference: it was " + afterDesktopToggle
                        + " and is now " + afterPhoneToggles);
            System.out.println("  ok   a phone's panel leaves the desktop's rail preference alone,"
                    + " which is still " + afterPhoneToggles);

            // the panel is still usable, and the view it opens over does not run off the side
            String overflow = String.valueOf(d.scriptQuiet(
                    "const el = document.documentElement;"
                            + "return el.scrollWidth <= el.clientWidth + 1 ? 'none'"
                            + " : 'scrolls to ' + el.scrollWidth + ' in ' + el.clientWidth;"));
            if (! "none".equals(overflow))
                throw new AssertionError("The drive scrolls sideways on a phone: " + overflow);
            System.out.println("  ok   nothing runs off the side of the drive at " + width + "px");

            // --- and back, where the preference decides again ---------------------------------
            d.setWindowRect(DESKTOP_WIDTH, DESKTOP_HEIGHT);
            d.waitForScript("the desktop width to register",
                    "window.__drive.$store.state.windowWidth >= 1024", 30_000);
            if (! afterDesktopToggle.equals(preference(d)))
                throw new AssertionError("The rail preference changed on the way back to a desktop");
            System.out.println("  ok   the desktop comes back to the rail it was left on");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Through the navigation's own toggle, which is what the phone and the desktop both call.
     *
     *  Not through the logo it hangs off: that control is an svg, which has no click() of its
     *  own, and on a phone the whole rail is off screen anyway - while the behaviour under test
     *  is the method's, at both widths.
     */
    private static void toggleSidebar(WebDriver d) {
        Object toggled = d.scriptQuiet("let root = null;"
                + "for (const el of document.querySelectorAll('*')) if (el.__vue__) { root = el.__vue__.$root; break; }"
                + "const queue = root ? [root] : [];"
                + "while (queue.length) { const c = queue.shift();"
                + "  if (c && typeof c.toggleSidebar === 'function') { c.toggleSidebar(); return true; }"
                + "  if (c && c.$children) for (const kid of c.$children) queue.push(kid); }"
                + "return false;");
        if (! Boolean.TRUE.equals(toggled))
            throw new AssertionError("Nothing in the component tree offers a sidebar toggle");
        WebDriver.sleep(600);
    }

    private static String preference(WebDriver d) {
        Object v = d.scriptQuiet("try { return localStorage.getItem('side-bar-open'); }"
                + " catch (e) { return null; }");
        return v == null ? null : String.valueOf(v);
    }

    private static int viewport(WebDriver d) {
        WebDriver.sleep(800);
        Object w = d.scriptQuiet("return document.documentElement.clientWidth");
        try {
            return Integer.parseInt(String.valueOf(w));
        } catch (NumberFormatException notANumber) {
            return -1;
        }
    }
}
