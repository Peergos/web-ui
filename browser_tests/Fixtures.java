import java.io.*;
import java.nio.file.*;
import java.util.*;

/** Test files, created by the test rather than assumed to be sitting on the server.
 *
 *  The first version of the download test used two files that happened to be in the drive
 *  already. They were gone by the next day and the test failed with "no such file", which is a
 *  worse failure than the bug it was meant to catch. Fixtures are uploaded with the Peergos
 *  shell, not through the ui: setting up through the api and asserting through the browser keeps
 *  a download test from failing for upload reasons.
 */
public class Fixtures {

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

    public static List<String> listing(Path jar, String url, String username, String password) {
        String out = shell(jar, url, username, password, "ls");
        List<String> names = new ArrayList<>();
        for (String line : out.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.contains("@" + url) || trimmed.startsWith("WARNING")
                    || trimmed.startsWith("Logging") || trimmed.startsWith("Generating")
                    || trimmed.startsWith("Retrieving") || trimmed.startsWith("Exiting"))
                continue;
            // the prompt is echoed before the first entry
            int prompt = trimmed.lastIndexOf("> ");
            names.add(prompt >= 0 ? trimmed.substring(prompt + 2) : trimmed);
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
            try (Writer w = new OutputStreamWriter(p.getOutputStream())) {
                for (String c : commands)
                    w.write(c + "\n");
                w.write("exit\n");
            }
            String out = new String(p.getInputStream().readAllBytes());
            p.waitFor();
            return out;
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}
