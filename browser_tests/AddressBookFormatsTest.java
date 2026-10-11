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
