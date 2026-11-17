import UIKit
import WebKit

private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var owner: StudioViewController?
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.receive(message)
    }
}

final class StudioViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, UIDocumentPickerDelegate {
    private var web: WKWebView!
    private var webRoot: URL!
    private let handler = WeakMessageHandler()
    private let io = DispatchQueue(label: "art.ebrusim.files", qos: .userInitiated)
    private var store: GalleryStore?
    private var pendingExport: String?
    private var sceneObservers: [NSObjectProtocol] = []
    private var isTurkish: Bool { Locale.preferredLanguages.first?.hasPrefix("tr") == true }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(white: 0.08, alpha: 1)
        do { store = try GalleryStore() }
        catch { /* Painting and sharing remain usable; gallery operations report errors. */ }
        configureWebView()
        for (name, active) in [(UIApplication.willResignActiveNotification, false), (UIApplication.didBecomeActiveNotification, true)] {
            sceneObservers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.web?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('ebru-app-active',{detail:\(active)}))", completionHandler: nil)
            })
        }
    }
    deinit { sceneObservers.forEach(NotificationCenter.default.removeObserver); web?.configuration.userContentController.removeScriptMessageHandler(forName: "ebru") }

    private func configureWebView() {
        let content = WKUserContentController()
        handler.owner = self
        content.add(handler, name: "ebru")
        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = .all
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = .white
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        guard let root = Bundle.main.url(forResource: "www", withExtension: nil),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            showRecovery(message: isTurkish ? "Uygulama dosyaları bulunamadı. Paketi yeniden derle." : "App assets are missing. Rebuild the app.")
            return
        }
        webRoot = root.resolvingSymlinksInPath()
        web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, url.isFileURL, let root = webRoot,
              url.resolvingSymlinksInPath().path.hasPrefix(root.path + "/") else { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showRecovery(message: isTurkish ? "iOS grafik belleğini boşalttı. Kayıtlı çalışmaların korunur; kaydedilmemiş tuval kaybolabilir." : "iOS released graphics memory. Saved images are safe; unsaved canvas changes may be lost.")
    }
    private func showRecovery(message: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Ebrusim", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: isTurkish ? "Yeniden aç" : "Reload", style: .default) { [weak self] _ in
            guard let self, let root = self.webRoot else { return }
            self.web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        })
        present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard frame.isMainFrame, presentedViewController == nil else { completionHandler(false); return }
        let alert = UIAlertController(title: "Ebrusim", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: isTurkish ? "Vazgeç" : "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: isTurkish ? "Tamam" : "OK", style: .destructive) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    fileprivate func receive(_ message: WKScriptMessage) {
        guard message.webView === web, message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "file",
              let raw = message.body as? String,
              raw.utf8.count <= GalleryStore.maxBytes * 4 / 3 + 2048,
              let data = raw.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = payload["id"] as? String, id.range(of: "^[0-9]{1,12}$", options: .regularExpression) != nil,
              let action = payload["action"] as? String else { return }
        io.async { [weak self] in
            guard let self else { return }
            do {
                switch action {
                case "gallerySave":
                    guard let store = self.store, let source = payload["data"] as? String else { throw CocoaError(.fileWriteUnknown) }
                    self.reply(id, result: try store.save(dataURL: source).dictionary)
                case "galleryList":
                    guard let store = self.store else { throw CocoaError(.fileReadUnknown) }
                    self.reply(id, result: try store.list().map(\.dictionary))
                case "galleryDelete":
                    guard let store = self.store, let artworkId = payload["artworkId"] as? String else { throw CocoaError(.fileReadUnknown) }
                    try store.delete(id: artworkId)
                    self.reply(id, result: [:])
                case "shareFile", "saveFile":
                    let file = try self.prepareExport(payload)
                    DispatchQueue.main.async { self.presentExport(id: id, file: file, share: action == "shareFile") }
                default: throw CocoaError(.featureUnsupported)
                }
            } catch { self.reply(id, error: "Could not complete the operation. Check available storage and try again.") }
        }
    }
    private func reply(_ id: String, result: Any? = nil, error: String? = nil) {
        var message: [String: Any] = ["id": id]
        if let error { message["error"] = error } else { message["result"] = result ?? [:] }
        guard let data = try? JSONSerialization.data(withJSONObject: message), let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.web?.evaluateJavaScript("window.EbruNative && window.EbruNative.receive(\(json))", completionHandler: nil)
        }
    }
    private func prepareExport(_ payload: [String: Any]) throws -> URL {
        guard let mime = payload["mime"] as? String, let source = payload["data"] as? String else { throw CocoaError(.fileReadCorruptFile) }
        let extensions = ["image/png": "png", "video/mp4": "mp4", "video/webm": "webm"]
        guard let ext = extensions[mime] else { throw CocoaError(.fileReadCorruptFile) }
        let data = try GalleryStore.decodeDataURL(source)
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("EbrusimExports", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let file = directory.appendingPathComponent("ebrusim-\(UUID().uuidString).\(ext)")
        try data.write(to: file, options: [.atomic, .completeFileProtectionUnlessOpen])
        return file
    }
    private func presentExport(id: String, file: URL, share: Bool) {
        guard presentedViewController == nil, pendingExport == nil else { reply(id, error: "Another file action is already open"); return }
        if share {
            let controller = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            if let popover = controller.popoverPresentationController {
                popover.sourceView = web
                popover.sourceRect = CGRect(x: web.bounds.midX, y: web.bounds.maxY - 24, width: 1, height: 1)
                popover.permittedArrowDirections = .down
            }
            controller.completionWithItemsHandler = { [weak self] _, completed, _, error in
                if error != nil { self?.reply(id, error: "Could not share the file") }
                else { self?.reply(id, result: ["cancelled": !completed]) }
            }
            present(controller, animated: true)
        } else {
            pendingExport = id
            let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
            picker.delegate = self
            present(picker, animated: true)
        }
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let id = pendingExport else { return }
        pendingExport = nil
        reply(id, result: ["cancelled": urls.isEmpty])
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard let id = pendingExport else { return }
        pendingExport = nil
        reply(id, result: ["cancelled": true])
    }
}
