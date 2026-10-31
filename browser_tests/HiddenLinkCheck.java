import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.LinkProperties;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;
import peergos.shared.util.Futures;

import java.net.URI;
import java.nio.file.*;
import java.util.*;

/**
 * A secret link that hides where its items are, made and opened as a person would.
 *
 * "Hide where these are" is on by default in the link editor, and whoever opens the link sees the
 * item under its own name, with neither the owner's username nor the folders above it anywhere on
 * the page. A writable folder link then makes a folder and uploads a file from the browser, whose
 * keys the compiled javascript seals to the folder, and the owner reads them back in java.
 *
 * Usage: java -cp ../server/Peergos.jar HiddenLinkCheck.java [engine] [peergos url]
 */
public class HiddenLinkCheck {

    static final String PASSWORD = "testpassword";

    public static void main(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        try {
            run(engine, own != null ? own.url() : given);
        } finally {
            if (own != null)
                own.close();
        }
    }

    static void shot(WebDriver d, String name) throws Exception {
        if (d instanceof MarionetteDriver)
            Files.write(Paths.get(System.getProperty("java.io.tmpdir"), name + ".png"), ((MarionetteDriver) d).screenshot());
    }

    static String pageText(WebDriver d) {
        return String.valueOf(d.script("return document.body.innerText"));
    }

    /** A link opens straight into the drive, with no nav to click, so wait for it to show the item first. */
    static void openLink(WebDriver d, String href, String expected) throws Exception {
        d.navigate(href);
        try {
            d.waitUntil("'" + expected + "' through the link",
                    () -> pageText(d).contains(expected) ? Boolean.TRUE : null, 120_000);
        } catch (RuntimeException e) {
            shot(d, "hidden-link-failed");
            System.out.println("  page: " + pageText(d));
            throw e;
        }
        Page.gotoDrive(d);
        Page.waitForInDrive(d, expected, 60_000);
    }

    public static void run(String engine, String url) throws Exception {
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        String s = Long.toString(System.currentTimeMillis() % 100000);
        String owner = "hider" + s;
        Crypto crypto = Builder.initCrypto();
        NetworkAccess network = Builder.buildJavaNetworkAccess(URI.create(url).toURL(), false, Optional.empty(), Optional.empty()).join();
        UserContext.signUp(owner, PASSWORD, "", network.clear(), crypto).join();
        UserContext api = NewsFeedViewTest.signInApi(url, owner, crypto);
        FileWrapper home = api.getUserRoot().join();
        home.mkdir("private", api.network, false, api.mirrorBatId(), crypto).join();
        FileWrapper privateDir = api.getByPath(owner + "/private").join().get();
        privateDir.mkdir("photos", api.network, false, api.mirrorBatId(), crypto).join();
        privateDir = api.getByPath(owner + "/private").join().get();
        privateDir.mkdir("drop", api.network, false, api.mirrorBatId(), crypto).join();
        byte[] photo = "a photo nobody should place".getBytes();
        api.getByPath(owner + "/private/photos").join().get()
                .uploadOrReplaceFile("photo.txt", new AsyncReader.ArrayBacked(photo), photo.length, api.network, crypto, () -> false, x -> {}).join();
        byte[] existing = "already here".getBytes();
        api.getByPath(owner + "/private/drop").join().get()
                .uploadOrReplaceFile("existing.txt", new AsyncReader.ArrayBacked(existing), existing.length, api.network, crypto, () -> false, x -> {}).join();

        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("hlc-"), headless)) {
            d.setWindowRect(1280, 900);
            NewsFeedViewTest.signIn(d, url, owner);
            Page.gotoDrive(d);
            d.waitForScript("drive ready", "window.__drive && window.__drive.sharedWithState && window.__drive.context", 60_000);
            Page.openPath(d, "/" + owner + "/private/photos", "photos");
            Page.waitForInDrive(d, "photo.txt", 60_000);
            d.waitForScript("sharing state", "window.__drive.sharedWithState && window.__drive.sharedWithState.get('photo.txt') != null", 60_000);

            // the link editor, which hides the location by default
            String btn = "document.querySelector(\"[aria-label='Create Secret Link']\")";
            d.waitForScript("share modal", "(function(){ var dr = window.__drive; if (" + btn + ") return true;"
                    + " if (! dr.showShare) { dr.selectedFiles = dr.files.filter(f => f.getName() == 'photo.txt'); dr.showShareWith(); }"
                    + " return false; })()", 120_000);
            d.script("return " + btn + ".click()");
            d.waitForScript("link editor", "document.querySelector('.link-members')", 30_000);
            Object hiding = d.script("""
                const label = Array.from(document.querySelectorAll('.secret-link__options .pg-switch'))
                    .find(l => l.textContent.includes('Hide where these are'));
                if (! label) return 'no switch';
                return label.querySelector('input').checked;
                """);
            if (! Boolean.TRUE.equals(hiding))
                throw new IllegalStateException("hiding should be on by default: " + hiding);
            if (pageText(d).contains("sees your username"))
                throw new IllegalStateException("the editor still says the username is visible");
            shot(d, "hidden-link-editor");
            d.script("document.querySelector('#modal-button-id').click()");
            d.waitForScript("the link", "document.querySelector('#secret-link-url') && document.querySelector('#secret-link-url').value.length > 0", 120_000);
            String href = String.valueOf(d.script("return document.querySelector('#secret-link-url').value"));
            System.out.println("  link: " + href);
            if (href.contains("private") || href.contains(owner))
                throw new IllegalStateException("the link names where it is: " + href);
            shot(d, "hidden-link-created");

            // whoever opens it sees the photo, and nothing about where it is
            Page.logout(d);
            openLink(d, href, "photo.txt");
            Thread.sleep(2000);
            shot(d, "hidden-link-opened");
            String text = pageText(d);
            for (String secret : List.of(owner, "private", "photos"))
                if (text.contains(secret))
                    throw new IllegalStateException("the page shows '" + secret + "': " + text);
            if (! Page.driveListing(d).equals(List.of("photo.txt")))
                throw new IllegalStateException("expected only the photo, got " + Page.driveListing(d));
            System.out.println("  ok   a hidden file link shows only the file, under its own name");

            // a writable hidden folder: make a folder and upload a file from the browser
            String drop = owner + "/private/drop";
            // the browser wrote to the account since, so start from where it is now
            api = NewsFeedViewTest.signInApi(url, owner, crypto);
            LinkProperties writable = api.createSecretLink(List.of(drop), List.of(drop), List.of(drop),
                    Optional.empty(), Optional.empty(), "", false).join();
            String dropHref = url + "/" + writable.toLinkString(api.signer.publicKeyHash);
            openLink(d, dropHref, "existing.txt");
            d.script("""
                window.__made = null;
                const dr = window.__drive;
                dr.context.getByPath('/drop')
                    .thenCompose(dir => dir.ref.mkdir('from-browser', dr.context.network, false, java.util.Optional.empty(), dr.context.crypto))
                    .thenApply(x => { window.__made = 'ok'; return true; })
                    .exceptionally(t => { window.__made = 'error ' + t; return null; });
                """);
            d.waitForScript("the folder made", "window.__made", 120_000);
            if (! "ok".equals(d.script("return window.__made")))
                throw new IllegalStateException("mkdir through the link: " + d.script("return window.__made"));
            d.script("window.__drive.updateFiles && window.__drive.updateFiles();");
            d.script("window.__drive.uploadFiles({target: {files: [new File([new TextEncoder().encode('uploaded through a hidden link')], 'uploaded.txt')]}});");
            Page.waitForInDrive(d, "uploaded.txt", 120_000);
            Thread.sleep(2000);
            shot(d, "hidden-folder-link");
            String folderText = pageText(d);
            for (String secret : List.of(owner, "private"))
                if (folderText.contains(secret))
                    throw new IllegalStateException("the folder page shows '" + secret + "': " + folderText);
            System.out.println("  ok   a writable hidden folder link can make folders and upload");
        }

        // the owner reads what the browser made, through keys the browser sealed to the folder
        UserContext fresh = NewsFeedViewTest.signInApi(url, owner, crypto);
        FileWrapper uploaded = fresh.getByPath(owner + "/private/drop/uploaded.txt").join()
                .orElseThrow(() -> new IllegalStateException("the owner can't see the upload"));
        byte[] read = new byte[(int) uploaded.getSize()];
        uploaded.getInputStream(fresh.network, crypto, x -> {}).join().readIntoArray(read, 0, read.length).join();
        if (! new String(read).equals("uploaded through a hidden link"))
            throw new IllegalStateException("the owner read " + new String(read));
        if (! uploaded.isPending())
            throw new IllegalStateException("an upload through a hidden link should be pending");
        if (fresh.getByPath(owner + "/private/drop/from-browser").join().isEmpty())
            throw new IllegalStateException("the owner can't see the folder made through the link");
        System.out.println("  ok   the owner reads what the browser made");
        System.out.println("PASS");
    }
}
