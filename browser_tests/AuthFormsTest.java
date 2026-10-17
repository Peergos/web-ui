import java.nio.file.*;
import java.util.*;

/** The way in - sign in, mirror and sign up - as a person uses its checkboxes and fields, in both themes.
 *
 *  A checkbox shows whether it is ticked while it has the focus. The shadow inside the edge that the text fields use
 *  to cover a browser's autofill colour was applied to every focused input, so a checkbox just clicked was covered in
 *  the page's background colour - dark, or blank in the light theme - until the focus moved on.
 *
 *  And each form's text fields take text the way people move it: select all, copy, and paste into another field,
 *  which is read back from the field.
 *
 *  Usage: java -cp ../server/Peergos.jar AuthFormsTest.java [engine] [url]
 */
public class AuthFormsTest {
    static final String CTRL = "", RELEASE = "";
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
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
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
                        d.script("document.querySelectorAll('.tabs__header button')[arguments[0]].click(); return 1;", tab);
                        // the tabs fade from one to the next, so the form is the open tab's once it is the only one
                        d.waitForScript("the " + TABS[tab] + " form", "document.querySelectorAll('[role=tabpanel]').length === 1"
                                + " && document.querySelectorAll('.tabs__header button')[" + tab + "].getAttribute('aria-selected') === 'true'"
                                + " && !!document.querySelector('[role=tabpanel] input[name=username]')", 30_000);
                        WebDriver.sleep(400);
                        checkboxes(d, name + ", " + TABS[tab]);
                        clipboard(d, name + ", " + TABS[tab]);
                    }
                }
            } finally {
                d.script(before == null ? "localStorage.removeItem('theme'); return 1;" : "localStorage.setItem('theme', arguments[0]); return 1;", before);
            }
        } finally {
            if (own != null)
                own.close();
        }
        System.out.println("PASS");
    }

    /** Each checkbox in the open form, clicked as a person clicks it, is ticked and uncovered while it has the focus. */
    static void checkboxes(WebDriver d, String where) {
        long count = ((Number) d.script("return [...document.querySelectorAll('.pg-auth__check input[type=checkbox]')]"
                + ".filter(b => b.offsetParent !== null).length")).longValue();
        if (count == 0)
            throw new AssertionError(where + ": no checkbox in the form");
        for (int i = 0; i < count; i++) {
            d.script("document.querySelectorAll('[data-auth-check]').forEach(b => b.removeAttribute('data-auth-check'));"
                    + "[...document.querySelectorAll('.pg-auth__check input[type=checkbox]')].filter(b => b.offsetParent !== null)[arguments[0]]"
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

    /** The open form's username: select all and copy it, and paste it over its password. */
    static void clipboard(WebDriver d, String where) {
        String text = "clipboard" + new Random().nextInt(1_000_000);
        d.script("document.querySelectorAll('[data-auth-clip]').forEach(i => i.removeAttribute('data-auth-clip'));"
                + "const visible = sel => [...document.querySelectorAll(sel)].find(i => i.offsetParent !== null);"
                + "visible('input[name=username]').setAttribute('data-auth-clip', 'from');"
                + "visible('input[type=password]').setAttribute('data-auth-clip', 'to'); return 1;");
        Object from = d.find("[data-auth-clip=from]"), to = d.find("[data-auth-clip=to]");
        d.click(from);
        d.sendKeys(from, CTRL + "a" + RELEASE);
        d.sendKeys(from, text);
        d.sendKeys(from, CTRL + "a" + RELEASE);
        String selected = String.valueOf(d.script("const i = document.querySelector('[data-auth-clip=from]');"
                + " return i.value.substring(i.selectionStart, i.selectionEnd)"));
        if (! selected.equals(text))
            throw new AssertionError("FAIL " + where + ": select all should select the whole username: " + selected);
        d.sendKeys(from, CTRL + "c" + RELEASE);
        d.click(to);
        d.sendKeys(to, CTRL + "a" + RELEASE);
        d.sendKeys(to, CTRL + "v" + RELEASE);
        String pasted = String.valueOf(d.script("return document.querySelector('[data-auth-clip=to]').value"));
        if (! pasted.equals(text))
            throw new AssertionError("FAIL " + where + ": the username copied should paste into the password: " + pasted);
        System.out.println("  ok   " + where + ": select all, copy and paste carry " + text + " from the username to the password");
    }
}
