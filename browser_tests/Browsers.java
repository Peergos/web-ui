import java.io.*;
import java.net.ServerSocket;
import java.nio.file.*;
import java.util.*;

/** Launches a browser and returns a driver for it.
 *
 *  No binary is ever downloaded. chromedriver and WebKitWebDriver come from the distro, where
 *  they are already version matched to their browser, and Firefox needs no driver at all.
 */
public class Browsers {

    public enum Engine { FIREFOX, CHROMIUM, WEBKIT }

    public static Engine engine(String name) {
        switch (name.toLowerCase()) {
            case "firefox": return Engine.FIREFOX;
            case "chrome":
            case "chromium": return Engine.CHROMIUM;
            case "webkit":
            case "webkitgtk": return Engine.WEBKIT;
            default: throw new IllegalArgumentException("Unknown engine: " + name);
        }
    }

    public static WebDriver launch(Engine engine, Path downloadDir, boolean headless) {
        try {
            Files.createDirectories(downloadDir);
            switch (engine) {
                case FIREFOX: return firefox(downloadDir, headless);
                case CHROMIUM: return chromium(downloadDir, headless);
                case WEBKIT: return webkit(downloadDir, headless);
            }
            throw new IllegalStateException();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private static int freePort() throws IOException {
        try (ServerSocket s = new ServerSocket(0)) {
            return s.getLocalPort();
        }
    }

    private static WebDriver firefox(Path downloadDir, boolean headless) throws IOException {
        Path profile = Files.createTempDirectory("peergos-ff-profile-");
        int port = freePort();
        // Marionette reads its port from the profile, so there is no race with a fixed one.
        String prefs = String.join("\n",
                "user_pref(\"marionette.port\", " + port + ");",
                "user_pref(\"browser.download.folderList\", 2);",
                "user_pref(\"browser.download.dir\", \"" + downloadDir.toAbsolutePath() + "\");",
                "user_pref(\"browser.download.useDownloadDir\", true);",
                "user_pref(\"browser.download.always_ask_before_handling_new_types\", false);",
                "user_pref(\"browser.download.alwaysOpenPanel\", false);",
                "user_pref(\"browser.shell.checkDefaultBrowser\", false);",
                "user_pref(\"browser.aboutwelcome.enabled\", false);",
                "user_pref(\"browser.startup.homepage_override.mstone\", \"ignore\");",
                "user_pref(\"datareporting.policy.dataSubmissionEnabled\", false);",
                "user_pref(\"dom.serviceWorkers.testing.enabled\", true);",
                "");
        Files.writeString(profile.resolve("user.js"), prefs);

        List<String> cmd = new ArrayList<>(List.of(
                firefoxBinary(), "--marionette", "--no-remote", "--profile", profile.toString()));
        if (headless)
            cmd.add("--headless");
        cmd.add("about:blank");
        Process p = start(cmd);
        return new MarionetteDriver(port, p);
    }

    private static String firefoxBinary() {
        String env = System.getenv("FIREFOX");
        return env != null ? env : "firefox";
    }

    private static WebDriver chromium(Path downloadDir, boolean headless) throws IOException {
        int port = freePort();
        Process driver = start(List.of(chromedriverBinary(), "--port=" + port));
        awaitDriver("http://127.0.0.1:" + port + "/status");

        Path userData = Files.createTempDirectory("peergos-chrome-profile-");
        List<String> args = new ArrayList<>(List.of(
                "--user-data-dir=" + userData,
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-features=DownloadBubble,DownloadBubbleV2"));
        if (headless)
            args.add("--headless=new");

        Map<String, Object> chromeOptions = new LinkedHashMap<>();
        String binary = System.getenv("CHROMIUM");
        if (binary != null)
            chromeOptions.put("binary", binary);
        chromeOptions.put("args", args);
        chromeOptions.put("prefs", Map.of(
                "download.default_directory", downloadDir.toAbsolutePath().toString(),
                "download.prompt_for_download", false,
                "safebrowsing.enabled", false));

        Map<String, Object> caps = Map.of("alwaysMatch",
                Map.of("browserName", "chrome", "goog:chromeOptions", chromeOptions));
        HttpDriver d = new HttpDriver("http://127.0.0.1:" + port, caps, driver);
        d.setDownloadDirectory(downloadDir.toAbsolutePath().toString());
        return d;
    }

    private static String chromedriverBinary() {
        String env = System.getenv("CHROMEDRIVER");
        return env != null ? env : "chromedriver";
    }

    private static WebDriver webkit(Path downloadDir, boolean headless) throws IOException {
        int port = freePort();
        // MiniBrowser has no headless mode - it exits with "Unknown option --headless" - so
        // headless here means running the driver, and the browser it spawns, under a virtual
        // display. CI installs xvfb for this; a developer machine just uses the real display.
        List<String> cmd = new ArrayList<>();
        if (headless && hasXvfb()) {
            cmd.add("xvfb-run");
            cmd.add("-a");
        } else if (headless && System.getenv("DISPLAY") == null) {
            throw new IllegalStateException("WebKitGTK needs a display: install xvfb, or run with"
                    + " HEADLESS=0 on a machine with one");
        }
        cmd.add(webkitDriverBinary());
        cmd.add("--port=" + port);
        Process driver = start(cmd);
        awaitDriver("http://127.0.0.1:" + port + "/status");

        // WebKitWebDriver has no download directory capability, so downloads land wherever the
        // embedder puts them - which for MiniBrowser is not configurable from here. The download
        // tests therefore run on the other two engines, and WebKit download coverage comes from
        // the gtk host, which sets the destination in decide-destination exactly as
        // packager/flatpak/peergos-window.py does. Browsing, uploads, video and the sandboxed
        // apps are all fine on this driver.
        Map<String, Object> caps = Map.of("alwaysMatch",
                Map.of("browserName", "MiniBrowser",
                        "webkitgtk:browserOptions", Map.of("args", List.of())));
        return new HttpDriver("http://127.0.0.1:" + port, caps, driver);
    }

    private static boolean hasXvfb() {
        try {
            return new ProcessBuilder("which", "xvfb-run")
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start().waitFor() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private static String webkitDriverBinary() {
        String env = System.getenv("WEBKITWEBDRIVER");
        return env != null ? env : "WebKitWebDriver";
    }

    private static Process start(List<String> cmd) throws IOException {
        return new ProcessBuilder(cmd)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start();
    }

    private static void awaitDriver(String statusUrl) {
        long end = System.currentTimeMillis() + 30_000;
        while (System.currentTimeMillis() < end) {
            try (java.io.InputStream in = java.net.URI.create(statusUrl).toURL().openStream()) {
                in.readAllBytes();
                return;
            } catch (IOException e) {
                WebDriver.sleep(200);
            }
        }
        throw new IllegalStateException("Driver never came up at " + statusUrl);
    }
}
