import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.*;

/** Remove native libraries for other platforms from a jar, in place.
 *
 *  java StripNatives.java &lt;jar&gt;
 *
 *  Keeps only the Linux glibc libraries for the arch this runs on. The dependencies each lay out
 *  their natives differently (linux_x86_64, x86_64-Linux, linux/amd64, Linux/arm64, ...) so this
 *  matches os and arch names anywhere in the path rather than a fixed layout.
 */
public class StripNatives {
    private static final Pattern NATIVE = Pattern.compile("\\.(so|dll|dylib|jnilib|a)$");
    private static final Pattern X86_64 = Pattern.compile("(?<![a-z0-9])(x86[_-]64|amd64)(?![a-z0-9])");
    private static final Pattern AARCH64 = Pattern.compile("(?<![a-z0-9])(aarch_?64|arm64)(?![a-z0-9])");

    public static void main(String[] args) throws Exception {
        if (! System.getProperty("os.name").equals("Linux"))
            throw new IllegalStateException("Only Linux is supported");
        Pattern arch = switch (System.getProperty("os.arch")) {
            case "amd64" -> X86_64;
            case "aarch64" -> AARCH64;
            default -> throw new IllegalStateException("Unsupported arch " + System.getProperty("os.arch"));
        };
        Path jar = Path.of(args[0]);
        long before = Files.size(jar);
        try (FileSystem zip = FileSystems.newFileSystem(jar)) {
            List<Path> natives;
            try (Stream<Path> all = Files.walk(zip.getPath("/"))) {
                natives = all.filter(p -> NATIVE.matcher(p.toString()).find()).toList();
            }
            for (Path p : natives) {
                String name = p.toString().toLowerCase();
                boolean keep = name.contains("linux") && ! name.contains("android") && ! name.contains("musl")
                        && arch.matcher(name).find();
                if (keep)
                    System.out.println("Keeping " + p);
                else
                    Files.delete(p);
            }
        }
        System.out.printf("Stripped %s from %d to %d bytes%n", jar, before, Files.size(jar));
    }
}
