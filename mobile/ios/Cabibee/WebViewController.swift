import PhotosUI
import UIKit
import UniformTypeIdentifiers
import WebKit

/// Abre https://app.cabibee.com. La ubicación no se pide en esta versión.
final class WebViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate, PHPickerViewControllerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    private var webView: WKWebView!
    private var fileCompletion: (([URL]?) -> Void)?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.067, green: 0.067, blue: 0.067, alpha: 1)

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let page = WKWebpagePreferences()
        page.allowsContentJavaScript = true
        config.defaultWebpagePreferences = page

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(webView)
        webView.load(URLRequest(url: URL(string: "https://app.cabibee.com")!))
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if navigationAction.targetFrame == nil {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "mailto" || scheme == "tel" {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    @available(iOS 18.4, *)
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        fileCompletion = completionHandler
        let sheet = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
        sheet.addAction(UIAlertAction(title: "Fotos", style: .default) { [weak self] _ in
            self?.pickPhotos(multiple: parameters.allowsMultipleSelection)
        })
        sheet.addAction(UIAlertAction(title: "Tomar foto", style: .default) { [weak self] _ in
            self?.takePhoto()
        })
        sheet.addAction(UIAlertAction(title: "Archivo", style: .default) { [weak self] _ in
            self?.pickFile(multiple: parameters.allowsMultipleSelection)
        })
        sheet.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { [weak self] _ in
            self?.finishPicking(nil)
        })
        if let pop = sheet.popoverPresentationController {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 40, width: 1, height: 1)
        }
        present(sheet, animated: true)
    }

    private func pickPhotos(multiple: Bool) {
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.filter = .images
        config.selectionLimit = multiple ? 0 : 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        present(picker, animated: true)
    }

    private func takePhoto() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            finishPicking(nil)
            return
        }
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = self
        present(picker, animated: true)
    }

    private func pickFile(multiple: Bool) {
        let picker = UIDocumentPickerViewController(
            forOpeningContentTypes: [.image, .pdf, .audio, .movie, .data],
            asCopy: true
        )
        picker.allowsMultipleSelection = multiple
        picker.delegate = self
        present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard !results.isEmpty else {
            finishPicking(nil)
            return
        }
        let group = DispatchGroup()
        var urls: [URL] = []
        for result in results {
            group.enter()
            result.itemProvider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, _ in
                if let url, let copy = Self.copyToTemp(url) {
                    urls.append(copy)
                }
                group.leave()
            }
        }
        group.notify(queue: .main) { [weak self] in
            self?.finishPicking(urls.isEmpty ? nil : urls)
        }
    }

    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        guard let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.9) else {
            finishPicking(nil)
            return
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
        do {
            try data.write(to: url)
            finishPicking([url])
        } catch {
            finishPicking(nil)
        }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        finishPicking(nil)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        finishPicking(urls.isEmpty ? nil : urls)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        finishPicking(nil)
    }

    private func finishPicking(_ urls: [URL]?) {
        let done = fileCompletion
        fileCompletion = nil
        done?(urls)
    }

    private static func copyToTemp(_ url: URL) -> URL? {
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "-" + url.lastPathComponent)
        do {
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.copyItem(at: url, to: dest)
            return dest
        } catch {
            return nil
        }
    }
}
