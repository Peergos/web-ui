import java.nio.file.*;
import java.time.*;

/** A link to one calendar entry opens that entry, which is what tapping a reminder on the phone
 *  does: the Android app hands the page {"app":"Calendar","args":{"entry":{"id":uid,"at":start}}}.
 *
 *  It used to open the app on whatever it was showing, or on Drive from a cold start. Now the
 *  calendar opens, goes to the occurrence and shows its detail, whether the page was elsewhere,
 *  already on the calendar, or not yet signed in. And the link is used once, so the app coming
 *  back to the page does not open it again.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarEntryLinkTest.java [engine] [url]
 */
public class CalendarEntryLinkTest {

    static final String EVENT = "Dentist appointment";
    static final String SERIES = "Weekly standup";

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
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-link-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);

            // months away from today, so the grid has to move to find it
            ZonedDateTime eventStart = LocalDate.now(ZoneOffset.UTC).plusMonths(3).withDayOfMonth(12)
                    .atTime(9, 0).atZone(ZoneOffset.UTC);
            CalendarApp.write(d, calendar + "/" + eventStart.getYear() + "/" + eventStart.getMonthValue(),
                    "dentist.ics", ics("dentist", eventStart, "SUMMARY:" + EVENT));
            ZonedDateTime seriesStart = LocalDate.now(ZoneOffset.UTC).minusMonths(2).withDayOfMonth(3)
                    .atTime(10, 0).atZone(ZoneOffset.UTC);
            CalendarApp.write(d, calendar + "/recurring", "standup.ics",
                    ics("standup", seriesStart, "SUMMARY:" + SERIES + "\r\nRRULE:FREQ=WEEKLY"));
            ZonedDateTime occurrence = seriesStart.plusWeeks(14);

            // from elsewhere in the app, as a tap with the app open on Drive
            Page.gotoView(d, "Drive", "downloadFile", "__drive");
            follow(d, "dentist", eventStart);
            awaitPopover(d, EVENT);
            if (Boolean.TRUE.equals(d.script("const p = " + Page.VUE + ".root().getPropsFromUrl();"
                    + " return !!(p && p.args && p.args.entry);")))
                throw new AssertionError("Once followed, the link should be gone from the address, so coming back does not open it again");
            System.out.println("  ok   from Drive: the calendar opens on the entry, and the link is used up");

            // with the calendar already open, on another entry
            CalendarApp.inFrame(d, "document.getElementById('popover-close').click(); return 1;");
            follow(d, "standup", occurrence);
            awaitPopover(d, SERIES);
            String time = String.valueOf(CalendarApp.inFrame(d, "return document.getElementById('popover-time').textContent;"));
            if (! time.contains(Integer.toString(occurrence.getDayOfMonth())))
                throw new AssertionError("The occurrence on the " + occurrence.getDayOfMonth() + "th should open, not another: " + time);
            System.out.println("  ok   with the calendar open: the occurrence the link names opens");

            // a cold start, before signing in: away first, as only the fragment differs
            d.navigate("about:blank");
            d.navigate(url + "/#" + fragment("dentist", eventStart));
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            awaitPopover(d, EVENT);
            System.out.println("  ok   from a cold start: signing in lands on the entry, not on Drive");

            // an entry that is not there says so rather than nothing happening
            follow(d, "no-such-entry", eventStart);
            CalendarApp.waitInFrame(d, "the toast", "document.body.innerText.includes('no longer in the calendar')", 30_000);
            System.out.println("  ok   an entry that has gone says so");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    private static String ics(String uid, ZonedDateTime start, String extra) {
        java.time.format.DateTimeFormatter f = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
        return String.join("\r\n", "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Peergos test//EN",
                "BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + f.format(start), "DTSTART:" + f.format(start),
                "DTEND:" + f.format(start.plusMinutes(30)), extra, "END:VEVENT", "END:VCALENDAR", "");
    }

    private static String fragment(String uid, ZonedDateTime at) {
        return java.net.URLEncoder.encode("{\"app\":\"Calendar\",\"args\":{\"entry\":{\"id\":\"" + uid
                + "\",\"at\":" + at.toInstant().toEpochMilli() + "}}}", java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
    }

    /** What the Android app does to a page that is already open. */
    private static void follow(WebDriver d, String uid, ZonedDateTime at) {
        d.script("window.location.hash = '#' + arguments[0]; return 1;", fragment(uid, at));
    }

    private static void awaitPopover(WebDriver d, String title) {
        d.waitForScript("the calendar frame", "document.querySelector('#calendar-iframe')", 60_000);
        CalendarApp.waitInFrame(d, "the entry's detail to open",
                "document.getElementById('event-popover').classList.contains('open')"
                        + " && document.getElementById('popover-title').textContent.includes('" + title + "')", 60_000);
    }
}
