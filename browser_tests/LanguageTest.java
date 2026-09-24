import java.nio.file.*;

/** The interface in a chosen language, and the page saying which language that is.
 *
 *  The page used to be marked English whatever it showed, so a screen reader voiced Greek with
 *  an English voice and capitals kept the accents Greek drops in upper case. Greek also has longer
 *  words than the login tabs were sized for, and the last tab ran off a narrow phone. Picking a
 *  language left its dialog open.
 *
 *  Usage: java -cp ../server/Peergos.jar LanguageTest.java [engine] [url]
 */
public class LanguageTest {

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String given = args.length > 1 ? args[1] : null;
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-lang-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);

            open(d, "el");
            String button = String.valueOf(d.script("return [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t).join(' | ')"));
            if (! button.contains("Σύνδεση"))
                throw new AssertionError("Chosen Greek, the sign in button should read Σύνδεση: " + button);
            if (! "el".equals(d.script("return document.documentElement.lang")))
                throw new AssertionError("Chosen Greek, the page should say lang=el, not " + d.script("return document.documentElement.lang"));
            if (! String.valueOf(d.script("let r = null; for (const e of document.querySelectorAll('*')) if (e.__vue__) { r = e.__vue__.$root; break; }"
                    + " const st = [r]; while (st.length) { const c = st.pop(); if (c && typeof c.getLanguages === 'function') return c.getLanguages().join(','); if (c && c.$children) st.push(...c.$children); } return '';"))
                    .contains("Ελληνικά"))
                throw new AssertionError("The language list should offer Ελληνικά");
            System.out.println("  ok   Greek translates the page, marks it lang=el, and is on the language list");

            // the narrowest phone the layout is checked at
            d.setWindowRect(320, 700);
            WebDriver.sleep(600);
            Object tabs = d.script("return [...document.querySelector('.tabs__header').children]"
                    + ".filter(li => li.getBoundingClientRect().right > window.innerWidth + 1 || li.scrollWidth > li.clientWidth + 1)"
                    + ".map(li => li.textContent.trim()).join(', ') + (document.documentElement.scrollWidth > window.innerWidth + 1 ? ' [page scrolls sideways]' : '')");
            if (! String.valueOf(tabs).isEmpty())
                throw new AssertionError("At 320px every Greek login tab should fit: " + tabs);
            System.out.println("  ok   the Greek login tabs fit a 320px phone");

            // signed in, the views are Greek too
            d.setWindowRect(1280, 900);
            d.script("""
                function set(el, v) { el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); }
                const ins = [...document.querySelectorAll('input')];
                set(ins.find(i => i.name === 'username'), 'peergos'); set(ins.find(i => i.type === 'password'), 'testpassword');
                const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Σύνδεση' && ! b.disabled);
                if (b) b.click(); return 1;""");
            d.waitForScript("signed in", "(() => { const a = document.querySelector('#app'); const s = a && a.__vue__ && a.__vue__.$store.state;"
                    + " return !! (s && s.context && s.context.username); })()", 120_000);
            d.waitForScript("the drive in Greek", "[...document.querySelectorAll('h1')].some(h => h.textContent.trim() === 'Drive') && document.body.innerText.includes('Ροή ειδήσεων')", 60_000);
            System.out.println("  ok   signed in, the navigation is Greek and Drive keeps its name, as in the other languages");

            // the rail's Upgrade label: a longer word than "Upgrade", and it spilled past both edges
            Object rail = d.script("const u = document.querySelector('.navigation-storage .upgrade'); if (! u) return 'no upgrade label';"
                    + " const nav = document.querySelector('.app-navigation'); if (nav.classList.contains('expanded')) return 'rail not collapsed';"
                    + " const n = nav.getBoundingClientRect(), r = u.getBoundingClientRect(), cs = getComputedStyle(u);"
                    + " const lines = Math.round((r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight));"
                    + " return (r.left < n.left || r.right > n.right || u.scrollWidth > u.clientWidth + 1 ? 'clipped ' : '') + (lines !== 1 ? lines + ' lines' : '');");
            if (! String.valueOf(rail).isEmpty())
                throw new AssertionError("In Greek the rail's Upgrade label should fit on one line: " + rail);
            System.out.println("  ok   the rail's Upgrade label, Αναβάθμιση, fits the rail whole");

            // picking a language is all the dialog is for, so it closes, and says what happens next
            d.script("document.querySelector('#app').__vue__.$store.commit('CURRENT_MODAL', 'ModalLanguage'); return 1;");
            d.waitForScript("the language dialog", "[...document.querySelectorAll('.app-modal button')].some(b => b.textContent.trim() === 'English')", 30_000);
            d.script("[...document.querySelectorAll('.app-modal button')].find(b => b.textContent.trim() === 'English').click(); return 1;");
            d.waitForScript("the dialog to close", "! document.querySelector('.app-modal')", 10_000);
            if (! "en-GB".equals(d.script("return localStorage.getItem('Language')")))
                throw new AssertionError("Picking English should store en-GB, not " + d.script("return localStorage.getItem('Language')"));
            d.waitForScript("the log in again note", "document.body.innerText.includes('Log in again to reflect language change')", 10_000);
            System.out.println("  ok   picking a language stores it, closes the dialog and says to log in again, in that language");

            open(d, "de");
            if (! "de".equals(d.script("return document.documentElement.lang")))
                throw new AssertionError("Chosen German, the page should say lang=de");

            // nothing chosen, and a browser language nobody translated: English
            d.script("localStorage.removeItem('Language'); return 1;");
            Object fallback = d.script("return (navigator.language.startsWith('en') || ! ['zh-CN','de','el','es','fr','it','ko','nl','pl'].some(p => navigator.language === p || navigator.language.startsWith(p.split('-')[0] + '-'))) ? 'expect-en' : 'skip'");
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            if ("expect-en".equals(fallback) && ! "en-GB".equals(d.script("return document.documentElement.lang")))
                throw new AssertionError("With no language chosen and an English browser the page should say lang=en-GB, not "
                        + d.script("return document.documentElement.lang"));
            System.out.println("  ok   another choice, and no choice, mark the page with their own language");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }

    private static void open(WebDriver d, String code) {
        d.script("localStorage.setItem('Language', arguments[0]); location.reload(); return 1;", code);
        d.waitForScript("login form in " + code, "document.querySelector('input[name=username]') && document.documentElement.lang === '" + code + "'", 60_000);
    }
}
