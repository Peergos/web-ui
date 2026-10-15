import java.nio.file.*;

/** The page reconnecting by itself once the server is reachable again.
 *
 *  The desktop app loads the page once, hidden in the tray, possibly before the network is up. It
 *  used to try the server once: one failure left it on the sign-in form for good, with a
 *  persistent error and a hint to reconfigure the server and restart the app. Now it retries with
 *  backoff, says so, and once through takes the error away and lets you sign in.
 *
 *  The outage is every request the page makes going to a port nothing listens on, which fails
 *  the way an unreachable server does.
 *
 *  Usage: java -cp ../server/Peergos.jar NetworkRetryTest.java [engine] [url]
 */
public class NetworkRetryTest {

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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-netretry-"), headless)) {
            d.navigate(url + "/");
            d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
            d.waitForScript("network", Page.VUE + ".root().$store.state.network != null", 60_000);

            // the server goes away, and the page starts over as it would on a fresh load
            d.script("const open = XMLHttpRequest.prototype.open;"
                    + " window.__offline = true;"
                    + " XMLHttpRequest.prototype.open = function(method, u, ...rest) {"
                    + "   if (window.__offline) u = 'http://127.0.0.1:1/' + String(u).replace(/^https?:\\/\\/[^/]+\\//, '').replace(/^\\//, '');"
                    + "   return open.call(this, method, u, ...rest); };"
                    + " const app = " + Page.VUE + ".root();"
                    + " app.$store.commit('SET_NETWORK', null);"
                    + " app.updateNetwork(); return 1;");
            d.waitForScript("retrying", Page.VUE + ".root().$store.state.networkRetrying", 30_000);
            String hint = String.valueOf(d.script("const h = document.querySelector('.pg-auth__hint'); return h ? h.innerText : '';"));
            if (! hint.contains("retrying automatically"))
                throw new AssertionError("While the server is unreachable the sign-in form should say it is retrying: " + hint);
            if (! Boolean.TRUE.equals(d.script("return document.querySelector('.pg-auth button.pg-btn--primary').disabled")))
                throw new AssertionError("Sign in should wait for the server");
            String toast = String.valueOf(d.script("return document.body.innerText"));
            if (! toast.contains("Unable to connect to the configured server"))
                throw new AssertionError("The page should say it cannot reach the server");
            // backoff, not one failure per frame: a few seconds in, only a few attempts
            WebDriver.sleep(5000);
            if (! Boolean.TRUE.equals(d.script("return " + Page.VUE + ".root().$store.state.network == null")))
                throw new AssertionError("Nothing should have connected while the server is unreachable");
            System.out.println("  ok   an unreachable server is retried, and the form says so");

            // the server is back, and the next retry finds it without a reload
            d.script("window.__offline = false; return 1;");
            d.waitForScript("reconnected", Page.VUE + ".root().$store.state.network != null", 60_000);
            WebDriver.sleep(500);
            if (Boolean.TRUE.equals(d.script("return " + Page.VUE + ".root().$store.state.networkRetrying")))
                throw new AssertionError("Once connected it should stop retrying");
            if (Boolean.TRUE.equals(d.script("return document.body.innerText.includes('Unable to connect to the configured server')")))
                throw new AssertionError("Once connected the error should go");
            if (Boolean.TRUE.equals(d.script("return document.querySelector('.pg-auth button.pg-btn--primary').disabled")))
                throw new AssertionError("Once connected Sign in should be enabled");
            System.out.println("  ok   once the server is back it connects without a reload, and the error goes");

            Page.login(d, Server.USERNAME, Server.PASSWORD);
            System.out.println("  ok   and signing in works");
            System.out.println("PASS");
        } finally {
            if (own != null)
                own.close();
        }
    }
}
