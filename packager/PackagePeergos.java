import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;

/** Package Peergos.jar into a self contained installer
 *  Requires at least Java 23
 *  For building rpms on ubuntu install the rpm package
 */
public class PackagePeergos {
    public static final String VERSION = "1.0.0";

    public static void main(String[] a) throws Exception {
        String OS = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String OS_ARCH = getOsArch();
        String ARCH = canonicaliseArchitecture(System.getProperty("os.arch"));

        Files.copy(Paths.get("../server/Peergos.jar"), Paths.get("Peergos.jar"), StandardCopyOption.REPLACE_EXISTING);

        boolean isWin = OS.equals("windows");
        boolean isMac = OS.equals("macos");
        String icon = isWin ? "winicon.ico" : "../assets/images/logo.png";
        String linuxType = System.getenv("LINUX_TARGET");
        if (linuxType == null || ! List.of("deb", "rpm").contains(linuxType))
            linuxType = "deb";
        String type = isWin ? "msi" : isMac ? "pkg": linuxType;
        String resourceDir = type.equals("rpm") ? "includes/rpm" : "deb-resources";
        if (isWin)
            runCommand("jpackage", "-i", "../server", "-n", "peergos-app",
                       "--main-class", "peergos.server.Main", "--main-jar",
                       "Peergos.jar", "--vendor", "Peergos Ltd.",
                       "--description", "The Peergos server and web interface.",
                       "--copyright", "AGPL",
                       "--about-url", "https://peergos.org",
                       "--type", type,
                       "--icon", icon,
                       "--resource-dir", "deb-resources",
                       "--app-version", VERSION,
                       "--vendor", "Peergos LTD",
                       "--win-menu",
                       "--win-shortcut",
                       "--win-shortcut-prompt",
                       "--win-dir-chooser",
                       "--add-launcher", "peergos=windows-cli.properties"
                       );
        else if (isMac) {
            runCommand("security", "find-identity", "-v", "-p", "codesigning", System.getenv("RUNNER_TEMP") + "/app-signing.keychain-db");
            runCommand("java", "SignLibraries.java");
            runCommand("jpackage", "-i", "../server", "-n", "peergos",
                       "--main-class", "peergos.server.Main", "--main-jar",
                       "Peergos.jar", "--vendor", "Peergos Ltd.",
                       "--description", "The Peergos server and web interface.",
                       "--copyright", "AGPL",
                       "--about-url", "https://peergos.org",
                       "--type", type,
                       "--icon", icon,
                       "--resource-dir", "deb-resources",
                       "--name", "peergos",
                       "--mac-package-name", "Peergos",
                       "--mac-package-identifier", "org.peergos",
                       "--app-version", VERSION,
                       "--mac-sign",
                       "--mac-signing-keychain", System.getenv("RUNNER_TEMP") + "/app-signing.keychain-db",
                       "--mac-package-name", "Peergos",
                       "--mac-signing-key-user-name", "Peergos LTD (XUVT52ZN3F)"
                       );
        } else
            runCommand("jpackage", "-i", "../server", "-n", "peergos",
                       "--main-class", "peergos.server.Main", "--main-jar",
                       "Peergos.jar", "--vendor", "Peergos Ltd.",
                       "--description", "The Peergos server and web interface.",
                       "--copyright", "AGPL",
                       "--linux-rpm-license-type", "AGPL",
                       "--about-url", "https://peergos.org",
                       "--type", type,
                       "--icon", icon,
                       "--linux-menu-group", "Peergos",
                       "--linux-shortcut",
                       "--resource-dir", resourceDir,
                       "--app-version", VERSION);
        String artifact = Files.list(Paths.get(""))
            .map(f -> f.toString())
            .filter(n -> n.endsWith(type))
            .findFirst().get();
        
        // Canonicalise artifact name
        String releaseName = "peergos-" + VERSION + "-" + OS + "-" + ARCH + "." + type;
        Files.move(Paths.get(artifact), Paths.get(releaseName), StandardCopyOption.ATOMIC_MOVE);
        artifact = releaseName;
        
        String envVarName = type.equals("rpm") ? "artifact2" : "artifact";
        System.out.println(envVarName + ": " + artifact);
        if (OS.equals("windows")) {
            // write artifact name to a file which a separate ci step then puts in an env var
            Files.write(Paths.get("artifact"), ("artifact=" + artifact).getBytes(), StandardOpenOption.CREATE);
        } else
            runCommand("./setenv.sh", envVarName + "="+artifact);
    }

    public static int redirectOutput(String outputFile, String... command) throws Exception {
        System.out.println(Arrays.asList(command) + " >> " + outputFile);
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectError(ProcessBuilder.Redirect.INHERIT);
        pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
        return pb.start().waitFor();
    }

    public static int runCommand(String... command) throws Exception {
        System.out.println(Arrays.asList(command));
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
            return "macos";
        if (os.startsWith("windows"))
            return "windows";
        return os;
    }
}
