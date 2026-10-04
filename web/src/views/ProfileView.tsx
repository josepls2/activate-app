// Perfil y ajustes con aspecto de app profesional (lista agrupada tipo iOS).
import { useState } from "react";
import {
  Bell,
  BedDouble,
  Camera,
  DoorOpen,
  Droplet,
  Dumbbell,
  FileText,
  Flame,
  Layers,
  Leaf,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Stethoscope,
  Target,
  Trash2,
  Trophy,
  User,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { currentWeek, initials, LIMITS, roleLabel, staffKindLabel, type StaffKind } from "../lib/domain";
import { sessionsInWeek, weeklyStreak } from "../lib/engagement";
import { disablePush, enablePush, pushConfigured, pushState, type PushState } from "../lib/notifications";
import { store } from "../lib/store";
import { SettingsGroup, SettingsRow, Sheet, StatTile, Toggle, ToggleRow, go, useAppState } from "../ui";
import { GoalSheet } from "./HomeView";

const staffIcon: Record<StaffKind, LucideIcon> = {
  trainer: Dumbbell,
  physiotherapist: Stethoscope,
  room_rental: DoorOpen,
  physio_room_rental: BedDouble,
};

const APP_VERSION = "1.1";

export function ProfileView() {
  const state = useAppState();
  const user = state.currentUser;
  const [sheet, setSheet] = useState<null | "terms" | "goal" | "details" | "team" | "install">(null);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  if (!user) return null;
  const isClient = user.role === "client";
  const isCustomer = isClient || user.role === "reserve";
  const isStaff = user.role === "boss" || user.role === "trainer";
  const done = isClient ? sessionsInWeek(state.sessions, user.id, currentWeek()) : 0;
  const streak = isClient ? weeklyStreak(state.sessions, user.id, user.weeklyGoal) : 0;

  return (
    <div className="screen" style={{ gap: 24 }}>
      <section className="profile-hero">
        <div className="avatar" aria-hidden>
          {initials(user.name)}
        </div>
        <h2>{user.name}</h2>
        <span className="role-pill">{roleLabel[user.role]}{user.role === "boss" && user.isTrainer ? " · Entrenador" : ""}</span>
        <span className="caption muted">{user.email}</span>
      </section>

      {isClient && (
        <div className="grid-3">
          <StatTile icon={Layers} tone="red" value={state.activePack.remainingSessions} label="En tu bono" onClick={() => go("plan")} />
          <StatTile icon={Target} tone="green" value={`${done}/${user.weeklyGoal}`} label="Esta semana" onClick={() => setSheet("goal")} />
          <StatTile icon={Flame} tone="orange" value={streak} label="Racha" />
        </div>
      )}

      <SettingsGroup title="Cuenta">
        <SettingsRow icon={User} tone="gray" label="Datos personales" value={user.phone || "Añadir teléfono"} onClick={() => setSheet("details")} />
        <SettingsRow icon={Mail} tone="blue" label="Email" value={user.email} />
        {isClient && (
          <SettingsRow
            icon={Users}
            tone="purple"
            label="Mis entrenadores"
            value={state.trainers.map((t) => t.name.split(" ")[0]).join(", ") || "Pendiente"}
          />
        )}
      </SettingsGroup>

      {isClient && (
        <SettingsGroup title="Entrenamiento">
          <SettingsRow
            icon={Target}
            tone="green"
            label="Objetivo semanal"
            value={`${user.weeklyGoal} ${user.weeklyGoal === 1 ? "clase" : "clases"}`}
            onClick={() => setSheet("goal")}
          />
          <SettingsRow icon={Layers} tone="red" label="Mi bono" value={`${state.activePack.remainingSessions} sesiones`} onClick={() => go("plan")} />
          <SettingsRow icon={Trophy} tone="orange" label="Retos y clasificación" onClick={() => go("challenges")} />
          <SettingsRow icon={Leaf} tone="green" label="Nutrición" onClick={() => go("nutrition")} />
          {user.cycleTrackingEnabled && <SettingsRow icon={Droplet} tone="red" label="Mi ciclo" onClick={() => go("cycle")} />}
        </SettingsGroup>
      )}

      {user.role === "reserve" && (
        <SettingsGroup title="Sala">
          <SettingsRow icon={Layers} tone="red" label="Mi bono" value={`${state.activePack.remainingSessions} sesiones`} onClick={() => go("plan")} />
          <SettingsRow icon={DoorOpen} tone="orange" label="Salas permitidas" detail="Sala de arriba, Sala de abajo y Sala de fisio" />
        </SettingsGroup>
      )}

      {isStaff && (
        <SettingsGroup title="Herramientas del equipo">
          <SettingsRow icon={Trophy} tone="orange" label="Retos semanales" onClick={() => go("challenges")} />
          <SettingsRow icon={Sparkles} tone="teal" label="Consejos saludables" onClick={() => go("tips")} />
          <SettingsRow icon={Users} tone="blue" label="Clientes" value={String(state.managedUsers.length)} onClick={() => go("clients")} />
          {user.role === "boss" && (
            <SettingsRow icon={Dumbbell} tone="purple" label="Equipo y colaboradores" value={String(state.staff.length)} onClick={() => setSheet("team")} />
          )}
        </SettingsGroup>
      )}

      <SettingsGroup title="Notificaciones" footer="Se configuran en cada dispositivo. Al cerrar sesión, este dispositivo deja de recibirlas.">
        <NotificationsRow uid={user.id} />
      </SettingsGroup>

      {isCustomer && (
        <SettingsGroup title="Privacidad">
          {isClient && (
            <SettingsRow
              icon={Trophy}
              tone="purple"
              label="Aparecer en la clasificación"
              detail="Sólo nombre e inicial del apellido"
              trailing={
                <Toggle
                  label="Aparecer en la clasificación"
                  checked={user.leaderboardOptIn}
                  onChange={(v) => void store.setLeaderboardOptIn(v)}
                />
              }
            />
          )}
          {isClient && user.cycleTrackingEnabled && (
            <SettingsRow
              icon={Droplet}
              tone="red"
              label="Compartir resumen del ciclo"
              detail="Con tus entrenadores; nunca las notas"
              trailing={
                <Toggle
                  label="Compartir resumen del ciclo"
                  checked={user.cycleSharingEnabled}
                  onChange={(v) => void store.setCycleSharingEnabled(v)}
                />
              }
            />
          )}
          <SettingsRow
            icon={FileText}
            tone="gray"
            label="Términos"
            value={user.termsAccepted ? "Aceptados" : "Pendientes"}
            onClick={() => setSheet("terms")}
          />
          {isClient && (
            <SettingsRow icon={Camera} tone="gray" label="Uso de imagen" value={user.imageConsent ? "Autorizado" : "No autorizado"} />
          )}
          <SettingsRow
            icon={UserCheck}
            tone="gray"
            label="Titular de la cuenta"
            value={user.isMinor ? `Menor · ${user.guardianName ?? "tutor pendiente"}` : "Persona adulta"}
          />
        </SettingsGroup>
      )}

      <SettingsGroup title="Ayuda">
        {isClient && <SettingsRow icon={MessageCircle} tone="blue" label="Escribir a mi entrenador" onClick={() => go("chat")} />}
        {!isStaff && <SettingsRow icon={Sparkles} tone="teal" label="Consejos para una vida sana" onClick={() => go("tips")} />}
        <SettingsRow icon={Smartphone} tone="gray" label="Instalar la app en el móvil" onClick={() => setSheet("install")} />
        <SettingsRow icon={ShieldCheck} tone="green" label="Privacidad y salud" detail="Tus datos de salud sólo los ve tu equipo autorizado" />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow icon={LogOut} tone="red" label="Cerrar sesión" danger onClick={() => void store.signOut()} />
        {user.role !== "boss" && (
          <SettingsRow
            icon={Trash2}
            tone="gray"
            label="Solicitar eliminación de la cuenta"
            onClick={async () => {
              const ok = window.confirm(
                "¿Solicitar la eliminación de la cuenta?\n\nEl acceso quedará desactivado y Activate tramitará la eliminación respetando las obligaciones legales de conservación.",
              );
              if (ok) setDeletionError(await store.requestAccountDeletion());
            }}
          />
        )}
      </SettingsGroup>
      {deletionError && <p className="caption" style={{ color: "var(--error)" }}>{deletionError}</p>}

      <p className="caption muted" style={{ textAlign: "center" }}>
        Activate Personal Training · versión {APP_VERSION}
      </p>

      {sheet === "terms" && <TermsSheet allowAcceptance={!user.termsAccepted} onClose={() => setSheet(null)} />}
      {sheet === "goal" && <GoalSheet current={user.weeklyGoal} onClose={() => setSheet(null)} />}
      {sheet === "details" && <DetailsSheet onClose={() => setSheet(null)} />}
      {sheet === "install" && <InstallSheet onClose={() => setSheet(null)} />}
      {sheet === "team" && (
        <Sheet title="Equipo y colaboradores" onClose={() => setSheet(null)}>
          <div className="settings-card">
            {state.staff.map((member) => (
              <SettingsRow
                key={member.id}
                icon={staffIcon[member.kind]}
                tone={member.kind === "trainer" ? "red" : "gray"}
                label={member.name}
                detail={staffKindLabel[member.kind]}
                value={member.kind === "trainer" ? (member.authUid ? "Con acceso" : "Sin acceso") : undefined}
              />
            ))}
          </div>
          <p className="caption muted">Activa accesos y asigna entrenadores desde Gestión.</p>
        </Sheet>
      )}
    </div>
  );
}

function DetailsSheet({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const user = state.currentUser!;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title="Datos personales" onClose={onClose}>
      <div className="form-section">
        <label className="form-row">
          <User size={18} color="var(--muted)" />
          <input
            className="input spacer"
            style={{ padding: 0, minHeight: 32 }}
            aria-label="Nombre y apellidos"
            maxLength={LIMITS.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="form-row">
          <Phone size={18} color="var(--muted)" />
          <input
            className="input spacer"
            style={{ padding: 0, minHeight: 32 }}
            type="tel"
            placeholder="Teléfono"
            aria-label="Teléfono"
            maxLength={LIMITS.phone}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <div className="form-row">
          <Mail size={18} color="var(--muted)" />
          <span className="spacer muted">{user.email}</span>
        </div>
      </div>
      <p className="caption muted">Para cambiar el email, pídeselo a Dirección.</p>
      {error && <div className="error-box">{error}</div>}
      <button
        className="btn btn-primary"
        disabled={saving || !name.trim() || (name === user.name && phone === user.phone)}
        onClick={async () => {
          setSaving(true);
          const result = await store.updateProfile({ name, phone });
          setSaving(false);
          if (result) setError(result);
          else onClose();
        }}
      >
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </Sheet>
  );
}

function InstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Instalar la app" onClose={onClose}>
      <div className="settings-card">
        <SettingsRow icon={Smartphone} tone="blue" label="iPhone (Safari)" detail="Pulsa Compartir → «Añadir a pantalla de inicio»." />
        <SettingsRow icon={Smartphone} tone="green" label="Android (Chrome)" detail="Menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio»." />
        <SettingsRow icon={Smartphone} tone="gray" label="Ordenador" detail="En Chrome o Edge, icono de instalar en la barra de direcciones." />
      </div>
      <p className="caption muted" style={{ lineHeight: 1.45 }}>
        Instalada se abre a pantalla completa, como una app, y en iPhone permite recibir notificaciones.
      </p>
    </Sheet>
  );
}

const pushLabel: Record<PushState, string> = {
  unsupported: "Este navegador no las admite",
  "needs-install": "En iPhone, instala la app primero",
  denied: "Bloqueadas en el navegador",
  off: "Desactivadas",
  foreground: pushConfigured ? "Con la app abierta" : "Con la app abierta (push sin configurar)",
  on: "Activadas, también con la app cerrada",
};

function NotificationsRow({ uid }: { uid: string }) {
  const [state, setState] = useState<PushState>(() => pushState(uid));
  const [busy, setBusy] = useState(false);
  const enabled = state === "on" || state === "foreground";
  const blocked = state === "unsupported" || state === "needs-install" || state === "denied";
  return (
    <SettingsRow
      icon={Bell}
      tone="red"
      label="Notificaciones"
      detail={busy ? "Configurando…" : pushLabel[state]}
      trailing={
        <Toggle
          label="Notificaciones"
          checked={enabled}
          disabled={busy || (blocked && state !== "denied")}
          onChange={async (value) => {
            setBusy(true);
            if (value) {
              const result = await enablePush(uid);
              setState(result.state);
            } else {
              await disablePush(uid);
              setState("off");
            }
            setBusy(false);
          }}
        />
      }
    />
  );
}

const TERMS = [
  "Las sesiones son personales y no pueden cederse sin autorización escrita de Activate.",
  "Avisando con más de 24 horas se podrá reorganizar la sesión sin perderla.",
  "Avisando con menos de 4 horas, la sesión se contabilizará como realizada.",
  "La regla aplicable entre 4 y 24 horas debe ser confirmada por Activate antes de publicar.",
  "Las cuentas de menores requieren un consentimiento específico de padre, madre o tutor legal.",
  "El consentimiento para uso de imagen es independiente y se puede rechazar.",
];

function TermsSheet({ allowAcceptance, onClose }: { allowAcceptance: boolean; onClose: () => void }) {
  const state = useAppState();
  const [accepts, setAccepts] = useState(false);
  const [image, setImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title="Términos del piloto" onClose={onClose}>
      <div className="card inline-icon bold small" style={{ color: "var(--orange)" }}>
        <ShieldAlert size={18} /> Borrador operativo pendiente de revisión legal
      </div>
      {TERMS.map((text, index) => (
        <div key={index} className="card row top">
          <span className="terms-num">{index + 1}</span>
          <p className="small spacer" style={{ color: "var(--text-2)", lineHeight: 1.45 }}>
            {text}
          </p>
        </div>
      ))}
      <p className="caption muted">
        La fotografía original aportada por Activate se conserva en docs/reference para que un profesional revise la
        redacción completa.
      </p>

      {allowAcceptance && (
        <div className="card stack" style={{ gap: 4, padding: 0 }}>
          <ToggleRow title="He leído y acepto los términos del piloto" checked={accepts} onChange={setAccepts} />
          {state.currentUser?.role === "client" && (
            <ToggleRow
              title="Autorizo el uso de mi imagen"
              subtitle="El uso de imagen es opcional y no condiciona el servicio."
              checked={image}
              onChange={setImage}
            />
          )}
          {error && (
            <p className="caption" style={{ color: "var(--error)", padding: "0 14px" }}>
              {error}
            </p>
          )}
          <div style={{ padding: 14 }}>
            <button
              className="btn btn-primary"
              disabled={!accepts || saving}
              onClick={async () => {
                setSaving(true);
                const result = await store.acceptTerms(image);
                setSaving(false);
                if (result) setError(result);
                else onClose();
              }}
            >
              {saving ? "Guardando…" : "Guardar consentimientos"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
