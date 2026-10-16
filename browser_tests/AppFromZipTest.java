import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.user.UserContext;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** An app installed straight from a zip in the drive: browse into the archive, open the
 *  manifest's menu and install. Its assets and data are read out of the archive and written to
 *  .apps, byte for byte, both for an app in a folder of the zip and for one at its root.
 *
 *  Usage: java -cp ../server/Peergos.jar AppFromZipTest.java [engine] [peergos url]
 */
public class AppFromZipTest {

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
        String user = "zara" + Long.toString(System.currentTimeMillis() % 100000);
        try {
            NoAppsYetTest.signUp(url, user, crypto);
            byte[] index = "<!doctype html><html><body><p>zip notes</p></body></html>\n".getBytes(StandardCharsets.UTF_8);
            byte[] icon = NoAppsYetTest.icon();
            byte[] data = "a note the app starts with\n".getBytes(StandardCharsets.UTF_8);
            Map<String, byte[]> nested = new LinkedHashMap<>();
            nested.put("zipnotes/peergos-app.json", NoAppsYetTest.manifest("Zip Notes", "zipnotes", "STORE_APP_DATA", "  \"appIcon\": \"icon.png\",\n"));
            nested.put("zipnotes/assets/index.html", index);
            nested.put("zipnotes/assets/icon.png", icon);
            nested.put("zipnotes/data/notes/hello.txt", data);
            byte[] rootIndex = "<!doctype html><html><body><p>root app</p></body></html>\n".getBytes(StandardCharsets.UTF_8);
            Map<String, byte[]> atRoot = new LinkedHashMap<>();
            atRoot.put("peergos-app.json", NoAppsYetTest.manifest("Root App", "rootapp", "STORE_APP_DATA", ""));
            atRoot.put("assets/index.html", rootIndex);
            Path dir = Temp.directory("peergos-appzip-");
            Path nestedZip = zip(dir.resolve("apps.zip"), nested);
            Path rootZip = zip(dir.resolve("rootapp.zip"), atRoot);
            Fixtures.commands(jar, url, user, NoAppsYetTest.PASSWORD, "mkdir downloads", "cd downloads",
                    "put " + nestedZip.toAbsolutePath(), "put " + rootZip.toAbsolutePath());
            UserContext api = NewsFeedViewTest.signInApi(url, user, crypto);
            System.out.println("signed up " + user + " with two app zips in downloads");

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-appzip-"), headless)) {
                d.setWindowRect(1280, 900);
                NewsFeedViewTest.signIn(d, url, user);
                Page.gotoDrive(d);

                installFromArchive(d, "/" + user + "/downloads/apps.zip/zipnotes", "zipnotes", "Zip Notes");
                expectSame(api, user + "/.apps/zipnotes/assets/index.html", index);
                expectSame(api, user + "/.apps/zipnotes/assets/icon.png", icon);
                expectSame(api, user + "/.apps/zipnotes/data/notes/hello.txt", data);
                String installed = new String(NoAppsYetTest.read(api, user + "/.apps/zipnotes/peergos-app.json"), StandardCharsets.UTF_8);
                if (! installed.contains("\"source\": \"/" + user + "/downloads/apps.zip/zipnotes\""))
                    throw new AssertionError("The installed manifest does not name the archive it came from: " + installed);
                System.out.println("  ok   an app in a folder of a zip installs, assets, icon and data byte for byte");

                installFromArchive(d, "/" + user + "/downloads/rootapp.zip", "", "Root App");
                expectSame(api, user + "/.apps/rootapp/assets/index.html", rootIndex);
                System.out.println("  ok   an app at the root of a zip installs");

                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                d.waitForScript("both apps in the launcher",
                        "document.body.innerText.includes('Zip Notes') && document.body.innerText.includes('Root App')", 60_000);
                System.out.println("  ok   the launcher lists them");
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static Path zip(Path file, Map<String, byte[]> entries) throws Exception {
        try (OutputStream out = Files.newOutputStream(file); ZipOutputStream zip = new ZipOutputStream(out)) {
            for (Map.Entry<String, byte[]> e : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(e.getKey()));
                zip.write(e.getValue());
                zip.closeEntry();
            }
        }
        return file;
    }

    static void expectSame(UserContext api, String path, byte[] expected) throws Exception {
        if (! Arrays.equals(NoAppsYetTest.read(api, path), expected))
            throw new AssertionError(path + " differs from the file in the zip");
    }

    /** Browses into the archive to the app's folder and installs from the manifest's menu. */
    static void installFromArchive(WebDriver d, String path, String entry, String displayName) {
        d.script("window.__drive.changePath(arguments[0]);", path);
        d.waitForScript("the drive to list " + path,
                "!!window.__drive.archive && window.__drive.archive.entry === '" + entry + "'"
                        + " && !window.__drive.showSpinner"
                        + " && window.__drive.files.some(f => f.getName() === 'peergos-app.json')", 120_000);
        d.waitUntil("Install in the manifest's menu", () -> {
            d.script("window.__drive.closeMenu();"
                    + " const card = [...document.querySelectorAll('.grid-card, .drive-table tbody tr')]"
                    + ".find(c => c.textContent.includes('peergos-app.json'));"
                    + " card.querySelector('[aria-label=menu]').click(); return 1;");
            WebDriver.sleep(2000);
            return d.scriptQuiet("const e = document.querySelector('#app-install');"
                    + " return !!e && e.getClientRects().length > 0 ? true : null;");
        }, 40_000);
        if (Boolean.TRUE.equals(d.scriptQuiet("const e = document.querySelector('#app-run');"
                + " return !!e && e.getClientRects().length > 0;")))
            throw new AssertionError("Run is offered for an app inside an archive, which it cannot run from");
        d.script("document.querySelector('#app-install').click(); return 1;");
        d.waitForScript("the installation dialog to show " + displayName,
                "(() => { const x = " + NoAppsYetTest.DIALOG + "; return !!x && x.textContent.includes('" + displayName + "'); })()", 60_000);
        d.script("[...(" + NoAppsYetTest.DIALOG + ").querySelectorAll('button')].find(b => b.textContent.trim() === 'Install').click(); return 1;");
        d.waitForScript("the installation of " + displayName + " to finish", "!(" + NoAppsYetTest.DIALOG + ")", 120_000);
    }
}
