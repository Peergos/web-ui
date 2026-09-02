import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Waiting on browser downloads, and asserting they are actually the file that was asked for.
 *
 *  W3C WebDriver has no download api, so this is all convention. Each engine names its partial
 *  file differently:
 *
 *    Firefox     name.RANDOM.bin.part
 *    Chromium    name.bin.crdownload
 *    WebKitGTK   no partial file at all, it writes straight to the destination
 *
 *  The distinction that matters is stalled versus slow. The bug fixed in 3cee931b left a file
 *  of entirely plausible size sitting on disk, finalised, and only its hash showed it was 40MB
 *  of a 150MB file. So completion is "the partial marker is gone and the size stopped moving",
 *  and the assertion is always against the source bytes.
 */
public class Downloads {

    public static class Result {
        public final Path path;
        public final long size;
        public final boolean stalled;

        Result(Path path, long size, boolean stalled) {
            this.path = path;
            this.size = size;
            this.stalled = stalled;
        }

        @Override
        public String toString() {
            return (path == null ? "<none>" : path.getFileName().toString())
                    + " " + size + " bytes" + (stalled ? " STALLED" : "");
        }
    }

    private static boolean isPartial(String name) {
        return name.endsWith(".part") || name.endsWith(".crdownload");
    }

    /** Every file in the directory that looks like it belongs to this download. */
    private static List<Path> candidates(Path dir, String name) throws IOException {
        String stem = name.contains(".") ? name.substring(0, name.lastIndexOf('.')) : name;
        try (var s = Files.list(dir)) {
            return s.filter(p -> {
                String f = p.getFileName().toString();
                return f.equals(name) || f.startsWith(name) || f.startsWith(stem + ".");
            }).toList();
        }
    }

    private static long totalSize(List<Path> paths) {
        long total = 0;
        for (Path p : paths) {
            try {
                total += Files.size(p);
            } catch (IOException e) {
                // it was renamed out from under us mid poll, which the next round picks up
            }
        }
        return total;
    }

    /** Waits for a download to finish, or to stop making progress.
     *
     *  @param quietMillis how long the size may stand still before we call it stalled
     */
    public static Result await(Path dir, String name, long timeoutMillis, long quietMillis) {
        long end = System.currentTimeMillis() + timeoutMillis;
        long lastSize = -1;
        long lastChange = System.currentTimeMillis();
        try {
            while (System.currentTimeMillis() < end) {
                List<Path> found = candidates(dir, name);
                boolean anyPartial = found.stream()
                        .anyMatch(p -> isPartial(p.getFileName().toString()));
                Optional<Path> complete = found.stream()
                        .filter(p -> ! isPartial(p.getFileName().toString()))
                        .filter(p -> p.getFileName().toString().equals(name))
                        .findFirst();
                long size = totalSize(found);
                if (size != lastSize) {
                    lastSize = size;
                    lastChange = System.currentTimeMillis();
                }
                // Firefox creates the final name as a zero byte placeholder while the .part
                // fills, so a complete file only counts once no partial remains beside it.
                if (complete.isPresent() && ! anyPartial && size > 0
                        && System.currentTimeMillis() - lastChange > 1000)
                    return new Result(complete.get(), Files.size(complete.get()), false);
                if (! found.isEmpty() && System.currentTimeMillis() - lastChange > quietMillis)
                    return new Result(found.get(0), size, true);
                WebDriver.sleep(250);
            }
            List<Path> found = candidates(dir, name);
            return new Result(found.isEmpty() ? null : found.get(0), totalSize(found), true);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public static String sha256(Path p) {
        try (InputStream in = Files.newInputStream(p)) {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[1 << 20];
            int read;
            while ((read = in.read(buf)) > 0)
                md.update(buf, 0, read);
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest())
                sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** The assertion that matters: right length and right bytes, not merely a file that exists. */
    public static void assertMatches(Result result, Path source, long expectedSize) {
        if (result.path == null)
            throw new AssertionError("No download appeared at all");
        if (result.stalled)
            throw new AssertionError("Download stalled at " + result.size + " of " + expectedSize
                    + " bytes: " + result.path);
        if (result.size != expectedSize)
            throw new AssertionError("Download is " + result.size + " bytes, expected "
                    + expectedSize + ": " + result.path);
        String got = sha256(result.path), want = sha256(source);
        if (! got.equals(want))
            throw new AssertionError("Download hash " + got + " does not match source " + want);
    }
}
