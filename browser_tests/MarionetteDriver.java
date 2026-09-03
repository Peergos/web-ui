import peergos.shared.io.ipfs.api.JSONParser;

import java.io.*;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Firefox over Marionette, the protocol built into the browser.
 *
 *  Frames are length prefixed json, "<byte length>:<json>". A command is
 *  [0, messageId, name, params] and the reply [1, messageId, error, result]. The command names
 *  are W3C's, so this is the same vocabulary as HttpDriver, just a different envelope.
 */
public class MarionetteDriver implements WebDriver {

    private static final String ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";

    private final Socket socket;
    private final InputStream in;
    private final OutputStream out;
    private final Process browser;
    private final String marker;
    private int messageId = 0;

    public MarionetteDriver(int port, Process browser) {
        this(port, browser, null);
    }

    public MarionetteDriver(int port, Process browser, String marker) {
        this.browser = browser;
        this.marker = marker;
        try {
            Socket s = null;
            long end = System.currentTimeMillis() + 60_000;
            while (s == null && System.currentTimeMillis() < end) {
                try {
                    s = new Socket("127.0.0.1", port);
                } catch (IOException e) {
                    WebDriver.sleep(250);
                }
            }
            if (s == null)
                throw new IllegalStateException("Firefox never opened marionette on port " + port);
            this.socket = s;
            this.socket.setSoTimeout(600_000);
            this.in = s.getInputStream();
            this.out = s.getOutputStream();
            readFrame(); // the server's handshake
            command("WebDriver:NewSession", Map.of("capabilities", Map.of()));
            focusAWindow();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private synchronized Object command(String name, Map<String, Object> params) {
        try {
            int id = ++messageId;
            String msg = JSONParser.toString(Arrays.asList(0, id, name, params));
            byte[] body = msg.getBytes(StandardCharsets.UTF_8);
            out.write((body.length + ":").getBytes(StandardCharsets.UTF_8));
            out.write(body);
            out.flush();
            while (true) {
                List<Object> reply = (List<Object>) JSONParser.parse(readFrame());
                if (((Number) reply.get(0)).intValue() != 1)
                    continue;
                if (((Number) reply.get(1)).intValue() != id)
                    continue;
                Object error = reply.get(2);
                if (error != null)
                    throw new IllegalStateException("Marionette " + name + " -> " + describe(error));
                return reply.get(3);
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    /** Points the session at a window that actually exists.
     *
     *  A fresh profile can end up with the session bound to a browsing context that is then
     *  discarded - an import or welcome window replacing the first one, which happens on windows
     *  and macos far more than on linux. Every later command then fails with "no such window",
     *  or hangs waiting for a page that is not in the window being polled.
     */
    @SuppressWarnings("unchecked")
    private void focusAWindow() {
        try {
            Object handles = command("WebDriver:GetWindowHandles", Map.of());
            List<Object> list = handles instanceof List ? (List<Object>) handles : List.of();
            if (! list.isEmpty())
                command("WebDriver:SwitchToWindow",
                        Map.of("handle", String.valueOf(list.get(list.size() - 1))));
        } catch (RuntimeException e) {
            // nothing to switch to; the next command will report the real problem
        }
    }

    private static boolean isDiscardedWindow(RuntimeException e) {
        String message = String.valueOf(e.getMessage());
        return message.contains("no such window") || message.contains("discarded");
    }

    /** Runs a command, and if the window went away, re-focuses one and tries once more. */
    private Object commandWithRecovery(String name, Map<String, Object> params) {
        try {
            return command(name, params);
        } catch (IllegalStateException e) {
            if (! isDiscardedWindow(e))
                throw e;
            focusAWindow();
            return command(name, params);
        }
    }

    private static String describe(Object error) {
        if (error instanceof Map) {
            Map m = (Map) error;
            return m.get("error") + ": " + String.valueOf(m.get("message"));
        }
        return String.valueOf(error);
    }

    private String readFrame() throws IOException {
        StringBuilder len = new StringBuilder();
        int c;
        while ((c = in.read()) != -1 && c != ':')
            len.append((char) c);
        if (c == -1)
            throw new EOFException("marionette closed");
        byte[] buf = in.readNBytes(Integer.parseInt(len.toString()));
        return new String(buf, StandardCharsets.UTF_8);
    }

    private static Object value(Object res) {
        return res instanceof Map ? ((Map) res).get("value") : res;
    }

    @Override
    public void navigate(String url) {
        commandWithRecovery("WebDriver:Navigate", Map.of("url", url));
    }

    @Override
    public Object script(String body, Object... args) {
        return value(commandWithRecovery("WebDriver:ExecuteScript",
                Map.of("script", body, "args", Arrays.asList(args))));
    }

    @Override
    public void switchToFrame(Object frameElementOrNull) {
        Map<String, Object> params = new HashMap<>();
        params.put("element", frameElementOrNull == null ? null : elementId(frameElementOrNull));
        command("WebDriver:SwitchToFrame", params);
    }

    @Override
    public Object find(String css) {
        try {
            return value(command("WebDriver:FindElement",
                    Map.of("using", "css selector", "value", css)));
        } catch (IllegalStateException e) {
            return null;
        }
    }

    @Override
    public void click(Object element) {
        command("WebDriver:ElementClick", Map.of("id", elementId(element)));
    }

    @Override
    public void sendKeys(Object element, String text) {
        command("WebDriver:ElementSendKeys", Map.of("id", elementId(element), "text", text));
    }

    private static String elementId(Object element) {
        Map m = (Map) element;
        Object id = m.get(ELEMENT_KEY);
        return (String) (id != null ? id : m.get("value"));
    }

    @Override
    public void close() {
        try {
            command("WebDriver:DeleteSession", Map.of());
        } catch (RuntimeException e) {
            // going away regardless
        }
        try {
            socket.close();
        } catch (IOException e) {
            // ditto
        }
        HttpDriver.stop(browser, marker);
    }
}
