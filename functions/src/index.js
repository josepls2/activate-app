"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const {
  BOOKING_STATES,
  ROLES,
  SESSION_STATES,
  assertBookingTransition,
  assertRole,
  faqReply,
  optionalString,
  requireString,
  sessionsOverlap,
  validateAdminClientInput,
  validateAdminRoomUserInput,
  validateBoolean,
  validateBookingInput,
  validateDate,
  validateDuration,
  validatePackIncrement,
  validateRoomBookingInput,
  validateRoom,
  validateTime,
} = require("./domain");

admin.initializeApp();
const db = admin.firestore();
const timestamp = admin.firestore.FieldValue.serverTimestamp;
const FUNCTIONS_REGION = "europe-southwest1";

function authenticatedUid(request) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  return uid;
}

async function currentUser(request) {
  const uid = authenticatedUid(request);
  const snapshot = await db.collection("users").doc(uid).get();
  if (!snapshot.exists) {
    throw new HttpsError("failed-precondition", "El perfil del usuario no existe.");
  }
  return { uid, ...snapshot.data() };
}

function authorizeRole(actual, allowed) {
  try {
    assertRole(actual, allowed);
  } catch {
    throw new HttpsError(
      "permission-denied",
      "No tienes permisos para realizar esta acción.",
    );
  }
}

function isTrainerProfile(profile) {
  return profile?.role === ROLES.TRAINER || profile?.isTrainer === true;
}

function callableError(error) {
  if (error instanceof HttpsError) return error;
  logger.warn("Callable validation failed", { message: error.message });
  return new HttpsError("invalid-argument", error.message);
}

function audit(transaction, data, request) {
  const reference = db.collection("activityLogs").doc();
  transaction.set(reference, {
    ...data,
    timestamp: timestamp(),
    ipAddress: request.rawRequest?.ip ?? null,
    userAgent: request.rawRequest?.get("user-agent") ?? null,
  });
}

exports.adminCreateClient = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    let createdUser = null;
    try {
      const operator = await currentUser(request);
      authorizeRole(operator.role, [ROLES.BOSS]);
      const input = validateAdminClientInput(request.data ?? {});

      const trainerSnapshots = await Promise.all(
        input.trainerIds.map((trainerId) =>
          db.collection("users").doc(trainerId).get()),
      );
      if (trainerSnapshots.some(
        (snapshot) =>
          !snapshot.exists || !isTrainerProfile(snapshot.data()),
      )) {
        throw new HttpsError("not-found", "Algún entrenador no existe.");
      }
      const trainerNames = trainerSnapshots.map(
        (snapshot) => snapshot.data().name,
      );

      try {
        createdUser = await admin.auth().createUser({
          email: input.email,
          displayName: input.name,
          disabled: false,
          emailVerified: false,
        });
      } catch (error) {
        if (error.code === "auth/email-already-exists") {
          throw new HttpsError(
            "already-exists",
            "Ya existe una cuenta con este email.",
          );
        }
        throw error;
      }

      await admin.auth().setCustomUserClaims(createdUser.uid, {
        role: ROLES.CLIENT,
      });
      const setupLink = await admin.auth().generatePasswordResetLink(input.email);
      const reference = db.collection("users").doc(createdUser.uid);

      await db.runTransaction(async (transaction) => {
        transaction.create(reference, {
          uid: createdUser.uid,
          email: input.email,
          name: input.name,
          phone: input.phone,
          role: ROLES.CLIENT,
          trainerIds: input.trainerIds,
          trainerNames,
          sessionDuration: input.sessionDuration,
          packId: `initial-${createdUser.uid}`,
          packName: input.packName,
          packTotalSessions: input.packTotalSessions,
          usedSessions: 0,
          remainingSessions: input.packTotalSessions,
          isMinor: input.isMinor,
          guardianName: input.guardianName,
          guardianEmail: input.guardianEmail,
          termsAccepted: input.termsAccepted,
          termsAcceptedAt: input.termsAccepted ? timestamp() : null,
          termsVersion: input.termsAccepted ? "pilot-v1" : null,
          imageConsent: input.imageConsent,
          cycleTrackingEnabled: input.cycleTrackingEnabled,
          cycleSharingEnabled: false,
          status: "active",
          createdAt: timestamp(),
          modifiedAt: timestamp(),
          createdBy: operator.uid,
        });
        audit(transaction, {
          uid: operator.uid,
          action: "admin_create_client",
          resourceId: createdUser.uid,
          changes: {
            email: input.email,
            trainerIds: input.trainerIds,
            packName: input.packName,
            packTotalSessions: input.packTotalSessions,
            sessionDuration: input.sessionDuration,
            isMinor: input.isMinor,
            cycleTrackingEnabled: input.cycleTrackingEnabled,
          },
        }, request);
      });

      return {
        uid: createdUser.uid,
        email: input.email,
        setupLink,
      };
    } catch (error) {
      if (createdUser) {
        try {
          await admin.auth().deleteUser(createdUser.uid);
        } catch (cleanupError) {
          logger.error("Could not rollback Auth user", {
            uid: createdUser.uid,
            message: cleanupError.message,
          });
        }
      }
      throw callableError(error);
    }
  },
);

exports.adminCreateRoomUser = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    let createdUser = null;
    try {
      const operator = await currentUser(request);
      authorizeRole(operator.role, [ROLES.BOSS]);
      const input = validateAdminRoomUserInput(request.data ?? {});

      try {
        createdUser = await admin.auth().createUser({
          email: input.email,
          displayName: input.name,
          disabled: false,
          emailVerified: false,
        });
      } catch (error) {
        if (error.code === "auth/email-already-exists") {
          throw new HttpsError(
            "already-exists",
            "Ya existe una cuenta con este email.",
          );
        }
        throw error;
      }

      await admin.auth().setCustomUserClaims(createdUser.uid, {
        role: ROLES.RESERVE,
      });
      const setupLink = await admin.auth().generatePasswordResetLink(input.email);
      const reference = db.collection("users").doc(createdUser.uid);

      await db.runTransaction(async (transaction) => {
        transaction.create(reference, {
          uid: createdUser.uid,
          email: input.email,
          name: input.name,
          phone: input.phone,
          role: ROLES.RESERVE,
          isTrainer: false,
          trainerIds: [],
          sessionDuration: input.sessionDuration,
          packId: `initial-${createdUser.uid}`,
          packName: input.packName,
          packTotalSessions: input.packTotalSessions,
          usedSessions: 0,
          remainingSessions: input.packTotalSessions,
          termsAccepted: input.termsAccepted,
          termsAcceptedAt: input.termsAccepted ? timestamp() : null,
          termsVersion: input.termsAccepted ? "pilot-v1" : null,
          imageConsent: false,
          cycleTrackingEnabled: false,
          cycleSharingEnabled: false,
          status: "active",
          createdAt: timestamp(),
          modifiedAt: timestamp(),
          createdBy: operator.uid,
        });
        audit(transaction, {
          uid: operator.uid,
          action: "admin_create_room_user",
          resourceId: createdUser.uid,
          changes: {
            email: input.email,
            packName: input.packName,
            packTotalSessions: input.packTotalSessions,
            sessionDuration: input.sessionDuration,
          },
        }, request);
      });

      return {
        uid: createdUser.uid,
        email: input.email,
        setupLink,
      };
    } catch (error) {
      if (createdUser) {
        try {
          await admin.auth().deleteUser(createdUser.uid);
        } catch (cleanupError) {
          logger.error("Could not rollback Auth room user", {
            uid: createdUser.uid,
            message: cleanupError.message,
          });
        }
      }
      throw callableError(error);
    }
  },
);

exports.adminAddPackSessions = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      const operator = await currentUser(request);
      authorizeRole(operator.role, [ROLES.BOSS]);
      const input = validatePackIncrement(request.data ?? {});
      const reference = db.collection("users").doc(input.clientId);
      let result;

      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (
          !snapshot.exists ||
          ![ROLES.CLIENT, ROLES.RESERVE].includes(snapshot.data().role)
        ) {
          throw new HttpsError("not-found", "El usuario no existe.");
        }

        const client = snapshot.data();
        const currentTotal = Number(client.packTotalSessions ?? 0);
        const usedSessions = Number(client.usedSessions ?? 0);
        const remainingSessions = Math.max(0, currentTotal - usedSessions);
        if (
          remainingSessions > 0 &&
          Number(client.sessionDuration) !== input.sessionDuration
        ) {
          throw new HttpsError(
            "failed-precondition",
            "No se puede cambiar la duración mientras queden sesiones del pack actual.",
          );
        }

        const packTotalSessions = currentTotal + input.sessionsToAdd;
        const newRemainingSessions = Math.max(
          0,
          packTotalSessions - usedSessions,
        );
        transaction.update(reference, {
          packName: input.packName,
          packTotalSessions,
          remainingSessions: newRemainingSessions,
          sessionDuration: input.sessionDuration,
          modifiedAt: timestamp(),
          modifiedBy: operator.uid,
        });
        audit(transaction, {
          uid: operator.uid,
          action: "admin_add_pack_sessions",
          resourceId: input.clientId,
          changes: {
            sessionsToAdd: input.sessionsToAdd,
            packName: input.packName,
            sessionDuration: input.sessionDuration,
            previousTotal: currentTotal,
            packTotalSessions,
          },
        }, request);
        result = {
          packTotalSessions,
          remainingSessions: newRemainingSessions,
        };
      });

      return result;
    } catch (error) {
      throw callableError(error);
    }
  },
);

exports.acceptTerms = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    const user = await currentUser(request);
    authorizeRole(user.role, [ROLES.CLIENT, ROLES.RESERVE]);
    const termsAccepted = validateBoolean(
      request.data?.termsAccepted,
      "termsAccepted",
    );
    const imageConsent = validateBoolean(
      request.data?.imageConsent,
      "imageConsent",
    );
    if (!termsAccepted) {
      throw new HttpsError(
        "invalid-argument",
        "Debes aceptar los términos para continuar.",
      );
    }
    const reference = db.collection("users").doc(user.uid);
    await db.runTransaction(async (transaction) => {
      transaction.update(reference, {
        termsAccepted: true,
        termsAcceptedAt: timestamp(),
        termsVersion: "pilot-v1",
        imageConsent,
        imageConsentAt: timestamp(),
        modifiedAt: timestamp(),
      });
      audit(transaction, {
        uid: user.uid,
        action: "accept_terms",
        resourceId: user.uid,
        changes: { termsVersion: "pilot-v1", imageConsent },
      }, request);
    });
    return { termsAccepted: true, imageConsent };
  } catch (error) {
    throw callableError(error);
  }
});

exports.createBooking = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    const user = await currentUser(request);
    authorizeRole(user.role, [ROLES.CLIENT]);
    const input = validateBookingInput(request.data ?? {});
    const duration = validateDuration(user.sessionDuration);
    if (user.termsAccepted !== true) {
      throw new HttpsError(
        "failed-precondition",
        "Debes aceptar los términos antes de solicitar una sesión.",
      );
    }
    if (user.isMinor === true && !user.guardianName) {
      throw new HttpsError(
        "failed-precondition",
        "La cuenta de un menor necesita un responsable legal.",
      );
    }
    if (Number(user.remainingSessions ?? 0) <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "El pack no tiene sesiones disponibles.",
      );
    }

    const assignedTrainerIds = Array.isArray(user.trainerIds)
      ? user.trainerIds
      : (user.trainerId ? [user.trainerId] : []);
    if (!assignedTrainerIds.includes(input.trainerId)) {
      throw new HttpsError(
        "permission-denied",
        "Solo puedes reservar con uno de tus entrenadores asignados.",
      );
    }

    const trainer = await db.collection("users").doc(input.trainerId).get();
    if (!trainer.exists || !isTrainerProfile(trainer.data())) {
      throw new HttpsError("not-found", "El entrenador no existe.");
    }

    const reference = db.collection("bookingRequests").doc();
    await db.runTransaction(async (transaction) => {
      transaction.create(reference, {
        clientId: user.uid,
        clientName: user.name,
        trainerId: input.trainerId,
        trainerName: trainer.data().name,
        kind: "training",
        requestedDate: input.requestedDate,
        requestedTime: input.requestedTime,
        type: input.type,
        duration,
        room: input.room,
        status: BOOKING_STATES.PENDING_TRAINER,
        proposedTime: input.requestedTime,
        finalTime: null,
        trainerNotes: null,
        bossNotes: null,
        createdAt: timestamp(),
        modifiedAt: timestamp(),
      });
      audit(transaction, {
        uid: user.uid,
        action: "create_booking",
        resourceId: reference.id,
        changes: input,
      }, request);
    });

    return { id: reference.id, status: BOOKING_STATES.PENDING_TRAINER };
  } catch (error) {
    throw callableError(error);
  }
});

exports.createRoomBooking = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      const user = await currentUser(request);
      authorizeRole(user.role, [ROLES.RESERVE]);
      const input = validateRoomBookingInput(request.data ?? {});
      const duration = validateDuration(user.sessionDuration);
      if (user.termsAccepted !== true) {
        throw new HttpsError(
          "failed-precondition",
          "Debes aceptar los términos antes de reservar.",
        );
      }
      if (Number(user.remainingSessions ?? 0) <= 0) {
        throw new HttpsError(
          "failed-precondition",
          "El bono de sala no tiene sesiones disponibles.",
        );
      }

      const reference = db.collection("bookingRequests").doc();
      await db.runTransaction(async (transaction) => {
        transaction.create(reference, {
          clientId: user.uid,
          clientName: user.name,
          trainerId: "",
          trainerName: "Dirección",
          kind: "room_rental",
          requestedDate: input.requestedDate,
          requestedTime: input.requestedTime,
          type: "Uso de sala",
          duration,
          room: input.room,
          status: BOOKING_STATES.PENDING_BOSS,
          proposedTime: input.requestedTime,
          finalTime: null,
          trainerNotes: null,
          bossNotes: null,
          createdAt: timestamp(),
          modifiedAt: timestamp(),
        });
        audit(transaction, {
          uid: user.uid,
          action: "create_room_booking",
          resourceId: reference.id,
          changes: input,
        }, request);
      });
      return { id: reference.id, status: BOOKING_STATES.PENDING_BOSS };
    } catch (error) {
      throw callableError(error);
    }
  },
);

exports.confirmTrainingBooking = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      const user = await currentUser(request);
      authorizeRole(user.role, [ROLES.TRAINER, ROLES.BOSS]);
      const bookingId = requireString(request.data?.bookingId, "bookingId", {
        max: 128,
      });
      const finalTime = validateTime(request.data?.finalTime);
      const room = validateRoom(request.data?.room);
      const trainerNotes = optionalString(
        request.data?.trainerNotes,
        "trainerNotes",
      );
      const bookingReference = db.collection("bookingRequests").doc(bookingId);
      const sessionReference = db.collection("sessions").doc();
      const occupancyReference = db
        .collection("occupancy")
        .doc(sessionReference.id);

      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(bookingReference);
        if (!snapshot.exists) {
          throw new HttpsError("not-found", "La solicitud no existe.");
        }
        const booking = snapshot.data();
        if (booking.kind === "room_rental") {
          throw new HttpsError(
            "failed-precondition",
            "Las reservas de sala las confirma Dirección.",
          );
        }
        if (user.role === ROLES.TRAINER && booking.trainerId !== user.uid) {
          throw new HttpsError(
            "permission-denied",
            "La solicitud pertenece a otro entrenador.",
          );
        }
        assertBookingTransition(booking.status, BOOKING_STATES.CONFIRMED);
        const duration = validateDuration(booking.duration);
        const daySessions = await transaction.get(
          db
            .collection("sessions")
            .where("date", "==", booking.requestedDate)
            .where("status", "==", SESSION_STATES.CONFIRMED),
        );
        const candidate = { time: finalTime, duration };
        const conflict = daySessions.docs
          .map((document) => document.data())
          .find(
            (session) =>
              (session.trainerId === booking.trainerId ||
                session.room === room) &&
              sessionsOverlap(session, candidate),
          );
        if (conflict) {
          throw new HttpsError(
            "already-exists",
            conflict.trainerId === booking.trainerId
              ? "El entrenador ya está ocupado en esa franja."
              : "La sala ya está ocupada en esa franja.",
          );
        }

        const clientReference = db.collection("users").doc(booking.clientId);
        const clientSnapshot = await transaction.get(clientReference);
        if (!clientSnapshot.exists) {
          throw new HttpsError("not-found", "El cliente no existe.");
        }
        const client = clientSnapshot.data();
        const packTotalSessions = Number(client.packTotalSessions ?? 0);
        const packSessionNumber = Number(client.usedSessions ?? 0) + 1;

        transaction.update(bookingReference, {
          status: BOOKING_STATES.CONFIRMED,
          finalTime,
          room,
          trainerNotes,
          sessionId: sessionReference.id,
          modifiedAt: timestamp(),
        });
        transaction.create(sessionReference, {
          bookingRequestId: bookingId,
          kind: "training",
          clientId: booking.clientId,
          clientName: booking.clientName,
          trainerId: booking.trainerId,
          trainerName: booking.trainerName,
          date: booking.requestedDate,
          time: finalTime,
          duration,
          room,
          type: booking.type,
          status: SESSION_STATES.CONFIRMED,
          trainerNotes,
          feedback: null,
          packSessionNumber,
          packTotalSessions,
          createdAt: timestamp(),
          modifiedAt: timestamp(),
          modifiedBy: user.uid,
        });
        transaction.create(occupancyReference, {
          sessionId: sessionReference.id,
          kind: "training",
          date: booking.requestedDate,
          time: finalTime,
          duration,
          room,
          trainerId: booking.trainerId,
          createdAt: timestamp(),
        });
        audit(transaction, {
          uid: user.uid,
          action: "confirm_training_booking",
          resourceId: bookingId,
          changes: {
            finalTime,
            room,
            trainerNotes,
            sessionId: sessionReference.id,
          },
        }, request);
      });
      return {
        status: BOOKING_STATES.CONFIRMED,
        sessionId: sessionReference.id,
      };
    } catch (error) {
      throw callableError(error);
    }
  },
);

exports.confirmRoomBooking = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    const user = await currentUser(request);
    authorizeRole(user.role, [ROLES.BOSS]);
    const bookingId = requireString(request.data?.bookingId, "bookingId", {
      max: 128,
    });
    const finalTime = validateTime(request.data?.finalTime);
    const room = validateRoom(request.data?.room);
    const bossNotes = optionalString(request.data?.bossNotes, "bossNotes");
    const bookingReference = db.collection("bookingRequests").doc(bookingId);
    const sessionReference = db.collection("sessions").doc();
    const occupancyReference = db
      .collection("occupancy")
      .doc(sessionReference.id);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(bookingReference);
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "La solicitud no existe.");
      }
      const booking = snapshot.data();
      if (booking.kind !== "room_rental") {
        throw new HttpsError(
          "failed-precondition",
          "Esta solicitud debe confirmarla el entrenador asignado.",
        );
      }
      assertBookingTransition(booking.status, BOOKING_STATES.CONFIRMED);
      const duration = validateDuration(booking.duration);

      const daySessions = await transaction.get(
        db
          .collection("sessions")
          .where("date", "==", booking.requestedDate)
          .where("status", "==", SESSION_STATES.CONFIRMED),
      );
      const candidate = { time: finalTime, duration };
      const conflict = daySessions.docs
        .map((document) => document.data())
        .find(
          (session) =>
            session.room === room && sessionsOverlap(session, candidate),
        );
      if (conflict) {
        throw new HttpsError(
          "already-exists",
          "La sala ya está ocupada en esa franja.",
        );
      }
      const clientReference = db.collection("users").doc(booking.clientId);
      const clientSnapshot = await transaction.get(clientReference);
      if (!clientSnapshot.exists) {
        throw new HttpsError("not-found", "El cliente no existe.");
      }
      const client = clientSnapshot.data();
      const packTotalSessions = Number(client.packTotalSessions ?? 0);
      const usedSessions = Number(client.usedSessions ?? 0);
      if (usedSessions >= packTotalSessions) {
        throw new HttpsError(
          "failed-precondition",
          "El bono de sala no tiene sesiones disponibles.",
        );
      }
      const packSessionNumber = usedSessions + 1;

      transaction.update(bookingReference, {
        status: BOOKING_STATES.CONFIRMED,
        finalTime,
        bossNotes,
        sessionId: sessionReference.id,
        modifiedAt: timestamp(),
      });
      transaction.create(sessionReference, {
        bookingRequestId: bookingId,
        kind: "room_rental",
        clientId: booking.clientId,
        clientName: booking.clientName,
        trainerId: booking.trainerId,
        trainerName: booking.trainerName,
        date: booking.requestedDate,
        time: finalTime,
        duration,
        room,
        type: booking.type,
        status: SESSION_STATES.CONFIRMED,
        trainerNotes: null,
        feedback: null,
        packSessionNumber,
        packTotalSessions,
        createdAt: timestamp(),
        modifiedAt: timestamp(),
        modifiedBy: user.uid,
      });
      transaction.update(clientReference, {
        usedSessions: usedSessions + 1,
        remainingSessions: Math.max(0, packTotalSessions - usedSessions - 1),
        modifiedAt: timestamp(),
        modifiedBy: user.uid,
      });
      transaction.create(occupancyReference, {
        sessionId: sessionReference.id,
        kind: "room_rental",
        date: booking.requestedDate,
        time: finalTime,
        duration,
        room,
        trainerId: null,
        createdAt: timestamp(),
      });
      audit(transaction, {
        uid: user.uid,
        action: "confirm_room_booking",
        resourceId: bookingId,
        changes: { finalTime, room, sessionId: sessionReference.id },
      }, request);
    });

    return {
      status: BOOKING_STATES.CONFIRMED,
      sessionId: sessionReference.id,
    };
  } catch (error) {
    throw callableError(error);
  }
});

exports.rejectBooking = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    const user = await currentUser(request);
    authorizeRole(user.role, [ROLES.BOSS, ROLES.TRAINER]);
    const bookingId = requireString(request.data?.bookingId, "bookingId", {
      max: 128,
    });
    const reason = requireString(
      request.data?.reason ?? request.data?.bossNotes,
      "reason",
      { max: 500 },
    );
    const reference = db.collection("bookingRequests").doc(bookingId);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "La solicitud no existe.");
      }
      const booking = snapshot.data();
      if (
        user.role === ROLES.TRAINER &&
        (booking.trainerId !== user.uid || booking.kind === "room_rental")
      ) {
        throw new HttpsError(
          "permission-denied",
          "La solicitud pertenece a otro entrenador.",
        );
      }
      assertBookingTransition(booking.status, BOOKING_STATES.REJECTED);
      transaction.update(reference, {
        status: BOOKING_STATES.REJECTED,
        rejectionReason: reason,
        modifiedAt: timestamp(),
      });
      audit(transaction, {
        uid: user.uid,
        action: "reject_booking",
        resourceId: bookingId,
        changes: { reason },
      }, request);
    });
    return { status: BOOKING_STATES.REJECTED };
  } catch (error) {
    throw callableError(error);
  }
});

exports.completeSession = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    const user = await currentUser(request);
    authorizeRole(user.role, [ROLES.TRAINER, ROLES.BOSS]);
    const sessionId = requireString(request.data?.sessionId, "sessionId", {
      max: 128,
    });
    const feedback = optionalString(request.data?.feedback, "feedback");
    const reference = db.collection("sessions").doc(sessionId);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "La sesión no existe.");
      }
      const session = snapshot.data();
      if (user.role === ROLES.TRAINER && session.trainerId !== user.uid) {
        throw new HttpsError(
          "permission-denied",
          "La sesión pertenece a otro entrenador.",
        );
      }
      if (session.status !== SESSION_STATES.CONFIRMED) {
        throw new HttpsError(
          "failed-precondition",
          "Solo se pueden completar sesiones confirmadas.",
        );
      }
      if (session.kind === "room_rental") {
        transaction.update(reference, {
          status: SESSION_STATES.COMPLETED,
          modifiedAt: timestamp(),
          modifiedBy: user.uid,
        });
        audit(transaction, {
          uid: user.uid,
          action: "complete_room_booking",
          resourceId: sessionId,
          changes: {},
        }, request);
        return;
      }
      const clientReference = db.collection("users").doc(session.clientId);
      const clientSnapshot = await transaction.get(clientReference);
      if (!clientSnapshot.exists) {
        throw new HttpsError("not-found", "El cliente no existe.");
      }
      const client = clientSnapshot.data();
      const usedSessions = Number(client.usedSessions ?? 0);
      const packTotalSessions = Number(client.packTotalSessions ?? 0);
      if (usedSessions >= packTotalSessions) {
        throw new HttpsError(
          "failed-precondition",
          "El pack no tiene sesiones disponibles.",
        );
      }
      transaction.update(reference, {
        status: SESSION_STATES.COMPLETED,
        feedback,
        modifiedAt: timestamp(),
        modifiedBy: user.uid,
      });
      transaction.update(clientReference, {
        usedSessions: usedSessions + 1,
        remainingSessions: Math.max(0, packTotalSessions - usedSessions - 1),
        modifiedAt: timestamp(),
      });
      audit(transaction, {
        uid: user.uid,
        action: "complete_session",
        resourceId: sessionId,
        changes: { feedback },
      }, request);
    });
    return { status: SESSION_STATES.COMPLETED };
  } catch (error) {
    throw callableError(error);
  }
});

exports.rescheduleSession = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      const user = await currentUser(request);
      authorizeRole(user.role, [ROLES.BOSS]);
      const sessionId = requireString(request.data?.sessionId, "sessionId", {
        max: 128,
      });
      const date = validateDate(request.data?.date);
      const time = validateTime(request.data?.time);
      const room = validateRoom(request.data?.room);
      const trainerId = optionalString(
        request.data?.trainerId,
        "trainerId",
        128,
      );
      let trainerSnapshot = null;
      if (trainerId) {
        trainerSnapshot = await db.collection("users").doc(trainerId).get();
        if (
          !trainerSnapshot.exists ||
          !isTrainerProfile(trainerSnapshot.data())
        ) {
          throw new HttpsError("not-found", "El entrenador no existe.");
        }
      }

      const reference = db.collection("sessions").doc(sessionId);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) {
          throw new HttpsError("not-found", "La sesión no existe.");
        }
        const currentSession = snapshot.data();
        if (currentSession.status !== SESSION_STATES.CONFIRMED) {
          throw new HttpsError(
            "failed-precondition",
            "Solo se pueden reasignar sesiones confirmadas.",
          );
        }
        if (currentSession.kind !== "room_rental" && !trainerId) {
          throw new HttpsError(
            "invalid-argument",
            "La sesión necesita un entrenador.",
          );
        }
        const selectedTrainerId =
          currentSession.kind === "room_rental" ? "" : trainerId;
        const selectedTrainerName =
          currentSession.kind === "room_rental"
            ? "Dirección"
            : trainerSnapshot.data().name;

        const daySessions = await transaction.get(
          db
            .collection("sessions")
            .where("date", "==", date)
            .where("status", "==", SESSION_STATES.CONFIRMED),
        );
        const candidate = { time, duration: currentSession.duration };
        const conflict = daySessions.docs
          .filter((document) => document.id !== sessionId)
          .map((document) => document.data())
          .find(
            (session) =>
              (
                (selectedTrainerId &&
                  session.trainerId === selectedTrainerId) ||
                session.room === room
              ) &&
              sessionsOverlap(session, candidate),
          );
        if (conflict) {
          throw new HttpsError(
            "already-exists",
            selectedTrainerId && conflict.trainerId === selectedTrainerId
              ? "El entrenador ya tiene una sesión en esa franja."
              : "La sala ya está ocupada en esa franja.",
          );
        }

        transaction.update(reference, {
          date,
          time,
          room,
          trainerId: selectedTrainerId,
          trainerName: selectedTrainerName,
          modifiedAt: timestamp(),
          modifiedBy: user.uid,
        });
        transaction.set(
          db.collection("occupancy").doc(sessionId),
          {
            sessionId,
            kind: currentSession.kind ?? "training",
            date,
            time,
            duration: currentSession.duration,
            room,
            trainerId: selectedTrainerId || null,
            modifiedAt: timestamp(),
          },
          { merge: true },
        );
        audit(transaction, {
          uid: user.uid,
          action: "reschedule_session",
          resourceId: sessionId,
          changes: { date, time, room, trainerId: selectedTrainerId },
        }, request);
      });
      return { success: true };
    } catch (error) {
      throw callableError(error);
    }
  },
);

exports.cancelSession = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  try {
    const user = await currentUser(request);
    authorizeRole(user.role, [ROLES.BOSS]);
    const sessionId = requireString(request.data?.sessionId, "sessionId", {
      max: 128,
    });
    const reason = requireString(request.data?.reason, "reason", { max: 500 });
    const reference = db.collection("sessions").doc(sessionId);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "La sesión no existe.");
      }
      const session = snapshot.data();
      if (session.status !== SESSION_STATES.CONFIRMED) {
        throw new HttpsError(
          "failed-precondition",
          "Solo se pueden cancelar sesiones confirmadas.",
        );
      }
      let rentalClientReference = null;
      let rentalClient = null;
      if (session.kind === "room_rental") {
        rentalClientReference = db.collection("users").doc(session.clientId);
        const clientSnapshot = await transaction.get(rentalClientReference);
        if (clientSnapshot.exists) {
          rentalClient = clientSnapshot.data();
        }
      }
      transaction.update(reference, {
        status: SESSION_STATES.CANCELLED,
        cancellationReason: reason,
        modifiedAt: timestamp(),
        modifiedBy: user.uid,
      });
      transaction.delete(db.collection("occupancy").doc(sessionId));
      if (rentalClientReference && rentalClient) {
        const usedSessions = Math.max(
          0,
          Number(rentalClient.usedSessions ?? 0) - 1,
        );
        const packTotalSessions = Number(
          rentalClient.packTotalSessions ?? 0,
        );
        transaction.update(rentalClientReference, {
          usedSessions,
          remainingSessions: Math.max(0, packTotalSessions - usedSessions),
          modifiedAt: timestamp(),
          modifiedBy: user.uid,
        });
      }
      audit(transaction, {
        uid: user.uid,
        action: "cancel_session",
        resourceId: sessionId,
        changes: { reason },
      }, request);
    });
    return { status: SESSION_STATES.CANCELLED };
  } catch (error) {
    throw callableError(error);
  }
});

exports.processFaqMessage = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      const user = await currentUser(request);
      authorizeRole(user.role, [ROLES.CLIENT]);
      const text = requireString(request.data?.text, "text", { max: 1000 });
      const upcoming = await db
        .collection("sessions")
        .where("clientId", "==", user.uid)
        .where("status", "==", SESSION_STATES.CONFIRMED)
        .orderBy("date")
        .limit(1)
        .get();
      const next = upcoming.empty ? null : upcoming.docs[0].data();
      const reply = faqReply(text, {
        remainingSessions: user.remainingSessions ?? 0,
        nextSession: next ? `${next.date} a las ${next.time}` : null,
      });

      if (reply.type === "escalate") {
        logger.info("FAQ escalated to trainer", {
          clientId: user.uid,
          trainerId: user.trainerId,
        });
      }
      return { ...reply, trainerId: reply.type === "escalate" ? user.trainerId : null };
    } catch (error) {
      throw callableError(error);
    }
  },
);

exports.requestAccountDeletion = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    try {
      const user = await currentUser(request);
      if (user.role === ROLES.BOSS) {
        throw new HttpsError(
          "failed-precondition",
          "La cuenta principal de Dirección debe transferirse antes de eliminarla.",
        );
      }
      const requestReference = db
        .collection("deletionRequests")
        .doc(user.uid);
      await db.runTransaction(async (transaction) => {
        transaction.set(requestReference, {
          uid: user.uid,
          email: user.email,
          status: "pending",
          requestedAt: timestamp(),
        });
        transaction.update(db.collection("users").doc(user.uid), {
          status: "deletion_requested",
          modifiedAt: timestamp(),
        });
        audit(transaction, {
          uid: user.uid,
          action: "request_account_deletion",
          resourceId: user.uid,
          changes: {},
        }, request);
      });
      await admin.auth().updateUser(user.uid, { disabled: true });
      return { status: "pending" };
    } catch (error) {
      throw callableError(error);
    }
  },
);
