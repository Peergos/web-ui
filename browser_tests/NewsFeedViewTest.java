import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.social.FollowRequestWithCipherText;
import peergos.shared.user.UserContext;
import peergos.shared.util.PathUtil;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** The news feed between two friends: a folder one shared with the other, a post, a reply to it,
 *  and a post of one's own edited and deleted from its menu - what the feed did before it was
 *  restyled. The page is found by its words and the ids it has always had, so the same test runs
 *  on either look.
 *
 *  Usage: java -cp ../server/Peergos.jar NewsFeedViewTest.java [engine] [peergos url]
 */
public class NewsFeedViewTest {

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-newsfeed-"), headless)) {
            String s = Long.toString(System.currentTimeMillis() % 100000);
            String me = "maria" + s, friend = "anna" + s, folder = "Trip" + s;
            seed(url, me, friend, folder);
            d.setWindowRect(1280, 900);

            String theirs = "Hello from " + friend, mine = "My first post " + s, reply = "Nice one " + s;
            signIn(d, url, friend);
            openFeed(d);
            post(d, theirs, true);
            System.out.println("  ok   a new post appears in its author's feed");

            Page.logout(d);
            signIn(d, url, me);
            openFeed(d);
            d.waitUntil("the friend's post and share", () -> {
                if (feedText(d).contains(theirs) && feedText(d).contains(folder))
                    return true;
                d.script("const b = document.querySelector('[aria-label=Refresh]'); if (b && !b.disabled) b.click(); return 1;");
                WebDriver.sleep(3000);
                return null;
            }, 120_000);
            System.out.println("  ok   a friend's post and the folder they shared both reach the feed");

            clickNear(d, theirs, "Reply");
            composer(d, reply, false);
            d.waitForScript("the reply", "document.querySelector('#feed').textContent.includes(" + js(reply) + ")", 60_000);
            System.out.println("  ok   a reply to a friend's post appears under it");

            post(d, mine, true);
            openPostMenu(d, mine);
            menuItem(d, "Edit");
            d.waitForScript("the post to edit", "document.querySelector('#social-post-text') && document.querySelector('#social-post-text').value === " + js(mine), 30_000);
            d.script("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel').click(); return 1;");
            d.waitForScript("the editor closed", "!document.querySelector('#social-post-text')", 30_000);
            // the composer is a dialog like the others: escape closes it too
            d.script("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'New Post').click(); return 1;");
            d.waitForScript("the composer", "!!document.querySelector('#social-post-text')", 30_000);
            d.sendKeys(d.find("#social-post-text"), "\uE00C");
            d.waitForScript("the composer closed by escape", "!document.querySelector('#social-post-text')", 10_000);
            // a click anywhere else closes the menu, outside the feed's column as well as in it
            openPostMenu(d, mine);
            d.click(d.find(".newsfeed-view h1"));
            d.waitForScript("the menu closed by a click elsewhere", "!document.querySelector('#editMenu')", 10_000);
            openPostMenu(d, mine);
            d.sendKeys(d.find("#editMenu"), "\uE00C");
            d.waitForScript("the menu closed by escape", "!document.querySelector('#editMenu')", 10_000);
            openPostMenu(d, mine);
            menuItem(d, "Delete");
            d.waitForScript("the deletion to confirm", "!!document.querySelector('.pg-dialog')", 30_000);
            d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === 'Yes').click(); return 1;");
            d.waitForScript("the post gone", "!document.querySelector('#feed').textContent.includes(" + js(mine) + ")", 60_000);
            System.out.println("  ok   one's own post opens for editing from its menu, the composer closes on escape, the menu closes on a click elsewhere or escape, and the post is deleted from it once confirmed");

            d.script("[...document.querySelectorAll('#feed a')].find(a => a.textContent.trim() === arguments[0]).click(); return 1;", folder);
            d.waitForScript("the shared folder in the drive", "(() => { let r = null; r = " + Page.VUE + ".root();"
                    + " const q = [r]; while (q.length) { const c = q.shift(); if (! c) continue;"
                    + "   if (typeof c.downloadFile === 'function' && c.currentDir) return c.currentDir.getName() === " + js(folder) + ";"
                    + "   q.push(..." + Page.VUE + ".children(c)); } return false; })()", 60_000);
            System.out.println("  ok   the shared folder's name opens it in the drive");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static String js(String s) {
        return "'" + s.replace("'", "\\'") + "'";
    }

    /** Two friends, and a folder one of them shares with the other. */
    static void seed(String url, String me, String friend, String folder) throws Exception {
        Crypto crypto = Builder.initCrypto();
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        for (String name : List.of(me, friend))
            UserContext.signUp(name, PASSWORD, "", network.clear(), crypto).join();
        UserContext a = signInApi(url, me, crypto), b = signInApi(url, friend, crypto);
        a.sendInitialFollowRequest(friend).join();
        for (FollowRequestWithCipherText req : b.processFollowRequests().join())
            b.sendReplyFollowRequest(req, true, true).join();
        a.processFollowRequests().join();
        b.getUserRoot().join().mkdir(folder, b.network, false, Optional.empty(), crypto).join();
        b.shareReadAccessWith(PathUtil.get(friend, folder), Set.of(me)).join();
    }

    static UserContext signInApi(String url, String name, Crypto crypto) throws Exception {
        return UserContext.signIn(name, PASSWORD, mfa -> null,
                Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join(), crypto).join();
    }

    static void signIn(WebDriver d, String url, String user) {
        d.navigate(url + "/");
        d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
        Page.login(d, user, PASSWORD);
    }

    static void openFeed(WebDriver d) {
        Page.gotoView(d, "Newsfeed", "addNewPost", "__feed");
        try {
            d.waitForScript("the feed", "!window.__feed.buildingFeed && !!document.querySelector('#feed')", 120_000);
        } catch (RuntimeException neverBuilt) {
            System.out.println("  the feed never built, the page showing: " + d.script(
                    "return JSON.stringify([...document.querySelectorAll('.Vue-Toastification__toast')].map(t => t.textContent.trim()))"));
            throw neverBuilt;
        }
    }

    static String feedText(WebDriver d) {
        return String.valueOf(d.script("const f = document.querySelector('#feed'); return f ? f.textContent : ''"));
    }

    static void post(WebDriver d, String text, boolean toFriends) {
        d.script("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'New Post').click(); return 1;");
        composer(d, text, toFriends);
        d.waitForScript("the post", "document.querySelector('#feed').textContent.includes(" + js(text) + ")", 60_000);
    }

    static void composer(WebDriver d, String text, boolean toFriends) {
        d.waitForScript("the composer", "!!document.querySelector('#social-post-text')", 30_000);
        d.script("const t = document.querySelector('#social-post-text'); t.value = arguments[0];"
                + " t.dispatchEvent(new Event('input', {bubbles: true}));"
                + " if (arguments[1] && document.querySelector('#friends-option')) document.querySelector('#friends-option').click(); return 1;", text, toFriends);
        // the composer's own button: every prompt in the app shares this id, and one of those
        // mounted elsewhere would be the button waited on and clicked instead
        String button = "document.querySelector('.social-post #prompt-button-id')";
        d.waitForScript("posting allowed", "!" + button + ".disabled", 10_000);
        // a post that fails says so in a toast that has faded long before a timeout here, so keep
        // every toast from the click on
        d.script("window.__toastsSeen = []; if (window.__toastWatch) window.__toastWatch.disconnect();"
                + " window.__toastWatch = new MutationObserver(() => document.querySelectorAll('.Vue-Toastification__toast').forEach(t => {"
                + "   const x = t.textContent.trim(); if (x && ! window.__toastsSeen.includes(x)) window.__toastsSeen.push(x); }));"
                + " window.__toastWatch.observe(document.body, {childList: true, subtree: true, characterData: true}); return 1;");
        // and count the composer's own steps, so a post that never closes can say whether the
        // click reached it at all, and whether it asked to be closed
        d.script("const feed = " + Page.VUE + ".of(document.querySelector('.newsfeed-view')), q = [feed]; let p = null;"
                + " while (q.length && ! p) { const c = q.shift(); if (typeof c.submitPost === 'function') p = c; else q.push(..." + Page.VUE + ".children(c)); }"
                + " window.__postCalls = {submit: 0, close: 0, errors: []};"
                + " if (p) { const s = p.submitPost, c = p.closeSocialPostForm;"
                + "   p.submitPost = function() { window.__postCalls.submit++; return s.apply(this, arguments); };"
                + "   p.closeSocialPostForm = function() { window.__postCalls.close++; return c.apply(this, arguments); }; }"
                + " window.addEventListener('error', e => window.__postCalls.errors.push(String(e.message)));"
                + " window.addEventListener('unhandledrejection', e => window.__postCalls.errors.push('rejected: ' + String(e.reason)));"
                + " return !! p;");
        d.script(button + ".click(); return 1;");
        // saving a post is a write and a share, which a busy runner can take over a minute over
        try {
            d.waitForScript("the composer closed", "!document.querySelector('#social-post-text')", 120_000);
        } catch (RuntimeException neverClosed) {
            sayWhereThePostIs(d);
            throw neverClosed;
        }
    }

    /** A post is the write, then the share with the chosen group, then the composer closing,
     *  and a bare timeout names none of them - so say whether it is still busy, which groups
     *  it could share with and what the page has shown. Once the post is done the composer is
     *  gone from the feed and only its dialog stays, for as long as it takes to fade out. */
    static void sayWhereThePostIs(WebDriver d) {
        try {
            System.out.println("  the composer: " + d.script("const feed = " + Page.VUE + ".of(document.querySelector('.newsfeed-view')), q = [feed]; let p = null;"
                    + " while (q.length && ! p) { const c = q.shift(); if (typeof c.submitPost === 'function') p = c; else q.push(..." + Page.VUE + ".children(c)); }"
                    + " const text = document.querySelector('#social-post-text'), dialog = text && text.closest('.pg-dialog__mask');"
                    + " return JSON.stringify({open: !! p, posting: p && p.isPosting, spinner: p && p.showSpinner, shareWith: p && p.shareWith,"
                    + "   dialog: dialog && dialog.className, groups: Object.keys(feed.$store.state.socialData.groupsNameToUid),"
                    + "   friends: feed.$store.state.socialData.friends, text: p && p.post,"
                    + "   toastsSinceThePost: window.__toastsSeen || [],"
                    + "   calls: window.__postCalls,"
                    + "   toasts: [...document.querySelectorAll('.Vue-Toastification__toast')].map(t => t.textContent.trim())});"));
        } catch (RuntimeException e) {
            System.out.println("  the composer could not be read: " + e.getMessage());
        }
    }

    /** Clicks the control with that label in the part of the feed holding the given text. */
    static void clickNear(WebDriver d, String text, String label) {
        d.script("let n = [...document.querySelectorAll('.post-content')].find(p => p.textContent.includes(arguments[0]));"
                + " const hit = el => [...el.querySelectorAll('i, button')].find(b => b.textContent.trim() === arguments[1]);"
                + " while (n && ! hit(n)) n = n.parentElement;"
                + " hit(n).click(); return 1;", text, label);
    }

    /** The item's own control where it has one - the old menu put its handler on a link
     *  inside the item - and the item itself otherwise. */
    static void menuItem(WebDriver d, String label) {
        d.script("const items = [...document.querySelectorAll('#editMenu a, #editMenu button')].concat([...document.querySelectorAll('#editMenu li')]);"
                + " items.find(e => e.textContent.trim() === arguments[0]).click(); return 1;", label);
    }

    static void openPostMenu(WebDriver d, String text) {
        d.script("let n = [...document.querySelectorAll('.post-content')].find(p => p.textContent.includes(arguments[0]));"
                + " const hit = el => el.querySelector('.fa-ellipsis-h, .feed-post__more');"
                + " while (n && ! hit(n)) n = n.parentElement;"
                + " hit(n).click(); return 1;", text);
        d.waitForScript("the post's menu", "!!document.querySelector('#editMenu')", 10_000);
    }
}
