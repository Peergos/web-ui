import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.zip.*;
import java.util.*;

public class InstallNativeImage {

    public static void main(String[] a) throws Exception {
        String VERSION = "25.0.1";
        
        String OS = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String OS_ARCH = getOsArch();       
        System.out.println("OS-ARCH: " + OS_ARCH);
        String ext = OS.equals("windows") ? "bin.zip" : "bin.tar.gz";
        String filename = "graalvm-community-jdk-" + VERSION + "_" + OS_ARCH + "_"+ext;
        String url = "https://github.com/graalvm/graalvm-ce-builds/releases/download/jdk-" +VERSION +"/" + filename;

        // Download graalVM
        if (! new File(filename).exists())
            download(url, new File(filename));
        String tar = OS.equals("windows") ? "unzip" : "tar -zxvf";

        // unzip GraalVM
        runCommand(tar + " " + filename);

        // install native-image
        String binExt = OS.equals("windows") ? ".cmd" : "";

        Optional<Path> nativeImage = Files.walk(Paths.get("."), 5)
            .filter(p ->  p.getFileName().toString().contains("native-image") && !p.toFile().isDirectory())
            .findFirst();
        
        if (nativeImage.isPresent())
            System.out.println("native-image installed");
        else
            throw new IllegalStateException("native-image not installed...");
    }

    public static void download(String url, File output) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setDoInput(true);

        String contentEncoding = conn.getContentEncoding();
        boolean isGzipped = "gzip".equals(contentEncoding);
        DataInputStream din = new DataInputStream(isGzipped ? new GZIPInputStream(conn.getInputStream()) : conn.getInputStream());
        byte[] buf = new byte[4*1024];
        OutputStream fout = new BufferedOutputStream(new FileOutputStream(output));
        int nRead;
        while ((nRead = din.read(buf, 0, buf.length)) != -1 )
            fout.write(buf, 0, nRead);
        din.close();
        fout.flush();
        fout.close();
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
