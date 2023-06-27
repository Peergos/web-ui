import java.nio.charset.*;
import java.nio.file.*;

public class RemoveGwtError {

    public static void main(String[] a) throws Exception {
        Path file = Paths.get("peergos/war/peergoslib/peergoslib.nocache.js");
        String gwt = Files.readString(file);
        String replaced = gwt.replaceFirst("function assertCompileTimeUserAgent\\(\\)\\{\n" +
                "  var runtimeValue;\n" +
                "  runtimeValue = \\$getRuntimeValue\\(\\);\n" +
                "  if \\(!\\$equals_0\\('safari', runtimeValue\\)\\) \\{\n" +
                "    throw toJs\\(new UserAgentAsserter\\$UserAgentAssertionError\\(runtimeValue\\)\\);\n" +
                "  }\n" +
                "}", "function assertCompileTimeUserAgent(){\n}");
        Files.write(file, replaced.getBytes(StandardCharsets.UTF_8));
    }
}
