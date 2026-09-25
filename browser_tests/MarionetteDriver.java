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
            // Eager: navigation is done once the document is parsed, not once every
            // subresource has settled. Every navigate in this suite is followed by a wait for
            // what the test actually needs, so the load event was only ever an extra thing to
            // hang on - and on a loaded windows runner it has hung, taking a page that was
            // there and usable for one that was never coming.
            try {
                command("WebDriver:NewSession", Map.of("capabilities",
                        Map.of("alwaysMatch", Map.of("pageLoadStrategy", "eager"))));
            } catch (RuntimeException unsupported) {
                command("WebDriver:NewSession", Map.of("capabilities", Map.of()));
            }
            // Long enough that a page which is merely slow is not read as a page that will
            // never come. Two minutes covers an ordinary machine; the runners flagged as slow
            // have been seen to spend six and a half minutes on a single test, and a load
            // that overran two of them there failed a test with nothing wrong with it.
            long pageLoad = "1".equals(System.getenv("PEERGOS_TEST_SLOW")) ? 300_000 : 120_000;
            try {
                command("WebDriver:SetTimeouts", Map.of("pageLoad", pageLoad));
            } catch (RuntimeException e) {
                // an older marionette without the command; the default stands
            }
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

    /** Rebuilds the session on the connection we already have.
     *
     *  The last resort, and the only one left when the context is discarded: opening a window is
     *  itself a command against that context, so it fails the same way, and the session cannot
     *  talk about anything any more. Only listing windows still answers, because the parent
     *  process handles that one. The browser is alive, so a new session can attach to it.
     */
    private void restartSession() {
        boolean wasInFrame = ! frames.isEmpty();
        try {
            try {
                command("WebDriver:DeleteSession", Map.of());
            } catch (RuntimeException e) {
                // it is already unusable, which is why we are here
            }
            command("WebDriver:NewSession", Map.of("capabilities", Map.of()));
            frames.clear();
            focusAWindow();
            recovery = "restarted the session";
        } catch (RuntimeException e) {
            recovery = "could not restart the session (" + e.getMessage() + ")";
            return;
        }
        if (wasInFrame)
            throw new FrameContextLost("The session was restarted while working inside "
                    + "a frame, so the document under test is gone", null);
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
        int attempts = 0;
        boolean opened = false, restarted = false;
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
                // An escalation, because repeating a step that has already failed is not a
                // recovery: re-focus, then open a window, then rebuild the session, then go back
                // to waiting. One attempt at a window, not three: opening one is itself a command
                // against the context that has gone, so when it fails it will keep failing, and
                // the attempts are better spent getting to the rebuild.
                attempts++;
                if (attempts == 1)
                    focusAWindow();
                else if (! opened) {
                    opened = true;
                    openAWindow();
                } else if (! restarted) {
                    restarted = true;
                    restartSession();
                } else {
                    focusAWindow();
                }
                restoreFrame();
            }
            // The ladder is always finished, whatever the clock says: a failing command is not
            // instant, and three of them can spend the whole budget before the one step that
            // might have worked has been tried at all.
        } while (System.currentTimeMillis() < end || ! restarted);
        // A rebuilt session is worth nothing without an attempt after it, and the clock can run
        // out on the very step that was going to work.
        if (restarted) {
            try {
                return command(name, params);
            } catch (IllegalStateException e) {
                last = e;
            }
        }
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
    public void setWindowRect(int width, int height) {
        // Best effort, as on the http drivers: headless firefox will not go below about 500px
        // wide, and a test that needs narrower than that reads back what it actually got.
        try {
            command("WebDriver:SetWindowRect",
                    Map.of("x", 0, "y", 0, "width", width, "height", height));
        } catch (RuntimeException wontResize) {
            System.out.println("  the window would not take " + width + "x" + height
                    + ": " + wontResize.getMessage());
        }
    }

    @Override
    public void navigate(String url) {
        // Loading a page is idempotent, and a server too busy to answer is usually busy for a
        // moment rather than for the rest of the run - so try a few times rather than once.
        // Fewer attempts where each one waits longer: the point is to survive a moment's
        // trouble, not to spend a quarter of an hour proving the browser is not coming back.
        IllegalStateException last = null;
        int attempts = "1".equals(System.getenv("PEERGOS_TEST_SLOW")) ? 2 : 3;
        for (int attempt = 0; attempt < attempts; attempt++) {
            String mark = "nav" + System.nanoTime();
            boolean marked = markDocument(mark);
            try {
                commandWithRecovery("WebDriver:Navigate", Map.of("url", url));
                settle();
                return;
            } catch (IllegalStateException e) {
                if (! String.valueOf(e.getMessage()).contains("timed out"))
                    throw e;
                last = e;
                if (marked && arrivedAt(url, mark))
                    return;
                if (attempt + 1 < attempts) {
                    System.out.println("  page load timed out, navigating again: " + url);
                    // A load that never finished leaves the session waiting on it, so asking
                    // that same session for that same page is the step which has already
                    // failed - two attempts at it spend ten minutes proving it twice. The
                    // session is rebuilt first, which is what makes the second attempt a
                    // different one. Only at the top level: inside a frame a restart throws
                    // away the document under test, and there the plain retry is the safer of
                    // the two.
                    if (frames.isEmpty())
                        restartSession();
                }
            }
        }
        throw last;
    }

    /** Stamps the document we are leaving, so a navigation that times out can be told apart
     *  from one that never happened at all.
     *
     *  Best effort, and deliberately without the recovery every other command gets: this is
     *  worth no time on a context that has already gone, and a document we could not even
     *  write to is one arrivedAt below would rather not vouch for - so it says whether the
     *  mark is there to be trusted instead of leaving it to guess.
     */
    private boolean markDocument(String mark) {
        try {
            command("WebDriver:ExecuteScript",
                    Map.of("script", "window.__leaving = '" + mark + "';", "args", List.of()));
            return true;
        } catch (RuntimeException cannotReachTheDocument) {
            return false;
        }
    }

    /** Whether the document in front of us now is the one the navigation was going to.
     *
     *  A navigation that timed out is not the same as a page that never came: marionette gives
     *  up on the load, and what it was loading is usually there and usable. Asked between the
     *  attempts rather than after them, because navigating again is what costs another five
     *  minutes on a slow runner - and is itself what discards the context.
     *
     *  Asked through the recovering path rather than quietly: a navigation that times out often
     *  leaves the context discarded, where a bare script answers nothing at all and a page that
     *  is perfectly good reads as one that never came.
     *
     *  The mark left on the document we were leaving is what tells those two apart. A test
     *  navigating to where it already is wears the same url either way, so the url alone would
     *  accept the document that never left, and every assertion after it would be made against
     *  the page the test before it finished on.
     */
    private boolean arrivedAt(String url, String mark) {
        Object landed;
        try {
            landed = script("return document.readyState + ' left=' + (window.__leaving !== '"
                    + mark + "') + ' ' + location.href");
        } catch (RuntimeException nothingLeftToAsk) {
            return false;
        }
        String where = String.valueOf(landed);
        if (! where.contains("left=true") || ! where.contains(url))
            return false;
        System.out.println("  the page is there despite the timeout: " + where);
        settle();
        return true;
    }

    /** Waits for the document the navigation landed on to finish loading.
     *
     *  Navigation itself is eager, so it comes back while the page is still arriving. That is
     *  what keeps a straggling subresource from hanging the whole run, but it also hands the
     *  next step a document that can still be replaced under it - and a context replaced while
     *  the driver is holding it is discarded, after which every later script quietly answers
     *  nothing. Waiting here for the load to finish costs a healthy page almost nothing and
     *  leaves a slow one settled rather than half arrived. A page that never finishes is not
     *  an error: the caller waits for what it actually needs next.
     */
    private void settle() {
        long end = System.currentTimeMillis()
                + ("1".equals(System.getenv("PEERGOS_TEST_SLOW")) ? 120_000 : 60_000);
        while (System.currentTimeMillis() < end) {
            if ("complete".equals(scriptQuiet("return document.readyState"))) {
                stillAnimations();
                return;
            }
            WebDriver.sleep(250);
        }
        stillAnimations();
    }

    @Override
    public Object script(String body, Object... args) {
        return value(commandWithRecovery("WebDriver:ExecuteScript",
                Map.of("script", body, "args", Arrays.asList(args))));
    }

    /** A png of the whole page, for looking at a layout rather than asserting on it. */
    public byte[] screenshot() {
        Object png = value(command("WebDriver:TakeScreenshot", Map.of("full", true, "hash", false)));
        return Base64.getDecoder().decode(String.valueOf(png));
    }

    /** Runs a script in the browser's own chrome rather than in the page: how a test reaches what
     *  a person does outside the page, such as cancelling a download in the downloads list. */
    public Object chromeScript(String body) {
        command("Marionette:SetContext", Map.of("value", "chrome"));
        try {
            return value(command("WebDriver:ExecuteScript", Map.of("script", body, "args", List.of())));
        } finally {
            command("Marionette:SetContext", Map.of("value", "content"));
        }
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
