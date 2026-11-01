import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** A series with a deleted occurrence, then moved to another time and to another start day
 *  through Edit -> All events.
 *
 *  A deleted occurrence is an EXDATE naming its start. Moving the series to another time moves
 *  every start, so the EXDATE has to take the new time, or it names a time the series no longer
 *  has and the deleted occurrence comes back. Moving its start to another day does not move the
 *  rule's days - the dialog keeps the weekday - so there the EXDATE keeps its day.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarMovedSeriesDatesTest.java [engine] [url]
 */
public class CalendarMovedSeriesDatesTest {

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, me.name());
            String recurring = calendar + "/recurring";
            LocalDate first = LocalDate.now().withDayOfMonth(1).plusMonths(1).withDayOfMonth(2);
            LocalDate deleted = first.plusWeeks(1);
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", "Shifted standup")
                            + CalendarApp.setField("event-start-date", first.toString())
                            + CalendarApp.setField("event-start-time", "10:00")
                            + CalendarApp.setField("event-end-date", first.toString())
                            + CalendarApp.setField("event-end-time", "10:30")
                            + CalendarApp.setField("event-repeat-freq", "weekly")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String file = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:Shifted standup");

            CalendarApp.gotoMonth(d, deleted.toString());
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn("Shifted standup"), 30_000);
            CalendarClockChangeTest.openOn(d, "Shifted standup", deleted);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "this");
            String excluded = CalendarApp.awaitStored(d, recurring, file, "EXDATE");
            System.out.println("  deleted one: " + CalendarApp.property(excluded, "EXDATE"));

            CalendarApp.waitInFrame(d, "the series still on the grid", CalendarSeriesTest.drawn("Shifted standup"), 30_000);
            CalendarApp.openPopover(d, "Shifted standup");
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-time", "11:00")
                    + CalendarApp.setField("event-end-time", "11:30") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            // waits for the series' own start, as T1100 alone also matches a time stamp written in the 11:00 minute
            String moved = CalendarApp.awaitStored(d, recurring, file, first.format(DateTimeFormatter.BASIC_ISO_DATE) + "T110000");
            String exdate = CalendarApp.property(moved, "EXDATE");
            if (exdate == null || ! exdate.contains(deleted.format(DateTimeFormatter.BASIC_ISO_DATE) + "T110000"))
                throw new AssertionError("The series moved to 11:00 but its deleted occurrence did not: " + exdate);
            System.out.println("  ok   the deleted occurrence moved with the series: " + exdate);
            CalendarClockChangeTest.reload(d, deleted);
            CalendarApp.waitInFrame(d, "the series after a reload", CalendarSeriesTest.drawn("Shifted standup"), 30_000);
            List<String> drawn = CalendarApp.occurrenceDates(d, "Shifted standup");
            if (drawn.contains(deleted.toString()))
                throw new AssertionError("The deleted occurrence is back on " + deleted + ": " + drawn);
            System.out.println("  ok   and it stays deleted: " + drawn);

            LocalDate later = first.plusDays(1);
            CalendarApp.openPopover(d, "Shifted standup");
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-date", later.toString())
                    + CalendarApp.setField("event-end-date", later.toString()) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String restarted = CalendarApp.awaitStored(d, recurring, file, later.format(DateTimeFormatter.BASIC_ISO_DATE) + "T110000");
            String kept = CalendarApp.property(restarted, "EXDATE");
            if (kept == null || ! kept.contains(deleted.format(DateTimeFormatter.BASIC_ISO_DATE) + "T110000"))
                throw new AssertionError("The series' start moved a day, on the same weekdays, and its deleted occurrence moved off its day: " + kept);
            CalendarClockChangeTest.reload(d, deleted);
            CalendarApp.waitInFrame(d, "the series after the start moved", CalendarSeriesTest.drawn("Shifted standup"), 30_000);
            List<String> after = CalendarApp.occurrenceDates(d, "Shifted standup");
            if (after.contains(deleted.toString()))
                throw new AssertionError("The deleted occurrence is back on " + deleted + " once the start moved: " + after);
            System.out.println("  ok   a start moved a day keeps the deleted occurrence on its day: " + kept);

            // --- an added date at a time of its own, when the series turns all-day ------------------
            // an all-day value has no time, so it keeps its own day rather than moving by the series' 09:00
            String zone = String.valueOf(d.script("return Intl.DateTimeFormat().resolvedOptions().timeZone;"));
            LocalDate monday = first.with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
            LocalDate early = monday.plusDays(9);
            CalendarApp.write(d, recurring, "turned.ics", CalendarClockChangeTest.vevent("turned", "Turned all-day",
                    "DTSTART;TZID=" + zone + ":" + monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T090000",
                    "DTEND;TZID=" + zone + ":" + monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "RDATE;TZID=" + zone + ":" + early.format(DateTimeFormatter.BASIC_ISO_DATE) + "T080000"));
            CalendarClockChangeTest.reload(d, monday);
            CalendarApp.waitInFrame(d, "the series to turn all-day", CalendarSeriesTest.drawn("Turned all-day"), 30_000);
            CalendarClockChangeTest.openOn(d, "Turned all-day", monday);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("event-all-day") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String allDay = CalendarApp.awaitStored(d, recurring, "turned.ics", "DTSTART;VALUE=DATE:");
            String rdate = CalendarApp.property(allDay, "RDATE");
            if (rdate == null || ! rdate.contains(early.format(DateTimeFormatter.BASIC_ISO_DATE)))
                throw new AssertionError("Turned all-day, the date added at 08:00 on " + early + " should stay on its day, but the file lists " + rdate + ":\n" + allDay);
            System.out.println("  ok   an added date at 08:00 kept its day when the series turned all-day: " + rdate);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
