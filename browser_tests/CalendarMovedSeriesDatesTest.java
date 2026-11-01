import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** A series with a deleted occurrence, then moved to another time and to another start day
 *  through Edit -> All events; then the dates a series adds and its rule's end, as a series moves.
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
            // an all-day value has no time of day, so the added date keeps its own day; and the rule's UNTIL takes
            // the type of the new start, a date, as RFC 5545 has it. A Monday whose 09:00 is deleted but which has a
            // time added at 18:00 still has an occurrence, so it isn't excluded as a whole day
            String zone = String.valueOf(d.script("return Intl.DateTimeFormat().resolvedOptions().timeZone;"));
            LocalDate monday = first.with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
            LocalDate early = monday.plusDays(9);
            LocalDate swapped = monday.plusWeeks(1);
            CalendarApp.write(d, recurring, "turned.ics", CalendarClockChangeTest.vevent("turned", "Turned all-day",
                    "DTSTART;TZID=" + zone + ":" + monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T090000",
                    "DTEND;TZID=" + zone + ":" + monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=" + monday.plusWeeks(5).format(DateTimeFormatter.BASIC_ISO_DATE) + "T235900Z",
                    "EXDATE;TZID=" + zone + ":" + swapped.format(DateTimeFormatter.BASIC_ISO_DATE) + "T090000",
                    "RDATE;TZID=" + zone + ":" + swapped.format(DateTimeFormatter.BASIC_ISO_DATE) + "T180000,"
                            + early.format(DateTimeFormatter.BASIC_ISO_DATE) + "T080000"));
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
            if (rdate == null || ! rdate.matches("RDATE;VALUE=DATE:[0-9,]+") || ! rdate.contains(early.format(DateTimeFormatter.BASIC_ISO_DATE)))
                throw new AssertionError("Turned all-day, the date added at 08:00 on " + early + " should stay on its day, but the file lists " + rdate + ":\n" + allDay);
            String rule = CalendarApp.property(allDay, "RRULE");
            if (rule == null || ! rule.matches(".*UNTIL=\\d{8}(;.*)?"))
                throw new AssertionError("Turned all-day, the rule's UNTIL should be a date like its start, but it says " + rule + ":\n" + allDay);
            String swappedExdate = CalendarApp.property(allDay, "EXDATE");
            if (swappedExdate != null && swappedExdate.contains(swapped.format(DateTimeFormatter.BASIC_ISO_DATE)))
                throw new AssertionError("Turned all-day, " + swapped + " still has its 18:00 occurrence, but the file excludes the day: "
                        + swappedExdate + ":\n" + allDay);
            System.out.println("  ok   an added date at 08:00 kept its day when the series turned all-day: " + rdate);

            // --- moved an hour on, with an UNTIL and a date added late in the day -------------------
            // the rule's UNTIL names its last start, so it takes the new time; the added date moves the hour too,
            // into the next day
            LocalDate last = monday.plusWeeks(3);
            LocalDate friday = monday.plusDays(4);
            CalendarApp.write(d, recurring, "late.ics", CalendarClockChangeTest.vevent("late", "Late added",
                    "DTSTART;TZID=" + zone + ":" + monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T090000",
                    "DTEND;TZID=" + zone + ":" + monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=" + utc(last, 9, zone),
                    "RDATE;TZID=" + zone + ":" + friday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T233000"));
            CalendarClockChangeTest.reload(d, monday);
            CalendarApp.waitInFrame(d, "the series with a late added date", CalendarSeriesTest.drawn("Late added"), 30_000);
            CalendarClockChangeTest.openOn(d, "Late added", monday);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-time", "10:00")
                    + CalendarApp.setField("event-end-time", "10:30") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String later10 = CalendarApp.awaitStored(d, recurring, "late.ics", monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T100000");
            String lateRdate = CalendarApp.property(later10, "RDATE");
            String saturday = friday.plusDays(1).format(DateTimeFormatter.BASIC_ISO_DATE) + "T003000";
            if (lateRdate == null || ! lateRdate.contains(saturday))
                throw new AssertionError("Moved an hour on, the date added at 23:30 on " + friday + " should be listed as " + saturday
                        + ", but the file lists " + lateRdate + ":\n" + later10);
            String lateRule = CalendarApp.property(later10, "RRULE");
            if (lateRule == null || ! lateRule.contains("UNTIL=" + utc(last, 10, zone)))
                throw new AssertionError("Moved to 10:00, the rule should end at " + last + " 10:00 (UNTIL=" + utc(last, 10, zone)
                        + "), but it says " + lateRule + ":\n" + later10);
            System.out.println("  ok   moved an hour on, the late added date went into the next day and the end took the new time: "
                    + lateRdate + ", " + lateRule);

            // --- an UNTIL before the series' time of day on its own day --------------------------------
            // it bounds the starts, so that day has none: it isn't drawn, and the end written for a new time of day
            // is the day before's
            CalendarApp.write(d, recurring, "bound.ics", CalendarClockChangeTest.vevent("bound", "Daily bound",
                    "DTSTART;TZID=" + zone + ":" + monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T090000",
                    "DTEND;TZID=" + zone + ":" + monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T091500",
                    "RRULE:FREQ=DAILY;UNTIL=" + utc(last, 8, 59, zone)));
            CalendarClockChangeTest.reload(d, monday);
            CalendarApp.waitInFrame(d, "the bounded series", CalendarSeriesTest.drawn("Daily bound"), 30_000);
            List<String> bounded = CalendarApp.occurrenceDates(d, "Daily bound");
            if (bounded.contains(last.toString()) || ! bounded.contains(last.minusDays(1).toString()))
                throw new AssertionError("Ending at 08:59 on " + last + ", the 09:00 series should end the day before, but it is drawn on " + bounded);
            CalendarClockChangeTest.openOn(d, "Daily bound", monday);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-time", "10:00")
                    + CalendarApp.setField("event-end-time", "10:15") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String bound = CalendarApp.awaitStored(d, recurring, "bound.ics", monday.format(DateTimeFormatter.BASIC_ISO_DATE) + "T100000");
            String boundRule = CalendarApp.property(bound, "RRULE");
            if (boundRule == null || ! boundRule.contains("UNTIL=" + utc(last.minusDays(1), 10, 0, zone)))
                throw new AssertionError("Moved to 10:00, the series should end at " + last.minusDays(1) + " 10:00, but it says "
                        + boundRule + ":\n" + bound);
            System.out.println("  ok   an end before the series' time on its day leaves that day out, moved or not: " + boundRule);

            // --- an all-day series whose file gives its UNTIL a time --------------------------------
            // RFC 5545 would have a date there, but nothing here turned the series all-day or timed, so deleting
            // an occurrence leaves the rule as the file wrote it
            String keptRule = "RRULE:FREQ=WEEKLY;UNTIL=" + last.format(DateTimeFormatter.BASIC_ISO_DATE) + "T235959Z";
            CalendarApp.write(d, recurring, "kept.ics", CalendarClockChangeTest.vevent("kept", "Kept end",
                    "DTSTART;VALUE=DATE:" + monday.format(DateTimeFormatter.BASIC_ISO_DATE),
                    "DTEND;VALUE=DATE:" + monday.plusDays(1).format(DateTimeFormatter.BASIC_ISO_DATE),
                    keptRule));
            CalendarClockChangeTest.reload(d, monday);
            CalendarApp.waitInFrame(d, "the all-day series", CalendarSeriesTest.drawn("Kept end"), 30_000);
            CalendarClockChangeTest.openOn(d, "Kept end", monday.plusWeeks(1));
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "this");
            String keptFile = CalendarApp.awaitStored(d, recurring, "kept.ics", "EXDATE");
            if (! keptRule.equals(CalendarApp.property(keptFile, "RRULE")))
                throw new AssertionError("Deleting one occurrence rewrote the rule " + keptRule + ":\n" + keptFile);
            System.out.println("  ok   deleting an occurrence left the file's own rule alone: " + keptRule);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** A wall-clock time in the browser's zone as an RFC 5545 UTC stamp, as an UNTIL is written */
    static String utc(LocalDate day, int hour, String zone) {
        return utc(day, hour, 0, zone);
    }

    static String utc(LocalDate day, int hour, int minute, String zone) {
        return day.atTime(hour, minute).atZone(ZoneId.of(zone)).withZoneSameInstant(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
    }
}
