// Datos ficticios para revisar la interfaz en local (sólo `npm run dev`).
import {
  addDays,
  currentWeek,
  todayKey,
  type AppUser,
  type BookingRequest,
  type Challenge,
  type ChallengeProgress,
  type GymSession,
  type LeaderboardEntry,
  type Tip,
  type UserRole,
} from "./domain";
import { demoUserBase, store } from "./store";

const today = todayKey();

const roger: AppUser = { ...demoUserBase(), id: "t-roger", name: "Roger", role: "boss", isTrainer: true, email: "roger@demo.local" };
const tobias: AppUser = { ...demoUserBase(), id: "t-tobias", name: "Tobias", role: "trainer", isTrainer: true, email: "tobias@demo.local" };
const domi: AppUser = { ...demoUserBase(), id: "t-domi", name: "Domi", role: "trainer", isTrainer: true, email: "domi@demo.local" };

const laura: AppUser = {
  ...demoUserBase(),
  id: "c-laura",
  name: "Laura Martín",
  email: "laura@demo.local",
  phone: "600 111 222",
  dni: "12345678Z",
  role: "client",
  trainerIds: ["t-tobias", "t-domi"],
  trainerStaffIds: ["s-tobias", "s-domi"],
  termsAccepted: true,
  imageConsent: true,
  cycleTrackingEnabled: true,
  cycleSharingEnabled: true,
  weeklyGoal: 2,
  leaderboardOptIn: true,
  packName: "Pack 10 · 45 min",
  packTotalSessions: 10,
  usedSessions: 3,
  reservedSessions: 2,
  remainingSessions: 5,
  sessionDuration: 45,
};

const marc: AppUser = {
  ...demoUserBase(),
  id: "c-marc",
  name: "Marc Puig",
  email: "marc@demo.local",
  dni: "87654321X",
  role: "client",
  trainerIds: ["t-tobias"],
  termsAccepted: true,
  packName: "Pack 20 · 60 min",
  packTotalSessions: 20,
  usedSessions: 12,
  reservedSessions: 1,
  remainingSessions: 7,
  sessionDuration: 60,
};

const lydia: AppUser = {
  ...demoUserBase(),
  id: "r-lydia",
  name: "Lydia",
  email: "lydia@demo.local",
  role: "reserve",
  termsAccepted: true,
  packName: "Bono sala 10",
  packTotalSessions: 10,
  usedSessions: 2,
  reservedSessions: 1,
  remainingSessions: 7,
  sessionDuration: 60,
};

const sessions: GymSession[] = [
  {
    id: "s1", date: addDays(today, -2), time: "09:15", duration: 45, clientId: laura.id, clientName: laura.name,
    trainerId: tobias.id, trainerName: "Tobias", type: "Fuerza", room: "Sala de arriba", status: "completed",
    trainerNotes: null, feedback: "Muy buena técnica en sentadilla. Subimos carga la próxima.", packSessionNumber: 3, packTotalSessions: 10, noShow: false,
  },
  {
    id: "s2", date: today, time: "10:45", duration: 45, clientId: laura.id, clientName: laura.name,
    trainerId: tobias.id, trainerName: "Tobias", type: "Entrenamiento personal", room: "Sala de arriba", status: "confirmed",
    trainerNotes: "Trae toalla y agua.", feedback: null, packSessionNumber: 4, packTotalSessions: 10, noShow: false,
  },
  {
    id: "s3", date: today, time: "18:00", duration: 60, clientId: marc.id, clientName: marc.name,
    trainerId: tobias.id, trainerName: "Tobias", type: "HIIT", room: "Sala de abajo", status: "confirmed",
    trainerNotes: null, feedback: null, packSessionNumber: 13, packTotalSessions: 20, noShow: false,
  },
  {
    id: "s4", date: addDays(today, 2), time: "08:30", duration: 45, clientId: laura.id, clientName: laura.name,
    trainerId: domi.id, trainerName: "Domi", type: "Movilidad", room: "Sala de abajo", status: "confirmed",
    trainerNotes: null, feedback: null, packSessionNumber: 5, packTotalSessions: 10, noShow: false,
  },
  {
    id: "s5", date: addDays(today, 1), time: "12:00", duration: 60, clientId: lydia.id, clientName: lydia.name,
    trainerId: "", trainerName: "Dirección", type: "Uso de sala", room: "Sala de fisio", status: "confirmed",
    trainerNotes: null, feedback: null, packSessionNumber: 3, packTotalSessions: 10, noShow: false,
  },
];

const bookings: BookingRequest[] = [
  {
    id: "b1", clientId: laura.id, clientName: laura.name, trainerId: tobias.id, trainerName: "Tobias", kind: "training",
    requestedDate: addDays(today, 3), requestedTime: "17:15", type: "Fuerza", duration: 45, room: "Sala de arriba",
    status: "pending_trainer", proposedTime: "17:15", finalTime: null, trainerNotes: null, bossNotes: null,
  },
  {
    id: "b2", clientId: lydia.id, clientName: lydia.name, trainerId: "", trainerName: "Dirección", kind: "room_rental",
    requestedDate: addDays(today, 4), requestedTime: "10:00", type: "Uso de sala", duration: 60, room: "Sala de abajo",
    status: "pending_boss", proposedTime: "10:00", finalTime: null, trainerNotes: null, bossNotes: null,
  },
  {
    id: "b3", clientId: marc.id, clientName: marc.name, trainerId: tobias.id, trainerName: "Tobias", kind: "training",
    requestedDate: addDays(today, -1), requestedTime: "19:00", type: "HIIT", duration: 60, room: "Sala de abajo",
    status: "rejected", proposedTime: "19:00", finalTime: null, trainerNotes: "Esa tarde no hay disponibilidad.", bossNotes: null,
  },
];

const rooms = [
  { id: "upstairs", name: "Sala de arriba", type: "Entrenamiento y reservas", capacity: 1 },
  { id: "downstairs", name: "Sala de abajo", type: "Entrenamiento y reservas", capacity: 1 },
  { id: "physio", name: "Sala de fisio", type: "Fisioterapia y reservas", capacity: 1 },
];

const staff = [
  { id: "s-roger", name: "Roger", kind: "trainer" as const, authUid: roger.id, email: "" },
  { id: "s-tobias", name: "Tobias", kind: "trainer" as const, authUid: tobias.id, email: "" },
  { id: "s-domi", name: "Domi", kind: "trainer" as const, authUid: null, email: "" },
  { id: "s-xavi", name: "Xavi", kind: "physiotherapist" as const, authUid: null, email: "" },
  { id: "s-lydia", name: "Lydia", kind: "room_rental" as const, authUid: null, email: "" },
  { id: "s-adria", name: "Adrià", kind: "room_rental" as const, authUid: null, email: "" },
  { id: "s-eleonora", name: "Eleonora", kind: "physio_room_rental" as const, authUid: null, email: "" },
];

function packOf(user: AppUser) {
  return {
    id: "demo",
    name: user.packName,
    totalSessions: user.packTotalSessions,
    usedSessions: user.usedSessions,
    reservedSessions: user.reservedSessions,
    remainingSessions: user.remainingSessions,
    duration: user.sessionDuration,
  };
}

// Historial para ver racha, asistencia e insignias.
function history(): GymSession[] {
  const out: GymSession[] = [];
  const pattern = [2, 2, 1, 2, 3, 2, 2]; // semanas anteriores (de la más antigua a la última)
  const week = currentWeek();
  pattern.forEach((count, i) => {
    const monday = addDays(week, -7 * (pattern.length - i));
    for (let k = 0; k < count; k += 1) {
      const date = addDays(monday, k * 2);
      out.push({
        id: `h-${i}-${k}`, date, time: "09:15", duration: 45, clientId: laura.id, clientName: laura.name,
        trainerId: tobias.id, trainerName: "Tobias", type: "Fuerza", room: "Sala de arriba", status: "completed",
        trainerNotes: null, feedback: null, packSessionNumber: null, packTotalSessions: null, noShow: false,
      });
    }
  });
  return out;
}

function engagement(role: UserRole) {
  const week = currentWeek();
  const challenges: Challenge[] = [
    {
      id: "ch1", title: "8.000 pasos al día", description: "Llega a 8.000 pasos y marca el día. ¡Vale cualquier paseo!",
      weekKey: week, target: 5, unit: "días", points: 30, audience: "trainer", trainerId: tobias.id,
      createdBy: tobias.id, createdByName: "Tobias", active: true,
    },
    {
      id: "ch2", title: "2 litros de agua", description: "Bebe al menos 2 litros de agua al día.",
      weekKey: week, target: 4, unit: "días", points: 20, audience: "all", trainerId: null,
      createdBy: roger.id, createdByName: "Roger", active: true,
    },
    {
      id: "ch0", title: "3 sesiones esta semana", description: "Completa tres sesiones en el centro.",
      weekKey: addDays(week, -7), target: 3, unit: "sesiones", points: 30, audience: "trainer", trainerId: tobias.id,
      createdBy: tobias.id, createdByName: "Tobias", active: true,
    },
  ];
  const today = todayKey();
  const challengeProgress: ChallengeProgress[] = [
    {
      id: `ch1_${laura.id}`, challengeId: "ch1", uid: laura.id, weekKey: week, trainerIds: laura.trainerIds,
      progress: 2, checkIns: [week, addDays(week, 1)].filter((d) => d <= today), note: "Hoy he ido andando al trabajo",
      completed: false, feedback: "", feedbackByName: "", feedbackAt: null, approved: false,
    },
    {
      id: `ch0_${laura.id}`, challengeId: "ch0", uid: laura.id, weekKey: addDays(week, -7), trainerIds: laura.trainerIds,
      progress: 3, checkIns: [], note: "", completed: true,
      feedback: "¡Gran semana, Laura! Mantén ese ritmo y sube un poco la carga en sentadilla.",
      feedbackByName: "Tobias", feedbackAt: new Date(Date.now() - 86_400_000), approved: true,
    },
    {
      id: `ch1_${marc.id}`, challengeId: "ch1", uid: marc.id, weekKey: week, trainerIds: marc.trainerIds,
      progress: 5, checkIns: [], note: "Hecho, ¡me ha costado el jueves!", completed: true,
      feedback: "", feedbackByName: "", feedbackAt: null, approved: false,
    },
  ];
  const leaderboard: LeaderboardEntry[] = [
    { id: `${week}_${laura.id}`, weekKey: week, uid: laura.id, displayName: "Laura M.", sessions: 1, challengePoints: 0, visible: true },
    { id: `${week}_${marc.id}`, weekKey: week, uid: marc.id, displayName: "Marc P.", sessions: 2, challengePoints: 0, visible: role !== "client" ? false : false },
    { id: `${week}_x1`, weekKey: week, uid: "x1", displayName: "Nuria G.", sessions: 3, challengePoints: 20, visible: true },
    { id: `${week}_x2`, weekKey: week, uid: "x2", displayName: "Pau R.", sessions: 2, challengePoints: 0, visible: true },
    { id: `${week}_x3`, weekKey: week, uid: "x3", displayName: "Carla S.", sessions: 1, challengePoints: 30, visible: true },
  ];
  const customTips: Tip[] = [
    {
      id: "tip1", title: "Proteína después de entrenar", category: "nutricion", custom: true,
      body: "Un yogur natural con fruta o un batido sencillo en la hora siguiente al entreno ayuda a recuperar.",
      createdByName: "Tobias", createdAt: new Date(Date.now() - 2 * 86_400_000),
    },
  ];
  return {
    challenges,
    challengeProgress: role === "client" ? challengeProgress.filter((p) => p.uid === laura.id) : challengeProgress,
    leaderboard: role === "client" ? leaderboard.filter((e) => e.visible) : leaderboard,
    myLeaderboardEntry: role === "client" ? leaderboard[0] : null,
    customTips,
  };
}

export function loadDemo(raw: string) {
  // ?demo=new → cliente recién dado de alta (ve la bienvenida).
  const isNew = raw === "new";
  const role = (isNew ? "client" : ["client", "trainer", "boss", "reserve"].includes(raw) ? raw : "client") as UserRole;
  const base = role === "client" ? laura : role === "trainer" ? tobias : role === "boss" ? roger : lydia;
  const current = isNew ? { ...laura, onboarded: false, termsAccepted: false, leaderboardOptIn: false } : base;
  store.startDemo(role, {
    ...engagement(role),
    currentUser: current,
    activePack: packOf(current),
    sessions: [...history(), ...sessions],
    bookings,
    rooms,
    staff,
    trainers: role === "client" ? [tobias, domi] : [roger, tobias, domi],
    managedUsers: role === "trainer" ? [laura, marc] : [laura, lydia, marc],
    clientCycleSummaries: { [laura.id]: { flow: "light", symptoms: ["Fatiga"], mood: "🙂", notes: "" } },
    chats:
      role === "trainer" || role === "boss"
        ? [
            {
              id: laura.id,
              clientId: laura.id,
              participantIds: [laura.id, tobias.id, domi.id],
              lastMessageText: "Perfecto, allí estaré.",
              lastMessageAt: new Date(Date.now() - 3_000_000),
              lastAuthorId: laura.id,
            },
          ]
        : [],
    nutritionPlan:
      role === "client"
        ? {
            clientId: laura.id,
            title: "Plan semana de fuerza",
            goal: "Recomposición corporal manteniendo energía para entrenar",
            meals: [
              { name: "Desayuno", description: "Avena (60 g) con yogur natural, fruta y un puñado de nueces." },
              { name: "Comida", description: "Arroz integral, pollo o legumbre y verdura a la plancha." },
              { name: "Merienda", description: "Fruta + queso fresco batido." },
              { name: "Cena", description: "Pescado al horno con patata y ensalada." },
            ],
            notes: "Bebe 2 litros de agua al día. Los días de entreno añade una pieza de fruta antes de la sesión.",
            updatedAt: new Date(Date.now() - 86_400_000),
            updatedByName: "Tobias",
          }
        : null,
    deletionRequests:
      role === "boss" ? [{ id: marc.id, email: marc.email, requestedAt: new Date(Date.now() - 2 * 86_400_000) }] : [],
    messages:
      role !== "reserve"
        ? [
            { id: "m1", author: "trainer", text: "¡Hola Laura! Mañana a las 10:45 en la sala de arriba 💪", timestamp: new Date(Date.now() - 3_600_000), isRead: true },
            { id: "m2", author: "user", text: "Perfecto, allí estaré.", timestamp: new Date(Date.now() - 3_000_000), isRead: true },
          ]
        : [],
  });
}
