import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;

/** Renders an html file in the html viewer, follows its links, and checks its images loaded.
 *
 *  The viewer runs the user's own html inside a sandboxed iframe on a per workspace subdomain,
 *  and every relative resource - links and images alike - is served by the sandbox service worker
 *  reading from the drive. So a broken resolution does not show up as an error: a link goes
 *  nowhere and an image renders as nothing, both of which look like an ordinary page.
 *
 *  Images are therefore asserted on naturalWidth, and each one is a different size so a wrong but
 *  present image cannot pass. Links and images are covered both beside the page and in a
 *  subdirectory, since those resolve differently.
 *
 *  It signs up its own user rather than using the admin account. /peergos/ is a magic prefix to
 *  the sandbox service worker, marking an absolute drive path of the form
 *  /peergos/<username>/<rest>, which it redirects to /<username>/<rest>. The admin account is
 *  itself called "peergos", so its files land on /peergos/... and get redirected as though the
 *  first directory name were the username - which then 400s and renders nothing.
 *
 *  Usage: java -cp ../server/Peergos.jar HtmlViewerTest.java [engine] [url]
 */
public class HtmlViewerTest {

    static final int SAME_W = 40, SAME_H = 20;      // image beside index.html
    static final int SUB_W = 60, SUB_H = 30;        // image in the subdirectory

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
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();
        Path jar = serverDir.resolve("Peergos.jar");

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;

        String user = "html" + (System.currentTimeMillis() % 1_000_000);
        String password = "htmlviewertestpassword";
        Fixtures.signUp(url, user, password);
        System.out.println("signed up " + user);

        String folder = "htmltest-" + System.currentTimeMillis();
        Path dir = Files.createTempDirectory("peergos-html-");
        Path index = dir.resolve("index.html");
        Path sibling = dir.resolve("sibling.html");
        Path child = dir.resolve("child.html");
        Path same = dir.resolve("same.png");
        Path nested = dir.resolve("nested.png");

        Files.writeString(index, page("Index page",
                "<p>the index</p>"
                        + "<img id=\"beside\" src=\"same.png\">"
                        + "<img id=\"below\" src=\"sub/nested.png\">"
                        + "<p><a id=\"tosibling\" href=\"sibling.html\">go to the sibling</a></p>"));
        Files.writeString(sibling, page("Sibling page",
                "<p>reached the sibling</p>"
                        + "<p><a id=\"tochild\" href=\"sub/child.html\">go to the child</a></p>"));
        // referenced without a path, so it only resolves if the subdirectory page resolves
        // relative to its own directory rather than the root
        Files.writeString(child, page("Child page",
                "<p>reached the child in a subdirectory</p>"
                        + "<img id=\"besidechild\" src=\"nested.png\">"));
        writePng(same, SAME_W, SAME_H);
        writePng(nested, SUB_W, SUB_H);

        Path downloads = Files.createTempDirectory("peergos-html-dl-");
        try {
            Fixtures.commands(jar, url, user, password,
                    "mkdir " + folder,
                    "cd " + folder,
                    "put " + index.toAbsolutePath(),
                    "put " + sibling.toAbsolutePath(),
                    "put " + same.toAbsolutePath(),
                    "mkdir sub",
                    "cd sub",
                    "put " + child.toAbsolutePath(),
                    "put " + nested.toAbsolutePath());
            Fixtures.awaitListing(jar, url, user, password, folder,
                    120_000, "index.html", "sibling.html", "same.png", "sub");
            Fixtures.awaitListing(jar, url, user, password, folder + "/sub",
                    120_000, "child.html", "nested.png");

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, user, password);
                Page.gotoDrive(d);

                String root = Page.currentPath(d);
                Page.openPath(d, root + folder, folder);
                Page.waitForInDrive(d, "index.html", 120_000);

                // The html viewer is the read-only route: getApp returns "editor" for a writable
                // html and "htmlviewer" only when it is not, so this is the context menu's View,
                // not Open. viewFile() calls openFile(false), which is what the menu item does.
                System.out.println("opening index.html with View");
                Page.select(d, "index.html");
                d.script("window.__drive.viewFile();");

                inFrame(d, () -> {
                    requireText(d, "the index");
                    requireImage(d, "beside", SAME_W, SAME_H, "beside the page");
                    requireImage(d, "below", SUB_W, SUB_H, "in a subdirectory");
                });
                System.out.println("  index.html rendered, both images loaded");

                clickInFrame(d, "tosibling");
                inFrame(d, () -> requireText(d, "reached the sibling"));
                System.out.println("  followed the same directory link, sibling.html rendered");

                clickInFrame(d, "tochild");
                inFrame(d, () -> {
                    requireText(d, "reached the child in a subdirectory");
                    requireImage(d, "besidechild", SUB_W, SUB_H, "beside the subdirectory page");
                });
                System.out.println("  followed the subdirectory link, sub/child.html rendered"
                        + " with its own image");

                System.out.println("  ok   links and images resolved in both directories");
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    private static String page(String title, String body) {
        return "<!doctype html><html><head><title>" + title + "</title></head>"
                + "<body><h1>" + title + "</h1>" + body + "</body></html>";
    }

    private static void writePng(Path target, int width, int height) throws java.io.IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < width; x++)
            for (int y = 0; y < height; y++)
                image.setRGB(x, y, ((x * 7 + y * 13) & 0xff) << 8);
        ImageIO.write(image, "png", target.toFile());
    }

    /** Descends to the page itself, two frames down.
     *
     *  #sandboxId holds sandbox.html on a content addressed subdomain, and the user's file is in
     *  #appSandboxId inside that. Stopping at the first frame - or worse, at "the first iframe on
     *  the page", which is the streamsaver worker or the hidden print container - lands on an
     *  empty body and every assertion then fails for the wrong reason.
     */
    private static void descend(WebDriver d) {
        Object outer;
        try {
            outer = d.waitUntil("the sandbox frame", () -> d.find("iframe#sandboxId"), 120_000);
        } catch (RuntimeException e) {
            // AppSandbox creates this iframe from javascript in startListener, after an async
            // setup, so its absence means that setup never finished rather than "not yet drawn"
            throw new AssertionError("The sandbox frame never appeared. " + diagnose(d));
        }
        d.switchToFrame(outer);
        Object inner = d.waitUntil("the page frame inside the sandbox",
                () -> d.find("iframe#appSandboxId"), 120_000);
        d.switchToFrame(inner);
    }

    /** What the page looks like when the sandbox never opens, so a CI failure is readable. */
    private static String diagnose(WebDriver d) {
        return String.valueOf(d.scriptQuiet(
                "const dr = window.__drive || {};" +
                "return 'showAppSandbox=' + dr.showAppSandbox" +
                " + ' sandboxAppName=' + dr.sandboxAppName" +
                " + ' currentFile=' + (dr.currentFile ? dr.currentFile.getName() : null)" +
                " + ' currentPath=' + dr.currentPath" +
                " + ' selected=' + (dr.selectedFiles || []).length" +
                " + ' container=' + !!document.getElementById('sandbox-container')" +
                " + ' iframes=[' + [...document.querySelectorAll('iframe')]" +
                "     .map(f => (f.id || '?') + ':' + (f.getAttribute('src') || '').substring(0, 60)).join(' | ') + ']'" +
                " + ' errors=' + JSON.stringify((window.__htmlErrors || []).slice(0, 6))" +
                // AppSandbox refuses to open at all unless both of these hold, and it closes
                // itself rather than throwing, which is why the page looks untouched afterwards
                " + ' crossOriginIsolated=' + window.crossOriginIsolated" +
                " + ' serviceWorker=' + ('serviceWorker' in navigator)" +
                " + ' streams=' + (() => { try { return !!new ReadableStream() && !!new WritableStream(); }" +
                "                          catch (e) { return 'threw: ' + e; } })()" +
                " + ' visibleError=' + JSON.stringify(document.body.innerText" +
                "     .split('\\n').filter(l => /sandbox|isolated|incognito/i.test(l)).slice(0, 3))"));
    }

    private static void inFrame(WebDriver d, Runnable body) {
        descend(d);
        try {
            body.run();
        } finally {
            d.switchToFrame(null);
        }
    }

    private static void clickInFrame(WebDriver d, String id) {
        descend(d);
        try {
            Object clicked = d.script("const a = document.getElementById(arguments[0]);"
                    + "if (a) { a.click(); return true; } return false;", id);
            if (! Boolean.TRUE.equals(clicked))
                throw new AssertionError("No link #" + id + " in the rendered page");
        } finally {
            d.switchToFrame(null);
        }
    }

    private static void requireText(WebDriver d, String expected) {
        d.waitUntil("'" + expected + "' to render", () -> {
            Object text = d.scriptQuiet("return document.body ? document.body.innerText : ''");
            return text != null && String.valueOf(text).contains(expected);
        }, 120_000);
    }

    /** naturalWidth is the only honest signal: a broken image still has a layout box. */
    private static void requireImage(WebDriver d, String id, int width, int height, String where) {
        d.waitUntil("the image " + where + " to load", () -> {
            Object w = d.scriptQuiet("const i = document.getElementById(arguments[0]);"
                    + "return i ? i.naturalWidth : 0", id);
            return w instanceof Number && ((Number) w).intValue() > 0;
        }, 120_000);
        Object w = d.script("return document.getElementById(arguments[0]).naturalWidth", id);
        Object h = d.script("return document.getElementById(arguments[0]).naturalHeight", id);
        if (((Number) w).intValue() != width || ((Number) h).intValue() != height)
            throw new AssertionError("The image " + where + " is " + w + "x" + h
                    + ", expected " + width + "x" + height + " - a different image was served");
    }
}
