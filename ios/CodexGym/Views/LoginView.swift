import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isSigningIn = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: sectionSpacing) {
                Spacer(minLength: verticalSizeClass == .compact ? 4 : 24)

                VStack(alignment: .leading, spacing: 10) {
                    Image("BrandLogo")
                        .resizable()
                        .scaledToFit()
                        .frame(
                            maxWidth: 360,
                            maxHeight: verticalSizeClass == .compact ? 72 : 110,
                            alignment: .leading
                        )
                        .accessibilityLabel("Activate Personal Training")

                    Text("Activate Personal Training")
                        .font(.title2.bold())
                        .foregroundStyle(T.text)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Accede con tu cuenta. Los permisos se asignan automáticamente.")
                        .font(.subheadline)
                        .foregroundStyle(T.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }

                VStack(spacing: 14) {
                    InputField(
                        title: "Email",
                        icon: "envelope",
                        text: $email,
                        isSecure: false
                    )
                    InputField(
                        title: "Contraseña",
                        icon: "lock",
                        text: $password,
                        isSecure: true
                    )

                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(T.error)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(T.error.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    Button {
                        Task {
                            isSigningIn = true
                            errorMessage = await store.signIn(
                                email: email,
                                password: password
                            )
                            isSigningIn = false
                        }
                    } label: {
                        Text(isSigningIn ? "Accediendo…" : "Entrar")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .frame(minHeight: 52)
                            .background(T.red)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(isSigningIn)
                    .accessibilityHint("Accede con tu cuenta de Activate")

                    if store.canUseBiometricLogin {
                        Button {
                            Task {
                                errorMessage = await store.signInWithBiometrics()
                            }
                        } label: {
                            Label(
                                store.isAuthenticatingBiometrics
                                    ? "Verificando…"
                                    : "Acceder con \(store.biometricName)",
                                systemImage: store.biometricName == "Touch ID"
                                    ? "touchid"
                                    : "faceid"
                            )
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .frame(minHeight: 50)
                            .background(T.card)
                            .foregroundStyle(T.text)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                            .overlay {
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(T.border)
                            }
                        }
                        .disabled(store.isAuthenticatingBiometrics)
                        .accessibilityHint(
                            "Desbloquea el último perfil autenticado"
                        )
                    }
                }

                Label(
                    "Acceso seguro conectado con Activate",
                    systemImage: "lock.shield.fill"
                )
                .font(.caption)
                .foregroundStyle(T.muted)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, horizontalPadding)
            .padding(.vertical, verticalSizeClass == .compact ? 12 : 20)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .onAppear {
            store.refreshBiometricAvailability()
        }
        .scrollDismissesKeyboard(.interactively)
        .background {
            ZStack {
                T.background
                RadialGradient(
                    colors: [T.red.opacity(0.22), .clear],
                    center: .topTrailing,
                    startRadius: 0,
                    endRadius: 440
                )
            }
            .ignoresSafeArea()
        }
    }

    private var horizontalPadding: CGFloat {
        horizontalSizeClass == .regular ? 32 : 20
    }

    private var sectionSpacing: CGFloat {
        verticalSizeClass == .compact ? 18 : 26
    }
}

private struct InputField: View {
    let title: String
    let icon: String
    @Binding var text: String
    let isSecure: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(T.muted)
                .frame(width: 20)
            Group {
                if isSecure {
                    SecureField(title, text: $text)
                } else {
                    TextField(title, text: $text)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                }
            }
            .foregroundStyle(T.text)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(minHeight: 52)
        .background(T.card)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay { RoundedRectangle(cornerRadius: 14).stroke(T.border) }
    }
}
