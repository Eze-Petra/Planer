import { useState } from "react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { usePlannerStore } from "../../store/usePlannerStore";
import { estimateDailyFreeMinutes, STUDY_MIN_PER_COMPLEXITY } from "../scheduler/schedule";
import { formatDuration } from "../../lib/time";
import { Card, Field, PrimaryButton, IconDelete, EmptyState, inputClass } from "../../components/ui";

export function ExamBoards() {
  const { examBoards, subjects, fixed, flexible, addExamBoard, removeExamBoard } = usePlannerStore();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  const valid = name.trim().length > 0 && date.length > 0;

  const submit = () => {
    if (!valid) return;
    addExamBoard({ name: name.trim(), date });
    setName("");
    setDate("");
  };

  const dailyFreeMin = estimateDailyFreeMinutes(fixed, flexible);

  return (
    <Card
      title="Mesas de examen"
      subtitle="Turnos que ofrece la facultad. Al cargar un final de una materia, elegís en cuál se inscribe."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Nombre de la mesa" className="min-w-40 flex-1">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Diciembre 2026"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <PrimaryButton onClick={submit} disabled={!valid}>
            Agregar mesa
          </PrimaryButton>
        </div>

        {examBoards.length === 0 ? (
          <EmptyState>
            Sin mesas cargadas. Agregá los turnos de finales de tu facultad para
            poder inscribir materias en ellos.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {examBoards.map((board) => {
              const finals = subjects.flatMap((s) =>
                s.exams
                  .filter((e) => e.kind === "final" && e.boardId === board.id)
                  .map((e) => ({ subject: s, exam: e })),
              );
              const hoursNeeded =
                finals.reduce((sum, f) => sum + f.exam.complexity * STUDY_MIN_PER_COMPLEXITY, 0) / 60;
              const daysLeft = differenceInCalendarDays(parseISO(board.date), new Date());
              const hoursAvailable = Math.max(daysLeft, 0) * (dailyFreeMin / 60);
              const load = hoursNeeded === 0 ? "ok" : hoursAvailable >= hoursNeeded ? "ok" : hoursAvailable >= hoursNeeded * 0.7 ? "ajustado" : "sobrecargado";

              return (
                <li key={board.id} className="flex flex-col gap-1.5 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate font-medium">{board.name}</span>
                    <span className="time-chip">
                      {format(parseISO(board.date), "dd MMM yyyy", { locale: es })}
                    </span>
                    <span
                      className={`text-xs ${
                        daysLeft < 0 ? "text-ink-soft" : daysLeft <= 14 ? "font-medium text-accent" : "text-ink-soft"
                      }`}
                    >
                      {daysLeft < 0 ? "pasó" : daysLeft === 0 ? "¡hoy!" : `en ${daysLeft} días`}
                    </span>
                    <IconDelete onClick={() => removeExamBoard(board.id)} label={`Eliminar mesa ${board.name}`} />
                  </div>
                  {finals.length > 0 && (
                    <p className="text-xs text-ink-soft">
                      {finals.length} final{finals.length > 1 ? "es" : ""} anotado{finals.length > 1 ? "s" : ""}
                      {" — "}necesitás ~{formatDuration(Math.round(hoursNeeded * 60))} de estudio
                      {daysLeft >= 0 && (
                        <>
                          {" "}· tenés ~{formatDuration(Math.round(hoursAvailable * 60))} libres hasta esa fecha
                          {" — "}
                          <span
                            className={
                              load === "ok"
                                ? "font-medium text-primary"
                                : load === "ajustado"
                                  ? "font-medium text-accent"
                                  : "font-medium text-danger"
                            }
                          >
                            {load === "ok" ? "vas bien" : load === "ajustado" ? "ajustado" : "no llegás con todas"}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
