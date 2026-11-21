import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** Moves a file that has a secret link - Cut, then Paste on a folder, by real clicks - which asks
 *  whether to keep the link working.
 *
 *  The move asked with its spinner still up, and the spinner is drawn over dialogs: nothing could
 *  be clicked, and the move, which holds its writer's other writes until it has an answer, never
 *  finished. Answered with Yes, closed with its X - which keeps the link - or left open by going
 *  to another view, the move has to finish.
 *
 *  Usage: java -cp ../server/Peergos.jar MoveSharedFileTest.java [engine] [url]
 */
public class MoveSharedFileTest {

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
        Fixtures.Account me = Fixtures.account(url);
        Path local = Temp.directory("peergos-move-shared-");
        List<String> commands = new ArrayList<>(List.of("mkdir dest"));
        for (String name : List.of("yes.txt", "closed.txt", "left.txt")) {
            Path f = local.resolve(name);
            Files.writeString(f, name + " has a secret link\n");
            commands.add("put " + f.toAbsolutePath());
        }
        try {
            Fixtures.commands(jar, url, me.name(), me.password(), commands.toArray(new String[0]));
            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false,
                    Optional.empty(), Optional.empty()).join();
            UserContext owner = UserContext.signIn(me.name(), me.password(), mfa -> null, network, crypto).join();
            for (String name : List.of("yes.txt", "closed.txt", "left.txt"))
                owner.createSecretLink("/" + me.name() + "/" + name, false, Optional.empty(), Optional.empty(), "", false).join();

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-move-shared-dl-"), headless)) {
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, me.name(), me.password());
                Page.gotoDrive(d);
                for (String name : List.of("yes.txt", "closed.txt", "left.txt", "dest"))
                    Page.waitForInDrive(d, name, 120_000);

                moveIntoDest(d, "yes.txt");
                click(d, ".pg-dialog .pg-btn--primary", "Yes");
                awaitMoved(d, jar, url, me, "yes.txt");
                System.out.println("  ok   Yes can be clicked, and the move finishes");

                moveIntoDest(d, "closed.txt");
                click(d, ".pg-dialog .pg-dialog__close", "the close button");
                awaitMoved(d, jar, url, me, "closed.txt");
                UserContext fresh = UserContext.signIn(me.name(), me.password(), mfa -> null, network, crypto).join();
                // the path a link is recorded under has the platform's separator, a backslash on a Windows JVM
                if (fresh.getAllSecretLinks().join().stream().noneMatch(l -> l.recordedUnder.replace('\\', '/').endsWith("dest/closed.txt")))
                    throw new AssertionError("Closing the question dropped the moved file's secret link");
                System.out.println("  ok   closing the question lets the move finish, keeping the link");

                // the drive left, with the question still open, as Back does
                moveIntoDest(d, "left.txt");
                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                Fixtures.awaitListing(jar, url, me.name(), me.password(), "dest", 60_000, "left.txt");
                System.out.println("  ok   leaving the drive with the question open lets the move finish");
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Cut from the file's menu and Paste from the folder's, by real clicks, up to the question. */
    private static void moveIntoDest(WebDriver d, String name) {
        openMenu(d, name);
        d.waitForScript("Cut in the menu", "!!document.querySelector('#cut-file')", 10_000);
        click(d, "#cut-file", "Cut");
        openMenu(d, "dest");
        d.waitForScript("Paste in the menu", "!!document.querySelector('#paste-file')", 10_000);
        click(d, "#paste-file", "Paste");
        d.waitForScript("the keep-access question", "window.__drive.showConfirm", 60_000);
    }

    private static void openMenu(WebDriver d, String name) {
        Object found = d.script("document.querySelectorAll('[data-pg-test]').forEach(e => e.removeAttribute('data-pg-test'));"
                + "const card = [...document.querySelectorAll('.grid-card')].find(c =>"
                + "  c.querySelector('.card__name').textContent.trim() === arguments[0]);"
                + "if (! card) return 'no tile for ' + arguments[0];"
                + "card.setAttribute('data-pg-test', 'menu'); return true;", name);
        if (! Boolean.TRUE.equals(found))
            throw new IllegalStateException(String.valueOf(found));
        click(d, "[data-pg-test=menu] .card__menu", "the menu of " + name);
    }

    /** A real click, which the browser refuses when something else is on top of the element. */
    private static void click(WebDriver d, String css, String what) {
        Object element = d.find(css);
        if (element == null)
            throw new IllegalStateException("Nothing to click for " + what + " (" + css + ")");
        try {
            d.click(element);
        } catch (IllegalStateException e) {
            if (! String.valueOf(e.getMessage()).contains("click intercepted"))
                throw e;
            String onTop = String.valueOf(d.scriptQuiet("const r = document.querySelector(arguments[0])"
                    + ".getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2,"
                    + " r.top + r.height / 2); return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '');", css));
            throw new AssertionError("A person cannot click " + what + ": " + onTop + " is on top of it; "
                    + state(d));
        }
    }

    /** The file is in the folder, and the drive is no longer busy. */
    private static void awaitMoved(WebDriver d, Path jar, String url, Fixtures.Account me, String name) throws Exception {
        Fixtures.awaitListing(jar, url, me.name(), me.password(), "dest", 60_000, name);
        long end = System.currentTimeMillis() + 60_000;
        while (System.currentTimeMillis() < end) {
            if (Boolean.TRUE.equals(d.script("return !window.__drive.showSpinner && !window.__drive.showConfirm;")))
                return;
            WebDriver.sleep(500);
        }
        throw new AssertionError(name + " moved but the drive is still busy a minute later; " + state(d));
    }

    private static String state(WebDriver d) {
        return String.valueOf(d.scriptQuiet("const vm = window.__drive;"
                + "return 'spinner=' + vm.showSpinner + ' question=' + vm.showConfirm;"));
    }
}
