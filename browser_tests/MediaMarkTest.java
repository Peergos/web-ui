import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.social.FollowRequestWithCipherText;
import peergos.shared.user.UserContext;
import peergos.shared.util.PathUtil;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** The thumbnail of a video, or the cover art of a piece of music, is a still picture that reads
 *  as a photo, so it wears a mark - a play glyph or a speaker - in the drive's grid and list and
 *  in the news feed. A photo wears none, and nor does a file without a thumbnail.
 *
 *  Only a browser makes a video's thumbnail, from a video it can decode, and CI has nothing to
 *  make one with. The mark goes by the file's type and its having a thumbnail, so the video here
 *  is an mp4 header given a thumbnail over the api, which is what a browser upload stores. The
 *  music is a real ID3 tag with a picture in it, which the upload turns into a thumbnail itself.
 *
 *  Usage: java -cp ../server/Peergos.jar MediaMarkTest.java [engine] [url]
 */
public class MediaMarkTest {
    static final String FOLDER = "marks";
    static final String VIDEO = "mark-film.mp4", MUSIC = "mark-song.mp3", SILENT = "mark-plain.mp3",
            PHOTO = "mark-photo.png", TEXT = "mark-notes.txt";

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();
        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        try {
            Fixtures.Account me = Fixtures.account(url), friend = Fixtures.account(url);
            Fixtures.uploadInto(serverDir.resolve("Peergos.jar"), url, me.name(), me.password(), FOLDER,
                    List.of(video(), music(true), music(false), photo(), text()));
            Crypto crypto = Builder.initCrypto();
            UserContext mine = signIn(url, me, crypto), theirs = signIn(url, friend, crypto);
            mine.getByPath(PathUtil.get(me.name(), FOLDER, VIDEO)).join().get()
                    .updateThumbnail("data:image/jpeg;base64," + Base64.getEncoder().encodeToString(picture("jpg")), mine.network).join();
            mine.sendInitialFollowRequest(friend.name()).join();
            for (FollowRequestWithCipherText req : theirs.processFollowRequests().join())
                theirs.sendReplyFollowRequest(req, true, true).join();
            mine.processFollowRequests().join();
            for (String name : List.of(VIDEO, MUSIC, PHOTO))
                mine.shareReadAccessWith(PathUtil.get(me.name(), FOLDER, name), Set.of(friend.name())).join();

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-marks-"), headless)) {
                d.setWindowRect(1280, 900);
                signIn(d, url, me);
                Page.gotoDrive(d);
                Page.openPath(d, "/" + me.name() + "/" + FOLDER, FOLDER);
                for (boolean grid : List.of(true, false)) {
                    String view = grid ? "grid" : "list";
                    d.script("window.__drive.isGrid = arguments[0]; return 1;", grid);
                    Map<String, Map<String, Object>> seen = d.waitUntil("the " + view + " with every thumbnail decoded", () -> {
                        Map<String, Map<String, Object>> s = marks(d, view);
                        return s.keySet().containsAll(List.of(VIDEO, MUSIC, SILENT, PHOTO, TEXT))
                                && thumb(s.get(VIDEO)) && thumb(s.get(MUSIC)) && thumb(s.get(PHOTO)) ? s : null;
                    }, 60_000);
                    expectMark(seen, VIDEO, "Video", "#play", view);
                    expectMark(seen, MUSIC, "Audio", "#speaker", view);
                    expectNone(seen, PHOTO, true, view);
                    expectNone(seen, SILENT, false, view);
                    expectNone(seen, TEXT, false, view);
                    System.out.println("  ok   in the " + view + " the video and the music wear their marks"
                            + " inside the picture, clear of its controls, and a tap on one reaches the picture;"
                            + " the photo and the files without a thumbnail wear none");
                }

                Page.logout(d);
                signIn(d, url, friend);
                Page.gotoView(d, "Newsfeed", "addNewPost", "__feed");
                Map<String, Map<String, Object>> feed = d.waitUntil("the three shared files in the feed", () -> {
                    Map<String, Map<String, Object>> s = marks(d, "feed");
                    if (thumb(s.get(VIDEO)) && thumb(s.get(MUSIC)) && thumb(s.get(PHOTO)))
                        return s;
                    d.scriptQuiet("const b = document.querySelector('[aria-label=Refresh]'); if (b && !b.disabled) b.click(); return 1;");
                    WebDriver.sleep(3000);
                    return null;
                }, 180_000);
                expectMark(feed, VIDEO, "Video", "#play", "feed");
                expectMark(feed, MUSIC, "Audio", "#speaker", "feed");
                expectNone(feed, PHOTO, true, "feed");
                System.out.println("  ok   in a friend's feed the shared video and music wear their marks and the photo none");
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** What each item shows, by file name: its thumbnail, and the mark over it measured against it. */
    @SuppressWarnings("unchecked")
    static Map<String, Map<String, Object>> marks(WebDriver d, String view) {
        Object items = d.scriptQuiet("const view = arguments[0], box = e => e.getBoundingClientRect();"
                + " const items = view === 'grid' ? document.querySelectorAll('.grid-card')"
                + "   : view === 'list' ? document.querySelectorAll('.drive-table tbody tr') : document.querySelectorAll('.feed-share');"
                + " return [...items].map(item => {"
                + "   const label = item.querySelector(view === 'grid' ? '.card__name' : view === 'list' ? 'td.file' : '.feed-link__name');"
                + "   const img = item.querySelector(view === 'grid' ? 'img.cover' : view === 'list' ? 'img.tablethumb' : 'img.feed-preview__thumb');"
                + "   const mark = item.querySelector('.media-mark');"
                + "   const out = {name: label ? label.textContent.trim() : '', thumb: !! img && img.complete && img.naturalWidth > 0,"
                + "     alt: img ? img.getAttribute('alt') : null, mark: mark ? mark.getAttribute('aria-label') : null};"
                + "   if (mark && img) {"
                + "     item.scrollIntoView({block: 'center'});"
                + "     const m = box(mark), p = box(img), use = mark.querySelector('use'), glyph = use.getBBox();"
                + "     const clear = c => ! c || m.right <= box(c).left || box(c).right <= m.left || m.bottom <= box(c).top || box(c).bottom <= m.top;"
                + "     out.glyph = use.getAttribute('href') || use.getAttribute('xlink:href');"
                + "     out.painted = glyph.width > 0 && glyph.height > 0;"
                + "     out.inside = m.width > 0 && m.left >= p.left - 0.5 && m.top >= p.top - 0.5 && m.right <= p.right + 0.5 && m.bottom <= p.bottom + 0.5;"
                + "     out.clear = clear(item.querySelector('.card__select')) && clear(item.querySelector('.card__menu'));"
                + "     out.through = document.elementFromPoint((m.left + m.right) / 2, (m.top + m.bottom) / 2) === img;"
                + "   }"
                + "   return out;"
                + " });", view);
        Map<String, Map<String, Object>> byName = new HashMap<>();
        if (items instanceof List)
            for (Object o : (List<?>) items) {
                Map<String, Object> m = (Map<String, Object>) o;
                byName.put(String.valueOf(m.get("name")), m);
            }
        return byName;
    }

    static boolean thumb(Map<String, Object> item) {
        return item != null && Boolean.TRUE.equals(item.get("thumb"));
    }

    static void expectMark(Map<String, Map<String, Object>> seen, String name, String label, String glyph, String view) {
        Map<String, Object> item = seen.get(name);
        if (! label.equals(item.get("mark")) || ! glyph.equals(item.get("glyph")) || ! Boolean.TRUE.equals(item.get("painted")))
            throw new AssertionError("In the " + view + ", " + name + " should wear a mark read as " + label
                    + " showing " + glyph + ", but has " + item);
        if (! Boolean.TRUE.equals(item.get("inside")))
            throw new AssertionError("In the " + view + ", the mark on " + name + " is not inside its picture: " + item);
        if (! Boolean.TRUE.equals(item.get("clear")))
            throw new AssertionError("In the " + view + ", the mark on " + name + " lies over the tile's select circle or menu: " + item);
        if (! Boolean.TRUE.equals(item.get("through")))
            throw new AssertionError("In the " + view + ", a tap on the mark on " + name + " does not reach the picture under it: " + item);
        if (! "".equals(item.get("alt")))
            throw new AssertionError("In the " + view + ", the thumbnail of " + name + " should have an empty alt, as its name"
                    + " is beside it, but has " + item.get("alt"));
    }

    static void expectNone(Map<String, Map<String, Object>> seen, String name, boolean thumbnail, String view) {
        Map<String, Object> item = seen.get(name);
        if (item.get("mark") != null)
            throw new AssertionError("In the " + view + ", " + name + " should wear no mark, but has " + item);
        if (thumb(item) != thumbnail)
            throw new AssertionError("In the " + view + ", " + name + (thumbnail ? " should" : " should not") + " have a thumbnail: " + item);
        if (thumbnail && ! "".equals(item.get("alt")))
            throw new AssertionError("In the " + view + ", the thumbnail of " + name + " should have an empty alt, but has " + item.get("alt"));
    }

    static UserContext signIn(String url, Fixtures.Account account, Crypto crypto) throws Exception {
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        return UserContext.signIn(account.name(), account.password(), mfa -> null, network, crypto).join();
    }

    static void signIn(WebDriver d, String url, Fixtures.Account account) {
        d.navigate(url + "/");
        d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
        Page.login(d, account.name(), account.password());
    }

    /** A picture that is neither all black nor all white, as a png or a jpg. */
    static byte[] picture(String format) throws IOException {
        BufferedImage image = new BufferedImage(160, 120, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        for (int i = 0; i < 4; i++) {
            g.setColor(new Color(60 * i, 200 - 40 * i, 120));
            g.fillRect(40 * i, 0, 40, 120);
        }
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    static Path write(String name, byte[] bytes) throws IOException {
        Path dir = Fixtures.fixtureDir();
        Files.createDirectories(dir);
        return Files.write(dir.resolve(name), bytes);
    }

    static Path photo() throws IOException {
        return write(PHOTO, picture("png"));
    }

    static Path text() throws IOException {
        return write(TEXT, "nothing to see\n".getBytes(StandardCharsets.UTF_8));
    }

    /** The start of an mp4 - an ftyp box naming isom - which is all that makes a file a video here. */
    static Path video() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(new byte[] {0, 0, 0, 24});
        out.write("ftypisom\0\0\2\0isomiso2".getBytes(StandardCharsets.US_ASCII));
        out.write(new byte[1000]);
        return write(VIDEO, out.toByteArray());
    }

    /** An ID3v2.3 tag, with the cover art in an APIC frame or a title in a TIT2 one, before a few
     *  frames of silence. */
    static Path music(boolean withCover) throws IOException {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        if (withCover) {
            body.write(0); // ISO-8859-1
            body.write("image/png\0".getBytes(StandardCharsets.US_ASCII));
            body.write(3); // front cover
            body.write(0); // no description
            body.write(picture("png"));
        } else {
            body.write(0);
            body.write("No cover".getBytes(StandardCharsets.US_ASCII));
        }
        ByteArrayOutputStream frame = new ByteArrayOutputStream();
        frame.write((withCover ? "APIC" : "TIT2").getBytes(StandardCharsets.US_ASCII));
        int size = body.size();
        frame.write(new byte[] {(byte) (size >>> 24), (byte) (size >>> 16), (byte) (size >>> 8), (byte) size, 0, 0});
        body.writeTo(frame);
        int tag = frame.size();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write("ID3".getBytes(StandardCharsets.US_ASCII));
        out.write(new byte[] {3, 0, 0, (byte) ((tag >>> 21) & 0x7f), (byte) ((tag >>> 14) & 0x7f), (byte) ((tag >>> 7) & 0x7f), (byte) (tag & 0x7f)});
        frame.writeTo(out);
        // MPEG-1 layer III, 128 kbit/s, 44.1 kHz: 417 bytes a frame
        for (int i = 0; i < 8; i++) {
            out.write(new byte[] {(byte) 0xff, (byte) 0xfb, (byte) 0x90, 0x64});
            out.write(new byte[413]);
        }
        return write(withCover ? MUSIC : SILENT, out.toByteArray());
    }
}
