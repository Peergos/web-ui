import java.nio.file.*;

/**
 * Every secret link enumerated at once, and "add to an existing link" as a user meets it in
 * the share modal. The enumeration has no screen of its own any more, so this is what holds
 * it: it is still what the share modal appends to.
 *
 * Both are new js reaching new java: enumerating every link once despite it being recorded under
 * each of its items, and appending one more. A java test cannot see the vue wiring or the js
 * bridge, which is where the last bug of this kind was.
 */
public class LinksOverviewCheck {
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
        Fixtures.Account me = Fixtures.account(url);
        // the links go over folders, and a new account has none
        Fixtures.commands(Paths.get("..", "server", "Peergos.jar").toAbsolutePath().normalize(), url,
                me.name(), me.password(), "mkdir alpha", "mkdir beta");
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("loc-"), headless)) {
            d.navigate(url.endsWith("/") ? url : url + "/");
            d.waitForScript("login", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, me.name(), me.password());
            Page.gotoDrive(d);
            // gotoDrive returns once the listing is up, but the shared-with state and the
            // cache the sharing code needs arrive separately. Poking at the app before they
            // do is what "Cannot read properties of null" in CI was.
            d.waitForScript("drive ready", "window.__drive && window.__drive.sharedWithState && window.__drive.context && (window.__drive.files||[]).length > 0", 60_000);

            // A link created while a new account's sign-in is still writing loses the race, as in
            // MultiLinkCheck, so wait for its social read as a person would.
            d.waitForScript("sign-in's social read", "window.__drive.$store.state.socialData.groupUids.length > 0", 60_000);

            // two links over one item each; only the folders no link holds yet, so a create that
            // lost a compare-and-set can be taken again without making a second link
            String create = """
                window.__o = null;
                const ctx = window.__drive.context;
                const u = ctx.username;
                const dirs = (window.__drive.files||[]).filter(f => f.isDirectory())
                    .map(f => u + '/' + f.getName()).slice(0, 2);
                window.__dirs = dirs;
                const one = p => ctx.createSecretLinkTo(peergos.client.JsUtil.asList([p]),
                        peergos.client.JsUtil.asList([]), java.util.Optional.empty(), '', '', false);
                ctx.getAllSecretLinks()
                  .thenCompose(ls => dirs.filter(p => ! ls.toArray([]).some(l => l.contains(p)))
                      .reduce((f, p) => f.thenCompose(() => one(p)), peergos.shared.util.Futures.of(true)))
                  .thenCompose(() => ctx.getAllSecretLinks())
                  .thenApply(ls => {
                      const arr = ls.toArray([]);
                      window.__o = {count: arr.length,
                                    items: arr.map(l => l.itemCount()),
                                    paths: arr.map(l => l.paths().join('|'))};
                      return true;
                  }).exceptionally(t => { window.__o = {error: '' + t}; return null; });
                """;
            Object overview = null;
            for (int attempt = 1; attempt <= 3; attempt++) {
                d.script(create);
                d.waitForScript("links listed", "window.__o", 120_000);
                overview = d.script("return window.__o");
                String err = String.valueOf(overview).replace('+', ' ');
                if (! err.contains("Champ root not present") && ! err.contains("CasException"))
                    break;
                System.out.println("  a create lost a race with another write, taking it again");
                Thread.sleep(2000);
            }
            System.out.println("overview: " + overview);
            if (overview.toString().contains("error"))
                throw new IllegalStateException("creating the links failed: " + overview);

            // now append the second folder to the first link, and list again
            d.script("""
                window.__a = null;
                const ctx = window.__drive.context;
                ctx.getAllSecretLinks().thenCompose(ls => {
                    // other tests in the run leave links of their own, so pick one that is
                    // actually missing something rather than assuming the first one is
                    const all = ls.toArray([]);
                    let first = null, other = null;
                    for (const l of all) {
                        const missing = window.__dirs.filter(p => ! l.contains(p));
                        if (missing.length > 0) { first = l; other = missing[0]; break; }
                    }
                    if (first == null) {
                        window.__a = {error: 'every link already holds both folders'};
                        return peergos.shared.util.Futures.of(true);
                    }
                    return ctx.addToSecretLink(first, other, false)
                        .thenCompose(() => ctx.getAllSecretLinks())
                        .thenApply(after => {
                            const arr = after.toArray([]);
                            const grown = arr.filter(l => l.getLabel() == first.getLabel())[0];
                            window.__a = {count: arr.length,
                                          grewTo: grown == null ? -1 : grown.itemCount(),
                                          holdsAdded: grown != null && grown.contains(other),
                                          added: other};
                            return true;
                        });
                }).exceptionally(t => { window.__a = {error: '' + t}; return null; });
                """);
            d.waitForScript("appended", "window.__a", 120_000);
            Object after = d.script("return window.__a");
            System.out.println("after adding: " + after);
            if (after.toString().contains("error"))
                throw new IllegalStateException("adding failed: " + after);
            // the link we added to gained the item; other tests in the run have links of their
            // own, so the total is not ours to assert
            java.util.Map m = (java.util.Map) after;
            if (! Boolean.TRUE.equals(m.get("holdsAdded")))
                throw new IllegalStateException("the link did not gain " + m.get("added") + ": " + after);
            if (((Number) m.get("grewTo")).intValue() < 2)
                throw new IllegalStateException("the link should hold at least two items now: " + after);
            System.out.println("PASS");
        }
    }
}
