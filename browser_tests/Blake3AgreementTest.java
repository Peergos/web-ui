import peergos.shared.crypto.hash.Blake3;
import peergos.shared.user.fs.Chunk;
import peergos.shared.util.ArrayOps;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The browser's BLAKE3 and the Java one must agree, byte for byte.
 *
 * They are different implementations of the same thing - generated JavaScript in a worker,
 * and {@link Blake3} compiled from Java - and the tree they build together is written into
 * cryptree nodes and can never be re-derived. A disagreement would not throw: it would
 * store a root hash that is wrong, for a file that has already been uploaded.
 *
 * So this runs the real shipped path, not the kernel: the module workers the app posts to,
 * loaded from the running server under the app's own CSP, including the file worker that
 * slices a File. Values are compared against the Java implementation, which is itself
 * checked against the official vectors and against b3sum elsewhere.
 *
 * Usage: java -cp ../server/Peergos.jar Blake3AgreementTest.java [firefox|chromium] [url]
 */
public class Blake3AgreementTest {

    /** Sizes worth disagreeing at: block and chunk edges, and the real 4 MiB chunk. */
    private static final long[] SIZES = {
            0, 1, 63, 64, 65, 1023, 1024, 1025, 2048, 4095, 4096, 4097,
            Chunk.DEFAULT_SIZE - 1, Chunk.DEFAULT_SIZE, Chunk.DEFAULT_SIZE + 1024,
    };

    public static void main(String[] args) throws Exception {
        run(args);
    }

    public static void run(String[] args) throws Exception {
        String engine = args.length > 0 ? args[0] : "firefox";
        String url = args.length > 1 ? args[1] : "http://localhost:8080";
        boolean headless = ! "0".equals(System.getenv("HEADLESS"));

        Path downloads = Temp.directory("peergos-blake3-");
        try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
            d.navigate(url.endsWith("/") ? url : url + "/");
            d.waitForScript("app loaded", "document.querySelector('input[name=username]')", 60_000);

            // what the browser should produce, computed here
            Map<String, String> expected = new LinkedHashMap<>();
            for (long size : SIZES) {
                byte[] data = deterministic(size);
                expected.put("hash:" + size, ArrayOps.bytesToHex(Blake3.hash(data)));
                if (size > 0) {
                    // as one chunk of a bigger file, at a few different offsets, so the
                    // chunk counter is exercised rather than always being zero
                    for (long startChunk : new long[]{0, 1, 4096}) {
                        expected.put("cv:" + size + ":" + startChunk,
                                ArrayOps.bytesToHex(Blake3.tailChainingValue(data, 0, data.length, startChunk)));
                    }
                }
            }

            String script = page(SIZES);
            d.script(script);
            d.waitForScript("workers finished", "window.__b3done", 180_000);
            Object err = d.script("return window.__b3error");
            if (err != null)
                throw new IllegalStateException("browser reported: " + err);

            @SuppressWarnings("unchecked")
            Map<String, Object> got = (Map<String, Object>) d.script("return window.__b3");

            List<String> failures = new ArrayList<>();
            for (Map.Entry<String, String> e : expected.entrySet()) {
                // every value is produced twice in the browser: once from a buffer, once by
                // the worker that slices a File, since the app uses both
                for (String via : new String[]{"buffer", "file"}) {
                    String key = via + "/" + e.getKey();
                    Object actual = got.get(key);
                    if (actual == null)
                        failures.add(key + " missing from the browser's results");
                    else if (! e.getValue().equals(actual))
                        failures.add(key + "\n      java: " + e.getValue() + "\n   browser: " + actual);
                }
            }
            if (! failures.isEmpty())
                throw new AssertionError("browser and java BLAKE3 disagree in " + failures.size()
                        + " of " + (expected.size() * 2) + " cases:\n  " + String.join("\n  ", failures));
            System.out.println("PASS: " + (expected.size() * 2) + " values agree between "
                    + engine + " and java, over " + SIZES.length + " sizes up to "
                    + (Chunk.DEFAULT_SIZE + 1024) + " bytes");
        }
    }

    /**
     * The same bytes on both sides without shipping megabytes through the driver: a plain
     * 32 bit LCG, which Java and JavaScript agree on given Math.imul.
     */
    static byte[] deterministic(long size) {
        byte[] out = new byte[(int) size];
        int x = (int) (size + 1);
        for (int i = 0; i < out.length; i++) {
            x = x * 1103515245 + 12345;
            out[i] = (byte) (x >>> 16);
        }
        return out;
    }

    private static String page(long[] sizes) {
        StringBuilder sizeList = new StringBuilder();
        for (long s : sizes)
            sizeList.append(sizeList.length() == 0 ? "" : ",").append(s);
        return """
            window.__b3 = {}; window.__b3done = false; window.__b3error = null;
            (async function() {
              try {
                function bytes(size) {
                  const out = new Uint8Array(size);
                  let x = (size + 1) | 0;
                  for (let i = 0; i < size; i++) {
                    x = (Math.imul(x, 1103515245) + 12345) | 0;
                    out[i] = (x >>> 16) & 0xff;
                  }
                  return out;
                }
                function hex(arr) {
                  let s = '';
                  for (let i = 0; i < arr.length; i++) s += ((arr[i] & 0xff) + 256).toString(16).slice(1);
                  return s;
                }
                function pool(path) {
                  const w = new Worker(path, {type: 'module'});
                  const pending = new Map();
                  let next = 0;
                  w.onmessage = e => {
                    const p = pending.get(e.data.id);
                    if (!p) return;
                    pending.delete(e.data.id);
                    e.data.error ? p.rej(e.data.error) : p.res(e.data.result);
                  };
                  w.onerror = e => { window.__b3error = 'worker ' + path + ': ' + (e.message || e); };
                  return (msg, transfer) => new Promise((res, rej) => {
                    const id = next++;
                    pending.set(id, {res, rej});
                    w.postMessage(Object.assign({id: id}, msg), transfer || []);
                  });
                }
                const buffered = pool('/js/blake3-worker.js');
                const sliced = pool('/js/blake3-file-worker.js');
                const lo = n => n >>> 0, hi = n => Math.floor(n / 4294967296);

                for (const size of [%s]) {
                  const data = bytes(size);
                  const file = new File([data], 'f.bin');
                  const cases = [['hash:' + size, false, 0]];
                  if (size > 0)
                    for (const sc of [0, 1, 4096]) cases.push(['cv:' + size + ':' + sc, true, sc]);

                  for (const [key, cv, startChunk] of cases) {
                    const copy = data.slice().buffer;
                    window.__b3['buffer/' + key] = hex(await buffered(
                      {data: copy, chainingValue: cv, startChunkHi: hi(startChunk), startChunkLo: lo(startChunk)}, [copy]));
                    window.__b3['file/' + key] = hex(await sliced(
                      {file: file, start: 0, end: size, chainingValue: cv,
                       startChunkHi: hi(startChunk), startChunkLo: lo(startChunk)}));
                  }
                }
              } catch (e) {
                window.__b3error = '' + (e && e.stack ? e.stack : e);
              }
              window.__b3done = true;
            })();
            """.formatted(sizeList.toString());
    }
}
