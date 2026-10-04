// Consejos para una vida más sana: biblioteca de Activate + los que publique
// el equipo. El equipo puede publicar y retirar sus consejos.
import { useMemo, useState } from "react";
import { Droplets, Brain, Footprints, Moon, Plus, Repeat, Salad, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { LIMITS, tipCategoryLabel, type Tip, type TipCategory } from "../lib/domain";
import { TIP_LIBRARY, tipOfTheDay } from "../lib/engagement";
import { store } from "../lib/store";
import { Chip, ScreenHeader, Sheet, useAppState, type IconTone } from "../ui";

const categoryIcon: Record<TipCategory, { icon: LucideIcon; tone: IconTone }> = {
  hidratacion: { icon: Droplets, tone: "blue" },
  sueno: { icon: Moon, tone: "purple" },
  nutricion: { icon: Salad, tone: "green" },
  movilidad: { icon: Footprints, tone: "orange" },
  mente: { icon: Brain, tone: "teal" },
  habitos: { icon: Repeat, tone: "red" },
};

const CATEGORIES = Object.keys(tipCategoryLabel) as TipCategory[];
const dateFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

export function TipsView() {
  const state = useAppState();
  const user = state.currentUser;
  const isStaff = user?.role === "boss" || user?.role === "trainer";
  const [category, setCategory] = useState<TipCategory | "all">("all");
  const [publishing, setPublishing] = useState(false);
  const today = tipOfTheDay(state.customTips);

  const tips = useMemo(
    () => [...state.customTips, ...TIP_LIBRARY].filter((t) => category === "all" || t.category === category),
    [state.customTips, category],
  );

  return (
    <div className="screen">
      <ScreenHeader eyebrow="Bienestar" title="Consejos" subtitle="Pequeños hábitos para una vida más sana" />

      <section className="hero-card stack" style={{ gap: 8 }}>
        <span className="eyebrow" style={{ color: "var(--text-2)" }}>
          Consejo del día · {tipCategoryLabel[today.category]}
        </span>
        <strong style={{ fontSize: 20 }}>{today.title}</strong>
        <p style={{ color: "var(--text-2)", lineHeight: 1.5 }}>{today.body}</p>
      </section>

      {isStaff && (
        <button className="btn btn-soft" onClick={() => setPublishing(true)}>
          <Plus size={18} /> Publicar un consejo para tus clientes
        </button>
      )}

      <div className="chips" style={{ padding: 0, margin: "0 -20px", paddingLeft: 20, paddingRight: 20 }}>
        <Chip selected={category === "all"} onClick={() => setCategory("all")}>
          Todos
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
            {tipCategoryLabel[c]}
          </Chip>
        ))}
      </div>

      {tips.map((tip) => (
        <TipCard key={tip.id} tip={tip} canDelete={Boolean(isStaff && tip.custom)} />
      ))}

      <p className="caption muted" style={{ lineHeight: 1.45 }}>
        Consejos generales de hábitos saludables. No sustituyen la valoración de un profesional sanitario.
      </p>

      {publishing && <PublishTipSheet onClose={() => setPublishing(false)} />}
    </div>
  );
}

function TipCard({ tip, canDelete }: { tip: Tip; canDelete: boolean }) {
  const { icon: Icon, tone } = categoryIcon[tip.category];
  return (
    <article className="card tip-card">
      <span className={`settings-icon tile-${tone}`}>
        <Icon size={16} />
      </span>
      <div className="spacer">
        <div className="row" style={{ gap: 8 }}>
          <strong className="spacer">{tip.title}</strong>
          {canDelete && (
            <button
              className="icon-btn"
              style={{ margin: 0, width: 32, height: 32, color: "var(--muted)" }}
              aria-label="Eliminar consejo"
              onClick={() => {
                if (window.confirm("¿Retirar este consejo?")) void store.deleteTip(tip.id);
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <p style={{ marginTop: 4 }}>{tip.body}</p>
        <span className="caption muted" style={{ display: "block", marginTop: 6 }}>
          {tipCategoryLabel[tip.category]}
          {tip.custom ? ` · ${tip.createdByName}${tip.createdAt ? `, ${dateFormatter.format(tip.createdAt)}` : ""}` : ""}
        </span>
      </div>
    </article>
  );
}

function PublishTipSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TipCategory>("habitos");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title="Nuevo consejo" onClose={onClose}>
      <div className="chip-row">
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
            {tipCategoryLabel[c]}
          </Chip>
        ))}
      </div>
      <div className="form-section">
        <input
          className="input"
          placeholder="Título"
          aria-label="Título"
          maxLength={LIMITS.tipTitle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="textarea"
          style={{ borderRadius: 0, background: "transparent", minHeight: 120 }}
          placeholder="Escribe el consejo de forma breve y práctica"
          aria-label="Consejo"
          maxLength={LIMITS.tipBody}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <p className="caption muted">Lo verán todos los clientes en Consejos y, hoy, como consejo del día.</p>
      {error && <div className="error-box">{error}</div>}
      <button
        className="btn btn-primary"
        disabled={saving || !title.trim() || !body.trim()}
        onClick={async () => {
          setSaving(true);
          const result = await store.publishTip({ title, body, category });
          setSaving(false);
          if (result) setError(result);
          else onClose();
        }}
      >
        <Sparkles size={18} /> {saving ? "Publicando…" : "Publicar"}
      </button>
    </Sheet>
  );
}
