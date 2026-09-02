import java.util.*;

/** A browser session, engine agnostic.
 *
 *  Two transports sit behind this. Chromium and WebKitGTK are driven over W3C WebDriver's HTTP
 *  protocol via chromedriver and WebKitWebDriver. Firefox is driven over Marionette, its own
 *  protocol, which is built into the browser - the alternative, geckodriver, is a downloaded
 *  binary that has to track the browser version, and version skew is exactly what killed the
 *  previous suite. The checked in geckodriver is 0.11.1, from 2016, and predates W3C WebDriver.
 */
public interface WebDriver extends AutoCloseable {

    void navigate(String url);

    /** Evaluates a function body in the page and returns the result, JSON decoded. */
    Object script(String body, Object... args);

    /** Switches into the frame holding the given element, or back to the top with null. */
    void switchToFrame(Object frameElementOrNull);

    /** The element handle for a css selector, or null if there is none. */
    Object find(String css);

    void click(Object element);

    /** Types into an element. Used for file inputs too - the value is the path to upload. */
    void sendKeys(Object element, String text);

    @Override
    void close();

    default Object scriptQuiet(String body, Object... args) {
        try {
            return script(body, args);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Every wait in the suite goes through here, so no test grows its own sleep. */
    default <T> T waitUntil(String what, java.util.function.Supplier<T> probe, long timeoutMillis) {
        long end = System.currentTimeMillis() + timeoutMillis;
        RuntimeException last = null;
        while (System.currentTimeMillis() < end) {
            try {
                T val = probe.get();
                if (val != null && ! Boolean.FALSE.equals(val))
                    return val;
                last = null;
            } catch (RuntimeException e) {
                last = e;
            }
            sleep(250);
        }
        throw new IllegalStateException("Timed out after " + timeoutMillis + "ms waiting for " + what,
                last);
    }

    default void waitForScript(String what, String booleanBody, long timeoutMillis) {
        waitUntil(what, () -> Boolean.TRUE.equals(scriptQuiet("return !!(" + booleanBody + ")")), timeoutMillis);
    }

    static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(e);
        }
    }
}
