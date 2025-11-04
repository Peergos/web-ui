import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.util.*;
import java.util.stream.*;
import java.util.zip.*;

/** Package Peergos.jar into a self contained installer
 *  Requires at least Java 23
 *  For building rpms on ubuntu install the rpm package
 */
public class PackagePeergos {
    public static final String VERSION = "1.14.0";

    public static void main(String[] a) throws Exception {
        String OS = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String OS_ARCH = getOsArch();
        String ARCH = canonicaliseArchitecture(System.getProperty("os.arch"));

        Files.copy(Paths.get("../server/Peergos.jar"), Paths.get("Peergos.jar"), StandardCopyOption.REPLACE_EXISTING);

        boolean isWin = OS.equals("windows");
        boolean isMac = OS.equals("macos");
        String icon = isWin ? "winicon.ico" : isMac ? "mac-logo-512.icns" : "../assets/images/logo.png";
        String linuxType = System.getenv("LINUX_TARGET");
        if (linuxType == null || ! List.of("deb", "rpm").contains(linuxType))
            linuxType = "deb";
        String type = isWin ? "msi" : isMac ? "pkg": linuxType;
        String resourceDir = "includes/" + type;
        boolean isDeb = type.equals("deb");
        // For debian we build using teh static image compiled from native-image
        if (isDeb) {
            if (ARCH.equals("aarch64"))
                ARCH = "arm64";
            new File("peergos/opt/peergos/bin").mkdirs();
            Files.copy(Paths.get("../native-build/peergos"), Paths.get("peergos/opt/peergos/bin/peergos"), StandardCopyOption.REPLACE_EXISTING);
            List<Path> sharedLibraries = Files.walk(Paths.get("../native-build"), 1)
                .filter(p -> !p.toFile().isDirectory())
                .filter(p -> p.getFileName().toString().endsWith(".so"))
                .toList();
            for (Path sharedLib : sharedLibraries) {
                Files.copy(sharedLib, Paths.get("peergos/opt/peergos/bin/" + sharedLib.getFileName()), StandardCopyOption.REPLACE_EXISTING);
            }
            new File("peergos/DEBIAN").mkdirs();
            long sizeKiB = Files.walk(Paths.get("peergos"))
                                   .filter(p -> p.toFile().isFile())
                                   .mapToLong(p -> p.toFile().length())
                                   .sum()/1024;
            Files.writeString(Paths.get("peergos/DEBIAN/control"),
                              Stream.of("Package: peergos",
                                        "Version: " + VERSION,
                                        "Maintainer: Peergos <peergos@peergos.org>",
                                        "Description: The Peergos server and web interface.",
                                        "Architecture: " + ARCH,
                                        "Installed-Size: " + sizeKiB,
                                        "Provides: peergos",
                                        "Section: utils",
                                        "Homepage: https://peergos.org",
                                        "Priority: optional")
                              .collect(Collectors.joining("\n")) + "\n");
            Files.copy(Paths.get("includes/deb/postinst"), Paths.get("peergos/DEBIAN/postinst"), StandardCopyOption.REPLACE_EXISTING);
            Files.setPosixFilePermissions(Paths.get("peergos/DEBIAN/postinst"), PosixFilePermissions.fromString("r-xr-xr-x"));
            new File("peergos/opt/peergos/lib").mkdirs();
            Files.writeString(Paths.get("peergos/opt/peergos/lib/peergos-peergos.desktop"),
                              Stream.of("[Desktop Entry]",
                                        "Name=peergos",
                                        "Comment=The Peergos server and web interface.",
                                        "Exec=/opt/peergos/bin/peergos",
                                        "Icon=/opt/peergos/lib/peergos.png",
                                        "Terminal=false",
                                        "Type=Application",
                                        "Categories=Peergos",
                                        "MimeType=")
                              .collect(Collectors.joining("\n")));
            Files.setPosixFilePermissions(Paths.get("peergos/opt/peergos/lib/peergos-peergos.desktop"), PosixFilePermissions.fromString("r-xr-xr-x"));
            Files.copy(Paths.get("../assets/images/logo.png"), Paths.get("peergos/opt/peergos/lib/peergos.png"), StandardCopyOption.REPLACE_EXISTING);
            new File("peergos/usr/share/doc/peergos").mkdirs();
            Files.writeString(Paths.get("peergos/usr/share/doc/peergos/copyright"), "Copyright: 2025 Peergos <peergos@peergos.org>\n" +
                              "The entire code base may be distributed under the terms of the GNU General\n" +
                              "Public License (GPL-3), which appears immediately below.\n\n"+
                              "See /usr/share/common-licenses/GPL-3");
        }
        
        if (isWin)
            runCommand("jpackage", "-i", "../server", "-n", "peergos-app",
                       "--main-class", "peergos.server.Main", "--main-jar",
                       "Peergos.jar", "--vendor", "Peergos Ltd.",
                       "--description", "The Peergos server and web interface.",
                       "--copyright", "AGPL",
                       "--about-url", "https://peergos.org",
                       "--type", type,
                       "--icon", icon,
                       "--resource-dir", resourceDir,
                       "--app-version", VERSION,
                       "--vendor", "Peergos LTD",
                       "--win-menu",
                       "--win-shortcut",
                       "--win-shortcut-prompt",
                       "--win-dir-chooser",
                       "--win-upgrade-uuid", "bea010b4-07e7-46af-b870-2d3d3be4d4dd",
                       "--add-launcher", "peergos=windows-cli.properties"
                       );
        else if (isMac) {
            runCommand("security", "find-identity", "-v", "-p", "codesigning", System.getenv("RUNNER_TEMP") + "/app-signing.keychain-db");
            runCommand("java", "SignLibraries.java");
            Files.copy(Paths.get("Peergos.jar"), Paths.get("../server/Peergos.jar"), StandardCopyOption.REPLACE_EXISTING);
            runCommand("jpackage", "-i", "../server", "-n", "peergos",
                       "--main-class", "peergos.server.Main", "--main-jar",
                       "Peergos.jar", "--vendor", "Peergos Ltd.",
                       "--description", "The Peergos server and web interface.",
                       "--copyright", "AGPL",
                       "--about-url", "https://peergos.org",
                       "--type", type,
                       "--icon", icon,
                       "--resource-dir", resourceDir,
                       "--name", "peergos",
                       "--mac-package-name", "Peergos",
                       "--mac-package-identifier", "org.peergos",
                       "--app-version", VERSION,
                       "--mac-sign",
                       "--mac-signing-keychain", System.getenv("RUNNER_TEMP") + "/app-signing.keychain-db",
                       "--mac-package-name", "Peergos",
                       "--mac-signing-key-user-name", "Peergos LTD (XUVT52ZN3F)"
                       );
        } else if (isDeb) {
            runCommand("dpkg-deb", "--root-owner-group", "--build", "peergos");
            /*runCommand("jpackage", "-n", "peergos",
                       "--vendor", "Peergos Ltd.",
                       "--description", "The Peergos server and web interface.",
                       "--copyright", "AGPL",
                       "--linux-rpm-license-type", "AGPL",
                       "--about-url", "https://peergos.org",
                       "--type", type,
                       "--runtime-image", "peergos",
                       "--icon", icon,
                       "--linux-menu-group", "Peergos",
                       "--linux-shortcut",
                       "--resource-dir", resourceDir,
                       "--app-version", VERSION);*/
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
        String releaseName = "peergos-" + VERSION + "-" + (type.equals("deb") ? "ubuntu" : OS) + "-" + ARCH + "." + type;
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
