import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FixedActivity,
  FlexibleActivity,
  Subject,
  Exam,
  ExamBoard,
  Task,
  DayOfWeek,
} from "../types/models";
import { uid } from "../lib/time";

/**
 * Store único de la app (Zustand + persist).
 *
 * Decisiones:
 * - Un solo store: el dominio es chico y muy interrelacionado (el scheduler
 *   necesita leer las tres colecciones a la vez).
 * - persist → localStorage con clave versionada: los datos sobreviven al
 *   refresh sin backend, y `version` permite migraciones futuras.
 * - Las acciones son la única forma de mutar estado; los componentes nunca
 *   tocan los arrays directamente. Eso deja un punto único para validar.
 */

interface PlannerState {
  fixed: FixedActivity[];
  flexible: FlexibleActivity[];
  subjects: Subject[];
  examBoards: ExamBoard[];

  addFixed: (a: Omit<FixedActivity, "id">) => void;
  updateFixed: (id: string, patch: Partial<FixedActivity>) => void;
  removeFixed: (id: string) => void;

  addFlexible: (a: Omit<FlexibleActivity, "id">) => void;
  updateFlexible: (id: string, patch: Partial<FlexibleActivity>) => void;
  removeFlexible: (id: string) => void;

  addSubject: (name: string, color: string) => void;
  updateSubject: (id: string, patch: Partial<Pick<Subject, "name" | "color">>) => void;
  removeSubject: (id: string) => void;

  addExam: (subjectId: string, exam: Omit<Exam, "id">) => void;
  removeExam: (subjectId: string, examId: string) => void;

  addExamBoard: (board: Omit<ExamBoard, "id">) => void;
  removeExamBoard: (id: string) => void;

  addTask: (subjectId: string, task: Omit<Task, "id" | "done">) => void;
  toggleTask: (subjectId: string, taskId: string) => void;
  removeTask: (subjectId: string, taskId: string) => void;
}

const patchSubject = (
  subjects: Subject[],
  id: string,
  fn: (s: Subject) => Subject,
): Subject[] => subjects.map((s) => (s.id === id ? fn(s) : s));

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      fixed: [],
      flexible: [],
      subjects: [],
      examBoards: [],

      addFixed: (a) =>
        set((st) => ({ fixed: [...st.fixed, { ...a, id: uid() }] })),
      updateFixed: (id, patch) =>
        set((st) => ({
          fixed: st.fixed.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),
      removeFixed: (id) =>
        set((st) => ({ fixed: st.fixed.filter((f) => f.id !== id) })),

      addFlexible: (a) =>
        set((st) => ({ flexible: [...st.flexible, { ...a, id: uid() }] })),
      updateFlexible: (id, patch) =>
        set((st) => ({
          flexible: st.flexible.map((f) =>
            f.id === id ? { ...f, ...patch } : f,
          ),
        })),
      removeFlexible: (id) =>
        set((st) => ({ flexible: st.flexible.filter((f) => f.id !== id) })),

      addSubject: (name, color) =>
        set((st) => ({
          subjects: [
            ...st.subjects,
            { id: uid(), name, color, exams: [], tasks: [] },
          ],
        })),
      updateSubject: (id, patch) =>
        set((st) => ({
          subjects: patchSubject(st.subjects, id, (s) => ({ ...s, ...patch })),
        })),
      removeSubject: (id) =>
        set((st) => ({ subjects: st.subjects.filter((s) => s.id !== id) })),

      addExam: (subjectId, exam) =>
        set((st) => ({
          subjects: patchSubject(st.subjects, subjectId, (s) => ({
            ...s,
            exams: [...s.exams, { ...exam, id: uid() }].sort((a, b) =>
              a.date.localeCompare(b.date),
            ),
          })),
        })),
      removeExam: (subjectId, examId) =>
        set((st) => ({
          subjects: patchSubject(st.subjects, subjectId, (s) => ({
            ...s,
            exams: s.exams.filter((e) => e.id !== examId),
          })),
        })),

      addExamBoard: (board) =>
        set((st) => ({
          examBoards: [...st.examBoards, { ...board, id: uid() }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        })),
      removeExamBoard: (id) =>
        set((st) => ({
          examBoards: st.examBoards.filter((b) => b.id !== id),
          // Los finales que apuntaban a esta mesa pierden el vínculo pero
          // conservan la fecha ya resuelta, no quedan huérfanos ni se borran.
          subjects: st.subjects.map((s) => ({
            ...s,
            exams: s.exams.map((e) => (e.boardId === id ? { ...e, boardId: undefined } : e)),
          })),
        })),

      addTask: (subjectId, task) =>
        set((st) => ({
          subjects: patchSubject(st.subjects, subjectId, (s) => ({
            ...s,
            tasks: [...s.tasks, { ...task, id: uid(), done: false }],
          })),
        })),
      toggleTask: (subjectId, taskId) =>
        set((st) => ({
          subjects: patchSubject(st.subjects, subjectId, (s) => ({
            ...s,
            tasks: s.tasks.map((t) =>
              t.id === taskId ? { ...t, done: !t.done } : t,
            ),
          })),
        })),
      removeTask: (subjectId, taskId) =>
        set((st) => ({
          subjects: patchSubject(st.subjects, subjectId, (s) => ({
            ...s,
            tasks: s.tasks.filter((t) => t.id !== taskId),
          })),
        })),
    }),
    {
      name: "planner-data",
      version: 2,
      // v1 → v2: FixedActivity pasó de un start/end único por actividad a
      // `slots` (horario propio por día), para poder cargar ej. lunes y
      // miércoles con horarios distintos en la misma actividad.
      migrate: (persisted, version) => {
        const state = persisted as { fixed?: Array<Record<string, unknown>> };
        if (version < 2 && Array.isArray(state?.fixed)) {
          state.fixed = state.fixed.map((f) => {
            if (Array.isArray(f.slots)) return f;
            const days = Array.isArray(f.days) ? (f.days as DayOfWeek[]) : [];
            return {
              id: f.id,
              name: f.name,
              color: f.color,
              slots: days.map((day) => ({ day, start: f.start, end: f.end })),
            };
          });
        }
        return state as unknown as PlannerState;
      },
    },
  ),
);
