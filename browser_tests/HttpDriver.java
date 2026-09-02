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

    public HttpDriver(String base, Map<String, Object> capabilities, Process driverProcess) {
        this.base = base;
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
    public void switchToFrame(Object frameElementOrNull) {
        Map<String, Object> params = new HashMap<>();
        params.put("id", frameElementOrNull);
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
        if (driverProcess != null)
            driverProcess.destroy();
    }
}
