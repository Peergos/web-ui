import java.nio.file.*;

/** Proves the driver works end to end: launch, load the app, sign in, reach the drive.
 *
 *  Usage: java -cp ../server/Peergos.jar SmokeTest.java [firefox|chromium|webkit] [url]
 */
public class SmokeTest {

    public static void main(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String url = args.length > 1 ? args[1] : "http://localhost:8080/";
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));

        Path downloads = Files.createTempDirectory("peergos-smoke-downloads-");
        long start = System.currentTimeMillis();
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            System.out.println("launched " + engine + (headless ? " headless" : "") + " in "
                    + (System.currentTimeMillis() - start) + "ms");

            d.navigate(url);
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            System.out.println("app loaded, title=" + d.script("return document.title"));
            System.out.println("crossOriginIsolated=" + d.script("return window.crossOriginIsolated"));

            Page.login(d, "peergos", "testpassword");
            System.out.println("signed in");

            Page.gotoDrive(d);
            System.out.println("drive ready, usage line=" + d.script(
                    "return document.body.innerText.split('\\n').filter(l => l.indexOf('/') > 0)[0]"));
            System.out.println("PASS");
        }
    }
}
