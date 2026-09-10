/**
 * Modelos de dominio del planificador.
 *
 * Decisiones clave:
 * - Las horas se guardan como string "HH:mm" (hora local). Evita los problemas
 *   de zona horaria de Date para algo que es puramente "hora del día".
 * - Las fechas de exámenes se guardan como "yyyy-MM-dd" (ISO local), también
 *   sin componente horario.
 * - Todo es serializable a JSON → persiste directo en localStorage y mañana
 *   puede viajar a un backend sin cambios.
 */

/** 0 = domingo ... 6 = sábado (convención de JS Date.getDay()) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  0: "Domingo",
};

/** Orden de visualización: semana que arranca el lunes. */
export const WEEK_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

/** "HH:mm" en hora local, ej: "08:30" */
export type TimeString = string;

/** "yyyy-MM-dd", ej: "2026-06-25" */
export type DateString = string;

export type Complexity = 1 | 2 | 3 | 4 | 5;

/**
 * Franja horaria de una actividad fija en un día puntual.
 * Si end <= start se interpreta que cruza la medianoche (ej: dormir 23:30 → 07:30).
 */
export interface FixedSlot {
  day: DayOfWeek;
  start: TimeString;
  end: TimeString;
}

/**
 * Actividad fija: ocurre en días y horarios exactos (gimnasio, cursada, dormir).
 * Cada día puede tener su propio horario (ej: Redes lunes 13–17, miércoles 20–22),
 * por eso el horario vive en `slots` y no como un start/end único para todos los días.
 */
export interface FixedActivity {
  id: string;
  name: string;
  slots: FixedSlot[];
  color: string;
}

/**
 * Actividad esencial variable: no tiene horario fijo, solo una duración que el
 * scheduler deberá ubicar cada día (comer, cocinar, descansar).
 */
export interface FlexibleActivity {
  id: string;
  name: string;
  /** Duración estimada en minutos. */
  durationMin: number;
  /** Cuántas veces por día debe ocurrir (ej: comer × 2). */
  timesPerDay: number;
  /** Ventana preferida opcional; el scheduler intentará respetarla. */
  preferredWindow?: { start: TimeString; end: TimeString };
}

/**
 * Mesa de examen: fecha de turno que ofrece la facultad, compartida por
 * todas las materias (no pertenece a ninguna en particular). Un final se
 * inscribe en una mesa existente en vez de cargar una fecha suelta, así
 * varias materias que comparten turno quedan con la misma fecha.
 */
export interface ExamBoard {
  id: string;
  name: string;
  date: DateString;
}

export type ExamKind = "parcial" | "final";

export interface Exam {
  id: string;
  kind: ExamKind;
  date: DateString;
  /** 1 = trámite, 5 = pesadilla. Pondera las horas de estudio asignadas. */
  complexity: Complexity;
  /** Solo para finales: mesa global (ExamBoard) en la que se inscribió. */
  boardId?: string;
}

/** TP / actividad asociada a una materia. */
export interface Task {
  id: string;
  title: string;
  dueDate?: DateString;
  /** Horas estimadas de trabajo; el scheduler las reparte antes del vencimiento. */
  estimatedHours: number;
  done: boolean;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  exams: Exam[];
  tasks: Task[];
}

/** Paleta para materias y actividades — derivada de los tokens del tema. */
export const PALETTE = [
  "#2B4ACB", // azul tinta
  "#0E7C66", // verde pizarra
  "#B3261E", // rojo corrección
  "#B45309", // ámbar
  "#6D28D9", // violeta
  "#0E7490", // cian profundo
  "#9D174D", // magenta
  "#4D7C0F", // oliva
] as const;
