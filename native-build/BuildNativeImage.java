import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.zip.*;
import java.util.*;

public class BuildNativeImage {

    public static void main(String[] a) throws Exception {
        Files.copy(Paths.get("../server/Peergos.jar"), Paths.get("Peergos.jar"), StandardCopyOption.REPLACE_EXISTING);

        String OS = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String OS_ARCH = getOsArch();
        System.out.println("OS-ARCH: " + OS_ARCH);
        String binExt = OS.equals("windows") ? ".cmd" : "";
        String extraDirs = OS.equals("darwin") ? "/Contents/Home" : "";

        String ext = OS.equals("windows") ? ".exe" : "";
        Optional<Path> nativeImage = Files.walk(Paths.get("."), 5)
            .filter(p -> !p.toFile().isDirectory())
            .filter(p -> p.getFileName().toString().endsWith("native-image" + binExt))
            .findFirst();
        if (nativeImage.isEmpty())
            throw new IllegalStateException("Couldn't find native image executable");
        
        // run native-image
        runCommand(nativeImage.get().toString() + " " +
                   "--static-nolibc " +
                   "-H:+UnlockExperimentalVMOptions " +
                   "--enable-http " +
                   "--enable-https " +
                   "-march=compatibility " +
                   "-H:ConfigurationFileDirectories=META-INF/native-image " +
                   "--initialize-at-build-time=org.sqlite.util.ProcessRunner " +
                   "--initialize-at-run-time=io.netty.incubator.codec.quic.ConnectionIdChannelMap " +
                   "--initialize-at-run-time=io.netty.incubator.codec.quic.SecureRandomQuicConnectionIdGenerator " +
                   "--no-fallback " +
                   "-jar Peergos.jar peergos");
        if (! new File("peergos"+ext).exists())
            throw new IllegalStateException("Native build failed!");
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
            return "aarch64";
        if (arch.startsWith("arm"))
            return "arm";
        if (arch.startsWith("amd64") || arch.startsWith("x86_64"))
            return "x64";
        if (arch.startsWith("x86"))
            return "386";
        return arch;
    }

    private static String canonicaliseOS(String os) {
        if (os.startsWith("mac"))
            return "macos";
        if (os.startsWith("windows"))
            return "windows";
        return os;
    }
}
