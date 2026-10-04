// Port de ios/CodexGym/Views/NutritionView.swift, ahora con datos reales:
// el entrenador asignado publica el plan (nutritionPlans/{clientId}) y el
// cliente lo ve aquí en vivo.
import { useEffect, useState } from "react";
import { Leaf, Plus, Target, Trash2 } from "lucide-react";
import { LIMITS, roleLabel, type AppUser, type NutritionMeal } from "../lib/domain";
import { store } from "../lib/store";
import { ScreenHeader, Sheet, useAppState } from "../ui";

const updatedFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" });

export function NutritionView() {
  const state = useAppState();
  const plan = state.nutritionPlan;

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={state.currentUser ? roleLabel[state.currentUser.role] : ""}
        title="Nutrición"
        subtitle="Plan publicado por tu profesional"
      />

      {!plan ? (
        <div className="card empty" style={{ minHeight: 320, justifyContent: "center" }}>
          <Leaf size={40} />
          <strong style={{ fontSize: 22 }}>Sin plan publicado</strong>
          <p style={{ fontSize: 15, maxWidth: 320 }}>
            Cuando tu entrenador publique tu plan nutricional aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
          <div className="card stack" style={{ gap: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>{plan.title}</h2>
            {plan.goal && (
              <span className="inline-icon small" style={{ color: "var(--text-2)" }}>
                <Target size={15} color="var(--red-light)" /> {plan.goal}
              </span>
            )}
            <span className="caption muted">
              {plan.updatedByName ? `Publicado por ${plan.updatedByName}` : "Publicado por tu entrenador"}
              {plan.updatedAt ? ` · ${updatedFormatter.format(plan.updatedAt)}` : ""}
            </span>
          </div>

          {plan.meals.length > 0 && (
            <div className="form-section">
              {plan.meals.map((meal, index) => (
                <div key={index} className="meal">
                  <strong>{meal.name || `Comida ${index + 1}`}</strong>
                  {meal.description && <p>{meal.description}</p>}
                </div>
              ))}
            </div>
          )}

          {plan.notes && (
            <div className="card stack">
              <span className="label">Indicaciones</span>
              <p className="small" style={{ color: "var(--text-2)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {plan.notes}
              </p>
            </div>
          )}

          <p className="caption muted">
            Orientación general de tu entrenador. Ante cualquier condición médica, consulta con un profesional sanitario.
          </p>
        </>
      )}
    </div>
  );
}

const emptyMeals = (): NutritionMeal[] => [
  { name: "Desayuno", description: "" },
  { name: "Comida", description: "" },
  { name: "Cena", description: "" },
];

/** Editor para entrenadores asignados y Dirección. */
export function NutritionEditor({ client, onClose }: { client: AppUser; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Plan nutricional");
  const [goal, setGoal] = useState("");
  const [meals, setMeals] = useState<NutritionMeal[]>(emptyMeals);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    store
      .loadNutritionPlan(client.id)
      .then((plan) => {
        if (cancelled || !plan) return;
        setTitle(plan.title);
        setGoal(plan.goal);
        setMeals(plan.meals.length ? plan.meals : emptyMeals());
        setNotes(plan.notes);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const updateMeal = (index: number, patch: Partial<NutritionMeal>) =>
    setMeals((list) => list.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  return (
    <Sheet title="Plan nutricional" onClose={onClose}>
      <p className="muted small">
        Para <strong style={{ color: "var(--text)" }}>{client.name}</strong>. Lo verá en su pestaña Nutrición en
        cuanto lo publiques.
      </p>

      {loading ? (
        <div className="loader" style={{ alignSelf: "center" }} />
      ) : (
        <>
          <div className="form-section">
            <input
              className="input"
              placeholder="Título del plan"
              aria-label="Título del plan"
              maxLength={LIMITS.planTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="input"
              placeholder="Objetivo (opcional)"
              aria-label="Objetivo"
              maxLength={LIMITS.planGoal}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <p className="form-section-title">Comidas</p>
          <div className="form-section">
            {meals.map((meal, index) => (
              <div key={index} className="meal-editor">
                <input
                  className="input"
                  placeholder="Nombre"
                  aria-label={`Nombre de la comida ${index + 1}`}
                  maxLength={LIMITS.mealName}
                  value={meal.name}
                  onChange={(e) => updateMeal(index, { name: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn"
                  style={{ margin: 0, color: "var(--muted)" }}
                  aria-label={`Quitar ${meal.name || "comida"}`}
                  onClick={() => setMeals((list) => list.filter((_, i) => i !== index))}
                >
                  <Trash2 size={18} />
                </button>
                <textarea
                  className="textarea"
                  placeholder="Qué comer, cantidades, alternativas…"
                  aria-label={`Descripción de ${meal.name || "la comida"}`}
                  maxLength={LIMITS.mealDescription}
                  value={meal.description}
                  onChange={(e) => updateMeal(index, { description: e.target.value })}
                />
              </div>
            ))}
            {meals.length < LIMITS.meals && (
              <button
                type="button"
                className="check-row"
                style={{ color: "var(--red-light)", fontWeight: 700 }}
                onClick={() => setMeals((list) => [...list, { name: "", description: "" }])}
              >
                <Plus size={18} /> Añadir comida
              </button>
            )}
          </div>

          <div className="form-group">
            <span className="label">Indicaciones generales</span>
            <textarea
              className="textarea"
              placeholder="Hidratación, suplementos, horarios…"
              maxLength={LIMITS.planNotes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button
            className="btn btn-primary"
            disabled={saving || !title.trim()}
            onClick={async () => {
              setSaving(true);
              const result = await store.saveNutritionPlan(client.id, { title, goal, meals, notes });
              setSaving(false);
              if (result) setError(result);
              else onClose();
            }}
          >
            {saving ? "Publicando…" : "Publicar plan"}
          </button>
        </>
      )}
    </Sheet>
  );
}
