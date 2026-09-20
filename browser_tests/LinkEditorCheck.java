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

            // open the share modal on the first folder, then the secret link editor
            d.script("""
                const drive = window.__drive;
                const f = (drive.files||[]).filter(x => x.isDirectory())[0];
                drive.selectedFiles = [f];
                drive.showShareWith();
                """);
            String btn = "document.querySelector(\"[aria-label='Create Secret Link']\")";
            d.waitForScript("share modal", btn, 30_000);
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
