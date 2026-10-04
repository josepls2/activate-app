import EventKit
import SwiftUI

struct SessionsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedSession: GymSession?
    @State private var showingBooking = false
    @State private var bossRange = "Semana"

    private var role: UserRole { store.currentUser?.role ?? .client }

    private var displayedSessions: [GymSession] {
        guard role == .trainer else { return store.visibleSessions }
        let calendar = Calendar.current
        let earliest = calendar.date(byAdding: .day, value: -14, to: .now) ?? .now
        let latest = calendar.date(byAdding: .day, value: 7, to: .now) ?? .now
        return store.visibleSessions.filter { $0.date >= earliest && $0.date <= latest }
    }

    private var title: String {
        switch role {
        case .boss: "Sesiones"
        case .trainer: "Entrenos"
        case .client: "Mis entrenos"
        case .reserve: "Mis reservas"
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                ScreenHeader(
                    eyebrow: role.label,
                    title: title,
                    subtitle: role == .trainer ? "Esta semana" : "Tu agenda de actividad",
                    badge: role == .boss
                        ? store.bookings.filter { $0.status == .pendingBoss }.count
                        : nil
                )

                if role == .client || role == .reserve {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(role == .reserve ? "Bono de sala" : "Sesiones disponibles")
                                .font(.caption.bold())
                                .foregroundStyle(T.muted)
                            Text("\(store.remainingSessions)")
                                .font(.system(size: 36, weight: .bold))
                                .foregroundStyle(T.text)
                        }
                        Spacer()
                        Text("\(store.activePack.duration) min")
                            .font(.subheadline.bold())
                            .foregroundStyle(T.redLight)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(T.red.opacity(0.15))
                            .clipShape(Capsule())
                    }
                    .gymCard()
                }

                if role == .boss {
                    Picker("Rango", selection: $bossRange) {
                        ForEach(["Semana", "Mes", "Personalizado"], id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if role == .client {
                    Button {
                        showingBooking = true
                    } label: {
                        Label("Pedir una sesión", systemImage: "plus")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .frame(minHeight: 50)
                            .background(T.red)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }

                    let myRequests = store.visibleBookings.filter {
                        $0.status == .pendingTrainer || $0.status == .pendingBoss
                    }
                    if !myRequests.isEmpty {
                        SectionTitle(title: "Mis solicitudes", count: myRequests.count)
                        ForEach(myRequests) { request in
                            BookingRequestCard(
                                request: request,
                                actionTitle: nil,
                                action: {}
                            )
                        }
                    }
                }

                SectionTitle(
                    title: role == .client ? "Próximas y recientes" : "Agenda",
                    count: displayedSessions.count
                )

                if displayedSessions.isEmpty {
                    EmptyState(
                        icon: "calendar.badge.checkmark",
                        title: "Agenda despejada",
                        message: "No hay sesiones que mostrar en este periodo."
                    )
                } else {
                    ForEach(groupedDays, id: \.date) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(group.date.formattedGymDate().capitalized)
                                .font(.caption.bold())
                                .foregroundStyle(T.muted)
                            ForEach(group.sessions) { session in
                                SessionCard(session: session) {
                                    selectedSession = session
                                }
                            }
                        }
                    }
                }
            }
            .padding(20)
            .padding(.bottom, 16)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .sheet(isPresented: $showingBooking) {
            BookingSheet()
                .environmentObject(store)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $selectedSession) { session in
            SessionDetailView(session: session)
                .environmentObject(store)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    private var groupedDays: [(date: Date, sessions: [GymSession])] {
        let dictionary = Dictionary(grouping: displayedSessions) {
            Calendar.current.startOfDay(for: $0.date)
        }
        return dictionary
            .map { (date: $0.key, sessions: $0.value) }
            .sorted { $0.date < $1.date }
    }
}

private struct BookingSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var date =
        Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now
    @State private var type = "Entrenamiento personal"
    @State private var selectedTime = "10:00"
    @State private var selectedRoom = "Sala de arriba"
    @State private var selectedTrainerId = ""

    private let types = [
        "Entrenamiento personal",
        "HIIT",
        "Movilidad",
        "Fuerza",
    ]
    private var slots: [String] {
        BookingTimeSlots.values(duration: store.activePack.duration)
    }

    private var trainerId: String {
        selectedTrainerId.isEmpty
            ? (store.currentUser?.trainerIds.first ?? "")
            : selectedTrainerId
    }

    private var selectedTrainer: AppUser? {
        store.trainers.first { $0.id == trainerId }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("¿Qué día quieres?")
                            .font(.title2.bold())
                            .foregroundStyle(T.text)
                        Text("Elige una hora disponible. Tu entrenador confirmará la sesión.")
                            .font(.subheadline)
                            .foregroundStyle(T.muted)
                    }

                    DatePicker(
                        "Día de la sesión",
                        selection: $date,
                        in: Date.now...,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                    .tint(T.red)
                    .padding(8)
                    .background(T.card)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Entrenador")
                            .font(.headline)
                        Picker("Entrenador", selection: $selectedTrainerId) {
                            ForEach(store.trainers) { trainer in
                                Text(trainer.name).tag(trainer.id)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(T.redLight)
                    }
                    .gymCard()

                    Picker("Sala", selection: $selectedRoom) {
                        ForEach(store.rooms) { room in
                            Text(room.name).tag(room.name)
                        }
                    }
                    .pickerStyle(.segmented)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Hora")
                            .font(.headline)
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 70))],
                            spacing: 9
                        ) {
                            ForEach(slots, id: \.self) { slot in
                                let occupied = store.isSlotOccupied(
                                    date: date,
                                    time: slot,
                                    duration: store.activePack.duration,
                                    room: selectedRoom,
                                    trainerId: trainerId
                                )
                                Button {
                                    selectedTime = slot
                                } label: {
                                    Text(slot)
                                        .font(.caption.bold())
                                        .strikethrough(occupied, color: T.error)
                                        .foregroundStyle(
                                            occupied
                                                ? T.error
                                                : (selectedTime == slot ? .white : T.text)
                                        )
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background(
                                            occupied
                                                ? T.error.opacity(0.14)
                                                : (selectedTime == slot ? T.red : T.card2)
                                        )
                                        .clipShape(RoundedRectangle(cornerRadius: 9))
                                }
                                .disabled(occupied)
                            }
                        }
                    }
                    .gymCard()

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Tipo de sesión")
                            .font(.headline)
                        Picker("Tipo de sesión", selection: $type) {
                            ForEach(types, id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.menu)
                        .tint(T.redLight)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(T.card2)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    HStack {
                        Image(systemName: "person.crop.circle.fill")
                            .foregroundStyle(T.redLight)
                        VStack(alignment: .leading) {
                            Text("Entrenador asignado")
                                .font(.caption)
                                .foregroundStyle(T.muted)
                            Text(selectedTrainer?.name ?? "Entrenador asignado")
                                .font(.subheadline.bold())
                        }
                        Spacer()
                        Text("\(store.activePack.duration) min")
                            .font(.caption.bold())
                            .foregroundStyle(T.redLight)
                    }
                    .gymCard()

                    Button {
                        store.requestSession(
                            date: date,
                            time: selectedTime,
                            type: type,
                            trainerId: trainerId,
                            room: selectedRoom
                        )
                        dismiss()
                    } label: {
                        Text("Enviar solicitud")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .frame(minHeight: 50)
                            .background(T.red)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(
                        trainerId.isEmpty ||
                        store.isSlotOccupied(
                            date: date,
                            time: selectedTime,
                            duration: store.activePack.duration,
                            room: selectedRoom,
                            trainerId: trainerId
                        )
                    )
                }
                .padding(20)
            }
            .background(T.background)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cerrar") { dismiss() }
                        .foregroundStyle(T.muted)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            selectedTrainerId =
                store.currentUser?.trainerIds.first ??
                store.trainers.first?.id ??
                ""
            selectedTime = BookingTimeSlots.normalizedTime(
                selectedTime,
                duration: store.activePack.duration
            )
        }
    }
}

private struct SessionDetailView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let session: GymSession
    @State private var feedback: String
    @State private var editDate: Date
    @State private var editTime: String
    @State private var editRoom: String

    init(session: GymSession) {
        self.session = session
        _feedback = State(initialValue: session.feedback ?? "")
        _editDate = State(initialValue: session.date)
        _editTime = State(
            initialValue: BookingTimeSlots.normalizedTime(
                session.time,
                duration: session.duration
            )
        )
        _editRoom = State(initialValue: session.room)
    }

    private var canComplete: Bool {
        store.currentUser?.role == .trainer || store.currentUser?.role == .boss
    }

    private var isBoss: Bool {
        store.currentUser?.role == .boss
    }

    private var timeSlots: [String] {
        BookingTimeSlots.values(duration: session.duration)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(session.clientName)
                                .font(.title2.bold())
                            Text(session.type)
                                .foregroundStyle(T.muted)
                        }
                        Spacer()
                        StatusBadge(status: session.status)
                    }

                    VStack(spacing: 14) {
                        DetailRow(
                            icon: "calendar",
                            label: "Fecha",
                            value: session.date.formattedGymDate().capitalized
                        )
                        DetailRow(
                            icon: "clock",
                            label: "Hora",
                            value: "\(session.time) · \(session.duration) min"
                        )
                        DetailRow(
                            icon: "person.fill",
                            label: "Entrenador",
                            value: session.trainerName
                        )
                        DetailRow(
                            icon: "door.left.hand.closed",
                            label: "Sala",
                            value: session.room
                        )
                    }
                    .gymCard()

                    if let notes = session.trainerNotes {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Observaciones")
                                .font(.headline)
                            Text(notes)
                                .font(.subheadline)
                                .foregroundStyle(T.text2)
                        }
                        .gymCard()
                    }

                    if session.status == .confirmed {
                        Button {
                            Task {
                                let message = await DeviceCalendarService.add(session)
                                store.toast = message
                            }
                        } label: {
                            Label(
                                "Añadir al calendario de Apple",
                                systemImage: "calendar.badge.plus"
                            )
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(T.card2)
                            .foregroundStyle(T.text)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }

                    if isBoss && session.status == .confirmed {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Reasignar sesión")
                                .font(.headline)
                            DatePicker(
                                "Fecha",
                                selection: $editDate,
                                displayedComponents: .date
                            )
                            Picker("Hora", selection: $editTime) {
                                ForEach(timeSlots, id: \.self) {
                                    Text($0).tag($0)
                                }
                            }
                            Picker("Sala", selection: $editRoom) {
                                ForEach(store.rooms) {
                                    Text($0.name).tag($0.name)
                                }
                            }
                            Button {
                                if store.rescheduleSession(
                                    session.id,
                                    date: editDate,
                                    time: editTime,
                                    room: editRoom
                                ) {
                                    dismiss()
                                }
                            } label: {
                                Text("Guardar cambios")
                                    .font(.subheadline.bold())
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 13)
                                    .frame(minHeight: 46)
                                    .background(T.card2)
                                    .foregroundStyle(T.text)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                        .gymCard()
                    }

                    if canComplete && session.status == .confirmed {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Feedback para el cliente")
                                .font(.headline)
                            TextEditor(text: $feedback)
                                .frame(minHeight: 100)
                                .padding(10)
                                .scrollContentBackground(.hidden)
                                .background(T.card2)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            Button {
                                store.completeSession(session.id, feedback: feedback)
                                dismiss()
                            } label: {
                                Label("Marcar como completada", systemImage: "checkmark")
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 13)
                                    .frame(minHeight: 48)
                                    .background(T.red)
                                    .foregroundStyle(.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 13))
                            }
                        }
                    } else if let feedback = session.feedback {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Feedback del entrenador", systemImage: "quote.bubble.fill")
                                .font(.headline)
                                .foregroundStyle(T.blue)
                            Text(feedback)
                                .foregroundStyle(T.text2)
                        }
                        .gymCard()
                    }

                    if isBoss && session.status == .confirmed {
                        Button(role: .destructive) {
                            store.cancelSession(session.id)
                            dismiss()
                        } label: {
                            Text("Cancelar sesión")
                                .font(.subheadline.bold())
                                .foregroundStyle(T.error)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                                .frame(minHeight: 46)
                                .background(T.error.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(20)
            }
            .background(T.background)
            .navigationTitle("Detalle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cerrar") { dismiss() }
                        .foregroundStyle(T.muted)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct DetailRow: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(T.redLight)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(T.muted)
                Text(value)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(T.text)
            }
            Spacer()
        }
    }
}
