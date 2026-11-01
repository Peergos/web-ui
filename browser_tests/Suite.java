import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.io.*;

/** Runs the browser tests against one engine, sharing a single server across them.
 *
 *  Usage: java -cp ../server/Peergos.jar Suite.java [firefox|chromium|webkit]
 */
public class Suite {

    public static void main(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();

        List<String> failures = Collections.synchronizedList(new ArrayList<>());
        String serverLog = null;
        try (Server server = Server.start(serverDir, 1000)) {
            System.out.println("server at " + server.url() + ", engine " + engine);
            String[] args1 = {engine, server.url()};
            serial("smoke", () -> SmokeTest.main(new String[]{engine, server.url() + "/"}));
            // Before anything uploads: if the browser's BLAKE3 disagreed with the Java one,
            // every later hash in the run is built on it, and the failure to look at is this.
            t("browser and java blake3 agree", () -> Blake3AgreementTest.run(args1));
            // Before the links: the first of them puts the admin's own first two folders in a link,
            // and the one it makes writable is recommended-apps, Custom Apps' page. From then on that
            // no longer resolves as a public file, so Custom Apps can't be opened for the rest of the run.
            t("Custom Apps, told Peergos' theme in its address", () -> CustomAppsThemeTest.run(args1));
            t("a secret link over several items", () -> MultiLinkCheck.run(args1));
            t("a secret link that can no longer be opened", () -> SecretLinkUnavailableTest.run(args1));
            t("every secret link at once, and adding to one", () -> LinksOverviewCheck.run(args1));
            t("the secret link editor", () -> LinkEditorCheck.run(args1));
            t("the interface in another language", () -> LanguageTest.run(args1));
            t("sign-in fields a saved login filled keep their colour", () -> LoginAutofillTest.run(args1));
            t("the way in: checkboxes show their tick while focused, and fields copy and paste", () -> AuthFormsTest.run(args1));
            t("the page reconnects by itself once the server is reachable", () -> NetworkRetryTest.run(args1));
            t("upload file", () -> UploadTest.run(args1));
            t("upload a group of files", () -> UploadGroupTest.run(args1));
            t("upload folder", () -> UploadFolderTest.run(args1));
            t("render a pdf in the pdf app", () -> PdfRenderTest.run(args1));
            t("follow markdown links", () -> MarkdownLinksTest.run(args1));
            t("html viewer links and images", () -> HtmlViewerTest.run(args1));
            t("paging through a big file in the hex viewer", () -> HexViewerTest.run(args1));
            t("cancel an upload", () -> CancelUploadTest.run(args1));
            // The one thing a phone does differently: its panel must not decide how the next
            // desktop session opens. Cheap, and no engine here is too wide to be a phone.
            t("the drive on a phone", () -> MobileNavTest.run(args1));
            t("the news feed and what it does", () -> NewsFeedViewTest.run(args1));
            t("a shared calendar entry as a feed tile", () -> FeedTileTest.run(args1));
            t("a shared file as a tile drawn by an installed app", () -> FeedAppTileTest.run(args1));
            // Picking files out of the grid, which a pointer and a touch screen reach in
            // different ways and which the file menu must not be mistaken for.
            t("picking files in the grid", () -> GridSelectionTest.run(args1));
            t("a folder cut with the selection bar can't be pasted into itself", () -> CutIntoItselfTest.run(args1));
            // Sorting is shared state drawn by two views: the header's menu sets it, the
            // table's headings set it, and both views must follow whichever did.
            t("sorting a listing from either view", () -> GridSortTest.run(args1));
            t("a file's menu in the last row opens without moving the page", () -> DriveMenuScrollTest.run(args1));
            t("a long path trail opens out", () -> PathExpandTest.run(args1));
            t("what the mount page shows once mounted", () -> MountCardTest.run(args1));
            t("what the mount page says about syncing into a phone's own apps", () -> MountDeviceTest.run(args1));
            t("the launcher's apps and shortcuts", () -> LauncherViewTest.run(args1));
            t("an app left open by a view change answers nothing once reopened", () -> AppLeftOpenTest.run(args1));
            t("signing in with no apps installed yet", () -> NoAppsYetTest.run(args1));
            t("an app installed straight from a zip", () -> AppFromZipTest.run(args1));
            t("an app reaches only its own chats", () -> AppChatIsolationTest.run(args1));
            t("choosing between two apps for a file, and always using one", () -> AppChoiceTest.run(args1));
            t("an app's folder grants: details, rename, move and a suggested folder", () -> AppFolderGrantTest.run(args1));
            t("a folder app can't read a sibling whose name starts the same", () -> FolderAppSiblingTest.run(args1));
            t("Address Book, in the navigation on its own subdomain", () -> AddressBookTest.run(args1));
            t("Address Book keeps contacts where they belong when Peergos is slow", () -> AddressBookSafetyTest.run(args1));
            t("Address Book reads and writes vCards as other apps write them", () -> AddressBookFormatsTest.run(args1));
            t("Address Book installed from Custom Apps, after it came with Peergos", () -> AddressBookTransitionTest.run(args1));
            t("the contacts api an app with MANAGE_CONTACTS gets", () -> ContactsApiTest.run(args1));
            t("an admin inviting new users", () -> AdminInviteTest.run(args1));
            t("inviting new users on a paid instance", () -> AdminInvitePaidTest.run(args1));

            // Neither WebKitWebDriver nor safaridriver can be told where downloads go, so
            // everything that asserts on a downloaded file runs on the engines that can. WebKit
            // download coverage belongs with the gtk host, which sets the destination itself.
            // The two downloads that predate the calendar keep their place near the start of
            // the run: they are timing-sensitive on the slower runners, and the calendar tests
            // are minutes of extra load on the shared server that they should not run behind.
            boolean canPlaceDownloads = ! engine.startsWith("webkit") && ! engine.equals("safari");
            if (canPlaceDownloads) {
                t("concurrent downloads", () -> ConcurrentDownloadTest.run(args1));
                t("download folder as zip", () -> ZipFolderDownloadTest.run(args1));
                t("a download with no service worker to stream it", () -> DownloadWithoutServiceWorkerTest.run(args1));
            }

            t("calendar event round trip", () -> CalendarEventTest.run(args1));
            t("calendar repeat and reminder", () -> CalendarRepeatTest.run(args1));
            t("a series cut short keeps the parts of its rule the form can't show", () -> CalendarShortenedRuleTest.run(args1));
            t("calendar task", () -> CalendarTaskTest.run(args1));
            t("a link to a calendar entry opens it", () -> CalendarEntryLinkTest.run(args1));
            t("calendar sharing stays with the host", () -> CalendarSharingTest.run(args1));
            t("a series cut by this-and-following ends after the occurrences it had left", () -> CalendarFollowingCountTest.run(args1));
            t("custom sharing groups", () -> CustomGroupsTest.run(args1));
            t("the social view and what it does", () -> SocialViewTest.run(args1));
            t("a failed read of the calendar list keeps the calendars", () -> CalendarListReadFailureTest.run(args1));
            t("the deleted dates of a series move with it", () -> CalendarMovedSeriesDatesTest.run(args1));
            t("a series split from an occurrence takes its later dates", () -> CalendarFollowingDatesTest.run(args1));
            t("a blocked user's comment is hidden in the feed", () -> NewsFeedBlockTest.run(args1));
            t("hidden files aren't listed in the drive", () -> HiddenFilesTest.run(args1));
            t("a delete that fails part way leaves the drive usable", () -> DeleteSpinnerTest.run(args1));
            t("a copy over the quota is refused and leaves the drive usable", () -> CopyOverQuotaTest.run(args1));
            t("a drag that lands nowhere leaves what was cut to paste", () -> DragThenPasteTest.run(args1));
            t("change password with an authenticator app", () -> ChangePasswordMfaTest.run(args1));
            t("friends again after blocking and unblocking", () -> BlockRefriendTest.run(args1));
            t("an entry renamed keeps the alarms the dialog does not show", () -> CalendarOtherAlarmsTest.run(args1));
            t("calendar repeat shapes", () -> CalendarRecurrenceTest.run(args1));
            t("calendar series edits", () -> CalendarSeriesTest.run(args1));
            t("a series moved to start in another month keeps its file", () -> CalendarSeriesMoveTest.run(args1));
            t("calendar series with listed dates", () -> CalendarAddedDatesTest.run(args1));
            t("calendar to and from the previous app", () -> CalendarLegacyTest.run(args1));
            t("calendar files read by another parser", () -> CalendarInteropTest.run(args1));
            t("a series stays as long as the clock says across a clock change", () -> CalendarClockChangeTest.run(args1));
            t("a series turned timed from a day the clocks skip midnight keeps its deleted dates", () -> CalendarMidnightClockChangeTest.run(args1));
            t("calendar drag to move", () -> CalendarDragTest.run(args1));
            t("calendar shared read-only", () -> CalendarReadOnlyTest.run(args1));
            t("calendar writable link", () -> CalendarLinkWriteTest.run(args1));
            // Two accounts, a friendship and four sign-ins: minutes rather than seconds, and
            // the slow runners already spend most of their hour on the rest of this. WebKit
            // is left out for a different reason - it cannot be relied on here to bring the
            // calendar up for an account opening it for the first time, which is the driver
            // rather than the app, and the same reason downloads skip it. Every other engine
            // runs it, which is where most of the matrix is.
            if (canPlaceDownloads && ! "1".equals(System.getenv("PEERGOS_TEST_SLOW"))) {
                t("calendar entries shared between accounts", () -> CalendarLiveShareTest.run(args1));
                // A whole calendar rather than one entry, and the one people actually share:
                // the calendar their account came with, which the recipient has a namesake of.
                t("whole calendar shared between accounts", () -> CalendarWholeShareTest.run(args1));
                // Leaving has to be as complete as arriving: this one exports a calendar,
                // imports it into an account that has never seen it, and exports that.
                t("calendar moved to another account", () -> CalendarMigrationTest.run(args1));
                // Four downloads of a 200MiB file, each left 30s to show it stopped.
                t("cancel downloads", () -> CancelDownloadTest.run(args1));
            }
            t("calendar store safety", () -> CalendarStoreTest.run(args1));
            t("an entry with a DURATION is as long as it says", () -> CalendarDurationReadTest.run(args1));
            // An account of its own, so not on WebKit, which cannot be relied on to bring the
            // calendar up for an account opening it for the first time (see above).
            if (! engine.startsWith("webkit"))
                t("emptying the first calendar", () -> CalendarEmptyTest.run(args1));
            if (canPlaceDownloads) {
                t("download calendar event", () -> CalendarEventDownloadTest.run(args1));
                t("a selection with an empty file in it downloads to the end", () -> EmptyFileDownloadTest.run(args1));
                // The export half of this one downloads a file, so it belongs with the group
                // that can say where downloads land.
                t("calendar import and export", () -> CalendarImportExportTest.run(args1));
            } else {
                System.out.println("\nSKIP the download tests on " + engine
                        + ": its driver has no download directory capability");
            }
            // Beside the import above, but without a download, so Safari runs it too. An account
            // of its own, so not on WebKit, which cannot be relied on to bring the calendar up for
            // an account opening it for the first time (see above).
            if (! engine.startsWith("webkit"))
                t("the question an .ics import asks", () -> CalendarImportDialogTest.run(args1));
            if (! engine.startsWith("webkit"))
                t("an import's dates, duplicates, new calendar and Cancel", () -> CalendarImportMoreTest.run(args1));
            runAll(failures, engine);
            if (! failures.isEmpty())
                serverLog = server.tailLog(120);
        }

        System.out.println();
        if (! failures.isEmpty() && serverLog != null) {
            System.out.println("--- the end of the server's log");
            System.out.println(serverLog);
            System.out.println("--- end of server log");
            System.out.println();
        }
        if (failures.isEmpty()) {
            System.out.println("all tests passed on " + engine);
            // Explicitly, as on failure: peergos' retry executors keep a non-daemon thread once
            // a java-side client has used one, and that alone holds the job open until timeout.
            System.exit(0);
        } else {
            System.out.println(failures.size() + " failed on " + engine + ": " + failures);
            System.exit(1);
        }
    }

    private interface Test {
        void run() throws Exception;
    }

    private record Case(String name, Test test, boolean serial) {}

    private static final List<Case> cases = new ArrayList<>();

    private static void t(String name, Test test) {
        cases.add(new Case(name, test, false));
    }

    /** A test that must have the server to itself. */
    private static void serial(String name, Test test) {
        cases.add(new Case(name, test, true));
    }

    /** The tests run on as many threads as PEERGOS_TEST_WORKERS says, one browser and one account
     *  each against the one server; the serial ones first, alone. With one worker everything runs
     *  as it did, in order, printing as it goes. With more, a test's output is held back and
     *  printed in one block when it ends, so the log still reads test by test. */
    private static void runAll(List<String> failures, String engine) throws InterruptedException {
        // safaridriver drives the one Safari, which pairs with one session at a time
        int workers = engine.equals("safari") ? 1
                : Math.max(1, Integer.parseInt(System.getenv().getOrDefault("PEERGOS_TEST_WORKERS", "1")));
        for (Case c : cases)
            if (c.serial())
                run(failures, c.name(), c.test(), false);
        List<Case> pooled = cases.stream().filter(c -> ! c.serial()).toList();
        if (workers == 1) {
            for (Case c : pooled)
                run(failures, c.name(), c.test(), false);
            return;
        }
        System.out.println("\n" + pooled.size() + " tests on " + workers + " workers");
        ExecutorService pool = Executors.newFixedThreadPool(workers);
        for (Case c : pooled)
            pool.submit(() -> run(failures, c.name(), c.test(), true));
        pool.shutdown();
        pool.awaitTermination(6, TimeUnit.HOURS);
    }

    private static String clock() {
        return java.time.LocalTime.now().withNano(0).toString();
    }

    private static final PrintStream REAL_OUT = System.out;
    /** The buffer of the test running on this thread, when its output is held back. */
    private static final ThreadLocal<ByteArrayOutputStream> HELD = new ThreadLocal<>();
    /** What the test on this thread printed, held back or not, for the annotation. */
    private static final ThreadLocal<ByteArrayOutputStream> SEEN = new ThreadLocal<>();
    static {
        System.setOut(new PrintStream(new OutputStream() {
            public void write(int b) { write(new byte[] {(byte) b}, 0, 1); }
            public void write(byte[] b, int off, int len) {
                ByteArrayOutputStream seen = SEEN.get();
                if (seen != null)
                    seen.write(b, off, len);
                ByteArrayOutputStream held = HELD.get();
                if (held != null)
                    held.write(b, off, len);
                else
                    REAL_OUT.write(b, off, len);
            }
            public void flush() { REAL_OUT.flush(); }
        }, true));
    }

    private static void run(List<String> failures, String name, Test test, boolean hold) {
        ByteArrayOutputStream seen = new ByteArrayOutputStream();
        ByteArrayOutputStream held = hold ? new ByteArrayOutputStream() : null;
        SEEN.set(seen);
        HELD.set(held);
        long start = System.currentTimeMillis();
        try {
            System.out.println("\n--- " + name + (hold ? " (started " + clock() + ")" : ""));
            test.run();
            System.out.println("--- " + name + " passed in " + (System.currentTimeMillis() - start) / 1000 + "s"
                    + (hold ? " at " + clock() : ""));
        } catch (Throwable t) {
            System.out.println("--- " + name + " FAILED: " + t);
            t.printStackTrace(System.out);
            failures.add(name);
            annotate(name, t, seen.toString());
        } finally {
            SEEN.remove();
            HELD.remove();
            if (held != null) {
                synchronized (REAL_OUT) {
                    REAL_OUT.write(held.toByteArray(), 0, held.size());
                    REAL_OUT.flush();
                }
            }
        }
    }

    /** On GitHub Actions, a failure also becomes an annotation: those can be read through the API
     *  without signing in, where the job's log cannot. It carries what the test itself printed,
     *  without the server's and the java client's log lines. */
    private static void annotate(String name, Throwable t, String printed) {
        if (! "true".equals(System.getenv("GITHUB_ACTIONS")))
            return;
        List<String> lines = new ArrayList<>();
        for (String line : printed.split("\n")) {
            String l = line.stripTrailing();
            if (l.isEmpty() || l.startsWith("INFO: ") || l.startsWith("WARNING: ") || l.startsWith("\tat ")
                    || l.matches("^[A-Z][a-z]{2} \\d{2}, \\d{4} .*"))
                continue;
            lines.add(l);
        }
        List<String> tail = lines.subList(Math.max(0, lines.size() - 40), lines.size());
        String body = t + "\n" + String.join("\n", tail);
        if (body.length() > 3500)
            body = body.substring(body.length() - 3500);
        String escaped = body.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A");
        String title = name.replace("%", "%25").replace(",", "%2C").replace(":", "%3A");
        System.out.println("::error title=" + title + "::" + escaped);
    }
}
