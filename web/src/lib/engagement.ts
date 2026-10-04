// Lógica de motivación: objetivo semanal, rachas, insignias y consejos.
// Funciones puras (sin Firebase) para poder probarlas y reutilizarlas.
import {
  addDays,
  currentWeek,
  todayKey,
  weekStart,
  type AppUser,
  type ChallengeProgress,
  type GymSession,
  type Tip,
  type TipCategory,
} from "./domain";

/** Sesiones a las que el cliente asistió de verdad. */
export function attended(sessions: GymSession[], uid: string) {
  return sessions.filter((s) => s.clientId === uid && s.status === "completed" && !s.noShow);
}

export function sessionsInWeek(sessions: GymSession[], uid: string, week: string) {
  return attended(sessions, uid).filter((s) => weekStart(s.date) === week).length;
}

/** Sesiones confirmadas que quedan esta semana (desde hoy). */
export function upcomingThisWeek(sessions: GymSession[], uid: string, week = currentWeek()) {
  const today = todayKey();
  return sessions.filter(
    (s) => s.clientId === uid && s.status === "confirmed" && s.date >= today && weekStart(s.date) === week,
  ).length;
}

/** Semanas seguidas cumpliendo el objetivo (la semana en curso cuenta si ya se cumplió). */
export function weeklyStreak(sessions: GymSession[], uid: string, goal: number, week = currentWeek()) {
  const counts = new Map<string, number>();
  for (const s of attended(sessions, uid)) {
    const key = weekStart(s.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let cursor = (counts.get(week) ?? 0) >= goal ? week : addDays(week, -7);
  let streak = 0;
  while ((counts.get(cursor) ?? 0) >= goal) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

/** Asistencia de las últimas N semanas (de la más antigua a la actual). */
export function attendanceHistory(sessions: GymSession[], uid: string, weeks = 8, week = currentWeek()) {
  return Array.from({ length: weeks }, (_, index) => {
    const key = addDays(week, -7 * (weeks - 1 - index));
    return { week: key, count: sessionsInWeek(sessions, uid, key) };
  });
}

export function nextSession(sessions: GymSession[], uid: string) {
  const today = todayKey();
  return (
    sessions
      .filter((s) => s.clientId === uid && s.status === "confirmed" && s.date >= today)
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))[0] ?? null
  );
}

export function lastAttendance(sessions: GymSession[], uid: string) {
  const list = attended(sessions, uid).sort((a, b) => b.date.localeCompare(a.date));
  return list[0]?.date ?? null;
}

export type Badge = { id: string; label: string; detail: string; earned: boolean; emoji: string };

export function badges(
  sessions: GymSession[],
  uid: string,
  goal: number,
  progress: ChallengeProgress[],
): Badge[] {
  const total = attended(sessions, uid).length;
  const streak = weeklyStreak(sessions, uid, goal);
  const approved = progress.filter((p) => p.uid === uid && p.approved).length;
  const perfectWeek = attendanceHistory(sessions, uid, 12).some((w) => w.count >= goal);
  return [
    { id: "first", emoji: "🎯", label: "Primer entreno", detail: "Completa tu primera sesión", earned: total >= 1 },
    { id: "five", emoji: "🔥", label: "5 sesiones", detail: "Completa 5 sesiones", earned: total >= 5 },
    { id: "ten", emoji: "💪", label: "10 sesiones", detail: "Completa 10 sesiones", earned: total >= 10 },
    { id: "goal", emoji: "✅", label: "Semana cumplida", detail: "Cumple tu objetivo semanal", earned: perfectWeek },
    { id: "streak2", emoji: "📈", label: "Racha de 2", detail: "2 semanas seguidas cumpliendo", earned: streak >= 2 },
    { id: "streak4", emoji: "🏅", label: "Racha de 4", detail: "4 semanas seguidas cumpliendo", earned: streak >= 4 },
    { id: "challenge", emoji: "🏆", label: "Reto superado", detail: "Tu entrenador aprueba un reto", earned: approved >= 1 },
    { id: "twentyfive", emoji: "⭐", label: "25 sesiones", detail: "Completa 25 sesiones", earned: total >= 25 },
  ];
}

/** Clientes sin sesiones (hechas ni previstas) en los últimos `days` días. */
export function inactiveClients(clients: AppUser[], sessions: GymSession[], days = 14) {
  const since = addDays(todayKey(), -days);
  const active = new Set(
    sessions
      .filter((s) => (s.status === "completed" || s.status === "confirmed") && s.date >= since)
      .map((s) => s.clientId),
  );
  return clients.filter((c) => c.role === "client" && c.status === "active" && !active.has(c.id));
}

// ---------- Consejos ----------
// Orientación general de hábitos saludables; no sustituye consejo médico.

const LIBRARY: Array<[TipCategory, string, string]> = [
  ["hidratacion", "Empieza el día con agua", "Un vaso de agua al levantarte ayuda a reponer líquidos después de la noche. Déjalo preparado junto a la cama."],
  ["hidratacion", "Lleva tu botella", "Tener la botella a la vista es la forma más fácil de beber sin pensarlo. Rellénala dos o tres veces al día."],
  ["hidratacion", "Bebe durante el entreno", "Da pequeños sorbos entre series en lugar de beber mucho de golpe al terminar."],
  ["hidratacion", "Fíjate en el color", "Una orina de color amarillo claro suele indicar buena hidratación. Si es oscura, bebe un poco más."],
  ["sueno", "Horario fijo de sueño", "Acostarte y levantarte a la misma hora, también el fin de semana, mejora la calidad del descanso."],
  ["sueno", "Pantallas fuera 30 minutos antes", "Deja el móvil lejos de la cama. Leer o estirar suavemente prepara mejor al cuerpo para dormir."],
  ["sueno", "Dormitorio fresco y oscuro", "Una habitación entre 18 y 20 °C, oscura y silenciosa favorece un sueño profundo y la recuperación muscular."],
  ["sueno", "Cuidado con la cafeína tarde", "Evita café y bebidas energéticas a partir de media tarde si te cuesta conciliar el sueño."],
  ["nutricion", "Proteína en cada comida", "Incluye una fuente de proteína (huevo, legumbre, pescado, yogur, carne) en cada comida para recuperarte mejor del entreno."],
  ["nutricion", "Medio plato de verdura", "Llena la mitad del plato con verduras y hortalizas: más fibra, vitaminas y saciedad con pocas calorías."],
  ["nutricion", "Prepara tus comidas", "Dedicar una hora el domingo a cocinar bases (legumbres, arroz, verduras asadas) evita improvisar durante la semana."],
  ["nutricion", "Fruta como tentempié", "Una pieza de fruta y un puñado de frutos secos es un tentempié práctico antes o después de entrenar."],
  ["nutricion", "Lee las etiquetas", "Si el azúcar aparece entre los primeros ingredientes, probablemente haya una opción mejor."],
  ["nutricion", "Come sin prisas", "Comer despacio y sin pantallas ayuda a notar la saciedad y a disfrutar más de la comida."],
  ["movilidad", "Muévete cada hora", "Si trabajas sentado, levántate cada hora: camina un par de minutos o haz unas sentadillas."],
  ["movilidad", "Calienta siempre", "5–10 minutos de calentamiento progresivo preparan articulaciones y músculos y reducen el riesgo de lesión."],
  ["movilidad", "Estira al final del día", "Diez minutos de estiramientos suaves por la noche ayudan a soltar tensión de cadera, espalda y hombros."],
  ["movilidad", "Sube por las escaleras", "Cambiar el ascensor por las escaleras suma actividad diaria sin necesidad de sacar tiempo extra."],
  ["movilidad", "Objetivo de pasos", "Intenta acercarte a 7.000–10.000 pasos diarios. Una llamada de teléfono caminando ya cuenta."],
  ["mente", "Respira antes de empezar", "Tres respiraciones lentas y profundas antes del entreno ayudan a concentrarte y a reducir el estrés."],
  ["mente", "Celebra lo conseguido", "Apunta cada semana un logro, por pequeño que sea. Ver el progreso es lo que mantiene la motivación."],
  ["mente", "Desconecta un rato al día", "Diez minutos sin móvil (pasear, leer, meditar) ayudan a bajar el nivel de estrés acumulado."],
  ["mente", "Compara contigo, no con otros", "Tu referencia eres tú hace un mes. Cada persona tiene su ritmo y su punto de partida."],
  ["habitos", "Reserva tus sesiones", "Las sesiones que ya tienen día y hora en la agenda se cumplen mucho más. Pide la semana que viene hoy."],
  ["habitos", "Prepara la bolsa la noche antes", "Dejar la ropa de entreno lista elimina excusas y te ahorra tiempo por la mañana."],
  ["habitos", "Pequeños cambios, grandes resultados", "Mejor un hábito pequeño mantenido durante meses que un gran cambio que dura una semana."],
  ["habitos", "Escucha a tu cuerpo", "Un dolor agudo o persistente no es normal: coméntalo con tu entrenador antes de seguir."],
  ["habitos", "Descanso activo", "Los días sin entreno, un paseo o una sesión suave de movilidad ayudan a recuperarte mejor que quedarte quieto."],
];

export const TIP_LIBRARY: Tip[] = LIBRARY.map(([category, title, body], index) => ({
  id: `lib-${index}`,
  title,
  body,
  category,
  createdByName: "Activate",
  createdAt: null,
  custom: false,
}));

function dayOfYear(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
}

/** Consejo del día: el último publicado por el equipo hoy, o uno de la biblioteca. */
export function tipOfTheDay(custom: Tip[], key = todayKey()): Tip {
  const fresh = custom.find((t) => t.createdAt && t.createdAt.toISOString().slice(0, 10) === key);
  if (fresh) return fresh;
  return TIP_LIBRARY[dayOfYear(key) % TIP_LIBRARY.length];
}
