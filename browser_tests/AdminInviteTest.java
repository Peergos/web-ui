import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;

import java.net.URI;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.CompletionException;

/** An admin inviting new users from the web ui rather than a shell on the server.
 *
 *  The server here is full - its one place is the admin's - so the only way in is a signup token.
 *  The admin creates two from the admin panel, and each has to let exactly one person sign up.
 *
 *  Usage: java -cp ../server/Peergos.jar AdminInviteTest.java [engine]
 */
public class AdminInviteTest {

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        // its own server whatever the suite passes: the shared one takes signups without a token
        try (Server server = Server.start(Paths.get("..", "server").toAbsolutePath().normalize(), 1);
             WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-invite-"), headless)) {
            String url = server.url();
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);

            // through the menu, as an admin gets there: with no space requests pending, which on its
            // own says nothing about who is an admin
            d.script("document.querySelector('.user-settings .drive-user').click(); return 1;");
            String adminItem = "[...document.querySelectorAll('.user-settings li')].find(li => li.textContent.trim() === 'Admin Panel')";
            d.waitForScript("the admin menu item", adminItem, 60_000);
            d.script(adminItem + ".click(); return 1;");
            d.waitForScript("the admin panel", "!!document.querySelector('.admin-invites')", 60_000);
            if (! Boolean.TRUE.equals(d.script("return document.querySelector('.admin-panel').textContent.includes('No one is waiting for more space')")))
                throw new AssertionError("The admin here should have no space requests pending");
            d.script("const i = document.querySelector('#admin-invite-count'); i.value = '2';"
                    + " i.dispatchEvent(new Event('input', {bubbles: true}));"
                    + " [...document.querySelectorAll('.admin-invites button')].find(b => b.textContent.trim() === 'Create invites').click(); return 1;");
            d.waitForScript("two invite links", "document.querySelectorAll('.admin-invites__list input').length === 2", 60_000);
            @SuppressWarnings("unchecked")
            List<String> links = (List<String>) d.script("return [...document.querySelectorAll('.admin-invites__list input')].map(i => i.value)");
            List<String> tokens = new ArrayList<>();
            for (String link : links) {
                String prefix = url + "/?signup=true&token=";
                if (! link.startsWith(prefix) || ! link.substring(prefix.length()).matches("[0-9a-f]{64}"))
                    throw new AssertionError("An invite should be this server's signup page with a token: " + link);
                tokens.add(link.substring(prefix.length()));
            }
            if (tokens.get(0).equals(tokens.get(1)))
                throw new AssertionError("Two invites should be two different tokens");
            System.out.println("  ok   the admin panel creates invite links to this server, each with its own token");

            // the tokens exist from here on, and the links are shown only once
            d.script("document.querySelector('.pg-dialog__mask').click(); return 1;");
            WebDriver.sleep(500);
            if (d.find(".admin-invites") == null)
                throw new AssertionError("A tap beside the dialog should not close it while there are invites to copy");
            d.script("document.querySelector('.admin-panel .pg-dialog__close').click(); return 1;");
            d.waitForScript("the admin panel closed", "!document.querySelector('.admin-invites')", 10_000);
            System.out.println("  ok   the panel stays up for a stray tap while invites show, and closes when asked");

            // the link is what the invitee gets: it opens signup with the token in hand
            Page.logout(d);
            d.navigate(links.get(1));
            d.waitForScript("signup with the token", "(() => { let r = null; for (const e of document.querySelectorAll('*')) if (e.__vue__) { r = e.__vue__.$root; break; }"
                    + " const st = [r]; while (st.length) { const c = st.pop(); if (! c) continue;"
                    + "   if (c.$options && c.$options.props && 'token' in c.$options.props && c.token === '" + tokens.get(1) + "') return true;"
                    + "   if (c.$children) st.push(...c.$children); } return false; })()", 60_000);
            System.out.println("  ok   opening an invite link brings up signup with its token");

            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
            refused(() -> UserContext.signUp("inviteea", "testpassword1", "", network, crypto).join(), "not currently accepting new sign ups");
            UserContext.signUp("inviteea", "testpassword1", tokens.get(0), network, crypto).join();
            refused(() -> UserContext.signUp("inviteeb", "testpassword2", tokens.get(0), network, crypto).join(), "Invalid signup token");
            UserContext.signUp("inviteeb", "testpassword2", tokens.get(1), network, crypto).join();
            System.out.println("  ok   the full server lets each invite in once, and no one without one");
            System.out.println("PASS");
        }
    }

    /** Fails, and for the reason given: a refusal for some other reason would pass unnoticed otherwise. */
    private static void refused(Runnable call, String reason) {
        try {
            call.run();
        } catch (CompletionException e) {
            String message = String.valueOf(e.getCause() == null ? e.getMessage() : e.getCause().getMessage());
            if (! message.contains(reason))
                throw new AssertionError("Refused, but for another reason: " + message);
            return;
        }
        throw new AssertionError("Should have been refused: " + reason);
    }
}
