import SwiftUI
import UIKit

/// Controlador inicial declarado en Main.storyboard.
///
/// La navegación interior sigue en SwiftUI porque se adapta mejor a todos los
/// tamaños de iPhone y permite mantener una única interfaz para todos los roles.
final class RootViewController: UIViewController {
    private let store = AppStore()
    private var hostingController: UIHostingController<AnyView>?

    override func viewDidLoad() {
        super.viewDidLoad()

        let root = AnyView(
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        )
        let hostingController = UIHostingController(rootView: root)
        hostingController.view.backgroundColor = .clear

        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingController.view.leadingAnchor.constraint(
                equalTo: view.leadingAnchor
            ),
            hostingController.view.trailingAnchor.constraint(
                equalTo: view.trailingAnchor
            ),
            hostingController.view.topAnchor.constraint(
                equalTo: view.topAnchor
            ),
            hostingController.view.bottomAnchor.constraint(
                equalTo: view.bottomAnchor
            ),
        ])
        hostingController.didMove(toParent: self)
        self.hostingController = hostingController
    }
}
