// Bienvenida del primer acceso: términos, objetivo semanal + clasificación y
// notificaciones. Deja la cuenta lista para reservar en menos de un minuto.
import { useState } from "react";
import { Bell, Check, ChevronLeft, ShieldAlert, Trophy } from "lucide-react";
import { asset } from "../lib/domain";
import { enablePush } from "../lib/notifications";
import { store } from "../lib/store";
import { ToggleRow, useAppState } from "../ui";

const TERMS = [
  "Las sesiones son personales y no pueden cederse sin autorización escrita de Activate.",
  "Avisando con más de 24 horas podrás reorganizar o cancelar la sesión sin perderla.",
  "Avisando con menos de 4 horas, la sesión se contabilizará como realizada.",
  "Las cuentas de menores requieren el consentimiento de padre, madre o tutor legal.",
  "El consentimiento para uso de imagen es independiente y se puede rechazar.",
];

export function OnboardingView() {
  const state = useAppState();
  const user = state.currentUser!;
  const isClient = user.role === "client";
  const totalSteps = isClient ? 3 : 2;
  const [step, setStep] = useState(0);
  const [acceptTerms, setAcceptTerms] = useState(user.termsAccepted);
  const [imageConsent, setImageConsent] = useState(user.imageConsent);
  const [goal, setGoal] = useState(user.weeklyGoal || 2);
  const [optIn, setOptIn] = useState(user.leaderboardOptIn);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = user.name.split(" ")[0];

  const finish = async () => {
    setSaving(true);
    setError(null);
    const result = await store.completeOnboarding({
      acceptTerms,
      imageConsent,
      weeklyGoal: goal,
      leaderboardOptIn: isClient && optIn,
    });
    setSaving(false);
    if (result) setError(result);
  };

  const notificationsStep = (
    <>
      <div className="stack" style={{ gap: 8 }}>
        <span className="settings-icon tile-blue" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <Bell size={22} />
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>No te pierdas nada</h1>
        <p className="muted" style={{ lineHeight: 1.5 }}>
          Te avisamos cuando tu entrenador confirme una sesión, te escriba o valore tu reto, y te recordamos cada
          sesión el día antes.
        </p>
      </div>
      {pushMessage ? (
        <div className="info-box">{pushMessage}</div>
      ) : (
        <button
          className="btn btn-secondary"
          onClick={async () => {
            const result = await enablePush(user.id);
            setPushMessage(result.message);
          }}
        >
          <Bell size={18} /> Activar notificaciones
        </button>
      )}
      <p className="caption muted">Puedes cambiarlo cuando quieras en Perfil → Notificaciones.</p>
    </>
  );

  return (
    <main className="onboarding">
      <div className="onboarding-inner">
        <div className="steps" aria-label={`Paso ${step + 1} de ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={i <= step ? "done" : ""} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className="stack" style={{ gap: 10 }}>
              <img src={asset("icon-192.png")} alt="" style={{ width: 56, height: 56, borderRadius: 14 }} />
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Bienvenido/a, {firstName}</h1>
              <p className="muted" style={{ lineHeight: 1.5 }}>
                {user.termsAccepted
                  ? "Ya aceptaste los términos del servicio. Repasa lo esencial y continúa."
                  : "Antes de reservar tu primera sesión, revisa y acepta lo esencial del servicio."}
              </p>
            </div>
            <div className="settings-card">
              {TERMS.map((t, i) => (
                <div key={i} className="settings-row" style={{ alignItems: "flex-start" }}>
                  <span className="terms-num" style={{ marginTop: 2 }}>
                    {i + 1}
                  </span>
                  <span className="settings-detail" style={{ fontSize: 14, color: "var(--text-2)" }}>
                    {t}
                  </span>
                </div>
              ))}
            </div>
            <div className="inline-icon caption" style={{ color: "var(--orange)" }}>
              <ShieldAlert size={14} /> Borrador operativo pendiente de revisión legal.
            </div>
            {!user.termsAccepted && (
              <div className="form-section">
                <ToggleRow title="He leído y acepto los términos" checked={acceptTerms} onChange={setAcceptTerms} />
                {isClient && (
                  <ToggleRow
                    title="Autorizo el uso de mi imagen"
                    subtitle="Opcional. No condiciona el servicio."
                    checked={imageConsent}
                    onChange={setImageConsent}
                  />
                )}
              </div>
            )}
            <button className="btn btn-primary" disabled={!acceptTerms} onClick={() => setStep(1)}>
              Continuar
            </button>
          </>
        )}

        {step === 1 && isClient && (
          <>
            <div className="stack" style={{ gap: 8 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800 }}>¿Cuántas clases a la semana?</h1>
              <p className="muted" style={{ lineHeight: 1.5 }}>
                Marca tu objetivo. Verás tu progreso en Inicio y sumarás rachas cada semana que lo cumplas.
              </p>
            </div>
            <div className="goal-grid">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={goal === n} onClick={() => setGoal(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="card row top">
              <span className="settings-icon tile-purple">
                <Trophy size={16} />
              </span>
              <div className="spacer">
                <strong style={{ display: "block" }}>Clasificación semanal</strong>
                <span className="caption muted" style={{ lineHeight: 1.4 }}>
                  Compite con el resto del centro sumando sesiones y retos. Sólo se ve tu nombre y la inicial del
                  apellido.
                </span>
              </div>
            </div>
            <div className="form-section">
              <ToggleRow title="Quiero aparecer en la clasificación" checked={optIn} onChange={setOptIn} />
            </div>
            <div className="row">
              <button className="btn btn-secondary" style={{ width: 56 }} aria-label="Atrás" onClick={() => setStep(0)}>
                <ChevronLeft size={18} />
              </button>
              <button className="btn btn-primary spacer" onClick={() => setStep(2)}>
                Continuar
              </button>
            </div>
          </>
        )}

        {step === totalSteps - 1 && step > 0 && (
          <>
            {notificationsStep}
            {error && <div className="error-box">{error}</div>}
            <div className="row">
              <button className="btn btn-secondary" style={{ width: 56 }} aria-label="Atrás" onClick={() => setStep(step - 1)}>
                <ChevronLeft size={18} />
              </button>
              <button className="btn btn-primary spacer" disabled={saving} onClick={finish}>
                <Check size={18} /> {saving ? "Guardando…" : "Empezar"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
