import { useState } from "react";
import { usePlannerStore } from "../../store/usePlannerStore";
import { DAY_LABELS, WEEK_ORDER, PALETTE, type DayOfWeek } from "../../types/models";
import { durationMin, formatDuration } from "../../lib/time";
import {
  Card, Field, PrimaryButton, IconDelete, ColorPicker, EmptyState, inputClass,
} from "../../components/ui";

export function FixedActivities() {
  const { fixed, addFixed, removeFixed } = usePlannerStore();

  const [name, setName] = useState("");
  const [days, setDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [color, setColor] = useState<string>(PALETTE[0]);

  const toggleDay = (d: DayOfWeek) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const valid = name.trim().length > 0 && days.length > 0 && start !== end;

  const submit = () => {
    if (!valid) return;
    addFixed({ name: name.trim(), days, start, end, color });
    setName("");
  };

  const crossesMidnight = end <= start;

  return (
    <Card
      title="Actividades fijas"
      subtitle="Bloques con día y horario exacto: cursada, gimnasio, dormir."
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Nombre">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cursada de Álgebra"
            />
          </Field>
          <Field label="Desde">
            <input type="time" className={inputClass} value={start}
              onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <input type="time" className={inputClass} value={end}
              onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <Field label="Días">
          <div className="flex flex-wrap gap-1.5">
            {WEEK_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() => toggleDay(d)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  days.includes(d)
                    ? "border-primary bg-primary-soft font-medium text-primary"
                    : "border-line bg-white text-ink-soft hover:border-ink-soft"
                }`}
              >
                {DAY_LABELS[d].slice(0, 3)}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="Color">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
          <div className="flex items-center gap-3">
            {crossesMidnight && start !== end && (
              <span className="text-xs text-accent">
                Cruza la medianoche ({formatDuration(durationMin(start, end))})
              </span>
            )}
            <PrimaryButton onClick={submit} disabled={!valid}>
              Agregar actividad
            </PrimaryButton>
          </div>
        </div>

        {fixed.length === 0 ? (
          <EmptyState>
            Todavía no cargaste actividades fijas. Empezá por las que se repiten
            todos los días, como dormir.
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {fixed.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: a.color }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                <span className="hidden text-xs text-ink-soft sm:block">
                  {WEEK_ORDER.filter((d) => a.days.includes(d))
                    .map((d) => DAY_LABELS[d].slice(0, 2))
                    .join(" · ")}
                </span>
                <span className="time-chip">
                  {a.start}–{a.end}
                </span>
                <IconDelete
                  onClick={() => removeFixed(a.id)}
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
