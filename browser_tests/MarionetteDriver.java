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
    private final List<String> frames = new ArrayList<>();
    private String recovery = "not attempted";

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
            // Newest first, and every candidate is probed: switching to a discarded context
            // succeeds, and only the command after it reports that nothing is there. Taking the
            // last handle on trust is how a recovery re-attaches to the same dead window each
            // time and spends its whole budget getting nowhere.
            for (int i = list.size() - 1; i >= 0; i--) {
                if (usable(String.valueOf(list.get(i))))
                    return;
            }
            openAWindow();
        } catch (RuntimeException e) {
            // nothing to switch to; the next command will report the real problem
        }
    }

    /** Opens a window and moves the session into it.
     *
     *  Escalated to rather than kept for the case where no handle answers at all: a window can
     *  run a script and still refuse to navigate, and re-focusing it then repeats a step that
     *  cannot work for as long as the budget lasts. Giving the session a window it opened itself
     *  is the only move that changes anything.
     */
    private void openAWindow() {
        try {
            Object created = command("WebDriver:NewWindow", Map.of("type", "tab", "focus", true));
            Object handle = created instanceof Map ? ((Map<?, ?>) created).get("handle") : null;
            if (handle == null)
                recovery = "opening a window returned no handle";
            else if (usable(String.valueOf(handle)))
                recovery = "opened a window";
            else
                recovery = "opened a window and it was not usable either";
        } catch (RuntimeException e) {
            recovery = "could not open a window (" + e.getMessage() + ")";
        }
    }

    /** Switching to a discarded context succeeds, so a window only counts once it runs something. */
    private boolean usable(String handle) {
        try {
            command("WebDriver:SwitchToWindow", Map.of("handle", handle));
            command("WebDriver:ExecuteScript", Map.of("script", "return 1", "args", List.of()));
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    private String windowSummary() {
        String process = browser == null ? "browser not ours to watch"
                : browser.isAlive() ? "browser alive" : "browser has exited";
        try {
            Object handles = command("WebDriver:GetWindowHandles", Map.of());
            List<?> list = handles instanceof List ? (List<?>) handles : List.of();
            return process + ", " + list.size() + " window handle(s)";
        } catch (RuntimeException e) {
            return process + ", window handles unavailable (" + e.getMessage() + ")";
        }
    }

    private static boolean isDiscardedWindow(RuntimeException e) {
        String message = String.valueOf(e.getMessage());
        return message.contains("no such window") || message.contains("discarded");
    }

    /** Runs a command, re-focusing a window and trying again while the context keeps going away.
     *
     *  Retried with a pause rather than once immediately: a browser that is still starting can
     *  replace its first context a moment after the session attached to it, so an instant retry
     *  lands on the same discarded context the first attempt did.
     */
    private Object commandWithRecovery(String name, Map<String, Object> params) {
        IllegalStateException last = null;
        int attempts = 0, opened = 0;
        // Bounded by time rather than by a count of attempts. A slow windows runner can still be
        // replacing the window it started with well after a handful of two second pauses have
        // run out, and giving up then reports a browser that was about to be perfectly usable.
        long end = System.currentTimeMillis()
                + ("1".equals(System.getenv("PEERGOS_TEST_SLOW")) ? 120_000 : 60_000);
        do {
            try {
                return command(name, params);
            } catch (IllegalStateException e) {
                if (! isDiscardedWindow(e))
                    throw e;
                last = e;
                WebDriver.sleep(2000);
                // Re-focus once, then stop repeating it: whatever the current window is doing,
                // it is not going to start working on the tenth identical attempt. The
                // escalation is capped, because a browser that has ignored three new windows is
                // not short of windows, and opening one every two seconds only adds to its load.
                if (++attempts > 1 && opened < 3) {
                    opened++;
                    openAWindow();
                } else {
                    focusAWindow();
                }
                restoreFrame();
            }
        } while (System.currentTimeMillis() < end);
        throw new IllegalStateException(last.getMessage() + " - recovery gave up, "
                + windowSummary() + ", " + recovery, last);
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
        try {
            commandWithRecovery("WebDriver:Navigate", Map.of("url", url));
        } catch (IllegalStateException e) {
            // Loading a page is idempotent, and a machine busy enough to miss a five minute page
            // load is usually busy for a moment rather than for the rest of the run.
            if (! String.valueOf(e.getMessage()).contains("timed out"))
                throw e;
            System.out.println("  page load timed out, navigating again: " + url);
            commandWithRecovery("WebDriver:Navigate", Map.of("url", url));
        }
    }

    @Override
    public Object script(String body, Object... args) {
        return value(commandWithRecovery("WebDriver:ExecuteScript",
                Map.of("script", body, "args", Arrays.asList(args))));
    }

    @Override
    public void switchToFrame(String css) {
        enterFrame(css);
        frames.add(css);
    }

    @Override
    public void switchToTop() {
        switchToTopContext();
        frames.clear();
    }

    private void switchToTopContext() {
        Map<String, Object> params = new HashMap<>();
        params.put("element", null);
        command("WebDriver:SwitchToFrame", params);
    }

    private void enterFrame(String css) {
        Object element = value(command("WebDriver:FindElement",
                Map.of("using", "css selector", "value", css)));
        Map<String, Object> params = new HashMap<>();
        params.put("element", elementId(element));
        command("WebDriver:SwitchToFrame", params);
    }

    /** Puts us back in the frame we were in before recovering from a discarded window.
     *
     *  Switching window resets the browsing context to the top document. Without this, a single
     *  recovery inside a frame leaves every later script running in the parent instead, where
     *  the app under test simply does not exist - so the test polls a document that can never
     *  satisfy it and blames the app for never loading. Failing to get back is thrown rather
     *  than swallowed, because carrying on in the wrong document is what made this invisible.
     */
    private void restoreFrame() {
        if (frames.isEmpty())
            return;
        try {
            switchToTopContext();
            for (String css : frames)
                enterFrame(css);
        } catch (RuntimeException e) {
            throw new FrameContextLost("Could not get back into " + frames
                    + " after the window went away", e);
        }
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
        // Ask the browser to quit rather than relying on killing it. Deleting the session leaves
        // firefox running, and the sweep that catches a reparented browser matches on the command
        // line, which the jdk does not fill in on every platform - so where it is missing, every
        // test leaks a browser and a later sign in times out on a starved machine.
        try {
            command("Marionette:Quit", Map.of("flags", List.of("eForceQuit")));
        } catch (RuntimeException e) {
            try {
                command("WebDriver:DeleteSession", Map.of());
            } catch (RuntimeException ignored) {
                // going away regardless
            }
        }
        try {
            socket.close();
        } catch (IOException e) {
            // ditto
        }
        HttpDriver.stop(browser, marker);
    }
}
