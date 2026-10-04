// Notificador de Activate: lee los cambios de Firestore desde la última
// ejecución y envía las notificaciones push con Firebase Cloud Messaging.
//
// Uso:
//   node src/index.mjs            una pasada (GitHub Actions / cron)
//   node src/index.mjs --loop     cada 5 minutos (ordenador siempre encendido)
//   node src/index.mjs --dry-run  muestra los avisos sin enviarlos ni guardar nada
//
// Credenciales (cuenta de servicio con permisos de Firestore y FCM):
//   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'   (JSON completo)
//   o GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/clave.json

import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  addDaysKey,
  bookingEvents,
  challengeEvents,
  challengeFeedbackEvents,
  flattenEvents,
  localDayKey,
  messageEvents,
  planEvents,
  reminderEvents,
  sessionEvents,
  weekKeyOf,
} from "./events.mjs";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const LOOP = args.has("--loop");
const LOOP_MINUTES = Number(process.env.NOTIFIER_INTERVAL_MINUTES ?? 5);
/** Tras una parada larga no se reenvía un día entero de avisos. */
const MAX_LOOKBACK_MS = 6 * 3_600_000;
const FIRST_RUN_LOOKBACK_MS = 15 * 60_000;

const credential = process.env.FIREBASE_SERVICE_ACCOUNT
  ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  : applicationDefault();
initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID || undefined });

const db = getFirestore();
const messaging = getMessaging();

const toDate = (value) => (value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null);

function plain(docSnap) {
  const data = docSnap.data();
  const out = { id: docSnap.id };
  for (const [key, value] of Object.entries(data)) out[key] = value instanceof Timestamp ? value.toDate() : value;
  return out;
}

async function loadChanges(since, now) {
  const from = Timestamp.fromDate(since);
  const to = Timestamp.fromDate(now);
  const today = localDayKey(now.getTime());

  const [bookings, sessions, messages, plans, upcoming, bosses, challenges, feedback] = await Promise.all([
    db.collection("bookingRequests").where("modifiedAt", ">", from).where("modifiedAt", "<=", to).get(),
    db.collection("sessions").where("modifiedAt", ">", from).where("modifiedAt", "<=", to).get(),
    db.collectionGroup("messages").where("timestamp", ">", from).where("timestamp", "<=", to).get(),
    db.collection("nutritionPlans").where("updatedAt", ">", from).where("updatedAt", "<=", to).get(),
    db.collection("sessions").where("date", ">=", today).where("date", "<=", addDaysKey(today, 1)).get(),
    db.collection("users").where("role", "==", "boss").get(),
    db.collection("challenges").where("createdAt", ">", from).where("createdAt", "<=", to).get(),
    db.collection("challengeProgress").where("feedbackAt", ">", from).where("feedbackAt", "<=", to).get(),
  ]);

  // Destinatarios de retos nuevos y títulos para el feedback.
  const clients = challenges.empty
    ? []
    : (await db.collection("users").where("role", "==", "client").get()).docs.map((d) => ({
        id: d.id,
        trainerIds: d.get("trainerIds") ?? [],
        status: d.get("status"),
      }));
  const feedbackRows = feedback.docs.map(plain);
  const challengeIds = [...new Set(feedbackRows.map((p) => p.challengeId).filter((id) => typeof id === "string"))];
  const challengeDocs = challengeIds.length ? await db.getAll(...challengeIds.map((id) => db.doc(`challenges/${id}`))) : [];

  // Chats y nombres necesarios para los mensajes.
  const messageRows = messages.docs
    .map((d) => ({
      chatId: d.ref.parent.parent?.id,
      authorId: d.get("authorId"),
      text: d.get("text"),
      timestamp: toDate(d.get("timestamp")),
    }))
    .filter((m) => m.chatId && typeof m.authorId === "string" && typeof m.text === "string");

  const chatIds = [...new Set(messageRows.map((m) => m.chatId))];
  const authorIds = [...new Set(messageRows.map((m) => m.authorId))];
  const [chatDocs, authorDocs] = await Promise.all([
    chatIds.length ? db.getAll(...chatIds.map((id) => db.doc(`chats/${id}`))) : [],
    authorIds.length ? db.getAll(...authorIds.map((id) => db.doc(`users/${id}`))) : [],
  ]);

  return {
    bookings: bookings.docs.map(plain),
    sessions: sessions.docs.map(plain),
    messages: messageRows,
    chats: new Map(chatDocs.filter((d) => d.exists).map((d) => [d.id, { participantIds: d.get("participantIds") ?? [] }])),
    names: new Map(authorDocs.filter((d) => d.exists).map((d) => [d.id, d.get("name") ?? "Activate"])),
    plans: plans.docs.map(plain),
    upcoming: upcoming.docs.map(plain),
    challenges: challenges.docs.map(plain),
    clients,
    feedback: feedbackRows,
    challengeTitles: new Map(challengeDocs.filter((d) => d.exists).map((d) => [d.id, d.get("title") ?? "tu reto"])),
    currentWeek: weekKeyOf(today),
    bossIds: bosses.docs.filter((d) => d.get("status") !== "disabled").map((d) => d.id),
  };
}

async function tokensFor(uids) {
  const result = new Map();
  await Promise.all(
    uids.map(async (uid) => {
      const snap = await db.collection(`users/${uid}/pushTokens`).get();
      result.set(
        uid,
        snap.docs.filter((d) => typeof d.get("token") === "string").map((d) => ({ ref: d.ref, token: d.get("token") })),
      );
    }),
  );
  return result;
}

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

async function send(notifications) {
  const uids = [...new Set(notifications.map((n) => n.uid))];
  const tokens = await tokensFor(uids);
  const outgoing = [];
  for (const n of notifications) {
    for (const device of tokens.get(n.uid) ?? []) {
      outgoing.push({
        device,
        message: {
          token: device.token,
          data: { title: n.title, body: n.body, url: n.url, tag: n.tag },
          webpush: { headers: { Urgency: "high", TTL: "86400" } },
        },
      });
    }
  }

  let sent = 0;
  let failed = 0;
  const stale = [];
  for (let i = 0; i < outgoing.length; i += 500) {
    const chunk = outgoing.slice(i, i + 500);
    const response = await messaging.sendEach(chunk.map((o) => o.message));
    response.responses.forEach((r, index) => {
      if (r.success) sent += 1;
      else {
        failed += 1;
        if (INVALID_TOKEN_CODES.has(r.error?.code)) stale.push(chunk[index].device.ref);
      }
    });
  }
  // Dispositivos que ya no existen: se borran para no reintentar.
  for (let i = 0; i < stale.length; i += 400) {
    const batch = db.batch();
    stale.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return { devices: outgoing.length, sent, failed, pruned: stale.length };
}

export async function runOnce() {
  const now = new Date();
  const stateRef = db.doc("system/notifier");
  const state = await stateRef.get();
  const lastRun = toDate(state.get("lastRun"));
  const since = new Date(
    Math.max(lastRun ? lastRun.getTime() : now.getTime() - FIRST_RUN_LOOKBACK_MS, now.getTime() - MAX_LOOKBACK_MS),
  );

  const changes = await loadChanges(since, now);
  const sessionsResult = sessionEvents(changes.sessions);
  const reminders = reminderEvents(changes.upcoming, { now });
  const notifications = flattenEvents([
    ...bookingEvents(changes.bookings, { since, bossIds: changes.bossIds }),
    ...sessionsResult.events,
    ...messageEvents(changes.messages, changes.chats, changes.names),
    ...planEvents(changes.plans),
    ...challengeEvents(changes.challenges, changes.clients, { currentWeek: changes.currentWeek }),
    ...challengeFeedbackEvents(changes.feedback, changes.challengeTitles),
    ...reminders.events,
  ]);

  if (DRY_RUN) {
    console.log(JSON.stringify({ since, now, notifications }, null, 2));
    return { notifications: notifications.length, dryRun: true };
  }

  const result = notifications.length ? await send(notifications) : { devices: 0, sent: 0, failed: 0, pruned: 0 };

  // Recordatorios enviados y sesiones reprogramadas (necesitan uno nuevo).
  const writes = [
    ...reminders.remindedIds.map((id) => ({ id, data: { reminderSentAt: FieldValue.serverTimestamp() } })),
    ...sessionsResult.rescheduled
      .filter((id) => !reminders.remindedIds.includes(id))
      .map((id) => ({ id, data: { reminderSentAt: FieldValue.delete() } })),
  ];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach((w) => batch.update(db.doc(`sessions/${w.id}`), w.data));
    await batch.commit();
  }

  await stateRef.set(
    {
      lastRun: Timestamp.fromDate(now),
      lastResult: { notifications: notifications.length, ...result, at: Timestamp.fromDate(now) },
    },
    { merge: true },
  );
  const summary = { since: since.toISOString(), notifications: notifications.length, ...result };
  console.log(JSON.stringify(summary));
  return summary;
}

async function main() {
  if (!LOOP) {
    await runOnce();
    return;
  }
  console.log(`Notificador en marcha: cada ${LOOP_MINUTES} min. Ctrl+C para parar.`);
  for (;;) {
    try {
      await runOnce();
    } catch (error) {
      console.error("[notificador]", error);
    }
    await new Promise((resolve) => setTimeout(resolve, LOOP_MINUTES * 60_000));
  }
}

main().catch((error) => {
  console.error("[notificador]", error);
  process.exitCode = 1;
});
