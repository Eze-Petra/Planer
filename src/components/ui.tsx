import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PALETTE } from "../types/models";

/** Primitivas mínimas compartidas. Si crecen, se separan en archivos. */

/** Cómo se muestran las secciones de la pestaña Datos. */
export type SectionMode = "open" | "accordion" | "modal";
export const SectionModeContext = createContext<SectionMode>("open");

function Chevron(props: { open: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={`shrink-0 transition-transform ${props.open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CardTitle(props: { title: string; subtitle?: string; badge?: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {props.badge !== undefined && (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
            {props.badge}
          </span>
        )}
      </div>
      {props.subtitle && <p className="mt-0.5 text-sm text-ink-soft">{props.subtitle}</p>}
    </div>
  );
}

export function Card(props: {
  title: string;
  subtitle?: string;
  /** Cantidad de ítems cargados, se muestra al lado del título. */
  badge?: number;
  /** Solo las secciones con `collapsible` respetan el modo desplegable / pop up. */
  collapsible?: boolean;
  children: ReactNode;
}) {
  const mode = useContext(SectionModeContext);
  const [open, setOpen] = useState(false);
  const variant = props.collapsible ? mode : "open";

  useEffect(() => {
    if (variant !== "modal" || !open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, open]);

  if (variant === "open") {
    return (
      <section className="card-light rounded-xl border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <CardTitle title={props.title} subtitle={props.subtitle} badge={props.badge} />
        </header>
        <div className="px-5 py-4">{props.children}</div>
      </section>
    );
  }

  if (variant === "accordion") {
    return (
      <section className="card-light rounded-xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex w-full items-center gap-3 px-5 py-4 text-left ${
            open ? "border-b border-line" : ""
          }`}
        >
          <CardTitle title={props.title} subtitle={open ? props.subtitle : undefined} badge={props.badge} />
          <Chevron open={open} />
        </button>
        {/* Se mantiene montado (solo oculto) para no perder lo que se está tipeando */}
        <div hidden={!open} className="px-5 py-4">{props.children}</div>
      </section>
    );
  }

  return (
    <>
      <section className="card-light rounded-xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left"
        >
          <CardTitle title={props.title} subtitle={props.subtitle} badge={props.badge} />
          <span className="shrink-0 rounded-full bg-button px-4 py-1.5 text-sm font-medium text-on-button">
            Abrir
          </span>
        </button>
      </section>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={props.title}
            className="card-light w-full max-w-3xl rounded-xl border border-line bg-surface shadow-2xl"
          >
            <header className="flex items-start gap-3 border-b border-line px-5 py-4">
              <CardTitle title={props.title} subtitle={props.subtitle} badge={props.badge} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-field hover:text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>
            <div className="px-5 py-4">{props.children}</div>
          </section>
        </div>
      )}
    </>
  );
}

export function Field(props: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${props.className ?? ""}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

export const inputClass =
  "rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink-soft/60";

export function PrimaryButton(props: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-lg bg-button px-4 py-2 text-sm font-medium text-on-button
                 transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

export function IconDelete(props: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
      className="rounded p-1 text-ink-soft transition-colors hover:text-danger"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4h8v2m-9 0v14h10V6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function IconEdit(props: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
      className="rounded p-1 text-ink-soft transition-colors hover:text-primary"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function ColorPicker(props: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Color">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={props.value === c}
          onClick={() => props.onChange(c)}
          className="h-6 w-6 rounded-full transition-transform hover:scale-110"
          style={{
            background: c,
            boxShadow: props.value === c ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${c}` : "none",
          }}
        />
      ))}
    </div>
  );
}

export function EmptyState(props: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
      {props.children}
    </p>
  );
}
