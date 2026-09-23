/** Taking a step again while the store is still settling under it.
 *
 *  The suite shares one server and one account across its tests, so a write can lose a
 *  compare-and-set against another client's write to the same cryptree, and something just
 *  published is not always readable on the very next call. Neither says anything about the
 *  code under test, and both clear if the step is taken again.
 *
 *  Only the errors named here are taken again. Anything else is a real failure and is left
 *  to fail on the spot, so a regression cannot hide behind a retry.
 */
public class Settle {

    public static boolean transientStorage(Object result) {
        // A JsException crossing the bridge arrives url-encoded, so "No secret link published!"
        // reads "No+secret+link+published!". Matching the plain wording against that silently
        // never fires, which is how the retry looked like it was working and was not.
        String s = String.valueOf(result).replace('+', ' ');
        return s.contains("CasException")
            || s.contains("Champ root not present")
            || s.contains("No secret link published");
    }

    /** Runs a step that leaves its result in window.<slot>, until the store stops moving. */
    public static Object step(WebDriver d, String what, String slot, String script) throws Exception {
        Object last = null;
        for (int attempt = 1; attempt <= 4; attempt++) {
            d.script(script);
            d.waitForScript(what, "window." + slot, 120_000);
            last = d.script("return window." + slot);
            if (! transientStorage(last))
                return last;
            System.out.println("  " + what + ": the store was mid-write, taking it again (" + attempt + "/4)");
            Thread.sleep(2000);
        }
        return last;
    }
}
