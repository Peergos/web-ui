import java.nio.file.*;

/**
 * One secret link over several items, created and resolved in the browser.
 *
 * The members live inside the link's encrypted payload, so this is the only place the whole
 * chain is exercised as a user meets it: the GWT compiled java, the js bridge the modal uses to
 * pass paths in and read members back, and the read path that mounts every member. A java test
 * cannot catch a list that is unreachable from js, which is exactly what went wrong first.
 *
 * Usage: java -cp ../server/Peergos.jar MultiLinkCheck.java [firefox|chromium] [url]
 */
public class MultiLinkCheck {
    public static void main(String[] args) throws Exception {
        if (args.length > 1) {
            run(args);
            return;
        }
        try (Server server = Server.start(Paths.get("..", "server").toAbsolutePath().normalize())) {
            System.out.println("server " + server.url());
            run(new String[]{args.length > 0 ? args[0] : "firefox", server.url()});
        }
    }

    /** How many secret links the account holds, or -1 if that could not be read. */
    static long linkCount(WebDriver d) {
        d.script("window.__n = null; window.__drive.context.getAllSecretLinks()"
                + ".thenApply(ls => { window.__n = ls.toArray([]).length; return true; })"
                + ".exceptionally(t => { window.__n = -1; return null; });");
        d.waitForScript("link count", "window.__n !== null", 60_000);
        Object n = d.script("return window.__n");
        return n instanceof Number ? ((Number) n).longValue() : -1;
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String url = args.length > 1 ? args[1] : "http://localhost:8080";
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        {
            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("mlc-"), headless)) {
                d.navigate(url.endsWith("/") ? url : url + "/");
                d.waitForScript("login", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, "peergos", "testpassword");
                Page.gotoDrive(d);
            // gotoDrive returns once the listing is up, but the shared-with state and the
            // cache the sharing code needs arrive separately. Poking at the app before they
            // do is what "Cannot read properties of null" in CI was.
            d.waitForScript("drive ready", "window.__drive && window.__drive.sharedWithState && window.__drive.context && (window.__drive.files||[]).length > 0", 60_000);
                System.out.println("signed in");

                String create = """
                    window.__r = null;
                    const ctx = window.__drive.context;
                    const u = ctx.username;
                    const dirs = (window.__drive.files||[]).filter(f => f.isDirectory())
                        .map(f => u + '/' + f.getName()).slice(0, 2);
                    if (dirs.length < 2) { window.__r = {error: 'need two folders, found ' + dirs.length}; }
                    window.__dirs = dirs;
                    ctx.createSecretLinkTo(
                        peergos.client.JsUtil.asList(dirs),
                        peergos.client.JsUtil.asList([dirs[1]]),
                        java.util.Optional.empty(), '', '', false)
                    .thenApply(props => {
                        window.__r = {members: props.memberCount(),
                                      writable: props.isLinkWritable,
                                      url: props.toLinkString(ctx.signer.publicKeyHash),
                                      paths: []};
                        window.__r.paths = props.getMembers().toArray()
                            .map(m => m.getPath() + (m.isWritable() ? ':w' : ':r'));
                        return true;
                    }).exceptionally(t => { window.__r = {error: '' + t}; return null; });
                    """;
                // The suite shares one account, so this write can lose a compare-and-set against
                // one the app is making at the same moment. A create that fails that way writes
                // nothing, so it is safe to take again - but only once that is checked, since a
                // create taken again after it did land makes a second link and spoils every test
                // after this one. The count before and after the failed attempt is that check.
                long before = linkCount(d);
                Object r = null;
                for (int attempt = 1; attempt <= 3; attempt++) {
                    d.script(create);
                    d.waitForScript("link created", "window.__r", 120_000);
                    r = d.script("return window.__r");
                    String err = String.valueOf(r).replace('+', ' ');
                    if (! err.contains("Champ root not present") && ! err.contains("CasException"))
                        break;
                    long now = linkCount(d);
                    if (before < 0 || now != before)
                        break;
                    System.out.println("  the create lost a race with another write and left nothing, taking it again");
                    Thread.sleep(2000);
                }
                System.out.println("result: " + r);
                if (r.toString().contains("error"))
                    throw new IllegalStateException("browser reported: " + r);

                // and the link resolves, to both items, in a context that has only the link
                d.script("""
                    window.__resolved = null;
                    const url = window.__r.url;
                    const d0 = window.__drive;
                    const dirs = window.__dirs;
                    peergos.shared.user.UserContext.fromSecretLinkV2(url,
                            {get_0: () => peergos.shared.util.Futures.of('')},
                            d0.context.network, d0.context.crypto)
                        .thenCompose(ctx => ctx.getByPath(dirs[0])
                            .thenCompose(a => ctx.getByPath(dirs[1])
                                .thenApply(b => {
                                    window.__resolved = {
                                        readOnlyMemberResolves: a.ref != null,
                                        writableMemberResolves: b.ref != null,
                                        writableMemberIsWritable: b.ref != null && b.ref.isWritable(),
                                        readOnlyMemberIsWritable: a.ref != null && a.ref.isWritable()};
                                    return true;
                                })))
                        .exceptionally(t => { window.__resolved = {error: '' + t}; return null; });
                    """);
                d.waitForScript("link resolved", "window.__resolved", 120_000);
                Object res = d.script("return window.__resolved");
                System.out.println("resolved: " + res);

                // and the recipient lands on the first item in the link, not the first by name
                d.script("""
                    window.__entry = null;
                    const d1 = window.__drive;
                    peergos.shared.user.UserContext.fromSecretLinkV2(window.__r.url,
                            {get_0: () => peergos.shared.util.Futures.of('')},
                            d1.context.network, d1.context.crypto)
                        .thenCompose(ctx => ctx.getEntryPath())
                        .thenApply(p => { window.__entry = {path: p, expected: '/' + window.__dirs[0]}; return true; })
                        .exceptionally(t => { window.__entry = {error: '' + t}; return null; });
                    """);
                d.waitForScript("entry path", "window.__entry", 120_000);
                Object entry = d.script("return window.__entry");
                System.out.println("landing: " + entry);
                String path = String.valueOf(((java.util.Map) entry).get("path"));
                String expected = String.valueOf(((java.util.Map) entry).get("expected"));
                if (! expected.equals(path))
                    throw new IllegalStateException("should land on the first member " + expected + ", not " + path);
                if (res.toString().contains("error"))
                    throw new IllegalStateException("resolving failed: " + res);
                System.out.println("PASS");
            }
        }
    }
}
