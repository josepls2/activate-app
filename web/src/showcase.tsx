// Demo de presentación para enseñar la app sin Firebase ni cuentas reales.
// Sólo se compila con `npm run build:demo` (VITE_SHOWCASE=1).
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Dumbbell, Repeat2, Sparkles, UserCog, UserRound, Warehouse, type LucideIcon } from "lucide-react";
import { App } from "./App";
import { setAssetOverrides } from "./lib/domain";
import { loadDemo } from "./lib/demo";
import logo from "../public/activate-logo.png?inline";
import icon from "../public/icon-192.png?inline";
import "./styles.css";

type DemoRole = "client" | "new" | "trainer" | "boss" | "reserve";

const ROLES: { id: DemoRole; title: string; text: string; icon: LucideIcon }[] = [
  { id: "client", title: "Cliente", text: "Inicio con objetivo semanal, reservas, retos, clasificación y consejos.", icon: UserRound },
  { id: "new", title: "Cliente nuevo", text: "La bienvenida del primer acceso: términos, objetivo y avisos.", icon: Sparkles },
  { id: "trainer", title: "Entrenador", text: "Agenda de hoy, solicitudes, fichas de clientes, retos y feedback.", icon: Dumbbell },
  { id: "boss", title: "Dirección", text: "Todo lo del entrenador, más altas guiadas, bonos y equipo.", icon: UserCog },
  { id: "reserve", title: "Usuario de sala", text: "Ocupación de las salas y solicitudes con su bono.", icon: Warehouse },
];

function Showcase() {
  const [role, setRole] = useState<DemoRole | null>(null);
  const [run, setRun] = useState(0);

  const choose = (next: DemoRole) => {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    loadDemo(next);
    setRole(next);
    setRun((n) => n + 1);
    window.scrollTo({ top: 0 });
  };

  if (!role) {
    return (
      <main className="showcase">
        <div className="showcase-inner">
          <img className="showcase-logo" src={logo} alt="Activate Personal Training" />
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow">Demo interactiva</span>
            <h1>Elige con qué perfil quieres ver la app</h1>
            <p className="muted">
              Los datos son de ejemplo y nada se guarda: puedes reservar, cancelar, crear retos o dar altas sin miedo.
            </p>
          </div>
          <div className="showcase-roles">
            {ROLES.map(({ id, title, text, icon: Icon }) => (
              <button key={id} className="showcase-role" onClick={() => choose(id)}>
                <span className="settings-icon tile-red">
                  <Icon size={17} />
                </span>
                <span className="spacer">
                  <strong>{title}</strong>
                  <span className="caption muted">{text}</span>
                </span>
                <ArrowRight size={18} className="muted" />
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <App key={run} />
      <button className="showcase-switch" onClick={() => setRole(null)}>
        <Repeat2 size={15} /> {ROLES.find((r) => r.id === role)?.title} · Cambiar
      </button>
    </>
  );
}

export function startShowcase() {
  setAssetOverrides({
    "activate-logo.png": logo,
    "icon-192.png": icon,
    "apple-touch-icon.png": icon,
    "icon-512.png": icon,
  });
  // El visor de enlaces no muestra cuadros de confirmación: en la demo se aceptan.
  window.confirm = () => true;
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Showcase />
    </StrictMode>,
  );
}
