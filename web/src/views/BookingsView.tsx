// Port de ios/CodexGym/Views/BookingsView.swift.
import { useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, Lightbulb } from "lucide-react";
import {
  formatLongDay,
  normalizedTime,
  roleLabel,
  timeSlots,
  todayKey,
  type BookingRequest,
} from "../lib/domain";
import { store } from "../lib/store";
import {
  BookingRequestCard,
  EmptyState,
  MonthCalendar,
  ScreenHeader,
  SectionTitle,
  Segmented,
  Sheet,
  SlotGrid,
  useAppState,
} from "../ui";

export function BookingsView() {
  const state = useAppState();
  const role = state.currentUser?.role ?? "reserve";
  const [active, setActive] = useState<BookingRequest | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [roomRequest, setRoomRequest] = useState(false);

  const visible = store.visibleBookings();
  const roomRequests = visible.filter((b) => b.kind === "room_rental" && b.status === "pending_boss");
  const trainingRequests = visible.filter((b) => b.kind === "training" && b.status === "pending_trainer");
  const actionable =
    role === "trainer"
      ? visible.filter((b) => b.status === "pending_trainer")
      : role === "boss"
        ? [...roomRequests, ...trainingRequests]
        : [];

  const section = (title: string, requests: BookingRequest[], actionTitle?: string) => (
    <>
      <SectionTitle title={title} count={requests.length} />
      {requests.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Todo al día" message="No hay solicitudes en esta sección." />
      ) : (
        requests.map((r) => (
          <BookingRequestCard
            key={r.id}
            request={r}
            actionTitle={actionTitle}
            onAction={actionTitle ? () => setActive(r) : undefined}
          />
        ))
      )}
    </>
  );

  const history = visible
    .filter((b) => b.status === "confirmed" || b.status === "rejected")
    .sort((a, b) => b.requestedDate.localeCompare(a.requestedDate));

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={roleLabel[role]}
        title={role === "reserve" ? "Ocupación de salas" : "Reservas"}
        subtitle={role === "reserve" ? "Consulta disponibilidad y usa tu bono" : "Calendario y solicitudes"}
        badge={actionable.length}
      />

      <AvailabilityCalendar date={selectedDate} onDate={setSelectedDate} />

      {role === "reserve" && (
        <>
          <button className="btn btn-primary" onClick={() => setRoomRequest(true)}>
            <CalendarPlus size={20} /> Solicitar una sala
          </button>
          <SectionTitle title="Mis solicitudes" count={visible.length} />
          {visible.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Todo al día" message="No tienes solicitudes." />
          ) : (
            visible.map((r) => {
              const pending = r.status === "pending_boss" || r.status === "pending_trainer";
              return (
                <BookingRequestCard
                  key={r.id}
                  request={r}
                  actionTitle={pending ? "Retirar solicitud" : undefined}
                  onAction={
                    pending
                      ? () => {
                          if (window.confirm("¿Retirar esta solicitud?")) void store.cancelBookingRequest(r.id);
                        }
                      : undefined
                  }
                />
              );
            })
          )}
        </>
      )}
      {role === "trainer" && section("Confirmar entrenamientos", actionable, "Confirmar")}
      {role === "boss" && (
        <>
          {section("Confirmar reservas de sala", roomRequests, "Confirmar o cambiar")}
          {section("Confirmar entrenamientos", trainingRequests, "Confirmar")}
          {section("Historial", history)}
        </>
      )}

      {active && <TimeAssignmentSheet request={active} isBoss={role === "boss"} onClose={() => setActive(null)} />}
      {roomRequest && <RoomBookingSheet initialDate={selectedDate} onClose={() => setRoomRequest(false)} />}
    </div>
  );
}

function AvailabilityCalendar({ date, onDate }: { date: string; onDate: (d: string) => void }) {
  const state = useAppState();
  const role = state.currentUser?.role;
  const rooms = store.roomNames();
  const [room, setRoom] = useState(rooms[0]);
  const [chosenDuration, setChosenDuration] = useState(45);
  const duration = role === "client" || role === "reserve" ? state.activePack.duration : chosenDuration;

  return (
    <div className="card stack" style={{ gap: 14 }}>
      <MonthCalendar value={date} onChange={onDate} />
      <Segmented label="Sala" value={room} onChange={setRoom} options={rooms.map((r) => ({ value: r, label: r }))} />
      {(role === "boss" || role === "trainer") && (
        <Segmented
          label="Duración"
          value={chosenDuration}
          onChange={setChosenDuration}
          options={[
            { value: 45, label: "45 min" },
            { value: 60, label: "1 hora" },
          ]}
        />
      )}
      <div className="caption bold muted">Horas disponibles · intervalos de {duration} min</div>
      <SlotGrid
        slots={timeSlots(duration)}
        isOccupied={(slot) => store.isSlotOccupied(date, slot, duration, room, null)}
      />
    </div>
  );
}

function RoomBookingSheet({ initialDate, onClose }: { initialDate: string; onClose: () => void }) {
  const state = useAppState();
  const duration = state.activePack.duration;
  const rooms = store.roomNames();
  const [date, setDate] = useState(initialDate < todayKey() ? todayKey() : initialDate);
  const [room, setRoom] = useState(rooms[0]);
  const [time, setTime] = useState(() => normalizedTime("10:00", duration));
  const occupied = (slot: string) => store.isSlotOccupied(date, slot, duration, room, null);

  // Si la hora elegida está ocupada, saltar a la primera libre.
  useEffect(() => {
    if (occupied(time)) {
      const free = timeSlots(duration).find((slot) => !occupied(slot));
      if (free) setTime(free);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, room, state.occupiedSlots, state.sessions]);

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="sheet-title">Reservar una sala</h2>
        <p className="muted small">
          Dirección debe confirmar la reserva. Al confirmarla se utilizará una sesión de tu bono.
        </p>
      </div>
      <div className="card">
        <MonthCalendar value={date} onChange={setDate} minDate={todayKey()} />
      </div>
      <Segmented label="Sala" value={room} onChange={setRoom} options={rooms.map((r) => ({ value: r, label: r }))} />
      <SlotGrid slots={timeSlots(duration)} selected={time} isOccupied={occupied} onSelect={setTime} />
      <button
        className="btn btn-primary"
        disabled={occupied(time) || state.activePack.remainingSessions <= 0}
        onClick={() => {
          void store.requestSession({ date, time, type: "Uso de sala", room });
          onClose();
        }}
      >
        Enviar solicitud
      </button>
    </Sheet>
  );
}

function TimeAssignmentSheet(props: { request: BookingRequest; isBoss: boolean; onClose: () => void }) {
  const { request, isBoss, onClose } = props;
  const rooms = store.roomNames();
  const isRoomApproval = request.kind === "room_rental";
  const [time, setTime] = useState(normalizedTime(request.proposedTime ?? request.requestedTime, request.duration));
  const [notes, setNotes] = useState(request.trainerNotes ?? "");
  const [room, setRoom] = useState(request.room && rooms.includes(request.room) ? request.room : rooms[0]);
  const trainerId = isRoomApproval ? null : request.trainerId;
  const occupied = (slot: string) => store.isSlotOccupied(request.requestedDate, slot, request.duration, room, trainerId);

  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 5 }}>
        <h2 className="sheet-title">{isRoomApproval ? "Confirmar reserva de sala" : "Confirmar entrenamiento"}</h2>
        <p className="muted small">
          {request.clientName} · {formatLongDay(request.requestedDate)} · {request.duration} min
        </p>
      </div>

      {request.proposedTime && (
        <div className="card inline-icon bold small" style={{ color: "var(--orange)" }}>
          <Lightbulb size={16} />
          Hora solicitada: {request.proposedTime}
        </div>
      )}

      <div className="form-group">
        <span className="label">Elige una hora</span>
        <SlotGrid slots={timeSlots(request.duration)} selected={time} isOccupied={occupied} onSelect={setTime} />
      </div>

      <div className="form-group">
        <span className="label">Sala</span>
        <select className="select" value={room} onChange={(e) => setRoom(e.target.value)}>
          {rooms.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <span className="label">Notas</span>
        <textarea className="textarea" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button
        className="btn btn-primary"
        disabled={occupied(time)}
        onClick={() => {
          if (isRoomApproval) void store.confirmBooking(request.id, time, room);
          else void store.proposeTime(request.id, time, notes, room);
          onClose();
        }}
      >
        {isRoomApproval ? "Confirmar reserva" : "Confirmar entrenamiento"}
      </button>

      {(isBoss || request.kind === "training") && (
        <button
          className="btn btn-danger"
          onClick={() => {
            void store.rejectBooking(request.id);
            onClose();
          }}
        >
          Rechazar solicitud
        </button>
      )}
    </Sheet>
  );
}
