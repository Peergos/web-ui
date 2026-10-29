import java.nio.file.*;
import java.util.*;

/** A refresh whose read of the calendar list fails, and a calendar added after it.
 *
 *  The list of calendars is one file. A read of it that fails for any reason but "not there yet"
 *  - the server out of reach, a block missing - has to stay a failure. Taken for an empty list,
 *  the view shows no calendars, and the next calendar added writes the file with only itself:
 *  My Calendar and every calendar shared in are dropped from it for good, with their entries
 *  still on disk and nothing listing them.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarListReadFailureTest.java [engine] [url]
 */
public class CalendarListReadFailureTest {

    static final String ADDED = "Added after the failed read";

    public static void main(String[] args) throws Exception {
        try {
            run(args);
        } catch (AssertionError e) {
            System.out.println(e.getMessage());
            System.exit(1);
        }
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();
        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Path downloads = Temp.directory("peergos-calendar-list-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            List<String> before = calendars(d);
            if (before.isEmpty())
                throw new AssertionError("No calendars listed to begin with: " + CalendarApp.hostState(d));
            System.out.println("calendars listed: " + before);

            // Every read of the list fails from here on, as it would with the server out of reach.
            // The failure carries what the host reads off a java throwable.
            d.script("window.__readStubbed = null;"
                    + "peergos.shared.user.App.init(window.__cal.context, 'calendar').thenApply(app => {"
                    + "  const proto = Object.getPrototypeOf(app);"
                    + "  window.__origRead = proto.readInternal;"
                    + "  proto.readInternal = function(path) {"
                    + "    if (String(path).indexOf('App.config') !== -1) {"
                    + "      const f = peergos.shared.util.Futures.incomplete();"
                    + "      f.completeExceptionally({detailMessage: 'block missing', getMessage: () => 'block missing'});"
                    + "      return f; }"
                    + "    return window.__origRead.apply(this, arguments); };"
                    + "  window.__readStubbed = true; });");
            d.waitForScript("the read to be stubbed", "window.__readStubbed", 30_000);
            CalendarApp.inFrame(d, "hostSend({type: 'refresh', year: new Date().getFullYear(), month: new Date().getMonth() + 1}); return 1;");
            d.waitForScript("the refresh to fail", "!window.__cal.showSpinner"
                    + " && document.body.innerText.indexOf(" + CalendarApp.quote("load") + ") !== -1", 60_000);
            List<String> afterFailure = calendars(d);
            if (! afterFailure.containsAll(before))
                throw new AssertionError("A failed read of the list emptied it: " + afterFailure + " was " + before);
            System.out.println("  ok   the failed refresh kept the list: " + afterFailure);

            // reads work again, and a calendar is added
            d.script("peergos.shared.user.App.init(window.__cal.context, 'calendar').thenApply(app => {"
                    + "  Object.getPrototypeOf(app).readInternal = window.__origRead; window.__readStubbed = 'restored'; });");
            d.waitForScript("the read to be restored", "window.__readStubbed === 'restored'", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("add-calendar-button") + "return 1;");
            CalendarApp.waitInFrame(d, "the new calendar dialog",
                    "document.getElementById('calendar-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("calendar-name-input", ADDED)
                    + "document.getElementById('calendar-form').requestSubmit(); return 1;");
            CalendarApp.waitInFrame(d, "the dialog to close",
                    "!document.getElementById('calendar-modal-backdrop').classList.contains('open')", 30_000);
            d.waitUntil("the new calendar to be listed", () -> calendars(d).contains(ADDED), 60_000);
            d.waitForScript("the host to finish writing", "Object.keys(window.__cal.pendingWrites).length === 0", 60_000);

            // and the list read back from the store, as the next open would
            Page.gotoView(d, "Drive", "downloadFile", "__drive");
            CalendarApp.open(d);
            List<String> reloaded = calendars(d);
            for (String name : before)
                if (! reloaded.contains(name))
                    throw new AssertionError("After adding " + ADDED + ", a reload lists " + reloaded
                            + ": " + name + " was dropped from the stored list");
            if (! reloaded.contains(ADDED))
                throw new AssertionError("The added calendar is not in the reloaded list: " + reloaded);
            System.out.println("  ok   a reload lists them all: " + reloaded);
            // The suite's account is shared with the tests after this one, and some of them export
            // "the first calendar": the one added here goes again, as CalendarStoreTest's does.
            CalendarApp.inFrame(d, "let row = Array.from(document.querySelectorAll('.calendar-list-item'))"
                    + "  .find(r => r.textContent.indexOf(" + CalendarApp.quote(ADDED) + ") !== -1);"
                    + "row.querySelector('.calendar-menu-button').click();"
                    + "return new Promise(r => setTimeout(() => {"
                    + "  let edit = Array.from(document.querySelectorAll('.calendar-menu.open button'))"
                    + "    .find(b => b.textContent.trim() === 'Edit');"
                    + "  if (!edit) throw new Error('no Edit in the calendar menu');"
                    + "  edit.click(); r(1); }, 300));");
            CalendarApp.waitInFrame(d, "the calendar dialog",
                    "document.getElementById('calendar-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("calendar-delete") + "return 1;");
            d.waitForScript("the host's delete question", "window.__cal.showConfirm === true", 30_000);
            d.script("window.__cal.showConfirm = false; window.__cal.confirm_consumer_func();");
            d.waitUntil("the added calendar to go", () -> ! calendars(d).contains(ADDED), 60_000);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** The calendars the host currently holds, by display name. */
    static List<String> calendars(WebDriver d) {
        Object names = d.script("return (((window.__cal || {}).calendarProperties || {}).calendars || []).map(c => c.name);");
        List<String> out = new ArrayList<>();
        for (Object each : (List<?>) names)
            out.add(String.valueOf(each));
        return out;
    }
}
