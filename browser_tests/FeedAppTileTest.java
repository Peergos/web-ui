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

/** A file a friend shared, shown in the feed by a custom app the reader installed whose manifest
 *  has a tile. The tile runs in the app's own sandbox and reads the shared file from the one path
 *  it is given; every other request - app data the app itself holds a permission for, the
 *  profile, chat, a write - is refused. The app's own static files still load.
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
            String note = "Note body " + s;
            seed(url, me, friend, note);
            installApp(serverDir.resolve("Peergos.jar"), url, me, app);
            d.setWindowRect(1280, 900);

            NewsFeedViewTest.signIn(d, url, me);
            NewsFeedViewTest.openFeed(d);
            d.waitUntil("a tile in the feed", () -> {
                if (Boolean.TRUE.equals(d.scriptQuiet("return !!document.querySelector('" + OUTER + "')")))
                    return true;
                d.script("const b = document.querySelector('[aria-label=Refresh]'); if (b && !b.disabled) b.click(); return 1;");
                WebDriver.sleep(3000);
                return null;
            }, 120_000);

            String result = d.waitUntil("the tile to read its file and probe the host", () -> {
                Object r = inTile(d, "let el = document.getElementById('result'); return el ? el.textContent : null;");
                return r == null || String.valueOf(r).isEmpty() ? null : String.valueOf(r);
            }, 120_000);
            System.out.println("  tile says: " + result);
            if (! result.contains("file=" + note))
                throw new AssertionError("The tile did not read the shared file: " + result);
            System.out.println("  ok   the tile reads the shared file from its fixed path");
            if (! result.contains("css=200"))
                throw new AssertionError("The tile could not load its own static file: " + result);
            System.out.println("  ok   the tile loads the app's own files");
            for (String probe : List.of("data", "profile", "chat", "post", "save"))
                if (! result.contains(probe + "=403"))
                    throw new AssertionError("The tile was not refused " + probe + ": " + result);
            System.out.println("  ok   app data, profile, chat, a write and save are all refused with 403");

            d.waitForScript("the tile shown in place of its placeholder",
                    "!document.querySelector('.feed-tile__placeholder')", 30_000);
            long height = ((Number) d.script("return document.querySelector('.feed-tile').getBoundingClientRect().height")).longValue();
            if (height > 480)
                throw new AssertionError("The tile grew past the feed's limit: " + height + "px");
            String src = String.valueOf(d.script("return document.querySelector('" + OUTER + "').src"));
            if (! src.endsWith("/sandbox.html") || src.contains("//calendar."))
                throw new AssertionError("The tile is not in the app's sandbox: " + src);
            System.out.println("  ok   the tile runs in the app's sandbox, held to " + height + "px");

            inTile(d, "document.body.click(); return 1;");
            d.waitForScript("the full app", "!!document.querySelector('#sandboxId')", 60_000);
            System.out.println("  ok   clicking the tile opens the full app");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static Object inTile(WebDriver d, String body) {
        d.switchToFrame(OUTER);
        try {
            d.switchToFrame(INNER);
            return d.scriptQuiet(body);
        } catch (RuntimeException e) {
            return null;
        } finally {
            d.switchToTop();
        }
    }

    /** Two friends, and a note one of them shares with the other. */
    static void seed(String url, String me, String friend, String note) throws Exception {
        Crypto crypto = Builder.initCrypto();
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        for (String name : List.of(me, friend))
            UserContext.signUp(name, PASSWORD, "", network.clear(), crypto).join();
        UserContext a = NewsFeedViewTest.signInApi(url, me, crypto), b = NewsFeedViewTest.signInApi(url, friend, crypto);
        a.sendInitialFollowRequest(friend).join();
        for (FollowRequestWithCipherText req : b.processFollowRequests().join())
            b.sendReplyFollowRequest(req, true, true).join();
        a.processFollowRequests().join();
        byte[] data = note.getBytes(StandardCharsets.UTF_8);
        FileWrapper root = b.getUserRoot().join();
        root.uploadOrReplaceFile("today.tilenote", new AsyncReader.ArrayBacked(data), 0, data.length, b.network, crypto, x -> {}).join();
        b.shareReadAccessWith(PathUtil.get(friend, "today.tilenote"), Set.of(me)).join();
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
