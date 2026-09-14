import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** Dragging an event with a mouse, and what the file does about it.
 *
 *  A plain event follows the pointer, across a month boundary too - its file moves directory.
 *  A repeating occurrence keeps the previous calendar's rule: it may change time, not day, and
 *  a change asks which occurrences move. The drag itself is the mouse event sequence
 *  FullCalendar listens for, dispatched from inside the frame - the drivers here have no
 *  pointer actions, and the desktop app is exercised with real mouse input elsewhere.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarDragTest.java [engine] [url]
 */
public class CalendarDragTest {

    static final String PLAIN = "Dragged across the month";
    static final String SERIES = "Dragged series";

    /** The entry drawn anywhere on the grid, by its title, or null. */
    static String chipByTitle(String title) {
        return "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                + "  .find(e => e.textContent.indexOf(" + CalendarApp.quote(title) + ") !== -1) || null";
    }

    /** Presses on an event, moves to a point, releases - the way FullCalendar sees a mouse drag. */
    static String drag(String title, String targetExpression) {
        return "let el = " + chipByTitle(title) + ";"
                + "if (!el) throw new Error('no event called ' + " + CalendarApp.quote(title) + ");"
                + "let from = el.getBoundingClientRect();"
                + "let to = " + targetExpression + ";"
                + "let at = (x, y) => ({bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1});"
                + "let sx = from.left + from.width / 2, sy = from.top + from.height / 2;"
                + "el.dispatchEvent(new MouseEvent('mousedown', at(sx, sy)));"
                + "let steps = 12;"
                + "for (let i = 1; i <= steps; i++) {"
                + "  let x = sx + (to.x - sx) * i / steps, y = sy + (to.y - sy) * i / steps;"
                + "  document.dispatchEvent(new MouseEvent('mousemove', at(x, y)));"
                + "}"
                + "return new Promise(r => setTimeout(() => {"
                + "  document.dispatchEvent(new MouseEvent('mouseup', Object.assign(at(to.x, to.y), {buttons: 0})));"
                + "  setTimeout(() => r('from ' + Math.round(sx) + ',' + Math.round(sy) + ' to '"
                + "    + Math.round(to.x) + ',' + Math.round(to.y) + ' in a ' + window.innerWidth"
                + "    + 'x' + window.innerHeight + ' window'), 600); }, 120));";
    }

    /** The centre of the day cell for a date, as drawn on the month grid. */
    /** The entry drawn in the week view's column for a day, or null. A day's header cell
     *  carries the same date attribute as its column, so every carrier is searched. */
    static String chipInColumn(String isoDate, String title) {
        return "Array.from(document.querySelectorAll('[data-date=\"" + isoDate + "\"]'))"
                + "  .flatMap(c => Array.from(c.querySelectorAll('[data-search-event-id]')))"
                + "  .find(el => el.textContent.indexOf(" + CalendarApp.quote(title) + ") !== -1) || null";
    }

    static String inColumn(String isoDate, String title) {
        return "!!(" + chipInColumn(isoDate, title) + ")";
    }

    /** Moves the week view on until a day is on screen: where the grid lands when the view
     *  changes depends on the date it was left on, so it is walked rather than counted. */
    static void weekShowing(WebDriver d, String isoDate) {
        for (int i = 0; i < 8; i++) {
            if (Boolean.TRUE.equals(CalendarApp.inFrame(d,
                    "return Array.from(document.querySelectorAll('[data-date=\"" + isoDate + "\"]'))"
                            + ".some(c => c.querySelector('[data-time]') || c.closest('[role=\"grid\"]'));")))
                return;
            CalendarApp.nextPeriod(d);
            WebDriver.sleep(500);
        }
        throw new AssertionError("The week view never reached " + isoDate);
    }

    /** The vertical distance between two time slots of the week view, in px: how far a drag
     *  has to travel for that change of time, whatever the slot height is. */
    static String slotDistance(String fromTime, String toTime) {
        return "(document.querySelector('[data-time=\"" + toTime + "\"]').getBoundingClientRect().top"
                + " - document.querySelector('[data-time=\"" + fromTime + "\"]').getBoundingClientRect().top)";
    }

    /** Drags the entry in a day column down by a distance; a resize takes it by its bottom
     *  handle instead, which only appears while a real pointer rests on the entry and so is
     *  shown by hand first. The hours are a scroller, so the entry is brought into view before
     *  anything is measured: a press or a drop below the fold lands on no hour at all. Returns
     *  an account of what it did, which is all a failure after it has to go on.
     */
    static String dragInColumn(String title, String isoDate, String distanceExpression, boolean resize) {
        return "let el = " + chipInColumn(isoDate, title) + ";"
                + "if (!el) throw new Error('no ' + " + CalendarApp.quote(title) + " + ' on " + isoDate + "');"
                + "el.scrollIntoView({block: 'center'});"
                + "let handle = el;"
                + (resize ? "handle = Array.from(el.querySelectorAll('*'))"
                        + "  .find(c => getComputedStyle(c).cursor.indexOf('resize') !== -1);"
                        + "if (!handle) throw new Error('no resize handle on the entry');"
                        + "handle.style.display = 'block';" : "")
                + "let b = handle.getBoundingClientRect();"
                + "let sx = b.left + b.width / 2, sy = b.top + b.height / 2, dy = " + distanceExpression + ";"
                + "let at = (x, y) => ({bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1});"
                + "handle.dispatchEvent(new MouseEvent('mousedown', at(sx, sy)));"
                + "for (let i = 1; i <= 12; i++) document.dispatchEvent(new MouseEvent('mousemove', at(sx, sy + dy * i / 12)));"
                + "return new Promise(r => setTimeout(() => {"
                + "  document.dispatchEvent(new MouseEvent('mouseup', Object.assign(at(sx, sy + dy), {buttons: 0})));"
                + "  setTimeout(() => r('from y=' + Math.round(sy) + ' by ' + Math.round(dy)"
                + "    + 'px in a ' + window.innerWidth + 'x' + window.innerHeight + ' window'), 600); }, 120));";
    }

    /** Drags, then answers the dialog the change raises. A drag that took hold but asked nothing
     *  and one that never took hold look the same from here, so the drag's own account of itself
     *  goes in the message: these run where no one is watching them. */
    static void dragThenChoose(WebDriver d, String dragScript, String scope) {
        String did = String.valueOf(CalendarApp.inFrame(d, dragScript));
        try {
            CalendarApp.chooseScope(d, scope);
        } catch (IllegalStateException noDialog) {
            throw new AssertionError("A drag " + did + " raised no question about which occurrences"
                    + " to change, so it did not take hold", noDialog);
        }
    }

    /** Drags, then waits for the entry to be drawn in the day it was dropped on. Where it is
     *  instead separates a drag that never took hold from one that landed somewhere else. */
    static void dragThenLandIn(WebDriver d, String dragScript, String isoDate, String title) {
        String did = String.valueOf(CalendarApp.inFrame(d, dragScript));
        try {
            CalendarApp.waitInFrame(d, "the event in the cell for " + isoDate,
                    "document.querySelector('[data-date=\"" + isoDate + "\"]')"
                            + ".textContent.indexOf(" + CalendarApp.quote(title) + ") !== -1", 10_000);
        } catch (IllegalStateException notThere) {
            throw new AssertionError("A drag " + did + " did not put " + title + " on " + isoDate
                    + "; it is drawn on " + CalendarApp.occurrenceDates(d, title), notThere);
        }
    }

    static String cellCentre(String isoDate) {
        return "(function(){ let c = document.querySelector('[data-date=\"" + isoDate + "\"]');"
                + " if (!c) throw new Error('no cell for " + isoDate + "'); let b = c.getBoundingClientRect();"
                + " return {x: b.left + b.width / 2, y: b.top + b.height / 2}; })()";
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

        // A month of its own, so what is counted here is what this test put there.
        LocalDate lastDay = LocalDate.of(2027, 3, 31);
        LocalDate nextDay = lastDay.plusDays(1);
        String from = lastDay.format(DateTimeFormatter.ISO_LOCAL_DATE);
        String to = nextDay.format(DateTimeFormatter.ISO_LOCAL_DATE);

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Path downloads = Temp.directory("peergos-calendar-drag-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            System.out.println("calendar open, files under " + calendar);

            // --- a plain event, dragged over the month boundary --------------------------------
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", PLAIN)
                            + CalendarApp.setField("event-start-date", from)
                            + CalendarApp.setField("event-start-time", "10:00")
                            + CalendarApp.setField("event-end-date", from)
                            + CalendarApp.setField("event-end-time", "11:00")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String march = calendar + "/2027/3";
            String plainFile = CalendarApp.awaitFileSaying(d, march, "SUMMARY:" + PLAIN);
            CalendarApp.gotoMonth(d, from);
            CalendarApp.waitInFrame(d, "the event on the grid", "!!(" + chipByTitle(PLAIN) + ")", 60_000);

            // The month grid shows the first days of April after the 31st, so the drop lands in
            // the next month and the file has to move directory.
            dragThenLandIn(d, drag(PLAIN, cellCentre(to)), to, PLAIN);
            String april = calendar + "/2027/4";
            String movedFile = CalendarApp.awaitFileSaying(d, april, "SUMMARY:" + PLAIN);
            String moved = CalendarApp.read(d, april, movedFile);
            CalendarApp.assertTimeIs(moved, "DTSTART", nextDay.atTime(10, 0));
            CalendarApp.assertTimeIs(moved, "DTEND", nextDay.atTime(11, 0));
            d.waitUntil("the old file to go", () -> CalendarApp.list(d, march).contains(plainFile) ? null : true, 60_000);
            System.out.println("  ok   a dragged event's file moved to the month it was dropped in");

            // --- a repeating occurrence: another day is refused ----------------------------------
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", SERIES)
                            + CalendarApp.setField("event-start-date", from)
                            + CalendarApp.setField("event-start-time", "09:00")
                            + CalendarApp.setField("event-end-date", from)
                            + CalendarApp.setField("event-end-time", "09:30")
                            + CalendarApp.setField("event-repeat-freq", "weekly")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String recurring = calendar + "/recurring";
            String seriesFile = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:" + SERIES);
            String before = CalendarApp.read(d, recurring, seriesFile);
            CalendarApp.waitInFrame(d, "the series on the grid", "!!(" + chipByTitle(SERIES) + ")", 60_000);
            CalendarApp.inFrame(d, drag(SERIES, cellCentre(to)));
            WebDriver.sleep(2000);
            List<String> stillOn = CalendarApp.occurrenceDates(d, SERIES);
            if (! stillOn.contains(from) || stillOn.contains(to))
                throw new AssertionError("A repeating occurrence was moved to another day: " + stillOn);
            if (Boolean.TRUE.equals(CalendarApp.inFrame(d, "return document.getElementById('scope-modal-backdrop').classList.contains('open');")))
                throw new AssertionError("A refused drag still asked which occurrences to move");
            if (! CalendarApp.read(d, recurring, seriesFile).equals(before))
                throw new AssertionError("A refused drag changed the series' file");
            System.out.println("  ok   a repeating occurrence dropped on another day snaps back, file untouched");

            // --- a same-day move, in the week view where a time can change ---------------------
            // The month grid only moves days, so the three answers for a repeating occurrence
            // are exercised where they apply: This detaches the occurrence, This and following
            // splits the series, All (here by a resize) rewrites the one series file.
            CalendarApp.inFrame(d, "let tab = Array.from(document.querySelectorAll('#calendar [role=\"tab\"]'))"
                    + "  .find(t => t.textContent.trim() === 'Week');"
                    + "if (!tab) throw new Error('no Week tab'); tab.click(); return 1;");
            weekShowing(d, from);
            CalendarApp.waitInFrame(d, "the occurrence in its week", inColumn(from, SERIES), 30_000);
            dragThenChoose(d, dragInColumn(SERIES, from, slotDistance("09:00:00", "11:00:00"), false), "this");
            String excluded = CalendarApp.awaitStored(d, recurring, seriesFile, "EXDATE");
            CalendarApp.assertTimeIs(excluded, "EXDATE", lastDay.atTime(9, 0));
            String detachedFile = CalendarApp.awaitFileSaying(d, march, "SUMMARY:" + SERIES);
            String ownIcs = CalendarApp.read(d, march, detachedFile);
            CalendarApp.assertTimeIs(ownIcs, "DTSTART", lastDay.atTime(11, 0));
            if (CalendarApp.property(ownIcs, "RRULE") != null)
                throw new AssertionError("The detached occurrence is still a series of its own:\n" + ownIcs);
            System.out.println("  ok   this: excluded where it was, stored on its own at the new time");

            LocalDate second = lastDay.plusWeeks(1);
            String secondDay = second.format(DateTimeFormatter.ISO_LOCAL_DATE);
            weekShowing(d, secondDay);
            CalendarApp.waitInFrame(d, "the next occurrence", inColumn(secondDay, SERIES), 30_000);
            dragThenChoose(d, dragInColumn(SERIES, secondDay, slotDistance("09:00:00", "11:00:00"), false), "following");
            String cut = CalendarApp.awaitStored(d, recurring, seriesFile, "UNTIL=");
            CalendarApp.assertHas(cut, "RRULE", "UNTIL=" + lastDay.format(DateTimeFormatter.ofPattern("yyyyMM")));
            String fresh = d.waitUntil("a second series file for " + SERIES, () -> {
                for (String name : CalendarApp.list(d, recurring)) {
                    if (name.equals(seriesFile))
                        continue;
                    String ics = CalendarApp.read(d, recurring, name);
                    if (ics.contains("SUMMARY:" + SERIES) && CalendarApp.property(ics, "RRULE") != null)
                        return name;
                }
                return null;
            }, 60_000);
            CalendarApp.assertTimeIs(CalendarApp.read(d, recurring, fresh), "DTSTART", second.atTime(11, 0));
            System.out.println("  ok   this and following: the series ends before the occurrence, a new one starts at the new time");

            LocalDate third = second.plusWeeks(1);
            String thirdDay = third.format(DateTimeFormatter.ISO_LOCAL_DATE);
            weekShowing(d, thirdDay);
            CalendarApp.waitInFrame(d, "the new series' next occurrence", inColumn(thirdDay, SERIES), 30_000);
            int filesBefore = CalendarApp.list(d, recurring).size();
            dragThenChoose(d, dragInColumn(SERIES, thirdDay, slotDistance("11:30:00", "13:00:00"), true), "all");
            String longer = d.waitUntil("the series to carry the new length", () -> {
                String ics = CalendarApp.read(d, recurring, fresh);
                String end = CalendarApp.property(ics, "DTEND");
                return end != null && end.contains(second.atTime(13, 0).format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss"))) ? ics : null;
            }, 60_000);
            CalendarApp.assertTimeIs(longer, "DTSTART", second.atTime(11, 0));
            CalendarApp.assertTimeIs(longer, "DTEND", second.atTime(13, 0));
            if (CalendarApp.list(d, recurring).size() != filesBefore)
                throw new AssertionError("All events wrote a new file instead of rewriting the series");
            System.out.println("  ok   all: a resize of one occurrence gives the whole series the new length, in its one file");
            CalendarApp.monthView(d);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
