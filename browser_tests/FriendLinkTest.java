import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** Friends through a friend link, all in the page: one user makes a link in Your friend links, which shows it as a
 *  QR code and text, the other pastes it into Social and sends a request, the first allows it and follows back, and
 *  revoking the link stops it working.
 *
 *  Usage: java -cp ../server/Peergos.jar FriendLinkTest.java [engine] [peergos url]
 */
public class FriendLinkTest {

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
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try {
            Fixtures.Account alice = Fixtures.account(url);
            Fixtures.Account bob = Fixtures.account(url);
            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-friend-link-"), headless)) {
                d.setWindowRect(1280, 900);
                d.navigate(url + "/");
                Page.login(d, alice.name(), alice.password());
                openSocial(d);
                d.script("document.querySelector('.social-link__mine').click(); return 1;");
                d.waitForScript("the friend links dialog", "!!document.querySelector('.friend-link__create')", 30_000);
                d.script("const i = document.querySelector('.friend-link__label'); i.value = 'for bob';"
                        + " i.dispatchEvent(new Event('input', {bubbles: true})); return 1;");
                clickButton(d, "Create link");
                d.waitForScript("the new link", "!!document.querySelector('.friend-link__text')", 60_000);
                String link = String.valueOf(d.script("return document.querySelector('.friend-link__text').textContent.trim();"));
                if (! link.startsWith("follow/z"))
                    throw new AssertionError("The link should be a friend link, not " + link);
                if (d.script("return document.querySelector('.friend-link__shown img.qrcode').getAttribute('src')") == null)
                    throw new AssertionError("The link should be shown as a QR code too");
                d.waitForScript("the link in the list", "[...document.querySelectorAll('.friend-link__item')].length === 1"
                        + " && document.querySelector('.friend-link__item').textContent.includes('for bob')", 30_000);
                System.out.println("  ok   a friend link made in the dialog shows as a QR code and text, and is listed with its label");
                d.script("document.querySelector('.pg-dialog__close').click(); return 1;");

                Page.logout(d);
                d.navigate(url + "/");
                Page.login(d, bob.name(), bob.password());
                openSocial(d);
                d.script("const i = document.querySelector('.social-link__field'); i.value = arguments[0];"
                        + " i.dispatchEvent(new Event('input', {bubbles: true})); return 1;", link);
                clickButton(d, "Add");
                d.waitForScript("the confirmation naming who signed the link",
                        "!!document.querySelector('#choice-header-id') && document.querySelector('#choice-header-id').textContent.includes('" + alice.name() + "')",
                        60_000);
                clickButton(d, "Confirm");
                d.waitForScript("the request sent", "document.body.innerText.includes('Follow request(s) sent')", 120_000);
                System.out.println("  ok   a pasted link is checked, names who signed it, and a request goes to it");

                Page.logout(d);
                d.navigate(url + "/");
                Page.login(d, alice.name(), alice.password());
                openSocial(d);
                d.waitForScript("Bob's request", "[...document.querySelectorAll('#follow-request-table-id .social-person')]"
                        + ".some(r => r.textContent.includes('" + bob.name() + "'))", 120_000);
                d.script("[...document.querySelectorAll('#follow-request-table-id .social-person')]"
                        + ".find(r => r.textContent.includes(arguments[0])).querySelector('button.pg-btn--primary').click(); return 1;", bob.name());
                d.waitForScript("Bob as a friend", "[...document.querySelectorAll('#friend-table-id .social-person')]"
                        + ".some(r => r.textContent.includes('" + bob.name() + "'))", 120_000);
                System.out.println("  ok   the request arrives, and allowing it and following back makes them friends");

                d.script("document.querySelector('.social-link__mine').click(); return 1;");
                d.waitForScript("the link, used once", "[...document.querySelectorAll('.friend-link__item')].length === 1"
                        + " && document.querySelector('.friend-link__item').textContent.includes('Used once')", 30_000);
                clickButton(d, "Revoke");
                d.waitForScript("no links left", "document.querySelectorAll('.friend-link__item').length === 0", 60_000);
                UserContext bobs = UserContext.signIn(bob.name(), bob.password(),
                        r -> { throw new IllegalStateException("no second factor"); }, network(url), Builder.initCrypto()).join();
                boolean stillWorks;
                try {
                    bobs.fetchFriendLink(link).join();
                    stillWorks = true;
                } catch (Exception e) {
                    stillWorks = false;
                }
                if (stillWorks)
                    throw new AssertionError("A revoked link should no longer work");
                System.out.println("  ok   the list counts the use, and a revoked link stops working");
            }
        } finally {
            if (own != null)
                own.close();
        }
        System.out.println("PASS");
    }

    private static NetworkAccess network(String url) throws Exception {
        return Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
    }

    private static void openSocial(WebDriver d) {
        Page.gotoView(d, "Social", "sendInitialFollowRequest", "__social");
        d.waitForScript("the lists loaded", "window.__social.loaded", 60_000);
    }

    private static void clickButton(WebDriver d, String text) {
        d.waitForScript(text, "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '" + text + "' && ! b.disabled)", 30_000);
        d.script("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '" + text + "' && ! b.disabled).click(); return 1;");
    }
}
