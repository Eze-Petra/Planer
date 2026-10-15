import type { ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { useSession } from "./useSession";
import { useRemoteSync, type SyncStatus } from "./useRemoteSync";
import { LoginForm } from "./LoginForm";

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: "",
  loading: "Sincronizando…",
  synced: "Sincronizado",
  saving: "Guardando…",
  error: "No se pudo sincronizar (los cambios quedan guardados en este navegador)",
};

const STATUS_SHORT: Record<SyncStatus, string> = {
  idle: "",
  loading: "Sincronizando…",
  synced: "Sincronizado",
  saving: "Guardando…",
  error: "Sin sincronizar",
};

const STATUS_DOT: Record<SyncStatus, string> = {
  idle: "bg-ink-soft",
  loading: "bg-accent animate-pulse",
  synced: "bg-emerald-400",
  saving: "bg-accent animate-pulse",
  error: "bg-danger",
};

/** "juan.perez@mail.com" → "juan perez" */
function displayName(email: string | undefined): string {
  return (email ?? "").split("@")[0].replace(/[._-]+/g, " ");
}

/**
 * Envuelve toda la app:
 * - Si no hay credenciales de Supabase configuradas, no bloquea nada: la app
 *   sigue funcionando solo con localStorage, como antes de esta migración.
 * - Si hay credenciales pero no hay sesión, muestra el login.
 * - Si hay sesión, sincroniza el store contra Supabase y muestra una barra
 *   chica con el estado de sync + botón de salir.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const userId = session?.user.id ?? null;
  const status = useRemoteSync(userId);

  if (!isSupabaseConfigured) return <>{children}</>;

  if (loading) {
    return (
      <p className="px-4 py-16 text-center text-sm text-ink-soft">Cargando…</p>
    );
  }

  if (!session) return <LoginForm />;

  return (
    <>
      <div className="px-4 pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full bg-paper py-3 pl-8 pr-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold capitalize leading-tight text-ink">
              {displayName(session.user.email)}
            </p>
            <p className="truncate text-sm leading-tight text-ink-soft">
              {session.user.email}
            </p>
          </div>

          {status === "error" && (
            <span
              className="flex items-center gap-2 text-sm text-ink-soft"
              title={STATUS_LABEL[status]}
            >
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`}
              />
              <span className="hidden sm:inline">{STATUS_SHORT[status]}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => supabase?.auth.signOut()}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-paper transition-opacity hover:opacity-90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Salir
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
