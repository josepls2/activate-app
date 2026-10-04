// Port de ios/CodexGym/Views/CycleView.swift.
import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cycleFlowLabel, cycleFlows, todayKey, type CycleEntry } from "../lib/domain";
import { store } from "../lib/store";
import { MonthCalendar, ScreenHeader, SectionTitle, Toggle, useAppState } from "../ui";

const SYMPTOMS = ["Dolor", "Fatiga", "Hinchazón", "Dolor de cabeza", "Buen ánimo"];
const MOODS = ["😔", "😐", "🙂", "😊", "⚡️"];

export function CycleView() {
  const state = useAppState();
  const [date, setDate] = useState(todayKey());
  const [entry, setEntry] = useState<CycleEntry>(() => store.cycleEntry(todayKey()));

  useEffect(() => setEntry(store.cycleEntry(date)), [date, state.cycleEntries]);

  const toggleSymptom = (symptom: string) =>
    setEntry((e) => ({
      ...e,
      symptoms: e.symptoms.includes(symptom) ? e.symptoms.filter((s) => s !== symptom) : [...e.symptoms, symptom],
    }));

  return (
    <div className="screen">
      <ScreenHeader eyebrow="Bienestar" title="Mi ciclo" subtitle="Registro privado y bajo tu control" />

      <div className="card">
        <MonthCalendar value={date} onChange={setDate} />
      </div>

      <div className="card stack" style={{ gap: 13 }}>
        <SectionTitle title="Flujo" />
        <div className="option-row">
          {cycleFlows.map((flow) => (
            <button
              key={flow}
              className={`option${entry.flow === flow ? " on" : ""}`}
              aria-pressed={entry.flow === flow}
              onClick={() => setEntry({ ...entry, flow })}
            >
              {cycleFlowLabel[flow]}
            </button>
          ))}
        </div>
      </div>

      <div className="card stack" style={{ gap: 13 }}>
        <SectionTitle title="¿Cómo te sientes?" />
        <div className="symptom-grid">
          {SYMPTOMS.map((symptom) => {
            const on = entry.symptoms.includes(symptom);
            return (
              <button key={symptom} className={`symptom${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleSymptom(symptom)}>
                {on ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                {symptom}
              </button>
            );
          })}
        </div>
        <div className="option-row">
          {MOODS.map((mood) => (
            <button
              key={mood}
              className={`mood${entry.mood === mood ? " on" : ""}`}
              aria-pressed={entry.mood === mood}
              onClick={() => setEntry({ ...entry, mood })}
            >
              {mood}
            </button>
          ))}
        </div>
        <textarea
          className="textarea"
          placeholder="Notas privadas"
          aria-label="Notas privadas"
          maxLength={2000}
          value={entry.notes}
          onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
        />
      </div>

      <div className="card row">
        <div className="spacer">
          <div className="bold small">Compartir resumen con mis entrenadores</div>
          <div className="caption muted" style={{ marginTop: 3 }}>
            Nunca se comparten notas privadas.
          </div>
        </div>
        <Toggle
          label="Compartir resumen con mis entrenadores"
          checked={Boolean(state.currentUser?.cycleSharingEnabled)}
          onChange={(v) => void store.setCycleSharingEnabled(v)}
        />
      </div>

      <button className="btn btn-primary" onClick={() => void store.saveCycleEntry(entry, date)}>
        Guardar registro
      </button>
    </div>
  );
}
