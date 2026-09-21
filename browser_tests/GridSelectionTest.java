import java.nio.file.*;
import java.util.*;

/** Picking files out of the drive's grid.
 *
 *  A pointer has a circle on every tile under it and a click that opens. A touch screen has
 *  neither, so it starts a selection by pressing and holding, and once one is running every
 *  tile carries a circle and a tap adds to the selection instead of opening.
 *
 *  The part worth guarding: openMenu borrows selectedFiles to say which file its actions
 *  apply to, which is not the user picking anything. Collapsing the two - reading
 *  selectedFiles.length where the code reads `picking` - puts the selection bar up behind
 *  every file's menu and turns the next click into a selection. It looks like a tidy-up and
 *  nothing else in the app complains.
 *
 *  Usage: java -cp ../server/Peergos.jar GridSelectionTest.java [engine] [url]
 */
public class GridSelectionTest {

    static final int PHONE_WIDTH = 390, PHONE_HEIGHT = 844;
    static final int DESKTOP_WIDTH = 1280, DESKTOP_HEIGHT = 900;
    static final String PREFIX = "pick-";
    static final String FOLDER = "pick-into";

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
        // A folder to paste into, made before the browser opens so the first listing has it -
        // this is how files are moved where dragging one onto a folder is not offered.
        Fixtures.uploadInto(serverDir.resolve("Peergos.jar"), url, Server.USERNAME, Server.PASSWORD,
                FOLDER, List.of(Fixtures.patternFile("inside.bin", 64)));
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-pick-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            d.scriptQuiet("window.__drive.isGrid = true; return 1;");

            Map<String, Integer> files = new LinkedHashMap<>();
            for (int i = 1; i <= 4; i++)
                files.put(PREFIX + i + ".bin", 256);
            Page.handFiles(d, files);
            for (String name : files.keySet())
                Page.waitForInDrive(d, name, 120_000);
            Page.waitForInDrive(d, FOLDER, 120_000);
            WebDriver.sleep(1500);

            desktop(d);
            touch(d, engine);
            // last, because it moves the files the rest addresses by name
            aCutPastesIntoTheFolderItWasAimedAt(d);
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** A pointer: circles on every tile, and a click that opens until files are being picked. */
    private static void desktop(WebDriver d) {
        d.setWindowRect(DESKTOP_WIDTH, DESKTOP_HEIGHT);
        d.waitForScript("the desktop width to register",
                "window.__drive.$store.state.windowWidth >= 1024", 30_000);
        clearSelection(d);

        int tiles = count(d, ".grid-card");
        if (tiles < 4)
            throw new AssertionError("Expected the uploaded files in the grid, found " + tiles + " tiles");
        if (count(d, ".grid-card .card__select") != tiles)
            throw new AssertionError("A pointer keeps a circle on every tile, but "
                    + count(d, ".grid-card .card__select") + " of " + tiles + " have one");
        System.out.println("  ok   a pointer has a circle on each of the " + tiles + " tiles");

        countOpens(d);
        clickTile(d, PREFIX + "1.bin");
        if (opens(d) != 1)
            throw new AssertionError("With nothing picked a click should open the file, but the"
                    + " open handler ran " + opens(d) + " times");
        if (selected(d) != 0)
            throw new AssertionError("A click with nothing picked selected " + selected(d) + " files");
        System.out.println("  ok   with nothing picked, a click opens");

        pick(d, PREFIX + "1.bin");
        if (selected(d) != 1 || ! barShown(d))
            throw new AssertionError("Picking one file should raise the bar, but "
                    + selected(d) + " files are picked and the bar is "
                    + (barShown(d) ? "up" : "down"));
        System.out.println("  ok   picking one file raises the selection bar");

        clickTile(d, PREFIX + "2.bin");
        if (opens(d) != 1)
            throw new AssertionError("A click while picking must not open a file, but the open"
                    + " handler has now run " + opens(d) + " times");
        if (selected(d) != 2)
            throw new AssertionError("A click while picking should add to the selection, which"
                    + " holds " + selected(d) + " files");
        System.out.println("  ok   while picking, a click adds instead of opening");

        menuBorrow(d);
        clearSelection(d);
        theBarsTickMatchesTheTiles(d);
    }

    /** The bar's select-all circle is the same control a tile carries, so it is the same size.
     *
     *  It is styled in the bar's own stylesheet, and the rules that size a tile's circle and
     *  the tick inside it do not reach there. Matching only the proportion is not enough -
     *  the two sit one above the other on screen and any difference in size shows.
     */
    private static void theBarsTickMatchesTheTiles(WebDriver d) {
        clearSelection(d);
        pick(d, PREFIX + "1.bin");
        d.script("window.__drive.selectAllOrNone(); return 1;");
        WebDriver.sleep(800);
        String sizes = String.valueOf(d.script(
                "const bar = document.querySelector('.drive-selected .card__select');"
                        + "if (bar == null) throw new Error('no select-all circle in the bar');"
                        + "const barTick = bar.querySelector('svg');"
                        + "if (barTick == null) throw new Error('the bar circle carries no tick');"
                        + "const tile = document.querySelector('.grid-card .card__select');"
                        + "const tileTick = tile.querySelector('svg');"
                        + "const w = e => Math.round(e.getBoundingClientRect().width);"
                        + "const ring = e => parseFloat(getComputedStyle(e).borderTopWidth);"
                        + "const offset = btn => { const s = btn.querySelector('svg').getBoundingClientRect();"
                        + "  const b = btn.getBoundingClientRect();"
                        + "  return Math.round((Math.abs((s.left + s.right) / 2 - (b.left + b.right) / 2)"
                        + "    + Math.abs((s.top + s.bottom) / 2 - (b.top + b.bottom) / 2)) * 10) / 10; };"
                        + "return [w(bar), w(tile), w(barTick), w(tileTick),"
                        + "        ring(bar), ring(tile), offset(bar), offset(tile)].join(',');"));
        String[] parts = sizes.split(",");
        int barCircle = Integer.parseInt(parts[0]), tileCircle = Integer.parseInt(parts[1]);
        int barTick = Integer.parseInt(parts[2]), tileTick = Integer.parseInt(parts[3]);
        double barRing = Double.parseDouble(parts[4]), tileRing = Double.parseDouble(parts[5]);
        double barOff = Double.parseDouble(parts[6]), tileOff = Double.parseDouble(parts[7]);
        if (barOff > 0.5)
            throw new AssertionError("The bar's tick sits " + barOff + "px off the centre of its"
                    + " circle - a tile's is " + tileOff + "px. Without flex centring the icon"
                    + " falls to the text baseline and hard against the left edge");
        if (barRing != tileRing)
            throw new AssertionError("The bar's circle has a " + barRing + "px ring where a"
                    + " tile's has " + tileRing + "px - with border-box the thicker one eats"
                    + " the disc inside it and the tick reads smaller, even at the same size");
        if (barCircle != tileCircle)
            throw new AssertionError("The bar's circle is " + barCircle + "px where a tile's is "
                    + tileCircle + "px - they sit one above the other and the difference shows");
        if (barTick != tileTick)
            throw new AssertionError("The bar's tick is " + barTick + "px where a tile's is "
                    + tileTick + "px");
        System.out.println("  ok   the bar's circle matches a tile's (" + barCircle + "px circle, "
                + barTick + "px tick, " + barRing + "px ring, " + barOff + "px off centre)");
        clearSelection(d);
    }

    /** No pointer: no circles until a press and hold starts a selection. */
    private static void touch(WebDriver d, String engine) {
        d.setWindowRect(PHONE_WIDTH, PHONE_HEIGHT);
        d.waitForScript("the phone width to register",
                "window.__drive.$store.state.windowWidth < 1024", 30_000);
        clearSelection(d);

        if (count(d, ".grid-card .card__select") != 0)
            throw new AssertionError("A touch layout carries no circle until a selection is"
                    + " running, but " + count(d, ".grid-card .card__select") + " tiles have one");
        System.out.println("  ok   no circles on a touch layout until something is picked");

        if (! Boolean.TRUE.equals(d.scriptQuiet(canSynthesiseTouch()))) {
            System.out.println("  skip " + engine + " cannot construct touch events here;"
                    + " the press and hold is not exercised");
        } else {
            pressAndHold(d, PREFIX + "1.bin", true);
            if (selected(d) != 0)
                throw new AssertionError("A press that travels is a scroll and must not pick,"
                        + " but " + selected(d) + " files are picked");
            System.out.println("  ok   a press that travels scrolls rather than picks");

            pressAndHold(d, PREFIX + "1.bin", false);
            if (selected(d) != 1)
                throw new AssertionError("Pressing and holding a tile should pick it, but "
                        + selected(d) + " files are picked");
            if (! barShown(d))
                throw new AssertionError("The selection bar should be up after a press and hold");
            System.out.println("  ok   pressing and holding picks the tile and raises the bar");

            countOpens(d);
            liftAndTap(d, PREFIX + "1.bin");
            if (opens(d) != 0)
                throw new AssertionError("The tap that ends a press and hold must not open the"
                        + " file, but the open handler ran " + opens(d) + " times");
            System.out.println("  ok   the tap that ends the hold does not open the file");
        }

        // From here the selection is set up directly, so the rest runs on every engine -
        // and from a known state, since the gesture above may or may not have run.
        clearSelection(d);
        pick(d, PREFIX + "1.bin");
        int tiles = count(d, ".grid-card");
        if (count(d, ".grid-card .card__select") != tiles)
            throw new AssertionError("While picking, every tile carries a circle, but "
                    + count(d, ".grid-card .card__select") + " of " + tiles + " do");
        System.out.println("  ok   while picking, all " + tiles + " tiles carry a circle");

        countOpens(d);
        clickTile(d, PREFIX + "2.bin");
        if (selected(d) != 2 || opens(d) != 0)
            throw new AssertionError("A tap while picking should add to the selection without"
                    + " opening: " + selected(d) + " picked, open handler ran " + opens(d) + " times");
        System.out.println("  ok   while picking, a tap adds instead of opening");

        clickName(d, PREFIX + "3.bin");
        if (selected(d) != 3)
            throw new AssertionError("The whole tile picks, the name included, but the"
                    + " selection holds " + selected(d) + " files");
        if (Boolean.TRUE.equals(d.scriptQuiet(
                "return !!document.querySelector('.grid-card figcaption.name-open');")))
            throw new AssertionError("A tap on the name while picking should add to the"
                    + " selection rather than opening the name out");
        System.out.println("  ok   while picking, the filename picks rather than opening out");

        clearSelection(d);
        clickName(d, PREFIX + "3.bin");
        if (! Boolean.TRUE.equals(d.scriptQuiet(
                "return !!document.querySelector('.grid-card figcaption.name-open');")))
            throw new AssertionError("With nothing picked, a tap on a long name should open it"
                    + " out - a touch screen never shows the title tooltip");
        System.out.println("  ok   with nothing picked, the filename opens out instead");

        clearSelection(d);
        menuBorrow(d);
        clearSelection(d);
        aCutStillHasSomewhereToGo(d);
        draggingIsForPointersOnly(d);
        menusStandDownWhilePicking(d);
        dismissedMenuLeavesNothing(d);
        listCheckboxIsAPick(d);
        listHeaderClearsTheBar(d);
    }

    /** The list view picks through a checkbox per row rather than through the tile handler,
     *  so that path has to put the drive into selection mode as well - otherwise ticking rows
     *  selects files with no bar to act on them.
     */
    private static void listCheckboxIsAPick(WebDriver d) {
        clearSelection(d);
        d.script("window.__drive.isGrid = false; return 1;");
        WebDriver.sleep(900);
        d.script("const rows = [...document.querySelectorAll('.drive-table tbody tr')];"
                + "const row = rows.find(r => r.textContent.indexOf(arguments[0]) >= 0);"
                + "if (row == null) throw new Error('no row for ' + arguments[0]);"
                + "row.querySelector('input[type=checkbox]').click(); return 1;", PREFIX + "1.bin");
        WebDriver.sleep(900);
        if (selected(d) != 1)
            throw new AssertionError("Ticking a row's checkbox should pick that one file, not "
                    + selected(d));
        if (! barShown(d))
            throw new AssertionError("Ticking a row's checkbox is how the list view picks a"
                    + " file, so it has to raise the selection bar - without it the files are"
                    + " picked and nothing can be done with them");
        System.out.println("  ok   a row's checkbox picks the file and raises the bar");
        clearSelection(d);

        // the same borrow the grid was protected from, down the list view's own path
        d.script("const vm = window.__drive;"
                + "vm.openMenu(vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0]));"
                + "return 1;", PREFIX + "1.bin");
        WebDriver.sleep(600);
        if (barShown(d))
            throw new AssertionError("Opening a row's menu must not raise the bar in the list"
                    + " view any more than it does in the grid");
        d.script("window.__drive.closeMenu(); return 1;");
        WebDriver.sleep(600);
        d.script("const rows = [...document.querySelectorAll('.drive-table tbody tr')];"
                + "const row = rows.find(r => r.textContent.indexOf(arguments[0]) >= 0);"
                + "if (row == null) throw new Error('no row for ' + arguments[0]);"
                + "row.querySelector('input[type=checkbox]').click(); return 1;", PREFIX + "2.bin");
        WebDriver.sleep(900);
        if (selected(d) != 1)
            throw new AssertionError("After dismissing one row's menu, ticking a single other"
                    + " row must leave exactly that one picked, not " + selected(d)
                    + " - the extra is the menu's leftover");
        System.out.println("  ok   ticking one row after a dismissed menu picks exactly one");
        clearSelection(d);
        d.script("window.__drive.isGrid = true; return 1;");
        WebDriver.sleep(900);
    }

    /** The list's sticky header is pushed down to clear the selection bar.
     *
     *  Its rule and the bar's condition are two readings of the same thing, so they have to
     *  agree at every count. They did not: the bar appears from the first file picked while
     *  the header waited for a second, which left the header under the bar at exactly one.
     */
    private static void listHeaderClearsTheBar(WebDriver d) {
        d.script("window.__drive.isGrid = false; return 1;");
        WebDriver.sleep(900);
        String idle = headerTop(d);
        pick(d, PREFIX + "1.bin");
        String picked = headerTop(d);
        if (idle.equals(picked))
            throw new AssertionError("With one file picked the selection bar is up, so the"
                    + " list's sticky header has to drop to clear it - it stayed at " + idle);
        System.out.println("  ok   one file picked drops the list header from "
                + idle + " to " + picked + " to clear the bar");
        clearSelection(d);
        if (! headerTop(d).equals(idle))
            throw new AssertionError("With the selection cleared the header should be back at "
                    + idle + ", not " + headerTop(d));
        System.out.println("  ok   clearing the selection puts the list header back");
        d.script("window.__drive.isGrid = true; return 1;");
        WebDriver.sleep(900);
    }

    private static String headerTop(WebDriver d) {
        return String.valueOf(d.script(
                "const row = document.querySelector('.drive-table thead tr');"
                        + "if (row == null) throw new Error('the list view has no header row');"
                        + "return getComputedStyle(row).top;"));
    }

    /** Opening a file's menu is not the user picking files, and must not look like it. */
    private static void menuBorrow(WebDriver d) {
        d.scriptQuiet("window.__drive.openMenu(window.__drive.sortedFiles[0]); return 1;");
        WebDriver.sleep(600);
        if (selected(d) != 1)
            throw new AssertionError("openMenu names its target through selectedFiles, so one"
                    + " file should be in it, not " + selected(d));
        if (barShown(d))
            throw new AssertionError("The menu borrowing selectedFiles must not raise the"
                    + " selection bar - see the note at the top of this test");
        System.out.println("  ok   a file's menu does not put the drive into selection mode");

        d.scriptQuiet("window.__drive.selectFromMenu(); return 1;");
        WebDriver.sleep(600);
        if (! barShown(d) || selected(d) != 1)
            throw new AssertionError("The menu's Select should leave one file picked with the"
                    + " bar up: " + selected(d) + " picked, bar "
                    + (barShown(d) ? "up" : "down"));
        System.out.println("  ok   the menu's Select does put it into selection mode");
    }

    /** The cut files land in the folder whose menu was used, not in the one being looked at.
     *
     *  isPasteOptionAvailable is a computed that writes multiSelectTargetFolder as a side
     *  effect, setting it to the current directory. openMenu sets it to the folder the menu
     *  belongs to. Which of those survives decides where the files go, so this follows the
     *  move through and reads the listings back rather than trusting the menu appeared.
     */
    private static void aCutPastesIntoTheFolderItWasAimedAt(WebDriver d) {
        clearSelection(d);
        pick(d, PREFIX + "1.bin");
        pick(d, PREFIX + "2.bin");
        d.script("window.__drive.cutMultiSelect(); return 1;");
        WebDriver.sleep(700);
        d.script("const vm = window.__drive;"
                + "vm.openMenu(vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0]));"
                + "return 1;", FOLDER);
        WebDriver.sleep(900);
        if (! Boolean.TRUE.equals(d.script("return !!document.querySelector('#paste-files');")))
            throw new AssertionError("With a cut pending, a folder's menu should offer Paste");
        d.script("document.querySelector('#paste-files').click(); return 1;");

        d.waitUntil("the cut files to leave the folder they came from",
                () -> ! Page.driveListing(d).contains(PREFIX + "1.bin")
                        && ! Page.driveListing(d).contains(PREFIX + "2.bin"), 120_000);
        System.out.println("  ok   the cut files left the folder they came from");

        Page.openPath(d, "/" + Server.USERNAME + "/" + FOLDER, FOLDER);
        WebDriver.sleep(1200);
        List<String> inside = Page.driveListing(d);
        if (! inside.contains(PREFIX + "1.bin") || ! inside.contains(PREFIX + "2.bin"))
            throw new AssertionError("The cut files should be in " + FOLDER + ", the folder whose"
                    + " menu pasted them, but it holds " + inside
                    + " - if they went to the directory being looked at instead, the computed"
                    + " that writes multiSelectTargetFolder overwrote the menu's target");
        System.out.println("  ok   they arrived in the folder whose menu was used");
    }

    /** Cutting several files must leave a way to paste them.
     *
     *  Cut keeps the files selected, and a folder's own menu is how a phone pastes into it -
     *  dragging a file onto a folder is a pointer gesture and is switched off on touch. So the
     *  rule that stands the per-item menu down has to let a paste target through: that menu
     *  opens the paste menu, which names the folder and leaves the selection alone.
     */
    private static void aCutStillHasSomewhereToGo(WebDriver d) {
        clearSelection(d);
        pick(d, PREFIX + "1.bin");
        pick(d, PREFIX + "2.bin");
        if (menuCount(d, FOLDER) != 0 && selected(d) != 2)
            throw new AssertionError("Expected two files picked, found " + selected(d));
        d.script("window.__drive.cutMultiSelect(); return 1;");
        WebDriver.sleep(700);
        if (selected(d) != 2)
            throw new AssertionError("Cut keeps the files selected, but " + selected(d) + " are");
        if (menuCount(d, FOLDER) != 1)
            throw new AssertionError("With a cut pending, the destination folder has to keep its"
                    + " menu - it is the only way to paste into it on a touch layout, and that"
                    + " menu does not disturb the selection");
        if (menuCount(d, PREFIX + "3.bin") != 0)
            throw new AssertionError("A plain file is not a paste target, so its menu should"
                    + " still stand down while several are picked");
        System.out.println("  ok   a cut leaves the destination folder's menu reachable");
        d.script("window.__drive.clipboardMultiSelect = null; return 1;");
        clearSelection(d);
    }

    /** Whether the tile for this name currently offers its menu. */
    private static int menuCount(WebDriver d, String name) {
        return ((Number) d.script(
                "const tile = [...document.querySelectorAll('.grid-card')].find(c => {"
                        + "  const n = c.querySelector('.card__name');"
                        + "  return n && n.textContent.trim() === arguments[0]; });"
                        + "if (tile == null) throw new Error('no tile for ' + arguments[0]);"
                        + "return tile.querySelectorAll('.card__menu').length;", name)).intValue();
    }

    /** A tile is draggable under a pointer and not under a finger.
     *
     *  A touch cannot finish an HTML5 drag, and the browser reads the start of one from the
     *  same press and hold that starts a selection, so leaving it on means the two gestures
     *  fight. This asserts the attribute, which is the mechanism - whether a given engine
     *  would have raised a drag from that press is not something the harness can produce.
     */
    private static void draggingIsForPointersOnly(WebDriver d) {
        d.setWindowRect(DESKTOP_WIDTH, DESKTOP_HEIGHT);
        d.waitForScript("the desktop width to register",
                "window.__drive.$store.state.windowWidth >= 1024", 30_000);
        if (! Boolean.TRUE.equals(draggable(d)))
            throw new AssertionError("Under a pointer a tile should stay draggable");
        d.setWindowRect(PHONE_WIDTH, PHONE_HEIGHT);
        d.waitForScript("the phone width to register",
                "window.__drive.$store.state.windowWidth < 1024", 30_000);
        if (Boolean.TRUE.equals(draggable(d)))
            throw new AssertionError("On a touch layout the tile must not be draggable - the"
                    + " browser starts a drag from the same press and hold that picks a file");
        System.out.println("  ok   tiles drag under a pointer and not under a finger");
    }

    private static Object draggable(WebDriver d) {
        return d.script("const fig = document.querySelector('.grid-card figure');"
                + "if (fig == null) throw new Error('no tile to check');"
                + "return fig.draggable;");
    }

    /** Once several files are picked the per-item menu stands down, in both views.
     *
     *  Opening a file's menu replaces the selection with that one file, so a menu left
     *  reachable is a single click that throws the pick away - and its actions cannot work on
     *  a selection anyway: rename throws above one file, copy and cut return silently. At one
     *  file it names the file already picked, costs nothing, and is the only way to reach
     *  rename, share and the file's details, so it stays.
     */
    private static void menusStandDownWhilePicking(WebDriver d) {
        clearSelection(d);
        int tiles = count(d, ".grid-card");
        if (count(d, ".grid-card .card__menu") != tiles)
            throw new AssertionError("With nothing picked every tile offers its menu, but "
                    + count(d, ".grid-card .card__menu") + " of " + tiles + " do");
        pick(d, PREFIX + "1.bin");
        if (count(d, ".grid-card .card__menu") != tiles)
            throw new AssertionError("At one file picked the tile menus stay - the menu names"
                    + " the file already picked and is the only route to rename and share -"
                    + " but " + count(d, ".grid-card .card__menu") + " of " + tiles + " remain");
        pick(d, PREFIX + "2.bin");
        if (count(d, ".grid-card .card__menu") != 0)
            throw new AssertionError("Once several are picked the tile menus should stand down,"
                    + " but " + count(d, ".grid-card .card__menu") + " are still offered");
        System.out.println("  ok   the tile menus stay at one picked and stand down above it");
        clearSelection(d);
        if (count(d, ".grid-card .card__menu") != tiles)
            throw new AssertionError("The tile menus should be back once nothing is picked");

        d.script("window.__drive.isGrid = false; return 1;");
        WebDriver.sleep(900);
        int rows = count(d, ".drive-table tbody tr");
        if (count(d, ".drive-table .table__menu") != rows)
            throw new AssertionError("With nothing picked every row offers its menu, but "
                    + count(d, ".drive-table .table__menu") + " of " + rows + " do");
        pick(d, PREFIX + "1.bin");
        if (count(d, ".drive-table .table__menu") != rows)
            throw new AssertionError("At one file picked the row menus stay, but only "
                    + count(d, ".drive-table .table__menu") + " of " + rows + " remain");
        pick(d, PREFIX + "2.bin");
        if (count(d, ".drive-table .table__menu") != 0)
            throw new AssertionError("Once several are picked the row menus should stand down,"
                    + " but " + count(d, ".drive-table .table__menu") + " are still offered");
        System.out.println("  ok   the row menus behave the same way");
        clearSelection(d);
        d.script("window.__drive.isGrid = true; return 1;");
        WebDriver.sleep(900);
    }

    /** A menu that was dismissed rather than used must leave nothing in the next selection.
     *
     *  openMenu names its target by putting it in selectedFiles and closeMenu does not take it
     *  back out, so a pick that adds to whatever is already there starts with a file nobody
     *  chose - and that file goes into whatever the selection bar is then asked to do, delete
     *  included.
     */
    private static void dismissedMenuLeavesNothing(WebDriver d) {
        clearSelection(d);
        d.script("const vm = window.__drive;"
                + "vm.openMenu(vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0]));"
                + "return 1;", PREFIX + "1.bin");
        WebDriver.sleep(600);
        if (! marked(d, PREFIX + "1.bin"))
            throw new AssertionError("While its menu is open the file it applies to should be"
                    + " marked, so it is clear what the menu will act on");
        d.script("window.__drive.closeMenu(); return 1;");
        WebDriver.sleep(600);
        if (marked(d, PREFIX + "1.bin"))
            throw new AssertionError("Once the menu is dismissed its file should stop looking"
                    + " picked - nobody picked it");
        System.out.println("  ok   a file is marked while its menu is open and not after");

        pick(d, PREFIX + "2.bin");
        if (selected(d) != 1)
            throw new AssertionError("After dismissing one file's menu, picking a single other"
                    + " file must leave exactly that one picked, not " + selected(d)
                    + " - the extra is the menu's leftover and would be deleted with the rest");
        System.out.println("  ok   picking one file after a dismissed menu picks exactly one");
        clearSelection(d);
    }

    private static String canSynthesiseTouch() {
        return "try {"
                + "  if (typeof Touch !== 'function' || typeof TouchEvent !== 'function') return false;"
                + "  new Touch({identifier: 1, target: document.body});"
                + "  return true;"
                + "} catch (e) { return false; }";
    }

    /** touchstart on a tile, then either a travel that cancels it or a wait that does not. */
    private static void pressAndHold(WebDriver d, String name, boolean travels) {
        d.script(touchHelpers() + tileFor(name) + "const p = at(tile);"
                + "touch(tile, 'touchstart', p[0], p[1]);"
                + "if (arguments[1]) touch(tile, 'touchmove', p[0], p[1] + 40);"
                + "return 1;", name, travels);
        WebDriver.sleep(900);
        if (travels) {
            d.script(touchHelpers() + tileFor(name) + "const p = at(tile);"
                    + "touch(tile, 'touchend', p[0], p[1]); return 1;", name);
            WebDriver.sleep(300);
        }
    }

    private static void liftAndTap(WebDriver d, String name) {
        d.script(touchHelpers() + tileFor(name) + "const p = at(tile);"
                + "touch(tile, 'touchend', p[0], p[1]); tile.click(); return 1;", name);
        WebDriver.sleep(800);
    }

    private static String touchHelpers() {
        return "function at(el) { const b = el.getBoundingClientRect();"
                + "  return [b.left + b.width / 2, b.top + b.height / 2]; }"
                + "function touch(el, type, x, y) {"
                + "  const t = new Touch({identifier: 1, target: el, clientX: x, clientY: y});"
                + "  const empty = type === 'touchend' || type === 'touchcancel';"
                + "  el.dispatchEvent(new TouchEvent(type, {"
                + "    touches: empty ? [] : [t], targetTouches: empty ? [] : [t],"
                + "    changedTouches: [t], bubbles: true, cancelable: true}));"
                + "}";
    }

    /** The tile for one of this test's own files, wherever the sort put it. */
    private static String tileFor(String name) {
        return "const tile = [...document.querySelectorAll('.grid-card')].find(c => {"
                + "  const n = c.querySelector('.card__name');"
                + "  return n && n.textContent.trim() === arguments[0]; });"
                + "if (tile == null) throw new Error('no tile for ' + arguments[0]);";
    }

    private static void clickTile(WebDriver d, String name) {
        d.script(tileFor(name) + "tile.click(); return 1;", name);
        WebDriver.sleep(800);
    }

    private static void clickName(WebDriver d, String name) {
        d.script(tileFor(name) + "tile.querySelector('.card__name').click(); return 1;", name);
        WebDriver.sleep(800);
    }

    private static void pick(WebDriver d, String name) {
        d.script("const vm = window.__drive;"
                + "const file = vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0]);"
                + "if (file == null) throw new Error('no file named ' + arguments[0]);"
                + "vm.toggleSelection(file, false); return 1;", name);
        WebDriver.sleep(600);
    }

    private static void clearSelection(WebDriver d) {
        d.scriptQuiet("window.__drive.selectedFiles = []; window.__drive.viewMenu = false; return 1;");
        WebDriver.sleep(500);
    }

    /** Counts where a click was routed. It deliberately does not open: navigating would move
     *  the drive out of the folder the rest of the test is addressing by name. */
    private static void countOpens(WebDriver d) {
        d.scriptQuiet("const vm = window.__drive;"
                + "if (!vm.__openSpy) { vm.navigateDrive = function () { window.__opens++; };"
                + "  vm.__openSpy = true; }"
                + "window.__opens = 0; return 1;");
    }

    private static int opens(WebDriver d) {
        return ((Number) d.scriptQuiet("return window.__opens;")).intValue();
    }

    private static int selected(WebDriver d) {
        return ((Number) d.scriptQuiet("return (window.__drive.selectedFiles || []).length;")).intValue();
    }

    /** Whether the tile for this file is drawn as picked. */
    private static boolean marked(WebDriver d, String name) {
        return Boolean.TRUE.equals(d.script(
                "const tile = [...document.querySelectorAll('.grid-card')].find(c => {"
                        + "  const n = c.querySelector('.card__name');"
                        + "  return n && n.textContent.trim() === arguments[0]; });"
                        + "if (tile == null) throw new Error('no tile for ' + arguments[0]);"
                        + "return tile.classList.contains('selected');", name));
    }

    private static boolean barShown(WebDriver d) {
        return Boolean.TRUE.equals(d.scriptQuiet("return !!document.querySelector('.drive-selected');"));
    }

    private static int count(WebDriver d, String css) {
        return ((Number) d.scriptQuiet("return document.querySelectorAll(arguments[0]).length;", css)).intValue();
    }
}
