import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.social.FollowRequestWithCipherText;
import peergos.shared.user.FriendAnnotation;
import peergos.shared.user.UserContext;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** The social view, with someone in every list: a request waiting, friends (one verified),
 *  a follower, someone followed and someone blocked. Each list shows them, and each action on
 *  the page does what it did before the view was restyled, which a reload then confirms.
 *
 *  Usage: java -cp ../server/Peergos.jar SocialViewTest.java [engine] [peergos url]
 */
public class SocialViewTest {

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-social-"), headless)) {
            People p = People.seed(url);
            d.setWindowRect(1280, 900);
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, p.stranger, People.PASSWORD);
            Page.gotoView(d, "Social", "sendInitialFollowRequest", "__social");
            d.waitForScript("the empty state", "!!document.querySelector('.social-view .pg-empty')", 60_000);
            Object sections = d.script("return [...document.querySelectorAll('.social-section h2')].map(h => h.textContent.trim())");
            if (! String.valueOf(sections).equals("[Groups]"))
                throw new AssertionError("With no one yet, only the groups should be listed, but: " + sections);
            System.out.println("  ok   an account with no one yet is told so, with the groups still there");

            d.navigate(url + "/");
            Page.login(d, p.me, People.PASSWORD);
            // loading takes a moment, and the lists are empty until it is done: that must not
            // read as an account with no one in it
            d.script("window.__sawEmpty = false; new MutationObserver(() => {"
                    + " if (document.querySelector('.social-view .pg-empty')) window.__sawEmpty = true;"
                    + " }).observe(document.body, {childList: true, subtree: true}); return 1;");
            openSocial(d);
            if (Boolean.TRUE.equals(d.script("return window.__sawEmpty")))
                throw new AssertionError("The empty state showed while the lists were loading");

            expect(d, "Incoming follow requests", 1, List.of(p.pending));
            expect(d, "Friends", 2, List.of(p.verified, p.friend));
            // a friend follows and is followed, and is listed once, as a friend
            expect(d, "Followers", 1, List.of(p.follower));
            expect(d, "Following", 1, List.of(p.followed));
            expect(d, "Blocked", 1, List.of(p.blocked));
            String verifiedRow = rowText(d, "Friends", p.verified);
            if (! verifiedRow.contains("Verified") || rowText(d, "Friends", p.friend).contains("Verified"))
                throw new AssertionError("Only the verified friend should say so: " + verifiedRow);
            System.out.println("  ok   every list shows its people and its count, and the verified friend says so, with no empty state while loading");

            click(d, "Friends", p.friend, ".social-person__link");
            d.waitForScript("the friend's profile", "document.body.innerText.includes('" + p.friend + "') && !!document.querySelector('.modal-mask, .pg-dialog__mask')", 30_000);
            d.navigate(url + "/");
            Page.login(d, p.me, People.PASSWORD);
            openSocial(d);
            System.out.println("  ok   a friend's name opens their profile");

            click(d, "Friends", p.friend, "button.pg-btn:last-child");
            d.waitForScript("the verification dialog", "document.body.innerText.includes('" + p.friend + "') && !!document.querySelector('.qrcode-container')", 30_000);
            if (! String.valueOf(d.script("return document.querySelector('.fingerprint').innerText")).contains("Unverified"))
                throw new AssertionError("A friend not yet verified should say so in the dialog");
            d.sendKeys(d.find(".fingerprint .pg-dialog__close"), "\uE00C");
            d.waitForScript("the verification dialog closed by escape", "!document.querySelector('.qrcode-container')", 10_000);
            System.out.println("  ok   verification opens the fingerprint of that friend, says it is unverified, and closes on escape");

            d.script("const i = document.querySelector('.social-invite input'); i.value = arguments[0];"
                    + " i.dispatchEvent(new Event('input', {bubbles: true}));"
                    + " document.querySelector('.social-invite .pg-btn--primary').click(); return 1;", p.stranger);
            d.waitUntil("the request to arrive", () -> p.strangerContext.processFollowRequests().join().stream()
                    .anyMatch(r -> r.getEntry().ownerName.equals(p.me)) ? Boolean.TRUE : null, 60_000);
            System.out.println("  ok   sending a follow request reaches its recipient");

            click(d, "Incoming follow requests", p.pending, "button.pg-btn--primary");
            awaitCount(d, "Incoming follow requests", 0);
            awaitCount(d, "Friends", 3);
            click(d, "Followers", p.follower, "button.pg-btn");
            awaitCount(d, "Followers", 0);
            // unfollowing someone also blocks them
            click(d, "Following", p.followed, "button.pg-btn");
            awaitCount(d, "Following", 0);
            awaitCount(d, "Blocked", 2);
            click(d, "Blocked", p.blocked, "button.pg-btn");
            awaitCount(d, "Blocked", 1);
            System.out.println("  ok   allow and follow back, remove a follower, unfollow and unblock each take effect");

            d.navigate(url + "/");
            Page.login(d, p.me, People.PASSWORD);
            openSocial(d);
            expect(d, "Friends", 3, List.of(p.verified, p.friend, p.pending));
            if (names(d, "Followers").contains(p.follower))
                throw new AssertionError("The removed follower came back");
            if (names(d, "Following").contains(p.followed))
                throw new AssertionError("The unfollowed user is still followed");
            if (! names(d, "Blocked").contains(p.followed) || names(d, "Blocked").contains(p.blocked))
                throw new AssertionError("Unfollowing blocks, and unblocking unblocks: " + names(d, "Blocked"));
            System.out.println("  ok   and they are still so after signing in again");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Seven accounts, one of them looking at the view, in every relation the view lists. */
    static class People {
        static final String PASSWORD = "testpassword";
        final String me, verified, friend, follower, followed, pending, blocked, stranger;
        UserContext strangerContext;

        People(String s) {
            me = "maria" + s; verified = "anna" + s; friend = "ben" + s; follower = "carl" + s;
            followed = "dora" + s; pending = "emil" + s; blocked = "fred" + s; stranger = "gina" + s;
        }

        static People seed(String url) throws Exception {
            People p = new People(Long.toString(System.currentTimeMillis() % 100000));
            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
            List<String> everyone = List.of(p.me, p.verified, p.friend, p.follower, p.followed, p.pending, p.blocked, p.stranger);
            for (String name : everyone)
                UserContext.signUp(name, PASSWORD, "", network.clear(), crypto).join();
            // signed in again once all exist: each connection knows the usernames there were when it began
            Map<String, UserContext> u = new HashMap<>();
            for (String name : everyone)
                u.put(name, UserContext.signIn(name, PASSWORD, mfa -> null,
                        Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join(), crypto).join());
            UserContext me = u.get(p.me);
            follow(u.get(p.me), u.get(p.verified), true);
            follow(u.get(p.me), u.get(p.friend), true);
            follow(u.get(p.follower), me, false);
            follow(u.get(p.me), u.get(p.followed), false);
            follow(u.get(p.me), u.get(p.blocked), false);
            me.unfollow(p.blocked).join();
            u.get(p.pending).sendInitialFollowRequest(p.me).join();
            me.addFriendAnnotation(new FriendAnnotation(p.verified, true, me.generateFingerPrint(p.verified).join().left)).join();
            p.strangerContext = u.get(p.stranger);
            return p;
        }

        /** from asks to follow to; to allows it, and follows back when asked to. The order of
         *  PeergosNetworkUtils.friendBetweenGroups: each side processes its requests in turn. */
        static void follow(UserContext from, UserContext to, boolean back) {
            from.sendInitialFollowRequest(to.username).join();
            for (FollowRequestWithCipherText req : to.processFollowRequests().join())
                to.sendReplyFollowRequest(req, true, back).join();
            from.processFollowRequests().join();
        }
    }

    private static void openSocial(WebDriver d) {
        Page.gotoView(d, "Social", "sendInitialFollowRequest", "__social");
        d.waitForScript("the lists", "document.querySelectorAll('.social-section').length === 6", 60_000);
    }

    private static final String SECTION = "[...document.querySelectorAll('.social-section')].find(s => s.querySelector('h2').textContent.trim() === arguments[0])";

    @SuppressWarnings("unchecked")
    private static List<String> names(WebDriver d, String section) {
        return (List<String>) d.script("const s = " + SECTION + "; return [...s.querySelectorAll('.social-person')]"
                + ".map(r => (r.querySelector('.social-person__link') || r.querySelector('.social-person__name')).textContent.trim())", section);
    }

    private static int count(WebDriver d, String section) {
        return Integer.parseInt(String.valueOf(d.script("return (" + SECTION + ").querySelector('.pg-sectionhead span').textContent.trim()", section)));
    }

    private static void expect(WebDriver d, String section, int count, List<String> people) {
        List<String> shown = names(d, section);
        if (count(d, section) != count || shown.size() != count || ! new HashSet<>(shown).containsAll(people))
            throw new AssertionError(section + " should list " + people + " (" + count + "), but lists " + shown + " (" + count(d, section) + ")");
    }

    private static String rowText(WebDriver d, String section, String name) {
        return String.valueOf(d.script("const s = " + SECTION + "; return [...s.querySelectorAll('.social-person')]"
                + ".find(r => r.textContent.includes(arguments[1])).textContent", section, name));
    }

    private static void click(WebDriver d, String section, String name, String control) {
        d.script("const s = " + SECTION + "; [...s.querySelectorAll('.social-person')]"
                + ".find(r => r.textContent.includes(arguments[1])).querySelector(arguments[2]).click(); return 1;", section, name, control);
    }

    private static void awaitCount(WebDriver d, String section, int count) {
        d.waitUntil(section + " to count " + count, () -> count(d, section) == count, 60_000);
    }
}
