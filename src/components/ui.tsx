import type { ReactNode } from "react";
import { PALETTE } from "../types/models";

/** Primitivas mínimas compartidas. Si crecen, se separan en archivos. */

export function Card(props: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-paper shadow-[0_1px_2px_rgba(28,34,48,0.06)]">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {props.subtitle && (
          <p className="mt-0.5 text-sm text-ink-soft">{props.subtitle}</p>
        )}
      </header>
      <div className="px-5 py-4">{props.children}</div>
    </section>
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
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink " +
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
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white
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
            boxShadow: props.value === c ? `0 0 0 2px var(--color-paper), 0 0 0 4px ${c}` : "none",
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
