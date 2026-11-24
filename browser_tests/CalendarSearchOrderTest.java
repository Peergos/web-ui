import java.nio.file.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** The calendar's search list over a few years of entries. It used to put every match in date
 *  order, oldest first, and show the first twenty, with no year on any date: with history enough,
 *  what is coming next was cut off, and nothing said which year a hit was from.
 *
 *  Now, as calendar apps list a search, what is still to come leads, soonest first, then what has
 *  been, latest first, with undated tasks at the end. A date names its year when it isn't this one,
 *  and a list cut at twenty says how many it left out.
 *
 *  Every date is relative to today, so the order asserted holds whenever the test runs.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarSearchOrderTest.java [engine] [url]
 */
public class CalendarSearchOrderTest {

    static final DateTimeFormatter ICS = DateTimeFormatter.BASIC_ISO_DATE;
    static final DateTimeFormatter SHORT = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US);
    static final DateTimeFormatter LONG = DateTimeFormatter.ofPattern("EEE, MMM d, yyyy", Locale.US);

    static String entry(String kind, String uid, String summary, String extra) {
        return String.join("\r\n", "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//browser test//EN",
                "BEGIN:" + kind, "UID:" + uid, "DTSTAMP:20260101T090000Z", extra, "SUMMARY:" + summary,
                "END:" + kind, "END:VCALENDAR", "");
    }

    static String day(LocalDate date) {
        return "DTSTART;VALUE=DATE:" + ICS.format(date) + "\r\nDTEND;VALUE=DATE:" + ICS.format(date.plusDays(1));
    }

    /** A date as the list writes it: the year only when it isn't this one. */
    static String shown(LocalDate date, LocalDate today) {
        return (date.getYear() == today.getYear() ? SHORT : LONG).format(date);
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
        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;
        String user = "searcher" + (System.currentTimeMillis() % 100000);
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-calendar-search-"), headless)) {
            Fixtures.signUp(url, user, CalendarLiveShareTest.PASSWORD);
            CalendarLiveShareTest.signIn(d, url, user);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            String main = CalendarApp.directoryOf(d, user);

            LocalDate today = LocalDate.now();
            LocalDate weekly = today.plusDays(2), soon = today.plusDays(9), nextYear = today.plusDays(400);
            LocalDate recent = today.minusDays(20), ended = today.minusDays(700), twoYears = today.minusDays(760),
                    threeYears = today.minusDays(1100);
            // titles in the order the list should give them, each with the date it should show
            List<String[]> expected = List.of(
                    new String[] {"Dentist weekly", shown(weekly, today)},
                    new String[] {"Dentist soon", shown(soon, today)},
                    new String[] {"Dentist next year", shown(nextYear, today)},
                    new String[] {"Dentist recent", shown(recent, today)},
                    new String[] {"Dentist ended series", shown(ended, today)},
                    new String[] {"Dentist two years ago", shown(twoYears, today)},
                    new String[] {"Dentist three years ago", shown(threeYears, today)},
                    new String[] {"Dentist forms", "Task"});

            // a series running for three years whose next occurrence is in two days, and one that
            // ended after three weeks nearly two years ago
            CalendarApp.write(d, main + "/recurring", "search-weekly.ics", entry("VEVENT", "search-weekly", "Dentist weekly",
                    day(weekly.minusWeeks(156)) + "\r\nRRULE:FREQ=WEEKLY"));
            CalendarApp.write(d, main + "/recurring", "search-ended.ics", entry("VEVENT", "search-ended", "Dentist ended series",
                    day(ended.minusWeeks(2)) + "\r\nRRULE:FREQ=WEEKLY;COUNT=3"));
            String[][] singles = {{"search-soon", "Dentist soon"}, {"search-next-year", "Dentist next year"},
                    {"search-recent", "Dentist recent"}, {"search-two-years", "Dentist two years ago"},
                    {"search-three-years", "Dentist three years ago"}};
            LocalDate[] singleDates = {soon, nextYear, recent, twoYears, threeYears};
            for (int i = 0; i < singles.length; i++) {
                LocalDate at = singleDates[i];
                CalendarApp.write(d, main + "/" + at.getYear() + "/" + at.getMonthValue(), singles[i][0] + ".ics",
                        entry("VEVENT", singles[i][0], singles[i][1], day(at)));
            }
            CalendarApp.write(d, main + "/tasks", "search-forms.ics", entry("VTODO", "search-forms", "Dentist forms",
                    "STATUS:NEEDS-ACTION"));
            // more matches than the list shows, in the month on screen
            for (int i = 1; i <= 22; i++) {
                LocalDate at = today.withDayOfMonth(i);
                CalendarApp.write(d, main + "/" + at.getYear() + "/" + at.getMonthValue(), "search-review-" + i + ".ics",
                        entry("VEVENT", "search-review-" + i, "Review " + i, day(at)));
            }
            CalendarEmptyTest.refresh(d);
            CalendarApp.waitInFrame(d, "the task written into the store", "document.body.textContent.indexOf('Dentist forms') !== -1", 60_000);

            // --- the order, and a year on every date that isn't this year's ---------------------
            search(d, "Dentist");
            List<String> titles = new ArrayList<>(), dates = new ArrayList<>();
            for (String[] e : expected) {
                titles.add(e[0]);
                dates.add(e[1]);
            }
            try {
                d.waitUntil("all eight matches, the earlier months read", () -> {
                    Object r = CalendarApp.inFrame(d, LIST);
                    return r != null && ((Map) r).get("rows") instanceof List l && l.size() == 8
                            && Boolean.TRUE.equals(((Map) r).get("swept")) ? r : null;
                }, 120_000);
            } catch (IllegalStateException e) {
                throw new AssertionError("The search never listed all eight matches: " + CalendarApp.inFrame(d, LIST));
            }
            Object compared = CalendarApp.inFrame(d, "const rows = (" + LIST_BODY + ").rows;"
                    + " const titles = arguments[0].split('|'), dates = arguments[1].split('|');"
                    + " const got = rows.map(r => r.title + ' [' + r.meta.split(' ' + String.fromCharCode(183) + ' ')[0] + ']');"
                    + " const want = titles.map((t, i) => t + ' [' + dates[i] + ']');"
                    + " return got.join(' / ') === want.join(' / ') ? 'same' : 'got: ' + got.join(' / ') + '  wanted: ' + want.join(' / ');",
                    String.join("|", titles), String.join("|", dates));
            if (! "same".equals(compared))
                throw new AssertionError("The search should list what is to come first, soonest at the top, then what has been,"
                        + " latest first, undated tasks last, each date with its year unless it is this year's - " + compared);
            System.out.println("  ok   to come first, soonest at the top, then the past, latest first, undated tasks last;"
                    + " years named where they aren't this one: " + String.join(", ", dates));

            // --- a list cut at twenty says what it left out --------------------------------------
            search(d, "Review");
            try {
                CalendarApp.waitInFrame(d, "twenty reviews and a note of the two left out",
                        "document.querySelectorAll('#search-results .search-result-item').length === 20"
                                + " && [...document.querySelectorAll('#search-results .search-empty')]"
                                + "    .some(n => n.textContent === '2 more not shown. Keep typing to narrow the search.')", 60_000);
            } catch (IllegalStateException e) {
                throw new AssertionError("With 22 matches the list should show 20 and say 2 more are not shown: "
                        + CalendarApp.inFrame(d, "return document.getElementById('search-results').innerText.replace(/\\s+/g, ' ').slice(-200)"));
            }
            System.out.println("  ok   with 22 matches, 20 are listed and the list says 2 more are not shown");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static final String LIST_BODY = "{rows: [...document.querySelectorAll('#search-results .search-result-item')].map(b => ({"
            + " title: b.querySelector('.search-result-title').textContent, meta: b.querySelector('.search-result-meta').textContent})),"
            + " swept: ! document.getElementById('search-results').textContent.includes('Still looking')}";
    static final String LIST = "return " + LIST_BODY + ";";

    static void search(WebDriver d, String query) {
        CalendarApp.inFrame(d, "const i = document.getElementById('search-input'); i.focus(); i.value = arguments[0];"
                + " i.dispatchEvent(new Event('input', {bubbles: true})); return 1;", query);
    }
}
