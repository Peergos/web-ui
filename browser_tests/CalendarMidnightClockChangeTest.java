import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.time.zone.*;

/** An all-day series starting on a day whose clocks go forward at midnight, turned into a timed one.
 *
 *  That day has no midnight, and a Date for its start says 01:00. A series' deleted dates take its new
 *  time of day, and measured from that 01:00 the shift came out an hour short: the deleted occurrence two
 *  weeks on was excluded at 09:00 instead of 10:00, which excludes nothing, and it came back.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarMidnightClockChangeTest.java [engine] [url]
 */
public class CalendarMidnightClockChangeTest {

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
        // a zone whose clocks go forward at midnight, where the browser can be put in one
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-"), headless, "America/Havana")) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            CalendarApp.open(d);
            ZoneId zone = ZoneId.of(String.valueOf(d.script("return Intl.DateTimeFormat().resolvedOptions().timeZone;")));
            LocalDate changeDay = nextMidnightChange(zone);
            if (changeDay == null || ! Boolean.TRUE.equals(d.script("return new Date(arguments[0], arguments[1] - 1, arguments[2], 0, 0).getHours() === 1;",
                    changeDay.getYear(), changeDay.getMonthValue(), changeDay.getDayOfMonth()))) {
                System.out.println("SKIP the browser's " + zone + " has no clock change at midnight in the year ahead");
                return;
            }
            String recurring = CalendarApp.directoryOf(d, me.name()) + "/recurring";
            LocalDate deleted = changeDay.plusWeeks(2);
            CalendarApp.write(d, recurring, "midnight.ics", CalendarClockChangeTest.vevent("midnight", "Night watch",
                    "DTSTART;VALUE=DATE:" + changeDay.format(BASIC),
                    "DTEND;VALUE=DATE:" + changeDay.plusDays(1).format(BASIC),
                    "RRULE:FREQ=WEEKLY",
                    "EXDATE;VALUE=DATE:" + deleted.format(BASIC)));
            CalendarClockChangeTest.reload(d, changeDay);
            CalendarApp.waitInFrame(d, "the series on the grid", CalendarSeriesTest.drawn("Night watch"), 30_000);
            CalendarClockChangeTest.openOn(d, "Night watch", changeDay);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.click("event-all-day")
                    + CalendarApp.setField("event-start-date", changeDay.toString())
                    + CalendarApp.setField("event-start-time", "10:00")
                    + CalendarApp.setField("event-end-date", changeDay.toString())
                    + CalendarApp.setField("event-end-time", "10:30") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String timed = CalendarApp.awaitStored(d, recurring, "midnight.ics", changeDay.format(BASIC) + "T100000");
            String exdate = CalendarApp.property(timed, "EXDATE");
            if (exdate == null || ! exdate.contains(deleted.format(BASIC) + "T100000"))
                throw new AssertionError("Turned into a series at 10:00 from " + changeDay + " (clocks go forward at midnight in "
                        + zone + "), its deleted " + deleted + " should be excluded at 10:00, but the file says " + exdate + ":\n" + timed);
            System.out.println("  ok   the deleted occurrence took the new time: " + exdate);

            // --- a series moved into the hour the clocks skip ---------------------------------------
            // the deleted occurrence on the change day goes to 00:30, which that day doesn't have; the stored time
            // stays 00:30, which RFC 5545 reads with the offset before the gap, rather than turning into 01:30, which
            // names no occurrence of the series. The file is what is checked: this app's grid draws an occurrence at
            // a skipped time whatever its EXDATE says.
            LocalDate from = changeDay.minusDays(3);
            CalendarApp.write(d, recurring, "skipped.ics", CalendarClockChangeTest.vevent("skipped", "Late shift",
                    "DTSTART;TZID=" + zone + ":" + from.format(BASIC) + "T233000",
                    "DTEND;TZID=" + zone + ":" + from.format(BASIC) + "T235000",
                    "RRULE:FREQ=DAILY;COUNT=7",
                    "EXDATE;TZID=" + zone + ":" + changeDay.format(BASIC) + "T233000"));
            CalendarClockChangeTest.reload(d, changeDay);
            CalendarApp.waitInFrame(d, "the late series on the grid", CalendarSeriesTest.drawn("Late shift"), 30_000);
            CalendarClockChangeTest.openOn(d, "Late shift", from);
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.chooseScope(d, "all");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 30_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-time", "00:30")
                    + CalendarApp.setField("event-end-time", "00:50") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String early = CalendarApp.awaitStored(d, recurring, "skipped.ics", from.format(BASIC) + "T003000");
            String skippedExdate = CalendarApp.property(early, "EXDATE");
            if (skippedExdate == null || ! skippedExdate.contains(changeDay.format(BASIC) + "T003000"))
                throw new AssertionError("Moved to 00:30, the deleted " + changeDay + " should be excluded at 00:30, but the file says "
                        + skippedExdate + ":\n" + early);
            System.out.println("  ok   moved into the skipped hour, the deleted occurrence is still named at 00:30: " + skippedExdate);
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** The next day, within a year, whose clocks go forward at midnight in this zone, or null */
    static LocalDate nextMidnightChange(ZoneId zone) {
        Instant at = Instant.now();
        Instant end = at.plus(Duration.ofDays(365));
        for (ZoneOffsetTransition t = zone.getRules().nextTransition(at); t != null && t.getInstant().isBefore(end);
             t = zone.getRules().nextTransition(t.getInstant())) {
            if (t.isGap() && t.getDateTimeBefore().toLocalTime().equals(LocalTime.MIDNIGHT))
                return t.getDateTimeBefore().toLocalDate();
        }
        return null;
    }
}
