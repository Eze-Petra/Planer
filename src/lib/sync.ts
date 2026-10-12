import { supabase } from "./supabase";
import { usePlannerStore, type SyncableData } from "../store/usePlannerStore";

const TABLE = "planner_state";

function getSyncableData(): SyncableData {
  const { fixed, flexible, subjects, examBoards } = usePlannerStore.getState();
  return { fixed, flexible, subjects, examBoards };
}

/**
 * Trae la fila del usuario. `null` si todavía no tiene fila (primer login:
 * no migró errores, simplemente no sincronizó nunca antes).
 */
export async function pullRemoteState(userId: string): Promise<SyncableData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.data as SyncableData | undefined) ?? null;
}

export async function pushRemoteState(userId: string, data: SyncableData): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Snapshot actual del store, listo para subir. */
export function currentSyncableData(): SyncableData {
  return getSyncableData();
}
