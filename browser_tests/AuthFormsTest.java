import java.nio.file.*;
import java.util.*;

/** The way in - sign in, mirror and sign up - as a person uses its checkboxes and fields, in both themes.
 *
 *  A checkbox shows whether it is ticked while it has the focus. The shadow inside the edge that the text fields use
 *  to cover a browser's autofill colour was applied to every focused input, so a checkbox just clicked was covered in
 *  the page's background colour - dark, or blank in the light theme - until the focus moved on.
 *
 *  And each form's text fields take text the way people move it: select all, copy, and paste into another field,
 *  which is read back from the field. They tell a password manager what they hold - a new password where an account
 *  is made - and keep a username in lower case without moving the caret. Enter in any field sends its form.
 *
 *  On a paid instance, where sign up and mirror offer plans, monthly or yearly billing is switched by a click and by
 *  the arrow keys, and the prices follow.
 *
 *  Usage: java -cp ../server/Peergos.jar AuthFormsTest.java [engine] [url]
 */
public class AuthFormsTest {
    static final String RELEASE = "\uE000", ENTER = "\uE007", LEFT = "\uE012";
    // what goes with a, c and v for select all, copy and paste: Command on a Mac, Control elsewhere
    static final String MOD = System.getProperty("os.name", "").toLowerCase().contains("mac") ? "\uE03D" : "\uE009";
    static final String[] TABS = {"sign in", "mirror", "sign up"};

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
        // safaridriver presses fewer keys than a person: a Command chord reaches the page as the Command key alone, so
        // Command-A, C and V do nothing, and it types into nothing it can't see, such as a radio button behind its label.
        // Safari's own shortcuts and arrow keys are left to it.
        boolean keys = ! "safari".equals(engine);
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        String user = "forms" + new Random().nextInt(1_000_000), password = "authformstestpassword";
        Fixtures.signUp(url, user, password);
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-auth-forms-"), headless)) {
            d.setWindowRect(1280, 900);
            d.navigate(url + "/");
            // a desktop run uses a real profile, whose theme is put back after
            Object before = d.script("return localStorage.getItem('theme')");
            try {
                for (String theme : new String[] {"light", "dark-mode"}) {
                    d.script("localStorage.setItem('theme', arguments[0]); return 1;", theme);
                    d.navigate(url + "/");
                    d.waitForScript("the sign-in card", "document.querySelectorAll('.tabs__header button').length === 3", 60_000);
                    String name = theme.equals("light") ? "light" : "dark";
                    for (int tab = 0; tab < TABS.length; tab++) {
                        openTab(d, tab);
                        checkboxes(d, name + ", " + TABS[tab]);
                        if (keys)
                            clipboard(d, name + ", " + TABS[tab]);
                        if (theme.equals("light")) {
                            hints(d, TABS[tab], tab == 2 ? "new-password" : "current-password");
                            caret(d, TABS[tab]);
                        }
                    }
                }
                enter(d, url, user, password);
            } finally {
                d.script(before == null ? "localStorage.removeItem('theme'); return 1;" : "localStorage.setItem('theme', arguments[0]); return 1;", before);
            }
        } finally {
            if (own != null)
                own.close();
        }
        paid(engine, headless, keys);
        System.out.println("PASS");
    }

    /** Each checkbox in the open form, clicked as a person clicks it, is ticked and uncovered while it has the focus. */
    static void checkboxes(WebDriver d, String where) {
        long count = ((Number) d.script("return [...document.querySelectorAll('.pg-check input[type=checkbox]')]"
                + ".filter(b => b.offsetParent !== null).length")).longValue();
        if (count == 0)
            throw new AssertionError(where + ": no checkbox in the form");
        for (int i = 0; i < count; i++) {
            d.script("document.querySelectorAll('[data-auth-check]').forEach(b => b.removeAttribute('data-auth-check'));"
                    + "[...document.querySelectorAll('.pg-check input[type=checkbox]')].filter(b => b.offsetParent !== null)[arguments[0]]"
                    + ".setAttribute('data-auth-check', ''); return 1;", i);
            Object box = d.find("[data-auth-check]");
            if (Boolean.TRUE.equals(d.script("return document.querySelector('[data-auth-check]').checked")))
                d.click(box);
            d.click(box);
            String shown = String.valueOf(d.script("const b = document.querySelector('[data-auth-check]'), s = getComputedStyle(b);"
                    + " return (b.checked ? 'ticked' : 'not ticked') + ' | ' + (document.activeElement === b ? 'focused' : 'not focused')"
                    + " + ' | shadow ' + s.boxShadow"));
            if (! shown.startsWith("ticked"))
                throw new AssertionError("FAIL " + where + ", checkbox " + (i + 1) + ": a click should tick it: " + shown);
            if (! shown.endsWith("shadow none"))
                throw new AssertionError("FAIL " + where + ", checkbox " + (i + 1) + ": nothing should cover it while it has the focus: " + shown);
            System.out.println("  ok   " + where + ", checkbox " + (i + 1) + " clicked: " + shown);
        }
    }

    /** On a paid instance, sign up and mirror offer the plans, billed monthly or yearly: a click and the arrow keys
     *  both switch the period, and the prices follow. */
    static void paid(String engine, boolean headless, boolean keys) throws Exception {
        try (QuotaAdminStandIn quotaService = QuotaAdminStandIn.start(false);
             Server server = Server.startPaid(Paths.get("..", "server").toAbsolutePath().normalize(), quotaService.port());
             WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-auth-paid-"), headless)) {
            d.setWindowRect(1280, 900);
            d.navigate(server.url() + "/");
            d.waitForScript("the sign-in card", "document.querySelectorAll('.tabs__header button').length === 3", 60_000);
            for (int tab : new int[] {1, 2}) {
                d.script("document.querySelectorAll('.tabs__header button')[arguments[0]].click(); return 1;", tab);
                d.waitForScript("the plans in " + TABS[tab], "document.querySelectorAll('[role=tabpanel]').length === 1"
                        + " && !!document.querySelector('[role=tabpanel] .pg-segmented')", 30_000);
                WebDriver.sleep(400);
                billing(d, TABS[tab], "[role=tabpanel]", keys);
            }
            // and the upgrade dialog, signed in
            d.navigate(server.url() + "/");
            Page.login(d, Server.USERNAME, Server.PASSWORD);
            Page.gotoDrive(d);
            d.waitForScript("paid mode", "(() => { const p = window.__drive.$store.state.paymentProperties; return p && p.isPaid(); })()", 60_000);
            d.script("window.__drive.$store.commit('CURRENT_MODAL', 'ModalPro'); return 1;");
            d.waitForScript("the upgrade dialog's plans", "!!document.querySelector('.app-modal__dialog .pg-segmented')", 30_000);
            WebDriver.sleep(400);
            billing(d, "the upgrade dialog", ".app-modal__dialog", keys);
        }
    }

    /** The billing period inside the given element: Yearly clicked, then Monthly by the arrow keys from the chosen one -
     *  or, without keys, by a click. */
    static void billing(WebDriver d, String where, String inside, boolean keys) {
        String price = "return document.querySelector(arguments[0] + ' .pg-plan li:last-child').textContent.trim()";
        d.click(d.find(inside + " .pg-segmented label:last-child"));
        WebDriver.sleep(300);
        String yearly = String.valueOf(d.script(price, inside));
        if (! yearly.startsWith("£3 /"))
            throw new AssertionError("FAIL " + where + ": Yearly clicked should price the first plan at £3 a month: " + yearly);
        if (keys)
            d.sendKeys(d.find(inside + " .pg-segmented input[value=yearly]"), LEFT);
        else
            d.click(d.find(inside + " .pg-segmented label:first-child"));
        String how = keys ? "the left arrow" : "a click";
        WebDriver.sleep(300);
        String monthly = String.valueOf(d.script(price, inside));
        if (! monthly.startsWith("£4 /"))
            throw new AssertionError("FAIL " + where + ": " + how + " should choose Monthly, at £4 a month: " + monthly);
        String on = String.valueOf(d.script("return document.querySelector(arguments[0] + ' .pg-segmented label.active').textContent.trim()", inside));
        if (! on.equals("Monthly"))
            throw new AssertionError("FAIL " + where + ": Monthly should be shown as the choice: " + on);
        System.out.println("  ok   " + where + ": a click chose yearly (" + yearly + "), " + how + " monthly (" + monthly + ")");
    }

    static void openTab(WebDriver d, int tab) {
        d.script("document.querySelectorAll('.tabs__header button')[arguments[0]].click(); return 1;", tab);
        // the tabs fade from one to the next, so the form is the open tab's once it is the only one
        d.waitForScript("the " + TABS[tab] + " form", "document.querySelectorAll('[role=tabpanel]').length === 1"
                + " && document.querySelectorAll('.tabs__header button')[" + tab + "].getAttribute('aria-selected') === 'true'"
                + " && !!document.querySelector('[role=tabpanel] input[name=username]')", 30_000);
        // The username takes the focus as its form opens, and on a phone that brings up the keyboard over the rest of
        // the form, so it is put away first, as a person would before ticking anything.
        WebDriver.sleep(400);
        d.script("if (document.activeElement) document.activeElement.blur(); return 1;");
        WebDriver.sleep(600);
    }

    /** What the open form's fields tell a password manager: who, and whether the password is one it has or a new one. */
    static void hints(WebDriver d, String where, String passwords) {
        String said = String.valueOf(d.script("const p = document.querySelector('[role=tabpanel]');"
                + " return [p.querySelector('input[name=username]').autocomplete]"
                + ".concat([...p.querySelectorAll('input[type=password]')].map(i => i.autocomplete)).join(' ')"));
        String[] each = said.split(" ");
        boolean ok = each.length >= 2 && each[0].equals("username");
        for (int i = 1; i < each.length; i++)
            ok &= each[i].equals(passwords);
        if (! ok)
            throw new AssertionError("FAIL " + where + ": the fields should say username, then " + passwords + ": " + said);
        System.out.println("  ok   " + where + ": the fields tell a password manager " + said);
    }

    /** A capital typed in the middle of a username comes out in lower case, with the caret after it: typed in one go, the
     *  caret moved back with the arrow keys, as a person would. */
    static void caret(WebDriver d, String where) {
        d.script("document.querySelectorAll('[data-auth-clip]').forEach(i => i.removeAttribute('data-auth-clip'));"
                + "document.querySelector('[role=tabpanel] input[name=username]').setAttribute('data-auth-clip', 'name'); return 1;");
        Object name = d.find("[data-auth-clip=name]");
        d.click(name);
        d.script("const i = document.querySelector('[data-auth-clip=name]'); i.value = '';"
                + " i.dispatchEvent(new Event('input', {bubbles: true})); return 1;");
        d.sendKeys(name, "abcd" + LEFT + LEFT + "Xy");
        String shown = String.valueOf(d.script("const i = document.querySelector('[data-auth-clip=name]'); return i.value + ' caret ' + i.selectionStart"));
        if (! shown.equals("abxycd caret 4"))
            throw new AssertionError("FAIL " + where + ": typing X then y after ab should give abxycd with the caret after y: " + shown);
        System.out.println("  ok   " + where + ": a capital typed mid-name is lowered where it was typed, and typing goes on there: " + shown);
    }

    /** Enter in a username field sends its form: mirror and sign up answer that the rest is missing, sign in signs in. */
    static void enter(WebDriver d, String url, String user, String password) {
        d.script("localStorage.setItem('theme', 'light'); return 1;");
        d.navigate(url + "/");
        d.waitForScript("the sign-in card", "document.querySelectorAll('.tabs__header button').length === 3", 60_000);
        for (int tab : new int[] {1, 2}) {
            openTab(d, tab);
            // closed as a person closes them: the forms share one toast, which would otherwise be updated, not shown again
            d.script("document.querySelectorAll('.Vue-Toastification__close-button').forEach(b => b.click()); return 1;");
            d.waitForScript("no toast left", "!document.querySelector('.Vue-Toastification__toast')", 15_000);
            Object name = d.find("[role=tabpanel] input[name=username]");
            d.click(name);
            d.sendKeys(name, "someone" + ENTER);
            d.waitForScript("the " + TABS[tab] + " form to answer", "!!document.querySelector('.Vue-Toastification__toast')", 15_000);
            System.out.println("  ok   " + TABS[tab] + ": Enter in the username sends the form, which answers: "
                    + d.script("return document.querySelector('.Vue-Toastification__toast').innerText.trim()"));
        }
        openTab(d, 0);
        Object pass = d.find("[role=tabpanel] input[type=password]");
        d.click(pass);
        d.sendKeys(pass, password);
        Object name = d.find("[role=tabpanel] input[name=username]");
        d.click(name);
        d.sendKeys(name, user + ENTER);
        d.waitForScript("sign in by Enter", "/upgrade/i.test(document.body.innerText)", 120_000);
        System.out.println("  ok   sign in: Enter in the username signs in");
    }

    /** The open form's username: select all and copy it, and paste it over its password. */
    static void clipboard(WebDriver d, String where) {
        String text = "clipboard" + new Random().nextInt(1_000_000);
        d.script("document.querySelectorAll('[data-auth-clip]').forEach(i => i.removeAttribute('data-auth-clip'));"
                + "const visible = sel => [...document.querySelectorAll(sel)].find(i => i.offsetParent !== null);"
                + "visible('input[name=username]').setAttribute('data-auth-clip', 'from');"
                + "visible('input[type=password]').setAttribute('data-auth-clip', 'to'); return 1;");
        Object from = d.find("[data-auth-clip=from]"), to = d.find("[data-auth-clip=to]");
        d.click(from);
        d.sendKeys(from, MOD + "a" + RELEASE);
        d.sendKeys(from, text);
        d.sendKeys(from, MOD + "a" + RELEASE);
        String selected = String.valueOf(d.script("const i = document.querySelector('[data-auth-clip=from]');"
                + " return i.value.substring(i.selectionStart, i.selectionEnd)"));
        if (! selected.equals(text))
            throw new AssertionError("FAIL " + where + ": select all should select the whole username: " + selected);
        d.sendKeys(from, MOD + "c" + RELEASE);
        d.click(to);
        d.sendKeys(to, MOD + "a" + RELEASE);
        d.sendKeys(to, MOD + "v" + RELEASE);
        String pasted = String.valueOf(d.script("return document.querySelector('[data-auth-clip=to]').value"));
        if (! pasted.equals(text))
            throw new AssertionError("FAIL " + where + ": the username copied should paste into the password: " + pasted);
        System.out.println("  ok   " + where + ": select all, copy and paste carry " + text + " from the username to the password");
    }
}
