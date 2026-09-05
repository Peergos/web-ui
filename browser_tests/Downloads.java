import peergos.shared.util.PathUtil;

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

    /** Waits for whatever file appears with this prefix and suffix.
     *
     *  For downloads whose exact name the app decides - the zip is numbered from a counter on a
     *  component the test does not own - so that reading the wrong number cannot be mistaken for
     *  the download never arriving.
     */
    public static Result awaitMatching(Path dir, String prefix, String suffix,
                                       long timeoutMillis, long quietMillis) {
        long end = System.currentTimeMillis() + timeoutMillis;
        while (System.currentTimeMillis() < end) {
            try (var s = Files.list(dir)) {
                Optional<String> found = s.map(p -> p.getFileName().toString())
                        .filter(n -> n.startsWith(prefix) && n.endsWith(suffix))
                        .findFirst();
                if (found.isPresent())
                    return await(dir, found.get(), timeoutMillis, quietMillis);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
            WebDriver.sleep(500);
        }
        // Nothing arrived under its final name, so report a partial if one is sitting there. A
        // download that started and never finished and one that never started at all both leave
        // no file matching the suffix, and only the partial tells them apart.
        try (var s = Files.list(dir)) {
            List<Path> partial = s.filter(p -> p.getFileName().toString().startsWith(prefix))
                    .filter(p -> isPartial(p.getFileName().toString()))
                    .toList();
            if (! partial.isEmpty())
                return new Result(partial.get(0), totalSize(partial), true);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        return new Result(null, 0, true);
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

    /** Everything actually in the download directory, with sizes.
     *
     *  What a browser calls a download in progress is convention, not contract - a duplicate gets
     *  renamed, a partial is suffixed differently by every engine - so when nothing matched, the
     *  directory itself is the evidence, rather than another guess at the naming.
     */
    public static String listing(Path dir) {
        try (var s = Files.list(dir)) {
            List<String> entries = s.map(p -> {
                try {
                    return p.getFileName() + " (" + Files.size(p) + ")";
                } catch (IOException e) {
                    return p.getFileName() + " (gone)";
                }
            }).sorted().toList();
            return entries.isEmpty() ? "the download directory is empty" : String.join(", ", entries);
        } catch (IOException e) {
            return "could not list " + dir + ": " + e;
        }
    }

    /** Anything under the temp tree whose name looks like this download.
     *
     *  A browser decides for itself where to write a partial, and it is not obliged to be the
     *  directory it was told to save into. When the destination is empty the question is whether
     *  the file exists at all - so this asks that, rather than assuming the answer.
     */
    public static String findAnywhere(Path root, String namePrefix) {
        long deadline = System.currentTimeMillis() + 30_000;
        List<String> hits = new ArrayList<>();
        try {
            // A visitor rather than a stream walk: a temp directory holds things that are not
            // ours to read, and a walk gives up on the whole search the first time it meets one.
            Files.walkFileTree(root, java.util.Set.of(), 4,
                    new java.nio.file.SimpleFileVisitor<Path>() {
                @Override
                public java.nio.file.FileVisitResult visitFile(Path p,
                        java.nio.file.attribute.BasicFileAttributes attrs) {
                    if (p.getFileName().toString().startsWith(namePrefix))
                        hits.add(p + " (" + attrs.size() + ")");
                    return hits.size() >= 20 || System.currentTimeMillis() > deadline
                            ? java.nio.file.FileVisitResult.TERMINATE
                            : java.nio.file.FileVisitResult.CONTINUE;
                }

                @Override
                public java.nio.file.FileVisitResult visitFileFailed(Path p, IOException e) {
                    return java.nio.file.FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            return "could not search " + root + ": " + e;
        }
        return hits.isEmpty() ? "nothing named " + namePrefix + "* anywhere under " + root
                : String.join(", ", hits);
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
