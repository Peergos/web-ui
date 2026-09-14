import java.nio.file.*;
import java.util.*;

/** An entry one person shares with another stays live at both ends.
 *
 *  Bob does not get a copy: he gets a snapshot of Alice's file beside a pointer back to it,
 *  so when she changes the entry his calendar catches up instead of quietly showing what she
 *  used to have. Both directions are checked - her change reaching him, and, when the share
 *  was writable, his change reaching her own file.
 *
 *  Usage: java -cp ../server/Peergos.jar CalendarLiveShareTest.java [engine] [url]
 */
public class CalendarLiveShareTest {

    static final String TITLE = "Shared live";
    static final String WRITABLE = "Shared and writable";
    static final String PASSWORD = "live-share-password";

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
        String alice = "alice" + stamp, bob = "bob" + stamp;
        Path downloads = Temp.directory("peergos-calendar-liveshare-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            Fixtures.signUp(url, alice, PASSWORD);
            Fixtures.signUp(url, bob, PASSWORD);
            befriend(d, url, alice, bob);
            System.out.println(alice + " and " + bob + " are friends");

            // --- Alice makes an entry and shares it, read only --------------------------------
            signIn(d, url, alice);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", TITLE)
                    + CalendarApp.setField("event-start-time", "09:00")
                    + CalendarApp.setField("event-end-time", "10:00") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String aliceDir = CalendarApp.directoryOf(d, alice);
            java.time.LocalDate today = java.time.LocalDate.now();
            String month = aliceDir + "/" + today.getYear() + "/" + today.getMonthValue();
            String file = CalendarApp.awaitFileSaying(d, month, "SUMMARY:" + TITLE);
            String uid = file.substring(0, file.length() - ".ics".length());
            String entryDir = alice + "/.apps/calendar/data/" + month;
            share(d, entryDir, file, bob, false);
            System.out.println("  ok   " + alice + " shared one entry with " + bob);

            // --- Bob opens it: a snapshot of her file, not a copy in a month of his own -------
            signIn(d, url, bob);
            openSharedEntry(d, entryDir, file);
            String sharedId = "shared:" + alice + ":" + uid;
            CalendarApp.waitInFrame(d, "the shared entry on " + bob + "'s grid", drawn(sharedId), 120_000);
            String bobDir = CalendarApp.directoryOf(d, bob);
            String snapshot = alice + "-" + file;
            List<String> held = CalendarApp.list(d, bobDir + "/shared");
            if (! held.contains(snapshot))
                throw new AssertionError("The entry should be kept as a snapshot of the owner's"
                        + " file, but " + bob + "'s shared directory holds " + held);
            String kept = CalendarApp.read(d, bobDir + "/shared", snapshot);
            CalendarApp.assertHas(kept, "X-PEERGOS-SRC-OWNER", alice);
            CalendarApp.assertHas(kept, "X-PEERGOS-SRC-UID", uid);
            List<String> ownMonth = CalendarApp.list(d, bobDir + "/" + today.getYear() + "/" + today.getMonthValue());
            if (ownMonth.contains(file))
                throw new AssertionError("Someone else's entry was copied into a month of "
                        + bob + "'s own, which is the copy that stops matching: " + ownMonth);
            System.out.println("  ok   it is a snapshot of the owner's file, with a pointer back to it");

            // --- Alice changes the time ------------------------------------------------------
            signIn(d, url, alice);
            CalendarApp.open(d);
            String before = CalendarApp.read(d, month, file);
            // Stored in UTC, so the hour on disk is not the one that was typed: the time is
            // rewritten by position rather than by looking for what was entered.
            String wasAt = firstMatch(before, "DTSTART[^:]*:(\\d{8}T\\d{6})");
            String after = before.replaceAll("(DTSTART[^:]*:\\d{8}T)\\d{6}", "$1140000")
                    .replaceAll("(DTEND[^:]*:\\d{8}T)\\d{6}", "$1150000");
            if (wasAt == null || after.equals(before))
                throw new AssertionError("The test could not move the entry's time: " + before);
            CalendarApp.write(d, month, file, after);
            System.out.println("  ok   the owner moved it, from " + wasAt + " to 14:00 UTC");

            // --- Bob refreshes and has her new time ------------------------------------------
            signIn(d, url, bob);
            CalendarApp.open(d);
            d.waitUntil("the snapshot to catch up with the owner's change", () ->
                    CalendarApp.read(d, bobDir + "/shared", snapshot).contains("T140000") ? true : null,
                    120_000);
            CalendarApp.waitInFrame(d, "the entry still on the grid afterwards", drawn(sharedId), 60_000);
            String caught = CalendarApp.read(d, bobDir + "/shared", snapshot);
            CalendarApp.assertHas(caught, "X-PEERGOS-SRC-OWNER", alice);
            if (caught.contains(wasAt))
                throw new AssertionError("The snapshot still says what the owner used to have: " + caught);
            System.out.println("  ok   and the reader's calendar caught up with it");

            // --- and one shared writable, which the reader can change -------------------------
            signIn(d, url, alice);
            CalendarApp.open(d);
            CalendarApp.monthView(d);
            CalendarApp.newEntry(d, "add-menu-event", "event-modal-backdrop");
            CalendarApp.inFrame(d, CalendarApp.setField("event-title", WRITABLE)
                    + CalendarApp.setField("event-start-time", "11:00")
                    + CalendarApp.setField("event-end-time", "12:00") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String writableFile = CalendarApp.awaitFileSaying(d, month, "SUMMARY:" + WRITABLE);
            String writableUid = writableFile.substring(0, writableFile.length() - ".ics".length());
            String ownedBefore = CalendarApp.read(d, month, writableFile);
            String ownerWasAt = firstMatch(ownedBefore, "DTSTART[^:]*:(\\d{8}T\\d{6})");
            share(d, entryDir, writableFile, bob, true);
            System.out.println("  ok   " + alice + " shared another one, this time writable");

            signIn(d, url, bob);
            openSharedEntry(d, entryDir, writableFile);
            String writableId = "shared:" + alice + ":" + writableUid;
            CalendarApp.waitInFrame(d, "the writable entry on the grid", drawn(writableId), 120_000);
            // Editing only becomes possible once the host has reached the owner's file and
            // found it writable - before that a shared entry is something to read. The
            // popover is opened the way a person opens it, which is not instant: a click sets
            // a timer, so reading the button straight after the click sees the closed one.
            d.waitUntil("the entry to offer editing", () -> {
                CalendarApp.openPopover(d, WRITABLE);
                return Boolean.TRUE.equals(CalendarApp.inFrame(d,
                        "let edit = document.getElementById('popover-edit');"
                                + "return !!edit && edit.offsetParent !== null;")) ? true : null;
            }, 120_000);
            // Sharing it on is the owner's to do, not the reader's.
            boolean offersShare = Boolean.TRUE.equals(CalendarApp.inFrame(d,
                    "let share = document.getElementById('popover-share');"
                            + "return !!share && share.offsetParent !== null;"));
            if (offersShare)
                throw new AssertionError("The reader is offered the chance to share on an entry"
                        + " that is not theirs to grant");
            CalendarApp.inFrame(d, CalendarApp.click("popover-edit") + "return 1;");
            CalendarApp.waitInFrame(d, "the event dialog",
                    "document.getElementById('event-modal-backdrop').classList.contains('open')", 60_000);
            CalendarApp.inFrame(d, CalendarApp.setField("event-start-time", "16:00")
                    + CalendarApp.setField("event-end-time", "17:00") + "return 1;");
            CalendarApp.save(d, "event-save", "event-modal-backdrop");
            String bobsSnapshot = alice + "-" + writableFile;
            // Asked of DTSTART alone: DTSTAMP and LAST-MODIFIED carry an hour of their own,
            // and looking for it anywhere in the file passes on a write that never happened.
            d.waitUntil("the reader's own snapshot to hold the change", () ->
                    startTimeChanged(CalendarApp.read(d, bobDir + "/shared", bobsSnapshot), ownerWasAt), 120_000);
            String bobsCopy = CalendarApp.read(d, bobDir + "/shared", bobsSnapshot);
            System.out.println("  ok   the reader changed it");

            // --- the owner's own file, which is where it had to land -------------------------
            signIn(d, url, alice);
            CalendarApp.open(d);
            d.waitUntil("the owner's own file to carry the reader's change", () ->
                    startTimeChanged(CalendarApp.read(d, month, writableFile), ownerWasAt), 120_000);
            String owned = CalendarApp.read(d, month, writableFile);
            if (owned.contains(ownerWasAt))
                throw new AssertionError("The owner's file still says what it did before the"
                        + " reader changed it: " + owned);
            CalendarApp.assertHas(owned, "SUMMARY", WRITABLE);
            String ownerNowAt = firstMatch(owned, "DTSTART[^:]*:(\\d{8}T\\d{6})");
            String readerNowAt = firstMatch(bobsCopy, "DTSTART[^:]*:(\\d{8}T\\d{6})");
            if (ownerNowAt == null || ! ownerNowAt.equals(readerNowAt))
                throw new AssertionError("The two ends disagree about when it is: the owner has "
                        + ownerNowAt + ", the reader " + readerNowAt);
            // The pointer is the reader's own bookkeeping and has no business in the owner's file.
            if (owned.contains("X-PEERGOS-SRC-"))
                throw new AssertionError("The reader's pointer was written into the owner's file: " + owned);
            System.out.println("  ok   and it landed in the owner's own file, saying the same thing");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** True once the entry's own start time is something other than `was`. */
    static Boolean startTimeChanged(String ics, String was) {
        String at = firstMatch(ics, "DTSTART[^:]*:(\\d{8}T\\d{6})");
        return at != null && ! at.equals(was) ? true : null;
    }

    static String firstMatch(String text, String pattern) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(pattern).matcher(text);
        return m.find() ? m.group(1) : null;
    }

    static String drawn(String id) {
        return "!!document.querySelector('[data-search-event-id=\"" + id + "\"]')";
    }

    /** Alice asks to follow Bob, Bob accepts and follows back, which is what a share needs. */
    static void befriend(WebDriver d, String url, String alice, String bob) {
        signIn(d, url, alice);
        // Retried: a fresh account is still settling its own writes, and a follow request
        // landing on top of one comes back as a failed compare-and-swap rather than a
        // refusal. It is the same request either way.
        String[] asked = {"never tried"};
        d.waitUntil("the follow request to go through", () -> {
            asked[0] = settle(d, "ctx().sendInitialFollowRequest(arguments[0])"
                    + "  .thenApply(r => { window.__r = 'ok ' + r; })"
                    + "  .exceptionally(t => { window.__r = 'FAILED ' + t; });", bob);
            return asked[0].startsWith("ok") ? true : null;
        }, 180_000);
        signIn(d, url, bob);
        // Asked for again until it is there rather than once: a follow request and its reply
        // both travel through the other user's store, and neither is instant.
        d.waitUntil("the request to reach " + bob, () -> settle(d, "ctx().getSocialState()"
                + "  .thenApply(social => { window.__reqs = social.pendingIncoming.toArray([]);"
                + "     window.__r = 'ok ' + window.__reqs.length; })"
                + "  .exceptionally(t => { window.__r = 'FAILED ' + t; });").equals("ok 0") ? null : true,
                120_000);
        String[] replied = {"never tried"};
        d.waitUntil("the reply to go through", () -> {
            replied[0] = settle(d, "ctx().sendReplyFollowRequest(window.__reqs[0], true, true)"
                    + "  .thenApply(r => { window.__r = 'ok ' + r; })"
                    + "  .exceptionally(t => { window.__r = 'FAILED ' + t; });");
            return replied[0].startsWith("ok") ? true : null;
        }, 180_000);
        // Nothing is asserted about what the social state says here. What matters is whether
        // a share works, and that is what the share itself waits for: the reply travels
        // through Alice's own store and a session that has already read her state can go on
        // reporting the old one for as long as it likes.
        signIn(d, url, alice);
    }

    /** Shares one file, the way the drive's own dialog does - with a Path, not a string.
     *
     *  Retried rather than asserted once: granting access needs the other account's reply to
     *  have reached this one, and that arrives when it arrives. */
    static void share(WebDriver d, String directory, String filename, String with, boolean writable) {
        String call = writable ? "shareWriteAccessWith" : "shareReadAccessWith";
        String[] last = {"never tried"};
        d.waitUntil("the share to go through", () -> {
            last[0] = settle(d, "let filePath = peergos.client.PathUtils.toPath("
                    + "arguments[0].split('/'), arguments[1]);"
                    + "ctx()." + call + "(filePath, peergos.client.JsUtil.asSet(['" + with + "']))"
                    + "  .thenApply(r => { window.__r = 'ok'; })"
                    + "  .exceptionally(t => { window.__r = 'FAILED ' + t; });",
                    directory, filename);
            return last[0].startsWith("ok") ? true : null;
        }, 180_000);
    }

    /** Opens one entry in the calendar, the way the drive routes to it.
     *
     *  Asked more than once, and reloaded in between: routing by url is a hash change, and
     *  some engines answer one of those by doing nothing at all. The reload boots the app
     *  from the url it has just been given, which is the same journey a person makes when
     *  they open a link to a file. */
    static void openSharedEntry(WebDriver d, String directory, String filename) {
        RuntimeException last = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            // By way of the drive, the way a person reaches it, rather than by reloading
            // what is on screen: a reload repeats whatever state the page is already in, so
            // it cannot recover a route that never took. Coming from somewhere else also
            // makes every attempt a real transition - asking for the route the page is
            // already on changes no hash and re-renders nothing.
            if (attempt > 0)
                Page.gotoDrive(d);
            d.script("let root = null;"
                    + "for (const el of document.querySelectorAll('*')) if (el.__vue__) { root = el.__vue__.$root; break; }"
                    + "const stack = root ? [root] : [];"
                    + "while (stack.length) { const c = stack.pop();"
                    + "  if (typeof c.updateHistory === 'function') { window.__router = c; break; }"
                    + "  (c.$children || []).forEach(k => stack.push(k)); }"
                    + "if (!window.__router) throw new Error('no component that routes');"
                    + "window.__router.updateHistory('Calendar', arguments[0], {filename: arguments[1]}, false);"
                    + "return 1;", directory, filename);
            try {
                // The same allowance the rest of this test gives a step: bringing the view
                // and its framed app up is the app being launched, not a moment's rendering,
                // and a loaded runner has been seen to take minutes over work that usually
                // takes seconds. The wait ends as soon as it is there.
                d.waitForScript("the calendar frame",
                        "!!document.querySelector('" + CalendarApp.FRAME + "')", 120_000);
                d.waitForScript("the calendar view", CalendarReadOnlyTest.CALENDAR_VIEW, 120_000);
                return;
            } catch (RuntimeException notYet) {
                last = notYet;
                System.out.println("  the calendar did not come up from the url, asking again");
            }
        }
        // A page that never routed and one whose view never mounted look the same from the
        // wait, so say which it is before giving up.
        System.out.println("  the page is on: " + d.scriptQuiet("return location.hash.slice(0, 60)"));
        System.out.println("  signed in: " + d.scriptQuiet(
                "return !document.querySelector('input[name=username]')"));
        System.out.println("  frames on the page: " + d.scriptQuiet(
                "return Array.from(document.querySelectorAll('iframe')).map(function(f) {"
                        + "  return f.id || '(no id)'; }).join(', ') || 'none'"));
        System.out.println("  the page shows: " + d.scriptQuiet(
                "return document.body.innerText.replace(/\\s+/g, ' ').slice(0, 200)"));
        throw last;
    }

    /** Signs in as `user`, signing whoever is there out first. Asked of the page rather than
     *  assumed from the form's absence: on a slow load the form is missing because nothing has
     *  rendered yet, which is not the same as somebody being signed in. */
    static void signIn(WebDriver d, String url, String user) {
        d.navigate(url + "/");
        d.waitUntil("the page to say whether anyone is signed in", () -> {
            if (Boolean.TRUE.equals(d.scriptQuiet(
                    "return !!document.querySelector('input[name=username]')")))
                return "signed out";
            if (Boolean.TRUE.equals(d.scriptQuiet("return (() => {"
                    + "  for (const el of document.querySelectorAll('*')) {"
                    + "    const c = el.__vue__;"
                    + "    if (c && typeof c.logout === 'function') return true;"
                    + "  }"
                    + "  return false; })()")))
                return "signed in";
            return null;
        }, 120_000);
        if (Boolean.TRUE.equals(d.scriptQuiet("return !document.querySelector('input[name=username]')")))
            Page.logout(d);
        d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
        Page.login(d, user, PASSWORD);
    }

    static void expect(String result, String what) {
        if (! result.startsWith("ok"))
            throw new AssertionError(what + " did not work: " + result);
    }

    static String settle(WebDriver d, String script, String... args) {
        d.script("window.__r = null;"
                + "window.ctx = function() { return document.querySelector('#app').__vue__.$store.state.context; };"
                + script, (Object[]) args);
        try {
            d.waitForScript("the call to settle", "window.__r", 120_000);
        } catch (RuntimeException timedOut) {
            return "never settled";
        }
        return String.valueOf(d.script("return window.__r"));
    }
}
