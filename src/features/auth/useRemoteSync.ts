import { useEffect, useRef, useState } from "react";
import { usePlannerStore, type SyncableData } from "../../store/usePlannerStore";
import {
  currentSyncableData, pullRemoteState, pushRemoteState, readSyncMeta, writeSyncMeta,
  type SyncMeta,
} from "../../lib/sync";

export type SyncStatus = "idle" | "loading" | "synced" | "pending" | "saving" | "error";

const PUSH_DEBOUNCE_MS = 1500;
/** Esperas entre reintentos cuando el servidor no responde (sin internet, proyecto en pausa). */
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

const EMPTY_DATA: SyncableData = { fixed: [], flexible: [], subjects: [], examBoards: [] };

const CONFLICT_PROMPT =
  "Hay cambios en este dispositivo que no se llegaron a subir, y mientras tanto " +
  "también cambiaron los datos en la nube (desde otro dispositivo).\n\n" +
  "Aceptar: quedarte con los datos de ESTE dispositivo (se pisan los de la nube).\n" +
  "Cancelar: quedarte con los de la NUBE (se descartan los cambios de acá).";

export interface SyncEngine {
  /** Sube ya lo pendiente. Devuelve true si no quedó nada sin subir. */
  flush: () => Promise<boolean>;
  /** Vacía los datos de este navegador (usar solo cuando ya están en la nube). */
  clearLocal: () => void;
  stop: () => void;
}

/**
 * Sincroniza el store contra Supabase para un usuario:
 *
 * - Cada cambio marca los datos como "sin subir" (`dirty`, en localStorage)
 *   y se sube con debounce. Mientras haya algo sin subir, lo local gana: si
 *   se cerró la pestaña antes del debounce, no había internet o Supabase
 *   estaba en pausa, se sube en la próxima oportunidad en vez de perderse.
 * - Si no hay nada pendiente, la nube manda: al abrir, al volver a la
 *   pestaña y al recuperar conexión se baja la última versión.
 * - Cada subida verifica que la nube siga como la vimos (`updated_at`); si
 *   otro dispositivo escribió en el medio, se pregunta con cuál quedarse en
 *   vez de pisarlo sin avisar.
 * - Si falla, reintenta solo con esperas crecientes.
 */
export function startSync(userId: string, setStatus: (s: SyncStatus) => void): SyncEngine {
  let stopped = false;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryAttempt = 0;
  // Cuenta ediciones locales en memoria, para saber si hubo cambios mientras
  // una subida o bajada estaba en vuelo.
  let changeCounter = 0;
  let applyingRemote = false;
  let currentRun: Promise<void> | null = null;
  let rerun = false;

  const meta = (): SyncMeta => {
    const m = readSyncMeta();
    return m && m.userId === userId ? m : { userId, dirty: false, remoteUpdatedAt: null };
  };

  const applyRemote = (data: SyncableData) => {
    applyingRemote = true;
    try {
      usePlannerStore.getState().hydrate(data);
    } finally {
      applyingRemote = false;
    }
  };

  /** Sube lo local. false = conflicto (la nube cambió desde la última vez que la vimos). */
  const pushLocal = async (force: boolean): Promise<boolean> => {
    const counterAtPush = changeCounter;
    const result = await pushRemoteState(userId, currentSyncableData(), meta().remoteUpdatedAt, force);
    if (!result.ok) return false;
    const stillDirty = changeCounter !== counterAtPush; // se editó mientras subía
    writeSyncMeta({ userId, dirty: stillDirty, remoteUpdatedAt: result.updatedAt });
    if (stillDirty) rerun = true;
    return true;
  };

  const resolveConflict = async () => {
    const remote = await pullRemoteState(userId);
    if (stopped) return;
    if (!remote || window.confirm(CONFLICT_PROMPT)) {
      await pushLocal(true);
      return;
    }
    applyRemote(remote.data);
    writeSyncMeta({ userId, dirty: false, remoteUpdatedAt: remote.updatedAt });
  };

  const syncOnce = async () => {
    if (meta().dirty) {
      setStatus("saving");
      if (!(await pushLocal(false))) await resolveConflict();
      return;
    }

    const counterAtPull = changeCounter;
    const remote = await pullRemoteState(userId);
    if (stopped) return;
    if (changeCounter !== counterAtPull) {
      // Se editó mientras bajaba: no se pisa, se sube lo local (con chequeo de conflicto).
      rerun = true;
      return;
    }
    if (!remote) {
      // Primera vez de esta cuenta: lo que haya en este navegador es el punto de partida.
      writeSyncMeta({ ...meta(), dirty: true });
      rerun = true;
      return;
    }
    if (remote.updatedAt !== meta().remoteUpdatedAt) {
      applyRemote(remote.data);
      writeSyncMeta({ userId, dirty: false, remoteUpdatedAt: remote.updatedAt });
    }
  };

  const scheduleRetry = () => {
    clearTimeout(retryTimer);
    const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
    retryAttempt++;
    retryTimer = setTimeout(runSync, delay);
  };

  /** Corre la sync de a una por vez; si se pide mientras corre, se repite al terminar. */
  function runSync(): Promise<void> {
    if (currentRun) {
      rerun = true;
      return currentRun;
    }
    currentRun = (async () => {
      try {
        do {
          rerun = false;
          await syncOnce();
        } while (rerun && !stopped);
        retryAttempt = 0;
        clearTimeout(retryTimer);
        if (!stopped) setStatus("synced");
      } catch (e) {
        console.error("Error sincronizando con Supabase:", e);
        if (!stopped) {
          setStatus("error");
          scheduleRetry();
        }
      } finally {
        currentRun = null;
      }
    })();
    return currentRun;
  }

  const schedulePush = () => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = undefined;
      runSync();
    }, PUSH_DEBOUNCE_MS);
  };

  // Datos de otra cuenta en este navegador: no se mezclan ni se le suben a esta.
  const stored = readSyncMeta();
  if (stored && stored.userId !== userId) {
    applyRemote(EMPTY_DATA);
    writeSyncMeta({ userId, dirty: false, remoteUpdatedAt: null });
  }

  const unsubscribe = usePlannerStore.subscribe((state, prevState) => {
    if (applyingRemote) return;
    const changedRelevantSlice =
      state.fixed !== prevState.fixed ||
      state.flexible !== prevState.flexible ||
      state.subjects !== prevState.subjects ||
      state.examBoards !== prevState.examBoards;
    if (!changedRelevantSlice) return;

    changeCounter++;
    writeSyncMeta({ ...meta(), dirty: true });
    setStatus("pending");
    schedulePush();
  });

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      runSync(); // trae lo que se haya cambiado desde otro dispositivo
    } else if (pushTimer) {
      // Se va de la pestaña: no esperar al debounce (si igual no llega, queda `dirty`).
      clearTimeout(pushTimer);
      pushTimer = undefined;
      runSync();
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", runSync);

  setStatus("loading");
  runSync();

  return {
    flush: async () => {
      clearTimeout(pushTimer);
      pushTimer = undefined;
      await runSync();
      return !meta().dirty;
    },
    clearLocal: () => {
      applyRemote(EMPTY_DATA);
      writeSyncMeta(null);
    },
    stop: () => {
      stopped = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", runSync);
      clearTimeout(pushTimer);
      clearTimeout(retryTimer);
    },
  };
}

/**
 * Sincroniza el store contra Supabase mientras haya un usuario logueado
 * (ver `startSync`). `localStorage` (vía el middleware `persist` del store)
 * sigue actuando como caché offline: si se corta la conexión o Supabase está
 * en pausa, la app sigue funcionando y los cambios se suben cuando vuelva.
 */
export function useRemoteSync(userId: string | null) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const engine = useRef<SyncEngine | null>(null);

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      return;
    }
    const e = startSync(userId, setStatus);
    engine.current = e;
    return () => {
      e.stop();
      engine.current = null;
    };
  }, [userId]);

  return {
    status,
    flush: () => engine.current?.flush() ?? Promise.resolve(true),
    clearLocal: () => engine.current?.clearLocal(),
  };
}
