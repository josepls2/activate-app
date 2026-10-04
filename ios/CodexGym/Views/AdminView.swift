import SwiftUI

struct AdminView: View {
    @EnvironmentObject private var store: AppStore
    @State private var showingNewClient = false
    @State private var packClient: AppUser?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                ScreenHeader(
                    eyebrow: "Sólo Dirección",
                    title: "Gestión",
                    subtitle: "Altas, bonos y asignación de entrenadores"
                )

                Button {
                    showingNewClient = true
                } label: {
                    Label(
                        "Dar de alta cliente o usuario de sala",
                        systemImage: "person.badge.plus"
                    )
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(T.red)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }

                SectionTitle(
                    title: "Clientes y usuarios de sala",
                    count: store.managedUsers.count
                )
                ForEach(store.managedUsers) { person in
                    Button {
                        packClient = person
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(person.name)
                                    .font(.headline)
                                    .foregroundStyle(T.text)
                                Text(
                                    "\(person.role.label) · \(person.remainingSessions) sesiones"
                                )
                                .font(.caption)
                                .foregroundStyle(T.muted)
                            }
                            Spacer()
                            Label("Añadir bono", systemImage: "plus.circle.fill")
                                .font(.caption.bold())
                                .foregroundStyle(T.redLight)
                        }
                        .gymCard()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(20)
            .padding(.bottom, 18)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .sheet(isPresented: $showingNewClient) {
            NewClientSheet()
                .environmentObject(store)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $packClient) { client in
            AddPackSheet(client: client)
                .environmentObject(store)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
    }
}

private struct NewClientSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var dni = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var selectedTrainerStaffIds = Set<String>()
    @State private var duration = 45
    @State private var packName = "Bono inicial"
    @State private var packSessions = 10
    @State private var isMinor = false
    @State private var isFemale = false
    @State private var cycleTrackingEnabled = false
    @State private var guardianName = ""
    @State private var guardianEmail = ""
    @State private var isRoomUser = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var formValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
            dni.filter { $0.isLetter || $0.isNumber }.count >= 6 &&
            email.contains("@") &&
            (isRoomUser || !selectedTrainerStaffIds.isEmpty) &&
            packSessions > 0 &&
            (isRoomUser || !isMinor || (
                !guardianName.isEmpty && guardianEmail.contains("@")
            ))
    }

    private var realTrainers: [StaffMember] {
        store.staff.filter { $0.kind == .trainer }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Cliente") {
                    Picker("Tipo de alta", selection: $isRoomUser) {
                        Text("Cliente Activate").tag(false)
                        Text("Usuario de sala").tag(true)
                    }
                    .pickerStyle(.segmented)
                    TextField("DNI, NIE o documento", text: $dni)
                        .textInputAutocapitalization(.characters)
                    TextField("Nombre y apellidos", text: $name)
                    TextField("Correo", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    TextField("Teléfono", text: $phone)
                        .keyboardType(.phonePad)
                }

                if !isRoomUser {
                    Section("Entrenadores asignados") {
                    if realTrainers.isEmpty {
                        Text("No hay entrenadores activos en el directorio de Firebase.")
                            .foregroundStyle(T.orange)
                    }
                    ForEach(realTrainers) { trainer in
                        Button {
                            if selectedTrainerStaffIds.contains(trainer.id) {
                                selectedTrainerStaffIds.remove(trainer.id)
                            } else {
                                selectedTrainerStaffIds.insert(trainer.id)
                            }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(trainer.name)
                                    Text(
                                        trainer.authUid == nil
                                            ? "Acceso pendiente"
                                            : "Acceso Firebase activo"
                                    )
                                    .font(.caption2)
                                    .foregroundStyle(T.muted)
                                }
                                Spacer()
                                Image(
                                    systemName: selectedTrainerStaffIds.contains(trainer.id)
                                        ? "checkmark.circle.fill"
                                        : "circle"
                                )
                                .foregroundStyle(T.redLight)
                            }
                        }
                    }
                }
                }

                Section("Bono") {
                    TextField("Nombre del bono", text: $packName)
                    Stepper("\(packSessions) sesiones", value: $packSessions, in: 1...100)
                    Picker("Duración", selection: $duration) {
                        Text("45 minutos").tag(45)
                        Text("60 minutos").tag(60)
                    }
                }

                if !isRoomUser {
                    Section("Menor de edad") {
                    Toggle("Es menor", isOn: $isMinor)
                    if isMinor {
                        TextField("Responsable legal", text: $guardianName)
                        TextField("Correo del responsable", text: $guardianEmail)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                    }
                }
                }

                if !isRoomUser {
                    Section("Privacidad y salud") {
                        Toggle("La clienta es mujer", isOn: $isFemale)
                        if isFemale {
                            Toggle(
                                "Activar seguimiento de ciclo",
                                isOn: $cycleTrackingEnabled
                            )
                            Text(
                                "La clienta decidirá aparte si comparte el resumen " +
                                "con sus entrenadores."
                            )
                            .font(.caption)
                            .foregroundStyle(T.muted)
                        }
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(T.error)
                    }
                }

                Section {
                    Button {
                        isSaving = true
                        errorMessage = nil
                        Task {
                            let error = await store.createClient(
                                name: name,
                                dni: dni,
                                email: email,
                                phone: phone,
                                trainerStaffIds: Array(selectedTrainerStaffIds),
                                duration: duration,
                                packName: packName,
                                packSessions: packSessions,
                                isMinor: isRoomUser ? false : isMinor,
                                isRoomUser: isRoomUser,
                                isFemale: isRoomUser ? false : isFemale,
                                cycleTrackingEnabled: cycleTrackingEnabled,
                                guardianName: guardianName,
                                guardianEmail: guardianEmail
                            )
                            isSaving = false
                            if let error {
                                errorMessage = error
                            } else {
                                dismiss()
                            }
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if isSaving { ProgressView() }
                            Text(
                                isRoomUser
                                    ? "Crear usuario de sala"
                                    : "Crear y enviar acceso"
                            )
                            Spacer()
                        }
                    }
                    .disabled(!formValid || isSaving)
                }
            }
            .navigationTitle(
                isRoomUser ? "Nuevo usuario de sala" : "Nuevo cliente"
            )
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct AddPackSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let client: AppUser
    @State private var sessions = 10
    @State private var duration: Int
    @State private var name = "Nuevo bono"
    @State private var errorMessage: String?

    init(client: AppUser) {
        self.client = client
        _duration = State(initialValue: client.sessionDuration)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(client.name) {
                    TextField("Nombre del bono", text: $name)
                    Stepper("\(sessions) sesiones", value: $sessions, in: 1...100)
                    Picker("Duración", selection: $duration) {
                        Text("45 minutos").tag(45)
                        Text("60 minutos").tag(60)
                    }
                }
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(T.error)
                }
                Button("Añadir bono") {
                    Task {
                        errorMessage = await store.addPack(
                            to: client.id,
                            sessions: sessions,
                            duration: duration,
                            name: name
                        )
                        if errorMessage == nil { dismiss() }
                    }
                }
            }
            .navigationTitle("Añadir bono")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}
