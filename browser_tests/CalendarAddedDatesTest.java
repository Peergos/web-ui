import java.nio.file.*;
import java.util.*;

/** Series that list some or all of their dates (RDATE), as other clients and the Android mirror
 *  write them.
 *
 *  A weekly rule with one extra day, a series that is nothing but a list of days, and the same in
 *  all-day form are planted in the store and have to be drawn on every day they name. Then the
 *  three things a user does to a series: delete one day of it, rename the whole of it, and cut it
 *  short from a day on. The dates a file lists have to survive each, and an added date after the
 *  cut has to go with the rest of the series.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarAddedDatesTest.java [engine] [url]
 */
public class CalendarAddedDatesTest {

    static final String ADDED = "Weekly with an extra day";
    static final String LISTED = "Listed days";
    static final String RENAMED = "Listed days renamed";
    static final String ALL_DAY = "Listed all-day";

    // 4 January 2027 is a Monday.
    static final String ADDED_ICS = String.join("\r\n",
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Another client//EN",
            "BEGIN:VEVENT", "UID:added-dates", "DTSTAMP:20261201T090000Z",
            "DTSTART:20270104T090000Z", "DTEND:20270104T100000Z", "SUMMARY:" + ADDED,
            "RRULE:FREQ=WEEKLY;COUNT=2", "RDATE:20270106T090000Z",
            "END:VEVENT", "END:VCALENDAR", "");
    static final String LISTED_ICS = String.join("\r\n",
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Another client//EN",
            "BEGIN:VEVENT", "UID:listed-dates", "DTSTAMP:20261201T090000Z",
            "DTSTART:20270112T090000Z", "DTEND:20270112T100000Z", "SUMMARY:" + LISTED,
            "RDATE:20270114T090000Z,20270116T090000Z",
            "END:VEVENT", "END:VCALENDAR", "");
    static final String ALL_DAY_ICS = String.join("\r\n",
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Another client//EN",
            "BEGIN:VEVENT", "UID:listed-days", "DTSTAMP:20261201T090000Z",
            "DTSTART;VALUE=DATE:20270120", "DTEND;VALUE=DATE:20270121", "SUMMARY:" + ALL_DAY,
            "RDATE;VALUE=DATE:20270122",
            "END:VEVENT", "END:VCALENDAR", "");

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
        Path downloads = Temp.directory("peergos-calendar-added-dates-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String recurring = CalendarApp.directoryOf(d, Server.USERNAME) + "/recurring";
            CalendarApp.write(d, recurring, "added-dates.ics", ADDED_ICS);
            CalendarApp.write(d, recurring, "listed-dates.ics", LISTED_ICS);
            CalendarApp.write(d, recurring, "listed-days.ics", ALL_DAY_ICS);
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            CalendarApp.gotoMonth(d, "2027-01-04");
            System.out.println("planted under " + recurring);

            assertDrawn(d, ADDED, "2027-01-04", "2027-01-06", "2027-01-11");
            System.out.println("  ok   a rule's extra day is drawn beside the days of the rule");
            assertDrawn(d, LISTED, "2027-01-12", "2027-01-14", "2027-01-16");
            System.out.println("  ok   a series of listed days is drawn on each of them");
            assertDrawn(d, ALL_DAY, "2027-01-20", "2027-01-22");
            System.out.println("  ok   and so is an all-day one");
            if (! CalendarApp.read(d, recurring, "listed-dates.ics").equals(LISTED_ICS))
                throw new AssertionError("Opening the calendar rewrote a series of listed days");

            // --- delete one listed day ---------------------------------------------------------
            openPopoverOn(d, LISTED, "2027-01-14");
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "this");
            String listed = CalendarApp.awaitStored(d, recurring, "listed-dates.ics", "EXDATE");
            CalendarApp.assertContains(listed, "20270114T");
            CalendarApp.assertContains(listed, "RDATE");
            if (CalendarApp.property(listed, "RRULE") != null)
                throw new AssertionError("A series of listed days was given a rule:\n" + listed);
            assertDrawn(d, LISTED, "2027-01-12", "2027-01-16");
            System.out.println("  ok   one listed day deleted is excluded, and the others stay");

            // --- rename the whole series -------------------------------------------------------
            openPopoverOn(d, LISTED, "2027-01-12");
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", RENAMED) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String renamed = CalendarApp.awaitStored(d, recurring, "listed-dates.ics", "SUMMARY:" + RENAMED);
            CalendarApp.assertContains(renamed, "RDATE");
            CalendarApp.assertContains(renamed, "20270116T");
            CalendarApp.assertContains(renamed, "EXDATE");
            assertDrawn(d, RENAMED, "2027-01-12", "2027-01-16");
            System.out.println("  ok   renaming the series keeps its listed days, which the dialog has no control for");

            // --- cut the rule short from its extra day on --------------------------------------
            openPopoverOn(d, ADDED, "2027-01-06");
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            String cut = CalendarApp.awaitStored(d, recurring, "added-dates.ics", "UNTIL=");
            if (CalendarApp.property(cut, "RDATE") != null)
                throw new AssertionError("An added day after the cut stayed with the series:\n" + cut);
            assertDrawn(d, ADDED, "2027-01-04");
            System.out.println("  ok   cutting a series short takes its later added days with it");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Waits for the grid to draw the entry on exactly these days. */
    static void assertDrawn(WebDriver d, String title, String... dates) {
        List<String> expected = Arrays.asList(dates);
        long deadline = System.currentTimeMillis() + 30_000;
        List<String> drawn = List.of();
        while (System.currentTimeMillis() < deadline) {
            drawn = CalendarApp.occurrenceDates(d, title);
            if (drawn.equals(expected))
                return;
            try {
                Thread.sleep(250);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        throw new AssertionError(title + " should be drawn on " + expected + " but is on " + drawn);
    }

    /** Opens the popover of the entry's chip on one day, as CalendarApp.openPopover does for the first. */
    static void openPopoverOn(WebDriver d, String title, String date) {
        for (int attempt = 0; attempt < 3; attempt++) {
            CalendarApp.inFrame(d, "let chips = Array.from(document.querySelectorAll('[data-search-event-id]'))"
                    + "  .filter(el => el.textContent.indexOf(arguments[0]) !== -1"
                    + "    && el.closest('[data-date]') && el.closest('[data-date]').getAttribute('data-date') === arguments[1]);"
                    + "if (chips.length === 0) throw new Error('no chip for ' + arguments[0] + ' on ' + arguments[1]);"
                    + "chips[0].click(); return 1;", title, date);
            try {
                CalendarApp.waitInFrame(d, "the event popover",
                        "document.getElementById('event-popover').classList.contains('open')", 5_000);
                return;
            } catch (IllegalStateException retry) {
                // the click landed before the grid settled; try again
            }
        }
        throw new AssertionError("The popover never opened for " + title + " on " + date);
    }
}
