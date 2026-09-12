import java.nio.file.*;
import java.util.*;

/** Where the sandbox ends: the calendar app can ask for the share dialog and nothing else.
 *
 *  Sharing gives another account access, so it belongs to the privileged half. The app is a
 *  cross origin frame - code that could be tampered with without touching the host - and this
 *  proves the two things that follow from that: pressing Share opens Peergos' own dialog outside
 *  the frame, and a message from the frame asking for a grant directly is not something the host
 *  will act on.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarSharingTest.java [engine] [url]
 */
public class CalendarSharingTest {

    static final String TITLE = "Shared with the host";

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
        Path downloads = Temp.directory("peergos-calendar-share-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            System.out.println("calendar open");

            // The host is the only side with the primitives at all.
            Object mutators = d.script("return ['shareAddUser', 'shareRemoveUser', 'shareCreateLink',"
                    + " 'shareRevokeLink', 'sendShareState']"
                    + ".filter(name => typeof window.__cal[name] === 'function');");
            if (! String.valueOf(mutators).equals("[]"))
                throw new AssertionError("The host still answers share mutations directly: " + mutators);
            System.out.println("  ok   the host has no share mutation to be asked for");

            // A frame that has been tampered with can post whatever it likes. Nothing should
            // come of a grant it asks for itself.
            CalendarApp.inFrame(d,
                    "['shareAddUser', 'shareCreateLink', 'shareRevokeLink'].forEach(type => {"
                            + "  window.parent.postMessage({type: type, target: 'calendar',"
                            + "    calendarName: 'default', username: 'peergos', access: 'edit'}, '*'); });"
                            + "return 1;");
            WebDriver.sleep(3000);
            boolean opened = Boolean.TRUE.equals(d.script("return !!window.__cal.showShare"));
            if (opened)
                throw new AssertionError("A forged share message opened the dialog by itself");
            System.out.println("  ok   a forged share message changes nothing");

            // The same frame can name any file it likes in a batch save. The id becomes a
            // filename on the host, so one that climbs out of the month directory has to be
            // refused there - the app's own sanitiser is not the side with filesystem access.
            CalendarApp.inFrame(d,
                    "window.parent.postMessage({type: 'saveAll', items: [{calendarName: 'default',"
                            + " year: 2026, month: 4, Id: '../../escaped',"
                            + " item: 'BEGIN:VCALENDAR\\r\\nEND:VCALENDAR\\r\\n'}]}, '*');"
                            + "return 1;");
            WebDriver.sleep(3000);
            String calendarDir = CalendarApp.directoryOf(d, Server.USERNAME);
            for (String name : CalendarApp.list(d, calendarDir))
                if (name.contains("escaped"))
                    throw new AssertionError("A forged batch item was written outside its month: "
                            + calendarDir + "/" + name);
            System.out.println("  ok   a forged batch item with a climbing id is not written");

            // Every other message that names a place in the store goes through the same check.
            // First the control: a forged single save with sound values does land, so what
            // follows is the values being refused and not the path being dead.
            String calendarName = String.valueOf(d.script(
                    "return window.__cal.calendarProperties.calendars[0].name;"));
            String minimal = "'BEGIN:VCALENDAR\\r\\nBEGIN:VEVENT\\r\\nUID:forged\\r\\nDTSTART:20260401T100000Z\\r\\n"
                    + "SUMMARY:forged\\r\\nEND:VEVENT\\r\\nEND:VCALENDAR\\r\\n'";
            String post = "let post = m => window.parent.postMessage(m, '*');"
                    + "let sound = {type: 'save', calendarName: " + CalendarApp.quote(calendarName)
                    + ", year: 2026, month: 4, isRecurring: false, isTask: false, item: " + minimal + "};";
            CalendarApp.inFrame(d, post + "post(Object.assign({}, sound, {Id: 'forged-but-sound'})); return 1;");
            CalendarApp.awaitStored(d, calendarDir + "/2026/4", "forged-but-sound.ics", "SUMMARY:forged");
            System.out.println("  ok   a forged save with sound values lands, so the refusals below are about the values");

            CalendarApp.inFrame(d, post
                    + "post(Object.assign({}, sound, {Id: 'escaped-by-name', calendarName: '../../escaped'}));"
                    + "post(Object.assign({}, sound, {Id: 'escaped-by-month', month: 13}));"
                    + "post(Object.assign({}, sound, {Id: 'escaped-by-year', year: 0}));"
                    + "post(Object.assign({}, sound, {Id: 'up/../../escaped-by-slash'}));"
                    + "post(Object.assign({}, sound, {Id: '..'}));"
                    + "post(Object.assign({}, sound, {Id: 'escaped-by-control\\u0000'}));"
                    + "post({type: 'delete', calendarName: '../..', year: 2026, month: 4, Id: 'forged-but-sound'});"
                    + "post({type: 'delete', calendarName: " + CalendarApp.quote(calendarName) + ", year: 2026, month: 4, Id: '../forged-but-sound'});"
                    + "post({type: 'loadAdditional', year: 'x', month: 0});"
                    + "return 1;");
            WebDriver.sleep(4000);
            List<String> month = CalendarApp.list(d, calendarDir + "/2026/4");
            for (String name : month)
                if (name.contains("escaped") || name.equals("..") || name.contains("\u0000"))
                    throw new AssertionError("A forged message with a climbing or unsafe id was written: " + name);
            if (! month.contains("forged-but-sound.ics"))
                throw new AssertionError("A forged delete with a climbing path removed the sound file");
            long refused = ((Number) d.script("return Array.from(document.querySelectorAll('.Vue-Toastification__toast-body'))"
                    + ".filter(el => /unable to save|unable to delete/i.test(el.textContent)).length;")).longValue();
            if (refused < 1)
                throw new AssertionError("The host refused nothing visibly: no error toast for the forged messages");
            System.out.println("  ok   climbing names, months out of range and unsafe ids are refused, and said so");

            // What the app may do: ask. An event carries the Share the primary calendar does not
            // (there is nothing to share a calendar with yet), and it is the same one message.
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", TITLE) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            CalendarApp.waitInFrame(d, "the event on the grid",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(TITLE) + ") !== -1)",
                    60_000);
            CalendarApp.openPopover(d, TITLE);
            CalendarApp.inFrame(d, CalendarApp.click("popover-share") + "return 1;");
            d.waitForScript("the host's share dialog", "window.__cal.showShare", 60_000);
            Object file = d.script("let files = window.__cal.filesToShare || [];"
                    + "return files.length === 1 ? files[0].getFileProperties().name : null;");
            if (file == null)
                throw new AssertionError("The dialog opened without resolving what to share");
            System.out.println("  ok   the host resolved " + file + " and opened its own dialog");

            boolean outsideFrame = Boolean.TRUE.equals(d.script(
                    "return Array.from(document.querySelectorAll('div,section,article'))"
                            + ".some(el => /share/i.test(el.className || '')"
                            + "   && el.getBoundingClientRect().height > 40);"));
            if (! outsideFrame)
                throw new AssertionError("Nothing of the share dialog is on screen outside the frame");
            System.out.println("  ok   drawn in the app's own chrome, not in the sandbox");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
