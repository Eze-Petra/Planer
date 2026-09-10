import { useState } from "react";
import { usePlannerStore } from "../../store/usePlannerStore";
import {
  DAY_LABELS, WEEK_ORDER, PALETTE, type DayOfWeek, type FixedSlot,
} from "../../types/models";
import { durationMin, formatDuration } from "../../lib/time";
import {
  Card, Field, PrimaryButton, IconDelete, ColorPicker, EmptyState, inputClass,
} from "../../components/ui";

export function FixedActivities() {
  const { fixed, addFixed, removeFixed } = usePlannerStore();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PALETTE[0]);

  // Franja en construcción: puede aplicarse a varios días a la vez si comparten horario.
  const [slotDays, setSlotDays] = useState<DayOfWeek[]>([]);
  const [slotStart, setSlotStart] = useState("08:00");
  const [slotEnd, setSlotEnd] = useState("09:00");

  // Franjas ya confirmadas para la actividad que se está cargando.
  const [pendingSlots, setPendingSlots] = useState<FixedSlot[]>([]);

  const toggleSlotDay = (d: DayOfWeek) =>
    setSlotDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const slotValid = slotDays.length > 0 && slotStart !== slotEnd;

  const addSlot = () => {
    if (!slotValid) return;
    const additions = slotDays
      .filter(
        (day) =>
          !pendingSlots.some(
            (s) => s.day === day && s.start === slotStart && s.end === slotEnd,
          ),
      )
      .map((day) => ({ day, start: slotStart, end: slotEnd }));
    setPendingSlots((prev) => [...prev, ...additions]);
    setSlotDays([]);
  };

  const removeSlot = (index: number) =>
    setPendingSlots((prev) => prev.filter((_, i) => i !== index));

  const valid = name.trim().length > 0 && pendingSlots.length > 0;

  const submit = () => {
    if (!valid) return;
    addFixed({ name: name.trim(), slots: pendingSlots, color });
    setName("");
    setPendingSlots([]);
  };

  const slotCrossesMidnight = slotEnd <= slotStart;

  return (
    <Card
      title="Actividades fijas"
      subtitle="Bloques con día y horario exacto: cursada, gimnasio, dormir."
    >
      <div className="flex flex-col gap-4">
        <Field label="Nombre">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Redes"
          />
        </Field>

        <div className="rounded-lg border border-dashed border-line p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Agregar franja horaria
          </p>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_auto]">
              <Field label="Desde">
                <input type="time" className={inputClass} value={slotStart}
                  onChange={(e) => setSlotStart(e.target.value)} />
              </Field>
              <Field label="Hasta">
                <input type="time" className={inputClass} value={slotEnd}
                  onChange={(e) => setSlotEnd(e.target.value)} />
              </Field>
            </div>

            <Field label="Días con ese horario">
              <div className="flex flex-wrap gap-1.5">
                {WEEK_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={slotDays.includes(d)}
                    onClick={() => toggleSlotDay(d)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      slotDays.includes(d)
                        ? "border-primary bg-primary-soft font-medium text-primary"
                        : "border-line bg-white text-ink-soft hover:border-ink-soft"
                    }`}
                  >
                    {DAY_LABELS[d].slice(0, 3)}
                  </button>
                ))}
              </div>
            </Field>

            <div className="flex items-center justify-between gap-3">
              {slotCrossesMidnight && slotStart !== slotEnd && (
                <span className="text-xs text-accent">
                  Cruza la medianoche ({formatDuration(durationMin(slotStart, slotEnd))})
                </span>
              )}
              <PrimaryButton onClick={addSlot} disabled={!slotValid}>
                Agregar franja
              </PrimaryButton>
            </div>
          </div>
        </div>

        {pendingSlots.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingSlots.map((s, i) => (
              <span
                key={i}
                className="time-chip flex items-center gap-1.5"
              >
                {DAY_LABELS[s.day].slice(0, 3)} {s.start}–{s.end}
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  aria-label={`Quitar franja ${DAY_LABELS[s.day]} ${s.start}-${s.end}`}
                  className="text-ink-soft hover:text-danger"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="Color">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
          <PrimaryButton onClick={submit} disabled={!valid}>
            Agregar actividad
          </PrimaryButton>
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
                <div className="flex flex-wrap justify-end gap-1.5">
                  {WEEK_ORDER.flatMap((d) =>
                    a.slots
                      .filter((s) => s.day === d)
                      .map((s, i) => (
                        <span key={`${d}-${i}`} className="time-chip">
                          {DAY_LABELS[d].slice(0, 2)} {s.start}–{s.end}
                        </span>
                      )),
                  )}
                </div>
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
