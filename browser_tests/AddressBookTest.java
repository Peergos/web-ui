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
 *  the api rather than trusting the page. Its questions - a name for a new address book, whether
 *  to delete - are asked in Peergos' own dialogs, and closing one without answering changes
 *  nothing. It follows Peergos' theme.
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

                // every contact and address book is a button: Enter on a contact opens it, and the
                // focus stays on its row, now marked as the open one
                d.switchToFrame(FRAME);
                try {
                    d.sendKeys(d.find("#contacts li.card .list-row"), "\uE007");
                } finally {
                    d.switchToTop();
                }
                waitInFrame(d, "the contact opened from the keyboard", "const h = document.querySelector('#detail h1'); return h && h.textContent.includes('Carol Current') ? true : null");
                Object focused = inFrame(d, "const a = document.activeElement; return a && a.classList.contains('list-row') ? a.getAttribute('aria-current') + ' ' + a.textContent.trim() : null");
                if (! String.valueOf(focused).startsWith("true"))
                    throw new AssertionError("The opened contact's row should keep the focus: " + focused);
                Object rows = inFrame(d, "const r = [...document.querySelectorAll('#bookList .list-row, #contacts .list-row')]; return r.every(x => x.tagName === 'BUTTON') ? r.length : 0");
                if (! (rows instanceof Number) || ((Number) rows).intValue() < 2)
                    throw new AssertionError("Every book and contact row should be a button: " + rows);
                System.out.println("  ok   rows are buttons; Enter opens a contact and the focus stays on its row (" + focused + ")");

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
