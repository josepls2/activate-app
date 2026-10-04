import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDaysKey,
  bookingEvents,
  challengeEvents,
  challengeFeedbackEvents,
  flattenEvents,
  formatDay,
  localDayKey,
  messageEvents,
  planEvents,
  reminderEvents,
  sessionEvents,
  weekKeyOf,
  zonedToEpoch,
} from "../src/events.mjs";

const since = new Date("2026-10-03T10:00:00Z");
const after = new Date("2026-10-03T10:05:00Z");
const before = new Date("2026-10-03T09:00:00Z");

test("zona horaria de Madrid, también en cambio de hora", () => {
  // Verano: UTC+2
  assert.equal(new Date(zonedToEpoch("2026-07-01", "10:00")).toISOString(), "2026-07-01T08:00:00.000Z");
  // Invierno: UTC+1
  assert.equal(new Date(zonedToEpoch("2026-12-01", "10:00")).toISOString(), "2026-12-01T09:00:00.000Z");
  // Día del cambio (25-10-2026, 03:00 → 02:00)
  assert.equal(new Date(zonedToEpoch("2026-10-25", "12:00")).toISOString(), "2026-10-25T11:00:00.000Z");
  assert.equal(localDayKey(Date.parse("2026-10-03T23:30:00Z")), "2026-10-04");
  assert.equal(addDaysKey("2026-12-31", 1), "2027-01-01");
  assert.equal(formatDay("2026-10-05"), "lunes, 5 de octubre");
});

test("solicitudes: nueva para el entrenador, de sala para Dirección, confirmación al cliente", () => {
  const events = bookingEvents(
    [
      { id: "a", status: "pending_trainer", trainerId: "t1", clientId: "c1", clientName: "Laura", requestedDate: "2026-10-05", requestedTime: "10:00", createdAt: after },
      { id: "b", status: "pending_boss", trainerId: "", clientId: "r1", clientName: "Lydia", requestedDate: "2026-10-06", requestedTime: "12:00", room: "Sala de fisio", createdAt: after },
      { id: "c", status: "confirmed", trainerId: "t1", clientId: "c2", clientName: "Marc", requestedDate: "2026-10-07", finalTime: "18:00", room: "Sala de abajo", createdAt: before },
      { id: "d", status: "rejected", trainerId: "t1", clientId: "c3", clientName: "Ana", requestedDate: "2026-10-08", type: "HIIT", createdAt: before },
      { id: "e", status: "pending_trainer", trainerId: "t1", clientId: "c1", clientName: "Laura", requestedDate: "2026-10-09", createdAt: before },
    ],
    { since, bossIds: ["boss1", "boss2"] },
  );
  assert.deepEqual(
    events.map((e) => [e.title, e.to]),
    [
      ["Nueva solicitud de entrenamiento", ["t1"]],
      ["Nueva reserva de sala", ["boss1", "boss2"]],
      ["Sesión confirmada", ["c2"]],
      ["Solicitud no disponible", ["c3"]],
    ],
  );
  assert.match(events[2].body, /miércoles, 7 de octubre · 18:00 · Sala de abajo/);
});

test("sesiones: cancelada, reprogramada y feedback; no se avisa a quien hizo el cambio", () => {
  const { events, rescheduled } = sessionEvents([
    { id: "s1", status: "cancelled", clientId: "c1", trainerId: "t1", modifiedBy: "boss", date: "2026-10-05", time: "10:00" },
    { id: "s2", status: "confirmed", clientId: "c1", trainerId: "t1", modifiedBy: "boss", date: "2026-10-06", time: "12:00", room: "Sala de abajo", createdAt: before, modifiedAt: after },
    { id: "s3", status: "completed", clientId: "c1", trainerId: "t1", trainerName: "Tobias", modifiedBy: "t1", feedback: "Gran sesión", date: "2026-10-02", time: "09:00" },
    { id: "s4", status: "confirmed", clientId: "c1", trainerId: "t1", modifiedBy: "t1", createdAt: after, modifiedAt: after },
    { id: "s5", status: "cancelled", clientId: "c1", trainerId: "t1", modifiedBy: "t1", date: "2026-10-05", time: "10:00" },
  ]);
  assert.deepEqual(
    events.map((e) => [e.title, e.to]),
    [
      ["Sesión cancelada", ["c1", "t1"]],
      ["Sesión reprogramada", ["c1", "t1"]],
      ["Feedback de Tobias", ["c1"]],
      ["Sesión cancelada", ["c1"]],
    ],
  );
  assert.deepEqual(rescheduled, ["s2"]);
});

test("mensajes: a los demás participantes, agrupados", () => {
  const chats = new Map([["c1", { participantIds: ["c1", "t1", "t2"] }]]);
  const names = new Map([["c1", "Laura"], ["t1", "Tobias"]]);
  const events = flattenEvents(
    messageEvents(
      [
        { chatId: "c1", authorId: "c1", text: "Hola" },
        { chatId: "c1", authorId: "c1", text: "¿Mañana a las 10?" },
        { chatId: "c1", authorId: "t1", text: "¡Claro!" },
        { chatId: "desconocido", authorId: "x", text: "ignorar" },
      ],
      chats,
      names,
    ),
  );
  assert.deepEqual(
    events.map((e) => [e.uid, e.title, e.body]),
    [
      ["t1", "2 mensajes de Laura", "¿Mañana a las 10?"],
      ["t2", "2 mensajes de Laura", "¿Mañana a las 10?"],
      ["c1", "Mensaje de Tobias", "¡Claro!"],
      ["t2", "Mensaje de Tobias", "¡Claro!"],
    ],
  );
});

test("recordatorio una sola vez dentro de las 24 h previas", () => {
  const now = new Date("2026-10-03T16:00:00Z"); // 18:00 en Madrid
  const { events, remindedIds } = reminderEvents(
    [
      { id: "hoy", status: "confirmed", clientId: "c1", date: "2026-10-03", time: "20:00", room: "Sala de arriba", type: "Fuerza" },
      { id: "manana", status: "confirmed", clientId: "c2", date: "2026-10-04", time: "09:00", room: "Sala de abajo" },
      { id: "lejos", status: "confirmed", clientId: "c3", date: "2026-10-04", time: "19:00", room: "Sala de abajo" },
      { id: "pasada", status: "confirmed", clientId: "c4", date: "2026-10-03", time: "10:00", room: "Sala de abajo" },
      { id: "ya", status: "confirmed", clientId: "c5", date: "2026-10-04", time: "09:00", room: "Sala de abajo", reminderSentAt: new Date() },
      { id: "cancelada", status: "cancelled", clientId: "c6", date: "2026-10-04", time: "09:00", room: "Sala de abajo" },
    ],
    { now },
  );
  assert.deepEqual(remindedIds, ["hoy", "manana"]);
  assert.equal(events[0].body, "Hoy a las 20:00 · Fuerza en Sala de arriba");
  assert.equal(events[1].body, "Mañana a las 09:00 · Sesión en Sala de abajo");
});

test("plan nutricional al cliente; duplicados fuera", () => {
  const events = planEvents([
    { clientId: "c1", title: "Plan fuerza", updatedBy: "t1", updatedByName: "Tobias" },
    { clientId: "c2", title: "Raro", updatedBy: "c2" },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].body, "Plan fuerza · de Tobias");
  const flat = flattenEvents([...events, ...events, { to: [], title: "x", tag: "y" }]);
  assert.equal(flat.length, 1);
});

test("retos nuevos: todo el centro o sólo clientes del entrenador", () => {
  const clients = [
    { id: "c1", trainerIds: ["t1"] },
    { id: "c2", trainerIds: ["t2"] },
    { id: "c3", trainerIds: ["t1"], status: "disabled" },
  ];
  const events = flattenEvents(
    challengeEvents(
      [
        { id: "a", title: "8.000 pasos", points: 30, audience: "all", weekKey: "2026-09-28", createdByName: "Dirección" },
        { id: "b", title: "Agua", points: 20, audience: "trainer", trainerId: "t1", weekKey: "2026-10-05" },
      ],
      clients,
      { currentWeek: "2026-09-28" },
    ),
  );
  assert.deepEqual(
    events.map((e) => [e.uid, e.title]),
    [
      ["c1", "Nuevo reto semanal"],
      ["c2", "Nuevo reto semanal"],
      ["c1", "Reto para la próxima semana"],
    ],
  );
  assert.equal(events[0].url, "#challenges");
});

test("feedback y aprobación de retos llegan al cliente", () => {
  const events = flattenEvents(
    challengeFeedbackEvents(
      [
        { id: "a_c1", challengeId: "a", uid: "c1", feedback: "Muy bien", feedbackBy: "t1", feedbackByName: "Tobias", approved: false },
        { id: "a_c2", challengeId: "a", uid: "c2", feedback: "", feedbackBy: "t1", approved: true },
        { id: "a_c3", challengeId: "a", uid: "c3", feedback: null, approved: false },
      ],
      new Map([["a", "8.000 pasos"]]),
    ),
  );
  assert.deepEqual(
    events.map((e) => [e.uid, e.title]),
    [
      ["c1", "Feedback de Tobias"],
      ["c2", "Reto aprobado: 8.000 pasos"],
    ],
  );
});

test("solicitud retirada por el cliente avisa a quien la revisaba", () => {
  const since = new Date("2026-10-01T10:00:00Z");
  const events = bookingEvents(
    [
      { id: "b1", status: "cancelled", trainerId: "t1", clientName: "Laura", requestedDate: "2026-10-05", requestedTime: "10:00" },
      { id: "b2", status: "cancelled", kind: "room_rental", clientName: "Sala", requestedDate: "2026-10-05", requestedTime: "11:00" },
    ],
    { since, bossIds: ["boss"] },
  );
  assert.deepEqual(events.map((e) => [e.to, e.title]), [
    [["t1"], "Solicitud retirada"],
    [["boss"], "Solicitud retirada"],
  ]);
});

test("weekKeyOf devuelve el lunes", () => {
  assert.equal(weekKeyOf("2026-10-03"), "2026-09-28");
  assert.equal(weekKeyOf("2026-09-28"), "2026-09-28");
  assert.equal(weekKeyOf("2026-10-04"), "2026-09-28");
});
