import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.LinkProperties;
import peergos.shared.user.UserContext;
import peergos.shared.util.PathUtil;

import java.net.URI;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;

/** Opening a secret link the server will not serve - used up, expired or deleted - or one with a
 *  password that is closed without one or given the wrong one.
 *
 *  The page used to say "Loading file..." for over a minute while the client retried, then show a
 *  toast that could not say which. Now it says why, straight away, in place of the loading page.
 *
 *  Usage: java -cp ../server/Peergos.jar SecretLinkUnavailableTest.java [engine] [peergos url]
 */
public class SecretLinkUnavailableTest {

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-link-unavailable-"), headless)) {
            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
            UserContext owner = UserContext.signIn(Server.USERNAME, Server.PASSWORD, mfa -> null, network, crypto).join();
            String folder = "link-limits-" + System.currentTimeMillis();
            owner.getByPath("/" + Server.USERNAME).join().get().mkdir(folder, network, false, Optional.empty(), crypto).join();
            String path = Server.USERNAME + "/" + folder;

            LinkProperties once = owner.createSecretLink(path, false, Optional.empty(), Optional.of(1), "", false).join();
            LinkProperties expired = owner.createSecretLink(path, false, Optional.of(LocalDateTime.now().minusMinutes(1)), Optional.empty(), "", false).join();
            LinkProperties deleted = owner.createSecretLink(path, false, Optional.empty(), Optional.empty(), "", false).join();
            owner.deleteSecretLink(deleted.label, PathUtil.get(path), false).join();

            String onceLink = url + "/" + once.toLinkString(owner.signer.publicKeyHash);
            open(d, onceLink);
            d.waitForScript("the folder behind the link", "document.body.innerText.includes('" + folder + "')", 60_000);
            System.out.println("  ok   a link limited to one use opens the first time");

            expect(d, onceLink, "It has already been opened as many times as its owner allowed");
            System.out.println("  ok   opened again, it says it has been used up");
            expect(d, url + "/" + expired.toLinkString(owner.signer.publicKeyHash), "It has expired");
            System.out.println("  ok   an expired link says it has expired");
            expect(d, url + "/" + deleted.toLinkString(owner.signer.publicKeyHash), "It no longer exists");
            System.out.println("  ok   a deleted link says it no longer exists");

            // closing the password question gives no password, which is the wrong one
            LinkProperties guarded = owner.createSecretLink(path, false, Optional.empty(), Optional.empty(), "hunter2", false).join();
            String guardedLink = url + "/" + guarded.toLinkString(owner.signer.publicKeyHash);
            askedForPassword(d, guardedLink);
            d.script("document.querySelector('.pg-dialog__close').click(); return 1;");
            cannotOpen(d, "closed without a password");
            System.out.println("  ok   a password link closed without one says it can't be opened");

            askedForPassword(d, guardedLink);
            enterPassword(d, "not-the-password");
            cannotOpen(d, "given the wrong password");
            System.out.println("  ok   the wrong password says it can't be opened");

            askedForPassword(d, guardedLink);
            enterPassword(d, "hunter2");
            d.waitForScript("the folder behind the password", "document.body.innerText.includes('" + folder + "')", 60_000);
            System.out.println("  ok   the right password opens it");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    private static void open(WebDriver d, String link) {
        d.navigate("about:blank");
        d.navigate(link);
    }

    private static void askedForPassword(WebDriver d, String link) {
        open(d, link);
        d.waitForScript("the password question", "!!document.querySelector('.pg-dialog #modal-header-id')", 60_000);
    }

    /** Set through the native value setter and an input event, so the vue model sees it. */
    private static void enterPassword(WebDriver d, String password) {
        d.script("const i = document.querySelector('.pg-dialog input');"
                + "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, arguments[0]);"
                + "i.dispatchEvent(new Event('input', {bubbles: true}));"
                + "document.querySelector('.pg-dialog #modal-button-id').click(); return 1;", password);
    }

    private static void cannotOpen(WebDriver d, String how) {
        d.waitForScript("the page to say the link can't be opened once " + how,
                "!!document.querySelector('.secret-link-unavailable')", 30_000);
        if (! "false".equals(String.valueOf(d.script("return document.body.innerText.includes('Loading file...')"))))
            throw new AssertionError("Once " + how + ", the loading page should give way to the reason");
    }

    /** The reason, in place of the loading page, well inside the minute the retries used to take. */
    private static void expect(WebDriver d, String link, String reason) {
        open(d, link);
        long start = System.currentTimeMillis();
        d.waitForScript("the page to say: " + reason,
                "(document.querySelector('.secret-link-unavailable') || {}).textContent"
                        + " && document.querySelector('.secret-link-unavailable').textContent.includes(\"" + reason + "\")", 20_000);
        String loading = String.valueOf(d.script("return document.body.innerText.includes('Loading file...')"));
        if (! "false".equals(loading))
            throw new AssertionError("The loading page should give way to the reason");
        System.out.println("       (said so after " + (System.currentTimeMillis() - start) / 1000 + "s)");
    }
}
