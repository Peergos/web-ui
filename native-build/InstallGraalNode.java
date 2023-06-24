import java.io.*;
import java.net.*;
import java.util.stream.*;
import java.util.zip.*;

public class InstallNativeImage {

    public static void main(String[] a) throws Exception {
        String VERSION = "17.0.7"; // This is graalvm 23.0.0
        
        String OS = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String OS_ARCH = getOsArch();       
        System.out.println("OS-ARCH: " + OS_ARCH);
        String ext = OS.equals("windows") ? ".zip" : ".tar.gz";
        String JAVA_VERSION = "java17";
        String filename = "graalvm-community-jdk-" + VERSION + "_" + OS_ARCH + "_bin"+ext;
        String url = "https://github.com/graalvm/graalvm-ce-builds/releases/download/jdk-" +VERSION +"/" + filename;

        // Download graalVM
        if (! new File(filename).exists())
            download(url, new File(filename));
        String tar = OS.equals("windows") ? "unzip" : "tar -zxvf";

        // unzip GraalVM
        runCommand(tar + " " + filename);

        // install native-image
        String binExt = OS.equals("windows") ? ".cmd" : "";
        String extraDirs = OS.equals("darwin") ? "/Contents/Home" : "";
        String dir = Stream.of(new File(".").listFiles())
            .filter(f -> f.isDirectory() && f.getName().startsWith("graalvm-community"))
            .map(f -> f.getName())
            .findFirst()
            .get();
        System.out.println("Running graalvm from " + dir);
        runCommand("./" + dir + extraDirs + "/bin/gu" + binExt + " install js");
        runCommand("./" + dir + extraDirs + "/bin/gu" + binExt + " install nodejs");
        runCommand("./" + dir + extraDirs + "/bin/gu" + binExt + " install wasm");

        if (new File(dir + extraDirs + "/bin/node" + binExt).exists())
            System.out.println("graal nodejs installed");
        else
            throw new IllegalStateException("graal nodejs not installed...");
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
            return "macos";
        if (os.startsWith("windows"))
            return "windows";
        return os;
    }
}
