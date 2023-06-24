import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.zip.*;

public class RunNode {

    public static void main(String[] a) throws Exception {
        String VERSION = "17.0.7"; // This is graalvm 23.0.0

        String OS = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String OS_ARCH = getOsArch();
        System.out.println("OS-ARCH: " + OS_ARCH);
        String binExt = OS.equals("windows") ? ".cmd" : "";
        String extraDirs = OS.equals("darwin") ? "/Contents/Home" : "";
        String dir = Stream.of(new File(".").listFiles())
            .filter(f -> f.isDirectory() && f.getName().startsWith("graalvm-community"))
            .map(f -> f.getName())
            .findFirst()
            .get();
        System.out.println("Running graalvm from " + dir);

        if (! new File(dir + extraDirs + "/bin/native-image" + binExt).exists())
            throw new IllegalStateException("native-image not installed...");
        String ext = OS.equals("windows") ? ".exe" : "";

        // run command in graal nodejs
        runCommand(dir + extraDirs + "/bin/node" + binExt +
                   " --experimental-options --js.webassembly --polyglot " +
                   Stream.of(a).collect(Collectors.joining(" ")));
    }

    public static int runCommand(String command) throws Exception {
        System.out.println(command);
        ProcessBuilder pb = new ProcessBuilder(command.split(" "));
        pb.redirectError(ProcessBuilder.Redirect.INHERIT);
        pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
        return pb.start().waitFor();
    }

    private static String getOsArch() {
        String os = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String arch = canonicaliseArchitecture(System.getProperty("os.arch"));

        return os + "-" + arch;
    }

    private static String canonicaliseArchitecture(String arch) {
        if (arch.startsWith("arm64"))
            return "arm64";
        if (arch.startsWith("arm"))
            return "arm";
        if (arch.startsWith("x86_64"))
            return "x64";
        if (arch.startsWith("amd64"))
            return "x64";
        if (arch.startsWith("x86"))
            return "386";
        return arch;
    }

    private static String canonicaliseOS(String os) {
        if (os.startsWith("mac"))
            return "darwin";
        if (os.startsWith("windows"))
            return "windows";
        return os;
    }
}
