import SwiftUI
import WebKit

@main
struct PeergosApp: App {
    static let name = "Peergos"
    static let port = ProcessInfo.processInfo.environment["PEERGOS_PORT"] ?? "7777";

    @NSApplicationDelegateAdaptor private var appDelegate: AppDelegate

    var body: some Scene {
        WindowGroup(Self.name) {
            PeergosWebView()
        }.defaultSize(width: 1280, height: 900)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        let app = NSApplication.shared;
        app.setActivationPolicy(.regular)
        app.activate()
    }
}

struct PeergosWebView: NSViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> WKWebView  {
        let config = WKWebViewConfiguration()
        let script = WKUserScript(
            source: "window.__IS_MACOS_WEBVIEW__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false)
        config.userContentController.addUserScript(script)
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.load(URLRequest(url: URL(string: "http://localhost:\(PeergosApp.port)")!))
        return webView
    }

    func updateNSView(_ uiView: WKWebView, context: Context) {
    }

    class Coordinator: NSObject,  WKNavigationDelegate, WKDownloadDelegate, WKUIDelegate {
        // MARK: - WKNavigationDelegate

        // Handle <a download> links and Content-Disposition: attachment navigation actions
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if #available(macOS 11.3, *) {
                if navigationAction.shouldPerformDownload {
                    decisionHandler(.download)
                    return
                }
            }
            decisionHandler(.allow)
        }

        // Handle responses that should be downloaded rather than rendered
        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if #available(macOS 11.3, *) {
                let isAttachment = (navigationResponse.response as? HTTPURLResponse)
                  .flatMap { $0.value(forHTTPHeaderField: "Content-Disposition") }
                  .map { $0.lowercased().hasPrefix("attachment") } ?? false
                if isAttachment || !navigationResponse.canShowMIMEType {
                    decisionHandler(.download)
                    return
                }
            }
            decisionHandler(.allow)
        }

        // Called when a navigation action becomes a download (macOS 11.3+)
        @available(macOS 11.3, *)
        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        // Called when a navigation response becomes a download (macOS 11.3+)
        @available(macOS 11.3, *)
        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        // MARK: - WKUIDelegate

        // Present the native file picker for <input type="file">
        func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
            let openPanel = NSOpenPanel()
            openPanel.allowsMultipleSelection = parameters.allowsMultipleSelection
            openPanel.canChooseDirectories = parameters.allowsDirectories
            openPanel.canChooseFiles = true
            openPanel.begin { result in
                completionHandler(result == .OK ? openPanel.urls : nil)
            }
        }

        // MARK: - WKDownloadDelegate

        @available(macOS 11.3, *)
        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
            let savePanel = NSSavePanel()
            savePanel.nameFieldStringValue = suggestedFilename
            savePanel.begin { result in
                completionHandler(result == .OK ? savePanel.url : nil)
            }
        }

        @available(macOS 11.3, *)
        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            let alert = NSAlert()
            alert.messageText = "Download Failed"
            alert.informativeText = error.localizedDescription
            alert.runModal()
        }

    }
}
