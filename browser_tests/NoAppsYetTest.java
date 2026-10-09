import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.FileWrapper;
import peergos.shared.util.Serialize;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Signing in with no apps installed yet: with no .apps folder at all, as on the first sign-in
 *  here of an account made outside the web ui, or with an empty one. The apps have to load all
 *  the same: the launcher stops waiting, the default app is installed and registered as read
 *  from its manifest, and apps install from the drive, a single-instance template app among them.
 *
 *  Usage: java -cp ../server/Peergos.jar NoAppsYetTest.java [engine] [peergos url]
 */
public class NoAppsYetTest {

    static final String PASSWORD = "testpassword";
    /** The installation dialog in whichever design it has, found by its title. */
    static final String DIALOG = "[...document.querySelectorAll('.app-install-container, .pg-dialog')]"
            + ".find(x => x.textContent.includes('App Installation'))";

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
            // no .apps: the launcher comes up and an app installs from the drive
            String first = "nadia" + s;
            signUp(url, first, crypto);
            byte[] index = "<!doctype html><html><body><p>sticky notes</p></body></html>\n".getBytes(StandardCharsets.UTF_8);
            putApp(jar, url, first, "stickynotes", manifest("Sticky Notes", "stickynotes", "STORE_APP_DATA", ""), Map.of("index.html", index));
            UserContext api = NewsFeedViewTest.signInApi(url, first, crypto);
            if (api.getByPath(first + "/.apps").join().isPresent())
                throw new IllegalStateException("The account already has .apps, so this tests nothing");
            System.out.println("signed up " + first + " over the api, with no .apps");
            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-noapps-"), headless)) {
                signInAndCheckApps(d, url, first, api);
                if (api.getByPath(first + "/.apps/launcher").join().isEmpty())
                    throw new AssertionError("The launcher's folder is missing beside the default app");
                installFromDrive(d, first, "stickynotes", "Sticky Notes");
                if (! Arrays.equals(read(api, first + "/.apps/stickynotes/assets/index.html"), index))
                    throw new AssertionError("The installed index.html differs from the one in the drive");
                // the installer writes the manifest back with its defaults filled in and where it came from
                String installed = new String(read(api, first + "/.apps/stickynotes/peergos-app.json"), StandardCharsets.UTF_8);
                if (! installed.contains("\"source\": \"/" + first + "/stickynotes\""))
                    throw new AssertionError("The installed manifest is not the one from the drive: " + installed);
                System.out.println("  ok   the app is installed from the drive");
                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                d.waitForScript("the app in the launcher", "document.body.innerText.includes('Sticky Notes')", 60_000);
                System.out.println("  ok   the launcher lists it");
            }

            // an empty .apps: a single-instance template app looks at every installed app's
            // template before it installs, the default app's among them
            String second = "omar" + s;
            signUp(url, second, crypto);
            Fixtures.commands(jar, url, second, PASSWORD, "mkdir .apps");
            putApp(jar, url, second, "chatboard",
                    manifest("Chat Board", "chatboard", "EXCHANGE_MESSAGES_WITH_FRIENDS", "  \"template\": \"messaging-instance\",\n  \"appIcon\": \"icon.png\",\n"),
                    Map.of("index.html", "<!doctype html><html><body><p>chat board</p></body></html>\n".getBytes(StandardCharsets.UTF_8),
                            "icon.png", icon()));
            UserContext api2 = NewsFeedViewTest.signInApi(url, second, crypto);
            if (! appsIn(api2, second).isEmpty())
                throw new IllegalStateException("The account's .apps is not empty, so this tests nothing");
            System.out.println("signed up " + second + " over the api, with an empty .apps");
            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-noapps-"), headless)) {
                signInAndCheckApps(d, url, second, api2);
                installFromDrive(d, second, "chatboard", "Chat Board");
                String instance = d.waitUntil("an instance of the template app in .apps", () -> {
                    Optional<String> found = appsIn(api2, second).stream().filter(n -> n.startsWith("chatboard!")).findFirst();
                    if (found.isEmpty())
                        WebDriver.sleep(1000);
                    return found.orElse(null);
                }, 60_000);
                String installed = new String(read(api2, second + "/.apps/" + instance + "/peergos-app.json"), StandardCharsets.UTF_8);
                if (! installed.contains("\"template\": \"messaging-instance\"") || ! installed.matches("(?s).*\"chatId\": \"[^\"]+\".*"))
                    throw new AssertionError("The template app was installed without its chat: " + installed);
                System.out.println("  ok   the template app is installed, with its chat");
                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                d.waitForScript("the template app in the launcher", "document.body.innerText.includes('Chat Board')", 60_000);
                System.out.println("  ok   the launcher lists it");
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** An account made over the api, which makes no .apps. The session to read it back with is
     *  opened once the command line has written to it, so it starts from what is there. */
    static void signUp(String url, String user, Crypto crypto) throws Exception {
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        UserContext.signUp(user, PASSWORD, "", network.clear(), crypto).join();
    }

    /** Signs in through the browser and checks the apps load, with the default app installed and
     *  registered as read from its manifest, defaults and all. */
    static void signInAndCheckApps(WebDriver d, String url, String user, UserContext api) throws Exception {
        d.setWindowRect(1280, 900);
        NewsFeedViewTest.signIn(d, url, user);
        Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
        d.waitForScript("the launcher to finish loading the apps", "!window.__launcher.showSpinner", 60_000);
        System.out.println("  ok   the launcher loads the apps");
        String viewer = new String(read(api, user + "/.apps/htmlviewer/peergos-app.json"), StandardCharsets.UTF_8);
        if (! viewer.contains("\"name\": \"htmlviewer\""))
            throw new AssertionError("The default app was not installed: " + viewer);
        Object registered = d.script("return " + Page.VUE + ".root().$store.state.sandboxedApps.appsInstalled"
                + ".map(a => [a.name, typeof a.template, Array.isArray(a.newFileExtensions), typeof a.appIcon].join(' ')).join(', ')");
        if (! "htmlviewer string true string".equals(registered))
            throw new AssertionError("The default app is not registered with every field: " + registered);
        System.out.println("  ok   the default app is installed and registered with every field");
    }

    static void installFromDrive(WebDriver d, String user, String folder, String displayName) {
        Page.gotoDrive(d);
        Page.openPath(d, "/" + user + "/" + folder, folder);
        // a listing refresh while the menu is open clears its file, so open it again if so
        d.waitUntil("Install in the file's menu", () -> {
            d.script("window.__drive.closeMenu();"
                    + " const card = [...document.querySelectorAll('.grid-card, .drive-table tbody tr')]"
                    + ".find(c => c.textContent.includes('peergos-app.json'));"
                    + " card.querySelector('[aria-label=menu]').click(); return 1;");
            WebDriver.sleep(2000);
            return d.scriptQuiet("const e = document.querySelector('#app-install');"
                    + " return !!e && e.getClientRects().length > 0 ? true : null;");
        }, 40_000);
        d.script("document.querySelector('#app-install').click(); return 1;");
        d.waitForScript("the installation dialog to show " + displayName,
                "(() => { const x = " + DIALOG + "; return !!x && x.textContent.includes('" + displayName + "'); })()", 60_000);
        System.out.println("  ok   the installation dialog shows " + displayName);
        d.script("[...(" + DIALOG + ").querySelectorAll('button')].find(b => b.textContent.trim() === 'Install').click(); return 1;");
        d.waitForScript("the installation of " + displayName + " to finish", "!(" + DIALOG + ")", 120_000);
    }

    static List<String> appsIn(UserContext api, String user) {
        return api.getByPath(user + "/.apps").join().get().getChildren(api.crypto.hasher, api.network).join()
                .stream().map(FileWrapper::getName).filter(n -> ! n.equals("launcher")).sorted().toList();
    }

    /** The file at a path, read back over the api once it is there. */
    static byte[] read(UserContext api, String path) throws Exception {
        long until = System.currentTimeMillis() + 60_000;
        while (true) {
            Optional<FileWrapper> file = api.getByPath(path).join();
            if (file.isPresent())
                return Serialize.readFully(file.get().getInputStream(api.network, api.crypto, x -> {}).join(),
                        file.get().getSize()).join();
            if (System.currentTimeMillis() > until)
                throw new AssertionError("No " + path);
            WebDriver.sleep(1000);
        }
    }

    static byte[] manifest(String displayName, String name, String permission, String extra) {
        return ("{\n"
                + "  \"displayName\": \"" + displayName + "\",\n"
                + "  \"name\": \"" + name + "\",\n"
                + "  \"description\": \"an app to install\",\n"
                + "  \"version\": \"1.0.0\",\n"
                + "  \"author\": \"peergos\",\n"
                + "  \"launchable\": true,\n"
                + "  \"folderAction\": false,\n"
                + extra
                + "  \"permissions\": [\"" + permission + "\"]\n"
                + "}\n").getBytes(StandardCharsets.UTF_8);
    }

    /** A template app has to have an icon, and it has to be an image. */
    static byte[] icon() throws Exception {
        BufferedImage img = new BufferedImage(64, 64, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0x15, 0x6b, 0x57));
        g.fillRect(0, 0, 64, 64);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    /** The app as a folder in the drive, as a user would have it before installing. */
    static void putApp(Path jar, String url, String user, String folder, byte[] manifest, Map<String, byte[]> assets) throws Exception {
        Path dir = Temp.directory("peergos-noapps-app-");
        Files.write(dir.resolve("peergos-app.json"), manifest);
        List<String> commands = new ArrayList<>(List.of("mkdir " + folder, "cd " + folder,
                "put " + dir.resolve("peergos-app.json").toAbsolutePath(), "mkdir assets", "cd assets"));
        for (Map.Entry<String, byte[]> asset : assets.entrySet()) {
            Files.write(dir.resolve(asset.getKey()), asset.getValue());
            commands.add("put " + dir.resolve(asset.getKey()).toAbsolutePath());
        }
        Fixtures.commands(jar, url, user, PASSWORD, commands.toArray(String[]::new));
    }
}
