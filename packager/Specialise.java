import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.*;

/** Remove native libraries for other platforms from a jar, in place.
 *
 *  java Specialise.java &lt;jar&gt; [linux|macos|windows] [x86_64|aarch64]
 *
 *  The OS and arch default to the current machine. The dependencies each lay out their natives
 *  differently (linux_x86_64, x86_64-Linux, linux/amd64, Mac/arm64, Darwin, ...) so this finds os and
 *  arch names anywhere in the path. A library is kept unless it names a different os or arch, so
 *  universal ones (jni/Darwin/libjffi-1.2.jnilib) and platform-neutral ones survive.
 */
public class Specialise {
    private static final Pattern NATIVE = Pattern.compile("\\.(so|dll|dylib|jnilib|a)$");
    private static final Pattern OS = Pattern.compile("(?<![a-z0-9])(linux|android|musl|macos|mac|osx|darwin|windows|freebsd|openbsd|dragonflybsd|sunos|aix)(?![a-z0-9])");
    private static final Pattern ARCH = Pattern.compile("(?<![a-z0-9])(x86[_-]64|amd64|aarch_?64|arm64|armv[0-9]+|arm|x86|i386|ppc64le|ppc64|ppc|s390x|sparcv9|mips64el|loongarch64|riscv64)(?![a-z0-9])");

    public static void main(String[] args) throws Exception {
        Path jar = Path.of(args[0]);
        String os = canonicalOs(args.length > 1 ? args[1] : System.getProperty("os.name"));
        String arch = canonicalArch(args.length > 2 ? args[2] : System.getProperty("os.arch"));
        long before = Files.size(jar);
        try (FileSystem zip = FileSystems.newFileSystem(jar)) {
            List<Path> natives;
            try (Stream<Path> all = Files.walk(zip.getPath("/"))) {
                natives = all.filter(p -> NATIVE.matcher(p.toString()).find()).toList();
            }
            for (Path p : natives) {
                if (keep(p.toString().toLowerCase(), os, arch))
                    System.out.println("Keeping " + p);
                else
                    Files.delete(p);
            }
        }
        System.out.printf("Specialised %s to %s-%s, %d -> %d bytes%n", jar, os, arch, before, Files.size(jar));
    }

    static boolean keep(String path, String os, String arch) {
        Set<String> oses = tokens(OS, path, Specialise::canonicalOs);
        if (path.endsWith(".dll"))
            oses.add("windows");
        else if (path.endsWith(".dylib") || path.endsWith(".jnilib"))
            oses.add("macos");
        else if (path.endsWith(".a"))
            oses.add("aix");
        if (! oses.isEmpty() && ! oses.equals(Set.of(os)))
            return false;
        Set<String> arches = tokens(ARCH, path, Specialise::canonicalArch);
        return arches.isEmpty() || arches.equals(Set.of(arch));
    }

    static Set<String> tokens(Pattern p, String path, java.util.function.Function<String, String> canonical) {
        Set<String> res = new HashSet<>();
        Matcher m = p.matcher(path);
        while (m.find())
            res.add(canonical.apply(m.group(1)));
        return res;
    }

    static String canonicalOs(String os) {
        String s = os.toLowerCase();
        if (s.startsWith("mac") || s.equals("osx") || s.equals("darwin"))
            return "macos";
        if (s.startsWith("windows"))
            return "windows";
        return s;
    }

    static String canonicalArch(String arch) {
        return switch (arch.toLowerCase()) {
            case "x86_64", "x86-64", "amd64" -> "x86_64";
            case "aarch64", "aarch_64", "arm64" -> "aarch64";
            default -> arch.toLowerCase();
        };
    }
}
