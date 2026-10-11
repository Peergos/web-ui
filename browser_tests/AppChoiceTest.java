import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Double clicking a file two installed apps both open asks which to use, rather than saying
 *  there is no app for it. Without "always use this app" it asks again next time; with it the
 *  choice is kept in local storage and the file opens straight in that app.
 *
 *  Usage: java -cp ../server/Peergos.jar AppChoiceTest.java [engine] [peergos url]
 */
public class AppChoiceTest {

    static final String PASSWORD = "testpassword";
    static final String DIALOG = "[...document.querySelectorAll('.pg-dialog')]"
            + ".find(x => x.textContent.includes('Open with'))";

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
        Crypto crypto = Builder.initCrypto();
        String s = Long.toString(System.currentTimeMillis() % 100000);
        try {
            String me = "petra" + s;
            String file = "letter.twoapp";
            NoAppsYetTest.signUp(url, me, crypto);
            Fixtures.installHtmlViewerApp(jar, url, me, PASSWORD);
            installApp(jar, url, me, "alphaview", "Alpha Viewer");
            installApp(jar, url, me, "betaview", "Beta Viewer");
            UserContext api = NewsFeedViewTest.signInApi(url, me, crypto);
            byte[] data = "two apps open this\n".getBytes(StandardCharsets.UTF_8);
            FileWrapper root = api.getUserRoot().join();
            root.uploadOrReplaceFile(file, new AsyncReader.ArrayBacked(data), 0, data.length, api.network, crypto, x -> {}).join();

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-appchoice-"), headless)) {
                d.setWindowRect(1280, 900);
                NewsFeedViewTest.signIn(d, url, me);
                Page.gotoDrive(d);
                Page.waitForInDrive(d, file, 60_000);

                doubleClick(d, file);
                awaitDialog(d);
                String options = String.valueOf(d.script("return [...(" + DIALOG + ").querySelectorAll('.choice-block__text')]"
                        + ".map(x => x.textContent.trim()).join(' | ')"));
                if (! (options.contains("Alpha Viewer") && options.contains("Beta Viewer") && options.contains("Open in Text Editor")))
                    throw new AssertionError("The choice is missing an app: " + options);
                if (Boolean.TRUE.equals(d.script("return document.body.innerText.includes('There is no app installed')")))
                    throw new AssertionError("Still told there is no app installed");
                System.out.println("  ok   double click asks which app: " + options);
                screenshot(d, "appchoice-dialog.png");

                pick(d, "Alpha Viewer", false);
                awaitApp(d, "alphaview");
                if (! "null".equals(String.valueOf(d.script("return localStorage.getItem('defaultApps')"))))
                    throw new AssertionError("A choice not to be remembered was stored");
                System.out.println("  ok   it opens in the app picked, and remembers nothing");

                closeApp(d);
                doubleClick(d, file);
                awaitDialog(d);
                System.out.println("  ok   without always, it asks again");

                pick(d, "Beta Viewer", true);
                awaitApp(d, "betaview");
                String stored = String.valueOf(d.script("return JSON.parse(localStorage.getItem('defaultApps') || '{}')['.twoapp']"));
                if (! stored.equals("betaview"))
                    throw new AssertionError("The default was not stored: " + stored);
                System.out.println("  ok   with always, it opens and stores .twoapp -> " + stored);

                closeApp(d);
                doubleClick(d, file);
                awaitApp(d, "betaview");
                if (Boolean.TRUE.equals(d.script("return !!(" + DIALOG + ")")))
                    throw new AssertionError("Asked again despite the stored default");
                System.out.println("  ok   next time it opens straight in the default");
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Two clicks on the file's card, as a person double clicking does. */
    static void doubleClick(WebDriver d, String name) {
        Object clicked = d.script("const card = [...document.querySelectorAll('.grid-card, .drive-table tbody tr')]"
                + ".find(c => c.textContent.includes(arguments[0]));"
                + " if (! card) return false; card.click(); card.click(); return true;", name);
        if (! Boolean.TRUE.equals(clicked))
            throw new IllegalStateException("No card for " + name + " in " + Page.driveListing(d));
    }

    static void awaitDialog(WebDriver d) {
        d.waitForScript("the Open with dialog", "!!(" + DIALOG + ")", 30_000);
    }

    static void pick(WebDriver d, String app, boolean always) {
        d.script("const dlg = " + DIALOG + ";"
                + " [...dlg.querySelectorAll('.choice-block')].find(b => b.textContent.includes(arguments[0])).click();"
                + " if (arguments[1]) dlg.querySelector('.choice-remember input').click();"
                + " [...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'Confirm').click(); return 1;",
                app, always);
    }

    static void awaitApp(WebDriver d, String app) {
        d.waitForScript(app + " to open", "window.__drive.showAppSandbox && window.__drive.sandboxAppName === '" + app + "'"
                + " && !!document.querySelector('iframe#sandboxId')", 60_000);
    }

    static void closeApp(WebDriver d) {
        d.script("document.querySelector('.pg-viewer__mask .pg-dialog__close').click(); return 1;");
        d.waitForScript("the app to close", "!window.__drive.showAppSandbox && !document.querySelector('iframe#sandboxId')", 30_000);
        WebDriver.sleep(500);
    }

    static void screenshot(WebDriver d, String name) throws Exception {
        if (d instanceof MarionetteDriver m) {
            Path out = Paths.get(System.getProperty("java.io.tmpdir"), name);
            Files.write(out, m.screenshot());
            System.out.println("  screenshot " + out);
        }
    }

    static void installApp(Path jar, String url, String user, String name, String displayName) throws Exception {
        Path dir = Temp.directory("peergos-appchoice-app-");
        Path manifest = dir.resolve("peergos-app.json");
        Files.writeString(manifest, String.join("\n",
                "{",
                "  \"displayName\": \"" + displayName + "\",",
                "  \"name\": \"" + name + "\",",
                "  \"description\": \"opens .twoapp files\",",
                "  \"version\": \"1.0.0\",",
                "  \"author\": \"peergos\",",
                "  \"launchable\": true,",
                "  \"folderAction\": false,",
                "  \"fileExtensions\": [\"twoapp\"],",
                "  \"permissions\": []",
                "}", ""));
        Path index = dir.resolve("index.html");
        Files.writeString(index, "<!doctype html><html><body><p>" + displayName + "</p></body></html>\n");
        Fixtures.commands(jar, url, user, PASSWORD,
                "cd .apps", "mkdir " + name, "cd " + name, "put " + manifest.toAbsolutePath(),
                "mkdir assets", "cd assets", "put " + index.toAbsolutePath());
    }
}
