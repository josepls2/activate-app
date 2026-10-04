"use strict";

const BOOKING_STATES = Object.freeze({
  PENDING_TRAINER: "pending_trainer",
  PENDING_BOSS: "pending_boss",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
});

const SESSION_STATES = Object.freeze({
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

const ROLES = Object.freeze({
  BOSS: "boss",
  TRAINER: "trainer",
  CLIENT: "client",
  RESERVE: "reserve",
});

const ROOM_NAMES = Object.freeze([
  "Sala de arriba",
  "Sala de abajo",
  "Sala de fisio",
]);

const BOOKING_TRANSITIONS = Object.freeze({
  [BOOKING_STATES.PENDING_TRAINER]: new Set([
    BOOKING_STATES.CONFIRMED,
    BOOKING_STATES.REJECTED,
  ]),
  [BOOKING_STATES.PENDING_BOSS]: new Set([
    BOOKING_STATES.CONFIRMED,
    BOOKING_STATES.REJECTED,
    BOOKING_STATES.PENDING_TRAINER,
  ]),
  [BOOKING_STATES.CONFIRMED]: new Set(),
  [BOOKING_STATES.REJECTED]: new Set(),
});

function assertBookingTransition(from, to) {
  if (!BOOKING_TRANSITIONS[from]?.has(to)) {
    throw new Error(`Invalid booking transition: ${from} -> ${to}`);
  }
}

function assertRole(actual, allowed) {
  if (!allowed.includes(actual)) {
    throw new Error(`Role ${actual ?? "unknown"} is not allowed`);
  }
}

function requireString(value, field, options = {}) {
  const min = options.min ?? 1;
  const max = options.max ?? 200;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} must contain between ${min} and ${max} characters`);
  }
  return normalized;
}

function optionalString(value, field, max = 500) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return requireString(value, field, { max });
}

function validateDate(value) {
  const normalized = requireString(value, "requestedDate", { max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("requestedDate must use YYYY-MM-DD");
  }
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error("requestedDate is not a valid calendar date");
  }
  return normalized;
}

function validateTime(value) {
  const normalized = requireString(value, "time", { max: 5 });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw new Error("time must use HH:mm");
  }
  return normalized;
}

function validateDuration(value) {
  const duration = Number(value);
  if (!Number.isInteger(duration) || ![45, 60].includes(duration)) {
    throw new Error("duration must be 45 or 60 minutes");
  }
  return duration;
}

function validateRoom(value) {
  const room = requireString(value, "room", { max: 80 });
  if (!ROOM_NAMES.includes(room)) {
    throw new Error(`room must be one of: ${ROOM_NAMES.join(", ")}`);
  }
  return room;
}

function validateEmail(value, field = "email") {
  const normalized = requireString(value, field, { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`${field} must be a valid email`);
  }
  return normalized;
}

function validateBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

function optionalBoolean(value, field, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return validateBoolean(value, field);
}

function validateInteger(value, field, options = {}) {
  const number = Number(value);
  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
  return number;
}

function validateStringArray(value, field, options = {}) {
  const min = options.min ?? 1;
  const max = options.max ?? 20;
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`${field} must contain between ${min} and ${max} values`);
  }
  const normalized = value.map((item, index) =>
    requireString(item, `${field}[${index}]`, { max: 128 }));
  return [...new Set(normalized)];
}

function validateAdminClientInput(data) {
  const isMinor = validateBoolean(data.isMinor, "isMinor");
  const guardianName = optionalString(
    data.guardianName,
    "guardianName",
    120,
  );
  const guardianEmail = data.guardianEmail
    ? validateEmail(data.guardianEmail, "guardianEmail")
    : null;
  if (isMinor && (!guardianName || !guardianEmail)) {
    throw new Error("minor clients require guardianName and guardianEmail");
  }

  const packTotalSessions = validateInteger(
    data.packTotalSessions,
    "packTotalSessions",
    { min: 1, max: 200 },
  );

  return {
    name: requireString(data.name, "name", { max: 120 }),
    email: validateEmail(data.email),
    phone: requireString(data.phone, "phone", { max: 40 }),
    trainerIds: validateStringArray(
      data.trainerIds ?? (data.trainerId ? [data.trainerId] : []),
      "trainerIds",
      { min: 1, max: 10 },
    ),
    sessionDuration: validateDuration(data.sessionDuration),
    packName: requireString(data.packName, "packName", { max: 120 }),
    packTotalSessions,
    isMinor,
    guardianName: isMinor ? guardianName : null,
    guardianEmail: isMinor ? guardianEmail : null,
    termsAccepted: validateBoolean(data.termsAccepted, "termsAccepted"),
    imageConsent: validateBoolean(data.imageConsent, "imageConsent"),
    cycleTrackingEnabled: optionalBoolean(
      data.cycleTrackingEnabled,
      "cycleTrackingEnabled",
    ),
  };
}

function validateAdminRoomUserInput(data) {
  return {
    name: requireString(data.name, "name", { max: 120 }),
    email: validateEmail(data.email),
    phone: requireString(data.phone, "phone", { max: 40 }),
    sessionDuration: validateDuration(data.sessionDuration),
    packName: requireString(data.packName, "packName", { max: 120 }),
    packTotalSessions: validateInteger(
      data.packTotalSessions,
      "packTotalSessions",
      { min: 1, max: 200 },
    ),
    termsAccepted: validateBoolean(data.termsAccepted, "termsAccepted"),
  };
}

function validatePackIncrement(data) {
  return {
    clientId: requireString(data.clientId, "clientId", { max: 128 }),
    sessionsToAdd: validateInteger(data.sessionsToAdd, "sessionsToAdd", {
      min: 1,
      max: 100,
    }),
    sessionDuration: validateDuration(data.sessionDuration),
    packName: requireString(data.packName, "packName", { max: 120 }),
  };
}

function minutesFromTime(value) {
  const normalized = validateTime(value);
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function sessionsOverlap(first, second) {
  const firstStart = minutesFromTime(first.time);
  const firstEnd = firstStart + Number(first.duration);
  const secondStart = minutesFromTime(second.time);
  const secondEnd = secondStart + Number(second.duration);
  return firstStart < secondEnd && secondStart < firstEnd;
}

function validateBookingInput(data) {
  return {
    requestedDate: validateDate(data.requestedDate),
    requestedTime: validateTime(data.requestedTime),
    type: requireString(data.type, "type", { max: 80 }),
    trainerId: requireString(data.trainerId, "trainerId", { max: 128 }),
    room: validateRoom(data.room),
  };
}

function validateRoomBookingInput(data) {
  return {
    requestedDate: validateDate(data.requestedDate),
    requestedTime: validateTime(data.requestedTime),
    room: validateRoom(data.room),
  };
}

function faqReply(message, context = {}) {
  const normalized = requireString(message, "text", { max: 1000 })
    .toLocaleLowerCase("es");

  if (
    normalized.includes("cuántas sesiones") ||
    normalized.includes("cuantas sesiones") ||
    normalized.includes("sesiones restantes")
  ) {
    return {
      type: "ai",
      text: `Te quedan ${Number(context.remainingSessions ?? 0)} sesiones.`,
    };
  }

  if (normalized.includes("próxima sesión") || normalized.includes("proxima sesion")) {
    return {
      type: "ai",
      text: context.nextSession
        ? `Tu próxima sesión es ${context.nextSession}.`
        : "No tienes ninguna sesión confirmada próximamente.",
    };
  }

  if (normalized.includes("horario")) {
    return {
      type: "ai",
      text: "Abrimos de lunes a viernes de 07:00 a 21:00 y los sábados de 08:00 a 15:00.",
    };
  }

  if (normalized.includes("precio") || normalized.includes("pack")) {
    return {
      type: "ai",
      text: "Puedes consultar tu pack y las sesiones disponibles en la pestaña Pack. Los pagos se gestionan fuera de la app.",
    };
  }

  return {
    type: "escalate",
    text: "No tengo una respuesta segura. He avisado a tu entrenador para que continúe la conversación.",
  };
}

module.exports = {
  BOOKING_STATES,
  ROOM_NAMES,
  ROLES,
  SESSION_STATES,
  assertBookingTransition,
  assertRole,
  faqReply,
  optionalString,
  optionalBoolean,
  minutesFromTime,
  requireString,
  sessionsOverlap,
  validateAdminClientInput,
  validateAdminRoomUserInput,
  validateBoolean,
  validateBookingInput,
  validateEmail,
  validateDate,
  validateDuration,
  validatePackIncrement,
  validateRoomBookingInput,
  validateRoom,
  validateStringArray,
  validateTime,
};
