import java.nio.file.*;

/**
 * The link editor as a person meets it: open the share modal on a file, create a link, then use
 * "add files or folders" to put a second item in it.
 *
 * The picker being a second child of a <transition> meant it rendered nothing and the button
 * looked dead, which no java test could see.
 */
public class LinkEditorCheck {
    public static void main(String[] args) throws Exception {
        if (args.length > 1) { run(args); return; }
        try (Server server = Server.start(Paths.get("..", "server").toAbsolutePath().normalize())) {
            System.out.println("server " + server.url());
            run(new String[]{args.length > 0 ? args[0] : "firefox", server.url()});
        }
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String url = args.length > 1 ? args[1] : "http://localhost:8080";
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("lec-"), headless)) {
            d.navigate(url.endsWith("/") ? url : url + "/");
            d.waitForScript("login", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, "peergos", "testpassword");
            Page.gotoDrive(d);
            // gotoDrive returns once the listing is up, but the shared-with state and the
            // cache the sharing code needs arrive separately. Poking at the app before they
            // do is what "Cannot read properties of null" in CI was.
            d.waitForScript("drive ready", "window.__drive && window.__drive.sharedWithState && window.__drive.context && (window.__drive.files||[]).length > 0", 60_000);

            // open the share modal on the first folder, then the secret link editor
            // showShareWith reads this file's entry out of sharedWithState and dereferences it,
            // so the map existing is not enough - the entry has to be there or it throws and the
            // modal never opens. That is what failed intermittently in CI.
            Object name = d.script("""
                const dirs = (window.__drive.files||[]).filter(x => x.isDirectory());
                if (dirs.length == 0) return null;
                window.__pick = dirs[0];
                return dirs[0].getName();
                """);
            if (name == null)
                throw new IllegalStateException("no folders in the drive to share");
            d.waitForScript("sharing state for " + name,
                    "window.__drive.sharedWithState && window.__drive.sharedWithState.get(window.__pick.getName()) != null", 60_000);

            Object opened = d.script("""
                const drive = window.__drive;
                drive.selectedFiles = [window.__pick];
                drive.showShareWith();
                return 'showShare=' + drive.showShare + ' name=' + window.__pick.getName();
                """);
            System.out.println("share setup: " + opened);
            String btn = "document.querySelector(\"[aria-label='Create Secret Link']\")";
            // Opening the modal occasionally does not take - the app re-renders the drive
            // underneath it - so the wait re-triggers rather than failing the run on a miss.
            String modalUp = "(function(){ var dr = window.__drive;"
                    + " if (! dr.showShare) { try { dr.selectedFiles = [window.__pick]; dr.showShareWith(); } catch (e) {} }"
                    + " return !!" + btn + "; })()";
            // the modal loads this file's sharing state before it renders, which on a slow or
            // busy runner takes a while; 30s was not enough in CI
            long t0 = System.currentTimeMillis();
            d.waitForScript("share modal", modalUp, 120_000);
            System.out.println("share modal appeared in " + (System.currentTimeMillis() - t0) + "ms");
            d.script("return " + btn + ".click()");
            d.waitForScript("link editor", "document.querySelector('.link-members')", 30_000);

            // the members list shows the file the modal was opened on
            System.out.println("members shown: " + d.script(
                "return Array.from(document.querySelectorAll('.link-member__path')).map(e => e.textContent.trim())"));

            // the writable toggle should sit next to the path, not at the far edge
            System.out.println("layout: " + d.script("""
                const row = document.querySelector('.link-member');
                const path = row.querySelector('.link-member__path').getBoundingClientRect();
                const tog = row.querySelector('.link-member__writable').getBoundingClientRect();
                return 'gap=' + Math.round(tog.left - path.right) + ' rowWidth=' + Math.round(row.getBoundingClientRect().width);
                """));

            // and the add button must actually open the picker
            d.script("document.querySelector('.link-members button.btn-success').click()");
            Thread.sleep(1500);
            Object pickerVisible = d.script(
                "return !!document.querySelector('.file-picker-container')");
            System.out.println("picker opened: " + pickerVisible);
            if (! Boolean.TRUE.equals(pickerVisible))
                throw new IllegalStateException("the add files or folders button did nothing");
            System.out.println("PASS");
        }
    }
}
