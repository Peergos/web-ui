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
 *  The admin creates three from the admin panel, finds them still listed after closing it, cancels
 *  one, and each of the others has to let exactly one person sign up.
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
            String prefix = url + "/?signup=true&token=";
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);

            openPanel(d);
            if (! Boolean.TRUE.equals(d.script("return document.querySelector('.admin-panel').textContent.includes('No one is waiting for more space')")))
                throw new AssertionError("The admin here should have no space requests pending");
            d.waitForScript("the empty invite list", "document.querySelector('.admin-invites').textContent.includes('No unused invites')", 30_000);

            d.script("const up = document.querySelector('.admin-invites__step[aria-label=\"One more invite\"]'); up.click(); up.click(); return 1;");
            d.waitForScript("the count stepped to three", "document.querySelector('#admin-invite-count').value === '3'", 5_000);
            String label = (String) d.script("return document.querySelector('.admin-invites__submit').textContent.trim()");
            if (! "Create 3 invites".equals(label))
                throw new AssertionError("The button should say what it makes, but says: " + label);
            d.script("document.querySelector('.admin-invites__submit').click(); return 1;");
            d.waitForScript("three invite links", "document.querySelectorAll('.admin-invites__list input').length === 3", 60_000);
            List<String> tokens = new ArrayList<>();
            for (String link : shownLinks(d)) {
                if (! link.startsWith(prefix) || ! link.substring(prefix.length()).matches("[0-9a-f]{64}"))
                    throw new AssertionError("An invite should be this server's signup page with a token: " + link);
                tokens.add(link.substring(prefix.length()));
            }
            if (new HashSet<>(tokens).size() != 3)
                throw new AssertionError("Three invites should be three different tokens: " + tokens);
            System.out.println("  ok   the admin panel creates invite links to this server, each with its own token");

            // closing loses nothing now: a tap beside the dialog closes it, and the invites are still there
            d.script("document.querySelector('.pg-dialog__mask').click(); return 1;");
            d.waitForScript("the admin panel closed", "!document.querySelector('.admin-invites')", 10_000);
            openPanel(d);
            d.waitForScript("the invites listed again", "document.querySelectorAll('.admin-invites__list input').length === 3", 30_000);
            Set<String> relisted = new HashSet<>();
            for (String link : shownLinks(d))
                relisted.add(link.substring(prefix.length()));
            if (! relisted.equals(new HashSet<>(tokens)))
                throw new AssertionError("The unused invites should be listed when the panel opens again: " + relisted);
            System.out.println("  ok   a tap beside the panel closes it, and the unused invites are listed when it opens again");

            String cancelled = tokens.get(0);
            d.script("const row = [...document.querySelectorAll('.admin-invites__list li')].find(li => li.querySelector('input').value.endsWith(arguments[0]));"
                    + " row.querySelector('.admin-invites__cancel').click(); return 1;", cancelled);
            d.waitForScript("the cancelled invite gone", "document.querySelectorAll('.admin-invites__list input').length === 2", 30_000);
            for (String link : shownLinks(d))
                if (link.endsWith(cancelled))
                    throw new AssertionError("A cancelled invite should leave the list");
            System.out.println("  ok   cancelling an invite takes it off the list");

            // someone signs up with an invite while the panel is open: cancelling it then says so,
            // rather than that it was cancelled
            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
            UserContext.signUp("inviteea", "testpassword1", tokens.get(1), network, crypto).join();
            d.script("const row = [...document.querySelectorAll('.admin-invites__list li')].find(li => li.querySelector('input').value.endsWith(arguments[0]));"
                    + " row.querySelector('.admin-invites__cancel').click(); return 1;", tokens.get(1));
            d.waitForScript("the used invite gone", "document.querySelectorAll('.admin-invites__list input').length === 1", 30_000);
            d.waitForScript("the used invite reported", "[...document.querySelectorAll('.Vue-Toastification__toast-body')].some(t => t.textContent.includes('had already been used'))", 10_000);
            System.out.println("  ok   cancelling an invite someone has just used says it was used");

            d.script("document.querySelector('.admin-panel .pg-dialog__close').click(); return 1;");
            d.waitForScript("the admin panel closed", "!document.querySelector('.admin-invites')", 10_000);

            // the link is what the invitee gets: it opens signup with the token in hand
            Page.logout(d);
            d.navigate(prefix + tokens.get(2));
            d.waitForScript("signup with the token", "(() => { let r = null; for (const e of document.querySelectorAll('*')) if (e.__vue__) { r = e.__vue__.$root; break; }"
                    + " const st = [r]; while (st.length) { const c = st.pop(); if (! c) continue;"
                    + "   if (c.$options && c.$options.props && 'token' in c.$options.props && c.token === '" + tokens.get(2) + "') return true;"
                    + "   if (c.$children) st.push(...c.$children); } return false; })()", 60_000);
            System.out.println("  ok   opening an invite link brings up signup with its token");

            refused(() -> UserContext.signUp("inviteeb", "testpassword2", "", network, crypto).join(), "not currently accepting new sign ups");
            refused(() -> UserContext.signUp("inviteeb", "testpassword2", cancelled, network, crypto).join(), "Invalid signup token");
            refused(() -> UserContext.signUp("inviteeb", "testpassword2", tokens.get(1), network, crypto).join(), "Invalid signup token");
            UserContext.signUp("inviteeb", "testpassword2", tokens.get(2), network, crypto).join();
            System.out.println("  ok   the full server lets each invite in once, a cancelled one not at all, and no one without one");

            // used invites leave the list
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            openPanel(d);
            d.waitForScript("the empty invite list", "document.querySelector('.admin-invites').textContent.includes('No unused invites')", 30_000);
            System.out.println("  ok   used invites leave the list");

            // the panel speaks the chosen language. It looks the language up as it opens, so it
            // needs no new sign in, which the page helpers could not do in Greek anyway
            d.script("document.querySelector('.admin-panel .pg-dialog__close').click(); return 1;");
            d.waitForScript("the admin panel closed", "!document.querySelector('.admin-invites')", 10_000);
            d.script("localStorage.setItem('Language', 'el'); return 1;");
            openPanel(d);
            d.waitForScript("the empty invite list in Greek", "document.querySelector('.admin-invites').textContent.includes('Δεν υπάρχουν αχρησιμοποίητες προσκλήσεις.')", 30_000);
            String greek = (String) d.script("return document.querySelector('.admin-panel .pg-dialog__title').textContent.trim() + ' | ' + document.querySelector('.admin-invites__submit').textContent.trim()");
            if (! "Πίνακας διαχείρισης | Δημιουργία 1 πρόσκλησης".equals(greek))
                throw new AssertionError("The panel should be in Greek, but reads: " + greek);
            System.out.println("  ok   the panel is translated");
            System.out.println("PASS");
        }
    }

    /** Through the menu, as an admin gets there: with no space requests pending, which on its own
     *  says nothing about who is an admin. */
    private static void openPanel(WebDriver d) {
        d.script("document.querySelector('.user-settings .drive-user').click(); return 1;");
        String adminItem = "[...document.querySelectorAll('.user-settings li')].find(li => li.textContent.trim() === 'Admin Panel')";
        d.waitForScript("the admin menu item", adminItem, 60_000);
        d.script(adminItem + ".click(); return 1;");
        d.waitForScript("the admin panel", "!!document.querySelector('.admin-invites')", 60_000);
    }

    @SuppressWarnings("unchecked")
    private static List<String> shownLinks(WebDriver d) {
        return (List<String>) d.script("return [...document.querySelectorAll('.admin-invites__list input')].map(i => i.value)");
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
