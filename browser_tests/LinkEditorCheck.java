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

            // A render error inside the modal drops the whole thing, Create button included, and
            // never reaches showShareWith - so catch what Vue itself reports while it renders.
            d.script("""
                window.__vueErrs = [];
                const before = Vue.config.errorHandler;
                Vue.config.errorHandler = function (err, vm, info) {
                    window.__vueErrs.push(info + ': ' + err + (err && err.stack ? ' @ ' + String(err.stack).split('\\n')[1] : ''));
                    if (before) before(err, vm, info);
                };
                """);
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
            // The catch keeps a miss from failing the run, but it also threw away the only
            // account of why the modal never came: every failure read "timed out" and nothing
            // else. The reason is kept so the timeout below can say it.
            // Re-opening only when showShare is false misses the case its own note describes: a
            // re-render underneath can take the modal out of the page and leave showShare true,
            // and then nothing ever opens it again. A modal that is missing is closed so the
            // next pass opens it; one that is up but empty is left alone for the report below.
            String modalUp = "(function(){ var dr = window.__drive;"
                    + " if (" + btn + ") return true;"
                    + " try {"
                    + "  if (dr.showShare && ! document.querySelector('.drive-share')) dr.showShare = false;"
                    + "  if (! dr.showShare) { dr.selectedFiles = [window.__pick]; dr.showShareWith(); }"
                    + " } catch (e) { window.__shareErr = '' + e; }"
                    + " return false; })()";
            // the modal loads this file's sharing state before it renders, which on a slow or
            // busy runner takes a while; 30s was not enough in CI, and 120s was not enough on
            // the macos runner, which drives a real safari with nothing headless about it
            long slow = "1".equals(System.getenv("PEERGOS_TEST_SLOW")) ? 3 : 1;
            long t0 = System.currentTimeMillis();
            try {
                d.waitForScript("share modal", modalUp, 120_000 * slow);
            } catch (RuntimeException e) {
                // it opens in about ten milliseconds or it never opens, so a timeout here is
                // showShareWith throwing rather than the runner being slow
                Object why = d.script("return 'showShareWith: ' + (window.__shareErr || 'did not throw')"
                        + " + ' | vue: ' + ((window.__vueErrs || []).join(' || ') || 'nothing reported')"
                        + " + ' | showShare=' + window.__drive.showShare"
                        + " + ' | modal in page: ' + !!document.querySelector('.drive-share')");
                throw new IllegalStateException("the share modal never came up: " + why, e);
            }
            System.out.println("share modal appeared in " + (System.currentTimeMillis() - t0) + "ms");
            d.script("return " + btn + ".click()");
            d.waitForScript("link editor", "document.querySelector('.link-members')", 30_000 * slow);

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
            d.script("document.querySelector('.link-members__add').click()");
            Thread.sleep(1500);
            Object pickerVisible = d.script(
                "return !!document.querySelector('.file-picker-container')");
            System.out.println("picker opened: " + pickerVisible);
            if (! Boolean.TRUE.equals(pickerVisible))
                throw new IllegalStateException("the add files or folders button did nothing");

            // removing asks first, and Yes has to actually take the item out: the confirm hides
            // itself before it calls back, which once dropped the item it was asked about
            d.script("""
                // the element belongs to the <transition> the dialog renders through, so climb to it
                let vm = document.querySelector('.secret-link').parentElement.__vue__;
                while (vm && ! Array.isArray(vm.members)) vm = vm.$parent;
                vm.addMember(vm.members[0].path + '/removal-check', false);
                """);
            d.waitForScript("second member", "document.querySelectorAll('.link-member').length === 2", 10_000);
            d.script("const rs = document.querySelectorAll('.link-member__remove'); rs[rs.length - 1].click();");
            d.waitForScript("remove confirmation", "document.querySelector('.pg-dialog--prompt .pg-btn--primary')", 10_000);
            d.script("document.querySelector('.pg-dialog--prompt .pg-btn--primary').click()");
            d.waitForScript("the member to go", "document.querySelectorAll('.link-member').length === 1", 10_000);
            System.out.println("remove confirmed: back to one member");
            System.out.println("PASS");
        }
    }
}
