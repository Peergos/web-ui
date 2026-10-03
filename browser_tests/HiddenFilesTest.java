import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.storage.auth.Bat;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** Files marked hidden in the home directory aren't listed in the drive: the file blocking someone
 *  creates, and any other hidden file, whose name the drive doesn't know in advance.
 *
 *  Usage: java -cp ../server/Peergos.jar HiddenFilesTest.java [engine] [peergos url]
 */
public class HiddenFilesTest {

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-hidden-"), headless)) {
            String s = Long.toString(System.currentTimeMillis() % 100000);
            String me = "maria" + s, other = "anna" + s, visible = "visible" + s + ".txt", hidden = ".hidden" + s + ".txt";
            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
            for (String name : List.of(me, other))
                UserContext.signUp(name, PASSWORD, "", network.clear(), crypto).join();
            UserContext mine = NewsFeedViewTest.signInApi(url, me, crypto);
            byte[] data = "hello".getBytes();
            mine.getUserRoot().join().uploadOrReplaceFile(visible, new AsyncReader.ArrayBacked(data), data.length,
                    mine.network, crypto, () -> false, x -> {}).join();
            mine.getUserRoot().join().uploadFileSection(hidden, AsyncReader.build(data), true, 0, data.length,
                    Optional.empty(), true, mine.network, crypto, () -> false, x -> {}, crypto.random.randomBytes(32),
                    Optional.empty(), Optional.of(Bat.random(crypto.random)), mine.mirrorBatId()).join();
            mine.block(other).join();

            d.setWindowRect(1280, 900);
            NewsFeedViewTest.signIn(d, url, me);
            Page.gotoDrive(d);
            Page.waitForInDrive(d, visible, 60_000);
            d.waitUntil("hidden files to drop out of the listing", () -> {
                List<String> names = Page.driveListing(d);
                return ! names.contains(hidden) && ! names.contains(UserContext.BLOCKED_USERS_FILE) ? Boolean.TRUE : null;
            }, 60_000);
            if (! Page.driveListing(d).contains(visible))
                throw new AssertionError("The ordinary file went missing: " + Page.driveListing(d));
            System.out.println("  ok   the blocked users file and other hidden files aren't listed in the drive");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
