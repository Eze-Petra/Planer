import { supabase } from "./supabase";
import { usePlannerStore, type SyncableData } from "../store/usePlannerStore";

const TABLE = "planner_state";
const META_KEY = "planner-sync-meta";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

/** Fila remota tal como está en Supabase. */
export interface RemoteSnapshot {
  data: SyncableData;
  /** Lo pone el trigger de la tabla en cada escritura; sirve para detectar conflictos. */
  updatedAt: string;
}

/**
 * Trae la fila del usuario. `null` si todavía no tiene fila (primer login:
 * no migró errores, simplemente no sincronizó nunca antes).
 */
export async function pullRemoteState(userId: string): Promise<RemoteSnapshot | null> {
  const { data, error } = await client()
    .from(TABLE)
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? { data: data.data as SyncableData, updatedAt: data.updated_at as string } : null;
}

export type PushResult = { ok: true; updatedAt: string } | { ok: false };

/**
 * Sube el estado solo si la fila remota sigue igual que la última vez que
 * este navegador la vio (`expectedUpdatedAt`; `null` = se espera que la fila
 * todavía no exista). Si otro dispositivo escribió en el medio devuelve
 * `{ ok: false }` en vez de pisarlo. Con `force` sube sin chequear.
 */
export async function pushRemoteState(
  userId: string,
  data: SyncableData,
  expectedUpdatedAt: string | null,
  force = false,
): Promise<PushResult> {
  if (force) {
    const { data: row, error } = await client()
      .from(TABLE)
      .upsert({ user_id: userId, data }, { onConflict: "user_id" })
      .select("updated_at")
      .single();
    if (error) throw error;
    return { ok: true, updatedAt: row.updated_at as string };
  }

  if (expectedUpdatedAt === null) {
    const { data: row, error } = await client()
      .from(TABLE)
      .insert({ user_id: userId, data })
      .select("updated_at")
      .single();
    if (error?.code === "23505") return { ok: false }; // ya hay una fila que este navegador no vio
    if (error) throw error;
    return { ok: true, updatedAt: row.updated_at as string };
  }

  const { data: rows, error } = await client()
    .from(TABLE)
    .update({ data })
    .eq("user_id", userId)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at");
  if (error) throw error;
  if (rows.length === 0) return { ok: false };
  return { ok: true, updatedAt: rows[0].updated_at as string };
}

/** Snapshot actual del store, listo para subir. */
export function currentSyncableData(): SyncableData {
  const { fixed, flexible, subjects, examBoards } = usePlannerStore.getState();
  return { fixed, flexible, subjects, examBoards };
}

/**
 * Estado de la sync guardado en localStorage, junto a los datos:
 * - `userId`: de quién son los datos que hay en este navegador.
 * - `dirty`: hay cambios locales que todavía no llegaron a la nube (se
 *   cerró la pestaña antes del debounce, no había internet, Supabase en
 *   pausa…). Mientras esté en true, lo local gana sobre lo remoto.
 * - `remoteUpdatedAt`: `updated_at` de la última versión remota que este
 *   navegador vio o escribió.
 */
export interface SyncMeta {
  userId: string;
  dirty: boolean;
  remoteUpdatedAt: string | null;
}

export function readSyncMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as SyncMeta) : null;
  } catch {
    return null;
  }
}

export function writeSyncMeta(meta: SyncMeta | null): void {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {
    // Sin localStorage (modo privado estricto): la sync sigue andando, solo
    // que sin recordar cambios pendientes entre recargas.
  }
}
