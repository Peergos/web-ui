import java.io.*;
import java.nio.file.*;
import java.util.*;

/** Pages through two files in the hex viewer and checks every row it shows against the file.
 *
 *  The viewer holds one piece of a file at a time, so the places worth checking are the ones
 *  where the page and the piece it was read from disagree: the end of a file that is a whole
 *  number of pages, which End once went past (and on a file that is a whole number of chunks,
 *  read from a chunk that does not exist and never came back), the short last page of one
 *  that is not, and a page straddling the boundary between two chunks. Each file's byte at
 *  offset i follows a formula, so every row on screen is checked against the bytes it names
 *  rather than for something merely being there.
 *
 *  Usage: java -cp ../server/Peergos.jar HexViewerTest.java [engine] [url]
 */
public class HexViewerTest {

    static final int CHUNK = 5 * 1024 * 1024;
    static final String ROOT = "document.querySelector('.hex-viewer')";

    static int byteAt(long i) {
        return (((int) i * 0x9E3779B1) >>> 24) & 0xff;
    }

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
        Path serverDir = Paths.get("..", "server").toAbsolutePath().normalize();
        Path jar = serverDir.resolve("Peergos.jar");

        Server own = given == null ? Server.start(serverDir) : null;
        String url = own != null ? own.url() : given;

        long stamp = System.currentTimeMillis();
        // two whole chunks, and two chunks with a short page after them
        Path whole = write("hex-" + stamp + "-whole.bin", 2L * CHUNK);
        Path tail = write("hex-" + stamp + "-tail.bin", 2L * CHUNK + 300);
        try {
            Fixtures.upload(jar, url, Server.USERNAME, Server.PASSWORD, whole);
            Fixtures.upload(jar, url, Server.USERNAME, Server.PASSWORD, tail);
            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD, null, 120_000,
                    whole.getFileName().toString(), tail.getFileName().toString());

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), Temp.directory("peergos-hex-dl-"), headless)) {
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, Server.USERNAME, Server.PASSWORD);
                Page.gotoDrive(d);

                long last = 2L * CHUNK - 512;
                open(d, whole.getFileName().toString());
                page(d, "the start", 0, 32);
                key(d, 34);
                page(d, "a page down", 512, 32);
                key(d, 35);
                page(d, "End on a file of whole pages", last, 32);
                key(d, 33);
                page(d, "a page up from there", last - 512, 32);
                key(d, 36);
                page(d, "Home", 0, 32);
                close(d);

                open(d, tail.getFileName().toString());
                key(d, 35);
                // 300 bytes: 18 full rows and a row of 12
                page(d, "End on a file with a short last page", 2L * CHUNK, 19);
                key(d, 38);
                // 16 bytes before the second chunk ends and the 300 after it
                page(d, "a page across the end of a chunk", 2L * CHUNK - 16, 20);
                close(d);
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    static Path write(String name, long size) throws IOException {
        Path file = Temp.directory("peergos-hex-").resolve(name);
        try (OutputStream out = new BufferedOutputStream(Files.newOutputStream(file), 1 << 20)) {
            for (long i = 0; i < size; i++)
                out.write(byteAt(i));
        }
        return file;
    }

    static void open(WebDriver d, String name) {
        Page.waitForInDrive(d, name, 120_000);
        // as a click opens it, so that closing goes back to the drive
        Page.viewFile(d, name);
        d.waitForScript("the hex viewer", "!!" + ROOT + " && !!" + ROOT + ".querySelector('tr td')", 120_000);
    }

    /** The viewer's own keys, as it reads them: a keyup on the window with its key code. */
    static void key(WebDriver d, int code) {
        d.script("const e = new KeyboardEvent('keyup', {bubbles: true});"
                + " Object.defineProperty(e, 'keyCode', {get: () => arguments[0]});"
                + " window.dispatchEvent(e); return 1;", code);
    }

    /** Waits for the page starting at offset, then checks every row on it against the file. */
    static void page(WebDriver d, String what, long offset, int rows) {
        String want = String.format("%08X:", offset);
        try {
            d.waitForScript(what, "(() => { const td = " + ROOT + ".querySelector('tr td');"
                    + " return !!td && td.textContent.trim() === '" + want + "'; })()", 60_000);
        } catch (IllegalStateException e) {
            Object at = d.scriptQuiet("const td = " + ROOT + ".querySelector('tr td'); return td ? td.textContent.trim() : 'no rows'");
            throw new AssertionError(what + ": the page should start at " + want + " but shows " + at);
        }
        Object checked = d.script("const byteAt = i => (Math.imul(i, 0x9E3779B1) >>> 24) & 0xff;"
                + " const rows = [...(" + ROOT + ").querySelectorAll('tr')].filter(tr => tr.querySelector('td'));"
                + " const bad = [];"
                + " for (const tr of rows) {"
                + "   const tds = [...tr.querySelectorAll('td')];"
                + "   const off = parseInt(tds[0].textContent.trim().replace(':', ''), 16);"
                + "   const hex = tds.slice(1, 5).map(t => t.textContent.replace(/\\s/g, '')).join('');"
                + "   let expected = '';"
                + "   for (let i = 0; i < hex.length / 2; i++) expected += byteAt(off + i).toString(16).toUpperCase().padStart(2, '0');"
                + "   if (hex !== expected || hex.length === 0) bad.push(tds[0].textContent.trim());"
                + " }"
                + " return rows.length + ' ' + bad.join(' ');");
        String[] parts = String.valueOf(checked).split(" ", 2);
        int shown = Integer.parseInt(parts[0]);
        String wrong = parts.length > 1 ? parts[1].trim() : "";
        if (shown != rows)
            throw new AssertionError(what + ": " + rows + " rows expected, " + shown + " shown");
        if (! wrong.isEmpty())
            throw new AssertionError(what + ": rows not matching the file: " + wrong);
        System.out.println("  " + what + ": " + shown + " rows from " + want + " match the file");
    }

    static void close(WebDriver d) {
        d.script("const r = " + ROOT + ";"
                + " const x = r.querySelector('[aria-label=\"close\"], [aria-label=\"Close\"]')"
                + "   || [...r.querySelectorAll('span')].find(s => s.textContent.trim() === '×' && ! s.querySelector('span'));"
                + " x.click(); return 1;");
        d.waitForScript("the hex viewer to close", "!" + ROOT, 15_000);
    }
}
