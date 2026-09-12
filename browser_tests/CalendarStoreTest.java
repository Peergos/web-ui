import java.nio.file.*;
import java.util.*;

/** Two ways to lose a file, checked against the store.
 *
 *  A create, an edit and a delete of the same entry fired without waiting for each other: every
 *  write is a round trip, the host queues a later one behind the earlier, and what the store
 *  ends with has to be nothing. And deleting a calendar removes that calendar's directory and
 *  no other: the account's own calendar keeps every file it had.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarStoreTest.java [engine] [url]
 */
public class CalendarStoreTest {

    static final String FIRST = "Quick one";
    static final String SECOND = "Quick two";
    static final String TEMP = "Temp";
    static final String IN_TEMP = "Lives in Temp";

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
        Path downloads = Temp.directory("peergos-calendar-store-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            java.time.LocalDate today = java.time.LocalDate.now();
            String month = calendar + "/" + today.getYear() + "/" + today.getMonthValue();
            System.out.println("calendar open, this month under " + month);

            // --- create, edit, delete, back to back ------------------------------------------
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", FIRST) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            CalendarApp.waitInFrame(d, "the entry on the grid", drawn(FIRST), 30_000);
            // The grid draws before the host has written anything, and on a slow runner the
            // write is still queued for a long while after. Waiting for this entry's own file
            // is what makes the check below mean something: a month holding no file that says
            // either name is otherwise just as true before the entry was ever stored as it is
            // after it was properly removed. This entry's own, not any file: the month is the
            // one the tests before this shared, and it is not empty.
            d.waitUntil("the entry to reach the store", () -> {
                for (String name : CalendarApp.list(d, month))
                    if (CalendarApp.read(d, month, name).contains("SUMMARY:" + FIRST))
                        return true;
                return null;
            }, 120_000);
            CalendarApp.openPopover(d, FIRST);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", SECOND) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            CalendarApp.waitInFrame(d, "the renamed entry", drawn(SECOND), 30_000);
            CalendarApp.openPopover(d, SECOND);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.waitInFrame(d, "the delete question",
                    "document.getElementById('confirm-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("confirm-ok") + "return 1;");
            d.waitUntil("the store to hold neither name", () -> {
                for (String name : CalendarApp.list(d, month)) {
                    String ics = CalendarApp.read(d, month, name);
                    if (ics.contains("SUMMARY:" + FIRST) || ics.contains("SUMMARY:" + SECOND))
                        return null;
                }
                return true;
            }, 90_000);
            // The store has said the entry is gone once. Watched for a while rather than
            // sampled once, and the whole timeline reported: an entry that returns after a
            // pause was put back by a write that outlived the delete, while one that is
            // there on the very first look was never really removed, and the two want
            // different fixes.
            List<String> timeline = new ArrayList<>();
            for (int second = 1; second <= 6; second++) {
                WebDriver.sleep(1000);
                String found = null;
                for (String name : CalendarApp.list(d, month)) {
                    String ics = CalendarApp.read(d, month, name);
                    if (ics.contains("SUMMARY:" + FIRST)) found = name + " holding " + FIRST;
                    else if (ics.contains("SUMMARY:" + SECOND)) found = name + " holding " + SECOND;
                }
                timeline.add("t+" + second + "s " + (found == null ? "gone" : found));
                if (found != null)
                    throw new AssertionError("The entry came back after the delete: " + timeline);
            }
            System.out.println("  ok   an edit and a delete fired together leave nothing behind");

            // --- deleting a calendar takes only its own directory ----------------------------
            List<String> ownFiles = CalendarApp.list(d, month);
            CalendarApp.inFrame(d, CalendarApp.click("add-calendar-button") + "return 1;");
            CalendarApp.waitInFrame(d, "the calendar dialog",
                    "document.getElementById('calendar-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("calendar-name-input", TEMP)
                    + "document.getElementById('calendar-form').requestSubmit(); return 1;");
            CalendarApp.waitInFrame(d, "the new calendar in the list", listed(TEMP), 60_000);
            String temp = CalendarApp.directoryOf(d, TEMP);
            if (temp.equals(calendar))
                throw new AssertionError("The new calendar shares the account's own directory");

            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", IN_TEMP)
                    + "let select = document.getElementById('event-calendar');"
                    + "let option = Array.from(select.options).find(o => o.textContent.trim() === " + CalendarApp.quote(TEMP) + ");"
                    + "if (!option) throw new Error('the new calendar is not offered in the dialog');"
                    + "select.value = option.value; select.dispatchEvent(new Event('change', {bubbles: true}));"
                    + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String tempMonth = temp + "/" + today.getYear() + "/" + today.getMonthValue();
            CalendarApp.awaitFileSaying(d, tempMonth, "SUMMARY:" + IN_TEMP);
            System.out.println("  ok   an entry in the new calendar is stored under " + tempMonth);

            // Its row's menu, Edit, Delete: the host then asks, in its own dialog.
            CalendarApp.inFrame(d, "let row = Array.from(document.querySelectorAll('.calendar-list-item'))"
                    + "  .find(r => r.textContent.indexOf(" + CalendarApp.quote(TEMP) + ") !== -1);"
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
            CalendarApp.waitInFrame(d, "the calendar to leave the list", "!(" + listed(TEMP) + ")", 60_000);
            d.waitUntil("the calendar's directory to go", () -> {
                try {
                    return CalendarApp.list(d, temp).isEmpty() ? true : null;
                } catch (RuntimeException gone) {
                    return true;
                }
            }, 60_000);
            List<String> ownFilesAfter = CalendarApp.list(d, month);
            if (! new HashSet<>(ownFilesAfter).equals(new HashSet<>(ownFiles)))
                throw new AssertionError("Deleting " + TEMP + " changed the account's own month: "
                        + ownFiles + " became " + ownFilesAfter);
            System.out.println("  ok   deleting a calendar removes its directory and touches no other");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static String drawn(String title) {
        return "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(title) + ") !== -1)";
    }

    static String listed(String calendarName) {
        return "Array.from(document.querySelectorAll('.calendar-list-item'))"
                + ".some(r => r.textContent.indexOf(" + CalendarApp.quote(calendarName) + ") !== -1)";
    }
}
