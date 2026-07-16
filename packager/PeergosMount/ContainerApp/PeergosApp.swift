import AppKit
import FileProvider
import SwiftUI
import WebKit

@main
struct PeergosApp: App {
    static let port = ProcessInfo.processInfo.environment["PEERGOS_PORT"] ?? "7777"
    @NSApplicationDelegateAdaptor private var appDelegate: AppDelegate

    var body: some Scene {
        WindowGroup("Peergos") {
            PeergosWebView()
        }.defaultSize(width: 1280, height: 900)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    private var snapshotSource: DispatchSourceFileSystem?
    private var domain: NSFileProviderDomain?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate()
        installFileProviderDomain()
        watchSnapshotFile()
    }

    private func installFileProviderDomain() {
        let id = NSFileProviderDomainIdentifier(rawValue: kAppGroupID)
        let d = NSFileProviderDomain(identifier: id, displayName: "Peergos")
        self.domain = d
        NSFileProviderManager.add(d) { error in
            if let error { NSLog("PeergosMount: add domain failed: \(error)") }
        }
    }

    private func watchSnapshotFile() {
        guard let containerURL = MountConfig.containerURL() else { return }
        let snapshotURL = containerURL.appendingPathComponent(MountConfig.snapshotFilename)
        if !FileManager.default.fileExists(atPath: snapshotURL.path) {
            try? "{}".write(to: snapshotURL, atomically: true, encoding: .utf8)
        }
        let fd = open(snapshotURL.path, O_EVTONLY)
        guard fd >= 0 else { return }
        let src = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: .write, queue: .main)
        src.setEventHandler { [weak self] in self?.signalEnumerator() }
        src.setCancelHandler { close(fd) }
        src.resume()
        snapshotSource = src
    }

    private func signalEnumerator() {
        guard let domain else { return }
        NSFileProviderManager(for: domain)?.signalEnumerator(for: .workingSet) { error in
            if let error { NSLog("PeergosMount: signalEnumerator failed: \(error)") }
        }
    }
}

struct PeergosWebView: NSViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.load(URLRequest(url: URL(string: "http://localhost:\(PeergosApp.port)")!))
        return webView
    }

    func updateNSView(_ uiView: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
            return nil
        }
    }
}
