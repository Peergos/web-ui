import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Opens a pdf from the drive in the pdf app and checks it actually rendered.
 *
 *  The viewer apps run in an iframe on a subdomain - pdf.<host> - so this is the only test that
 *  crosses an origin boundary, and the one that exercises the server's app subdomain handling,
 *  the frame-src in its CSP, and the app's postMessage handshake for getting the file's bytes in.
 *  A viewer that loads its chrome but never receives the file looks fine to the eye and renders
 *  nothing, so the assertion is on a canvas with real dimensions, not on the app appearing.
 *
 *  Usage: java -cp ../server/Peergos.jar PdfRenderTest.java [engine] [url]
 */
public class PdfRenderTest {

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

        String name = "render-" + System.currentTimeMillis() + ".pdf";
        Path pdf = Files.createTempDirectory("peergos-pdf-").resolve(name);
        Files.write(pdf, minimalPdf("Peergos browser test"));

        Path downloads = Files.createTempDirectory("peergos-pdf-dl-");
        try {
            Fixtures.upload(jar, url, Server.USERNAME, Server.PASSWORD, pdf);
            Fixtures.awaitListing(jar, url, Server.USERNAME, Server.PASSWORD, null, 120_000, name);

            try (WebDriver d = Browsers.launch(Browsers.engine(engine), downloads, headless)) {
                d.navigate(url + "/");
                d.waitForScript("login form", "document.querySelector('input[name=username]')", 60_000);
                Page.login(d, Server.USERNAME, Server.PASSWORD);
                Page.gotoDrive(d);
                Page.waitForInDrive(d, name, 120_000);

                System.out.println("opening " + name + " in the pdf app");
                d.script("window.__drive.openInApp({filename: arguments[0]}, 'pdf');", name);

                d.waitUntil("the pdf app frame", () -> d.find("#pdf"), 60_000);
                String frameSrc = String.valueOf(d.script(
                        "return document.getElementById('pdf').getAttribute('src')"));
                System.out.println("  frame src " + frameSrc);
                if (! frameSrc.contains("//pdf."))
                    throw new AssertionError("The pdf app should be framed from its own subdomain,"
                            + " got " + frameSrc);

                d.switchToFrame("#pdf");
                try {
                    // pdf.js builds a .page per page and paints into a canvas inside it
                    try {
                        // Three separate waits so a failure names the step that did not happen.
                        // Landing in the wrong document, an app that never ran, and a viewer
                        // that never painted all look identical from the last wait alone.
                        d.waitForScript("to be inside the pdf app document",
                                "location.href.indexOf('/apps/pdf/') >= 0", 60_000);
                        // Generous: initialising awaits storage, and a loaded runner has been
                        // seen to take longer than a minute over it. The wait ends as soon as
                        // the viewer is ready, so the ceiling costs a healthy run nothing.
                        d.waitForScript("the pdf viewer to initialise",
                                "window.PDFViewerApplication && PDFViewerApplication.initialized",
                                180_000);
                        d.waitForScript("a rendered page", "(() => {" +
                                "  const c = document.querySelector('#viewer .page canvas');" +
                                "  return c && c.width > 0 && c.height > 0;" +
                                "})()", 120_000);
                    } catch (RuntimeException e) {
                        // An empty viewer looks the same however it got that way, so say which
                        // of the steps between framing the app and painting a page did not run.
                        // href and the viewer container come first deliberately: an empty
                        // parent document and a frame whose app never ran report the same
                        // absent app and zero pages, and only the url tells them apart.
                        System.out.println("  pdf app state: " + d.scriptQuiet("return ["
                                + "'href=' + location.href,"
                                + "'readyState=' + document.readyState,"
                                + "'viewerContainer=' + (!!document.querySelector('#viewer')),"
                                + "'moduleTag=' + (!!document.querySelector('script[src*=viewer]')),"
                                + "'app=' + (!!window.PDFViewerApplication),"
                                + "'initialised=' + (window.PDFViewerApplication ?"
                                + "   PDFViewerApplication.initialized : 'n/a'),"
                                + "'document=' + (window.PDFViewerApplication ?"
                                + "   !!PDFViewerApplication.pdfDocument : 'n/a'),"
                                + "'pages=' + document.querySelectorAll('#viewer .page').length,"
                                + "'error=' + (document.querySelector('#errorMessage') ?"
                                + "   document.querySelector('#errorMessage').textContent.trim() : ''),"
                                + "'body=' + document.body.innerText.replace(/\\s+/g, ' ').slice(0, 120)"
                                + "].join(' ')"));
                        throw e;
                    }
                    Object width = d.script("return document.querySelector('#viewer .page canvas').width");
                    Object height = d.script("return document.querySelector('#viewer .page canvas').height");
                    Object pages = d.script("return document.querySelectorAll('#viewer .page').length");
                    System.out.println("  rendered " + pages + " page(s), first canvas "
                            + width + "x" + height);

                    Object text = d.script("const l = document.querySelector('#viewer .textLayer');"
                            + "return l ? l.textContent : '';");
                    if (String.valueOf(text).contains("Peergos browser test"))
                        System.out.println("  text layer holds the document's text");
                } finally {
                    d.switchToTop();
                }
                System.out.println("  ok   the pdf app rendered the file");
                System.out.println("PASS");
            }
        } finally {
            if (own != null)
                own.close();
        }
    }

    /** A one page pdf with a line of text, built here so the test carries no binary fixture. */
    static byte[] minimalPdf(String text) throws IOException {
        String stream = "BT /F1 18 Tf 30 120 Td (" + text + ") Tj ET\n";
        List<String> objects = List.of(
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200]"
                        + " /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
                "<< /Length " + stream.length() + " >>\nstream\n" + stream + "endstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        List<Integer> offsets = new ArrayList<>();
        write(out, "%PDF-1.4\n");
        for (int i = 0; i < objects.size(); i++) {
            offsets.add(out.size());
            write(out, (i + 1) + " 0 obj\n" + objects.get(i) + "\nendobj\n");
        }
        int xref = out.size();
        StringBuilder table = new StringBuilder("xref\n0 " + (objects.size() + 1) + "\n");
        table.append("0000000000 65535 f \n");
        for (int offset : offsets)
            table.append(String.format("%010d 00000 n %n", offset).replace(System.lineSeparator(), "\n"));
        table.append("trailer\n<< /Size ").append(objects.size() + 1).append(" /Root 1 0 R >>\n")
                .append("startxref\n").append(xref).append("\n%%EOF\n");
        write(out, table.toString());
        return out.toByteArray();
    }

    private static void write(ByteArrayOutputStream out, String s) throws IOException {
        out.write(s.getBytes(StandardCharsets.ISO_8859_1));
    }
}
