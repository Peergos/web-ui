import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;

/** Extract Apple notary id from log file and put it in env var
 */
public class GetNotaryId {

    public static void main(String[] args) throws Exception {
        
        List<String> log = Files.readAllLines(Paths.get("notary.output"));
        String idLine = log.stream().filter(a -> a.trim().startsWith("id:")).findFirst().get();
        String id = idLine.trim().substring(4);
        String envVarName = "notaryid";
        System.out.println(envVarName + ": " + id);
        runCommand("./setenv.sh", envVarName + "="+id);
    }

    public static int runCommand(String... command) throws Exception {
        System.out.println(Arrays.asList(command));
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectError(ProcessBuilder.Redirect.INHERIT);
        pb.redirectOutput(ProcessBuilder.Redirect.INHERIT);
        return pb.start().waitFor();
    }
}
