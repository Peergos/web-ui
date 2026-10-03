import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.social.FollowRequestWithCipherText;
import peergos.shared.user.UserContext;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** Blocking a friend in the social view, unblocking them, and becoming friends again, in each of the
 *  ways a person would try: asking them, following them again and then asking, and them asking. The
 *  view must never be left waiting, and they must end up friends.
 *
 *  Usage: java -cp ../server/Peergos.jar BlockRefriendTest.java [engine] [peergos url]
 */
public class BlockRefriendTest {

    static final String PASSWORD = "testpassword";

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-refriend-"), headless)) {
            String s = Long.toString(System.currentTimeMillis() % 100000);
            String me = "maria" + s, asked = "anna" + s, followedAgain = "ben" + s, asker = "carl" + s;
            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
            for (String name : List.of(me, asked, followedAgain, asker))
                UserContext.signUp(name, PASSWORD, "", network.clear(), crypto).join();
            for (String friend : List.of(asked, followedAgain, asker))
                SocialViewTest.People.follow(api(url, me, crypto), api(url, friend, crypto), true);
            d.setWindowRect(1280, 900);

            NewsFeedViewTest.signIn(d, url, me);
            openSocial(d);
            for (String friend : List.of(asked, followedAgain, asker)) {
                click(d, "Friends", friend, "button.pg-btn--danger:nth-of-type(3)");
                settled(d, "blocking " + friend);
                awaitListed(d, "Blocked", friend);
                click(d, "Blocked", friend, "button.pg-btn");
                settled(d, "unblocking " + friend);
                awaitListed(d, "Unfollowed", friend);
            }
            System.out.println("  ok   block then unblock leaves each of them unfollowed, without the view waiting");

            sendRequest(d, asked);
            settled(d, "asking " + asked);
            answer(api(url, asked, crypto));

            click(d, "Unfollowed", followedAgain, "button.pg-btn");
            settled(d, "following " + followedAgain + " again");
            awaitListed(d, "Following", followedAgain);
            sendRequest(d, followedAgain);
            settled(d, "asking " + followedAgain + " after following them again");
            answer(api(url, followedAgain, crypto));

            api(url, asker, crypto).sendInitialFollowRequest(me).join();
            NewsFeedViewTest.signIn(d, url, me);
            openSocial(d);
            awaitListed(d, "Incoming follow requests", asker);
            click(d, "Incoming follow requests", asker, "button.pg-btn--primary");
            settled(d, "allowing and following back " + asker);
            System.out.println("  ok   asking, following again then asking, and being asked each go through without the view waiting");

            NewsFeedViewTest.signIn(d, url, me);
            openSocial(d);
            d.waitUntil("all three to be friends again", () -> names(d, "Friends").containsAll(List.of(asked, followedAgain, asker)) ? Boolean.TRUE : null, 60_000);
            if (! names(d, "Unfollowed").isEmpty() || ! names(d, "Blocked").isEmpty())
                throw new AssertionError("Nobody should still be unfollowed or blocked: " + names(d, "Unfollowed") + " " + names(d, "Blocked"));
            System.out.println("  ok   and they are all friends again after signing in again");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static UserContext api(String url, String name, Crypto crypto) throws Exception {
        return NewsFeedViewTest.signInApi(url, name, crypto);
    }

    /** They allow us to follow them and follow us back. */
    static void answer(UserContext them) {
        for (FollowRequestWithCipherText req : them.processFollowRequests().join())
            them.sendReplyFollowRequest(req, true, true).join();
    }

    static void openSocial(WebDriver d) {
        Page.gotoView(d, "Social", "sendInitialFollowRequest", "__social");
        d.waitForScript("the lists loaded", "window.__social.loaded && !window.__social.showSpinner", 60_000);
    }

    /** The view stops waiting, and says nothing went wrong. */
    static void settled(WebDriver d, String what) {
        try {
            d.waitForScript(what + " to finish", "!window.__social.showSpinner", 60_000);
        } catch (RuntimeException e) {
            throw new AssertionError("The social view was left waiting after " + what);
        }
        Object error = d.script("const t = document.querySelector('.Vue-Toastification__toast--error'); return t ? t.textContent : null");
        if (error != null)
            throw new AssertionError(what + " failed: " + error);
    }

    static void sendRequest(WebDriver d, String name) {
        d.script("const i = document.querySelector('.social-invite input'); i.value = arguments[0];"
                + " i.dispatchEvent(new Event('input', {bubbles: true}));"
                + " document.querySelector('.social-invite .pg-btn--primary').click(); return 1;", name);
    }

    private static final String SECTION = "[...document.querySelectorAll('.social-section')].find(s => s.querySelector('h2').textContent.trim() === arguments[0])";

    @SuppressWarnings("unchecked")
    static List<String> names(WebDriver d, String section) {
        return (List<String>) d.script("const s = " + SECTION + "; return s ? [...s.querySelectorAll('.social-person')]"
                + ".map(r => (r.querySelector('.social-person__link') || r.querySelector('.social-person__name')).textContent.trim()) : []", section);
    }

    static void awaitListed(WebDriver d, String section, String name) {
        d.waitUntil(name + " to be listed under " + section, () -> names(d, section).contains(name) ? Boolean.TRUE : null, 60_000);
    }

    static void click(WebDriver d, String section, String name, String control) {
        d.script("const s = " + SECTION + "; [...s.querySelectorAll('.social-person')]"
                + ".find(r => r.textContent.includes(arguments[1])).querySelector(arguments[2]).click(); return 1;", section, name, control);
    }
}
