import java.nio.file.*;

/** Uploads a file through the drive's file picker and checks the bytes that arrived.
 *
 *  Deliberately larger than Chunk.MAX_SIZE. The suite this replaced round tripped an eleven byte
 *  "Hello World", which never touches the chunked writer at all.
 *
 *  Usage: java -cp ../server/Peergos.jar UploadTest.java [engine] [url]
 */
public class UploadTest {

    static final long SIZE = Long.getLong("upload.size", 7L * 1024 * 1024);

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

        String name = "uploaded-" + System.currentTimeMillis() + ".bin";
        Path source = Fixtures.localFile(name, SIZE);
        Path downloads = Files.createTempDirectory("peergos-upload-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);

            Object input = d.find("#uploadFileInput");
            if (input == null)
                throw new AssertionError("No file input in the drive view");
            System.out.println("uploading " + name + " (" + SIZE + " bytes)");
            d.sendKeys(input, source.toAbsolutePath().toString());

            Page.waitForInDrive(d, name, 300_000);
            System.out.println("  appeared in the drive listing");

            // pulled back over the api rather than through the browser, so an upload failure
            // cannot be masked by a download failure
            Path roundTripped = downloads.resolve("roundtrip.bin");
            Fixtures.download(jar, url, Server.USERNAME, Server.PASSWORD, name, roundTripped);

            long size = Files.size(roundTripped);
            if (size != SIZE)
                throw new AssertionError("Uploaded file is " + size + " bytes, expected " + SIZE);
            String got = Downloads.sha256(roundTripped), want = Downloads.sha256(source);
            if (! got.equals(want))
                throw new AssertionError("Uploaded bytes differ: " + got + " vs " + want);
            System.out.println("  ok   " + size + " bytes, hash matches source");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
