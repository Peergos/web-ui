import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.time.temporal.*;
import java.util.*;

/** "This and following" splits a series at an occurrence, and the part from there on is a series of
 *  its own. It takes the series' deleted (EXDATE) and added (RDATE) dates after that occurrence,
 *  moved as far as it moved: left behind, the deleted occurrences come back and the added ones are
 *  drawn where the series no longer is. The earlier ones stay with the part before, or they are
 *  drawn twice. Both ways in: a drag to another time, and the dialog turning an all-day series into
 *  a timed one, whose dates have to change form as well - a bare date could not be written as a time.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarFollowingDatesTest.java [engine] [url]
 */
public class CalendarFollowingDatesTest {

    static final String ZONE = "Europe/Athens";
    static final DateTimeFormatter BASIC = DateTimeFormatter.BASIC_ISO_DATE;

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
        Fixtures.Account me = Fixtures.account(url);
        // the seeded times are read in the browser's zone
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-"), headless, ZONE)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            CalendarApp.open(d);
            String recurring = CalendarApp.directoryOf(d, me.name()) + "/recurring";
            // Mondays, with a Wednesday added before the split and one after, and a Monday deleted after it
            LocalDate first = LocalDate.now().withDayOfMonth(1).plusMonths(1).with(TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY));
            LocalDate earlyAdded = first.plusDays(2);
            LocalDate split = first.plusWeeks(1);
            LocalDate lateAdded = first.plusWeeks(2).plusDays(2);
            LocalDate deleted = first.plusWeeks(3);

            // --- dragged to another time ----------------------------------------------------------
            String dragged = "Dragged split";
            CalendarApp.write(d, recurring, "dragged.ics", CalendarClockChangeTest.vevent("dragged", dragged,
                    "DTSTART;TZID=" + ZONE + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + ZONE + ":" + first.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY",
                    "EXDATE;TZID=" + ZONE + ":" + deleted.format(BASIC) + "T090000",
                    "RDATE;TZID=" + ZONE + ":" + earlyAdded.format(BASIC) + "T090000," + lateAdded.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, split);
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn(dragged), 30_000);
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, split);
            CalendarApp.waitInFrame(d, "the occurrence in its week", CalendarDragTest.inColumn(split.toString(), dragged), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn(dragged, split.toString(),
                    CalendarDragTest.slotDistance("09:00:00", "11:00:00"), false), "following");
            String fresh = CalendarApp.read(d, recurring, newSeries(d, recurring, "dragged.ics", dragged));
            assertListed(fresh, "EXDATE", deleted, "T110000", "the deleted Monday after the split");
            assertListed(fresh, "RDATE", lateAdded, "T110000", "the Wednesday added after the split");
            assertNotListed(fresh, "RDATE", earlyAdded, "the Wednesday added before the split");
            String cut = CalendarApp.awaitStored(d, recurring, "dragged.ics", "UNTIL=");
            assertListed(cut, "RDATE", earlyAdded, "T090000", "the Wednesday added before the split");
            System.out.println("  ok   dragged: the dates after the split moved to 11:00 with it, the earlier one stayed");

            // --- from all day to a time, in the dialog ----------------------------------------------
            String edited = "Edited split";
            CalendarApp.write(d, recurring, "edited.ics", CalendarClockChangeTest.vevent("edited", edited,
                    "DTSTART;VALUE=DATE:" + first.format(BASIC),
                    "DTEND;VALUE=DATE:" + first.plusDays(1).format(BASIC),
                    "RRULE:FREQ=WEEKLY",
                    "EXDATE;VALUE=DATE:" + deleted.format(BASIC),
                    "RDATE;VALUE=DATE:" + earlyAdded.format(BASIC) + "," + lateAdded.format(BASIC)));
            CalendarClockChangeTest.reload(d, split);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the all-day series on the grid", CalendarSeriesTest.drawn(edited), 30_000);
            CalendarClockChangeTest.openOn(d, edited, split);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("event-all-day")
                    + CalendarApp.setField("event-start-date", split.toString())
                    + CalendarApp.setField("event-start-time", "10:00")
                    + CalendarApp.setField("event-end-date", split.toString())
                    + CalendarApp.setField("event-end-time", "10:30") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String timed = CalendarApp.read(d, recurring, newSeries(d, recurring, "edited.ics", edited));
            CalendarApp.assertTimeIs(timed, "DTSTART", split.atTime(10, 0));
            assertListed(timed, "EXDATE", deleted, "T100000", "the deleted Monday after the split");
            assertListed(timed, "RDATE", lateAdded, "T100000", "the Wednesday added after the split");
            assertNotListed(timed, "RDATE", earlyAdded, "the Wednesday added before the split");
            CalendarApp.awaitStored(d, recurring, "edited.ics", "UNTIL=");
            CalendarClockChangeTest.reload(d, split);
            CalendarApp.waitInFrame(d, "both parts on the grid", CalendarSeriesTest.drawn(edited), 30_000);
            List<String> drawn = CalendarApp.occurrenceDates(d, edited);
            for (LocalDate day : List.of(first, earlyAdded, split, lateAdded))
                if (! drawn.contains(day.toString()))
                    throw new AssertionError("After the split, nothing is drawn on " + day + ": " + drawn);
            if (drawn.contains(deleted.toString()))
                throw new AssertionError("The deleted occurrence is back on " + deleted + ": " + drawn);
            System.out.println("  ok   edited: the series went to 10:00 with its later dates, and draws as it should: " + drawn);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** The week view opens on a week of the month the grid was on, which can be after the day, and the
     *  drag test's walk only goes forward: so it is stepped back first. */
    static void weekShowing(WebDriver d, LocalDate day) {
        for (int i = 0; i < 8; i++) {
            Object earliest = CalendarApp.inFrame(d, "return Array.from(document.querySelectorAll('[data-date]'))"
                    + ".map(c => c.getAttribute('data-date')).sort()[0] || null;");
            if (earliest != null && ! LocalDate.parse(String.valueOf(earliest)).isAfter(day))
                break;
            CalendarApp.inFrame(d, "let prev = document.querySelector('#calendar [aria-label^=\"Prev\"]');"
                    + "if (!prev) throw new Error('no previous button in the toolbar');"
                    + "prev.click(); return 1;");
            WebDriver.sleep(500);
        }
        CalendarDragTest.weekShowing(d, day.toString());
    }

    /** The series file the split wrote, beside the one it cut short */
    static String newSeries(WebDriver d, String recurring, String original, String title) {
        return d.waitUntil("a second series file for " + title, () -> {
            for (String name : CalendarApp.list(d, recurring)) {
                if (name.equals(original))
                    continue;
                String ics = CalendarApp.read(d, recurring, name);
                if (ics.contains("SUMMARY:" + title) && CalendarApp.property(ics, "RRULE") != null)
                    return name;
            }
            return null;
        }, 120_000);
    }

    static void assertListed(String ics, String name, LocalDate day, String time, String what) {
        String line = CalendarApp.property(ics, name);
        if (line == null || ! line.contains(day.format(BASIC) + time))
            throw new AssertionError(what + " should be listed as " + day.format(BASIC) + time + " in " + name + ":\n" + ics);
    }

    static void assertNotListed(String ics, String name, LocalDate day, String what) {
        String line = CalendarApp.property(ics, name);
        if (line != null && line.contains(day.format(BASIC)))
            throw new AssertionError(what + " is listed in " + name + " here too, so it is drawn twice:\n" + ics);
    }
}
