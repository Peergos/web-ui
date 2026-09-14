import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Scratch directories a test needs while it runs, removed when it is over.
 *
 *  A run leaves a browser profile and a download directory behind for every test, which is
 *  hundreds of megabytes each time. Where the system temp directory is a tmpfs that is enough,
 *  after a few runs, to fail the next one with "No space left on device" - and the symptom is
 *  a page that never loads rather than anything naming the disk.
 */
public class Temp {

    private static final List<Path> made = new ArrayList<>();

    static {
        Runtime.getRuntime().addShutdownHook(new Thread(Temp::cleanUp));
    }

    public static Path directory(String prefix) throws IOException {
        Path dir = Files.createTempDirectory(prefix);
        synchronized (made) {
            made.add(dir);
        }
        return dir;
    }

    /** Best effort: these are under the system temp directory, so a file that will not go is
     *  the operating system's problem to sweep up, not a reason to fail a test. */
    public static void deleteRecursive(Path dir) {
        try (var paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException e) {
                }
            });
        } catch (IOException e) {
        }
    }

    private static void cleanUp() {
        List<Path> copy;
        synchronized (made) {
            copy = new ArrayList<>(made);
            made.clear();
        }
        copy.forEach(Temp::deleteRecursive);
    }
}
