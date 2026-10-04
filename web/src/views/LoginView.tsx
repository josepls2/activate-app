// Port de ios/CodexGym/Views/LoginView.swift.
// Face ID no existe en web: Firebase mantiene la sesión abierta en este
// dispositivo hasta que se pulsa «Cerrar sesión».
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Lock, Mail, Share, ShieldCheck } from "lucide-react";
import { asset } from "../lib/domain";
import { store } from "../lib/store";
import { Toggle, useAppState } from "../ui";

function isIosSafariBrowser() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function LoginView() {
  const state = useAppState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [remember, setRemember] = useState(true);
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  useEffect(() => setShowInstall(isIosSafariBrowser()), []);

  const message = error ?? state.loginError;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResetInfo(null);
    setError(await store.signIn(email, password, remember));
    setBusy(false);
  }

  async function forgot() {
    setError(null);
    setResetInfo(null);
    const result = await store.resetPassword(email);
    if (result.ok) setResetInfo(result.message);
    else setError(result.message);
  }

  return (
    <main className="login">
      <div className="login-inner">
        <div>
          <div className="login-logo">
            <img src={asset("activate-logo.png")} alt="Activate Personal Training" />
          </div>
          <h1>Activate Personal Training</h1>
          <p className="lead">Accede con tu cuenta. Los permisos se asignan automáticamente.</p>
        </div>

        <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
          <label className="field">
            <Mail size={20} />
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="Email"
              aria-label="Email"
              maxLength={120}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <Lock size={20} />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              aria-label="Contraseña"
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {message && (
            <div className="error-box" role="alert">
              <AlertTriangle size={16} style={{ flex: "none" }} />
              {message}
            </div>
          )}

          {state.authStatus === "unconfigured" && (
            <div className="error-box" role="alert">
              <AlertTriangle size={16} style={{ flex: "none" }} />
              Falta la configuración de Firebase (.env.local).
            </div>
          )}

          {resetInfo && (
            <div className="info-box" role="status">
              <CheckCircle2 size={16} style={{ flex: "none" }} />
              {resetInfo}
            </div>
          )}

          <div className="row" style={{ padding: "2px 4px" }}>
            <span className="spacer small" style={{ color: "var(--text-2)" }}>
              Mantener la sesión en este dispositivo
            </span>
            <Toggle checked={remember} onChange={setRemember} label="Mantener la sesión en este dispositivo" />
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy || state.authStatus === "unconfigured"}>
            {busy ? "Accediendo…" : "Entrar"}
          </button>
          <button type="button" className="btn-link" style={{ fontSize: 14 }} onClick={forgot}>
            ¿Has olvidado tu contraseña?
          </button>
        </form>

        {showInstall && (
          <div className="install-hint">
            <Share size={18} />
            <span>
              Para usarla como app en el iPhone: pulsa <strong>Compartir</strong> y luego{" "}
              <strong>Añadir a pantalla de inicio</strong>.
            </span>
          </div>
        )}

        <p className="footnote">
          <ShieldCheck size={14} /> Acceso seguro conectado con Activate
        </p>
      </div>
    </main>
  );
}
