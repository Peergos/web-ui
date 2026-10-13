import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.user.UserContext;
import peergos.shared.user.fs.AsyncReader;
import peergos.shared.user.fs.FileWrapper;
import peergos.shared.util.PathUtil;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Address Book, in the navigation like Calendar, on a subdomain of its own.
 *
 *  It shows what is already stored where phones, CardDAV clients and the Custom Apps version of
 *  it put contacts, and what it saves lands there: every check reads the stored files back over
 *  the api rather than trusting the page. Its questions - a name for a new or renamed address
 *  book, whether to delete a contact or a whole book - are asked in Peergos' own dialogs, and
 *  closing one without answering changes nothing. It follows Peergos' theme.
 *
 *  Usage: java -cp ../server/Peergos.jar AddressBookTest.java [engine] [peergos url]
 */
public class AddressBookTest {

    static final String FRAME = "#address-book-iframe";
    static final String PASSWORD = "testpassword";

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
        String me = "abook" + (System.currentTimeMillis() % 100000);
        try {
            NoAppsYetTest.signUp(url, me, crypto);
            UserContext api = NewsFeedViewTest.signInApi(url, me, crypto);
            String data = me + "/.apps/contacts/data/";
            // a contact as the Custom Apps version, a phone or a CardDAV client stored it
            store(api, ".apps/contacts/data/default", "carol-1.vcf",
                    "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:carol-1\r\nFN:Carol Current\r\nN:Current;Carol;;;\r\nTEL;TYPE=CELL:+44 20 7946 0001\r\nEND:VCARD\r\n");
            // one with only a formatted name, as some exporters write
            store(api, ".apps/contacts/data/default", "acme-1.vcf",
                    "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:acme-1\r\nFN:Acme Support\r\nTEL:+1 555 0100\r\nEND:VCARD\r\n");

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-addressbook-"), headless)) {
                d.setWindowRect(1280, 900);
                NewsFeedViewTest.signIn(d, url, me);
                Page.gotoView(d, "Address Book", "saveCard", "__addressBook");
                Object shown = waitInFrame(d, "the stored contact", "const l = [...document.querySelectorAll('#contacts li')].map(x => x.textContent.trim()).join('|');"
                        + " return l.includes('Carol Current') ? l : null");
                System.out.println("  ok   the navigation opens Address Book, on the contact already stored (" + shown + ")");
                Object origin = inFrame(d, "return location.host");
                if (! String.valueOf(origin).startsWith("address-book."))
                    throw new AssertionError("Address Book should run on its own subdomain, not " + origin);
                System.out.println("  ok   it runs on its own subdomain (" + origin + ")");

                // its menu row stays in reach in a short window - a laptop's, once the browser's
                // own bars are off it - and in a phone's panel held sideways
                String row = "const row = [...document.querySelectorAll('.app-navigation .menu-item')].find(m => m.textContent.includes('Address Book'));";
                pageHeight(d, 1366, 610);
                Object reach = d.waitUntil("the short window", () -> d.scriptQuiet(row
                        + " const r = row.getBoundingClientRect(), s = document.querySelector('.app-navigation .navigation-storage').getBoundingClientRect();"
                        + " const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);"
                        + " return innerHeight < 640 ? (r.bottom <= innerHeight && s.bottom <= innerHeight + 1 && hit && row.contains(hit) ? 'in reach'"
                        + "   : 'row ' + Math.round(r.top) + '-' + Math.round(r.bottom) + ', storage to ' + Math.round(s.bottom) + ', window ' + innerHeight) : null"), 30_000);
                if (! "in reach".equals(reach))
                    throw new AssertionError("Address Book's menu row should be in reach in a short window: " + reach);
                Object laptop = d.script("return innerWidth + 'x' + innerHeight");
                pageHeight(d, 844, 390);
                MobileNavTest.toggleSidebar(d);
                Object panel = d.waitUntil("the phone's panel", () -> d.scriptQuiet(row
                        + " if (innerWidth > 1024 || ! document.querySelector('.app-navigation.expanded')) return null;"
                        + " row.scrollIntoView({block: 'nearest'});"
                        + " const r = row.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);"
                        + " return r.top >= 0 && r.bottom <= innerHeight && hit && row.contains(hit) ? 'in reach'"
                        + "   : 'row ' + Math.round(r.top) + '-' + Math.round(r.bottom) + ', window ' + innerHeight"), 30_000);
                if (! "in reach".equals(panel))
                    throw new AssertionError("Address Book's menu row should be in reach in a phone's panel held sideways: " + panel);
                Object phone = d.script("return innerWidth + 'x' + innerHeight");
                MobileNavTest.toggleSidebar(d);
                d.setWindowRect(1280, 900);
                System.out.println("  ok   its menu row is in reach in a short window (" + laptop + ") and in a phone's panel held sideways (" + phone + ")");

                // every contact and address book is a button: Enter on a contact opens it, and the
                // focus stays on its row, now marked as the open one. Where the driver can't type
                // into the frame, the row is clicked from the page instead, and the focus, which a
                // click doesn't give a button in WebKit, isn't asked about.
                boolean keys = canTypeInFrame(engine);
                Object firstName = inFrame(d, "return document.querySelector('#contacts li.card .list-row .names div').textContent");
                if (keys) {
                    d.switchToFrame(FRAME);
                    try {
                        d.sendKeys(d.find("#contacts li.card .list-row"), "\uE007");
                    } finally {
                        d.switchToTop();
                    }
                } else {
                    inFrame(d, "document.querySelector('#contacts li.card .list-row').click(); return 1;");
                }
                waitInFrame(d, "the contact opened from its row", "const h = document.querySelector('#detail h1'); return h && h.textContent === arguments[0] ? true : null", firstName);
                Object focused = keys ? inFrame(d, "const a = document.activeElement; return a && a.classList.contains('list-row') ? a.getAttribute('aria-current') + ' ' + a.textContent.trim() : null") : "not asked";
                if (keys && ! String.valueOf(focused).startsWith("true"))
                    throw new AssertionError("The opened contact's row should keep the focus: " + focused);
                Object rows = inFrame(d, "const r = [...document.querySelectorAll('#bookList .list-row, #contacts .list-row')]; return r.every(x => x.tagName === 'BUTTON') ? r.length : 0");
                if (! (rows instanceof Number) || ((Number) rows).intValue() < 2)
                    throw new AssertionError("Every book and contact row should be a button: " + rows);
                // read out by their names: the picker and the search are labelled, and a row's initials aren't read
                Object labelled = inFrame(d, "return !!document.getElementById('search').getAttribute('aria-label') && !!document.getElementById('bookSelect').getAttribute('aria-label')"
                        + " && [...document.querySelectorAll('#contacts .list-row .avatar')].every(a => a.getAttribute('aria-hidden') === 'true' || a.getAttribute('alt') === '')");
                if (! Boolean.TRUE.equals(labelled))
                    throw new AssertionError("The search and the book picker should be labelled, and a row read as its name alone");
                System.out.println("  ok   rows are buttons; " + (keys ? "Enter opens a contact and the focus stays on its row (" + focused + ")" : "a click opens a contact")
                        + "; the search and picker are labelled");

                // a contact with only a formatted name shows it in the form, and saves with a change
                inFrame(d, "selectContact('acme-1.vcf'); [...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Edit').click(); return 1;");
                Object first = waitInFrame(d, "the edit form", "const i = document.querySelector('#detail input[placeholder=\"First name\"]'); return i ? i.value : null");
                if (! "Acme Support".equals(String.valueOf(first)))
                    throw new AssertionError("A contact with only a formatted name should show it in the form, not " + first);
                inFrame(d, "const t = document.querySelector('#detail input[placeholder=\"Job title\"]'); t.value = 'Helpdesk'; t.dispatchEvent(new Event('input'));"
                        + " document.querySelector('#detail button[type=submit]').click(); return 1;");
                String acme = waitForStored(api, data + "default", "TITLE:Helpdesk");
                if (! acme.contains("FN:Acme Support"))
                    throw new AssertionError("Its name should be kept: " + acme);
                System.out.println("  ok   a contact with only a formatted name shows it in the form, and saves a change (" + firstLine(acme, "FN:") + ")");

                // a new contact, typed in and saved, is stored where everything else reads it
                inFrame(d, "document.getElementById('newContactButton').click(); return 1;");
                inFrame(d, "const i = document.querySelector('#detail input[placeholder=\"First name\"]'); i.value = 'Dee'; i.dispatchEvent(new Event('input'));"
                        + " const f = document.querySelector('#detail input[placeholder=\"Last name\"]'); f.value = 'Saved'; f.dispatchEvent(new Event('input'));"
                        + " document.querySelector('#detail button[type=submit]').click(); return 1;");
                String saved = waitForStored(api, data + "default", "FN:Dee Saved");
                System.out.println("  ok   a new contact is stored in the address book (" + firstLine(saved, "FN:") + ")");

                // a new address book: its name is asked for in Peergos' own dialog
                inFrame(d, "document.getElementById('newBookButton').click(); return 1;");
                d.waitForScript("Peergos' name dialog", "!!document.getElementById('prompt-input')", 30_000);
                CustomGroupsTest.setInput(d, "#prompt-input", "Work");
                d.script("document.getElementById('prompt-button-id').click(); return 1;");
                waitInFrame(d, "the new address book", "return [...document.querySelectorAll('#bookList li')].some(l => l.textContent.includes('Work')) ? true : null");
                waitFor("the new address book's name to be stored", () -> bookNames(api, data).contains("\"name\":\"Work\""));
                String books = bookNames(api, data);
                System.out.println("  ok   a new address book is named in Peergos' dialog, and stored (" + books + ")");

                // renaming starts from the current name; closing the dialog keeps it
                inFrame(d, "document.getElementById('renameBookButton').click(); return 1;");
                d.waitForScript("Peergos' rename dialog", "!!document.getElementById('prompt-input')", 30_000);
                Object offered = d.script("return document.getElementById('prompt-input').value");
                if (! "Work".equals(offered))
                    throw new AssertionError("The rename dialog should start from the current name, not: " + offered);
                d.script("document.querySelector('.app-prompt .pg-dialog__close').click(); return 1;");
                d.waitForScript("the rename dialog to close", "!document.getElementById('prompt-input')", 10_000);
                WebDriver.sleep(1500);
                if (! bookNames(api, data).equals(books))
                    throw new AssertionError("Closing the rename dialog should keep the name: " + bookNames(api, data));
                // a name is the user's own text: stored as typed, and shown as text
                String renamed = "Work & <b>Home</b> $&";
                inFrame(d, "document.getElementById('renameBookButton').click(); return 1;");
                d.waitForScript("Peergos' rename dialog", "!!document.getElementById('prompt-input')", 30_000);
                CustomGroupsTest.setInput(d, "#prompt-input", renamed);
                d.script("document.getElementById('prompt-button-id').click(); return 1;");
                waitInFrame(d, "the new name", "return document.getElementById('bookTitle').textContent === arguments[0]"
                        + " && [...document.querySelectorAll('#bookList li')].some(l => l.textContent.includes(arguments[0])) ? true : null", renamed);
                waitFor("the new name to be stored", () -> bookNames(api, data).equals("{\"name\":\"" + renamed + "\"}"));
                if (Boolean.TRUE.equals(inFrame(d, "return !!document.querySelector('#bookList b, #bookTitle b')")))
                    throw new AssertionError("A book's name should be shown as text");
                System.out.println("  ok   renaming starts from the current name, closing keeps it, and the new one is stored and shown as typed");

                // deleting an address book asks first, naming it; closing the question or No keeps it and its contacts
                String work = String.valueOf(inFrame(d, "return document.getElementById('bookSelect').value"));
                if (work.equals("default"))
                    throw new AssertionError("The new address book should be the one open");
                // a contact made here goes into the book that's open
                inFrame(d, "document.getElementById('newContactButton').click(); return 1;");
                inFrame(d, "const i = document.querySelector('#detail input[placeholder=\"First name\"]'); i.value = 'Wendy'; i.dispatchEvent(new Event('input'));"
                        + " const f = document.querySelector('#detail input[placeholder=\"Last name\"]'); f.value = 'Work'; f.dispatchEvent(new Event('input'));"
                        + " document.querySelector('#detail button[type=submit]').click(); return 1;");
                waitForStored(api, data + work, "FN:Wendy Work");
                waitInFrame(d, "the book's contact", "return [...document.querySelectorAll('#contacts li')].some(l => l.textContent.includes('Wendy Work')) ? true : null");
                // the question names the book, and counts its contacts, as stored, whatever the
                // frame asking says
                inFrame(d, "host('deleteBook', {book: arguments[0], name: 'Something else'}); return 1;", work);
                d.waitForScript("Peergos' confirmation", "!!document.getElementById('confirm-header-id')", 30_000);
                Object named = d.script("const t = document.getElementById('confirm-header-id').textContent.trim(),"
                        + " b = document.getElementById('confirm-body-id').textContent.trim();"
                        + " return t === arguments[0] && b.includes('the contact in it') ? 'as stored' : t + ' / ' + b", "Delete " + renamed + "?");
                if (! "as stored".equals(named))
                    throw new AssertionError("The delete question should name the book, and count its contacts, as stored: " + named);
                d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === 'No').click(); return 1;");
                d.waitForScript("the confirmation to close", "!document.getElementById('confirm-header-id')", 10_000);
                for (String answer : new String[] {"close", "No"}) {
                    inFrame(d, "document.getElementById('deleteBookButton').click(); return 1;");
                    d.waitForScript("Peergos' confirmation", "!!document.getElementById('confirm-header-id')", 30_000);
                    // compared in the page, as chromium's driver hands back a < escaped
                    Object asked = d.script("const t = document.getElementById('confirm-header-id').textContent.trim(); return t === arguments[0] ? 'named' : t",
                            "Delete " + renamed + "?");
                    if (! "named".equals(asked))
                        throw new AssertionError("The confirmation should name the address book, not: " + asked);
                    if (answer.equals("close"))
                        d.script("document.querySelector('.pg-dialog .pg-dialog__close').click(); return 1;");
                    else
                        d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === 'No').click(); return 1;");
                    d.waitForScript("the confirmation to close", "!document.getElementById('confirm-header-id')", 10_000);
                    WebDriver.sleep(1500);
                    if (stored(api, data + work).stream().noneMatch(c -> c.contains("FN:Wendy Work")))
                        throw new AssertionError("Answering the delete question with " + answer + " should keep the address book and its contact");
                }
                System.out.println("  ok   deleting an address book asks first, naming it and counting its contacts as stored; closing the question or No keeps it and its contacts");
                inFrame(d, "document.getElementById('deleteBookButton').click(); return 1;");
                d.waitForScript("Peergos' confirmation", "!!document.getElementById('confirm-header-id')", 30_000);
                d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === 'Yes').click(); return 1;");
                waitFor("the address book to be deleted", () -> api.getByPath(data + work).join().isEmpty());
                if (stored(api, data + "default").stream().noneMatch(c -> c.contains("FN:Carol Current")))
                    throw new AssertionError("Deleting an address book should leave the others");
                waitInFrame(d, "the default book, with the deleted one gone",
                        "return document.getElementById('deleteBookButton').disabled"
                                + " && ! [...document.querySelectorAll('#bookList li')].some(l => l.textContent.includes('Work &'))"
                                + " && [...document.querySelectorAll('#contacts li')].some(l => l.textContent.includes('Carol Current')) ? true : null");
                System.out.println("  ok   Yes deletes the address book and its contacts, and only it; the default one opens, and can't be deleted");

                // deleting asks first, in Peergos' dialog; closing it keeps the contact
                inFrame(d, "document.querySelector('#bookList .list-row').click(); return 1;");
                waitInFrame(d, "the default book again", "return [...document.querySelectorAll('#contacts li')].some(l => l.textContent.includes('Dee Saved')) ? true : null");
                inFrame(d, "[...document.querySelectorAll('#contacts .list-row')].find(l => l.textContent.includes('Dee Saved')).click(); return 1;");
                waitInFrame(d, "the contact's page", "return [...document.querySelectorAll('#detail button')].some(b => b.textContent.trim() === 'Delete') ? true : null");
                inFrame(d, "[...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Delete').click(); return 1;");
                d.waitForScript("Peergos' confirmation", "!!document.querySelector('.pg-dialog') && document.querySelector('.pg-dialog').textContent.includes('Delete Dee Saved?')", 30_000);
                d.script("document.querySelector('.pg-dialog .pg-dialog__close').click(); return 1;");
                d.waitForScript("the confirmation to close", "!document.querySelector('.pg-dialog')", 10_000);
                WebDriver.sleep(1500);
                if (stored(api, data + "default").stream().noneMatch(c -> c.contains("FN:Dee Saved")))
                    throw new AssertionError("Closing the confirmation should keep the contact");
                System.out.println("  ok   closing the delete confirmation keeps the contact");
                inFrame(d, "[...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Delete').click(); return 1;");
                d.waitForScript("Peergos' confirmation", "!!document.querySelector('.pg-dialog')", 30_000);
                d.script("[...document.querySelectorAll('.pg-dialog button')].find(b => b.textContent.trim() === 'Yes').click(); return 1;");
                waitFor("the contact to be deleted", () -> stored(api, data + "default").stream().noneMatch(c -> c.contains("FN:Dee Saved")));
                if (stored(api, data + "default").stream().noneMatch(c -> c.contains("FN:Carol Current")))
                    throw new AssertionError("Deleting one contact should leave the others");
                System.out.println("  ok   Yes deletes the contact, and only it");

                // search narrows the list by name or phone; clearing it shows everyone again
                String names = "return [...document.querySelectorAll('#contacts .list-row')].map(r => r.textContent.trim()).join('|')";
                for (String query : new String[] {"current", "7946 0001"}) {
                    inFrame(d, "const s = document.getElementById('search'); s.value = arguments[0]; s.dispatchEvent(new Event('input')); return 1;", query);
                    Object found = inFrame(d, names);
                    if (! String.valueOf(found).contains("Carol Current") || String.valueOf(found).contains("Acme"))
                        throw new AssertionError("Searching '" + query + "' should find Carol Current alone, not: " + found);
                }
                inFrame(d, "const s = document.getElementById('search'); s.value = ''; s.dispatchEvent(new Event('input')); return 1;");
                Object everyone = inFrame(d, names);
                if (! String.valueOf(everyone).contains("Carol Current") || ! String.valueOf(everyone).contains("Acme Support"))
                    throw new AssertionError("Clearing the search should show everyone: " + everyone);
                System.out.println("  ok   search narrows the list by name or phone, and clearing it shows everyone");

                // Cancel leaves a contact as it was
                String carol = stored(api, data + "default").stream().filter(c -> c.contains("UID:carol-1")).findFirst().orElseThrow();
                inFrame(d, "selectContact('carol-1.vcf'); [...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Edit').click(); return 1;");
                waitInFrame(d, "the edit form", "return document.querySelector('#detail input[placeholder=\"First name\"]') ? true : null");
                inFrame(d, "const i = document.querySelector('#detail input[placeholder=\"First name\"]'); i.value = 'Changed'; i.dispatchEvent(new Event('input'));"
                        + " [...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Cancel').click(); return 1;");
                waitInFrame(d, "the contact's page again", "const h = document.querySelector('#detail h1'); return h && h.textContent === 'Carol Current' ? true : null");
                WebDriver.sleep(1500);
                if (! stored(api, data + "default").contains(carol))
                    throw new AssertionError("Cancel should leave the contact as it was: " + stored(api, data + "default"));
                System.out.println("  ok   Cancel leaves a contact as it was");

                // on a phone: a contact on its own page with Back, and the address books in a picker
                d.setWindowRect(390, 844);
                String visible = "const shown = id => document.getElementById(id).getClientRects().length > 0; ";
                waitInFrame(d, "the contact on its own", visible + "return ! shown('list') && ! shown('books')"
                        + " && document.querySelector('#detail .back').getClientRects().length > 0 ? true : null");
                inFrame(d, "document.querySelector('#detail .back').click(); return 1;");
                waitInFrame(d, "the list, with the picker", visible + "return shown('list') && ! shown('detail') && shown('bookSelect') ? true : null");
                // picking "+ New address book" asks for a name; closing that leaves the picker on the open book
                inFrame(d, "const s = document.getElementById('bookSelect'); s.value = '__new__'; s.dispatchEvent(new Event('change')); return 1;");
                d.waitForScript("Peergos' name dialog", "!!document.getElementById('prompt-input')", 30_000);
                d.script("document.querySelector('.app-prompt .pg-dialog__close').click(); return 1;");
                d.waitForScript("the name dialog to close", "!document.getElementById('prompt-input')", 10_000);
                Object picked = inFrame(d, "return document.getElementById('bookSelect').value");
                if (! "default".equals(picked))
                    throw new AssertionError("The picker should stay on the open address book, not: " + picked);
                Object width = inFrame(d, "return innerWidth");
                if (Boolean.TRUE.equals(inFrame(d, "return document.documentElement.scrollWidth > innerWidth + 1")))
                    throw new AssertionError("Nothing should scroll sideways at " + width + "px");
                d.setWindowRect(1280, 900);
                System.out.println("  ok   narrow (" + width + "px): the address books in a picker, a contact on its own page with Back, nothing sideways");

                // Peergos' theme reaches it, without a reload
                Object before = inFrame(d, "return document.documentElement.getAttribute('data-theme')");
                d.script("document.querySelector('.toggle-theme').click(); return 1;");
                Object after = waitInFrame(d, "the theme to change", "const t = document.documentElement.getAttribute('data-theme'); return t !== arguments[0] ? t : null", before);
                d.script("document.querySelector('.toggle-theme').click(); return 1;");
                System.out.println("  ok   it follows Peergos' theme (" + before + " -> " + after + ")");

                if (Boolean.TRUE.equals(d.script("return !!document.querySelector('.address-book-view__failed')")))
                    throw new AssertionError("The view should not say Address Book didn't start");
                Object errors = d.script("return [...document.querySelectorAll('.Vue-Toastification__toast--error')].map(t => t.textContent.trim()).join(' | ')");
                if (! String.valueOf(errors).isEmpty())
                    throw new AssertionError("No error should show: " + errors);
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static void store(UserContext api, String dir, String name, String text) {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        FileWrapper folder = api.getUserRoot().join().getOrMkdirs(PathUtil.get(dir), api.network, false, api.mirrorBatId(), api.crypto).join();
        folder.uploadOrReplaceFile(name, new AsyncReader.ArrayBacked(bytes), bytes.length, api.network, api.crypto, () -> false, x -> {}).join();
    }

    /** Every card in a book, as stored. */
    static List<String> stored(UserContext api, String bookPath) {
        Optional<FileWrapper> dir = api.getByPath(bookPath).join();
        if (dir.isEmpty())
            return List.of();
        List<String> cards = new ArrayList<>();
        for (FileWrapper f : dir.get().getChildren(api.crypto.hasher, api.network).join()) {
            if (f.getName().endsWith(".vcf")) {
                try {
                    cards.add(new String(NoAppsYetTest.read(api, bookPath + "/" + f.getName()), StandardCharsets.UTF_8));
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }
        }
        return cards;
    }

    static String waitForStored(UserContext api, String bookPath, String text) {
        long until = System.currentTimeMillis() + 60_000;
        while (System.currentTimeMillis() < until) {
            Optional<String> card = stored(api, bookPath).stream().filter(c -> c.contains(text)).findFirst();
            if (card.isPresent())
                return card.get();
            WebDriver.sleep(1000);
        }
        throw new AssertionError("Nothing stored in " + bookPath + " with " + text + ": " + stored(api, bookPath));
    }

    /** Each book's addressbook.inf, as stored. */
    static String bookNames(UserContext api, String dataPath) {
        List<String> names = new ArrayList<>();
        for (FileWrapper book : api.getByPath(dataPath).join().get().getChildren(api.crypto.hasher, api.network).join()) {
            try {
                if (api.getByPath(dataPath + book.getName() + "/addressbook.inf").join().isPresent())
                    names.add(new String(NoAppsYetTest.read(api, dataPath + book.getName() + "/addressbook.inf"), StandardCharsets.UTF_8));
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
        return String.join(", ", names);
    }

    static String firstLine(String card, String prefix) {
        return Arrays.stream(card.split("\r\n")).filter(l -> l.startsWith(prefix)).findFirst().orElse("");
    }

    static void waitFor(String what, java.util.function.BooleanSupplier done) {
        long until = System.currentTimeMillis() + 60_000;
        while (! done.getAsBoolean()) {
            if (System.currentTimeMillis() > until)
                throw new AssertionError("Timed out waiting for " + what);
            WebDriver.sleep(1000);
        }
    }

    /** A window of the given width whose page is the given height. What a window's frame takes
     *  differs between engines and needn't stay the same once the window is resized - Brave's page
     *  came out 136px short of what the frame measured beforehand allowed for - so the page is
     *  measured after each resize and the window corrected by the difference. */
    static void pageHeight(WebDriver d, int width, int height) {
        int window = height + ((Number) d.script("return window.outerHeight - window.innerHeight")).intValue();
        for (int i = 0; i < 4; i++) {
            d.setWindowRect(width, window);
            int missing = height - ((Number) d.script("return window.innerHeight")).intValue();
            if (missing == 0)
                return;
            window += missing;
        }
    }

    /** WebKitGTK's driver can't type into a frame from another origin: nothing in it is focusable
     *  to it, a text field included. Safari's driver is WebKit's too, and is taken to be the same. */
    static boolean canTypeInFrame(String engine) {
        Browsers.Engine e = Browsers.engine(engine);
        return e != Browsers.Engine.WEBKIT && e != Browsers.Engine.SAFARI;
    }

    /** What the import's file picker would hand the page, for a driver that can't give a file input
     *  a file (see Page.canDriveFilePicker): each [name, text] as a file. */
    static void handFiles(WebDriver d, List<List<String>> files) {
        inFrame(d, "importFiles({files: arguments[0].map(f => new File([f[1]], f[0])), value: ''}); return 1;", files);
    }

    /** A script run in the app's own page, inside its frame. */
    static Object inFrame(WebDriver d, String body, Object... args) {
        d.switchToFrame(FRAME);
        try {
            return d.script(body, args);
        } finally {
            d.switchToTop();
        }
    }

    static Object waitInFrame(WebDriver d, String what, String body, Object... args) {
        return d.waitUntil(what, () -> {
            try {
                return inFrame(d, body, args);
            } catch (RuntimeException e) {
                return null;
            }
        }, 60_000);
    }
}
