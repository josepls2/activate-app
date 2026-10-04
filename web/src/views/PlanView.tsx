// Port de ios/CodexGym/Views/PlanView.swift.
import { AlertCircle, Calendar, CheckCircle2, CreditCard } from "lucide-react";
import { packProgress, roleLabel } from "../lib/domain";
import { InfoRow, ScreenHeader, useAppState } from "../ui";

export function PlanView() {
  const state = useAppState();
  const role = state.currentUser?.role;
  const pack = state.activePack;
  const isCustomer = role === "client" || role === "reserve";

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={role ? roleLabel[role] : ""}
        title="Pack de sesiones"
        subtitle="Consulta de consumo · pagos fuera de la app"
      />

      {isCustomer ? (
        <>
          <div className="card stack" style={{ gap: 18 }}>
            <div className="row top">
              <div className="spacer">
                <h2 style={{ fontSize: 22, fontWeight: 800 }}>{pack.name}</h2>
                <p className="muted small" style={{ marginTop: 5 }}>
                  {role === "reserve" ? `${pack.duration} minutos de sala` : `${pack.duration} minutos por entrenamiento`}
                </p>
              </div>
              <span style={{ fontSize: 44, fontWeight: 900, color: "var(--red-light)", lineHeight: 1 }}>
                {pack.remainingSessions}
              </span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={pack.totalSessions}
              aria-valuenow={pack.usedSessions}
            >
              <div style={{ width: `${Math.round(packProgress(pack) * 100)}%` }} />
            </div>
            <div className="row caption muted">
              <span className="inline-icon spacer">
                <CheckCircle2 size={13} /> {pack.usedSessions} utilizadas
                {pack.reservedSessions ? ` · ${pack.reservedSessions} reservadas` : ""}
              </span>
              <span>{pack.totalSessions} en total</span>
            </div>
          </div>

          <InfoRow
            icon={Calendar}
            label="Próxima sesión del pack"
            value={
              pack.totalSessions
                ? `Sesión ${Math.min(pack.usedSessions + pack.reservedSessions + 1, pack.totalSessions)} de ${pack.totalSessions}`
                : "Sin bono activo"
            }
          />
          <InfoRow icon={CreditCard} label="Pagos" value="No disponibles en la app durante el piloto" />

          <div className="card stack">
            <h3 style={{ fontSize: 17 }}>Packs definitivos pendientes</h3>
            <p className="small" style={{ color: "var(--text-2)", lineHeight: 1.45 }}>
              La duración admitida es de 45 o 60 minutos. Activate debe confirmar todavía los nombres, número de
              sesiones, vigencia y precios de cada pack.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="grid-2">
            <div className="card metric left">
              <strong>1</strong>
              <span className="caption muted">Centro piloto</span>
            </div>
            <div className="card metric left">
              <strong>45/60</strong>
              <span className="caption muted">Minutos</span>
            </div>
          </div>
          <div className="card stack small" style={{ color: "var(--text-2)" }}>
            <h3 style={{ fontSize: 17, color: "var(--text)" }}>Configuración del piloto</h3>
            <span className="inline-icon">
              <CheckCircle2 size={15} /> Consumo de sesiones visible al cliente
            </span>
            <span className="inline-icon">
              <CreditCard size={15} /> Compra y cobro fuera de la aplicación
            </span>
            <span className="inline-icon">
              <AlertCircle size={15} /> Catálogo y precios por confirmar
            </span>
          </div>
        </>
      )}
    </div>
  );
}
