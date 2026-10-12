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

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

/** true si hay credenciales configuradas y la sync remota puede habilitarse. */
export const isSupabaseConfigured = Boolean(supabase);
