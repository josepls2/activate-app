import SwiftUI

struct ClientsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var search = ""

    private var people: [AppUser] {
        let source = store.managedUsers
        guard !search.isEmpty else { return source }
        return source.filter {
            $0.name.localizedCaseInsensitiveContains(search) ||
                $0.email.localizedCaseInsensitiveContains(search) ||
                $0.dni.localizedCaseInsensitiveContains(search) ||
                $0.phone.localizedCaseInsensitiveContains(search)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                ScreenHeader(
                    eyebrow: store.currentUser?.role.label ?? "Equipo",
                    title: "Resumen de clientes",
                    subtitle: store.currentUser?.role == .boss
                        ? "Clientes Activate y usuarios de sala"
                        : "Sólo tus clientes asignados",
                    badge: people.count
                )

                TextField("Buscar por nombre, DNI, email o teléfono", text: $search)
                    .textInputAutocapitalization(.never)
                    .padding(14)
                    .background(T.card)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                if people.isEmpty {
                    EmptyState(
                        icon: "person.2",
                        title: "Sin clientes asignados",
                        message: "Los clientes aparecerán aquí al asignarlos desde Dirección."
                    )
                } else {
                    ForEach(people) { person in
                        ClientSummaryCard(
                            person: person,
                            cycle: store.clientCycleSummaries[person.id],
                            showCycle:
                                store.currentUser?.isTrainer == true &&
                                person.trainerIds.contains(
                                    store.currentUser?.id ?? ""
                                )
                        )
                    }
                }
            }
            .padding(20)
            .padding(.bottom, 18)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct ClientSummaryCard: View {
    let person: AppUser
    let cycle: CycleEntry?
    let showCycle: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(person.name)
                        .font(.headline)
                        .foregroundStyle(T.text)
                    Text(person.role == .reserve ? "Usuario de sala" : "Cliente Activate")
                        .font(.caption.bold())
                        .foregroundStyle(person.role == .reserve ? T.orange : T.redLight)
                }
                Spacer()
                Text("\(person.remainingSessions)")
                    .font(.title2.bold())
                    .foregroundStyle(T.text)
                Text("restantes")
                    .font(.caption2)
                    .foregroundStyle(T.muted)
            }

            HStack(spacing: 12) {
                Label("\(person.sessionDuration) min", systemImage: "clock")
                Label(
                    "\(person.trainerIds.count) entrenador\(person.trainerIds.count == 1 ? "" : "es")",
                    systemImage: "person.2"
                )
            }
            .font(.caption)
            .foregroundStyle(T.text2)

            if showCycle &&
                person.role == .client &&
                person.cycleTrackingEnabled
            {
                Divider().overlay(T.border)
                if !person.cycleSharingEnabled {
                    Label(
                        "La clienta no ha activado compartir el ciclo",
                        systemImage: "lock.fill"
                    )
                    .font(.caption)
                    .foregroundStyle(T.muted)
                } else if let cycle {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Resumen de ciclo compartido", systemImage: "drop.fill")
                            .font(.caption.bold())
                            .foregroundStyle(T.redLight)
                        Text(
                            "\(cycle.mood) · \(cycle.flow.label)" +
                            (cycle.symptoms.isEmpty
                                ? ""
                                : " · \(cycle.symptoms.sorted().joined(separator: ", "))")
                        )
                        .font(.caption)
                        .foregroundStyle(T.text2)
                    }
                } else {
                    Text("Sin registros de ciclo compartidos.")
                        .font(.caption)
                        .foregroundStyle(T.muted)
                }
            }
        }
        .gymCard()
    }
}
