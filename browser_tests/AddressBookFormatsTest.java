import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.user.UserContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Address Book reads and writes vCards as other apps write them.
 *
 *  A file is imported through the app's own Import button, as a person would, and what is stored
 *  is read back over the api: nothing in it is lost or garbled on the way in.
 *
 *  Usage: java -cp ../server/Peergos.jar AddressBookFormatsTest.java [engine] [peergos url]
 */
public class AddressBookFormatsTest {

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
        String me = "abformat" + (System.currentTimeMillis() % 100000);
        try {
            NoAppsYetTest.signUp(url, me, crypto);
            UserContext api = NewsFeedViewTest.signInApi(url, me, crypto);
            String book = me + "/.apps/contacts/data/default";
            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-abformat-"), headless)) {
                d.setWindowRect(1280, 900);
                NewsFeedViewTest.signIn(d, url, me);
                Page.gotoView(d, "Address Book", "saveCard", "__addressBook");
                AddressBookTest.waitInFrame(d, "the app", "return document.getElementById('bookTitle').textContent === 'Contacts' ? true : null");
                List<String> failures = new ArrayList<>();
                AddressBookSafetyTest.scenario(failures, "quotedPrintable", d, () -> quotedPrintable(d, api, book));
                AddressBookSafetyTest.scenario(failures, "quotedPrintableByType", d, () -> quotedPrintableByType(d, api, book));
                AddressBookSafetyTest.scenario(failures, "everyCard", d, () -> everyCard(d, api, book));
                AddressBookSafetyTest.scenario(failures, "editsKeep", d, () -> editsKeep(d, api, book));
                AddressBookSafetyTest.scenario(failures, "editsKeepMore", d, () -> editsKeepMore(d, api, book));
                AddressBookSafetyTest.scenario(failures, "unreadable", d, () -> unreadable(d, api, book));
                if (! failures.isEmpty())
                    throw new AssertionError("Failed: " + String.join("; ", failures));
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    // vCard 2.1 as Android's own contacts export writes it: any value that isn't plain ASCII is
    // quoted-printable, every byte as =XX, with a soft line break after every 23 of them
    static String qp(String s) {
        StringBuilder out = new StringBuilder();
        int n = 0;
        for (byte b : s.getBytes(StandardCharsets.UTF_8)) {
            out.append(String.format("=%02X", b & 0xff));
            if (++n % 23 == 0)
                out.append("=\r\n");
        }
        return out.toString();
    }

    static String android(String uid, String name, String given, String family, String note) {
        return String.join("\r\n", "BEGIN:VCARD", "VERSION:2.1",
                "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:" + qp(family) + ";" + qp(given) + ";;;",
                "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:" + qp(name),
                "TEL;CELL:+33 6 12 34 56 78",
                "NOTE;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:" + qp(note),
                "UID:" + uid,
                "END:VCARD", "");
    }

    static String importFile(WebDriver d, String name, String text) {
        try {
            Path file = Temp.directory("peergos-abformat-file-").resolve(name);
            Files.writeString(file, text);
            AddressBookTest.inFrame(d, "document.getElementById('status').textContent = ''; return 1;");
            d.switchToFrame(AddressBookTest.FRAME);
            try {
                d.sendKeys(d.find("#importFile"), file.toAbsolutePath().toString());
            } finally {
                d.switchToTop();
            }
            return String.valueOf(AddressBookTest.waitInFrame(d, "the import", "const t = document.getElementById('status').textContent; return t.startsWith('Imported') ? t : null"));
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    static String stored(UserContext api, String book, String uid) {
        String found = AddressBookTest.waitForStored(api, book, "UID:" + uid);
        // unfolded first: a long line is stored folded, as vCard allows
        return found.replace("\r\n ", "").replace("\r\n", "|");
    }

    static String storedLine(UserContext api, String book, String uid, String prefix, String expected) {
        try {
            AddressBookTest.waitFor(uid + " to be stored with " + expected, () -> stored(api, book, uid).contains("|" + expected + "|"));
        } catch (AssertionError e) {
            // said below, with what is there
        }
        return Arrays.stream(stored(api, book, uid).split("\\|")).filter(l -> l.startsWith(prefix)).findFirst().orElse("(none)");
    }

    static void editAndSave(WebDriver d, String file, String change) {
        AddressBookTest.inFrame(d, "selectContact(arguments[0]); [...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Edit').click(); return 1;", file);
        AddressBookTest.waitInFrame(d, "the edit form", "return document.querySelector('#detail form') ? true : null");
        AddressBookTest.inFrame(d, "document.getElementById('status').textContent = ''; " + change
                + " document.querySelector('#detail button[type=submit]').click(); return 1;");
        AddressBookTest.waitInFrame(d, "the save", "return document.getElementById('status').textContent === 'Saved' ? true : null");
    }

    // An import reads every card a file has, as files are found: one cut short before the next,
    // one after a byte order mark where two exports were joined, a quoted-printable value ending
    // the card on a soft break, and a vCard 2.1 AGENT's card inside another.
    static void everyCard(WebDriver d, UserContext api, String book) {
        String file = String.join("\r\n",
                "BEGIN:VCARD", "VERSION:3.0", "UID:cut-1", "FN:Cut Short",
                "BEGIN:VCARD", "VERSION:3.0", "UID:whole-1", "FN:Whole One", "END:VCARD",
                "﻿BEGIN:VCARD ", "VERSION:3.0", "UID:bom-1", "FN:Bom Start", "END:VCARD",
                "BEGIN:VCARD", "VERSION:2.1", "UID:soft-1", "FN:Soft Break", "NOTE;ENCODING=QUOTED-PRINTABLE:=41=42=", "END:VCARD",
                "BEGIN:VCARD", "VERSION:2.1", "UID:boss-1", "FN:Big Boss", "AGENT:",
                "BEGIN:VCARD", "VERSION:2.1", "FN:Assistant", "END:VCARD",
                "EMAIL:boss@example.org", "END:VCARD", "");
        String said = importFile(d, "joined.vcf", file);
        String[][] wanted = {{"cut-1", "FN:Cut Short"}, {"whole-1", "FN:Whole One"}, {"bom-1", "FN:Bom Start"},
                {"soft-1", "NOTE:AB"}, {"boss-1", "EMAIL:boss@example.org"}};
        for (String[] w : wanted) {
            String card = "|" + stored(api, book, w[0]) + "|";
            if (! card.contains("|" + w[1] + "|"))
                throw new AssertionError("Every card in the file should be imported whole, " + w[0] + " with " + w[1] + ": " + card);
        }
        if (AddressBookTest.stored(api, book).stream().anyMatch(c -> c.contains("FN:Assistant") && ! c.contains("Big Boss")))
            throw new AssertionError("An AGENT's own card should stay inside its card, not become a contact of its own");
        System.out.println("  ok   an import reads every card a file has, cut short, joined, ending on a soft break, or holding another (" + said + ")");
    }

    // Each decoded value is written back for what it is: a link as it was, a list's items and the
    // parts of Android's own fields each on their own - the separators encoded with the rest, as
    // Android encodes every byte - a ; Android escaped as one, and 2.1's shorthands the 3.0 way.
    static void quotedPrintableByType(WebDriver d, UserContext api, String book) {
        String card21 = String.join("\r\n", "BEGIN:VCARD", "VERSION:2.1",
                "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:" + qp("Zoë Byté"),
                "NOTE;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:" + qp("a\\;b é"),
                "CATEGORIES;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:" + qp("Família,Work"),
                "URL;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:" + qp("https://example.com/ü?a=1,2;b"),
                "X-ANDROID-CUSTOM;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:" + qp("vnd.android.cursor.item/nickname;Zoë;1;;;;;;;;;;;;;"),
                "TEL;CELL:+1 555 0123",
                "UID:qp-3",
                "END:VCARD", "");
        importFile(d, "android-fields.vcf", card21);
        AddressBookTest.waitInFrame(d, "Zoë Byté in the list", "return [...document.querySelectorAll('#contacts .list-row')].some(r => r.textContent.includes('Zoë Byté')) ? true : null");
        String card = "|" + stored(api, book, "qp-3") + "|";
        String[] wanted = {"VERSION:3.0", "FN:Zoë Byté", "NOTE:a\\;b é", "CATEGORIES:Família,Work", "URL:https://example.com/ü?a=1,2;b",
                "X-ANDROID-CUSTOM:vnd.android.cursor.item/nickname;Zoë;1;;;;;;;;;;;;;", "TEL;TYPE=CELL:+1 555 0123"};
        List<String> missing = Arrays.stream(wanted).filter(w -> ! card.contains("|" + w + "|")).collect(java.util.stream.Collectors.toList());
        if (! missing.isEmpty() || card.toUpperCase().contains("QUOTED-PRINTABLE"))
            throw new AssertionError("Each decoded value should be written back for what it is, missing " + missing + ": " + card);
        System.out.println("  ok   a decoded link, list, Android field, escaped ; and 2.1 shorthand are each written back for what they are");
    }

    // An edit keeps the second of what the form shows the first of - another company, title or
    // note, the name in another language - and a changed value keeps its group and parameters:
    // the label an app tied to a website, a note's language. A changed name is written whole,
    // with the parts of it the form doesn't show.
    static void editsKeepMore(WebDriver d, UserContext api, String book) {
        AddressBookSafetyTest.elsewhere(d, "window.__addressBook.writeContactCard('default', 'multi-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:multi-1"
                + "\\r\\nN:Smith;John;Quincy;Dr.;Jr.\\r\\nFN:Dr. John Quincy Smith Jr.\\r\\nFN;LANGUAGE=ja:スミス ジョン"
                + "\\r\\nORG:Acme\\r\\nORG:Night School\\r\\nTITLE:Engineer\\r\\nTITLE:Tutor"
                + "\\r\\nNOTE;LANGUAGE=en:first note\\r\\nNOTE:second note"
                + "\\r\\nitem1.URL;TYPE=WORK:https://example.org/a\\r\\nitem1.X-ABLabel:Blog\\r\\nTEL;TYPE=CELL:+1 555 0111\\r\\nEND:VCARD\\r\\n')");
        AddressBookSafetyTest.openBook(d, "default", "Contacts", "John Quincy Smith");
        editAndSave(d, "multi-1.vcf", "const f = document.querySelector('#detail input[placeholder=\"Last name\"]'); f.value = 'Smyth'; f.dispatchEvent(new Event('input'));"
                + " const n = document.querySelector('#detail textarea'); n.value = 'first note, edited'; n.dispatchEvent(new Event('input'));"
                + " const u = document.querySelector('#detail input[type=url]'); u.value = 'https://example.org/b'; u.dispatchEvent(new Event('input'));");
        String[] wanted = {"FN:Dr. John Quincy Smyth Jr.", "N:Smyth;John;Quincy;Dr.;Jr.", "FN;LANGUAGE=ja:スミス ジョン", "ORG:Acme", "ORG:Night School",
                "TITLE:Engineer", "TITLE:Tutor", "NOTE;LANGUAGE=en:first note\\, edited", "NOTE:second note",
                "item1.URL;TYPE=WORK:https://example.org/b", "item1.X-ABLabel:Blog", "TEL;TYPE=CELL:+1 555 0111"};
        storedLine(api, book, "multi-1", "FN:", "FN:Dr. John Quincy Smyth Jr.");
        String card = "|" + stored(api, book, "multi-1") + "|";
        List<String> missing = Arrays.stream(wanted).filter(w -> ! card.contains("|" + w + "|")).collect(java.util.stream.Collectors.toList());
        if (! missing.isEmpty())
            throw new AssertionError("An edit should keep, and write whole, " + missing + ": " + card);
        // the first of each stays first: it's the one other apps, and this one, show
        String[][] firsts = {{"FN:Dr. John Quincy Smyth Jr.", "FN;LANGUAGE=ja:スミス ジョン"}, {"ORG:Acme", "ORG:Night School"},
                {"TITLE:Engineer", "TITLE:Tutor"}, {"NOTE;LANGUAGE=en:first note\\, edited", "NOTE:second note"}};
        List<String> moved = Arrays.stream(firsts).filter(f -> card.indexOf("|" + f[0] + "|") > card.indexOf("|" + f[1] + "|"))
                .map(f -> f[0]).collect(java.util.stream.Collectors.toList());
        if (! moved.isEmpty())
            throw new AssertionError("An edit should keep the first of each first, as the one other apps show: " + moved + ": " + card);
        System.out.println("  ok   an edit keeps a second name, company, title and note, after the first, a changed value's label and language, and writes a changed name whole");
    }

    // an edit keeps what it didn't touch: a phone stored as a tel: URI stays one, the departments
    // after a company name stay when the name changes, and a work mobile stays one
    static void editsKeep(WebDriver d, UserContext api, String book) {
        AddressBookSafetyTest.elsewhere(d, "window.__addressBook.writeContactCard('default', 'uri-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:4.0\\r\\nUID:uri-1\\r\\nFN:Uri Phone\\r\\nN:Phone;Uri;;;\\r\\nTEL;VALUE=uri;TYPE=home:tel:+44-20-7946-0000\\r\\nEND:VCARD\\r\\n')"
                + ".then(() => window.__addressBook.writeContactCard('default', 'org-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:org-1\\r\\nFN:Ann Org\\r\\nN:Org;Ann;;;\\r\\nORG:Acme Ltd;Research;Optics\\r\\nEND:VCARD\\r\\n'))"
                + ".then(() => window.__addressBook.writeContactCard('default', 'wm-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:wm-1\\r\\nFN:Bo Mobile\\r\\nN:Mobile;Bo;;;\\r\\nTEL;TYPE=WORK,CELL:+1 555 0100\\r\\nEND:VCARD\\r\\n'))");
        AddressBookSafetyTest.openBook(d, "default", "Contacts", "Bo Mobile");
        editAndSave(d, "uri-1.vcf", "const k = document.querySelector('#detail select'); k.value = 'cell'; k.dispatchEvent(new Event('change'));");
        String uri = storedLine(api, book, "uri-1", "TEL", "TEL;VALUE=uri;TYPE=cell:tel:+44-20-7946-0000");
        editAndSave(d, "org-1.vcf", "const o = document.querySelector('#detail input[placeholder=\"Company\"]'); o.value = 'Acme Group'; o.dispatchEvent(new Event('input'));");
        String org = storedLine(api, book, "org-1", "ORG", "ORG:Acme Group;Research;Optics");
        editAndSave(d, "wm-1.vcf", "const t = document.querySelector('#detail input[type=tel]'); t.value = '+1 555 0199'; t.dispatchEvent(new Event('input'));");
        String wm = storedLine(api, book, "wm-1", "TEL", "TEL;TYPE=WORK,CELL:+1 555 0199");
        if (! uri.equals("TEL;VALUE=uri;TYPE=cell:tel:+44-20-7946-0000") || ! org.equals("ORG:Acme Group;Research;Optics") || ! wm.equals("TEL;TYPE=WORK,CELL:+1 555 0199"))
            throw new AssertionError("An edit should keep what it didn't touch: " + uri + " / " + org + " / " + wm);
        System.out.println("  ok   an edit keeps what it didn't touch (" + uri + " / " + org + " / " + wm + ")");
    }

    // a card cut short, with no END:VCARD, still shows; a file that isn't a vCard shows by its
    // name, says it can't be read, and can be deleted
    static void unreadable(WebDriver d, UserContext api, String book) {
        AddressBookSafetyTest.elsewhere(d, "window.__addressBook.writeContactCard('default', 'broken.vcf', 'this is not a vcard at all')"
                + ".then(() => window.__addressBook.writeContactCard('default', 'cut-1.vcf', 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:cut-1\\r\\nFN:Cut Short\\r\\nN:Short;Cut;;;\\r\\n'))");
        AddressBookSafetyTest.openBook(d, "default", "Contacts", "Cut Short");
        Object row = AddressBookTest.waitInFrame(d, "the unreadable file", "const r = [...document.querySelectorAll('#contacts .list-row')].find(x => x.textContent.includes('broken.vcf'));"
                + " return r ? r.textContent : null");
        if (! String.valueOf(row).contains("Can't be read"))
            throw new AssertionError("A file that isn't a vCard should say it can't be read: " + row);
        AddressBookTest.inFrame(d, "selectContact('broken.vcf'); return 1;");
        AddressBookTest.waitInFrame(d, "its page", "const p = document.querySelector('#detail pre'); return p && p.textContent.includes('this is not a vcard') ? true : null");
        AddressBookTest.inFrame(d, "[...document.querySelectorAll('#detail button')].find(b => b.textContent.trim() === 'Delete').click(); return 1;");
        AddressBookSafetyTest.answer(d, "Delete broken.vcf?", "Yes");
        AddressBookTest.waitFor("the unreadable file to be deleted", () -> api.getByPath(book + "/broken.vcf").join().isEmpty());
        AddressBookTest.waitInFrame(d, "it gone from the list", "return [...document.querySelectorAll('#contacts .list-row')].some(x => x.textContent.includes('broken.vcf')) ? null : true");
        System.out.println("  ok   a card cut short shows; a file that isn't a vCard says it can't be read, and can be deleted (" + row + ")");
    }

    // names and notes in any script come in whole, as plain text, the long ones too
    static void quotedPrintable(WebDriver d, UserContext api, String book) {
        String[][] people = {
            {"qp-1", "Élodie Lefèvre-Dubois", "Élodie", "Lefèvre-Dubois", "Rencontrée à la conférence de Genève, préfère être contactée par e-mail"},
            {"qp-2", "Александра Васильевна Кузнецова", "Александра", "Кузнецова", "Коллега из московского офиса, звонить после шести"},
        };
        StringBuilder file = new StringBuilder();
        for (String[] p : people)
            file.append(android(p[0], p[1], p[2], p[3], p[4]));
        String said = importFile(d, "android-export.vcf", file.toString());
        for (String[] p : people) {
            AddressBookTest.waitInFrame(d, p[1] + " in the list", "return [...document.querySelectorAll('#contacts .list-row')].some(r => r.textContent.includes(arguments[0])) ? true : null", p[1]);
            String card = stored(api, book, p[0]);
            String note = p[4].replace(",", "\\,");
            if (! card.contains("|FN:" + p[1] + "|") || ! card.contains("|NOTE:" + note + "|") || ! card.contains("|N:" + p[3] + ";" + p[2] + ";;;|"))
                throw new AssertionError(p[1] + " should be stored whole, as plain text: " + card);
            if (! card.contains("|VERSION:3.0|") || card.toUpperCase().contains("QUOTED-PRINTABLE"))
                throw new AssertionError(p[1] + " should be stored as a plain 3.0 card: " + card);
        }
        System.out.println("  ok   an Android 2.1 export comes in whole, as plain text (" + said + ": " + people[0][1] + ", " + people[1][1] + ")");
    }
}
