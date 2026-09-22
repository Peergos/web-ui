import java.nio.file.*;
import java.util.*;

/** Choosing the order of a drive listing from the header, in either view.
 *
 *  The order itself was always shared - both views draw the same sortedFiles - but only the
 *  table offered a way to change it, through its column headings. The grid had none, so a
 *  listing could only be reordered by leaving the view. The bar sets the same state those
 *  headings do, which is the part worth guarding: a second copy of the state, or a bar wired
 *  to its own, would reorder one view and leave the other as it was.
 *
 *  The bar stands down for a list wide enough to show its headings, and takes over where
 *  they are hidden - so exactly one control is offered at every width.
 *
 *  Sizes are chosen so name order and size order disagree - asserting on an order that both
 *  would satisfy proves nothing.
 *
 *  Usage: java -cp ../server/Peergos.jar GridSortTest.java [engine] [url]
 */
public class GridSortTest {

    static final int DESKTOP_WIDTH = 1280, DESKTOP_HEIGHT = 900;
    static final int PHONE_WIDTH = 390, PHONE_HEIGHT = 844;
    static final String PREFIX = "sort-";

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-sort-"), headless)) {
            d.setWindowRect(DESKTOP_WIDTH, DESKTOP_HEIGHT);
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            d.scriptQuiet("window.__drive.isGrid = true; return 1;");

            // name order a,b,c; size order b,c,a - so neither can pass for the other
            Map<String, Integer> files = new LinkedHashMap<>();
            files.put(PREFIX + "a.bin", 4096);
            files.put(PREFIX + "b.bin", 64);
            files.put(PREFIX + "c.bin", 1024);
            Page.handFiles(d, files);
            for (String name : files.keySet())
                Page.waitForInDrive(d, name, 120_000);

            // whatever a previous run left in localStorage, start from name ascending
            d.scriptQuiet("window.__drive.sortBy = 'name'; window.__drive.normalSortOrder = true; return 1;");
            d.waitUntil("the grid to settle on name order",
                    () -> List.of("sort-a.bin", "sort-b.bin", "sort-c.bin").equals(gridOrder(d)), 30_000);
            System.out.println("  grid opens in name order: " + gridOrder(d));

            pressChip(d, "Size");
            d.waitUntil("the grid to reorder by size",
                    () -> List.of("sort-b.bin", "sort-c.bin", "sort-a.bin").equals(gridOrder(d)), 30_000);
            expect("grid ascending by size", List.of("sort-b.bin", "sort-c.bin", "sort-a.bin"), gridOrder(d));

            // the same entry again turns the order around rather than picking size afresh
            pressChip(d, "Size");
            d.waitUntil("the grid to turn the size order around",
                    () -> List.of("sort-a.bin", "sort-c.bin", "sort-b.bin").equals(gridOrder(d)), 30_000);
            expect("grid descending by size", List.of("sort-a.bin", "sort-c.bin", "sort-b.bin"), gridOrder(d));

            // over the list, the bar gives way to the headings - one control for one state -
            // but the order it set stands
            d.scriptQuiet("window.__drive.isGrid = false; return 1;");
            d.waitUntil("the list to draw", () -> listOrder(d).size() == 3, 30_000);
            expect("list carries the grid's order", List.of(PREFIX + "a.bin", PREFIX + "c.bin", PREFIX + "b.bin"), listOrder(d));
            if (barShown(d))
                throw new AssertionError("A list wide enough for its headings should not also wear the bar");
            System.out.println("  ok   the bar stands down for a wide list's headings");
            String sorted = String.valueOf(d.script(
                    "const th = document.querySelector('.drive-table thead th.sorted');" +
                    "return th ? th.textContent.trim() : 'NONE';"));
            if (! sorted.startsWith("Size"))
                throw new AssertionError("The table should show Size as the sorted column, got " + sorted);
            System.out.println("  ok   the heading carries the state instead: " + sorted);

            // and those headings still move both views. Choosing a different property keeps the
            // direction in force - only choosing the one already in force turns it around - so
            // this lands on name descending.
            d.scriptQuiet("const th = [...document.querySelectorAll('.drive-table thead th')]" +
                    ".find(e => e.textContent.trim().startsWith('Name')); th.click(); return 1;");
            d.waitUntil("the list to follow its heading",
                    () -> List.of(PREFIX + "c.bin", PREFIX + "b.bin", PREFIX + "a.bin").equals(listOrder(d)), 30_000);
            d.scriptQuiet("window.__drive.isGrid = true; return 1;");
            d.waitUntil("the grid to draw", () -> gridOrder(d).size() == 3, 30_000);
            expect("the grid opens on what the heading set",
                    List.of(PREFIX + "c.bin", PREFIX + "b.bin", PREFIX + "a.bin"), gridOrder(d));

            // narrow enough and the headings are gone, so the list wears the bar after all
            d.setWindowRect(PHONE_WIDTH, PHONE_HEIGHT);
            d.scriptQuiet("window.__drive.isGrid = false; return 1;");
            d.waitUntil("the phone's list to draw", () -> listOrder(d).size() == 3, 30_000);
            d.waitUntil("the bar to take over from the hidden headings", () -> barShown(d), 15_000);
            expect("a phone's list wears the same bar", List.of("Name", "Size", "Type", "Modified", "Created"), chips(d));
            if (! "Name".equals(activeChip(d)))
                throw new AssertionError("The bar should show Name in force, got " + activeChip(d));
            // descending is still in force from the heading, and picking a different property
            // keeps it, so this is size descending
            pressChip(d, "Size");
            d.waitUntil("the phone's list to reorder by size",
                    () -> List.of(PREFIX + "a.bin", PREFIX + "c.bin", PREFIX + "b.bin").equals(listOrder(d)), 30_000);
            expect("and sorts from there", List.of(PREFIX + "a.bin", PREFIX + "c.bin", PREFIX + "b.bin"), listOrder(d));
            if (! "Size".equals(activeChip(d)))
                throw new AssertionError("The bar should now show Size in force, got " + activeChip(d));
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Presses one chip of the sort bar by its label, whichever view it stands over. */
    static void pressChip(WebDriver d, String label) {
        Object hit = d.script("const chip = [...document.querySelectorAll('.drive-sort__chip')]" +
                ".find(e => e.textContent.trim().startsWith(arguments[0]));" +
                "if (! chip) return 'NO SUCH CHIP'; chip.click(); return 'ok';", label);
        if (! "ok".equals(String.valueOf(hit)))
            throw new AssertionError("The sort bar should offer " + label + ", got " + hit);
    }

    /** The bar's chips, in order - the same five whichever view stands under it. */
    static List<String> chips(WebDriver d) {
        Object got = d.script("return [...document.querySelectorAll('.drive-sort__chip')]" +
                ".map(e => e.textContent.trim());");
        List<String> out = new ArrayList<>();
        if (got instanceof List)
            for (Object o : (List<?>) got)
                out.add(String.valueOf(o));
        return out;
    }

    /** Whether the bar is drawn at all: it is in the page over a wide list too, hidden. */
    static boolean barShown(WebDriver d) {
        Object h = d.script("const b = document.querySelector('.drive-sort');" +
                "return b ? b.offsetHeight : 0;");
        return h instanceof Number && ((Number) h).doubleValue() > 0;
    }

    /** The label of the chip the bar shows as in force, or NONE. */
    static String activeChip(WebDriver d) {
        return String.valueOf(d.script(
                "const c = document.querySelector('.drive-sort__chip.sorted');" +
                "return c ? c.textContent.trim() : 'NONE';"));
    }

    static List<String> gridOrder(WebDriver d) {
        return names(d, ".grid-card .card__name");
    }

    static List<String> listOrder(WebDriver d) {
        return names(d, ".drive-table .table__name");
    }

    /** The names as drawn, in the order they are drawn - not the unsorted source list.
     *  Only this test's own files: the drive it runs against already holds folders and
     *  whatever else was put there, and folders sort ahead of files whatever the property. */
    static List<String> names(WebDriver d, String selector) {
        Object got = d.script("return [...document.querySelectorAll(arguments[0])]" +
                ".map(e => e.textContent.trim());", selector);
        List<String> out = new ArrayList<>();
        if (got instanceof List)
            for (Object o : (List<?>) got) {
                String name = String.valueOf(o);
                if (name.startsWith(PREFIX))
                    out.add(name);
            }
        return out;
    }

    static void expect(String what, List<String> want, List<String> got) {
        if (! want.equals(got))
            throw new AssertionError(what + ": expected " + want + " but the view drew " + got);
        System.out.println("  ok   " + what + ": " + got);
    }
}
