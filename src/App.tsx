import { useState } from "react";
import { SectionModeContext, type SectionMode } from "./components/ui";
import { usePlannerStore } from "./store/usePlannerStore";
import { FixedActivities } from "./features/fixed/FixedActivities";
import { FlexibleActivities } from "./features/flexible/FlexibleActivities";
import { Subjects } from "./features/subjects/Subjects";
import { ExamBoards } from "./features/examBoards/ExamBoards";
import { WeekCalendar } from "./features/calendar/WeekCalendar";

type Tab = "datos" | "calendario";

const SECTION_MODES: { id: SectionMode; label: string }[] = [
  { id: "open", label: "Abiertas" },
  { id: "accordion", label: "Desplegables" },
  { id: "modal", label: "Pop up" },
];
const SECTION_MODE_KEY = "planner.sectionMode";

function loadSectionMode(): SectionMode {
  try {
    const v = localStorage.getItem(SECTION_MODE_KEY);
    if (v === "open" || v === "accordion" || v === "modal") return v;
  } catch {
    /* sin localStorage: usa el default */
  }
  return "accordion";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("datos");
  const [sectionMode, setSectionMode] = useState<SectionMode>(loadSectionMode);
  const changeSectionMode = (m: SectionMode) => {
    setSectionMode(m);
    try {
      localStorage.setItem(SECTION_MODE_KEY, m);
    } catch {
      /* ignorar */
    }
  };
  const { fixed, flexible, subjects } = usePlannerStore();
  const examCount = subjects.reduce((n, s) => n + s.exams.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">
            Planificador académico
          </p>
          <h1 className="text-3xl font-bold">Agenda</h1>
        </div>
        <nav className="flex gap-1 rounded-lg border border-line bg-paper-2 p-1">
          {(["datos", "calendario"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-md px-4 py-1.5 text-sm capitalize transition-colors ${
                tab === t ? "bg-primary font-medium text-paper" : "text-ink-soft"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {tab === "datos" ? (
        <SectionModeContext.Provider value={sectionMode}>
        <main className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {fixed.length} actividades fijas · {flexible.length} rutinas ·{" "}
              {subjects.length} materias con {examCount} fechas de examen
            </p>
            <div
              role="radiogroup"
              aria-label="Vista de secciones"
              className="flex gap-1 rounded-lg border border-line bg-paper-2 p-1"
            >
              {SECTION_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={sectionMode === m.id}
                  onClick={() => changeSectionMode(m.id)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${
                    sectionMode === m.id ? "bg-primary font-medium text-paper" : "text-ink-soft"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <FixedActivities />
          <FlexibleActivities />
          <ExamBoards />
          <Subjects />
        </main>
        </SectionModeContext.Provider>
      ) : (
        <main>
          <WeekCalendar />
        </main>
      )}
    </div>
  );
}
