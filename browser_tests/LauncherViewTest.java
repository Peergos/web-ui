import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** The launcher, with apps installed and shortcuts pinned: each shows, an app launches from its
 *  tile, its menu opens from the button on the tile as well as a right-click, and removing an app
 *  or a shortcut takes it off the page - what the launcher did before it was restyled.
 *
 *  Usage: java -cp ../server/Peergos.jar LauncherViewTest.java [engine] [peergos url]
 */
public class LauncherViewTest {

    static final String PASSWORD = "testpassword";

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-launcher-"), headless)) {
            String user = seed(url);
            d.setWindowRect(1280, 900);
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, user, PASSWORD);
            Page.gotoDrive(d);
            pin(d, "/" + user, user, "Docs");
            pin(d, "/" + user + "/Docs", "Docs", "plan.md");
            openLauncher(d);

            d.waitForScript("three app tiles", "document.querySelectorAll('.app-tile').length === 3", 60_000);
            List<?> tiles = (List<?>) d.script("return [...document.querySelectorAll('.app-tile .app-icon-title')].map(t => t.textContent.trim()).sort()");
            if (! tiles.equals(List.of(LONG_NAME, "Notes", "Sketch")))
                throw new AssertionError("The installed apps should each have a tile: " + tiles);
            d.waitForScript("two shortcuts", "document.querySelectorAll('.shortcut-table tbody tr').length === 2", 60_000);
            if (! "2".equals(d.script("return document.querySelector('.launcher-shortcuts .pg-sectionhead span').textContent.trim()")))
                throw new AssertionError("The shortcuts heading should count them");
            Object folderName = d.script("return [...document.querySelectorAll('.shortcut-table tbody tr')].find(r => !r.textContent.includes('plan.md')).querySelector('.shortcut-table__name').textContent.trim()");
            if (! "Docs".equals(folderName))
                throw new AssertionError("A pinned folder should show its name, not: '" + folderName + "'");
            System.out.println("  ok   installed apps show as tiles, and the pinned shortcuts under a heading that counts them, a folder by its name");

            tileMenu(d, "Notes", "button");
            d.waitForScript("the app menu", "!!document.querySelector('.app-grid-flex-container #appMenu')", 10_000);
            d.script("[...document.querySelectorAll('#appMenu li')].find(li => li.textContent.trim() === 'Details').click(); return 1;");
            d.waitForScript("the app details", "!!document.querySelector('.app-details-container') && document.querySelector('.app-details-container').textContent.includes('Notes')", 30_000);
            d.script("document.querySelector('.app-details-container .pg-dialog__close').click(); return 1;");
            d.waitForScript("the details closed", "!document.querySelector('.app-details-container')", 10_000);
            // and on escape, as every dialog on this surface closes
            tileMenu(d, "Notes", "button");
            d.waitForScript("the app menu", "!!document.querySelector('.app-grid-flex-container #appMenu')", 10_000);
            d.script("[...document.querySelectorAll('#appMenu li')].find(li => li.textContent.trim() === 'Details').click(); return 1;");
            d.waitForScript("the app details again", "!!document.querySelector('.app-details-container')", 30_000);
            d.sendKeys(d.find(".app-details-container .pg-dialog__close"), "\uE00C");
            d.waitForScript("the details closed by escape", "!document.querySelector('.app-details-container')", 10_000);
            tileMenu(d, "Sketch", "right-click");
            d.waitForScript("the app menu from a right-click", "!!document.querySelector('.app-grid-flex-container #appMenu')", 10_000);
            // a touch screen has no mouse to leave the menu with: a tap anywhere else closes it
            d.click(d.find(".launcher-shortcuts .pg-sectionhead h2"));
            d.waitForScript("the menu closed by a click elsewhere", "!document.querySelector('.app-grid-flex-container #appMenu')", 10_000);
            tileMenu(d, "Notes", "button");
            d.waitForScript("the app menu", "!!document.querySelector('.app-grid-flex-container #appMenu')", 10_000);
            d.sendKeys(d.find(".app-grid-flex-container #appMenu"), "\uE00C");
            d.waitForScript("the menu closed by escape", "!document.querySelector('.app-grid-flex-container #appMenu')", 10_000);
            System.out.println("  ok   an app's menu opens from the button on its tile and from a right-click, shows its details, and closes on a click elsewhere or escape");

            d.script("[...document.querySelectorAll('.app-tile')].find(t => t.textContent.includes('Notes')).querySelector('.app-grid-item').click(); return 1;");
            d.waitForScript("the app running", "window.__launcher.showAppSandbox", 30_000);
            d.script("window.__launcher.closeAppSandbox(); return 1;");
            d.waitForScript("the app closed", "!window.__launcher.showAppSandbox", 10_000);
            System.out.println("  ok   a tile launches its app");

            // a long name is cut to two lines, and a tap on it shows the rest rather than launching
            String label = "[...document.querySelectorAll('.app-icon-title')].find(l => l.textContent.includes('Household'))";
            double lineHeight = ((Number) d.script("return parseFloat(getComputedStyle(" + label + ").lineHeight)")).doubleValue();
            double cut = ((Number) d.script("return " + label + ".getBoundingClientRect().height")).doubleValue();
            if (cut > lineHeight * 2 + 1)
                throw new AssertionError("A long name should take two lines at most, not " + cut + "px of " + lineHeight + "px lines");
            d.script(label + ".click(); return 1;");
            d.waitUntil("the whole name", () -> ((Number) d.script("return " + label + ".getBoundingClientRect().height")).doubleValue() > cut + 1, 10_000);
            if (Boolean.TRUE.equals(d.script("return !!window.__launcher.showAppSandbox")))
                throw new AssertionError("A tap on a long name should show it, not launch the app");
            d.script(label + ".click(); return 1;");
            d.waitUntil("the name cut again", () -> Math.abs(((Number) d.script("return " + label + ".getBoundingClientRect().height")).doubleValue() - cut) < 1, 10_000);
            d.script("[...document.querySelectorAll('.app-icon-title')].find(l => l.textContent.trim() === 'Notes').click(); return 1;");
            d.waitForScript("the app running from its name", "window.__launcher.showAppSandbox", 30_000);
            d.script("window.__launcher.closeAppSandbox(); return 1;");
            d.waitForScript("the app closed", "!window.__launcher.showAppSandbox", 10_000);
            System.out.println("  ok   a long name shows in full on a tap and is cut again on another, and a short name still launches");

            tileMenu(d, "Sketch", "button");
            // the menu's items render a moment after the menu itself
            d.waitForScript("the remove item", "[...document.querySelectorAll('.app-grid-flex-container #appMenu li')].some(li => li.textContent.trim() === 'Remove')", 10_000);
            d.script("[...document.querySelectorAll('#appMenu li')].find(li => li.textContent.trim() === 'Remove').click(); return 1;");
            d.waitForScript("the removal to confirm", "!!document.querySelector('.pg-dialog') && document.querySelector('.pg-dialog').textContent.includes('Sketch')", 30_000);
            d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === 'Yes').click(); return 1;");
            d.waitForScript("two apps left", "document.querySelectorAll('.app-tile').length === 2", 60_000);
            System.out.println("  ok   removing an app from its menu, once confirmed, takes its tile away");

            // the app goes before its confirmation has faded out, and that dialog's Yes would pass
            // for the next one's: wait for it to be gone
            d.waitForScript("the app's confirmation gone", "!document.querySelector('.pg-dialog')", 10_000);
            d.script("[...document.querySelectorAll('.shortcut-table tbody tr')].find(r => r.textContent.includes('plan.md')).querySelector('.pg-btn--danger').click(); return 1;");
            d.waitForScript("the removal to confirm", "!!document.querySelector('.pg-dialog') && document.querySelector('.pg-dialog').textContent.includes('shortcut')", 30_000);
            d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === 'Yes').click(); return 1;");
            d.waitForScript("one shortcut left", "document.querySelectorAll('.shortcut-table tbody tr').length === 1"
                    + " && document.querySelector('.launcher-shortcuts .pg-sectionhead span').textContent.trim() === '1'", 60_000);
            System.out.println("  ok   removing a shortcut, once confirmed, takes it off the list, and the count with it");

            d.script("document.querySelector('.shortcut-table tbody tr .shortcut-table__name').click(); return 1;");
            d.waitForScript("the drive", "!!document.querySelector('.drive-view') && !document.querySelector('.launcher-view')", 30_000);
            Page.gotoView(d, "Drive", "downloadFile", "__drive");
            d.waitUntil("the pinned folder open", () -> Page.currentPath(d).replaceAll("/$", "").endsWith("/Docs") ? Boolean.TRUE : null, 30_000);
            System.out.println("  ok   a pinned folder's name opens it in the drive");

            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, user, PASSWORD);
            openLauncher(d);
            d.waitForScript("what was left", "document.querySelectorAll('.app-tile').length === 2 && document.querySelectorAll('.shortcut-table tbody tr').length === 1", 60_000);
            System.out.println("  ok   and both are gone after signing in again");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static final String LONG_NAME = "Household budget and shared expenses planner for the whole family";

    /** A user with three apps installed, one with a long name, and a folder holding a file. */
    static String seed(String url) throws Exception {
        String user = "lina" + (System.currentTimeMillis() % 100000);
        Crypto crypto = Builder.initCrypto();
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        UserContext u = UserContext.signUp(user, PASSWORD, "", network, crypto).join();
        mkdir(u, crypto, "/" + user, ".apps");
        for (String[] app : new String[][] {{"notes", "Notes"}, {"sketch", "Sketch"}, {"budget", LONG_NAME}}) {
            mkdir(u, crypto, "/" + user + "/.apps", app[0]);
            put(u, crypto, "/" + user + "/.apps/" + app[0], "peergos-app.json", String.join("\n",
                    "{", "  \"schemaVersion\": \"1\",", "  \"displayName\": \"" + app[1] + "\",", "  \"name\": \"" + app[0] + "\",",
                    "  \"version\": \"1.0.0\",", "  \"author\": \"test\",", "  \"folderAction\": false,",
                    "  \"description\": \"a test app\",", "  \"source\": \"\",", "  \"launchable\": true,",
                    "  \"fileExtensions\": [],", "  \"mimeTypes\": [],", "  \"fileTypes\": [],", "  \"permissions\": []", "}", ""));
            mkdir(u, crypto, "/" + user + "/.apps/" + app[0], "assets");
            put(u, crypto, "/" + user + "/.apps/" + app[0] + "/assets", "index.html", "<!doctype html><title>" + app[1] + "</title><p>" + app[1]);
        }
        mkdir(u, crypto, "/" + user, "Docs");
        put(u, crypto, "/" + user + "/Docs", "plan.md", "# Plan\n");
        return user;
    }

    static void mkdir(UserContext u, Crypto crypto, String parent, String name) {
        u.getByPath(parent).join().get().mkdir(name, u.network, false, Optional.empty(), crypto).join();
    }

    static void put(UserContext u, Crypto crypto, String dir, String name, String text) {
        byte[] data = text.getBytes(StandardCharsets.UTF_8);
        FileWrapper parent = u.getByPath(dir).join().get();
        parent.uploadOrReplaceFile(name, new AsyncReader.ArrayBacked(data), 0, data.length, u.network, crypto, x -> {}).join();
    }

    private static void pin(WebDriver d, String dir, String dirName, String name) {
        Page.openPath(d, dir, dirName);
        d.script("const dr = window.__drive; dr.selectedFiles = [dr.files.find(f => f.getName() === arguments[0])]; dr.addToLauncher(); return 1;", name);
        d.waitForScript("pinned " + name, "!window.__drive.showSpinner", 60_000);
        WebDriver.sleep(1000);
    }

    private static void openLauncher(WebDriver d) {
        Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
        d.waitForScript("the launcher", "!!document.querySelector('.launcher-view .launcher-bar')", 60_000);
    }

    private static void tileMenu(WebDriver d, String app, String how) {
        d.script("const t = [...document.querySelectorAll('.app-tile')].find(t => t.textContent.includes(arguments[0]));"
                + " if (arguments[1] === 'button') t.querySelector('.app-tile__menu').click();"
                + " else { const r = t.getBoundingClientRect(); t.querySelector('.app-grid-item').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 20})); }"
                + " return 1;", app, how);
    }
}
