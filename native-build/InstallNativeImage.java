import java.io.*;
import java.net.*;
import java.util.zip.*;

public class InstallNativeImage {

    public static void main(String[] a) throws Exception {
        String VERSION = "22.3.3";
        
        String OS = canonicaliseOS(System.getProperty("os.name").toLowerCase());
        String OS_ARCH = getOsArch();       
        System.out.println("OS-ARCH: " + OS_ARCH);
        String ext = OS.equals("windows") ? ".zip" : ".tar.gz";
        String JAVA_VERSION = "java17";
        String filename = "graalvm-ce-" + JAVA_VERSION + "-" + OS_ARCH + "-"+VERSION+ext;
        String url = "https://github.com/graalvm/graalvm-ce-builds/releases/download/vm-" +VERSION +"/" + filename;

        // Download graalVM
        if (! new File(filename).exists())
            download(url, new File(filename));
        String tar = OS.equals("windows") ? "unzip" : "tar -zxvf";

        // unzip GraalVM
        runCommand(tar + " " + filename);

        // install native-image
        String binExt = OS.equals("windows") ? ".cmd" : "";
        String extraDirs = OS.equals("darwin") ? "/Contents/Home" : "";
        runCommand("./graalvm-ce-" + JAVA_VERSION + "-" + VERSION + extraDirs + "/bin/gu" + binExt + " install native-image");

        if (new File("graalvm-ce-" + JAVA_VERSION + "-"+VERSION + extraDirs + "/bin/native-image" + binExt).exists())
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
