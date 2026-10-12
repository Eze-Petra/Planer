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
      <div className="flex items-center justify-between gap-3 border-b border-line bg-paper-2 px-4 py-1.5 text-xs text-ink-soft">
        <span>
          {session.user.email} · {STATUS_LABEL[status]}
        </span>
        <button
          type="button"
          onClick={() => supabase?.auth.signOut()}
          className="underline-offset-2 hover:underline"
        >
          Salir
        </button>
      </div>
      {children}
    </>
  );
}
