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
            // the added date goes where the dialog put it, listed before the new part's start, which is the rule's
            // next date after it; it isn't drawn where it was any more
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
            CalendarApp.assertTimeIs(moved, "DTSTART", added.with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(9, 0));
            assertListed(moved, "RDATE", moveTo, "T090000", "the added date, where the dialog moved it");
            assertNotListed(moved, "RDATE", added, "the added date the split was moved off");
            CalendarApp.awaitStored(d, recurring, "moved-added.ics", "UNTIL=");
            CalendarClockChangeTest.reload(d, added);
            CalendarApp.waitInFrame(d, "the moved part on the grid", CalendarSeriesTest.drawn(movedAdded), 30_000);
            List<String> movedDrawn = CalendarApp.occurrenceDates(d, movedAdded);
            if (! movedDrawn.contains(moveTo.toString()) || movedDrawn.contains(added.toString()))
                throw new AssertionError("Moved from " + added + " to " + moveTo + ", the occurrence is drawn on " + movedDrawn);
            System.out.println("  ok   an added date moved to " + moveTo + " in the dialog went there: " + movedDrawn);

            // --- from an added date at a time of its own, dragged an hour on ----------------------
            // the rule goes on as it was, from the next Monday at 09:00, with the dragged Wednesday listed at 15:00
            // before it, and the deleted Monday stays at 09:00; the date added later that week at 23:30 moves an hour
            // as the dragged one did, into the next day
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
            CalendarApp.assertTimeIs(ownPart, "DTSTART", first.plusWeeks(1).atTime(9, 0));
            assertListed(ownPart, "RDATE", wed, "T150000", "the dragged Wednesday, before the new part's start");
            assertListed(ownPart, "EXDATE", gone, "T090000", "the deleted Monday, where the rule still falls");
            assertListed(ownPart, "RDATE", fri.plusDays(1), "T003000", "the date added at 23:30 on " + fri + ", an hour on");
            CalendarClockChangeTest.reload(d, gone);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the split series", CalendarSeriesTest.drawn(ownTime), 30_000);
            if (CalendarApp.occurrenceDates(d, ownTime).contains(gone.toString()))
                throw new AssertionError("The deleted " + gone + " is back after the split: " + CalendarApp.occurrenceDates(d, ownTime));
            System.out.println("  ok   split at an added date at its own time: the rule went on from the next Monday, the later added date an hour");

            // split that part again at the next Monday: none of its rule's dates comes before it, but its start and
            // the date it added that week do, and they stay where they are
            LocalDate nextMonday = first.plusWeeks(1);
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, nextMonday);
            CalendarApp.waitInFrame(d, "the next Monday in its week", CalendarDragTest.inColumn(nextMonday.toString(), ownTime), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn(ownTime, nextMonday.toString(),
                    CalendarDragTest.slotDistance("09:00:00", "10:00:00"), false), "following");
            newSeries(d, recurring, Set.of("own-time.ics", ownFile), ownTime);
            String kept = d.waitUntil("the part from the added date to lose its rule", () -> {
                if (! CalendarApp.list(d, recurring).contains(ownFile))
                    throw new AssertionError("Split again at " + nextMonday + ", the part holding " + wed + " and " + fri.plusDays(1) + " was deleted");
                String now = CalendarApp.read(d, recurring, ownFile);
                return CalendarApp.property(now, "RRULE") == null ? now : null;
            }, 60_000);
            CalendarApp.assertTimeIs(kept, "DTSTART", wed.atTime(15, 0));
            assertListed(kept, "RDATE", fri.plusDays(1), "T003000", "the date added that week");
            // and it is a series of those dates as it stands, before any reload: its dialog opens
            weekShowing(d, wed);
            CalendarApp.waitInFrame(d, "the Wednesday left", CalendarDragTest.inColumn(wed.toString(), ownTime), 30_000);
            CalendarClockChangeTest.openOn(d, ownTime, wed);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the dialog of the dates left",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("event-cancel") + "return 1;");
            CalendarClockChangeTest.reload(d, wed);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the parts on the grid", CalendarSeriesTest.drawn(ownTime), 30_000);
            List<String> chained = CalendarApp.occurrenceDates(d, ownTime);
            for (LocalDate day : List.of(wed, fri.plusDays(1), nextMonday))
                if (! chained.contains(day.toString()))
                    throw new AssertionError("After splitting twice, nothing is drawn on " + day + ": " + chained);
            System.out.println("  ok   split again at the next Monday: the added dates before it stayed: " + chained);

            // --- a start off its own rule, cut at the first date the rule draws -------------------------------
            // a weekly Monday series whose file starts on a Tuesday: that start is no occurrence here, so deleting
            // from the first Monday on leaves nothing, not a one-off on the Tuesday
            LocalDate tuesday = first.plusDays(1);
            CalendarApp.write(d, recurring, "off-rule.ics", CalendarClockChangeTest.vevent("off-rule", "Off rule",
                    "DTSTART;TZID=" + zone + ":" + tuesday.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + tuesday.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO"));
            CalendarClockChangeTest.reload(d, tuesday);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the off-rule series", CalendarSeriesTest.drawn("Off rule"), 30_000);
            LocalDate firstDrawn = first.plusWeeks(1);
            CalendarClockChangeTest.openOn(d, "Off rule", firstDrawn);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            d.waitUntil("the off-rule series to be removed", () -> CalendarApp.list(d, recurring).contains("off-rule.ics") ? null : true, 60_000);
            System.out.println("  ok   deleted from its first drawn Monday, a series starting off its rule is gone");

            // --- a split at an added time on a day whose rule time is deleted -------------------------------
            // the rule's 15:00 is deleted that day and 09:00 added; split there, the new part goes on from the next day's
            // 15:00 with the 09:00 listed before it, and its count is of the rule's dates from there, the deleted one
            // too: the series ends on the day it did
            LocalDate swapDay = first.plusDays(3);
            CalendarApp.write(d, recurring, "swap.ics", CalendarClockChangeTest.vevent("swap", "Swapped day",
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T150000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T153000",
                    "RRULE:FREQ=DAILY;COUNT=10",
                    "EXDATE;TZID=" + zone + ":" + swapDay.format(BASIC) + "T150000",
                    "RDATE;TZID=" + zone + ":" + swapDay.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, swapDay);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the swapped series", CalendarSeriesTest.drawn("Swapped day"), 30_000);
            CalendarClockChangeTest.openOn(d, "Swapped day", swapDay);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", "Swapped later") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String later = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("swap.ics"), "Swapped later"));
            CalendarApp.assertTimeIs(later, "DTSTART", swapDay.plusDays(1).atTime(15, 0));
            assertListed(later, "RDATE", swapDay, "T090000", "the added 09:00 the split started from");
            if (! String.valueOf(CalendarApp.property(later, "RRULE")).contains("COUNT=6"))
                throw new AssertionError("Of 10 days, 3 and the deleted one come before the new start, so 6 are left:\n" + later);
            CalendarClockChangeTest.reload(d, swapDay);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the later part", CalendarSeriesTest.drawn("Swapped later"), 30_000);
            List<String> laterDays = CalendarApp.occurrenceDates(d, "Swapped later");
            if (! laterDays.contains(swapDay.toString()) || laterDays.contains(first.plusDays(10).toString()))
                throw new AssertionError("The new part should draw " + swapDay + " and end on " + first.plusDays(9) + ", but draws " + laterDays + ":\n" + later);
            System.out.println("  ok   split at an added time where the rule's was deleted: the rule went on from the next day, ending where it did");

            // --- a cut that leaves one date --------------------------------------------------------------------
            // the part a split at an added Wednesday makes: its start, listed, and its rule's Mondays. Deleted from the
            // next Monday on, the Wednesday is left, and the file must still read back as a series: as a plain event it
            // is looked for where a plain event's file goes, and deleting it leaves this one in place
            LocalDate lone = first.plusDays(2);
            CalendarApp.write(d, recurring, "lone.ics", CalendarClockChangeTest.vevent("lone", "Lone date",
                    "DTSTART;TZID=" + zone + ":" + lone.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + lone.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "RDATE;TZID=" + zone + ":" + lone.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, lone);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the series from an added date", CalendarSeriesTest.drawn("Lone date"), 30_000);
            CalendarClockChangeTest.openOn(d, "Lone date", first.plusWeeks(1));
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            String lonePart = d.waitUntil("the cut to drop the rule", () -> {
                String now = CalendarApp.read(d, recurring, "lone.ics");
                return CalendarApp.property(now, "RRULE") == null ? now : null;
            }, 60_000);
            assertListed(lonePart, "RDATE", lone, "T090000", "the one date left");
            CalendarClockChangeTest.reload(d, lone);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the date left", CalendarSeriesTest.drawn("Lone date"), 30_000);
            CalendarClockChangeTest.openOn(d, "Lone date", lone);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            d.waitUntil("the date left to be deleted", () -> CalendarApp.list(d, recurring).contains("lone.ics") ? null : true, 60_000);
            System.out.println("  ok   a cut that leaves one date keeps a series, which can be deleted after a reload");

            // --- a split with an added date that was deleted again ----------------------------------------------
            // a Monday has the rule's 09:00 and an added 14:00 that was deleted. Split at an added Wednesday 14:00 and
            // dragged an hour on, the deleted 14:00 is no occurrence and goes nowhere: moved as an added date, it would
            // land on the new part's 15:00 that Monday and take it out
            LocalDate undone = first.plusWeeks(2);
            CalendarApp.write(d, recurring, "undone.ics", CalendarClockChangeTest.vevent("undone", "Undone",
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "EXDATE;TZID=" + zone + ":" + undone.format(BASIC) + "T140000",
                    "RDATE;TZID=" + zone + ":" + wed.format(BASIC) + "T140000," + undone.format(BASIC) + "T140000"));
            CalendarClockChangeTest.reload(d, wed);
            CalendarApp.waitInFrame(d, "the series with a deleted added date", CalendarSeriesTest.drawn("Undone"), 30_000);
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, wed);
            CalendarApp.waitInFrame(d, "the added Wednesday in its week", CalendarDragTest.inColumn(wed.toString(), "Undone"), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn("Undone", wed.toString(),
                    CalendarDragTest.slotDistance("14:00:00", "15:00:00"), false), "following");
            String undonePart = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("undone.ics"), "Undone"));
            // the part before is cut short too, or after the reload it still draws that Monday itself
            CalendarApp.awaitStored(d, recurring, "undone.ics", "UNTIL=");
            String undoneEx = CalendarApp.property(undonePart, "EXDATE");
            if (undoneEx != null && undoneEx.contains(undone.format(BASIC)))
                throw new AssertionError("The deleted added date on " + undone + " went with the split and takes out the new part's Monday:\n" + undonePart);
            CalendarClockChangeTest.reload(d, undone);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the split series", CalendarSeriesTest.drawn("Undone"), 30_000);
            if (! CalendarApp.occurrenceDates(d, "Undone").contains(undone.toString()))
                throw new AssertionError("After the split nothing is drawn on " + undone + ":\n" + undonePart);
            System.out.println("  ok   a deleted added date stayed behind at a split, and the new part's Monday is drawn");

            // --- a cut at a date added after the rule has ended --------------------------------------------------
            // three days, and a date added a week after the last: deleted from that date on, the rule ends where it
            // did, and isn't stretched to the day before the cut
            LocalDate addedLater = first.plusDays(10);
            CalendarApp.write(d, recurring, "ended.ics", CalendarClockChangeTest.vevent("ended", "Ended rule",
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T093000",
                    "RRULE:FREQ=DAILY;COUNT=3",
                    "RDATE;TZID=" + zone + ":" + addedLater.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, addedLater);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the series that ended", CalendarSeriesTest.drawn("Ended rule"), 30_000);
            CalendarClockChangeTest.openOn(d, "Ended rule", addedLater);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            String ended = d.waitUntil("the date added later to go", () -> {
                String now = CalendarApp.read(d, recurring, "ended.ics");
                return CalendarApp.property(now, "RDATE") == null ? now : null;
            }, 60_000);
            CalendarClockChangeTest.reload(d, first);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the series left", CalendarSeriesTest.drawn("Ended rule"), 30_000);
            Set<String> endedDays = new TreeSet<>(CalendarApp.occurrenceDates(d, "Ended rule"));
            Set<String> threeDays = new TreeSet<>(List.of(first.toString(), first.plusDays(1).toString(), first.plusDays(2).toString()));
            if (! endedDays.equals(threeDays))
                throw new AssertionError("Cut at a date added after its rule had ended, the series should keep its three days "
                        + threeDays + ", but draws " + endedDays + ":\n" + ended);
            System.out.println("  ok   a cut after the rule had ended left the rule's own days: " + endedDays);

            // --- a series of listed dates, split at its last ---------------------------------------------------
            // Monday, Wednesday and Friday at 09:00, and no rule. Friday dragged to 11:00 for it and those after:
            // the new part is that one date, which its file lists, or it reads back as a plain event and can't
            // be deleted where it is
            LocalDate listedFri = first.plusDays(4);
            Set<String> before = new HashSet<>(CalendarApp.list(d, recurring));
            before.add("listed.ics");
            CalendarApp.write(d, recurring, "listed.ics", CalendarClockChangeTest.vevent("listed", "Listed dates",
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T093000",
                    "RDATE;TZID=" + zone + ":" + wed.format(BASIC) + "T090000," + listedFri.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, listedFri);
            CalendarApp.waitInFrame(d, "the listed dates", CalendarSeriesTest.drawn("Listed dates"), 30_000);
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, listedFri);
            CalendarApp.waitInFrame(d, "the Friday in its week", CalendarDragTest.inColumn(listedFri.toString(), "Listed dates"), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn("Listed dates", listedFri.toString(),
                    CalendarDragTest.slotDistance("09:00:00", "11:00:00"), false), "following");
            String lastPart = d.waitUntil("the new part's file", () -> {
                for (String name : CalendarApp.list(d, recurring))
                    if (! before.contains(name) && CalendarApp.read(d, recurring, name).contains("SUMMARY:Listed dates"))
                        return name;
                return null;
            }, 60_000);
            assertListed(CalendarApp.read(d, recurring, lastPart), "RDATE", listedFri, "T110000", "the one date of the new part");
            CalendarClockChangeTest.reload(d, listedFri);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the parts", CalendarSeriesTest.drawn("Listed dates"), 30_000);
            CalendarClockChangeTest.openOn(d, "Listed dates", listedFri);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            d.waitUntil("the new part to be deleted", () -> CalendarApp.list(d, recurring).contains(lastPart) ? null : true, 60_000);
            System.out.println("  ok   split at the last of its listed dates, the new part is a series that can be deleted");

            // --- a series of listed dates whose start comes after one of them ---------------------------------
            // Friday at 10:00 starts it, with Wednesday 08:00 listed before and Saturday 10:00 after. Wednesday dragged
            // to 09:00 for it and those after takes the Friday and the Saturday along, an hour on
            LocalDate listedSat = first.plusDays(5);
            Set<String> known = new HashSet<>(CalendarApp.list(d, recurring));
            known.add("late-start.ics");
            CalendarApp.write(d, recurring, "late-start.ics", CalendarClockChangeTest.vevent("late-start", "Late start",
                    "DTSTART;TZID=" + zone + ":" + fri.format(BASIC) + "T100000",
                    "DTEND;TZID=" + zone + ":" + fri.format(BASIC) + "T103000",
                    "RDATE;TZID=" + zone + ":" + wed.format(BASIC) + "T080000," + listedSat.format(BASIC) + "T100000"));
            CalendarClockChangeTest.reload(d, wed);
            CalendarApp.waitInFrame(d, "the late-start list", CalendarSeriesTest.drawn("Late start"), 30_000);
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, wed);
            CalendarApp.waitInFrame(d, "the Wednesday in its week", CalendarDragTest.inColumn(wed.toString(), "Late start"), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn("Late start", wed.toString(),
                    CalendarDragTest.slotDistance("08:00:00", "09:00:00"), false), "following");
            String lateStart = d.waitUntil("the new part's file", () -> {
                for (String name : CalendarApp.list(d, recurring))
                    if (! known.contains(name) && CalendarApp.read(d, recurring, name).contains("SUMMARY:Late start"))
                        return CalendarApp.read(d, recurring, name);
                return null;
            }, 60_000);
            assertListed(lateStart, "RDATE", fri, "T110000", "the list's own start, after the split, an hour on");
            assertListed(lateStart, "RDATE", listedSat, "T110000", "the Saturday, an hour on");
            System.out.println("  ok   a list split at a date before its start kept the start");

            String weekTab = "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;";

            // --- an added time dragged onto the rule's deleted time that day --------------------------------------
            // daily at 10:00, the fourth day's 10:00 deleted and 09:00 added. That 09:00, dragged to 10:00 for it and
            // those after, is an occurrence of its own, and the deletion of the rule's 10:00 doesn't take it out
            LocalDate ontoDeleted = first.plusDays(3);
            CalendarApp.write(d, recurring, "onto.ics", CalendarClockChangeTest.vevent("onto", "Onto deleted",
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T100000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T103000",
                    "RRULE:FREQ=DAILY;COUNT=10",
                    "EXDATE;TZID=" + zone + ":" + ontoDeleted.format(BASIC) + "T100000",
                    "RDATE;TZID=" + zone + ":" + ontoDeleted.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, ontoDeleted);
            CalendarApp.waitInFrame(d, "the series with its day swapped", CalendarSeriesTest.drawn("Onto deleted"), 30_000);
            CalendarApp.inFrame(d, weekTab);
            weekShowing(d, ontoDeleted);
            CalendarApp.waitInFrame(d, "the added 09:00 in its week", CalendarDragTest.inColumn(ontoDeleted.toString(), "Onto deleted"), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn("Onto deleted", ontoDeleted.toString(),
                    CalendarDragTest.slotDistance("09:00:00", "10:00:00"), false), "following");
            String onto = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("onto.ics"), "Onto deleted"));
            CalendarApp.awaitStored(d, recurring, "onto.ics", "UNTIL=");
            CalendarClockChangeTest.reload(d, ontoDeleted);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the split series", CalendarSeriesTest.drawn("Onto deleted"), 30_000);
            if (! CalendarApp.occurrenceDates(d, "Onto deleted").contains(ontoDeleted.toString()))
                throw new AssertionError("Dragged onto the rule's deleted 10:00, nothing is drawn on " + ontoDeleted + ":\n" + onto);
            System.out.println("  ok   an added time dragged onto the rule's deleted time stays drawn");

            // --- an all-day series split at an added date and made timed in the dialog ---------------------------
            // the rule had no time of day, so it takes the moved occurrence's: the Mondays after are at 10:00 too
            CalendarApp.write(d, recurring, "dayish.ics", CalendarClockChangeTest.vevent("dayish", "Day to time",
                    "DTSTART;VALUE=DATE:" + first.format(BASIC),
                    "DTEND;VALUE=DATE:" + first.plusDays(1).format(BASIC),
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "RDATE;VALUE=DATE:" + wed.format(BASIC)));
            CalendarClockChangeTest.reload(d, wed);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the all-day series", CalendarSeriesTest.drawn("Day to time"), 30_000);
            CalendarClockChangeTest.openOn(d, "Day to time", wed);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("event-all-day")
                    + CalendarApp.setField("event-start-date", wed.toString())
                    + CalendarApp.setField("event-start-time", "10:00")
                    + CalendarApp.setField("event-end-date", wed.toString())
                    + CalendarApp.setField("event-end-time", "10:30") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String dayToTime = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("dayish.ics"), "Day to time"));
            CalendarApp.assertTimeIs(dayToTime, "DTSTART", first.plusWeeks(1).atTime(10, 0));
            assertListed(dayToTime, "RDATE", wed, "T100000", "the Wednesday the split started from");
            System.out.println("  ok   an all-day series made timed from an added date keeps its Mondays, at the new time");

            // --- a split at an added date, with the count changed in the dialog ----------------------------------
            // ten days at 10:00, the fourth's 10:00 deleted and 09:00 added; from that 09:00 on, the user asks for 3:
            // the 09:00 and the next two days, after the three days before it
            LocalDate counted = first.plusDays(3);
            CalendarApp.write(d, recurring, "counted.ics", CalendarClockChangeTest.vevent("counted", "Counted",
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T100000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T103000",
                    "RRULE:FREQ=DAILY;COUNT=10",
                    "EXDATE;TZID=" + zone + ":" + counted.format(BASIC) + "T100000",
                    "RDATE;TZID=" + zone + ":" + counted.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, counted);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the counted series", CalendarSeriesTest.drawn("Counted"), 30_000);
            CalendarClockChangeTest.openOn(d, "Counted", counted);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-repeat-count", "3") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String countedPart = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("counted.ics"), "Counted"));
            CalendarApp.awaitStored(d, recurring, "counted.ics", "UNTIL=");
            CalendarClockChangeTest.reload(d, counted);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "both parts", CalendarSeriesTest.drawn("Counted"), 30_000);
            Set<String> countedDays = new TreeSet<>(CalendarApp.occurrenceDates(d, "Counted"));
            Set<String> sixDays = new TreeSet<>();
            for (int i = 0; i < 6; i++)
                sixDays.add(first.plusDays(i).toString());
            if (! countedDays.equals(sixDays))
                throw new AssertionError("Asked for 3 from the added 09:00, the series should draw " + sixDays + ", but draws "
                        + countedDays + ":\n" + countedPart);
            System.out.println("  ok   the count typed in the dialog for a split at an added date is kept: " + countedDays);

            // --- the start of a rule series that lists its start too, dragged for it and those after -------------
            // a list of dates given a rule keeps its start listed; that start is one of the rule's own dates, so the
            // rule moves with it to 11:00
            CalendarApp.write(d, recurring, "liststart.ics", CalendarClockChangeTest.vevent("liststart", "Listed start",
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "RDATE;TZID=" + zone + ":" + first.format(BASIC) + "T090000," + wed.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, first);
            CalendarApp.waitInFrame(d, "the series that lists its start", CalendarSeriesTest.drawn("Listed start"), 30_000);
            CalendarApp.inFrame(d, weekTab);
            weekShowing(d, first);
            CalendarApp.waitInFrame(d, "the start in its week", CalendarDragTest.inColumn(first.toString(), "Listed start"), 30_000);
            CalendarDragTest.dragThenChoose(d, CalendarDragTest.dragInColumn("Listed start", first.toString(),
                    CalendarDragTest.slotDistance("09:00:00", "11:00:00"), false), "following");
            String listedStart = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("liststart.ics"), "Listed start"));
            CalendarApp.assertTimeIs(listedStart, "DTSTART", first.atTime(11, 0));
            System.out.println("  ok   a start that is listed too moved the rule with it");

            // --- a split at an added date after the rule has run out, edited again at once -----------------------
            // two Mondays, and a Wednesday and Thursday added after them. From the Wednesday on, moved to 11:00, the
            // new part is a list of dates, and its dialog opens before any reload
            LocalDate ranOutWed = first.plusDays(16);
            LocalDate ranOutThu = first.plusDays(17);
            Set<String> beforeRanOut = new HashSet<>(CalendarApp.list(d, recurring));
            beforeRanOut.add("ranout.ics");
            CalendarApp.write(d, recurring, "ranout.ics", CalendarClockChangeTest.vevent("ranout", "Ran out",
                    "DTSTART;TZID=" + zone + ":" + first.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + first.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=2",
                    "RDATE;TZID=" + zone + ":" + ranOutWed.format(BASIC) + "T090000," + ranOutThu.format(BASIC) + "T090000"));
            CalendarClockChangeTest.reload(d, ranOutWed);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the series that ran out", CalendarSeriesTest.drawn("Ran out"), 30_000);
            CalendarClockChangeTest.openOn(d, "Ran out", ranOutWed);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-time", "11:00")
                    + CalendarApp.setField("event-end-time", "11:30") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            d.waitUntil("the new part's file", () -> {
                for (String name : CalendarApp.list(d, recurring))
                    if (! beforeRanOut.contains(name) && CalendarApp.read(d, recurring, name).contains("SUMMARY:Ran out"))
                        return name;
                return null;
            }, 60_000);
            CalendarApp.waitInFrame(d, "the Thursday at its new time", CalendarSeriesTest.drawn("Ran out"), 30_000);
            CalendarClockChangeTest.openOn(d, "Ran out", ranOutThu);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the dialog of the dates left",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("event-cancel") + "return 1;");
            System.out.println("  ok   a part left a list of dates by a split opens its dialog before a reload");

            // --- a rule the form can't show whole, split at an added date in the dialog --------------------------
            // the last weekday of each month at 10:00, and 15 September added at 15:00. From that date on, saved as it
            // is, the new part starts at the rule's next date, 30 September, which only the whole rule knows
            LocalDate lastWeekdayStart = LocalDate.of(2027, 8, 31);
            LocalDate lastWeekdayAdded = LocalDate.of(2027, 9, 15);
            CalendarApp.write(d, recurring, "lastweekday.ics", CalendarClockChangeTest.vevent("lastweekday", "Last weekday",
                    "DTSTART;TZID=" + zone + ":" + lastWeekdayStart.format(BASIC) + "T100000",
                    "DTEND;TZID=" + zone + ":" + lastWeekdayStart.format(BASIC) + "T103000",
                    "RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1",
                    "RDATE;TZID=" + zone + ":" + lastWeekdayAdded.format(BASIC) + "T150000"));
            CalendarClockChangeTest.reload(d, lastWeekdayAdded);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the last-weekday series", CalendarSeriesTest.drawn("Last weekday"), 30_000);
            CalendarClockChangeTest.openOn(d, "Last weekday", lastWeekdayAdded);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String lastWeekday = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("lastweekday.ics"), "Last weekday"));
            CalendarApp.assertTimeIs(lastWeekday, "DTSTART", LocalDate.of(2027, 9, 30).atTime(10, 0));
            System.out.println("  ok   split at an added date, a rule the form can't show goes on from its own next date");

            // --- a list of dates made a repeat from one of them -------------------------------------------------
            // 2 March 10:00, 3 March 14:00 and 5 March 10:00, and no rule. From the 3rd on, made daily every 2 days,
            // 3 times: the new rule starts where that occurrence is, the 3rd at 14:00
            LocalDate listMade = LocalDate.of(2027, 3, 3);
            Set<String> beforeMade = new HashSet<>(CalendarApp.list(d, recurring));
            beforeMade.add("made.ics");
            CalendarApp.write(d, recurring, "made.ics", CalendarClockChangeTest.vevent("made", "Made a repeat",
                    "DTSTART;TZID=" + zone + ":20270302T100000",
                    "DTEND;TZID=" + zone + ":20270302T103000",
                    "RDATE;TZID=" + zone + ":20270303T140000,20270305T100000"));
            CalendarClockChangeTest.reload(d, listMade);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the list", CalendarSeriesTest.drawn("Made a repeat"), 30_000);
            CalendarClockChangeTest.openOn(d, "Made a repeat", listMade);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-repeat-freq", "daily")
                    + CalendarApp.setField("event-repeat-interval", "2")
                    + CalendarApp.setField("event-repeat-end", "count")
                    + CalendarApp.setField("event-repeat-count", "3") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String made = CalendarApp.read(d, recurring, newSeries(d, recurring, beforeMade, "Made a repeat"));
            CalendarApp.assertTimeIs(made, "DTSTART", listMade.atTime(14, 0));
            System.out.println("  ok   a list made a repeat from one of its dates starts the rule there");

            // --- a split at an added date after the rule has run out, with a new count ------------------------------
            // three days from 1 March, and 10 March added. From the 10th on, the user asks for 5: the rule goes on,
            // and the 10th, a date of the rule once it runs on, is where it starts
            LocalDate ranOutAdded = LocalDate.of(2027, 3, 10);
            CalendarApp.write(d, recurring, "recount.ics", CalendarClockChangeTest.vevent("recount", "Counted again",
                    "DTSTART;TZID=" + zone + ":20270301T100000",
                    "DTEND;TZID=" + zone + ":20270301T103000",
                    "RRULE:FREQ=DAILY;COUNT=3",
                    "RDATE;TZID=" + zone + ":" + ranOutAdded.format(BASIC) + "T100000"));
            CalendarClockChangeTest.reload(d, ranOutAdded);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the series that ran out", CalendarSeriesTest.drawn("Counted again"), 30_000);
            CalendarClockChangeTest.openOn(d, "Counted again", ranOutAdded);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-repeat-count", "5") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String recounted = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("recount.ics"), "Counted again"));
            if (! String.valueOf(CalendarApp.property(recounted, "RRULE")).contains("COUNT=5"))
                throw new AssertionError("Asked for 5 more after its rule had run out, the new part should repeat 5 times:\n" + recounted);
            CalendarApp.assertTimeIs(recounted, "DTSTART", ranOutAdded.atTime(10, 0));
            System.out.println("  ok   a count typed after the rule ran out is kept: " + CalendarApp.property(recounted, "RRULE"));

            // --- from an added date, moved past midnight in the dialog -----------------------------------------------
            // weekly on Mondays at 09:00, with Wednesday 23:00 and Friday 14:00 added. From the Wednesday on, moved two
            // hours to Thursday 01:00: the Friday goes as far, to 16:00 that Friday, not back to the Thursday
            LocalDate pastMonday = LocalDate.of(2027, 5, 3);
            LocalDate pastWednesday = pastMonday.plusDays(2), pastThursday = pastMonday.plusDays(3), pastFriday = pastMonday.plusDays(4);
            CalendarApp.write(d, recurring, "pastmidnight.ics", CalendarClockChangeTest.vevent("pastmidnight", "Past midnight",
                    "DTSTART;TZID=" + zone + ":" + pastMonday.format(BASIC) + "T090000",
                    "DTEND;TZID=" + zone + ":" + pastMonday.format(BASIC) + "T093000",
                    "RRULE:FREQ=WEEKLY;BYDAY=MO",
                    "RDATE;TZID=" + zone + ":" + pastWednesday.format(BASIC) + "T230000," + pastFriday.format(BASIC) + "T140000"));
            CalendarClockChangeTest.reload(d, pastWednesday);
            CalendarApp.monthView(d);
            CalendarApp.waitInFrame(d, "the series with dates past midnight", CalendarSeriesTest.drawn("Past midnight"), 30_000);
            CalendarClockChangeTest.openOn(d, "Past midnight", pastWednesday);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "following");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-date", pastThursday.toString())
                    + CalendarApp.setField("event-start-time", "01:00")
                    + CalendarApp.setField("event-end-date", pastThursday.toString())
                    + CalendarApp.setField("event-end-time", "01:30") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String pastPart = CalendarApp.read(d, recurring, newSeries(d, recurring, Set.of("pastmidnight.ics"), "Past midnight"));
            String pastAdded = String.valueOf(CalendarApp.property(pastPart, "RDATE"));
            if (! pastAdded.contains(pastThursday.format(BASIC) + "T010000") || ! pastAdded.contains(pastFriday.format(BASIC) + "T160000"))
                throw new AssertionError("Moved two hours past midnight, the Friday should go two hours on, to "
                        + pastFriday + " 16:00, with the moved date listed at " + pastThursday + " 01:00:\n" + pastPart);
            System.out.println("  ok   moved past midnight in the dialog, a later added date goes as far: " + pastAdded);
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
