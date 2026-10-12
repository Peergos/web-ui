import java.nio.file.*;
import java.util.*;

/** A file's menu, opened from the last row of a folder scrolled to its end, opens in place.
 *
 *  The menu places itself once it knows its height, and is focused as it opens. Its transition
 *  used to animate every property, so it glided to that place from where it first landed - below
 *  the page, for the last row - and the focus on the way scrolled the page down after it and back
 *  as it rose: the whole grid jumped and flowed back. The page ends up where it started either
 *  way, so the scroll position is read on every frame from the click on.
 *
 *  Usage: java -cp ../server/Peergos.jar DriveMenuScrollTest.java [engine] [url]
 */
public class DriveMenuScrollTest {

    static final String FOLDER = "menu-scroll";

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
            // enough tiles for the folder to scroll a few screens
            List<Path> files = new ArrayList<>();
            for (int i = 0; i < 36; i++)
                files.add(Fixtures.patternFile(String.format("tile-%02d.bin", i), 64));
            Fixtures.uploadInto(serverDir.resolve("Peergos.jar"), url, Server.USERNAME, Server.PASSWORD, FOLDER, files);

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-menuscroll-"), headless)) {
                d.setWindowRect(1280, 800);
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, Server.USERNAME, Server.PASSWORD);
                Page.gotoDrive(d);
                Page.openPath(d, Page.currentPath(d) + FOLDER, FOLDER);
                Page.waitForInDrive(d, "tile-35.bin", 120_000);

                for (String view : List.of("grid", "list")) {
                    boolean grid = view.equals("grid");
                    if (! Objects.equals(grid, d.script("return window.__drive.isGrid")))
                        d.script("window.__drive.switchView(); return 1;");
                    String last = grid ? ".drive-grid .grid-card:last-child" : "table tbody tr:last-child";
                    d.waitForScript("the " + view, "document.querySelectorAll('" + (grid ? ".drive-grid .grid-card" : "table tbody tr") + "').length >= 36", 60_000);
                    d.script("window.scrollTo(0, document.documentElement.scrollHeight); return 1;");
                    WebDriver.sleep(1000);
                    long start = ((Number) d.script("return Math.round(scrollY)")).longValue();
                    if (start == 0)
                        throw new AssertionError("The " + view + " should scroll, for its last row to be at the bottom of the page");
                    d.script("window.__scrolls = []; const t0 = performance.now(); const tick = () => {"
                            + " window.__scrolls.push(Math.round(scrollY)); if (performance.now() - t0 < 1000) requestAnimationFrame(tick); };"
                            + " requestAnimationFrame(tick); return 1;");
                    d.click(d.find(last + (grid ? " .card__menu" : " .table__menu")));
                    d.waitForScript("the menu", "!!document.querySelector('.drive-menu')", 10_000);
                    WebDriver.sleep(1200);
                    List<?> scrolls = (List<?>) d.script("return window.__scrolls");
                    long low = scrolls.stream().mapToLong(s -> ((Number) s).longValue()).min().orElse(start);
                    long high = scrolls.stream().mapToLong(s -> ((Number) s).longValue()).max().orElse(start);
                    if (low != start || high != start)
                        throw new AssertionError("Opening the " + view + "'s last menu should leave the page where it was, at " + start
                                + ", not move it between " + low + " and " + high + " over " + scrolls.size() + " frames");
                    Object fits = d.script("const r = document.querySelector('.drive-menu').getBoundingClientRect();"
                            + " return r.top >= 0 && r.bottom <= innerHeight ? true : r.top + ' to ' + r.bottom + ' of ' + innerHeight");
                    if (! Boolean.TRUE.equals(fits))
                        throw new AssertionError("The " + view + "'s last menu should open on the screen: " + fits);
                    System.out.println("  ok   the " + view + "'s last menu opens on the screen, and the page stays at " + start
                            + " through " + scrolls.size() + " frames");
                    d.sendKeys(d.find(".drive-menu"), "");
                    d.waitForScript("the menu closed", "!document.querySelector('.drive-menu')", 10_000);
                }
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }
}
