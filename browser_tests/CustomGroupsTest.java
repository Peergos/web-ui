import java.nio.file.*;
import java.util.*;

/** Custom sharing groups, end to end: made in the social view, shared with from the drive's
 *  share dialog, seen by a member and not by anyone else, then renamed, emptied and deleted
 *  with its shares revoked.
 *
 *  Set SHOTS to a directory to keep a screenshot of each step (firefox only).
 *
 *  Usage: java -cp ../server/Peergos.jar CustomGroupsTest.java [engine] [url]
 */
public class CustomGroupsTest {

    static final String PASSWORD = CalendarLiveShareTest.PASSWORD;

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
        Path jar = serverDir.resolve("Peergos.jar");
        long stamp = System.currentTimeMillis() % 100000;
        String alice = "alice" + stamp, bob = "bob" + stamp, carol = "carol" + stamp;
        Path downloads = Temp.directory("peergos-custom-groups-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.setWindowRect(1280, 1000);
            Fixtures.signUp(url, alice, PASSWORD);
            Fixtures.signUp(url, bob, PASSWORD);
            Fixtures.signUp(url, carol, PASSWORD);
            Fixtures.commands(jar, url, alice, PASSWORD, "mkdir holidays");
            CalendarLiveShareTest.befriend(d, url, alice, bob);
            CalendarLiveShareTest.befriend(d, url, alice, carol);
            System.out.println(alice + " is friends with " + bob + " and " + carol);

            // --- make a group in the social view ---------------------------------------------
            openSocial(d);
            setInput(d, ".social-groups__name", "family");
            pickMember(d, ".social-groups__create", bob);
            clickButton(d, ".social-groups", "Create group");
            d.waitForScript("the new group with its member",
                    "[...document.querySelectorAll('.social-group')].some(g => g.innerText.includes('family')"
                            + " && g.innerText.includes('(1)') && g.querySelector('.social-group__member')"
                            + " && g.querySelector('.social-group__member').innerText.includes('" + bob + "'))", 120_000);
            shot(d, "1-group-created");
            String uid = groupUid(d, "family");
            expect(members(d, uid), "[" + bob + "]", "the group's members");
            System.out.println("  ok   created family with " + bob);

            // the built-in names are reserved
            setInput(d, ".social-groups__name", "friends");
            clickButton(d, ".social-groups", "Create group");
            d.waitForScript("the reserved name to be refused",
                    "/reserved/.test(document.body.innerText)", 60_000);
            dismissToasts(d);
            setInput(d, ".social-groups__name", "");
            System.out.println("  ok   a group can't be called friends");

            // --- share a folder with it from the drive's own dialog --------------------------
            openShareDialog(d, "holidays");
            String groups = String.valueOf(d.script("return [...document.querySelectorAll('.share-groups label')]"
                    + ".map(l => l.innerText.replace(/\\s+/g, ' ').trim()).join(' | ')"));
            if (! groups.equals("Friends (2) | Followers (Includes Friends) (2) | family (1)"))
                throw new AssertionError("The share dialog lists the groups as: " + groups);
            shot(d, "2-share-dialog");
            d.script("[...document.querySelectorAll('.share-groups label')].find(l => l.innerText.includes('family'))"
                    + ".querySelector('input').click(); return 1;");
            clickButton(d, ".share-fields", "Share");
            d.waitForScript("the share dialog to close", "!document.querySelector('.drive-share')", 120_000);
            expect(readers(d, alice + "/holidays"), "[" + uid + "]", "who holidays is shared with");
            System.out.println("  ok   shared holidays with family from the share dialog");

            openShareDialog(d, "holidays");
            d.waitForScript("the group in the read access list",
                    "[...document.querySelectorAll('.drive-share .modal-section')].some(s => s.innerText.includes('family')"
                            + " && s.querySelector('.share-group-icon'))", 60_000);
            shot(d, "3-shared-with-group");
            d.script("document.querySelector('.drive-share .close').click(); return 1;");
            d.waitForScript("the share dialog to close", "!document.querySelector('.drive-share')", 30_000);
            System.out.println("  ok   the read access list names the group and marks it as one");

            // --- a member sees it, a friend outside the group doesn't ------------------------
            CalendarLiveShareTest.signIn(d, url, bob);
            d.waitUntil(bob + " to see holidays", () -> visible(d, "/" + alice + "/holidays") ? true : null, 120_000);
            CalendarLiveShareTest.signIn(d, url, carol);
            WebDriver.sleep(5000);
            if (visible(d, "/" + alice + "/holidays"))
                throw new AssertionError(carol + " can see a folder shared only with family");
            System.out.println("  ok   " + bob + " sees holidays and " + carol + " doesn't");

            // --- rename, remove the member, delete and revoke --------------------------------
            CalendarLiveShareTest.signIn(d, url, alice);
            openSocial(d);
            d.waitForScript("the group row", "document.querySelectorAll('.social-group').length == 1", 60_000);
            clickButton(d, ".social-group", "Rename");
            d.waitForScript("the rename prompt", "!!document.getElementById('prompt-input')", 30_000);
            setInput(d, "#prompt-input", "relatives");
            d.script("document.getElementById('prompt-button-id').click(); return 1;");
            d.waitForScript("the new name", "document.querySelector('.social-group').innerText.includes('relatives')", 60_000);
            expect(members(d, uid), "[" + bob + "]", "the members after a rename");
            System.out.println("  ok   renamed to relatives, members unchanged");

            d.script("document.querySelector('.social-group__remove').click(); return 1;");
            d.waitForScript("the remove choice", "!!document.getElementById('choice-header-id')", 30_000);
            shot(d, "4-remove-member");
            clickButton(d, ".modal-container", "Confirm");
            d.waitForScript("the group to be empty",
                    "document.querySelector('.social-group').innerText.includes('(empty)')", 180_000);
            expect(members(d, uid), "[]", "the members after removing " + bob);
            System.out.println("  ok   removed " + bob + " from the group");

            clickButton(d, ".social-group", "Delete");
            d.waitForScript("the delete choice", "!!document.getElementById('choice-header-id')", 60_000);
            String body = String.valueOf(d.script("return document.getElementById('choice-body-id').innerText"));
            if (! body.startsWith("1 item(s)"))
                throw new AssertionError("The delete dialog says: " + body);
            shot(d, "5-delete-choice");
            d.script("document.querySelectorAll('.choice-block input')[1].click(); return 1;");
            clickButton(d, ".modal-container", "Confirm");
            d.waitForScript("the group to be gone", "document.querySelectorAll('.social-group').length == 0", 180_000);
            expect(readers(d, alice + "/holidays"), "[]", "who holidays is shared with after deleting and revoking");
            shot(d, "6-deleted");
            System.out.println("  ok   deleted the group and revoked holidays");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static void openSocial(WebDriver d) {
        Page.gotoView(d, "Social", "createGroup", "__social");
        d.waitForScript("the groups section", "!!document.querySelector('.social-groups')", 60_000);
    }

    static void openShareDialog(WebDriver d, String name) {
        Page.gotoDrive(d);
        Page.waitForInDrive(d, name, 120_000);
        Page.select(d, name);
        d.script("window.__drive.showShareWith(); return 1;");
        d.waitForScript("the share dialog's groups", "document.querySelectorAll('.share-groups label').length >= 3"
                + " && ![...document.querySelectorAll('.share-groups label')].some(l => /family\\s*$/.test(l.innerText.trim()))", 60_000);
    }

    /** Sets an input the way typing does, so the vue model sees it. */
    static void setInput(WebDriver d, String css, String value) {
        d.script("const el = document.querySelector(arguments[0]);"
                + "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, arguments[1]);"
                + "el.dispatchEvent(new Event('input', {bubbles: true})); return 1;", css, value);
    }

    /** Opens the autocomplete under `scope` and clicks the option for `name`. */
    static void pickMember(WebDriver d, String scope, String name) {
        try {
            // the options come from the social state, which may still be loading when the field is first focused
            d.waitUntil("the option for " + name, () -> Boolean.TRUE.equals(d.scriptQuiet(
                    "const i = document.querySelector(arguments[0] + ' input.autocomplete');"
                    + "i.focus(); i.dispatchEvent(new Event('focus'));"
                    + "return [...document.querySelectorAll(arguments[0] + ' .options li')].some(li => li.innerText.trim() === arguments[1]);",
                    scope, name)) ? true : null, 60_000);
        } catch (RuntimeException e) {
            System.out.println("  picker state: " + d.scriptQuiet("const i = document.querySelector(arguments[0] + ' input.autocomplete');"
                    + "const c = i ? i.closest('.form-autocomplete').__vue__ : null;"
                    + "return 'input=' + !!i + ' options=' + (c ? JSON.stringify(c.options) : 'n/a') + ' shown=' + (c ? c.isShow : 'n/a')"
                    + " + ' lis=' + [...document.querySelectorAll(arguments[0] + ' .options li')].map(li => li.innerText).join(',');", scope));
            throw e;
        }
        d.script("[...document.querySelectorAll(arguments[0] + ' .options li')].find(li => li.innerText.trim() === arguments[1]).click();"
                + "return 1;", scope, name);
        d.waitForScript(name + " to be picked",
                "[...document.querySelectorAll('" + scope + " .item-selected')].some(s => s.innerText.includes('" + name + "'))", 30_000);
    }

    static void clickButton(WebDriver d, String scope, String text) {
        Object clicked = d.script("const b = [...document.querySelectorAll(arguments[0] + ' button')]"
                + ".find(b => b.textContent.trim() === arguments[1] && ! b.disabled);"
                + "if (b) { b.click(); return true; } return false;", scope, text);
        if (! Boolean.TRUE.equals(clicked))
            throw new AssertionError("No enabled '" + text + "' button in " + scope);
    }

    static void dismissToasts(WebDriver d) {
        d.script("document.querySelectorAll('.Vue-Toastification__close-button').forEach(b => b.click()); return 1;");
    }

    static String groupUid(WebDriver d, String name) {
        String r = CalendarLiveShareTest.settle(d, "ctx().getSocialState().thenApply(s => {"
                + " const m = s.uidToGroupName; const uid = m.keySet().toArray([]).find(k => m.get(k) == arguments[0]);"
                + " window.__r = uid ? 'ok ' + uid : 'FAILED no group'; })"
                + ".exceptionally(t => { window.__r = 'FAILED ' + t; });", name);
        CalendarLiveShareTest.expect(r, "finding the group's uid");
        return r.substring(3);
    }

    static String members(WebDriver d, String uid) {
        String r = CalendarLiveShareTest.settle(d, "ctx().getGroupMembers(arguments[0])"
                + ".thenApply(m => { window.__r = 'ok ' + JSON.stringify(m.toArray([]).sort()).replace(/\"/g, ''); })"
                + ".exceptionally(t => { window.__r = 'FAILED ' + t; });", uid);
        CalendarLiveShareTest.expect(r, "reading the group's members");
        return r.substring(3);
    }

    static String readers(WebDriver d, String path) {
        String r = CalendarLiveShareTest.settle(d, "ctx().sharedWith(peergos.client.PathUtils.directoryToPath(arguments[0].split('/')))"
                + ".thenApply(s => { window.__r = 'ok ' + JSON.stringify(s.readAccess.toArray([]).sort()).replace(/\"/g, ''); })"
                + ".exceptionally(t => { window.__r = 'FAILED ' + t; });", path);
        CalendarLiveShareTest.expect(r, "reading who " + path + " is shared with");
        return r.substring(3);
    }

    static boolean visible(WebDriver d, String path) {
        String r = CalendarLiveShareTest.settle(d, "ctx().getByPath(arguments[0])"
                + ".thenApply(f => { window.__r = 'ok ' + f.isPresent(); })"
                + ".exceptionally(t => { window.__r = 'FAILED ' + t; });", path);
        return r.equals("ok true");
    }

    static void expect(String actual, String expected, String what) {
        if (! actual.equals(expected))
            throw new AssertionError(what + " was " + actual + ", expected " + expected);
    }

    static void shot(WebDriver d, String name) {
        String dir = System.getenv("SHOTS");
        if (dir == null || ! (d instanceof MarionetteDriver))
            return;
        try {
            Files.write(Paths.get(dir, name + ".png"), ((MarionetteDriver) d).screenshot());
        } catch (Exception e) {
            System.out.println("  no screenshot of " + name + ": " + e);
        }
    }
}
