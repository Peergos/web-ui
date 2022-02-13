import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;

/** Compile submodule into Jar and JS
 */
public class CompileSubmodule {

    public static void main(String[] a) throws Exception {
        runCommand("peergos", "ant", "dist");
        runCommand("peergos", "ant", "gwtc");
    }

    public static int runCommand(String dir, String... command) throws Exception {
        System.out.println(Arrays.asList(command));
        ProcessBuilder pb = new ProcessBuilder(command).directory(new File(dir));
        pb.redirectError(ProcessBuilder.Redirect.INHERIT);
        pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
        return pb.start().waitFor();
    }
}
