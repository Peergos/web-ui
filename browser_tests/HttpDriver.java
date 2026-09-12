import peergos.shared.io.ipfs.api.JSONParser;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

/** W3C WebDriver over HTTP: chromedriver, and WebKitWebDriver for WebKitGTK. */
public class HttpDriver implements WebDriver {

    private static final String ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private final String base;
    private final String sessionId;
    private final Process driverProcess;
    private final String marker;

    public HttpDriver(String base, Map<String, Object> capabilities, Process driverProcess) {
        this(base, capabilities, driverProcess, null);
    }

    public HttpDriver(String base, Map<String, Object> capabilities, Process driverProcess,
                      String marker) {
        this.base = base;
        this.marker = marker;
        this.driverProcess = driverProcess;
        Object res = send("POST", "/session", Map.of("capabilities", capabilities));
        this.sessionId = (String) value(res, "sessionId");
    }

    private Object send(String method, String path, Object body) {
        try {
            HttpRequest.BodyPublisher pub = body == null ?
                    HttpRequest.BodyPublishers.noBody() :
                    HttpRequest.BodyPublishers.ofString(JSONParser.toString(body));
            HttpRequest req = HttpRequest.newBuilder(URI.create(base + path))
                    .timeout(Duration.ofMinutes(10))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .method(method, pub)
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            Object parsed = JSONParser.parse(resp.body());
            if (resp.statusCode() >= 400)
                throw new IllegalStateException("WebDriver " + method + " " + path + " -> "
                        + resp.statusCode() + " " + summarise(parsed));
            return parsed;
        } catch (java.io.IOException | InterruptedException e) {
            throw new RuntimeException(e);
        }
    }

    private static String summarise(Object parsed) {
        Object v = parsed instanceof Map ? ((Map) parsed).get("value") : parsed;
        if (v instanceof Map) {
            Map m = (Map) v;
            return m.get("error") + ": " + String.valueOf(m.get("message"));
        }
        return String.valueOf(v);
    }

    @SuppressWarnings("unchecked")
    private static Object value(Object res, String field) {
        Object v = ((Map) res).get("value");
        return field == null ? v : ((Map) v).get(field);
    }

    /** Chromium only: headless Chrome ignores the download.default_directory preference, so the
     *  destination has to be set over the devtools protocol once the session exists. Without this
     *  a headless download simply never lands anywhere.
     */
    public void setDownloadDirectory(String dir) {
        Map<String, Object> body = Map.of("cmd", "Browser.setDownloadBehavior",
                "params", Map.of("behavior", "allow", "downloadPath", dir));
        try {
            send("POST", session("/goog/cdp/execute"), body);
        } catch (RuntimeException e) {
            // older chromedriver spells it differently
            send("POST", session("/chromium/send_command"), body);
        }
    }

    /** Sizes the browser's window. Engines that take their size from the command line are set
     *  up at launch; the ones driven by a real window are sized here, once the session exists.
     *
     *  The request is read back rather than trusted. A driver can answer a resize before the
     *  window it is resizing has been mapped, and the window then keeps the size it opened at -
     *  which is small enough that a month grid has no room to be dropped on. Best effort still:
     *  a window that will not take the size says so and the tests carry on, since the one that
     *  cares says what it was given when it fails.
     */
    public void setWindowRect(int width, int height) {
        String had = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                send("POST", session("/window/rect"),
                        Map.of("x", 0, "y", 0, "width", width, "height", height));
                Object rect = value(send("GET", session("/window/rect"), null), null);
                had = String.valueOf(rect);
                if (rect instanceof Map) {
                    Map m = (Map) rect;
                    if (number(m.get("width")) >= width && number(m.get("height")) >= height)
                        return;
                }
            } catch (RuntimeException e) {
                System.out.println("  note: this driver would not set the window size: " + e.getMessage());
                return;
            }
            WebDriver.sleep(500);
        }
        System.out.println("  note: the window stayed at " + had + " rather than " + width + "x" + height);
    }

    private static int number(Object value) {
        return value instanceof Number ? ((Number) value).intValue() : -1;
    }

    private String session(String suffix) {
        return "/session/" + sessionId + suffix;
    }

    @Override
    public void navigate(String url) {
        send("POST", session("/url"), Map.of("url", url));
    }

    @Override
    public Object script(String body, Object... args) {
        return value(send("POST", session("/execute/sync"),
                Map.of("script", body, "args", Arrays.asList(args))), null);
    }

    @Override
    public void switchToFrame(String css) {
        Object element = find(css);
        if (element == null)
            throw new IllegalStateException("No frame matching " + css + " to switch into");
        Map<String, Object> params = new HashMap<>();
        params.put("id", element);
        send("POST", session("/frame"), params);
    }

    @Override
    public void switchToTop() {
        Map<String, Object> params = new HashMap<>();
        params.put("id", null);
        send("POST", session("/frame"), params);
    }

    @Override
    public Object find(String css) {
        try {
            return value(send("POST", session("/element"),
                    Map.of("using", "css selector", "value", css)), null);
        } catch (IllegalStateException e) {
            return null;
        }
    }

    @Override
    public void click(Object element) {
        send("POST", session("/element/" + elementId(element) + "/click"), Map.of());
    }

    @Override
    public void sendKeys(Object element, String text) {
        send("POST", session("/element/" + elementId(element) + "/value"), Map.of("text", text));
    }

    private static String elementId(Object element) {
        return (String) ((Map) element).get(ELEMENT_KEY);
    }

    @Override
    public void close() {
        try {
            send("DELETE", session(""), null);
        } catch (RuntimeException e) {
            // the session may already be gone; the driver process still has to go
        }
        stop(driverProcess, marker);
    }

    /** Waits for the driver to actually exit.
     *
     *  safaridriver serves one session at a time and refuses to start while the previous one is
     *  still around, so returning from close() before the process is gone makes the next test
     *  fail to launch a driver at all.
     */
    static void stop(Process process) {
        stop(process, null);
    }

    /** @param marker a string unique to this launch - the temp profile path - that identifies
     *                the browser even after it has been reparented away from us */
    static void stop(Process process, String marker) {
        if (process == null && marker == null)
            return;
        // Kill the children first. On macos and windows the command we launched is often a stub
        // that execs the real browser, so destroying only our own handle leaves the browser
        // running - and ten tests each leaving one behind starve the machine until scrypt in the
        // page cannot finish inside any sane timeout.
        List<ProcessHandle> children = process == null ? List.of()
                : process.descendants().collect(java.util.stream.Collectors.toList());
        if (process != null) {
            process.destroy();
            children.forEach(ProcessHandle::destroy);
            try {
                if (! process.waitFor(20, java.util.concurrent.TimeUnit.SECONDS))
                    process.destroyForcibly().waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                process.destroyForcibly();
            }
        }
        for (ProcessHandle child : children) {
            if (child.isAlive())
                child.destroyForcibly();
        }
        // The launcher we started often execs the real browser and exits, leaving it reparented
        // and no longer a descendant of anything we hold. Ten tests each leaving one behind
        // starve the machine, and the symptom is a later test timing out in scrypt at sign in.
        sweep(marker);
    }

    private static void sweep(String marker) {
        if (marker == null)
            return;
        List<ProcessHandle> strays = ProcessHandle.allProcesses()
                .filter(h -> h.info().commandLine().map(c -> c.contains(marker)).orElse(false))
                .collect(java.util.stream.Collectors.toList());
        strays.forEach(ProcessHandle::destroy);
        long deadline = System.currentTimeMillis() + 15_000;
        for (ProcessHandle stray : strays) {
            while (stray.isAlive() && System.currentTimeMillis() < deadline)
                WebDriver.sleep(200);
            if (stray.isAlive())
                stray.destroyForcibly();
        }
    }
}
