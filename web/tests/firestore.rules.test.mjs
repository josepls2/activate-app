// Tests de firestore.rules con el emulador de Firestore.
//
// Desde la raíz del proyecto (necesita Java instalado):
//   npm --prefix web install
//   npx firebase emulators:exec --only firestore --project demo-activate \
//     "npm --prefix web run test:rules"
//
// Cubren los flujos que usan iOS, admin-web y la web app, y los abusos que
// las reglas deben bloquear.

import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const RULES = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

const BOSS = "bossUid";
const TRAINER = "trainerUid";
const OTHER_TRAINER = "otherTrainerUid";
const CLIENT = "clientUid";
const ROOM_USER = "roomUid";

let env;

function dayOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const TOMORROW = dayOffset(1);
const LAST_MONTH = dayOffset(-30);

function profile(uid, role, extra = {}) {
  return {
    uid,
    email: `${uid}@test.local`,
    name: uid,
    phone: "",
    role,
    isTrainer: role === "trainer",
    trainerIds: [],
    status: "active",
    packTotalSessions: 10,
    usedSessions: 0,
    reservedSessions: 0,
    remainingSessions: 10,
    sessionDuration: 45,
    termsAccepted: true,
    gender: "unspecified",
    cycleTrackingEnabled: false,
    cycleSharingEnabled: false,
    ...extra,
  };
}

function bookingData(overrides = {}) {
  return {
    clientId: CLIENT,
    clientName: CLIENT,
    trainerId: TRAINER,
    trainerName: "Trainer",
    kind: "training",
    requestedDate: TOMORROW,
    requestedTime: "10:00",
    type: "Fuerza",
    duration: 45,
    room: "Sala de arriba",
    status: "pending_trainer",
    proposedTime: "10:00",
    finalTime: null,
    trainerNotes: null,
    bossNotes: null,
    createdAt: serverTimestamp(),
    modifiedAt: serverTimestamp(),
    ...overrides,
  };
}

const db = (uid) => env.authenticatedContext(uid).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-activate",
    firestore: { rules: RULES },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const admin = context.firestore();
    await setDoc(doc(admin, "users", BOSS), profile(BOSS, "boss", { isTrainer: true }));
    await setDoc(doc(admin, "users", TRAINER), profile(TRAINER, "trainer"));
    await setDoc(doc(admin, "users", OTHER_TRAINER), profile(OTHER_TRAINER, "trainer"));
    await setDoc(
      doc(admin, "users", CLIENT),
      profile(CLIENT, "client", {
        trainerIds: [TRAINER],
        gender: "female",
        cycleTrackingEnabled: true,
      }),
    );
    await setDoc(doc(admin, "users", ROOM_USER), profile(ROOM_USER, "reserve", { sessionDuration: 60 }));
    await setDoc(doc(admin, "bookingRequests", "pending1"), {
      ...bookingData(),
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
    await setDoc(doc(admin, "staffDirectory", "s1"), { name: "Trainer", kind: "trainer", status: "active" });
  });
});

/** Confirmación tal como la hacen iOS y la web (batch = mismas reglas que una transacción). */
function confirmBatch(firestore, actor, overrides = {}) {
  const batch = writeBatch(firestore);
  const time = overrides.time ?? "10:00";
  const sessionTrainer = overrides.sessionTrainer ?? TRAINER;
  const sessionDate = overrides.sessionDate ?? TOMORROW;
  batch.update(doc(firestore, "bookingRequests", "pending1"), {
    status: "confirmed",
    finalTime: time,
    room: "Sala de arriba",
    trainerNotes: null,
    sessionId: "pending1",
    modifiedAt: serverTimestamp(),
    ...(overrides.bookingExtra ?? {}),
  });
  batch.set(doc(firestore, "sessions", "pending1"), {
    bookingRequestId: "pending1",
    kind: "training",
    clientId: CLIENT,
    clientName: CLIENT,
    trainerId: sessionTrainer,
    trainerName: "Trainer",
    date: sessionDate,
    time,
    duration: 45,
    room: "Sala de arriba",
    type: "Fuerza",
    status: "confirmed",
    trainerNotes: null,
    feedback: null,
    packSessionNumber: 1,
    packTotalSessions: 10,
    createdAt: serverTimestamp(),
    modifiedAt: serverTimestamp(),
    modifiedBy: actor,
  });
  batch.update(doc(firestore, "users", CLIENT), {
    reservedSessions: 1,
    remainingSessions: 9,
    lastSessionId: "pending1",
    modifiedAt: serverTimestamp(),
    modifiedBy: actor,
  });
  for (const block of ["0600", "0615", "0630"]) {
    const data = {
      sessionId: "pending1",
      kind: "training",
      date: TOMORROW,
      time: `${String(Math.floor(Number(block) / 60)).padStart(2, "0")}:${String(Number(block) % 60).padStart(2, "0")}`,
      duration: 15,
      room: "Sala de arriba",
      trainerId: sessionTrainer,
      createdAt: serverTimestamp(),
    };
    batch.set(doc(firestore, "occupancy", `room_upstairs_${TOMORROW}_${block}`), data);
    batch.set(doc(firestore, "occupancy", `trainer_${sessionTrainer}_${TOMORROW}_${block}`), data);
  }
  batch.set(doc(collection(firestore, "activityLogs")), {
    actorId: actor,
    action: "confirm_training_booking",
    resourceId: "pending1",
    createdAt: serverTimestamp(),
  });
  return batch;
}

describe("Solicitudes de reserva", () => {
  test("el cliente pide una sesión válida", async () => {
    await assertSucceeds(setDoc(doc(collection(db(CLIENT), "bookingRequests")), bookingData()));
  });

  test("no se puede reservar en el pasado", async () => {
    await assertFails(
      setDoc(doc(collection(db(CLIENT), "bookingRequests")), bookingData({ requestedDate: LAST_MONTH })),
    );
  });

  test("no se aceptan campos extra ni horas mal formadas", async () => {
    await assertFails(setDoc(doc(collection(db(CLIENT), "bookingRequests")), bookingData({ sessionId: "x" })));
    await assertFails(setDoc(doc(collection(db(CLIENT), "bookingRequests")), bookingData({ requestedTime: "25:00" })));
  });

  test("el cliente no puede elegir un entrenador no asignado", async () => {
    await assertFails(
      setDoc(doc(collection(db(CLIENT), "bookingRequests")), bookingData({ trainerId: OTHER_TRAINER })),
    );
  });

  test("el usuario de sala pide una sala", async () => {
    await assertSucceeds(
      setDoc(
        doc(collection(db(ROOM_USER), "bookingRequests")),
        bookingData({
          clientId: ROOM_USER,
          clientName: ROOM_USER,
          trainerId: "",
          kind: "room_rental",
          status: "pending_boss",
          duration: 60,
        }),
      ),
    );
  });
});

describe("Confirmación de entrenamientos", () => {
  test("el entrenador asignado confirma (transacción completa)", async () => {
    await assertSucceeds(confirmBatch(db(TRAINER), TRAINER).commit());
  });

  test("Dirección confirma", async () => {
    await assertSucceeds(confirmBatch(db(BOSS), BOSS).commit());
  });

  test("el entrenador no puede cambiar la fecha de la sesión", async () => {
    await assertFails(confirmBatch(db(TRAINER), TRAINER, { sessionDate: dayOffset(5) }).commit());
  });

  test("el entrenador no puede modificar campos bloqueados de la solicitud", async () => {
    await assertFails(
      confirmBatch(db(TRAINER), TRAINER, { bookingExtra: { requestedDate: dayOffset(5) } }).commit(),
    );
  });

  test("otro entrenador no puede confirmar", async () => {
    await assertFails(confirmBatch(db(OTHER_TRAINER), OTHER_TRAINER).commit());
  });

  test("el entrenador rechaza", async () => {
    await assertSucceeds(
      updateDoc(doc(db(TRAINER), "bookingRequests", "pending1"), {
        status: "rejected",
        rejectionReason: "No disponible",
        modifiedAt: serverTimestamp(),
      }),
    );
  });
});

describe("Sesiones confirmadas", () => {
  beforeEach(async () => {
    await confirmBatch(db(TRAINER), TRAINER).commit();
  });

  test("el entrenador completa con feedback", async () => {
    const batch = writeBatch(db(TRAINER));
    batch.update(doc(db(TRAINER), "sessions", "pending1"), {
      status: "completed",
      feedback: "Muy bien",
      modifiedAt: serverTimestamp(),
      modifiedBy: TRAINER,
    });
    batch.update(doc(db(TRAINER), "users", CLIENT), {
      usedSessions: 1,
      reservedSessions: 0,
      lastSessionId: "pending1",
      modifiedAt: serverTimestamp(),
      modifiedBy: TRAINER,
    });
    await assertSucceeds(batch.commit());
  });

  test("el entrenador no puede tocar el saldo sin completar la sesión", async () => {
    await assertFails(
      updateDoc(doc(db(TRAINER), "users", CLIENT), {
        usedSessions: 1,
        reservedSessions: 0,
        lastSessionId: "pending1",
        modifiedAt: serverTimestamp(),
        modifiedBy: TRAINER,
      }),
    );
  });

  test("Dirección cancela y devuelve la sesión al bono", async () => {
    const firestore = db(BOSS);
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, "sessions", "pending1"), {
      status: "cancelled",
      cancellationReason: "Cancelada por Dirección",
      modifiedAt: serverTimestamp(),
      modifiedBy: BOSS,
    });
    batch.update(doc(firestore, "users", CLIENT), {
      reservedSessions: 0,
      remainingSessions: 10,
      lastSessionId: "pending1",
      modifiedAt: serverTimestamp(),
      modifiedBy: BOSS,
    });
    await assertSucceeds(batch.commit());
  });

  test("el entrenador no puede mover la sesión al completarla", async () => {
    await assertFails(
      updateDoc(doc(db(TRAINER), "sessions", "pending1"), {
        status: "completed",
        time: "18:00",
        modifiedAt: serverTimestamp(),
        modifiedBy: TRAINER,
      }),
    );
  });

  test("Dirección reprograma", async () => {
    await assertSucceeds(
      updateDoc(doc(db(BOSS), "sessions", "pending1"), {
        date: dayOffset(3),
        time: "12:00",
        room: "Sala de abajo",
        modifiedAt: serverTimestamp(),
        modifiedBy: BOSS,
      }),
    );
  });

  test("un entrenador no puede crear bloqueos falsos de ocupación", async () => {
    await assertFails(
      setDoc(doc(db(TRAINER), "occupancy", `room_downstairs_${TOMORROW}_1200`), {
        sessionId: "pending1",
        kind: "training",
        date: TOMORROW,
        time: "20:00",
        duration: 15,
        room: "Sala de abajo",
        trainerId: TRAINER,
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("cualquier usuario autenticado ve la ocupación anónima", async () => {
    await assertSucceeds(getDocs(collection(db(ROOM_USER), "occupancy")));
  });
});

describe("Saldo del bono", () => {
  test("un entrenador no puede reservar saldo sin crear la sesión", async () => {
    await assertFails(
      updateDoc(doc(db(TRAINER), "users", CLIENT), {
        reservedSessions: 1,
        remainingSessions: 9,
        lastSessionId: "inventada",
        modifiedAt: serverTimestamp(),
        modifiedBy: TRAINER,
      }),
    );
  });

  test("un bloqueo de ocupación fuera de la hora de la sesión se rechaza", async () => {
    const batch = confirmBatch(db(TRAINER), TRAINER);
    batch.set(doc(db(TRAINER), "occupancy", `room_upstairs_${TOMORROW}_0700`), {
      sessionId: "pending1",
      kind: "training",
      date: TOMORROW,
      time: "11:40",
      duration: 15,
      room: "Sala de arriba",
      trainerId: TRAINER,
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });
});

describe("Notificaciones", () => {
  const tokenDoc = () => ({
    token: "fcm-token-de-prueba-0123456789abcdef",
    userAgent: "test",
    updatedAt: serverTimestamp(),
  });

  test("cada usuario registra sus dispositivos", async () => {
    await assertSucceeds(setDoc(doc(db(CLIENT), "users", CLIENT, "pushTokens", "t1"), tokenDoc()));
  });

  test("nadie más puede leer ni escribir sus dispositivos", async () => {
    await assertFails(setDoc(doc(db(TRAINER), "users", CLIENT, "pushTokens", "t1"), tokenDoc()));
    await assertFails(getDocs(collection(db(BOSS), "users", CLIENT, "pushTokens")));
  });
});

describe("Lecturas", () => {
  test("el entrenador lista sus clientes con la consulta de la web", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(db(TRAINER), "users"),
          where("role", "==", "client"),
          where("trainerIds", "array-contains", TRAINER),
        ),
      ),
    );
  });

  test("los clientes no ven el directorio del equipo", async () => {
    await assertFails(getDocs(collection(db(CLIENT), "staffDirectory")));
    await assertSucceeds(getDocs(collection(db(TRAINER), "staffDirectory")));
  });
});

describe("Chat", () => {
  test("el cliente abre el chat y escribe", async () => {
    const firestore = db(CLIENT);
    const batch = writeBatch(firestore);
    batch.set(
      doc(firestore, "chats", CLIENT),
      { participantIds: [CLIENT, TRAINER], clientId: CLIENT, modifiedAt: serverTimestamp() },
      { merge: true },
    );
    batch.set(doc(collection(firestore, "chats", CLIENT, "messages")), {
      authorId: CLIENT,
      authorRole: "client",
      text: "Hola",
      timestamp: serverTimestamp(),
      isRead: false,
    });
    await assertSucceeds(batch.commit());
  });

  test("el entrenador responde y no puede suplantar al cliente", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "chats", CLIENT), { participantIds: [CLIENT, TRAINER], clientId: CLIENT }),
    );
    const firestore = db(TRAINER);
    await assertSucceeds(
      setDoc(doc(collection(firestore, "chats", CLIENT, "messages")), {
        authorId: TRAINER,
        authorRole: "trainer",
        text: "¡Hola!",
        timestamp: serverTimestamp(),
        isRead: false,
      }),
    );
    await assertFails(
      setDoc(doc(collection(firestore, "chats", CLIENT, "messages")), {
        authorId: CLIENT,
        authorRole: "client",
        text: "Falso",
        timestamp: serverTimestamp(),
        isRead: false,
      }),
    );
    await assertSucceeds(
      getDocs(query(collection(firestore, "chats"), where("participantIds", "array-contains", TRAINER))),
    );
  });

  test("el cliente puede escuchar su chat aunque aún no exista", async () => {
    await assertSucceeds(getDoc(doc(db(CLIENT), "chats", CLIENT)));
    await assertFails(getDoc(doc(db(TRAINER), "chats", "otroCliente")));
  });

  test("un entrenador no asignado no puede leer ni escribir", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "chats", CLIENT), { participantIds: [CLIENT, TRAINER], clientId: CLIENT }),
    );
    await assertFails(getDoc(doc(db(OTHER_TRAINER), "chats", CLIENT)));
  });

  test("leído: cada uno marca sólo su propia entrada", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "chats", CLIENT), { participantIds: [CLIENT, TRAINER], clientId: CLIENT }),
    );
    await assertSucceeds(updateDoc(doc(db(TRAINER), "chats", CLIENT), { [`readBy.${TRAINER}`]: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(CLIENT), "chats", CLIENT), { [`readBy.${CLIENT}`]: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(TRAINER), "chats", CLIENT), { [`readBy.${CLIENT}`]: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(CLIENT), "chats", CLIENT), { [`readBy.${CLIENT}`]: new Date(2030, 0, 1) }));
  });

  test("responder citando y eliminar para todos (sólo el autor)", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "chats", CLIENT), { participantIds: [CLIENT, TRAINER], clientId: CLIENT }),
    );
    const ref = doc(collection(db(TRAINER), "chats", CLIENT, "messages"));
    await assertSucceeds(
      setDoc(ref, {
        authorId: TRAINER,
        authorRole: "trainer",
        text: "Perfecto",
        timestamp: serverTimestamp(),
        isRead: false,
        replyTo: { id: "m1", text: "¿Mañana a las 10?", authorId: CLIENT },
      }),
    );
    await assertFails(
      setDoc(doc(collection(db(TRAINER), "chats", CLIENT, "messages")), {
        authorId: TRAINER,
        authorRole: "trainer",
        text: "Hola",
        timestamp: serverTimestamp(),
        isRead: false,
        replyTo: { id: "m1", text: "x".repeat(500), authorId: CLIENT },
      }),
    );
    // El cliente no puede borrar mensajes del entrenador ni editar textos.
    await assertFails(
      updateDoc(doc(db(CLIENT), "chats", CLIENT, "messages", ref.id), { text: "", deleted: true, replyTo: null }),
    );
    await assertFails(updateDoc(doc(db(TRAINER), "chats", CLIENT, "messages", ref.id), { text: "Editado" }));
    await assertSucceeds(
      updateDoc(doc(db(TRAINER), "chats", CLIENT, "messages", ref.id), { text: "", deleted: true, replyTo: null }),
    );
  });
});

describe("Nutrición", () => {
  const plan = (by) => ({
    clientId: CLIENT,
    title: "Plan semana 1",
    goal: "Ganar fuerza",
    meals: [{ name: "Desayuno", description: "Avena y fruta" }],
    notes: "",
    updatedAt: serverTimestamp(),
    updatedBy: by,
    updatedByName: "Trainer",
  });

  test("el entrenador asignado publica y el cliente lo lee", async () => {
    await assertSucceeds(setDoc(doc(db(TRAINER), "nutritionPlans", CLIENT), plan(TRAINER)));
    await assertSucceeds(getDoc(doc(db(CLIENT), "nutritionPlans", CLIENT)));
  });

  test("ni el cliente ni otro entrenador pueden escribirlo", async () => {
    await assertFails(setDoc(doc(db(CLIENT), "nutritionPlans", CLIENT), plan(CLIENT)));
    await assertFails(setDoc(doc(db(OTHER_TRAINER), "nutritionPlans", CLIENT), plan(OTHER_TRAINER)));
  });
});

describe("Perfil y bonos", () => {
  test("el cliente no puede subirse sesiones", async () => {
    await assertFails(updateDoc(doc(db(CLIENT), "users", CLIENT), { remainingSessions: 99 }));
  });

  test("el cliente acepta términos", async () => {
    await assertSucceeds(
      updateDoc(doc(db(CLIENT), "users", CLIENT), {
        termsAccepted: true,
        termsAcceptedAt: serverTimestamp(),
        termsVersion: "2026-07-27",
        imageConsent: false,
        imageConsentAt: serverTimestamp(),
        modifiedAt: serverTimestamp(),
      }),
    );
  });

  test("Dirección asigna un entrenador recién activado", async () => {
    await assertSucceeds(
      updateDoc(doc(db(BOSS), "users", CLIENT), {
        trainerIds: arrayUnion(OTHER_TRAINER),
        modifiedAt: serverTimestamp(),
        modifiedBy: BOSS,
      }),
    );
  });
});

// ---------- Funciones nuevas: retos, clasificación, consejos, notas ----------

function mondayOf(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}
const WEEK = mondayOf();

const challengeData = (by, overrides = {}) => ({
  title: "3 días de pasos",
  description: "Camina 8.000 pasos",
  weekKey: WEEK,
  target: 3,
  unit: "días",
  points: 20,
  audience: "trainer",
  trainerId: by,
  createdBy: by,
  createdByName: by,
  createdAt: serverTimestamp(),
  active: true,
  ...overrides,
});

describe("Retos semanales", () => {
  test("el entrenador crea retos sólo para sus clientes", async () => {
    await assertSucceeds(setDoc(doc(db(TRAINER), "challenges", "c1"), challengeData(TRAINER)));
    await assertFails(setDoc(doc(db(TRAINER), "challenges", "c2"), challengeData(TRAINER, { audience: "all", trainerId: null })));
    await assertFails(setDoc(doc(db(CLIENT), "challenges", "c3"), challengeData(CLIENT)));
  });

  test("Dirección crea retos para todos", async () => {
    await assertSucceeds(setDoc(doc(db(BOSS), "challenges", "c4"), challengeData(BOSS, { audience: "all", trainerId: null })));
  });

  test("el cliente apunta progreso y el entrenador da feedback", async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), "challenges", "c1"), { ...challengeData(TRAINER), createdAt: new Date() }),
    );
    const progressRef = (firestore) => doc(firestore, "challengeProgress", `c1_${CLIENT}`);
    await assertSucceeds(
      setDoc(progressRef(db(CLIENT)), {
        challengeId: "c1",
        uid: CLIENT,
        weekKey: WEEK,
        trainerIds: [TRAINER],
        progress: 1,
        checkIns: [TOMORROW],
        note: "",
        completed: false,
        updatedAt: serverTimestamp(),
      }),
    );
    // El cliente no puede aprobarse a sí mismo.
    await assertFails(updateDoc(progressRef(db(CLIENT)), { approved: true }));
    await assertSucceeds(
      updateDoc(progressRef(db(TRAINER)), {
        feedback: "¡Muy bien!",
        feedbackBy: TRAINER,
        feedbackByName: "Trainer",
        feedbackAt: serverTimestamp(),
        approved: true,
      }),
    );
    // Aprobado: el cliente ya no lo cambia.
    await assertFails(updateDoc(progressRef(db(CLIENT)), { progress: 3, updatedAt: serverTimestamp() }));
    await assertFails(getDoc(progressRef(db(OTHER_TRAINER))));
    await assertSucceeds(
      getDocs(query(collection(db(TRAINER), "challengeProgress"), where("trainerIds", "array-contains", TRAINER))),
    );
  });
});

describe("Clasificación", () => {
  const entry = (visible) => ({
    weekKey: WEEK,
    uid: CLIENT,
    displayName: "Client C.",
    sessions: 1,
    challengePoints: 0,
    visible,
    updatedAt: serverTimestamp(),
  });

  test("el entrenador suma la sesión; visible debe respetar la elección del cliente", async () => {
    await assertFails(setDoc(doc(db(TRAINER), "leaderboard", `${WEEK}_${CLIENT}`), entry(true)));
    await assertSucceeds(setDoc(doc(db(TRAINER), "leaderboard", `${WEEK}_${CLIENT}`), entry(false)));
    await assertFails(setDoc(doc(db(CLIENT), "leaderboard", `${WEEK}_${CLIENT}`), entry(false)));
  });

  test("los clientes sólo ven a quien ha aceptado aparecer", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "leaderboard", `${WEEK}_x`), { ...entry(true), uid: "x", updatedAt: new Date() });
      await setDoc(doc(c.firestore(), "leaderboard", `${WEEK}_y`), { ...entry(false), uid: "y", updatedAt: new Date() });
    });
    await assertSucceeds(
      getDocs(query(collection(db(ROOM_USER), "leaderboard"), where("weekKey", "==", WEEK), where("visible", "==", true))),
    );
    await assertFails(getDocs(query(collection(db(ROOM_USER), "leaderboard"), where("weekKey", "==", WEEK))));
  });
});

describe("Consejos y notas del entrenador", () => {
  test("el equipo publica consejos, el cliente sólo los lee", async () => {
    const tip = (by) => ({
      title: "Bebe agua",
      body: "Lleva una botella contigo.",
      category: "hidratacion",
      createdBy: by,
      createdByName: by,
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(setDoc(doc(db(TRAINER), "tips", "t1"), tip(TRAINER)));
    await assertFails(setDoc(doc(db(CLIENT), "tips", "t2"), tip(CLIENT)));
    await assertSucceeds(getDoc(doc(db(CLIENT), "tips", "t1")));
  });

  test("las notas privadas no las ve el cliente", async () => {
    const note = { notes: "Molestias en la rodilla", updatedAt: serverTimestamp(), updatedBy: TRAINER, updatedByName: "T" };
    await assertSucceeds(setDoc(doc(db(TRAINER), "trainerNotes", CLIENT), note));
    await assertFails(getDoc(doc(db(CLIENT), "trainerNotes", CLIENT)));
    await assertFails(getDoc(doc(db(OTHER_TRAINER), "trainerNotes", CLIENT)));
  });
});

describe("Cancelaciones del cliente", () => {
  test("retira su solicitud pendiente", async () => {
    await assertSucceeds(
      updateDoc(doc(db(CLIENT), "bookingRequests", "pending1"), { status: "cancelled", modifiedAt: serverTimestamp() }),
    );
  });

  test("cancela con más de 24 h y recupera la sesión; con menos, no", async () => {
    const far = dayOffset(5);
    await env.withSecurityRulesDisabled(async (c) => {
      const admin = c.firestore();
      for (const [id, date] of [["lejos", far], ["cerca", TOMORROW]]) {
        await setDoc(doc(admin, "sessions", id), {
          bookingRequestId: id, kind: "training", clientId: CLIENT, clientName: CLIENT, trainerId: TRAINER,
          trainerName: "T", date, time: "07:00", duration: 45, room: "Sala de arriba", type: "Fuerza",
          status: "confirmed", trainerNotes: null, feedback: null,
        });
      }
      await setDoc(doc(admin, "occupancy", `room_upstairs_${far}_0420`), {
        sessionId: "lejos", kind: "training", date: far, time: "07:00", duration: 15, room: "Sala de arriba",
        trainerId: TRAINER, createdAt: new Date(),
      });
      await updateDoc(doc(admin, "users", CLIENT), { reservedSessions: 2, remainingSessions: 8 });
    });
    const cancel = (id) => {
      const firestore = db(CLIENT);
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, "sessions", id), {
        status: "cancelled", cancellationReason: "Cancelada por el cliente", modifiedAt: serverTimestamp(), modifiedBy: CLIENT,
      });
      batch.update(doc(firestore, "users", CLIENT), {
        reservedSessions: 1, remainingSessions: 9, lastSessionId: id, modifiedAt: serverTimestamp(), modifiedBy: CLIENT,
      });
      return batch;
    };
    const farBatch = cancel("lejos");
    farBatch.delete(doc(db(CLIENT), "occupancy", `room_upstairs_${far}_0420`));
    await assertSucceeds(farBatch.commit());
    // "cerca" es mañana a las 07:00: puede faltar menos de 24 h según la hora del test,
    // así que se prueba una sesión de hoy (siempre < 24 h).
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), "sessions", "cerca"), { date: dayOffset(0) }));
    await assertFails(cancel("cerca").commit());
  });

  test("un cliente no puede borrar bloqueos de sesiones que siguen confirmadas", async () => {
    await confirmBatch(db(TRAINER), TRAINER).commit();
    await assertFails(deleteDoc(doc(db(CLIENT), "occupancy", `room_upstairs_${TOMORROW}_0600`)));
  });
});
