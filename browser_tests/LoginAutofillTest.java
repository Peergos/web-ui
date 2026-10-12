import java.nio.file.*;

/** The sign-in fields as a browser's saved login fills them.
 *
 *  A browser paints a field it filled in its own colour - yellow in Firefox, blue in Chrome - and
 *  a page can only cover that with a shadow inside the field's edge. The focus ring replaced that
 *  shadow, so a filled field turned yellow as soon as it was focused. Now a filled field keeps the
 *  field's own colour, focused or not, and focus only turns its edge green.
 *
 *  A saved login is put in the browser itself and the page fills from it, the way it does for a
 *  person, and what each field shows is read back from its style. Only Firefox can be given a
 *  saved login from a test.
 *
 *  Usage: java -cp ../server/Peergos.jar LoginAutofillTest.java [engine] [url]
 */
public class LoginAutofillTest {

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
        if (Browsers.engine(engine) != Browsers.Engine.FIREFOX) {
            System.out.println("  skip only Firefox can be given a saved login from a test");
            System.out.println("PASS");
            return;
        }
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        Server own = given == null ? Server.start(Paths.get("..", "server").toAbsolutePath().normalize()) : null;
        String url = own != null ? own.url() : given;
        try {
            for (String theme : new String[] {"light", "dark"}) {
                try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-autofill-"), headless)) {
                    MarionetteDriver ff = (MarionetteDriver) d;
                    // automation turns the password manager off; a person's browser has it on
                    ff.chromeScript("for (const n of ['signon.rememberSignons', 'signon.autofillForms', 'signon.autofillForms.http'])"
                            + " Services.prefs.setBoolPref(n, true); return 1;");
                    ff.chromeScript("const login = Cc['@mozilla.org/login-manager/loginInfo;1'].createInstance(Ci.nsILoginInfo);"
                            + " login.init('" + url.replaceAll("/+$", "") + "', '', null, 'someone', 'a-saved-password', '', '');"
                            + " return Services.logins.addLoginAsync(login).then(() => 1);");
                    d.setWindowRect(1280, 860);
                    d.navigate(url + "/");
                    if (theme.equals("dark")) {
                        d.script("localStorage.setItem('theme', 'dark-mode'); return 1;");
                        d.navigate(url + "/");
                    }
                    d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                    d.waitForScript("the browser to fill the form", "(() => { const u = document.querySelector('input[name=username]'),"
                            + " p = document.querySelector('input[type=password]'); return !!u && !!p && u.matches(':autofill') && p.matches(':autofill'); })()", 30_000);
                    String fieldColour = String.valueOf(d.script("const e = document.createElement('input'); e.className = 'pg-input'; document.body.appendChild(e);"
                            + " const c = getComputedStyle(e).backgroundColor; e.remove(); return c;"));
                    String textColour = String.valueOf(d.script("return getComputedStyle(document.body).color"));
                    for (String field : new String[] {"input[name=username]", "input[type=password]"}) {
                        for (boolean focused : new boolean[] {false, true}) {
                            d.script(focused ? "document.querySelector(arguments[0]).focus(); return 1;"
                                    : "document.activeElement && document.activeElement.blur(); return 1;", field);
                            WebDriver.sleep(300);
                            String shown = String.valueOf(d.script("const s = getComputedStyle(document.querySelector(arguments[0]));"
                                    + " return s.boxShadow + ' | edge ' + s.borderTopColor + ' | caret ' + s.caretColor", field));
                            String what = theme + ", " + field + (focused ? ", focused" : "");
                            // what shows is the shadow inside the edge, in the field's own colour
                            if (! shown.contains(fieldColour + " 0px 0px 0px 30px inset"))
                                throw new AssertionError(what + ": the browser's fill should be covered by the field's own colour " + fieldColour + ": " + shown);
                            if (focused && ! shown.contains("edge rgb(38, 185, 154)"))
                                throw new AssertionError(what + ": focus should turn the edge green: " + shown);
                            // the browser makes the text its own colour, which the caret would follow
                            if (focused && ! shown.contains("caret " + textColour))
                                throw new AssertionError(what + ": the caret should be the theme's text colour " + textColour + ": " + shown);
                        }
                    }
                    System.out.println("  ok   " + theme + ": both filled fields keep the field's colour " + fieldColour + ", focused or not, focus turns the edge green, and the caret is the text colour " + textColour);
                }
            }
        } finally {
            if (own != null)
                own.close();
        }
        System.out.println("PASS");
    }
}
