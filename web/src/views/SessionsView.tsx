// Port de ios/CodexGym/Views/SessionsView.swift.
import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarCheck, CalendarPlus, Check, CircleUser, Clock, DoorClosed, MessageCircle, Plus, Quote, User, UserX } from "lucide-react";
import {
  addDays,
  capitalize,
  formatLongDay,
  normalizedTime,
  roleLabel,
  timeSlots,
  todayKey,
  type GymSession,
} from "../lib/domain";
import { downloadSessionEvent } from "../lib/calendar";
import { store } from "../lib/store";
import {
  BookingRequestCard,
  DetailRow,
  EmptyState,
  MonthCalendar,
  ScreenHeader,
  SectionTitle,
  Segmented,
  SessionCard,
  Sheet,
  SlotGrid,
  StatusBadge,
  go,
  useAppState,
} from "../ui";

type BossRange = "Semana" | "Mes" | "Todo";

export function SessionsView() {
  const state = useAppState();
  const role = state.currentUser?.role ?? "client";
  const [selected, setSelected] = useState<GymSession | null>(null);
  const [booking, setBooking] = useState(false);
  const [bossRange, setBossRange] = useState<BossRange>("Semana");

  const visible = store.visibleSessions();
  const displayed = useMemo(() => {
    const today = todayKey();
    if (role === "trainer") {
      return visible.filter((s) => s.date >= addDays(today, -14) && s.date <= addDays(today, 7));
    }
    if (role === "boss") {
      if (bossRange === "Semana") return visible.filter((s) => s.date >= addDays(today, -1) && s.date <= addDays(today, 7));
      if (bossRange === "Mes") return visible.filter((s) => s.date >= addDays(today, -1) && s.date <= addDays(today, 31));
    }
    return visible;
  }, [visible, role, bossRange]);

  const groups = useMemo(() => {
    const map = new Map<string, GymSession[]>();
    displayed.forEach((s) => map.set(s.date, [...(map.get(s.date) ?? []), s]));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [displayed]);

  const title =
    role === "boss" ? "Sesiones" : role === "trainer" ? "Entrenos" : role === "client" ? "Mis entrenos" : "Mis reservas";
  const myRequests = store.visibleBookings().filter((b) => b.status === "pending_trainer" || b.status === "pending_boss");

  // Mantener el detalle sincronizado con los datos en vivo.
  const liveSelected = selected ? (state.sessions.find((s) => s.id === selected.id) ?? selected) : null;

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={roleLabel[role]}
        title={title}
        subtitle={role === "trainer" ? "Esta semana" : "Tu agenda de actividad"}
        badge={role === "boss" ? state.bookings.filter((b) => b.status === "pending_boss").length : undefined}
      />

      {(role === "client" || role === "reserve") && (
        <div className="card row">
          <div className="spacer">
            <div className="caption bold muted">{role === "reserve" ? "Bono de sala" : "Sesiones disponibles"}</div>
            <div className="big-number" style={{ marginTop: 4 }}>
              {state.activePack.remainingSessions}
            </div>
          </div>
          <span className="badge tone-red" style={{ fontSize: 15, padding: "8px 12px" }}>
            {state.activePack.duration} min
          </span>
        </div>
      )}

      {role === "boss" && (
        <Segmented
          label="Rango"
          value={bossRange}
          onChange={setBossRange}
          options={[
            { value: "Semana", label: "Semana" },
            { value: "Mes", label: "Mes" },
            { value: "Todo", label: "Todo" },
          ]}
        />
      )}

      {role === "client" && (
        <>
          <button className="btn btn-primary" onClick={() => setBooking(true)}>
            <Plus size={20} strokeWidth={2.6} /> Pedir una sesión
          </button>
          {myRequests.length > 0 && (
            <>
              <SectionTitle title="Mis solicitudes" count={myRequests.length} />
              {myRequests.map((r) => (
                <BookingRequestCard
                  key={r.id}
                  request={r}
                  actionTitle="Retirar solicitud"
                  onAction={() => {
                    if (window.confirm("¿Retirar esta solicitud? No se descuenta ninguna sesión.")) {
                      void store.cancelBookingRequest(r.id);
                    }
                  }}
                />
              ))}
            </>
          )}
        </>
      )}

      <SectionTitle title={role === "client" ? "Próximas y recientes" : "Agenda"} count={displayed.length} />

      {displayed.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Agenda despejada" message="No hay sesiones que mostrar en este periodo." />
      ) : (
        groups.map(([date, sessions]) => (
          <section key={date} className="stack">
            <div className="day-label">{capitalize(formatLongDay(date))}</div>
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onTap={() => setSelected(s)} />
            ))}
          </section>
        ))
      )}

      {booking && <BookingSheet onClose={() => setBooking(false)} />}
      {liveSelected && <SessionDetail session={liveSelected} onClose={() => setSelected(null)} />}
    </div>
  );
}

const SESSION_TYPES = ["Entrenamiento personal", "HIIT", "Movilidad", "Fuerza"];

function BookingSheet({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const user = state.currentUser!;
  const duration = state.activePack.duration;
  const rooms = store.roomNames();
  const [date, setDate] = useState(addDays(todayKey(), 1));
  const [type, setType] = useState(SESSION_TYPES[0]);
  const [time, setTime] = useState(() => normalizedTime("10:00", duration));
  const [room, setRoom] = useState(rooms[0]);
  const [trainerId, setTrainerId] = useState(user.trainerIds[0] ?? state.trainers[0]?.id ?? "");

  const trainerOptions = state.trainers.filter((t) => user.trainerIds.includes(t.id));
  const trainer = state.trainers.find((t) => t.id === trainerId);
  const occupied = (slot: string) => store.isSlotOccupied(date, slot, duration, room, trainerId || null);

  // Si la hora elegida está ocupada, saltar a la primera libre.
  useEffect(() => {
    if (occupied(time)) {
      const free = timeSlots(duration).find((slot) => !occupied(slot));
      if (free) setTime(free);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, room, trainerId, state.occupiedSlots, state.sessions]);

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="sheet-title">¿Qué día quieres?</h2>
        <p className="muted small">Elige una hora disponible. Tu entrenador confirmará la sesión.</p>
      </div>

      <div className="card">
        <MonthCalendar value={date} onChange={setDate} minDate={todayKey()} />
      </div>

      <div className="card form-group">
        <span className="label">Entrenador</span>
        <select className="select" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
          {(trainerOptions.length ? trainerOptions : state.trainers).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          {!trainerOptions.length && !state.trainers.length && <option value={trainerId}>Entrenador asignado</option>}
        </select>
      </div>

      <Segmented label="Sala" value={room} onChange={setRoom} options={rooms.map((r) => ({ value: r, label: r }))} />

      <div className="card form-group">
        <span className="label">Hora</span>
        <SlotGrid slots={timeSlots(duration)} selected={time} isOccupied={occupied} onSelect={setTime} />
      </div>

      <div className="form-group">
        <span className="label">Tipo de sesión</span>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          {SESSION_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="card row">
        <CircleUser size={22} color="var(--red-light)" />
        <div className="spacer">
          <div className="caption muted">Entrenador asignado</div>
          <div className="bold small">{trainer?.name ?? "Entrenador asignado"}</div>
        </div>
        <span className="caption bold" style={{ color: "var(--red-light)" }}>
          {duration} min
        </span>
      </div>

      <button
        className="btn btn-primary"
        disabled={!trainerId || occupied(time)}
        onClick={() => {
          void store.requestSession({ date, time, type, trainerId, room });
          onClose();
        }}
      >
        Enviar solicitud
      </button>
    </Sheet>
  );
}

function SessionDetail({ session, onClose }: { session: GymSession; onClose: () => void }) {
  const state = useAppState();
  const role = state.currentUser?.role;
  const isBoss = role === "boss";
  const canComplete = role === "trainer" || role === "boss";
  const isOwnSession = state.currentUser?.id === session.clientId;
  const confirmed = session.status === "confirmed";
  const [feedback, setFeedback] = useState(session.feedback ?? "");
  const [editDate, setEditDate] = useState(session.date);
  const [editTime, setEditTime] = useState(normalizedTime(session.time, session.duration));
  const [editRoom, setEditRoom] = useState(session.room);
  const viewer = state.currentUser;
  const chatClient =
    viewer?.isTrainer && !isOwnSession
      ? state.managedUsers.find((u) => u.id === session.clientId && u.role === "client")
      : null;
  const canMessage = (isOwnSession && role === "client") || Boolean(chatClient);

  return (
    <Sheet title="Detalle" onClose={onClose}>
      <div className="row">
        <div className="spacer">
          <h2 className="sheet-title">{session.clientName}</h2>
          <div className="muted" style={{ marginTop: 4 }}>
            {session.type}
          </div>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div className="card stack" style={{ gap: 14 }}>
        <DetailRow icon={Calendar} label="Fecha" value={capitalize(formatLongDay(session.date))} />
        <DetailRow icon={Clock} label="Hora" value={`${session.time} · ${session.duration} min`} />
        <DetailRow icon={User} label="Entrenador" value={session.trainerName} />
        <DetailRow icon={DoorClosed} label="Sala" value={session.room} />
      </div>

      {session.trainerNotes && (
        <div className="card stack">
          <span className="label">Observaciones</span>
          <p className="small" style={{ color: "var(--text-2)" }}>
            {session.trainerNotes}
          </p>
        </div>
      )}

      {confirmed && (
        <button className="btn btn-secondary" onClick={() => store.showToast(downloadSessionEvent(session))}>
          <CalendarPlus size={18} /> Añadir a mi calendario
        </button>
      )}

      {isBoss && confirmed && (
        <div className="card form-group">
          <span className="label">Reasignar sesión</span>
          <MonthCalendar value={editDate} onChange={setEditDate} />
          <div className="grid-2">
            <select className="select" aria-label="Hora" value={editTime} onChange={(e) => setEditTime(e.target.value)}>
              {timeSlots(session.duration).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select className="select" aria-label="Sala" value={editRoom} onChange={(e) => setEditRoom(e.target.value)}>
              {store.roomNames().map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              if (await store.rescheduleSession(session.id, editDate, editTime, editRoom)) onClose();
            }}
          >
            Guardar cambios
          </button>
        </div>
      )}

      {canMessage && (
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (chatClient) void store.openChat(chatClient.id);
            onClose();
            go("chat");
          }}
        >
          <MessageCircle size={18} /> {chatClient ? `Escribir a ${chatClient.name.split(" ")[0]}` : "Escribir a mi entrenador"}
        </button>
      )}

      {canComplete && confirmed ? (
        <div className="form-group">
          <span className="label">Feedback para el cliente</span>
          <textarea
            className="textarea"
            style={{ minHeight: 100 }}
            maxLength={2000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              void store.completeSession(session.id, feedback);
              onClose();
            }}
          >
            <Check size={20} strokeWidth={2.6} /> Marcar como completada
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (
                window.confirm(
                  "¿Marcar como no presentada? La sesión se descuenta del bono (aviso con menos de 4 h) y no suma puntos.",
                )
              ) {
                void store.completeSession(session.id, feedback, true);
                onClose();
              }
            }}
          >
            <UserX size={18} /> No se presentó
          </button>
        </div>
      ) : session.feedback ? (
        <div className="card stack">
          <span className="label inline-icon" style={{ color: "var(--blue)" }}>
            <Quote size={16} /> Feedback del entrenador
          </span>
          <p style={{ color: "var(--text-2)" }}>{session.feedback}</p>
        </div>
      ) : null}

      {isOwnSession && confirmed && <ClientCancel session={session} onDone={onClose} />}

      {session.noShow && (
        <div className="card inline-icon small" style={{ color: "var(--orange)" }}>
          <UserX size={16} /> Marcada como no presentada.
        </div>
      )}

      {isBoss && confirmed && (
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm("¿Cancelar esta sesión? Se devolverá la sesión al bono del cliente.")) {
              void store.cancelSession(session.id);
              onClose();
            }
          }}
        >
          Cancelar sesión
        </button>
      )}
    </Sheet>
  );
}

function ClientCancel({ session, onDone }: { session: GymSession; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!store.canSelfCancel(session)) {
    return (
      <p className="caption muted" style={{ lineHeight: 1.45 }}>
        Quedan menos de 24 h. Si no puedes venir, escribe a tu entrenador por el chat para reorganizarla (con menos de
        4 h la sesión cuenta como realizada).
      </p>
    );
  }
  return (
    <>
      {error && <div className="error-box">{error}</div>}
      <button
        className="btn btn-danger"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm("¿Cancelar esta sesión? Como avisas con más de 24 h, vuelve a tu bono.")) return;
          setBusy(true);
          const result = await store.cancelOwnSession(session.id);
          setBusy(false);
          if (result) setError(result);
          else onDone();
        }}
      >
        {busy ? "Cancelando…" : "Cancelar sesión (vuelve a tu bono)"}
      </button>
    </>
  );
}
