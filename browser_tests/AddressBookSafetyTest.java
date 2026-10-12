import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.user.UserContext;

import java.nio.file.*;
import java.util.*;

/** Address Book keeps contacts where they belong when Peergos is slow to answer.
 *
 *  A request to Peergos takes a moment, and the user can move on meanwhile: open another address
 *  book while one loads, while a contact saves, while an import or a move is under way. Each
 *  case is made certain by holding back that one request in the app's page, and what is stored
 *  is read back over the api.
 *
 *  Usage: java -cp ../server/Peergos.jar AddressBookSafetyTest.java [engine] [peergos url]
 */
public class AddressBookSafetyTest {

    static final String CAROL = "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:carol-1\r\nFN:Carol Current\r\nN:Current;Carol;;;\r\nEND:VCARD\r\n";
    static final String BOB = "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:bob-1\r\nFN:Bob Big\r\nN:Big;Bob;;;\r\nEND:VCARD\r\n";
    // holds back the named request for the given time, on its way to Peergos
    static final String HOLD = "window.__real = window.__real || host;"
            + " window.host = (t, p) => t === arguments[0] && (arguments[1] == null || p.book === arguments[1])"
            + "   ? new Promise(r => setTimeout(r, arguments[2])).then(() => window.__real(t, p)) : window.__real(t, p); return 1;";
    static final String RELEASE = "if (window.__real) window.host = window.__real; return 1;";
    // lets the next named request through at once and holds back only its answer, for the given
    // time, as a slow answer from Peergos would be: once
    static final String HOLD_ANSWER_ONCE = "window.__real = window.__real || host; let once = true;"
            + " window.host = (t, p) => { const r = window.__real(t, p);"
            + "   if (once && t === arguments[0] && p != null && p.book === arguments[1]) {"
            + "     once = false; return r.then(v => new Promise(ok => setTimeout(() => ok(v), arguments[2]))); }"
            + "   return r; }; return 1;";

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
        Crypto crypto = Builder.initCrypto();
        String me = "absafe" + (System.currentTimeMillis() % 100000);
        try {
            NoAppsYetTest.signUp(url, me, crypto);
            UserContext api = NewsFeedViewTest.signInApi(url, me, crypto);
            String data = me + "/.apps/contacts/data/";
            AddressBookTest.store(api, ".apps/contacts/data/default", "carol-1.vcf", CAROL);
            AddressBookTest.store(api, ".apps/contacts/data/big", "addressbook.inf", "{\"name\":\"Big\"}");
            AddressBookTest.store(api, ".apps/contacts/data/big", "bob-1.vcf", BOB);

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-absafe-"), headless)) {
                d.setWindowRect(1280, 900);
                NewsFeedViewTest.signIn(d, url, me);
                Page.gotoView(d, "Address Book", "saveCard", "__addressBook");
                AddressBookTest.waitInFrame(d, "the address books", "return [...document.querySelectorAll('#contacts .list-row')].some(l => l.textContent.includes('Carol Current'))"
                        + " && [...document.querySelectorAll('#bookList .list-row')].some(l => l.textContent.includes('Big')) ? true : null");

                List<String> failures = new ArrayList<>();
                scenario(failures, "slowBook", d, () -> slowBook(d, api, data));
                scenario(failures, "lateSave", d, () -> lateSave(d, api, data));
                scenario(failures, "importWhileSwitching", d, () -> importWhileSwitching(d, api, data));
                scenario(failures, "twoFilesWhileSwitching", d, () -> twoFilesWhileSwitching(d, api, data));
                scenario(failures, "searchWhileLoading", d, () -> searchWhileLoading(d));
                scenario(failures, "olderLoadAnswersLast", d, () -> olderLoadAnswersLast(d));
                scenario(failures, "moveIntoOpenedBook", d, () -> moveIntoOpenedBook(d, api, data));
                scenario(failures, "failedLoad", d, () -> failedLoad(d));
                scenario(failures, "doubleSave", d, () -> doubleSave(d, api, data));
                scenario(failures, "changedElsewhere", d, () -> changedElsewhere(d, api, data));
                scenario(failures, "overwriteWhenAsked", d, () -> overwriteWhenAsked(d, api, data));
                scenario(failures, "deletedElsewhere", d, () -> deletedElsewhere(d, api, data));
                scenario(failures, "deleteChangedElsewhere", d, () -> deleteChangedElsewhere(d, api, data));
                scenario(failures, "changedAgainWhileAsked", d, () -> changedAgainWhileAsked(d, api, data));
                scenario(failures, "importAgain", d, () -> importAgain(d, api, data));
                scenario(failures, "moveBesideTwin", d, () -> moveBesideTwin(d, api, data));
                scenario(failures, "deletedBookStaysDeleted", d, () -> deletedBookStaysDeleted(d, api, data));
                // last, as it leaves the view and opens a new one
                scenario(failures, "answerAfterLeaving", d, () -> answerAfterLeaving(d));
                if (! failures.isEmpty())
                    throw new AssertionError("Failed: " + String.join("; ", failures));
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    // an import of several files goes wholly to the book it was started in, however the view
    // moves meanwhile, and says so once for them all
    static void twoFilesWhileSwitching(WebDriver d, UserContext api, String data) {
        openBook(d, "default", "Contacts", "Carol Current");
        Path a, b;
        try {
            Path dir = Temp.directory("peergos-absafe-two-");
            a = dir.resolve("first.vcf");
            b = dir.resolve("second.vcf");
            Files.writeString(a, "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:tf-a\r\nFN:Two Files A\r\nN:A;Two Files;;;\r\nEND:VCARD\r\n");
            Files.writeString(b, "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:tf-b\r\nFN:Two Files B\r\nN:B;Two Files;;;\r\nEND:VCARD\r\n");
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
        AddressBookTest.inFrame(d, "document.getElementById('status').textContent = ''; return 1;");
        AddressBookTest.inFrame(d, HOLD, "saveCard", "default", 2500);
        d.switchToFrame(AddressBookTest.FRAME);
        try {
            d.sendKeys(d.find("#importFile"), a.toAbsolutePath() + "\n" + b.toAbsolutePath());
        } finally {
            d.switchToTop();
        }
        WebDriver.sleep(800);
        AddressBookTest.inFrame(d, "openBook('big'); return 1;");
        Object said = AddressBookTest.waitInFrame(d, "the import", "const t = document.getElementById('status').textContent; return t.startsWith('Imported') ? t : null");
        AddressBookTest.inFrame(d, RELEASE);
        AddressBookTest.waitFor("both files' contacts in the book the import started in", () -> AddressBookTest.stored(api, data + "default").stream()
                .filter(c -> c.contains("UID:tf-a") || c.contains("UID:tf-b")).count() == 2);
        if (AddressBookTest.stored(api, data + "big").stream().anyMatch(c -> c.contains("Two Files")))
            throw new AssertionError("No file of an import should go to the book opened meanwhile");
        if (! "Imported 2".equals(String.valueOf(said)))
            throw new AssertionError("An import of two files should say so once for both, not: " + said);
        System.out.println("  ok   an import of two files goes wholly to the book it started in, however the view moves, and says so once (" + said + ")");
    }

    // nothing of the book that was open is listed while the next one loads, so a search can't
    // bring its contacts back to be opened, edited or deleted as the new book's
    static void searchWhileLoading(WebDriver d) {
        openBook(d, "default", "Contacts", "Carol Current");
        AddressBookTest.inFrame(d, HOLD, "loadBook", "big", 3000);
        Object listed = AddressBookTest.inFrame(d, "openBook('big'); const s = document.getElementById('search'); s.value = 'carol'; s.dispatchEvent(new Event('input'));"
                + " selectContact('carol-1.vcf'); return document.getElementById('contacts').textContent + ' / ' + document.getElementById('detail').textContent");
        AddressBookTest.inFrame(d, "const s = document.getElementById('search'); s.value = ''; s.dispatchEvent(new Event('input')); return 1;");
        AddressBookTest.inFrame(d, RELEASE);
        if (String.valueOf(listed).contains("Carol"))
            throw new AssertionError("Nothing of the book that was open should show while the next loads: " + listed);
        openBook(d, "big", "Big", "Bob Big");
        System.out.println("  ok   nothing of the book that was open shows while the next one loads, searched for or not");
    }

    // a load that answers after a later load of the same book is passed over: the later one,
    // with what was added in between, stays on show
    static void olderLoadAnswersLast(WebDriver d) {
        openBook(d, "default", "Contacts", "Carol Current");
        AddressBookTest.inFrame(d, HOLD_ANSWER_ONCE, "loadBook", "default", 4000);
        AddressBookTest.inFrame(d, "openBook('default'); return 1;");
        WebDriver.sleep(800);
        elsewhere(d, "window.__addressBook.writeContactCard('default', 'late-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:late-1\\r\\nFN:Late One\\r\\nN:One;Late;;;\\r\\nEND:VCARD\\r\\n')");
        openBook(d, "default", "Contacts", "Late One");
        WebDriver.sleep(4500);
        AddressBookTest.inFrame(d, RELEASE);
        Object rows = AddressBookTest.inFrame(d, SHOWN);
        if (! s(rows).contains("Late One"))
            throw new AssertionError("A load that answered after a later one should not replace it: " + s(rows));
        System.out.println("  ok   a load answering after a later one of the same book is passed over");
    }

    // a book that is slow to load, replaced by one opened after it
    static void slowBook(WebDriver d, UserContext api, String data) {
        AddressBookTest.inFrame(d, HOLD, "loadBook", "big", 3000);
        AddressBookTest.inFrame(d, "openBook('big'); setTimeout(() => openBook('default'), 300); return 1;");
        WebDriver.sleep(5000);
        AddressBookTest.inFrame(d, RELEASE);
        String o = s(AddressBookTest.inFrame(d, SHOWN));
        if (! (o.contains("\"title\":\"Contacts\"") && o.contains("Carol Current") && ! o.contains("Bob Big")))
            throw new AssertionError("The book opened last should show its own contacts, not the slow one's: " + o);
        System.out.println("  ok   a slow book replaced by one opened after it doesn't put its contacts in that one (" + o + ")");
    }

    // a save that finishes after another book was opened
    static void lateSave(WebDriver d, UserContext api, String data) {
        AddressBookTest.inFrame(d, HOLD, "saveCard", null, 2000);
        AddressBookTest.inFrame(d, "selectContact('carol-1.vcf');"
                + " [...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Edit').click(); return 1;");
        AddressBookTest.waitInFrame(d, "the edit form", "return document.querySelector('#detail input[placeholder=\"Job title\"]') ? true : null");
        AddressBookTest.inFrame(d, "const t = document.querySelector('#detail input[placeholder=\"Job title\"]'); t.value = 'Engineer'; t.dispatchEvent(new Event('input'));"
                + " document.querySelector('#detail button[type=submit]').click(); setTimeout(() => openBook('big'), 200); return 1;");
        WebDriver.sleep(4000);
        AddressBookTest.inFrame(d, RELEASE);
        String big = s(AddressBookTest.inFrame(d, SHOWN));
        String carol = AddressBookTest.waitForStored(api, data + "default", "TITLE:Engineer");
        if (! big.contains("\"title\":\"Big\"") || big.contains("Carol"))
            throw new AssertionError("A save finishing in another book's view should leave that book's list alone: " + big);
        if (AddressBookTest.stored(api, data + "big").stream().anyMatch(c -> c.contains("Carol")))
            throw new AssertionError("The save should not reach the book opened meanwhile");
        System.out.println("  ok   a save that finishes after another book opened is stored in its own (" + AddressBookTest.firstLine(carol, "TITLE:") + "), and the open list is left alone");
    }

    // an import under way while another book is opened
    static void importWhileSwitching(WebDriver d, UserContext api, String data) {
        openBook(d, "default", "Contacts", "Carol Current");
        AddressBookTest.inFrame(d, HOLD, "saveCard", null, 700);
        String three = "BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:imp-1\\r\\nFN:Imp One\\r\\nN:One;Imp;;;\\r\\nEND:VCARD\\r\\n"
                + "BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:imp-2\\r\\nFN:Imp Two\\r\\nN:Two;Imp;;;\\r\\nEND:VCARD\\r\\n"
                + "BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:imp-3\\r\\nFN:Imp Three\\r\\nN:Three;Imp;;;\\r\\nEND:VCARD\\r\\n";
        AddressBookTest.inFrame(d, "importText('" + three + "'); setTimeout(() => openBook('big'), 1000); return 1;");
        AddressBookTest.waitInFrame(d, "the import to finish", "return document.getElementById('status').textContent.startsWith('Imported') ? true : null");
        AddressBookTest.inFrame(d, RELEASE);
        System.out.println("  import said: " + AddressBookTest.inFrame(d, "return document.getElementById('status').textContent"));
        try {
            AddressBookTest.waitFor("the import to be stored", () -> AddressBookTest.stored(api, data + "default").stream().filter(c -> c.contains("FN:Imp ")).count() == 3);
        } catch (AssertionError e) {
            // counted below
        }
        long inDefault = AddressBookTest.stored(api, data + "default").stream().filter(c -> c.contains("FN:Imp ")).count();
        long inBig = AddressBookTest.stored(api, data + "big").stream().filter(c -> c.contains("FN:Imp ")).count();
        if (inDefault != 3 || inBig != 0)
            throw new AssertionError("All of an import should go to the book it was started in: " + inDefault + " there, " + inBig + " in the other");
        System.out.println("  ok   an import goes wholly to the book it started in, however the view moves meanwhile (3 there, 0 elsewhere)");
    }

    // a move under way while its target is opened
    static void moveIntoOpenedBook(WebDriver d, UserContext api, String data) {
        openBook(d, "default", "Contacts", "Carol Current");
        AddressBookTest.inFrame(d, "selectContact('carol-1.vcf'); return 1;");
        AddressBookTest.waitInFrame(d, "the contact's move menu", "return document.querySelector('#detail select') ? true : null");
        AddressBookTest.inFrame(d, HOLD, "saveCard", null, 1500);
        // the way a person moves it: the Move to menu
        AddressBookTest.inFrame(d, "const m = document.querySelector('#detail select'); m.value = 'big'; m.dispatchEvent(new Event('change'));"
                + " setTimeout(() => openBook('big'), 300); return 1;");
        AddressBookTest.waitInFrame(d, "the move to finish", "return document.getElementById('status').textContent.startsWith('Moved') ? true : null");
        AddressBookTest.inFrame(d, RELEASE);
        AddressBookTest.waitForStored(api, data + "big", "FN:Carol Current");
        AddressBookTest.waitFor("the original to go", () -> AddressBookTest.stored(api, data + "default").stream().noneMatch(c -> c.contains("FN:Carol Current")));
        AddressBookTest.waitInFrame(d, "the moved contact in the open book", "return document.getElementById('bookTitle').textContent === 'Big'"
                + " && [...document.querySelectorAll('#contacts .list-row')].some(r => r.textContent.includes('Carol Current')) ? true : null");
        System.out.println("  ok   a move finishes in its target even when that book is opened meanwhile, and shows there");
    }

    // a book that can't be loaded says so, and can be tried again, rather than looking empty
    static void failedLoad(WebDriver d) {
        AddressBookTest.inFrame(d, "window.__real = window.__real || host; window.__failed = false;"
                + " window.host = (t, p) => t === 'loadBook' && ! window.__failed ? (window.__failed = true, Promise.reject(new Error('unreachable'))) : window.__real(t, p); return 1;");
        AddressBookTest.inFrame(d, "openBook('default'); return 1;");
        Object shown = AddressBookTest.waitInFrame(d, "the book's list", "const e = document.querySelector('#contacts .empty'); return e && ! e.textContent.includes('Loading') ? e.textContent.trim() : null");
        AddressBookTest.inFrame(d, RELEASE);
        String said = String.valueOf(shown);
        if (! said.contains("Couldn't load") || said.contains("No contacts yet"))
            throw new AssertionError("A book that couldn't be loaded should say so, not look empty: " + said);
        Object count = AddressBookTest.inFrame(d, "const c = document.querySelector('#bookList .list-row[aria-current=\"true\"] .count'); return c ? c.textContent : 'none'");
        if (! "none".equals(String.valueOf(count)))
            throw new AssertionError("A book that couldn't be loaded should show no count: " + count);
        AddressBookTest.inFrame(d, "[...document.querySelectorAll('#contacts button')].find(b => b.textContent.trim() === 'Try again').click(); return 1;");
        AddressBookTest.waitInFrame(d, "the book on trying again", "return [...document.querySelectorAll('#contacts .list-row')].some(r => r.textContent.includes('Imp One')) ? true : null");
        System.out.println("  ok   a book that can't be loaded says so (" + said + "), shows no count, and Try again loads it");
    }

    // Save pressed twice while the first save is on its way stores one contact, not two
    static void doubleSave(WebDriver d, UserContext api, String data) {
        AddressBookTest.inFrame(d, HOLD, "saveCard", null, 1500);
        AddressBookTest.inFrame(d, "document.getElementById('newContactButton').click(); return 1;");
        AddressBookTest.waitInFrame(d, "the new contact form", "return document.querySelector('#detail input[placeholder=\"First name\"]') ? true : null");
        AddressBookTest.inFrame(d, "const i = document.querySelector('#detail input[placeholder=\"First name\"]'); i.value = 'Twice'; i.dispatchEvent(new Event('input'));"
                + " const save = document.querySelector('#detail button[type=submit]'); save.click(); setTimeout(() => save.click(), 300); return 1;");
        AddressBookTest.waitInFrame(d, "the save to finish", "return document.getElementById('status').textContent === 'Saved' ? true : null");
        WebDriver.sleep(3000);
        AddressBookTest.inFrame(d, RELEASE);
        AddressBookTest.waitForStored(api, data + "default", "FN:Twice");
        long stored = AddressBookTest.stored(api, data + "default").stream().filter(c -> c.contains("FN:Twice")).count();
        if (stored != 1)
            throw new AssertionError("Saving a new contact twice in a row should store it once, not " + stored + " times");
        System.out.println("  ok   Save pressed twice while the first is on its way stores the contact once");
    }

    // Another device's change, written to the address book past the app, while it shows the card.
    static void elsewhere(WebDriver d, String script) {
        d.script("window.__wrote = null; " + script + ".then(() => window.__wrote = 'done', e => window.__wrote = 'failed ' + e); return 1;");
        d.waitForScript("the change elsewhere", "window.__wrote != null", 60_000);
        if (! "done".equals(String.valueOf(d.script("return window.__wrote"))))
            throw new IllegalStateException("Could not make the change elsewhere: " + d.script("return window.__wrote"));
    }

    static void edit(WebDriver d, String file, String title) {
        AddressBookTest.inFrame(d, "selectContact(arguments[0]); [...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Edit').click(); return 1;", file);
        AddressBookTest.waitInFrame(d, "the edit form", "return document.querySelector('#detail input[placeholder=\"Job title\"]') ? true : null");
        AddressBookTest.inFrame(d, "const t = document.querySelector('#detail input[placeholder=\"Job title\"]'); t.value = arguments[0]; t.dispatchEvent(new Event('input')); return 1;", title);
    }

    static void answer(WebDriver d, String question, String button) {
        d.waitUntil("Peergos asking " + question, () -> Boolean.TRUE.equals(d.script(
                "const g = document.querySelector('.pg-dialog'); return !!g && g.textContent.includes(arguments[0])", question)) ? true : null, 30_000);
        d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === arguments[0]).click(); return 1;", button);
    }

    static String card(UserContext api, String data, String file) {
        return AddressBookTest.stored(api, data + "default").stream().filter(c -> c.contains("UID:" + file.replace(".vcf", "")))
                .findFirst().orElse("(none)").replace("\r\n", "|");
    }

    static void waitForCard(UserContext api, String data, String file, String text, String what) {
        try {
            AddressBookTest.waitFor(text, () -> card(api, data, file).contains(text));
        } catch (AssertionError e) {
            throw new AssertionError(what + ": " + card(api, data, file));
        }
    }

    // a contact changed elsewhere after it was opened isn't saved over without asking; No keeps
    // the change and shows it, and a save from there keeps both
    static void changedElsewhere(WebDriver d, UserContext api, String data) {
        openBook(d, "default", "Contacts", "Imp Two");
        edit(d, "imp-2.vcf", "Pilot");
        elsewhere(d, "window.__addressBook.writeContactCard('default', 'imp-2.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:imp-2\\r\\nFN:Imp Two\\r\\nN:Two;Imp;;;\\r\\nTEL:+1 555 0102\\r\\nEND:VCARD\\r\\n')");
        AddressBookTest.inFrame(d, "document.querySelector('#detail button[type=submit]').click(); return 1;");
        answer(d, "Imp Two was changed elsewhere", "No");
        AddressBookTest.waitInFrame(d, "the change from elsewhere on show", "return document.getElementById('status').textContent.startsWith('Not saved')"
                + " && document.getElementById('detail').textContent.includes('+1 555 0102') ? true : null");
        // read back until the store shows the change: the api's view can trail the page's by a moment
        waitForCard(api, data, "imp-2.vcf", "TEL:+1 555 0102", "No should keep the change made elsewhere");
        if (card(api, data, "imp-2.vcf").contains("TITLE:Pilot"))
            throw new AssertionError("No should not save this version over the other: " + card(api, data, "imp-2.vcf"));
        edit(d, "imp-2.vcf", "Pilot");
        AddressBookTest.inFrame(d, "document.querySelector('#detail button[type=submit]').click(); return 1;");
        AddressBookTest.waitInFrame(d, "the save", "return document.getElementById('status').textContent === 'Saved' ? true : null");
        if (Boolean.TRUE.equals(d.script("return !!document.querySelector('.pg-dialog')")))
            throw new AssertionError("A save of the card as it is now should not ask");
        AddressBookTest.waitFor("both changes to be stored", () -> card(api, data, "imp-2.vcf").contains("TITLE:Pilot"));
        if (! card(api, data, "imp-2.vcf").contains("TEL:+1 555 0102"))
            throw new AssertionError("The save should keep the change made elsewhere: " + card(api, data, "imp-2.vcf"));
        System.out.println("  ok   a change made elsewhere is asked about, No keeps and shows it, and the next save keeps both");
    }

    // Yes saves over a change made elsewhere, as asked
    static void overwriteWhenAsked(WebDriver d, UserContext api, String data) {
        edit(d, "imp-2.vcf", "Captain");
        elsewhere(d, "window.__addressBook.writeContactCard('default', 'imp-2.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:imp-2\\r\\nFN:Imp Two\\r\\nN:Two;Imp;;;\\r\\nNOTE:from the phone\\r\\nEND:VCARD\\r\\n')");
        AddressBookTest.inFrame(d, "document.querySelector('#detail button[type=submit]').click(); return 1;");
        answer(d, "Imp Two was changed elsewhere", "Yes");
        AddressBookTest.waitFor("the save over it", () -> card(api, data, "imp-2.vcf").contains("TITLE:Captain"));
        if (card(api, data, "imp-2.vcf").contains("from the phone"))
            throw new AssertionError("Yes should save this version over the other: " + card(api, data, "imp-2.vcf"));
        System.out.println("  ok   Yes saves over the change made elsewhere");
    }

    // a contact deleted elsewhere after it was opened is asked about too, and Yes saves it again
    static void deletedElsewhere(WebDriver d, UserContext api, String data) {
        edit(d, "imp-3.vcf", "Back");
        elsewhere(d, "window.__addressBook.deleteContactCard('default', 'imp-3.vcf')");
        AddressBookTest.inFrame(d, "document.querySelector('#detail button[type=submit]').click(); return 1;");
        answer(d, "Imp Three was deleted elsewhere", "Yes");
        AddressBookTest.waitFor("it to be saved again", () -> card(api, data, "imp-3.vcf").contains("TITLE:Back"));
        System.out.println("  ok   a contact deleted elsewhere is asked about, and Yes saves it again");
    }

    // deleting a contact that changed elsewhere since it was opened leaves it, and shows the change
    static void deleteChangedElsewhere(WebDriver d, UserContext api, String data) {
        AddressBookTest.inFrame(d, "selectContact('imp-1.vcf'); return 1;");
        AddressBookTest.waitInFrame(d, "the contact", "return [...document.querySelectorAll('#detail button')].some(b => b.textContent.trim() === 'Delete') ? true : null");
        elsewhere(d, "window.__addressBook.writeContactCard('default', 'imp-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:imp-1\\r\\nFN:Imp One\\r\\nN:One;Imp;;;\\r\\nNOTE:keep me\\r\\nEND:VCARD\\r\\n')");
        AddressBookTest.inFrame(d, "[...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Delete').click(); return 1;");
        answer(d, "Delete Imp One?", "Yes");
        AddressBookTest.waitInFrame(d, "the refusal", "return document.getElementById('status').textContent.startsWith('Not deleted')"
                + " && document.getElementById('detail').textContent.includes('keep me') ? true : null");
        waitForCard(api, data, "imp-1.vcf", "NOTE:keep me", "A contact changed elsewhere should not be deleted");
        System.out.println("  ok   deleting a contact changed elsewhere leaves it, and shows the change");
    }

    static String importAndWait(WebDriver d, String text) {
        AddressBookTest.inFrame(d, "document.getElementById('status').textContent = ''; importText(arguments[0]); return 1;", text);
        return String.valueOf(AddressBookTest.waitInFrame(d, "the import", "const t = document.getElementById('status').textContent; return t.startsWith('Imported') ? t : null"));
    }

    static long count(UserContext api, String bookPath, String text) {
        return AddressBookTest.stored(api, bookPath).stream().filter(c -> c.contains(text)).count();
    }

    // importing a contact that is already there adds nothing, and importing it over one changed
    // since keeps both
    static void importAgain(WebDriver d, UserContext api, String data) {
        openBook(d, "default", "Contacts", "Imp One");
        String original = "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:kb-1\r\nFN:Kept Both\r\nN:Both;Kept;;;\r\nTEL:+1 555 0001\r\nEND:VCARD\r\n";
        String first = importAndWait(d, original);
        String again = importAndWait(d, original);
        AddressBookTest.waitFor("the import to be stored", () -> count(api, data + "default", "FN:Kept Both") >= 1);
        WebDriver.sleep(2000);
        if (count(api, data + "default", "FN:Kept Both") != 1 || ! again.contains("1 already here"))
            throw new AssertionError("Importing a contact again should add nothing: " + again + ", stored " + count(api, data + "default", "FN:Kept Both"));
        elsewhere(d, "window.__addressBook.writeContactCard('default', 'kb-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:kb-1\\r\\nFN:Kept Both\\r\\nN:Both;Kept;;;\\r\\nTEL:+1 555 0002\\r\\nEND:VCARD\\r\\n')");
        String over = importAndWait(d, original);
        AddressBookTest.waitFor("both versions to be stored", () -> count(api, data + "default", "FN:Kept Both") == 2);
        if (count(api, data + "default", "TEL:+1 555 0002") != 1 || count(api, data + "default", "TEL:+1 555 0001") != 1)
            throw new AssertionError("Both versions should be kept: " + AddressBookTest.stored(api, data + "default"));
        System.out.println("  ok   an import adds and never replaces (" + first + " / " + again + " / " + over + ")");
    }

    // moving a contact into a book where its file name holds another contact keeps both
    static void moveBesideTwin(WebDriver d, UserContext api, String data) {
        elsewhere(d, "window.__addressBook.writeContactCard('default', 'twin-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:twin-1\\r\\nFN:Twin Here\\r\\nN:Here;Twin;;;\\r\\nEND:VCARD\\r\\n')"
                + ".then(() => window.__addressBook.writeContactCard('big', 'twin-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:twin-1\\r\\nFN:Twin There\\r\\nN:There;Twin;;;\\r\\nEND:VCARD\\r\\n'))");
        openBook(d, "default", "Contacts", "Twin Here");
        AddressBookTest.inFrame(d, "selectContact('twin-1.vcf'); return 1;");
        AddressBookTest.waitInFrame(d, "the contact's move menu", "return document.querySelector('#detail select') ? true : null");
        AddressBookTest.inFrame(d, "document.getElementById('status').textContent = ''; const m = document.querySelector('#detail select'); m.value = 'big'; m.dispatchEvent(new Event('change')); return 1;");
        Object said = AddressBookTest.waitInFrame(d, "the move", "const t = document.getElementById('status').textContent; return t.startsWith('Moved') ? t : null");
        AddressBookTest.waitFor("both in the target", () -> count(api, data + "big", "FN:Twin") == 2);
        AddressBookTest.waitFor("none left behind", () -> count(api, data + "default", "FN:Twin") == 0);
        System.out.println("  ok   a move into a book where its name is taken keeps both there (" + said + ")");
    }

    // a Yes is to saving over the change it asked about: another made while the question was
    // open is asked about in turn, and No to that keeps it
    static void changedAgainWhileAsked(WebDriver d, UserContext api, String data) {
        openBook(d, "default", "Contacts", "Imp Two");
        edit(d, "imp-2.vcf", "Major");
        elsewhere(d, "window.__addressBook.writeContactCard('default', 'imp-2.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:imp-2\\r\\nFN:Imp Two\\r\\nN:Two;Imp;;;\\r\\nNOTE:first change\\r\\nEND:VCARD\\r\\n')");
        AddressBookTest.inFrame(d, "document.querySelector('#detail button[type=submit]').click(); return 1;");
        d.waitUntil("Peergos asking about the first change", () -> Boolean.TRUE.equals(d.script(
                "const g = document.querySelector('.pg-dialog'); return !!g && g.textContent.includes('Imp Two was changed elsewhere')")) ? true : null, 30_000);
        elsewhere(d, "window.__addressBook.writeContactCard('default', 'imp-2.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:imp-2\\r\\nFN:Imp Two\\r\\nN:Two;Imp;;;\\r\\nNOTE:second change\\r\\nEND:VCARD\\r\\n')");
        d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === 'Yes').click(); return 1;");
        // the first question fades out as the second comes
        WebDriver.sleep(1500);
        answer(d, "Imp Two was changed elsewhere", "No");
        waitForCard(api, data, "imp-2.vcf", "NOTE:second change", "No to the second question should keep the second change");
        if (card(api, data, "imp-2.vcf").contains("TITLE:Major"))
            throw new AssertionError("A Yes to the first change should not save over the second: " + card(api, data, "imp-2.vcf"));
        System.out.println("  ok   a change made while the question was open is asked about too, and No keeps it");
    }

    // a book deleted while it is open, on another device say, isn't brought back by a save into
    // it: the save is refused, and opening the book again says it can't be loaded
    static void deletedBookStaysDeleted(WebDriver d, UserContext api, String data) {
        elsewhere(d, "window.__addressBook.writeAddressBookName('gone', 'Gone')");
        AddressBookTest.inFrame(d, "loadBooks().then(() => openBook('gone')); return 1;");
        AddressBookTest.waitInFrame(d, "the Gone book", "return document.getElementById('bookTitle').textContent === 'Gone'"
                + " && document.getElementById('contacts').textContent.includes('No contacts yet') ? true : null");
        elsewhere(d, "window.__addressBook.deleteAddressBook('gone')");
        AddressBookTest.inFrame(d, "document.getElementById('newContactButton').click();"
                + " const i = document.querySelector('#detail input[placeholder=\"First name\"]'); i.value = 'Ghost'; i.dispatchEvent(new Event('input'));"
                + " document.querySelector('#detail button[type=submit]').click(); return 1;");
        AddressBookTest.waitInFrame(d, "the save to be refused", "return document.getElementById('status').textContent === 'Could not save the contact' ? true : null");
        AddressBookTest.inFrame(d, "openBook('gone'); return 1;");
        AddressBookTest.waitInFrame(d, "the book to say it can't be loaded", "return document.getElementById('contacts').textContent.includes(\"Couldn't load\") ? true : null");
        AddressBookTest.waitFor("the book to stay gone", () -> api.getByPath(data + "gone").join().isEmpty());
        AddressBookTest.inFrame(d, "loadBooks().then(() => openBook('default')); return 1;");
        AddressBookTest.waitInFrame(d, "the default book", "return document.getElementById('bookTitle').textContent === 'Contacts' ? true : null");
        System.out.println("  ok   a book deleted while it is open isn't brought back by a save into it, and says it can't be loaded");
    }

    // an answer still on its way when the view is left goes nowhere, rather than to the frame of the
    // Address Book opened next, which could take it for the answer to a request of its own
    static void answerAfterLeaving(WebDriver d) {
        d.script("window.__leftView = window.__addressBook; return 1;");
        Page.gotoDrive(d);
        Page.gotoView(d, "Address Book", "saveCard", "__addressBook");
        AddressBookTest.waitInFrame(d, "the new view's contacts", "return document.querySelectorAll('#contacts .list-row').length > 0 ? true : null");
        AddressBookTest.inFrame(d, "window.__strays = []; window.addEventListener('message', e => { if (e.data && e.data.stray) window.__strays.push(e.data.requestId); }); return 1;");
        d.script("window.__leftView.post({type: 'answer', requestId: 7, stray: true}); return 1;");
        WebDriver.sleep(1500);
        Object strays = AddressBookTest.inFrame(d, "return window.__strays.length");
        if (! "0".equals(String.valueOf(strays)))
            throw new AssertionError("An answer from a view left behind should not reach the next one's frame: " + strays + " did");
        System.out.println("  ok   an answer from a view left behind doesn't reach the next one's frame");
    }

    /** Runs one case, and carries on to the next if it fails, so a run says which of them hold. */
    static void scenario(List<String> failures, String name, WebDriver d, Runnable body) {
        try {
            // whatever a case that failed part way left held back is let through first
            AddressBookTest.inFrame(d, RELEASE);
            body.run();
        } catch (AssertionError | IllegalStateException e) {
            System.out.println("  FAIL " + name + ": " + e.getMessage());
            failures.add(name);
        }
    }

    static final String SHOWN = "renderContacts(); return JSON.stringify({title: document.getElementById('bookTitle').textContent,"
            + " rows: [...document.querySelectorAll('#contacts .list-row')].map(r => r.textContent.trim())})";

    static void openBook(WebDriver d, String book, String title, String contact) {
        AddressBookTest.inFrame(d, "openBook(arguments[0]); return 1;", book);
        AddressBookTest.waitInFrame(d, "the " + title + " book", "return document.getElementById('bookTitle').textContent === arguments[0]"
                + " && [...document.querySelectorAll('#contacts .list-row')].some(r => r.textContent.includes(arguments[1])) ? true : null", title, contact);
    }

    // some drivers hand json back with its quotes escaped
    static String s(Object o) {
        return String.valueOf(o).replace("\\\"", "\"");
    }
}
