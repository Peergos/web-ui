import com.sun.net.httpserver.*;
import peergos.shared.cbor.*;
import peergos.shared.storage.PaymentProperties;
import peergos.shared.storage.controller.AllowedSignups;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.*;

/** Stands in for the quota service a paid Peergos instance keeps its quotas and signup tokens in.
 *
 *  The real one is not part of this repository. This answers the same calls HttpQuotaAdmin makes,
 *  with the same CBOR replies, from memory, so a test can run a paid instance end to end. Anyone
 *  may sign up, as on a paid instance, and a signup token gives its user the free quota.
 *
 *  listing says whether it answers token-list and token-delete: off, it is a quota service from
 *  before those calls existed, which refuses them as unknown.
 */
public class QuotaAdminStandIn implements AutoCloseable {

    static final long FREE = 4L * 1024 * 1024 * 1024;

    public final Set<String> tokens = ConcurrentHashMap.newKeySet();
    private final Map<String, Long> quotas = new ConcurrentHashMap<>();
    public volatile boolean listing;
    private final HttpServer server;

    private QuotaAdminStandIn(boolean listing) throws IOException {
        this.listing = listing;
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/quota-admin/", this::handle);
        server.start();
    }

    public static QuotaAdminStandIn start(boolean listing) throws IOException {
        return new QuotaAdminStandIn(listing);
    }

    public int port() {
        return server.getAddress().getPort();
    }

    private void handle(HttpExchange ex) throws IOException {
        String call = ex.getRequestURI().getPath().substring("/quota-admin/".length());
        Map<String, String> q = new HashMap<>();
        String raw = ex.getRequestURI().getRawQuery();
        if (raw != null)
            for (String kv : raw.split("&")) {
                String[] p = kv.split("=", 2);
                q.put(p[0], p.length > 1 ? URLDecoder.decode(p[1], StandardCharsets.UTF_8) : "");
            }
        try {
            Cborable reply = switch (call) {
                case "signups" -> new AllowedSignups(false, true);
                case "allowed", "quota-by-name-time", "remove-desired-quota" -> new CborObject.CborBoolean(true);
                case "create-paid", "payment-properties", "request" -> {
                    if (q.containsKey("username"))
                        quotas.putIfAbsent(q.get("username"), FREE);
                    yield new PaymentProperties("http://localhost:7000", Optional.empty(), FREE, 0, false, Optional.empty(), 0);
                }
                case "token-add" -> new CborObject.CborBoolean(tokens.add(q.get("token")));
                case "token-remove" -> {
                    boolean had = tokens.remove(q.get("token"));
                    if (had)
                        quotas.put(q.get("username"), FREE);
                    yield new CborObject.CborBoolean(had);
                }
                case "token-list" -> {
                    if (! listing)
                        throw new IllegalStateException("Unknown quota admin call " + call);
                    yield new CborObject.CborList(tokens.stream().map(CborObject.CborString::new).collect(Collectors.toList()));
                }
                case "token-delete" -> {
                    if (! listing)
                        throw new IllegalStateException("Unknown quota admin call " + call);
                    yield new CborObject.CborBoolean(tokens.remove(q.get("token")));
                }
                case "quota-by-name" -> new CborObject.CborLong(quotas.getOrDefault(q.get("username"), FREE));
                case "quota" -> new CborObject.CborLong(FREE);
                case "quota-remove" -> { quotas.remove(q.get("username")); yield new CborObject.CborBoolean(true); }
                case "usernames" -> new CborObject.CborList(quotas.keySet().stream().map(CborObject.CborString::new).collect(Collectors.toList()));
                default -> throw new IllegalStateException("Unknown quota admin call " + call);
            };
            byte[] body = reply.serialize();
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
        } catch (RuntimeException e) {
            ex.getResponseHeaders().set("Trailer", URLEncoder.encode(String.valueOf(e.getMessage()), StandardCharsets.UTF_8));
            ex.sendResponseHeaders(400, -1);
        } finally {
            ex.close();
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
