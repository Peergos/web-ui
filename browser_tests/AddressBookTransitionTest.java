import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.user.UserContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Someone who installed Address Book from Custom Apps, before it came with Peergos in the menu.
 *
 *  Their copy is the same app on the same contacts, so the launcher stops showing it beside the
 *  one in the menu, while its files stay, for an older Peergos on another device that still opens
 *  it from there. The menu's Address Book shows the contacts they already had, and installing the
 *  old one again says where it is now rather than adding a copy that wouldn't be shown. An app of
 *  the same name by someone else installs as any app does. Someone whose only app it was is left
 *  with none in the launcher, which still loads.
 *
 *  Usage: java -cp ../server/Peergos.jar AddressBookTransitionTest.java [engine] [peergos url]
 */
public class AddressBookTransitionTest {

    // exactly as published in recommended-apps, which is what was installed
    static final String MANIFEST = "{\n    \"displayName\": \"Address Book\",\n"
            + "    \"description\": \"Manage your contacts and address books, synced with CardDAV\",\n"
            + "    \"version\": \"1.0.0\",\n    \"author\": \"peergos\",\n    \"launchable\": true,\n"
            + "    \"folderAction\": false,\n    \"appIcon\": \"icon.png\",\n    \"permissions\": [\"MANAGE_CONTACTS\"]\n}\n";

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
        String me = "abmove" + (System.currentTimeMillis() % 100000);
        try {
            NoAppsYetTest.signUp(url, me, crypto);
            Fixtures.installHtmlViewerApp(jar, url, me, NoAppsYetTest.PASSWORD);
            // the copy as Custom Apps installed it: the installer records where it came from
            Path dir = Temp.directory("peergos-abmove-");
            Path manifest = dir.resolve("peergos-app.json"), page = dir.resolve("index.html"), icon = dir.resolve("icon.png");
            Files.writeString(manifest, MANIFEST.replace("\"author\": \"peergos\",", "\"author\": \"peergos\",\n    \"source\": \"/peergos/recommended-apps/address-book\","));
            Files.writeString(page, "<!doctype html><html><head><meta charset=\"utf-8\"><title>Address Book</title></head><body>the Custom Apps copy</body></html>");
            Files.write(icon, NoAppsYetTest.icon());
            Fixtures.commands(jar, url, me, NoAppsYetTest.PASSWORD, "cd .apps", "mkdir addressbook", "cd addressbook",
                    "put " + manifest.toAbsolutePath(), "mkdir assets", "cd assets", "put " + page.toAbsolutePath(), "put " + icon.toAbsolutePath());
            // another installed app, which the launcher goes on showing
            Path other = Temp.directory("peergos-abmove-o-").resolve("peergos-app.json");
            Files.writeString(other, "{\"displayName\": \"Sketch\", \"description\": \"draws\", \"version\": \"1.0.0\", \"author\": \"someone\","
                    + " \"source\": \"/someone/sketch\", \"launchable\": true, \"folderAction\": false, \"permissions\": []}");
            Fixtures.commands(jar, url, me, NoAppsYetTest.PASSWORD, "cd .apps", "mkdir sketch", "cd sketch",
                    "put " + other.toAbsolutePath(), "mkdir assets", "cd assets", "put " + page.toAbsolutePath());
            // and the folder it would be installed from again, as published
            Files.writeString(manifest, MANIFEST);
            Fixtures.commands(jar, url, me, NoAppsYetTest.PASSWORD, "mkdir address-book", "cd address-book",
                    "put " + manifest.toAbsolutePath(), "mkdir assets", "cd assets", "put " + page.toAbsolutePath(), "put " + icon.toAbsolutePath());
            // an app of the same name, by someone else
            Files.writeString(manifest, MANIFEST.replace("\"author\": \"peergos\"", "\"author\": \"someone\""));
            Fixtures.commands(jar, url, me, NoAppsYetTest.PASSWORD, "mkdir their-address-book", "cd their-address-book",
                    "put " + manifest.toAbsolutePath(), "mkdir assets", "cd assets", "put " + page.toAbsolutePath(), "put " + icon.toAbsolutePath());
            // someone whose only app was that copy, and a folder of another app to install
            String only = "abonly" + (System.currentTimeMillis() % 100000);
            NoAppsYetTest.signUp(url, only, crypto);
            Files.writeString(manifest, MANIFEST.replace("\"author\": \"peergos\",", "\"author\": \"peergos\",\n    \"source\": \"/peergos/recommended-apps/address-book\","));
            Fixtures.commands(jar, url, only, NoAppsYetTest.PASSWORD, "mkdir .apps", "cd .apps", "mkdir addressbook", "cd addressbook",
                    "put " + manifest.toAbsolutePath(), "mkdir assets", "cd assets", "put " + page.toAbsolutePath(), "put " + icon.toAbsolutePath());
            Fixtures.commands(jar, url, only, NoAppsYetTest.PASSWORD, "mkdir sketch", "cd sketch",
                    "put " + other.toAbsolutePath(), "mkdir assets", "cd assets", "put " + page.toAbsolutePath());
            UserContext api = NewsFeedViewTest.signInApi(url, me, crypto);
            AddressBookTest.store(api, ".apps/contacts/data/default", "carol-1.vcf",
                    "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:carol-1\r\nFN:Carol Current\r\nN:Current;Carol;;;\r\nEND:VCARD\r\n");
            String installed = new String(NoAppsYetTest.read(api, me + "/.apps/addressbook/peergos-app.json"), StandardCharsets.UTF_8);

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-abmove-b-"), headless)) {
                d.setWindowRect(1280, 900);
                NewsFeedViewTest.signIn(d, url, me);
                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                d.waitForScript("the launcher to load the apps", "!window.__launcher.showSpinner", 60_000);
                Object apps = d.script("return window.__launcher.appsList.map(a => a.name).join(',') + ' | tiles: '"
                        + " + [...document.querySelectorAll('.app-grid-item')].map(a => a.getAttribute('aria-label')).join(',')");
                if (String.valueOf(apps).contains("addressbook") || String.valueOf(apps).contains("Address Book")
                        || ! String.valueOf(apps).contains("Sketch"))
                    throw new AssertionError("The launcher should show the other apps, and no longer the Custom Apps copy: " + apps);
                System.out.println("  ok   the launcher no longer shows the Custom Apps copy (" + apps + ")");

                Page.gotoView(d, "Address Book", "saveCard", "__addressBook");
                AddressBookTest.waitInFrame(d, "the contacts already there", "return [...document.querySelectorAll('#contacts .list-row')].some(r => r.textContent.includes('Carol Current')) ? true : null");
                System.out.println("  ok   the menu's Address Book shows the contacts already there");

                if (! new String(NoAppsYetTest.read(api, me + "/.apps/addressbook/peergos-app.json"), StandardCharsets.UTF_8).equals(installed)
                        || api.getByPath(me + "/.apps/addressbook/assets/index.html").join().isEmpty())
                    throw new AssertionError("The Custom Apps copy's files should stay as they were");
                System.out.println("  ok   its files stay, for an older Peergos elsewhere that still opens it");

                // installing it again, from where it was installed before
                Page.gotoDrive(d);
                Page.openPath(d, "/" + me + "/address-book", "address-book");
                installSelectedManifest(d);
                Object said = d.waitUntil("the installer's answer", () -> {
                    Object t = d.scriptQuiet("return [...document.querySelectorAll('.Vue-Toastification__toast')].map(t => t.textContent.trim()).join(' | ')");
                    return String.valueOf(t).contains("Address Book") ? t : null;
                }, 60_000);
                if (! String.valueOf(said).contains("Address Book is part of Peergos now"))
                    throw new AssertionError("Installing it again should say where it is now: " + said);
                WebDriver.sleep(2000);
                if (! new String(NoAppsYetTest.read(api, me + "/.apps/addressbook/peergos-app.json"), StandardCharsets.UTF_8).equals(installed))
                    throw new AssertionError("Installing it again should change nothing");
                System.out.println("  ok   installing it again says it is part of Peergos now, and changes nothing (" + said + ")");

                // one of the same name by someone else is theirs, and opens the installer as any app does
                Page.gotoDrive(d);
                Page.openPath(d, "/" + me + "/their-address-book", "their-address-book");
                installSelectedManifest(d);
                Object theirs = d.waitUntil("the app installer, for theirs", () -> d.scriptQuiet(
                        "return [...document.querySelectorAll('.app-install dd')].map(x => x.textContent.trim()).join(' | ') || null"), 60_000);
                if (! String.valueOf(theirs).contains("Address Book") || ! String.valueOf(theirs).contains("someone"))
                    throw new AssertionError("An Address Book by someone else should open the installer as any app does: " + theirs);
                System.out.println("  ok   an app of the same name by someone else opens the installer as any app does (" + theirs + ")");

                // with that copy given way, someone who had no other app has none to show: the
                // launcher and the app installer still finish loading
                NewsFeedViewTest.signIn(d, url, only);
                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                d.waitForScript("the launcher to load the apps", "!window.__launcher.showSpinner", 60_000);
                Object none = d.script("return window.__launcher.appsList.map(a => a.name).join(',')");
                if (! String.valueOf(none).isEmpty())
                    throw new AssertionError("The launcher should show no apps for someone whose only one was the Custom Apps copy: " + none);
                Page.gotoDrive(d);
                Page.openPath(d, "/" + only + "/sketch", "sketch");
                installSelectedManifest(d);
                d.waitForScript("the app installer", "[...document.querySelectorAll('.app-install dd')].some(x => x.textContent.includes('Sketch'))", 60_000);
                System.out.println("  ok   someone whose only app was that copy gets a launcher with none in it, and the app installer still opens");
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Installs from the manifest in the open folder. The drive can redraw just after a folder
     *  opens and drop a selection made in that moment, so only once the manifest is what is
     *  selected. */
    static void installSelectedManifest(WebDriver d) {
        boolean started = false;
        for (int i = 0; i < 10 && ! started; i++) {
            Page.select(d, "peergos-app.json");
            WebDriver.sleep(800);
            started = Boolean.TRUE.equals(d.script("const s = window.__drive.selectedFiles || [];"
                    + " if (s.length !== 1 || s[0].getName() !== 'peergos-app.json') return false; window.__drive.installApp(); return true;"));
        }
        if (! started)
            throw new IllegalStateException("peergos-app.json never stayed selected");
    }
}
