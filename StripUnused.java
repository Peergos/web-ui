import java.nio.file.*;
import java.util.*;
import java.util.stream.*;

/** Remove dependency contents that no platform uses from a jar, in place.
 *
 *  java StripUnused.java &lt;jar&gt;
 */
public class StripUnused {
    // org/bouncycastle/pqc can't go: new BouncyCastleProvider() instantiates PQC key factories, and libp2p's ECDSA keys need the provider
    private static final List<String> UNUSED = List.of(
            "redis/clients/jedis/", // only nabu's InteropTestClient
            "META-INF/maven/redis.clients/",
            "peergos/server/tests/");

    public static void main(String[] args) throws Exception {
        Path jar = Path.of(args[0]);
        long before = Files.size(jar);
        int removed = 0;
        try (FileSystem zip = FileSystems.newFileSystem(jar)) {
            for (String prefix : UNUSED) {
                Path dir = zip.getPath("/" + prefix);
                if (! Files.exists(dir))
                    continue;
                List<Path> all;
                try (Stream<Path> s = Files.walk(dir)) {
                    all = s.sorted(Comparator.reverseOrder()).toList();
                }
                for (Path p : all) {
                    Files.delete(p);
                    removed++;
                }
            }
        }
        System.out.printf("Removed %d entries from %s, %d -> %d bytes%n", removed, jar, before, Files.size(jar));
    }
}
