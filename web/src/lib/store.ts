// Port de ios/CodexGym/Data/AppStore.swift.
// Mantiene el estado de la app, escucha Firestore en vivo y ejecuta las mismas
// transacciones que iOS, así que funciona con las reglas actuales (plan Spark).

import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type FirestoreError,
  type Firestore,
  type Query,
  type Transaction,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { firebaseAuth, firebaseConfigured, firebaseDb, provisioningAuth } from "./firebase";
import { forgetDevice, systemNotify } from "./notifications";
import {
  addDays,
  availableTabs,
  currentWeek,
  shortName,
  dayKey,
  emptyCycleEntry,
  formatShortDay,
  keyToDate,
  weekStart,
  formatMinutes,
  LIMITS,
  normalizeDocument,
  parseMinutes,
  roomKey,
  todayKey,
  type AppTab,
  type AppUser,
  type BookingKind,
  type BookingRequest,
  type BookingStatus,
  type ChatMessage,
  type Challenge,
  type ChallengeAudience,
  type ChallengeProgress,
  type ChatThread,
  type DeletionRequest,
  type LeaderboardEntry,
  type Tip,
  type TipCategory,
  type NutritionMeal,
  type NutritionPlan,
  type CycleEntry,
  type CycleFlow,
  type GymRoom,
  type GymSession,
  type OccupiedSlot,
  type SessionStatus,
  type StaffKind,
  type StaffMember,
  type TrainingPack,
  type UserRole,
} from "./domain";

export type AuthStatus = "checking" | "unconfigured" | "signed-out" | "ready";

export type AppState = {
  authStatus: AuthStatus;
  loginError: string | null;
  demo: boolean;
  currentUser: AppUser | null;
  sessions: GymSession[];
  bookings: BookingRequest[];
  rooms: GymRoom[];
  occupiedSlots: OccupiedSlot[];
  messages: ChatMessage[];
  /** Conversaciones del entrenador (o de Dirección con perfil de entrenador). */
  chats: ChatThread[];
  /** Chat propio del cliente (para saber si hay mensajes sin leer). */
  clientChat: ChatThread | null;
  /** Cambia al leer un chat para refrescar los indicadores de no leído. */
  chatSeenVersion: number;
  /** Chat abierto: el uid del cliente. */
  activeChatId: string | null;
  chatError: string | null;
  nutritionPlan: NutritionPlan | null;
  deletionRequests: DeletionRequest[];
  challenges: Challenge[];
  challengeProgress: ChallengeProgress[];
  /** Clasificación de la semana en curso (clientes: sólo quien es visible). */
  leaderboard: LeaderboardEntry[];
  myLeaderboardEntry: LeaderboardEntry | null;
  customTips: Tip[];
  activePack: TrainingPack;
  cycleEntries: Record<string, CycleEntry>;
  managedUsers: AppUser[];
  trainers: AppUser[];
  staff: StaffMember[];
  clientCycleSummaries: Record<string, CycleEntry>;
  toast: string | null;
};

const emptyPack: TrainingPack = {
  id: "active",
  name: "Bono",
  totalSessions: 0,
  usedSessions: 0,
  reservedSessions: 0,
  remainingSessions: 0,
  duration: 45,
};

const initialState = (): AppState => ({
  authStatus: firebaseConfigured ? "checking" : "unconfigured",
  loginError: null,
  demo: false,
  currentUser: null,
  sessions: [],
  bookings: [],
  rooms: [],
  occupiedSlots: [],
  messages: [],
  chats: [],
  clientChat: null,
  chatSeenVersion: 0,
  activeChatId: null,
  chatError: null,
  nutritionPlan: null,
  deletionRequests: [],
  challenges: [],
  challengeProgress: [],
  leaderboard: [],
  myLeaderboardEntry: null,
  customTips: [],
  activePack: emptyPack,
  cycleEntries: {},
  managedUsers: [],
  trainers: [],
  staff: [],
  clientCycleSummaries: {},
  toast: null,
});

export type CreateClientInput = {
  name: string;
  dni: string;
  email: string;
  phone: string;
  trainerStaffIds: string[];
  duration: number;
  packName: string;
  packSessions: number;
  isMinor: boolean;
  isRoomUser: boolean;
  isFemale: boolean;
  cycleTrackingEnabled: boolean;
  guardianName: string;
  guardianEmail: string;
};

class ActivateError extends Error {}

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, "es", { sensitivity: "base" });

export class AppStore {
  private state: AppState = initialState();
  private subscribers = new Set<() => void>();
  private dataListeners: Unsubscribe[] = [];
  private cycleListeners = new Map<string, Unsubscribe>();
  private messageListener: Unsubscribe | null = null;
  /** Invalida aperturas de chat en curso al cambiar de conversación. */
  private chatToken = 0;
  /** Listeners que ya entregaron su primera foto (no se avisa de lo que ya existía). */
  private primed = new Set<string>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (firebaseConfigured && firebaseAuth) {
      onAuthStateChanged(firebaseAuth, (user) => {
        if (this.state.demo) return;
        void this.handleAuthUser(user);
      });
    }
  }

  // ---------- Suscripción (useSyncExternalStore) ----------

  subscribe = (callback: () => void) => {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  };

  getState = () => this.state;

  private set(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    this.subscribers.forEach((cb) => cb());
  }

  showToast(text: string | null) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.set({ toast: text });
    if (text) {
      this.toastTimer = setTimeout(() => this.set({ toast: null }), 2600);
    }
  }

  // ---------- Derivados ----------

  get tabs(): AppTab[] {
    return availableTabs(this.state.currentUser);
  }

  visibleSessions(): GymSession[] {
    const { currentUser: user, sessions } = this.state;
    if (!user) return [];
    const filtered =
      user.role === "boss"
        ? sessions
        : user.role === "trainer"
          ? sessions.filter((s) => s.trainerId === user.id)
          : sessions.filter((s) => s.clientId === user.id);
    return [...filtered].sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
    );
  }

  visibleBookings(): BookingRequest[] {
    const { currentUser: user, bookings } = this.state;
    if (!user) return [];
    if (user.role === "boss") return bookings;
    if (user.role === "trainer") return bookings.filter((b) => b.trainerId === user.id);
    return bookings.filter((b) => b.clientId === user.id);
  }

  roomNames(): string[] {
    const names = this.state.rooms.map((r) => r.name);
    return names.length ? names : ["Sala de arriba", "Sala de abajo", "Sala de fisio"];
  }

  private occupancyIndex: {
    slots: OccupiedSlot[];
    sessions: GymSession[];
    byDay: Map<string, { room: string; trainerId: string | null; start: number; end: number }[]>;
  } | null = null;

  /** Bloques ocupados agrupados por día; se recalcula sólo cuando cambian los datos. */
  private occupiedByDay() {
    const { occupiedSlots, sessions } = this.state;
    if (this.occupancyIndex?.slots === occupiedSlots && this.occupancyIndex.sessions === sessions) {
      return this.occupancyIndex.byDay;
    }
    const blocks: OccupiedSlot[] = occupiedSlots.length
      ? occupiedSlots
      : sessions
          .filter((s) => s.status === "confirmed")
          .map((s) => ({
            id: s.id,
            date: s.date,
            time: s.time,
            duration: s.duration,
            room: s.room,
            trainerId: s.trainerId || null,
          }));
    const byDay = new Map<string, { room: string; trainerId: string | null; start: number; end: number }[]>();
    for (const block of blocks) {
      const start = parseMinutes(block.time) ?? 0;
      const list = byDay.get(block.date) ?? [];
      list.push({ room: block.room, trainerId: block.trainerId, start, end: start + block.duration });
      byDay.set(block.date, list);
    }
    this.occupancyIndex = { slots: occupiedSlots, sessions, byDay };
    return byDay;
  }

  isSlotOccupied(date: string, time: string, duration: number, room: string, trainerId: string | null) {
    const start = parseMinutes(time) ?? 0;
    const end = start + duration;
    const blocks = this.occupiedByDay().get(date);
    if (!blocks) return false;
    return blocks.some(
      (block) =>
        (block.room === room || (trainerId !== null && trainerId !== "" && block.trainerId === trainerId)) &&
        start < block.end &&
        block.start < end,
    );
  }

  cycleEntry(date: string): CycleEntry {
    return this.state.cycleEntries[date] ?? emptyCycleEntry();
  }

  // ---------- Acceso ----------

  /**
   * @param remember true: la sesión sigue abierta al cerrar el navegador.
   *                 false: se cierra al cerrar la pestaña (equipos compartidos).
   */
  async signIn(email: string, password: string, remember = true): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@") || !password) return "Introduce tu email y contraseña.";
    if (!firebaseAuth) return "Firebase no está configurado.";
    this.set({ loginError: null });
    try {
      await setPersistence(firebaseAuth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
      return null;
    } catch (error) {
      return authenticationMessage(error);
    }
  }

  /** Siempre responde lo mismo para no revelar qué emails tienen cuenta. */
  async resetPassword(email: string): Promise<{ ok: boolean; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { ok: false, message: "Escribe tu email para recibir el enlace." };
    }
    if (!firebaseAuth) return { ok: false, message: "Firebase no está configurado." };
    try {
      await sendPasswordResetEmail(firebaseAuth, normalizedEmail);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? "";
      if (code === "auth/network-request-failed") {
        return { ok: false, message: "No hay conexión. Revisa Internet e inténtalo de nuevo." };
      }
      if (code === "auth/too-many-requests") {
        return { ok: false, message: "Demasiados intentos. Espera unos minutos." };
      }
    }
    return {
      ok: true,
      message: "Si el email tiene cuenta en Activate, recibirás un enlace para crear una contraseña nueva.",
    };
  }

  async signOut() {
    this.stopDataSync();
    if (this.state.demo) {
      this.state = { ...initialState(), authStatus: "signed-out" };
      this.subscribers.forEach((cb) => cb());
      return;
    }
    const uid = this.state.currentUser?.id;
    if (uid) await forgetDevice(uid).catch(() => undefined);
    if (firebaseAuth) await firebaseSignOut(firebaseAuth).catch(() => undefined);
    this.set({ ...initialState(), authStatus: "signed-out" });
  }

  private async handleAuthUser(user: User | null) {
    this.stopDataSync();
    if (!user) {
      this.set({
        ...initialState(),
        authStatus: "signed-out",
        loginError: this.state.loginError,
      });
      return;
    }
    try {
      const snapshot = await getDoc(doc(this.db, "users", user.uid));
      const profile = userFromDoc(snapshot);
      if (!profile) {
        throw new ActivateError("Esta cuenta todavía no tiene un perfil de Activate.");
      }
      if (profile.status !== "active" && profile.role !== "boss") {
        throw new ActivateError(
          profile.status === "deletion_requested"
            ? "Esta cuenta tiene una solicitud de eliminación en curso. Contacta con Dirección."
            : "Esta cuenta está desactivada. Contacta con Dirección.",
        );
      }
      if (!profile.email) profile.email = user.email ?? "";
      this.set({ currentUser: profile, authStatus: "ready", loginError: null });
      this.startDataSync(profile);
      this.showToast("Sesión iniciada");
    } catch (error) {
      await firebaseSignOut(firebaseAuth!).catch(() => undefined);
      this.set({
        ...initialState(),
        authStatus: "signed-out",
        loginError: errorText(error),
      });
    }
  }

  private get db(): Firestore {
    if (!firebaseDb) throw new ActivateError("Firebase no está configurado.");
    return firebaseDb;
  }

  // ---------- Reservas ----------

  async requestSession(input: {
    date: string;
    time: string;
    type: string;
    trainerId?: string;
    room: string;
  }) {
    const client = this.state.currentUser;
    if (!client || (client.role !== "client" && client.role !== "reserve")) return;
    if (!client.termsAccepted) return this.showToast("Debes aceptar los términos antes de reservar");
    if (client.isMinor && !client.guardianName)
      return this.showToast("Falta el responsable legal de la cuenta");
    if (client.remainingSessions <= 0) return this.showToast("Tu bono no tiene sesiones disponibles");

    const isRoomRental = client.role === "reserve";
    const trainerId = isRoomRental ? "" : (input.trainerId ?? client.trainerIds[0] ?? "");
    if (!isRoomRental && !client.trainerIds.includes(trainerId)) {
      return this.showToast("Selecciona uno de tus entrenadores asignados");
    }
    const trainerName = isRoomRental
      ? "Dirección"
      : (this.state.trainers.find((t) => t.id === trainerId)?.name ?? "Entrenador");

    const booking: Omit<BookingRequest, "id"> = {
      clientId: client.id,
      clientName: client.name,
      trainerId,
      trainerName,
      kind: isRoomRental ? "room_rental" : "training",
      requestedDate: input.date,
      requestedTime: input.time,
      type: isRoomRental ? "Uso de sala" : input.type,
      duration: client.sessionDuration,
      room: input.room,
      status: isRoomRental ? "pending_boss" : "pending_trainer",
      proposedTime: input.time,
      finalTime: null,
      trainerNotes: null,
      bossNotes: null,
    };
    const okMessage = isRoomRental ? "Solicitud enviada a Dirección" : "Solicitud enviada al entrenador";

    if (this.state.demo) {
      this.set({ bookings: [...this.state.bookings, { ...booking, id: demoId() }] });
      return this.showToast(okMessage);
    }

    try {
      const reference = doc(collection(this.db, "bookingRequests"));
      await setDoc(reference, {
        ...booking,
        createdAt: serverTimestamp(),
        modifiedAt: serverTimestamp(),
      });
      this.showToast(okMessage);
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  /** El entrenador asignado (o Dirección) confirma un entrenamiento. */
  async proposeTime(requestId: string, time: string, notes: string, room: string) {
    const user = this.state.currentUser;
    const request = this.state.bookings.find(
      (b) => b.id === requestId && b.status === "pending_trainer",
    );
    if (!user || !request) return;
    if (!(user.role === "boss" || (user.role === "trainer" && request.trainerId === user.id))) return;
    await this.confirmBookingInFirestore(request, time, room, notes);
  }

  /** Dirección confirma una reserva de sala. */
  async confirmBooking(requestId: string, time: string, room: string) {
    const request = this.state.bookings.find((b) => b.id === requestId && b.status === "pending_boss");
    if (this.state.currentUser?.role !== "boss" || !request) return;
    await this.confirmBookingInFirestore(request, time, room, "");
  }

  private async confirmBookingInFirestore(
    request: BookingRequest,
    time: string,
    room: string,
    notes: string,
  ) {
    const actor = this.state.currentUser;
    if (!actor) return;
    const okMessage = request.kind === "room_rental" ? "Reserva de sala confirmada" : "Entrenamiento confirmado";

    if (this.state.demo) {
      const client = this.state.managedUsers.find((u) => u.id === request.clientId);
      const session: GymSession = {
        id: request.id,
        date: request.requestedDate,
        time,
        duration: request.duration,
        clientId: request.clientId,
        clientName: request.clientName,
        trainerId: request.trainerId,
        trainerName: request.trainerName,
        type: request.type,
        room,
        status: "confirmed",
        trainerNotes: notes || null,
        feedback: null,
        packSessionNumber: client ? client.usedSessions + client.reservedSessions + 1 : null,
        packTotalSessions: client?.packTotalSessions ?? null,
        noShow: false,
      };
      this.set({
        bookings: this.state.bookings.map((b) =>
          b.id === request.id ? { ...b, status: "confirmed", finalTime: time, room } : b,
        ),
        sessions: [...this.state.sessions, session],
      });
      return this.showToast(okMessage);
    }

    const db = this.db;
    const bookingRef = doc(db, "bookingRequests", request.id);
    const sessionRef = doc(db, "sessions", request.id);
    const clientRef = doc(db, "users", request.clientId);
    const locks = occupancyDocuments(db, {
      sessionId: request.id,
      kind: request.kind,
      date: request.requestedDate,
      time,
      duration: request.duration,
      room,
      trainerId: request.trainerId,
    });

    try {
      await runTransaction(db, async (tx) => {
        const bookingSnap = await tx.get(bookingRef);
        const clientSnap = await tx.get(clientRef);
        const booking = bookingSnap.data();
        const client = clientSnap.data();
        if (!booking || !client || !["pending_trainer", "pending_boss"].includes(booking.status)) {
          throw new ActivateError("La solicitud ya no está pendiente.");
        }
        const remaining = num(client.remainingSessions);
        const reserved = num(client.reservedSessions);
        const used = num(client.usedSessions);
        const total = num(client.packTotalSessions);
        if (remaining <= 0) throw new ActivateError("El bono no tiene sesiones disponibles.");

        for (const lock of locks) {
          if ((await tx.get(lock.ref)).exists()) {
            throw new ActivateError("El entrenador o la sala ya están ocupados en esa franja.");
          }
        }

        tx.update(bookingRef, {
          status: "confirmed",
          finalTime: time,
          room,
          trainerNotes: notes || null,
          sessionId: request.id,
          modifiedAt: serverTimestamp(),
        });
        tx.set(sessionRef, {
          bookingRequestId: request.id,
          kind: request.kind,
          clientId: request.clientId,
          clientName: request.clientName,
          trainerId: request.trainerId,
          trainerName: request.trainerName,
          date: request.requestedDate,
          time,
          duration: request.duration,
          room,
          type: request.type,
          status: "confirmed",
          trainerNotes: notes || null,
          feedback: null,
          packSessionNumber: used + reserved + 1,
          packTotalSessions: total,
          createdAt: serverTimestamp(),
          modifiedAt: serverTimestamp(),
          modifiedBy: actor.id,
        });
        tx.update(clientRef, {
          reservedSessions: reserved + 1,
          remainingSessions: remaining - 1,
          lastSessionId: request.id,
          modifiedAt: serverTimestamp(),
          modifiedBy: actor.id,
        });
        for (const lock of locks) tx.set(lock.ref, lock.data);
        writeAudit(
          db,
          tx,
          actor.id,
          request.kind === "room_rental" ? "confirm_room_booking" : "confirm_training_booking",
          request.id,
        );
      });
      this.showToast(okMessage);
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  async rejectBooking(requestId: string) {
    const actor = this.state.currentUser;
    const request = this.state.bookings.find((b) => b.id === requestId);
    if (!actor || !request) return;
    const allowed =
      actor.role === "boss" ||
      (actor.role === "trainer" && request.trainerId === actor.id && request.kind === "training");
    if (!allowed) return;

    if (this.state.demo) {
      this.set({
        bookings: this.state.bookings.map((b) => (b.id === requestId ? { ...b, status: "rejected" } : b)),
      });
      return this.showToast("Solicitud rechazada");
    }

    const db = this.db;
    const batch = writeBatch(db);
    batch.update(doc(db, "bookingRequests", requestId), {
      status: "rejected",
      rejectionReason: "No disponible",
      modifiedAt: serverTimestamp(),
    });
    writeAudit(db, batch, actor.id, "reject_booking", requestId);
    try {
      await batch.commit();
      this.showToast("Solicitud rechazada");
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  // ---------- Sesiones ----------

  /**
   * Completa una sesión. Si el cliente asistió, suma la sesión a su
   * clasificación semanal (misma transacción).
   */
  async completeSession(sessionId: string, feedback: string, noShow = false) {
    const actor = this.state.currentUser;
    const session = this.state.sessions.find((s) => s.id === sessionId && s.status === "confirmed");
    if (!actor || !session) return;
    if (!(actor.role === "boss" || (actor.role === "trainer" && session.trainerId === actor.id))) return;
    const okMessage = noShow ? "Marcada como no presentada" : "Sesión completada";

    if (this.state.demo) {
      this.set({
        sessions: this.state.sessions.map((s) =>
          s.id === sessionId ? { ...s, status: "completed", feedback: feedback || null, noShow } : s,
        ),
      });
      return this.showToast(okMessage);
    }

    const db = this.db;
    const sessionRef = doc(db, "sessions", sessionId);
    const clientRef = doc(db, "users", session.clientId);
    const week = weekStart(session.date);
    const entryRef = doc(db, "leaderboard", `${week}_${session.clientId}`);
    try {
      await runTransaction(db, async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const clientSnap = await tx.get(clientRef);
        const client = clientSnap.data();
        if (sessionSnap.data()?.status !== "confirmed" || !client) {
          throw new ActivateError("La sesión ya no está confirmada.");
        }
        const countsForRanking = !noShow && client.role === "client";
        const entrySnap = countsForRanking ? await tx.get(entryRef) : null;
        const used = num(client.usedSessions);
        const reserved = num(client.reservedSessions);
        if (reserved <= 0) throw new ActivateError("El saldo reservado no es válido.");
        tx.update(sessionRef, {
          status: "completed",
          feedback: feedback.trim().slice(0, LIMITS.feedback) || null,
          noShow,
          modifiedAt: serverTimestamp(),
          modifiedBy: actor.id,
        });
        tx.update(clientRef, {
          usedSessions: used + 1,
          reservedSessions: reserved - 1,
          lastSessionId: sessionId,
          modifiedAt: serverTimestamp(),
          modifiedBy: actor.id,
        });
        if (countsForRanking && entrySnap) {
          const previous = entrySnap.data();
          tx.set(entryRef, {
            weekKey: week,
            uid: session.clientId,
            displayName: shortName(str(client.name, "Cliente")),
            sessions: Math.min(50, num(previous?.sessions) + 1),
            challengePoints: num(previous?.challengePoints),
            visible: client.leaderboardOptIn === true,
            updatedAt: serverTimestamp(),
          });
        }
        writeAudit(
          db,
          tx,
          actor.id,
          noShow ? "no_show_session" : session.trainerId ? "complete_session" : "complete_room_booking",
          sessionId,
        );
      });
      this.showToast(okMessage);
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  async rescheduleSession(sessionId: string, date: string, time: string, room: string) {
    const actor = this.state.currentUser;
    const session = this.state.sessions.find((s) => s.id === sessionId && s.status === "confirmed");
    if (actor?.role !== "boss" || !session) return false;

    if (this.state.demo) {
      this.set({
        sessions: this.state.sessions.map((s) => (s.id === sessionId ? { ...s, date, time, room } : s)),
      });
      this.showToast("Sesión actualizada");
      return true;
    }

    const db = this.db;
    const sessionRef = doc(db, "sessions", sessionId);
    const kind: BookingKind = session.trainerId ? "training" : "room_rental";
    const oldLocks = occupancyDocuments(db, { ...session, sessionId, kind });
    const newLocks = occupancyDocuments(db, { ...session, sessionId, kind, date, time, room });
    const oldIds = new Set(oldLocks.map((l) => l.ref.id));
    const newIds = new Set(newLocks.map((l) => l.ref.id));
    const toDelete = oldLocks.filter((l) => !newIds.has(l.ref.id));
    const toCreate = newLocks.filter((l) => !oldIds.has(l.ref.id));

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(sessionRef);
        if (snap.data()?.status !== "confirmed") throw new ActivateError("La sesión ya no está confirmada.");
        for (const lock of toCreate) {
          if ((await tx.get(lock.ref)).exists()) throw new ActivateError("Esa franja ya está ocupada.");
        }
        tx.update(sessionRef, {
          date,
          time,
          room,
          modifiedAt: serverTimestamp(),
          modifiedBy: actor.id,
        });
        for (const lock of toDelete) tx.delete(lock.ref);
        for (const lock of toCreate) tx.set(lock.ref, lock.data);
        writeAudit(db, tx, actor.id, "reschedule_session", sessionId);
      });
      this.showToast("Sesión actualizada");
      return true;
    } catch (error) {
      this.showToast(errorText(error));
      return false;
    }
  }

  async cancelSession(sessionId: string) {
    const actor = this.state.currentUser;
    const session = this.state.sessions.find((s) => s.id === sessionId && s.status === "confirmed");
    if (actor?.role !== "boss" || !session) return;

    if (this.state.demo) {
      this.set({
        sessions: this.state.sessions.map((s) => (s.id === sessionId ? { ...s, status: "cancelled" } : s)),
      });
      return this.showToast("Sesión cancelada");
    }

    const db = this.db;
    const sessionRef = doc(db, "sessions", sessionId);
    const clientRef = doc(db, "users", session.clientId);
    const locks = occupancyDocuments(db, {
      ...session,
      sessionId,
      kind: session.trainerId ? "training" : "room_rental",
    });
    try {
      await runTransaction(db, async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const clientSnap = await tx.get(clientRef);
        const client = clientSnap.data();
        if (sessionSnap.data()?.status !== "confirmed" || !client) {
          throw new ActivateError("La sesión ya no está confirmada.");
        }
        const reserved = num(client.reservedSessions);
        const remaining = num(client.remainingSessions);
        if (reserved <= 0) throw new ActivateError("El saldo reservado no es válido.");
        tx.update(sessionRef, {
          status: "cancelled",
          cancellationReason: "Cancelada por Dirección",
          modifiedAt: serverTimestamp(),
          modifiedBy: actor.id,
        });
        tx.update(clientRef, {
          reservedSessions: reserved - 1,
          remainingSessions: remaining + 1,
          lastSessionId: sessionId,
          modifiedAt: serverTimestamp(),
          modifiedBy: actor.id,
        });
        for (const lock of locks) tx.delete(lock.ref);
        writeAudit(db, tx, actor.id, "cancel_session", sessionId);
      });
      this.showToast("Sesión cancelada");
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  // ---------- Chat ----------

  /** Abre la conversación de un cliente (el cliente siempre abre la suya). */
  async openChat(clientId: string) {
    const user = this.state.currentUser;
    if (!user) return;
    this.detachChat();
    const token = this.chatToken;
    this.set({ activeChatId: clientId, messages: this.state.demo ? this.state.messages : [], chatError: null });
    if (this.state.demo) return;

    const db = this.db;
    const chatRef = doc(db, "chats", clientId);
    try {
      if (user.role === "client") {
        // Crea el chat si no existe y refresca los entrenadores actuales.
        await setDoc(
          chatRef,
          { participantIds: [user.id, ...user.trainerIds], clientId: user.id, modifiedAt: serverTimestamp() },
          { merge: true },
        );
      } else if (!this.state.chats.some((c) => c.id === clientId)) {
        const client = this.state.managedUsers.find((u) => u.id === clientId);
        if (!client) throw new ActivateError("No se ha encontrado al cliente.");
        let exists = false;
        try {
          exists = (await getDoc(chatRef)).exists();
        } catch {
          exists = false; // Un chat inexistente no se puede leer: se crea.
        }
        if (!exists) {
          await setDoc(chatRef, {
            participantIds: [client.id, ...client.trainerIds],
            clientId: client.id,
            modifiedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      this.set({ chatError: errorText(error) });
      return;
    }

    if (token !== this.chatToken || this.state.activeChatId !== clientId) return;
    this.messageListener = onSnapshot(
      query(collection(db, "chats", clientId, "messages"), orderBy("timestamp"), limitToLast(200)),
      (snap) => {
        this.markChatSeen(clientId);
        this.set({
          messages: snap.docs
            .map((d) => messageFromData(d.id, d.data(), user.id))
            .filter(isDefined),
        });
      },
      (error) => this.set({ chatError: errorText(error) }),
    );
  }

  /** Vuelve a la bandeja (botón atrás). */
  closeChat() {
    this.detachChat();
    this.set({ activeChatId: null, messages: this.state.demo ? this.state.messages : [], chatError: null });
  }

  /** Deja de escuchar al salir de la pestaña; se recupera al volver. */
  detachChat() {
    this.chatToken += 1;
    this.messageListener?.();
    this.messageListener = null;
  }

  async sendMessage(text: string) {
    const user = this.state.currentUser;
    const chatId = this.state.activeChatId ?? (user?.role === "client" ? user.id : null);
    const normalized = text.trim().slice(0, LIMITS.message);
    if (!user || !chatId || !normalized) return;

    if (this.state.demo) {
      this.set({
        messages: [
          ...this.state.messages,
          { id: demoId(), author: "user", text: normalized, timestamp: new Date(), isRead: false },
        ],
      });
      return;
    }

    const db = this.db;
    const chatRef = doc(db, "chats", chatId);
    const batch = writeBatch(db);
    const summary = {
      modifiedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessageText: normalized.slice(0, 140),
      lastAuthorId: user.id,
    };
    if (user.role === "client") {
      batch.set(
        chatRef,
        { participantIds: [user.id, ...user.trainerIds], clientId: user.id, ...summary },
        { merge: true },
      );
    } else {
      batch.update(chatRef, summary);
    }
    batch.set(doc(collection(chatRef, "messages")), {
      authorId: user.id,
      authorRole: user.role,
      text: normalized,
      timestamp: serverTimestamp(),
      isRead: false,
    });
    try {
      await batch.commit();
      if (!this.messageListener) await this.openChat(chatId);
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  /** Marca local (por dispositivo) de último mensaje visto, para el punto de no leído. */
  private markChatSeen(chatId: string) {
    const uid = this.state.currentUser?.id;
    if (!uid) return;
    try {
      localStorage.setItem(`activate.chatSeen.${uid}.${chatId}`, String(Date.now()));
    } catch {
      /* almacenamiento no disponible */
    }
    this.set({ chatSeenVersion: this.state.chatSeenVersion + 1 });
  }

  unreadChatCount(): number {
    const { currentUser, clientChat, chats, activeChatId } = this.state;
    if (!currentUser) return 0;
    if (currentUser.role === "client") {
      return clientChat && activeChatId !== currentUser.id && this.chatHasUnread(clientChat) ? 1 : 0;
    }
    return chats.filter((t) => t.id !== activeChatId && this.chatHasUnread(t)).length;
  }

  // ---------- Avisos ----------

  /** true sólo la primera vez que un listener entrega datos. */
  private isFirst(key: string) {
    if (this.primed.has(key)) return false;
    this.primed.add(key);
    return true;
  }

  private announce(title: string, body: string, tab: AppTab, tag: string) {
    const user = this.state.currentUser;
    if (!user || this.state.demo) return;
    this.showToast(`${title} · ${body}`);
    void systemNotify(user.id, title, body, tab, tag);
  }

  private diffBookings(prev: BookingRequest[], next: BookingRequest[]) {
    const user = this.state.currentUser;
    if (!user) return;
    const before = new Map(prev.map((b) => [b.id, b]));
    for (const b of next) {
      const old = before.get(b.id);
      const when = `${formatShortDay(b.requestedDate)} · ${b.finalTime ?? b.requestedTime ?? ""}`.trim();
      if (!old) {
        if (b.status === "pending_trainer" && b.trainerId === user.id) {
          this.announce("Nueva solicitud", `${b.clientName} · ${when}`, "bookings", `booking-${b.id}`);
        } else if (b.status === "pending_boss" && user.role === "boss") {
          this.announce("Nueva reserva de sala", `${b.clientName} · ${when}`, "bookings", `booking-${b.id}`);
        }
      } else if (old.status !== b.status && b.clientId === user.id) {
        if (b.status === "confirmed") {
          this.announce("Sesión confirmada", `${when}${b.room ? ` · ${b.room}` : ""}`, "sessions", `booking-${b.id}`);
        } else if (b.status === "rejected") {
          this.announce("Solicitud no disponible", `${b.type} · ${formatShortDay(b.requestedDate)}`, "sessions", `booking-${b.id}`);
        }
      }
    }
  }

  private diffSessions(prev: GymSession[], next: GymSession[]) {
    const user = this.state.currentUser;
    if (!user) return;
    const before = new Map(prev.map((s) => [s.id, s]));
    for (const s of next) {
      const old = before.get(s.id);
      if (!old || (s.clientId !== user.id && s.trainerId !== user.id)) continue;
      const when = `${formatShortDay(s.date)} a las ${s.time}`;
      if (old.status === "confirmed" && s.status === "cancelled") {
        this.announce("Sesión cancelada", when, "sessions", `session-${s.id}`);
      } else if (
        s.status === "confirmed" &&
        (old.date !== s.date || old.time !== s.time || old.room !== s.room)
      ) {
        this.announce("Sesión reprogramada", `${when} · ${s.room}`, "sessions", `session-${s.id}`);
      } else if (old.status === "confirmed" && s.status === "completed" && s.clientId === user.id && s.feedback) {
        this.announce(`Feedback de ${s.trainerName}`, s.feedback.slice(0, 120), "sessions", `session-${s.id}`);
      }
    }
  }

  private isNewIncoming(old: ChatThread | null | undefined, next: ChatThread) {
    const uid = this.state.currentUser?.id;
    if (!next.lastMessageAt || !next.lastAuthorId || next.lastAuthorId === uid) return false;
    if (this.state.activeChatId === next.id) return false;
    return !old?.lastMessageAt || old.lastMessageAt.getTime() < next.lastMessageAt.getTime();
  }

  chatHasUnread(thread: ChatThread): boolean {
    const uid = this.state.currentUser?.id;
    if (!uid || !thread.lastMessageAt || thread.lastAuthorId === uid) return false;
    try {
      const seen = Number(localStorage.getItem(`activate.chatSeen.${uid}.${thread.id}`) ?? 0);
      return thread.lastMessageAt.getTime() > seen;
    } catch {
      return false;
    }
  }

  // ---------- Nutrición ----------

  async loadNutritionPlan(clientId: string): Promise<NutritionPlan | null> {
    if (this.state.demo) {
      return this.state.nutritionPlan?.clientId === clientId ? this.state.nutritionPlan : null;
    }
    const snap = await getDoc(doc(this.db, "nutritionPlans", clientId));
    return snap.exists() ? planFromData(snap.data()) : null;
  }

  async saveNutritionPlan(
    clientId: string,
    input: { title: string; goal: string; meals: NutritionMeal[]; notes: string },
  ): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user || !(user.role === "boss" || user.isTrainer)) return "No tienes permiso para publicar planes.";
    const title = input.title.trim().slice(0, LIMITS.planTitle);
    if (!title) return "Pon un título al plan.";
    const meals = input.meals
      .map((m) => ({
        name: m.name.trim().slice(0, LIMITS.mealName),
        description: m.description.trim().slice(0, LIMITS.mealDescription),
      }))
      .filter((m) => m.name || m.description)
      .slice(0, LIMITS.meals);
    const plan = {
      clientId,
      title,
      goal: input.goal.trim().slice(0, LIMITS.planGoal),
      meals,
      notes: input.notes.trim().slice(0, LIMITS.planNotes),
      updatedByName: user.name.slice(0, LIMITS.name),
    };

    if (this.state.demo) {
      this.set({ nutritionPlan: { ...plan, updatedAt: new Date() } });
      this.showToast("Plan nutricional publicado");
      return null;
    }
    try {
      await setDoc(doc(this.db, "nutritionPlans", clientId), {
        ...plan,
        updatedAt: serverTimestamp(),
        updatedBy: user.id,
      });
      this.showToast("Plan nutricional publicado");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  // ---------- Ciclo ----------

  async saveCycleEntry(entry: CycleEntry, date: string) {
    this.set({ cycleEntries: { ...this.state.cycleEntries, [date]: entry } });
    this.showToast("Registro de ciclo guardado");
    const user = this.state.currentUser;
    if (!user || user.role !== "client" || this.state.demo) return;
    try {
      await setDoc(
        doc(this.db, "users", user.id, "cycleEntries", date),
        {
          date,
          flow: entry.flow,
          symptoms: entry.symptoms,
          mood: entry.mood,
          notes: entry.notes,
          modifiedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (user.cycleTrackingEnabled && user.cycleSharingEnabled) {
        await setDoc(
          doc(this.db, "users", user.id, "cycleSummaries", date),
          { date, flow: entry.flow, symptoms: entry.symptoms, mood: entry.mood, modifiedAt: serverTimestamp() },
          { merge: true },
        );
      }
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  async setCycleSharingEnabled(enabled: boolean) {
    const user = this.state.currentUser;
    if (!user || user.role !== "client" || !user.cycleTrackingEnabled) return;
    this.set({ currentUser: { ...user, cycleSharingEnabled: enabled } });
    if (this.state.demo) return;
    try {
      await updateDoc(doc(this.db, "users", user.id), {
        cycleSharingEnabled: enabled,
        modifiedAt: serverTimestamp(),
      });
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  // ---------- Dirección ----------

  async createClient(input: CreateClientInput): Promise<string | null> {
    const boss = this.state.currentUser;
    if (boss?.role !== "boss") return "No tienes permisos de Dirección.";
    if (![45, 60].includes(input.duration) || input.packSessions <= 0) {
      return "Revisa la duración y el número de sesiones.";
    }
    if (!input.isRoomUser && input.trainerStaffIds.length === 0) return "Asigna al menos un entrenador.";
    if (input.cycleTrackingEnabled && !input.isFemale) {
      return "El seguimiento de ciclo sólo puede activarse en una clienta.";
    }
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedDni = normalizeDocument(input.dni);
    if (normalizedDni.length < 6) return "Introduce un DNI, NIE o documento válido.";

    const selectedStaff = this.state.staff.filter(
      (s) => s.kind === "trainer" && input.trainerStaffIds.includes(s.id),
    );
    const trainerIds = selectedStaff.map((s) => s.authUid).filter((id): id is string => Boolean(id));
    const trainerNames = selectedStaff.map((s) => s.name);
    const isRoomUser = input.isRoomUser;
    const isMinor = !isRoomUser && input.isMinor;
    const isFemale = !isRoomUser && input.isFemale;

    if (this.state.demo) {
      const user: AppUser = {
        ...demoUserBase(),
        id: demoId(),
        email: normalizedEmail,
        name: input.name.trim(),
        role: isRoomUser ? "reserve" : "client",
        trainerIds: isRoomUser ? [] : trainerIds,
        trainerStaffIds: isRoomUser ? [] : input.trainerStaffIds,
        phone: input.phone,
        dni: input.dni.trim().toUpperCase(),
        isMinor,
        guardianName: isMinor ? input.guardianName : null,
        cycleTrackingEnabled: isFemale && input.cycleTrackingEnabled,
        packName: input.packName,
        packTotalSessions: input.packSessions,
        remainingSessions: input.packSessions,
        sessionDuration: input.duration,
      };
      this.set({ managedUsers: [...this.state.managedUsers, user].sort(byName) });
      this.showToast(isRoomUser ? "Usuario de sala creado; acceso enviado por email" : "Cliente creado; acceso enviado por email");
      return null;
    }

    const db = this.db;
    const documentRef = doc(db, "clientDocuments", normalizedDni);
    try {
      if ((await getDoc(documentRef)).exists()) return "Este documento ya está vinculado a otro cliente.";
    } catch (error) {
      return errorText(error);
    }

    const secondaryAuth = provisioningAuth();
    let createdUser: User | null = null;
    try {
      const password = `Activate-${crypto.randomUUID()}-Aa1!`;
      const result = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password);
      createdUser = result.user;

      const batch = writeBatch(db);
      batch.set(doc(db, "users", result.user.uid), {
        uid: result.user.uid,
        dni: input.dni.trim().toUpperCase(),
        normalizedDni,
        email: normalizedEmail,
        name: input.name.trim(),
        phone: input.phone,
        role: isRoomUser ? "reserve" : "client",
        isTrainer: false,
        trainerIds: isRoomUser ? [] : trainerIds,
        trainerStaffIds: isRoomUser ? [] : input.trainerStaffIds,
        trainerNames: isRoomUser ? [] : trainerNames,
        allowedRoomIds: isRoomUser ? ["upstairs", "downstairs", "physio"] : [],
        packId: crypto.randomUUID(),
        packName: input.packName,
        packTotalSessions: input.packSessions,
        usedSessions: 0,
        reservedSessions: 0,
        remainingSessions: input.packSessions,
        sessionDuration: input.duration,
        isMinor,
        guardianName: isMinor ? input.guardianName : null,
        guardianEmail: isMinor ? input.guardianEmail : null,
        termsAccepted: false,
        termsVersion: null,
        imageConsent: false,
        gender: isFemale ? "female" : "unspecified",
        cycleTrackingEnabled: isFemale && input.cycleTrackingEnabled,
        cycleSharingEnabled: false,
        status: "active",
        createdBy: boss.id,
        createdAt: serverTimestamp(),
        modifiedBy: boss.id,
        modifiedAt: serverTimestamp(),
      });
      batch.set(documentRef, {
        userId: result.user.uid,
        normalizedDni,
        createdAt: serverTimestamp(),
        createdBy: boss.id,
      });
      writeAudit(db, batch, boss.id, isRoomUser ? "create_room_user" : "create_client", result.user.uid);
      await batch.commit();
      await sendPasswordResetEmail(secondaryAuth, normalizedEmail);
      await firebaseSignOut(secondaryAuth);
      this.showToast(isRoomUser ? "Usuario de sala creado; acceso enviado por email" : "Cliente creado; acceso enviado por email");
      return null;
    } catch (error) {
      if (createdUser) await deleteUser(createdUser).catch(() => undefined);
      await firebaseSignOut(secondaryAuth).catch(() => undefined);
      return errorText(error);
    }
  }

  async addPack(clientId: string, sessions: number, duration: number, name: string): Promise<string | null> {
    const boss = this.state.currentUser;
    if (boss?.role !== "boss") return "No tienes permisos de Dirección.";
    if (sessions <= 0 || ![45, 60].includes(duration)) return "Revisa el bono.";

    if (this.state.demo) {
      this.set({
        managedUsers: this.state.managedUsers.map((u) =>
          u.id === clientId
            ? {
                ...u,
                packName: name,
                packTotalSessions: u.packTotalSessions + sessions,
                remainingSessions: u.remainingSessions + sessions,
                sessionDuration: duration,
              }
            : u,
        ),
      });
      this.showToast("Bono actualizado");
      return null;
    }

    const db = this.db;
    const reference = doc(db, "users", clientId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(reference);
        const data = snap.data();
        if (!data || !["client", "reserve"].includes(data.role)) throw new ActivateError("La cuenta no existe.");
        const total = num(data.packTotalSessions);
        const remaining = num(data.remainingSessions);
        const reserved = num(data.reservedSessions);
        const currentDuration = num(data.sessionDuration, 45);
        if (!(remaining + reserved === 0 || currentDuration === duration)) {
          throw new ActivateError("No se puede cambiar la duración mientras quede saldo del bono actual.");
        }
        tx.update(reference, {
          packName: name,
          packTotalSessions: total + sessions,
          remainingSessions: remaining + sessions,
          sessionDuration: duration,
          modifiedAt: serverTimestamp(),
          modifiedBy: boss.id,
        });
        writeAudit(db, tx, boss.id, "add_pack_sessions", clientId);
      });
      this.showToast("Bono actualizado");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  /** Crea la cuenta de acceso de un entrenador del directorio (port de admin-web). */
  async activateStaff(staffId: string, email: string): Promise<string | null> {
    const boss = this.state.currentUser;
    if (boss?.role !== "boss") return "No tienes permisos de Dirección.";
    const member = this.state.staff.find((s) => s.id === staffId);
    if (!member || member.kind !== "trainer") return "Sólo se puede activar el acceso de entrenadores.";
    if (member.authUid) return "Este acceso ya está activado.";
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return "Introduce el email real del entrenador.";

    if (this.state.demo) {
      const uid = demoId();
      this.set({
        staff: this.state.staff.map((s) => (s.id === staffId ? { ...s, authUid: uid, email: normalizedEmail } : s)),
        managedUsers: this.state.managedUsers.map((u) =>
          u.trainerStaffIds.includes(staffId) ? { ...u, trainerIds: [...new Set([...u.trainerIds, uid])] } : u,
        ),
      });
      this.showToast(`Acceso activado para ${member.name}`);
      return null;
    }

    const db = this.db;
    const secondaryAuth = provisioningAuth();
    try {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizedEmail,
        `Activate-${crypto.randomUUID()}-Aa1!`,
      );
      const created = credential.user;
      try {
        const assigned = await getDocs(
          query(collection(db, "users"), where("trainerStaffIds", "array-contains", staffId)),
        );
        const batch = writeBatch(db);
        batch.set(doc(db, "users", created.uid), {
          uid: created.uid,
          email: normalizedEmail,
          name: member.name,
          phone: "",
          role: "trainer",
          isTrainer: true,
          staffId,
          trainerIds: [],
          trainerStaffIds: [],
          trainerNames: [],
          allowedRoomIds: ["upstairs", "downstairs", "physio"],
          packId: "",
          packName: "Equipo Activate",
          packTotalSessions: 0,
          usedSessions: 0,
          reservedSessions: 0,
          remainingSessions: 0,
          sessionDuration: 45,
          isMinor: false,
          guardianName: null,
          guardianEmail: null,
          termsAccepted: true,
          termsVersion: "2026-07-27",
          imageConsent: false,
          gender: "unspecified",
          cycleTrackingEnabled: false,
          cycleSharingEnabled: false,
          status: "active",
          createdBy: boss.id,
          createdAt: serverTimestamp(),
          modifiedAt: serverTimestamp(),
          modifiedBy: boss.id,
        });
        batch.update(doc(db, "staffDirectory", staffId), {
          authUid: created.uid,
          email: normalizedEmail,
          linkedAt: serverTimestamp(),
          linkedBy: boss.id,
        });
        assigned.forEach((client) => {
          batch.update(client.ref, {
            trainerIds: arrayUnion(created.uid),
            modifiedAt: serverTimestamp(),
            modifiedBy: boss.id,
          });
        });
        writeAudit(db, batch, boss.id, "activate_trainer_access", created.uid, staffId);
        await batch.commit();
        await sendPasswordResetEmail(secondaryAuth, normalizedEmail);
      } catch (error) {
        await deleteUser(created).catch(() => undefined);
        throw error;
      }
      this.showToast(`Acceso activado para ${member.name}; se ha enviado el email`);
      return null;
    } catch (error) {
      return errorText(error);
    } finally {
      await firebaseSignOut(secondaryAuth).catch(() => undefined);
    }
  }

  /** Cambia los entrenadores asignados a un cliente. */
  async updateClientTrainers(clientId: string, trainerStaffIds: string[]): Promise<string | null> {
    const boss = this.state.currentUser;
    if (boss?.role !== "boss") return "No tienes permisos de Dirección.";
    const client = this.state.managedUsers.find((u) => u.id === clientId);
    if (!client || client.role !== "client") return "Sólo los clientes tienen entrenadores asignados.";
    if (trainerStaffIds.length === 0) return "Asigna al menos un entrenador.";
    const selected = this.state.staff.filter((s) => s.kind === "trainer" && trainerStaffIds.includes(s.id));
    const trainerIds = selected.map((s) => s.authUid).filter((id): id is string => Boolean(id));
    const trainerNames = selected.map((s) => s.name);

    if (this.state.demo) {
      this.set({
        managedUsers: this.state.managedUsers.map((u) =>
          u.id === clientId ? { ...u, trainerIds, trainerStaffIds } : u,
        ),
      });
      this.showToast("Entrenadores actualizados");
      return null;
    }
    try {
      const batch = writeBatch(this.db);
      batch.update(doc(this.db, "users", clientId), {
        trainerIds,
        trainerStaffIds,
        trainerNames,
        modifiedAt: serverTimestamp(),
        modifiedBy: boss.id,
      });
      writeAudit(this.db, batch, boss.id, "update_client_trainers", clientId);
      await batch.commit();
      this.showToast("Entrenadores actualizados");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  async markDeletionProcessed(userId: string) {
    const boss = this.state.currentUser;
    if (boss?.role !== "boss") return;
    if (this.state.demo) {
      this.set({ deletionRequests: this.state.deletionRequests.filter((r) => r.id !== userId) });
      return this.showToast("Solicitud marcada como tramitada");
    }
    try {
      await updateDoc(doc(this.db, "deletionRequests", userId), {
        status: "processed",
        processedAt: serverTimestamp(),
        processedBy: boss.id,
      });
      this.showToast("Solicitud marcada como tramitada");
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  // ---------- Cliente: cancelaciones ----------

  /** El cliente retira una solicitud que aún no se ha confirmado. */
  async cancelBookingRequest(requestId: string) {
    const user = this.state.currentUser;
    const request = this.state.bookings.find((b) => b.id === requestId);
    if (!user || !request || request.clientId !== user.id) return;
    if (request.status !== "pending_trainer" && request.status !== "pending_boss") return;
    if (this.state.demo) {
      this.set({ bookings: this.state.bookings.map((b) => (b.id === requestId ? { ...b, status: "cancelled" } : b)) });
      return this.showToast("Solicitud retirada");
    }
    try {
      await updateDoc(doc(this.db, "bookingRequests", requestId), {
        status: "cancelled",
        modifiedAt: serverTimestamp(),
      });
      this.showToast("Solicitud retirada");
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  /** ¿Se puede cancelar sin perder la sesión? (más de 24 h de antelación). */
  canSelfCancel(session: GymSession) {
    const minutes = parseMinutes(session.time);
    if (session.status !== "confirmed" || minutes === null) return false;
    const start = keyToDate(session.date);
    start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    // Margen de 2 h como en las reglas del servidor.
    return start.getTime() - Date.now() > 26 * 3_600_000;
  }

  /** El cliente cancela con más de 24 h: la sesión vuelve a su bono. */
  async cancelOwnSession(sessionId: string): Promise<string | null> {
    const user = this.state.currentUser;
    const session = this.state.sessions.find((s) => s.id === sessionId);
    if (!user || !session || session.clientId !== user.id) return "No se ha encontrado la sesión.";
    if (!this.canSelfCancel(session)) {
      return "Quedan menos de 24 h: escribe a tu entrenador para reorganizarla.";
    }
    if (this.state.demo) {
      this.set({
        sessions: this.state.sessions.map((s) => (s.id === sessionId ? { ...s, status: "cancelled" } : s)),
      });
      this.showToast("Sesión cancelada; vuelve a tu bono");
      return null;
    }
    const db = this.db;
    const sessionRef = doc(db, "sessions", sessionId);
    const userRef = doc(db, "users", user.id);
    const locks = occupancyDocuments(db, {
      ...session,
      sessionId,
      kind: session.trainerId ? "training" : "room_rental",
    });
    try {
      await runTransaction(db, async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        const userSnap = await tx.get(userRef);
        const data = userSnap.data();
        if (sessionSnap.data()?.status !== "confirmed" || !data) {
          throw new ActivateError("La sesión ya no está confirmada.");
        }
        const reserved = num(data.reservedSessions);
        const remaining = num(data.remainingSessions);
        if (reserved <= 0) throw new ActivateError("El saldo reservado no es válido.");
        tx.update(sessionRef, {
          status: "cancelled",
          cancellationReason: "Cancelada por el cliente con antelación",
          modifiedAt: serverTimestamp(),
          modifiedBy: user.id,
        });
        tx.update(userRef, {
          reservedSessions: reserved - 1,
          remainingSessions: remaining + 1,
          lastSessionId: sessionId,
          modifiedAt: serverTimestamp(),
          modifiedBy: user.id,
        });
        for (const lock of locks) tx.delete(lock.ref);
        writeAudit(db, tx, user.id, "client_cancel_session", sessionId);
      });
      this.showToast("Sesión cancelada; vuelve a tu bono");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  // ---------- Retos semanales ----------

  /** Retos visibles para el cliente actual (de Dirección o de sus entrenadores). */
  challengesFor(user: AppUser | null, week = currentWeek()) {
    if (!user) return [];
    return this.state.challenges.filter(
      (c) =>
        c.weekKey === week &&
        c.active &&
        (c.audience === "all" || (c.trainerId !== null && user.trainerIds.includes(c.trainerId))),
    );
  }

  /** Retos que gestiona el usuario del equipo (Dirección ve todos). */
  managedChallenges(week?: string) {
    const user = this.state.currentUser;
    if (!user) return [];
    return this.state.challenges.filter(
      (c) => (!week || c.weekKey === week) && (user.role === "boss" || c.createdBy === user.id),
    );
  }

  progressFor(challengeId: string, uid: string) {
    return this.state.challengeProgress.find((p) => p.challengeId === challengeId && p.uid === uid) ?? null;
  }

  async saveChallenge(input: {
    id?: string;
    title: string;
    description: string;
    weekKey: string;
    target: number;
    unit: string;
    points: number;
    audience: ChallengeAudience;
  }): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user || !(user.role === "boss" || user.role === "trainer")) return "No tienes permiso para crear retos.";
    const title = input.title.trim().slice(0, LIMITS.challengeTitle);
    const unit = input.unit.trim().slice(0, LIMITS.challengeUnit) || "veces";
    if (!title) return "Pon un título al reto.";
    const audience: ChallengeAudience = user.role === "boss" ? input.audience : "trainer";
    if (audience === "trainer" && !user.isTrainer) return "Sólo puedes crear retos para tus clientes.";
    const editable = {
      title,
      description: input.description.trim().slice(0, LIMITS.challengeDescription),
      target: Math.min(100, Math.max(1, Math.round(input.target))),
      unit,
      points: Math.min(100, Math.max(0, Math.round(input.points))),
      active: true,
    };

    if (this.state.demo) {
      const existing = input.id ? this.state.challenges.find((c) => c.id === input.id) : null;
      const challenge: Challenge = existing
        ? { ...existing, ...editable }
        : {
            id: demoId(),
            ...editable,
            weekKey: input.weekKey,
            audience,
            trainerId: audience === "trainer" ? user.id : null,
            createdBy: user.id,
            createdByName: user.name,
          };
      this.set({ challenges: [...this.state.challenges.filter((c) => c.id !== challenge.id), challenge] });
      this.showToast(existing ? "Reto actualizado" : "Reto publicado");
      return null;
    }
    try {
      if (input.id) {
        await updateDoc(doc(this.db, "challenges", input.id), editable);
        this.showToast("Reto actualizado");
      } else {
        await setDoc(doc(collection(this.db, "challenges")), {
          ...editable,
          weekKey: input.weekKey,
          audience,
          trainerId: audience === "trainer" ? user.id : null,
          createdBy: user.id,
          createdByName: user.name.slice(0, LIMITS.name),
          createdAt: serverTimestamp(),
        });
        this.showToast("Reto publicado");
      }
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  async deleteChallenge(id: string) {
    if (this.state.demo) {
      this.set({ challenges: this.state.challenges.filter((c) => c.id !== id) });
      return this.showToast("Reto eliminado");
    }
    try {
      await deleteDoc(doc(this.db, "challenges", id));
      this.showToast("Reto eliminado");
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  /** El cliente apunta su progreso (marcar hoy, sumar/restar, nota). */
  async updateChallengeProgress(
    challenge: Challenge,
    patch: { progress?: number; checkIns?: string[]; note?: string },
  ): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user || user.role !== "client") return null;
    const existing = this.progressFor(challenge.id, user.id);
    if (existing?.approved) return "Tu entrenador ya ha cerrado este reto.";
    const progress = Math.min(1000, Math.max(0, Math.round(patch.progress ?? existing?.progress ?? 0)));
    const checkIns = [...new Set(patch.checkIns ?? existing?.checkIns ?? [])].sort().slice(-7);
    const note = (patch.note ?? existing?.note ?? "").slice(0, LIMITS.challengeNote);
    const completed = progress >= challenge.target;
    const id = `${challenge.id}_${user.id}`;

    if (this.state.demo) {
      const next: ChallengeProgress = {
        id,
        challengeId: challenge.id,
        uid: user.id,
        weekKey: challenge.weekKey,
        trainerIds: user.trainerIds,
        progress,
        checkIns,
        note,
        completed,
        feedback: existing?.feedback ?? "",
        feedbackByName: existing?.feedbackByName ?? "",
        feedbackAt: existing?.feedbackAt ?? null,
        approved: false,
      };
      this.set({ challengeProgress: [...this.state.challengeProgress.filter((p) => p.id !== id), next] });
      if (completed && !existing?.completed) this.showToast("¡Reto completado! Tu entrenador lo revisará");
      return null;
    }
    try {
      const ref = doc(this.db, "challengeProgress", id);
      if (existing) {
        await updateDoc(ref, { progress, checkIns, note, completed, trainerIds: user.trainerIds, updatedAt: serverTimestamp() });
      } else {
        await setDoc(ref, {
          challengeId: challenge.id,
          uid: user.id,
          weekKey: challenge.weekKey,
          trainerIds: user.trainerIds,
          progress,
          checkIns,
          note,
          completed,
          updatedAt: serverTimestamp(),
        });
      }
      if (completed && !existing?.completed) this.showToast("¡Reto completado! Tu entrenador lo revisará");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  /** Feedback semanal del entrenador; al aprobar suma los puntos del reto. */
  async giveChallengeFeedback(
    challenge: Challenge,
    client: AppUser,
    feedback: string,
    approve: boolean,
  ): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user || !(user.role === "boss" || client.trainerIds.includes(user.id))) {
      return "Sólo su entrenador o Dirección pueden valorar este reto.";
    }
    const id = `${challenge.id}_${client.id}`;
    const text = feedback.trim().slice(0, 1000);
    const existing = this.progressFor(challenge.id, client.id);
    const newlyApproved = approve && !existing?.approved;

    if (this.state.demo) {
      const base: ChallengeProgress = existing ?? {
        id,
        challengeId: challenge.id,
        uid: client.id,
        weekKey: challenge.weekKey,
        trainerIds: client.trainerIds,
        progress: 0,
        checkIns: [],
        note: "",
        completed: false,
        feedback: "",
        feedbackByName: "",
        feedbackAt: null,
        approved: false,
      };
      this.set({
        challengeProgress: [
          ...this.state.challengeProgress.filter((p) => p.id !== id),
          { ...base, feedback: text, feedbackByName: user.name, feedbackAt: new Date(), approved: existing?.approved || approve },
        ],
      });
      this.showToast(newlyApproved ? `Reto aprobado: +${challenge.points} puntos` : "Feedback enviado");
      return null;
    }

    const db = this.db;
    const ref = doc(db, "challengeProgress", id);
    const clientRef = doc(db, "users", client.id);
    const entryRef = doc(db, "leaderboard", `${challenge.weekKey}_${client.id}`);
    const feedbackFields = {
      feedback: text || null,
      feedbackBy: user.id,
      feedbackByName: user.name.slice(0, LIMITS.name),
      feedbackAt: serverTimestamp(),
      approved: Boolean(existing?.approved || approve),
    };
    try {
      await runTransaction(db, async (tx) => {
        const progressSnap = await tx.get(ref);
        const clientSnap = await tx.get(clientRef);
        const entrySnap = newlyApproved ? await tx.get(entryRef) : null;
        const clientData = clientSnap.data();
        if (!clientData) throw new ActivateError("No se ha encontrado al cliente.");
        if (progressSnap.exists()) {
          if (progressSnap.data().approved && newlyApproved) throw new ActivateError("Este reto ya estaba aprobado.");
          tx.update(ref, feedbackFields);
        } else {
          tx.set(ref, {
            challengeId: challenge.id,
            uid: client.id,
            weekKey: challenge.weekKey,
            trainerIds: strList(clientData.trainerIds),
            progress: 0,
            checkIns: [],
            note: "",
            completed: false,
            ...feedbackFields,
          });
        }
        if (newlyApproved && entrySnap && challenge.points > 0) {
          const previous = entrySnap.data();
          tx.set(entryRef, {
            weekKey: challenge.weekKey,
            uid: client.id,
            displayName: shortName(str(clientData.name, "Cliente")),
            sessions: num(previous?.sessions),
            challengePoints: Math.min(2000, num(previous?.challengePoints) + challenge.points),
            visible: clientData.leaderboardOptIn === true,
            updatedAt: serverTimestamp(),
          });
        }
      });
      this.showToast(newlyApproved ? `Reto aprobado: +${challenge.points} puntos` : "Feedback enviado");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  // ---------- Preferencias del cliente ----------

  async setWeeklyGoal(goal: number) {
    const user = this.state.currentUser;
    if (!user) return;
    const weeklyGoal = Math.min(7, Math.max(1, Math.round(goal)));
    this.set({ currentUser: { ...user, weeklyGoal } });
    if (this.state.demo) return this.showToast("Objetivo semanal actualizado");
    try {
      await updateDoc(doc(this.db, "users", user.id), { weeklyGoal, modifiedAt: serverTimestamp() });
      this.showToast("Objetivo semanal actualizado");
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  async setLeaderboardOptIn(optIn: boolean) {
    const user = this.state.currentUser;
    if (!user) return;
    this.set({
      currentUser: { ...user, leaderboardOptIn: optIn },
      myLeaderboardEntry: this.state.myLeaderboardEntry ? { ...this.state.myLeaderboardEntry, visible: optIn } : null,
    });
    if (this.state.demo) return this.showToast(optIn ? "Apareces en la clasificación" : "Ya no apareces en la clasificación");
    try {
      const batch = writeBatch(this.db);
      batch.update(doc(this.db, "users", user.id), { leaderboardOptIn: optIn, modifiedAt: serverTimestamp() });
      if (this.state.myLeaderboardEntry) {
        batch.update(doc(this.db, "leaderboard", this.state.myLeaderboardEntry.id), { visible: optIn });
      }
      await batch.commit();
      this.showToast(optIn ? "Apareces en la clasificación" : "Ya no apareces en la clasificación");
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  /** Bienvenida del primer acceso: términos, objetivo y clasificación de una vez. */
  async completeOnboarding(input: {
    acceptTerms: boolean;
    imageConsent: boolean;
    weeklyGoal: number;
    leaderboardOptIn: boolean;
  }): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user) return null;
    const weeklyGoal = Math.min(7, Math.max(1, Math.round(input.weeklyGoal)));
    const patch: DocumentData = {
      weeklyGoal,
      leaderboardOptIn: input.leaderboardOptIn,
      onboardedAt: serverTimestamp(),
      modifiedAt: serverTimestamp(),
    };
    if (input.acceptTerms && !user.termsAccepted) {
      Object.assign(patch, {
        termsAccepted: true,
        termsAcceptedAt: serverTimestamp(),
        termsVersion: "2026-07-27",
        imageConsent: user.role === "client" ? input.imageConsent : false,
        imageConsentAt: serverTimestamp(),
      });
    }
    if (this.state.demo) {
      this.set({
        currentUser: {
          ...user,
          weeklyGoal,
          leaderboardOptIn: input.leaderboardOptIn,
          onboarded: true,
          termsAccepted: user.termsAccepted || input.acceptTerms,
          imageConsent: input.acceptTerms && !user.termsAccepted ? input.imageConsent : user.imageConsent,
        },
      });
      return null;
    }
    try {
      await updateDoc(doc(this.db, "users", user.id), patch);
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  async updateProfile(input: { name: string; phone: string }): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user) return null;
    const name = input.name.trim().slice(0, LIMITS.name);
    const phone = input.phone.trim().slice(0, LIMITS.phone);
    if (!name) return "El nombre no puede quedar vacío.";
    if (this.state.demo) {
      this.set({ currentUser: { ...user, name, phone } });
      this.showToast("Datos actualizados");
      return null;
    }
    try {
      await updateDoc(doc(this.db, "users", user.id), { name, phone, modifiedAt: serverTimestamp() });
      this.showToast("Datos actualizados");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  // ---------- Entrenador: notas privadas y consejos ----------

  async loadTrainerNotes(clientId: string): Promise<string> {
    if (this.state.demo) return this.demoNotes.get(clientId) ?? "";
    const snap = await getDoc(doc(this.db, "trainerNotes", clientId));
    return snap.exists() ? str(snap.data().notes) : "";
  }

  private demoNotes = new Map<string, string>();

  async saveTrainerNotes(clientId: string, notes: string): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user) return null;
    const text = notes.slice(0, LIMITS.trainerNotes);
    if (this.state.demo) {
      this.demoNotes.set(clientId, text);
      this.showToast("Notas guardadas");
      return null;
    }
    try {
      await setDoc(doc(this.db, "trainerNotes", clientId), {
        notes: text,
        updatedAt: serverTimestamp(),
        updatedBy: user.id,
        updatedByName: user.name.slice(0, LIMITS.name),
      });
      this.showToast("Notas guardadas");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  async publishTip(input: { title: string; body: string; category: TipCategory }): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user || !(user.role === "boss" || user.role === "trainer")) return "No tienes permiso para publicar.";
    const title = input.title.trim().slice(0, LIMITS.tipTitle);
    const body = input.body.trim().slice(0, LIMITS.tipBody);
    if (!title || !body) return "Escribe un título y el consejo.";
    if (this.state.demo) {
      this.set({
        customTips: [
          { id: demoId(), title, body, category: input.category, createdByName: user.name, createdAt: new Date(), custom: true },
          ...this.state.customTips,
        ],
      });
      this.showToast("Consejo publicado");
      return null;
    }
    try {
      await setDoc(doc(collection(this.db, "tips")), {
        title,
        body,
        category: input.category,
        createdBy: user.id,
        createdByName: user.name.slice(0, LIMITS.name),
        createdAt: serverTimestamp(),
      });
      this.showToast("Consejo publicado");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  async deleteTip(id: string) {
    if (this.state.demo) {
      this.set({ customTips: this.state.customTips.filter((t) => t.id !== id) });
      return;
    }
    try {
      await deleteDoc(doc(this.db, "tips", id));
      this.showToast("Consejo eliminado");
    } catch (error) {
      this.showToast(errorText(error));
    }
  }

  // ---------- Perfil ----------

  async acceptTerms(imageConsent: boolean): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user || (user.role !== "client" && user.role !== "reserve")) {
      return "Esta cuenta no necesita aceptar estos términos.";
    }
    if (this.state.demo) {
      this.set({ currentUser: { ...user, termsAccepted: true, imageConsent } });
      this.showToast("Consentimientos guardados");
      return null;
    }
    try {
      await updateDoc(doc(this.db, "users", user.id), {
        termsAccepted: true,
        termsAcceptedAt: serverTimestamp(),
        termsVersion: "2026-07-27",
        imageConsent,
        imageConsentAt: serverTimestamp(),
        modifiedAt: serverTimestamp(),
      });
      this.showToast("Consentimientos guardados");
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  async requestAccountDeletion(): Promise<string | null> {
    const user = this.state.currentUser;
    if (!user || user.role === "boss") return "Antes hay que transferir la cuenta principal de Dirección.";
    if (this.state.demo) {
      await this.signOut();
      return null;
    }
    const db = this.db;
    const batch = writeBatch(db);
    batch.set(doc(db, "deletionRequests", user.id), {
      uid: user.id,
      email: user.email,
      status: "pending",
      requestedAt: serverTimestamp(),
    });
    batch.update(doc(db, "users", user.id), {
      status: "deletion_requested",
      deletionRequestedAt: serverTimestamp(),
      modifiedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
      await this.signOut();
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  // ---------- Sincronización en vivo ----------

  private stopDataSync() {
    this.dataListeners.forEach((stop) => stop());
    this.cycleListeners.forEach((stop) => stop());
    this.messageListener?.();
    this.dataListeners = [];
    this.cycleListeners.clear();
    this.messageListener = null;
  }

  /**
   * Escucha una consulta acotada por fecha; si Firestore pide un índice que
   * aún no está desplegado, repite la escucha sin el filtro de fecha.
   */
  private listenWithFallback(
    primary: Query,
    fallback: Query,
    onData: (docs: DocumentSnapshot<DocumentData>[]) => void,
  ) {
    let usingFallback = false;
    let stop: Unsubscribe = () => undefined;
    const start = (q: Query) => {
      stop = onSnapshot(
        q,
        (snap) => onData(snap.docs),
        (error: FirestoreError) => {
          if (!usingFallback && error.code === "failed-precondition") {
            console.warn("[Activate] índice no desplegado, consulta sin filtro de fecha");
            usingFallback = true;
            start(fallback);
          } else {
            console.warn("[Activate] listener", error.message);
          }
        },
      );
    };
    start(primary);
    this.dataListeners.push(() => stop());
  }

  private startDataSync(user: AppUser) {
    this.stopDataSync();
    this.primed.clear();
    const db = this.db;
    const listen = (stop: Unsubscribe) => this.dataListeners.push(stop);
    const onError = (error: Error) => console.warn("[Activate] listener", error.message);
    const profileRef = doc(db, "users", user.id);
    const isStaff = user.role === "boss" || user.role === "trainer";
    // Historial: 90 días atrás es suficiente para la agenda y el feedback.
    const historyStart = addDays(todayKey(), -90);

    listen(
      onSnapshot(
        profileRef,
        (snap) => {
          const profile = userFromDoc(snap);
          if (!profile) return;
          if (profile.status !== "active" && profile.role !== "boss") {
            this.showToast("Tu cuenta no está activa. Contacta con Dirección.");
            void this.signOut();
            return;
          }
          this.set({
            currentUser: profile,
            activePack: {
              id: profile.packId,
              name: profile.packName,
              totalSessions: profile.packTotalSessions,
              usedSessions: profile.usedSessions,
              reservedSessions: profile.reservedSessions,
              remainingSessions: profile.remainingSessions,
              duration: profile.sessionDuration,
            },
          });
        },
        onError,
      ),
    );

    // Sesiones (acotadas por fecha, con índices ya existentes).
    const sessionsBase =
      user.role === "boss"
        ? collection(db, "sessions")
        : query(collection(db, "sessions"), where(user.role === "trainer" ? "trainerId" : "clientId", "==", user.id));
    this.listenWithFallback(query(sessionsBase, where("date", ">=", historyStart)), sessionsBase, (docs) => {
      const sessions = docs.map(sessionFromDoc).filter(isDefined);
      if (!this.isFirst("sessions")) this.diffSessions(this.state.sessions, sessions);
      this.set({ sessions });
    });

    // Solicitudes.
    if (user.role === "boss") {
      const all = collection(db, "bookingRequests");
      this.listenWithFallback(query(all, where("requestedDate", ">=", addDays(todayKey(), -60))), all, (docs) => {
        const bookings = docs.map(bookingFromDoc).filter(isDefined);
        if (!this.isFirst("bookings")) this.diffBookings(this.state.bookings, bookings);
        this.set({ bookings });
      });
    } else {
      listen(
        onSnapshot(
          query(
            collection(db, "bookingRequests"),
            where(user.role === "trainer" ? "trainerId" : "clientId", "==", user.id),
          ),
          (snap) => {
            const bookings = snap.docs.map(bookingFromDoc).filter(isDefined);
            if (!this.isFirst("bookings")) this.diffBookings(this.state.bookings, bookings);
            this.set({ bookings });
          },
          onError,
        ),
      );
    }

    // Ocupación anónima: sólo desde ayer.
    const occupancy = collection(db, "occupancy");
    this.listenWithFallback(query(occupancy, where("date", ">=", addDays(todayKey(), -1))), occupancy, (docs) =>
      this.set({ occupiedSlots: docs.map(occupiedFromDoc).filter(isDefined) }),
    );

    listen(
      onSnapshot(
        query(collection(db, "rooms"), where("status", "==", "active")),
        (snap) => {
          const rooms = snap.docs.map(roomFromDoc).filter(isDefined).sort(byName);
          if (rooms.length) this.set({ rooms });
        },
        onError,
      ),
    );

    // Retos, progreso y clasificación (no aplica a usuarios de sala).
    if (user.role !== "reserve") {
      const week = currentWeek();
      const weeks = [addDays(week, -7), week, addDays(week, 7)];
      listen(
        onSnapshot(
          query(collection(db, "challenges"), where("weekKey", "in", weeks)),
          (snap) => {
            const challenges = snap.docs.map(challengeFromDoc).filter(isDefined);
            if (!this.isFirst("challenges") && user.role === "client") {
              const known = new Set(this.state.challenges.map((c) => c.id));
              const mine = new Set(this.challengesFor(this.state.currentUser).map((c) => c.id));
              for (const c of challenges) {
                const visible =
                  c.active &&
                  c.weekKey === week &&
                  (c.audience === "all" || (c.trainerId !== null && user.trainerIds.includes(c.trainerId)));
                if (!known.has(c.id) && visible && !mine.has(c.id)) {
                  this.announce("Nuevo reto semanal", c.title, "challenges", `challenge-${c.id}`);
                }
              }
            }
            this.set({ challenges });
          },
          onError,
        ),
      );

      const progressCol = collection(db, "challengeProgress");
      const progressQuery =
        user.role === "client"
          ? query(progressCol, where("uid", "==", user.id))
          : user.role === "boss"
            ? query(progressCol, where("weekKey", "in", weeks.slice(0, 2)))
            : query(progressCol, where("trainerIds", "array-contains", user.id));
      listen(
        onSnapshot(
          progressQuery,
          (snap) => {
            const progress = snap.docs.map(progressFromDoc).filter(isDefined);
            if (!this.isFirst("progress") && user.role === "client") {
              const before = new Map(this.state.challengeProgress.map((p) => [p.id, p]));
              for (const p of progress) {
                const old = before.get(p.id);
                if (p.feedbackAt && p.feedbackAt.getTime() !== old?.feedbackAt?.getTime()) {
                  this.announce(
                    p.approved && !old?.approved ? "¡Reto aprobado!" : `Feedback de ${p.feedbackByName || "tu entrenador"}`,
                    p.feedback || "Tu entrenador ha revisado tu reto.",
                    "challenges",
                    `progress-${p.id}`,
                  );
                }
              }
            }
            this.set({ challengeProgress: progress });
          },
          onError,
        ),
      );

      const board = collection(db, "leaderboard");
      listen(
        onSnapshot(
          user.role === "client"
            ? query(board, where("weekKey", "==", week), where("visible", "==", true))
            : query(board, where("weekKey", "==", week)),
          (snap) => this.set({ leaderboard: snap.docs.map(entryFromDoc).filter(isDefined) }),
          onError,
        ),
      );
      if (user.role === "client") {
        listen(
          onSnapshot(
            doc(db, "leaderboard", `${week}_${user.id}`),
            (snap) => this.set({ myLeaderboardEntry: snap.exists() ? entryFromDoc(snap) : null }),
            () => this.set({ myLeaderboardEntry: null }),
          ),
        );
      }
    }

    listen(
      onSnapshot(
        query(collection(db, "tips"), orderBy("createdAt", "desc"), limit(30)),
        (snap) => this.set({ customTips: snap.docs.map(tipFromDoc).filter(isDefined) }),
        onError,
      ),
    );

    // El directorio del equipo contiene emails: sólo para el equipo.
    if (isStaff) {
      listen(
        onSnapshot(
          query(collection(db, "staffDirectory"), where("status", "==", "active")),
          (snap) => this.set({ staff: snap.docs.map(staffFromDoc).filter(isDefined).sort(byName) }),
          onError,
        ),
      );
    }

    // Conversaciones del equipo.
    if (user.isTrainer) {
      listen(
        onSnapshot(
          query(collection(db, "chats"), where("participantIds", "array-contains", user.id)),
          (snap) => {
            const chats = snap.docs
              .map(chatFromDoc)
              .filter(isDefined)
              .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
            if (!this.isFirst("chats")) {
              const before = new Map(this.state.chats.map((c) => [c.id, c]));
              for (const thread of chats) {
                if (this.isNewIncoming(before.get(thread.id), thread)) {
                  const name = this.state.managedUsers.find((u) => u.id === thread.clientId)?.name ?? "Cliente";
                  this.announce(`Mensaje de ${name}`, thread.lastMessageText ?? "", "chat", `chat-${thread.id}`);
                }
              }
            }
            this.set({ chats });
          },
          onError,
        ),
      );
    }

    if (user.role === "boss") {
      listen(
        onSnapshot(
          query(collection(db, "users"), where("role", "in", ["client", "reserve"])),
          (snap) => {
            const people = snap.docs.map(userFromDoc).filter(isDefined).sort(byName);
            this.set({ managedUsers: people });
            if (user.isTrainer) this.listenToSharedCycles(people);
          },
          onError,
        ),
      );
      listen(
        onSnapshot(
          query(collection(db, "users"), where("isTrainer", "==", true)),
          (snap) => this.set({ trainers: snap.docs.map(userFromDoc).filter(isDefined).sort(byName) }),
          onError,
        ),
      );
      listen(
        onSnapshot(
          query(collection(db, "deletionRequests"), where("status", "==", "pending")),
          (snap) =>
            this.set({
              deletionRequests: snap.docs.map((d) => ({
                id: d.id,
                email: str(d.data().email),
                requestedAt: toDate(d.data().requestedAt),
              })),
            }),
          onError,
        ),
      );
    } else if (user.role === "trainer") {
      this.set({ trainers: [user] });
      // La consulta debe filtrar por rol para cumplir las reglas (índice role + trainerIds).
      listen(
        onSnapshot(
          query(
            collection(db, "users"),
            where("role", "==", "client"),
            where("trainerIds", "array-contains", user.id),
          ),
          (snap) => {
            const people = snap.docs.map(userFromDoc).filter(isDefined).sort(byName);
            this.set({ managedUsers: people });
            this.listenToSharedCycles(people);
          },
          onError,
        ),
      );
    } else if (user.role === "client") {
      for (const trainerId of user.trainerIds) {
        listen(
          onSnapshot(
            doc(db, "users", trainerId),
            (snap) => {
              const trainer = userFromDoc(snap);
              if (!trainer) return;
              const others = this.state.trainers.filter((t) => t.id !== trainer.id);
              this.set({ trainers: [...others, trainer].sort(byName) });
            },
            onError,
          ),
        );
      }
      if (user.cycleTrackingEnabled) {
        listen(
          onSnapshot(
            collection(profileRef, "cycleEntries"),
            (snap) => {
              const entries: Record<string, CycleEntry> = {};
              snap.docs.forEach((d) => {
                const entry = cycleFromData(d.data());
                if (entry) entries[d.id] = entry;
              });
              this.set({ cycleEntries: entries });
            },
            onError,
          ),
        );
      }
      listen(
        onSnapshot(
          doc(db, "nutritionPlans", user.id),
          (snap) => {
            const plan = snap.exists() ? planFromData(snap.data()) : null;
            const previous = this.state.nutritionPlan;
            if (
              !this.isFirst("nutrition") &&
              plan?.updatedAt &&
              plan.updatedAt.getTime() !== previous?.updatedAt?.getTime()
            ) {
              this.announce("Plan nutricional actualizado", plan.title, "nutrition", "nutrition");
            }
            this.set({ nutritionPlan: plan });
          },
          onError,
        ),
      );
      // Resumen del propio chat (no leídos y avisos). Si aún no existe, no hay nada que avisar.
      listen(
        onSnapshot(
          doc(db, "chats", user.id),
          (snap) => {
            const thread = snap.exists() ? chatFromDoc(snap) : null;
            if (thread && !this.isFirst("clientChat") && this.isNewIncoming(this.state.clientChat, thread)) {
              this.announce("Mensaje de tu entrenador", thread.lastMessageText ?? "", "chat", `chat-${thread.id}`);
            }
            this.primed.add("clientChat");
            this.set({ clientChat: thread });
          },
          () => this.primed.add("clientChat"),
        ),
      );
    }
  }

  /** Mantiene un listener por clienta que comparte el ciclo (sin reiniciar los demás). */
  private listenToSharedCycles(clients: AppUser[]) {
    const viewer = this.state.currentUser;
    const wanted = new Set(
      viewer?.isTrainer
        ? clients
            .filter(
              (c) =>
                c.role === "client" &&
                c.cycleTrackingEnabled &&
                c.cycleSharingEnabled &&
                c.trainerIds.includes(viewer.id),
            )
            .map((c) => c.id)
        : [],
    );

    for (const [clientId, stop] of this.cycleListeners) {
      if (!wanted.has(clientId)) {
        stop();
        this.cycleListeners.delete(clientId);
        const { [clientId]: _removed, ...rest } = this.state.clientCycleSummaries;
        void _removed;
        this.set({ clientCycleSummaries: rest });
      }
    }
    for (const clientId of wanted) {
      if (this.cycleListeners.has(clientId)) continue;
      this.cycleListeners.set(
        clientId,
        onSnapshot(
          query(collection(this.db, "users", clientId, "cycleSummaries"), orderBy("date", "desc"), limit(1)),
          (snap) => {
            const entry = snap.docs[0] ? cycleFromData(snap.docs[0].data()) : null;
            if (entry) {
              this.set({ clientCycleSummaries: { ...this.state.clientCycleSummaries, [clientId]: entry } });
            }
          },
          (error) => console.warn("[Activate] ciclo", error.message),
        ),
      );
    }
  }

  // ---------- Modo demo (sólo desarrollo) ----------

  startDemo(role: UserRole, data: Partial<AppState>) {
    this.stopDataSync();
    this.set({ ...initialState(), ...data, demo: true, authStatus: "ready" });
    void role;
  }
}

// ---------- Utilidades ----------

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

let demoCounter = 0;
function demoId() {
  demoCounter += 1;
  return `demo-${Date.now()}-${demoCounter}`;
}

export function demoUserBase(): AppUser {
  return {
    id: "",
    email: "",
    name: "",
    role: "client",
    trainerIds: [],
    phone: "",
    dni: "",
    trainerStaffIds: [],
    isTrainer: false,
    isMinor: false,
    guardianName: null,
    termsAccepted: false,
    imageConsent: false,
    cycleTrackingEnabled: false,
    cycleSharingEnabled: false,
    packId: "active",
    packName: "Bono",
    packTotalSessions: 0,
    usedSessions: 0,
    reservedSessions: 0,
    remainingSessions: 0,
    sessionDuration: 45,
    status: "active",
    weeklyGoal: 2,
    leaderboardOptIn: false,
    onboarded: true,
  };
}

export function errorText(error: unknown) {
  if (error instanceof ActivateError) return error.message;
  const code = (error as { code?: string } | null)?.code ?? "";
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "No tienes permiso para esta operación.";
  }
  if (code === "unavailable") return "No hay conexión. Revisa Internet e inténtalo de nuevo.";
  if (code === "auth/email-already-in-use") return "Ya existe una cuenta con ese email.";
  if (code === "auth/invalid-email") return "El email no es válido.";
  if (error instanceof Error) return error.message;
  return "No se ha podido completar la operación.";
}

function authenticationMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "El email no es válido.";
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "El email o la contraseña no son correctos.";
    case "auth/user-disabled":
      return "Esta cuenta está desactivada. Contacta con Dirección.";
    case "auth/network-request-failed":
      return "No hay conexión. Revisa Internet e inténtalo de nuevo.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos.";
    default:
      return errorText(error);
  }
}

/** Convierte "AAAA-MM-DD" o Timestamp en clave de día. */
function dayFrom(value: unknown): string | null {
  if (value instanceof Timestamp) return dayKey(value.toDate());
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const strOrNull = (value: unknown) => (typeof value === "string" ? value : null);
const numOrNull = (value: unknown) => (typeof value === "number" ? value : null);
const strList = (value: unknown) => (Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);

const ROLES: UserRole[] = ["client", "trainer", "boss", "reserve"];

export function userFromDoc(snap: DocumentSnapshot<DocumentData>): AppUser | null {
  const data = snap.data();
  if (!data || !ROLES.includes(data.role)) return null;
  const role = data.role as UserRole;
  const trainerIds = Array.isArray(data.trainerIds)
    ? strList(data.trainerIds)
    : typeof data.trainerId === "string"
      ? [data.trainerId]
      : [];
  return {
    id: snap.id,
    email: str(data.email),
    name: str(data.name, "Usuario Activate"),
    role,
    trainerIds,
    phone: str(data.phone),
    dni: str(data.dni),
    trainerStaffIds: strList(data.trainerStaffIds),
    isTrainer: typeof data.isTrainer === "boolean" ? data.isTrainer : role === "trainer",
    isMinor: Boolean(data.isMinor),
    guardianName: strOrNull(data.guardianName),
    termsAccepted: Boolean(data.termsAccepted),
    imageConsent: Boolean(data.imageConsent),
    cycleTrackingEnabled: Boolean(data.cycleTrackingEnabled),
    cycleSharingEnabled: Boolean(data.cycleSharingEnabled),
    packId: str(data.packId, "active"),
    packName: str(data.packName, "Bono"),
    packTotalSessions: num(data.packTotalSessions),
    usedSessions: num(data.usedSessions),
    reservedSessions: num(data.reservedSessions),
    remainingSessions: num(data.remainingSessions),
    sessionDuration: num(data.sessionDuration, 45),
    status: str(data.status, "active"),
    weeklyGoal: Math.min(7, Math.max(1, num(data.weeklyGoal, 2))),
    leaderboardOptIn: data.leaderboardOptIn === true,
    onboarded: Boolean(data.onboardedAt),
  };
}

const SESSION_STATUSES: SessionStatus[] = ["confirmed", "pending", "completed", "cancelled"];
const BOOKING_STATUSES: BookingStatus[] = ["pending_trainer", "pending_boss", "confirmed", "rejected", "cancelled"];

function sessionFromDoc(snap: DocumentSnapshot<DocumentData>): GymSession | null {
  const data = snap.data();
  const date = dayFrom(data?.date);
  if (!data || !date || !SESSION_STATUSES.includes(data.status)) return null;
  return {
    id: snap.id,
    date,
    time: str(data.time, "00:00"),
    duration: num(data.duration, 45),
    clientId: str(data.clientId),
    clientName: str(data.clientName, "Usuario"),
    trainerId: str(data.trainerId),
    trainerName: str(data.trainerName, "Dirección"),
    type: str(data.type, "Sesión"),
    room: str(data.room, "Sala de arriba"),
    status: data.status,
    trainerNotes: strOrNull(data.trainerNotes),
    feedback: strOrNull(data.feedback),
    packSessionNumber: numOrNull(data.packSessionNumber),
    packTotalSessions: numOrNull(data.packTotalSessions),
    noShow: data.noShow === true,
  };
}

function bookingFromDoc(snap: DocumentSnapshot<DocumentData>): BookingRequest | null {
  const data = snap.data();
  const date = dayFrom(data?.requestedDate);
  if (!data || !date || !BOOKING_STATUSES.includes(data.status)) return null;
  return {
    id: snap.id,
    clientId: str(data.clientId),
    clientName: str(data.clientName, "Usuario"),
    trainerId: str(data.trainerId),
    trainerName: str(data.trainerName, "Dirección"),
    kind: data.kind === "room_rental" ? "room_rental" : "training",
    requestedDate: date,
    requestedTime: strOrNull(data.requestedTime),
    type: str(data.type, "Sesión"),
    duration: num(data.duration, 45),
    room: strOrNull(data.room),
    status: data.status,
    proposedTime: strOrNull(data.proposedTime),
    finalTime: strOrNull(data.finalTime),
    trainerNotes: strOrNull(data.trainerNotes),
    bossNotes: strOrNull(data.bossNotes),
  };
}

function occupiedFromDoc(snap: DocumentSnapshot<DocumentData>): OccupiedSlot | null {
  const data = snap.data();
  const date = dayFrom(data?.date);
  if (!data || !date) return null;
  return {
    id: snap.id,
    date,
    time: str(data.time, "00:00"),
    duration: num(data.duration, 45),
    room: str(data.room),
    trainerId: strOrNull(data.trainerId),
  };
}

function roomFromDoc(snap: DocumentSnapshot<DocumentData>): GymRoom | null {
  const data = snap.data();
  if (!data || typeof data.name !== "string") return null;
  return {
    id: snap.id,
    name: data.name,
    type: data.type === "physiotherapy_and_rental" ? "Fisioterapia y reservas" : "Entrenamiento y reservas",
    capacity: num(data.capacity, 1),
  };
}

const STAFF_KINDS: StaffKind[] = ["trainer", "physiotherapist", "room_rental", "physio_room_rental"];

function staffFromDoc(snap: DocumentSnapshot<DocumentData>): StaffMember | null {
  const data = snap.data();
  if (!data || typeof data.name !== "string" || !STAFF_KINDS.includes(data.kind)) return null;
  return {
    id: snap.id,
    name: data.name,
    kind: data.kind,
    authUid: strOrNull(data.authUid),
    email: str(data.email),
  };
}

const FLOWS: CycleFlow[] = ["none", "light", "medium", "heavy"];

function cycleFromData(data: DocumentData): CycleEntry | null {
  if (!FLOWS.includes(data.flow)) return null;
  return {
    flow: data.flow,
    symptoms: strList(data.symptoms),
    mood: str(data.mood, "🙂"),
    notes: str(data.notes),
  };
}

type OccupancyInput = {
  sessionId: string;
  kind: BookingKind;
  date: string;
  time: string;
  duration: number;
  room: string;
  trainerId: string;
};

/** Bloques de 15 min por sala y entrenador; mismos IDs que iOS. */
function occupancyDocuments(db: Firestore, input: OccupancyInput) {
  const start = parseMinutes(input.time) ?? 0;
  const blockCount = Math.max(1, Math.ceil(input.duration / 15));
  const key = roomKey(input.room);
  const values: { ref: DocumentReference; data: DocumentData }[] = [];
  for (let offset = 0; offset < blockCount; offset += 1) {
    const blockMinutes = start + offset * 15;
    const blockKey = String(blockMinutes).padStart(4, "0");
    const data = {
      sessionId: input.sessionId,
      kind: input.kind,
      date: input.date,
      time: formatMinutes(blockMinutes),
      duration: 15,
      room: input.room,
      trainerId: input.trainerId || null,
      createdAt: serverTimestamp(),
    };
    values.push({ ref: doc(db, "occupancy", `room_${key}_${input.date}_${blockKey}`), data });
    if (input.trainerId) {
      values.push({ ref: doc(db, "occupancy", `trainer_${input.trainerId}_${input.date}_${blockKey}`), data });
    }
  }
  return values;
}

function writeAudit(
  db: Firestore,
  writer: Transaction | WriteBatch,
  actorId: string,
  action: string,
  resourceId: string,
  staffId?: string,
) {
  const reference = doc(collection(db, "activityLogs"));
  const data: DocumentData = { actorId, action, resourceId, createdAt: serverTimestamp() };
  if (staffId) data.staffId = staffId;
  // Transaction y WriteBatch comparten la firma de set().
  (writer as WriteBatch).set(reference, data);
}

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function messageFromData(id: string, data: DocumentData, viewerId: string): ChatMessage | null {
  if (typeof data.text !== "string" || typeof data.authorId !== "string") return null;
  return {
    id,
    author: data.authorId === viewerId ? "user" : "trainer",
    text: data.text,
    // Mientras el servidor asigna la hora, se muestra la local.
    timestamp: toDate(data.timestamp) ?? new Date(),
    isRead: Boolean(data.isRead),
  };
}

function chatFromDoc(snap: DocumentSnapshot<DocumentData>): ChatThread | null {
  const data = snap.data();
  if (!data) return null;
  return {
    id: snap.id,
    clientId: str(data.clientId, snap.id),
    participantIds: strList(data.participantIds),
    lastMessageText: strOrNull(data.lastMessageText),
    lastMessageAt: toDate(data.lastMessageAt) ?? toDate(data.modifiedAt),
    lastAuthorId: strOrNull(data.lastAuthorId),
  };
}

function challengeFromDoc(snap: DocumentSnapshot<DocumentData>): Challenge | null {
  const data = snap.data();
  if (!data || typeof data.title !== "string" || typeof data.weekKey !== "string") return null;
  return {
    id: snap.id,
    title: data.title,
    description: str(data.description),
    weekKey: data.weekKey,
    target: Math.max(1, num(data.target, 1)),
    unit: str(data.unit, "veces"),
    points: num(data.points),
    audience: data.audience === "all" ? "all" : "trainer",
    trainerId: strOrNull(data.trainerId),
    createdBy: str(data.createdBy),
    createdByName: str(data.createdByName),
    active: data.active !== false,
  };
}

function progressFromDoc(snap: DocumentSnapshot<DocumentData>): ChallengeProgress | null {
  const data = snap.data();
  if (!data || typeof data.challengeId !== "string" || typeof data.uid !== "string") return null;
  return {
    id: snap.id,
    challengeId: data.challengeId,
    uid: data.uid,
    weekKey: str(data.weekKey),
    trainerIds: strList(data.trainerIds),
    progress: num(data.progress),
    checkIns: strList(data.checkIns),
    note: str(data.note),
    completed: data.completed === true,
    feedback: str(data.feedback),
    feedbackByName: str(data.feedbackByName),
    feedbackAt: toDate(data.feedbackAt),
    approved: data.approved === true,
  };
}

function entryFromDoc(snap: DocumentSnapshot<DocumentData>): LeaderboardEntry | null {
  const data = snap.data();
  if (!data || typeof data.uid !== "string") return null;
  return {
    id: snap.id,
    weekKey: str(data.weekKey),
    uid: data.uid,
    displayName: str(data.displayName, "Cliente"),
    sessions: num(data.sessions),
    challengePoints: num(data.challengePoints),
    visible: data.visible === true,
  };
}

const TIP_CATEGORIES: TipCategory[] = ["hidratacion", "sueno", "nutricion", "movilidad", "mente", "habitos"];

function tipFromDoc(snap: DocumentSnapshot<DocumentData>): Tip | null {
  const data = snap.data();
  if (!data || typeof data.title !== "string" || typeof data.body !== "string") return null;
  return {
    id: snap.id,
    title: data.title,
    body: data.body,
    category: TIP_CATEGORIES.includes(data.category) ? data.category : "habitos",
    createdByName: str(data.createdByName, "Equipo Activate"),
    createdAt: toDate(data.createdAt),
    custom: true,
  };
}

function planFromData(data: DocumentData): NutritionPlan {
  const meals: NutritionMeal[] = Array.isArray(data.meals)
    ? data.meals
        .filter((m: unknown): m is Record<string, unknown> => typeof m === "object" && m !== null)
        .map((m: Record<string, unknown>) => ({ name: str(m.name), description: str(m.description) }))
    : [];
  return {
    clientId: str(data.clientId),
    title: str(data.title, "Plan nutricional"),
    goal: str(data.goal),
    meals,
    notes: str(data.notes),
    updatedAt: toDate(data.updatedAt),
    updatedByName: str(data.updatedByName),
  };
}

export const store = new AppStore();
