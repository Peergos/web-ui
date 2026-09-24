import java.nio.file.*;
import java.util.*;

/** The drive's path trail when it is too long for the header.
 *
 *  Every folder in the trail used to shrink alike, so a deep path on a phone cut every name
 *  short, the current folder's included. A trail that does not fit now keeps the folder and its
 *  parent and folds the rest into an ellipsis. The ellipsis opens it out with every name whole;
 *  tapping the folder you are in folds it again, and so does opening any folder. A trail that
 *  fits has nothing folded away, so it shows as it always did.
 *
 *  Usage: java -cp ../server/Peergos.jar PathExpandTest.java [engine] [url]
 */
public class PathExpandTest {

    static final int DESKTOP_WIDTH = 1280, DESKTOP_HEIGHT = 900;
    static final int PHONE_WIDTH = 390, PHONE_HEIGHT = 844;
    // deep and long enough to be cut on a desktop window as well as a phone
    static final String[] DEEP = {"path-expand-a-folder-with-a-long-name", "another-quite-long-folder-name",
            "yet-one-more-long-folder-name", "a-fourth-folder-with-a-long-name", "the-folder-at-the-bottom-of-it-all"};
    // one word far wider than a phone, which has nowhere to break and must still be cut
    static final String HUGE = "Ggggggggggggh" + "g".repeat(90);

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
        try {
            Path jar = serverDir.resolve("Peergos.jar");
            List<String> cmds = new ArrayList<>();
            for (String dir : DEEP) {
                cmds.add("mkdir " + dir);
                cmds.add("cd " + dir);
            }
            Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD, cmds.toArray(new String[0]));
            Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD, "mkdir " + HUGE, "cd " + HUGE, "mkdir inner-" + HUGE);
            String deepPath = "/" + Server.USERNAME + "/" + String.join("/", DEEP);
            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD,
                    String.join("/", Arrays.copyOf(DEEP, DEEP.length - 1)), 120_000, DEEP[DEEP.length - 1]);

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-path-"), headless)) {
                d.setWindowRect(DESKTOP_WIDTH, DESKTOP_HEIGHT);
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, Server.USERNAME, Server.PASSWORD);
                Page.gotoDrive(d);

                // a short trail on a wide window fits, so nothing is folded away
                WebDriver.sleep(800);
                if (count(d, ".breadcrumb__more") != 0)
                    throw new AssertionError("A trail that fits should have no ellipsis");
                System.out.println("  ok   a trail that fits is shown whole, with nothing to expand");

                d.setWindowRect(PHONE_WIDTH, PHONE_HEIGHT);
                open(d, deepPath, DEEP[DEEP.length - 1]);
                d.waitForScript("the folded trail", "!!document.querySelector('.breadcrumb__more')", 10_000);
                assertFolded(d, "on a phone");
                System.out.println("  ok   a deep trail on a phone keeps the folder and its parent, the rest behind the ellipsis");

                List<Double> before = firstLine(d);
                d.script("document.querySelector('.breadcrumb__more').click()");
                WebDriver.sleep(600);
                if (cut(d) != 0)
                    throw new AssertionError("Expanded, every name should be whole, but " + cut(d) + " are cut");
                Object names = d.script("return [...document.querySelectorAll('.breadcrumb__item')].map(b => b.textContent.trim())");
                for (String dir : DEEP)
                    if (! String.valueOf(names).contains(dir))
                        throw new AssertionError("Expanded, the trail should hold " + dir + ": " + names);
                if (count(d, ".breadcrumb__more") != 0 || wider(d))
                    throw new AssertionError("Expanded, the ellipsis should be gone and the trail within the width");
                assertStill(before, firstLine(d), "on a phone");
                System.out.println("  ok   the ellipsis opens the trail, every name whole and within the width");
                Object gaps = d.script("const tops = [...new Set([...document.querySelectorAll('.breadcrumb__item')]"
                        + ".map(b => Math.round(b.getBoundingClientRect().top)))].sort((a, b) => a - b);"
                        + "return tops.slice(1).map((t, i) => t - tops[i]);");
                for (Object g : (List<?>) gaps)
                    if (((Number) g).intValue() > 44)
                        throw new AssertionError("Expanded lines should sit close together, but are " + gaps + "px apart");
                System.out.println("  ok   the expanded lines sit close together: " + gaps + "px apart");

                // the bold folder, the one you are in, folds it back, and opens it again
                d.script("document.querySelector('.breadcrumb__item--current').click()");
                WebDriver.sleep(600);
                assertFolded(d, "after tapping the current folder");
                d.script("document.querySelector('.breadcrumb__item--current').click()");
                WebDriver.sleep(600);
                if (count(d, ".drive-breadcrumb--expanded") != 1 || cut(d) != 0)
                    throw new AssertionError("Tapping the current folder on a folded trail should open it out");
                System.out.println("  ok   tapping the current folder folds and opens the trail, and stays in that folder");

                // a name in the expanded trail still takes you there, and that folder opens folded
                d.script("const items = [...document.querySelectorAll('.breadcrumb__item')];"
                        + "items.find(b => b.textContent.trim() === arguments[0]).click();", DEEP[DEEP.length - 2]);
                waitFor(d, DEEP[DEEP.length - 2]);
                WebDriver.sleep(600);
                if (count(d, ".drive-breadcrumb--expanded") != 0 || count(d, ".breadcrumb__more") != 1)
                    throw new AssertionError("The folder chosen from the expanded trail should open with its trail folded");
                System.out.println("  ok   a name in the trail navigates, and that folder opens folded");

                // the root fits, so there is nothing folded away
                d.script("document.querySelector('.breadcrumb__root').click()");
                d.waitForScript("the drive root", "document.querySelectorAll('.breadcrumb__item').length <= 1", 60_000);
                WebDriver.sleep(600);
                if (count(d, ".drive-breadcrumb--expanded") != 0 || count(d, ".breadcrumb__more") != 0)
                    throw new AssertionError("At the root the trail fits, so it should be neither expanded nor folded");
                System.out.println("  ok   a trail that fits is shown whole again");
                // at the top the globe is where you are: the current folder's colour, and no word
                Object globe = d.script("const g = document.querySelector('.breadcrumb__root');"
                        + "const probe = document.createElement('span'); probe.style.color = 'var(--color)'; document.body.appendChild(probe);"
                        + "const want = getComputedStyle(probe).color; probe.remove();"
                        + "const got = getComputedStyle(g).color, text = g.textContent.trim();"
                        + "return (got === want ? '' : 'colour ' + got + ' not ' + want + ' ') + (text ? 'text \"' + text + '\"' : '');");
                if (! String.valueOf(globe).isEmpty())
                    throw new AssertionError("At the top the globe should be solid and alone: " + globe);
                // with nothing folded away, the current folder has nothing to toggle
                open(d, "/" + Server.USERNAME, Server.USERNAME);
                WebDriver.sleep(600);
                d.script("document.querySelector('.breadcrumb__item--current').click()");
                WebDriver.sleep(600);
                if (count(d, ".drive-breadcrumb--expanded") != 0)
                    throw new AssertionError("A trail that fits has nothing to open, but tapping the current folder expanded it");

                // one enormous word: cut with an ellipsis, inside the page, nothing drawn over anything
                for (String p : List.of("/" + Server.USERNAME + "/" + HUGE, "/" + Server.USERNAME + "/" + HUGE + "/inner-" + HUGE)) {
                    open(d, p, p.substring(p.lastIndexOf('/') + 1));
                    WebDriver.sleep(600);
                    Object bad = d.script("const nav = document.querySelector('.drive-breadcrumb').getBoundingClientRect();"
                            + "const crumbs = [...document.querySelectorAll('.breadcrumb__crumb')];"
                            + "const out = [];"
                            + "if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('page scrolls sideways');"
                            + "crumbs.forEach((c, i) => { const r = c.getBoundingClientRect();"
                            + "  if (r.right > nav.right + 1) out.push('crumb ' + i + ' runs past the bar');"
                            + "  if (r.width < 20) out.push('crumb ' + i + ' squeezed to ' + Math.round(r.width) + 'px');"
                            + "  if (i > 0 && r.left < crumbs[i - 1].getBoundingClientRect().right - 1) out.push('crumb ' + i + ' overlaps the one before'); });"
                            + "const cur = document.querySelector('.breadcrumb__item--current');"
                            + "if (cur.scrollWidth <= cur.clientWidth) out.push('the huge name is not cut');"
                            + "return out.join(', ');");
                    if (! String.valueOf(bad).isEmpty())
                        throw new AssertionError("A huge folder name at " + p.split("/").length + " levels: " + bad);
                }
                System.out.println("  ok   a huge one word name is cut with an ellipsis, and nothing overlaps or overflows");
                d.script("document.querySelector('.breadcrumb__root').click()");
                d.waitForScript("the drive root again", "document.querySelectorAll('.breadcrumb__item').length <= 1", 60_000);

                // the same on a desktop window, where the trail shares its row with the tools
                d.setWindowRect(DESKTOP_WIDTH, DESKTOP_HEIGHT);
                open(d, deepPath, DEEP[DEEP.length - 1]);
                d.waitForScript("the folded trail on a desktop window", "!!document.querySelector('.breadcrumb__more')", 10_000);
                assertFolded(d, "on a desktop window");
                // the phone steps can leave the page a few pixels down, which expanding then moves
                d.script("window.scrollTo(0, 0)");
                WebDriver.sleep(300);
                List<Double> deskBefore = firstLine(d);
                d.script("document.querySelector('.breadcrumb__more').click()");
                WebDriver.sleep(600);
                if (cut(d) != 0 || wider(d))
                    throw new AssertionError("Expanded on a desktop window, " + cut(d) + " names are still cut"
                            + (wider(d) ? " and the page scrolls sideways" : ""));
                // a wrapped line should start on a name: a separator stays with the name before it
                Object stray = d.script("return [...document.querySelectorAll('.breadcrumb__crumb')].filter(c => {"
                        + " const sep = c.querySelector('.breadcrumb__separator'), item = c.querySelector('.breadcrumb__item');"
                        + " return sep && item && Math.abs(sep.getBoundingClientRect().top + sep.getBoundingClientRect().height / 2"
                        + "   - item.getBoundingClientRect().top - item.getBoundingClientRect().height / 2) > 4; }).length");
                if (((Number) stray).intValue() != 0)
                    throw new AssertionError(stray + " separators wrapped away from the name they follow");
                assertStill(deskBefore, firstLine(d), "on a desktop window");
                System.out.println("  ok   on a desktop window it folds and opens the same, each separator on the line of its name");
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** the folder and its parent shown, the rest behind the ellipsis */
    private static void assertFolded(WebDriver d, String where) {
        Object shown = d.script("return [...document.querySelectorAll('.breadcrumb__item')].map(b => b.textContent.trim())");
        String expect = "[" + DEEP[DEEP.length - 2] + ", " + DEEP[DEEP.length - 1] + "]";
        if (! expect.equals(String.valueOf(shown)))
            throw new AssertionError("Folded " + where + ", the trail should show " + expect + ", not " + shown);
        if (count(d, ".breadcrumb__more") != 1 || count(d, ".drive-breadcrumb--expanded") != 0)
            throw new AssertionError("Folded " + where + ", the ellipsis should be there and the trail not expanded");
        if (wider(d))
            throw new AssertionError("Folded " + where + ", the trail runs off the side of the page");
    }

    /** where the globe, the first name's text and the tools sit: what the eye holds on to */
    @SuppressWarnings("unchecked")
    private static List<Double> firstLine(WebDriver d) {
        List<Object> raw = (List<Object>) d.script("const i = document.querySelector('.breadcrumb__item');"
                + "return [document.querySelector('.breadcrumb__root').getBoundingClientRect().top,"
                + " i.getBoundingClientRect().top + parseFloat(getComputedStyle(i).paddingTop),"
                + " document.querySelector('.drive-tools').getBoundingClientRect().top];");
        List<Double> out = new ArrayList<>();
        for (Object o : raw)
            out.add(((Number) o).doubleValue());
        return out;
    }

    /** opening the trail adds lines below; the line that was there, and the tools, stay put */
    private static void assertStill(List<Double> before, List<Double> after, String where) {
        String[] what = {"the globe", "the first name", "the tools"};
        for (int i = 0; i < what.length; i++)
            if (Math.abs(before.get(i) - after.get(i)) > 1)
                throw new AssertionError("Expanding " + where + " moved " + what[i] + " from "
                        + before.get(i) + " to " + after.get(i));
    }

    private static void open(WebDriver d, String path, String name) {
        d.script("window.__drive.changePath(arguments[0]);", path);
        waitFor(d, name);
    }

    private static void waitFor(WebDriver d, String name) {
        d.waitForScript("the folder " + name,
                "window.__drive.currentDir && window.__drive.currentDir.getName() === '" + name + "'", 120_000);
    }

    private static int cut(WebDriver d) {
        return ((Number) d.script("return [...document.querySelectorAll('.breadcrumb__item')]"
                + ".filter(b => b.scrollWidth > b.clientWidth + 1).length")).intValue();
    }

    private static boolean wider(WebDriver d) {
        return Boolean.TRUE.equals(d.script("return document.documentElement.scrollWidth > window.innerWidth + 1"));
    }

    private static int count(WebDriver d, String css) {
        return ((Number) d.script("return document.querySelectorAll(arguments[0]).length", css)).intValue();
    }
}
