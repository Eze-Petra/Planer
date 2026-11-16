import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase (Auth + DB) para la sincronización entre dispositivos.
 *
 * Las dos env vars son públicas a propósito (van en el bundle del navegador,
 * como cualquier clave "anon"/"publishable" de Supabase): la seguridad real
 * la dan las políticas de Row Level Security definidas en `supabase/schema.sql`,
 * no el secreto de esta clave.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — la app sigue " +
      "funcionando solo con localStorage, sin sincronizar entre dispositivos.",
  );
}

/**
 * true si la página se abrió desde el link de "olvidé mi contraseña" del mail.
 * Se lee antes de crear el cliente porque el cliente limpia el hash de la URL
 * al tomar la sesión que viene en él.
 */
export const openedFromRecoveryLink =
  typeof window !== "undefined" && window.location.hash.includes("type=recovery");

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

/** true si hay credenciales configuradas y la sync remota puede habilitarse. */
export const isSupabaseConfigured = Boolean(supabase);
