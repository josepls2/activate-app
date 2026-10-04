package com.activatepersonaltraining.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import java.time.LocalDate
import java.util.Locale

class AppStore(
    private val sessionService: FirebaseSessionService = FirebaseSessionService(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    var role by mutableStateOf<Role?>(null)
        private set
    var userId by mutableStateOf("")
        private set
    var isCheckingAuthentication by mutableStateOf(true)
        private set
    var userName by mutableStateOf("")
        private set
    var userEmail by mutableStateOf("")
        private set
    var isTrainer by mutableStateOf(false)
        private set
    var cycleTrackingEnabled by mutableStateOf(false)
        private set
    var termsAccepted by mutableStateOf(false)
        private set
    var isMinor by mutableStateOf(false)
        private set
    var guardianName by mutableStateOf<String?>(null)
        private set
    var trainerIds by mutableStateOf<List<String>>(emptyList())
        private set
    var trainerNames by mutableStateOf<List<String>>(emptyList())
        private set
    var selectedTab by mutableStateOf(AppTab.SESSIONS)
    var packName by mutableStateOf("Bono")
        private set
    var usedSessions by mutableIntStateOf(0)
        private set
    var reservedSessions by mutableIntStateOf(0)
        private set
    var remainingSessions by mutableIntStateOf(0)
        private set
    var packTotalSessions by mutableIntStateOf(0)
        private set
    var packDuration by mutableIntStateOf(45)
        private set
    var notice by mutableStateOf<String?>(null)
        private set

    val staff = mutableStateListOf<StaffMember>()
    val clients = mutableStateListOf<ManagedClient>()
    val sharedCycleSummaries = mutableStateListOf<SharedCycleSummary>()
    val sessions = mutableStateListOf<TrainingSession>()
    val bookings = mutableStateListOf<BookingRequest>()
    val rooms = mutableStateListOf<Room>()
    val messages = mutableStateListOf<String>()
    val occupiedSlots = mutableStateListOf<OccupiedSlot>()

    private val listeners = mutableListOf<ListenerRegistration>()
    private val cycleListeners = mutableListOf<ListenerRegistration>()

    fun restoreAuthentication() {
        sessionService.restore { result ->
            isCheckingAuthentication = false
            result.getOrNull()?.let(::openSession)
        }
    }

    fun signIn(
        email: String,
        password: String,
        onResult: (String?) -> Unit,
    ) {
        sessionService.signIn(email, password) { result ->
            result.onSuccess {
                openSession(it)
                onResult(null)
            }.onFailure {
                onResult(authenticationMessage(it))
            }
        }
    }

    fun logout() {
        stopSync()
        sessionService.signOut()
        role = null
        userId = ""
        userName = ""
        userEmail = ""
        isTrainer = false
        cycleTrackingEnabled = false
        selectedTab = AppTab.SESSIONS
    }

    private fun openSession(session: UserSession) {
        userId = session.uid
        role = session.role
        userName = session.name
        userEmail = session.email
        isTrainer = session.isTrainer
        cycleTrackingEnabled = session.cycleTrackingEnabled
        trainerIds = session.trainerIds
        termsAccepted = session.termsAccepted
        isMinor = session.isMinor
        guardianName = session.guardianName
        packName = session.packName
        packTotalSessions = session.packTotalSessions
        usedSessions = session.usedSessions
        reservedSessions = session.reservedSessions
        remainingSessions = session.remainingSessions
        packDuration = session.packDuration
        selectedTab = tabsFor(session.role).first()
        startSync(session)
    }

    private fun startSync(session: UserSession) {
        stopSync()
        val profile = firestore.collection("users").document(session.uid)
        listeners += profile.addSnapshotListener { snapshot, _ ->
            if (snapshot == null || !snapshot.exists()) return@addSnapshotListener
            userName = snapshot.getString("name") ?: userName
            userEmail = snapshot.getString("email") ?: userEmail
            cycleTrackingEnabled = snapshot.getBoolean("cycleTrackingEnabled") ?: false
            termsAccepted = snapshot.getBoolean("termsAccepted") ?: false
            isMinor = snapshot.getBoolean("isMinor") ?: false
            guardianName = snapshot.getString("guardianName")
            trainerIds = snapshot.stringList("trainerIds")
            trainerNames = snapshot.stringList("trainerNames")
            packName = snapshot.getString("packName") ?: "Bono"
            packTotalSessions = snapshot.int("packTotalSessions")
            usedSessions = snapshot.int("usedSessions")
            reservedSessions = snapshot.int("reservedSessions")
            remainingSessions = snapshot.int("remainingSessions")
            packDuration = snapshot.int("sessionDuration").takeIf { it in listOf(45, 60) }
                ?: 45
        }

        val sessionsQuery: Query
        val bookingsQuery: Query
        when (session.role) {
            Role.BOSS -> {
                sessionsQuery = firestore.collection("sessions")
                bookingsQuery = firestore.collection("bookingRequests")
            }
            Role.TRAINER -> {
                sessionsQuery = firestore.collection("sessions")
                    .whereEqualTo("trainerId", session.uid)
                bookingsQuery = firestore.collection("bookingRequests")
                    .whereEqualTo("trainerId", session.uid)
            }
            Role.CLIENT, Role.RESERVE -> {
                sessionsQuery = firestore.collection("sessions")
                    .whereEqualTo("clientId", session.uid)
                bookingsQuery = firestore.collection("bookingRequests")
                    .whereEqualTo("clientId", session.uid)
            }
        }
        listeners += sessionsQuery.addSnapshotListener { snapshot, _ ->
            sessions.replaceWith(snapshot?.documents?.mapNotNull(::sessionFrom).orEmpty())
        }
        listeners += bookingsQuery.addSnapshotListener { snapshot, _ ->
            bookings.replaceWith(snapshot?.documents?.mapNotNull(::bookingFrom).orEmpty())
        }
        listeners += firestore.collection("rooms")
            .whereEqualTo("status", "active")
            .addSnapshotListener { snapshot, _ ->
                rooms.replaceWith(snapshot?.documents?.mapNotNull(::roomFrom).orEmpty())
            }
        listeners += firestore.collection("occupancy")
            .addSnapshotListener { snapshot, _ ->
                occupiedSlots.replaceWith(
                    snapshot?.documents?.mapNotNull { document ->
                        if (!document.id.startsWith("room_")) return@mapNotNull null
                        OccupiedSlot(
                            id = document.id,
                            date = document.getString("date") ?: return@mapNotNull null,
                            time = document.getString("time") ?: return@mapNotNull null,
                            room = document.getString("room") ?: return@mapNotNull null,
                        )
                    }.orEmpty(),
                )
            }
        listeners += firestore.collection("staffDirectory")
            .whereEqualTo("status", "active")
            .addSnapshotListener { snapshot, _ ->
                staff.replaceWith(snapshot?.documents?.mapNotNull { document ->
                    val name = document.getString("name") ?: return@mapNotNull null
                    val label = when (document.getString("kind")) {
                        "trainer" -> "Entrenador"
                        "physiotherapist" -> "Fisioterapeuta"
                        "room_rental" -> "Usuario de sala"
                        "physio_room_rental" -> "Usuario de sala de fisio"
                        else -> return@mapNotNull null
                    }
                    StaffMember(name, label)
                }.orEmpty())
            }
        if (session.role == Role.BOSS || session.role == Role.TRAINER) {
            val clientsQuery = if (session.role == Role.BOSS) {
                firestore.collection("users").whereEqualTo("role", "client")
            } else {
                firestore.collection("users")
                    .whereEqualTo("role", "client")
                    .whereArrayContains("trainerIds", session.uid)
            }
            listeners += clientsQuery.addSnapshotListener { snapshot, error ->
                if (error != null) {
                    notice = error.localizedMessage
                    return@addSnapshotListener
                }
                val values = snapshot?.documents?.mapNotNull(::clientFrom).orEmpty()
                    .sortedBy { it.name.lowercase(Locale.getDefault()) }
                clients.replaceWith(values)
                syncSharedCycleSummaries(values)
            }
        }
        if (session.role == Role.CLIENT) {
            listeners += firestore.collection("chats").document(session.uid)
                .collection("messages")
                .orderBy("timestamp")
                .addSnapshotListener { snapshot, _ ->
                    messages.replaceWith(snapshot?.documents?.mapNotNull { message ->
                        val text = message.getString("text") ?: return@mapNotNull null
                        val prefix = if (message.getString("authorId") == session.uid) {
                            "Tú"
                        } else {
                            "Equipo Activate"
                        }
                        "$prefix: $text"
                    }.orEmpty())
                }
        }
    }

    private fun stopSync() {
        listeners.forEach(ListenerRegistration::remove)
        listeners.clear()
        cycleListeners.forEach(ListenerRegistration::remove)
        cycleListeners.clear()
        clients.clear()
        sharedCycleSummaries.clear()
        sessions.clear()
        bookings.clear()
        rooms.clear()
        staff.clear()
        messages.clear()
        occupiedSlots.clear()
    }

    private fun authenticationMessage(error: Throwable): String {
        val message = error.localizedMessage.orEmpty()
        return when {
            "password" in message.lowercase() ||
                "credential" in message.lowercase() ||
                "user" in message.lowercase() ->
                "El email o la contraseña no son correctos."
            "network" in message.lowercase() ->
                "No hay conexión. Revisa Internet e inténtalo de nuevo."
            message.isNotBlank() -> message
            else -> "No se ha podido iniciar sesión."
        }
    }

    fun tabsFor(selectedRole: Role): List<AppTab> = when (selectedRole) {
        Role.CLIENT -> buildList {
            add(AppTab.SESSIONS)
            if (cycleTrackingEnabled) add(AppTab.CYCLE)
            add(AppTab.CHAT)
            add(AppTab.NUTRITION)
            add(AppTab.PACK)
            add(AppTab.PROFILE)
        }
        Role.TRAINER -> listOf(
            AppTab.CLIENTS,
            AppTab.SESSIONS,
            AppTab.BOOKINGS,
            AppTab.PROFILE,
        )
        Role.BOSS -> listOf(
            AppTab.CLIENTS,
            AppTab.SESSIONS,
            AppTab.BOOKINGS,
            AppTab.PACK,
            AppTab.PROFILE,
        )
        Role.RESERVE -> listOf(AppTab.SESSIONS, AppTab.BOOKINGS, AppTab.PACK, AppTab.PROFILE)
    }

    fun requestSession(
        date: String,
        type: String,
        time: String = "09:00",
        room: String = "Sala de arriba",
    ) {
        val currentRole = role ?: return
        if (!termsAccepted) {
            notice = "Debes aceptar los términos antes de reservar."
            return
        }
        if (isMinor && guardianName.isNullOrBlank()) {
            notice = "Falta el responsable legal de la cuenta."
            return
        }
        if (remainingSessions <= 0) {
            notice = "Tu bono no tiene sesiones disponibles."
            return
        }
        val roomRental = currentRole == Role.RESERVE
        val selectedTrainerId = if (roomRental) "" else trainerIds.firstOrNull().orEmpty()
        if (!roomRental && selectedTrainerId.isEmpty()) {
            notice = "No tienes ningún entrenador asignado."
            return
        }
        val reference = firestore.collection("bookingRequests").document()
        reference.set(
            mapOf(
                "clientId" to userId,
                "clientName" to userName,
                "trainerId" to selectedTrainerId,
                "trainerName" to if (roomRental) "Dirección"
                    else trainerNames.firstOrNull().orEmpty(),
                "kind" to if (roomRental) "room_rental" else "training",
                "requestedDate" to date,
                "requestedTime" to time,
                "type" to if (roomRental) "Uso de sala" else type,
                "duration" to packDuration,
                "room" to room,
                "status" to if (roomRental) "pending_boss" else "pending_trainer",
                "proposedTime" to time,
                "finalTime" to null,
                "trainerNotes" to null,
                "bossNotes" to null,
                "createdAt" to FieldValue.serverTimestamp(),
                "modifiedAt" to FieldValue.serverTimestamp(),
            ),
        ).addOnSuccessListener {
            notice = if (roomRental) "Solicitud enviada a Dirección"
            else "Solicitud enviada al entrenador"
        }.addOnFailureListener { notice = it.localizedMessage }
    }

    fun proposeTime(id: String, time: String) {
        val request = bookings.firstOrNull {
            it.id == id && it.status == BookingStatus.PENDING_TRAINER
        } ?: return
        confirmBooking(request.id, time, request.room)
    }

    fun confirmBooking(id: String, time: String, room: String) {
        val request = bookings.firstOrNull { it.id == id } ?: return
        val actorId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        val bookingReference = firestore.collection("bookingRequests").document(id)
        val sessionReference = firestore.collection("sessions").document(id)
        val clientReference = firestore.collection("users").document(request.clientId)
        val locks = occupancyDocuments(request, time, room)

        firestore.runTransaction { transaction ->
            val booking = transaction.get(bookingReference)
            val client = transaction.get(clientReference)
            val status = booking.getString("status")
            if (status !in listOf("pending_trainer", "pending_boss")) {
                abort("La solicitud ya no está pendiente.")
            }
            val remaining = client.int("remainingSessions")
            val reserved = client.int("reservedSessions")
            val used = client.int("usedSessions")
            val total = client.int("packTotalSessions")
            if (remaining <= 0) abort("El bono no tiene sesiones disponibles.")
            locks.forEach { if (transaction.get(it.first).exists()) abort(
                "El entrenador o la sala ya están ocupados en esa franja.",
            ) }

            transaction.update(
                bookingReference,
                mapOf(
                    "status" to "confirmed",
                    "finalTime" to time,
                    "room" to room,
                    "sessionId" to id,
                    "modifiedAt" to FieldValue.serverTimestamp(),
                ),
            )
            transaction.set(
                sessionReference,
                mapOf(
                    "bookingRequestId" to id,
                    "kind" to request.kind,
                    "clientId" to request.clientId,
                    "clientName" to request.clientName,
                    "trainerId" to request.trainerId,
                    "trainerName" to request.trainerName,
                    "date" to request.requestedDate,
                    "time" to time,
                    "duration" to request.duration,
                    "room" to room,
                    "type" to request.type,
                    "status" to "confirmed",
                    "trainerNotes" to null,
                    "feedback" to null,
                    "packSessionNumber" to used + reserved + 1,
                    "packTotalSessions" to total,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "modifiedAt" to FieldValue.serverTimestamp(),
                    "modifiedBy" to actorId,
                ),
            )
            transaction.update(
                clientReference,
                mapOf(
                    "reservedSessions" to reserved + 1,
                    "remainingSessions" to remaining - 1,
                    "modifiedAt" to FieldValue.serverTimestamp(),
                    "modifiedBy" to actorId,
                ),
            )
            locks.forEach { transaction.set(it.first, it.second) }
            audit(transaction, actorId, "confirm_booking", id)
        }.addOnSuccessListener { notice = "Reserva confirmada" }
            .addOnFailureListener { notice = it.localizedMessage }
    }

    fun completeSession(id: String) {
        val actorId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        val session = sessions.firstOrNull {
            it.id == id && it.status == SessionStatus.CONFIRMED
        } ?: return
        val sessionReference = firestore.collection("sessions").document(id)
        val clientReference = firestore.collection("users").document(session.clientId)
        firestore.runTransaction { transaction ->
            val sessionSnapshot = transaction.get(sessionReference)
            val client = transaction.get(clientReference)
            if (sessionSnapshot.getString("status") != "confirmed") {
                abort("La sesión ya no está confirmada.")
            }
            val used = client.int("usedSessions")
            val reserved = client.int("reservedSessions")
            if (reserved <= 0) abort("El saldo reservado no es válido.")
            transaction.update(
                sessionReference,
                mapOf(
                    "status" to "completed",
                    "modifiedAt" to FieldValue.serverTimestamp(),
                    "modifiedBy" to actorId,
                ),
            )
            transaction.update(
                clientReference,
                mapOf(
                    "usedSessions" to used + 1,
                    "reservedSessions" to reserved - 1,
                    "modifiedAt" to FieldValue.serverTimestamp(),
                    "modifiedBy" to actorId,
                ),
            )
            audit(transaction, actorId, "complete_session", id)
        }.addOnSuccessListener { notice = "Sesión completada" }
            .addOnFailureListener { notice = it.localizedMessage }
    }

    fun sendMessage(text: String) {
        if (role != Role.CLIENT) return
        val trimmed = text.trim().take(1_000)
        if (trimmed.isEmpty()) return
        val chat = firestore.collection("chats").document(userId)
        val batch = firestore.batch()
        batch.set(
            chat,
            mapOf(
                "participantIds" to listOf(userId) + trainerIds,
                "clientId" to userId,
                "modifiedAt" to FieldValue.serverTimestamp(),
            ),
            com.google.firebase.firestore.SetOptions.merge(),
        )
        batch.set(
            chat.collection("messages").document(),
            mapOf(
                "authorId" to userId,
                "authorRole" to "client",
                "text" to trimmed,
                "timestamp" to FieldValue.serverTimestamp(),
                "isRead" to false,
            ),
        )
        batch.commit().addOnFailureListener { notice = it.localizedMessage }
    }

    fun saveCycleEntry(
        flow: String,
        symptoms: Set<String>,
        notes: String,
        sharing: Boolean,
    ) {
        if (role != Role.CLIENT || !cycleTrackingEnabled) return
        val day = LocalDate.now().toString()
        val profile = firestore.collection("users").document(userId)
        val batch = firestore.batch()
        val rawFlow = when (flow) {
            "Ligero" -> "light"
            "Medio" -> "medium"
            "Intenso" -> "heavy"
            else -> "none"
        }
        batch.set(
            profile.collection("cycleEntries").document(day),
            mapOf(
                "date" to day,
                "flow" to rawFlow,
                "symptoms" to symptoms.toList(),
                "mood" to "",
                "notes" to notes.take(1_000),
                "modifiedAt" to FieldValue.serverTimestamp(),
            ),
        )
        if (sharing) {
            batch.set(
                profile.collection("cycleSummaries").document(day),
                mapOf(
                    "date" to day,
                    "flow" to rawFlow,
                    "symptoms" to symptoms.toList(),
                    "mood" to "",
                    "modifiedAt" to FieldValue.serverTimestamp(),
                ),
            )
        }
        batch.update(
            profile,
            mapOf(
                "cycleSharingEnabled" to sharing,
                "modifiedAt" to FieldValue.serverTimestamp(),
            ),
        )
        batch.commit().addOnSuccessListener { notice = "Registro de ciclo guardado" }
            .addOnFailureListener { notice = it.localizedMessage }
    }

    fun acceptTerms(imageConsent: Boolean) {
        if (role !in listOf(Role.CLIENT, Role.RESERVE)) return
        firestore.collection("users").document(userId).update(
            mapOf(
                "termsAccepted" to true,
                "termsAcceptedAt" to FieldValue.serverTimestamp(),
                "termsVersion" to "2026-07-27",
                "imageConsent" to imageConsent,
                "imageConsentAt" to FieldValue.serverTimestamp(),
                "modifiedAt" to FieldValue.serverTimestamp(),
            ),
        ).addOnSuccessListener { notice = "Consentimientos guardados" }
            .addOnFailureListener { notice = it.localizedMessage }
    }

    private fun occupancyDocuments(
        request: BookingRequest,
        time: String,
        room: String,
    ): List<Pair<DocumentReference, Map<String, Any?>>> {
        val start = time.split(":").mapNotNull(String::toIntOrNull).let {
            if (it.size == 2) it[0] * 60 + it[1] else 0
        }
        val roomKey = when (room) {
            "Sala de arriba" -> "upstairs"
            "Sala de abajo" -> "downstairs"
            "Sala de fisio" -> "physio"
            else -> "unknown"
        }
        return buildList {
            repeat((request.duration + 14) / 15) { offset ->
                val minute = start + offset * 15
                val key = String.format(Locale.ROOT, "%04d", minute)
                val blockTime = String.format(
                    Locale.ROOT,
                    "%02d:%02d",
                    minute / 60,
                    minute % 60,
                )
                val data = mapOf<String, Any?>(
                    "sessionId" to request.id,
                    "kind" to request.kind,
                    "date" to request.requestedDate,
                    "time" to blockTime,
                    "duration" to 15,
                    "room" to room,
                    "trainerId" to request.trainerId.ifEmpty { null },
                    "createdAt" to FieldValue.serverTimestamp(),
                )
                add(
                    firestore.collection("occupancy").document(
                        "room_${roomKey}_${request.requestedDate}_$key",
                    ) to data,
                )
                if (request.trainerId.isNotEmpty()) {
                    add(
                        firestore.collection("occupancy").document(
                            "trainer_${request.trainerId}_${request.requestedDate}_$key",
                        ) to data,
                    )
                }
            }
        }
    }

    private fun audit(
        transaction: com.google.firebase.firestore.Transaction,
        actorId: String,
        action: String,
        resourceId: String,
    ) {
        transaction.set(
            firestore.collection("activityLogs").document(),
            mapOf(
                "actorId" to actorId,
                "action" to action,
                "resourceId" to resourceId,
                "createdAt" to FieldValue.serverTimestamp(),
            ),
        )
    }

    private fun sessionFrom(document: DocumentSnapshot): TrainingSession? {
        val status = when (document.getString("status")) {
            "confirmed" -> SessionStatus.CONFIRMED
            "completed" -> SessionStatus.COMPLETED
            "cancelled" -> SessionStatus.CANCELLED
            else -> return null
        }
        return TrainingSession(
            id = document.id,
            date = document.getString("date") ?: return null,
            time = document.getString("time") ?: "00:00",
            duration = document.int("duration"),
            clientId = document.getString("clientId").orEmpty(),
            clientName = document.getString("clientName") ?: "Usuario",
            trainerId = document.getString("trainerId").orEmpty(),
            trainerName = document.getString("trainerName") ?: "Dirección",
            kind = document.getString("kind") ?: "training",
            room = document.getString("room") ?: "Sala de arriba",
            type = document.getString("type") ?: "Sesión",
            status = status,
            packSessionNumber = document.getLong("packSessionNumber")?.toInt(),
            packTotalSessions = document.getLong("packTotalSessions")?.toInt(),
            feedback = document.getString("feedback"),
        )
    }

    private fun bookingFrom(document: DocumentSnapshot): BookingRequest? {
        val status = when (document.getString("status")) {
            "pending_trainer" -> BookingStatus.PENDING_TRAINER
            "pending_boss" -> BookingStatus.PENDING_BOSS
            "confirmed" -> BookingStatus.CONFIRMED
            "rejected" -> BookingStatus.REJECTED
            else -> return null
        }
        return BookingRequest(
            id = document.id,
            clientId = document.getString("clientId").orEmpty(),
            clientName = document.getString("clientName") ?: "Usuario",
            trainerId = document.getString("trainerId").orEmpty(),
            trainerName = document.getString("trainerName") ?: "Dirección",
            kind = document.getString("kind") ?: "training",
            requestedDate = document.getString("requestedDate") ?: return null,
            requestedTime = document.getString("requestedTime") ?: "09:00",
            type = document.getString("type") ?: "Sesión",
            duration = document.int("duration"),
            status = status,
            proposedTime = document.getString("proposedTime"),
            room = document.getString("room") ?: "Sala de arriba",
        )
    }

    private fun roomFrom(document: DocumentSnapshot): Room? {
        val name = document.getString("name") ?: return null
        return Room(
            id = document.id,
            name = name,
            use = if (document.getString("type") == "physiotherapy_and_rental") {
                "Fisioterapia y reservas"
            } else {
                "Entrenamiento y reservas"
            },
            occupied = 0,
            capacity = document.int("capacity").coerceAtLeast(1),
            nextUse = "Consultar calendario",
        )
    }

    private fun clientFrom(document: DocumentSnapshot): ManagedClient? {
        if (document.getString("role") != "client") return null
        return ManagedClient(
            id = document.id,
            name = document.getString("name") ?: return null,
            email = document.getString("email").orEmpty(),
            gender = document.getString("gender") ?: "unspecified",
            trainerNames = document.stringList("trainerNames"),
            packTotalSessions = document.int("packTotalSessions"),
            usedSessions = document.int("usedSessions"),
            reservedSessions = document.int("reservedSessions"),
            remainingSessions = document.int("remainingSessions"),
            cycleTrackingEnabled = document.getBoolean("cycleTrackingEnabled") ?: false,
            cycleSharingEnabled = document.getBoolean("cycleSharingEnabled") ?: false,
        )
    }

    private fun syncSharedCycleSummaries(currentClients: List<ManagedClient>) {
        cycleListeners.forEach(ListenerRegistration::remove)
        cycleListeners.clear()
        sharedCycleSummaries.clear()
        currentClients
            .filter {
                it.gender == "female" &&
                    it.cycleTrackingEnabled &&
                    it.cycleSharingEnabled
            }
            .forEach { client ->
                cycleListeners += firestore.collection("users").document(client.id)
                    .collection("cycleSummaries")
                    .orderBy("date", Query.Direction.DESCENDING)
                    .limit(1)
                    .addSnapshotListener { snapshot, error ->
                        if (error != null) {
                            notice = error.localizedMessage
                            return@addSnapshotListener
                        }
                        sharedCycleSummaries.removeAll { it.clientId == client.id }
                        snapshot?.documents?.firstOrNull()?.let { document ->
                            sharedCycleSummaries.add(
                                SharedCycleSummary(
                                    id = "${client.id}_${document.id}",
                                    clientId = client.id,
                                    date = document.getString("date") ?: document.id,
                                    flow = document.getString("flow") ?: "none",
                                    symptoms = document.stringList("symptoms"),
                                    mood = document.getString("mood").orEmpty(),
                                ),
                            )
                        }
                    }
            }
    }

    private fun abort(message: String): Nothing = throw FirebaseFirestoreException(
        message,
        FirebaseFirestoreException.Code.ABORTED,
    )

    private fun DocumentSnapshot.int(field: String): Int = getLong(field)?.toInt() ?: 0

    @Suppress("UNCHECKED_CAST")
    private fun DocumentSnapshot.stringList(field: String): List<String> =
        get(field) as? List<String> ?: emptyList()

    private fun <T> MutableList<T>.replaceWith(values: List<T>) {
        clear()
        addAll(values)
    }
}
