import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.social.FollowRequestWithCipherText;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;
import peergos.shared.util.PathUtil;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** A calendar entry a friend shared, shown in the feed as a tile drawn by the calendar's own
 *  page: the event itself rather than an icon, on the calendar's origin, held to the size the
 *  feed allows, and opening the full calendar when clicked.
 *
 *  Usage: java -cp ../server/Peergos.jar FeedTileTest.java [engine] [peergos url]
 */
public class FeedTileTest {

    static final String PASSWORD = "testpassword";
    static final String FRAME = ".feed-tile__frame";

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-feedtile-"), headless)) {
            String s = Long.toString(System.currentTimeMillis() % 100000);
            String me = "tess" + s, friend = "omar" + s;
            String title = "Standup " + s, place = "Room " + s;
            seed(url, me, friend, title, place);
            d.setWindowRect(1280, 900);

            NewsFeedViewTest.signIn(d, url, me);
            NewsFeedViewTest.openFeed(d);
            d.waitUntil("a tile in the feed", () -> {
                if (Boolean.TRUE.equals(d.scriptQuiet("return !!document.querySelector('" + FRAME + "')")))
                    return true;
                d.script("const b = document.querySelector('[aria-label=Refresh]'); if (b && !b.disabled) b.click(); return 1;");
                WebDriver.sleep(3000);
                return null;
            }, 120_000);

            d.waitUntil("the event drawn in the tile", () -> {
                d.switchToFrame(FRAME);
                try {
                    String text = String.valueOf(d.scriptQuiet("return document.body ? document.body.textContent : ''"));
                    return text.contains(title) && text.contains(place) && text.contains("Weekly") ? true : null;
                } finally {
                    d.switchToTop();
                }
            }, 60_000);
            d.waitForScript("the tile shown in place of its placeholder",
                    "!document.querySelector('.feed-tile__placeholder')", 30_000);
            System.out.println("  ok   a shared event is drawn in the feed: its title, place and repeat");

            String src = String.valueOf(d.script("return document.querySelector('" + FRAME + "').src"));
            String expected = String.valueOf(d.script("return location.protocol + '//calendar.' + location.host + '/apps/calendar/tile.html'"));
            if (! src.startsWith(expected))
                throw new AssertionError("The tile is not the calendar's own page: " + src);
            String sandbox = String.valueOf(d.script("return document.querySelector('" + FRAME + "').getAttribute('sandbox')"));
            if (! sandbox.equals("allow-scripts allow-same-origin"))
                throw new AssertionError("The tile frame is not sandboxed as expected: " + sandbox);
            System.out.println("  ok   the tile is the calendar's page, on the calendar's origin, sandboxed");

            d.switchToFrame(FRAME);
            try {
                d.script("window.parent.postMessage({type: 'resize', height: 100000}, '*'); return 1;");
            } finally {
                d.switchToTop();
            }
            WebDriver.sleep(1000);
            long height = ((Number) d.script("return document.querySelector('.feed-tile').getBoundingClientRect().height")).longValue();
            if (height > 480)
                throw new AssertionError("The tile grew past the feed's limit: " + height + "px");
            System.out.println("  ok   a tile asking to be huge is held to " + height + "px");

            d.switchToFrame(FRAME);
            try {
                d.script("document.getElementById('tile').click(); return 1;");
            } finally {
                d.switchToTop();
            }
            d.waitForScript("the full calendar", "!!document.querySelector('" + CalendarApp.FRAME + "')", 60_000);
            System.out.println("  ok   clicking the tile opens the full calendar");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Two friends, and a repeating event one of them shares with the other. */
    static void seed(String url, String me, String friend, String title, String place) throws Exception {
        Crypto crypto = Builder.initCrypto();
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        for (String name : List.of(me, friend))
            UserContext.signUp(name, PASSWORD, "", network.clear(), crypto).join();
        UserContext a = NewsFeedViewTest.signInApi(url, me, crypto), b = NewsFeedViewTest.signInApi(url, friend, crypto);
        a.sendInitialFollowRequest(friend).join();
        for (FollowRequestWithCipherText req : b.processFollowRequests().join())
            b.sendReplyFollowRequest(req, true, true).join();
        a.processFollowRequests().join();

        String ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Peergos//FeedTileTest//EN\r\n"
                + "BEGIN:VEVENT\r\nUID:feed-tile-" + title.replace(' ', '-') + "\r\n"
                + "DTSTAMP:20260101T000000Z\r\nDTSTART:20260105T090000Z\r\nDTEND:20260105T093000Z\r\n"
                + "RRULE:FREQ=WEEKLY\r\nSUMMARY:" + title + "\r\nLOCATION:" + place + "\r\n"
                + "END:VEVENT\r\nEND:VCALENDAR\r\n";
        byte[] data = ics.getBytes(StandardCharsets.UTF_8);
        FileWrapper root = b.getUserRoot().join();
        root.uploadOrReplaceFile("standup.ics", new AsyncReader.ArrayBacked(data), 0, data.length, b.network, crypto, x -> {}).join();
        b.shareReadAccessWith(PathUtil.get(friend, "standup.ics"), Set.of(me)).join();
    }
}
