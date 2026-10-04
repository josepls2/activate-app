// Port de ios/CodexGym/Models/DomainModels.swift.
// Las fechas de día se manejan como texto "AAAA-MM-DD" (igual que en Firestore).

export type UserRole = "client" | "trainer" | "boss" | "reserve";

export const roleLabel: Record<UserRole, string> = {
  client: "Cliente",
  trainer: "Entrenador",
  boss: "Dirección",
  reserve: "Usuario de sala",
};

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  trainerIds: string[];
  phone: string;
  dni: string;
  trainerStaffIds: string[];
  /** Una cuenta de Dirección también puede tener funciones de entrenador. */
  isTrainer: boolean;
  isMinor: boolean;
  guardianName: string | null;
  termsAccepted: boolean;
  imageConsent: boolean;
  /** El módulo de ciclo sólo existe en las cuentas donde Dirección lo activa. */
  cycleTrackingEnabled: boolean;
  cycleSharingEnabled: boolean;
  packId: string;
  packName: string;
  packTotalSessions: number;
  usedSessions: number;
  reservedSessions: number;
  remainingSessions: number;
  sessionDuration: number;
  /** active | deletion_requested | disabled */
  status: string;
  /** Clases por semana que se propone el cliente (1-7). */
  weeklyGoal: number;
  /** El cliente acepta aparecer (nombre + inicial) en la clasificación semanal. */
  leaderboardOptIn: boolean;
  /** Ha completado la bienvenida del primer acceso. */
  onboarded: boolean;
};

export type SessionStatus = "confirmed" | "pending" | "completed" | "cancelled";

export const sessionStatusLabel: Record<SessionStatus, string> = {
  confirmed: "Confirmada",
  pending: "Pendiente",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const sessionStatusTone: Record<SessionStatus, Tone> = {
  confirmed: "green",
  pending: "orange",
  completed: "blue",
  cancelled: "error",
};

export type GymSession = {
  id: string;
  date: string;
  time: string;
  duration: number;
  clientId: string;
  clientName: string;
  trainerId: string;
  trainerName: string;
  type: string;
  room: string;
  status: SessionStatus;
  trainerNotes: string | null;
  feedback: string | null;
  packSessionNumber: number | null;
  packTotalSessions: number | null;
  /** Completada sin asistencia (cuenta como usada, sin puntos). */
  noShow: boolean;
};

export type BookingStatus = "pending_trainer" | "pending_boss" | "confirmed" | "rejected" | "cancelled";

export const bookingStatusLabel: Record<BookingStatus, string> = {
  pending_trainer: "Asignando hora",
  pending_boss: "Pendiente del jefe",
  confirmed: "Confirmada",
  rejected: "Rechazada",
  cancelled: "Cancelada por ti",
};

export const bookingStatusTone: Record<BookingStatus, Tone> = {
  pending_trainer: "blue",
  pending_boss: "orange",
  confirmed: "green",
  rejected: "error",
  cancelled: "muted",
};

export type BookingKind = "training" | "room_rental";

export type BookingRequest = {
  id: string;
  clientId: string;
  clientName: string;
  trainerId: string;
  trainerName: string;
  kind: BookingKind;
  requestedDate: string;
  requestedTime: string | null;
  type: string;
  duration: number;
  room: string | null;
  status: BookingStatus;
  proposedTime: string | null;
  finalTime: string | null;
  trainerNotes: string | null;
  bossNotes: string | null;
};

export type GymRoom = {
  id: string;
  name: string;
  type: string;
  capacity: number;
};

/** Bloque anónimo de ocupación. No contiene nombres ni datos de clientes. */
export type OccupiedSlot = {
  id: string;
  date: string;
  time: string;
  duration: number;
  room: string;
  trainerId: string | null;
};

export type ChatReply = { id: string; text: string; authorId: string };

export type ChatMessage = {
  id: string;
  author: "user" | "trainer" | "ai";
  /** uid de quien escribe (para el nombre en chats con varios entrenadores). */
  authorId: string;
  text: string;
  timestamp: Date;
  isRead: boolean;
  /** Todavía no ha llegado al servidor (reloj en lugar de ✓). */
  pending?: boolean;
  /** Eliminado para todos por su autor. */
  deleted?: boolean;
  replyTo?: ChatReply | null;
};

export type TrainingPack = {
  id: string;
  name: string;
  totalSessions: number;
  usedSessions: number;
  reservedSessions: number;
  remainingSessions: number;
  duration: number;
};

export function packProgress(pack: TrainingPack) {
  return pack.totalSessions > 0 ? pack.usedSessions / pack.totalSessions : 0;
}

export type StaffKind = "trainer" | "physiotherapist" | "room_rental" | "physio_room_rental";

export const staffKindLabel: Record<StaffKind, string> = {
  trainer: "Entrenador",
  physiotherapist: "Fisioterapeuta",
  room_rental: "Alquiler de sala",
  physio_room_rental: "Alquiler sala de fisio",
};

export type StaffMember = {
  id: string;
  name: string;
  kind: StaffKind;
  authUid: string | null;
  email: string;
};

export type CycleFlow = "none" | "light" | "medium" | "heavy";

export const cycleFlows: CycleFlow[] = ["none", "light", "medium", "heavy"];

export const cycleFlowLabel: Record<CycleFlow, string> = {
  none: "Sin flujo",
  light: "Ligero",
  medium: "Medio",
  heavy: "Intenso",
};

export type CycleEntry = {
  flow: CycleFlow;
  symptoms: string[];
  mood: string;
  notes: string;
};

export const emptyCycleEntry = (): CycleEntry => ({
  flow: "none",
  symptoms: [],
  mood: "🙂",
  notes: "",
});

export type AppTab =
  | "home"
  | "clients"
  | "sessions"
  | "bookings"
  | "challenges"
  | "cycle"
  | "chat"
  | "nutrition"
  | "plan"
  | "tips"
  | "admin"
  | "profile";

export const tabLabel: Record<AppTab, string> = {
  home: "Inicio",
  clients: "Clientes",
  sessions: "Entrenos",
  bookings: "Reservas",
  challenges: "Retos",
  cycle: "Ciclo",
  chat: "Chat",
  nutrition: "Nutrición",
  plan: "Pack",
  tips: "Consejos",
  admin: "Gestión",
  profile: "Perfil",
};

/** Pestañas de la barra inferior para cada rol. */
export function availableTabs(user: AppUser | null): AppTab[] {
  switch (user?.role) {
    case "client":
      return ["home", "sessions", "challenges", "chat", "profile"];
    case "trainer":
      return ["home", "clients", "sessions", "bookings", "chat", "profile"];
    case "boss":
      // Roger es Dirección y entrenador con una sola cuenta: también chatea.
      return user.isTrainer
        ? ["home", "sessions", "bookings", "chat", "admin", "profile"]
        : ["home", "sessions", "bookings", "admin", "profile"];
    case "reserve":
      return ["sessions", "bookings", "plan", "profile"];
    default:
      return [];
  }
}

/** Pantallas secundarias (se abren desde Inicio o Perfil) y su pestaña madre. */
export function secondaryRoutes(user: AppUser | null): Partial<Record<AppTab, AppTab>> {
  switch (user?.role) {
    case "client":
      return {
        nutrition: "profile",
        plan: "profile",
        tips: "home",
        ...(user.cycleTrackingEnabled ? { cycle: "profile" as AppTab } : {}),
      };
    case "trainer":
      return { challenges: "home", tips: "home" };
    case "boss":
      return { clients: "home", challenges: "home", tips: "home" };
    case "reserve":
      return { tips: "profile" };
    default:
      return {};
  }
}

export function routeAllowed(user: AppUser | null, route: AppTab) {
  return availableTabs(user).includes(route) || route in secondaryRoutes(user);
}

/** Ruta base de la web ("/" o "/<repositorio>/" en GitHub Pages). */
export const BASE = import.meta.env.BASE_URL;
/** Sustituciones de imágenes (sólo la demo de un archivo las usa). */
let assetOverrides: Record<string, string> = {};
export function setAssetOverrides(map: Record<string, string>) {
  assetOverrides = map;
}
export const asset = (file: string) => assetOverrides[file] ?? `${BASE}${file}`;

export const ROOM_NAMES = ["Sala de arriba", "Sala de abajo", "Sala de fisio"] as const;

export type Tone = "green" | "orange" | "blue" | "error" | "red" | "muted";

// ---------- Horarios ----------

/** Horarios de reserva alineados con la duración real de cada bono. */
export function timeSlots(duration: number, openingHour = 7, lastStartHour = 21): string[] {
  const interval = duration === 60 ? 60 : 45;
  const values: string[] = [];
  for (let m = openingHour * 60; m <= lastStartHour * 60; m += interval) {
    values.push(formatMinutes(m));
  }
  return values;
}

export function normalizedTime(preferred: string | null | undefined, duration: number): string {
  const slots = timeSlots(duration);
  if (!preferred) return slots[0] ?? "07:00";
  if (slots.includes(preferred)) return preferred;
  const target = parseMinutes(preferred);
  if (target === null) return slots[0] ?? "07:00";
  return slots.reduce((best, slot) =>
    Math.abs(parseMinutes(slot)! - target) < Math.abs(parseMinutes(best)! - target) ? slot : best,
  );
}

export function parseMinutes(time: string): number | null {
  const parts = time.split(":").map((p) => Number(p));
  if (parts.length !== 2 || parts.some((p) => !Number.isFinite(p))) return null;
  return parts[0] * 60 + parts[1];
}

export function formatMinutes(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ---------- Fechas ----------

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey() {
  return dayKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = keyToDate(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** Medianoche local del día indicado. */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const longFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

export function formatLongDay(key: string) {
  return longFormatter.format(keyToDate(key));
}

export function formatShortDay(key: string) {
  return shortFormatter.format(keyToDate(key));
}

export function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase("es") + text.slice(1);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("es");
}

export function normalizeDocument(value: string) {
  return value.toLocaleUpperCase("es").replace(/[^A-Z0-9]/g, "");
}

export function roomKey(room: string) {
  switch (room) {
    case "Sala de arriba":
      return "upstairs";
    case "Sala de abajo":
      return "downstairs";
    case "Sala de fisio":
      return "physio";
    default:
      return "unknown";
  }
}

// ---------- Chat, nutrición y bajas ----------

export type ChatThread = {
  /** El id del chat es el uid del cliente. */
  id: string;
  clientId: string;
  participantIds: string[];
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  lastAuthorId: string | null;
  /** Último momento en que cada participante abrió la conversación (✓✓ y no leídos). */
  readBy: Record<string, Date>;
};

export type NutritionMeal = { name: string; description: string };

export type NutritionPlan = {
  clientId: string;
  title: string;
  goal: string;
  meals: NutritionMeal[];
  notes: string;
  updatedAt: Date | null;
  updatedByName: string;
};

export type DeletionRequest = {
  id: string;
  email: string;
  requestedAt: Date | null;
};

export const LIMITS = {
  name: 80,
  email: 120,
  phone: 30,
  document: 20,
  packName: 60,
  notes: 1000,
  feedback: 2000,
  message: 1000,
  planTitle: 80,
  planGoal: 300,
  planNotes: 2000,
  mealName: 40,
  mealDescription: 300,
  meals: 8,
  challengeTitle: 80,
  challengeDescription: 500,
  challengeUnit: 20,
  challengeNote: 300,
  tipTitle: 80,
  tipBody: 1000,
  trainerNotes: 4000,
} as const;

// ---------- Retos, clasificación y consejos ----------

/** Lunes (AAAA-MM-DD) de la semana de un día. */
export function weekStart(key: string): string {
  const date = keyToDate(key);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dayKey(date);
}

export function currentWeek() {
  return weekStart(todayKey());
}

const weekFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

export function weekLabel(week: string) {
  return `${weekFormatter.format(keyToDate(week))} – ${weekFormatter.format(keyToDate(addDays(week, 6)))}`;
}

/** "Laura Martín" → "Laura M." (lo que se ve en la clasificación). */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Cliente";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1][0].toLocaleUpperCase("es")}.`;
}

export type ChallengeAudience = "all" | "trainer";

export type Challenge = {
  id: string;
  title: string;
  description: string;
  weekKey: string;
  target: number;
  unit: string;
  points: number;
  audience: ChallengeAudience;
  /** Entrenador dueño del reto cuando audience = "trainer". */
  trainerId: string | null;
  createdBy: string;
  createdByName: string;
  active: boolean;
};

export type ChallengeProgress = {
  id: string;
  challengeId: string;
  uid: string;
  weekKey: string;
  trainerIds: string[];
  progress: number;
  checkIns: string[];
  note: string;
  completed: boolean;
  feedback: string;
  feedbackByName: string;
  feedbackAt: Date | null;
  approved: boolean;
};

export type LeaderboardEntry = {
  id: string;
  weekKey: string;
  uid: string;
  displayName: string;
  sessions: number;
  challengePoints: number;
  visible: boolean;
};

export const SESSION_POINTS = 10;

export function entryScore(entry: Pick<LeaderboardEntry, "sessions" | "challengePoints">) {
  return entry.sessions * SESSION_POINTS + entry.challengePoints;
}

export type TipCategory = "hidratacion" | "sueno" | "nutricion" | "movilidad" | "mente" | "habitos";

export const tipCategoryLabel: Record<TipCategory, string> = {
  hidratacion: "Hidratación",
  sueno: "Descanso",
  nutricion: "Nutrición",
  movilidad: "Movilidad",
  mente: "Mente",
  habitos: "Hábitos",
};

export type Tip = {
  id: string;
  title: string;
  body: string;
  category: TipCategory;
  createdByName: string;
  createdAt: Date | null;
  custom: boolean;
};
