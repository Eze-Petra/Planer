import { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePlannerStore } from "../../store/usePlannerStore";
import { DAY_LABELS, WEEK_ORDER, type DayOfWeek } from "../../types/models";
import { toMinutes } from "../../lib/time";
import { buildWeekSchedule, type BlockKind, type ScheduledBlock } from "../scheduler/schedule";

const START_HOUR = 6; // la grilla arranca a las 06:00 para no desperdiciar espacio en horas de sueño
const END_HOUR = 24;
const HOUR_HEIGHT_PX = 48;
const GRID_HEIGHT_PX = (END_HOUR - START_HOUR) * HOUR_HEIGHT_PX;

const KIND_STYLE: Record<BlockKind, { border: string; opacity: number }> = {
  fixed: { border: "solid", opacity: 1 },
  flexible: { border: "dashed", opacity: 0.85 },
  study: { border: "solid", opacity: 0.9 },
};

export function WeekCalendar() {
  const { fixed, flexible, subjects } = usePlannerStore();

  const schedule = useMemo(
    () => buildWeekSchedule({ fixed, flexible, subjects }),
    [fixed, flexible, subjects],
  );

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="rounded-xl border border-line bg-paper shadow-[0_1px_2px_rgba(28,34,48,0.06)]">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Semana</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Desde el {format(schedule.weekStart, "d 'de' MMMM", { locale: es })} — actividades
            fijas, esenciales y estudio asignado por el planificador.
          </p>
        </div>
        <Legend />
      </header>

      <div className="overflow-x-auto px-5 py-4">
        <div className="grid min-w-[720px] grid-cols-[3rem_repeat(7,1fr)]">
          <div />
          {WEEK_ORDER.map((d) => (
            <div key={d} className="pb-2 text-center text-xs font-medium uppercase tracking-wide text-ink-soft">
              {DAY_LABELS[d]}
            </div>
          ))}

          <div className="relative" style={{ height: GRID_HEIGHT_PX }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-2 text-[11px] text-ink-soft"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT_PX }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {WEEK_ORDER.map((day) => (
            <DayColumn key={day} day={day} blocks={schedule.blocks} hours={hours} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn(props: { day: DayOfWeek; blocks: ScheduledBlock[]; hours: number[] }) {
  const dayBlocks = props.blocks.filter((b) => b.day === props.day);
  const gridStartMin = START_HOUR * 60;
  const gridEndMin = END_HOUR * 60;

  return (
    <div className="relative border-l border-line" style={{ height: GRID_HEIGHT_PX }}>
      {props.hours.map((h) => (
        <div
          key={h}
          className="absolute w-full border-t border-line/60"
          style={{ top: (h - START_HOUR) * HOUR_HEIGHT_PX }}
        />
      ))}

      {dayBlocks.map((block) => {
        const startMin = Math.max(toMinutes(block.start), gridStartMin);
        const rawEndMin = toMinutes(block.end) > toMinutes(block.start) ? toMinutes(block.end) : 1440;
        const endMin = Math.min(rawEndMin, gridEndMin);
        if (endMin <= startMin) return null; // fuera del rango visible de la grilla

        const top = ((startMin - gridStartMin) / 60) * HOUR_HEIGHT_PX;
        const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT_PX, 16);
        const style = KIND_STYLE[block.kind];

        return (
          <div
            key={block.id}
            title={`${block.label} · ${block.start}–${block.end}`}
            className="absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] leading-tight text-white"
            style={{
              top,
              height,
              background: block.color,
              opacity: style.opacity,
              border: `1px ${style.border} rgba(255,255,255,0.6)`,
            }}
          >
            <span className="line-clamp-2 font-medium">{block.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-ink-soft">
      <LegendItem label="Fija" border="solid" />
      <LegendItem label="Esencial" border="dashed" />
      <LegendItem label="Estudio" border="solid" faded />
    </div>
  );
}

function LegendItem(props: { label: string; border: string; faded?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm bg-primary"
        style={{ opacity: props.faded ? 0.75 : 1, borderStyle: props.border }}
      />
      {props.label}
    </span>
  );
}
