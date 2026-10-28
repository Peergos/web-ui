import java.nio.file.*;
import java.util.*;

/** A folder app reads the folder it was opened on, and not a sibling whose name starts the same.
 *
 *  An app with READ_CHOSEN_FOLDER, run from a folder's menu, may read that folder and what is in
 *  it. The sandbox decided that with a plain prefix test on the path, so an app opened on
 *  /alice/photos could also list and read /alice/photos-private. It is checked from inside the
 *  app, with the fetches an app would make, against a control read of its own folder.
 *
 *  Usage: java -cp ../server/Peergos.jar FolderAppSiblingTest.java [engine] [url]
 */
public class FolderAppSiblingTest {

    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String APP = "foldercheck" + RUN;
    static final String FOLDER = "shots" + RUN, SIBLING = FOLDER + "-private";
    static final String OUTER = "#sandboxId", INNER = "#appSandboxId";

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
        Path jar = serverDir.resolve("Peergos.jar");
        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;

        Path local = Temp.directory("peergos-folder-app-");
        Path granted = local.resolve("granted.txt");
        Files.writeString(granted, "inside the chosen folder");
        Path secret = local.resolve("secret.txt");
        Files.writeString(secret, "in a sibling folder, never chosen");
        Path manifest = local.resolve("peergos-app.json");
        Files.writeString(manifest, String.join("\n", "{",
                "  \"displayName\": \"Folder check\",",
                "  \"name\": \"" + APP + "\",",
                "  \"description\": \"reads the folder it is opened on\",",
                "  \"version\": \"1.0.0\",",
                "  \"author\": \"peergos\",",
                "  \"launchable\": false,",
                "  \"folderAction\": true,",
                "  \"permissions\": [\"READ_CHOSEN_FOLDER\"]",
                "}", ""));
        Path index = local.resolve("index.html");
        Files.writeString(index, String.join("\n",
                "<!doctype html><html><head><meta charset=\"utf-8\"><title>folder check</title></head><body>",
                "<p id=\"ready\">ready</p>",
                "<script>",
                "window.__r = {};",
                "window.read = function(key, url) {",
                "  fetch(url).then(r => r.text().then(t => window.__r[key] = {status: r.status, text: t}))",
                "  .catch(e => window.__r[key] = {status: -1, text: '' + e});",
                "};",
                "</script></body></html>", ""));
        Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD,
                "mkdir " + FOLDER, "cd " + FOLDER, "put " + granted.toAbsolutePath());
        Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD,
                "mkdir " + SIBLING, "cd " + SIBLING, "put " + secret.toAbsolutePath());
        try {
            Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD, "mkdir .apps");
        } catch (IllegalStateException alreadyThere) {
            // a test before this one in the suite signed in, which makes it
        }
        Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD,
                "cd .apps", "mkdir " + APP, "cd " + APP,
                "put " + manifest.toAbsolutePath(), "mkdir assets", "cd assets", "put " + index.toAbsolutePath());

        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-folder-app-dl-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            Page.waitForInDrive(d, FOLDER, 120_000);
            // what the folder's menu does when the app is picked in it
            d.script("const vm = window.__drive;"
                    + "vm.selectedFiles = [vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0])];"
                    + "vm.appOpen(arguments[1]); return 1;", FOLDER, APP);
            d.waitForScript("the app frame", "!!document.querySelector('" + OUTER + "')", 60_000);
            d.waitUntil("the app to load", () -> Boolean.TRUE.equals(inAppQuiet(d,
                    "return !!document.getElementById('ready') && typeof window.read === 'function'")), 120_000);

            String home = "/" + Server.USERNAME + "/";
            Map<String, Object> mine = read(d, home + FOLDER + "/granted.txt");
            if (((Number) mine.get("status")).intValue() != 200 || ! String.valueOf(mine.get("text")).contains("inside the chosen folder"))
                throw new AssertionError("The app could not read its own folder, so the rest proves nothing: " + mine);
            System.out.println("  ok   the app reads the folder it was opened on");

            Map<String, Object> file = read(d, home + SIBLING + "/secret.txt");
            if (String.valueOf(file.get("text")).contains("never chosen"))
                throw new AssertionError("An app opened on " + FOLDER + " read " + SIBLING + "/secret.txt: " + file);
            Map<String, Object> listing = read(d, home + SIBLING);
            if (String.valueOf(listing.get("text")).contains("secret.txt"))
                throw new AssertionError("An app opened on " + FOLDER + " listed " + SIBLING + ": " + listing);
            System.out.println("  ok   it can neither read nor list " + SIBLING + " (" + file.get("status")
                    + ", " + listing.get("status") + ")");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static Map<String, Object> read(WebDriver d, String path) {
        String key = "k" + System.nanoTime();
        inApp(d, "window.read(arguments[0], arguments[1]); return 1;", key, path);
        @SuppressWarnings("unchecked")
        Map<String, Object> res = d.waitUntil("the app's read of " + path, () ->
                (Map<String, Object>) inAppQuiet(d, "return window.__r[arguments[0]] || null;", key), 120_000);
        return res;
    }

    static Object inApp(WebDriver d, String body, Object... args) {
        try {
            d.switchToFrame(OUTER);
            d.switchToFrame(INNER);
            return d.script(body, args);
        } finally {
            d.switchToTop();
        }
    }

    static Object inAppQuiet(WebDriver d, String body, Object... args) {
        try {
            return inApp(d, body, args);
        } catch (RuntimeException e) {
            return null;
        }
    }
}
