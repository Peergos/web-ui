import java.nio.file.*;
import java.util.*;

/** A secret link that grants write access lets the reader change the entry.
 *
 *  The link is a capability on one file: there is no account behind it and no calendar to
 *  act in, so the edit goes back to that file in place. What this asserts is what the owner
 *  finds afterwards - the same file, under the same name, saying what the reader changed it
 *  to - and that the actions a link cannot carry out are not offered.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarLinkWriteTest.java [engine] [url]
 */
public class CalendarLinkWriteTest {

    static final String TITLE = "Writable there";
    static final String CHANGED = "Changed by the reader";

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
        Path downloads = Temp.directory("peergos-calendar-linkwrite-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            java.time.LocalDate today = java.time.LocalDate.now();
            String month = calendar + "/" + today.getYear() + "/" + today.getMonthValue();

            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", TITLE) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String stored = CalendarApp.awaitFileSaying(d, month, "SUMMARY:" + TITLE);
            System.out.println("owner's entry stored as " + month + "/" + stored);

            String entryPath = "/" + Server.USERNAME + "/.apps/calendar/data/" + month + "/" + stored;
            d.script("window.__w = null; window.__wErr = null;"
                    + "let ctx = document.querySelector('#app').__vue__.$store.state.context;"
                    + "ctx.createSecretLink(arguments[0], true, java.util.Optional.empty(), '', '', true)"
                    + "  .thenApply(props => { window.__w = ctx.getLinkString(props); })"
                    + "  .exceptionally(t => { window.__wErr = String(t); });", entryPath);
            d.waitForScript("the writable link", "window.__w || window.__wErr", 120_000);
            Object err = d.script("return window.__wErr");
            if (err != null)
                throw new AssertionError("Could not make a writable link to an entry: " + err);
            String link = String.valueOf(d.script("return window.__w"));
            System.out.println("writable link made");

            // --- the reader, with no account at all ------------------------------------------
            Page.logout(d);
            d.navigate(url + "/" + link + "?open=true");
            d.waitForScript("the calendar frame", "!!document.querySelector('" + CalendarApp.FRAME + "')", 120_000);
            CalendarApp.waitInFrame(d, "the entry's own detail",
                    "document.getElementById('event-popover').classList.contains('open')"
                            + " && document.getElementById('popover-title').textContent.indexOf("
                            + CalendarApp.quote(TITLE) + ") !== -1", 120_000);

            // Edit is the one action a link can carry out: the other three need a calendar to
            // act in, and there is none behind a link.
            String offered = String.valueOf(CalendarApp.inFrame(d,
                    "return ['edit', 'delete', 'duplicate', 'share'].filter(function (name) {"
                            + "  let el = document.getElementById('popover-' + name);"
                            + "  return el && el.offsetParent !== null; }).join(',');"));
            if (! offered.equals("edit"))
                throw new AssertionError("A writable link should offer editing and nothing else,"
                        + " but the popover offered [" + offered + "]");
            System.out.println("  ok   a writable link offers editing, and only that");

            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 60_000);
            boolean editable = Boolean.TRUE.equals(CalendarApp.inFrame(d,
                    "return !document.getElementById('event-title').disabled"
                            + " && document.getElementById('event-save').offsetParent !== null;"));
            if (! editable)
                throw new AssertionError("The dialog a writable link opens cannot be typed into");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", CHANGED) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            // The dialog closes as soon as the frame has the change; the write to the owner's
            // file is still on its way. Signing out here would take the page away mid-write,
            // which is a race the test would lose on a slow engine rather than a fault.
            d.waitForScript("the host to finish writing it",
                    CalendarReadOnlyTest.CALENDAR_VIEW + " && !window.__cal.showSpinner", 120_000);
            System.out.println("  ok   and the dialog it opens can be typed into and saved");

            // --- the owner again, to say what is in their own store --------------------------
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            d.waitUntil("the owner's file to carry the reader's change", () ->
                    CalendarApp.read(d, month, stored).contains("SUMMARY:" + CHANGED) ? true : null, 120_000);
            List<String> after = CalendarApp.list(d, month);
            if (! after.contains(stored))
                throw new AssertionError("The reader's edit should have gone back into the owner's"
                        + " own file, but " + stored + " is gone: " + after);
            String ics = CalendarApp.read(d, month, stored);
            if (ics.contains("SUMMARY:" + TITLE))
                throw new AssertionError("The owner's file still says the old title: " + ics);
            System.out.println("  ok   the owner's own file carries what the reader changed");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
