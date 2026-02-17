import Cocoa
import WebKit

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var port: String = "8000"
    
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