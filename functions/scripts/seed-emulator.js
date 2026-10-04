"use strict";

const admin = require("firebase-admin");

const requiredEnvironment = [
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIRESTORE_EMULATOR_HOST",
  "GCLOUD_PROJECT",
];

const missing = requiredEnvironment.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `Refusing to seed outside the Firebase emulators. Missing: ${missing.join(", ")}`,
  );
  process.exit(1);
}

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });

const users = [
  {
    uid: "client-1",
    email: "client@activate.demo",
    password: "demo123",
    name: "Ana García",
    role: "client",
    trainerIds: ["boss-1", "trainer-1"],
    phone: "+34 612 345 678",
    sessionDuration: 45,
    packId: "pack-demo-1",
    packName: "Pack 10 · 45 min",
    packTotalSessions: 10,
    usedSessions: 3,
    remainingSessions: 7,
    isMinor: false,
    guardianName: null,
    termsAccepted: true,
    imageConsent: false,
    cycleTrackingEnabled: true,
    cycleSharingEnabled: true,
  },
  {
    uid: "trainer-1",
    email: "roger@activate.demo",
    password: "demo123",
    name: "Tobias",
    role: "trainer",
    isTrainer: true,
  },
  {
    uid: "boss-1",
    email: "roger@activate.demo",
    password: "demo123",
    name: "Roger",
    role: "boss",
    isTrainer: true,
  },
  {
    uid: "reserve-1",
    email: "lydia@activate.demo",
    password: "demo123",
    name: "Lydia",
    role: "reserve",
    isTrainer: false,
    trainerIds: [],
    phone: "+34 600 000 002",
    sessionDuration: 60,
    packId: "pack-room-demo-1",
    packName: "Bono sala 8 · 60 min",
    packTotalSessions: 8,
    usedSessions: 1,
    remainingSessions: 7,
    termsAccepted: true,
    imageConsent: false,
    cycleTrackingEnabled: false,
    cycleSharingEnabled: false,
  },
];

const rooms = [
  {
    id: "upstairs",
    name: "Sala de arriba",
    type: "training_and_rental",
    status: "active",
  },
  {
    id: "downstairs",
    name: "Sala de abajo",
    type: "training_and_rental",
    status: "active",
  },
  {
    id: "physio",
    name: "Sala de fisio",
    type: "physiotherapy_and_rental",
    status: "active",
  },
];

async function upsertAuthUser(user) {
  try {
    await admin.auth().getUser(user.uid);
    await admin.auth().updateUser(user.uid, {
      email: user.email,
      password: user.password,
      displayName: user.name,
    });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    await admin.auth().createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.name,
    });
  }
}

async function main() {
  const batch = admin.firestore().batch();
  for (const user of users) {
    await upsertAuthUser(user);
    const { password, ...profile } = user;
    batch.set(admin.firestore().collection("users").doc(user.uid), {
      ...profile,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      modifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  for (const room of rooms) {
    const { id, ...data } = room;
    batch.set(admin.firestore().collection("rooms").doc(id), {
      ...data,
      modifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(
    `Seeded ${users.length} emulator users and ${rooms.length} rooms.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
