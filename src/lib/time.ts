import type { TimeString } from "../types/models";

/** ID corto, suficiente para datos locales de un solo usuario. */
export function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** "08:30" → 510 (minutos desde las 00:00) */
export function toMinutes(t: TimeString): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** 510 → "08:30" */
export function toTime(min: number): TimeString {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Duración en minutos entre start y end.
 * Si end <= start, se asume que el bloque cruza la medianoche.
 */
export function durationMin(start: TimeString, end: TimeString): number {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return e > s ? e - s : 1440 - s + e;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
