import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.zip.*;

/** Extract native libraries from jar and sign them for Apple
 */
public class SignLibraries {

    public static void main(String[] args) throws Exception {
        runCommand("unzip", "Peergos.jar", "*.dylib");
        runCommand("unzip", "Peergos.jar", "*.jnilib");
        Files.walkFileTree(Paths.get("."), new FileVisitor<Path>() {
            @Override
            public FileVisitResult preVisitDirectory(Path path, BasicFileAttributes basicFileAttributes) throws IOException {
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path path, BasicFileAttributes basicFileAttributes) throws IOException {
                String filename = path.getFileName().toString();
                if (filename.endsWith("dylib") || filename.endsWith("jnilib")) {
                    System.out.println("Signing: " + path);
                    try {
                        runCommand("codesign", "--force", "--options", "runtime", "--timestamp", "--keychain", System.getenv("RUNNER_TEMP") + "/app-signing.keychain-db", "--sign", "Peergos LTD (XUVT52ZN3F)", path.toString());
                        runCommand("jar", "uf", "Peergos.jar", path.toString());
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path path, IOException e) throws IOException {
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult postVisitDirectory(Path path, IOException e) throws IOException {
                return FileVisitResult.CONTINUE;
            }
        });
        
    }

    public static int runCommand(String... command) throws Exception {
        System.out.println(Arrays.asList(command));
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectError(ProcessBuilder.Redirect.INHERIT);
        pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
        return pb.start().waitFor();
    }
}
