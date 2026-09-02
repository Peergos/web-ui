import peergos.server.Builder;
import peergos.shared.NetworkAccess;

import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;

/** A Peergos server owned by the test run.
 *
 *  It gets its own port and its own PEERGOS_PATH under a temp directory, and is stopped by
 *  process handle. Nothing here touches any other Peergos on the machine: the old runner did
 *  `ps aux | grep Peergos.jar | xargs kill -9`, which killed a developer's own server along with
 *  the test one.
 */
public class Server implements AutoCloseable {

    public static final String USERNAME = "peergos";
    public static final String PASSWORD = "testpassword";

    private final Process process;
    private final int port;
    private final Path dataDir;
    private final Path log;

    private Server(Process process, int port, Path dataDir, Path log) {
        this.process = process;
        this.port = port;
        this.dataDir = dataDir;
        this.log = log;
    }

    public int port() {
        return port;
    }

    public String url() {
        return "http://localhost:" + port;
    }

    /** Starts a fresh pki server. serverDir is web-ui/server, which holds the jar and webroot. */
    public static Server start(Path serverDir) throws IOException {
        int port = freePort();
        // proxy-target is the second http server this starts, and it defaults to a fixed
        // 127.0.0.1:8003 - so without its own port a test server collides with any other Peergos
        // already running on the machine, including a developer's.
        int p2pPort = freePort();
        Path dataDir = Files.createTempDirectory("peergos-browser-test-");
        List<String> cmd = List.of("java", "-jar", "Peergos.jar", "pki-init",
                "-port", Integer.toString(port),
                "-proxy-target", "/ip4/127.0.0.1/tcp/" + p2pPort,
                "-log-to-console", "false",
                "-useIPFS", "false",
                "-webroot", "webroot",
                "-webcache", "false",
                "-max-users", "100",
                "peergos.password", PASSWORD,
                "pki.keygen.password", "testpkipassword",
                "pki.keyfile.password", "testpkifilepassword",
                "default-quota", Long.toString(4L * 1024 * 1024 * 1024),
                "PEERGOS_PATH", dataDir.toString(),
                "-admin-usernames", USERNAME,
                "-max-daily-signups", "10000");
        Path log = dataDir.resolve("server.log");
        Process p = new ProcessBuilder(cmd)
                .directory(serverDir.toFile())
                .redirectErrorStream(true)
                .redirectOutput(log.toFile())
                .start();
        Server server = new Server(p, port, dataDir, log);
        server.awaitReady();
        server.awaitAccount();
        return server;
    }

    private void awaitReady() {
        long end = System.currentTimeMillis() + 300_000;
        while (System.currentTimeMillis() < end) {
            if (! process.isAlive())
                throw new IllegalStateException("Peergos server exited during startup with "
                        + process.exitValue() + "\n" + tailLog());
            try {
                HttpURLConnection c = (HttpURLConnection) URI.create(url() + "/").toURL().openConnection();
                c.setConnectTimeout(2000);
                c.setReadTimeout(5000);
                if (c.getResponseCode() == 200) {
                    c.getInputStream().close();
                    return;
                }
            } catch (IOException e) {
                // not listening yet
            }
            WebDriver.sleep(500);
        }
        throw new IllegalStateException("Peergos server never came up on port " + port
                + "\n" + tailLog());
    }

    /** pki-init signs the admin user up as part of bootstrapping, a little after the web server
     *  starts answering. Waiting only for a 200 on / gets a shell that cannot log in and offers
     *  to sign up instead.
     */
    private void awaitAccount() {
        long end = System.currentTimeMillis() + 300_000;
        RuntimeException last = null;
        while (System.currentTimeMillis() < end) {
            try {
                NetworkAccess network = Builder.buildJavaNetworkAccess(
                        URI.create(url()).toURL(), false, Optional.empty(), Optional.empty()).join();
                if (! network.coreNode.getChain(USERNAME).join().isEmpty())
                    return;
            } catch (RuntimeException | java.io.IOException e) {
                last = e instanceof RuntimeException ? (RuntimeException) e : new RuntimeException(e);
            }
            WebDriver.sleep(1000);
        }
        throw new IllegalStateException("The " + USERNAME + " account never appeared\n" + tailLog(), last);
    }

    private String tailLog() {
        try {
            List<String> lines = Files.readAllLines(log);
            List<String> tail = lines.subList(Math.max(0, lines.size() - 20), lines.size());
            return String.join("\n", tail);
        } catch (IOException e) {
            return "(no server log at " + log + ")";
        }
    }

    private static int freePort() throws IOException {
        try (ServerSocket s = new ServerSocket(0)) {
            return s.getLocalPort();
        }
    }

    @Override
    public void close() {
        process.destroy();
        try {
            if (! process.waitFor(20, java.util.concurrent.TimeUnit.SECONDS))
                process.destroyForcibly();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
        }
        deleteRecursive(dataDir);
    }

    private static void deleteRecursive(Path dir) {
        try (var paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException e) {
                    // best effort; it is under the system temp directory
                }
            });
        } catch (IOException e) {
            // ditto
        }
    }
}
