#if DEBUG
import Foundation

@MainActor
extension AppStore {
    /// Datos sintéticos para revisar la interfaz sin escribir en Firebase.
    func loadDemoData() {
        let roger = demoTrainer(
            id: "demo-trainer-roger",
            name: "Roger",
            email: "roger.demo@example.com"
        )
        let tobias = demoTrainer(
            id: "demo-trainer-tobias",
            name: "Tobias",
            email: "tobias.demo@example.com"
        )
        let domi = demoTrainer(
            id: "demo-trainer-domi",
            name: "Domi",
            email: "domi.demo@example.com"
        )

        let clara = demoClient(
            id: "demo-client-01",
            name: "Clara Martín",
            dni: "DEMO0001",
            phone: "600 000 001",
            trainerIds: [roger.id],
            trainerStaffIds: ["roger"],
            packName: "Pack 10 · 45 min",
            total: 10,
            used: 3,
            reserved: 1,
            duration: 45,
            cycleTracking: true,
            cycleSharing: true
        )
        let marc = demoClient(
            id: "demo-client-02",
            name: "Marc Vidal",
            dni: "DEMO0002",
            phone: "600 000 002",
            trainerIds: [tobias.id],
            trainerStaffIds: ["tobias"],
            packName: "Pack 8 · 60 min",
            total: 8,
            used: 4,
            reserved: 1,
            duration: 60
        )
        let laia = demoClient(
            id: "demo-client-03",
            name: "Laia Costa",
            dni: "DEMO0003",
            phone: "600 000 003",
            trainerIds: [roger.id, domi.id],
            trainerStaffIds: ["roger", "domi"],
            packName: "Pack 12 · 45 min",
            total: 12,
            used: 2,
            reserved: 2,
            duration: 45,
            cycleTracking: true,
            cycleSharing: false
        )
        let pau = demoClient(
            id: "demo-client-04",
            name: "Pau Ferrer",
            dni: "DEMO0004",
            phone: "600 000 004",
            trainerIds: [roger.id],
            trainerStaffIds: ["roger"],
            packName: "Pack 10 · 45 min",
            total: 10,
            used: 10,
            reserved: 0,
            duration: 45
        )
        var julia = demoClient(
            id: "demo-client-05",
            name: "Júlia Serra",
            dni: "DEMO0005",
            phone: "600 000 005",
            trainerIds: [tobias.id],
            trainerStaffIds: ["tobias"],
            packName: "Pack 8 · 45 min",
            total: 8,
            used: 2,
            reserved: 1,
            duration: 45
        )
        julia.isMinor = true
        julia.guardianName = "Responsable demo"

        let arnau = demoClient(
            id: "demo-client-06",
            name: "Arnau Pons",
            dni: "DEMO0006",
            phone: "600 000 006",
            trainerIds: [domi.id],
            trainerStaffIds: ["domi"],
            packName: "Pack 12 · 60 min",
            total: 12,
            used: 1,
            reserved: 1,
            duration: 60
        )
        let marta = demoClient(
            id: "demo-client-07",
            name: "Marta Rius",
            dni: "DEMO0007",
            phone: "600 000 007",
            trainerIds: [roger.id],
            trainerStaffIds: ["roger"],
            packName: "Pack 6 · 45 min",
            total: 6,
            used: 4,
            reserved: 0,
            duration: 45,
            cycleTracking: true,
            cycleSharing: true
        )
        let eric = demoClient(
            id: "demo-client-08",
            name: "Èric Soler",
            dni: "DEMO0008",
            phone: "600 000 008",
            trainerIds: [roger.id, tobias.id],
            trainerStaffIds: ["roger", "tobias"],
            packName: "Pack 10 · 60 min",
            total: 10,
            used: 2,
            reserved: 1,
            duration: 60
        )
        let nina = demoClient(
            id: "demo-client-09",
            name: "Nina Campos",
            dni: "DEMO0009",
            phone: "600 000 009",
            trainerIds: [domi.id],
            trainerStaffIds: ["domi"],
            packName: "Pack 5 · 45 min",
            total: 5,
            used: 4,
            reserved: 0,
            duration: 45
        )
        let oscar = demoClient(
            id: "demo-client-10",
            name: "Óscar León",
            dni: "DEMO0010",
            phone: "600 000 010",
            trainerIds: [tobias.id],
            trainerStaffIds: ["tobias"],
            packName: "Pack 8 · 60 min",
            total: 8,
            used: 3,
            reserved: 1,
            duration: 60
        )
        let salaArriba = demoRoomUser(
            id: "demo-room-01",
            name: "Carla · Sala de arriba",
            dni: "DEMO-SALA-01",
            remaining: 6
        )
        let salaFisio = demoRoomUser(
            id: "demo-room-02",
            name: "Alex · Sala de fisio",
            dni: "DEMO-SALA-02",
            remaining: 3
        )

        var direction = AppUser(
            id: "demo-boss-josep",
            email: "josep.demo@example.com",
            name: "Josep · Modo demo",
            role: .boss,
            trainerIds: [],
            phone: ""
        )
        direction.isTrainer = false
        direction.termsAccepted = true

        currentUser = direction
        trainers = [roger, tobias, domi]
        staff = [
            StaffMember(id: "roger", name: "Roger", kind: .trainer, authUid: roger.id),
            StaffMember(id: "tobias", name: "Tobias", kind: .trainer, authUid: tobias.id),
            StaffMember(id: "domi", name: "Domi", kind: .trainer, authUid: domi.id),
            StaffMember(id: "xavi", name: "Xavi", kind: .physiotherapist),
            StaffMember(id: "lydia", name: "Lydia", kind: .roomRental),
            StaffMember(id: "adria", name: "Adrià", kind: .roomRental),
            StaffMember(id: "eleonora", name: "Eleonora", kind: .physioRoomRental),
        ]
        managedUsers = [
            arnau, clara, eric, julia, laia, marc, marta, nina, oscar, pau,
            salaArriba, salaFisio,
        ]
        rooms = [
            GymRoom(
                id: "downstairs",
                name: "Sala de abajo",
                type: "Entrenamiento",
                reserved: 2,
                capacity: 5,
                nextTrainer: "Tobias",
                nextTime: "10:30"
            ),
            GymRoom(
                id: "upstairs",
                name: "Sala de arriba",
                type: "Entrenamiento",
                reserved: 3,
                capacity: 6,
                nextTrainer: "Roger",
                nextTime: "09:00"
            ),
            GymRoom(
                id: "physio",
                name: "Sala de fisio",
                type: "Fisioterapia",
                reserved: 1,
                capacity: 3,
                nextTrainer: "Xavi",
                nextTime: "11:00"
            ),
        ]

        sessions = [
            demoSession(
                id: "demo-session-01",
                dayOffset: 0,
                time: "09:00",
                client: clara,
                trainer: roger,
                type: "Fuerza tren inferior",
                room: "Sala de arriba",
                status: .confirmed,
                packNumber: 5
            ),
            demoSession(
                id: "demo-session-02",
                dayOffset: 0,
                time: "10:30",
                client: marc,
                trainer: tobias,
                type: "Movilidad y core",
                room: "Sala de abajo",
                status: .confirmed,
                packNumber: 6
            ),
            demoSession(
                id: "demo-session-03",
                dayOffset: 1,
                time: "08:00",
                client: laia,
                trainer: domi,
                type: "Fuerza general",
                room: "Sala de arriba",
                status: .confirmed,
                packNumber: 5
            ),
            demoSession(
                id: "demo-session-04",
                dayOffset: 1,
                time: "18:00",
                client: eric,
                trainer: roger,
                type: "Acondicionamiento",
                room: "Sala de abajo",
                status: .confirmed,
                packNumber: 4
            ),
            demoSession(
                id: "demo-session-05",
                dayOffset: 2,
                time: "09:30",
                client: julia,
                trainer: tobias,
                type: "Técnica y movilidad",
                room: "Sala de arriba",
                status: .confirmed,
                packNumber: 4
            ),
            demoSession(
                id: "demo-session-06",
                dayOffset: -1,
                time: "17:00",
                client: marta,
                trainer: roger,
                type: "Fuerza",
                room: "Sala de arriba",
                status: .completed,
                packNumber: 4,
                feedback: "Buena técnica y progresión estable."
            ),
            demoSession(
                id: "demo-session-07",
                dayOffset: 3,
                time: "12:00",
                client: arnau,
                trainer: domi,
                type: "Hipertrofia",
                room: "Sala de abajo",
                status: .confirmed,
                packNumber: 3
            ),
        ]

        bookings = [
            demoBooking(
                id: "demo-booking-01",
                dayOffset: 2,
                time: "17:30",
                client: nina,
                trainer: domi,
                kind: .training,
                room: "Sala de arriba",
                status: .pendingTrainer
            ),
            demoBooking(
                id: "demo-booking-02",
                dayOffset: 3,
                time: "19:00",
                client: oscar,
                trainer: tobias,
                kind: .training,
                room: "Sala de abajo",
                status: .pendingTrainer
            ),
            demoBooking(
                id: "demo-booking-03",
                dayOffset: 1,
                time: "16:00",
                client: salaArriba,
                trainer: nil,
                kind: .roomRental,
                room: "Sala de arriba",
                status: .pendingBoss
            ),
            demoBooking(
                id: "demo-booking-04",
                dayOffset: 4,
                time: "11:00",
                client: salaFisio,
                trainer: nil,
                kind: .roomRental,
                room: "Sala de fisio",
                status: .pendingBoss
            ),
        ]

        occupiedSlots = sessions
            .filter { $0.status == .confirmed }
            .map {
                OccupiedSlot(
                    id: $0.id,
                    date: $0.date,
                    time: $0.time,
                    duration: $0.duration,
                    room: $0.room,
                    trainerId: $0.trainerId
                )
            }
        clientCycleSummaries = [
            clara.id: CycleEntry(
                flow: .medium,
                symptoms: ["Fatiga", "Molestias lumbares"],
                mood: "🙂",
                notes: ""
            ),
            marta.id: CycleEntry(
                flow: .light,
                symptoms: ["Energía alta"],
                mood: "💪",
                notes: ""
            ),
        ]
        activePack = TrainingPack(
            id: "demo-direction",
            name: "Dirección",
            totalSessions: 0,
            usedSessions: 0,
            reservedSessions: 0,
            remainingSessions: 0,
            duration: 45
        )
        toast = "Modo demo · 12 perfiles ficticios"
    }

    private func demoTrainer(id: String, name: String, email: String) -> AppUser {
        var trainer = AppUser(
            id: id,
            email: email,
            name: name,
            role: .trainer,
            trainerIds: [],
            phone: ""
        )
        trainer.isTrainer = true
        return trainer
    }

    private func demoClient(
        id: String,
        name: String,
        dni: String,
        phone: String,
        trainerIds: [String],
        trainerStaffIds: [String],
        packName: String,
        total: Int,
        used: Int,
        reserved: Int,
        duration: Int,
        cycleTracking: Bool = false,
        cycleSharing: Bool = false
    ) -> AppUser {
        var client = AppUser(
            id: id,
            email: "\(id)@example.com",
            name: name,
            role: .client,
            trainerIds: trainerIds,
            phone: phone
        )
        client.dni = dni
        client.trainerStaffIds = trainerStaffIds
        client.termsAccepted = true
        client.packName = packName
        client.packTotalSessions = total
        client.usedSessions = used
        client.reservedSessions = reserved
        client.remainingSessions = max(0, total - used - reserved)
        client.sessionDuration = duration
        client.cycleTrackingEnabled = cycleTracking
        client.cycleSharingEnabled = cycleSharing
        return client
    }

    private func demoRoomUser(
        id: String,
        name: String,
        dni: String,
        remaining: Int
    ) -> AppUser {
        var user = AppUser(
            id: id,
            email: "\(id)@example.com",
            name: name,
            role: .reserve,
            trainerIds: [],
            phone: "600 100 000"
        )
        user.dni = dni
        user.packName = "Bono de sala"
        user.packTotalSessions = 10
        user.usedSessions = 10 - remaining
        user.remainingSessions = remaining
        user.sessionDuration = 60
        return user
    }

    private func demoSession(
        id: String,
        dayOffset: Int,
        time: String,
        client: AppUser,
        trainer: AppUser,
        type: String,
        room: String,
        status: SessionStatus,
        packNumber: Int,
        feedback: String? = nil
    ) -> GymSession {
        GymSession(
            id: id,
            date: demoDate(dayOffset),
            time: time,
            duration: client.sessionDuration,
            clientId: client.id,
            clientName: client.name,
            trainerId: trainer.id,
            trainerName: trainer.name,
            type: type,
            room: room,
            status: status,
            trainerNotes: nil,
            feedback: feedback,
            packSessionNumber: packNumber,
            packTotalSessions: client.packTotalSessions
        )
    }

    private func demoBooking(
        id: String,
        dayOffset: Int,
        time: String,
        client: AppUser,
        trainer: AppUser?,
        kind: BookingKind,
        room: String,
        status: BookingStatus
    ) -> BookingRequest {
        BookingRequest(
            id: id,
            clientId: client.id,
            clientName: client.name,
            trainerId: trainer?.id ?? "",
            trainerName: trainer?.name ?? "Dirección",
            kind: kind,
            requestedDate: demoDate(dayOffset),
            requestedTime: time,
            type: kind == .roomRental ? "Uso de sala" : "Entrenamiento",
            duration: client.sessionDuration,
            room: room,
            status: status,
            proposedTime: time
        )
    }

    private func demoDate(_ dayOffset: Int) -> Date {
        Calendar.current.date(
            byAdding: .day,
            value: dayOffset,
            to: Calendar.current.startOfDay(for: .now)
        ) ?? .now
    }
}
#endif
