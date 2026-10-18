import java.nio.file.*;
import java.time.YearMonth;
import java.util.*;

/** Emptying the calendar an account came with: the one calendar that can't be deleted offers
 *  Empty instead, which deletes every event and task in it and keeps the calendar - its
 *  calendar.inf, its place in the list - and every other calendar as it was.
 *
 *  The host asks first, every time, and a No leaves the store alone. Afterwards the store is
 *  read back and the phone's copy told, so what the grid shows is what is left.
 *
 *  An account of its own: emptying the suite's shared account would take every other test's
 *  entries with it.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarEmptyTest.java [engine] [url]
 */
public class CalendarEmptyTest {

    static final String SINGLE = "Emptied single", SERIES = "Emptied series", TASK = "Emptied task";
    static final String KEPT_CALENDAR = "Kept", KEPT_ENTRY = "Stays put";

    static String entry(String kind, String uid, String summary, String extra) {
        return String.join("\r\n", "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//browser test//EN",
                "BEGIN:" + kind, "UID:" + uid, "DTSTAMP:20260101T090000Z", extra, "SUMMARY:" + summary,
                "END:" + kind, "END:VCALENDAR", "");
    }

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
        String user = "emptier" + (System.currentTimeMillis() % 100000);
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-empty-"), headless)) {
            Fixtures.signUp(url, user, CalendarLiveShareTest.PASSWORD);
            CalendarLiveShareTest.signIn(d, url, user);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String main = CalendarApp.directoryOf(d, user);

            // --- a calendar with nothing in it is already empty, not an error ------------------
            clickEmpty(d);
            awaitQuestion(d);
            answer(d, "Yes");
            CalendarApp.awaitHost(d);
            WebDriver.sleep(2000);
            Object complaint = d.script("return Array.from(document.querySelectorAll('.Vue-Toastification__toast'))"
                    + ".map(t => t.textContent.trim()).filter(t => t.indexOf('empty') !== -1).join(' / ')");
            if (complaint != null && ! String.valueOf(complaint).isEmpty())
                throw new AssertionError("Emptying a calendar with nothing in it should not be an error: " + complaint);
            System.out.println("  ok   a calendar with nothing in it empties without complaint");

            // --- something in each of the places a calendar keeps entries ----------------------
            YearMonth now = YearMonth.now();
            String day = String.format("%04d%02d15", now.getYear(), now.getMonthValue());
            String month = main + "/" + now.getYear() + "/" + now.getMonthValue();
            CalendarApp.write(d, month, "emptied-single.ics", entry("VEVENT", "emptied-single", SINGLE,
                    "DTSTART:" + day + "T090000Z\r\nDTEND:" + day + "T100000Z"));
            CalendarApp.write(d, main + "/recurring", "emptied-series.ics", entry("VEVENT", "emptied-series", SERIES,
                    "DTSTART:" + day + "T120000Z\r\nDTEND:" + day + "T130000Z\r\nRRULE:FREQ=WEEKLY"));
            CalendarApp.write(d, main + "/tasks", "emptied-task.ics", entry("VTODO", "emptied-task", TASK,
                    "DUE;VALUE=DATE:" + day + "\r\nSTATUS:NEEDS-ACTION"));
            String kept = CalendarWholeShareTest.addCalendar(d, KEPT_CALENDAR, KEPT_ENTRY);
            String keptMonth = kept + "/" + now.getYear() + "/" + now.getMonthValue();
            List<String> keptBefore = CalendarApp.list(d, keptMonth);
            refresh(d);
            CalendarApp.waitInFrame(d, "the entries put in the store",
                    "document.body.textContent.indexOf(" + CalendarApp.quote(SINGLE) + ") !== -1"
                            + " && document.body.textContent.indexOf(" + CalendarApp.quote(TASK) + ") !== -1", 60_000);

            // --- offered where Delete is not -----------------------------------------------------
            String mainMenu = CalendarWholeShareTest.menuActions(d, "My Calendar");
            String keptMenu = CalendarWholeShareTest.menuActions(d, KEPT_CALENDAR);
            if (! mainMenu.contains("Empty") || mainMenu.contains("Delete"))
                throw new AssertionError("The first calendar should offer Empty and no Delete: " + mainMenu);
            if (keptMenu.contains("Empty") || ! keptMenu.contains("Delete"))
                throw new AssertionError("Any other calendar keeps Delete and has no Empty: " + keptMenu);
            System.out.println("  ok   menus: My Calendar [" + mainMenu + "], " + KEPT_CALENDAR + " [" + keptMenu + "]");
            for (String[] each : new String[][] {{"My Calendar", "empty"}, {KEPT_CALENDAR, "delete"}}) {
                Object shown = CalendarApp.inFrame(d, openEditDialog(each[0])
                        + "return ['calendar-empty', 'calendar-delete'].filter(id => document.getElementById(id).style.display !== 'none')"
                        + "  .map(id => id.substring(9)).join(',');");
                CalendarApp.inFrame(d, CalendarApp.click("calendar-cancel") + "return 1;");
                if (! each[1].equals(String.valueOf(shown)))
                    throw new AssertionError("The edit dialog of " + each[0] + " should offer " + each[1] + " only: " + shown);
            }
            System.out.println("  ok   the edit dialog offers the same");

            // --- asked first, and No changes nothing ---------------------------------------------
            List<String> before = CalendarApp.list(d, main);
            clickEmpty(d);
            awaitQuestion(d);
            Object asked = d.script("const t = document.getElementById('confirm-header-id').textContent.trim(),"
                    + " b = (document.getElementById('confirm-body-id') || {textContent: ''}).textContent.trim();"
                    + " return t === arguments[0] && b.includes('not reversible') ? 'named' : t + ' / ' + b", "Empty calendar My Calendar?");
            if (! "named".equals(asked))
                throw new AssertionError("The question should name the calendar and say it can't be undone: " + asked);
            answer(d, "No");
            WebDriver.sleep(1500);
            if (! CalendarApp.list(d, main).equals(before) || CalendarApp.list(d, month).isEmpty())
                throw new AssertionError("Answering No should leave the calendar as it was: " + CalendarApp.list(d, main));
            System.out.println("  ok   asked by name, and No keeps " + before);

            // --- Yes empties it, and only it -----------------------------------------------------
            CalendarApp.standInForAndroid(d, main);
            clickEmpty(d);
            awaitQuestion(d);
            answer(d, "Yes");
            // The first calendar's name and colour are kept in the calendar list rather than in
            // a calendar.inf of its own, so its directory empties completely; any other's keeps
            // that file.
            List<String> expectLeft = before.contains("calendar.inf") ? List.of("calendar.inf") : List.of();
            List<String> left = d.waitUntil("the calendar to be emptied", () -> {
                List<String> names = CalendarApp.list(d, main);
                return names.equals(expectLeft) ? names : null;
            }, 120_000);
            Object listed = d.script("return window.__cal.calendarProperties.calendars"
                    + ".some(c => c.name === 'My Calendar' && c.directory === arguments[0])", main);
            if (! Boolean.TRUE.equals(listed))
                throw new AssertionError("The calendar itself should stay in the list, name and all: " + CalendarApp.hostState(d));
            if (! CalendarApp.list(d, keptMonth).equals(keptBefore))
                throw new AssertionError("Another calendar should keep its entries: " + CalendarApp.list(d, keptMonth));
            System.out.println("  ok   left " + left + ", still called My Calendar; " + KEPT_CALENDAR + " keeps " + keptBefore);
            CalendarApp.waitInFrame(d, "the grid and the task list to show what is left",
                    "[" + CalendarApp.quote(SINGLE) + ", " + CalendarApp.quote(SERIES) + ", " + CalendarApp.quote(TASK) + "]"
                            + ".every(t => document.body.textContent.indexOf(t) === -1)"
                            + " && document.body.textContent.indexOf(" + CalendarApp.quote(KEPT_ENTRY) + ") !== -1"
                            + " && Array.from(document.querySelectorAll('.calendar-list-item')).some(el => el.textContent.indexOf('My Calendar') !== -1)",
                    60_000);
            System.out.println("  ok   the app reads the store again: the emptied entries are gone, " + KEPT_ENTRY + " and the calendar stay");
            int told = d.waitUntil("the phone's copy to be told", () -> {
                int n = CalendarApp.timesTold(d);
                return n > 0 ? n : null;
            }, 60_000);
            List<String> phone = CalendarApp.listedWhenTold(d, told);
            if (! phone.equals(expectLeft))
                throw new AssertionError("The phone should be told once the calendar is empty, not before: " + phone);
            System.out.println("  ok   the phone's copy is told after the files are gone");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static void refresh(WebDriver d) {
        CalendarApp.inFrame(d, CalendarApp.click("overflow-menu-button") + CalendarApp.click("overflow-refresh-button") + "return 1;");
        CalendarApp.awaitHost(d);
        CalendarApp.waitInFrame(d, "the refresh", "document.getElementById('load-progress').dataset.pending === '0'", 60_000);
    }

    static String openEditDialog(String calendarName) {
        return "let item = Array.from(document.querySelectorAll('.calendar-list-item'))"
                + "  .find(el => el.textContent.indexOf(" + CalendarApp.quote(calendarName) + ") !== -1);"
                + "item.querySelector('.calendar-menu-button').click();"
                + "Array.from(document.querySelectorAll('.calendar-menu.open button'))"
                + "  .find(b => b.textContent.trim() === 'Edit').click();";
    }

    static void clickEmpty(WebDriver d) {
        CalendarApp.inFrame(d, "let item = Array.from(document.querySelectorAll('.calendar-list-item'))"
                + "  .find(el => el.textContent.indexOf('My Calendar') !== -1);"
                + "item.querySelector('.calendar-menu-button').click();"
                + "let empty = Array.from(document.querySelectorAll('.calendar-menu.open button'))"
                + "  .find(b => b.textContent.trim() === 'Empty');"
                + "if (!empty) throw new Error('no Empty in the open menu');"
                + "empty.click(); return 1;");
    }

    static void awaitQuestion(WebDriver d) {
        d.waitForScript("Peergos' confirmation", "!!document.getElementById('confirm-header-id')", 30_000);
    }

    static void answer(WebDriver d, String button) {
        d.script("Array.from(document.querySelectorAll('.pg-dialog__actions button'))"
                + "  .find(b => b.textContent.trim() === arguments[0]).click(); return 1;", button);
        d.waitForScript("the confirmation to close", "!document.getElementById('confirm-header-id')", 10_000);
    }
}
