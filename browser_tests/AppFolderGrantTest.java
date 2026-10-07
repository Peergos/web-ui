import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;

/** An app asks for a folder, the user approves it in the picker, and the app keeps using it.
 *
 *  The app holds no manifest permission at all: the picker is the consent. It addresses the
 *  folder only through the grant id the picker hands back, and the test checks every verb on
 *  that url against the bytes the drive then holds. The grant has to outlive the sandbox, follow
 *  the folder through a rename, ask once to be renewed after an unshare rotates the folder's
 *  keys, and stop working when it is revoked from the app details.
 *
 *  Usage: java -cp ../server/Peergos.jar AppFolderGrantTest.java [engine] [url]
 *  GRANT_USER and GRANT_PASSWORD reuse an existing account, for a server that is full.
 */
public class AppFolderGrantTest {

    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String APP = "folderwriter" + RUN;
    static final String NOTES = "notes" + RUN, PHOTOS = "photos" + RUN, JOURNAL = "journal" + RUN;
    static final String INNER = "#appSandboxId";
    static final String OUTER = "#sandboxId";
    static final int BIG = 3 * 1024 * 1024 + 11;
    static final int PIC_W = 30, PIC_H = 17;

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

        String existingUser = System.getenv("GRANT_USER");
        String user = existingUser != null ? existingUser : "grant" + RUN;
        String password = existingUser != null ? System.getenv("GRANT_PASSWORD") : "grantstestpassword";
        if (existingUser == null)
            Fixtures.signUp(url, user, password);
        installApp(jar, url, user, password, existingUser == null);
        Path local = Temp.directory("peergos-grant-");
        Path existing = local.resolve("existing.txt");
        Files.writeString(existing, "already here");
        Path big = local.resolve("big.bin");
        byte[] pattern = new byte[BIG];
        for (int i = 0; i < BIG; i++)
            pattern[i] = (byte) (i % 251);
        Files.write(big, pattern);
        Path pic = local.resolve("pic.png");
        ImageIO.write(new BufferedImage(PIC_W, PIC_H, BufferedImage.TYPE_INT_RGB), "png", pic.toFile());
        Fixtures.commands(jar, url, user, password,
                "mkdir " + NOTES, "mkdir " + PHOTOS, "cd " + NOTES,
                "put " + existing.toAbsolutePath(), "put " + big.toAbsolutePath(), "put " + pic.toAbsolutePath());
        System.out.println("signed up " + user + " and installed " + APP);

        Path downloads = Temp.directory("peergos-grant-dl-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url);
            Page.login(d, user, password);
            launch(d);

            check(call(d, "GET", "/peergos-api/v0/grants/", null, null).text.equals("[]"), "no grants to begin with");

            // a write grant, remembered
            start(d, "ask", "GET", "/peergos-api/v0/folders/?write=true&persist=true&multiple=false", null, null);
            List<Boolean> switches = awaitPicker(d);
            check(switches.equals(List.of(true, true)), "picker starts as the app asked: " + switches);
            shot(d, "consent");
            pick(d, "/" + user + "/" + NOTES);
            Response asked = await(d, "ask");
            check(asked.status == 200, "grant request answered " + asked);
            Map<String, Object> grant = only(asked.text);
            String id = (String) grant.get("grantId");
            check(Boolean.TRUE.equals(grant.get("write")) && Boolean.TRUE.equals(grant.get("persist"))
                    && ("/" + user + "/" + NOTES).equals(grant.get("path")), "grant reports what was approved: " + asked.text);
            String base = "/peergos-api/v0/folder/" + id + "/";
            System.out.println("granted " + id);

            Response listing = call(d, "GET", base, null, null);
            check(listing.text.contains("existing.txt") && listing.text.contains("big.bin"), "listing " + listing);
            check(call(d, "GET", base + "existing.txt", null, null).text.equals("already here"), "read existing file");
            check(call(d, "HEAD", base + "big.bin", null, null).status == 200, "head");

            Response put = call(d, "PUT", base + "sub/todo.md", "hello", null);
            check(put.status == 201 && (base + "sub/todo.md").equals(put.location), "put a new file " + put);
            check(call(d, "PUT", base + "sub/todo.md", "hello", null).status == 200, "overwrite");
            check(call(d, "PATCH", base + "sub/todo.md", " world", Map.of("X-Update-Range", "append")).status == 204, "append");
            check(call(d, "GET", base + "sub/todo.md", null, null).text.equals("hello world"), "read back");
            check(Fixtures.listing(jar, url, user, password, NOTES + "/sub").contains("todo.md"), "file is in the drive");
            Path fetched = downloads.resolve("todo.md");
            Fixtures.download(jar, url, user, password, NOTES + "/sub/todo.md", fetched);
            check(Files.readString(fetched).equals("hello world"), "drive holds what the app wrote");
            check(call(d, "POST", base + "made?type=directory", "", null).status == 201, "mkdir");
            check(call(d, "GET", base, null, null).text.contains("made"), "mkdir listed");
            Response created = call(d, "POST", base + "made", "generated", null);
            check(created.status == 201 && created.location.startsWith(base + "made/"), "post names the file " + created);
            check(call(d, "GET", created.location, null, null).text.equals("generated"), "read the generated name");
            check(call(d, "DELETE", base + "sub/todo.md", null, null).status == 204, "delete");
            check(call(d, "GET", base + "sub/todo.md", null, null).status == 404, "deleted");

            check(call(d, "GET", base + "%2E%2E/" + PHOTOS, null, null).status == 400, "no way out through ..");
            check(call(d, "GET", "/peergos-api/v0/folder/bnotagrant/existing.txt", null, null).status == 400, "unknown grant");
            check(call(d, "GET", "/" + user + "/" + NOTES + "/existing.txt", null, null).status != 200, "no absolute path access");

            for (int start : new int[] {0, 2_000_003}) {
                String ranged = String.valueOf(inApp(d, "return window.ranged(arguments[0], arguments[1]);", base + "big.bin", start));
                check(ranged.startsWith("ok 206"), "range request from " + start + ": " + ranged);
            }
            inApp(d, "window.showImage(arguments[0]); return 1;", base + "pic.png");
            d.waitUntil("the granted image to render", () -> {
                Object w = inAppQuiet(d, "const i = document.getElementById('pic'); return i && i.complete ? i.naturalWidth : 0;");
                return w instanceof Number && ((Number) w).intValue() == PIC_W;
            }, 60_000);
            check(headerShows(d, "/" + user + "/" + NOTES), "the app header shows the folder in use");

            // a read grant, remembered: the write switch starts off and a write is refused
            start(d, "askRead", "GET", "/peergos-api/v0/folders/?persist=true", null, null);
            switches = awaitPicker(d);
            check(switches.equals(List.of(false, true)), "read request starts read only: " + switches);
            pick(d, "/" + user + "/" + PHOTOS);
            Map<String, Object> read = only(await(d, "askRead").text);
            String readId = (String) read.get("grantId");
            check(Boolean.FALSE.equals(read.get("write")), "read grant " + read);
            check(call(d, "PUT", "/peergos-api/v0/folder/" + readId + "/x.md", "x", null).status == 403, "read grant refuses writes");

            // the plain picker is unchanged: no switches, and absolute paths back
            start(d, "legacy", "GET", "/peergos-api/v0/folders/?multiple=false", null, null);
            check(awaitPicker(d).isEmpty(), "plain picker has no grant switches");
            pick(d, "/" + user + "/" + PHOTOS);
            Response legacy = await(d, "legacy");
            check(legacy.text.equals("[\"/" + user + "/" + PHOTOS + "\"]"), "plain picker answers with paths " + legacy);

            // outlives the sandbox
            closeApp(d);
            launch(d);
            Response grants = call(d, "GET", "/peergos-api/v0/grants/", null, null);
            check(grants.text.contains(id) && grants.text.contains(readId), "grants survive a relaunch " + grants);
            check(call(d, "PUT", base + "again.md", "again", null).status == 201, "write after relaunch with no prompt");
            check(d.scriptQuiet("return !!document.querySelector('.fp-picker')") != Boolean.TRUE, "no picker on relaunch");

            // follows a rename
            d.script("const ctx = window.__launcher.context; const user = arguments[0];"
                    + "window.__renamed = false;"
                    + "ctx.getByPath('/' + user).thenCompose(home => ctx.getByPath('/' + user + '/' + arguments[1])"
                    + "    .thenCompose(f => f.get().rename(arguments[2], home.get(), peergos.client.PathUtils.toPath([user], arguments[1]), ctx)))"
                    + "  .thenApply(x => window.__renamed = true);", user, NOTES, JOURNAL);
            d.waitForScript("the rename", "window.__renamed === true", 120_000);
            grants = call(d, "GET", "/peergos-api/v0/grants/", null, null);
            check(grants.text.contains("/" + user + "/" + JOURNAL), "path hint follows the rename " + grants);
            check(call(d, "GET", base + "again.md", null, null).text.equals("again"), "read after rename");

            // an unshare rotates the folder's keys: the grant goes stale, asks once, and keeps its id
            d.script("const ctx = window.__launcher.context;"
                    + "window.__unshared = false;"
                    + "ctx.unShareReadAccessWith(peergos.client.PathUtils.toPath([arguments[0]], arguments[1]),"
                    + "    peergos.client.JsUtil.asSet([])).thenApply(x => window.__unshared = true);", user, JOURNAL);
            d.waitForScript("the unshare", "window.__unshared === true", 120_000);
            check(call(d, "GET", base + "again.md", null, null).status == 404, "stale grant is a 404");
            d.waitForScript("the re-consent prompt", "!!document.getElementById('confirm-header-id')", 60_000);
            String prompt = String.valueOf(d.script("return document.getElementById('confirm-header-id').textContent"));
            check(prompt.contains("/" + user + "/" + JOURNAL), "prompt names the folder: " + prompt);
            d.script("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Yes').click();");
            d.waitUntil("the grant to be renewed", () -> call(d, "GET", base + "again.md", null, null).text.equals("again"), 60_000);
            grants = call(d, "GET", "/peergos-api/v0/grants/", null, null);
            check(grants.text.contains(id) && ! grants.text.contains("\"stale\":true"), "renewed under the same id " + grants);

            // revoked from the app details
            closeApp(d);
            d.script("window.__launcher.displayAppDetails({name: arguments[0]});", APP);
            d.waitForScript("the folder access section",
                    "[...document.querySelectorAll('.app-details__grant')].length == 2", 60_000);
            shot(d, "app-details");
            d.script("const li = [...document.querySelectorAll('.app-details__grant')]"
                    + "  .find(l => l.textContent.includes('/' + arguments[0]));"
                    + "li.querySelector('button').click();", JOURNAL);
            d.waitForScript("the revoke", "[...document.querySelectorAll('.app-details__grant')].length == 1", 60_000);
            d.script("window.__launcher.closeAppDetails();");
            launch(d);
            grants = call(d, "GET", "/peergos-api/v0/grants/", null, null);
            check(! grants.text.contains(id) && grants.text.contains(readId), "revoked grant is gone " + grants);
            check(call(d, "PUT", base + "after.md", "x", null).status == 400, "revoked grant refuses writes");
            System.out.println("PASS app folder grants");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static void installApp(Path jar, String url, String user, String password, boolean newAccount) throws Exception {
        Path dir = Temp.directory("peergos-grantapp-");
        Path manifest = dir.resolve("peergos-app.json");
        Files.writeString(manifest, String.join("\n",
                "{",
                "  \"displayName\": \"Folder Writer\",",
                "  \"name\": \"" + APP + "\",",
                "  \"description\": \"keeps files in a folder you choose\",",
                "  \"version\": \"1.0.0\",",
                "  \"author\": \"peergos\",",
                "  \"launchable\": true,",
                "  \"folderAction\": false,",
                "  \"permissions\": []",
                "}", ""));
        Path index = dir.resolve("index.html");
        Files.writeString(index, String.join("\n",
                "<!doctype html><html><head><meta charset=\"utf-8\"><title>folder writer</title></head><body>",
                "<p id=\"ready\">ready</p><div id=\"out\"></div>",
                "<script>",
                "window.__r = {};",
                "window.run = function(key, method, url, body, headers) {",
                "  delete window.__r[key];",
                "  fetch(url, {method: method, body: body, headers: headers || {}}).then(r =>",
                "    (method == 'HEAD' ? Promise.resolve('') : r.text()).then(t =>",
                "      window.__r[key] = {status: r.status, text: t, location: r.headers.get('location')}))",
                "  .catch(e => window.__r[key] = {status: -1, text: '' + e});",
                "};",
                "window.ranged = async function(url, start) {",
                "  let r = await fetch(url, {headers: {range: 'bytes=' + start + '-' + (start + 99999)}});",
                "  let b = new Uint8Array(await r.arrayBuffer());",
                "  if (b.length == 0) return 'empty ' + r.status;",
                "  for (let i = 0; i < b.length; i++) if (b[i] != (start + i) % 251) return 'mismatch at ' + i;",
                "  return 'ok ' + r.status + ' ' + b.length;",
                "};",
                "window.showImage = function(src) {",
                "  let img = document.createElement('img'); img.id = 'pic'; img.src = src;",
                "  document.getElementById('out').appendChild(img);",
                "};",
                "</script></body></html>", ""));
        if (newAccount)
            Fixtures.commands(jar, url, user, password, "mkdir .apps");
        Fixtures.commands(jar, url, user, password,
                "cd .apps", "mkdir " + APP, "cd " + APP,
                "put " + manifest.toAbsolutePath(), "mkdir assets", "cd assets", "put " + index.toAbsolutePath());
    }

    record Response(int status, String text, String location) {}

    static void launch(WebDriver d) {
        Page.gotoView(d, "Launcher", "launchApp", "__launcher");
        d.script("window.__launcher.launchApp(arguments[0]);", APP);
        d.waitForScript("the app frame", "!!document.querySelector('" + OUTER + "')", 60_000);
        d.waitUntil("the app to load", () -> Boolean.TRUE.equals(inAppQuiet(d,
                "return !!document.getElementById('ready') && typeof window.run === 'function'")), 120_000);
    }

    static void closeApp(WebDriver d) {
        d.switchToTop();
        d.script("const queue = [window.__launcher];"
                + "while (queue.length > 0) { const c = queue.shift();"
                + "  if (typeof c.closeSandbox === 'function') { c.closeSandbox(); return 1; }"
                + "  queue.push(..." + Page.VUE + ".children(c)); }"
                + "throw new Error('no sandbox to close');");
        d.waitForScript("the app to close", "!document.querySelector('" + OUTER + "')", 60_000);
    }

    static Object inApp(WebDriver d, String body, Object... args) {
        d.switchToFrame(OUTER);
        d.switchToFrame(INNER);
        try {
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

    static void start(WebDriver d, String key, String method, String url, String body, Map<String, String> headers) {
        inApp(d, "window.run(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]); return 1;",
                key, method, url, body, headers == null ? Map.of() : headers);
    }

    @SuppressWarnings("unchecked")
    static Response await(WebDriver d, String key) {
        Map<String, Object> res = d.waitUntil("the app's " + key + " request", () ->
                (Map<String, Object>) inAppQuiet(d, "return window.__r[arguments[0]] || null;", key), 120_000);
        // the driver's json decoding leaves escapes in strings
        String text = String.valueOf(res.get("text")).replace("\\\"", "\"");
        return new Response(((Number) res.get("status")).intValue(), text, (String) res.get("location"));
    }

    static Response call(WebDriver d, String method, String url, String body, Map<String, String> headers) {
        String key = "k" + System.nanoTime();
        start(d, key, method, url, body, headers);
        return await(d, key);
    }

    @SuppressWarnings("unchecked")
    static List<Boolean> awaitPicker(WebDriver d) {
        d.waitForScript("the folder picker", "!!document.querySelector('.fp-picker .fp-row__input')", 60_000);
        return (List<Boolean>) d.script("return [...document.querySelectorAll('.fp-picker__choices input')].map(i => i.checked);");
    }

    static void pick(WebDriver d, String path) {
        d.waitForScript("the " + path + " row", "!!document.querySelector('.fp-row__input[value=\"" + path + "\"]')", 60_000);
        d.script("document.querySelector('.fp-row__input[value=\"' + arguments[0] + '\"]').click();", path);
        d.script("[...document.querySelectorAll('.fp-picker button')].find(b => b.textContent.trim() === 'Select').click();");
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> only(String json) {
        List<Object> list = (List<Object>) peergos.shared.io.ipfs.api.JSONParser.parse(json);
        check(list.size() == 1, "one grant: " + json);
        return (Map<String, Object>) list.get(0);
    }

    static boolean headerShows(WebDriver d, String path) {
        return Boolean.TRUE.equals(d.script("return [...document.querySelectorAll('.modal-header h2')]"
                + ".some(h => h.textContent.includes(arguments[0]));", path));
    }

    /** SHOTS names a directory to keep a screenshot of the dialogs in (firefox only). */
    static void shot(WebDriver d, String name) {
        String dir = System.getenv("SHOTS");
        if (dir == null || ! (d instanceof MarionetteDriver))
            return;
        try {
            Files.write(Paths.get(dir, name + ".png"), ((MarionetteDriver) d).screenshot());
        } catch (Exception e) {
            System.out.println("  no screenshot of " + name + ": " + e);
        }
    }

    static void check(boolean ok, String what) {
        if (! ok)
            throw new AssertionError("FAIL: " + what);
        System.out.println("  ok: " + what);
    }
}
