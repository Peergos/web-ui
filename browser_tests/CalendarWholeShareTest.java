import java.nio.file.*;

/** A whole calendar shared with somebody else, in their hands.
 *
 *  The calendar every account starts with is kept in a directory called `default`, so the
 *  one most people share is the one the recipient already has a namesake of. Taking it in
 *  has to work anyway, in the theme they are already using, and what arrives has to be
 *  usable: writable where the share was writable, and downloadable where it was not.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarWholeShareTest.java [engine] [url]
 */
public class CalendarWholeShareTest {

    static final String PASSWORD = CalendarLiveShareTest.PASSWORD;
    static final String IN_MAIN = "A meeting of the owner's";
    static final String IN_READ_ONLY = "Another of the owner's";
    static final String READ_ONLY_CALENDAR = "Readable";

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
        long stamp = System.currentTimeMillis() % 100000;
        String alice = "alice" + stamp, bob = "bob" + stamp;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine),
                Temp.directory("peergos-calendar-wholeshare-"), headless)) {
            Fixtures.signUp(url, alice, PASSWORD);
            Fixtures.signUp(url, bob, PASSWORD);
            CalendarLiveShareTest.befriend(d, url, alice, bob);

            // --- The owner shares the calendar their account came with -------------------------
            CalendarLiveShareTest.signIn(d, url, alice);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String mainDir = CalendarApp.directoryOf(d, alice);
            addEntry(d, null, IN_MAIN, mainDir);
            // The calendar an account is given is the one most people keep everything in,
            // so it has to be passable on from the app itself, not only from the drive.
            String offers = menuActions(d, "My Calendar");
            if (offers.indexOf("Share") < 0)
                throw new AssertionError("the calendar " + alice
                        + " was given cannot be shared from the app - the menu offers: " + offers);
            System.out.println("the menu on the calendar an account starts with offers: " + offers);

            // The whole point of this test: the calendar an account is given when it signs up
            // is kept in a directory of this name, so every account has one.
            if (! "default".equals(mainDir))
                throw new AssertionError("the first calendar is no longer kept in `default`"
                        + " but in `" + mainDir + "`, so this test is checking nothing");
            String otherDir = addCalendar(d, READ_ONLY_CALENDAR, IN_READ_ONLY);
            String data = alice + "/.apps/calendar/data";
            CalendarLiveShareTest.share(d, data, mainDir, bob, true);
            CalendarLiveShareTest.share(d, data, otherDir, bob, false);
            System.out.println(alice + " shared " + mainDir + " writable and " + otherDir + " read only");

            // --- The reader takes the writable one in, in the dark -----------------------------
            CalendarLiveShareTest.signIn(d, url, bob);
            d.script("document.querySelector('#app').__vue__.$store.commit('SET_THEME', true); return 1;");
            // Opened once and left, the way anybody who uses their own calendar before
            // somebody shares one with them would have left it.
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            Page.gotoDrive(d);
            // Saying no is the other way out of the question, and it leaves the reader in the
            // calendar: their own has to be there and usable afterwards.
            answer(d, data + "/" + mainDir, "No");
            try {
                CalendarApp.waitInFrame(d, "bob's own calendar after saying no",
                        "document.getElementById('event-calendar').options.length > 0", 120_000);
            } catch (RuntimeException e) {
                // A bare timeout here says nothing about which half stopped, so say what each had
                System.out.println("  app:  " + CalendarApp.appState(d));
                System.out.println("  host: " + CalendarApp.hostState(d));
                throw e;
            }

            // The calendar an account starts with carries no name of its own, so what
            // arrives is named after whose it is.
            String taken = alice + "-shared";
            Page.gotoDrive(d);
            takeIn(d, data + "/" + mainDir, taken);

            String theme = String.valueOf(CalendarApp.inFrame(d,
                    "return document.documentElement.getAttribute('data-color-scheme');"));
            if (! "dark".equals(theme))
                throw new AssertionError("the calendar opened in " + theme
                        + " for someone who is in dark mode");

            String offered = String.valueOf(CalendarApp.inFrame(d,
                    "let sel = document.getElementById('event-calendar');"
                            + "return Array.from(sel.options).map(function(o) { return o.value; }).join(', ');"));
            if (offered.indexOf(taken) < 0)
                throw new AssertionError("the calendar " + alice + " shared is not one "
                        + bob + " can put anything in - the dialog offers: " + offered);
            System.out.println("the calendars " + bob + " can write to: " + offered);
            CalendarApp.waitInFrame(d, "the owner's own entry, in the calendar they shared",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(IN_MAIN)
                            + ") !== -1)", 120_000);

            // --- And can write to it ----------------------------------------------------------
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", "Written by the reader")
                    + CalendarApp.setField("event-calendar", taken) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            // --- What a read-only one offers --------------------------------------------------
            Page.gotoDrive(d);
            takeIn(d, data + "/" + otherDir, READ_ONLY_CALENDAR);
            String actions = popoverActions(d, IN_READ_ONLY);
            if (actions.indexOf("export") < 0 || actions.indexOf("email") < 0)
                throw new AssertionError("an entry shared read only cannot be taken away: " + actions);
            if (actions.indexOf("edit") >= 0 || actions.indexOf("delete") >= 0)
                throw new AssertionError("an entry shared read only offers to change it: " + actions);
            if (actions.indexOf("share") >= 0)
                throw new AssertionError("an entry in somebody else's calendar offers to pass"
                        + " it on: " + actions);
            System.out.println("a read-only entry offers: " + actions);

            // --- The owner's own file is what the reader wrote to ------------------------------
            CalendarLiveShareTest.signIn(d, url, alice);
            CalendarApp.open(d);
            java.time.LocalDate today = java.time.LocalDate.now();
            String month = mainDir + "/" + today.getYear() + "/" + today.getMonthValue();
            String file = CalendarApp.awaitFileSaying(d, month, "SUMMARY:Written by the reader");
            System.out.println("what " + bob + " made is in " + alice + "'s own calendar: " + file);
        } finally {
            if (own != null) own.close();
        }
    }

    /** A calendar of the owner's own with one entry in it, and its directory. */
    static String addCalendar(WebDriver d, String name, String title) {
        CalendarApp.inFrame(d, CalendarApp.click("add-calendar-button") + "return 1;");
        CalendarApp.waitInFrame(d, "the calendar dialog",
                "document.getElementById('calendar-modal-backdrop').classList.contains('open')", 30_000);
        CalendarApp.inFrame(d, CalendarApp.setField("calendar-name-input", name)
                + "document.getElementById('calendar-form').requestSubmit(); return 1;");
        d.waitForScript("the calendar " + name, CalendarReadOnlyTest.CALENDAR_VIEW
                + " && window.__cal.calendarProperties.calendars.some(c => c.name === '" + name + "')", 60_000);
        // The host knowing about it and the app offering it are two different moments, and
        // an entry addressed to a calendar the dialog cannot offer yet is filed under
        // whichever one it is already showing.
        CalendarApp.waitInFrame(d, "the app to list " + name,
                "Array.from(document.querySelectorAll('.calendar-list-item'))"
                        + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(name)
                        + ") !== -1)", 60_000);
        String directory = String.valueOf(d.script("return window.__cal.calendarProperties.calendars"
                + ".find(c => c.name === '" + name + "').directory;"));
        addEntry(d, name, title, directory);
        return directory;
    }

    /** Adds one entry and waits for the file behind it. The dialog closes when the app hides
     *  it, not when the write lands, and everything after this reads the owner's store. */
    static void addEntry(WebDriver d, String calendarName, String title, String directory) {
        CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
        CalendarApp.inFrame(d, CalendarApp.setField("event-title", title)
                + (calendarName == null ? "" : CalendarApp.setField("event-calendar", calendarName))
                + "return 1;");
        // Read back rather than assumed: assigning a value a select has no option for leaves
        // it on whatever it was showing, and the entry then lands in the wrong calendar.
        if (calendarName != null) {
            String picked = String.valueOf(CalendarApp.inFrame(d,
                    "return document.getElementById('event-calendar').value;"));
            if (! calendarName.equals(picked))
                throw new AssertionError("the dialog would have filed " + title + " under "
                        + picked + " rather than " + calendarName);
        }
        CalendarApp.save(d, "event-save", "event-modal-backdrop");
        java.time.LocalDate today = java.time.LocalDate.now();
        CalendarApp.awaitFileSaying(d, directory + "/" + today.getYear() + "/" + today.getMonthValue(),
                "SUMMARY:" + title);
    }

    /** Takes a calendar in the way the drive routes to one, and says yes to the question.
     *
     *  Waited for by name in the calendar list rather than by the dialog's dropdown: a
     *  calendar shared read only is never offered there, and the dropdown is already full
     *  from whatever was taken in before it. */
    static void takeIn(WebDriver d, String path, String expected) {
        answer(d, path, "Yes");
        CalendarApp.waitInFrame(d, "the calendar " + expected + " to arrive",
                "Array.from(document.querySelectorAll('.calendar-list-item'))"
                        + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(expected)
                        + ") !== -1)", 120_000);
    }

    /** Routes to a calendar the way the drive does, and answers the question it asks. */
    static void answer(WebDriver d, String path, String reply) {
        d.script("let root = null;"
                + "for (const el of document.querySelectorAll('*')) if (el.__vue__) { root = el.__vue__.$root; break; }"
                + "const stack = root ? [root] : [];"
                + "while (stack.length) { const c = stack.pop();"
                + "  if (typeof c.updateHistory === 'function') { window.__router = c; break; }"
                + "  (c.$children || []).forEach(k => stack.push(k)); }"
                + "if (!window.__router) throw new Error('no component that routes');"
                + "window.__router.updateHistory('Calendar', arguments[0], {}, false); return 1;", path);
        d.waitUntil("the question about taking " + path + " in", () -> Boolean.TRUE.equals(d.scriptQuiet(
                "return Array.from(document.querySelectorAll('button'))"
                        + ".some(b => b.textContent.trim() === 'Yes');")) ? true : null, 60_000);
        d.script("Array.from(document.querySelectorAll('button'))"
                + ".find(b => b.textContent.trim() === arguments[0]).click(); return 1;", reply);
        d.waitForScript("the calendar view", CalendarReadOnlyTest.CALENDAR_VIEW, 120_000);
        // Mounted is not loaded: the view is there long before the host has the calendars it
        // then sends to the app, and everything below reads what the app was sent.
        CalendarApp.awaitHost(d);
    }

    /** What the sidebar menu on one calendar offers to do with it. */
    static String menuActions(WebDriver d, String calendarName) {
        return String.valueOf(CalendarApp.inFrame(d,
                "let item = Array.from(document.querySelectorAll('.calendar-list-item'))"
                        + "  .find(el => el.textContent.indexOf(arguments[0]) !== -1);"
                        + "if (!item) return 'no calendar called that';"
                        + "let menu = item.querySelector('.calendar-menu');"
                        + "return Array.from(menu ? menu.querySelectorAll('button') : [])"
                        + "  .map(function(b) { return b.textContent.trim(); }).join(', ') || 'nothing';",
                calendarName));
    }

    /** What the popover on one entry offers to do with it. */
    static String popoverActions(WebDriver d, String title) {
        try {
            CalendarApp.waitInFrame(d, "the entry " + title,
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(title)
                            + ") !== -1)", 120_000);
        } catch (RuntimeException neverDrawn) {
            // An entry that never arrived and one drawn somewhere the grid is not showing
            // look the same from the wait alone, so say what is actually there.
            System.out.println("  the calendars the host holds: " + d.scriptQuiet(
                    "return (window.__cal.calendarProperties.calendars || []).map(function(c) {"
                            + "  return c.name + '@' + c.owner + ' writable=' + c.writable;"
                            + "}).join(' | ')"));
            System.out.println("  the calendars the app lists: " + CalendarApp.inFrame(d,
                    "return Array.from(document.querySelectorAll('.calendar-list-item'))"
                            + ".map(function(el) { return el.textContent.trim().slice(0, 40); }).join(' | ')"));
            System.out.println("  what the grid is showing: " + CalendarApp.inFrame(d,
                    "return Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".map(function(el) { return el.textContent.trim().slice(0, 40); }).join(' | ')"));
            System.out.println("  the month on screen: " + CalendarApp.inFrame(d,
                    "let t = document.getElementById('period-label');"
                            + "return t ? t.textContent.trim() : 'no period label'"));
            throw neverDrawn;
        }
        return String.valueOf(CalendarApp.inFrame(d,
                "let chip = Array.from(document.querySelectorAll('[data-search-event-id]'))"
                        + "  .find(el => el.textContent.indexOf(arguments[0]) !== -1);"
                        + "openPopoverNear(chip.getAttribute('data-search-event-id'), new Date());"
                        + "return ['edit','delete','duplicate','share','email','export'].filter(function(n) {"
                        + "  let el = document.getElementById('popover-' + n);"
                        + "  return el && el.offsetParent !== null; }).join(',') || 'nothing';", title));
    }
}
