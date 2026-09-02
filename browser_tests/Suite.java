import java.nio.file.*;
import java.util.*;

/** Runs the browser tests against one engine, sharing a single server across them.
 *
 *  Usage: java -cp ../server/Peergos.jar Suite.java [firefox|chromium|webkit]
 */
public class Suite {

    public static void main(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();

        List<String> failures = new ArrayList<>();
        try (Server server = Server.start(serverDir)) {
            System.out.println("server at " + server.url() + ", engine " + engine);
            run(failures, "smoke", () -> SmokeTest.main(new String[]{engine, server.url() + "/"}));
            // WebKitWebDriver cannot be told where downloads go, so this one runs on the engines
            // that can. WebKit download coverage belongs with the gtk host.
            if (! engine.startsWith("webkit"))
                run(failures, "concurrent downloads",
                        () -> ConcurrentDownloadTest.main(new String[]{engine, server.url()}));
            else
                System.out.println("SKIP concurrent downloads on webkit: no download directory capability");
        }

        System.out.println();
        if (failures.isEmpty()) {
            System.out.println("all tests passed on " + engine);
        } else {
            System.out.println(failures.size() + " failed on " + engine + ": " + failures);
            System.exit(1);
        }
    }

    private interface Test {
        void run() throws Exception;
    }

    private static void run(List<String> failures, String name, Test test) {
        System.out.println("\n--- " + name);
        long start = System.currentTimeMillis();
        try {
            test.run();
            System.out.println("--- " + name + " passed in " + (System.currentTimeMillis() - start) / 1000 + "s");
        } catch (Throwable t) {
            System.out.println("--- " + name + " FAILED: " + t);
            t.printStackTrace(System.out);
            failures.add(name);
        }
    }
}
