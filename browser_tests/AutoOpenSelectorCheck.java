import java.nio.file.*;

/**
 * An auto-open url names one member of a multi item link.
 *
 * The selector is a prefix of the member's map key rather than an index or a path, so what this
 * really checks is that it keeps naming the same item when the link is reordered - the case a
 * url already in someone's hands would otherwise get wrong - and that a selector for an item
 * since removed opens nothing rather than opening a different one.
 */
public class AutoOpenSelectorCheck {
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
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("aos-"), headless)) {
            d.navigate(url.endsWith("/") ? url : url + "/");
            d.waitForScript("login", "document.querySelector('input[name=username]')", 60_000);
            Page.login(d, "peergos", "testpassword");
            Page.gotoDrive(d);

            d.script("""
                window.__s = null;
                const ctx = window.__drive.context;
                const u = ctx.username;
                const dirs = (window.__drive.files||[]).filter(f => f.isDirectory())
                    .map(f => u + '/' + f.getName()).slice(0, 2);
                const L = a => peergos.client.JsUtil.asList(a);
                const resolve = url => peergos.shared.user.UserContext.fromSecretLinkV2(url,
                        {get_0: () => peergos.shared.util.Futures.of('')}, ctx.network, ctx.crypto);

                ctx.createSecretLinkTo(L(dirs), L([]), java.util.Optional.empty(), '', '', false)
                  .thenCompose(props => {
                    const url = props.toLinkString(ctx.signer.publicKeyHash);
                    // the selector of the SECOND member, so it cannot be confused with the landing item
                    const second = props.getMembers().toArray()[1].getSelector();
                    return resolve(url).thenCompose(r1 => {
                        const named = r1.pathForLinkSelector(second);
                        // now reverse the members: the same selector must still name the same item
                        // each update returns the props to use for the next one: they carry the
                        // champ entry it just wrote, and reusing a stale copy fails the CAS
                        return ctx.setSecretLinkMembers(L([dirs[1], dirs[0]]), L([]), props)
                            .thenCompose(p2 => resolve(url).thenApply(r2 => [p2, r2]))
                            .thenCompose(pair => {
                                const afterReorder = pair[1].pathForLinkSelector(second);
                                // and drop that member: the selector should now name nothing
                                return ctx.setSecretLinkMembers(L([dirs[0]]), L([]), pair[0])
                                    .thenCompose(() => resolve(url))
                                    .thenApply(r3 => {
                                        window.__s = {expected: '/' + dirs[1],
                                                      named: named,
                                                      afterReorder: afterReorder,
                                                      afterRemoval: r3.pathForLinkSelector(second)};
                                        return true;
                                    });
                            });
                    });
                  }).exceptionally(t => { window.__s = {error: '' + t}; return null; });
                """);
            d.waitForScript("selector checked", "window.__s", 180_000);
            Object r = d.script("return window.__s");
            System.out.println("selector: " + r);
            if (r.toString().contains("error"))
                throw new IllegalStateException("failed: " + r);
            java.util.Map m = (java.util.Map) r;
            String expected = String.valueOf(m.get("expected"));
            if (! expected.equals(String.valueOf(m.get("named"))))
                throw new IllegalStateException("selector should name " + expected + ", named " + m.get("named"));
            if (! expected.equals(String.valueOf(m.get("afterReorder"))))
                throw new IllegalStateException("reordering moved what the selector names: " + m.get("afterReorder"));
            if (! "".equals(String.valueOf(m.get("afterRemoval"))))
                throw new IllegalStateException("a removed member should be named by nothing, got " + m.get("afterRemoval"));
            System.out.println("PASS");
        }
    }
}
