import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.crypto.symmetric.SymmetricKey;
import peergos.shared.display.*;
import peergos.shared.social.FollowRequestWithCipherText;
import peergos.shared.social.FriendLink;
import peergos.shared.social.SharedItem;
import peergos.shared.social.SocialFeed;
import peergos.shared.social.SocialPost;
import peergos.shared.user.SocialState;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;
import peergos.shared.util.Pair;
import peergos.shared.util.PathUtil;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** An introduction passed on with a reshare or a comment (remove-pki §9). Carol and Bob became friends through a link,
 *  so Carol holds Bob's introduction. She reshares a file of his to Alice, and Bob comments on her post, which Dave
 *  reads; neither is Bob's friend. Each is offered to ask Bob through Carol, Bob's Social view says who introduced
 *  them, and turning introductions off stops it working.
 *
 *  Usage: java -cp ../server/Peergos.jar IntroductionTest.java [engine] [peergos url]
 */
public class IntroductionTest {

    public static void main(String[] args) throws Exception {
        try {
            run(args);
        } catch (AssertionError e) {
            System.out.println(e.getMessage());
            System.exit(1);
        }
        // the api clients' threads would keep the jvm running
        System.exit(0);
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
            Fixtures.Account carol = Fixtures.account(url);
            Fixtures.Account dave = Fixtures.account(url);
            UserContext a = login(url, alice), b = login(url, bob), c = login(url, carol), dv = login(url, dave);

            FriendLink carolsLink = c.createFriendLink("", Optional.empty(), 0).join();
            b.sendFollowRequestToLink(carolsLink.toLink()).join();
            for (FollowRequestWithCipherText r : c.processFollowRequests().join())
                c.sendReplyFollowRequest(r, true, true).join();
            b.processFollowRequests().join();
            a.sendFollowRequest(carol.name(), SymmetricKey.random()).join();
            for (FollowRequestWithCipherText r : c.processFollowRequests().join())
                c.sendReplyFollowRequest(r, true, true).join();
            a.processFollowRequests().join();
            dv.sendFollowRequest(carol.name(), SymmetricKey.random()).join();
            for (FollowRequestWithCipherText r : c.processFollowRequests().join())
                c.sendReplyFollowRequest(r, true, true).join();
            dv.processFollowRequests().join();

            byte[] data = "from bob".getBytes();
            b.getUserRoot().join().uploadOrReplaceFile("from-bob.txt", new AsyncReader.ArrayBacked(data), data.length,
                    b.network, b.crypto, () -> false, x -> {}).join();
            b.shareReadAccessWith(PathUtil.get(bob.name(), "from-bob.txt"), Collections.singleton(carol.name())).join();
            UserContext c2 = login(url, carol);
            c2.getByPath(bob.name() + "/from-bob.txt").join().get();
            c2.shareReadAccessWith(PathUtil.get(bob.name(), "from-bob.txt"), Collections.singleton(alice.name())).join();

            SocialPost post = SocialPost.createInitialPost(carol.name(), Arrays.asList(new Text("carol's post")), SocialPost.Resharing.Friends);
            Pair<Path, FileWrapper> posted = c2.getSocialFeed().join().createNewPost(post).join();
            c2.shareReadAccessWith(posted.left, Set.of(c2.getGroupUid(SocialState.FRIENDS_GROUP_NAME).join().get())).join();
            UserContext b2 = login(url, bob);
            SocialFeed bobsFeed = b2.getSocialFeed().join().update().join();
            Pair<SharedItem, FileWrapper> received = bobsFeed.getSharedFiles(0, bobsFeed.getFeedSize() + 1).join().stream()
                    .filter(f -> f.left.owner.equals(carol.name()) && f.left.path.contains("/.posts/"))
                    .findFirst().get();
            SocialPost comment = SocialPost.createComment(new FileRef(received.left.path, received.left.cap,
                    post.contentHash(b2.crypto.hasher).join()), SocialPost.Resharing.Friends, bob.name(), Arrays.asList(new Text("bob's comment")));
            Pair<Path, FileWrapper> commented = bobsFeed.createNewPost(comment).join();
            b2.shareReadAccessWith(commented.left, Set.of(b2.getGroupUid(SocialState.FRIENDS_GROUP_NAME).join().get())).join();
            login(url, carol).getSocialFeed().join().update().join();

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-introduction-"), headless)) {
                d.setWindowRect(1280, 900);
                d.navigate(url + "/");
                Page.login(d, alice.name(), alice.password());
                Page.gotoView(d, "Newsfeed", "requestViaIntroduction", "__newsfeed");
                String label = "Ask " + bob.name() + " to be friends, via " + carol.name();
                d.waitForScript("the offer to ask Bob through Carol",
                        "[...document.querySelectorAll('.feed-introduce')].some(b => b.textContent.trim() === '" + label + "')", 120_000);
                d.script("[...document.querySelectorAll('.feed-introduce')].find(b => b.textContent.trim() === '" + label + "').click(); return 1;");
                d.waitForScript("the request sent", "document.body.innerText.includes('Follow request(s) sent')", 120_000);
                System.out.println("  ok   a stranger's file a friend reshared offers to ask its owner through that friend");

                Page.logout(d);
                d.navigate(url + "/");
                Page.login(d, dave.name(), dave.password());
                Page.gotoView(d, "Newsfeed", "requestViaIntroduction", "__newsfeed");
                d.waitForScript("Bob's comment", "[...document.querySelectorAll('.feed-post a.feed-author')]"
                        + ".some(a => a.textContent.trim() === '" + bob.name() + "')", 120_000);
                d.script("[...document.querySelectorAll('.feed-post a.feed-author')].find(a => a.textContent.trim() === '" + bob.name() + "').click(); return 1;");
                d.waitForScript("the offer to ask Bob through Carol", "!!document.querySelector('#friendMenu .feed-introduce')"
                        + " && document.querySelector('#friendMenu .feed-introduce').textContent.trim() === '" + label + "'", 30_000);
                d.script("document.querySelector('#friendMenu .feed-introduce').click(); return 1;");
                d.waitForScript("the request sent", "document.body.innerText.includes('Follow request(s) sent')", 120_000);
                System.out.println("  ok   a stranger's comment on a friend's post offers to ask them through that friend");

                Page.logout(d);
                d.navigate(url + "/");
                Page.login(d, bob.name(), bob.password());
                Page.gotoView(d, "Social", "sendInitialFollowRequest", "__social");
                for (String sender : List.of(alice.name(), dave.name()))
                    d.waitForScript(sender + "'s request, introduced by Carol", "[...document.querySelectorAll('#follow-request-table-id .social-person')]"
                            + ".some(r => r.textContent.includes('" + sender + "') && r.textContent.includes('introduced by " + carol.name() + "'))", 120_000);
                System.out.println("  ok   each request says who introduced its sender");

                d.script("document.querySelector('.social-link__mine').click(); return 1;");
                d.waitForScript("the introductions switch, on", "!!document.querySelector('.friend-link__introductions input')"
                        + " && document.querySelector('.friend-link__introductions input').checked"
                        + " && ! document.querySelector('.friend-link__introductions input').disabled", 30_000);
                d.script("document.querySelector('.friend-link__introductions input').click(); return 1;");
                d.waitForScript("introductions off", "! document.querySelector('.friend-link__introductions input').checked"
                        + " && ! document.querySelector('.friend-link__introductions input').disabled", 60_000);
                String intro = login(url, alice).getIntroduction(login(url, alice).getSocialFeed().join().update().join()
                        .getShared(0, 100, a.crypto, a.network).join().stream()
                        .filter(i -> i.owner.equals(bob.name())).findFirst().get()).join();
                boolean works;
                try {
                    login(url, carol).fetchFriendLink(intro).join();
                    works = true;
                } catch (Exception e) {
                    works = false;
                }
                if (works)
                    throw new AssertionError("Turning introductions off should stop Bob's introduction working");
                System.out.println("  ok   turning introductions off stops the introduction working");
            }
        } finally {
            if (own != null)
                own.close();
        }
        System.out.println("PASS");
    }

    private static UserContext login(String url, Fixtures.Account account) throws Exception {
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        Crypto crypto = Builder.initCrypto();
        return UserContext.signIn(account.name(), account.password(), r -> { throw new IllegalStateException("no second factor"); },
                network, crypto).join();
    }
}
