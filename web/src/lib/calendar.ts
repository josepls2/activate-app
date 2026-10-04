// Sustituye a DeviceCalendarService.swift (EventKit): genera un archivo .ics
// que iPhone, Android y escritorio abren con «Añadir al calendario».
import { keyToDate, parseMinutes, type GymSession } from "./domain";

function stamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function downloadSessionEvent(session: GymSession): string {
  const start = keyToDate(session.date);
  const minutes = parseMinutes(session.time);
  if (minutes === null) return "No se ha podido interpretar la fecha de la sesión.";
  start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const end = new Date(start.getTime() + session.duration * 60_000);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Activate Personal Training//Web//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${session.id}@activate-personal-training`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(session.type)}`,
    `LOCATION:${escape(`Activate Personal Training · ${session.room}`)}`,
    `DESCRIPTION:${escape(`Entrenador: ${session.trainerName}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `activate-${session.date}-${session.time.replace(":", "")}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "Evento de calendario descargado";
}
