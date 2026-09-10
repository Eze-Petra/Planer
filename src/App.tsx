import { useState } from "react";
import { usePlannerStore } from "./store/usePlannerStore";
import { FixedActivities } from "./features/fixed/FixedActivities";
import { FlexibleActivities } from "./features/flexible/FlexibleActivities";
import { Subjects } from "./features/subjects/Subjects";
import { ExamBoards } from "./features/examBoards/ExamBoards";
import { WeekCalendar } from "./features/calendar/WeekCalendar";

type Tab = "datos" | "calendario";

export default function App() {
  const [tab, setTab] = useState<Tab>("datos");
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
                tab === t ? "bg-white font-medium shadow-sm" : "text-ink-soft"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {tab === "datos" ? (
        <main className="flex flex-col gap-5">
          <p className="text-sm text-ink-soft">
            {fixed.length} actividades fijas · {flexible.length} rutinas ·{" "}
            {subjects.length} materias con {examCount} fechas de examen
          </p>
          <FixedActivities />
          <FlexibleActivities />
          <ExamBoards />
          <Subjects />
        </main>
      ) : (
        <main>
          <WeekCalendar />
        </main>
      )}
    </div>
  );
}
