import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.NetworkAccess;
import peergos.shared.user.UserContext;

import java.io.*;
import java.net.URI;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Test files, created by the test rather than assumed to be sitting on the server.
 *
 *  The first version of the download test used two files that happened to be in the drive
 *  already. They were gone by the next day and the test failed with "no such file", which is a
 *  worse failure than the bug it was meant to catch. Fixtures are uploaded with the Peergos
 *  shell, not through the ui: setting up through the api and asserting through the browser keeps
 *  a download test from failing for upload reasons.
 */
public class Fixtures {

    /** Creates an extra account over the api.
     *
     *  Needed because the admin account is called "peergos", which collides with the magic
     *  /peergos/ prefix the sandbox service worker uses to recognise a drive path.
     */
    public static void signUp(String peergosUrl, String username, String password) {
        try {
            Crypto crypto = Builder.initCrypto();
            NetworkAccess network = Builder.buildJavaNetworkAccess(
                    URI.create(peergosUrl).toURL(), false, Optional.empty(), Optional.empty()).join();
            UserContext.signUp(username, password, "", network, crypto).join();
        } catch (Exception e) {
            throw new RuntimeException("Could not sign up " + username + ": " + e, e);
        }
    }

    /** A file whose bytes can be regenerated in the browser, for drivers that cannot drive the
     *  file picker and have to be handed a File instead. Must match Page.handFiles. */
    public static Path patternFile(String name, int size) throws IOException {
        Path dir = Paths.get(System.getProperty("java.io.tmpdir"), "peergos-browser-fixtures");
        Files.createDirectories(dir);
        Path file = dir.resolve(name);
        byte[] bytes = new byte[size];
        for (int i = 0; i < size; i++)
            bytes[i] = (byte) ((i * 31 + 7) & 0xff);
        Files.write(file, bytes);
        return file;
    }

    /** A deterministic pseudo random file, so a rerun reuses it rather than regenerating. */
    public static Path localFile(String name, long size) throws IOException {
        Path dir = Paths.get(System.getProperty("java.io.tmpdir"), "peergos-browser-fixtures");
        Files.createDirectories(dir);
        Path file = dir.resolve(name);
        if (Files.exists(file) && Files.size(file) == size)
            return file;
        Random random = new Random(name.hashCode());
        byte[] block = new byte[1 << 20];
        try (OutputStream out = new BufferedOutputStream(Files.newOutputStream(file))) {
            long written = 0;
            while (written < size) {
                random.nextBytes(block);
                int n = (int) Math.min(block.length, size - written);
                out.write(block, 0, n);
                written += n;
            }
        }
        return file;
    }

    /** Uploads via the Peergos shell if the remote copy is not already there. */
    public static void upload(Path jar, String peergosUrl, String username, String password,
                              Path local) {
        String name = local.getFileName().toString();
        if (listing(jar, peergosUrl, username, password).contains(name)) {
            System.out.println("fixture " + name + " already uploaded");
            return;
        }
        System.out.println("uploading fixture " + name + " (" + sizeOf(local) + " bytes)");
        // put takes the local path alone; passing a remote directory as a second argument fails
        String out = shell(jar, peergosUrl, username, password, "put " + local.toAbsolutePath());
        if (out.contains("Failed to execute"))
            throw new IllegalStateException("Fixture upload failed for " + name + ":\n" + tail(out));
    }

    private static String tail(String out) {
        String[] lines = out.replace('\r', '\n').split("\n");
        StringBuilder sb = new StringBuilder();
        for (int i = Math.max(0, lines.length - 8); i < lines.length; i++)
            if (! lines[i].isBlank())
                sb.append("  ").append(lines[i].trim()).append("\n");
        return sb.toString();
    }

    private static long sizeOf(Path p) {
        try {
            return Files.size(p);
        } catch (IOException e) {
            return -1;
        }
    }

    /** Creates a remote folder and puts files in it, in one shell session.
     *
     *  Uploading a local directory with a single `put` proved unreliable for anything but the
     *  first file, so the folder is built explicitly.
     */
    public static void uploadInto(Path jar, String url, String username, String password,
                                  String remoteDir, List<Path> locals) {
        List<String> cmds = new ArrayList<>();
        cmds.add("mkdir " + remoteDir);
        cmds.add("cd " + remoteDir);
        for (Path l : locals)
            cmds.add("put " + l.toAbsolutePath());
        String out = shell(jar, url, username, password, cmds.toArray(new String[0]));
        if (out.contains("Failed to execute"))
            throw new IllegalStateException("Could not build " + remoteDir + ":\n" + tail(out));
    }

    /** Writes the app manifest the sandbox needs before it will open a viewer.
     *
     *  AppSandbox reads .apps/<app>/peergos-app.json and calls fatalError("Application properties
     *  not found") if it is missing, closing itself without throwing - so the viewer just never
     *  appears. Signup.vue installs this on a ui signup; an account created over the api has to
     *  do it explicitly. Mirrors installDefaultApp in mixins/sandbox.
     */
    public static void installHtmlViewerApp(Path jar, String url, String username, String password) {
        try {
            Path manifest = Files.createTempDirectory("peergos-app-").resolve("peergos-app.json");
            Files.writeString(manifest, String.join("\n",
                    "{",
                    "  \"schemaVersion\": \"1\",",
                    "  \"displayName\": \"HTML Viewer\",",
                    "  \"name\": \"htmlviewer\",",
                    "  \"version\": \"1.0.0-initial\",",
                    "  \"author\": \"peergos\",",
                    "  \"folderAction\": false,",
                    "  \"description\": \"for viewing HTML files\",",
                    "  \"source\": \"\",",
                    "  \"launchable\": false,",
                    "  \"fileExtensions\": [],",
                    "  \"mimeTypes\": [],",
                    "  \"fileTypes\": [],",
                    "  \"permissions\": []",
                    "}",
                    ""));
            commands(jar, url, username, password,
                    "mkdir .apps", "cd .apps", "mkdir htmlviewer", "cd htmlviewer",
                    "put " + manifest.toAbsolutePath());
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /** Runs arbitrary shell commands, for fixtures that need more than one directory. */
    public static void commands(Path jar, String url, String username, String password,
                                String... cmds) {
        String out = shell(jar, url, username, password, cmds);
        if (out.contains("Failed to execute"))
            throw new IllegalStateException("Fixture commands failed:\n" + tail(out));
    }

    /** Pulls a file back out over the api, so an upload can be checked byte for byte. */
    public static void download(Path jar, String url, String username, String password,
                                String remoteName, Path localTarget) {
        String out = shell(jar, url, username, password,
                "get " + remoteName + " " + localTarget.toAbsolutePath());
        if (! Files.exists(localTarget))
            throw new IllegalStateException("Could not fetch " + remoteName + " over the api:\n" + tail(out));
    }

    public static List<String> listing(Path jar, String url, String username, String password) {
        return listing(jar, url, username, password, null);
    }

    /** Waits for a listing to contain everything named, since an upload keeps going after the
     *  first entry shows up. */
    public static void awaitListing(Path jar, String url, String username, String password,
                                    String path, long timeoutMillis, String... expected) {
        long end = System.currentTimeMillis() + timeoutMillis;
        List<String> seen = List.of();
        while (System.currentTimeMillis() < end) {
            seen = listing(jar, url, username, password, path);
            if (seen.containsAll(Arrays.asList(expected)))
                return;
            WebDriver.sleep(2000);
        }
        throw new IllegalStateException("Timed out waiting for " + Arrays.toString(expected)
                + " in " + (path == null ? "/" : path) + ", saw " + seen);
    }

    /** Directory listing, of the root or of a path below it. */
    public static List<String> listing(Path jar, String url, String username, String password,
                                       String path) {
        String out = shell(jar, url, username, password, path == null ? "ls" : "ls " + path);
        List<String> names = new ArrayList<>();
        for (String line : out.replace('\r', '\n').split("\n")) {
            // The shell echoes its prompt and then the first entry on the same line, so the
            // prompt has to be stripped rather than the line skipped - skipping it silently
            // loses one file from every listing.
            String trimmed = line.trim();
            int prompt = trimmed.lastIndexOf("> ");
            if (prompt >= 0)
                trimmed = trimmed.substring(prompt + 2).trim();
            else if (trimmed.endsWith(">"))
                continue;
            if (trimmed.isEmpty() || trimmed.startsWith("WARNING") || trimmed.startsWith("Logging")
                    || trimmed.startsWith("Generating") || trimmed.startsWith("Retrieving")
                    || trimmed.startsWith("Exiting") || trimmed.startsWith("Successfully")
                    || trimmed.startsWith("Current directory") || trimmed.startsWith("INFO:")
                    || trimmed.startsWith("at ") || trimmed.contains("org.jline")
                    || trimmed.matches("^[A-Z][a-z]{2,4} \\d{1,2}, \\d{4} .*"))
                continue;
            names.add(trimmed);
        }
        return names;
    }

    private static String shell(Path jar, String url, String username, String password, String... commands) {
        try {
            List<String> cmd = List.of("java", "-jar", jar.toString(), "shell",
                    "-username", username, "-PEERGOS_PASSWORD", password, "-peergos-url", url);
            Process p = new ProcessBuilder(cmd)
                    .redirectErrorStream(true)
                    .start();
            // Drained on its own thread, and bounded. A shell that never exits used to block
            // readAllBytes for as long as the job was allowed to run, so one stuck upload spent
            // the entire ci budget and reported a timeout of the whole run rather than itself.
            StringBuilder collected = new StringBuilder();
            Thread reader = new Thread(() -> {
                try (BufferedReader r = new BufferedReader(
                        new InputStreamReader(p.getInputStream()))) {
                    String line;
                    while ((line = r.readLine()) != null) {
                        synchronized (collected) {
                            collected.append(line).append('\n');
                        }
                    }
                } catch (IOException e) {
                    // the process went away, which waitFor below reports properly
                }
            });
            reader.setDaemon(true);
            reader.start();
            try (Writer w = new OutputStreamWriter(p.getOutputStream())) {
                for (String c : commands)
                    w.write(c + "\n");
                w.write("exit\n");
            }
            long minutes = "1".equals(System.getenv("PEERGOS_TEST_SLOW")) ? 15 : 8;
            if (! p.waitFor(minutes, TimeUnit.MINUTES)) {
                p.destroyForcibly();
                synchronized (collected) {
                    throw new IllegalStateException("The peergos shell did not finish within "
                            + minutes + " minutes running " + Arrays.toString(commands)
                            + ". Output so far: " + collected);
                }
            }
            reader.join(30_000);
            synchronized (collected) {
                return collected.toString();
            }
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}
