// Lógica pura del notificador: a partir de los cambios en Firestore desde la
// última ejecución, decide qué avisos mandar y a quién. Sin dependencias de
// Firebase para poder probarla con `npm test`.

export const TIME_ZONE = "Europe/Madrid";

const longDay = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "2026-10-05" → "lunes, 5 de octubre" */
export function formatDay(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return String(key);
  return longDay.format(new Date(Date.UTC(y, m - 1, d)));
}

function tzOffsetMs(epoch, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epoch));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - epoch;
}

/** Fecha y hora locales de Madrid → milisegundos UTC. */
export function zonedToEpoch(date, time, timeZone = TIME_ZONE) {
  const [y, m, d] = String(date).split("-").map(Number);
  const [hh, mm] = String(time).split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let epoch = guess - tzOffsetMs(guess, timeZone);
  const corrected = guess - tzOffsetMs(epoch, timeZone);
  if (corrected !== epoch) epoch = corrected;
  return epoch;
}

/** Día local (AAAA-MM-DD) de un instante. */
export function localDayKey(epoch, timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(epoch),
  );
}

export function addDaysKey(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

const ms = (value) => (value instanceof Date ? value.getTime() : typeof value === "number" ? value : 0);
const uniq = (list) => [...new Set(list.filter(Boolean))];

function truncate(text, size) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > size ? `${value.slice(0, size - 1)}…` : value;
}

/**
 * Solicitudes de reserva.
 * @param {Array} bookings  documentos con createdAt/modifiedAt como Date
 */
export function bookingEvents(bookings, { since, bossIds }) {
  const events = [];
  for (const b of bookings) {
    const created = ms(b.createdAt) > ms(since);
    const when = `${formatDay(b.requestedDate)} · ${b.finalTime ?? b.requestedTime ?? ""}`.trim();
    if (created && b.status === "pending_trainer" && b.trainerId) {
      events.push({
        to: [b.trainerId],
        title: "Nueva solicitud de entrenamiento",
        body: `${b.clientName} · ${when}`,
        url: "#bookings",
        tag: `booking-${b.id}`,
      });
    } else if (created && b.status === "pending_boss") {
      events.push({
        to: bossIds,
        title: "Nueva reserva de sala",
        body: `${b.clientName} · ${when}${b.room ? ` · ${b.room}` : ""}`,
        url: "#bookings",
        tag: `booking-${b.id}`,
      });
    } else if (b.status === "confirmed") {
      events.push({
        to: [b.clientId],
        title: b.kind === "room_rental" ? "Reserva de sala confirmada" : "Sesión confirmada",
        body: `${when}${b.room ? ` · ${b.room}` : ""}`,
        url: "#sessions",
        tag: `booking-${b.id}`,
      });
    } else if (b.status === "cancelled") {
      // El propio cliente retiró la solicitud: se avisa a quien debía revisarla.
      events.push({
        to: b.kind === "room_rental" || !b.trainerId ? bossIds : [b.trainerId],
        title: "Solicitud retirada",
        body: `${b.clientName} retiró su solicitud del ${when}`,
        url: "#bookings",
        tag: `booking-${b.id}`,
      });
    } else if (b.status === "rejected") {
      events.push({
        to: [b.clientId],
        title: "Solicitud no disponible",
        body: `${b.type ?? "Sesión"} · ${formatDay(b.requestedDate)}. Prueba con otra hora.`,
        url: "#sessions",
        tag: `booking-${b.id}`,
      });
    }
  }
  return events;
}

/**
 * Sesiones modificadas: cancelación, reprogramación o feedback.
 * Devuelve también las sesiones reprogramadas para volver a enviar recordatorio.
 */
export function sessionEvents(sessions) {
  const events = [];
  const rescheduled = [];
  for (const s of sessions) {
    const people = uniq([s.clientId, s.trainerId]).filter((uid) => uid !== s.modifiedBy);
    const when = `${formatDay(s.date)} a las ${s.time}`;
    if (s.status === "cancelled") {
      events.push({ to: people, title: "Sesión cancelada", body: when, url: "#sessions", tag: `session-${s.id}` });
    } else if (s.status === "completed" && s.feedback) {
      events.push({
        to: [s.clientId].filter((uid) => uid !== s.modifiedBy),
        title: `Feedback de ${s.trainerName || "tu entrenador"}`,
        body: truncate(s.feedback, 140),
        url: "#sessions",
        tag: `session-${s.id}`,
      });
    } else if (s.status === "confirmed" && ms(s.modifiedAt) - ms(s.createdAt) > 5_000) {
      rescheduled.push(s.id);
      events.push({
        to: people,
        title: "Sesión reprogramada",
        body: `${when} · ${s.room}`,
        url: "#sessions",
        tag: `session-${s.id}`,
      });
    }
  }
  return { events, rescheduled };
}

/**
 * Mensajes nuevos agrupados por chat y destinatario.
 * @param messages [{ chatId, authorId, text, timestamp }]
 * @param chats    Map chatId → { participantIds }
 * @param names    Map uid → nombre
 */
export function messageEvents(messages, chats, names) {
  const grouped = new Map();
  for (const m of messages) {
    const chat = chats.get(m.chatId);
    if (!chat) continue;
    for (const uid of chat.participantIds ?? []) {
      if (uid === m.authorId) continue;
      const key = `${m.chatId}|${uid}|${m.authorId}`;
      const entry = grouped.get(key) ?? { chatId: m.chatId, to: uid, authorId: m.authorId, texts: [] };
      entry.texts.push(m.text);
      grouped.set(key, entry);
    }
  }
  return [...grouped.values()].map((g) => {
    const author = names.get(g.authorId) ?? "Activate";
    return {
      to: [g.to],
      title: g.texts.length > 1 ? `${g.texts.length} mensajes de ${author}` : `Mensaje de ${author}`,
      body: truncate(g.texts[g.texts.length - 1], 140),
      url: "#chat",
      tag: `chat-${g.chatId}`,
    };
  });
}

export function planEvents(plans) {
  return plans
    .filter((p) => p.clientId && p.updatedBy !== p.clientId)
    .map((p) => ({
      to: [p.clientId],
      title: "Nuevo plan nutricional",
      body: truncate(`${p.title}${p.updatedByName ? ` · de ${p.updatedByName}` : ""}`, 140),
      url: "#nutrition",
      tag: "nutrition",
    }));
}

/**
 * Retos semanales nuevos: a todos los clientes activos (audience "all") o a
 * los clientes del entrenador que lo creó (audience "trainer").
 * @param clients [{ id, trainerIds, status }]
 */
export function challengeEvents(challenges, clients, { currentWeek } = {}) {
  const active = clients.filter((c) => c.status !== "disabled");
  return challenges
    .filter((c) => c.active !== false)
    .map((c) => {
      const to =
        c.audience === "all"
          ? active.map((u) => u.id)
          : active.filter((u) => (u.trainerIds ?? []).includes(c.trainerId)).map((u) => u.id);
      const later = currentWeek && c.weekKey > currentWeek;
      return {
        to,
        title: later ? "Reto para la próxima semana" : "Nuevo reto semanal",
        body: truncate(`${c.title}${c.points ? ` · ${c.points} pts` : ""}${c.createdByName ? ` · de ${c.createdByName}` : ""}`, 140),
        url: "#challenges",
        tag: `challenge-${c.id}`,
      };
    });
}

/** Feedback (y aprobación) del entrenador sobre el reto de un cliente. */
export function challengeFeedbackEvents(progress, challengeTitles = new Map()) {
  return progress
    .filter((p) => p.uid && (p.feedback || p.approved) && p.feedbackBy !== p.uid)
    .map((p) => {
      const title = challengeTitles.get(p.challengeId) ?? "tu reto";
      return {
        to: [p.uid],
        title: p.approved ? `Reto aprobado: ${truncate(title, 60)}` : `Feedback de ${p.feedbackByName || "tu entrenador"}`,
        body: truncate(p.feedback || "¡Has sumado los puntos del reto a la clasificación!", 140),
        url: "#challenges",
        tag: `challenge-feedback-${p.id}`,
      };
    });
}

/** Lunes (AAAA-MM-DD) de la semana de un día. */
export function weekKeyOf(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDaysKey(dayKey, -weekday);
}

/**
 * Recordatorio único por sesión durante las 24 h previas.
 * @returns { events, remindedIds }
 */
export function reminderEvents(sessions, { now, timeZone = TIME_ZONE }) {
  const events = [];
  const remindedIds = [];
  const today = localDayKey(ms(now), timeZone);
  for (const s of sessions) {
    if (s.status !== "confirmed" || s.reminderSentAt) continue;
    const start = zonedToEpoch(s.date, s.time, timeZone);
    const delta = start - ms(now);
    if (delta <= 0 || delta > 24 * 3_600_000) continue;
    remindedIds.push(s.id);
    const dayWord = s.date === today ? "Hoy" : s.date === addDaysKey(today, 1) ? "Mañana" : formatDay(s.date);
    events.push({
      to: [s.clientId],
      title: "Recordatorio de sesión",
      body: `${dayWord} a las ${s.time} · ${s.type ?? "Sesión"} en ${s.room}`,
      url: "#sessions",
      tag: `reminder-${s.id}`,
    });
  }
  return { events, remindedIds };
}

/** Une avisos y descarta destinatarios vacíos o duplicados (mismo tag y usuario). */
export function flattenEvents(events) {
  const seen = new Set();
  const out = [];
  for (const event of events) {
    for (const uid of uniq(event.to ?? [])) {
      const key = `${uid}|${event.tag}|${event.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ uid, title: event.title, body: event.body, url: event.url, tag: event.tag });
    }
  }
  return out;
}
