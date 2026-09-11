import { useState } from "react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { usePlannerStore } from "../../store/usePlannerStore";
import { PALETTE, type Complexity, type ExamKind, type Subject } from "../../types/models";
import {
  Card, Field, PrimaryButton, IconDelete, ColorPicker, EmptyState, inputClass,
} from "../../components/ui";

export function Subjects() {
  const { subjects, addSubject, removeSubject } = usePlannerStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PALETTE[0]);

  const submit = () => {
    if (!name.trim()) return;
    addSubject(name.trim(), color);
    setName("");
    setColor(PALETTE[(subjects.length + 1) % PALETTE.length]);
  };

  return (
    <Card
      title="Materias"
      subtitle="Cada materia agrupa sus parciales, finales y TPs. La complejidad (1–5) pondera cuánto estudio asigna el planificador."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Nombre de la materia" className="min-w-52 flex-1">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sistemas Operativos"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
          <Field label="Color">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
          <PrimaryButton onClick={submit} disabled={!name.trim()}>
            Agregar materia
          </PrimaryButton>
        </div>

        {subjects.length === 0 ? (
          <EmptyState>
            Sin materias todavía. Agregá la primera para cargarle parciales y TPs.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {subjects.map((s) => (
              <SubjectCard key={s.id} subject={s} onRemove={() => removeSubject(s.id)} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- Tarjeta de una materia, con sus exámenes y TPs ---------- */

const COMPLEXITY_HINT: Record<Complexity, string> = {
  1: "trámite",
  2: "liviano",
  3: "normal",
  4: "exigente",
  5: "pesadilla",
};

function daysLeft(date: string): number {
  return differenceInCalendarDays(parseISO(date), new Date());
}

function clampComplexity(value: number): Complexity {
  if (Number.isNaN(value)) return 1;
  return Math.min(5, Math.max(1, Math.round(value))) as Complexity;
}

function SubjectCard(props: { subject: Subject; onRemove: () => void }) {
  const { subject } = props;
  const { examBoards, addExam, removeExam, addTask, toggleTask, removeTask } = usePlannerStore();

  // Form de examen
  const [kind, setKind] = useState<ExamKind>("parcial");
  const [date, setDate] = useState(""); // fecha manual, solo para parciales
  const [boardId, setBoardId] = useState(""); // mesa elegida, solo para finales
  const [boardDate, setBoardDate] = useState(""); // día exacto dentro de la mesa, si dura varios días
  const [complexity, setComplexity] = useState<Complexity>(3);

  // Form de TP
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskHours, setTaskHours] = useState(4);

  const selectedBoard = examBoards.find((b) => b.id === boardId);

  const examValid =
    kind === "final" ? boardId.length > 0 && (!selectedBoard?.endDate || boardDate.length > 0) : date.length > 0;

  const submitExam = () => {
    if (!examValid) return;
    if (kind === "final") {
      const board = examBoards.find((b) => b.id === boardId);
      if (!board) return;
      const examDate = board.endDate ? boardDate : board.date;
      addExam(subject.id, { kind, date: examDate, complexity, boardId: board.id });
      setBoardId("");
      setBoardDate("");
    } else {
      addExam(subject.id, { kind, date, complexity });
      setDate("");
    }
  };

  const submitTask = () => {
    if (!taskTitle.trim()) return;
    addTask(subject.id, {
      title: taskTitle.trim(),
      dueDate: taskDue || undefined,
      estimatedHours: taskHours,
    });
    setTaskTitle("");
    setTaskDue("");
  };

  return (
    <article
      className="rounded-lg border border-line bg-white"
      style={{ borderLeft: `4px solid ${subject.color}` }}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <h3 className="font-semibold">{subject.name}</h3>
        <IconDelete onClick={props.onRemove} label={`Eliminar ${subject.name}`} />
      </header>

      <div className="grid grid-cols-1 gap-4 border-t border-line px-4 py-3 lg:grid-cols-2">
        {/* Exámenes */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Parciales y finales
          </h4>
          {subject.exams.length === 0 && (
            <p className="text-sm text-ink-soft">Sin fechas cargadas.</p>
          )}
          <ul className="flex flex-col gap-1.5">
            {subject.exams.map((e) => {
              const left = daysLeft(e.date);
              const board = e.boardId ? examBoards.find((b) => b.id === e.boardId) : undefined;
              return (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      e.kind === "final"
                        ? "bg-accent-soft text-accent"
                        : "bg-primary-soft text-primary"
                    }`}
                  >
                    {e.kind}
                  </span>
                  {board && <span className="text-ink-soft">{board.name}</span>}
                  <span className="time-chip">
                    {format(parseISO(e.date), "dd MMM", { locale: es })}
                  </span>
                  <span className="text-ink-soft" title={COMPLEXITY_HINT[e.complexity]}>
                    {"●".repeat(e.complexity)}
                    {"○".repeat(5 - e.complexity)}
                  </span>
                  <span
                    className={`ml-auto text-xs ${
                      left <= 7 && left >= 0 ? "font-medium text-accent" : "text-ink-soft"
                    }`}
                  >
                    {left < 0 ? "pasó" : left === 0 ? "¡hoy!" : `en ${left} días`}
                  </span>
                  <IconDelete
                    onClick={() => removeExam(subject.id, e.id)}
                    label="Eliminar examen"
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <select
              aria-label="Tipo de examen"
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value as ExamKind)}
            >
              <option value="parcial">Parcial</option>
              <option value="final">Final</option>
            </select>
            {kind === "final" ? (
              examBoards.length === 0 ? (
                <span className="text-sm text-ink-soft">
                  Cargá una mesa de examen primero.
                </span>
              ) : (
                <>
                  <select
                    aria-label="Mesa de examen"
                    className={inputClass}
                    value={boardId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setBoardId(id);
                      const board = examBoards.find((b) => b.id === id);
                      setBoardDate(board?.endDate ? board.date : "");
                    }}
                  >
                    <option value="">Elegir mesa…</option>
                    {examBoards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} —{" "}
                        {b.endDate
                          ? `${format(parseISO(b.date), "dd MMM", { locale: es })}–${format(parseISO(b.endDate), "dd MMM", { locale: es })}`
                          : format(parseISO(b.date), "dd MMM", { locale: es })}
                      </option>
                    ))}
                  </select>
                  {selectedBoard?.endDate && (
                    <input
                      type="date"
                      aria-label="Día exacto dentro de la mesa"
                      className={inputClass}
                      value={boardDate}
                      min={selectedBoard.date}
                      max={selectedBoard.endDate}
                      onChange={(e) => setBoardDate(e.target.value)}
                    />
                  )}
                </>
              )
            ) : (
              <input
                type="date"
                aria-label="Fecha del examen"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            )}
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Complejidad
              <input
                type="range" min={1} max={5}
                value={complexity}
                onChange={(e) => setComplexity(clampComplexity(Number(e.target.value)))}
              />
              <input
                type="number" min={1} max={5}
                value={complexity}
                onChange={(e) => setComplexity(clampComplexity(Number(e.target.value)))}
                aria-label="Complejidad (1 a 5)"
                className="time-chip w-12 text-center"
              />
            </label>
            <PrimaryButton onClick={submitExam} disabled={!examValid}>
              Agregar
            </PrimaryButton>
          </div>
        </div>

        {/* TPs */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            TPs y actividades
          </h4>
          {subject.tasks.length === 0 && (
            <p className="text-sm text-ink-soft">Sin TPs cargados.</p>
          )}
          <ul className="flex flex-col gap-1.5">
            {subject.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(subject.id, t.id)}
                  aria-label={`Marcar ${t.title} como ${t.done ? "pendiente" : "hecho"}`}
                />
                <span className={`min-w-0 flex-1 truncate ${t.done ? "text-ink-soft line-through" : ""}`}>
                  {t.title}
                </span>
                {t.dueDate && (
                  <span className="time-chip time-chip--accent">
                    {format(parseISO(t.dueDate), "dd MMM", { locale: es })}
                  </span>
                )}
                <span className="time-chip">{t.estimatedHours} h</span>
                <IconDelete onClick={() => removeTask(subject.id, t.id)} label="Eliminar TP" />
              </li>
            ))}
          </ul>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <input
              className={`${inputClass} min-w-36 flex-1`}
              placeholder="TP 2 — Sockets"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <input
              type="date"
              aria-label="Fecha de entrega"
              className={inputClass}
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
            />
            <input
              type="number" min={1} max={60}
              aria-label="Horas estimadas"
              className={`${inputClass} w-20`}
              value={taskHours}
              onChange={(e) => setTaskHours(Number(e.target.value))}
            />
            <PrimaryButton onClick={submitTask} disabled={!taskTitle.trim()}>
              Agregar
            </PrimaryButton>
          </div>
        </div>
      </div>
    </article>
  );
}
