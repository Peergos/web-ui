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
        if (!new File(dir).isDirectory()) {
            throw new IllegalArgumentException("Not a valid directory: " + dir);
        }
        File workDir = new File(dir).getCanonicalFile();
        if (isWindows()) {
            new ProcessBuilder("cmd", "/c", "ant", "dist").directory(workDir).inheritIO().start().waitFor();
            new ProcessBuilder("cmd", "/c", "ant", "gwtc").directory(workDir).inheritIO().start().waitFor();
        } else {
            new ProcessBuilder("ant", "dist").directory(workDir).inheritIO().start().waitFor();
            new ProcessBuilder("ant", "gwtc").directory(workDir).inheritIO().start().waitFor();
        }
        replaceUserAgentCheck(dir);
    }

    public static void replaceUserAgentCheck(String dir) throws Exception {
        Path peergosLib = Paths.get(dir + "/war/peergoslib/peergoslib.nocache.js");
        String updated = Files.readString(peergosLib).replaceAll("var ua = navigator.userAgent.toLowerCase\\(\\);", "var ua = \"webkit\";");
        Files.writeString(peergosLib, updated, StandardOpenOption.TRUNCATE_EXISTING);
    }

    public static boolean isWindows() {
        return System.getProperty("os.name").toLowerCase().startsWith("windows");
    }
}
