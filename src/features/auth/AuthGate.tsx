import { useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { useSession } from "./useSession";
import { useRemoteSync, type SyncStatus } from "./useRemoteSync";
import { LoginForm } from "./LoginForm";
import { ChangePasswordForm } from "./ChangePasswordForm";

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: "",
  loading: "Sincronizando…",
  synced: "Sincronizado",
  pending: "Cambios por subir",
  saving: "Guardando…",
  error:
    "No se pudo conectar con el servidor (sin internet o con el proyecto de Supabase en pausa). " +
    "Tus cambios quedan guardados en este navegador y se suben solos cuando vuelva la conexión.",
};

const STATUS_SHORT: Record<SyncStatus, string> = {
  idle: "",
  loading: "Sincronizando…",
  synced: "Sincronizado",
  pending: "Cambios por subir",
  saving: "Guardando…",
  error: "Sin conexión al servidor",
};

const STATUS_DOT: Record<SyncStatus, string> = {
  idle: "bg-ink-soft",
  loading: "bg-accent animate-pulse",
  synced: "bg-emerald-400",
  pending: "bg-accent",
  saving: "bg-accent animate-pulse",
  error: "bg-danger",
};

const UNSYNCED_LOGOUT_PROMPT =
  "Hay cambios que todavía no se pudieron subir a la nube.\n\n" +
  "Quedan guardados en este navegador y se suben la próxima vez que entres " +
  "con esta cuenta acá. Si entra otra cuenta en este navegador, se pierden.\n\n" +
  "¿Salir igual?";

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
  const { session, loading, recovering, finishRecovery } = useSession();
  const userId = session?.user.id ?? null;
  const { status, flush, clearLocal } = useRemoteSync(userId);
  const [signingOut, setSigningOut] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState(false);

  // Antes de salir se sube lo pendiente. Si todo quedó en la nube, se vacía
  // este navegador (útil en una compu compartida); si no, se avisa.
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const synced = await flush();
      if (!synced && !window.confirm(UNSYNCED_LOGOUT_PROMPT)) return;
      if (synced) clearLocal();
      await supabase?.auth.signOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (!isSupabaseConfigured) return <>{children}</>;

  if (loading) {
    return (
      <p className="px-4 py-16 text-center text-sm text-ink-soft">Cargando…</p>
    );
  }

  if (!session) return <LoginForm />;

  // Se entró con el link de "olvidé mi contraseña": la sesión ya está
  // iniciada, falta elegir la contraseña nueva.
  if (recovering) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <ChangePasswordForm
          title="Elegí una contraseña nueva"
          subtitle={`Para ${session.user.email}. La vas a usar para entrar desde cualquier dispositivo.`}
          onDone={() => {
            finishRecovery();
            setPasswordNotice(true);
          }}
          onCancel={finishRecovery}
        />
      </div>
    );
  }

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
            onClick={() => {
              setChangingPassword((v) => !v);
              setPasswordNotice(false);
            }}
            aria-expanded={changingPassword}
            className="text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            Cambiar contraseña
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            {signingOut ? "Saliendo…" : "Salir"}
          </button>
        </div>
        {passwordNotice && (
          <p className="mt-2 px-8 text-sm text-ink" role="status">
            Contraseña actualizada.
          </p>
        )}
        {changingPassword && (
          <div className="mx-auto mt-3 max-w-sm">
            <ChangePasswordForm
              title="Cambiar contraseña"
              subtitle="La nueva contraseña sirve para entrar desde cualquier dispositivo."
              onDone={() => {
                setChangingPassword(false);
                setPasswordNotice(true);
              }}
              onCancel={() => setChangingPassword(false)}
            />
          </div>
        )}
      </div>
      {children}
    </>
  );
}
