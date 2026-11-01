import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.time.temporal.*;
import java.util.*;

/** "This and following" splits a series at an occurrence, and the part from there on is a series of
 *  its own. It takes the series' deleted (EXDATE) and added (RDATE) dates from that occurrence on,
 *  moved as the occurrences they name were: left behind, the deleted occurrences come back and the
 *  added ones are drawn where the series no longer is. The earlier ones stay with the part before,
 *  or they are drawn twice, and an occurrence that is itself an added date goes with the new part. Both ways
 *  in: a drag to another time, and the dialog turning an all-day series into a timed one, whose
 *  dates have to change form as well - a bare date could not be written as a time.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarFollowingDatesTest.java [engine] [url]
 */
public class CalendarFollowingDatesTest {

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            CalendarApp.open(d);
            String recurring = CalendarApp.directoryOf(d, me.name()) + "/recurring";
            // seeded in the browser's own zone, so the times below are its local times whatever zone it runs in
            String zone = String.valueOf(d.script("return Intl.DateTimeFormat().resolvedOptions().timeZone;"));
            // Mondays, with a Wednesday added before the split and one after, and a Monday deleted after it
            LocalDate first = LocalDate.now().withDayOfMonth(1).plusMonths(1).with(TemporalAdjusters.firstInMonth(DayOfWeek.MONDAY));
            LocalDate earlyAdded = first.plusDays(2);
            LocalDate split = first.plusWeeks(1);
            LocalDate lateAdded = first.plusWeeks(2).plusDays(2);
            LocalDate deleted = first.plusWeeks(3);

            // --- dragged to another time ----------------------------------------------------------
            String dragged = "Dragged split";
            CalendarApp.write(d, recurring, "dragged.ics", CalendarClockChangeTest.vevent("dragged", dragged,
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "EXDATE;TZID=" + zone + ":" + deleted.format(BASIC) + "T090000",
                    "RDATE;TZID=" + zone + ":" + earlyAdded.format(BASIC) + "T090000," + lateAdded.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, split);
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn(dragged), 30_000);
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, split);
            CalendarApp.waitInFrame(d, "the occurrence in its week", CalendarDragTest.inColumn(split.toString(), dragged), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn(dragged, split.toString(),
                    CalendarDragTest.slotDistance("09:00:00", "11:00:00"), false), "following");
            String freshFile = newSeries(d, recurring, Set.of("dragged.ics"), dragged);
            String fresh = CalendarApp.read(d, recurring, freshFile);
            assertListed(fresh, "EXDATE", deleted, "T110000", "the deleted Monday after the split");
            assertListed(fresh, "RDATE", lateAdded, "T110000", "the Wednesday added after the split");
            assertNotListed(fresh, "RDATE", earlyAdded, "the Wednesday added before the split");
            String cut = CalendarApp.awaitStored(d, recurring, "dragged.ics", "UNTIL=");
            assertListed(cut, "RDATE", earlyAdded, "T090000", "the Wednesday added before the split");
            System.out.println("  ok   dragged: the dates after the split moved to 11:00 with it, the earlier one stayed");
            // split again at the added Wednesday, which is no day of the rule's: it goes as an added date
            CalendarDragTest.weekShowing(d, lateAdded.toString());
            CalendarApp.waitInFrame(d, "the added Wednesday in its week", CalendarDragTest.inColumn(lateAdded.toString(), dragged), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn(dragged, lateAdded.toString(),
                    CalendarDragTest.slotDistance("11:00:00", "13:00:00"), false), "following");
            String fromAdded = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("dragged.ics", freshFile), dragged));
            assertListed(fromAdded, "RDATE", lateAdded, "T130000", "the added Wednesday the split started from");
            CalendarApp.waitInFrame(d, "the added Wednesday still drawn", CalendarDragTest.inColumn(lateAdded.toString(), dragged), 30_000);
            System.out.println("  ok   split at an added date: it went with the new part, at 13:00");

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
            String timed = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("edited.ics"), edited));
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

            // --- from an added date, moved to another day in the dialog -----------------------------
            // the added date is the new part's start, so it goes where the start goes, not where it was
            String movedAdded = "Moved added date";
            LocalDate added = first.plusDays(9);
            LocalDate moveTo = added.plusDays(1);
            CalendarApp.write(d, recurring, "moved-added.ics", CalendarClockChangeTest.vevent("moved-added", movedAdded,
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "RDATE;TZID=" + zone + ":" + added.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, added);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the series with its added date", CalendarSeriesTest.drawn(movedAdded), 30_000);
            CalendarClockChangeTest.openOn(d, movedAdded, added);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-date", moveTo.toString())
                    + CalendarApp.setField("event-end-date", moveTo.toString()) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String moved = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("moved-added.ics"), movedAdded));
            CalendarApp.assertTimeIs(moved, "DTSTART", moveTo.atTime(9, 0));
            assertNotListed(moved, "RDATE", added, "the added date the split was moved off");
            CalendarApp.awaitStored(d, recurring, "moved-added.ics", "UNTIL=");
            CalendarClockChangeTest.reload(d, added);
            CalendarApp.waitInFrame(d, "the moved part on the grid", CalendarSeriesTest.drawn(movedAdded), 30_000);
            List<String> movedDrawn = CalendarApp.occurrenceDates(d, movedAdded);
            if (! movedDrawn.contains(moveTo.toString()) || movedDrawn.contains(added.toString()))
                throw new AssertionError("Moved from " + added + " to " + moveTo + ", the occurrence is drawn on " + movedDrawn);
            System.out.println("  ok   an added date moved to " + moveTo + " in the dialog went there: " + movedDrawn);

            // --- from an added date at a time of its own, dragged an hour on ----------------------
            // the new part's rule falls at its start's time, 15:00, so the deleted Monday goes there too; the date
            // added later that week at 23:30 moves an hour as the dragged one did, into the next day
            String ownTime = "Own time";
            LocalDate wed = first.plusDays(2);
            LocalDate fri = first.plusDays(4);
            LocalDate gone = first.plusWeeks(2);
            CalendarApp.write(d, recurring, "own-time.ics", CalendarClockChangeTest.vevent("own-time", ownTime,
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "EXDATE;TZID=" + zone + ":" + gone.format(BASIC) + "T090000",
                    "RDATE;TZID=" + zone + ":" + wed.format(BASIC) + "T140000," + fri.format(BASIC) + "T233000"));
            CalendarClockChangeTest.reload(d, wed);
            CalendarApp.waitInFrame(d, "the series with an added date at 14:00", CalendarSeriesTest.drawn(ownTime), 30_000);
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, wed);
            CalendarApp.waitInFrame(d, "the added date in its week", CalendarDragTest.inColumn(wed.toString(), ownTime), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn(ownTime, wed.toString(),
                    CalendarDragTest.slotDistance("14:00:00", "15:00:00"), false), "following");
            String ownFile = newSeries(d, recurring, Set.of("own-time.ics"), ownTime);
            String ownPart = CalendarApp.read(d, recurring, ownFile);
            assertListed(ownPart, "EXDATE", gone, "T150000", "the deleted Monday, where the new part's rule now falls");
            assertListed(ownPart, "RDATE", fri.plusDays(1), "T003000", "the date added at 23:30 on " + fri + ", an hour on");
            CalendarClockChangeTest.reload(d, gone);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the split series", CalendarSeriesTest.drawn(ownTime), 30_000);
            if (CalendarApp.occurrenceDates(d, ownTime).contains(gone.toString()))
                throw new AssertionError("The deleted " + gone + " is back after the split: " + CalendarApp.occurrenceDates(d, ownTime));
            System.out.println("  ok   split at an added date at its own time: the deleted Monday moved with the rule, the later added date an hour");

            // split that part again at the next Monday: none of its rule's dates comes before it, but its start and
            // the date it added that week do, and they stay where they are
            LocalDate nextMonday = first.plusWeeks(1);
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, nextMonday);
            CalendarApp.waitInFrame(d, "the next Monday in its week", CalendarDragTest.inColumn(nextMonday.toString(), ownTime), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn(ownTime, nextMonday.toString(),
                    CalendarDragTest.slotDistance("15:00:00", "16:00:00"), false), "following");
            newSeries(d, recurring, Set.of("own-time.ics", ownFile), ownTime);
            String kept = d.waitUntil("the part from the added date to lose its rule", () -> {
                if (! CalendarApp.list(d, recurring).contains(ownFile))
                    throw new AssertionError("Split again at " + nextMonday + ", the part holding " + wed + " and " + fri.plusDays(1) + " was deleted");
                String now = CalendarApp.read(d, recurring, ownFile);
                return CalendarApp.property(now, "RRULE") == null ? now : null;
            }, 60_000);
            CalendarApp.assertTimeIs(kept, "DTSTART", wed.atTime(15, 0));
            assertListed(kept, "RDATE", fri.plusDays(1), "T003000", "the date added that week");
            CalendarClockChangeTest.reload(d, wed);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the parts on the grid", CalendarSeriesTest.drawn(ownTime), 30_000);
            List<String> chained = CalendarApp.occurrenceDates(d, ownTime);
            for (LocalDate day : List.of(wed, fri.plusDays(1), nextMonday))
                if (! chained.contains(day.toString()))
                    throw new AssertionError("After splitting twice, nothing is drawn on " + day + ": " + chained);
            System.out.println("  ok   split again at the next Monday: the added dates before it stayed: " + chained);
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

    /** The series file the split wrote, beside the ones there already */
    static String newSeries(WebDriver d, String recurring, Set<String> known, String title) {
        return d.waitUntil("another series file for " + title, () -> {
            for (String name : CalendarApp.list(d, recurring)) {
                if (known.contains(name))
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
