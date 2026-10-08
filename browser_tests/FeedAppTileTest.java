import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.social.FollowRequestWithCipherText;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;
import peergos.shared.util.PathUtil;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Files a friend shared, shown in the feed by a custom app the reader installed whose manifest
 *  has a tile. Each tile runs in its own sandbox of the app and reads its own shared file from
 *  the one path it is given - two at once, on one origin and one service worker. Every other
 *  request - app data the app itself holds a permission for, the profile, chat, a write, or the
 *  app's own page loaded without being one of its sandboxes - is refused. The app's own static
 *  files still load.
 *
 *  Usage: java -cp ../server/Peergos.jar FeedAppTileTest.java [engine] [peergos url]
 */
public class FeedAppTileTest {

    static final String PASSWORD = "testpassword";
    static final String OUTER = ".feed-tile__frame";
    static final String INNER = "#appSandboxId";

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
        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-feedapptile-"), headless)) {
            String s = Long.toString(System.currentTimeMillis() % 100000);
            String me = "ines" + s, friend = "kofi" + s, app = "tilenotes" + s;
            String note = "Note body " + s, other = "Second note " + s;
            seed(url, me, friend, Map.of("today.tilenote", note, "tomorrow.tilenote", other));
            installApp(serverDir.resolve("Peergos.jar"), url, me, app);
            d.setWindowRect(1280, 900);

            NewsFeedViewTest.signIn(d, url, me);
            NewsFeedViewTest.openFeed(d);
            d.waitUntil("two tiles in the feed", () -> {
                if (Boolean.TRUE.equals(d.scriptQuiet("return document.querySelectorAll('" + OUTER + "').length == 2")))
                    return true;
                d.script("const b = document.querySelector('[aria-label=Refresh]'); if (b && !b.disabled) b.click(); return 1;");
                WebDriver.sleep(3000);
                return null;
            }, 120_000);

            List<String> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                int index = i;
                results.add(d.waitUntil("tile " + i + " to read its file and probe the host", () -> {
                    Object r = inTile(d, index, "let el = document.getElementById('result'); return el ? el.textContent : null;");
                    return r == null || String.valueOf(r).isEmpty() ? null : String.valueOf(r);
                }, 60_000));
                System.out.println("  tile " + i + " says: " + results.get(i));
            }
            String all = String.join(" | ", results);
            if (! (all.contains("file=" + note + " ") && all.contains("file=" + other + " ")))
                throw new AssertionError("The two tiles did not each read their own file: " + all);
            long live = ((Number) d.script("return [...document.querySelectorAll('" + OUTER + "')].filter(f => f.offsetParent != null).length")).longValue();
            if (live != 2)
                throw new AssertionError("Both tiles should be shown at once, " + live + " are");
            System.out.println("  ok   two tiles of one app are live at once, each reading its own file");
            String result = results.get(0);
            if (! result.contains("css=200"))
                throw new AssertionError("The tile could not load its own static file: " + result);
            System.out.println("  ok   the tile loads the app's own files");
            for (String probe : List.of("data", "profile", "chat", "post", "save"))
                if (! result.contains(probe + "=403"))
                    throw new AssertionError("The tile was not refused " + probe + ": " + result);
            System.out.println("  ok   app data, profile, chat, a write and save are all refused with 403");
            if (! result.contains("own=reached"))
                throw new AssertionError("A tile could not load a page of its own app in its own sandbox: " + result);
            if (! result.contains("escape=refused"))
                throw new AssertionError("The tile loaded the app's page outside a sandbox: " + result);
            System.out.println("  ok   the app's own page loaded from a tile without an instance is refused");

            d.waitForScript("the tile shown in place of its placeholder",
                    "!document.querySelector('.feed-tile__placeholder')", 30_000);
            long height = ((Number) d.script("return document.querySelector('.feed-tile').getBoundingClientRect().height")).longValue();
            if (height > 480)
                throw new AssertionError("The tile grew past the feed's limit: " + height + "px");
            String src = String.valueOf(d.script("return document.querySelector('" + OUTER + "').src"));
            if (! src.endsWith("/sandbox.html") || src.contains("//calendar."))
                throw new AssertionError("The tile is not in the app's sandbox: " + src);
            System.out.println("  ok   the tile runs in the app's sandbox, held to " + height + "px");

            inTile(d, 0, "document.body.click(); return 1;");
            d.waitForScript("the full app", "!!document.querySelector('#sandboxId')", 60_000);
            System.out.println("  ok   clicking the tile opens the full app");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static Object inTile(WebDriver d, int index, String body) {
        d.script("document.querySelectorAll('" + OUTER + "').forEach((f, i) => f.setAttribute('data-tile-index', i)); return 1;");
        d.switchToFrame(OUTER + "[data-tile-index='" + index + "']");
        try {
            d.switchToFrame(INNER);
            return d.scriptQuiet(body);
        } catch (RuntimeException e) {
            return null;
        } finally {
            d.switchToTop();
        }
    }

    /** Two friends, and notes one of them shares with the other. */
    static void seed(String url, String me, String friend, Map<String, String> notes) throws Exception {
        Crypto crypto = Builder.initCrypto();
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        for (String name : List.of(me, friend))
            UserContext.signUp(name, PASSWORD, "", network.clear(), crypto).join();
        UserContext a = NewsFeedViewTest.signInApi(url, me, crypto), b = NewsFeedViewTest.signInApi(url, friend, crypto);
        a.sendInitialFollowRequest(friend).join();
        for (FollowRequestWithCipherText req : b.processFollowRequests().join())
            b.sendReplyFollowRequest(req, true, true).join();
        a.processFollowRequests().join();
        for (Map.Entry<String, String> note : notes.entrySet()) {
            byte[] data = note.getValue().getBytes(StandardCharsets.UTF_8);
            FileWrapper root = b.getUserRoot().join();
            root.uploadOrReplaceFile(note.getKey(), new AsyncReader.ArrayBacked(data), 0, data.length, b.network, crypto, x -> {}).join();
            b.shareReadAccessWith(PathUtil.get(friend, note.getKey()), Set.of(me)).join();
        }
    }

    /** An app for .tilenote files with a tile, and the app data permission its tile must not get. */
    static void installApp(Path jar, String url, String user, String app) throws Exception {
        Path dir = Temp.directory("peergos-tileapp-");
        Path manifest = dir.resolve("peergos-app.json");
        Files.writeString(manifest, String.join("\n",
                "{",
                "  \"displayName\": \"Tile Notes\",",
                "  \"name\": \"" + app + "\",",
                "  \"description\": \"notes with a feed tile\",",
                "  \"version\": \"1.0.0\",",
                "  \"author\": \"peergos\",",
                "  \"launchable\": true,",
                "  \"folderAction\": false,",
                "  \"fileExtensions\": [\"tilenote\"],",
                "  \"permissions\": [\"STORE_APP_DATA\"],",
                "  \"tile\": {\"page\": \"tile.html\", \"height\": 120}",
                "}", ""));
        Path index = dir.resolve("index.html");
        Files.writeString(index, "<!doctype html><html><body><p id=\"ready\">full app</p></body></html>\n");
        Path css = dir.resolve("tile.css");
        Files.writeString(css, "body { font-family: sans-serif; margin: 0; padding: 8px; }\n");
        Path secret = dir.resolve("secret.txt");
        Files.writeString(secret, "the app's own data\n");
        Path tile = dir.resolve("tile.html");
        Files.writeString(tile, String.join("\n",
                "<!doctype html><html><head><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"tile.css\"></head><body>",
                "<div id=\"note\">loading</div><div id=\"result\"></div>",
                "<script>",
                "const status = (u, o) => fetch(u, o).then(r => r.status).catch(e => 'error');",
                "const load = src => new Promise(done => {",
                "  setTimeout(() => done('refused'), 8000);",
                "  const f = document.createElement('iframe'); f.src = src;",
                "  f.onload = () => { let t = ''; try { t = f.contentDocument.body.textContent; } catch (e) {}",
                "    done(t.includes('full app') ? 'reached' : 'refused'); };",
                "  document.body.appendChild(f); });",
                "(async () => {",
                "  const text = await fetch('/peergos-api/v0/tile/file').then(r => r.text());",
                "  document.getElementById('note').textContent = text;",
                "  const probes = {",
                "    css: await status('tile.css'),",
                "    data: await status('/peergos-api/v0/data/secret.txt'),",
                "    profile: await status('/peergos-api/v0/profile/" + user + "'),",
                "    chat: await status('/peergos-api/v0/chat/'),",
                "    post: await status('/peergos-api/v0/tile/file', {method: 'PUT', body: 'overwritten'}),",
                "    save: await status('/peergos-api/v0/save/x.tilenote', {method: 'POST', body: 'x'}),",
                "    own: await load('index.html?pgi=' + new URLSearchParams(location.search).get('pgi')),",
                "    escape: await load('index.html'),",
                "  };",
                "  document.getElementById('result').textContent = 'file=' + text + ' '",
                "    + Object.keys(probes).map(k => k + '=' + probes[k]).join(' ');",
                "  parent.postMessage({type: 'resize', height: 100000}, location.origin);",
                "  parent.postMessage({type: 'ready'}, location.origin);",
                "})();",
                "document.body.addEventListener('click', () => parent.postMessage({type: 'open'}, location.origin));",
                "</script></body></html>", ""));
        Fixtures.commands(jar, url, user, PASSWORD, "mkdir .apps");
        Fixtures.commands(jar, url, user, PASSWORD,
                "cd .apps", "mkdir " + app, "cd " + app,
                "put " + manifest.toAbsolutePath(), "mkdir data", "cd data", "put " + secret.toAbsolutePath());
        Fixtures.commands(jar, url, user, PASSWORD,
                "cd .apps", "cd " + app, "mkdir assets", "cd assets",
                "put " + index.toAbsolutePath(), "put " + tile.toAbsolutePath(), "put " + css.toAbsolutePath());
    }
}
