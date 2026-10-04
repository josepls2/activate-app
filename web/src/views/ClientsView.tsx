// Port de ios/CodexGym/Views/ClientsView.swift.
import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Clock,
  Droplet,
  Flame,
  IdCard,
  Layers,
  Leaf,
  Lock,
  MessageCircle,
  NotebookPen,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import {
  capitalize,
  currentWeek,
  cycleFlowLabel,
  formatLongDay,
  formatShortDay,
  LIMITS,
  roleLabel,
  todayKey,
  type AppUser,
  type CycleEntry,
} from "../lib/domain";
import { attendanceHistory, lastAttendance, sessionsInWeek, weeklyStreak } from "../lib/engagement";
import { store } from "../lib/store";
import { EmptyState, ScreenHeader, SectionTitle, Sheet, StatTile, useAppState } from "../ui";
import { NutritionEditor } from "./NutritionView";

export function ClientsView() {
  const state = useAppState();
  const viewer = state.currentUser;
  const [search, setSearch] = useState("");
  const [nutritionFor, setNutritionFor] = useState<AppUser | null>(null);
  const [detailFor, setDetailFor] = useState<AppUser | null>(null);

  const term = search.trim().toLocaleLowerCase("es");
  const people = term
    ? state.managedUsers.filter((p) =>
        [p.name, p.email, p.dni, p.phone].some((v) => v.toLocaleLowerCase("es").includes(term)),
      )
    : state.managedUsers;

  return (
    <div className="screen tight">
      <ScreenHeader
        eyebrow={viewer ? roleLabel[viewer.role] : "Equipo"}
        title="Resumen de clientes"
        subtitle={viewer?.role === "boss" ? "Clientes Activate y usuarios de sala" : "Sólo tus clientes asignados"}
        badge={people.length}
      />
      <input
        className="input on-bg"
        type="search"
        placeholder="Buscar por nombre, DNI, email o teléfono"
        aria-label="Buscar clientes"
        autoCapitalize="none"
        maxLength={80}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin clientes asignados"
          message="Los clientes aparecerán aquí al asignarlos desde Dirección."
        />
      ) : (
        people.map((person) => (
          <ClientSummaryCard
            key={person.id}
            person={person}
            cycle={state.clientCycleSummaries[person.id]}
            showCycle={Boolean(viewer?.isTrainer && person.trainerIds.includes(viewer.id))}
            canMessage={Boolean(viewer?.isTrainer && person.role === "client" && person.trainerIds.includes(viewer.id))}
            canPlan={Boolean(
              person.role === "client" && (viewer?.role === "boss" || (viewer && person.trainerIds.includes(viewer.id))),
            )}
            onMessage={() => {
              void store.openChat(person.id);
              window.location.hash = "#chat";
            }}
            onPlan={() => setNutritionFor(person)}
            onOpen={() => setDetailFor(person)}
          />
        ))
      )}
      {nutritionFor && <NutritionEditor client={nutritionFor} onClose={() => setNutritionFor(null)} />}
      {detailFor && (
        <ClientDetailSheet
          client={state.managedUsers.find((u) => u.id === detailFor.id) ?? detailFor}
          onClose={() => setDetailFor(null)}
          onPlan={() => {
            setNutritionFor(detailFor);
            setDetailFor(null);
          }}
        />
      )}
    </div>
  );
}

function ClientSummaryCard(props: {
  person: AppUser;
  cycle?: CycleEntry;
  showCycle: boolean;
  canMessage: boolean;
  canPlan: boolean;
  onMessage: () => void;
  onPlan: () => void;
  onOpen: () => void;
}) {
  const { person, cycle } = props;
  const state = useAppState();
  const last = lastAttendance(state.sessions, person.id);
  const isRoom = person.role === "reserve";
  const trainerCount = person.trainerIds.length;
  return (
    <div className="card stack" style={{ gap: 13 }}>
      <button className="row top list-item-button" onClick={props.onOpen} aria-label={`Abrir ficha de ${person.name}`}>
        <div className="spacer">
          <div className="bold" style={{ fontSize: 17 }}>
            {person.name}
          </div>
          <div className="caption bold" style={{ marginTop: 4, color: isRoom ? "var(--orange)" : "var(--red-light)" }}>
            {isRoom ? roleLabel.reserve : "Cliente Activate"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="bold" style={{ fontSize: 22 }}>
            {person.remainingSessions}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>
            restantes
          </div>
        </div>
      </button>
      <div className="meta" style={{ color: "var(--text-2)" }}>
        <span>
          <Clock size={13} /> {person.sessionDuration} min
        </span>
        {!isRoom && (
          <span>
            <Users size={13} /> {trainerCount} entrenador{trainerCount === 1 ? "" : "es"}
          </span>
        )}
        <span>
          <CalendarCheck size={13} /> {last ? `Última: ${formatShortDay(last)}` : "Sin sesiones aún"}
        </span>
      </div>

      {props.showCycle && person.role === "client" && person.cycleTrackingEnabled && (
        <>
          <div className="divider" />
          {!person.cycleSharingEnabled ? (
            <span className="inline-icon caption muted">
              <Lock size={12} /> La clienta no ha activado compartir el ciclo
            </span>
          ) : cycle ? (
            <div className="stack" style={{ gap: 6 }}>
              <span className="inline-icon caption bold" style={{ color: "var(--red-light)" }}>
                <Droplet size={12} /> Resumen de ciclo compartido
              </span>
              <span className="caption" style={{ color: "var(--text-2)" }}>
                {cycle.mood} · {cycleFlowLabel[cycle.flow]}
                {cycle.symptoms.length ? ` · ${[...cycle.symptoms].sort().join(", ")}` : ""}
              </span>
            </div>
          ) : (
            <span className="caption muted">Sin registros de ciclo compartidos.</span>
          )}
        </>
      )}

      {(props.canMessage || props.canPlan || person.role === "client") && (
        <div className="card-actions">
          {person.role === "client" && (
            <button className="btn btn-secondary" onClick={props.onOpen}>
              <IdCard size={16} /> Ficha
            </button>
          )}
          {props.canMessage && (
            <button className="btn btn-secondary" onClick={props.onMessage}>
              <MessageCircle size={16} /> Mensaje
            </button>
          )}
          {props.canPlan && (
            <button className="btn btn-secondary" onClick={props.onPlan}>
              <Leaf size={16} /> Nutrición
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Ficha del cliente para su entrenador (y Dirección). */
export function ClientDetailSheet(props: { client: AppUser; onClose: () => void; onPlan?: () => void }) {
  const state = useAppState();
  const viewer = state.currentUser!;
  const { client } = props;
  const week = currentWeek();
  const done = sessionsInWeek(state.sessions, client.id, week);
  const streak = weeklyStreak(state.sessions, client.id, client.weeklyGoal);
  const history = attendanceHistory(state.sessions, client.id, 8);
  const maxBar = Math.max(client.weeklyGoal, ...history.map((h) => h.count), 1);
  const last = lastAttendance(state.sessions, client.id);
  const upcoming = state.sessions
    .filter((s) => s.clientId === client.id && s.status === "confirmed" && s.date >= todayKey())
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
    .slice(0, 3);
  const noShows = state.sessions.filter((s) => s.clientId === client.id && s.noShow).length;
  const challenges = store.challengesFor(client, week);
  const canMessage = viewer.isTrainer && client.trainerIds.includes(viewer.id);

  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(true);
  useEffect(() => {
    let cancelled = false;
    store
      .loadTrainerNotes(client.id)
      .then((text) => {
        if (cancelled) return;
        setNotes(text);
        setSavedNotes(text);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoadingNotes(false));
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  return (
    <Sheet title="Ficha del cliente" onClose={props.onClose}>
      <div className="row">
        <span className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
          {client.name
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0])
            .join("")}
        </span>
        <div className="spacer" style={{ minWidth: 0 }}>
          <h2 className="sheet-title">{client.name}</h2>
          <div className="caption muted ellipsis">
            {client.email}
            {client.phone ? ` · ${client.phone}` : ""}
          </div>
        </div>
      </div>

      <div className="grid-3">
        <StatTile icon={Target} tone="red" value={`${done}/${client.weeklyGoal}`} label="Esta semana" />
        <StatTile icon={Flame} tone="orange" value={streak} label={streak === 1 ? "Semana de racha" : "Semanas de racha"} />
        <StatTile icon={Layers} tone="blue" value={client.remainingSessions} label="En el bono" />
      </div>

      <section className="card stack" style={{ gap: 10 }}>
        <div className="row">
          <strong className="spacer">Asistencia (8 semanas)</strong>
          <span className="caption muted">{last ? `Última: ${formatShortDay(last)}` : "Sin asistencias"}</span>
        </div>
        <div className="bars">
          {history.map((h, index) => (
            <div key={h.week}>
              <div
                className={`bar${h.count >= client.weeklyGoal ? " met" : index === history.length - 1 ? " current" : ""}`}
                style={{ height: `${Math.max(6, (h.count / maxBar) * 100)}%` }}
              />
              <span>{h.count}</span>
            </div>
          ))}
        </div>
        <span className="caption muted">
          {client.packName} · {client.usedSessions} usadas de {client.packTotalSessions} · {client.sessionDuration} min
          {noShows ? ` · ${noShows} sin presentarse` : ""}
        </span>
      </section>

      <section className="stack">
        <SectionTitle title="Próximas sesiones" count={upcoming.length} />
        {upcoming.length === 0 ? (
          <p className="caption muted">No tiene sesiones reservadas.</p>
        ) : (
          <div className="settings-card">
            {upcoming.map((s) => (
              <div key={s.id} className="settings-row">
                <span className="settings-icon tile-red">
                  <CalendarCheck size={15} />
                </span>
                <span className="settings-text">
                  <span className="settings-label">
                    {capitalize(formatLongDay(s.date))} · {s.time}
                  </span>
                  <span className="settings-detail">
                    {s.type} · {s.room} · {s.trainerName}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {challenges.length > 0 && (
        <section className="stack">
          <SectionTitle title="Retos de la semana" />
          <div className="settings-card">
            {challenges.map((c) => {
              const p = store.progressFor(c.id, client.id);
              return (
                <div key={c.id} className="settings-row">
                  <span className="settings-icon tile-orange">
                    <Trophy size={15} />
                  </span>
                  <span className="settings-text">
                    <span className="settings-label">{c.title}</span>
                    <span className="settings-detail">
                      {p ? `${p.progress}/${c.target} ${c.unit}` : "Sin empezar"}
                      {p?.approved ? " · aprobado" : p?.completed ? " · por revisar" : ""}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="form-group">
        <span className="label inline-icon">
          <NotebookPen size={16} /> Notas privadas
        </span>
        <p className="caption muted" style={{ marginTop: -4 }}>
          Sólo las ven sus entrenadores y Dirección. Lesiones, objetivos, preferencias…
        </p>
        <textarea
          className="textarea"
          style={{ minHeight: 110 }}
          placeholder={loadingNotes ? "Cargando…" : "Escribe tus notas sobre este cliente"}
          aria-label="Notas privadas"
          disabled={loadingNotes}
          maxLength={LIMITS.trainerNotes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {notes !== savedNotes && (
          <button
            className="btn btn-secondary"
            onClick={async () => {
              const result = await store.saveTrainerNotes(client.id, notes);
              if (!result) setSavedNotes(notes);
              else store.showToast(result);
            }}
          >
            Guardar notas
          </button>
        )}
      </section>

      <div className="card-actions">
        {canMessage && (
          <button
            className="btn btn-primary"
            onClick={() => {
              void store.openChat(client.id);
              props.onClose();
              window.location.hash = "#chat";
            }}
          >
            <MessageCircle size={16} /> Mensaje
          </button>
        )}
        {props.onPlan && (
          <button className="btn btn-secondary" onClick={props.onPlan}>
            <Leaf size={16} /> Nutrición
          </button>
        )}
      </div>
    </Sheet>
  );
}
