import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** A recovery key set from the user menu, then used on /recovery to take the account back.
 *
 *  The key is read from the file the page downloads, not from the page, so a download that
 *  leaves out the key fails here. Recovery chooses a new password and hands out a new key, so
 *  afterwards the new password logs in over the api and the old one doesn't. Last, a login as
 *  username@peerid that stays logged in comes back after a reload under that name.
 *
 *  It needs the routing log, so it always starts a server of its own.
 *
 *  Usage: java -cp ../server/Peergos.jar RecoveryTest.java [engine]
 */
public class RecoveryTest {

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
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        String user = "recover" + (System.currentTimeMillis() % 100_000);
        String password = "first-password", newPassword = "second-password";
        try (Server server = Server.startWithRoutingLog(Paths.get("..", "server").toAbsolutePath().normalize())) {
            String url = server.url();
            Fixtures.signUp(url, user, password);
            Path downloads = Temp.directory("peergos-recovery-");
            String filename = "peergos-recovery-key-" + user + ".txt";
            try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
                d.setWindowRect(1280, 860);
                d.navigate(url + "/");
                Page.login(d, user, password);

                d.waitForScript("the recovery key prompt after login", dialog("Your Recovery Key") + " != null", 120_000);
                d.script("return " + dialog("Your Recovery Key") + ".querySelector('.pg-dialog__close').click();");
                d.waitForScript("the prompt to close", dialog("Your Recovery Key") + " == null", 30_000);
                System.out.println("  ok   the prompt after login can be put off");

                openRecoveryMenu(d);
                d.waitForScript("a new recovery key", "!!document.querySelector('.recovery-key')", 60_000);
                String shown = String.valueOf(d.script("return document.querySelector('.recovery-key').textContent.trim();"));
                clickButton(d, "Download");
                String key = keyFrom(Downloads.await(downloads, filename, 30_000, 1_000).path, user);
                if (! key.equals(shown))
                    throw new AssertionError("the downloaded key " + key + " should be the one shown, " + shown);
                clickButton(d, "Continue");
                d.waitForScript("the key to be committed", "!document.querySelector('.recovery-key')", 120_000);
                Files.delete(downloads.resolve(filename));

                openRecoveryMenu(d);
                d.waitForScript("the menu to say a key is set", "/Your account has a recovery key/.test(document.body.innerText)", 60_000);
                System.out.println("  ok   a recovery key set from the menu, downloaded with the key that was shown");
                d.script("return " + dialog("Your Recovery Key") + ".querySelector('.pg-dialog__close').click();");

                Page.logout(d);
                d.navigate(url + "/recovery");
                d.waitForScript("the recovery page", "!!document.querySelector('.recover-account__key')", 120_000);
                d.script("const set = (el, v) => {"
                        + "  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;"
                        + "  s.call(el, v); el.dispatchEvent(new Event('input', {bubbles: true}));"
                        + "};"
                        + "set(document.querySelector('input[name=username]'), arguments[0]);"
                        + "set(document.querySelector('.recover-account__key'), arguments[1]);"
                        + "document.querySelectorAll('input[type=password]').forEach(p => set(p, arguments[2]));"
                        + "return 1;", user, key, newPassword);
                clickButton(d, "Continue");
                d.waitForScript("the new recovery key", "!!document.querySelector('.recovery-key')", 30_000);
                if (Boolean.TRUE.equals(d.script("return [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Recover').disabled == false;")))
                    throw new AssertionError("recovery should wait for the new key to be downloaded");
                clickButton(d, "Download");
                String nextKey = keyFrom(Downloads.await(downloads, filename, 30_000, 1_000).path, user);
                if (nextKey.equals(key))
                    throw new AssertionError("recovery should hand out a new key");
                clickButton(d, "Recover");
                d.waitForScript("recovery to log in", "/upgrade/i.test(document.body.innerText)", 600_000);
                Object path = d.script("return location.pathname;");
                if (! "/".equals(path))
                    throw new AssertionError("after recovering the page should leave /recovery, not stay on " + path);
                System.out.println("  ok   /recovery took the account back with the key, and logged in");
            }

            Crypto crypto = Builder.initCrypto();
            UserContext.signIn(user, newPassword, r -> { throw new IllegalStateException("no second factor"); }, network(url), crypto).join();
            boolean oldWorks;
            try {
                UserContext.signIn(user, password, r -> { throw new IllegalStateException("no second factor"); }, network(url), crypto).join();
                oldWorks = true;
            } catch (Exception e) {
                oldWorks = false;
            }
            if (oldWorks)
                throw new AssertionError("the old password should no longer log in");
            System.out.println("  ok   the new password logs in and the old one doesn't");

            String named = user + "@" + network(url).dhtClient.id().join();
            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-recovery-named-"), headless)) {
                d.setWindowRect(1280, 860);
                d.navigate(url + "/");
                d.waitForScript("the login form", "!!document.querySelector('input[name=stayLoggedIn]')", 120_000);
                d.script("const c = document.querySelector('input[name=stayLoggedIn]'); if (! c.checked) c.click(); return 1;");
                Page.login(d, named, newPassword);
                d.navigate(url + "/");
                d.waitForScript("the stayed in session after a reload", "/upgrade/i.test(document.body.innerText)", 300_000);
                Object loginName = d.script("return " + Page.VUE + ".root().$store.state.context.loginName;");
                if (! named.equals(loginName))
                    throw new AssertionError("the restored session should be " + named + ", not " + loginName);
                System.out.println("  ok   a login as " + named + " stays logged in under that name");
            }
        }
        System.out.println("PASS");
    }

    private static NetworkAccess network(String url) throws Exception {
        return Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
    }

    private static String dialog(String label) {
        return "document.querySelector('[role=dialog][aria-label=\"" + label + "\"]')";
    }

    private static void openRecoveryMenu(WebDriver d) {
        if (! Page.awaitComponent(d, "showRecovery", "__settings", 60_000))
            throw new IllegalStateException("No user menu offers Recovery");
        d.script("window.__settings.showRecovery(); return 1;");
    }

    private static void clickButton(WebDriver d, String text) {
        d.waitForScript(text, "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '" + text + "' && ! b.disabled)", 30_000);
        d.script("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '" + text + "' && ! b.disabled).click(); return 1;");
    }

    /** The file starts with a line naming the user, then the key on a line of its own. */
    private static String keyFrom(Path file, String user) throws Exception {
        List<String> lines = Files.readAllLines(file);
        if (! lines.get(0).endsWith(" " + user))
            throw new AssertionError("the recovery file should name " + user + ": " + lines);
        return lines.get(2).trim();
    }
}
