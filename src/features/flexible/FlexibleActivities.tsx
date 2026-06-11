import { useState } from "react";
import { usePlannerStore } from "../../store/usePlannerStore";
import { formatDuration } from "../../lib/time";
import {
  Card, Field, PrimaryButton, IconDelete, EmptyState, inputClass,
} from "../../components/ui";

export function FlexibleActivities() {
  const { flexible, addFlexible, removeFlexible } = usePlannerStore();

  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [useWindow, setUseWindow] = useState(false);
  const [winStart, setWinStart] = useState("12:00");
  const [winEnd, setWinEnd] = useState("15:00");

  const valid = name.trim().length > 0 && durationMinutes > 0 && timesPerDay > 0;

  const submit = () => {
    if (!valid) return;
    addFlexible({
      name: name.trim(),
      durationMin: durationMinutes,
      timesPerDay,
      preferredWindow: useWindow ? { start: winStart, end: winEnd } : undefined,
    });
    setName("");
  };

  return (
    <Card
      title="Esenciales variables"
      subtitle="Sin horario fijo: el planificador las ubica cada día (comer, cocinar, descansar)."
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Nombre">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Almorzar"
            />
          </Field>
          <Field label="Duración (min)">
            <input
              type="number" min={5} step={5}
              className={`${inputClass} w-28`}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </Field>
          <Field label="Veces por día">
            <input
              type="number" min={1} max={6}
              className={`${inputClass} w-24`}
              value={timesPerDay}
              onChange={(e) => setTimesPerDay(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={useWindow}
              onChange={(e) => setUseWindow(e.target.checked)}
            />
            Preferir una franja horaria
          </label>
          {useWindow && (
            <>
              <Field label="Entre">
                <input type="time" className={inputClass} value={winStart}
                  onChange={(e) => setWinStart(e.target.value)} />
              </Field>
              <Field label="Y">
                <input type="time" className={inputClass} value={winEnd}
                  onChange={(e) => setWinEnd(e.target.value)} />
              </Field>
            </>
          )}
          <div className="ml-auto">
            <PrimaryButton onClick={submit} disabled={!valid}>
              Agregar esencial
            </PrimaryButton>
          </div>
        </div>

        {flexible.length === 0 ? (
          <EmptyState>
            Cargá lo que necesitás hacer todos los días aunque no tenga horario:
            comer, cocinar, descansar.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {flexible.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                {a.timesPerDay > 1 && (
                  <span className="text-xs text-ink-soft">× {a.timesPerDay}/día</span>
                )}
                {a.preferredWindow && (
                  <span className="time-chip">
                    {a.preferredWindow.start}–{a.preferredWindow.end}
                  </span>
                )}
                <span className="time-chip">{formatDuration(a.durationMin)}</span>
                <IconDelete
                  onClick={() => removeFlexible(a.id)}
                  label={`Eliminar ${a.name}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
