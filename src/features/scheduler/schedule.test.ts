import { describe, expect, it } from "vitest";
import { buildWeekSchedule, type ScheduleWarning } from "./schedule";
import type { FixedActivity, FlexibleActivity, Subject } from "../../types/models";

// Lunes 16/11/2026 a las 08:00: la semana arranca hoy, ningún día pasó.
const MONDAY = new Date(2026, 10, 16, 8, 0);

const lunch = (patch: Partial<FlexibleActivity> = {}): FlexibleActivity => ({
  id: "f1",
  name: "Almorzar",
  durationMin: 45,
  timesPerDay: 1,
  preferredWindow: { start: "12:00", end: "15:00" },
  ...patch,
});

const everyDay = (name: string, start: string, end: string): FixedActivity => ({
  id: name,
  name,
  color: "#000",
  slots: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day: day as FixedActivity["slots"][number]["day"], start, end })),
});

function build(data: { fixed?: FixedActivity[]; flexible?: FlexibleActivity[]; subjects?: Subject[] }, now = MONDAY) {
  return buildWeekSchedule({ fixed: [], flexible: [], subjects: [], ...data }, now);
}

const routineBlocks = (s: ReturnType<typeof build>) => s.blocks.filter((b) => b.kind === "flexible");
const kinds = (ws: ScheduleWarning[]) => ws.map((w) => w.kind);

describe("rutina con franja preferida", () => {
  it("dura lo que se pidió, no toda la franja, y cae dentro de ella", () => {
    const s = build({ flexible: [lunch()] });
    const blocks = routineBlocks(s);
    expect(blocks).toHaveLength(7);
    for (const b of blocks) {
      expect(b.start).toBe("12:00");
      expect(b.end).toBe("12:45");
    }
    expect(s.warnings).toEqual([]);
  });

  it("si la franja está ocupada, va al hueco más cercano (no a las 06:00) y avisa", () => {
    const s = build({ fixed: [everyDay("Cursada", "11:00", "15:30")], flexible: [lunch()] });
    for (const b of routineBlocks(s)) {
      expect(b.start).toBe("15:30");
      expect(b.end).toBe("16:15");
    }
    expect(kinds(s.warnings)).toEqual(["routine-moved"]);
  });

  it("prefiere el hueco de antes si queda más cerca del inicio de la franja", () => {
    const s = build({ fixed: [everyDay("Cursada", "11:45", "18:00")], flexible: [lunch()] });
    for (const b of routineBlocks(s)) {
      expect(b.start).toBe("11:00");
      expect(b.end).toBe("11:45");
    }
  });

  it("si no entra en ningún lado, avisa en vez de descartarla en silencio", () => {
    const s = build({ fixed: [everyDay("Todo el día", "06:00", "23:50")], flexible: [lunch()] });
    expect(routineBlocks(s)).toHaveLength(0);
    expect(s.warnings).toEqual([
      { kind: "routine-unplaced", label: "Almorzar", days: [1, 2, 3, 4, 5, 6, 0] },
    ]);
  });

  it("no avisa por días que ya pasaron", () => {
    const thursday = new Date(2026, 10, 19, 8, 0);
    const s = build({ fixed: [everyDay("Todo el día", "06:00", "23:50")], flexible: [lunch()] }, thursday);
    expect(s.warnings).toEqual([
      { kind: "routine-unplaced", label: "Almorzar", days: [4, 5, 6, 0] },
    ]);
  });
});

describe("estudio", () => {
  const subject = (date: string, complexity: 1 | 2 | 3 | 4 | 5): Subject => ({
    id: "s1",
    name: "Redes",
    color: "#000",
    exams: [{ id: "e1", kind: "parcial", date, complexity }],
    tasks: [],
  });

  it("avisa si un examen de esta semana no llega a tener todo su estudio", () => {
    // Miércoles, complejidad 5 = 10 h; con tope de 90 min/día hay 4,5 h hasta el miércoles.
    const s = build({ subjects: [subject("2026-11-18", 5)] });
    expect(s.warnings).toEqual([
      { kind: "study-short", label: "Parcial — Redes", missingMin: 600 - 270, dueDate: "2026-11-18" },
    ]);
  });

  it("no avisa por un examen de semanas futuras (lo que falta se estudia después)", () => {
    const s = build({ subjects: [subject("2026-12-15", 5)] });
    expect(s.warnings).toEqual([]);
    expect(s.blocks.some((b) => b.kind === "study")).toBe(true);
  });
});
