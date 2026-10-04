// Port de ios/CodexGym/Views/AdminView.swift (pestaña exclusiva de Dirección).
import { Fragment, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, Circle, Settings2, UserPlus } from "lucide-react";
import { LIMITS, normalizeDocument, roleLabel, type AppUser, type StaffMember } from "../lib/domain";
import { store } from "../lib/store";
import { Chip, ScreenHeader, SectionTitle, Segmented, Sheet, Stepper, ToggleRow, useAppState } from "../ui";

export function AdminView() {
  const state = useAppState();
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<AppUser | null>(null);
  const [activating, setActivating] = useState<StaffMember | null>(null);
  const trainers = state.staff.filter((s) => s.kind === "trainer");
  const pendingTrainers = trainers.filter((t) => !t.authUid);
  const liveManaging = managing ? (state.managedUsers.find((u) => u.id === managing.id) ?? managing) : null;

  return (
    <div className="screen" style={{ gap: 18 }}>
      <ScreenHeader
        eyebrow="Sólo Dirección"
        title="Gestión"
        subtitle="Altas, bonos y asignación de entrenadores"
        badge={state.deletionRequests.length + pendingTrainers.length || undefined}
      />
      <button className="btn btn-primary" onClick={() => setCreating(true)}>
        <UserPlus size={20} /> Dar de alta cliente o usuario de sala
      </button>

      {pendingTrainers.length > 0 && (
        <div className="card row top" style={{ borderColor: "rgba(255,158,10,0.35)" }}>
          <AlertTriangle size={18} color="var(--orange)" style={{ flex: "none", marginTop: 2 }} />
          <p className="small" style={{ color: "var(--text-2)", lineHeight: 1.45 }}>
            {pendingTrainers.map((t) => t.name).join(", ")} {pendingTrainers.length === 1 ? "no tiene" : "no tienen"}{" "}
            acceso activado. Sus clientes no podrán reservar con {pendingTrainers.length === 1 ? "él" : "ellos"} hasta
            activarlo en «Equipo».
          </p>
        </div>
      )}

      {state.deletionRequests.length > 0 && (
        <>
          <SectionTitle title="Solicitudes de baja" count={state.deletionRequests.length} />
          <div className="form-section">
            {state.deletionRequests.map((request) => {
              const person = state.managedUsers.find((u) => u.id === request.id);
              return (
                <div key={request.id} className="list-row">
                  <div className="spacer" style={{ minWidth: 0 }}>
                    <div className="bold">{person?.name ?? request.email}</div>
                    <div className="caption muted ellipsis">
                      {request.email}
                      {request.requestedAt ? ` · ${dateFormatter.format(request.requestedAt)}` : ""}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline"
                    style={{ width: "auto", padding: "8px 12px" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Marca la solicitud como tramitada cuando hayas eliminado o anonimizado la cuenta en Firebase Console, respetando los plazos legales de conservación.",
                        )
                      ) {
                        void store.markDeletionProcessed(request.id);
                      }
                    }}
                  >
                    Tramitada
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle title="Clientes y usuarios de sala" count={state.managedUsers.length} />
      {state.managedUsers.map((person) => (
        <button key={person.id} className="card row" style={{ textAlign: "left" }} onClick={() => setManaging(person)}>
          <div className="spacer" style={{ minWidth: 0 }}>
            <div className="bold" style={{ fontSize: 17 }}>
              {person.name}
            </div>
            <div className="caption muted" style={{ marginTop: 4 }}>
              {roleLabel[person.role]} · {person.remainingSessions} sesiones · {person.sessionDuration} min
            </div>
            {person.status !== "active" && (
              <span className="tag tone-error" style={{ marginTop: 6 }}>
                {person.status === "deletion_requested" ? "Baja solicitada" : "Desactivada"}
              </span>
            )}
          </div>
          <span className="inline-icon caption bold" style={{ color: "var(--red-light)" }}>
            <Settings2 size={15} /> Gestionar
          </span>
        </button>
      ))}

      <SectionTitle title="Equipo" count={trainers.length} />
      <div className="form-section">
        {trainers.length === 0 && <div className="list-row warning-text">No hay entrenadores en el directorio.</div>}
        {trainers.map((trainer) => (
          <div key={trainer.id} className="list-row">
            <div className="spacer" style={{ minWidth: 0 }}>
              <div className="bold">{trainer.name}</div>
              <div className="caption muted ellipsis">
                {trainer.authUid ? trainer.email || "Acceso activo" : "Sin acceso a la app"}
              </div>
            </div>
            {trainer.authUid ? (
              <span className="badge tone-green">
                <CheckCircle2 size={12} /> Activo
              </span>
            ) : (
              <button
                className="btn btn-outline"
                style={{ width: "auto", padding: "8px 12px" }}
                onClick={() => setActivating(trainer)}
              >
                Activar acceso
              </button>
            )}
          </div>
        ))}
      </div>

      {creating && <NewClientSheet onClose={() => setCreating(false)} />}
      {liveManaging && <ManageClientSheet client={liveManaging} onClose={() => setManaging(null)} />}
      {activating && <ActivateStaffSheet member={activating} onClose={() => setActivating(null)} />}
    </div>
  );
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

const PACKS = [
  { id: "5-45", sessions: 5, duration: 45, name: "Pack 5 · 45 min" },
  { id: "10-45", sessions: 10, duration: 45, name: "Pack 10 · 45 min" },
  { id: "10-60", sessions: 10, duration: 60, name: "Pack 10 · 60 min" },
  { id: "20-60", sessions: 20, duration: 60, name: "Pack 20 · 60 min" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Alta en 3 pasos: datos → plan → confirmar. */
function NewClientSheet({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const [step, setStep] = useState(0);
  const [isRoomUser, setIsRoomUser] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dni, setDni] = useState("");
  const [packId, setPackId] = useState("10-45");
  const [customSessions, setCustomSessions] = useState(8);
  const [customDuration, setCustomDuration] = useState(45);
  const [trainerIds, setTrainerIds] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [isFemale, setIsFemale] = useState(false);
  const [cycleTracking, setCycleTracking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const trainers = state.staff.filter((s) => s.kind === "trainer");
  const pack = PACKS.find((p) => p.id === packId);
  const sessions = pack?.sessions ?? customSessions;
  const duration = pack?.duration ?? customDuration;
  const packName = pack?.name ?? `Pack ${customSessions} · ${customDuration} min`;

  const step1Valid = name.trim().length > 1 && EMAIL_RE.test(email.trim()) && normalizeDocument(dni).length >= 6;
  const step2Valid = isRoomUser || trainerIds.length > 0;
  const extrasValid = isRoomUser || !isMinor || (guardianName.trim().length > 0 && EMAIL_RE.test(guardianEmail.trim()));

  const reset = () => {
    setStep(0);
    setName("");
    setEmail("");
    setPhone("");
    setDni("");
    setTrainerIds([]);
    setIsMinor(false);
    setGuardianName("");
    setGuardianEmail("");
    setIsFemale(false);
    setCycleTracking(false);
    setShowMore(false);
    setCreated(null);
    setError(null);
  };

  async function save() {
    setSaving(true);
    setError(null);
    const result = await store.createClient({
      name,
      dni,
      email,
      phone,
      trainerStaffIds: trainerIds,
      duration,
      packName,
      packSessions: sessions,
      isMinor: isRoomUser ? false : isMinor,
      isRoomUser,
      isFemale: isRoomUser ? false : isFemale,
      cycleTrackingEnabled: !isRoomUser && isFemale && cycleTracking,
      guardianName,
      guardianEmail,
    });
    setSaving(false);
    if (result) setError(result);
    else setCreated(name.trim());
  }

  if (created) {
    return (
      <Sheet title="Alta completada" onClose={onClose}>
        <div className="success-mark">
          <CheckCircle2 size={40} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 className="sheet-title">{created} ya está dado de alta</h2>
          <p className="muted small" style={{ marginTop: 8, lineHeight: 1.5 }}>
            Le hemos enviado un email a <strong style={{ color: "var(--text)" }}>{email.trim().toLowerCase()}</strong> para
            crear su contraseña. La primera vez que entre verá una bienvenida para aceptar los términos y marcar su
            objetivo.
          </p>
        </div>
        <button className="btn btn-primary" onClick={reset}>
          <UserPlus size={18} /> Dar de alta a otra persona
        </button>
        <button className="btn btn-secondary" onClick={onClose}>
          Terminar
        </button>
      </Sheet>
    );
  }

  const stepNames = ["Datos", "Plan", "Confirmar"];

  return (
    <Sheet title={isRoomUser ? "Nuevo usuario de sala" : "Nuevo cliente"} onClose={onClose}>
      <div className="wizard-steps" aria-label={`Paso ${step + 1} de 3`}>
        {stepNames.map((label, index) => (
          <Fragment key={label}>
            {index > 0 && <span className="line" />}
            <span className={`step${index === step ? " active" : index < step ? " done" : ""}`}>
              <span className="num">{index < step ? "✓" : index + 1}</span>
              {label}
            </span>
          </Fragment>
        ))}
      </div>

      {step === 0 && (
        <>
          <Segmented
            label="Tipo de alta"
            value={isRoomUser}
            onChange={setIsRoomUser}
            options={[
              { value: false, label: "Cliente Activate" },
              { value: true, label: "Usuario de sala" },
            ]}
          />
          <div className="form-section">
            <input
              className="input"
              placeholder="Nombre y apellidos"
              aria-label="Nombre y apellidos"
              autoComplete="off"
              maxLength={LIMITS.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              type="email"
              inputMode="email"
              placeholder="Email (recibirá el acceso)"
              aria-label="Email"
              autoCapitalize="none"
              autoComplete="off"
              maxLength={LIMITS.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              type="tel"
              placeholder="Teléfono (opcional)"
              aria-label="Teléfono"
              maxLength={LIMITS.phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="input"
              placeholder="DNI / NIE"
              aria-label="DNI o NIE"
              autoCapitalize="characters"
              maxLength={LIMITS.document}
              value={dni}
              onChange={(e) => setDni(e.target.value)}
            />
          </div>
          {email && !EMAIL_RE.test(email.trim()) && <p className="caption warning-text">Revisa el email.</p>}
          <button className="btn btn-primary" disabled={!step1Valid} onClick={() => setStep(1)}>
            Continuar
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <span className="label">Bono</span>
          <div className="pack-grid">
            {PACKS.map((p) => (
              <button key={p.id} type="button" className="pack-option" aria-pressed={packId === p.id} onClick={() => setPackId(p.id)}>
                <strong>{p.sessions}</strong>
                <span>sesiones · {p.duration} min</span>
              </button>
            ))}
            <button
              type="button"
              className="pack-option"
              aria-pressed={packId === "custom"}
              onClick={() => setPackId("custom")}
              style={{ gridColumn: "1 / -1" }}
            >
              <strong style={{ fontSize: 16 }}>Personalizado</strong>
              <span>Elige número de sesiones y duración</span>
            </button>
          </div>
          {packId === "custom" && (
            <div className="form-section">
              <Stepper label={`${customSessions} sesiones`} value={customSessions} min={1} max={100} onChange={setCustomSessions} />
              <div className="form-row">
                <span className="spacer">Duración</span>
                <div style={{ width: 200 }}>
                  <Segmented
                    label="Duración"
                    value={customDuration}
                    onChange={setCustomDuration}
                    options={[
                      { value: 45, label: "45 min" },
                      { value: 60, label: "60 min" },
                    ]}
                  />
                </div>
              </div>
            </div>
          )}

          {!isRoomUser && (
            <>
              <span className="label">Entrenadores</span>
              {trainers.length === 0 ? (
                <p className="warning-text">No hay entrenadores activos en el directorio.</p>
              ) : (
                <div className="chip-row">
                  {trainers.map((t) => (
                    <Chip
                      key={t.id}
                      selected={trainerIds.includes(t.id)}
                      onClick={() =>
                        setTrainerIds(trainerIds.includes(t.id) ? trainerIds.filter((id) => id !== t.id) : [...trainerIds, t.id])
                      }
                    >
                      {t.name}
                      {!t.authUid ? " ·  sin acceso" : ""}
                    </Chip>
                  ))}
                </div>
              )}
              {trainerIds.some((id) => !trainers.find((t) => t.id === id)?.authUid) && (
                <p className="caption warning-text">
                  Un entrenador sin acceso no podrá recibir sus reservas hasta que lo actives en «Equipo».
                </p>
              )}
            </>
          )}

          <div className="row">
            <button className="btn btn-secondary" style={{ width: 56 }} aria-label="Atrás" onClick={() => setStep(0)}>
              <ChevronLeft size={18} />
            </button>
            <button className="btn btn-primary spacer" disabled={!step2Valid} onClick={() => setStep(2)}>
              Continuar
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="settings-card summary-list">
            <div>
              <span>Nombre</span>
              <span>{name.trim()}</span>
            </div>
            <div>
              <span>Email</span>
              <span>{email.trim().toLowerCase()}</span>
            </div>
            <div>
              <span>Tipo</span>
              <span>{isRoomUser ? "Usuario de sala" : "Cliente"}</span>
            </div>
            <div>
              <span>Bono</span>
              <span>
                {sessions} sesiones · {duration} min
              </span>
            </div>
            {!isRoomUser && (
              <div>
                <span>Entrenadores</span>
                <span>{trainers.filter((t) => trainerIds.includes(t.id)).map((t) => t.name).join(", ")}</span>
              </div>
            )}
          </div>

          {!isRoomUser && (
            <button type="button" className="btn-link" style={{ textAlign: "left", padding: 0, fontSize: 14 }} onClick={() => setShowMore(!showMore)}>
              {showMore ? "Ocultar opciones" : "Más opciones (menor de edad, seguimiento de ciclo)"}
            </button>
          )}
          {!isRoomUser && showMore && (
            <div className="form-section">
              <ToggleRow title="Es menor de edad" checked={isMinor} onChange={setIsMinor} />
              {isMinor && (
                <>
                  <input
                    className="input"
                    placeholder="Nombre del responsable legal"
                    aria-label="Responsable legal"
                    maxLength={LIMITS.name}
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                  />
                  <input
                    className="input"
                    type="email"
                    placeholder="Email del responsable"
                    aria-label="Email del responsable"
                    autoCapitalize="none"
                    maxLength={LIMITS.email}
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                  />
                </>
              )}
              <ToggleRow
                title="Es una clienta"
                checked={isFemale}
                onChange={(v) => {
                  setIsFemale(v);
                  if (!v) setCycleTracking(false);
                }}
              />
              {isFemale && (
                <ToggleRow
                  title="Activar seguimiento de ciclo"
                  subtitle="Ella decidirá aparte si comparte el resumen."
                  checked={cycleTracking}
                  onChange={setCycleTracking}
                />
              )}
            </div>
          )}

          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <p className="caption muted" style={{ lineHeight: 1.45 }}>
            Al crear la cuenta se envía un email para que elija su contraseña. No se gestionan pagos en la app.
          </p>
          <div className="row">
            <button className="btn btn-secondary" style={{ width: 56 }} aria-label="Atrás" onClick={() => setStep(1)}>
              <ChevronLeft size={18} />
            </button>
            <button className="btn btn-primary spacer" disabled={saving || !extrasValid} onClick={save}>
              {saving ? "Creando…" : isRoomUser ? "Crear usuario de sala" : "Crear y enviar acceso"}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function ManageClientSheet({ client, onClose }: { client: AppUser; onClose: () => void }) {
  const state = useAppState();
  const [sessions, setSessions] = useState(10);
  const [duration, setDuration] = useState(client.sessionDuration === 60 ? 60 : 45);
  const [name, setName] = useState("Nuevo bono");
  const [packError, setPackError] = useState<string | null>(null);
  const [savingPack, setSavingPack] = useState(false);
  const [trainerIds, setTrainerIds] = useState<string[]>(client.trainerStaffIds);
  const [trainerError, setTrainerError] = useState<string | null>(null);
  const [savingTrainers, setSavingTrainers] = useState(false);
  const trainers = state.staff.filter((s) => s.kind === "trainer");
  const trainersChanged =
    trainerIds.length !== client.trainerStaffIds.length || trainerIds.some((id) => !client.trainerStaffIds.includes(id));
  const hasBalance = client.remainingSessions + client.reservedSessions > 0;

  return (
    <Sheet title={client.name} onClose={onClose}>
      <div className="grid-2">
        <div className="card metric">
          <strong>{client.remainingSessions}</strong>
          <span className="caption muted">Disponibles</span>
        </div>
        <div className="card metric">
          <strong>{client.reservedSessions}</strong>
          <span className="caption muted">Reservadas</span>
        </div>
      </div>
      <p className="caption muted" style={{ marginTop: -8 }}>
        {client.packName} · {client.usedSessions} usadas de {client.packTotalSessions} · {client.sessionDuration} min
        {client.email ? ` · ${client.email}` : ""}
      </p>

      <p className="form-section-title">Añadir bono</p>
      <div className="form-section">
        <input
          className="input"
          placeholder="Nombre del bono"
          aria-label="Nombre del bono"
          maxLength={LIMITS.packName}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Stepper label={`${sessions} sesiones`} value={sessions} min={1} max={100} onChange={setSessions} />
        <div className="form-row">
          <span className="spacer">Duración</span>
          <div style={{ width: 200 }}>
            <Segmented
              label="Duración"
              value={duration}
              onChange={setDuration}
              options={[
                { value: 45, label: "45 min" },
                { value: 60, label: "60 min" },
              ]}
            />
          </div>
        </div>
      </div>
      {hasBalance && duration !== client.sessionDuration && (
        <p className="caption warning-text" style={{ marginTop: -8 }}>
          No se puede cambiar la duración mientras quede saldo del bono actual.
        </p>
      )}
      {packError && <div className="error-box">{packError}</div>}
      <button
        className="btn btn-primary"
        disabled={savingPack || (hasBalance && duration !== client.sessionDuration)}
        onClick={async () => {
          setSavingPack(true);
          setPackError(null);
          const result = await store.addPack(client.id, sessions, duration, name.trim() || "Bono");
          setSavingPack(false);
          if (result) setPackError(result);
        }}
      >
        {savingPack ? "Guardando…" : `Añadir ${sessions} sesiones`}
      </button>

      {client.role === "client" && (
        <>
          <p className="form-section-title">Entrenadores asignados</p>
          <div className="form-section">
            {trainers.map((trainer) => {
              const on = trainerIds.includes(trainer.id);
              return (
                <button
                  key={trainer.id}
                  type="button"
                  className="check-row"
                  aria-pressed={on}
                  onClick={() => setTrainerIds(on ? trainerIds.filter((id) => id !== trainer.id) : [...trainerIds, trainer.id])}
                >
                  <div className="spacer">
                    <div>{trainer.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {trainer.authUid ? "Acceso activo" : "Acceso pendiente: se vinculará al activarlo"}
                    </div>
                  </div>
                  {on ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>
              );
            })}
          </div>
          {trainerError && <div className="error-box">{trainerError}</div>}
          <button
            className="btn btn-secondary"
            disabled={!trainersChanged || savingTrainers || trainerIds.length === 0}
            onClick={async () => {
              setSavingTrainers(true);
              setTrainerError(null);
              const result = await store.updateClientTrainers(client.id, trainerIds);
              setSavingTrainers(false);
              if (result) setTrainerError(result);
            }}
          >
            {savingTrainers ? "Guardando…" : "Guardar entrenadores"}
          </button>
        </>
      )}
    </Sheet>
  );
}

function ActivateStaffSheet({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const [email, setEmail] = useState(member.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title={`Activar a ${member.name}`} onClose={onClose}>
      <p className="muted small" style={{ lineHeight: 1.45 }}>
        Se creará su cuenta de entrenador y recibirá un email para elegir su contraseña. Los clientes que ya lo tengan
        asignado quedarán vinculados automáticamente.
      </p>
      <div className="form-section">
        <input
          className="input"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          placeholder="Email del entrenador"
          aria-label="Email del entrenador"
          maxLength={LIMITS.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button
        className="btn btn-primary"
        disabled={saving || !email.includes("@")}
        onClick={async () => {
          setSaving(true);
          setError(null);
          const result = await store.activateStaff(member.id, email);
          setSaving(false);
          if (result) setError(result);
          else onClose();
        }}
      >
        {saving ? "Activando…" : "Activar y enviar email"}
      </button>
    </Sheet>
  );
}
