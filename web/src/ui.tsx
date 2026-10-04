// Port de ios/CodexGym/Views/Components.swift + controles nativos de iOS.
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ChevronRight as ChevronRightIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorClosed,
  Hash,
  Hourglass,
  Minus,
  Plus,
  Quote,
  User,
  XCircle,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import {
  bookingStatusLabel,
  bookingStatusTone,
  dayKey,
  formatShortDay,
  keyToDate,
  sessionStatusLabel,
  sessionStatusTone,
  type BookingRequest,
  type BookingStatus,
  type GymSession,
  type SessionStatus,
} from "./lib/domain";
import { store, type AppState } from "./lib/store";

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function ScreenHeader(props: { eyebrow: string; title: string; subtitle?: string; badge?: number }) {
  return (
    <header className="header">
      <div className="spacer">
        <div className="eyebrow">{props.eyebrow}</div>
        <h1>{props.title}</h1>
        {props.subtitle && <p>{props.subtitle}</p>}
      </div>
      {props.badge ? (
        <span className="count-badge" aria-label={`${props.badge} pendientes`}>
          {props.badge}
        </span>
      ) : null}
    </header>
  );
}

export function SectionTitle(props: { title: string; count?: number }) {
  return (
    <h2 className="section-title">
      {props.title}
      {props.count !== undefined && <span className="pill-count">{props.count}</span>}
    </h2>
  );
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className={`badge tone-${sessionStatusTone[status]}`} aria-label={`Estado: ${sessionStatusLabel[status]}`}>
      {sessionStatusLabel[status]}
    </span>
  );
}

const bookingIcon: Record<BookingStatus, LucideIcon> = {
  pending_trainer: CalendarClock,
  pending_boss: Hourglass,
  confirmed: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle,
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const Icon = bookingIcon[status];
  return (
    <span className={`badge tone-${bookingStatusTone[status]}`}>
      <Icon size={12} strokeWidth={2.6} />
      {bookingStatusLabel[status]}
    </span>
  );
}

export function SessionCard({ session, onTap }: { session: GymSession; onTap: () => void }) {
  return (
    <button className="card tap-card" onClick={onTap} aria-label={`Sesión de ${session.clientName}, ${session.time}`}>
      <div className="row top">
        <div className="spacer">
          <div className="bold" style={{ fontSize: 17 }}>
            {session.clientName}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {session.time} · {session.duration} min
          </div>
        </div>
        <StatusBadge status={session.status} />
      </div>
      <div className="meta">
        <span>
          <User size={13} />
          {session.trainerName}
        </span>
        <span>
          <DoorClosed size={13} />
          {session.room}
        </span>
      </div>
      {session.packSessionNumber && session.packTotalSessions ? (
        <span className="inline-icon caption bold" style={{ color: "var(--red-light)" }}>
          <Hash size={13} strokeWidth={2.6} />
          Sesión {session.packSessionNumber} de {session.packTotalSessions} del pack
        </span>
      ) : null}
      {session.feedback ? (
        <div className="note">
          <div className="inline-icon bold" style={{ color: "var(--blue)", marginBottom: 5 }}>
            <Quote size={12} /> Feedback
          </div>
          <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {session.feedback}
          </div>
        </div>
      ) : null}
    </button>
  );
}

export function BookingRequestCard(props: {
  request: BookingRequest;
  actionTitle?: string;
  onAction?: () => void;
}) {
  const { request } = props;
  const time = request.proposedTime ?? request.finalTime;
  return (
    <div className="card stack" style={{ gap: 14 }}>
      <div className="row top">
        <div className="spacer stack" style={{ gap: 4 }}>
          <div className="bold" style={{ fontSize: 17 }}>
            {request.clientName}
          </div>
          <div className="muted caption">
            {request.type} · {request.duration} min · {formatShortDay(request.requestedDate)}
          </div>
          <div className="muted caption">
            {request.trainerName}
            {request.room ? ` · ${request.room}` : ""}
          </div>
        </div>
        <div className="stack" style={{ alignItems: "flex-end", gap: 6 }}>
          <BookingStatusBadge status={request.status} />
          {time && (
            <span className="bold small" style={{ color: "var(--orange)" }}>
              {time}
            </span>
          )}
        </div>
      </div>
      {request.trainerNotes ? <div className="note" style={{ fontStyle: "italic" }}>“{request.trainerNotes}”</div> : null}
      {props.actionTitle && (
        <button className="btn btn-outline" onClick={props.onAction}>
          {props.actionTitle}
        </button>
      )}
    </div>
  );
}

export function EmptyState(props: { icon: LucideIcon; title: string; message: string }) {
  const Icon = props.icon;
  return (
    <div className="card empty">
      <Icon size={30} />
      <strong>{props.title}</strong>
      <p>{props.message}</p>
    </div>
  );
}

export function DetailRow(props: { icon: LucideIcon; label: string; value: string }) {
  const Icon = props.icon;
  return (
    <div className="detail-row">
      <Icon size={20} />
      <div>
        <small>{props.label}</small>
        <strong>{props.value}</strong>
      </div>
    </div>
  );
}

export function InfoRow(props: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="card">
      <DetailRow {...props} />
    </div>
  );
}

// ---------- Controles ----------

export function Segmented<T extends string | number | boolean>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === props.value}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle"
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    />
  );
}

export function ToggleRow(props: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: ReactNode;
  subtitle?: string;
  disabled?: boolean;
}) {
  return (
    <div className="form-row">
      <div className="spacer">
        <div style={{ fontSize: 16 }}>{props.title}</div>
        {props.subtitle && <div className="muted caption" style={{ marginTop: 3 }}>{props.subtitle}</div>}
      </div>
      <Toggle
        checked={props.checked}
        onChange={props.onChange}
        label={typeof props.title === "string" ? props.title : "Opción"}
        disabled={props.disabled}
      />
    </div>
  );
}

export function Stepper(props: { value: number; min: number; max: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="form-row">
      <span className="spacer" style={{ fontSize: 16 }}>
        {props.label}
      </span>
      <div className="stepper">
        <button
          type="button"
          aria-label="Restar"
          disabled={props.value <= props.min}
          onClick={() => props.onChange(Math.max(props.min, props.value - 1))}
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          aria-label="Sumar"
          disabled={props.value >= props.max}
          onClick={() => props.onChange(Math.min(props.max, props.value + 1))}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export function SlotGrid(props: {
  slots: string[];
  selected?: string;
  isOccupied: (slot: string) => boolean;
  onSelect?: (slot: string) => void;
}) {
  return (
    <div className="slot-grid">
      {props.slots.map((slot) => {
        const occupied = props.isOccupied(slot);
        const classes = ["slot", occupied ? "occupied" : props.selected === slot ? "selected" : ""].join(" ");
        if (!props.onSelect) {
          return (
            <div key={slot} className={classes} aria-label={occupied ? `${slot}, ocupada` : `${slot}, disponible`}>
              {slot}
            </div>
          );
        }
        return (
          <button
            key={slot}
            type="button"
            className={classes}
            disabled={occupied}
            aria-pressed={props.selected === slot}
            aria-label={occupied ? `${slot}, ocupada` : slot}
            onClick={() => props.onSelect?.(slot)}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}

const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** Calendario mensual estilo DatePicker(.graphical) de iOS. */
export function MonthCalendar(props: { value: string; onChange: (key: string) => void; minDate?: string }) {
  const selected = keyToDate(props.value);
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  useEffect(() => {
    const d = keyToDate(props.value);
    setCursor((current) =>
      current.getFullYear() === d.getFullYear() && current.getMonth() === d.getMonth()
        ? current
        : new Date(d.getFullYear(), d.getMonth(), 1),
    );
  }, [props.value]);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= count; d += 1) cells.push(dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), d)));
    return cells;
  }, [cursor]);

  const today = dayKey(new Date());
  const title = monthFormatter.format(cursor);
  const minMonth = props.minDate ? keyToDate(props.minDate) : null;
  const canGoBack =
    !minMonth ||
    cursor.getFullYear() > minMonth.getFullYear() ||
    (cursor.getFullYear() === minMonth.getFullYear() && cursor.getMonth() > minMonth.getMonth());

  return (
    <div className="month">
      <div className="month-head">
        <strong>{title.charAt(0).toUpperCase() + title.slice(1)}</strong>
        <button
          type="button"
          aria-label="Mes anterior"
          disabled={!canGoBack}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="month-grid">
        {DOW.map((d) => (
          <span key={d} className="dow">
            {d}
          </span>
        ))}
        {days.map((key, index) =>
          key ? (
            <button
              key={key}
              type="button"
              className={[key === props.value ? "selected" : "", key === today ? "today" : ""].join(" ")}
              disabled={Boolean(props.minDate && key < props.minDate)}
              aria-pressed={key === props.value}
              aria-label={key}
              onClick={() => props.onChange(key)}
            >
              {Number(key.slice(8))}
            </button>
          ) : (
            <span key={`e${index}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function Sheet(props: { title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [props]);

  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={props.title ?? "Detalle"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-bar">
          {props.title && <strong>{props.title}</strong>}
          <button type="button" className="close" onClick={props.onClose}>
            Cerrar
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}


// ---------- Ajustes (lista agrupada) ----------

export type IconTone = "red" | "blue" | "green" | "orange" | "purple" | "gray" | "teal";

export function SettingsGroup(props: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      {props.title && <h3 className="settings-title">{props.title}</h3>}
      <div className="settings-card">{props.children}</div>
      {props.footer && <p className="settings-footer">{props.footer}</p>}
    </section>
  );
}

export function SettingsRow(props: {
  icon: LucideIcon;
  tone?: IconTone;
  label: string;
  value?: ReactNode;
  detail?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
}) {
  const Icon = props.icon;
  const content = (
    <>
      <span className={`settings-icon tile-${props.tone ?? "gray"}`}>
        <Icon size={17} strokeWidth={2.2} />
      </span>
      <span className="settings-text">
        <span className={`settings-label${props.danger ? " danger" : ""}`}>{props.label}</span>
        {props.detail && <span className="settings-detail">{props.detail}</span>}
      </span>
      {props.value !== undefined && <span className="settings-value">{props.value}</span>}
      {props.trailing}
      {props.onClick && !props.trailing && <ChevronRightIcon size={18} className="settings-chevron" />}
    </>
  );
  return props.onClick ? (
    <button type="button" className="settings-row" onClick={props.onClick}>
      {content}
    </button>
  ) : (
    <div className="settings-row">{content}</div>
  );
}

// ---------- Indicadores ----------

export function ProgressRing(props: { value: number; max: number; size?: number; label?: ReactNode; sublabel?: string }) {
  const size = props.size ?? 112;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = props.max > 0 ? Math.min(1, props.value / props.max) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${props.value} de ${props.max}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--card-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ratio >= 1 ? "var(--green)" : "var(--red)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label">
        <strong>{props.label ?? `${props.value}/${props.max}`}</strong>
        {props.sublabel && <span>{props.sublabel}</span>}
      </div>
    </div>
  );
}

export function StatTile(props: { value: ReactNode; label: string; icon?: LucideIcon; tone?: IconTone; onClick?: () => void }) {
  const Icon = props.icon;
  const body = (
    <>
      {Icon && (
        <span className={`settings-icon tile-${props.tone ?? "gray"}`} style={{ marginBottom: 8 }}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
      )}
      <strong className="stat-value">{props.value}</strong>
      <span className="stat-label">{props.label}</span>
    </>
  );
  return props.onClick ? (
    <button type="button" className="card stat-tile" onClick={props.onClick}>
      {body}
    </button>
  ) : (
    <div className="card stat-tile">{body}</div>
  );
}

/** Cabecera de pantallas secundarias (con volver). */
export function BackBar(props: { label: string; onBack: () => void }) {
  return (
    <button type="button" className="back-bar" onClick={props.onBack}>
      <ChevronLeft size={22} /> {props.label}
    </button>
  );
}

export function Chip(props: { selected: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      className={`choice-chip${props.selected ? " on" : ""}`}
      aria-pressed={props.selected}
      aria-label={props.label}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** Navega a otra pantalla de la app (usa el hash: #tips, #challenges…). */
export function go(route: string) {
  window.location.hash = `#${route}`;
}
