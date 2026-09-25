import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** The invite panel on a paid instance, where signup tokens live in a separate quota service.
 *
 *  A quota service from before token-list and token-delete cannot list or withdraw them, so the
 *  panel says to copy each link at once and offers no cancel. One that has them gives the same
 *  list and cancel as any other server. Both are the QuotaAdminStandIn, switched between.
 *
 *  Usage: java -cp ../server/Peergos.jar AdminInvitePaidTest.java [engine]
 */
public class AdminInvitePaidTest {

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        try (QuotaAdminStandIn quotaService = QuotaAdminStandIn.start(false);
             Server server = Server.startPaid(Paths.get("..", "server").toAbsolutePath().normalize(), quotaService.port());
             WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-invite-paid-"), headless)) {
            String url = server.url();
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            d.waitForScript("paid mode", "(() => { const p = window.__drive.$store.state.paymentProperties; return p && p.isPaid(); })()", 60_000);

            openPanel(d);
            d.waitForScript("the copy-now note", "document.querySelector('.admin-invites').textContent.includes(\"This server can't list unused invites\")", 30_000);
            if (Boolean.TRUE.equals(d.script("return document.querySelector('.admin-invites').textContent.includes('It stays here')")))
                throw new AssertionError("Without a list, the panel should not say invites stay here");
            d.script("document.querySelector('.admin-invites__step[aria-label=\"One more invite\"]').click(); return 1;");
            d.script("document.querySelector('.admin-invites__submit').click(); return 1;");
            d.waitForScript("two invite links", "document.querySelectorAll('.admin-invites__list input').length === 2", 60_000);
            if (((Number) d.script("return document.querySelectorAll('.admin-invites__cancel').length")).intValue() != 0)
                throw new AssertionError("Without a list there is no withdrawing either, so no cancel should be offered");
            List<String> tokens = tokens(d);
            if (! quotaService.tokens.containsAll(tokens))
                throw new AssertionError("The invites should be tokens in the quota service: " + tokens + " vs " + quotaService.tokens);
            System.out.println("  ok   a paid instance makes invites in its quota service, and says to copy them now when it cannot list them");

            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
            UserContext.signUp("paidinvitee", "testpassword1", tokens.get(0), network, crypto).join();
            if (quotaService.tokens.contains(tokens.get(0)))
                throw new AssertionError("Signing up with an invite should use its token up");
            System.out.println("  ok   an invite signs someone up on a paid instance, and is used up doing it");

            // the quota service gains token-list and token-delete
            quotaService.listing = true;
            d.script("document.querySelector('.admin-panel .pg-dialog__close').click(); return 1;");
            d.waitForScript("the panel closed", "!document.querySelector('.admin-invites')", 10_000);
            openPanel(d);
            d.waitForScript("the unused invite listed", "document.querySelectorAll('.admin-invites__list input').length === 1", 30_000);
            if (! tokens(d).equals(List.of(tokens.get(1))))
                throw new AssertionError("Only the unused invite should be listed: " + tokens(d));
            if (! Boolean.TRUE.equals(d.script("return document.querySelector('.admin-invites').textContent.includes('It stays here')")))
                throw new AssertionError("With a list, the panel should say invites stay here");
            d.script("document.querySelector('.admin-invites__cancel').click(); return 1;");
            d.waitForScript("the invite cancelled", "document.querySelectorAll('.admin-invites__list input').length === 0", 30_000);
            if (quotaService.tokens.contains(tokens.get(1)))
                throw new AssertionError("Cancelling should withdraw the token from the quota service");
            System.out.println("  ok   once the quota service can list and withdraw tokens, the panel lists and cancels them too");
            System.out.println("PASS");
        }
    }

    private static void openPanel(WebDriver d) {
        d.script("document.querySelector('.user-settings .drive-user').click(); return 1;");
        String adminItem = "[...document.querySelectorAll('.user-settings li')].find(li => li.textContent.trim() === 'Admin Panel')";
        d.waitForScript("the admin menu item", adminItem, 60_000);
        d.script(adminItem + ".click(); return 1;");
        d.waitForScript("the admin panel", "!!document.querySelector('.admin-invites')", 60_000);
    }

    @SuppressWarnings("unchecked")
    private static List<String> tokens(WebDriver d) {
        List<String> links = (List<String>) d.script("return [...document.querySelectorAll('.admin-invites__list input')].map(i => i.value)");
        List<String> out = new ArrayList<>();
        for (String l : links)
            out.add(l.substring(l.indexOf("token=") + "token=".length()));
        return out;
    }
}
