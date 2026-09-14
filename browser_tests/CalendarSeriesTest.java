import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

/** Changing one occurrence of a repeating event, and then ending the series early.
 *
 *  This is the part of a calendar that goes wrong quietly. Detaching an occurrence has to add an
 *  EXDATE to the series and write the changed one as a file of its own, or the day shows twice;
 *  ending a series has to leave an UNTIL behind, or occurrences a user deleted come back. Both are
 *  checked in the files, because that is where every other client reads them from.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarSeriesTest.java [engine] [url]
 */
public class CalendarSeriesTest {

    static final String TITLE = "Weekly standup";
    static final String MOVED = "Standup moved this week";

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

        // The 2nd of next month, so the whole series is on one screen and none of it is past.
        LocalDate start = LocalDate.now().withDayOfMonth(1).plusMonths(1).plusDays(1);
        String date = start.format(DateTimeFormatter.ISO_LOCAL_DATE);

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Path downloads = Temp.directory("peergos-calendar-series-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            System.out.println("calendar open, files under " + calendar);

            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", TITLE)
                            + CalendarApp.setField("event-start-date", date)
                            + CalendarApp.setField("event-start-time", "09:00")
                            + CalendarApp.setField("event-end-date", date)
                            + CalendarApp.setField("event-end-time", "09:15")
                            + CalendarApp.setField("event-repeat-freq", "weekly")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            String recurring = calendar + "/recurring";
            String seriesFile = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:" + TITLE);
            CalendarApp.assertHas(CalendarApp.read(d, recurring, seriesFile), "RRULE", "FREQ=WEEKLY");
            System.out.println("series stored as " + recurring + "/" + seriesFile);

            CalendarApp.nextPeriod(d);
            CalendarApp.waitInFrame(d, "the series on the grid", drawn(TITLE), 30_000);
            List<String> before = CalendarApp.occurrenceDates(d, TITLE);
            System.out.println("  the series runs on " + before);
            if (before.size() < 3)
                throw new AssertionError("Expected a few occurrences to work with, got " + before);

            // --- one occurrence, moved out of the series -------------------------------------
            CalendarApp.openPopover(d, TITLE);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "this");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", MOVED) + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            String series = CalendarApp.awaitStored(d, recurring, seriesFile, "EXDATE");
            CalendarApp.assertHas(series, "EXDATE", "T");
            CalendarApp.assertHas(series, "SUMMARY", TITLE);
            System.out.println("  ok   the series excludes the day that changed");

            String month = calendar + "/" + before.get(0).substring(0, 4)
                    + "/" + Integer.parseInt(before.get(0).substring(5, 7));
            String detached = CalendarApp.awaitFileSaying(d, month, "SUMMARY:" + MOVED);
            String detachedIcs = CalendarApp.read(d, month, detached);
            CalendarApp.assertHas(detachedIcs, "SUMMARY", MOVED);
            if (CalendarApp.property(detachedIcs, "RRULE") != null)
                throw new AssertionError("The detached occurrence is still a series of its own:\n"
                        + detachedIcs);
            System.out.println("  ok   the changed day is a file of its own, with no rule");

            // --- and the rest of the series, ended early -------------------------------------
            CalendarApp.waitInFrame(d, "the series still on the grid", drawn(TITLE), 30_000);
            CalendarApp.openPopover(d, TITLE);
            CalendarApp.inFrame(d, CalendarApp.click("popover-delete") + "return 1;");
            // Choosing a scope is the confirmation for a series: the dialog names what it will
            // do, so there is no second "are you sure" behind it.
            CalendarApp.chooseScope(d, "following");

            String ended = CalendarApp.awaitStored(d, recurring, seriesFile, "UNTIL=");
            CalendarApp.assertHas(ended, "RRULE", "UNTIL=");
            System.out.println("  ok   the series ends where it was cut");

            List<String> after = CalendarApp.occurrenceDates(d, TITLE);
            System.out.println("  the series now runs on " + after);
            if (after.size() >= before.size())
                throw new AssertionError("Deleting the rest of the series left " + after
                        + ", which is no shorter than " + before);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static String drawn(String title) {
        return "Array.from(document.querySelectorAll('[data-search-event-id]'))"
                + ".some(el => el.textContent.indexOf(" + CalendarApp.quote(title) + ") !== -1)";
    }

}
