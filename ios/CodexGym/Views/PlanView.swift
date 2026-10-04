import SwiftUI

struct PlanView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeader(
                    eyebrow: store.currentUser?.role.label ?? "",
                    title: "Pack de sesiones",
                    subtitle: "Consulta de consumo · pagos fuera de la app"
                )

                if store.currentUser?.role == .client ||
                    store.currentUser?.role == .reserve {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(store.activePack.name)
                                    .font(.title2.bold())
                                Text(
                                    store.currentUser?.role == .reserve
                                        ? "\(store.activePack.duration) minutos de sala"
                                        : "\(store.activePack.duration) minutos por entrenamiento"
                                )
                                    .font(.subheadline)
                                    .foregroundStyle(T.muted)
                            }
                            Spacer()
                            Text("\(store.remainingSessions)")
                                .font(.system(size: 44, weight: .black, design: .rounded))
                                .foregroundStyle(T.redLight)
                        }

                        ProgressView(value: store.activePack.progress)
                            .tint(T.red)

                        HStack {
                            Label(
                                "\(store.activePack.usedSessions) utilizadas",
                                systemImage: "checkmark.circle.fill"
                            )
                            Spacer()
                            Text("\(store.activePack.totalSessions) en total")
                        }
                        .font(.caption)
                        .foregroundStyle(T.muted)
                    }
                    .gymCard()

                    InfoPackRow(
                        icon: "calendar",
                        title: "Próxima sesión del pack",
                        value: "Sesión \(store.activePack.usedSessions + 1) de \(store.activePack.totalSessions)"
                    )
                    InfoPackRow(
                        icon: "creditcard.trianglebadge.exclamationmark",
                        title: "Pagos",
                        value: "No disponibles en la app durante el piloto"
                    )

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Packs definitivos pendientes")
                            .font(.headline)
                        Text(
                            "La duración admitida es de 45 o 60 minutos. Activate debe confirmar todavía los nombres, número de sesiones, vigencia y precios de cada pack."
                        )
                        .font(.subheadline)
                        .foregroundStyle(T.text2)
                    }
                    .gymCard()
                } else {
                    HStack(spacing: 12) {
                        PlanMetric(value: "1", label: "Centro piloto")
                        PlanMetric(value: "45/60", label: "Minutos")
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Configuración del piloto")
                            .font(.headline)
                        Label("Consumo de sesiones visible al cliente", systemImage: "checkmark.circle.fill")
                        Label("Compra y cobro fuera de la aplicación", systemImage: "creditcard")
                        Label("Catálogo y precios por confirmar", systemImage: "exclamationmark.circle")
                    }
                    .font(.subheadline)
                    .foregroundStyle(T.text2)
                    .gymCard()
                }
            }
            .padding(20)
            .padding(.bottom, 16)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct InfoPackRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(T.redLight)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.caption).foregroundStyle(T.muted)
                Text(value).font(.subheadline.bold())
            }
            Spacer()
        }
        .gymCard()
    }
}

private struct PlanMetric: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(value).font(.title2.bold()).foregroundStyle(T.text)
            Text(label).font(.caption).foregroundStyle(T.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
        .gymCard()
    }
}
