"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BOOKING_STATES,
  assertBookingTransition,
  faqReply,
  sessionsOverlap,
  validateAdminClientInput,
  validateAdminRoomUserInput,
  validateBookingInput,
  validateDuration,
  validatePackIncrement,
  validateRoom,
  validateTime,
} = require("../src/domain");

test("trainers confirm training and direction confirms room bookings", () => {
  assert.doesNotThrow(() =>
    assertBookingTransition(
      BOOKING_STATES.PENDING_TRAINER,
      BOOKING_STATES.CONFIRMED,
    ),
  );
  assert.doesNotThrow(() =>
    assertBookingTransition(
      BOOKING_STATES.PENDING_BOSS,
      BOOKING_STATES.CONFIRMED,
    ),
  );
});

test("booking flow rejects obsolete or repeated transitions", () => {
  assert.throws(
    () =>
      assertBookingTransition(
        BOOKING_STATES.PENDING_TRAINER,
        BOOKING_STATES.PENDING_BOSS,
      ),
    /Invalid booking transition/,
  );
  assert.throws(
    () =>
      assertBookingTransition(
        BOOKING_STATES.CONFIRMED,
        BOOKING_STATES.PENDING_BOSS,
      ),
    /Invalid booking transition/,
  );
});

test("booking input normalizes safe values", () => {
  assert.deepEqual(
    validateBookingInput({
      requestedDate: "2026-08-01",
      type: " Personal Training ",
      trainerId: "trainer-1",
      requestedTime: "09:30",
      room: " Sala de arriba ",
    }),
    {
      requestedDate: "2026-08-01",
      type: "Personal Training",
      trainerId: "trainer-1",
      requestedTime: "09:30",
      room: "Sala de arriba",
    },
  );
});

test("date and time validation reject malformed values", () => {
  assert.throws(
    () =>
      validateBookingInput({
        requestedDate: "2026-02-31",
        type: "HIIT",
        trainerId: "trainer-1",
        requestedTime: "09:00",
        room: "Sala de arriba",
      }),
    /valid calendar date/,
  );
  assert.throws(() => validateTime("24:10"), /HH:mm/);
  assert.equal(validateDuration(45), 45);
  assert.equal(validateDuration("60"), 60);
  assert.throws(() => validateDuration(55), /45 or 60/);
  assert.equal(validateRoom("Sala de arriba"), "Sala de arriba");
  assert.equal(validateRoom("Sala de fisio"), "Sala de fisio");
  assert.throws(() => validateRoom("Sala secreta"), /Sala de arriba/);
});

test("FAQ answers known questions without escalation", () => {
  assert.deepEqual(faqReply("¿Cuántas sesiones me quedan?", {
    remainingSessions: 7,
  }), {
    type: "ai",
    text: "Te quedan 7 sesiones.",
  });
});

test("FAQ escalates unknown questions", () => {
  assert.equal(
    faqReply("Me duele la rodilla al hacer sentadillas").type,
    "escalate",
  );
});

test("session overlap detects trainer and room time collisions", () => {
  assert.equal(
    sessionsOverlap(
      { time: "09:00", duration: 45 },
      { time: "09:30", duration: 45 },
    ),
    true,
  );
  assert.equal(
    sessionsOverlap(
      { time: "09:00", duration: 60 },
      { time: "10:00", duration: 60 },
    ),
    false,
  );
});

test("admin client input normalizes a valid adult account", () => {
  assert.deepEqual(validateAdminClientInput({
    name: " Ana García ",
    email: "ANA@EXAMPLE.COM",
    phone: "+34 612 345 678",
    trainerIds: ["trainer-1", "trainer-2"],
    sessionDuration: "45",
    packName: "Pack 10 · 45 min",
    packTotalSessions: "10",
    isMinor: false,
    guardianName: "",
    guardianEmail: "",
    termsAccepted: true,
    imageConsent: false,
    cycleTrackingEnabled: true,
  }), {
    name: "Ana García",
    email: "ana@example.com",
    phone: "+34 612 345 678",
    trainerIds: ["trainer-1", "trainer-2"],
    sessionDuration: 45,
    packName: "Pack 10 · 45 min",
    packTotalSessions: 10,
    isMinor: false,
    guardianName: null,
    guardianEmail: null,
    termsAccepted: true,
    imageConsent: false,
    cycleTrackingEnabled: true,
  });
});

test("admin client input requires guardian details for minors", () => {
  assert.throws(() => validateAdminClientInput({
    name: "Cliente menor",
    email: "menor@example.com",
    phone: "+34 600 000 000",
    trainerIds: ["trainer-1"],
    sessionDuration: 60,
    packName: "Pack menor",
    packTotalSessions: 8,
    isMinor: true,
    guardianName: "",
    guardianEmail: "",
    termsAccepted: true,
    imageConsent: false,
    cycleTrackingEnabled: false,
  }), /guardianName and guardianEmail/);
});

test("admin room user input accepts a 45 or 60 minute bono", () => {
  assert.deepEqual(validateAdminRoomUserInput({
    name: "Lydia Sala",
    email: "lydia@example.com",
    phone: "+34 600 000 001",
    sessionDuration: 60,
    packName: "Bono sala",
    packTotalSessions: 8,
    termsAccepted: false,
  }), {
    name: "Lydia Sala",
    email: "lydia@example.com",
    phone: "+34 600 000 001",
    sessionDuration: 60,
    packName: "Bono sala",
    packTotalSessions: 8,
    termsAccepted: false,
  });
});

test("pack increments only accept 1 to 100 sessions", () => {
  assert.deepEqual(validatePackIncrement({
    clientId: "client-1",
    sessionsToAdd: "5",
    sessionDuration: 60,
    packName: "Ampliación 60 min",
  }), {
    clientId: "client-1",
    sessionsToAdd: 5,
    sessionDuration: 60,
    packName: "Ampliación 60 min",
  });
  assert.throws(() => validatePackIncrement({
    clientId: "client-1",
    sessionsToAdd: 0,
    sessionDuration: 45,
    packName: "Pack",
  }), /between 1 and 100/);
});
