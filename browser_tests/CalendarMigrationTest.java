import java.nio.file.*;
import java.util.*;

/** Everything a calendar holds survives leaving it and arriving somewhere else.
 *
 *  A person trying Peergos has to be able to bring a calendar with them and take it away
 *  again, so this is a round trip rather than a read: entries of every shape this app stores
 *  are exported from one account, imported into a second that has never seen them, and
 *  exported again. What comes out of the second account has to say what went into the first
 *  - the same UIDs, times, rules, attendees and properties this app knows nothing about.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarMigrationTest.java [engine] [url]
 */
public class CalendarMigrationTest {

    static final String PASSWORD = "migration-password";

    /** One of each shape: timed, all day, a series with an exception and an extra date, an
     *  entry carrying properties this app does not write, and a task. */
    static final Map<String, String> PLANTED = new LinkedHashMap<>() {{
        put("mig-timed", String.join("\r\n",
                "BEGIN:VEVENT", "UID:mig-timed", "DTSTAMP:20270301T090000Z",
                "DTSTART;TZID=Europe/Paris:20270312T090000",
                "DTEND;TZID=Europe/Paris:20270312T103000",
                "SUMMARY:Timed with a zone", "LOCATION:Room 2\\, upstairs", "END:VEVENT"));
        put("mig-allday", String.join("\r\n",
                "BEGIN:VEVENT", "UID:mig-allday", "DTSTAMP:20270301T090000Z",
                "DTSTART;VALUE=DATE:20270314", "DTEND;VALUE=DATE:20270315",
                "SUMMARY:All day", "END:VEVENT"));
        put("mig-foreign", String.join("\r\n",
                "BEGIN:VEVENT", "UID:mig-foreign", "DTSTAMP:20270301T090000Z",
                "DTSTART:20270316T140000Z", "DTEND:20270316T150000Z",
                "SUMMARY:From another client", "ORGANIZER;CN=Someone:mailto:someone@example.com",
                "ATTENDEE;PARTSTAT=ACCEPTED:mailto:guest@example.com",
                "CATEGORIES:Work,Travel", "X-SOMETHING-ELSE:kept as it was", "END:VEVENT"));
    }};

    static final String SERIES = String.join("\r\n",
            "BEGIN:VEVENT", "UID:mig-series", "DTSTAMP:20270301T090000Z",
            "DTSTART;TZID=UTC:20270302T090000", "DTEND;TZID=UTC:20270302T093000",
            "SUMMARY:Weekly with an exception", "RRULE:FREQ=WEEKLY;BYDAY=TU",
            "EXDATE;TZID=UTC:20270316T090000", "RDATE;TZID=UTC:20270320T090000", "END:VEVENT");

    /** Tasks have to travel as completely as events: one with a date, one with none at all,
     *  one already done, one that repeats, and one carrying properties this app never
     *  writes. Each is a shape the app stores differently. */
    static final Map<String, String> TASKS = new LinkedHashMap<>() {{
        put("mig-task", String.join("\r\n",
                "BEGIN:VTODO", "UID:mig-task", "DTSTAMP:20270301T090000Z",
                "DUE;VALUE=DATE:20270318", "SUMMARY:A task that travels",
                "STATUS:NEEDS-ACTION", "PERCENT-COMPLETE:0", "END:VTODO"));
        put("mig-task-undated", String.join("\r\n",
                "BEGIN:VTODO", "UID:mig-task-undated", "DTSTAMP:20270301T090000Z",
                "SUMMARY:A task with no date", "STATUS:NEEDS-ACTION", "END:VTODO"));
        put("mig-task-done", String.join("\r\n",
                "BEGIN:VTODO", "UID:mig-task-done", "DTSTAMP:20270301T090000Z",
                "DUE;VALUE=DATE:20270310", "SUMMARY:A task already done",
                "STATUS:COMPLETED", "PERCENT-COMPLETE:100",
                "COMPLETED:20270309T170000Z", "END:VTODO"));
        put("mig-task-repeating", String.join("\r\n",
                "BEGIN:VTODO", "UID:mig-task-repeating", "DTSTAMP:20270301T090000Z",
                "DUE;TZID=UTC:20270305T170000", "SUMMARY:A task that repeats",
                "RRULE:FREQ=WEEKLY;BYDAY=FR", "STATUS:NEEDS-ACTION", "END:VTODO"));
        put("mig-task-part-done", String.join("\r\n",
                "BEGIN:VTODO", "UID:mig-task-part-done", "DTSTAMP:20270301T090000Z",
                "DUE;VALUE=DATE:20270322", "SUMMARY:A task somebody else half finished",
                "STATUS:NEEDS-ACTION", "PERCENT-COMPLETE:40", "END:VTODO"));
        put("mig-task-foreign", String.join("\r\n",
                "BEGIN:VTODO", "UID:mig-task-foreign", "DTSTAMP:20270301T090000Z",
                "DUE;VALUE=DATE:20270320", "SUMMARY:A task from another client",
                "PRIORITY:2", "DESCRIPTION:Written elsewhere",
                "CATEGORIES:Errands", "X-SOMETHING-ELSE:kept as it was", "END:VTODO"));
    }};

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
        Path downloads = Temp.directory("peergos-calendar-migration-");
        Path scratch = Temp.directory("peergos-calendar-migration-file-");
        String arriving = "arrival" + (System.currentTimeMillis() % 100000);
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            CalendarApp.open(d);
            String calendar = CalendarApp.directoryOf(d, Server.USERNAME);

            // --- a calendar worth taking with you --------------------------------------------
            for (Map.Entry<String, String> entry : PLANTED.entrySet())
                CalendarApp.write(d, calendar + "/2027/3", entry.getKey() + ".ics", document(entry.getValue()));
            CalendarApp.write(d, calendar + "/recurring", "mig-series.ics", document(SERIES));
            for (Map.Entry<String, String> task : TASKS.entrySet())
                CalendarApp.write(d, calendar + "/tasks", task.getKey() + ".ics", document(task.getValue()));
            System.out.println("planted " + wanted().size() + " entries of different shapes");

            String leaving = exportCalendar(d, Server.USERNAME, downloads);
            Map<String, List<String>> before = entriesOf(leaving);
            for (String uid : wanted())
                if (! before.containsKey(uid))
                    throw new AssertionError("The export left " + uid + " behind: " + before.keySet());
            // Against what was planted, not only against what the export happened to say: an
            // export that dropped a property would otherwise be copied faithfully into the
            // second account and compared against itself.
            Map<String, List<String>> planted = entriesOf(everythingPlanted());
            for (String uid : wanted()) {
                for (String property : properties(planted.get(uid)))
                    if (! before.get(uid).contains(property))
                        throw new AssertionError("The export dropped " + property + " from " + uid
                                + ":\n  stored " + planted.get(uid) + "\n  exported " + before.get(uid));
                Map<String, List<String>> was = moments(planted.get(uid));
                Map<String, List<String>> now = moments(before.get(uid));
                if (! was.equals(now))
                    throw new AssertionError(uid + " is at a different moment after exporting:"
                            + "\n  stored " + was + "\n  exported " + now);
            }
            System.out.println("  ok   the export says everything the stored entries said,"
                    + " at the same moments");
            if (! leaving.contains("X-WR-CALNAME:"))
                throw new AssertionError("The exported file does not say which calendar it is,"
                        + " so it arrives elsewhere unnamed");
            System.out.println("  ok   the export carries every shape, and names the calendar");

            // --- and arriving somewhere that has never seen it -------------------------------
            Fixtures.signUp(url, arriving, PASSWORD);
            Path file = scratch.resolve("leaving.ics");
            Files.writeString(file, leaving);
            signIn(d, url, arriving);
            CalendarApp.open(d);
            CalendarImportExportTest.handFile(d, file);
            String summary = CalendarImportExportTest.importSummary(d);
            System.out.println("  arrival said: " + summary);
            CalendarApp.inFrame(d, CalendarApp.click("import-summary-ok") + "return 1;");

            String again = exportCalendar(d, arriving, downloads);
            Map<String, List<String>> after = entriesOf(again);
            List<String> lost = new ArrayList<>();
            for (String uid : wanted())
                if (! after.containsKey(uid))
                    lost.add(uid);
            if (! lost.isEmpty())
                throw new AssertionError("Entries did not survive the move: " + lost
                        + ", arrived with " + after.keySet());
            System.out.println("  ok   every entry arrived in an account that had never seen them");

            for (String uid : wanted()) {
                for (String property : properties(before.get(uid)))
                    if (! after.get(uid).contains(property))
                        throw new AssertionError(uid + " lost " + property + " on the way:\n  was "
                                + before.get(uid) + "\n  now " + after.get(uid));
                if (! moments(before.get(uid)).equals(moments(after.get(uid))))
                    throw new AssertionError(uid + " moved in time on the way:\n  was "
                            + moments(before.get(uid)) + "\n  now " + moments(after.get(uid)));
            }
            System.out.println("  ok   with their times, rules, attendees and foreign properties intact");

            // A task that arrives as an event is a task lost, whatever its summary says.
            for (String uid : TASKS.keySet()) {
                if (! after.get(uid).get(0).equals("BEGIN:VTODO"))
                    throw new AssertionError(uid + " arrived as something other than a task: "
                            + after.get(uid));
            }
            System.out.println("  ok   and every task is still a task");

            // Arriving twice is a thing people do - a second click, a retried upload. It has
            // to leave the calendar holding one of each, not two.
            for (String uid : wanted())
                if (countOf(again, uid) != 1)
                    throw new AssertionError(uid + " arrived " + countOf(again, uid) + " times");
            CalendarImportExportTest.handFile(d, file);
            String twice = CalendarImportExportTest.importSummary(d);
            System.out.println("  the same file again said: " + twice);
            CalendarApp.inFrame(d, CalendarApp.click("import-summary-ok") + "return 1;");
            String third = exportCalendar(d, arriving, downloads);
            List<String> doubled = new ArrayList<>();
            for (String uid : wanted())
                if (countOf(third, uid) != 1)
                    doubled.add(uid + " x" + countOf(third, uid));
            if (! doubled.isEmpty())
                throw new AssertionError("Importing the same file twice doubled entries: " + doubled);
            if (entriesOf(third).size() != entriesOf(again).size())
                throw new AssertionError("The calendar grew from " + entriesOf(again).size()
                        + " entries to " + entriesOf(third).size() + " on a second import of the same file");
            System.out.println("  ok   and importing the same file again changes nothing");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Every entry this test planted, as one document, to compare an export against. */
    static String everythingPlanted() {
        StringBuilder all = new StringBuilder("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
        for (String component : PLANTED.values())
            all.append(component).append("\r\n");
        all.append(SERIES).append("\r\n");
        for (String component : TASKS.values())
            all.append(component).append("\r\n");
        return all.append("END:VCALENDAR\r\n").toString();
    }

    /** How many components in a document carry this UID. One is the only right answer. */
    static int countOf(String ics, String uid) {
        int found = 0;
        for (String line : ics.replaceAll("\r?\n[ \t]", "").split("\r?\n"))
            if (line.trim().equals("UID:" + uid))
                found++;
        return found;
    }

    static List<String> wanted() {
        List<String> all = new ArrayList<>(PLANTED.keySet());
        all.add("mig-series");
        all.addAll(TASKS.keySet());
        return all;
    }

    /** Properties whose text should arrive unchanged. Times are left out: the app writes
     *  them back in UTC, which is the same moment spelled differently, and those are
     *  compared as moments below. Book-keeping this app rewrites on every save is left out
     *  too - when a file was last touched says nothing about what it holds. */
    static final Set<String> REWRITTEN = Set.of("DTSTAMP", "LAST-MODIFIED", "SEQUENCE", "CREATED",
            "BEGIN", "END", "X-OWNER", "DTSTART", "DTEND", "DUE", "EXDATE", "RDATE");

    static List<String> properties(List<String> lines) {
        List<String> out = new ArrayList<>();
        for (String line : lines)
            if (! REWRITTEN.contains(nameOf(line)))
                out.add(line);
        return out;
    }

    static String nameOf(String line) {
        return line.split("[;:]")[0];
    }

    /** The moments a component names, by property. An all-day date has no time of day, so
     *  it is kept as its date; everything else resolves to an instant, whichever zone it
     *  was written in. */
    static Map<String, List<String>> moments(List<String> lines) {
        Map<String, List<String>> found = new LinkedHashMap<>();
        for (String line : lines) {
            String name = nameOf(line);
            if (! name.equals("DTSTART") && ! name.equals("DTEND") && ! name.equals("DUE")
                && ! name.equals("EXDATE") && ! name.equals("RDATE"))
                continue;
            String head = line.substring(0, line.indexOf(':'));
            String value = line.substring(line.indexOf(':') + 1);
            String zone = head.contains("TZID=") ? head.substring(head.indexOf("TZID=") + 5).split(";")[0] : null;
            List<String> resolved = new ArrayList<>();
            for (String each : value.split(","))
                resolved.add(momentOf(each.trim(), zone, head.contains("VALUE=DATE")));
            found.computeIfAbsent(name, n -> new ArrayList<>()).addAll(resolved);
        }
        return found;
    }

    static String momentOf(String value, String zone, boolean dateOnly) {
        try {
            if (dateOnly || value.length() == 8)
                return value;
            java.time.LocalDateTime local = java.time.LocalDateTime.parse(
                    value.endsWith("Z") ? value.substring(0, value.length() - 1) : value,
                    java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss"));
            java.time.ZoneId id = value.endsWith("Z") || zone == null
                    ? java.time.ZoneOffset.UTC : java.time.ZoneId.of(zone);
            return local.atZone(id).toInstant().toString();
        } catch (RuntimeException cannot) {
            return value;
        }
    }

    /** UID to the lines of its component, unfolded, for every VEVENT and VTODO in a document. */
    static Map<String, List<String>> entriesOf(String ics) {
        Map<String, List<String>> found = new LinkedHashMap<>();
        List<String> current = null;
        String uid = null;
        for (String raw : ics.replaceAll("\r?\n[ \t]", "").split("\r?\n")) {
            if (raw.equals("BEGIN:VEVENT") || raw.equals("BEGIN:VTODO")) {
                current = new ArrayList<>();
                uid = null;
            }
            if (current == null)
                continue;
            current.add(raw);
            if (raw.startsWith("UID:"))
                uid = raw.substring(4).trim();
            if (raw.equals("END:VEVENT") || raw.equals("END:VTODO")) {
                if (uid != null)
                    found.put(uid, current);
                current = null;
            }
        }
        return found;
    }

    static String document(String component) {
        return String.join("\r\n", "BEGIN:VCALENDAR", "VERSION:2.0",
                "PRODID:-//Another client//EN", component, "END:VCALENDAR", "");
    }

    /** Exports the first calendar and hands back the file's contents. */
    static String exportCalendar(WebDriver d, String user, Path downloads) throws Exception {
        for (Path stale : Files.list(downloads).toList())
            Files.deleteIfExists(stale);
        // Through the menu a person uses, not the function behind it.
        CalendarApp.inFrame(d,
                "document.getElementById('sidebar-toggle-button').click();"
                        + "document.querySelector('.calendar-menu-button').click();"
                        + "let out = Array.from(document.querySelectorAll('.calendar-menu button'))"
                        + "  .filter(b => b.textContent.trim().indexOf('Export') !== -1)[0];"
                        + "if (!out) throw new Error('the calendar menu offers no Export');"
                        + "out.click(); return 1;");
        Downloads.Result exported = Downloads.awaitMatching(downloads, "", ".ics", 180_000, 20_000);
        if (exported.path == null)
            throw new AssertionError("No .ics was exported for " + user + ", saw "
                    + Arrays.toString(downloads.toFile().list()));
        return Files.readString(exported.path);
    }

    static void signIn(WebDriver d, String url, String user) {
        d.navigate(url + "/");
        // Asked of the page rather than assumed from what has rendered so far: the app boots
        // after the document is parsed, so a check made the moment navigation returns finds
        // neither the form nor anyone signed in, and signing in over a live session hangs
        // waiting for a form that is never coming.
        d.waitUntil("the page to say whether anyone is signed in", () -> {
            if (Boolean.TRUE.equals(d.scriptQuiet(
                    "return !!document.querySelector('input[name=username]')")))
                return "signed out";
            if (Boolean.TRUE.equals(d.scriptQuiet("return (() => { for (const el of"
                    + " document.querySelectorAll('*')) { const c = el.__vue__;"
                    + " if (c && typeof c.logout === 'function') return true; } return false; })()")))
                return "signed in";
            return null;
        }, 120_000);
        if (Boolean.TRUE.equals(d.scriptQuiet("return !document.querySelector('input[name=username]')")))
            Page.logout(d);
        d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
        Page.login(d, user, PASSWORD);
    }
}
