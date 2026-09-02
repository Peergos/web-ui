import java.nio.file.*;
import java.util.*;

/** Uploads several files at once through the file picker.
 *
 *  The input carries `multiple`, and webdriver selects more than one file by sending the paths
 *  separated by newlines. This is a different path through the app from uploading one file:
 *  processFileUpload sorts the whole batch by directory and size before sending it, so a batch
 *  can succeed for the first file and quietly lose the rest.
 *
 *  Usage: java -cp ../server/Peergos.jar UploadGroupTest.java [engine] [url]
 */
public class UploadGroupTest {

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

        long stamp = System.currentTimeMillis();
        Path dir = Files.createTempDirectory("peergos-group-");
        // a mix of sizes, since the batch is sorted by size before upload and the big one
        // crosses the chunk boundary
        Map<String, Integer> sizes = new LinkedHashMap<>();
        sizes.put("group-" + stamp + "-tiny.txt", 12);
        sizes.put("group-" + stamp + "-small.bin", 64 * 1024);
        sizes.put("group-" + stamp + "-big.bin", 6 * 1024 * 1024);
        List<Path> locals = new ArrayList<>();
        for (Map.Entry<String, Integer> e : sizes.entrySet()) {
            Path f = dir.resolve(e.getKey());
            Files.write(f, bytes(e.getValue()));
            locals.add(f);
        }

        Path downloads = Files.createTempDirectory("peergos-group-dl-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);

            Object input = d.find("#uploadFileInput");
            if (input == null)
                throw new AssertionError("No file input in the drive view");
            StringBuilder paths = new StringBuilder();
            for (Path l : locals) {
                if (paths.length() > 0)
                    paths.append("\n");
                paths.append(l.toAbsolutePath());
            }
            System.out.println("uploading " + locals.size() + " files in one go");
            d.sendKeys(input, paths.toString());

            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD, null,
                    300_000, sizes.keySet().toArray(new String[0]));
            System.out.println("  all " + sizes.size() + " arrived");

            for (Path local : locals) {
                String name = local.getFileName().toString();
                Path back = downloads.resolve("back-" + name);
                Fixtures.download(jar, url, Server.USERNAME, Server.PASSWORD, name, back);
                if (Files.size(back) != Files.size(local))
                    throw new AssertionError(name + " is " + Files.size(back) + " bytes, expected "
                            + Files.size(local));
                if (! Downloads.sha256(back).equals(Downloads.sha256(local)))
                    throw new AssertionError(name + " differs after upload");
            }
            System.out.println("  ok   every file in the batch matches its source");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    private static byte[] bytes(int n) {
        byte[] b = new byte[n];
        for (int i = 0; i < n; i++)
            b[i] = (byte) ((i * 13 + 5) & 0xff);
        return b;
    }
}
