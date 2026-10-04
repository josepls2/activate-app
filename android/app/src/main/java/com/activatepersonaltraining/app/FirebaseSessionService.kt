package com.activatepersonaltraining.app

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

data class UserSession(
    val uid: String,
    val email: String,
    val name: String,
    val role: Role,
    val isTrainer: Boolean,
    val cycleTrackingEnabled: Boolean,
    val trainerIds: List<String>,
    val termsAccepted: Boolean,
    val isMinor: Boolean,
    val guardianName: String?,
    val packName: String,
    val packTotalSessions: Int,
    val usedSessions: Int,
    val reservedSessions: Int,
    val remainingSessions: Int,
    val packDuration: Int,
)

class FirebaseSessionService(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    fun restore(onResult: (Result<UserSession?>) -> Unit) {
        val user = auth.currentUser
        if (user == null) {
            onResult(Result.success(null))
            return
        }
        loadProfile(user.uid, user.email.orEmpty()) { result ->
            if (result.isFailure) auth.signOut()
            onResult(result.map { it })
        }
    }

    fun signIn(
        email: String,
        password: String,
        onResult: (Result<UserSession>) -> Unit,
    ) {
        auth.signInWithEmailAndPassword(email.trim().lowercase(), password)
            .addOnSuccessListener { authResult ->
                val user = authResult.user
                if (user == null) {
                    auth.signOut()
                    onResult(Result.failure(IllegalStateException("No se pudo abrir la cuenta.")))
                    return@addOnSuccessListener
                }
                loadProfile(user.uid, user.email.orEmpty()) { result ->
                    if (result.isFailure) auth.signOut()
                    onResult(result)
                }
            }
            .addOnFailureListener { onResult(Result.failure(it)) }
    }

    fun signOut() {
        auth.signOut()
    }

    private fun loadProfile(
        uid: String,
        fallbackEmail: String,
        onResult: (Result<UserSession>) -> Unit,
    ) {
        firestore.collection("users").document(uid).get()
            .addOnSuccessListener { snapshot ->
                val role = snapshot.getString("role")?.let(::roleFromFirebase)
                if (!snapshot.exists() || role == null) {
                    onResult(
                        Result.failure(
                            IllegalStateException(
                                "Esta cuenta todavía no tiene un perfil de Activate.",
                            ),
                        ),
                    )
                    return@addOnSuccessListener
                }
                onResult(
                    Result.success(
                        UserSession(
                            uid = uid,
                            email = snapshot.getString("email") ?: fallbackEmail,
                            name = snapshot.getString("name") ?: "Usuario Activate",
                            role = role,
                            isTrainer =
                                snapshot.getBoolean("isTrainer") ?: (role == Role.TRAINER),
                            cycleTrackingEnabled =
                                snapshot.getBoolean("cycleTrackingEnabled") ?: false,
                            trainerIds = snapshot.get("trainerIds") as? List<String>
                                ?: emptyList(),
                            termsAccepted = snapshot.getBoolean("termsAccepted") ?: false,
                            isMinor = snapshot.getBoolean("isMinor") ?: false,
                            guardianName = snapshot.getString("guardianName"),
                            packName = snapshot.getString("packName") ?: "Bono",
                            packTotalSessions =
                                snapshot.getLong("packTotalSessions")?.toInt() ?: 0,
                            usedSessions = snapshot.getLong("usedSessions")?.toInt() ?: 0,
                            reservedSessions =
                                snapshot.getLong("reservedSessions")?.toInt() ?: 0,
                            remainingSessions =
                                snapshot.getLong("remainingSessions")?.toInt() ?: 0,
                            packDuration =
                                snapshot.getLong("sessionDuration")?.toInt() ?: 45,
                        ),
                    ),
                )
            }
            .addOnFailureListener { onResult(Result.failure(it)) }
    }

    private fun roleFromFirebase(value: String): Role? = when (value) {
        "client" -> Role.CLIENT
        "trainer" -> Role.TRAINER
        "boss" -> Role.BOSS
        "reserve" -> Role.RESERVE
        else -> null
    }
}
