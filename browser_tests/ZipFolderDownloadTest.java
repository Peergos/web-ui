import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;

/** Downloads a folder as a zip, and checks the zip really holds the folder's files.
 *
 *  This is the other service worker download path: the page streams zip entries into the same
 *  stream the download is reading from, so a stall here looks exactly like the truncation bug in
 *  3cee931b - a zip of plausible size whose central directory is missing or short.
 *
 *  Usage: java -cp ../server/Peergos.jar ZipFolderDownloadTest.java [engine] [url]
 */
public class ZipFolderDownloadTest {

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

        // unique per run: the suite shares one server across tests
        String folder = "tozip-" + System.currentTimeMillis();
        Path local = Files.createTempDirectory("peergos-tozip-");
        Map<String, byte[]> expected = new LinkedHashMap<>();
        expected.put("small.txt", "a small entry\n".getBytes());
        expected.put("big.bin", bytes(6 * 1024 * 1024));   // over the chunk size
        List<Path> locals = new ArrayList<>();
        for (Map.Entry<String, byte[]> e : expected.entrySet()) {
            Path f = local.resolve(e.getKey());
            Files.write(f, e.getValue());
            locals.add(f);
        }

        Path downloads = Files.createTempDirectory("peergos-zip-dl-");
        try {
            Fixtures.uploadInto(jar, url, Server.USERNAME, Server.PASSWORD, folder, locals);
            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD, folder,
                    300_000, expected.keySet().toArray(new String[0]));

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, Server.USERNAME, Server.PASSWORD);
                Page.gotoDrive(d);

                // Walk into the folder and back before zipping. The zip is built from what the
                // app can see, and if its view of the directory is still empty the download
                // succeeds with an empty archive - 22 bytes, just an end of central directory
                // record - which is a pass as far as "a file arrived" goes.
                String root = Page.currentPath(d);
                Page.waitForInDrive(d, folder, 120_000);
                Page.openPath(d, root + folder, folder);
                for (String entry : expected.keySet())
                    Page.waitForInDrive(d, entry, 120_000);
                Page.openPath(d, root, "peergos");
                Page.waitForInDrive(d, folder, 120_000);

                Page.select(d, folder);
                System.out.println("zipping and downloading " + folder);
                d.script("window.__drive.zipAndDownloadFolders();");
                // the drive asks before zipping, and the flow does not continue until it is answered
                Page.confirmYes(d, 120_000);
                System.out.println("  confirmed the download dialog");
                // The counter the app names archives from is the signal that the zip flow got
                // past the dialog at all: it is bumped where the file is named. Toasts alone say
                // nothing, they are empty in a healthy run too.
                WebDriver.sleep(5_000);
                System.out.println("  zip state after confirming: " + zipState(d));

                // the app numbers the file from a counter of its own, so take whatever zip lands
                Downloads.Result zip = Downloads.awaitMatching(downloads, "archive-", ".zip",
                        600_000, 60_000);
                System.out.println("  " + zip);
                if (zip.path == null) {
                    System.out.println("  zip state when none arrived: " + zipState(d));
                    if (Page.errorShown(d))
                        System.out.println("  app reported: " + Page.errorText(d));
                    throw new AssertionError("No zip appeared in " + downloads);
                }
                if (zip.stalled)
                    throw new AssertionError("Zip download stalled at " + zip.size + " bytes");

                check(zip.path, expected);
                System.out.println("  ok   zip holds " + expected.size()
                        + " entries, all bytes match");
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    private static void check(Path zipFile, Map<String, byte[]> expected) throws IOException {
        Map<String, byte[]> found = new LinkedHashMap<>();
        try (ZipFile zip = new ZipFile(zipFile.toFile())) {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry.isDirectory())
                    continue;
                try (InputStream in = zip.getInputStream(entry)) {
                    found.put(name(entry.getName()), in.readAllBytes());
                }
            }
        } catch (ZipException e) {
            throw new AssertionError("Downloaded zip is not readable, which is what a truncated"
                    + " stream looks like: " + e.getMessage());
        }
        for (Map.Entry<String, byte[]> e : expected.entrySet()) {
            byte[] got = found.get(e.getKey());
            if (got == null)
                throw new AssertionError(found.isEmpty() ?
                        "The zip is empty, so the app saw no files in the folder when it zipped it"
                        : "Zip is missing " + e.getKey() + ", holds " + found.keySet());
            if (! Arrays.equals(got, e.getValue()))
                throw new AssertionError("Zip entry " + e.getKey() + " is " + got.length
                        + " bytes, expected " + e.getValue().length);
        }
    }

    private static String name(String entryName) {
        int slash = entryName.lastIndexOf('/');
        return slash < 0 ? entryName : entryName.substring(slash + 1);
    }

    private static byte[] bytes(int n) {
        byte[] b = new byte[n];
        for (int i = 0; i < n; i++)
            b[i] = (byte) ((i * 17 + 3) & 0xff);
        return b;
    }

    /** Whether the app got as far as naming and building an archive. */
    private static String zipState(WebDriver d) {
        return String.valueOf(d.scriptQuiet("return ["
                + "'archivesNamed=' + window.__drive.zipAndDownloadFoldersCount,"
                + "'spinner=' + window.__drive.showSpinner,"
                + "'progress=' + JSON.stringify([...document.querySelectorAll("
                + "   '[class*=progress]')].map(x => x.innerText.replace(/\\s+/g, ' ').trim())"
                + "   .filter(t => t.length > 0 && t.length < 120).slice(0, 3)),"
                + "'toasts=' + JSON.stringify([...document.querySelectorAll('[class*=toast]')]"
                + "   .map(x => x.innerText.replace(/\\s+/g, ' ').trim())"
                + "   .filter(t => t.length > 0 && t.length < 120).slice(0, 3))"
                + "].join(' ')"));
    }
}
