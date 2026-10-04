package com.activatepersonaltraining.app

enum class Role(val label: String, val subtitle: String) {
    CLIENT("Cliente", "Mis entrenos y bienestar"),
    TRAINER("Entrenador", "Clientes y agenda"),
    BOSS("Dirección", "Gestión del centro piloto"),
    RESERVE("Usuario de sala", "Mi bono y reservas de sala"),
}

enum class AppTab(val label: String, val symbol: String) {
    CLIENTS("Clientes", "◎"),
    SESSIONS("Entrenos", "▣"),
    BOOKINGS("Reservas", "▦"),
    CYCLE("Ciclo", "●"),
    CHAT("Chat", "◌"),
    NUTRITION("Nutrición", "⌁"),
    PACK("Pack", "▤"),
    PROFILE("Perfil", "◉"),
}

enum class SessionStatus(val label: String) {
    CONFIRMED("Confirmada"),
    COMPLETED("Completada"),
    CANCELLED("Cancelada"),
}

enum class BookingStatus(val label: String) {
    PENDING_TRAINER("Asignando hora"),
    PENDING_BOSS("Pendiente de dirección"),
    CONFIRMED("Confirmada"),
    REJECTED("Rechazada"),
}

data class TrainingSession(
    val id: String,
    val date: String,
    val time: String,
    val duration: Int,
    val clientId: String,
    val clientName: String,
    val trainerId: String,
    val trainerName: String,
    val kind: String,
    val room: String,
    val type: String,
    val status: SessionStatus,
    val packSessionNumber: Int?,
    val packTotalSessions: Int?,
    val feedback: String? = null,
)

data class BookingRequest(
    val id: String,
    val clientId: String,
    val clientName: String,
    val trainerId: String,
    val trainerName: String,
    val kind: String,
    val requestedDate: String,
    val requestedTime: String,
    val type: String,
    val duration: Int,
    val status: BookingStatus,
    val proposedTime: String? = null,
    val room: String = "Sala de arriba",
)

data class Room(
    val id: String,
    val name: String,
    val use: String,
    val occupied: Int,
    val capacity: Int,
    val nextUse: String,
)

data class StaffMember(val name: String, val role: String)

data class ManagedClient(
    val id: String,
    val name: String,
    val email: String,
    val gender: String,
    val trainerNames: List<String>,
    val packTotalSessions: Int,
    val usedSessions: Int,
    val reservedSessions: Int,
    val remainingSessions: Int,
    val cycleTrackingEnabled: Boolean,
    val cycleSharingEnabled: Boolean,
)

data class SharedCycleSummary(
    val id: String,
    val clientId: String,
    val date: String,
    val flow: String,
    val symptoms: List<String>,
    val mood: String,
)

data class OccupiedSlot(
    val id: String,
    val date: String,
    val time: String,
    val room: String,
)

object BookingPolicy {
    fun validDuration(duration: Int): Boolean = duration == 45 || duration == 60

    fun canTransition(from: BookingStatus, to: BookingStatus): Boolean = when (from) {
        BookingStatus.PENDING_TRAINER ->
            to == BookingStatus.CONFIRMED || to == BookingStatus.REJECTED
        BookingStatus.PENDING_BOSS ->
            to == BookingStatus.CONFIRMED || to == BookingStatus.REJECTED
        BookingStatus.CONFIRMED, BookingStatus.REJECTED -> false
    }

    fun overlaps(
        firstTime: String,
        firstDuration: Int,
        secondTime: String,
        secondDuration: Int,
    ): Boolean {
        val firstStart = minutes(firstTime)
        val secondStart = minutes(secondTime)
        return firstStart < secondStart + secondDuration &&
            secondStart < firstStart + firstDuration
    }

    private fun minutes(time: String): Int {
        val parts = time.split(":").map(String::toInt)
        require(parts.size == 2 && parts[0] in 0..23 && parts[1] in 0..59)
        return parts[0] * 60 + parts[1]
    }
}
