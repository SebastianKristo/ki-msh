import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = KiHostViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Webvisningen starter under statuslinjen (header havner ikke i statuslinjen), men går helt ned i bunnen,
/// så dashbordet synes bak og under navbaren. Navbaren løfter seg selv over hjem-indikatoren med
/// env(safe-area-inset-bottom); det krever viewport-fit=cover, som legges til på alle sider (også HA).
class KiHostViewController: UIViewController {
    let bridgeViewController = CAPBridgeViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0x23 / 255.0, green: 0x23 / 255.0, blue: 0x23 / 255.0, alpha: 1)
        addChild(bridgeViewController)
        let web = bridgeViewController.view!
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: safe.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
        ])
        bridgeViewController.didMove(toParent: self)
        bridgeViewController.webView?.configuration.userContentController.addUserScript(
            WKUserScript(source: Self.viewportFitCover, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    static let viewportFitCover = """
    (function () {
      function fix() {
        var m = document.querySelector('meta[name=viewport]');
        if (!m) { m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width, initial-scale=1'; (document.head || document.documentElement).appendChild(m); }
        if (!/viewport-fit/.test(m.content)) m.content += ', viewport-fit=cover';
      }
      if (document.head) fix();
      document.addEventListener('DOMContentLoaded', fix);
    })();
    """

    // Statuslinje, rotasjon og hjem-indikator styres fortsatt av Capacitor (StatusBar-pluginen)
    override var childForStatusBarStyle: UIViewController? { bridgeViewController }
    override var childForStatusBarHidden: UIViewController? { bridgeViewController }
    override var childForHomeIndicatorAutoHidden: UIViewController? { bridgeViewController }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { bridgeViewController.supportedInterfaceOrientations }
}
