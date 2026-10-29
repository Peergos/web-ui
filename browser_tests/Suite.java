import java.nio.file.*;
import java.util.*;

/** Runs the browser tests against one engine, sharing a single server across them.
 *
 *  Usage: java -cp ../server/Peergos.jar Suite.java [firefox|chromium|webkit]
 */
public class Suite {

    public static void main(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();

        List<String> failures = new ArrayList<>();
        String serverLog = null;
        try (Server server = Server.start(serverDir)) {
            System.out.println("server at " + server.url() + ", engine " + engine);
            String[] args1 = {engine, server.url()};
            run(failures, "smoke", () -> SmokeTest.main(new String[]{engine, server.url() + "/"}));
            // Before anything uploads: if the browser's BLAKE3 disagreed with the Java one,
            // every later hash in the run is built on it, and the failure to look at is this.
            run(failures, "browser and java blake3 agree", () -> Blake3AgreementTest.run(args1));
            // Before the links: the first of them puts the admin's own first two folders in a link,
            // and the one it makes writable is recommended-apps, Custom Apps' page. From then on that
            // no longer resolves as a public file, so Custom Apps can't be opened for the rest of the run.
            run(failures, "Custom Apps, told Peergos' theme in its address", () -> CustomAppsThemeTest.run(args1));
            run(failures, "a secret link over several items", () -> MultiLinkCheck.run(args1));
            run(failures, "a secret link that can no longer be opened", () -> SecretLinkUnavailableTest.run(args1));
            run(failures, "every secret link at once, and adding to one", () -> LinksOverviewCheck.run(args1));
            run(failures, "the secret link editor", () -> LinkEditorCheck.run(args1));
            run(failures, "the interface in another language", () -> LanguageTest.run(args1));
            run(failures, "sign-in fields a saved login filled keep their colour", () -> LoginAutofillTest.run(args1));
            run(failures, "the way in: checkboxes show their tick while focused, and fields copy and paste", () -> AuthFormsTest.run(args1));
            run(failures, "the page reconnects by itself once the server is reachable", () -> NetworkRetryTest.run(args1));
            run(failures, "upload file", () -> UploadTest.run(args1));
            run(failures, "upload a group of files", () -> UploadGroupTest.run(args1));
            run(failures, "upload folder", () -> UploadFolderTest.run(args1));
            run(failures, "render a pdf in the pdf app", () -> PdfRenderTest.run(args1));
            run(failures, "follow markdown links", () -> MarkdownLinksTest.run(args1));
            run(failures, "html viewer links and images", () -> HtmlViewerTest.run(args1));
            run(failures, "paging through a big file in the hex viewer", () -> HexViewerTest.run(args1));
            run(failures, "cancel an upload", () -> CancelUploadTest.run(args1));
            // The one thing a phone does differently: its panel must not decide how the next
            // desktop session opens. Cheap, and no engine here is too wide to be a phone.
            run(failures, "the drive on a phone", () -> MobileNavTest.run(args1));
            run(failures, "the news feed and what it does", () -> NewsFeedViewTest.run(args1));
            run(failures, "a shared calendar entry as a feed tile", () -> FeedTileTest.run(args1));
            run(failures, "a shared file as a tile drawn by an installed app", () -> FeedAppTileTest.run(args1));
            // Picking files out of the grid, which a pointer and a touch screen reach in
            // different ways and which the file menu must not be mistaken for.
            run(failures, "picking files in the grid", () -> GridSelectionTest.run(args1));
            run(failures, "a folder cut with the selection bar can't be pasted into itself", () -> CutIntoItselfTest.run(args1));
            // Sorting is shared state drawn by two views: the header's menu sets it, the
            // table's headings set it, and both views must follow whichever did.
            run(failures, "sorting a listing from either view", () -> GridSortTest.run(args1));
            run(failures, "a file's menu in the last row opens without moving the page", () -> DriveMenuScrollTest.run(args1));
            run(failures, "a long path trail opens out", () -> PathExpandTest.run(args1));
            run(failures, "what the mount page shows once mounted", () -> MountCardTest.run(args1));
            run(failures, "what the mount page says about syncing into a phone's own apps", () -> MountDeviceTest.run(args1));
            run(failures, "the launcher's apps and shortcuts", () -> LauncherViewTest.run(args1));
            run(failures, "an app left open by a view change answers nothing once reopened", () -> AppLeftOpenTest.run(args1));
            run(failures, "signing in with no apps installed yet", () -> NoAppsYetTest.run(args1));
            run(failures, "an app installed straight from a zip", () -> AppFromZipTest.run(args1));
            run(failures, "an app reaches only its own chats", () -> AppChatIsolationTest.run(args1));
            run(failures, "choosing between two apps for a file, and always using one", () -> AppChoiceTest.run(args1));
            run(failures, "an app's folder grants: details, rename, move and a suggested folder", () -> AppFolderGrantTest.run(args1));
            run(failures, "a folder app can't read a sibling whose name starts the same", () -> FolderAppSiblingTest.run(args1));
            run(failures, "Address Book, in the navigation on its own subdomain", () -> AddressBookTest.run(args1));
            run(failures, "Address Book keeps contacts where they belong when Peergos is slow", () -> AddressBookSafetyTest.run(args1));
            run(failures, "Address Book reads and writes vCards as other apps write them", () -> AddressBookFormatsTest.run(args1));
            run(failures, "Address Book installed from Custom Apps, after it came with Peergos", () -> AddressBookTransitionTest.run(args1));
            run(failures, "the contacts api an app with MANAGE_CONTACTS gets", () -> ContactsApiTest.run(args1));
            run(failures, "an admin inviting new users", () -> AdminInviteTest.run(args1));
            run(failures, "inviting new users on a paid instance", () -> AdminInvitePaidTest.run(args1));

            // Neither WebKitWebDriver nor safaridriver can be told where downloads go, so
            // everything that asserts on a downloaded file runs on the engines that can. WebKit
            // download coverage belongs with the gtk host, which sets the destination itself.
            // The two downloads that predate the calendar keep their place near the start of
            // the run: they are timing-sensitive on the slower runners, and the calendar tests
            // are minutes of extra load on the shared server that they should not run behind.
            boolean canPlaceDownloads = ! engine.startsWith("webkit") && ! engine.equals("safari");
            if (canPlaceDownloads) {
                run(failures, "concurrent downloads", () -> ConcurrentDownloadTest.run(args1));
                run(failures, "download folder as zip", () -> ZipFolderDownloadTest.run(args1));
                run(failures, "a download with no service worker to stream it", () -> DownloadWithoutServiceWorkerTest.run(args1));
            }

            run(failures, "calendar event round trip", () -> CalendarEventTest.run(args1));
            run(failures, "calendar repeat and reminder", () -> CalendarRepeatTest.run(args1));
            run(failures, "a series cut short keeps the parts of its rule the form can't show", () -> CalendarShortenedRuleTest.run(args1));
            run(failures, "calendar task", () -> CalendarTaskTest.run(args1));
            run(failures, "a link to a calendar entry opens it", () -> CalendarEntryLinkTest.run(args1));
            run(failures, "calendar sharing stays with the host", () -> CalendarSharingTest.run(args1));
            run(failures, "a series cut by this-and-following ends after the occurrences it had left", () -> CalendarFollowingCountTest.run(args1));
            run(failures, "custom sharing groups", () -> CustomGroupsTest.run(args1));
            run(failures, "the social view and what it does", () -> SocialViewTest.run(args1));
            run(failures, "a failed read of the calendar list keeps the calendars", () -> CalendarListReadFailureTest.run(args1));
            run(failures, "a blocked user's comment is hidden in the feed", () -> NewsFeedBlockTest.run(args1));
            run(failures, "hidden files aren't listed in the drive", () -> HiddenFilesTest.run(args1));
            run(failures, "a delete that fails part way leaves the drive usable", () -> DeleteSpinnerTest.run(args1));
            run(failures, "a copy over the quota is refused and leaves the drive usable", () -> CopyOverQuotaTest.run(args1));
            run(failures, "a drag that lands nowhere leaves what was cut to paste", () -> DragThenPasteTest.run(args1));
            run(failures, "change password with an authenticator app", () -> ChangePasswordMfaTest.run(args1));
            run(failures, "friends again after blocking and unblocking", () -> BlockRefriendTest.run(args1));
            run(failures, "an entry renamed keeps the alarms the dialog does not show", () -> CalendarOtherAlarmsTest.run(args1));
            run(failures, "calendar repeat shapes", () -> CalendarRecurrenceTest.run(args1));
            run(failures, "calendar series edits", () -> CalendarSeriesTest.run(args1));
            run(failures, "a series moved to start in another month keeps its file", () -> CalendarSeriesMoveTest.run(args1));
            run(failures, "calendar series with listed dates", () -> CalendarAddedDatesTest.run(args1));
            run(failures, "calendar to and from the previous app", () -> CalendarLegacyTest.run(args1));
            run(failures, "calendar files read by another parser", () -> CalendarInteropTest.run(args1));
            run(failures, "a series stays as long as the clock says across a clock change", () -> CalendarClockChangeTest.run(args1));
            run(failures, "calendar drag to move", () -> CalendarDragTest.run(args1));
            run(failures, "calendar shared read-only", () -> CalendarReadOnlyTest.run(args1));
            run(failures, "calendar writable link", () -> CalendarLinkWriteTest.run(args1));
            // Two accounts, a friendship and four sign-ins: minutes rather than seconds, and
            // the slow runners already spend most of their hour on the rest of this. WebKit
            // is left out for a different reason - it cannot be relied on here to bring the
            // calendar up for an account opening it for the first time, which is the driver
            // rather than the app, and the same reason downloads skip it. Every other engine
            // runs it, which is where most of the matrix is.
            if (canPlaceDownloads && ! "1".equals(System.getenv("PEERGOS_TEST_SLOW"))) {
                run(failures, "calendar entries shared between accounts", () -> CalendarLiveShareTest.run(args1));
                // A whole calendar rather than one entry, and the one people actually share:
                // the calendar their account came with, which the recipient has a namesake of.
                run(failures, "whole calendar shared between accounts", () -> CalendarWholeShareTest.run(args1));
                // Leaving has to be as complete as arriving: this one exports a calendar,
                // imports it into an account that has never seen it, and exports that.
                run(failures, "calendar moved to another account", () -> CalendarMigrationTest.run(args1));
                // Four downloads of a 200MiB file, each left 30s to show it stopped.
                run(failures, "cancel downloads", () -> CancelDownloadTest.run(args1));
            }
            run(failures, "calendar store safety", () -> CalendarStoreTest.run(args1));
            run(failures, "an entry with a DURATION is as long as it says", () -> CalendarDurationReadTest.run(args1));
            // An account of its own, so not on WebKit, which cannot be relied on to bring the
            // calendar up for an account opening it for the first time (see above).
            if (! engine.startsWith("webkit"))
                run(failures, "emptying the first calendar", () -> CalendarEmptyTest.run(args1));
            if (canPlaceDownloads) {
                run(failures, "download calendar event", () -> CalendarEventDownloadTest.run(args1));
                run(failures, "a selection with an empty file in it downloads to the end", () -> EmptyFileDownloadTest.run(args1));
                // The export half of this one downloads a file, so it belongs with the group
                // that can say where downloads land.
                run(failures, "calendar import and export", () -> CalendarImportExportTest.run(args1));
            } else {
                System.out.println("\nSKIP the download tests on " + engine
                        + ": its driver has no download directory capability");
            }
            // Beside the import above, but without a download, so Safari runs it too. An account
            // of its own, so not on WebKit, which cannot be relied on to bring the calendar up for
            // an account opening it for the first time (see above).
            if (! engine.startsWith("webkit"))
                run(failures, "the question an .ics import asks", () -> CalendarImportDialogTest.run(args1));
            if (! engine.startsWith("webkit"))
                run(failures, "an import's dates, duplicates, new calendar and Cancel", () -> CalendarImportMoreTest.run(args1));
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

    private static void run(List<String> failures, String name, Test test) {
        System.out.println("\n--- " + name);
        long start = System.currentTimeMillis();
        java.io.PrintStream out = System.out;
        java.io.ByteArrayOutputStream seen = new java.io.ByteArrayOutputStream();
        System.setOut(new java.io.PrintStream(new java.io.OutputStream() {
            public void write(int b) { out.write(b); seen.write(b); }
            public void write(byte[] b, int off, int len) { out.write(b, off, len); seen.write(b, off, len); }
            public void flush() { out.flush(); }
        }, true));
        try {
            test.run();
            System.out.println("--- " + name + " passed in " + (System.currentTimeMillis() - start) / 1000 + "s");
        } catch (Throwable t) {
            String printed = seen.toString();
            System.out.println("--- " + name + " FAILED: " + t);
            t.printStackTrace(System.out);
            failures.add(name);
            annotate(name, t, printed);
        } finally {
            System.setOut(out);
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
