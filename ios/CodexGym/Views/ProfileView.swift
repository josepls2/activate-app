import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var store: AppStore
    @State private var notificationsEnabled = true
    @State private var showingTerms = false
    @State private var showingDeletionConfirmation = false
    @State private var deletionError: String?

    private var user: AppUser? { store.currentUser }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(
                    eyebrow: user?.role.label ?? "",
                    title: "Perfil",
                    subtitle: "Cuenta, consentimientos y preferencias"
                )

                HStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [T.redLight, T.redDark],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                        Text(initials)
                            .font(.title.bold())
                            .foregroundStyle(.white)
                    }
                    .frame(width: 72, height: 72)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(user?.name ?? "").font(.title3.bold())
                        Text(user?.email ?? "").font(.caption).foregroundStyle(T.muted)
                        Text(user?.phone ?? "").font(.caption).foregroundStyle(T.muted)
                    }
                }
                .gymCard()

                roleInformation

                if user?.role == .boss {
                    SectionTitle(title: "Equipo y colaboradores", count: store.staff.count)
                    ForEach(store.staff) { member in
                        InfoRow(
                            icon: staffIcon(member.kind),
                            label: member.kind.label,
                            value: member.name
                        )
                    }
                }

                if user?.role == .client || user?.role == .reserve {
                    SectionTitle(title: "Consentimientos")
                    InfoRow(
                        icon: "person.badge.shield.checkmark",
                        label: "Titular de la cuenta",
                        value: user?.isMinor == true
                            ? "Menor · responsable: \(user?.guardianName ?? "pendiente")"
                            : "Persona adulta"
                    )
                    InfoRow(
                        icon: "doc.text.fill",
                        label: "Términos",
                        value: user?.termsAccepted == true ? "Aceptados" : "Pendientes"
                    )
                    if user?.role == .client {
                        InfoRow(
                            icon: "camera.fill",
                            label: "Uso de imagen",
                            value: user?.imageConsent == true
                                ? "Autorizado"
                                : "No autorizado"
                        )
                    }

                    Button {
                        showingTerms = true
                    } label: {
                        Label(
                            user?.termsAccepted == true
                                ? "Consultar términos del piloto"
                                : "Revisar y aceptar términos",
                            systemImage: "doc.text.magnifyingglass"
                        )
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .frame(minHeight: 48)
                            .background(T.red.opacity(0.12))
                            .foregroundStyle(T.redLight)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                }

                SectionTitle(title: "Preferencias")
                VStack(spacing: 0) {
                    Toggle("Notificaciones", isOn: $notificationsEnabled)
                        .tint(T.red)
                        .padding(14)
                    Divider().overlay(T.border)
                    Toggle(
                        "Acceso con \(store.biometricName)",
                        isOn: Binding(
                            get: { store.biometricEnabled },
                            set: { store.setBiometricEnabled($0) }
                        )
                    )
                    .tint(T.red)
                    .disabled(!store.biometricAvailable)
                    .padding(14)
                    Divider().overlay(T.border)
                    HStack {
                        Label("Idioma", systemImage: "globe")
                        Spacer()
                        Text("Español").foregroundStyle(T.muted)
                    }
                    .padding(14)
                    Divider().overlay(T.border)
                    HStack {
                        Label("Privacidad y salud", systemImage: "lock.shield")
                        Spacer()
                        Text("Acceso restringido").foregroundStyle(T.muted)
                    }
                    .padding(14)
                }
                .background(T.card)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(T.border) }

                Button(role: .destructive) {
                    store.signOut()
                } label: {
                    Label("Cerrar sesión", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(.headline)
                        .foregroundStyle(T.error)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .frame(minHeight: 50)
                        .background(T.error.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }

                if user?.role != .boss {
                    Button(role: .destructive) {
                        showingDeletionConfirmation = true
                    } label: {
                        Text("Solicitar eliminación de mi cuenta")
                            .font(.caption.bold())
                            .foregroundStyle(T.muted)
                            .frame(maxWidth: .infinity)
                    }
                }

                if let deletionError {
                    Text(deletionError)
                        .font(.caption)
                        .foregroundStyle(T.error)
                }
            }
            .padding(20)
            .padding(.bottom, 16)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .sheet(isPresented: $showingTerms) {
            TermsView(allowAcceptance: user?.termsAccepted != true)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog(
            "¿Solicitar la eliminación de la cuenta?",
            isPresented: $showingDeletionConfirmation,
            titleVisibility: .visible
        ) {
            Button("Solicitar eliminación", role: .destructive) {
                Task {
                    deletionError = await store.requestAccountDeletion()
                }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text(
                "El acceso quedará desactivado y Activate tramitará la eliminación respetando las obligaciones legales de conservación."
            )
        }
    }

    @ViewBuilder
    private var roleInformation: some View {
        if user?.role == .boss {
            HStack(spacing: 12) {
                ProfileMetric(value: "1", label: "Centro piloto")
                ProfileMetric(value: "\(store.staff.count)", label: "Equipo")
            }
        } else if user?.role == .trainer {
            InfoRow(
                icon: "figure.strengthtraining.traditional",
                label: "Rol",
                value: "Entrenador de Activate"
            )
        } else if user?.role == .client {
            HStack(spacing: 12) {
                ProfileMetric(value: "\(store.activePack.usedSessions)", label: "Utilizadas")
                ProfileMetric(value: "\(store.remainingSessions)", label: "Disponibles")
            }
            InfoRow(
                icon: "person.fill",
                label: "Entrenadores",
                value: store.trainers.map(\.name).joined(separator: ", ")
            )
        } else {
            InfoRow(
                icon: "door.left.hand.open",
                label: "Permisos",
                value: "Reservar Sala de arriba, Sala de abajo o Sala de fisio"
            )
        }
    }

    private func staffIcon(_ kind: StaffKind) -> String {
        switch kind {
        case .trainer: "figure.strengthtraining.traditional"
        case .physiotherapist: "cross.case.fill"
        case .roomRental: "door.left.hand.open"
        case .physioRoomRental: "bed.double.fill"
        }
    }

    private var initials: String {
        (user?.name ?? "")
            .split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
            .joined()
    }
}

private struct TermsView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let allowAcceptance: Bool
    @State private var acceptsTerms = false
    @State private var imageConsent = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Label(
                        "Borrador operativo pendiente de revisión legal",
                        systemImage: "exclamationmark.shield.fill"
                    )
                    .font(.subheadline.bold())
                    .foregroundStyle(T.orange)
                    .gymCard()

                    TermsItem(
                        number: "1",
                        text: "Las sesiones son personales y no pueden cederse sin autorización escrita de Activate."
                    )
                    TermsItem(
                        number: "2",
                        text: "Avisando con más de 24 horas se podrá reorganizar la sesión sin perderla."
                    )
                    TermsItem(
                        number: "3",
                        text: "Avisando con menos de 4 horas, la sesión se contabilizará como realizada."
                    )
                    TermsItem(
                        number: "4",
                        text: "La regla aplicable entre 4 y 24 horas debe ser confirmada por Activate antes de publicar."
                    )
                    TermsItem(
                        number: "5",
                        text: "Las cuentas de menores requieren un consentimiento específico de padre, madre o tutor legal."
                    )
                    TermsItem(
                        number: "6",
                        text: "El consentimiento para uso de imagen es independiente y se puede rechazar."
                    )

                    Text(
                        "La fotografía original aportada por Activate se conserva en docs/reference para que un profesional revise la redacción completa."
                    )
                    .font(.caption)
                    .foregroundStyle(T.muted)

                    if allowAcceptance {
                        VStack(alignment: .leading, spacing: 14) {
                            Toggle(
                                "He leído y acepto los términos del piloto",
                                isOn: $acceptsTerms
                            )
                            .tint(T.red)

                            if store.currentUser?.role == .client {
                                Toggle(
                                    "Autorizo el uso de mi imagen",
                                    isOn: $imageConsent
                                )
                                .tint(T.red)
                                Text(
                                    "El uso de imagen es opcional y no condiciona el servicio."
                                )
                                .font(.caption)
                                .foregroundStyle(T.muted)
                            }

                            if let errorMessage {
                                Text(errorMessage)
                                    .font(.caption)
                                    .foregroundStyle(T.error)
                            }

                            Button {
                                isSaving = true
                                Task {
                                    errorMessage = await store.acceptTerms(
                                        imageConsent: imageConsent
                                    )
                                    isSaving = false
                                    if errorMessage == nil { dismiss() }
                                }
                            } label: {
                                HStack {
                                    Spacer()
                                    if isSaving { ProgressView() }
                                    Text("Guardar consentimientos")
                                    Spacer()
                                }
                                .font(.headline)
                                .padding(.vertical, 13)
                                .background(T.red)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                            }
                            .disabled(!acceptsTerms || isSaving)
                        }
                        .gymCard()
                    }
                }
                .padding(20)
            }
            .background(T.background)
            .navigationTitle("Términos del piloto")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct TermsItem: View {
    let number: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.caption.bold())
                .foregroundStyle(.white)
                .frame(width: 26, height: 26)
                .background(T.red)
                .clipShape(Circle())
            Text(text)
                .font(.subheadline)
                .foregroundStyle(T.text2)
            Spacer()
        }
        .gymCard()
    }
}

private struct ProfileMetric: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 5) {
            Text(value).font(.title.bold()).foregroundStyle(T.redLight)
            Text(label).font(.caption).foregroundStyle(T.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 72)
        .gymCard()
    }
}

private struct InfoRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(T.redLight)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(label).font(.caption).foregroundStyle(T.muted)
                Text(value).font(.subheadline.bold())
            }
            Spacer()
        }
        .gymCard()
    }
}
