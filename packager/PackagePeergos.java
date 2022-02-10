import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.zip.*;

/** Package Peergos.jar into a self contained installer
 *  Requires at least Java 14
 */
public class PackagePeergos {

    public static void main(String[] a) throws Exception {
        String OS = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String OS_ARCH = getOsArch();

        Files.copy(Paths.get("../server/Peergos.jar"), Paths.get("Peergos.jar"), StandardCopyOption.REPLACE_EXISTING);
        
        if (OS.equals("linux"))
            runCommand("jpackage", "-i", "../server", "-n", "peergos",
                       "--main-class", "peergos.server.Main", "--main-jar",
                       "Peergos.jar", "--vendor", "Peergos Ltd.",
                       "--description", "The Peergos server and web interface.",
                       "--copyright", "AGPL",
                       "--icon", "../assets/images/logo.png",
                       "--resource-dir", "deb-resources",
                       "--app-version", "0.5.0");
    }

    public static int runCommand(String... command) throws Exception {
        System.out.println(command);
        ProcessBuilder pb = new ProcessBuilder(command);
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
            return "amd64";
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
