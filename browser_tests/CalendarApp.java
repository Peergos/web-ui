import java.util.*;

/** Drives the calendar: the host view, the sandboxed frame inside it, and the files it writes.
 *
 *  Everything inside the frame is done through the document - open a dialog, fill it, press Save -
 *  because the app keeps its own state to itself and a driver's sandbox sees only what the page
 *  puts on `window`. That is the right way round for these tests anyway: they exercise what a
 *  person can reach, and assert on the bytes in the store rather than on what the page believes it
 *  saved. Reads use the same App handle and readInternal the host itself uses.
 */
public class CalendarApp {

    public static final String FRAME = "#calendar-iframe";

    /** Opens the calendar view and waits for the app inside the frame to finish its first load. */
    public static void open(WebDriver d) {
        Page.gotoView(d, "Calendar", "downloadIcsFile", "__cal");
        d.waitForScript("the calendar frame", "document.querySelector('" + FRAME + "')", 60_000);
        d.waitUntil("the calendar app to load", () -> inFrameQuiet(d,
                "return !!document.getElementById('load-progress')"
                        + " && document.getElementById('load-progress').hidden"
                        + " && !!document.querySelector('[role=\"gridcell\"]')"), 120_000);
    }

    /** Runs a script inside the app and comes back out, whatever it does. */
    public static Object inFrame(WebDriver d, String body, Object... args) {
        d.switchToFrame(FRAME);
        try {
            return d.script(body, args);
        } finally {
            d.switchToTop();
        }
    }

    private static boolean inFrameQuiet(WebDriver d, String body) {
        d.switchToFrame(FRAME);
        try {
            return Boolean.TRUE.equals(d.scriptQuiet(body));
        } finally {
            d.switchToTop();
        }
    }

    public static void waitInFrame(WebDriver d, String what, String booleanBody, long timeoutMillis) {
        d.waitUntil(what, () -> inFrameQuiet(d, "return !!(" + booleanBody + ")"), timeoutMillis);
    }

    /** Sets a form control and tells the page, the way typing into it would. */
    public static String setField(String id, String value) {
        return "(() => { let el = document.getElementById('" + id + "');"
                + " el.value = " + quote(value) + ";"
                + " el.dispatchEvent(new Event('input', {bubbles: true}));"
                + " el.dispatchEvent(new Event('change', {bubbles: true})); })();";
    }

    public static String click(String id) {
        return "document.getElementById('" + id + "').click();";
    }

    /** Opens the New menu, picks one of its entries, and waits for its dialog. */
    public static void newEntry(WebDriver d, String menuItemId, String dialogId) {
        inFrame(d, click("toolbar-add-button") + click(menuItemId) + "return 1;");
        waitInFrame(d, "the " + dialogId + " dialog",
                "document.getElementById('" + dialogId + "').classList.contains('open')", 30_000);
    }

    /** Presses Save and waits for the dialog to take it. */
    /** Puts the grid back in the month view with nothing open over it, for a test that follows
     *  one which left the app elsewhere. */
    public static void monthView(WebDriver d) {
        inFrame(d, "document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));"
                + "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]')).find(t => t.textContent.trim() === 'Month');"
                + "if (tab) tab.click(); return 1;");
    }

    public static void save(WebDriver d, String saveId, String dialogId) {
        inFrame(d, click(saveId) + "return 1;");
        try {
            waitInFrame(d, "the dialog to close",
                    "!document.getElementById('" + dialogId + "').classList.contains('open')", 30_000);
        } catch (RuntimeException e) {
            // What kept it open says more than the timeout does.
            throw new IllegalStateException("The dialog stayed open after " + saveId + ": " + inFrame(d,
                    "let dialog = document.getElementById('" + dialogId + "');"
                            + "return JSON.stringify({invalid: Array.from(dialog.querySelectorAll(':invalid')).map(el => el.id || el.name),"
                            + "  disabled: !!document.getElementById('" + saveId + "').disabled,"
                            + "  open: Array.from(document.querySelectorAll('.event-modal-backdrop.open')).map(el => el.id),"
                            + "  errors: Array.from(dialog.querySelectorAll('[role=\"alert\"], .field-error')).map(el => el.textContent.trim()).filter(Boolean)});"), e);
        }
    }

    /** Opens an event's popover by clicking its chip on the grid.
     *
     *  A chip is laid out inside a wrapper of its own, which some drivers refuse to click as not
     *  interactable, so the click is dispatched. On a pointer the app defers the popover behind a
     *  short timer that tells a double click apart from a single one, hence the wait between
     *  attempts rather than a burst of clicks. */
    public static void openPopover(WebDriver d, String titleContains) {
        for (int attempt = 0; attempt < 3; attempt++) {
            inFrame(d, "let chips = Array.from(document.querySelectorAll('[data-search-event-id]'))"
                    + "  .filter(el => el.textContent.indexOf(arguments[0]) !== -1);"
                    + "if (chips.length === 0) throw new Error('no chip for ' + arguments[0]);"
                    + "chips[0].click(); return 1;", titleContains);
            try {
                waitInFrame(d, "the event popover",
                        "document.getElementById('event-popover').classList.contains('open')", 5_000);
                return;
            } catch (IllegalStateException retry) {
                // the click landed before the grid settled; try again
            }
        }
        throw new AssertionError("The popover never opened for " + titleContains);
    }

    /** The days the grid draws an entry on, read off the cells rather than the app's model. */
    public static List<String> occurrenceDates(WebDriver d, String titleContains) {
        Object dates = inFrame(d,
                "return Array.from(document.querySelectorAll('[data-search-event-id]'))"
                        + ".filter(el => el.textContent.indexOf(arguments[0]) !== -1)"
                        + ".map(el => { let cell = el.closest('[data-date]');"
                        + "  return cell ? cell.getAttribute('data-date') : null; })"
                        + ".filter(Boolean).sort();", titleContains);
        List<String> out = new ArrayList<>();
        for (Object each : (List<?>) dates)
            out.add(String.valueOf(each));
        return out;
    }

    /** Answers the "which events?" dialog a recurring entry raises before it is changed. */
    public static void chooseScope(WebDriver d, String scope) {
        waitInFrame(d, "the scope dialog",
                "document.getElementById('scope-modal-backdrop').classList.contains('open')", 30_000);
        inFrame(d, "document.querySelector('input[name=\"scope\"][value=\"' + arguments[0] + '\"]')"
                + ".checked = true;" + click("scope-confirm") + "return 1;", scope);
    }

    /** Moves the grid on by one view, the way the toolbar's own arrow does. */
    public static void nextPeriod(WebDriver d) {
        inFrame(d, "let next = document.querySelector('#calendar [aria-label^=\"Next\"]');"
                + "if (!next) throw new Error('no next button in the toolbar');"
                + "next.click(); return 1;");
    }

    /** The directory a calendar's files live under, which is not its display name. The host
     *  resolves that when it loads the calendar list, so this asks it rather than guessing. */
    public static String directoryOf(WebDriver d, String displayName) {
        Object dir = d.script("let all = (window.__cal.calendarProperties || {}).calendars || [];"
                + "let match = all.filter(c => c.name === arguments[0])[0] || all[0];"
                + "return match ? match.directory : null;", displayName);
        if (dir == null)
            throw new AssertionError("The account has no calendar to write to");
        return String.valueOf(dir);
    }

    /** The files in one of the app's directories, e.g. "<calendar>/2026/9" or "<calendar>/tasks".
     *  Paths are relative to the calendar app's own data root, which is what the App handle takes. */
    public static List<String> list(WebDriver d, String subPath) {
        d.script("window.__list = null; window.__listErr = null;"
                + "peergos.shared.user.App.init(window.__cal.context, 'calendar').thenApply(app => {"
                + "  let path = peergos.client.PathUtils.directoryToPath("
                + "     arguments[0].length > 0 ? arguments[0].split('/') : []);"
                + "  app.dirInternal(path, window.__cal.context.username).thenApply(names => {"
                + "    window.__list = names.toArray([]).map(n => String(n)); })"
                + "  .exceptionally(t => { window.__listErr = String(t); });"
                + "}).exceptionally(t => { window.__listErr = String(t); });", subPath);
        d.waitForScript("a listing of " + subPath, "window.__list || window.__listErr", 60_000);
        Object error = d.script("return window.__listErr");
        if (error != null)
            throw new IllegalStateException("Could not list " + subPath + ": " + error);
        List<String> names = new ArrayList<>();
        Object listed = d.script("return window.__list");
        for (Object name : (List<?>) listed)
            names.add(String.valueOf(name));
        return names;
    }

    /** The bytes of one stored .ics, as text. */
    public static String read(WebDriver d, String subPath, String filename) {
        d.script("window.__ics = null; window.__icsErr = null;"
                + "peergos.shared.user.App.init(window.__cal.context, 'calendar').thenApply(app => {"
                + "  let path = peergos.client.PathUtils.toPath(arguments[0].split('/'), arguments[1]);"
                + "  app.readInternal(path, window.__cal.context.username).thenApply(bytes => {"
                + "    window.__ics = new TextDecoder().decode(bytes); })"
                + "  .exceptionally(t => { window.__icsErr = String(t); });"
                + "}).exceptionally(t => { window.__icsErr = String(t); });", subPath, filename);
        d.waitForScript("the stored " + filename, "window.__ics || window.__icsErr", 60_000);
        Object error = d.script("return window.__icsErr");
        if (error != null)
            throw new IllegalStateException("Could not read " + subPath + "/" + filename + ": " + error);
        String text = String.valueOf(d.script("return window.__ics"));
        // Some drivers hand the json escapes back as they came - a file with real line breaks
        // arrives as the two characters that stood for them, and every backslash it carries
        // doubled. An .ics always has real line breaks, so that is what tells the two apart.
        return text.contains("\r\n") ? text : unescape(text);
    }

    private static String unescape(String text) {
        StringBuilder out = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c != '\\' || i + 1 == text.length()) {
                out.append(c);
                continue;
            }
            char next = text.charAt(++i);
            switch (next) {
                case 'r': out.append('\r'); break;
                case 'n': out.append('\n'); break;
                case 't': out.append('\t'); break;
                case '"': out.append('"'); break;
                case '\\': out.append('\\'); break;
                default: out.append('\\').append(next);
            }
        }
        return out.toString();
    }

    /** Puts a file into the store directly, for data another app is meant to have written. */
    public static void write(WebDriver d, String subPath, String filename, String contents) {
        d.script("window.__wrote = null; window.__writeErr = null;"
                + "peergos.shared.user.App.init(window.__cal.context, 'calendar').thenApply(app => {"
                + "  let bytes = convertToByteArray(new TextEncoder().encode(arguments[2]));"
                + "  let path = peergos.client.PathUtils.toPath(arguments[0].split('/'), arguments[1]);"
                + "  app.writeInternal(path, bytes).thenApply(res => { window.__wrote = true; })"
                + "  .exceptionally(t => { window.__writeErr = String(t); });"
                + "}).exceptionally(t => { window.__writeErr = String(t); });", subPath, filename, contents);
        d.waitForScript("the file to be written", "window.__wrote || window.__writeErr", 60_000);
        Object error = d.script("return window.__writeErr");
        if (error != null)
            throw new IllegalStateException("Could not write " + subPath + "/" + filename + ": " + error);
    }

    /** Takes the grid to the month a date falls in, through the app's own "Go to date" dialog. */
    public static void gotoMonth(WebDriver d, String isoDate) {
        inFrame(d, "document.querySelector('.goto-date-trigger').click(); return 1;");
        waitInFrame(d, "the go-to-date dialog",
                "document.getElementById('goto-date-backdrop').classList.contains('open')", 30_000);
        inFrame(d, "let parts = arguments[0].split('-');"
                + "let month = document.getElementById('goto-date-month');"
                + "let year = document.getElementById('goto-date-year');"
                + "month.value = String(parseInt(parts[1], 10) - 1);"
                + "month.dispatchEvent(new Event('change', {bubbles: true}));"
                + "year.value = parts[0];"
                + "year.dispatchEvent(new Event('change', {bubbles: true}));"
                + "document.querySelector('#goto-date-backdrop .modal-close').click();"
                + "return 1;", isoDate);
    }

    /** The file in a directory that carries some text, once it appears - a write is a round trip
     *  to the server, and the suite shares one account across its tests, so a directory holds
     *  whatever the tests before it left there. */
    public static String awaitFileSaying(WebDriver d, String subPath, String contains) {
        return d.waitUntil("a file in " + subPath + " carrying " + contains, () -> {
            for (String name : list(d, subPath)) {
                if (read(d, subPath, name).contains(contains))
                    return name;
            }
            return null;
        }, 60_000);
    }

    /** Reads the one file in a directory again until it says what the test is waiting for. */
    public static String awaitStored(WebDriver d, String subPath, String filename, String contains) {
        return d.waitUntil("the stored file to carry " + contains, () -> {
            String ics = read(d, subPath, filename);
            return ics.contains(contains) ? ics : null;
        }, 60_000);
    }

    /** A property line out of an .ics, e.g. "RRULE" or "SUMMARY", or null if it has none. The
     *  time zone block a file may carry has DTSTART lines of its own, so it is skipped. */
    public static String property(String ics, String name) {
        boolean inTimeZone = false;
        for (String line : ics.split("\r\n")) {
            if (line.equals("BEGIN:VTIMEZONE"))
                inTimeZone = true;
            else if (line.equals("END:VTIMEZONE"))
                inTimeZone = false;
            else if (! inTimeZone && (line.startsWith(name + ":") || line.startsWith(name + ";")))
                return line;
        }
        return null;
    }

    public static void assertHas(String ics, String name, String expected) {
        String line = property(ics, name);
        if (line == null)
            throw new AssertionError("The stored file has no " + name + ":\n" + ics);
        if (! line.contains(expected))
            throw new AssertionError("Expected " + name + " to carry " + expected + ", got: " + line);
        System.out.println("  ok   " + line);
    }

    /** The stamp an .ics carries for a local wall-clock time, whichever form it wrote. */
    public static void assertTimeIs(String ics, String name, java.time.LocalDateTime local) {
        String line = property(ics, name);
        if (line == null)
            throw new AssertionError("The stored file has no " + name + ":\n" + ics);
        String wallClock = local.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss"));
        String utc = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
                .withZone(java.time.ZoneOffset.UTC)
                .format(local.atZone(java.time.ZoneId.systemDefault()).toInstant());
        if (! line.contains(wallClock) && ! line.contains(utc))
            throw new AssertionError("Expected " + name + " at " + local + " (" + wallClock
                    + " local or " + utc + "), got: " + line);
        System.out.println("  ok   " + line);
    }

    public static void assertContains(String ics, String expected) {
        if (! ics.contains(expected))
            throw new AssertionError("The stored file is missing " + expected + ":\n" + ics);
        System.out.println("  ok   carries " + expected);
    }

    static String quote(String value) {
        return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }
}
