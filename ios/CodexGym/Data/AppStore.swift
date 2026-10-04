import Foundation
import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import LocalAuthentication

@MainActor
final class AppStore: ObservableObject {
    private enum PreferenceKey {
        static let biometricEnabled = "activate.biometricLoginEnabled"
        static let biometricCredentialStored =
            "activate.biometricCredentialStored"
    }

    @Published var currentUser: AppUser?
    @Published var sessions: [GymSession]
    @Published var bookings: [BookingRequest]
    @Published var rooms: [GymRoom]
    @Published var occupiedSlots: [OccupiedSlot] = []
    @Published var messages: [ChatMessage]
    @Published var activePack = TrainingPack(
        id: "active",
        name: "Bono",
        totalSessions: 0,
        usedSessions: 0,
        reservedSessions: 0,
        remainingSessions: 0,
        duration: 45
    )
    @Published var cycleEntries: [String: CycleEntry] = [:]
    @Published var managedUsers: [AppUser] = []
    @Published var trainers: [AppUser] = []
    @Published var staff: [StaffMember] = []
    @Published var clientCycleSummaries: [String: CycleEntry] = [:]
    @Published var toast: String?
    @Published private(set) var biometricAvailable = false
    @Published private(set) var biometricName = "Face ID o Touch ID"
    @Published private(set) var biometricEnabled =
        UserDefaults.standard.bool(forKey: PreferenceKey.biometricEnabled)
    @Published private(set) var isAuthenticatingBiometrics = false

    private var dataListeners: [ListenerRegistration] = []
    private var managedCycleListeners: [ListenerRegistration] = []

    var remainingSessions: Int { activePack.remainingSessions }

    init() {
        sessions = []
        bookings = []
        rooms = []
        messages = []
        refreshBiometricAvailability()
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ActivateDemoMode") {
            loadDemoData()
        }
        #endif
    }
    var availableTabs: [AppTab] {
        switch currentUser?.role {
        case .client:
            if currentUser?.cycleTrackingEnabled == true {
                [.sessions, .cycle, .chat, .nutrition, .plan, .profile]
            } else {
                [.sessions, .chat, .nutrition, .plan, .profile]
            }
        case .trainer:
            [.clients, .sessions, .bookings, .chat, .profile]
        case .boss:
            [.clients, .sessions, .bookings, .admin, .profile]
        case .reserve:
            [.sessions, .bookings, .plan, .profile]
        case nil:
            []
        }
    }

    var visibleSessions: [GymSession] {
        guard let user = currentUser else { return [] }
        let filtered: [GymSession]
        switch user.role {
        case .boss:
            filtered = sessions
        case .trainer:
            filtered = sessions.filter { $0.trainerId == user.id }
        case .client:
            filtered = sessions.filter { $0.clientId == user.id }
        case .reserve:
            filtered = sessions.filter { $0.clientId == user.id }
        }
        return filtered.sorted {
            if Calendar.current.isDate($0.date, inSameDayAs: $1.date) {
                return $0.time < $1.time
            }
            return $0.date < $1.date
        }
    }

    var visibleBookings: [BookingRequest] {
        guard let user = currentUser else { return [] }
        switch user.role {
        case .boss:
            return bookings
        case .trainer:
            return bookings.filter { $0.trainerId == user.id }
        case .client:
            return bookings.filter { $0.clientId == user.id }
        case .reserve:
            return bookings.filter { $0.clientId == user.id }
        }
    }

    func signIn(email: String, password: String) async -> String? {
        let normalizedEmail = email
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard normalizedEmail.contains("@"), !password.isEmpty else {
            return "Introduce tu email y contraseña."
        }

        do {
            let result = try await Auth.auth().signIn(
                withEmail: normalizedEmail,
                password: password
            )
            let user = try await loadUserProfile(
                userID: result.user.uid,
                fallbackEmail: result.user.email ?? normalizedEmail
            )
            currentUser = user
            startDataSync(for: user)
            configureBiometricLogin(for: user.id)
            toast = biometricEnabled
                ? "\(biometricName) activado para el próximo acceso"
                : "Sesión iniciada"
            return nil
        } catch {
            try? Auth.auth().signOut()
            return authenticationMessage(for: error)
        }
    }

    func signOut() {
        stopDataSync()
        try? Auth.auth().signOut()
        currentUser = nil
        toast = nil
        biometricEnabled = false
        UserDefaults.standard.set(false, forKey: PreferenceKey.biometricEnabled)
        UserDefaults.standard.set(
            false,
            forKey: PreferenceKey.biometricCredentialStored
        )
        BiometricCredentialStore.delete()
    }

    var canUseBiometricLogin: Bool {
        biometricAvailable &&
            biometricEnabled &&
            UserDefaults.standard.bool(
                forKey: PreferenceKey.biometricCredentialStored
            )
    }

    func refreshBiometricAvailability() {
        let context = LAContext()
        var error: NSError?
        biometricAvailable = context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        )

        switch context.biometryType {
        case .faceID:
            biometricName = "Face ID"
        case .touchID:
            biometricName = "Touch ID"
        default:
            biometricName = "Face ID o Touch ID"
        }
    }

    func setBiometricEnabled(_ enabled: Bool) {
        if enabled, let userID = currentUser?.id {
            configureBiometricLogin(for: userID)
        } else {
            biometricEnabled = false
            UserDefaults.standard.set(
                false,
                forKey: PreferenceKey.biometricEnabled
            )
            UserDefaults.standard.set(
                false,
                forKey: PreferenceKey.biometricCredentialStored
            )
            BiometricCredentialStore.delete()
        }
    }

    func signInWithBiometrics() async -> String? {
        refreshBiometricAvailability()
        guard canUseBiometricLogin else {
            return "Activa Face ID o Touch ID después de entrar con contraseña."
        }

        isAuthenticatingBiometrics = true
        defer { isAuthenticatingBiometrics = false }

        let context = LAContext()
        context.localizedCancelTitle = "Cancelar"
        do {
            let authenticated = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Accede de forma segura a Activate Personal Training."
            )
            guard authenticated else {
                return "No se ha podido verificar tu identidad."
            }

            let userID = try BiometricCredentialStore.read(using: context)
            guard let firebaseUser = Auth.auth().currentUser,
                  firebaseUser.uid == userID
            else {
                clearBiometricCredential()
                return "La sesión ha caducado. Entra otra vez con tu contraseña."
            }
            let user = try await loadUserProfile(
                userID: userID,
                fallbackEmail: firebaseUser.email ?? ""
            )
            currentUser = user
            startDataSync(for: user)
            toast = "Acceso autorizado con \(biometricName)"
            return nil
        } catch let error as LAError {
            switch error.code {
            case .userCancel, .systemCancel, .appCancel:
                return nil
            case .biometryNotEnrolled:
                return "Configura \(biometricName) en Ajustes antes de usarlo."
            case .biometryLockout:
                return "\(biometricName) está bloqueado. Desbloquea primero el dispositivo."
            default:
                return "No se ha podido acceder con \(biometricName)."
            }
        } catch {
            clearBiometricCredential()
            return "La credencial biométrica ha caducado. Entra otra vez con contraseña."
        }
    }

    private func configureBiometricLogin(for userID: String) {
        refreshBiometricAvailability()
        guard biometricAvailable else { return }

        do {
            try BiometricCredentialStore.save(userID: userID)
            biometricEnabled = true
            UserDefaults.standard.set(
                true,
                forKey: PreferenceKey.biometricEnabled
            )
            UserDefaults.standard.set(
                true,
                forKey: PreferenceKey.biometricCredentialStored
            )
        } catch {
            biometricEnabled = false
            UserDefaults.standard.set(
                false,
                forKey: PreferenceKey.biometricEnabled
            )
            UserDefaults.standard.set(
                false,
                forKey: PreferenceKey.biometricCredentialStored
            )
        }
    }

    private func clearBiometricCredential() {
        biometricEnabled = false
        UserDefaults.standard.set(false, forKey: PreferenceKey.biometricEnabled)
        UserDefaults.standard.set(
            false,
            forKey: PreferenceKey.biometricCredentialStored
        )
        BiometricCredentialStore.delete()
    }

    private func loadUserProfile(
        userID: String,
        fallbackEmail: String
    ) async throws -> AppUser {
        let snapshot = try await Firestore.firestore()
            .collection("users")
            .document(userID)
            .getDocument()
        guard let data = snapshot.data(),
              let rawRole = data["role"] as? String,
              let role = UserRole(rawValue: rawRole)
        else {
            throw NSError(
                domain: "ActivateAuthentication",
                code: 1,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Esta cuenta todavía no tiene un perfil de Activate."
                ]
            )
        }

        let trainerIds =
            (data["trainerIds"] as? [String]) ??
            (data["trainerId"] as? String).map { [$0] } ??
            []

        return AppUser(
            id: userID,
            email: (data["email"] as? String) ?? fallbackEmail,
            name: (data["name"] as? String) ?? "Usuario Activate",
            role: role,
            trainerIds: trainerIds,
            phone: (data["phone"] as? String) ?? "",
            dni: (data["dni"] as? String) ?? "",
            trainerStaffIds: (data["trainerStaffIds"] as? [String]) ?? [],
            isTrainer:
                (data["isTrainer"] as? Bool) ?? (role == .trainer),
            isMinor: (data["isMinor"] as? Bool) ?? false,
            guardianName: data["guardianName"] as? String,
            termsAccepted: (data["termsAccepted"] as? Bool) ?? false,
            imageConsent: (data["imageConsent"] as? Bool) ?? false,
            cycleTrackingEnabled:
                (data["cycleTrackingEnabled"] as? Bool) ?? false,
            cycleSharingEnabled:
                (data["cycleSharingEnabled"] as? Bool) ?? false,
            packName: (data["packName"] as? String) ?? "Bono",
            packTotalSessions: (data["packTotalSessions"] as? Int) ?? 0,
            usedSessions: (data["usedSessions"] as? Int) ?? 0,
            reservedSessions: (data["reservedSessions"] as? Int) ?? 0,
            remainingSessions: (data["remainingSessions"] as? Int) ?? 0,
            sessionDuration: (data["sessionDuration"] as? Int) ?? 45
        )
    }

    private func authenticationMessage(for error: Error) -> String {
        let nsError = error as NSError
        if nsError.domain == AuthErrorDomain {
            switch AuthErrorCode(rawValue: nsError.code) {
            case .invalidEmail:
                return "El email no es válido."
            case .wrongPassword, .userNotFound, .invalidCredential:
                return "El email o la contraseña no son correctos."
            case .userDisabled:
                return "Esta cuenta está desactivada. Contacta con Dirección."
            case .networkError:
                return "No hay conexión. Revisa Internet e inténtalo de nuevo."
            case .tooManyRequests:
                return "Demasiados intentos. Espera unos minutos."
            default:
                break
            }
        }
        return nsError.localizedDescription
    }

    func requestSession(
        date: Date,
        time: String = "09:00",
        type: String,
        trainerId: String? = nil,
        room: String = "Sala de arriba"
    ) {
        guard let client = currentUser,
              client.role == .client || client.role == .reserve,
              Auth.auth().currentUser?.uid == client.id
        else { return }
        guard client.termsAccepted else {
            toast = "Debes aceptar los términos antes de reservar"
            return
        }
        guard !client.isMinor || client.guardianName != nil else {
            toast = "Falta el responsable legal de la cuenta"
            return
        }
        guard client.remainingSessions > 0 else {
            toast = "Tu bono no tiene sesiones disponibles"
            return
        }

        let isRoomRental = client.role == .reserve
        let selectedTrainerId =
            isRoomRental ? "" : (trainerId ?? client.trainerIds.first ?? "")
        guard isRoomRental || client.trainerIds.contains(selectedTrainerId) else {
            toast = "Selecciona uno de tus entrenadores asignados"
            return
        }
        let trainerName = isRoomRental
            ? "Dirección"
            : trainers.first(where: { $0.id == selectedTrainerId })?.name
                ?? "Entrenador"

        let reference = Firestore.firestore().collection("bookingRequests").document()
        reference.setData([
            "clientId": client.id,
            "clientName": client.name,
            "trainerId": selectedTrainerId,
            "trainerName": trainerName,
            "kind": isRoomRental
                ? BookingKind.roomRental.rawValue
                : BookingKind.training.rawValue,
            "requestedDate": date.firestoreDay,
            "requestedTime": time,
            "type": isRoomRental ? "Uso de sala" : type,
            "duration": client.sessionDuration,
            "room": room,
            "status": isRoomRental
                ? BookingStatus.pendingBoss.rawValue
                : BookingStatus.pendingTrainer.rawValue,
            "proposedTime": time,
            "finalTime": NSNull(),
            "trainerNotes": NSNull(),
            "bossNotes": NSNull(),
            "createdAt": FieldValue.serverTimestamp(),
            "modifiedAt": FieldValue.serverTimestamp(),
        ]) { [weak self] error in
            Task { @MainActor in
                self?.toast = error?.localizedDescription ?? (
                    isRoomRental
                        ? "Solicitud enviada a Dirección"
                        : "Solicitud enviada al entrenador"
                )
            }
        }
    }

    func proposeTime(
        for requestId: String,
        time: String,
        notes: String,
        room: String = "Sala de arriba"
    ) {
        guard let user = currentUser,
              user.role == .trainer || user.role == .boss,
              let request = bookings.first(where: {
                  $0.id == requestId && $0.status == .pendingTrainer
              }),
              user.role == .boss || request.trainerId == user.id
        else { return }
        Task {
            await confirmBookingInFirestore(
                request,
                time: time,
                room: room,
                notes: notes
            )
        }
    }

    func confirmBooking(_ requestId: String, time: String, room: String) {
        guard currentUser?.role == .boss,
              let request = bookings.first(where: {
                  $0.id == requestId && $0.status == .pendingBoss
              })
        else { return }
        Task {
            await confirmBookingInFirestore(
                request,
                time: time,
                room: room,
                notes: ""
            )
        }
    }

    private func confirmBookingInFirestore(
        _ request: BookingRequest,
        time: String,
        room: String,
        notes: String
    ) async {
        guard let actor = currentUser else { return }
        let database = Firestore.firestore()
        let bookingReference = database.collection("bookingRequests")
            .document(request.id)
        let sessionReference = database.collection("sessions").document(request.id)
        let clientReference = database.collection("users").document(request.clientId)
        let lockDocuments = occupancyDocuments(
            sessionId: request.id,
            kind: request.kind,
            date: request.requestedDate,
            time: time,
            duration: request.duration,
            room: room,
            trainerId: request.trainerId
        )

        do {
            _ = try await database.runTransaction { transaction, errorPointer in
                guard let bookingSnapshot = try? transaction.getDocument(
                    bookingReference
                ), let clientSnapshot = try? transaction.getDocument(clientReference)
                else {
                    errorPointer?.pointee = self.firestoreError(
                        "No se han podido leer los datos de la reserva."
                    )
                    return nil
                }
                guard let booking = bookingSnapshot.data(),
                      let client = clientSnapshot.data(),
                      let status = booking["status"] as? String,
                      ["pending_trainer", "pending_boss"].contains(status)
                else {
                    errorPointer?.pointee = self.firestoreError(
                        "La solicitud ya no está pendiente."
                    )
                    return nil
                }
                let remaining = client["remainingSessions"] as? Int ?? 0
                let reserved = client["reservedSessions"] as? Int ?? 0
                let used = client["usedSessions"] as? Int ?? 0
                let total = client["packTotalSessions"] as? Int ?? 0
                guard remaining > 0 else {
                    errorPointer?.pointee = self.firestoreError(
                        "El bono no tiene sesiones disponibles."
                    )
                    return nil
                }

                for lock in lockDocuments {
                    if (try? transaction.getDocument(lock.reference).exists) == true {
                        errorPointer?.pointee = self.firestoreError(
                            "El entrenador o la sala ya están ocupados en esa franja."
                        )
                        return nil
                    }
                }

                transaction.updateData([
                    "status": BookingStatus.confirmed.rawValue,
                    "finalTime": time,
                    "room": room,
                    "trainerNotes": notes.isEmpty ? NSNull() : notes,
                    "sessionId": request.id,
                    "modifiedAt": FieldValue.serverTimestamp(),
                ], forDocument: bookingReference)
                transaction.setData([
                    "bookingRequestId": request.id,
                    "kind": request.kind.rawValue,
                    "clientId": request.clientId,
                    "clientName": request.clientName,
                    "trainerId": request.trainerId,
                    "trainerName": request.trainerName,
                    "date": request.requestedDate.firestoreDay,
                    "time": time,
                    "duration": request.duration,
                    "room": room,
                    "type": request.type,
                    "status": SessionStatus.confirmed.rawValue,
                    "trainerNotes": notes.isEmpty ? NSNull() : notes,
                    "feedback": NSNull(),
                    "packSessionNumber": used + reserved + 1,
                    "packTotalSessions": total,
                    "createdAt": FieldValue.serverTimestamp(),
                    "modifiedAt": FieldValue.serverTimestamp(),
                    "modifiedBy": actor.id,
                ], forDocument: sessionReference)
                transaction.updateData([
                    "reservedSessions": reserved + 1,
                    "remainingSessions": remaining - 1,
                    "modifiedAt": FieldValue.serverTimestamp(),
                    "modifiedBy": actor.id,
                ], forDocument: clientReference)
                for lock in lockDocuments {
                    transaction.setData(lock.data, forDocument: lock.reference)
                }
                self.writeAudit(
                    transaction,
                    actorId: actor.id,
                    action: request.kind == .roomRental
                        ? "confirm_room_booking"
                        : "confirm_training_booking",
                    resourceId: request.id
                )
                return nil
            }
            toast = request.kind == .roomRental
                ? "Reserva de sala confirmada"
                : "Entrenamiento confirmado"
        } catch {
            toast = error.localizedDescription
        }
    }

    func rejectBooking(_ requestId: String) {
        guard let actor = currentUser,
              let request = bookings.first(where: { $0.id == requestId }),
              actor.role == .boss ||
                (
                    actor.role == .trainer &&
                    request.trainerId == actor.id &&
                    request.kind == .training
                )
        else { return }

        let database = Firestore.firestore()
        let batch = database.batch()
        batch.updateData([
            "status": BookingStatus.rejected.rawValue,
            "rejectionReason": "No disponible",
            "modifiedAt": FieldValue.serverTimestamp(),
        ], forDocument: database.collection("bookingRequests").document(requestId))
        writeAudit(
            batch,
            actorId: actor.id,
            action: "reject_booking",
            resourceId: requestId
        )
        batch.commit { [weak self] error in
            Task { @MainActor in
                self?.toast = error?.localizedDescription ?? "Solicitud rechazada"
            }
        }
    }

    func completeSession(_ sessionId: String, feedback: String) {
        guard let actor = currentUser,
              actor.role == .trainer || actor.role == .boss,
              let session = sessions.first(where: {
                  $0.id == sessionId && $0.status == .confirmed
              }),
              actor.role == .boss || session.trainerId == actor.id
        else { return }

        Task {
            let database = Firestore.firestore()
            let sessionReference = database.collection("sessions").document(sessionId)
            let clientReference = database.collection("users")
                .document(session.clientId)
            do {
                _ = try await database.runTransaction { transaction, errorPointer in
                    guard let sessionSnapshot = try? transaction.getDocument(
                        sessionReference
                    ), let clientSnapshot = try? transaction.getDocument(clientReference)
                    else {
                        errorPointer?.pointee = self.firestoreError(
                            "No se han podido leer los datos de la sesión."
                        )
                        return nil
                    }
                    guard sessionSnapshot.data()?["status"] as? String == "confirmed",
                          let client = clientSnapshot.data()
                    else {
                        errorPointer?.pointee = self.firestoreError(
                            "La sesión ya no está confirmada."
                        )
                        return nil
                    }
                    let used = client["usedSessions"] as? Int ?? 0
                    let reserved = client["reservedSessions"] as? Int ?? 0
                    guard reserved > 0 else {
                        errorPointer?.pointee = self.firestoreError(
                            "El saldo reservado no es válido."
                        )
                        return nil
                    }
                    transaction.updateData([
                        "status": SessionStatus.completed.rawValue,
                        "feedback": feedback.isEmpty ? NSNull() : feedback,
                        "modifiedAt": FieldValue.serverTimestamp(),
                        "modifiedBy": actor.id,
                    ], forDocument: sessionReference)
                    transaction.updateData([
                        "usedSessions": used + 1,
                        "reservedSessions": reserved - 1,
                        "modifiedAt": FieldValue.serverTimestamp(),
                        "modifiedBy": actor.id,
                    ], forDocument: clientReference)
                    self.writeAudit(
                        transaction,
                        actorId: actor.id,
                        action: session.trainerId.isEmpty
                            ? "complete_room_booking"
                            : "complete_session",
                        resourceId: sessionId
                    )
                    return nil
                }
                toast = "Sesión completada"
            } catch {
                toast = error.localizedDescription
            }
        }
    }

    @discardableResult
    func rescheduleSession(
        _ sessionId: String,
        date: Date,
        time: String,
        room: String
    ) -> Bool {
        guard let actor = currentUser,
              actor.role == .boss,
              let session = sessions.first(where: {
                  $0.id == sessionId && $0.status == .confirmed
              })
        else { return false }

        Task {
            let database = Firestore.firestore()
            let sessionReference = database.collection("sessions").document(sessionId)
            let oldLocks = occupancyDocuments(
                sessionId: sessionId,
                kind: session.trainerId.isEmpty ? .roomRental : .training,
                date: session.date,
                time: session.time,
                duration: session.duration,
                room: session.room,
                trainerId: session.trainerId
            )
            let newLocks = occupancyDocuments(
                sessionId: sessionId,
                kind: session.trainerId.isEmpty ? .roomRental : .training,
                date: date,
                time: time,
                duration: session.duration,
                room: room,
                trainerId: session.trainerId
            )
            let oldIds = Set(oldLocks.map { $0.reference.documentID })
            let newIds = Set(newLocks.map { $0.reference.documentID })
            let locksToDelete = oldLocks.filter {
                !newIds.contains($0.reference.documentID)
            }
            let locksToCreate = newLocks.filter {
                !oldIds.contains($0.reference.documentID)
            }

            do {
                _ = try await database.runTransaction { transaction, errorPointer in
                    guard let snapshot = try? transaction.getDocument(sessionReference)
                    else {
                        errorPointer?.pointee = self.firestoreError(
                            "No se ha podido leer la sesión."
                        )
                        return nil
                    }
                    guard snapshot.data()?["status"] as? String == "confirmed" else {
                        errorPointer?.pointee = self.firestoreError(
                            "La sesión ya no está confirmada."
                        )
                        return nil
                    }
                    for lock in locksToCreate {
                        if (try? transaction.getDocument(lock.reference).exists) == true {
                            errorPointer?.pointee = self.firestoreError(
                                "Esa franja ya está ocupada."
                            )
                            return nil
                        }
                    }
                    transaction.updateData([
                        "date": date.firestoreDay,
                        "time": time,
                        "room": room,
                        "modifiedAt": FieldValue.serverTimestamp(),
                        "modifiedBy": actor.id,
                    ], forDocument: sessionReference)
                    for lock in locksToDelete {
                        transaction.deleteDocument(lock.reference)
                    }
                    for lock in locksToCreate {
                        transaction.setData(lock.data, forDocument: lock.reference)
                    }
                    self.writeAudit(
                        transaction,
                        actorId: actor.id,
                        action: "reschedule_session",
                        resourceId: sessionId
                    )
                    return nil
                }
                toast = "Sesión actualizada"
            } catch {
                toast = error.localizedDescription
            }
        }
        return true
    }

    func cancelSession(_ sessionId: String) {
        guard let actor = currentUser,
              actor.role == .boss,
              let session = sessions.first(where: {
                  $0.id == sessionId && $0.status == .confirmed
              })
        else { return }

        Task {
            let database = Firestore.firestore()
            let sessionReference = database.collection("sessions").document(sessionId)
            let clientReference = database.collection("users")
                .document(session.clientId)
            let locks = occupancyDocuments(
                sessionId: sessionId,
                kind: session.trainerId.isEmpty ? .roomRental : .training,
                date: session.date,
                time: session.time,
                duration: session.duration,
                room: session.room,
                trainerId: session.trainerId
            )

            do {
                _ = try await database.runTransaction { transaction, errorPointer in
                    guard let sessionSnapshot = try? transaction.getDocument(
                        sessionReference
                    ), let clientSnapshot = try? transaction.getDocument(clientReference)
                    else {
                        errorPointer?.pointee = self.firestoreError(
                            "No se han podido leer los datos de la sesión."
                        )
                        return nil
                    }
                    guard sessionSnapshot.data()?["status"] as? String == "confirmed",
                          let client = clientSnapshot.data()
                    else {
                        errorPointer?.pointee = self.firestoreError(
                            "La sesión ya no está confirmada."
                        )
                        return nil
                    }
                    let reserved = client["reservedSessions"] as? Int ?? 0
                    let remaining = client["remainingSessions"] as? Int ?? 0
                    guard reserved > 0 else {
                        errorPointer?.pointee = self.firestoreError(
                            "El saldo reservado no es válido."
                        )
                        return nil
                    }
                    transaction.updateData([
                        "status": SessionStatus.cancelled.rawValue,
                        "cancellationReason": "Cancelada por Dirección",
                        "modifiedAt": FieldValue.serverTimestamp(),
                        "modifiedBy": actor.id,
                    ], forDocument: sessionReference)
                    transaction.updateData([
                        "reservedSessions": reserved - 1,
                        "remainingSessions": remaining + 1,
                        "modifiedAt": FieldValue.serverTimestamp(),
                        "modifiedBy": actor.id,
                    ], forDocument: clientReference)
                    for lock in locks {
                        transaction.deleteDocument(lock.reference)
                    }
                    self.writeAudit(
                        transaction,
                        actorId: actor.id,
                        action: "cancel_session",
                        resourceId: sessionId
                    )
                    return nil
                }
                toast = "Sesión cancelada"
            } catch {
                toast = error.localizedDescription
            }
        }
    }
    func sendMessage(_ text: String) {
        guard let user = currentUser, user.role == .client else { return }
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }

        let database = Firestore.firestore()
        let chatReference = database.collection("chats").document(user.id)
        let messageReference = chatReference.collection("messages").document()
        let batch = database.batch()
        batch.setData([
            "participantIds": [user.id] + user.trainerIds,
            "clientId": user.id,
            "modifiedAt": FieldValue.serverTimestamp(),
        ], forDocument: chatReference, merge: true)
        batch.setData([
            "authorId": user.id,
            "authorRole": user.role.rawValue,
            "text": String(normalized.prefix(1_000)),
            "timestamp": FieldValue.serverTimestamp(),
            "isRead": false,
        ], forDocument: messageReference)
        batch.commit { [weak self] error in
            guard let error else { return }
            Task { @MainActor in self?.toast = error.localizedDescription }
        }
    }
    func cycleEntry(for date: Date) -> CycleEntry {
        cycleEntries[date.firestoreDay] ??
            CycleEntry(flow: .none, symptoms: [], mood: "🙂", notes: "")
    }

    func saveCycleEntry(_ entry: CycleEntry, for date: Date) {
        cycleEntries[date.firestoreDay] = entry
        toast = "Registro de ciclo guardado"
        guard let user = currentUser, user.role == .client,
              Auth.auth().currentUser != nil
        else { return }
        Firestore.firestore()
            .collection("users")
            .document(user.id)
            .collection("cycleEntries")
            .document(date.firestoreDay)
            .setData([
                "date": date.firestoreDay,
                "flow": entry.flow.rawValue,
                "symptoms": Array(entry.symptoms),
                "mood": entry.mood,
                "notes": entry.notes,
                "modifiedAt": FieldValue.serverTimestamp(),
            ], merge: true) { [weak self] error in
                guard let error else { return }
                Task { @MainActor in
                    self?.toast = error.localizedDescription
                }
            }
        if user.cycleTrackingEnabled && user.cycleSharingEnabled {
            Firestore.firestore()
                .collection("users")
                .document(user.id)
                .collection("cycleSummaries")
                .document(date.firestoreDay)
                .setData([
                    "date": date.firestoreDay,
                    "flow": entry.flow.rawValue,
                    "symptoms": Array(entry.symptoms),
                    "mood": entry.mood,
                    "modifiedAt": FieldValue.serverTimestamp(),
                ], merge: true)
        }
    }

    func setCycleSharingEnabled(_ enabled: Bool) {
        guard var user = currentUser,
              user.role == .client,
              user.cycleTrackingEnabled
        else { return }
        user.cycleSharingEnabled = enabled
        currentUser = user
        guard Auth.auth().currentUser != nil else { return }
        Firestore.firestore().collection("users").document(user.id).updateData([
            "cycleSharingEnabled": enabled,
            "modifiedAt": FieldValue.serverTimestamp(),
        ])
    }

    func isSlotOccupied(
        date: Date,
        time: String,
        duration: Int,
        room: String,
        trainerId: String?
    ) -> Bool {
        let start = minutes(from: time)
        let end = start + duration
        let blocks = occupiedSlots.isEmpty
            ? sessions.filter { $0.status == .confirmed }.map {
                OccupiedSlot(
                    id: $0.id,
                    date: $0.date,
                    time: $0.time,
                    duration: $0.duration,
                    room: $0.room,
                    trainerId: $0.trainerId.isEmpty ? nil : $0.trainerId
                )
            }
            : occupiedSlots
        return blocks.contains { block in
            guard Calendar.current.isDate(block.date, inSameDayAs: date),
                  block.room == room || (
                    trainerId != nil && block.trainerId == trainerId
                  )
            else { return false }
            let otherStart = minutes(from: block.time)
            let otherEnd = otherStart + block.duration
            return start < otherEnd && otherStart < end
        }
    }

    func createClient(
        name: String,
        dni: String,
        email: String,
        phone: String,
        trainerStaffIds: [String],
        duration: Int,
        packName: String,
        packSessions: Int,
        isMinor: Bool,
        isRoomUser: Bool,
        isFemale: Bool,
        cycleTrackingEnabled: Bool,
        guardianName: String,
        guardianEmail: String
    ) async -> String? {
        guard let boss = currentUser, boss.role == .boss else {
            return "No tienes permisos de Dirección."
        }
        guard [45, 60].contains(duration), packSessions > 0 else {
            return "Revisa la duración y el número de sesiones."
        }
        guard isRoomUser || !trainerStaffIds.isEmpty else {
            return "Asigna al menos un entrenador."
        }
        guard !cycleTrackingEnabled || isFemale else {
            return "El seguimiento de ciclo sólo puede activarse en una clienta."
        }
        guard let options = FirebaseApp.app()?.options else {
            return "Firebase no está configurado."
        }

        let appName = "activate-provisioning"
        if FirebaseApp.app(name: appName) == nil {
            FirebaseApp.configure(name: appName, options: options)
        }
        guard let provisioningApp = FirebaseApp.app(name: appName) else {
            return "No se ha podido preparar el alta segura."
        }

        let normalizedEmail = email
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let normalizedDni = dni.uppercased().filter { $0.isLetter || $0.isNumber }
        guard normalizedDni.count >= 6 else {
            return "Introduce un DNI, NIE o documento válido."
        }
        let database = Firestore.firestore()
        let documentReference = database.collection("clientDocuments")
            .document(normalizedDni)
        do {
            if try await documentReference.getDocument().exists {
                return "Este documento ya está vinculado a otro cliente."
            }
        } catch {
            return error.localizedDescription
        }
        let secondaryAuth = Auth.auth(app: provisioningApp)
        var createdUser: FirebaseAuth.User?

        do {
            let password = "Activate-" + UUID().uuidString + "-Aa1!"
            let result = try await secondaryAuth.createUser(
                withEmail: normalizedEmail,
                password: password
            )
            createdUser = result.user

            let selectedStaff = staff.filter {
                $0.kind == .trainer && trainerStaffIds.contains($0.id)
            }
            let trainerIds = selectedStaff.compactMap(\.authUid)
            let trainerNames = selectedStaff
                .map(\.name)
            let batch = database.batch()
            let userReference = database.collection("users")
                .document(result.user.uid)
            batch.setData([
                "uid": result.user.uid,
                "dni": dni.trimmingCharacters(in: .whitespacesAndNewlines)
                    .uppercased(),
                "normalizedDni": normalizedDni,
                "email": normalizedEmail,
                "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
                "phone": phone,
                "role": isRoomUser
                    ? UserRole.reserve.rawValue
                    : UserRole.client.rawValue,
                "isTrainer": false,
                "trainerIds": isRoomUser ? [] : trainerIds,
                "trainerStaffIds": isRoomUser ? [] : trainerStaffIds,
                "trainerNames": isRoomUser ? [] : trainerNames,
                "allowedRoomIds": isRoomUser
                    ? ["upstairs", "downstairs", "physio"]
                    : [],
                "packId": UUID().uuidString,
                "packName": packName,
                "packTotalSessions": packSessions,
                "usedSessions": 0,
                "reservedSessions": 0,
                "remainingSessions": packSessions,
                "sessionDuration": duration,
                "isMinor": !isRoomUser && isMinor,
                "guardianName": !isRoomUser && isMinor
                    ? guardianName
                    : NSNull(),
                "guardianEmail": !isRoomUser && isMinor
                    ? guardianEmail
                    : NSNull(),
                "termsAccepted": false,
                "termsVersion": NSNull(),
                "imageConsent": false,
                "gender": !isRoomUser && isFemale ? "female" : "unspecified",
                "cycleTrackingEnabled":
                    !isRoomUser && isFemale && cycleTrackingEnabled,
                "cycleSharingEnabled": false,
                "status": "active",
                "createdBy": boss.id,
                "createdAt": FieldValue.serverTimestamp(),
                "modifiedBy": boss.id,
                "modifiedAt": FieldValue.serverTimestamp(),
            ], forDocument: userReference)
            batch.setData([
                "userId": result.user.uid,
                "normalizedDni": normalizedDni,
                "createdAt": FieldValue.serverTimestamp(),
                "createdBy": boss.id,
            ], forDocument: documentReference)
            writeAudit(
                batch,
                actorId: boss.id,
                action: isRoomUser ? "create_room_user" : "create_client",
                resourceId: result.user.uid
            )
            try await batch.commit()
            try await secondaryAuth.sendPasswordReset(withEmail: normalizedEmail)
            try secondaryAuth.signOut()
            toast = isRoomUser
                ? "Usuario de sala creado; acceso enviado por email"
                : "Cliente creado; acceso enviado por email"
            return nil
        } catch {
            if let createdUser {
                try? await createdUser.delete()
            }
            try? secondaryAuth.signOut()
            return error.localizedDescription
        }
    }

    func addPack(
        to clientId: String,
        sessions: Int,
        duration: Int,
        name: String
    ) async -> String? {
        guard let boss = currentUser, boss.role == .boss else {
            return "No tienes permisos de Dirección."
        }
        guard sessions > 0, [45, 60].contains(duration) else {
            return "Revisa el bono."
        }

        let database = Firestore.firestore()
        let reference = database.collection("users").document(clientId)
        do {
            _ = try await database.runTransaction { transaction, errorPointer in
                guard let snapshot = try? transaction.getDocument(reference) else {
                    errorPointer?.pointee = self.firestoreError(
                        "No se ha podido leer la cuenta."
                    )
                    return nil
                }
                guard let data = snapshot.data(),
                      ["client", "reserve"].contains(data["role"] as? String ?? "")
                else {
                    errorPointer?.pointee = self.firestoreError(
                        "La cuenta no existe."
                    )
                    return nil
                }
                let total = data["packTotalSessions"] as? Int ?? 0
                let remaining = data["remainingSessions"] as? Int ?? 0
                let reserved = data["reservedSessions"] as? Int ?? 0
                let currentDuration = data["sessionDuration"] as? Int ?? 45
                guard (remaining + reserved == 0) || currentDuration == duration else {
                    errorPointer?.pointee = self.firestoreError(
                        "No se puede cambiar la duración mientras quede saldo del bono actual."
                    )
                    return nil
                }
                transaction.updateData([
                    "packName": name,
                    "packTotalSessions": total + sessions,
                    "remainingSessions": remaining + sessions,
                    "sessionDuration": duration,
                    "modifiedAt": FieldValue.serverTimestamp(),
                    "modifiedBy": boss.id,
                ], forDocument: reference)
                self.writeAudit(
                    transaction,
                    actorId: boss.id,
                    action: "add_pack_sessions",
                    resourceId: clientId
                )
                return nil
            }
            toast = "Bono actualizado"
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    func acceptTerms(imageConsent: Bool) async -> String? {
        guard let user = currentUser,
              user.role == .client || user.role == .reserve
        else {
            return "Esta cuenta no necesita aceptar estos términos."
        }
        do {
            try await Firestore.firestore().collection("users")
                .document(user.id)
                .updateData([
                    "termsAccepted": true,
                    "termsAcceptedAt": FieldValue.serverTimestamp(),
                    "termsVersion": "2026-07-27",
                    "imageConsent": imageConsent,
                    "imageConsentAt": FieldValue.serverTimestamp(),
                    "modifiedAt": FieldValue.serverTimestamp(),
                ])
            toast = "Consentimientos guardados"
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    func requestAccountDeletion() async -> String? {
        guard let user = currentUser, user.role != .boss else {
            return "Antes hay que transferir la cuenta principal de Dirección."
        }
        let database = Firestore.firestore()
        let batch = database.batch()
        batch.setData([
            "uid": user.id,
            "email": user.email,
            "status": "pending",
            "requestedAt": FieldValue.serverTimestamp(),
        ], forDocument: database.collection("deletionRequests").document(user.id))
        batch.updateData([
            "status": "deletion_requested",
            "deletionRequestedAt": FieldValue.serverTimestamp(),
            "modifiedAt": FieldValue.serverTimestamp(),
        ], forDocument: database.collection("users").document(user.id))
        do {
            try await batch.commit()
            signOut()
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    private func occupancyDocuments(
        sessionId: String,
        kind: BookingKind,
        date: Date,
        time: String,
        duration: Int,
        room: String,
        trainerId: String
    ) -> [(reference: DocumentReference, data: [String: Any])] {
        let database = Firestore.firestore()
        let collection = database.collection("occupancy")
        let start = minutes(from: time)
        let blockCount = max(1, Int(ceil(Double(duration) / 15.0)))
        let roomKey: String
        switch room {
        case "Sala de arriba": roomKey = "upstairs"
        case "Sala de abajo": roomKey = "downstairs"
        case "Sala de fisio": roomKey = "physio"
        default: roomKey = "unknown"
        }

        var values: [(DocumentReference, [String: Any])] = []
        for offset in 0..<blockCount {
            let blockMinutes = start + offset * 15
            let blockTime = String(
                format: "%02d:%02d",
                blockMinutes / 60,
                blockMinutes % 60
            )
            let blockKey = String(format: "%04d", blockMinutes)
            let common: [String: Any] = [
                "sessionId": sessionId,
                "kind": kind.rawValue,
                "date": date.firestoreDay,
                "time": blockTime,
                "duration": 15,
                "room": room,
                "trainerId": trainerId.isEmpty ? NSNull() : trainerId,
                "createdAt": FieldValue.serverTimestamp(),
            ]
            values.append((
                collection.document(
                    "room_\(roomKey)_\(date.firestoreDay)_\(blockKey)"
                ),
                common
            ))
            if !trainerId.isEmpty {
                values.append((
                    collection.document(
                        "trainer_\(trainerId)_\(date.firestoreDay)_\(blockKey)"
                    ),
                    common
                ))
            }
        }
        return values
    }

    private func writeAudit(
        _ transaction: Transaction,
        actorId: String,
        action: String,
        resourceId: String
    ) {
        let reference = Firestore.firestore().collection("activityLogs").document()
        transaction.setData([
            "actorId": actorId,
            "action": action,
            "resourceId": resourceId,
            "createdAt": FieldValue.serverTimestamp(),
        ], forDocument: reference)
    }

    private func writeAudit(
        _ batch: WriteBatch,
        actorId: String,
        action: String,
        resourceId: String
    ) {
        let reference = Firestore.firestore().collection("activityLogs").document()
        batch.setData([
            "actorId": actorId,
            "action": action,
            "resourceId": resourceId,
            "createdAt": FieldValue.serverTimestamp(),
        ], forDocument: reference)
    }

    private func firestoreError(_ message: String) -> NSError {
        NSError(
            domain: "ActivateFirestore",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
    }
    private func stopDataSync() {
        dataListeners.forEach { $0.remove() }
        managedCycleListeners.forEach { $0.remove() }
        dataListeners.removeAll()
        managedCycleListeners.removeAll()
        managedUsers = []
        trainers = []
        staff = []
        clientCycleSummaries = [:]
        occupiedSlots = []
    }

    private func startDataSync(for user: AppUser) {
        stopDataSync()
        sessions = []
        bookings = []
        messages = []
        cycleEntries = [:]

        let database = Firestore.firestore()
        let profileReference = database.collection("users").document(user.id)
        dataListeners.append(
            profileReference.addSnapshotListener { [weak self] snapshot, _ in
                guard let snapshot, snapshot.exists else { return }
                Task { @MainActor in
                    guard let self,
                          let profile = self.user(from: snapshot)
                    else { return }
                    self.currentUser = profile
                    self.activePack = TrainingPack(
                        id: (snapshot.data()?["packId"] as? String) ?? "active",
                        name: (snapshot.data()?["packName"] as? String) ?? "Bono",
                        totalSessions:
                            (snapshot.data()?["packTotalSessions"] as? Int) ?? 0,
                        usedSessions:
                            (snapshot.data()?["usedSessions"] as? Int) ?? 0,
                        reservedSessions:
                            (snapshot.data()?["reservedSessions"] as? Int) ?? 0,
                        remainingSessions:
                            (snapshot.data()?["remainingSessions"] as? Int) ?? 0,
                        duration:
                            (snapshot.data()?["sessionDuration"] as? Int) ?? 45
                    )
                }
            }
        )

        let sessionsQuery: Query
        let bookingsQuery: Query
        switch user.role {
        case .boss:
            sessionsQuery = database.collection("sessions")
            bookingsQuery = database.collection("bookingRequests")
        case .trainer:
            sessionsQuery = database.collection("sessions")
                .whereField("trainerId", isEqualTo: user.id)
            bookingsQuery = database.collection("bookingRequests")
                .whereField("trainerId", isEqualTo: user.id)
        case .client, .reserve:
            sessionsQuery = database.collection("sessions")
                .whereField("clientId", isEqualTo: user.id)
            bookingsQuery = database.collection("bookingRequests")
                .whereField("clientId", isEqualTo: user.id)
        }

        dataListeners.append(
            sessionsQuery.addSnapshotListener { [weak self] snapshot, _ in
                let values = snapshot?.documents.compactMap {
                    self?.session(from: $0)
                } ?? []
                Task { @MainActor in self?.sessions = values }
            }
        )
        dataListeners.append(
            bookingsQuery.addSnapshotListener { [weak self] snapshot, _ in
                let values = snapshot?.documents.compactMap {
                    self?.booking(from: $0)
                } ?? []
                Task { @MainActor in self?.bookings = values }
            }
        )
        dataListeners.append(
            database.collection("occupancy")
                .addSnapshotListener { [weak self] snapshot, _ in
                    let values = snapshot?.documents.compactMap {
                        self?.occupiedSlot(from: $0)
                    } ?? []
                    Task { @MainActor in self?.occupiedSlots = values }
                }
        )
        dataListeners.append(
            database.collection("rooms")
                .whereField("status", isEqualTo: "active")
                .addSnapshotListener { [weak self] snapshot, _ in
                    let values = snapshot?.documents.compactMap {
                        self?.room(from: $0)
                    } ?? []
                    guard !values.isEmpty else { return }
                    Task { @MainActor in
                        self?.rooms = values.sorted {
                            $0.name.localizedCaseInsensitiveCompare($1.name)
                                == .orderedAscending
                        }
                    }
            }
        )
        dataListeners.append(
            database.collection("staffDirectory")
                .whereField("status", isEqualTo: "active")
                .addSnapshotListener { [weak self] snapshot, _ in
                    let people = snapshot?.documents.compactMap {
                        self?.staffMember(from: $0)
                    } ?? []
                    Task { @MainActor in
                        self?.staff = people.sorted {
                            $0.name.localizedCaseInsensitiveCompare($1.name)
                                == .orderedAscending
                        }
                    }
                }
        )

        switch user.role {
        case .boss:
            dataListeners.append(
                database.collection("users")
                    .whereField("role", in: [
                        UserRole.client.rawValue,
                        UserRole.reserve.rawValue,
                    ])
                    .addSnapshotListener { [weak self] snapshot, _ in
                        let people = snapshot?.documents.compactMap {
                            self?.user(from: $0)
                        } ?? []
                        Task { @MainActor in
                            guard let self else { return }
                            self.managedUsers = people.sorted {
                                $0.name.localizedCaseInsensitiveCompare($1.name)
                                    == .orderedAscending
                            }
                            if user.isTrainer {
                                self.listenToSharedCycles(for: people)
                            }
                        }
                    }
            )
            dataListeners.append(
                database.collection("users")
                    .whereField("isTrainer", isEqualTo: true)
                    .addSnapshotListener { [weak self] snapshot, _ in
                        let people = snapshot?.documents.compactMap {
                            self?.user(from: $0)
                        } ?? []
                        Task { @MainActor in
                            self?.trainers = people.sorted {
                                $0.name.localizedCaseInsensitiveCompare($1.name)
                                    == .orderedAscending
                            }
                        }
                    }
            )
        case .trainer:
            trainers = [user]
            dataListeners.append(
                database.collection("users")
                    .whereField("trainerIds", arrayContains: user.id)
                    .addSnapshotListener { [weak self] snapshot, _ in
                        let people = snapshot?.documents.compactMap {
                            self?.user(from: $0)
                        } ?? []
                        Task { @MainActor in
                            guard let self else { return }
                            self.managedUsers = people
                            self.listenToSharedCycles(for: people)
                        }
                    }
            )
        case .client:
            for trainerId in user.trainerIds {
                dataListeners.append(
                    database.collection("users").document(trainerId)
                        .addSnapshotListener { [weak self] snapshot, _ in
                            guard let self, let snapshot,
                                  let trainer = self.user(from: snapshot)
                            else { return }
                            Task { @MainActor in
                                if let index = self.trainers.firstIndex(
                                    where: { $0.id == trainer.id }
                                ) {
                                    self.trainers[index] = trainer
                                } else {
                                    self.trainers.append(trainer)
                                }
                            }
                        }
                )
            }
            dataListeners.append(
                profileReference.collection("cycleEntries")
                    .addSnapshotListener { [weak self] snapshot, _ in
                        let values = snapshot?.documents.reduce(
                            into: [String: CycleEntry]()
                        ) { result, document in
                            if let entry = self?.cycleEntry(from: document) {
                                result[document.documentID] = entry
                            }
                        } ?? [:]
                        Task { @MainActor in self?.cycleEntries = values }
                    }
            )
            dataListeners.append(
                database.collection("chats").document(user.id)
                    .collection("messages")
                    .order(by: "timestamp")
                    .addSnapshotListener { [weak self] snapshot, _ in
                        let values = snapshot?.documents.compactMap {
                            self?.chatMessage(from: $0, currentUserId: user.id)
                        } ?? []
                        Task { @MainActor in self?.messages = values }
                    }
            )
        case .reserve:
            break
        }
    }

    private func listenToSharedCycles(for clients: [AppUser]) {
        managedCycleListeners.forEach { $0.remove() }
        managedCycleListeners.removeAll()
        clientCycleSummaries = [:]
        let database = Firestore.firestore()
        guard let viewer = currentUser, viewer.isTrainer else { return }
        for client in clients where
            client.role == .client &&
            client.cycleTrackingEnabled &&
            client.cycleSharingEnabled &&
            client.trainerIds.contains(viewer.id)
        {
            let listener = database.collection("users").document(client.id)
                .collection("cycleSummaries")
                .order(by: "date", descending: true)
                .limit(to: 1)
                .addSnapshotListener { [weak self] snapshot, _ in
                    guard let document = snapshot?.documents.first,
                          let entry = self?.cycleEntry(from: document)
                    else { return }
                    Task { @MainActor in
                        self?.clientCycleSummaries[client.id] = entry
                    }
                }
            managedCycleListeners.append(listener)
        }
    }

    private func user(from document: DocumentSnapshot) -> AppUser? {
        guard let data = document.data(),
              let rawRole = data["role"] as? String,
              let role = UserRole(rawValue: rawRole)
        else { return nil }
        let trainerIds =
            (data["trainerIds"] as? [String]) ??
            (data["trainerId"] as? String).map { [$0] } ??
            []
        return AppUser(
            id: document.documentID,
            email: (data["email"] as? String) ?? "",
            name: (data["name"] as? String) ?? "Usuario Activate",
            role: role,
            trainerIds: trainerIds,
            phone: (data["phone"] as? String) ?? "",
            dni: (data["dni"] as? String) ?? "",
            trainerStaffIds: (data["trainerStaffIds"] as? [String]) ?? [],
            isTrainer:
                (data["isTrainer"] as? Bool) ?? (role == .trainer),
            isMinor: (data["isMinor"] as? Bool) ?? false,
            guardianName: data["guardianName"] as? String,
            termsAccepted: (data["termsAccepted"] as? Bool) ?? false,
            imageConsent: (data["imageConsent"] as? Bool) ?? false,
            cycleTrackingEnabled:
                (data["cycleTrackingEnabled"] as? Bool) ?? false,
            cycleSharingEnabled:
                (data["cycleSharingEnabled"] as? Bool) ?? false,
            packName: (data["packName"] as? String) ?? "Bono",
            packTotalSessions: (data["packTotalSessions"] as? Int) ?? 0,
            usedSessions: (data["usedSessions"] as? Int) ?? 0,
            reservedSessions: (data["reservedSessions"] as? Int) ?? 0,
            remainingSessions: (data["remainingSessions"] as? Int) ?? 0,
            sessionDuration: (data["sessionDuration"] as? Int) ?? 45
        )
    }

    private func room(from document: QueryDocumentSnapshot) -> GymRoom? {
        let data = document.data()
        guard let name = data["name"] as? String else { return nil }
        let rawType = data["type"] as? String
        let type = rawType == "physiotherapy_and_rental"
            ? "Fisioterapia y reservas"
            : "Entrenamiento y reservas"
        return GymRoom(
            id: document.documentID,
            name: name,
            type: type,
            reserved: 0,
            capacity: (data["capacity"] as? Int) ?? 1,
            nextTrainer: "",
            nextTime: "Consultar calendario"
        )
    }

    private func staffMember(
        from document: QueryDocumentSnapshot
    ) -> StaffMember? {
        let data = document.data()
        guard let name = data["name"] as? String,
              let rawKind = data["kind"] as? String
        else { return nil }
        let kind: StaffKind
        switch rawKind {
        case "trainer": kind = .trainer
        case "physiotherapist": kind = .physiotherapist
        case "room_rental": kind = .roomRental
        case "physio_room_rental": kind = .physioRoomRental
        default: return nil
        }
        return StaffMember(
            id: document.documentID,
            name: name,
            kind: kind,
            authUid: data["authUid"] as? String,
            email: (data["email"] as? String) ?? ""
        )
    }

    private func session(from document: QueryDocumentSnapshot) -> GymSession? {
        let data = document.data()
        guard let date = date(from: data["date"]),
              let statusRaw = data["status"] as? String,
              let status = SessionStatus(rawValue: statusRaw)
        else { return nil }
        return GymSession(
            id: document.documentID,
            date: date,
            time: (data["time"] as? String) ?? "00:00",
            duration: (data["duration"] as? Int) ?? 45,
            clientId: (data["clientId"] as? String) ?? "",
            clientName: (data["clientName"] as? String) ?? "Usuario",
            trainerId: (data["trainerId"] as? String) ?? "",
            trainerName: (data["trainerName"] as? String) ?? "Dirección",
            type: (data["type"] as? String) ?? "Sesión",
            room: (data["room"] as? String) ?? "Sala de arriba",
            status: status,
            trainerNotes: data["trainerNotes"] as? String,
            feedback: data["feedback"] as? String,
            packSessionNumber: data["packSessionNumber"] as? Int,
            packTotalSessions: data["packTotalSessions"] as? Int
        )
    }

    private func booking(from document: QueryDocumentSnapshot) -> BookingRequest? {
        let data = document.data()
        guard let date = date(from: data["requestedDate"]),
              let statusRaw = data["status"] as? String,
              let status = BookingStatus(rawValue: statusRaw)
        else { return nil }
        return BookingRequest(
            id: document.documentID,
            clientId: (data["clientId"] as? String) ?? "",
            clientName: (data["clientName"] as? String) ?? "Usuario",
            trainerId: (data["trainerId"] as? String) ?? "",
            trainerName: (data["trainerName"] as? String) ?? "Dirección",
            kind: BookingKind(
                rawValue: (data["kind"] as? String) ?? "training"
            ) ?? .training,
            requestedDate: date,
            requestedTime: data["requestedTime"] as? String,
            type: (data["type"] as? String) ?? "Sesión",
            duration: (data["duration"] as? Int) ?? 45,
            room: data["room"] as? String,
            status: status,
            proposedTime: data["proposedTime"] as? String,
            finalTime: data["finalTime"] as? String,
            trainerNotes: data["trainerNotes"] as? String,
            bossNotes: data["bossNotes"] as? String
        )
    }

    private func occupiedSlot(
        from document: QueryDocumentSnapshot
    ) -> OccupiedSlot? {
        let data = document.data()
        guard let date = date(from: data["date"]) else { return nil }
        return OccupiedSlot(
            id: document.documentID,
            date: date,
            time: (data["time"] as? String) ?? "00:00",
            duration: (data["duration"] as? Int) ?? 45,
            room: (data["room"] as? String) ?? "",
            trainerId: data["trainerId"] as? String
        )
    }

    private func chatMessage(
        from document: QueryDocumentSnapshot,
        currentUserId: String
    ) -> ChatMessage? {
        let data = document.data()
        guard let text = data["text"] as? String,
              let authorId = data["authorId"] as? String
        else { return nil }
        return ChatMessage(
            id: document.documentID,
            author: authorId == currentUserId ? .user : .trainer,
            text: text,
            timestamp: (data["timestamp"] as? Timestamp)?.dateValue() ?? .now,
            isRead: (data["isRead"] as? Bool) ?? false
        )
    }

    private func cycleEntry(
        from document: QueryDocumentSnapshot
    ) -> CycleEntry? {
        let data = document.data()
        guard let rawFlow = data["flow"] as? String,
              let flow = CycleFlow(rawValue: rawFlow)
        else { return nil }
        return CycleEntry(
            flow: flow,
            symptoms: Set((data["symptoms"] as? [String]) ?? []),
            mood: (data["mood"] as? String) ?? "🙂",
            notes: (data["notes"] as? String) ?? ""
        )
    }

    private func date(from value: Any?) -> Date? {
        if let timestamp = value as? Timestamp {
            return timestamp.dateValue()
        }
        guard let value = value as? String else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }

    private func minutes(from time: String) -> Int {
        let components = time.split(separator: ":").compactMap { Int($0) }
        guard components.count == 2 else { return 0 }
        return components[0] * 60 + components[1]
    }
}
