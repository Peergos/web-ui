import java.nio.file.*;

/** What the mount page says about syncing calendars and contacts into a phone's own apps.
 *
 *  On Android there is no CalDAV or CardDAV client to point at Peergos: the switches put the
 *  calendars and contacts in the phone's own Calendar and Contacts apps, under a Peergos account of
 *  their own. The page says, before anything syncs, that only that account syncs - the phone's own
 *  calendars and contacts, on the device or in another account, are left alone - and what syncing
 *  does: both ways, conflicts, where new contacts go, tasks, unmounting. Once mounted, the same
 *  stays in view above "How syncing works". A desktop, with clients to point at Peergos, shows
 *  none of it, and its calendar switch still says calendars and tasks.
 *
 *  The page's state comes from the app it runs in, so each case is set on the view itself and
 *  what it renders is read back.
 *
 *  Usage: java -cp ../server/Peergos.jar MountDeviceTest.java [engine] [url]
 */
public class MountDeviceTest {

    static final String POINTS = "[...document.querySelectorAll('.mount-device__more li')].map(l => l.textContent.trim()).join(' / ')";

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-mountdevice-"), headless)) {
            d.setWindowRect(1280, 900);
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoView(d, "Mount", "onAddMount", "__mount");
            WebDriver.sleep(1500);

            // a desktop: clients to point at Peergos, so none of this shows
            d.script("Object.assign(window.__mount.config, {enabled: false, davClients: true, canSyncCalendar: true, canSyncContacts: true}); return 1;");
            WebDriver.sleep(300);
            if (Boolean.TRUE.equals(d.script("return !!document.querySelector('.mount-device')")))
                throw new AssertionError("A desktop should show nothing about syncing into the device's own apps");
            // and keeps its calendar switch, which a CalDAV client does get tasks through
            String desktop = String.valueOf(d.script("return [...document.querySelectorAll('.mount-setup .pg-switch span:last-child')].map(s => s.textContent.trim()).join(' | ')"));
            if (! desktop.contains("Sync your calendars and tasks"))
                throw new AssertionError("A desktop's calendar switch should still say calendars and tasks: " + desktop);
            System.out.println("  ok   a desktop shows none of it, and keeps calendars and tasks");

            // Android, before anything syncs
            d.script("Object.assign(window.__mount.config, {davClients: false}); return 1;");
            WebDriver.sleep(300);
            String note = String.valueOf(d.script("return (document.querySelector('.mount-setup .mount-device .pg-note') || {}).textContent || ''"));
            for (String says : new String[] {"Peergos account of their own on this device", "only that account is synced with Peergos",
                    "stored on the device itself or in another account such as Google", "aren't read, copied or changed"})
                if (! note.contains(says))
                    throw new AssertionError("Before syncing, the page should say what syncs and what doesn't (" + says + "): " + note);
            String labels = String.valueOf(d.script("return [...document.querySelectorAll('.mount-setup .pg-switch span:last-child')].map(s => s.textContent.trim()).join(' | ')"));
            if (! labels.contains("Sync your calendars |") || labels.contains("calendars and tasks"))
                throw new AssertionError("On Android the calendar switch shouldn't promise tasks: " + labels);
            String points = String.valueOf(d.script("return " + POINTS));
            for (String says : new String[] {"Changes go both ways", "can wait longer to save battery",
                    "the Peergos version is kept", "a contact's copy is marked", "deleted on one side and changed on the other is kept",
                    "first Peergos address book", "Tasks stay", "Unmounting stops", "sent to Peergos if you turn syncing on again"})
                if (! points.contains(says))
                    throw new AssertionError("How syncing works should say " + says + ": " + points);
            System.out.println("  ok   before syncing, Android says only Peergos' own account syncs, and how syncing works");

            // contacts only: nothing about tasks
            d.script("Object.assign(window.__mount.config, {canSyncCalendar: false}); return 1;");
            WebDriver.sleep(300);
            if (String.valueOf(d.script("return " + POINTS)).contains("Tasks"))
                throw new AssertionError("With only contacts on offer there should be nothing about tasks");
            System.out.println("  ok   with only contacts on offer, nothing about tasks");

            // once mounted, what syncs and what doesn't stays in view, above How syncing works
            d.script("Object.assign(window.__mount.config, {canSyncCalendar: true, enabled: true, mountDrive: false, syncCalendar: true, syncContacts: true, mountPoint: ''}); return 1;");
            WebDriver.sleep(500);
            String scope = String.valueOf(d.script("const n = document.querySelector('.mount-device > .pg-note'); return n && n.getClientRects().length > 0 ? n.textContent.trim() : ''"));
            if (! scope.contains("only that account is synced with Peergos") || ! scope.contains("stored on the device itself"))
                throw new AssertionError("Once mounted, what syncs and what doesn't should stay in view: " + scope);
            String mounted = String.valueOf(d.script("return " + POINTS));
            if (mounted.contains("Tasks") || mounted.contains("only that account"))
                throw new AssertionError("Once mounted, How syncing works should hold neither the tasks point nor the note above it again: " + mounted);
            System.out.println("  ok   once mounted, what syncs and what doesn't stays in view, above How syncing works");
            d.script("Object.assign(window.__mount.config, {enabled: false, syncCalendar: false, syncContacts: false}); return 1;");
        } finally {
            if (own != null)
                own.close();
        }
        System.out.println("PASS");
    }
}
