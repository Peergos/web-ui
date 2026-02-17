import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var port: String = "7777"
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        let args = CommandLine.arguments
        if args.count > 1 {
            port = args[1]
        }
        
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Peergos"
        window.center()
        
        webView = WKWebView(frame: window.contentView!.bounds)
        webView.autoresizingMask = [.width, .height]
        
        window.contentView?.addSubview(webView)
        
        webView.load(URLRequest(url: URL(string: "http://localhost:\(port)")!))
        
        window.makeKeyAndOrderFront(nil)
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        // Exit cleanly when window closes
        NSApplication.shared.terminate(self)
    }
}

// Bootstrap the app
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()