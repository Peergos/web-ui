import com.eatthepath.otp.TimeBasedOneTimePasswordGenerator;
import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.login.mfa.*;
import peergos.shared.user.UserContext;
import peergos.shared.util.Either;
import peergos.shared.util.Futures;

import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.file.*;
import java.time.*;
import java.util.*;

/** Changing the password of an account with an authenticator app: the second factor prompt has to
 *  be usable, not sat under the change password spinner (web-ui#816).
 *
 *  Usage: java -cp ../server/Peergos.jar ChangePasswordMfaTest.java [engine] [peergos url]
 */
public class ChangePasswordMfaTest {

    static final String PASSWORD = "testpassword";
    static final String NEW_PASSWORD = "a-new-test-password";

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-password-mfa-"), headless)) {
            String me = "maria" + (System.currentTimeMillis() % 100000);
            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
            UserContext.signUp(me, PASSWORD, "", network.clear(), crypto).join();

            d.setWindowRect(1280, 900);
            NewsFeedViewTest.signIn(d, url, me);

            // enabled after the browser has signed in, so only the password change meets it
            UserContext api = NewsFeedViewTest.signInApi(url, me, crypto);
            TimeBasedOneTimePasswordGenerator totp = new TimeBasedOneTimePasswordGenerator(Duration.ofSeconds(30L), 6, TotpKey.ALGORITHM);
            TotpKey key = api.network.account.addTotpFactor(me, api.signer).join();
            if (! api.network.account.enableTotpFactor(me, key.credentialId, code(totp, key), api.signer).join())
                throw new AssertionError("The authenticator app was not enabled");

            d.waitForScript("the settings menu", Page.VUE + ".find('showChangePassword')", 60_000);
            d.script(Page.VUE + ".find('showChangePassword').showChangePassword();");
            d.waitForScript("the change password form",
                    "document.querySelectorAll('.password__wrapper input').length === 3", 30_000);
            d.script(
                    "const set = (el, v) => {" +
                    "  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;" +
                    "  s.call(el, v); el.dispatchEvent(new Event('input', {bubbles: true}));" +
                    "};" +
                    "const inputs = document.querySelectorAll('.password__wrapper input');" +
                    "set(inputs[0], arguments[0]); set(inputs[1], arguments[1]); set(inputs[2], arguments[1]);" +
                    "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Change password').click();",
                    PASSWORD, NEW_PASSWORD);

            d.waitForScript("the second factor prompt", "document.querySelector('input[name=mfaCode]')", 120_000);
            // real clicks, which the browser refuses when something is drawn over them
            d.click(d.find("input[name=mfaCode]"));
            d.sendKeys(d.find("input[name=mfaCode]"), code(totp, key));
            d.click(d.find("#prompt-button-id"));
            d.waitForScript("the password change to finish",
                    "!document.querySelector('.password__wrapper') && !document.querySelector('#spinner')", 300_000);
            System.out.println("  ok   the authenticator prompt could be used to confirm the password change");

            UserContext.signIn(me, NEW_PASSWORD, req -> Futures.of(new MultiFactorAuthResponse(key.credentialId,
                    Either.a(code(totp, key)))), network.clear(), crypto).join();
            System.out.println("  ok   the new password signs in");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static String code(TimeBasedOneTimePasswordGenerator totp, TotpKey key) {
        try {
            return totp.generateOneTimePasswordString(new SecretKeySpec(key.key, TotpKey.ALGORITHM), Instant.now());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
