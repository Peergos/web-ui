import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** A repeating event whose start is moved to another month, through Edit -> All events.
 *
 *  A single entry is filed under its month, so moving it to another month writes the new file and
 *  deletes the old one. A series is filed in recurring/ whatever its start, so there is no old file
 *  to delete: treating the change as a move deletes the file the save has just written, and the
 *  series is gone the next time anything loads it.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarSeriesMoveTest.java [engine] [url]
 */
public class CalendarSeriesMoveTest {

    static final String TITLE = "Planning moved to the next month";

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

        // The 25th of next month, moved on a week: the same weekday, which the form keeps ticked,
        // in the month after whichever zone the browser is in, and none of it in the past.
        LocalDate start = LocalDate.now().withDayOfMonth(1).plusMonths(1).withDayOfMonth(25);
        LocalDate moved = start.plusWeeks(1);
        String newStart = moved.format(DateTimeFormatter.BASIC_ISO_DATE) + "T090000";

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Path downloads = Temp.directory("peergos-calendar-series-move-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            String recurring = calendar + "/recurring";

            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", TITLE)
                            + CalendarApp.setField("event-start-date", start.toString())
                            + CalendarApp.setField("event-start-time", "09:00")
                            + CalendarApp.setField("event-end-date", start.toString())
                            + CalendarApp.setField("event-end-time", "10:00")
                            + CalendarApp.setField("event-repeat-freq", "weekly")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String seriesFile = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:" + TITLE);
            System.out.println("series stored as " + recurring + "/" + seriesFile);

            CalendarApp.gotoMonth(d, start.toString());
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn(TITLE), 30_000);
            CalendarApp.openPopover(d, TITLE);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-start-date", moved.toString())
                            + CalendarApp.setField("event-end-date", moved.toString())
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            // Settled is when the host has nothing left to write for it: the save of the new
            // start, and on a build that took it for a move, the delete queued behind it.
            String settled = d.waitUntil("the new start to be written", () -> {
                if (((Number) d.script("return Object.keys(window.__cal.pendingWrites).length;")).intValue() > 0)
                    return null;
                if (! CalendarApp.list(d, recurring).contains(seriesFile))
                    return "gone";
                String ics = CalendarApp.read(d, recurring, seriesFile);
                return ics.contains(newStart) ? ics : null;
            }, 120_000);
            if ("gone".equals(settled))
                throw new AssertionError("Moving the series' start to " + moved + " deleted its file;"
                        + " recurring/ now holds " + CalendarApp.list(d, recurring));
            CalendarApp.assertContains(settled, "SUMMARY:" + TITLE);
            System.out.println("  ok   the series kept its file, now starting " + moved);

            // and loaded again, from the store, as any other client would
            Page.gotoView(d, "Drive", "downloadFile", "__drive");
            CalendarApp.open(d);
            CalendarApp.gotoMonth(d, moved.toString());
            CalendarApp.waitInFrame(d, "the moved series on the grid after a reload",
                    CalendarSeriesTest.drawn(TITLE), 30_000);
            List<String> dates = CalendarApp.occurrenceDates(d, TITLE);
            if (dates.isEmpty() || ! dates.get(0).equals(moved.toString()))
                throw new AssertionError("After a reload the series is drawn on " + dates
                        + ", where it should start on " + moved);
            System.out.println("  ok   a reload draws it from " + moved);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
