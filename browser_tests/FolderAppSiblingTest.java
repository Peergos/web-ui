import java.nio.file.*;
import java.util.*;

/** An app opened on a folder reads that folder and not a sibling whose name starts the same; an
 *  app opened on a file reads that file and nothing else in its folder.
 *
 *  An app with READ_CHOSEN_FOLDER, run from a folder's menu, may read that folder and what is in
 *  it. The sandbox decided that with a plain prefix test on the path, so an app opened on
 *  /alice/photos could also list and read /alice/photos-private; and an app opened on one file was
 *  let at the whole folder around it. Both are checked from inside the app, with the fetches an app
 *  would make, against a control read of what it was opened on.
 *
 *  Usage: java -cp ../server/Peergos.jar FolderAppSiblingTest.java [engine] [url]
 */
public class FolderAppSiblingTest {

    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String APP = "foldercheck" + RUN, FILE_APP = "filecheck" + RUN;
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
        Path beside = local.resolve("beside.txt");
        Files.writeString(beside, "beside the chosen file, never chosen");
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
        Path fileManifest = local.resolve("file-app.json");
        Files.writeString(fileManifest, String.join("\n", "{",
                "  \"displayName\": \"File check\",",
                "  \"name\": \"" + FILE_APP + "\",",
                "  \"description\": \"opens text files\",",
                "  \"version\": \"1.0.0\",",
                "  \"author\": \"peergos\",",
                "  \"launchable\": false,",
                "  \"folderAction\": false,",
                "  \"fileExtensions\": [\"txt\"],",
                "  \"permissions\": []",
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
                "mkdir " + FOLDER, "cd " + FOLDER, "put " + granted.toAbsolutePath(), "put " + beside.toAbsolutePath());
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
        // the manifest has to be named peergos-app.json, so it goes up under that name
        Path fileAppDir = local.resolve(FILE_APP);
        Files.createDirectories(fileAppDir);
        Files.copy(fileManifest, fileAppDir.resolve("peergos-app.json"));
        Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD,
                "cd .apps", "mkdir " + FILE_APP, "cd " + FILE_APP,
                "put " + fileAppDir.resolve("peergos-app.json").toAbsolutePath(), "mkdir assets", "cd assets",
                "put " + index.toAbsolutePath());

        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-folder-app-dl-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            Page.waitForInDrive(d, FOLDER, 120_000);
            // what the folder's menu does when the app is picked in it
            openFromDrive(d, FOLDER, APP);
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

            // and an app opened on one file, from the file's menu
            // closed through the sandbox itself, which takes its message listener off the window
            d.script("const queue = [window.__drive];"
                    + "while (queue.length > 0) { const c = queue.shift();"
                    + "  if (typeof c.closeSandbox === 'function') { c.closeSandbox(); return 1; }"
                    + "  queue.push(..." + Page.VUE + ".children(c)); }"
                    + "throw new Error('no sandbox to close');");
            d.waitForScript("the folder app to close", "!document.querySelector('" + OUTER + "')", 60_000);
            Page.openPath(d, home + FOLDER, FOLDER);
            Page.waitForInDrive(d, "granted.txt", 120_000);
            openFromDrive(d, "granted.txt", FILE_APP);
            d.waitUntil("the file app to load", () -> Boolean.TRUE.equals(inAppQuiet(d,
                    "return !!document.getElementById('ready') && typeof window.read === 'function'")), 120_000);
            Map<String, Object> opened = read(d, home + FOLDER + "/granted.txt");
            if (! String.valueOf(opened.get("text")).contains("inside the chosen folder"))
                throw new AssertionError("The file app could not read the file it was opened on: " + opened);
            Map<String, Object> next = read(d, home + FOLDER + "/beside.txt");
            if (String.valueOf(next.get("text")).contains("never chosen"))
                throw new AssertionError("An app opened on granted.txt read the file beside it: " + next);
            Map<String, Object> folder = read(d, home + FOLDER);
            if (String.valueOf(folder.get("text")).contains("beside.txt"))
                throw new AssertionError("An app opened on granted.txt listed its folder: " + folder);
            System.out.println("  ok   an app opened on a file reads that file and nothing beside it ("
                    + next.get("status") + ", " + folder.get("status") + ")");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Selects an entry of the listing and opens an app on it, as the entry's menu does, and
     *  waits for the app's frame. The drive's handle is taken afresh first: a listing that
     *  reloads while the test waits for it can leave window.__drive on a component that is no
     *  longer on the page, and an open on that one draws nothing. A frame that never comes says
     *  what the page holds instead. */
    static void openFromDrive(WebDriver d, String entry, String app) {
        d.waitForScript("the drive to settle",
                "window.__drive.sandboxedApps.appsLoaded && !window.__drive.showSpinner", 120_000);
        String opened = String.valueOf(d.script("const vm = " + Page.VUE + ".find('downloadFile');"
                + "if (!vm) return 'no drive on the page';"
                + "window.__drive = vm;"
                + "const entry = vm.sortedFiles.find(f => f.getFileProperties().name === arguments[0]);"
                + "if (!entry) return 'no ' + arguments[0] + ' among ' + vm.sortedFiles.map(f => f.getFileProperties().name).join(', ');"
                + "vm.selectedFiles = [entry]; vm.appOpen(arguments[1]); return 'opened';", entry, app));
        if (! opened.equals("opened"))
            throw new IllegalStateException("Could not open " + app + " on " + entry + ": " + opened);
        try {
            d.waitForScript("the app frame", "!!document.querySelector('" + OUTER + "')", 60_000);
        } catch (IllegalStateException e) {
            throw new IllegalStateException(e.getMessage() + "; the page: " + d.scriptQuiet(
                    "const vm = window.__drive; return JSON.stringify({sandbox: vm.showAppSandbox, app: vm.sandboxAppName,"
                    + " container: !!document.getElementById('sandbox-container'),"
                    + " frames: document.querySelectorAll('iframe').length,"
                    + " text: document.body.innerText.replace(/\\n/g, ' | ').substring(0, 400)})"), e);
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
