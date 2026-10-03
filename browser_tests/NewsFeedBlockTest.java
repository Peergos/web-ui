import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.display.Text;
import peergos.shared.social.*;
import peergos.shared.user.*;
import peergos.shared.user.fs.FileWrapper;
import peergos.shared.display.FileRef;
import peergos.shared.util.Pair;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** A friend's post with a comment from someone we then block: the post stays, and the comment is
 *  replaced by a note that it is hidden, since a reply is loaded straight from its author rather
 *  than through what the feed was sent.
 *
 *  Usage: java -cp ../server/Peergos.jar NewsFeedBlockTest.java [engine] [peergos url]
 */
public class NewsFeedBlockTest {

    static final String PASSWORD = "testpassword";
    static final String HIDDEN = "hidden: blocked user";

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-newsfeed-block-"), headless)) {
            String s = Long.toString(System.currentTimeMillis() % 100000);
            String me = "maria" + s, friend = "anna" + s, commenter = "ben" + s;
            String post = "Hello from " + friend, comment = "A reply from " + commenter;
            Crypto crypto = Builder.initCrypto();
            UserContext mine = seed(url, crypto, me, friend, commenter, post, comment);
            d.setWindowRect(1280, 900);

            NewsFeedViewTest.signIn(d, url, me);
            NewsFeedViewTest.openFeed(d);
            d.waitForScript("the post and its comment", "document.querySelector('#feed').textContent.includes(" + NewsFeedViewTest.js(post)
                    + ") && document.querySelector('#feed').textContent.includes(" + NewsFeedViewTest.js(comment) + ")", 120_000);
            if (NewsFeedViewTest.feedText(d).contains(HIDDEN))
                throw new AssertionError("Nothing is hidden before blocking anyone");
            System.out.println("  ok   a friend's post and a comment on it reach the feed");

            mine.block(commenter).join();
            Page.logout(d);
            NewsFeedViewTest.signIn(d, url, me);
            NewsFeedViewTest.openFeed(d);
            d.waitForScript("the post with its comment hidden", "document.querySelector('#feed').textContent.includes(" + NewsFeedViewTest.js(post)
                    + ") && document.querySelector('#feed').textContent.includes(" + NewsFeedViewTest.js(HIDDEN) + ")", 120_000);
            if (NewsFeedViewTest.feedText(d).contains(comment))
                throw new AssertionError("A blocked user's comment is still shown");
            System.out.println("  ok   after blocking its author the comment is hidden, and the post stays");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Three friends: one posts to their friends and another comments on it. */
    static UserContext seed(String url, Crypto crypto, String me, String friend, String commenter,
                            String post, String comment) throws Exception {
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        for (String name : List.of(me, friend, commenter))
            UserContext.signUp(name, PASSWORD, "", network.clear(), crypto).join();
        UserContext a = NewsFeedViewTest.signInApi(url, me, crypto),
                f = NewsFeedViewTest.signInApi(url, friend, crypto),
                c = NewsFeedViewTest.signInApi(url, commenter, crypto);
        SocialViewTest.People.follow(a, f, true);
        SocialViewTest.People.follow(a, c, true);
        SocialViewTest.People.follow(f, c, true);

        SocialFeed friendFeed = f.getSocialFeed().join().update().join();
        SocialPost initial = SocialPost.createInitialPost(friend, List.of(new Text(post)), SocialPost.Resharing.Friends);
        Pair<Path, FileWrapper> posted = friendFeed.createNewPost(initial).join();
        f.shareReadAccessWith(posted.left, Set.of(f.getSocialState().join().getFriendsGroupUid())).join();

        // signed in again, as each connection knows only the friends' groups there were when it began
        UserContext freshC = NewsFeedViewTest.signInApi(url, commenter, crypto);
        SocialFeed commenterFeed = freshC.getSocialFeed().join().update().join();
        SharedItem item = commenterFeed.getShared(0, commenterFeed.getFeedSize(), freshC.crypto, freshC.network).join().stream()
                .filter(i -> i.path.contains(friend + "/.posts/"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("The post didn't reach the commenter"));
        FileWrapper postFile = freshC.getFiles(List.of(item)).join().get(0).right;
        FileRef parent = new FileRef(item.path, item.cap, postFile.getContentHash(freshC.network, freshC.crypto).join());
        SocialPost reply = SocialPost.createComment(parent, SocialPost.Resharing.Friends, commenter, List.of(new Text(comment)));
        Pair<Path, FileWrapper> replied = commenterFeed.createNewPost(reply).join();
        freshC.shareReadAccessWith(replied.left, Set.of(freshC.getSocialState().join().getFriendsGroupUid())).join();

        // the author's feed adds the comment to their post
        NewsFeedViewTest.signInApi(url, friend, crypto).getSocialFeed().join().update().join();
        return a;
    }
}
