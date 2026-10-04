// Retos semanales y clasificación.
// Cliente: apunta su progreso y ve el feedback; equipo: crea retos y valora.
import { useMemo, useState } from "react";
import { CheckCircle2, Minus, MessageSquareText, Pencil, Plus, Target, Trash2, Trophy, Users } from "lucide-react";
import {
  addDays,
  currentWeek,
  entryScore,
  keyToDate,
  LIMITS,
  roleLabel,
  SESSION_POINTS,
  todayKey,
  weekLabel,
  type AppUser,
  type Challenge,
  type ChallengeAudience,
} from "../lib/domain";
import { sessionsInWeek } from "../lib/engagement";
import { store } from "../lib/store";
import { Chip, EmptyState, ScreenHeader, SectionTitle, Segmented, Sheet, Toggle, ToggleRow, useAppState } from "../ui";

export function ChallengesView() {
  const state = useAppState();
  return state.currentUser?.role === "client" ? <ClientChallenges /> : <StaffChallenges />;
}

// ---------------------------------------------------------------- Cliente

function ClientChallenges() {
  const state = useAppState();
  const user = state.currentUser!;
  const [tab, setTab] = useState<"challenges" | "ranking">("challenges");
  const week = currentWeek();
  const challenges = store.challengesFor(user, week);
  const lastWeek = store
    .challengesFor(user, addDays(week, -7))
    .filter((c) => store.progressFor(c.id, user.id)?.feedback);

  return (
    <div className="screen">
      <ScreenHeader eyebrow={weekLabel(week)} title="Retos" subtitle="Supera retos, suma puntos y no pierdas la racha" />
      <Segmented
        label="Sección"
        value={tab}
        onChange={setTab}
        options={[
          { value: "challenges", label: "Retos de la semana" },
          { value: "ranking", label: "Clasificación" },
        ]}
      />

      {tab === "challenges" ? (
        <>
          {challenges.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Sin retos esta semana"
              message="Cuando tu entrenador publique el reto semanal, aparecerá aquí."
            />
          ) : (
            challenges.map((c) => <ClientChallengeCard key={c.id} challenge={c} />)
          )}
          {lastWeek.length > 0 && (
            <>
              <SectionTitle title="Feedback de la semana pasada" />
              {lastWeek.map((c) => (
                <ClientChallengeCard key={c.id} challenge={c} readOnly />
              ))}
            </>
          )}
        </>
      ) : (
        <Leaderboard />
      )}
    </div>
  );
}

const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

function ClientChallengeCard({ challenge, readOnly = false }: { challenge: Challenge; readOnly?: boolean }) {
  const state = useAppState();
  const user = state.currentUser!;
  const progress = store.progressFor(challenge.id, user.id);
  const value = progress?.progress ?? 0;
  const checkIns = progress?.checkIns ?? [];
  const locked = readOnly || Boolean(progress?.approved);
  const daily = /d[ií]a/i.test(challenge.unit);
  const [note, setNote] = useState(progress?.note ?? "");
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(challenge.weekKey, i));

  const toggleDay = (day: string) => {
    const next = checkIns.includes(day) ? checkIns.filter((d) => d !== day) : [...checkIns, day];
    void store.updateChallengeProgress(challenge, { checkIns: next, progress: next.length });
  };

  return (
    <article className="card challenge-card">
      <div className="row top">
        <span className="settings-icon tile-orange">
          <Trophy size={16} />
        </span>
        <div className="spacer">
          <strong style={{ fontSize: 17 }}>{challenge.title}</strong>
          <div className="caption muted" style={{ marginTop: 3 }}>
            {challenge.points} puntos · de {challenge.createdByName || "tu entrenador"}
          </div>
        </div>
        {progress?.approved ? (
          <span className="badge tone-green">
            <CheckCircle2 size={12} /> Aprobado
          </span>
        ) : progress?.completed ? (
          <span className="badge tone-blue">En revisión</span>
        ) : null}
      </div>

      {challenge.description && (
        <p className="small" style={{ color: "var(--text-2)", lineHeight: 1.45 }}>
          {challenge.description}
        </p>
      )}

      <div className="stack" style={{ gap: 6 }}>
        <div className="progress">
          <div style={{ width: `${Math.min(100, (value / challenge.target) * 100)}%` }} />
        </div>
        <span className="caption muted">
          {value} de {challenge.target} {challenge.unit}
        </span>
      </div>

      {!locked &&
        (daily ? (
          <div className="check-days" role="group" aria-label="Días completados">
            {days.map((day, index) => (
              <button
                key={day}
                type="button"
                className={`check-day${checkIns.includes(day) ? " on" : ""}`}
                aria-pressed={checkIns.includes(day)}
                aria-label={`${DAY_LETTERS[index]} ${keyToDate(day).getDate()}`}
                disabled={day > today}
                onClick={() => toggleDay(day)}
              >
                {DAY_LETTERS[index]}
                <span>{keyToDate(day).getDate()}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="row">
            <button
              className="btn btn-secondary"
              style={{ width: 56 }}
              aria-label="Restar"
              disabled={value <= 0}
              onClick={() => void store.updateChallengeProgress(challenge, { progress: value - 1 })}
            >
              <Minus size={18} />
            </button>
            <button
              className="btn btn-primary spacer"
              onClick={() => void store.updateChallengeProgress(challenge, { progress: value + 1 })}
            >
              <Plus size={18} /> Sumar 1 {challenge.unit.replace(/s$/, "")}
            </button>
          </div>
        ))}

      {!locked && (
        <div className="row" style={{ alignItems: "flex-end" }}>
          <textarea
            className="textarea compact spacer"
            placeholder="Cuéntale a tu entrenador cómo te ha ido (opcional)"
            aria-label="Nota para tu entrenador"
            maxLength={LIMITS.challengeNote}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {note !== (progress?.note ?? "") && (
            <button className="btn btn-outline" style={{ width: "auto" }} onClick={() => void store.updateChallengeProgress(challenge, { note })}>
              Guardar
            </button>
          )}
        </div>
      )}

      {progress?.feedback && (
        <div className="feedback-box">
          <div className="inline-icon caption bold" style={{ color: "var(--blue)", marginBottom: 4, display: "flex" }}>
            <MessageSquareText size={13} /> Feedback de {progress.feedbackByName || "tu entrenador"}
          </div>
          {progress.feedback}
        </div>
      )}
    </article>
  );
}

function Leaderboard() {
  const state = useAppState();
  const user = state.currentUser!;
  const isClient = user.role === "client";
  const ranking = useMemo(
    () => [...state.leaderboard].sort((a, b) => entryScore(b) - entryScore(a) || a.displayName.localeCompare(b.displayName)),
    [state.leaderboard],
  );
  const week = currentWeek();
  const done = isClient ? sessionsInWeek(state.sessions, user.id, week) : 0;

  return (
    <>
      {isClient && (
        <div className="card row">
          <div className="spacer">
            <strong style={{ display: "block" }}>Aparecer en la clasificación</strong>
            <span className="caption muted" style={{ lineHeight: 1.4 }}>
              Sólo se muestra tu nombre y la inicial del apellido. Puedes cambiarlo cuando quieras.
            </span>
          </div>
          <Toggle
            label="Aparecer en la clasificación"
            checked={user.leaderboardOptIn}
            onChange={(v) => void store.setLeaderboardOptIn(v)}
          />
        </div>
      )}

      {isClient && (
        <div className="grid-2">
          <div className="card metric left">
            <strong>
              {done}/{user.weeklyGoal}
            </strong>
            <span className="caption muted">Clases esta semana</span>
          </div>
          <div className="card metric left">
            <strong>{state.myLeaderboardEntry ? entryScore(state.myLeaderboardEntry) : 0}</strong>
            <span className="caption muted">Tus puntos</span>
          </div>
        </div>
      )}

      <SectionTitle title={`Semana ${weekLabel(week)}`} />
      {ranking.length === 0 ? (
        <EmptyState icon={Trophy} title="Aún no hay puntos" message="La clasificación se llena al completar sesiones y aprobar retos." />
      ) : (
        <div className="settings-card">
          {ranking.map((entry, index) => (
            <div key={entry.id} className={`rank-row${entry.uid === user.id ? " me" : ""}`}>
              <span className={`rank-pos${index < 3 ? " top" : ""}`}>{index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1}</span>
              <span className="spacer">
                {entry.displayName}
                {entry.uid === user.id ? " (tú)" : ""}
                {!isClient && !entry.visible ? <span className="caption muted"> · oculto</span> : null}
                <span className="caption muted" style={{ display: "block" }}>
                  {entry.sessions} {entry.sessions === 1 ? "sesión" : "sesiones"} · {entry.challengePoints} pts de retos
                </span>
              </span>
              <span className="rank-score">{entryScore(entry)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="caption muted" style={{ lineHeight: 1.45 }}>
        Puntos: {SESSION_POINTS} por cada sesión completada + los puntos de cada reto que tu entrenador apruebe. Se
        reinicia cada lunes.
      </p>
    </>
  );
}

// ---------------------------------------------------------------- Equipo

function StaffChallenges() {
  const state = useAppState();
  const user = state.currentUser!;
  const thisWeek = currentWeek();
  const [week, setWeek] = useState(thisWeek);
  const [tab, setTab] = useState<"manage" | "ranking">("manage");
  const [editing, setEditing] = useState<Challenge | "new" | null>(null);
  const [reviewing, setReviewing] = useState<Challenge | null>(null);
  const challenges = store.managedChallenges(week);
  const liveReviewing = reviewing ? (state.challenges.find((c) => c.id === reviewing.id) ?? reviewing) : null;

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={roleLabel[user.role]}
        title="Retos semanales"
        subtitle={user.role === "boss" ? "Para todo el centro o para tus clientes" : "Para tus clientes asignados"}
      />
      <Segmented
        label="Sección"
        value={tab}
        onChange={setTab}
        options={[
          { value: "manage", label: "Retos y feedback" },
          { value: "ranking", label: "Clasificación" },
        ]}
      />

      {tab === "ranking" ? (
        <Leaderboard />
      ) : (
        <>
          <Segmented
            label="Semana"
            value={week}
            onChange={setWeek}
            options={[
              { value: addDays(thisWeek, -7), label: "Pasada" },
              { value: thisWeek, label: "Esta semana" },
              { value: addDays(thisWeek, 7), label: "Próxima" },
            ]}
          />
          <p className="caption muted" style={{ marginTop: -8 }}>
            {weekLabel(week)}
          </p>

          {week >= thisWeek && (
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus size={18} /> Nuevo reto
            </button>
          )}

          {challenges.length === 0 ? (
            <EmptyState icon={Target} title="Sin retos" message="Crea un reto para motivar a tus clientes esta semana." />
          ) : (
            challenges.map((c) => {
              const participants = state.challengeProgress.filter((p) => p.challengeId === c.id);
              const pending = participants.filter((p) => p.completed && !p.approved).length;
              return (
                <article key={c.id} className="card challenge-card">
                  <div className="row top">
                    <span className="settings-icon tile-orange">
                      <Trophy size={16} />
                    </span>
                    <div className="spacer">
                      <strong style={{ fontSize: 17 }}>{c.title}</strong>
                      <div className="caption muted" style={{ marginTop: 3 }}>
                        {c.target} {c.unit} · {c.points} pts · {c.audience === "all" ? "Todo el centro" : "Mis clientes"}
                      </div>
                    </div>
                    {pending > 0 && <span className="badge tone-orange">{pending} por revisar</span>}
                  </div>
                  {c.description && (
                    <p className="small" style={{ color: "var(--text-2)", lineHeight: 1.45 }}>
                      {c.description}
                    </p>
                  )}
                  <span className="inline-icon caption muted">
                    <Users size={13} /> {participants.length} participando ·{" "}
                    {participants.filter((p) => p.completed).length} completados ·{" "}
                    {participants.filter((p) => p.approved).length} aprobados
                  </span>
                  <div className="card-actions">
                    <button className="btn btn-primary" onClick={() => setReviewing(c)}>
                      <MessageSquareText size={16} /> Feedback
                    </button>
                    <button className="btn btn-secondary" style={{ width: 52 }} aria-label="Editar" onClick={() => setEditing(c)}>
                      <Pencil size={16} />
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ width: 52 }}
                      aria-label="Eliminar"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar el reto «${c.title}»?`)) void store.deleteChallenge(c.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </>
      )}

      {editing && (
        <ChallengeEditor
          challenge={editing === "new" ? null : editing}
          week={week}
          onClose={() => setEditing(null)}
        />
      )}
      {liveReviewing && <ReviewSheet challenge={liveReviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

const UNITS = ["días", "sesiones", "veces", "km", "minutos"];
const POINTS = [10, 20, 30, 50];
const TEMPLATES: Array<{ title: string; description: string; target: number; unit: string }> = [
  { title: "8.000 pasos al día", description: "Llega a 8.000 pasos y marca el día.", target: 5, unit: "días" },
  { title: "2 litros de agua", description: "Bebe al menos 2 litros de agua al día.", target: 5, unit: "días" },
  { title: "Movilidad 10 minutos", description: "10 minutos de movilidad o estiramientos.", target: 4, unit: "días" },
  { title: "Dormir 7 horas", description: "Duerme 7 horas o más.", target: 5, unit: "días" },
  { title: "3 sesiones esta semana", description: "Completa tres sesiones en el centro.", target: 3, unit: "sesiones" },
];

function ChallengeEditor(props: { challenge: Challenge | null; week: string; onClose: () => void }) {
  const state = useAppState();
  const isBoss = state.currentUser?.role === "boss";
  const c = props.challenge;
  const [title, setTitle] = useState(c?.title ?? "");
  const [description, setDescription] = useState(c?.description ?? "");
  const [target, setTarget] = useState(c?.target ?? 5);
  const [unit, setUnit] = useState(c?.unit ?? "días");
  const [points, setPoints] = useState(c?.points ?? 20);
  const [audience, setAudience] = useState<ChallengeAudience>(
    c?.audience ?? (isBoss && !state.currentUser?.isTrainer ? "all" : "trainer"),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title={c ? "Editar reto" : "Nuevo reto"} onClose={props.onClose}>
      {!c && (
        <>
          <p className="form-section-title">Plantillas rápidas</p>
          <div className="chip-row">
            {TEMPLATES.map((t) => (
              <Chip
                key={t.title}
                selected={title === t.title}
                onClick={() => {
                  setTitle(t.title);
                  setDescription(t.description);
                  setTarget(t.target);
                  setUnit(t.unit);
                }}
              >
                {t.title}
              </Chip>
            ))}
          </div>
        </>
      )}

      <div className="form-section">
        <input
          className="input"
          placeholder="Título del reto"
          aria-label="Título del reto"
          maxLength={LIMITS.challengeTitle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="textarea"
          style={{ borderRadius: 0, background: "transparent" }}
          placeholder="Explica el reto (opcional)"
          aria-label="Descripción"
          maxLength={LIMITS.challengeDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-group">
        <span className="label">Objetivo</span>
        <div className="row">
          <div className="stepper">
            <button type="button" aria-label="Restar" onClick={() => setTarget(Math.max(1, target - 1))}>
              <Minus size={16} />
            </button>
            <button type="button" aria-label="Sumar" onClick={() => setTarget(Math.min(100, target + 1))}>
              <Plus size={16} />
            </button>
          </div>
          <strong style={{ fontSize: 20 }}>{target}</strong>
          <span className="muted">{unit}</span>
        </div>
        <div className="chip-row">
          {UNITS.map((u) => (
            <Chip key={u} selected={unit === u} onClick={() => setUnit(u)}>
              {u}
            </Chip>
          ))}
        </div>
      </div>

      <div className="form-group">
        <span className="label">Puntos al aprobarlo</span>
        <div className="chip-row">
          {POINTS.map((p) => (
            <Chip key={p} selected={points === p} onClick={() => setPoints(p)}>
              {p} pts
            </Chip>
          ))}
        </div>
      </div>

      {isBoss && !c && (
        <div className="form-group">
          <span className="label">Para quién</span>
          <Segmented
            label="Para quién"
            value={audience}
            onChange={setAudience}
            options={[
              { value: "all" as ChallengeAudience, label: "Todo el centro" },
              ...(state.currentUser?.isTrainer ? [{ value: "trainer" as ChallengeAudience, label: "Mis clientes" }] : []),
            ]}
          />
        </div>
      )}

      <p className="caption muted">Semana del {weekLabel(props.week)}.</p>
      {error && <div className="error-box">{error}</div>}
      <button
        className="btn btn-primary"
        disabled={saving || !title.trim()}
        onClick={async () => {
          setSaving(true);
          const result = await store.saveChallenge({
            id: c?.id,
            title,
            description,
            weekKey: props.week,
            target,
            unit,
            points,
            audience,
          });
          setSaving(false);
          if (result) setError(result);
          else props.onClose();
        }}
      >
        {saving ? "Guardando…" : c ? "Guardar cambios" : "Publicar reto"}
      </button>
    </Sheet>
  );
}

function eligibleClients(challenge: Challenge, viewer: AppUser, clients: AppUser[]) {
  return clients.filter((client) => {
    if (client.role !== "client" || client.status !== "active") return false;
    if (challenge.audience === "trainer") return challenge.trainerId !== null && client.trainerIds.includes(challenge.trainerId);
    return viewer.role === "boss" || client.trainerIds.includes(viewer.id);
  });
}

function ReviewSheet({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const state = useAppState();
  const viewer = state.currentUser!;
  const clients = eligibleClients(challenge, viewer, state.managedUsers).sort((a, b) => {
    const pa = store.progressFor(challenge.id, a.id);
    const pb = store.progressFor(challenge.id, b.id);
    return Number(Boolean(pb?.completed && !pb.approved)) - Number(Boolean(pa?.completed && !pa.approved)) || a.name.localeCompare(b.name);
  });

  return (
    <Sheet title="Feedback semanal" onClose={onClose}>
      <div>
        <h2 className="sheet-title">{challenge.title}</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          {challenge.target} {challenge.unit} · {challenge.points} pts · {weekLabel(challenge.weekKey)}
        </p>
      </div>
      {clients.length === 0 ? (
        <EmptyState icon={Users} title="Sin clientes" message="No hay clientes asignados a este reto." />
      ) : (
        clients.map((client) => <ReviewRow key={client.id} challenge={challenge} client={client} />)
      )}
    </Sheet>
  );
}

function ReviewRow({ challenge, client }: { challenge: Challenge; client: AppUser }) {
  const progress = store.progressFor(challenge.id, client.id);
  const [feedback, setFeedback] = useState(progress?.feedback ?? "");
  const [approve, setApprove] = useState(progress?.approved ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = progress?.progress ?? 0;
  const changed = feedback !== (progress?.feedback ?? "") || approve !== (progress?.approved ?? false);

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row">
        <strong className="spacer">{client.name}</strong>
        {progress?.approved ? (
          <span className="badge tone-green">Aprobado</span>
        ) : progress?.completed ? (
          <span className="badge tone-orange">Completado</span>
        ) : (
          <span className="caption muted">
            {value}/{challenge.target}
          </span>
        )}
      </div>
      <div className="progress">
        <div style={{ width: `${Math.min(100, (value / challenge.target) * 100)}%` }} />
      </div>
      {progress?.note && <div className="note">“{progress.note}”</div>}
      <textarea
        className="textarea compact"
        placeholder="Feedback de la semana para el cliente"
        aria-label={`Feedback para ${client.name}`}
        maxLength={1000}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      {!progress?.approved && (
        <div className="form-section">
          <ToggleRow
            title={`Aprobar reto (+${challenge.points} pts)`}
            subtitle="Suma los puntos a su clasificación semanal. No se puede deshacer."
            checked={approve}
            onChange={setApprove}
          />
        </div>
      )}
      {error && <div className="error-box">{error}</div>}
      <button
        className="btn btn-secondary"
        disabled={saving || !changed}
        onClick={async () => {
          setSaving(true);
          setError(null);
          const result = await store.giveChallengeFeedback(challenge, client, feedback, approve);
          setSaving(false);
          if (result) setError(result);
        }}
      >
        {saving ? "Enviando…" : "Enviar feedback"}
      </button>
    </div>
  );
}
