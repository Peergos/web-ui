import java.nio.file.*;

/** What the mount page shows once it is mounted, for each kind of backend.
 *
 *  Where calendars and contacts are reached through a CalDAV or CardDAV client (desktop) the page
 *  shows the address to give it. Android syncs them into the phone's own Calendar and Contacts
 *  apps instead, so there is no address - and a calendar or contacts only mount there was a card
 *  holding nothing but a "Mounted" pill, under a note about downloaded files it never had. Now one
 *  note, worded for the case, says where calendars and contacts go and what happens to downloaded
 *  files, and a card that would hold nothing is left out.
 *
 *  The page's state comes from the app it runs in, so each case is set on the view itself and
 *  what it renders is read back.
 *
 *  Usage: java -cp ../server/Peergos.jar MountCardTest.java [engine] [url]
 */
public class MountCardTest {

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-mountcard-"), headless)) {
            d.setWindowRect(390, 844);
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoView(d, "Mount", "onAddMount", "__mount");
            WebDriver.sleep(1500);

            // Android: calendars and contacts go to the phone's own apps. The note says which, and there
            // is no card, which would hold nothing but its status
            String[][] platform = {
                {"syncCalendar: true, syncContacts: true", "Your calendars and contacts appear in this device's Calendar and Contacts apps, and tasks stay in the Peergos calendar."},
                {"syncCalendar: true, syncContacts: false", "Your calendars appear in this device's Calendar app, and tasks stay in the Peergos calendar."},
                {"syncCalendar: false, syncContacts: true", "Your contacts appear in this device's Contacts app."}};
            for (String[] c : platform) {
                String shown = card(d, "{enabled: true, mountPoint: '', mountDrive: false, " + c[0] + ", davClients: false}");
                expect(shown, "[card]", false, "Android with " + c[0]);
                expect(shown, "[notes 1]", true, "Android with " + c[0]);
                expect(shown, c[1], true, "Android with " + c[0]);
                expect(shown, "Any files downloaded", false, "Android with " + c[0]);
            }
            System.out.println("  ok   Android calendars or contacts: one note says where they go, and no empty card");

            // something to report brings the card back, its status where it is beside a drive
            d.script("window.__mount.error = 'test error'; return 1;");
            WebDriver.sleep(400);
            String withError = card(d, "{}");
            expect(withError, "[card]", true, "an error on Android");
            expect(withError, "test error", true, "an error on Android");
            String alone = pillOffset(d);
            if (! "0".equals(alone))
                throw new AssertionError("On its own the Mounted status should sit at the card's end, as it does beside a drive, but it is " + alone + "px short");
            d.script("window.__mount.error = null; return 1;");
            System.out.println("  ok   an error brings the card back, its Mounted status at the end as beside a drive");

            // Android drive, alone or with calendars and contacts: the endpoints, and one note for all of it
            String[][] drives = {
                {"syncCalendar: false, syncContacts: false", "Any files downloaded will remain in the local folder after unmount."},
                {"syncCalendar: true, syncContacts: true", "Your calendars and contacts appear in this device's Calendar and Contacts apps, and tasks stay in the Peergos calendar. Any files downloaded will remain in the local folder after unmount."},
                {"syncCalendar: true, syncContacts: false", "Your calendars appear in this device's Calendar app, and tasks stay in the Peergos calendar. Any files downloaded will remain in the local folder after unmount."},
                {"syncCalendar: false, syncContacts: true", "Your contacts appear in this device's Contacts app. Any files downloaded will remain in the local folder after unmount."}};
            for (String[] c : drives) {
                String drive = card(d, "{enabled: true, mountPoint: 'Files app', mountDrive: true, " + c[0] + ", davClients: false, peergosUsername: 'peergos'}");
                expect(drive, "[card]", true, "a drive on Android with " + c[0]);
                expect(drive, "Files app", true, "a drive on Android with " + c[0]);
                expect(drive, "[notes 1]", true, "a drive on Android with " + c[0]);
                expect(drive, c[1], true, "a drive on Android with " + c[0]);
                if (! "0".equals(pillOffset(d)))
                    throw new AssertionError("Beside a drive the Mounted status should sit at the card's end, but it is " + pillOffset(d) + "px short");
            }
            System.out.println("  ok   Android drive: the Files app endpoint, and one note covering the drive and what else syncs");

            // desktop: the address to give a calendar app, and no files note without a drive
            String desktop = card(d, "{enabled: true, mountPoint: '', mountDrive: false, syncCalendar: true, syncContacts: false, davClients: true, davUrl: 'http://localhost:1/dav'}");
            expect(desktop, "[card]", true, "calendars on desktop");
            expect(desktop, "[dav]", true, "calendars on desktop");
            expect(desktop, "[notes 0]", true, "calendars on desktop");
            System.out.println("  ok   desktop calendars: the CalDAV address in the card");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** Sets the view's config and returns what the mounted section shows, with [dav] when the address block is up. */
    private static String card(WebDriver d, String config) {
        d.script("const v = window.__mount; v.config = Object.assign({}, v.config, " + config + "); return 1;");
        WebDriver.sleep(500);
        return String.valueOf(d.script("const v = window.__mount; if (! v.isMounted) return 'not mounted';"
                + " const main = v.$el.querySelector('main');"
                + " const notes = [...main.children].filter(e => e.classList.contains('pg-note')).length;"
                + " return (main.querySelector('.pg-cards .pg-card') ? '[card] ' : '') + (main.querySelector('.mount-dav') ? '[dav] ' : '') + '[notes ' + notes + '] ' + main.innerText.replace(/\\n+/g, ' | ');"));
    }

    /** how far the Mounted status stops short of the end of its row, in whole pixels */
    private static String pillOffset(WebDriver d) {
        return String.valueOf(d.script("const h = window.__mount.$el.querySelector('.pg-card__head'); const p = h.querySelector('.pg-pill');"
                + " return String(Math.round(h.getBoundingClientRect().right - p.getBoundingClientRect().right));"));
    }

    private static void expect(String shown, String text, boolean present, String where) {
        if (shown.contains(text) != present)
            throw new AssertionError("For " + where + " the page should " + (present ? "" : "not ") + "show \"" + text + "\": " + shown);
    }
}
