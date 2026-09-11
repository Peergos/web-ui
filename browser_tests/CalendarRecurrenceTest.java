import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** The repeat shapes the previous calendar's editor could build, and the ones other clients write.
 *
 *  A rule can be stored perfectly and still be drawn on the wrong days, so each shape is checked
 *  twice: the RRULE that reaches the file, and the dates the grid actually puts the entry on. The
 *  yearly-by-weekday shape is the one the old editor's "by Day" mode produced; a rule whose plain
 *  weekday codes no control here can offer - the FREQ=DAILY spelling of "every weekday" - is
 *  planted in the store the way another client would leave it, and has to be drawn on weekdays
 *  only while its file stays exactly as it was written.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarRecurrenceTest.java [engine] [url]
 */
public class CalendarRecurrenceTest {

    static final String YEARLY = "Third Monday in January";
    static final String WEEKDAYS = "Every weekday";
    static final String FILTERED = "Weekdays as another client writes them";

    // 2027: the third Monday of January is the 18th, and the 5th is a Tuesday.
    static final String FILTERED_ICS = String.join("\r\n",
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Another client//EN",
            "BEGIN:VEVENT", "UID:filtered-weekdays",
            "DTSTAMP:20270105T090000Z", "DTSTART:20270105T090000Z", "DTEND:20270105T093000Z",
            "SUMMARY:" + FILTERED, "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
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
        Path downloads = Temp.directory("peergos-calendar-recurrence-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            String recurring = calendar + "/recurring";
            System.out.println("calendar open, files under " + calendar);

            // --- yearly on a weekday of a month, which the old editor called "by Day" ---------
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", YEARLY)
                            + CalendarApp.setField("event-start-date", "2027-01-18")
                            + CalendarApp.setField("event-start-time", "09:00")
                            + CalendarApp.setField("event-end-date", "2027-01-18")
                            + CalendarApp.setField("event-end-time", "10:00")
                            + CalendarApp.setField("event-repeat-freq", "yearly")
                            + CalendarApp.setField("event-repeat-monthly-mode", "nthWeekday")
                            + CalendarApp.setField("event-repeat-ordinal", "3")
                            + CalendarApp.setField("event-repeat-nth-weekday", "MO")
                            + CalendarApp.setField("event-repeat-month", "1")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String yearlyFile = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:" + YEARLY);
            String yearlyIcs = CalendarApp.read(d, recurring, yearlyFile);
            CalendarApp.assertHas(yearlyIcs, "RRULE", "FREQ=YEARLY;BYDAY=3MO;BYMONTH=1");
            System.out.println("  ok   a yearly rule can name a weekday of a month");

            // The third Mondays of January are the 18th in 2027 and the 17th in 2028: a rule
            // expanded on its start date instead would put both on the 18th.
            assertDrawnOn(d, YEARLY, "2027-01-18", "2027-01-18");
            assertDrawnOn(d, YEARLY, "2028-01-17", "2028-01-17");
            System.out.println("  ok   and it lands on that weekday every year, not on its start date");

            // --- the weekday shortcut writes the rule the rest of the world reads ------------
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", WEEKDAYS)
                            + CalendarApp.setField("event-start-date", "2027-03-01")
                            + CalendarApp.setField("event-start-time", "09:00")
                            + CalendarApp.setField("event-end-date", "2027-03-01")
                            + CalendarApp.setField("event-end-time", "09:30")
                            + CalendarApp.setField("event-repeat-freq", "weekday")
                            + "return 1;");
            boolean asWeekly = Boolean.TRUE.equals(CalendarApp.inFrame(d,
                    "return document.getElementById('event-repeat-freq').value === 'weekly'"
                            + " && ['MO','TU','WE','TH','FR'].every(function (day) {"
                            + "      return document.querySelector('.weekday-toggle[data-day=\"' + day + '\"]')"
                            + "             .classList.contains('selected'); });"));
            if (! asWeekly)
                throw new AssertionError("The weekday shortcut did not resolve into a weekly rule"
                        + " with its five days ticked, where they can be seen and changed");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String weekdayFile = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:" + WEEKDAYS);
            CalendarApp.assertHas(CalendarApp.read(d, recurring, weekdayFile), "RRULE",
                    "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
            System.out.println("  ok   the weekday shortcut writes an ordinary weekly rule");

            // --- the same thing as another client spells it ----------------------------------
            CalendarApp.write(d, recurring, "filtered-weekdays.ics", FILTERED_ICS);
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            CalendarApp.gotoMonth(d, "2027-01-05");
            CalendarApp.waitInFrame(d, "the planted series on the grid",
                    "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                            + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(FILTERED) + ") !== -1)",
                    60_000);
            List<String> drawn = CalendarApp.occurrenceDates(d, FILTERED);
            for (String date : drawn) {
                DayOfWeek day = LocalDate.parse(date).getDayOfWeek();
                if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY)
                    throw new AssertionError("A rule that names only weekdays was drawn on " + date
                            + ", a " + day + ": " + drawn);
            }
            if (drawn.size() < 5)
                throw new AssertionError("A daily rule filtered to weekdays hardly drew at all: " + drawn);
            System.out.println("  ok   a weekday rule another client wrote is drawn on weekdays only");

            if (! CalendarApp.read(d, recurring, "filtered-weekdays.ics").equals(FILTERED_ICS))
                throw new AssertionError("Opening the calendar rewrote a rule it cannot show in its"
                        + " dialog; it has to be left exactly as the other client wrote it");
            System.out.println("  ok   and its file is still exactly what that client wrote");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Walks the grid to the month holding `isoDate` and asserts the entry is drawn there. */
    static void assertDrawnOn(WebDriver d, String title, String isoDate, String expected) {
        CalendarApp.gotoMonth(d, isoDate);
        CalendarApp.waitInFrame(d, title + " in the month of " + isoDate,
                "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                        + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(title) + ") !== -1)",
                60_000);
        List<String> drawn = CalendarApp.occurrenceDates(d, title);
        if (! drawn.contains(expected))
            throw new AssertionError(title + " should fall on " + expected
                    + " but the grid drew it on " + drawn);
    }
}
