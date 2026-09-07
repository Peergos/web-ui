import java.io.*;
import java.nio.file.*;
import java.util.*;

/** Uploads a folder through the drive's directory picker.
 *
 *  The directory input carries webkitDirectory, so the browser hands the page a flat file list
 *  whose entries carry a relative path, and the app rebuilds the tree from that. The test checks
 *  the tree really was rebuilt, nested folder included, rather than everything landing flat.
 *
 *  Only chromedriver drives the real picker. Marionette rejects a directory outright with "File
 *  not found", and WebKitWebDriver accepts the path but hands the page the directory as a single
 *  file, so the app makes one entry out of it rather than a tree - accepted, and wrong. There is
 *  no webdriver command for picking a folder.
 *
 *  So elsewhere the test hands the app the same flat list the browser would have produced, with
 *  webkitRelativePath set, which is exactly what extractDirectory reads. That covers the app's
 *  tree rebuilding on every engine, and the real picker on the one that can drive it.
 *
 *  Usage: java -cp ../server/Peergos.jar UploadFolderTest.java [engine] [url]
 */
public class UploadFolderTest {

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

        String folder = "folder-" + System.currentTimeMillis();
        Path local = Files.createTempDirectory("peergos-folder-").resolve(folder);
        Files.createDirectories(local.resolve("nested"));
        Files.write(local.resolve("one.txt"), "first file\n".getBytes());
        Files.write(local.resolve("two.bin"), pattern(3 * 1024 * 1024));
        Files.write(local.resolve("nested").resolve("three.txt"), "in a subfolder\n".getBytes());

        Path downloads = Files.createTempDirectory("peergos-folder-dl-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);

            Object input = d.find("#uploadDirectoriesInput");
            if (input == null)
                throw new AssertionError("No directory input in the drive view");
            System.out.println("uploading folder " + folder + " (3 files, one nested)");
            boolean pickerWorks = Browsers.engine(engine) == Browsers.Engine.CHROMIUM;
            if (pickerWorks) {
                d.sendKeys(input, local.toAbsolutePath().toString());
                System.out.println("  through the directory picker");
            } else {
                System.out.println("  this driver cannot pick a folder, handing the app the file"
                        + " list the browser would have built");
                handOverFileList(d, folder);
            }

            Page.waitForInDrive(d, folder, 300_000);
            System.out.println("  folder appeared in the drive listing");

            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD, folder,
                    300_000, "one.txt", "two.bin", "nested");
            System.out.println("  " + folder + " contains "
                    + Fixtures.listing(jar, url, Server.USERNAME, Server.PASSWORD, folder));
            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD, folder + "/nested",
                    300_000, "three.txt");
            System.out.println("  " + folder + "/nested contains three.txt");

            Path roundTripped = downloads.resolve("two.bin");
            Fixtures.download(jar, url, Server.USERNAME, Server.PASSWORD,
                    folder + "/two.bin", roundTripped);
            String got = Downloads.sha256(roundTripped);
            String want = Downloads.sha256(local.resolve("two.bin"));
            if (! got.equals(want))
                throw new AssertionError("two.bin differs after upload: " + got + " vs " + want);
            System.out.println("  ok   nested tree intact, two.bin hash matches source");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** The same shape the directory picker delivers: a flat list carrying webkitRelativePath. */
    private static void handOverFileList(WebDriver d, String folder) {
        d.script("const dir = arguments[0];" +
                "function pattern(n) { const a = new Uint8Array(n);" +
                "  for (let i = 0; i < n; i++) a[i] = (i * 31 + 7) & 0xff; return a; }" +
                "function mk(relPath, data) {" +
                "  const parts = relPath.split('/');" +
                "  const f = new File([data], parts[parts.length - 1]);" +
                "  Object.defineProperty(f, 'webkitRelativePath', {value: relPath});" +
                "  return f;" +
                "}" +
                "const enc = new TextEncoder(); const NL = String.fromCharCode(10);" +
                "const files = [" +
                "  mk(dir + '/one.txt', enc.encode('first file' + NL))," +
                "  mk(dir + '/two.bin', pattern(3 * 1024 * 1024))," +
                "  mk(dir + '/nested/three.txt', enc.encode('in a subfolder' + NL))" +
                "];" +
                "window.__drive.uploadFiles({target: {files: files}});", folder);
    }

    /** Must match the generator in handOverFileList, so the hash check holds on either path. */
    private static byte[] pattern(int n) {
        byte[] b = new byte[n];
        for (int i = 0; i < n; i++)
            b[i] = (byte) ((i * 31 + 7) & 0xff);
        return b;
    }
}
