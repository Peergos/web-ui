import java.util.*;

/** The few app interactions every test needs. */
public class Page {

    /** Signs in and waits for the app to finish loading.
     *
     *  The username and password are set through the native value setter and an input event
     *  rather than by typing: this form's vue model does not pick up a plain value assignment,
     *  and the app ends up signing in with a null username.
     */
    public static void login(WebDriver d, String username, String password) {
        // Key generation is scrypt, in the browser, so nothing the server links against changes
        // it. Windows just needs longer: the runner is slower and the sqlite backed server it is
        // talking to is slower still.
        long timeout = "1".equals(System.getenv("PEERGOS_TEST_SLOW")) ? 900_000 : 300_000;
        // Sign in is disabled until the network is up, and a click on a disabled button is
        // dropped in silence - no spinner, no error, the form still sitting there - so waiting
        // for the button is the difference between signing in and waiting out the whole timeout.
        d.waitForScript("the sign in button to be enabled", signInEnabled(), timeout);
        for (int round = 0; round < 3; round++) {
            fillCredentials(d, username, password);
            d.script("[...document.querySelectorAll('button')]" +
                    ".find(b => b.textContent.trim() === 'Sign in').click();");
            // The app disables the button while it is logging in, so its going away is the
            // click having been taken. A click that was dropped leaves it enabled.
            boolean taken = false;
            long end = System.currentTimeMillis() + 30_000;
            while (! taken && System.currentTimeMillis() < end) {
                taken = ! Boolean.TRUE.equals(d.scriptQuiet("return " + signInEnabled()));
                if (! taken)
                    WebDriver.sleep(500);
            }
            if (taken)
                break;
        }
        try {
            d.waitForScript("sign in to complete",
                    "document.body.innerText.indexOf('UPGRADE') >= 0", timeout);
        } catch (RuntimeException e) {
            // A sign in that never completes looks the same whether the form was never filled,
            // the click was dropped, the page went somewhere else, or key generation really is
            // still running. Say which, rather than reading a slow runner into every timeout.
            System.out.println("  sign in state: " + d.scriptQuiet("return ["
                    + "'href=' + location.href,"
                    + "'form=' + (!!document.querySelector('input[name=username]')),"
                    + "'username=' + (document.querySelector('input[name=username]') ?"
                    + "   document.querySelector('input[name=username]').value : 'n/a'),"
                    + "'passwordLength=' + (document.querySelector('input[name=password]') ?"
                    + "   document.querySelector('input[name=password]').value.length : 'n/a'),"
                    + "'signInEnabled=' + [...document.querySelectorAll('button')]"
                    + "   .some(b => b.textContent.trim() === 'Sign in' && ! b.disabled),"
                    + "'signInButton=' + [...document.querySelectorAll('button')]"
                    + "   .some(b => b.textContent.trim() === 'Sign in'),"
                    + "'spinner=' + (document.querySelectorAll('.spinner, .v-spinner').length > 0),"
                    + "'body=' + document.body.innerText.replace(/\\s+/g, ' ').slice(0, 200)"
                    + "].join(' ')"));
            throw e;
        }
    }

    /** A bare expression, not a statement: waitForScript wraps what it is given in a return. */
    private static String signInEnabled() {
        return "[...document.querySelectorAll('button')]"
                + ".some(b => b.textContent.trim() === 'Sign in' && ! b.disabled)";
    }

    /** Set through the native value setter and an input event rather than by typing: this
     *  form's vue model does not pick up a plain value assignment, and the app then signs in
     *  with a null username. */
    private static void fillCredentials(WebDriver d, String username, String password) {
        d.script(
                "const set = (el, v) => {" +
                "  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;" +
                "  s.call(el, v); el.dispatchEvent(new Event('input', {bubbles: true}));" +
                "};" +
                "set(document.querySelector('input[name=username]'), arguments[0]);" +
                "set(document.querySelector('input[name=password]'), arguments[1]);",
                username, password);
    }

    /** Opens the drive and hands back a handle on its vue component as window.__drive. */
    public static void gotoDrive(WebDriver d) {
        gotoView(d, "Drive", "downloadFile", "__drive");
        // the view mounts before the listing arrives, and an empty listing is indistinguishable
        // from a directory that has not loaded, so wait for the directory itself
        d.waitForScript("drive listing",
                "window.__drive.currentDir && !window.__drive.showSpinner", 180_000);
    }

    /** Selects an entry and opens it with View, in one call.
     *
     *  Both in one script deliberately: a listing refresh between selecting and opening clears
     *  selectedFiles, and openFile returns silently when nothing is selected - so the viewer
     *  never opens and every later assertion blames the viewer for a lost selection.
     */
    public static void viewFile(WebDriver d, String name) {
        // Retried, because a listing refresh landing during the open clears selectedFiles and
        // the half finished open goes nowhere: no viewer, no error. Rounds are long so a retry
        // cannot restart an open that is merely slow.
        for (int round = 0; round < 4; round++) {
            if (! Boolean.TRUE.equals(selectAndOpen(d, name)))
                throw new IllegalStateException("No entry called " + name + " in " + driveListing(d));
            if (viewerOpened(d, 30_000))
                return;
        }
        System.out.println("  view state: " + d.scriptQuiet("return ["
                + "'selected=' + (window.__drive.selectedFiles || []).length,"
                + "'spinner=' + window.__drive.showSpinner,"
                + "'sandbox=' + window.__drive.showAppSandbox,"
                + "'markup=' + window.__drive.showMarkupViewer,"
                + "'pdf=' + window.__drive.showPdfViewer,"
                + "'appName=' + window.__drive.sandboxAppName,"
                + "'lastOpen=[' + window.__viewDebug + ']',"
                + "'hashLength=' + location.hash.length,"
                + "'visible=' + JSON.stringify([...document.querySelectorAll("
                + "   '[class*=toast], [class*=dialog], [role=dialog]')]"
                + "   .map(x => x.innerText.replace(/\\n/g, ' ').trim())"
                + "   .filter(t => t.length > 0 && t.length < 200).slice(0, 3))"
                + "].join(' ')"));
        throw new IllegalStateException("The viewer never opened for " + name);
    }

    /** Selects and opens in one script, recording what the open decided.
     *
     *  Both in one call deliberately: a listing refresh between selecting and opening clears
     *  selectedFiles, and openFile returns silently when nothing is selected.
     */
    private static Object selectAndOpen(WebDriver d, String name) {
        return d.script("const wanted = arguments[0];" +
                "const f = (window.__drive.files || []).find(x =>" +
                "  (x.getName ? x.getName() : (x.props ? x.props.name : null)) === wanted);" +
                "if (! f) return false;" +
                "window.__drive.selectedFiles = [f];" +
                "const before = location.hash.length;" +
                "let app;" +
                "try { app = window.__drive.getApp(f, window.__drive.getPath, false); }" +
                "catch (e) { app = 'threw: ' + e; }" +
                "window.__drive.viewFile();" +
                "window.__viewDebug = 'app=' + app + ' hashBefore=' + before" +
                "  + ' hashAfter=' + location.hash.length" +
                "  + ' selectedAfter=' + (window.__drive.selectedFiles || []).length;" +
                "return true;", name);
    }

    private static boolean viewerOpened(WebDriver d, long millis) {
        long end = System.currentTimeMillis() + millis;
        while (System.currentTimeMillis() < end) {
            if (Boolean.TRUE.equals(d.scriptQuiet("return !!(window.__drive.showAppSandbox"
                    + " || window.__drive.showMarkupViewer || window.__drive.showPdfViewer)")))
                return true;
            WebDriver.sleep(250);
        }
        return false;
    }

    /** Selects a folder and starts zipping it in one call.
     *
     *  Separate calls let a listing refresh clear selectedFiles in between, and
     *  zipAndDownloadFolders copies the selection on entry: with nothing selected it still names
     *  an archive, still shows its progress toast, and still writes a valid empty zip - which
     *  passes for a download that worked right up until the archive is opened.
     */
    public static void zipFolder(WebDriver d, String name) {
        Object started = d.script("const wanted = arguments[0];" +
                "const f = (window.__drive.files || []).find(x =>" +
                "  (x.getName ? x.getName() : (x.props ? x.props.name : null)) === wanted);" +
                "if (! f) return 'no entry called ' + wanted;" +
                "window.__drive.selectedFiles = [f];" +
                "if ((window.__drive.selectedFiles || []).length === 0)" +
                "  return 'the selection did not stick';" +
                "window.__drive.zipAndDownloadFolders();" +
                "return true;", name);
        if (! Boolean.TRUE.equals(started))
            throw new IllegalStateException("Could not start zipping " + name + ": " + started
                    + " in " + driveListing(d));
    }

    /** Opens a view from the nav and hands back its component.
     *
     *  By clicking the nav, not by setting location.hash: after signing in the fragment holds the
     *  encrypted session, so assigning a route to it leaves the view mounted but never loaded -
     *  a permanent spinner with a null currentDir.
     *
     *  A click that lands before the app has finished wiring the nav is simply lost, so the click
     *  is retried - but only after a long wait. Clicking again while the view is still loading
     *  restarts the load, and with a short retry interval that livelocks: every round throws away
     *  what the previous round started, and the view never finishes on a slow machine even though
     *  it is plainly there by the time the test gives up.
     */
    public static void gotoView(WebDriver d, String navLabel, String methodName, String handle) {
        for (int round = 0; round < 5; round++) {
            if (awaitComponent(d, methodName, handle, 0))
                return;
            clickNav(d, navLabel);
            if (awaitComponent(d, methodName, handle, 60_000))
                return;
        }
        throw new IllegalStateException("The " + navLabel + " view never appeared. Visible: "
                + d.scriptQuiet("return document.body.innerText.replace(/\\n/g, ' | ').substring(0, 300)"));
    }

    private static void clickNav(WebDriver d, String navLabel) {
        Object clicked = d.scriptQuiet("const label = arguments[0];" +
                "const b = [...document.querySelectorAll('button')]" +
                "  .find(x => x.textContent.trim() === label);" +
                "if (b) { b.click(); return true; } return false;", navLabel);
        if (! Boolean.TRUE.equals(clicked))
            throw new IllegalStateException("No '" + navLabel + "' item in the nav");
    }

    /** Finds a mounted component exposing the named method, by walking the dom rather than the
     *  component tree, so nesting depth does not matter. */
    private static boolean awaitComponent(WebDriver d, String methodName, String handle, long millis) {
        long end = System.currentTimeMillis() + millis;
        boolean first = true;
        String find = "(() => {" +
                "  const wanted = '" + methodName + "';" +
                "  for (const el of document.querySelectorAll('*')) {" +
                "    const c = el.__vue__;" +
                "    if (c && typeof c[wanted] === 'function') { window." + handle + " = c; return true; }" +
                "  }" +
                "  return false;" +
                "})()";
        while (first || System.currentTimeMillis() < end) {
            first = false;
            if (Boolean.TRUE.equals(d.scriptQuiet("return " + find)))
                return true;
            if (System.currentTimeMillis() >= end)
                break;
            WebDriver.sleep(250);
        }
        return false;
    }

    /** Resolves a file by absolute peergos path and stashes it as window.__f[path]. */
    public static void resolve(WebDriver d, String path) {
        // The path is captured in a const rather than read from arguments inside the callback:
        // the callback runs long after the injected script returned, and arguments is not
        // reliably still in scope by then in every driver.
        d.script("const path = arguments[0];" +
                "window.__f = window.__f || {}; window.__fErr = window.__fErr || {};" +
                "window.__drive.context.getByPath(path)" +
                "  .thenApply(o => { window.__f[path] = o.isPresent() ? o.get() : null;" +
                "                    if (!o.isPresent()) window.__fErr[path] = 'no such file'; })" +
                "  .exceptionally(t => { window.__fErr[path] = '' + t; return null; });",
                path);
        d.waitUntil("resolve " + path, () -> {
            Object err = d.script("return window.__fErr ? window.__fErr[arguments[0]] || null : null", path);
            if (err != null)
                throw new IllegalStateException("Could not resolve " + path + ": " + err);
            return d.script("return !!(window.__f && window.__f[arguments[0]])", path);
        }, 120_000);
    }

    public static long size(WebDriver d, String path) {
        Object low = d.script("const p = window.__f[arguments[0]].getFileProperties();" +
                "let low = p.sizeLow(); if (low < 0) low = low + Math.pow(2, 32);" +
                "return low + p.sizeHigh() * Math.pow(2, 32);", path);
        return ((Number) low).longValue();
    }

    public static void download(WebDriver d, String path) {
        Object res = d.script("try { window.__drive.downloadFile(window.__f[arguments[0]]);"
                + "  return 'called'; } catch (e) { return 'threw: ' + e; }", path);
        if (! "called".equals(String.valueOf(res)))
            throw new IllegalStateException("downloadFile(" + path + ") " + res);
    }

    /** What the app is showing about work in flight: the download toasts carry a file name and
     *  a percentage, so a download that never started is visible as the absence of its toast. */
    public static String inFlight(WebDriver d) {
        return String.valueOf(d.scriptQuiet("return JSON.stringify("
                + "[...document.querySelectorAll('[class*=toast]')]"
                + "  .map(x => x.innerText.replace(/\\s+/g, ' ').trim())"
                + "  .filter(t => t.length > 0 && t.length < 200))"));
    }

    /** safaridriver has no remote file upload, so sendKeys on a file input does nothing there.
     *  Chromedriver and marionette both handle it. */
    public static boolean canDriveFilePicker(String engine) {
        return ! Browsers.engine(engine).equals(Browsers.Engine.SAFARI);
    }

    /** Hands the app the file list the picker would have produced.
     *
     *  Contents come from the same generator as Fixtures.patternFile, so whichever route the
     *  test took, the bytes hashed afterwards are the same.
     */
    public static void handFiles(WebDriver d, Map<String, Integer> namesToSizes) {
        StringBuilder list = new StringBuilder();
        for (Map.Entry<String, Integer> e : namesToSizes.entrySet()) {
            if (list.length() > 0)
                list.append(", ");
            list.append("mk('").append(e.getKey()).append("', ").append(e.getValue()).append(")");
        }
        d.script("function pattern(n) { const a = new Uint8Array(n);" +
                "  for (let i = 0; i < n; i++) a[i] = (i * 31 + 7) & 0xff; return a; }" +
                "function mk(name, size) { return new File([pattern(size)], name); }" +
                "window.__drive.uploadFiles({target: {files: [" + list + "]}});");
    }

    /** Names currently listed in the drive view. */
    public static List<String> driveListing(WebDriver d) {
        Object names = d.script("return (window.__drive.files || []).map(f =>" +
                " f.getName ? f.getName() : (f.props ? f.props.name : '?'));");
        List<String> out = new ArrayList<>();
        if (names instanceof List)
            for (Object o : (List<?>) names)
                out.add(String.valueOf(o));
        return out;
    }

    public static void waitForInDrive(WebDriver d, String name, long timeoutMillis) {
        d.waitUntil("'" + name + "' to appear in the drive",
                () -> driveListing(d).contains(name), timeoutMillis);
    }

    /** Navigates the drive to a path and waits for its listing. */
    public static void openPath(WebDriver d, String path, String expectedDirName) {
        d.script("window.__drive.changePath(arguments[0]);", path);
        d.waitForScript("the drive to open " + path,
                "window.__drive.currentDir"
                        + " && window.__drive.currentDir.getName() === '" + expectedDirName + "'"
                        + " && !window.__drive.showSpinner", 180_000);
    }

    public static String currentPath(WebDriver d) {
        return String.valueOf(d.script("return window.__drive.getPath"));
    }

    /** Selects a single entry by name, as clicking it in the ui would. */
    public static void select(WebDriver d, String name) {
        Object found = d.script("const n = arguments[0];" +
                "const f = (window.__drive.files || []).find(x =>" +
                "  (x.getName ? x.getName() : (x.props ? x.props.name : null)) === n);" +
                "if (f) window.__drive.selectedFiles = [f];" +
                "return !!f;", name);
        if (! Boolean.TRUE.equals(found))
            throw new IllegalStateException("No entry called " + name + " in " + driveListing(d));
    }

    /** Answers the yes/no dialog the drive raises before zipping a folder. */
    public static void confirmYes(WebDriver d, long timeoutMillis) {
        d.waitForScript("confirm dialog", "window.__drive.showConfirm", timeoutMillis);
        Object clicked = d.script(
                "const b = [...document.querySelectorAll('.pg-dialog button')]" +
                "  .find(x => x.textContent.trim() === 'Yes');" +
                "if (b) { b.click(); return true; } return false;");
        if (! Boolean.TRUE.equals(clicked))
            throw new IllegalStateException("No Yes button in the confirm dialog");
    }

    public static boolean errorShown(WebDriver d) {
        return Boolean.TRUE.equals(d.script("return !!window.__drive.showError"));
    }

    public static String errorText(WebDriver d) {
        return String.valueOf(d.script("return '' + window.__drive.errorTitle + ' / ' + window.__drive.errorBody"));
    }

    private static String quote(String s) {
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }
}
