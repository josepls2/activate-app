import Foundation

enum UserRole: String, CaseIterable, Identifiable, Codable {
    case client
    case trainer
    case boss
    case reserve

    var id: String { rawValue }

    var label: String {
        switch self {
        case .client: "Cliente"
        case .trainer: "Entrenador"
        case .boss: "Dirección"
        case .reserve: "Usuario de sala"
        }
    }

    var subtitle: String {
        switch self {
        case .client: "Mis entrenos y bienestar"
        case .trainer: "Clientes y agenda semanal"
        case .boss: "Gestión del centro piloto"
        case .reserve: "Mi bono y reservas de sala"
        }
    }

    var icon: String {
        switch self {
        case .client: "figure.run"
        case .trainer: "figure.strengthtraining.traditional"
        case .boss: "crown.fill"
        case .reserve: "door.left.hand.open"
        }
    }
}

struct AppUser: Identifiable, Hashable {
    let id: String
    let email: String
    let name: String
    let role: UserRole
    let trainerIds: [String]
    let phone: String
    var dni = ""
    var trainerStaffIds: [String] = []
    /// Permite que una cuenta de Dirección también tenga funciones de entrenador.
    var isTrainer = false
    var isMinor = false
    var guardianName: String?
    var termsAccepted = true
    var imageConsent = false
    /// El módulo de ciclo sólo existe en las cuentas donde Dirección lo activa.
    var cycleTrackingEnabled = false
    var cycleSharingEnabled = false
    var packName = "Bono"
    var packTotalSessions = 0
    var usedSessions = 0
    var reservedSessions = 0
    var remainingSessions = 0
    var sessionDuration = 45
}

extension AppUser {
    /// Compatibilidad con perfiles antiguos mientras se migra Firebase.
    var trainerId: String? { trainerIds.first }
}

enum SessionStatus: String, CaseIterable, Codable {
    case confirmed
    case pending
    case completed
    case cancelled

    var label: String {
        switch self {
        case .confirmed: "Confirmada"
        case .pending: "Pendiente"
        case .completed: "Completada"
        case .cancelled: "Cancelada"
        }
    }
}

struct GymSession: Identifiable, Hashable {
    let id: String
    var date: Date
    var time: String
    var duration: Int
    let clientId: String
    var clientName: String
    let trainerId: String
    var trainerName: String
    var type: String
    var room: String
    var status: SessionStatus
    var trainerNotes: String?
    var feedback: String?
    var packSessionNumber: Int?
    var packTotalSessions: Int?
}

enum BookingStatus: String, CaseIterable {
    case pendingTrainer = "pending_trainer"
    case pendingBoss = "pending_boss"
    case confirmed
    case rejected

    var label: String {
        switch self {
        case .pendingTrainer: "Asignando hora"
        case .pendingBoss: "Pendiente del jefe"
        case .confirmed: "Confirmada"
        case .rejected: "Rechazada"
        }
    }

    var icon: String {
        switch self {
        case .pendingTrainer: "clock.badge.questionmark"
        case .pendingBoss: "hourglass"
        case .confirmed: "checkmark.circle.fill"
        case .rejected: "xmark.circle.fill"
        }
    }
}

enum BookingKind: String, Codable, CaseIterable {
    case training
    case roomRental = "room_rental"

    var label: String {
        switch self {
        case .training: "Entrenamiento"
        case .roomRental: "Reserva de sala"
        }
    }
}

struct BookingRequest: Identifiable, Hashable {
    let id: String
    let clientId: String
    let clientName: String
    let trainerId: String
    let trainerName: String
    var kind: BookingKind = .training
    var requestedDate: Date
    var requestedTime: String? = nil
    var type: String
    var duration: Int
    var room: String? = nil
    var status: BookingStatus
    var proposedTime: String?
    var finalTime: String?
    var trainerNotes: String?
    var bossNotes: String?
}

struct GymRoom: Identifiable, Hashable {
    let id: String
    let name: String
    let type: String
    let reserved: Int
    let capacity: Int
    let nextTrainer: String
    let nextTime: String
}

/// Bloque anónimo de ocupación. No contiene nombres ni datos de clientes.
struct OccupiedSlot: Identifiable, Hashable {
    let id: String
    let date: Date
    let time: String
    let duration: Int
    let room: String
    let trainerId: String?
}

enum MessageAuthor: String {
    case user
    case trainer
    case ai
}

struct ChatMessage: Identifiable, Hashable {
    let id: String
    let author: MessageAuthor
    let text: String
    let timestamp: Date
    var isRead: Bool
}

struct Macro: Identifiable {
    let id = UUID()
    let name: String
    let current: Int
    let target: Int
    let unit: String
    let colorName: String
}

struct TrainingPack: Identifiable, Hashable {
    let id: String
    let name: String
    let totalSessions: Int
    var usedSessions: Int
    var reservedSessions: Int
    var remainingSessions: Int
    let duration: Int

    var progress: Double {
        guard totalSessions > 0 else { return 0 }
        return Double(usedSessions) / Double(totalSessions)
    }
}

/// Horarios de reserva alineados con la duración real de cada bono.
enum BookingTimeSlots {
    static func values(
        duration: Int,
        openingHour: Int = 7,
        lastStartHour: Int = 21
    ) -> [String] {
        let interval = duration == 60 ? 60 : 45
        return stride(
            from: openingHour * 60,
            through: lastStartHour * 60,
            by: interval
        ).map { String(format: "%02d:%02d", $0 / 60, $0 % 60) }
    }

    static func normalizedTime(_ preferredTime: String?, duration: Int) -> String {
        let slots = values(duration: duration)
        guard let preferredTime else { return slots.first ?? "07:00" }
        if slots.contains(preferredTime) { return preferredTime }
        guard let preferredMinutes = minutes(from: preferredTime) else {
            return slots.first ?? "07:00"
        }
        return slots.min {
            abs((minutes(from: $0) ?? 0) - preferredMinutes)
                < abs((minutes(from: $1) ?? 0) - preferredMinutes)
        } ?? slots.first ?? "07:00"
    }

    private static func minutes(from time: String) -> Int? {
        let components = time.split(separator: ":").compactMap { Int($0) }
        guard components.count == 2 else { return nil }
        return components[0] * 60 + components[1]
    }
}

enum StaffKind: String {
    case trainer
    case physiotherapist
    case roomRental
    case physioRoomRental

    var label: String {
        switch self {
        case .trainer: "Entrenador"
        case .physiotherapist: "Fisioterapeuta"
        case .roomRental: "Alquiler de sala"
        case .physioRoomRental: "Alquiler sala de fisio"
        }
    }
}

struct StaffMember: Identifiable, Hashable {
    let id: String
    let name: String
    let kind: StaffKind
    var authUid: String?
    var email = ""
}

enum CycleFlow: String, CaseIterable, Identifiable {
    case none
    case light
    case medium
    case heavy

    var id: String { rawValue }

    var label: String {
        switch self {
        case .none: "Sin flujo"
        case .light: "Ligero"
        case .medium: "Medio"
        case .heavy: "Intenso"
        }
    }
}

struct CycleEntry: Hashable {
    var flow: CycleFlow
    var symptoms: Set<String>
    var mood: String
    var notes: String
}

enum AppTab: String, Identifiable {
    case clients
    case sessions
    case bookings
    case cycle
    case chat
    case nutrition
    case plan
    case admin
    case profile

    var id: String { rawValue }

    var label: String {
        switch self {
        case .clients: "Clientes"
        case .sessions: "Entrenos"
        case .bookings: "Reservas"
        case .cycle: "Ciclo"
        case .chat: "Chat"
        case .nutrition: "Nutrición"
        case .plan: "Pack"
        case .admin: "Gestión"
        case .profile: "Perfil"
        }
    }

    var icon: String {
        switch self {
        case .clients: "person.2.fill"
        case .sessions: "calendar"
        case .bookings: "square.grid.2x2"
        case .cycle: "drop.fill"
        case .chat: "bubble.left.and.bubble.right"
        case .nutrition: "leaf.fill"
        case .plan: "rectangle.stack.badge.person.crop"
        case .admin: "person.badge.plus"
        case .profile: "person.crop.circle"
        }
    }
}
