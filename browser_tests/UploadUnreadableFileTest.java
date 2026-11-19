import java.nio.file.*;
import java.util.*;

/** Uploads two files of which one can no longer be read - gone from the disk after it was picked, as
 *  a temporary or syncing file in a large folder can be - and checks the upload still finishes and
 *  says so.
 *
 *  Every file is hashed before any is uploaded, and one that failed to read stopped that chain
 *  with nothing reported: no file was uploaded and the transfer just stood still, which is how a
 *  large folder upload "stopped after analysis without warning".
 *
 *  Usage: java -cp ../server/Peergos.jar UploadUnreadableFileTest.java [engine] [url]
 */
public class UploadUnreadableFileTest {

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
        if (! Page.canDriveFilePicker(engine)) {
            System.out.println("SKIP this driver cannot hand the drive a file from disk");
            return;
        }
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();
        Path jar = serverDir.resolve("Peergos.jar");

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Fixtures.Account me = Fixtures.account(url);
        // the larger is read second, as an upload reads its files smallest first: well after the delete
        Path readable = Fixtures.patternFile("readable.bin", 16 * 1024 * 1024);
        Path gone = Temp.directory("peergos-unreadable-").resolve("gone.txt");
        Files.write(gone, new byte[17 * 1024 * 1024]);
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-unreadable-dl-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            Page.gotoDrive(d);

            d.sendKeys(d.find("#uploadFileInput"), readable.toAbsolutePath() + "\n" + gone.toAbsolutePath());
            Files.delete(gone);

            try {
                Fixtures.awaitListing(jar, url, me.name(), me.password(), null, 120_000, "readable.bin");
            } catch (Exception | AssertionError e) {
                throw new AssertionError("The file that could be read was not uploaded within two minutes; "
                        + state(d));
            }
            System.out.println("  ok   the file that could be read was uploaded");
            d.waitForScript("word of the file that could not be read",
                    "[...document.querySelectorAll('.Vue-Toastification__toast--error')].some(t => t.innerText.includes('gone.txt'))", 30_000);
            System.out.println("  ok   the upload says which file it could not read: " + toasts(d));
            System.out.println("PASS");
        } catch (IllegalStateException e) {
            throw new AssertionError(e.getMessage());
        } finally {
            if (own != null)
                own.close();
        }
    }

    private static String toasts(WebDriver d) {
        return String.valueOf(d.scriptQuiet("return JSON.stringify([...document.querySelectorAll('.Vue-Toastification__toast')]"
                + ".map(t => t.innerText.replace(/\\s+/g, ' ').trim()).filter(t => t.length > 0 && t.length < 200));"));
    }

    private static String state(WebDriver d) {
        return "toasts=" + toasts(d) + " error=" + d.scriptQuiet("const vm = window.__drive;"
                + "return vm.showError ? vm.errorTitle + ' / ' + vm.errorBody : 'none';");
    }
}
