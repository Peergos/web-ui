import peergos.server.Builder;
import peergos.shared.Crypto;
import peergos.shared.user.UserContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** The contacts api an app with MANAGE_CONTACTS gets: an installed app lists the address books,
 *  reads one, writes a card, refuses a path outside the address books, and deletes the card again,
 *  and each step is read back from what is stored.
 *
 *  Usage: java -cp ../server/Peergos.jar ContactsApiTest.java [engine] [peergos url]
 */
public class ContactsApiTest {

    static final String OUTER = "#sandboxId", INNER = "#appSandboxId";

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
        Crypto crypto = Builder.initCrypto();
        String me = "capi" + (System.currentTimeMillis() % 100000);
        try {
            NoAppsYetTest.signUp(url, me, crypto);
            // first, as it makes .apps
            Fixtures.installHtmlViewerApp(serverDir.resolve("Peergos.jar"), url, me, NoAppsYetTest.PASSWORD);
            UserContext api = NewsFeedViewTest.signInApi(url, me, crypto);
            AddressBookTest.store(api, ".apps/contacts/data/default", "carol-1.vcf",
                    "BEGIN:VCARD\r\nVERSION:3.0\r\nUID:carol-1\r\nFN:Carol Current\r\nEND:VCARD\r\n");
            Path dir = Temp.directory("peergos-contactsapi-");
            Path manifest = dir.resolve("peergos-app.json"), page = dir.resolve("index.html");
            Files.writeString(manifest, "{\"displayName\": \"Contacts Probe\", \"name\": \"contactsprobe\", \"description\": \"uses the contacts api\","
                    + " \"version\": \"1.0.0\", \"author\": \"tester\", \"launchable\": true, \"folderAction\": false, \"permissions\": [\"MANAGE_CONTACTS\"]}");
            // each step's status, and what it read, in order
            Files.writeString(page, "<!doctype html><html><head><meta charset=\"utf-8\"></head><body><pre id=\"result\"></pre><script>\n"
                    + "const api = '/peergos-api/v0/contacts/';\n"
                    + "const out = [];\n"
                    + "async function step(name, path, options) { let r = await fetch(api + path, options);"
                    + "  out.push(name + ' ' + r.status + ' ' + (r.ok ? (await r.text()).replace(/\\\\[rn]|[\\r\\n]+/g, '|').replace(/\\\\/g, '/').slice(0, 160) : '')); }\n"
                    + "(async () => {\n"
                    + "  await step('books', '');\n"
                    + "  await step('book', 'default');\n"
                    + "  await step('put', 'default/dee-1.vcf', {method: 'PUT', body: 'BEGIN:VCARD\\r\\nVERSION:3.0\\r\\nUID:dee-1\\r\\nFN:Dee Api\\r\\nEND:VCARD\\r\\n'});\n"
                    + "  await step('get', 'default/dee-1.vcf');\n"
                    + "  await step('escape', 'default/..%2F..%2Fsecret.vcf', {method: 'PUT', body: 'BEGIN:VCARD\\r\\nEND:VCARD\\r\\n'});\n"
                    + "  await step('hidden', '.hidden/x.vcf', {method: 'PUT', body: 'BEGIN:VCARD\\r\\nEND:VCARD\\r\\n'});\n"
                    + "  await step('delete', 'default/dee-1.vcf', {method: 'DELETE'});\n"
                    + "  await step('gone', 'default/dee-1.vcf');\n"
                    + "  document.getElementById('result').textContent = out.join(' ## ');\n"
                    + "})();\n"
                    + "</script></body></html>");
            Fixtures.commands(serverDir.resolve("Peergos.jar"), url, me, NoAppsYetTest.PASSWORD, "cd .apps", "mkdir contactsprobe", "cd contactsprobe",
                    "put " + manifest.toAbsolutePath(), "mkdir assets", "cd assets", "put " + page.toAbsolutePath());

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-contactsapi-b-"), headless)) {
                d.setWindowRect(1280, 900);
                NewsFeedViewTest.signIn(d, url, me);
                Page.gotoView(d, "Launcher", "launchAppFromUI", "__launcher");
                d.waitForScript("the app to be installed", "window.__launcher.appsList.some(a => a.name === 'contactsprobe')", 60_000);
                d.script("window.__launcher.launchApp('contactsprobe'); return 1;");
                Object result = d.waitUntil("the app's calls", () -> {
                    try {
                        d.switchToFrame(OUTER);
                        d.switchToFrame(INNER);
                        Object r = d.script("const r = document.getElementById('result'); return r && r.textContent.length > 0 ? r.textContent : null");
                        return r;
                    } catch (RuntimeException e) {
                        return null;
                    } finally {
                        d.switchToTop();
                    }
                }, 90_000);
                // some drivers hand the text back with its quotes escaped
                List<String> steps = Arrays.asList(String.valueOf(result).replace("\\\"", "\"").split(" ## "));
                System.out.println("  steps: " + steps);
                expect(steps, "books 200", "[{\"id\":\"default\",\"name\":\"Contacts\"}]", "lists the address books");
                expect(steps, "book 200", "Carol Current", "reads a book's cards");
                expect(steps, "put 201", "", "writes a new card");
                expect(steps, "get 200", "FN:Dee Api", "reads it back");
                expect(steps, "escape 4", "", "refuses a path out of the address books");
                expect(steps, "hidden 4", "", "refuses a hidden folder");
                expect(steps, "delete 20", "", "deletes the card");
                expect(steps, "gone 404", "", "no longer has it");
                List<String> stored = AddressBookTest.stored(api, me + "/.apps/contacts/data/default");
                if (stored.size() != 1 || ! stored.get(0).contains("FN:Carol Current"))
                    throw new AssertionError("Only the card that was there should be left: " + stored);
                if (api.getByPath(me + "/.apps/contacts/secret.vcf").join().isPresent() || api.getByPath(me + "/.apps/secret.vcf").join().isPresent())
                    throw new AssertionError("A path out of the address books was written");
                System.out.println("  ok   only the card that was there is stored, and nothing outside the address books");
            }
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    static void expect(List<String> steps, String start, String contains, String what) {
        Optional<String> step = steps.stream().filter(s -> s.startsWith(start)).findFirst();
        if (step.isEmpty() || ! step.get().contains(contains))
            throw new AssertionError("The api " + what + ": expected a step starting '" + start + "' with '" + contains + "', got " + steps);
        System.out.println("  ok   the api " + what + " (" + step.get() + ")");
    }
}
