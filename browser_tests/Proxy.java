import com.sun.net.httpserver.*;
import peergos.shared.io.ipfs.api.JSONParser;

import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

/** A reverse proxy in front of the Peergos server that can make the network misbehave.
 *
 *  This is the most valuable piece of the rig. With no injected latency the concurrent download
 *  bug fixed in 3cee931b did not reproduce at all; at 1500ms it reproduced every time.
 *
 *  Knobs, settable at runtime by POSTing json to /__ctl:
 *    latency_ms   delay added to every storage request
 *    error_prob   fraction answered with 503
 *    hang_prob    fraction never answered at all, the socket simply held open. This is the knob
 *                 that finds futures which never settle, as opposed to futures that fail.
 */
public class Proxy {

    private final URI upstream;
    private final HttpServer server;
    private final HttpClient client = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    private volatile double latencyMillis = 0, errorProb = 0, hangProb = 0;
    private final Map<String, Integer> stats = new ConcurrentHashMap<>();

    public Proxy(int port, URI upstream) throws IOException {
        this.upstream = upstream;
        this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 256);
        this.server.setExecutor(Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            return t;
        }));
        this.server.createContext("/__ctl", this::control);
        this.server.createContext("/", this::forward);
    }

    public void start() {
        server.start();
    }

    public void stop() {
        server.stop(0);
    }

    public int port() {
        return server.getAddress().getPort();
    }

    public void configure(double latencyMillis, double errorProb, double hangProb) {
        this.latencyMillis = latencyMillis;
        this.errorProb = errorProb;
        this.hangProb = hangProb;
    }

    public void resetStats() {
        stats.clear();
    }

    public int stat(String name) {
        return stats.getOrDefault(name, 0);
    }

    private void bump(String name) {
        stats.merge(name, 1, Integer::sum);
    }

    private static boolean isStorage(String path) {
        return path.startsWith("/api/v0/") || path.startsWith("/peergos/v0/");
    }

    @SuppressWarnings("unchecked")
    private void control(HttpExchange ex) throws IOException {
        byte[] body = ex.getRequestBody().readAllBytes();
        if (body.length > 0) {
            Map<String, Object> cfg = (Map<String, Object>) JSONParser.parse(new String(body, StandardCharsets.UTF_8));
            if (cfg.containsKey("latency_ms"))
                latencyMillis = ((Number) cfg.get("latency_ms")).doubleValue();
            if (cfg.containsKey("error_prob"))
                errorProb = ((Number) cfg.get("error_prob")).doubleValue();
            if (cfg.containsKey("hang_prob"))
                hangProb = ((Number) cfg.get("hang_prob")).doubleValue();
            if (Boolean.TRUE.equals(cfg.get("reset_stats")))
                resetStats();
        }
        byte[] out = JSONParser.toString(new LinkedHashMap<>(stats)).getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.sendResponseHeaders(200, out.length);
        ex.getResponseBody().write(out);
        ex.close();
    }

    private void forward(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getRawPath();
        String query = ex.getRequestURI().getRawQuery();

        if (isStorage(path)) {
            bump("storage_requests");
            if (latencyMillis > 0)
                WebDriver.sleep((long) latencyMillis);
            if (hangProb > 0 && Math.random() < hangProb) {
                bump("hung");
                // never answer and never close: to the browser this is a request in flight for ever
                try {
                    Thread.sleep(Long.MAX_VALUE);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return;
            }
            if (errorProb > 0 && Math.random() < errorProb) {
                bump("errored");
                ex.sendResponseHeaders(503, -1);
                ex.close();
                return;
            }
        }

        byte[] requestBody = ex.getRequestBody().readAllBytes();
        // HttpClient sets Host from the target uri, which is what the server's SubdomainHandler
        // checks against its whitelist, so forwarding to the upstream address is enough - there
        // is nothing to rewrite by hand.
        URI target = upstream.resolve(path + (query == null ? "" : "?" + query));
        HttpRequest.Builder req = HttpRequest.newBuilder(target)
                .timeout(Duration.ofMinutes(10))
                .method(ex.getRequestMethod(), requestBody.length == 0 ?
                        HttpRequest.BodyPublishers.noBody() :
                        HttpRequest.BodyPublishers.ofByteArray(requestBody));
        for (Map.Entry<String, List<String>> e : ex.getRequestHeaders().entrySet()) {
            String name = e.getKey().toLowerCase();
            if (name.equals("host") || name.equals("connection") || name.equals("content-length")
                    || name.equals("upgrade") || name.equals("expect"))
                continue;
            for (String v : e.getValue())
                req.header(e.getKey(), v);
        }

        HttpResponse<byte[]> resp;
        try {
            resp = client.send(req.build(), HttpResponse.BodyHandlers.ofByteArray());
        } catch (Exception e) {
            bump("upstream_fail");
            ex.sendResponseHeaders(502, -1);
            ex.close();
            return;
        }

        Headers out = ex.getResponseHeaders();
        resp.headers().map().forEach((name, values) -> {
            String lower = name.toLowerCase();
            // Content-Encoding must survive: the server always gzips, whatever was asked for.
            if (lower.equals("transfer-encoding") || lower.equals("content-length")
                    || lower.equals("connection"))
                return;
            values.forEach(v -> out.add(name, v));
        });
        byte[] data = resp.body();
        try {
            ex.sendResponseHeaders(resp.statusCode(), data.length == 0 ? -1 : data.length);
            if (data.length > 0)
                ex.getResponseBody().write(data);
            if (isStorage(path))
                bump("responded");
        } catch (IOException e) {
            // the browser hung up mid response, which is itself a signal worth counting
            bump("client_disconnected");
        } finally {
            ex.close();
        }
    }

    /** Standalone: java -cp ../server/Peergos.jar Proxy.java <listenPort> <upstreamUrl> */
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        URI up = URI.create(args.length > 1 ? args[1] : "http://localhost:7777");
        Proxy p = new Proxy(port, up);
        p.start();
        System.out.println("proxy on http://localhost:" + p.port() + " -> " + up);
        Thread.currentThread().join();
    }
}
