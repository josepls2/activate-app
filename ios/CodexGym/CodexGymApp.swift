import FirebaseAppCheck
import FirebaseCore
import UIKit

private final class ActivateAppCheckProviderFactory:
    NSObject,
    AppCheckProviderFactory
{
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        AppAttestProvider(app: app)
    }
}

@main
final class ActivateAppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions:
            [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        #if DEBUG
        AppCheck.setAppCheckProviderFactory(
            AppCheckDebugProviderFactory()
        )
        #else
        AppCheck.setAppCheckProviderFactory(
            ActivateAppCheckProviderFactory()
        )
        #endif
        FirebaseApp.configure()
        return true
    }
}
