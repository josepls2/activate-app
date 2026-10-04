"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  firebaseAuth,
  firebaseConfigured,
  firebaseDb,
  provisioningAuth,
} from "./firebase";

type ClientRecord = {
  id: string;
  name: string;
  dni: string;
  normalizedDni: string;
  email: string;
  phone: string;
  role: "client" | "reserve";
  trainerIds: string[];
  trainerStaffIds: string[];
  trainerNames: string;
  packName: string;
  packTotalSessions: number;
  usedSessions: number;
  reservedSessions: number;
  remainingSessions: number;
  sessionDuration: 45 | 60;
  isMinor: boolean;
  status: string;
};

type StaffRecord = {
  id: string;
  name: string;
  kind: "trainer" | "physiotherapist" | "room_rental" | "physio_room_rental";
  status: string;
  sortOrder: number;
  authUid: string;
  email: string;
};

type RoomRecord = {
  id: string;
  name: string;
  type: string;
};

type AuthStatus = "checking" | "unconfigured" | "signed-out" | "authorized";
type PanelView = "summary" | "clients" | "team";

type ClientDraft = {
  dni: string;
  name: string;
  email: string;
  phone: string;
  accountKind: "client" | "reserve";
  trainerStaffIds: string[];
  sessionDuration: 45 | 60;
  packName: string;
  packTotalSessions: number;
  gender: "unspecified" | "female" | "male";
  cycleTrackingEnabled: boolean;
  isMinor: boolean;
  guardianName: string;
  guardianEmail: string;
  termsAccepted: boolean;
  imageConsent: boolean;
};

const emptyDraft: ClientDraft = {
  dni: "",
  name: "",
  email: "",
  phone: "",
  accountKind: "client",
  trainerStaffIds: [],
  sessionDuration: 45,
  packName: "Pack 10 · 45 min",
  packTotalSessions: 10,
  gender: "unspecified",
  cycleTrackingEnabled: false,
  isMinor: false,
  guardianName: "",
  guardianEmail: "",
  termsAccepted: false,
  imageConsent: false,
};

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  return "No se ha podido completar la operación.";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDocument(value: string) {
  return value.toLocaleUpperCase("es").replace(/[^A-Z0-9]/g, "");
}

function temporaryPassword() {
  return `Activate-${crypto.randomUUID()}-Aa1!`;
}

function staffKindLabel(kind: StaffRecord["kind"]) {
  switch (kind) {
    case "trainer":
      return "Entrenador";
    case "physiotherapist":
      return "Fisioterapeuta";
    case "room_rental":
      return "Usuario de sala";
    case "physio_room_rental":
      return "Usuario sala de fisio";
  }
}

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    firebaseConfigured ? "checking" : "unconfigured",
  );
  const [bossName, setBossName] = useState("Dirección Activate");
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [activeView, setActiveView] = useState<PanelView>("summary");
  const [search, setSearch] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [clientDraft, setClientDraft] = useState<ClientDraft>(emptyDraft);
  const [existingMatch, setExistingMatch] = useState<ClientRecord | null>(null);
  const [packClient, setPackClient] = useState<ClientRecord | null>(null);
  const [staffToActivate, setStaffToActivate] = useState<StaffRecord | null>(null);
  const [setupMessage, setSetupMessage] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!firebaseConfigured || !firebaseAuth || !firebaseDb) return;

    const auth = firebaseAuth;
    const db = firebaseDb;
    let unsubscribeClients = () => {};
    let unsubscribeStaff = () => {};
    let unsubscribeRooms = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      unsubscribeClients();
      unsubscribeStaff();
      unsubscribeRooms();
      if (!user) {
        setAuthStatus("signed-out");
        return;
      }

      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        if (!profile.exists() || profile.data().role !== "boss") {
          await firebaseSignOut(auth);
          setLoginError("Esta cuenta no tiene acceso de Dirección.");
          setAuthStatus("signed-out");
          return;
        }

        setBossName(profile.data().name ?? user.email ?? "Dirección");
        setAuthStatus("authorized");

        unsubscribeClients = onSnapshot(
          query(collection(db, "users"), where("role", "in", ["client", "reserve"])),
          (snapshot) => {
            const rows = snapshot.docs.map((entry) => {
              const data = entry.data();
              return {
                id: entry.id,
                name: data.name ?? "",
                dni: data.dni ?? "",
                normalizedDni: data.normalizedDni ?? normalizeDocument(data.dni ?? ""),
                email: data.email ?? "",
                phone: data.phone ?? "",
                role: data.role === "reserve" ? "reserve" : "client",
                trainerIds: Array.isArray(data.trainerIds) ? data.trainerIds : [],
                trainerStaffIds: Array.isArray(data.trainerStaffIds)
                  ? data.trainerStaffIds
                  : [],
                trainerNames: Array.isArray(data.trainerNames)
                  ? data.trainerNames.join(", ")
                  : data.trainerName ??
                    (data.role === "reserve" ? "Dirección" : "Sin asignar"),
                packName: data.packName ?? "Sin pack",
                packTotalSessions: numberValue(data.packTotalSessions),
                usedSessions: numberValue(data.usedSessions),
                reservedSessions: numberValue(data.reservedSessions),
                remainingSessions: numberValue(data.remainingSessions),
                sessionDuration: data.sessionDuration === 60 ? 60 : 45,
                isMinor: data.isMinor === true,
                status: data.status ?? "active",
              } satisfies ClientRecord;
            });
            setClients(rows.sort((a, b) => a.name.localeCompare(b.name, "es")));
          },
        );

        unsubscribeStaff = onSnapshot(
          query(collection(db, "staffDirectory"), where("status", "==", "active")),
          (snapshot) => {
            const rows = snapshot.docs
              .map((entry) => {
                const data = entry.data();
                return {
                  id: entry.id,
                  name: data.name ?? "Equipo Activate",
                  kind: data.kind ?? "trainer",
                  status: data.status ?? "active",
                  sortOrder: numberValue(data.sortOrder),
                  authUid: data.authUid ?? "",
                  email: data.email ?? "",
                } satisfies StaffRecord;
              })
              .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"));
            setStaff(rows);
          },
        );

        unsubscribeRooms = onSnapshot(
          query(collection(db, "rooms"), where("status", "==", "active")),
          (snapshot) => {
            setRooms(
              snapshot.docs
                .map((entry) => ({
                  id: entry.id,
                  name: entry.data().name ?? "Sala",
                  type: entry.data().type ?? "training_and_rental",
                }))
                .sort((a, b) => a.name.localeCompare(b.name, "es")),
            );
          },
        );
      } catch (error) {
        setLoginError(errorText(error));
        setAuthStatus("signed-out");
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeClients();
      unsubscribeStaff();
      unsubscribeRooms();
    };
  }, []);

  const trainerStaff = useMemo(
    () => staff.filter((person) => person.kind === "trainer"),
    [staff],
  );

  const filteredClients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    if (!term) return clients;
    const normalized = normalizeDocument(term);
    return clients.filter((client) =>
      [
        client.name,
        client.dni,
        client.normalizedDni,
        client.email,
        client.phone,
        client.trainerNames,
      ]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(term) ||
      (normalized.length > 2 && client.normalizedDni.includes(normalized)),
    );
  }, [clients, search]);

  const totalRemaining = clients.reduce(
    (total, client) => total + client.remainingSessions,
    0,
  );
  const lowPacks = clients.filter((client) => client.remainingSessions <= 2).length;
  const linkedTrainers = trainerStaff.filter((person) => person.authUid).length;

  function updateDraft<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setClientDraft((current) => ({ ...current, [key]: value }));
  }

  function handleDniChange(value: string) {
    const normalized = normalizeDocument(value);
    const match = clients.find((client) => client.normalizedDni === normalized) ?? null;
    setExistingMatch(match);
    if (match) {
      setClientDraft((current) => ({
        ...current,
        dni: match.dni,
        name: match.name,
        email: match.email,
        phone: match.phone,
        accountKind: match.role,
        trainerStaffIds: match.trainerStaffIds,
        sessionDuration: match.sessionDuration,
        packName: match.packName,
      }));
    } else {
      updateDraft("dni", value.toLocaleUpperCase("es"));
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    const form = new FormData(event.currentTarget);
    try {
      if (!firebaseAuth) throw new Error("Firebase no está configurado.");
      await signInWithEmailAndPassword(
        firebaseAuth,
        String(form.get("email") ?? "").trim(),
        String(form.get("password") ?? ""),
      );
    } catch (error) {
      setLoginError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (firebaseAuth) await firebaseSignOut(firebaseAuth);
  }

  async function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");

    try {
      if (!firebaseAuth?.currentUser || !firebaseDb) {
        throw new Error("La sesión de Dirección ha caducado.");
      }
      if (existingMatch) {
        throw new Error("Este DNI ya pertenece a un cliente. Abre su ficha para gestionarlo.");
      }

      const payload = clientDraft;
      const normalizedDni = normalizeDocument(payload.dni);
      const normalizedEmail = payload.email.trim().toLowerCase();
      if (normalizedDni.length < 6) throw new Error("Introduce un DNI, NIE o documento válido.");
      if (!payload.name.trim() || !normalizedEmail.includes("@") || !payload.phone.trim()) {
        throw new Error("Completa nombre, email y teléfono.");
      }
      if (payload.accountKind === "client" && payload.trainerStaffIds.length === 0) {
        throw new Error("Asigna al menos un entrenador real de Activate.");
      }
      if (payload.packTotalSessions < 1 || !Number.isInteger(payload.packTotalSessions)) {
        throw new Error("Indica un número entero de sesiones mayor que cero.");
      }
      if (payload.cycleTrackingEnabled && payload.gender !== "female") {
        throw new Error("El seguimiento de ciclo sólo puede activarse en una clienta.");
      }
      if (payload.isMinor && (!payload.guardianName.trim() || !payload.guardianEmail.includes("@"))) {
        throw new Error("Completa los datos del responsable legal.");
      }

      const documentReference = doc(firebaseDb, "clientDocuments", normalizedDni);
      if ((await getDoc(documentReference)).exists()) {
        throw new Error("Ya existe una cuenta vinculada a este documento.");
      }

      const selectedStaff = trainerStaff.filter((trainer) =>
        payload.trainerStaffIds.includes(trainer.id),
      );
      const trainerIds = selectedStaff.map((trainer) => trainer.authUid).filter(Boolean);
      const trainerNames = selectedStaff.map((trainer) => trainer.name);
      const secondaryAuth = provisioningAuth();
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizedEmail,
        temporaryPassword(),
      );
      const createdUser = credential.user;
      const bossUid = firebaseAuth.currentUser.uid;

      try {
        const batch = writeBatch(firebaseDb);
        batch.set(doc(firebaseDb, "users", createdUser.uid), {
          uid: createdUser.uid,
          dni: payload.dni.trim().toLocaleUpperCase("es"),
          normalizedDni,
          email: normalizedEmail,
          name: payload.name.trim(),
          phone: payload.phone.trim(),
          role: payload.accountKind,
          isTrainer: false,
          trainerIds: payload.accountKind === "client" ? trainerIds : [],
          trainerStaffIds:
            payload.accountKind === "client" ? payload.trainerStaffIds : [],
          trainerNames: payload.accountKind === "client" ? trainerNames : [],
          allowedRoomIds:
            payload.accountKind === "reserve"
              ? ["upstairs", "downstairs", "physio"]
              : [],
          packId: crypto.randomUUID(),
          packName: payload.packName.trim(),
          packTotalSessions: payload.packTotalSessions,
          usedSessions: 0,
          reservedSessions: 0,
          remainingSessions: payload.packTotalSessions,
          sessionDuration: payload.sessionDuration,
          isMinor: payload.accountKind === "client" && payload.isMinor,
          guardianName:
            payload.accountKind === "client" && payload.isMinor
              ? payload.guardianName.trim()
              : null,
          guardianEmail:
            payload.accountKind === "client" && payload.isMinor
              ? payload.guardianEmail.trim().toLowerCase()
              : null,
          termsAccepted: payload.termsAccepted,
          termsVersion: payload.termsAccepted ? "2026-07-27" : null,
          imageConsent: payload.imageConsent,
          gender: payload.accountKind === "client" ? payload.gender : "unspecified",
          cycleTrackingEnabled:
            payload.accountKind === "client" && payload.cycleTrackingEnabled,
          cycleSharingEnabled: false,
          status: "active",
          createdBy: bossUid,
          createdAt: serverTimestamp(),
          modifiedAt: serverTimestamp(),
          modifiedBy: bossUid,
        });
        batch.set(documentReference, {
          userId: createdUser.uid,
          normalizedDni,
          createdAt: serverTimestamp(),
          createdBy: bossUid,
        });
        batch.set(doc(collection(firebaseDb, "activityLogs")), {
          actorId: bossUid,
          action: payload.accountKind === "reserve" ? "create_room_user" : "create_client",
          resourceId: createdUser.uid,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        await sendPasswordResetEmail(secondaryAuth, normalizedEmail);
      } catch (error) {
        await deleteUser(createdUser).catch(() => undefined);
        throw error;
      } finally {
        await firebaseSignOut(secondaryAuth).catch(() => undefined);
      }

      setSetupMessage(
        `Cuenta creada para ${normalizedEmail}. Firebase ha enviado el correo para definir la contraseña.`,
      );
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleActivateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffToActivate) return;
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();

    try {
      if (!firebaseAuth?.currentUser || !firebaseDb) {
        throw new Error("La sesión de Dirección ha caducado.");
      }
      if (!email.includes("@")) throw new Error("Introduce el email real del entrenador.");
      if (staffToActivate.authUid) throw new Error("Este acceso ya está activado.");

      const secondaryAuth = provisioningAuth();
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        temporaryPassword(),
      );
      const createdUser = credential.user;
      const bossUid = firebaseAuth.currentUser.uid;

      try {
        const assignedClients = await getDocs(
          query(
            collection(firebaseDb, "users"),
            where("trainerStaffIds", "array-contains", staffToActivate.id),
          ),
        );
        const batch = writeBatch(firebaseDb);
        batch.set(doc(firebaseDb, "users", createdUser.uid), {
          uid: createdUser.uid,
          email,
          name: staffToActivate.name,
          phone: "",
          role: "trainer",
          isTrainer: true,
          staffId: staffToActivate.id,
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
          createdBy: bossUid,
          createdAt: serverTimestamp(),
          modifiedAt: serverTimestamp(),
          modifiedBy: bossUid,
        });
        batch.update(doc(firebaseDb, "staffDirectory", staffToActivate.id), {
          authUid: createdUser.uid,
          email,
          linkedAt: serverTimestamp(),
          linkedBy: bossUid,
        });
        assignedClients.forEach((client) => {
          batch.update(client.ref, {
            trainerIds: arrayUnion(createdUser.uid),
            modifiedAt: serverTimestamp(),
            modifiedBy: bossUid,
          });
        });
        batch.set(doc(collection(firebaseDb, "activityLogs")), {
          actorId: bossUid,
          action: "activate_trainer_access",
          resourceId: createdUser.uid,
          staffId: staffToActivate.id,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        await sendPasswordResetEmail(secondaryAuth, email);
      } catch (error) {
        await deleteUser(createdUser).catch(() => undefined);
        throw error;
      } finally {
        await firebaseSignOut(secondaryAuth).catch(() => undefined);
      }

      setNotice(`Acceso activado para ${staffToActivate.name}. Se ha enviado el email de contraseña.`);
      setStaffToActivate(null);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddSessions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!packClient) return;
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const sessionsToAdd = Number(form.get("sessionsToAdd"));
    const requestedDuration = Number(form.get("sessionDuration")) === 60 ? 60 : 45;
    const packName = String(form.get("packName") ?? "").trim();

    try {
      if (!Number.isInteger(sessionsToAdd) || sessionsToAdd < 1) {
        throw new Error("Indica un número entero de sesiones mayor que cero.");
      }
      if (!firebaseAuth?.currentUser || !firebaseDb) {
        throw new Error("La sesión de Dirección ha caducado.");
      }
      const db = firebaseDb;
      const bossUid = firebaseAuth.currentUser.uid;
      const userReference = doc(db, "users", packClient.id);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(userReference);
        if (!snapshot.exists()) throw new Error("La cuenta ya no existe.");
        const data = snapshot.data();
        const currentTotal = numberValue(data.packTotalSessions);
        const currentRemaining = numberValue(data.remainingSessions);
        const currentReserved = numberValue(data.reservedSessions);
        const currentDuration = numberValue(data.sessionDuration) === 60 ? 60 : 45;
        if (
          currentTotal > 0 &&
          (currentRemaining > 0 || currentReserved > 0) &&
          currentDuration !== requestedDuration
        ) {
          throw new Error(
            "No se puede cambiar la duración mientras queden sesiones disponibles o reservadas.",
          );
        }
        transaction.update(userReference, {
          packName,
          packTotalSessions: currentTotal + sessionsToAdd,
          remainingSessions: currentRemaining + sessionsToAdd,
          sessionDuration: requestedDuration,
          modifiedAt: serverTimestamp(),
          modifiedBy: bossUid,
        });
        transaction.set(doc(collection(db, "activityLogs")), {
          actorId: bossUid,
          action: "add_pack_sessions",
          resourceId: packClient.id,
          sessionsAdded: sessionsToAdd,
          createdAt: serverTimestamp(),
        });
      });
      setPackClient(null);
      setNotice(`Se han añadido ${sessionsToAdd} sesiones a ${packClient.name}.`);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  function openCreatePanel() {
    setClientDraft(emptyDraft);
    setExistingMatch(null);
    setSetupMessage("");
    setNotice("");
    setCreateOpen(true);
  }

  function closeCreatePanel() {
    setCreateOpen(false);
    setClientDraft(emptyDraft);
    setExistingMatch(null);
    setSetupMessage("");
    setNotice("");
  }

  if (authStatus === "checking") {
    return (
      <main className="loading-screen">
        <Image src="/activate-icon.png" width={72} height={72} alt="Activate" priority />
        <span className="loading-dot" />
        <p>Comprobando acceso seguro…</p>
      </main>
    );
  }

  if (authStatus === "unconfigured") {
    return (
      <main className="loading-screen">
        <Image src="/activate-icon.png" width={72} height={72} alt="Activate" priority />
        <p>Panel no configurado</p>
        <small>Dirección debe conectar Firebase antes de publicar este entorno.</small>
      </main>
    );
  }

  if (authStatus === "signed-out") {
    return (
      <main className="login-page">
        <section className="login-brand">
          <Image
            src="/activate-logo.png"
            width={640}
            height={220}
            alt="Activate Personal Training"
            className="brand-logo"
            priority
          />
          <div>
            <span className="eyebrow">Panel interno</span>
            <h1>Clientes, equipo y bonos conectados al centro real.</h1>
            <p>
              Alta de clientes, asignación de entrenadores y control de sesiones
              desde un único espacio privado.
            </p>
          </div>
          <div className="login-security">
            <span className="security-mark">✓</span>
            <div>
              <strong>Acceso exclusivo para Dirección</strong>
              <small>Los permisos se validan también en Firebase.</small>
            </div>
          </div>
        </section>
        <section className="login-panel">
          <div className="login-card">
            <span className="eyebrow">Activate Personal Training</span>
            <h2>Acceso Dirección</h2>
            <p className="muted">Entra con la cuenta administrativa. No existe registro público.</p>
            <form onSubmit={handleLogin} className="form-stack">
              <label>
                Email
                <input name="email" type="email" autoComplete="username" required />
              </label>
              <label>
                Contraseña
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              {loginError && <p className="form-error">{loginError}</p>}
              <button className="primary-button" disabled={busy} type="submit">
                {busy ? "Comprobando…" : "Entrar al panel"}
              </button>
            </form>
            <p className="privacy-note">Sin pagos integrados · La facturación se gestiona externamente.</p>
          </div>
        </section>
      </main>
    );
  }

  const viewTitle =
    activeView === "clients"
      ? "Clientes"
      : activeView === "team"
        ? "Equipo y espacios"
        : `Buenos días, ${bossName.split(" ")[0]}`;

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <Image
          src="/activate-logo.png"
          width={300}
          height={104}
          alt="Activate Personal Training"
          className="sidebar-logo"
          priority
        />
        <nav aria-label="Navegación principal">
          <button
            className={`nav-item ${activeView === "summary" ? "active" : ""}`}
            onClick={() => setActiveView("summary")}
          >
            <span>⌂</span> Resumen
          </button>
          <button
            className={`nav-item ${activeView === "clients" ? "active" : ""}`}
            onClick={() => setActiveView("clients")}
          >
            <span>◎</span> Clientes
          </button>
          <button
            className={`nav-item ${activeView === "team" ? "active" : ""}`}
            onClick={() => setActiveView("team")}
          >
            <span>◫</span> Equipo y salas
          </button>
          <button className="nav-item" onClick={openCreatePanel}>
            <span>＋</span> Alta cliente
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="profile-avatar">{bossName.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{bossName}</strong>
            <small>Dirección</small>
          </div>
          <button onClick={handleSignOut} aria-label="Cerrar sesión">↗</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Centro piloto · Firebase real</span>
            <h1>{viewTitle}</h1>
            <p>
              {activeView === "summary" && "Estado operativo del centro."}
              {activeView === "clients" && "Busca por nombre, DNI, email, teléfono o entrenador."}
              {activeView === "team" && "Directorio real, accesos y espacios disponibles."}
            </p>
          </div>
          <div className="topbar-actions">
            <span className="external-payment">Cobro externo</span>
            <button className="primary-button compact" onClick={openCreatePanel}>
              + Nuevo cliente
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {activeView === "summary" && (
          <>
            <section className="metrics" aria-label="Resumen del centro">
              <article className="metric-card featured">
                <span>Clientes activos</span>
                <strong>{clients.length}</strong>
                <small>Registros reales en Firebase</small>
              </article>
              <article className="metric-card">
                <span>Sesiones disponibles</span>
                <strong>{totalRemaining}</strong>
                <small>Suma de todos los bonos</small>
              </article>
              <article className="metric-card">
                <span>Bonos por renovar</span>
                <strong>{lowPacks}</strong>
                <small>Con 2 sesiones o menos</small>
              </article>
              <article className="metric-card muted-card">
                <span>Entrenadores con acceso</span>
                <strong>{linkedTrainers}/{trainerStaff.length}</strong>
                <small>Roger, Tobias y Domi</small>
              </article>
            </section>

            <section className="overview-grid">
              <article className="overview-card">
                <div className="section-heading compact-heading">
                  <div>
                    <span className="eyebrow">Acción rápida</span>
                    <h2>Localizar cliente</h2>
                    <p>El DNI permite abrir una ficha sin repetir datos.</p>
                  </div>
                </div>
                <label className="search-box wide-search">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onFocus={() => setActiveView("clients")}
                    placeholder="Nombre, DNI, email o teléfono"
                    aria-label="Localizar cliente"
                  />
                </label>
                <button className="secondary-button wide" onClick={() => setActiveView("clients")}>
                  Abrir base de clientes
                </button>
              </article>
              <article className="overview-card">
                <span className="eyebrow">Centro</span>
                <h2>Espacios operativos</h2>
                <div className="room-list">
                  {rooms.map((room) => (
                    <div key={room.id}>
                      <span className="status-dot" />
                      <strong>{room.name}</strong>
                      <small>{room.type === "physiotherapy_and_rental" ? "Fisio y reservas" : "Entrenos y reservas"}</small>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}

        {activeView === "clients" && (
          <section className="clients-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Base de clientes</span>
                <h2>Clientes y sesiones</h2>
                <p>
                  Datos reales de Firebase. Añade sesiones solo después de gestionar el cobro fuera de la aplicación.
                </p>
              </div>
              <label className="search-box">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, DNI, email, teléfono…"
                  aria-label="Buscar clientes"
                  autoFocus
                />
              </label>
            </div>

            <div className="client-table">
              <div className="table-head">
                <span>Cliente</span>
                <span>Entrenador</span>
                <span>Pack</span>
                <span>Sesiones</span>
                <span />
              </div>
              {filteredClients.map((client) => {
                const progress =
                  client.packTotalSessions > 0
                    ? (client.usedSessions / client.packTotalSessions) * 100
                    : 0;
                return (
                  <article className="client-row" key={client.id}>
                    <div className="client-identity">
                      <span className="client-avatar">
                        {client.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                      </span>
                      <div>
                        <strong>{client.name}</strong>
                        <small>{client.dni ? `${client.dni} · ${client.email}` : client.email}</small>
                        {client.isMinor && <em>Cuenta de menor</em>}
                      </div>
                    </div>
                    <div className="cell" data-label="Entrenador">
                      <strong>{client.trainerNames}</strong>
                      <small>{client.sessionDuration} minutos</small>
                    </div>
                    <div className="cell" data-label="Pack">
                      <strong>{client.packName}</strong>
                      <small>{client.phone}</small>
                    </div>
                    <div className="pack-progress" data-label="Sesiones">
                      <div>
                        <strong>{client.remainingSessions}</strong>
                        <small> disponibles de {client.packTotalSessions} · {client.reservedSessions} reservadas</small>
                      </div>
                      <span><i style={{ width: `${Math.min(100, progress)}%` }} /></span>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setNotice("");
                        setPackClient(client);
                      }}
                    >
                      Añadir sesiones
                    </button>
                  </article>
                );
              })}
              {filteredClients.length === 0 && (
                <div className="empty-state">
                  <strong>{clients.length === 0 ? "Todavía no hay clientes reales." : "No hay coincidencias."}</strong>
                  <span>
                    {clients.length === 0
                      ? "Crea el primero desde “Nuevo cliente”."
                      : "Prueba con otro nombre, DNI, email, teléfono o entrenador."}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {activeView === "team" && (
          <section className="team-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Directorio Firebase</span>
                <h2>Equipo real de Activate</h2>
                <p>
                  El directorio ya es real. Para iniciar sesión, cada entrenador necesita vincular su email profesional.
                </p>
              </div>
            </div>
            <div className="staff-grid">
              {staff.map((person) => (
                <article className="staff-card" key={person.id}>
                  <div className="staff-avatar">{person.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <strong>{person.name}</strong>
                    <small>{staffKindLabel(person.kind)}</small>
                  </div>
                  {person.kind === "trainer" ? (
                    person.authUid ? (
                      <span className="access-pill ready">Acceso activo</span>
                    ) : (
                      <button className="secondary-button" onClick={() => setStaffToActivate(person)}>
                        Activar acceso
                      </button>
                    )
                  ) : (
                    <span className="access-pill">Directorio</span>
                  )}
                  {person.email && <p>{person.email}</p>}
                </article>
              ))}
            </div>
            <div className="rooms-panel">
              <span className="eyebrow">Reservas</span>
              <h2>Salas disponibles</h2>
              <div className="room-list horizontal">
                {rooms.map((room) => (
                  <div key={room.id}>
                    <span className="status-dot" />
                    <strong>{room.name}</strong>
                    <small>Disponible en el calendario de reservas</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </section>

      {createOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="create-client-title">
            <header className="drawer-header">
              <div>
                <span className="eyebrow">Alta conectada a Firebase</span>
                <h2 id="create-client-title">Nuevo cliente</h2>
                <p>Escribe primero el DNI: si ya existe, la ficha se rellena automáticamente.</p>
              </div>
              <button className="icon-button" onClick={closeCreatePanel} aria-label="Cerrar">×</button>
            </header>

            {setupMessage ? (
              <div className="success-panel">
                <span className="success-icon">✓</span>
                <h3>Cliente creado correctamente</h3>
                <p>La cuenta, sus entrenadores y el bono ya están en Firebase real.</p>
                <p className="payment-callout">{setupMessage}</p>
                <button className="secondary-button wide" onClick={closeCreatePanel}>Terminar</button>
              </div>
            ) : (
              <form className="drawer-form" onSubmit={handleCreateClient}>
                <fieldset>
                  <legend>Identificación y búsqueda</legend>
                  <label>
                    DNI, NIE o documento
                    <input
                      name="dni"
                      value={clientDraft.dni}
                      onChange={(event) => handleDniChange(event.target.value)}
                      list="existing-client-documents"
                      autoComplete="off"
                      placeholder="Ej. 12345678A"
                      required
                      maxLength={24}
                    />
                    <datalist id="existing-client-documents">
                      {clients.filter((client) => client.dni).map((client) => (
                        <option key={client.id} value={client.dni}>{client.name}</option>
                      ))}
                    </datalist>
                  </label>
                  {existingMatch && (
                    <div className="existing-client-alert">
                      <strong>Cliente encontrado: {existingMatch.name}</strong>
                      <span>Los datos se han rellenado desde Firebase. No se creará un duplicado.</span>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setCreateOpen(false);
                          setPackClient(existingMatch);
                        }}
                      >
                        Abrir ficha y sesiones
                      </button>
                    </div>
                  )}
                </fieldset>

                <fieldset disabled={Boolean(existingMatch)}>
                  <legend>Datos personales</legend>
                  <div className="form-grid">
                    <label className="span-two">
                      Nombre completo
                      <input
                        name="name"
                        value={clientDraft.name}
                        onChange={(event) => updateDraft("name", event.target.value)}
                        autoComplete="name"
                        required
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        value={clientDraft.email}
                        onChange={(event) => updateDraft("email", event.target.value)}
                        autoComplete="email"
                        required
                        maxLength={254}
                      />
                    </label>
                    <label>
                      Teléfono
                      <input
                        name="phone"
                        type="tel"
                        value={clientDraft.phone}
                        onChange={(event) => updateDraft("phone", event.target.value)}
                        autoComplete="tel"
                        required
                        maxLength={40}
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset disabled={Boolean(existingMatch)}>
                  <legend>Cuenta, entrenadores y bono</legend>
                  <label>
                    Tipo de cuenta
                    <select
                      value={clientDraft.accountKind}
                      onChange={(event) => updateDraft("accountKind", event.target.value as ClientDraft["accountKind"])}
                    >
                      <option value="client">Cliente Activate</option>
                      <option value="reserve">Usuario de sala</option>
                    </select>
                  </label>
                  {clientDraft.accountKind === "client" && (
                    <div className="trainer-selection">
                      <span>Entrenadores reales asignados</span>
                      {trainerStaff.map((trainer) => (
                        <label className="check-row" key={trainer.id}>
                          <input
                            type="checkbox"
                            checked={clientDraft.trainerStaffIds.includes(trainer.id)}
                            onChange={(event) => {
                              updateDraft(
                                "trainerStaffIds",
                                event.target.checked
                                  ? [...clientDraft.trainerStaffIds, trainer.id]
                                  : clientDraft.trainerStaffIds.filter((id) => id !== trainer.id),
                              );
                            }}
                          />
                          <span>
                            <strong>{trainer.name}</strong>
                            <small>{trainer.authUid ? "Acceso Firebase activo" : "Asignable · acceso pendiente"}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="form-grid">
                    <label>
                      Duración
                      <select
                        value={clientDraft.sessionDuration}
                        onChange={(event) => {
                          const duration = Number(event.target.value) === 60 ? 60 : 45;
                          setClientDraft((current) => ({
                            ...current,
                            sessionDuration: duration,
                            packName: `Pack ${current.packTotalSessions} · ${duration} min`,
                          }));
                        }}
                      >
                        <option value="45">45 minutos</option>
                        <option value="60">60 minutos</option>
                      </select>
                    </label>
                    <label>
                      Nombre del pack
                      <input
                        value={clientDraft.packName}
                        onChange={(event) => updateDraft("packName", event.target.value)}
                        required
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Número de sesiones
                      <input
                        type="number"
                        value={clientDraft.packTotalSessions}
                        onChange={(event) => updateDraft("packTotalSessions", Number(event.target.value))}
                        min="1"
                        max="200"
                        required
                      />
                    </label>
                  </div>
                </fieldset>

                {clientDraft.accountKind === "client" && (
                  <fieldset disabled={Boolean(existingMatch)}>
                    <legend>Privacidad y salud</legend>
                    <label>
                      Sexo (para módulos de salud)
                      <select
                        value={clientDraft.gender}
                        onChange={(event) => updateDraft("gender", event.target.value as ClientDraft["gender"])}
                      >
                        <option value="unspecified">Sin indicar</option>
                        <option value="female">Mujer</option>
                        <option value="male">Hombre</option>
                      </select>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={clientDraft.cycleTrackingEnabled}
                        onChange={(event) => updateDraft("cycleTrackingEnabled", event.target.checked)}
                      />
                      <span><strong>Activar seguimiento de ciclo</strong><small>Solo para clientas que lo soliciten.</small></span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={clientDraft.isMinor}
                        onChange={(event) => updateDraft("isMinor", event.target.checked)}
                      />
                      <span><strong>El cliente es menor de edad</strong><small>Requiere responsable legal.</small></span>
                    </label>
                    {clientDraft.isMinor && (
                      <div className="form-grid guardian-grid">
                        <label>
                          Responsable legal
                          <input
                            value={clientDraft.guardianName}
                            onChange={(event) => updateDraft("guardianName", event.target.value)}
                            required
                          />
                        </label>
                        <label>
                          Email del responsable
                          <input
                            type="email"
                            value={clientDraft.guardianEmail}
                            onChange={(event) => updateDraft("guardianEmail", event.target.value)}
                            required
                          />
                        </label>
                      </div>
                    )}
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={clientDraft.termsAccepted}
                        onChange={(event) => updateDraft("termsAccepted", event.target.checked)}
                      />
                      <span><strong>Términos aceptados</strong><small>Marca solo si existe evidencia.</small></span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={clientDraft.imageConsent}
                        onChange={(event) => updateDraft("imageConsent", event.target.checked)}
                      />
                      <span><strong>Autoriza el uso de imagen</strong><small>Consentimiento separado y revocable.</small></span>
                    </label>
                  </fieldset>
                )}

                {notice && <p className="form-error">{notice}</p>}
                <footer className="drawer-actions">
                  <button className="secondary-button wide" type="button" onClick={closeCreatePanel}>Cancelar</button>
                  <button className="primary-button wide" disabled={busy || Boolean(existingMatch)} type="submit">
                    {busy ? "Creando…" : "Crear cliente y bono"}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}

      {packClient && (
        <div className="modal-backdrop centered" role="presentation">
          <section className="pack-modal" role="dialog" aria-modal="true" aria-labelledby="pack-title">
            <header className="drawer-header">
              <div>
                <span className="eyebrow">Ficha real</span>
                <h2 id="pack-title">{packClient.name}</h2>
                <p>
                  {packClient.dni ? `${packClient.dni} · ` : ""}{packClient.email}<br />
                  {packClient.remainingSessions} sesiones disponibles.
                </p>
              </div>
              <button className="icon-button" onClick={() => setPackClient(null)} aria-label="Cerrar">×</button>
            </header>
            <form className="form-stack" onSubmit={handleAddSessions}>
              <label>
                Nombre del pack
                <input name="packName" defaultValue={packClient.packName} required maxLength={120} />
              </label>
              <div className="form-grid">
                <label>
                  Sesiones a añadir
                  <input name="sessionsToAdd" type="number" defaultValue="5" min="1" max="100" required />
                </label>
                <label>
                  Duración
                  <select name="sessionDuration" defaultValue={String(packClient.sessionDuration)}>
                    <option value="45">45 minutos</option>
                    <option value="60">60 minutos</option>
                  </select>
                </label>
              </div>
              <p className="payment-callout"><strong>Sin cobro automático.</strong> Confirma antes que el pago se ha gestionado externamente.</p>
              <footer className="drawer-actions">
                <button className="secondary-button wide" type="button" onClick={() => setPackClient(null)}>Cancelar</button>
                <button className="primary-button wide" disabled={busy} type="submit">
                  {busy ? "Guardando…" : "Confirmar sesiones"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {staffToActivate && (
        <div className="modal-backdrop centered" role="presentation">
          <section className="pack-modal" role="dialog" aria-modal="true" aria-labelledby="staff-access-title">
            <header className="drawer-header">
              <div>
                <span className="eyebrow">Acceso del equipo</span>
                <h2 id="staff-access-title">Activar a {staffToActivate.name}</h2>
                <p>Usa su email real. Recibirá un enlace para crear la contraseña.</p>
              </div>
              <button className="icon-button" onClick={() => setStaffToActivate(null)} aria-label="Cerrar">×</button>
            </header>
            <form className="form-stack" onSubmit={handleActivateStaff}>
              <label>
                Email profesional
                <input name="email" type="email" autoComplete="email" required />
              </label>
              {notice && <p className="form-error">{notice}</p>}
              <footer className="drawer-actions">
                <button className="secondary-button wide" type="button" onClick={() => setStaffToActivate(null)}>Cancelar</button>
                <button className="primary-button wide" disabled={busy} type="submit">
                  {busy ? "Activando…" : "Crear acceso Firebase"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
