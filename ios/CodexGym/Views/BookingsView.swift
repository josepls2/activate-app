import SwiftUI

struct BookingsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var activeRequest: BookingRequest?
    @State private var roomRange = "Hoy"
    @State private var selectedDate = Date.now
    @State private var showingRoomRequest = false

    private var role: UserRole { store.currentUser?.role ?? .reserve }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                ScreenHeader(
                    eyebrow: role.label,
                    title: role == .reserve ? "Ocupación de salas" : "Reservas",
                    subtitle: role == .reserve
                        ? "Consulta disponibilidad y usa tu bono"
                        : "Calendario y solicitudes",
                    badge: actionableRequests.count
                )

                AvailabilityCalendar(selectedDate: $selectedDate)
                    .environmentObject(store)

                if role == .reserve {
                    Button {
                        showingRoomRequest = true
                    } label: {
                        Label("Solicitar una sala", systemImage: "calendar.badge.plus")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(T.red)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    requestsSection(
                        title: "Mis solicitudes",
                        requests: store.visibleBookings,
                        actionTitle: nil
                    )
                } else if role == .trainer {
                    requestsSection(
                        title: "Confirmar entrenamientos",
                        requests: actionableRequests,
                        actionTitle: "Confirmar"
                    )
                } else if role == .boss {
                    requestsSection(
                        title: "Confirmar reservas de sala",
                        requests: roomRequests,
                        actionTitle: "Confirmar o cambiar"
                    )
                    requestsSection(
                        title: "Confirmar entrenamientos",
                        requests: trainingRequests,
                        actionTitle: "Confirmar"
                    )
                    let history = store.visibleBookings.filter {
                        $0.status == .confirmed || $0.status == .rejected
                    }
                    requestsSection(
                        title: "Historial",
                        requests: history,
                        actionTitle: nil
                    )
                }
            }
            .padding(20)
            .padding(.bottom, 16)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .sheet(item: $activeRequest) { request in
            TimeAssignmentSheet(request: request, isBoss: role == .boss)
                .environmentObject(store)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showingRoomRequest) {
            RoomBookingSheet(initialDate: selectedDate)
                .environmentObject(store)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    private var actionableRequests: [BookingRequest] {
        switch role {
        case .trainer:
            store.visibleBookings.filter { $0.status == .pendingTrainer }
        case .boss:
            roomRequests + trainingRequests
        default:
            []
        }
    }

    private var roomRequests: [BookingRequest] {
        store.visibleBookings.filter {
            $0.kind == .roomRental && $0.status == .pendingBoss
        }
    }

    private var trainingRequests: [BookingRequest] {
        store.visibleBookings.filter {
            $0.kind == .training && $0.status == .pendingTrainer
        }
    }

    @ViewBuilder
    private func requestsSection(
        title: String,
        requests: [BookingRequest],
        actionTitle: String?
    ) -> some View {
        SectionTitle(title: title, count: requests.count)
        if requests.isEmpty {
            EmptyState(
                icon: "checkmark.circle",
                title: "Todo al día",
                message: "No hay solicitudes en esta sección."
            )
        } else {
            ForEach(requests) { request in
                BookingRequestCard(
                    request: request,
                    actionTitle: actionTitle
                ) {
                    activeRequest = request
                }
            }
        }
    }

    private var roomsSection: some View {
        Group {
            SectionTitle(title: "Estado de salas · \(roomRange.lowercased())")
            ForEach(store.rooms) { room in
                RoomOccupancyCard(room: room)
            }
        }
    }
}

private struct AvailabilityCalendar: View {
    @EnvironmentObject private var store: AppStore
    @Binding var selectedDate: Date
    @State private var selectedRoom = "Sala de arriba"
    @State private var selectedDuration = 45

    private var duration: Int {
        switch store.currentUser?.role {
        case .client, .reserve:
            store.activePack.duration
        default:
            selectedDuration
        }
    }

    private var slots: [String] {
        BookingTimeSlots.values(duration: duration)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            DatePicker(
                "Fecha",
                selection: $selectedDate,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            .tint(T.red)

            Picker("Sala", selection: $selectedRoom) {
                ForEach(store.rooms) { room in
                    Text(room.name).tag(room.name)
                }
            }
            .pickerStyle(.segmented)

            if store.currentUser?.role == .boss || store.currentUser?.role == .trainer {
                Picker("Duración", selection: $selectedDuration) {
                    Text("45 min").tag(45)
                    Text("1 hora").tag(60)
                }
                .pickerStyle(.segmented)
            }

            Text("Horas disponibles · intervalos de \(duration) min")
                .font(.caption.bold())
                .foregroundStyle(T.muted)

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 66))],
                spacing: 8
            ) {
                ForEach(slots, id: \.self) { slot in
                    let occupied = store.isSlotOccupied(
                        date: selectedDate,
                        time: slot,
                        duration: duration,
                        room: selectedRoom,
                        trainerId: nil
                    )
                    Text(slot)
                        .font(.caption.bold())
                        .strikethrough(occupied, color: T.error)
                        .foregroundStyle(occupied ? T.error : T.text2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(occupied ? T.error.opacity(0.14) : T.card2)
                        .clipShape(RoundedRectangle(cornerRadius: 9))
                        .accessibilityLabel(
                            occupied ? "\(slot), ocupada" : "\(slot), disponible"
                        )
                }
            }
        }
        .gymCard()
    }
}

private struct RoomBookingSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var date: Date
    @State private var room = "Sala de arriba"
    @State private var selectedTime = "10:00"

    private var slots: [String] {
        BookingTimeSlots.values(duration: duration)
    }

    init(initialDate: Date) {
        _date = State(initialValue: initialDate)
    }

    private var duration: Int { store.activePack.duration }
    private var selectionOccupied: Bool {
        store.isSlotOccupied(
            date: date,
            time: selectedTime,
            duration: duration,
            room: room,
            trainerId: nil
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Reservar una sala")
                        .font(.title2.bold())
                    Text(
                        "Dirección debe confirmar la reserva. Al confirmarla se utilizará una sesión de tu bono."
                    )
                    .font(.subheadline)
                    .foregroundStyle(T.muted)

                    DatePicker(
                        "Fecha",
                        selection: $date,
                        in: Date.now...,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                    .tint(T.red)
                    .gymCard()

                    Picker("Sala", selection: $room) {
                        ForEach(store.rooms) {
                            Text($0.name).tag($0.name)
                        }
                    }
                    .pickerStyle(.segmented)

                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 70))],
                        spacing: 9
                    ) {
                        ForEach(slots, id: \.self) { slot in
                            let occupied = store.isSlotOccupied(
                                date: date,
                                time: slot,
                                duration: duration,
                                room: room,
                                trainerId: nil
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

                    Button {
                        store.requestSession(
                            date: date,
                            time: selectedTime,
                            type: "Uso de sala",
                            room: room
                        )
                        dismiss()
                    } label: {
                        Text("Enviar solicitud")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(T.red)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(selectionOccupied || store.remainingSessions <= 0)
                }
                .padding(20)
            }
            .background(T.background)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            selectedTime = BookingTimeSlots.normalizedTime(
                selectedTime,
                duration: duration
            )
        }
    }
}

private struct TimeAssignmentSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let request: BookingRequest
    let isBoss: Bool
    @State private var selectedTime: String
    @State private var notes: String
    @State private var room = "Sala de arriba"

    init(request: BookingRequest, isBoss: Bool) {
        self.request = request
        self.isBoss = isBoss
        _selectedTime = State(
            initialValue: BookingTimeSlots.normalizedTime(
                request.proposedTime ?? request.requestedTime,
                duration: request.duration
            )
        )
        _notes = State(initialValue: request.trainerNotes ?? "")
    }

    private var slots: [String] {
        BookingTimeSlots.values(duration: request.duration)
    }

    private var isRoomApproval: Bool {
        request.kind == .roomRental
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(
                            isRoomApproval
                                ? "Confirmar reserva de sala"
                                : "Confirmar entrenamiento"
                        )
                            .font(.title2.bold())
                        Text(
                            "\(request.clientName) · \(request.requestedDate.formattedGymDate()) · \(request.duration) min"
                        )
                            .font(.subheadline)
                            .foregroundStyle(T.muted)
                    }

                    if let proposed = request.proposedTime, isRoomApproval {
                        Label(
                            "Hora propuesta por el entrenador: \(proposed)",
                            systemImage: "lightbulb.fill"
                        )
                        .font(.subheadline.bold())
                        .foregroundStyle(T.orange)
                        .gymCard()
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Elige una hora")
                            .font(.headline)
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 70))],
                            spacing: 9
                        ) {
                            ForEach(slots, id: \.self) { slot in
                                let occupied = store.isSlotOccupied(
                                    date: request.requestedDate,
                                    time: slot,
                                    duration: request.duration,
                                    room: room,
                                    trainerId:
                                        isRoomApproval ? nil : request.trainerId
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
                                        .frame(minHeight: 40)
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

                    VStack(alignment: .leading, spacing: 9) {
                        Text("Sala")
                            .font(.headline)
                        Picker("Sala", selection: $room) {
                            ForEach(store.rooms) { Text($0.name).tag($0.name) }
                        }
                        .pickerStyle(.menu)
                        .tint(T.redLight)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(T.card2)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    VStack(alignment: .leading, spacing: 9) {
                        Text("Notas")
                            .font(.headline)
                        TextEditor(text: $notes)
                            .frame(height: 90)
                            .padding(10)
                            .scrollContentBackground(.hidden)
                            .background(T.card2)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Button {
                        if isRoomApproval {
                            store.confirmBooking(
                                request.id,
                                time: selectedTime,
                                room: room
                            )
                        } else {
                            store.proposeTime(
                                for: request.id,
                                time: selectedTime,
                                notes: notes,
                                room: room
                            )
                        }
                        dismiss()
                    } label: {
                        Text(
                            isRoomApproval
                                ? "Confirmar reserva"
                                : "Confirmar entrenamiento"
                        )
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .frame(minHeight: 50)
                            .background(T.red)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(
                        store.isSlotOccupied(
                            date: request.requestedDate,
                            time: selectedTime,
                            duration: request.duration,
                            room: room,
                            trainerId:
                                isRoomApproval ? nil : request.trainerId
                        )
                    )

                    if isBoss || request.kind == .training {
                        Button(role: .destructive) {
                            store.rejectBooking(request.id)
                            dismiss()
                        } label: {
                            Text("Rechazar solicitud")
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
