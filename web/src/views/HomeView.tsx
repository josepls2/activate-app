// Inicio: para el cliente, su semana (objetivo, racha, reto, consejo);
// para el equipo, «Hoy» (agenda, solicitudes, retos por revisar y seguimiento).
import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  ClipboardCheck,
  Clock,
  DoorClosed,
  Flame,
  Inbox,
  Layers,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  Trophy,
  User,
  UserX,
  Users,
} from "lucide-react";
import {
  capitalize,
  currentWeek,
  entryScore,
  formatLongDay,
  roleLabel,
  todayKey,
  type AppUser,
} from "../lib/domain";
import {
  attendanceHistory,
  badges,
  inactiveClients,
  nextSession,
  sessionsInWeek,
  tipOfTheDay,
  upcomingThisWeek,
  weeklyStreak,
} from "../lib/engagement";
import { store } from "../lib/store";
import { downloadSessionEvent } from "../lib/calendar";
import { EmptyState, ProgressRing, SectionTitle, Sheet, StatTile, go, useAppState } from "../ui";

const dateFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });

export function HomeView() {
  const state = useAppState();
  return state.currentUser?.role === "client" ? <ClientHome /> : <StaffHome />;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "";
}

// ---------------------------------------------------------------- Cliente

function ClientHome() {
  const state = useAppState();
  const user = state.currentUser!;
  const week = currentWeek();
  const [goalOpen, setGoalOpen] = useState(false);

  const done = sessionsInWeek(state.sessions, user.id, week);
  const planned = upcomingThisWeek(state.sessions, user.id, week);
  const goal = user.weeklyGoal;
  const streak = weeklyStreak(state.sessions, user.id, goal);
  const next = nextSession(state.sessions, user.id);
  const history = attendanceHistory(state.sessions, user.id, 8);
  const maxBar = Math.max(goal, ...history.map((h) => h.count), 1);
  const myBadges = badges(state.sessions, user.id, goal, state.challengeProgress);
  const challenges = store.challengesFor(user, week);
  const tip = tipOfTheDay(state.customTips);

  const ranking = useMemo(
    () => [...state.leaderboard].sort((a, b) => entryScore(b) - entryScore(a)),
    [state.leaderboard],
  );
  const myPosition = ranking.findIndex((e) => e.uid === user.id) + 1;
  const myPoints = state.myLeaderboardEntry ? entryScore(state.myLeaderboardEntry) : 0;

  const remainingToGoal = Math.max(0, goal - done);
  const goalMessage =
    remainingToGoal === 0
      ? "¡Objetivo cumplido esta semana! 🎉"
      : planned >= remainingToGoal
        ? planned === 1
          ? "Con tu sesión reservada lo cumplirás."
          : `Con tus ${planned} sesiones reservadas lo cumplirás.`
        : `Te ${remainingToGoal === 1 ? "falta 1 sesión" : `faltan ${remainingToGoal} sesiones`}. ¡Reserva ya!`;

  return (
    <div className="screen">
      <header className="header">
        <div className="spacer">
          <div className="eyebrow">{capitalize(dateFormatter.format(new Date()))}</div>
          <h1>Hola, {firstName(user.name)}</h1>
        </div>
      </header>

      {/* Próxima sesión */}
      <section className="hero-card">
        {next ? (
          <div className="next-session">
            <span className="eyebrow" style={{ color: "var(--text-2)" }}>
              Próxima sesión
            </span>
            <span className="when">
              {next.date === todayKey() ? "Hoy" : capitalize(formatLongDay(next.date))} · {next.time}
            </span>
            <div className="meta" style={{ color: "var(--text-2)" }}>
              <span>
                <User size={13} /> {next.trainerName}
              </span>
              <span>
                <DoorClosed size={13} /> {next.room}
              </span>
              <span>
                <Clock size={13} /> {next.duration} min
              </span>
            </div>
            <div className="card-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => store.showToast(downloadSessionEvent(next))}>
                <CalendarPlus size={16} /> Calendario
              </button>
              <button className="btn btn-secondary" onClick={() => go("sessions")}>
                Ver agenda
              </button>
            </div>
          </div>
        ) : (
          <div className="next-session">
            <span className="eyebrow" style={{ color: "var(--text-2)" }}>
              Sin sesiones reservadas
            </span>
            <span className="when">¿Entrenamos esta semana?</span>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => go("sessions")}>
              <Plus size={18} /> Pedir una sesión
            </button>
          </div>
        )}
      </section>

      {/* Objetivo semanal */}
      <section className="card row" style={{ gap: 18 }}>
        <ProgressRing value={done} max={goal} sublabel="esta semana" />
        <div className="spacer stack" style={{ gap: 6 }}>
          <strong style={{ fontSize: 17 }}>Objetivo semanal</strong>
          <span className="small" style={{ color: "var(--text-2)", lineHeight: 1.4 }}>
            {goalMessage}
          </span>
          <span className="inline-icon caption" style={{ color: streak ? "var(--orange)" : "var(--muted)" }}>
            <Flame size={14} />
            {streak ? `Racha de ${streak} ${streak === 1 ? "semana" : "semanas"}` : "Empieza tu racha esta semana"}
          </span>
          <button className="btn-link" style={{ padding: 0, textAlign: "left", width: "auto" }} onClick={() => setGoalOpen(true)}>
            Cambiar objetivo ({goal} {goal === 1 ? "clase" : "clases"}/semana)
          </button>
        </div>
      </section>

      {/* Retos */}
      <section className="stack">
        <div className="row">
          <SectionTitle title="Retos de la semana" count={challenges.length || undefined} />
          <span className="spacer" />
          <button className="btn-link" style={{ width: "auto", padding: 0, fontSize: 14 }} onClick={() => go("challenges")}>
            Ver todo
          </button>
        </div>
        {challenges.length === 0 ? (
          <div className="card small muted">Tu entrenador aún no ha publicado retos esta semana.</div>
        ) : (
          challenges.slice(0, 2).map((c) => {
            const p = store.progressFor(c.id, user.id);
            const value = p?.progress ?? 0;
            return (
              <button key={c.id} className="card stack list-item-button" onClick={() => go("challenges")}>
                <div className="row">
                  <span className="settings-icon tile-orange">
                    <Trophy size={16} />
                  </span>
                  <strong className="spacer">{c.title}</strong>
                  {p?.approved ? (
                    <span className="badge tone-green">Aprobado</span>
                  ) : (
                    <span className="caption muted">{c.points} pts</span>
                  )}
                </div>
                <div className="progress">
                  <div style={{ width: `${Math.min(100, (value / c.target) * 100)}%` }} />
                </div>
                <span className="caption muted">
                  {value}/{c.target} {c.unit}
                  {p?.feedback ? " · Tienes feedback de tu entrenador" : ""}
                </span>
              </button>
            );
          })
        )}
      </section>

      {/* Clasificación */}
      <button className="card row list-item-button" onClick={() => go("challenges")}>
        <span className="settings-icon tile-purple">
          <Trophy size={16} />
        </span>
        <span className="spacer">
          <strong style={{ display: "block" }}>Clasificación semanal</strong>
          <span className="caption muted">
            {user.leaderboardOptIn
              ? myPosition
                ? `Vas ${myPosition}º con ${myPoints} puntos`
                : "Completa una sesión para entrar"
              : "Activa la clasificación para competir con el centro"}
          </span>
        </span>
        <ChevronRight size={18} color="var(--muted)" />
      </button>

      {/* Asistencia */}
      <section className="card stack" style={{ gap: 12 }}>
        <div className="row">
          <strong className="spacer">Tus últimas 8 semanas</strong>
          <span className="caption muted">objetivo {goal}</span>
        </div>
        <div className="bars" aria-label="Sesiones por semana">
          {history.map((h, index) => (
            <div key={h.week} title={`${h.count} sesiones`}>
              <div
                className={`bar${h.count >= goal ? " met" : index === history.length - 1 ? " current" : ""}`}
                style={{ height: `${Math.max(6, (h.count / maxBar) * 100)}%` }}
              />
              <span>{h.count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Insignias */}
      <section className="stack">
        <SectionTitle title="Insignias" count={myBadges.filter((b) => b.earned).length} />
        <div className="badge-strip">
          {myBadges.map((b) => (
            <div key={b.id} className={`badge-item${b.earned ? "" : " locked"}`} title={b.detail}>
              <span className="emoji" aria-hidden>
                {b.emoji}
              </span>
              {b.label}
            </div>
          ))}
        </div>
      </section>

      {/* Consejo del día */}
      <button className="card tip-card list-item-button" onClick={() => go("tips")}>
        <span className="settings-icon tile-teal">
          <Sparkles size={16} />
        </span>
        <span className="spacer">
          <span className="eyebrow" style={{ color: "var(--muted)" }}>
            Consejo del día
          </span>
          <strong style={{ display: "block", margin: "4px 0" }}>{tip.title}</strong>
          <p>{tip.body}</p>
        </span>
      </button>

      <div className="grid-2">
        <StatTile icon={Layers} tone="red" value={state.activePack.remainingSessions} label="Sesiones en tu bono" onClick={() => go("plan")} />
        <StatTile icon={MessageCircle} tone="blue" value="Chat" label="Habla con tu entrenador" onClick={() => go("chat")} />
      </div>

      {goalOpen && <GoalSheet current={goal} onClose={() => setGoalOpen(false)} />}
    </div>
  );
}

export function GoalSheet({ current, onClose }: { current: number; onClose: () => void }) {
  const [goal, setGoal] = useState(current);
  return (
    <Sheet title="Objetivo semanal" onClose={onClose}>
      <p className="muted small" style={{ lineHeight: 1.45 }}>
        ¿Cuántas clases quieres hacer cada semana? Lo usamos para tu anillo, tu racha y tus insignias.
      </p>
      <div className="goal-grid">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={goal === n} onClick={() => setGoal(n)}>
            {n}
          </button>
        ))}
      </div>
      <button
        className="btn btn-primary"
        onClick={() => {
          void store.setWeeklyGoal(goal);
          onClose();
        }}
      >
        Guardar objetivo
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Equipo

function StaffHome() {
  const state = useAppState();
  const user = state.currentUser!;
  const today = todayKey();
  const week = currentWeek();
  const isBoss = user.role === "boss";

  const mySessions = state.sessions.filter((s) => isBoss || s.trainerId === user.id);
  const todaySessions = mySessions
    .filter((s) => s.date === today && s.status !== "cancelled")
    .sort((a, b) => a.time.localeCompare(b.time));
  const pending = state.bookings.filter(
    (b) =>
      (b.status === "pending_trainer" && (isBoss || b.trainerId === user.id)) ||
      (isBoss && b.status === "pending_boss"),
  );
  const myClients = state.managedUsers.filter(
    (c) => c.role === "client" && (isBoss || c.trainerIds.includes(user.id)),
  );
  const inactive = inactiveClients(myClients, state.sessions);
  const challenges = store.managedChallenges();
  const toReview = state.challengeProgress.filter(
    (p) => p.completed && !p.approved && challenges.some((c) => c.id === p.challengeId),
  );
  const ranking = [...state.leaderboard].sort((a, b) => entryScore(b) - entryScore(a)).slice(0, 3);
  const thisWeekChallenges = challenges.filter((c) => c.weekKey === week);

  return (
    <div className="screen">
      <header className="header">
        <div className="spacer">
          <div className="eyebrow">
            {roleLabel[user.role]} · {capitalize(dateFormatter.format(new Date()))}
          </div>
          <h1>Hoy</h1>
        </div>
      </header>

      <div className="grid-2">
        <StatTile icon={CalendarCheck} tone="red" value={todaySessions.length} label="Sesiones hoy" onClick={() => go("sessions")} />
        <StatTile icon={Inbox} tone="orange" value={pending.length} label="Solicitudes pendientes" onClick={() => go("bookings")} />
        <StatTile icon={ClipboardCheck} tone="green" value={toReview.length} label="Retos por revisar" onClick={() => go("challenges")} />
        <StatTile icon={UserX} tone="gray" value={inactive.length} label="Sin venir 14 días" />
      </div>

      <section className="stack">
        <SectionTitle title="Agenda de hoy" count={todaySessions.length} />
        {todaySessions.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Día libre" message="No hay sesiones programadas para hoy." />
        ) : (
          <div className="settings-card">
            {todaySessions.map((s) => (
              <button key={s.id} className="settings-row" onClick={() => go("sessions")}>
                <span className="settings-icon tile-red" style={{ fontSize: 11, fontWeight: 800 }}>
                  {s.time}
                </span>
                <span className="settings-text">
                  <span className="settings-label">{s.clientName}</span>
                  <span className="settings-detail">
                    {s.type} · {s.room}
                    {isBoss && s.trainerName ? ` · ${s.trainerName}` : ""}
                  </span>
                </span>
                <span className={`badge tone-${s.status === "completed" ? "blue" : "green"}`}>
                  {s.status === "completed" ? (s.noShow ? "No vino" : "Hecha") : "Confirmada"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <div className="row">
          <SectionTitle title="Retos de esta semana" count={thisWeekChallenges.length} />
          <span className="spacer" />
          <button className="btn-link" style={{ width: "auto", padding: 0, fontSize: 14 }} onClick={() => go("challenges")}>
            Gestionar
          </button>
        </div>
        {thisWeekChallenges.length === 0 ? (
          <button className="btn btn-soft" onClick={() => go("challenges")}>
            <Target size={18} /> Crear el reto de la semana
          </button>
        ) : (
          <div className="settings-card">
            {thisWeekChallenges.map((c) => {
              const participants = state.challengeProgress.filter((p) => p.challengeId === c.id);
              return (
                <button key={c.id} className="settings-row" onClick={() => go("challenges")}>
                  <span className="settings-icon tile-orange">
                    <Trophy size={16} />
                  </span>
                  <span className="settings-text">
                    <span className="settings-label">{c.title}</span>
                    <span className="settings-detail">
                      {participants.length} participando · {participants.filter((p) => p.completed).length} completados
                    </span>
                  </span>
                  <ChevronRight size={18} className="settings-chevron" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {inactive.length > 0 && (
        <section className="stack">
          <SectionTitle title="Seguimiento" count={inactive.length} />
          <p className="caption muted" style={{ marginTop: -4 }}>
            Clientes sin sesiones en las dos últimas semanas. Un mensaje a tiempo evita bajas.
          </p>
          <div className="settings-card">
            {inactive.slice(0, 6).map((client) => (
              <InactiveRow key={client.id} client={client} canMessage={user.isTrainer && client.trainerIds.includes(user.id)} />
            ))}
          </div>
        </section>
      )}

      {ranking.length > 0 && (
        <section className="stack">
          <SectionTitle title="Clasificación semanal" />
          <div className="settings-card">
            {ranking.map((entry, index) => (
              <div key={entry.id} className="rank-row">
                <span className="rank-pos top">{["🥇", "🥈", "🥉"][index]}</span>
                <span className="spacer">{entry.displayName}</span>
                <span className="rank-score">{entryScore(entry)} pts</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid-2">
        <StatTile icon={Sparkles} tone="teal" value="Consejos" label="Publica hábitos saludables" onClick={() => go("tips")} />
        {isBoss ? (
          <StatTile icon={Users} tone="blue" value={state.managedUsers.length} label="Clientes y usuarios" onClick={() => go("clients")} />
        ) : (
          <StatTile icon={Users} tone="blue" value={myClients.length} label="Tus clientes" onClick={() => go("clients")} />
        )}
      </div>
    </div>
  );
}

function InactiveRow({ client, canMessage }: { client: AppUser; canMessage: boolean }) {
  return (
    <div className="settings-row">
      <span className="mini-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
        {client.name
          .split(" ")
          .slice(0, 2)
          .map((p) => p[0])
          .join("")}
      </span>
      <span className="settings-text">
        <span className="settings-label">{client.name}</span>
        <span className="settings-detail">{client.remainingSessions} sesiones en el bono</span>
      </span>
      {canMessage && (
        <button
          className="btn btn-outline"
          style={{ width: "auto", minHeight: 34, padding: "6px 10px", fontSize: 13 }}
          onClick={() => {
            void store.openChat(client.id);
            go("chat");
          }}
        >
          <MessageCircle size={14} /> Escribir
        </button>
      )}
    </div>
  );
}
