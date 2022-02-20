import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;

/** Compile submodule into Jar and JS
 */
public class CompileSubmodule {

    public static void main(String[] a) throws Exception {
        String dir = a[0];
        if (isWindows()) {
            runCommand(dir, "cmd", "/c", "ant", "dist");
            runCommand(dir, "cmd", "/c", "ant", "gwtc");
        } else {
            runCommand(dir, "ant", "dist");
            runCommand(dir, "ant", "gwtc");
        }
    }

    public static int runCommand(String dir, String... command) throws Exception {
        System.out.println(Arrays.asList(command));
        ProcessBuilder pb = new ProcessBuilder(command).directory(new File(dir));
        pb.redirectError(ProcessBuilder.Redirect.INHERIT);
        pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
        return pb.start().waitFor();
    }

    public static boolean isWindows() {
        return System.getProperty("os.name").toLowerCase().startsWith("windows");
    }
}
