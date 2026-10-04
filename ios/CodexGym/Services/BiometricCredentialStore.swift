import Foundation
import LocalAuthentication
import Security

enum BiometricCredentialStore {
    private static let service = "com.activatepersonaltraining.app.biometric-login"
    private static let account = "last-authenticated-user"

    static func save(userID: String) throws {
        delete()

        var accessError: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            &accessError
        ) else {
            throw accessError?.takeRetainedValue() ??
                NSError(
                    domain: NSOSStatusErrorDomain,
                    code: Int(errSecParam),
                    userInfo: nil
                )
        }

        let data = Data(userID.utf8)
        let attributes: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecAttrAccessControl: accessControl,
            kSecValueData: data,
        ]
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(
                domain: NSOSStatusErrorDomain,
                code: Int(status),
                userInfo: nil
            )
        }
    }

    static func read(using context: LAContext) throws -> String {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
            kSecUseAuthenticationContext: context,
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let userID = String(data: data, encoding: .utf8),
              !userID.isEmpty
        else {
            throw NSError(
                domain: NSOSStatusErrorDomain,
                code: Int(status),
                userInfo: nil
            )
        }
        return userID
    }

    static func delete() {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
