import {
  startOfWeek, addDays, isBefore, startOfDay, differenceInCalendarDays, parseISO,
} from "date-fns";
import type {
  FixedActivity,
  FlexibleActivity,
  Subject,
  DayOfWeek,
  TimeString,
} from "../../types/models";
import { WEEK_ORDER, ROUTINE_COLOR } from "../../types/models";
import { toMinutes, toTime, uid } from "../../lib/time";

/**
 * Scheduler: reparte esenciales variables y horas de estudio en los huecos
 * libres de la semana, priorizando por urgencia (días restantes) y
 * complejidad. Todo acá es puro (sin acceso a fecha real salvo por param
 * `now`) para poder testear con fechas fijas.
 */

export type BlockKind = "fixed" | "flexible" | "study";

export interface ScheduledBlock {
  id: string;
  day: DayOfWeek;
  start: TimeString;
  end: TimeString;
  kind: BlockKind;
  label: string;
  color: string;
}

interface Interval {
  startMin: number;
  endMin: number;
}

/**
 * Lo que el scheduler no pudo acomodar como se pidió. Se muestra en el
 * calendario: nada se descarta en silencio.
 */
export type ScheduleWarning =
  /** Una ocurrencia de la rutina no entró en ningún hueco esos días. */
  | { kind: "routine-unplaced"; label: string; days: DayOfWeek[] }
  /** Entró, pero fuera de su franja preferida (en el hueco más cercano). */
  | { kind: "routine-moved"; label: string; days: DayOfWeek[] }
  /** El examen/entrega es esta semana y no alcanzó el tiempo para todo el estudio. */
  | { kind: "study-short"; label: string; missingMin: number; dueDate: string };

/** Heurísticas del scheduler — ajustables sin tocar el algoritmo. */
export const STUDY_MIN_PER_COMPLEXITY = 120; // minutos de estudio por punto de complejidad de un examen
const MAX_SESSION_MIN = 90; // sesión de estudio más larga que arma por día para un mismo ítem
const MIN_SESSION_MIN = 20; // hueco más chico que vale la pena usar
const FALLBACK_TASK_DAYS_LEFT = 21; // "días restantes" asumidos para un TP sin fecha de entrega
/**
 * El scheduler no ubica rutina ni estudio antes de esta hora salvo que ya
 * esté ocupada por una actividad fija — sin esto, un día sin nada cargado
 * deja el hueco más grande arrancando a las 00:00 y el estudio termina de
 * madrugada. Coincide con la hora en que arranca la grilla del calendario.
 */
export const AWAKE_START_MIN = 360; // 06:00

function urgency(daysLeft: number): number {
  // Cuanto más cerca la fecha, más urgente. Clamp para no dividir por 0/negativos.
  return 1 / Math.max(daysLeft, 0.5);
}

function priorityScore(severity: number, daysLeft: number): number {
  return severity * urgency(daysLeft);
}

/** Convierte una franja que puede cruzar la medianoche en 1 o 2 segmentos dentro de un mismo día. */
function slotToSegments(
  day: DayOfWeek,
  start: TimeString,
  end: TimeString,
): Array<{ day: DayOfWeek; startMin: number; endMin: number }> {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (e > s) return [{ day, startMin: s, endMin: e }];
  const nextDay = WEEK_ORDER[(WEEK_ORDER.indexOf(day) + 1) % 7];
  return [
    { day, startMin: s, endMin: 1440 },
    { day: nextDay, startMin: 0, endMin: e },
  ];
}

function subtractBusy(free: Interval[], busy: Interval): Interval[] {
  const result: Interval[] = [];
  for (const f of free) {
    if (busy.endMin <= f.startMin || busy.startMin >= f.endMin) {
      result.push(f); // no se solapan
      continue;
    }
    if (busy.startMin > f.startMin) {
      result.push({ startMin: f.startMin, endMin: busy.startMin });
    }
    if (busy.endMin < f.endMin) {
      result.push({ startMin: busy.endMin, endMin: f.endMin });
    }
  }
  return result;
}

type FreeByDay = Record<DayOfWeek, Interval[]>;

function initFreeByDay(): FreeByDay {
  const free = {} as FreeByDay;
  for (const d of WEEK_ORDER) free[d] = [{ startMin: AWAKE_START_MIN, endMin: 1440 }];
  return free;
}

function applyFixedActivities(free: FreeByDay, fixed: FixedActivity[]): ScheduledBlock[] {
  const blocks: ScheduledBlock[] = [];
  for (const activity of fixed) {
    for (const slot of activity.slots) {
      // Una franja que cruza la medianoche se parte en un segmento por día
      // (ej. dormir 23:30-07:30 = hoy 23:30-24:00 + mañana 00:00-07:30);
      // cada segmento se descuenta del día que corresponde y se dibuja aparte.
      for (const seg of slotToSegments(slot.day, slot.start, slot.end)) {
        free[seg.day] = subtractBusy(free[seg.day], seg);
        blocks.push({
          id: uid(),
          day: seg.day,
          start: toTime(seg.startMin),
          end: toTime(seg.endMin),
          kind: "fixed",
          label: activity.name,
          color: activity.color,
        });
      }
    }
  }
  return blocks;
}

/**
 * Dónde arrancar un bloque de `minutes`: dentro de la franja preferida si
 * entra; si no, en el hueco cuyo arranque quede más cerca de la franja (no
 * en el primero del día, que mandaba ej. el almuerzo a las 06:00). Sin
 * franja, el primer hueco donde entre.
 */
function findGap(
  intervals: Interval[],
  minutes: number,
  preferred?: { startMin: number; endMin: number },
): { startMin: number; outsideWindow: boolean } | null {
  const fits = (iv: Interval) => iv.endMin - iv.startMin >= minutes;
  if (!preferred) {
    const iv = intervals.find(fits);
    return iv ? { startMin: iv.startMin, outsideWindow: false } : null;
  }

  for (const iv of intervals) {
    const clippedStart = Math.max(iv.startMin, preferred.startMin);
    const clippedEnd = Math.min(iv.endMin, preferred.endMin);
    if (clippedEnd - clippedStart >= minutes) {
      return { startMin: clippedStart, outsideWindow: false };
    }
  }

  let best: { startMin: number; distance: number } | null = null;
  for (const iv of intervals.filter(fits)) {
    // Dentro de cada hueco, lo más pegado posible a la franja; la distancia es
    // lo que queda entre el bloque y la franja (antes o después de ella).
    const startMin = Math.min(Math.max(preferred.startMin, iv.startMin), iv.endMin - minutes);
    const distance = Math.max(
      preferred.startMin - (startMin + minutes),
      startMin - preferred.endMin,
      0,
    );
    if (!best || distance < best.distance) best = { startMin, distance };
  }
  return best ? { startMin: best.startMin, outsideWindow: true } : null;
}

function applyFlexibleActivities(
  free: FreeByDay,
  flexible: FlexibleActivity[],
  firstSchedulableDayIndex = 0,
): { blocks: ScheduledBlock[]; warnings: ScheduleWarning[] } {
  const blocks: ScheduledBlock[] = [];
  const warnings: ScheduleWarning[] = [];
  for (const activity of flexible) {
    const preferred = activity.preferredWindow
      ? {
          startMin: toMinutes(activity.preferredWindow.start),
          endMin: toMinutes(activity.preferredWindow.end),
        }
      : undefined;
    const unplacedDays: DayOfWeek[] = [];
    const movedDays: DayOfWeek[] = [];

    WEEK_ORDER.forEach((day, dayIndex) => {
      // Los días que ya pasaron se dibujan igual, pero no generan avisos.
      const warn = dayIndex >= firstSchedulableDayIndex;
      for (let occurrence = 0; occurrence < activity.timesPerDay; occurrence++) {
        const gap = findGap(free[day], activity.durationMin, preferred);
        if (!gap) {
          // No entra más esta ocurrencia — la agenda de ese día está llena.
          if (warn && !unplacedDays.includes(day)) unplacedDays.push(day);
          continue;
        }
        if (gap.outsideWindow && warn && !movedDays.includes(day)) movedDays.push(day);
        const busy = { startMin: gap.startMin, endMin: gap.startMin + activity.durationMin };
        free[day] = subtractBusy(free[day], busy);
        blocks.push({
          id: uid(),
          day,
          start: toTime(busy.startMin),
          end: toTime(busy.endMin),
          kind: "flexible",
          label: activity.name,
          color: ROUTINE_COLOR,
        });
      }
    });

    if (unplacedDays.length > 0) {
      warnings.push({ kind: "routine-unplaced", label: activity.name, days: unplacedDays });
    }
    if (movedDays.length > 0) {
      warnings.push({ kind: "routine-moved", label: activity.name, days: movedDays });
    }
  }
  return { blocks, warnings };
}

interface WorkItem {
  label: string;
  color: string;
  dueDayIndex: number; // índice en weekDays hasta el cual se puede estudiar (inclusive)
  /** Fecha del examen/entrega si cae dentro de esta semana (si no, lo que falte se estudia la próxima). */
  dueThisWeek: string | null;
  minutesRemaining: number;
  priority: number;
}

function buildWorkItems(subjects: Subject[], weekDays: Date[], today: Date): WorkItem[] {
  const items: WorkItem[] = [];
  const lastDayIndex = weekDays.length - 1;

  for (const subject of subjects) {
    for (const exam of subject.exams) {
      const examDate = startOfDay(parseISO(exam.date));
      const daysLeft = differenceInCalendarDays(examDate, today);
      if (daysLeft < 0) continue; // ya pasó
      const daysFromWeekStart = differenceInCalendarDays(examDate, weekDays[0]);
      const dueDayIndex = Math.min(Math.max(daysFromWeekStart, 0), lastDayIndex);
      items.push({
        label: `${exam.kind === "final" ? "Final" : "Parcial"} — ${subject.name}`,
        color: subject.color,
        dueDayIndex,
        dueThisWeek: daysFromWeekStart <= lastDayIndex ? exam.date : null,
        minutesRemaining: exam.complexity * STUDY_MIN_PER_COMPLEXITY,
        priority: priorityScore(exam.complexity, daysLeft),
      });
    }

    for (const task of subject.tasks) {
      if (task.done) continue;
      const daysLeft = task.dueDate
        ? differenceInCalendarDays(startOfDay(parseISO(task.dueDate)), today)
        : FALLBACK_TASK_DAYS_LEFT;
      if (daysLeft < 0) continue;
      const daysFromWeekStart = task.dueDate
        ? differenceInCalendarDays(startOfDay(parseISO(task.dueDate)), weekDays[0])
        : null;
      const dueDayIndex =
        daysFromWeekStart === null
          ? lastDayIndex
          : Math.min(Math.max(daysFromWeekStart, 0), lastDayIndex);
      // Los TPs no tienen complejidad propia: se aproxima con las horas estimadas.
      const pseudoComplexity = Math.min(5, Math.max(1, Math.round(task.estimatedHours / 2)));
      items.push({
        label: `${task.title} — ${subject.name}`,
        color: subject.color,
        dueDayIndex,
        dueThisWeek:
          task.dueDate && daysFromWeekStart !== null && daysFromWeekStart <= lastDayIndex
            ? task.dueDate
            : null,
        minutesRemaining: task.estimatedHours * 60,
        priority: priorityScore(pseudoComplexity, daysLeft),
      });
    }
  }

  return items.sort((a, b) => b.priority - a.priority);
}

/**
 * Reparte el estudio día por día: cada día, el tiempo libre se divide entre
 * los ítems elegibles ese día en proporción a su prioridad (no se le da todo
 * el hueco más grande al de mayor prioridad antes de mirar a los demás,
 * como pasaba antes). Cada ítem sigue topeado a MAX_SESSION_MIN por día.
 *
 * `items` ya viene ordenado por prioridad desc (buildWorkItems) y ese orden
 * se preserva al filtrar, así que no hace falta volver a ordenar acá.
 */
function applyStudyItems(
  free: FreeByDay,
  items: WorkItem[],
  firstSchedulableDayIndex: number,
): ScheduledBlock[] {
  const blocks: ScheduledBlock[] = [];
  const lastDayIndex = WEEK_ORDER.length - 1;

  for (let dayIndex = firstSchedulableDayIndex; dayIndex <= lastDayIndex; dayIndex++) {
    const day = WEEK_ORDER[dayIndex];
    const eligible = items.filter((it) => dayIndex <= it.dueDayIndex && it.minutesRemaining > 0);
    if (eligible.length === 0) continue;

    const dayTotalFree = free[day].reduce((sum, iv) => sum + (iv.endMin - iv.startMin), 0);
    if (dayTotalFree < MIN_SESSION_MIN) continue;

    const totalWeight = eligible.reduce((sum, it) => sum + it.priority, 0);

    for (const item of eligible) {
      const fairShare = Math.round(dayTotalFree * (item.priority / totalWeight));
      const target = Math.min(item.minutesRemaining, MAX_SESSION_MIN, fairShare);
      if (target < MIN_SESSION_MIN) continue; // su parte proporcional no alcanza para una sesión útil hoy

      // Usa el hueco más grande disponible ese día, hasta el tope calculado.
      const biggestGap = free[day].reduce<Interval | null>(
        (best, iv) =>
          !best || iv.endMin - iv.startMin > best.endMin - best.startMin ? iv : best,
        null,
      );
      if (!biggestGap || biggestGap.endMin - biggestGap.startMin < MIN_SESSION_MIN) continue;

      const allocated = Math.min(target, biggestGap.endMin - biggestGap.startMin);
      const busy = { startMin: biggestGap.startMin, endMin: biggestGap.startMin + allocated };
      free[day] = subtractBusy(free[day], busy);
      item.minutesRemaining -= allocated;
      blocks.push({
        id: uid(),
        day,
        start: toTime(busy.startMin),
        end: toTime(busy.endMin),
        kind: "study",
        label: item.label,
        color: item.color,
      });
    }
  }

  return blocks;
}

export interface WeekSchedule {
  weekStart: Date;
  blocks: ScheduledBlock[];
  warnings: ScheduleWarning[];
}

/**
 * Arma la semana (lunes a domingo) que contiene `now`: copia las actividades
 * fijas, ubica las esenciales variables y rellena los huecos restantes con
 * estudio, priorizando exámenes/TPs más urgentes y complejos primero.
 */
export function buildWeekSchedule(
  data: { fixed: FixedActivity[]; flexible: FlexibleActivity[]; subjects: Subject[] },
  now: Date = new Date(),
): WeekSchedule {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekDays = WEEK_ORDER.map((_, i) => addDays(weekStart, i));
  const today = startOfDay(now);

  const firstSchedulableDayIndex = Math.max(
    weekDays.findIndex((d) => !isBefore(d, today)),
    0,
  );

  const free = initFreeByDay();
  const fixedBlocks = applyFixedActivities(free, data.fixed);
  const flexible = applyFlexibleActivities(free, data.flexible, firstSchedulableDayIndex);

  const workItems = buildWorkItems(data.subjects, weekDays, today);
  const studyBlocks = applyStudyItems(free, workItems, firstSchedulableDayIndex);

  const studyWarnings: ScheduleWarning[] = workItems
    .filter((it) => it.dueThisWeek !== null && it.minutesRemaining > 0)
    .map((it) => ({
      kind: "study-short",
      label: it.label,
      missingMin: it.minutesRemaining,
      dueDate: it.dueThisWeek as string,
    }));

  return {
    weekStart,
    blocks: [...fixedBlocks, ...flexible.blocks, ...studyBlocks],
    warnings: [...flexible.warnings, ...studyWarnings],
  };
}

/**
 * Promedio de minutos libres por día una vez descontadas las actividades
 * fijas y la rutina diaria (sin contar estudio). Sirve como estimación
 * gruesa de cuánta capacidad de estudio hay por día, para juzgar si una
 * mesa de examen es alcanzable — no es una simulación semana a semana.
 */
export function estimateDailyFreeMinutes(
  fixed: FixedActivity[],
  flexible: FlexibleActivity[],
): number {
  const free = initFreeByDay();
  applyFixedActivities(free, fixed);
  applyFlexibleActivities(free, flexible);
  const totalFree = WEEK_ORDER.reduce<number>(
    (sum, day) => sum + free[day].reduce((s, iv) => s + (iv.endMin - iv.startMin), 0),
    0,
  );
  return totalFree / 7;
}
