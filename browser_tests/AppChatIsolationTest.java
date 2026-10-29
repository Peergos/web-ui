import java.nio.file.*;
import java.util.*;

/** An app's chat api reaches only the chats that app created.
 *
 *  Messenger names an app's chats "chat-<app>$<owner>$<uuid>". The sandbox matched them on
 *  "chat-<app>" alone, without the separator, and the requests that name a chat - reading its
 *  history, sending into it - did not check the chat at all. So an app called "note" could list,
 *  read and post into the chats of an app called "notes". Checked from inside the app with the
 *  requests an app makes, against a control chat of its own.
 *
 *  Usage: java -cp ../server/Peergos.jar AppChatIsolationTest.java [engine] [url]
 */
public class AppChatIsolationTest {

    static final String RUN = Long.toString(System.currentTimeMillis() % 1_000_000);
    static final String APP = "note" + RUN, OTHER_APP = APP + "s";
    static final String OUTER = "#sandboxId", INNER = "#appSandboxId";
    static final String SECRET = "only for the other app " + RUN;

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

        Path local = Temp.directory("peergos-chat-isolation-");
        Path manifest = local.resolve("peergos-app.json");
        Files.writeString(manifest, String.join("\n", "{",
                "  \"displayName\": \"Note\",",
                "  \"name\": \"" + APP + "\",",
                "  \"description\": \"talks to friends\",",
                "  \"version\": \"1.0.0\",",
                "  \"author\": \"peergos\",",
                "  \"launchable\": true,",
                "  \"folderAction\": false,",
                "  \"permissions\": [\"EXCHANGE_MESSAGES_WITH_FRIENDS\"]",
                "}", ""));
        Path index = local.resolve("index.html");
        Files.writeString(index, String.join("\n",
                "<!doctype html><html><head><meta charset=\"utf-8\"><title>note</title></head><body>",
                "<p id=\"ready\">ready</p>",
                "<script>",
                "window.__r = {};",
                "window.run = function(key, method, url, body) {",
                "  fetch(url, {method: method, body: body}).then(r => r.text().then(t => window.__r[key] = {status: r.status, text: t}))",
                "  .catch(e => window.__r[key] = {status: -1, text: '' + e});",
                "};",
                "</script></body></html>", ""));
        try {
            Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD, "mkdir .apps");
        } catch (IllegalStateException alreadyThere) {
            // a test before this one in the suite signed in, which makes it
        }
        Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD,
                "cd .apps", "mkdir " + APP, "cd " + APP,
                "put " + manifest.toAbsolutePath(), "mkdir assets", "cd assets", "put " + index.toAbsolutePath());

        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-chat-isolation-dl-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            String foreign = createChat(d, OTHER_APP, SECRET);
            String mine = createChat(d, APP, "ours");
            System.out.println("chats: " + foreign + " (the other app's), " + mine + " (this app's)");

            Page.gotoView(d, "Launcher", "launchApp", "__launcher");
            d.script("window.__launcher.launchApp(arguments[0]);", APP);
            d.waitForScript("the app frame", "!!document.querySelector('" + OUTER + "')", 60_000);
            d.waitUntil("the app to load", () -> Boolean.TRUE.equals(inAppQuiet(d,
                    "return !!document.getElementById('ready') && typeof window.run === 'function'")), 120_000);

            Map<String, Object> list = call(d, "GET", "/peergos-api/v1/chat/", null);
            String listed = String.valueOf(list.get("text"));
            if (! listed.contains(mine))
                throw new AssertionError("The app's own chat is not in its list, so the rest proves nothing: " + list);
            if (listed.contains(foreign))
                throw new AssertionError("App " + APP + " lists " + OTHER_APP + "'s chat: " + listed);
            System.out.println("  ok   the list has this app's chat and not the other's");

            Map<String, Object> history = call(d, "GET", "/peergos-api/v1/chat/" + foreign + "?startIndex=0", null);
            if (String.valueOf(history.get("text")).contains(SECRET))
                throw new AssertionError("App " + APP + " read " + OTHER_APP + "'s messages: " + history);
            Map<String, Object> ownHistory = call(d, "GET", "/peergos-api/v1/chat/" + mine + "?startIndex=0", null);
            if (! String.valueOf(ownHistory.get("text")).contains("ours"))
                throw new AssertionError("The app could not read its own chat: " + ownHistory);
            System.out.println("  ok   it reads its own chat's history and not the other's ("
                    + history.get("status") + ")");

            String sent = "posted by " + APP + " " + RUN;
            call(d, "PUT", "/peergos-api/v1/chat/" + mine,
                    "{\"createMessage\": {\"text\": \"" + sent + "\", \"attachments\": []}}");
            call(d, "PUT", "/peergos-api/v1/chat/" + foreign,
                    "{\"createMessage\": {\"text\": \"" + sent + "\", \"attachments\": []}}");
            call(d, "PUT", "/peergos-api/v0/chat/" + foreign, "{\"text\": \"" + sent + "\"}");
            WebDriver.sleep(3000);
            // the read of its own chat is what shows the read below can see a posted message
            if (! messages(d, mine).contains(sent))
                throw new AssertionError("The app's post into its own chat is not there: " + messages(d, mine));
            if (messages(d, foreign).contains(sent))
                throw new AssertionError("App " + APP + " posted into " + OTHER_APP + "'s chat");
            System.out.println("  ok   it posts into its own chat and not into the other app's");

            call(d, "DELETE", "/peergos-api/v1/chat/" + foreign, null);
            call(d, "DELETE", "/peergos-api/v0/chat/" + foreign, null);
            WebDriver.sleep(2000);
            if (! messages(d, foreign).contains(SECRET))
                throw new AssertionError("App " + APP + " deleted " + OTHER_APP + "'s chat: " + messages(d, foreign));
            System.out.println("  ok   it cannot delete the other app's chat");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** A chat as the named app would have made it, with one message in it. */
    static String createChat(WebDriver d, String app, String text) {
        d.script("window.__chat = null; window.__chatErr = null;"
                + "const ctx = window.__ctx = window.__ctx || window.__drive.context;"
                + "const m = new peergos.shared.messaging.Messenger(ctx);"
                + "m.createAppChat(arguments[0]).thenApply(c =>"
                + "  m.sendMessage(c, peergos.shared.messaging.messages.ApplicationMessage.text(arguments[1]))"
                + "   .thenApply(x => { window.__chat = String(c.chatUuid); }))"
                + ".exceptionally(t => { window.__chatErr = '' + t; });", app, text);
        d.waitForScript("a chat for " + app, "window.__chat || window.__chatErr", 120_000);
        Object err = d.script("return window.__chatErr");
        if (err != null)
            throw new IllegalStateException("Could not create a chat for " + app + ": " + err);
        return String.valueOf(d.script("return window.__chat"));
    }

    /** The text of every message in a chat, read by the account itself rather than an app. */
    static String messages(WebDriver d, String chatId) {
        d.script("window.__msgs = null;"
                + "const m = new peergos.shared.messaging.Messenger(window.__ctx);"
                + "m.getChat(arguments[0]).thenApply(c => c.getMessages(0, 100).thenApply(all => {"
                + "  window.__msgs = all.toArray([]).map(e => {"
                + "    try { return e.payload.body.toArray()[0].inlineText(); } catch (x) { return ''; } }).join('\\n'); }))"
                + ".exceptionally(t => { window.__msgs = 'error: ' + t; });", chatId);
        d.waitForScript("the chat's messages", "window.__msgs !== null", 60_000);
        return String.valueOf(d.script("return window.__msgs"));
    }

    static Map<String, Object> call(WebDriver d, String method, String path, String body) {
        String key = "k" + System.nanoTime();
        inApp(d, "window.run(arguments[0], arguments[1], arguments[2], arguments[3]); return 1;", key, method, path, body);
        @SuppressWarnings("unchecked")
        Map<String, Object> res = d.waitUntil("the app's " + method + " " + path, () ->
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
