import java.nio.file.*;
import java.util.*;

/** Renders a markdown file in the markup viewer and follows its links.
 *
 *  The viewer runs in an iframe on the markup-viewer subdomain and cannot read the drive itself:
 *  the app intercepts link clicks, posts navigateTo to the parent with the resolved pathname, and
 *  the parent finds the file, reads it, and posts the text back. So a broken link does not 404 -
 *  the viewer simply keeps showing the previous document, which looks like nothing happened.
 *  Each hop therefore asserts on the newly rendered text.
 *
 *  Both link shapes are covered: a sibling in the same directory, and one in a subdirectory,
 *  because they take different routes through calculatePath.
 *
 *  Usage: java -cp ../server/Peergos.jar MarkdownLinksTest.java [engine] [url]
 */
public class MarkdownLinksTest {

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

        String folder = "mdtest-" + System.currentTimeMillis();
        Path dir = Files.createTempDirectory("peergos-md-");
        Path index = dir.resolve("index.md");
        Path sibling = dir.resolve("sibling.md");
        Path child = dir.resolve("child.md");
        Files.writeString(index, String.join("\n",
                "# Index page",
                "",
                "[go to the sibling](sibling.md)",
                ""));
        // the second hop starts from here, so the subdirectory link lives on this page: after
        // following a link the viewer is showing the target, and index.md's links are gone
        Files.writeString(sibling, String.join("\n",
                "# Sibling page",
                "",
                "reached the sibling",
                "",
                "[go to the child](sub/child.md)",
                ""));
        Files.writeString(child, "# Child page\n\nreached the child in a subdirectory\n");

        Path downloads = Files.createTempDirectory("peergos-md-dl-");
        try {
            Fixtures.commands(jar, url, Server.USERNAME, Server.PASSWORD,
                    "mkdir " + folder,
                    "cd " + folder,
                    "put " + index.toAbsolutePath(),
                    "put " + sibling.toAbsolutePath(),
                    "mkdir sub",
                    "cd sub",
                    "put " + child.toAbsolutePath());
            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD, folder,
                    120_000, "index.md", "sibling.md", "sub");
            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD, folder + "/sub",
                    120_000, "child.md");

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, Server.USERNAME, Server.PASSWORD);
                Page.gotoDrive(d);

                // changePath takes a whole path, and the store's path starts with the username,
                // so a bare folder name navigates to the wrong place and silently spins
                d.script("window.__drive.changePath(window.__drive.getPath + arguments[0]);", folder);
                d.waitForScript("the fixture folder to open",
                        "window.__drive.currentDir && window.__drive.currentDir.getName() === "
                                + "'" + folder + "'", 120_000);
                Page.waitForInDrive(d, "index.md", 60_000);

                // openFileOrDir, not openInApp: the markup viewer reads its filename from the
                // url in created() via getPropsFromUrl, so setting showMarkupViewer without
                // updating history leaves it mounted with nothing to load.
                System.out.println("opening index.md in the markup viewer");
                d.script("window.__drive.openFileOrDir('markdown', window.__drive.getPath,"
                        + " {filename: 'index.md'}, true);");
                requireRendered(d, "Index page", 120_000);
                System.out.println("  index.md rendered");

                follow(d, "go to the sibling", "Sibling page", "reached the sibling");
                System.out.println("  followed the same directory link, sibling.md rendered");

                follow(d, "go to the child", "Child page", "reached the child in a subdirectory");
                System.out.println("  followed the subdirectory link, sub/child.md rendered");
                // and the subdirectory page resolved relative to its own directory, not the root

                System.out.println("  ok   both links resolved and rendered");
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Clicks a link inside the viewer frame and waits for the next document to render. */
    private static void follow(WebDriver d, String linkText, String heading, String body) {
        frame(d);
        d.switchToFrame("#md-editor");
        try {
            Object clicked = d.script("const wanted = arguments[0];" +
                    "const a = [...document.querySelectorAll('a')]" +
                    "  .find(x => x.textContent.trim() === wanted);" +
                    "if (a) { a.click(); return true; } return false;", linkText);
            if (! Boolean.TRUE.equals(clicked))
                throw new AssertionError("No link '" + linkText + "' in the rendered markdown");
        } finally {
            d.switchToTop();
        }
        // the parent tears the iframe down and rebuilds it for each document
        requireRendered(d, heading, 120_000);
        frame(d);
        d.switchToFrame("#md-editor");
        try {
            String text = String.valueOf(d.script("return document.body.innerText"));
            if (! text.contains(body))
                throw new AssertionError("Expected '" + body + "' after following '" + linkText
                        + "', got: " + text.replace("\n", " | "));
        } finally {
            d.switchToTop();
        }
    }

    private static Object frame(WebDriver d) {
        return d.waitUntil("the markup viewer frame", () -> d.find("#md-editor"), 60_000);
    }

    /** Waits until the frame shows the heading, since the viewer keeps the old document up
     *  while the next one is being fetched. */
    private static void requireRendered(WebDriver d, String heading, long timeoutMillis) {
        d.waitUntil("'" + heading + "' to render", () -> {
            Object f = d.find("#md-editor");
            if (f == null)
                return false;
            d.switchToFrame("#md-editor");
            try {
                Object text = d.scriptQuiet("return document.body.innerText");
                return text != null && String.valueOf(text).contains(heading);
            } finally {
                d.switchToTop();
            }
        }, timeoutMillis);
    }
}
