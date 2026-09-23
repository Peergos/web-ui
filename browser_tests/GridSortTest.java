import java.nio.file.*;
import java.util.*;

/** Choosing the order of a drive listing, from either view.
 *
 *  The order itself was always shared - both views draw the same sortedFiles - but only the
 *  table offered a way to change it, through its column headings. The grid had none, so a
 *  listing could only be reordered by leaving the view. The header's sort menu sets the same
 *  state those headings do, which is the part worth guarding: a second copy of the state, or
 *  a menu wired to its own, would reorder one view and leave the other as it was.
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
                    () -> List.of(PREFIX + "a.bin", PREFIX + "b.bin", PREFIX + "c.bin").equals(gridOrder(d)), 30_000);
            System.out.println("  grid opens in name order: " + gridOrder(d));

            pickSort(d, "Size");
            d.waitUntil("the grid to reorder by size",
                    () -> List.of(PREFIX + "b.bin", PREFIX + "c.bin", PREFIX + "a.bin").equals(gridOrder(d)), 30_000);
            expect("grid ascending by size", List.of(PREFIX + "b.bin", PREFIX + "c.bin", PREFIX + "a.bin"), gridOrder(d));

            // picking the property already in force is not how the order is turned around here
            // - that is the menu's last entry, so a second pick must leave the order alone
            pickSort(d, "Size");
            Thread.sleep(1500);
            expect("picking size again leaves the order as it was",
                    List.of(PREFIX + "b.bin", PREFIX + "c.bin", PREFIX + "a.bin"), gridOrder(d));

            toggleOrder(d);
            d.waitUntil("the grid to turn the size order around",
                    () -> List.of(PREFIX + "a.bin", PREFIX + "c.bin", PREFIX + "b.bin").equals(gridOrder(d)), 30_000);
            expect("grid descending by size", List.of(PREFIX + "a.bin", PREFIX + "c.bin", PREFIX + "b.bin"), gridOrder(d));

            // and the menu says so, both halves of it
            if (! "Size".equals(sortInForce(d)))
                throw new AssertionError("The menu should tick Size, got " + sortInForce(d));
            if (! "Descending".equals(directionInForce(d)))
                throw new AssertionError("The menu should read Descending, got " + directionInForce(d));
            System.out.println("  ok   the menu states both halves: Size, Descending");

            // and the list is holding the same order, from the same state, not its own copy
            d.scriptQuiet("window.__drive.isGrid = false; return 1;");
            d.waitUntil("the list to draw", () -> listOrder(d).size() == 3, 30_000);
            expect("list carries the grid's order", List.of(PREFIX + "a.bin", PREFIX + "c.bin", PREFIX + "b.bin"), listOrder(d));
            String sorted = String.valueOf(d.script(
                    "const th = document.querySelector('.drive-table thead th.sorted');" +
                    "return th ? th.textContent.trim() : 'NONE';"));
            if (! sorted.startsWith("Size"))
                throw new AssertionError("The table should show Size as the sorted column, got " + sorted);
            System.out.println("  ok   the table's own heading agrees: " + sorted);

            // a table heading must move the grid too. Choosing a different property keeps the
            // direction in force - only choosing the one already in force turns it around -
            // so this lands on name descending.
            d.scriptQuiet("const th = [...document.querySelectorAll('.drive-table thead th')]" +
                    ".find(e => e.textContent.trim().startsWith('Name')); th.click(); return 1;");
            d.scriptQuiet("window.__drive.isGrid = true; return 1;");
            d.waitUntil("the grid to follow the table's heading",
                    () -> List.of(PREFIX + "c.bin", PREFIX + "b.bin", PREFIX + "a.bin").equals(gridOrder(d)), 30_000);
            expect("a table heading moves the grid as well",
                    List.of(PREFIX + "c.bin", PREFIX + "b.bin", PREFIX + "a.bin"), gridOrder(d));

            // and the menu shows what that heading set, rather than what it last set itself
            String inForce = sortInForce(d);
            if (! inForce.startsWith("Name"))
                throw new AssertionError("The menu should show Name in force, got " + inForce);
            System.out.println("  ok   the menu reports the heading's choice: " + inForce);

            // the menu is in the header at every width, so a phone sorts from the same place
            d.setWindowRect(PHONE_WIDTH, PHONE_HEIGHT);
            d.waitUntil("the phone's grid to draw", () -> gridOrder(d).size() == 3, 30_000);
            pickSort(d, "Size");
            d.waitUntil("the phone's grid to reorder by size",
                    () -> List.of(PREFIX + "a.bin", PREFIX + "c.bin", PREFIX + "b.bin").equals(gridOrder(d)), 30_000);
            expect("a phone sorts from the same menu",
                    List.of(PREFIX + "a.bin", PREFIX + "c.bin", PREFIX + "b.bin"), gridOrder(d));
            toggleOrder(d);
            d.waitUntil("the phone to turn the order around",
                    () -> List.of(PREFIX + "b.bin", PREFIX + "c.bin", PREFIX + "a.bin").equals(gridOrder(d)), 30_000);
            expect("and turns it around from there too",
                    List.of(PREFIX + "b.bin", PREFIX + "c.bin", PREFIX + "a.bin"), gridOrder(d));
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Opens the header's sort menu and chooses one entry by its label. */
    static void pickSort(WebDriver d, String label) {
        openSortMenu(d);
        Object hit = d.script("const li = [...document.querySelectorAll(" +
                "'.drive-header .sort .dropdown__content li')]" +
                ".find(e => e.textContent.trim().startsWith(arguments[0]));" +
                "if (! li) return 'NO SUCH ENTRY'; li.click(); return 'ok';", label);
        if (! "ok".equals(String.valueOf(hit)))
            throw new AssertionError("The sort menu should offer " + label + ", got " + hit);
    }

    /** The entry the menu ticks, which is the property in force. */
    static String sortInForce(WebDriver d) {
        return readMenu(d, "const li = [...document.querySelectorAll(" +
                "'.drive-header .sort .dropdown__content li')].find(e => e.querySelector('.sort-tick'));" +
                "return li ? li.textContent.trim() : 'NONE';");
    }

    /** What the menu's last entry says the direction is. */
    static String directionInForce(WebDriver d) {
        return readMenu(d, "const li = document.querySelector(" +
                "'.drive-header .sort .dropdown__content .sort__order');" +
                "return li ? li.textContent.trim() : 'NONE';");
    }

    /** Turns the order around from the menu's last entry. */
    static void toggleOrder(WebDriver d) {
        openSortMenu(d);
        Object hit = d.script("const li = document.querySelector(" +
                "'.drive-header .sort .dropdown__content .sort__order');" +
                "if (! li) return 'NO ORDER ENTRY'; li.click(); return 'ok';");
        if (! "ok".equals(String.valueOf(hit)))
            throw new AssertionError("The sort menu should carry a direction entry, got " + hit);
    }

    /** Opens the menu, reads something out of it, and puts it away again. */
    static String readMenu(WebDriver d, String script) {
        openSortMenu(d);
        String out = String.valueOf(d.script(script));
        // the trigger toggles, so this puts the menu away again
        d.scriptQuiet("document.querySelector('.drive-header .sort .app-button').click(); return 1;");
        return out;
    }

    static void openSortMenu(WebDriver d) {
        d.scriptQuiet("document.querySelector('.drive-header .sort .app-button').click(); return 1;");
        d.waitForScript("the sort menu to open",
                "document.querySelector('.drive-header .sort .dropdown__content')", 10_000);
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
