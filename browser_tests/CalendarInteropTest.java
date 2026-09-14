import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;

import peergos.server.webdav.caldav.ICal;

/** What the calendar writes, read by something other than itself.
 *
 *  Every claim about compatibility comes down to this: another program has to be able to open
 *  these files. So the entries created here are parsed again with the server's own iCalendar
 *  reader - the one the CalDAV bridge serves phones from, and the one the Android mirror uses -
 *  rather than with the app's parser, which could agree with the writer about something wrong.
 *
 *  It also pins down the other half of an upgrade: a file this app cannot make sense of is left
 *  exactly where it is. Not shown, not rewritten, not deleted.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarInteropTest.java [engine] [url]
 */
public class CalendarInteropTest {

    static final String EVENT = "Interop event";
    static final String TASK = "Interop task";
    static final String WHERE = "Room 3; upstairs, at the back";

    /** Something no calendar can place: kept, because it is still the user's. */
    static final String UNREADABLE = String.join("\r\n",
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "BEGIN:VJOURNAL",
            "UID:not-an-event",
            "DTSTAMP:20260101T090000Z",
            "SUMMARY:A journal entry no calendar shows",
            "END:VJOURNAL",
            "END:VCALENDAR",
            "");

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

        LocalDate day = LocalDate.now().plusDays(3);
        String date = day.format(DateTimeFormatter.ISO_LOCAL_DATE);

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        Path downloads = Temp.directory("peergos-calendar-interop-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);
            System.out.println("calendar open, files under " + calendar);

            // --- an event, read back by the server's parser ------------------------------------
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("event-title", EVENT)
                            + CalendarApp.setField("event-location", WHERE)
                            + CalendarApp.setField("event-start-date", date)
                            + CalendarApp.setField("event-start-time", "09:00")
                            + CalendarApp.setField("event-end-date", date)
                            + CalendarApp.setField("event-end-time", "10:00")
                            + CalendarApp.setField("event-reminder", "15")
                            + CalendarApp.setField("event-repeat-freq", "weekly")
                            + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");

            String recurring = calendar + "/recurring";
            String eventFile = CalendarApp.awaitFileSaying(d, recurring, "SUMMARY:" + EVENT);
            String eventIcs = CalendarApp.read(d, recurring, eventFile);

            ICal.Component parsedEvent = parse(eventIcs, "VEVENT");
            expect("SUMMARY", parsedEvent.value("SUMMARY").orElse(""), EVENT);
            // The escapes this app writes have to come back as the text that was typed.
            expect("LOCATION", unescape(parsedEvent.value("LOCATION").orElse("")), WHERE);
            if (parsedEvent.property("DTSTART").flatMap(ICal::toInstant).isEmpty())
                throw new AssertionError("The server's parser cannot read DTSTART:\n" + eventIcs);
            expect("RRULE", parsedEvent.value("RRULE").orElse(""), "FREQ=WEEKLY;BYDAY="
                    + weekdayCode(day));
            List<ICal.Component> alarms = parsedEvent.children("VALARM");
            if (alarms.size() != 1)
                throw new AssertionError("Expected one alarm, the parser found " + alarms.size());
            expect("TRIGGER", alarms.get(0).value("TRIGGER").orElse(""), "-PT15M");
            System.out.println("  ok   the event reads back through the server's own parser");

            // --- and a task ------------------------------------------------------------------
            CalendarApp.newEntry(d, "add-menu-task", "task-modal-backdrop");
            CalendarApp.inFrame(d,
                    CalendarApp.setField("task-title", TASK)
                            + "document.getElementById('task-has-due').checked = true;"
                            + "document.getElementById('task-has-due')"
                            + "  .dispatchEvent(new Event('change', {bubbles: true}));"
                            + CalendarApp.setField("task-due-date", date)
                            + "return 1;");
            CalendarApp.save(d, "task-save", "task-modal-backdrop");

            String tasks = calendar + "/tasks";
            String taskFile = CalendarApp.awaitFileSaying(d, tasks, "SUMMARY:" + TASK);
            ICal.Component parsedTask = parse(CalendarApp.read(d, tasks, taskFile), "VTODO");
            expect("SUMMARY", parsedTask.value("SUMMARY").orElse(""), TASK);
            expect("STATUS", parsedTask.value("STATUS").orElse(""), "NEEDS-ACTION");
            if (parsedTask.property("DUE").isEmpty())
                throw new AssertionError("The task has no DUE the parser can see");
            System.out.println("  ok   the task reads back as a VTODO another client can open");

            // --- and something this app cannot show is still left alone -----------------------
            CalendarApp.write(d, calendar + "/2026/1", "not-an-event.ics", UNREADABLE);
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            CalendarApp.gotoMonth(d, "2026-01-05");
            WebDriver.sleep(4000);
            String afterLoading = CalendarApp.read(d, calendar + "/2026/1", "not-an-event.ics");
            if (! afterLoading.equals(UNREADABLE))
                throw new AssertionError("An entry this app cannot read was changed:\n" + afterLoading);
            System.out.println("  ok   an entry it cannot show is still on disk, unchanged");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static ICal.Component parse(String ics, String kind) {
        Optional<ICal.Component> parsed = ICal.parse(ics);
        if (parsed.isEmpty())
            throw new AssertionError("The server's parser could not read the file at all:\n" + ics);
        for (ICal.Component part : parsed.get().scheduleComponents())
            if (part.name.equals(kind))
                return part;
        throw new AssertionError("No " + kind + " in what was written:\n" + ics);
    }

    static void expect(String what, String got, String wanted) {
        if (! got.equals(wanted))
            throw new AssertionError("Expected " + what + " to read back as " + wanted + ", got " + got);
    }

    static String weekdayCode(LocalDate day) {
        return new String[]{"MO", "TU", "WE", "TH", "FR", "SA", "SU"}[day.getDayOfWeek().getValue() - 1];
    }

    /** RFC 5545 escaping, as a reader has to undo it. */
    static String unescape(String value) {
        return value.replace("\\,", ",").replace("\\;", ";").replace("\\n", "\n").replace("\\\\", "\\");
    }
}
