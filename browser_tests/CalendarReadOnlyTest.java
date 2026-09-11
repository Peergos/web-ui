import java.nio.file.*;
import java.util.*;

/** A calendar opened read-only by someone else: seen, and not writable from there.
 *
 *  The owner makes a read-only secret link to a calendar's directory, through the same call the
 *  share dialog makes, then signs out - so what opens the link is a browser with no account in
 *  it, the same stranger a second browser would have been. The owner's entry is on the grid, the
 *  calendar carries the read-only mark, its entries offer no edit, and a save forged from inside
 *  that frame - the one way round the app's own restraint - puts nothing in the owner's
 *  directory, because the host has no write access to grant. The owner signs back in at the end
 *  to say so from their own side.
 *
 *  One browser rather than two: safaridriver pairs a session to the one Safari on the machine
 *  and refuses a second, and this is the engine macos is tested on.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarReadOnlyTest.java [engine] [url]
 */
public class CalendarReadOnlyTest {

    static final String TITLE = "Read only there";

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
        Path downloads = Temp.directory("peergos-calendar-readonly-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);

            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", TITLE) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            java.time.LocalDate today = java.time.LocalDate.now();
            String month = calendar + "/" + today.getYear() + "/" + today.getMonthValue();
            String stored = CalendarApp.awaitFileSaying(d, month, "SUMMARY:" + TITLE);
            List<String> before = CalendarApp.list(d, month);
            System.out.println("owner's entry stored under " + month);

            // --- a read-only link to the calendar's directory, as the share dialog makes it ----
            String shared = "/" + Server.USERNAME + "/.apps/calendar/data/" + calendar;
            d.script("window.__link = null; window.__linkErr = null;"
                    + "let context = document.querySelector('#app').__vue__.$store.state.context;"
                    + "context.createSecretLink(arguments[0] + '/', false, java.util.Optional.empty(), '', '', true)"
                    + "  .thenApply(props => { window.__link = context.getLinkString(props); })"
                    + "  .exceptionally(t => { window.__linkErr = String(t); });", shared);
            d.waitForScript("the link", "window.__link || window.__linkErr", 120_000);
            Object linkError = d.script("return window.__linkErr");
            if (linkError != null)
                throw new IllegalStateException("Could not make the link: " + linkError);
            String link = String.valueOf(d.script("return window.__link"));
            System.out.println("read-only link made");

            // --- and now a stranger, in the same browser with the account signed out ----------
            Page.logout(d);
            d.navigate(url + "/" + link + "?open=true");
            d.waitForScript("the linked folder", "!!document.querySelector('#app') && !!document.querySelector('#app').__vue__"
                    + " && document.querySelector('#app').__vue__.$store.state.context != null", 120_000);
            // The same mark signing in waits for: if it is still here the sign out did nothing,
            // and everything below would be the owner looking at their own calendar.
            if (Boolean.TRUE.equals(d.script("return document.body.innerText.indexOf('UPGRADE') >= 0;")))
                throw new AssertionError("The link opened with the owner still signed in, so nothing"
                        + " below is about what a stranger can do");
            // Opened the way the drive opens a folder in an app: by its path, the link kept.
            d.script("let stack = [document.querySelector('#app').__vue__];"
                    + "while (stack.length) {"
                    + "  let c = stack.pop();"
                    + "  if (typeof c.openFileOrDir === 'function') { c.openFileOrDir('Calendar', arguments[0], {filename: ''}); return; }"
                    + "  (c.$children || []).forEach(k => stack.push(k));"
                    + "}"
                    + "throw new Error('no component that opens a path in an app');", shared);
            // A guest has no nav to click: the view comes up from the path alone, and its root
            // element is its transition's, so it is found in the mounted tree rather than on an
            // element - the shortcut the shared helper takes for a signed-in account.
            d.waitForScript("the calendar view", "(() => {"
                    + "  let root = null;"
                    + "  for (const el of document.querySelectorAll('*')) if (el.__vue__) { root = el.__vue__.$root; break; }"
                    + "  const stack = root ? [root] : [];"
                    + "  while (stack.length) {"
                    + "    const c = stack.pop();"
                    + "    if (typeof c.downloadIcsFile === 'function') { window.__cal = c; return true; }"
                    + "    (c.$children || []).forEach(k => stack.push(k));"
                    + "  }"
                    + "  return false; })()", 120_000);
            d.waitForScript("the calendar frame", "!!document.querySelector('" + CalendarApp.FRAME + "')", 60_000);
            CalendarApp.waitInFrame(d, "the calendar app to load",
                    "!!document.getElementById('load-progress') && document.getElementById('load-progress').hidden"
                            + " && !!document.querySelector('[role=\"gridcell\"]')", 120_000);
            CalendarApp.waitInFrame(d, "the owner's entry on the stranger's grid",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(TITLE) + ") !== -1)", 120_000);
            System.out.println("  ok   the link shows the owner's entry to someone with no account");

            boolean marked = Boolean.TRUE.equals(CalendarApp.inFrame(d,
                    "return document.querySelectorAll('.calendar-readonly-badge').length === 1;"));
            if (! marked)
                throw new AssertionError("The linked calendar does not carry the read-only mark");
            boolean offered = Boolean.TRUE.equals(CalendarApp.inFrame(d,
                    "let chip = Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + "  .find(el => el.textContent.indexOf(" + CalendarApp.quote(TITLE) + ") !== -1);"
                            + "chip.click();"
                            + "return new Promise(r => setTimeout(() => {"
                            + "  let edit = document.getElementById('popover-edit');"
                            + "  r(!!edit && edit.offsetParent !== null && !edit.disabled); }, 800));"));
            if (offered)
                throw new AssertionError("The popover offers Edit on an entry the reader cannot write");
            System.out.println("  ok   marked read-only, and the entry offers no edit");

            // What a tampered frame could do: ask the host to write into the owner's month.
            String sharedName = String.valueOf(d.script(
                    "return window.__cal.calendarProperties.calendars[0].name;"));
            CalendarApp.inFrame(d,
                    "window.parent.postMessage({type: 'save', calendarName: " + CalendarApp.quote(sharedName)
                            + ", year: " + today.getYear() + ", month: " + today.getMonthValue()
                            + ", isRecurring: false, isTask: false, Id: 'forged-by-reader',"
                            + " item: 'BEGIN:VCALENDAR\\r\\nBEGIN:VEVENT\\r\\nUID:forged-by-reader\\r\\n"
                            + "DTSTART:20260401T100000Z\\r\\nSUMMARY:forged\\r\\nEND:VEVENT\\r\\nEND:VCALENDAR\\r\\n'}, '*');"
                            + "return 1;");
            WebDriver.sleep(5000);

            // --- the owner again, to say what their own directory holds ----------------------
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            List<String> after = CalendarApp.list(d, month);
            if (after.contains("forged-by-reader.ics") || ! new HashSet<>(after).equals(new HashSet<>(before)))
                throw new AssertionError("A save forged in the reader's frame changed the owner's month: "
                        + before + " became " + after);
            System.out.println("  ok   a save forged in the reader's frame writes nothing in the owner's calendar");

            // --- and a link to one entry rather than the whole calendar ----------------------
            // The share dialog offers this too, and it opens the entry rather than the drive it
            // sits in. There is no account in a link, so it is shown and nothing is imported.
            String entryPath = "/" + Server.USERNAME + "/.apps/calendar/data/" + month + "/" + stored;
            d.script("window.__one = null; window.__oneErr = null;"
                    + "let ctx = document.querySelector('#app').__vue__.$store.state.context;"
                    + "ctx.createSecretLink(arguments[0], false, java.util.Optional.empty(), '', '', true)"
                    + "  .thenApply(props => { window.__one = ctx.getLinkString(props); })"
                    + "  .exceptionally(t => { window.__oneErr = String(t); });", entryPath);
            d.waitForScript("the entry's own link", "window.__one || window.__oneErr", 120_000);
            Object oneErr = d.script("return window.__oneErr");
            if (oneErr != null)
                throw new AssertionError("Could not make a link to a single entry: " + oneErr);
            String entryLink = String.valueOf(d.script("return window.__one"));

            Page.logout(d);
            d.navigate(url + "/" + entryLink + "?open=true");
            d.waitForScript("the calendar frame", "!!document.querySelector('" + CalendarApp.FRAME + "')", 120_000);
            CalendarApp.waitInFrame(d, "the entry drawn from its own link",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(TITLE) + ") !== -1)", 120_000);
            System.out.println("  ok   a link to one entry opens it rather than the drive");
            boolean summary = Boolean.TRUE.equals(CalendarApp.inFrame(d,
                    "let m = document.getElementById('import-summary-modal-backdrop');"
                            + "return !!m && m.classList.contains('open');"));
            if (summary)
                throw new AssertionError("A reader with no account was told what had been imported,"
                        + " when nothing was written and there is nowhere it could have been written to");
            System.out.println("  ok   and shows it without claiming to have imported anything");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
