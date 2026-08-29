import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.*;

/** Add Subresource Integrity hashes to every script and stylesheet reference in a built webroot.
 *
 *  java AddSri.java &lt;webroot&gt;           rewrite every page in place
 *  java AddSri.java &lt;webroot&gt; -check    verify only, non zero exit if any page is out of date
 *
 *  Each reference also gets a ?v= stamp taken from the same hash. Without it a client can hold a
 *  stale bundle from the ten minute Cache-Control while fetching a fresh index.html, and under SRI
 *  that skew is a dead page rather than a subtle bug. StaticHandler routes on the path alone, so
 *  the query needs nothing on the server side.
 *
 *  References are resolved on disk relative to the page holding them, which is what the sandbox
 *  needs: StaticHandler serves a generated subdomain's /foo.js out of apps/sandbox/foo.js, so the
 *  URL and the file layout differ there, but the page relative path is right either way.
 */
public class AddSri {

    private static final Pattern TAG = Pattern.compile("(?i)<(script|link)(?=[\\s>])");
    private static final Pattern INTEGRITY = Pattern.compile("(?i)\\s+integrity\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)");

    private static final List<String> report = new ArrayList<>();
    private static final List<String> problems = new ArrayList<>();
    private static int hashed = 0, external = 0;

    public static void main(String[] a) throws Exception {
        if (a.length < 1 || (a.length > 1 && ! a[1].equals("-check"))) {
            System.err.println("usage: AddSri <webroot> [-check]");
            System.exit(2);
        }
        Path webroot = Paths.get(a[0]).toAbsolutePath().normalize();
        boolean checkOnly = a.length > 1;

        List<Path> pages;
        try (Stream<Path> tree = Files.walk(webroot)) {
            pages = tree.filter(p -> p.toString().endsWith(".html")).sorted().collect(Collectors.toList());
        }
        List<String> stale = new ArrayList<>();
        for (Path page : pages) {
            String original = Files.readString(page);
            String updated = process(page, webroot, original);
            if (updated.equals(original))
                continue;
            if (checkOnly)
                stale.add(webroot.relativize(page).toString());
            else
                Files.writeString(page, updated);
        }

        for (String line : report)
            System.out.println((checkOnly ? "AddSri stale: " : "AddSri: ") + line);
        for (String problem : problems)
            System.err.println("AddSri: " + problem);
        System.out.println("AddSri: " + pages.size() + " pages, " + hashed + " references hashed, "
                + external + " external skipped, " + problems.size() + " unresolved"
                + (checkOnly ? ", " + stale.size() + " pages out of date" : ""));
        if (! problems.isEmpty() || ! stale.isEmpty())
            System.exit(1);
    }

    /** Rewrite every managed tag in one page, leaving the rest of the file byte for byte alone. */
    private static String process(Path page, Path webroot, String src) throws Exception {
        List<int[]> comments = comments(src);
        StringBuilder out = new StringBuilder();
        Matcher tags = TAG.matcher(src);
        int copied = 0;
        while (tags.find()) {
            int start = tags.start();
            if (start < copied || isInside(comments, start))
                continue;
            int gt = endOfTagHead(src, start);
            if (gt < 0)
                break;
            out.append(src, copied, start)
                    .append(rewrite(src.substring(start, gt), tags.group(1).toLowerCase(), page, webroot));
            copied = gt;
        }
        return out.append(src, copied, src.length()).toString();
    }

    private static String rewrite(String head, String tag, Path page, Path webroot) throws Exception {
        String name = tag.equals("script") ? "src" : managedLink(head) ? "href" : null;
        if (name == null)
            return head;
        Attr ref = attribute(head, name);
        if (ref == null)
            return head; // an inline script, or a link with no href
        String value = ref.value.trim();
        if (value.isEmpty())
            return head;
        if (value.startsWith("//") || value.matches("(?i)^[a-z][a-z0-9+.-]*:.*")) {
            external++;
            return head; // needs crossorigin and CORS on the far end, and our CSP blocks it anyway
        }

        String path = value.split("[?#]", 2)[0];
        Path target = (path.startsWith("/") ? webroot.resolve(path.substring(1)) : page.getParent().resolve(path))
                .normalize();
        String where = webroot.relativize(page) + " -> " + path;
        if (! target.startsWith(webroot)) {
            problems.add(where + " escapes the webroot");
            return head;
        }
        if (! Files.isRegularFile(target)) {
            problems.add(where + " does not exist");
            return head;
        }

        byte[] digest = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(target));
        String want = "sha256-" + Base64.getEncoder().encodeToString(digest);
        Attr existing = attribute(head, "integrity");
        if (existing == null || ! existing.value.equals(want))
            report.add(where + " " + (existing == null ? want : existing.value + " -> " + want));
        hashed++;

        String stripped = INTEGRITY.matcher(head).replaceAll("");
        Attr ours = attribute(stripped, name);
        String stamped = stripped.substring(0, ours.valueStart) + stamp(value, hex(digest).substring(0, 8))
                + stripped.substring(ours.valueEnd);
        Attr moved = attribute(stamped, name);
        return stamped.substring(0, moved.end) + " integrity=\"" + want + "\"" + stamped.substring(moved.end);
    }

    /** SRI only covers stylesheets, module preloads, and preloads of a script or a stylesheet. */
    private static boolean managedLink(String head) {
        Attr rel = attribute(head, "rel");
        if (rel == null)
            return false;
        List<String> tokens = Arrays.asList(rel.value.toLowerCase().trim().split("\\s+"));
        if (tokens.contains("stylesheet") || tokens.contains("modulepreload"))
            return true;
        Attr as = attribute(head, "as");
        return tokens.contains("preload") && as != null
                && (as.value.equalsIgnoreCase("script") || as.value.equalsIgnoreCase("style"));
    }

    /** Set v= to the content hash, replacing any earlier stamp so a rerun stays a no-op. */
    private static String stamp(String value, String version) {
        int hash = value.indexOf('#');
        String fragment = hash < 0 ? "" : value.substring(hash);
        String rest = hash < 0 ? value : value.substring(0, hash);
        int question = rest.indexOf('?');
        String path = question < 0 ? rest : rest.substring(0, question);
        List<String> params = new ArrayList<>();
        if (question >= 0)
            for (String param : rest.substring(question + 1).split("&"))
                if (! param.isEmpty() && ! param.equals("v") && ! param.startsWith("v="))
                    params.add(param);
        params.add("v=" + version);
        return path + "?" + String.join("&", params) + fragment;
    }

    private static String hex(byte[] data) {
        StringBuilder res = new StringBuilder();
        for (byte b : data)
            res.append(String.format("%02x", b));
        return res.toString();
    }

    private static class Attr {
        final String value;
        final int valueStart, valueEnd; // the value itself, inside its quotes if it has any
        final int end; // just past the attribute, where a new one can be inserted

        Attr(String value, int valueStart, int valueEnd, int end) {
            this.value = value;
            this.valueStart = valueStart;
            this.valueEnd = valueEnd;
            this.end = end;
        }
    }

    private static Attr attribute(String head, String name) {
        Matcher m = Pattern.compile("(?i)(?<=\\s)" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))")
                .matcher(head);
        if (! m.find())
            return null;
        int group = m.group(2) != null ? 2 : m.group(3) != null ? 3 : 4;
        return new Attr(m.group(group), m.start(group), m.end(group), m.end());
    }

    /** The '>' closing the tag opened at from, ignoring any inside a quoted attribute value. */
    private static int endOfTagHead(String html, int from) {
        char quote = 0;
        for (int i = from; i < html.length(); i++) {
            char c = html.charAt(i);
            if (quote != 0) {
                if (c == quote)
                    quote = 0;
            } else if (c == '"' || c == '\'')
                quote = c;
            else if (c == '>')
                return i;
        }
        return -1;
    }

    private static List<int[]> comments(String html) {
        List<int[]> res = new ArrayList<>();
        for (int i = html.indexOf("<!--"); i >= 0; i = html.indexOf("<!--", i + 4)) {
            int end = html.indexOf("-->", i + 4);
            res.add(new int[]{i, end < 0 ? html.length() : end + 3});
            if (end < 0)
                break;
        }
        return res;
    }

    private static boolean isInside(List<int[]> ranges, int index) {
        return ranges.stream().anyMatch(r -> index >= r[0] && index < r[1]);
    }
}
