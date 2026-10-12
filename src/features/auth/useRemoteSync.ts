import { useEffect, useRef, useState } from "react";
import { usePlannerStore } from "../../store/usePlannerStore";
import { currentSyncableData, pullRemoteState, pushRemoteState } from "../../lib/sync";

export type SyncStatus = "idle" | "loading" | "synced" | "saving" | "error";

const PUSH_DEBOUNCE_MS = 1500;

/**
 * Sincroniza el store contra Supabase mientras haya un usuario logueado:
 *
 * - Al loguearse: si ya existe una fila remota, hidrata el store con ella
 *   (la nube manda). Si es el primer login y no hay fila todavía, sube lo
 *   que haya en este navegador (lo que tenía guardado en localStorage) como
 *   punto de partida — así no se pierde lo ya cargado.
 * - De ahí en más: cada cambio en fixed/flexible/subjects/examBoards se sube
 *   con un pequeño debounce, para no pegarle a la API en cada tecla.
 *
 * `localStorage` (vía el middleware `persist` del store) sigue actuando como
 * caché offline — si se corta la conexión, la app sigue funcionando igual.
 */
export function useRemoteSync(userId: string | null) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const skipNextPush = useRef(false);

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let pushTimer: ReturnType<typeof setTimeout> | undefined;

    const schedulePush = () => {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(async () => {
        try {
          setStatus("saving");
          await pushRemoteState(userId, currentSyncableData());
          if (!cancelled) setStatus("synced");
        } catch (e) {
          console.error("Error subiendo cambios a Supabase:", e);
          if (!cancelled) setStatus("error");
        }
      }, PUSH_DEBOUNCE_MS);
    };

    setStatus("loading");
    (async () => {
      try {
        const remote = await pullRemoteState(userId);
        if (cancelled) return;

        if (remote) {
          skipNextPush.current = true;
          usePlannerStore.getState().hydrate(remote);
        } else {
          await pushRemoteState(userId, currentSyncableData());
        }
        if (!cancelled) setStatus("synced");
      } catch (e) {
        console.error("Error sincronizando con Supabase:", e);
        if (!cancelled) setStatus("error");
      }
    })();

    const unsubscribe = usePlannerStore.subscribe((state, prevState) => {
      const changedRelevantSlice =
        state.fixed !== prevState.fixed ||
        state.flexible !== prevState.flexible ||
        state.subjects !== prevState.subjects ||
        state.examBoards !== prevState.examBoards;
      if (!changedRelevantSlice) return;

      if (skipNextPush.current) {
        skipNextPush.current = false;
        return;
      }
      schedulePush();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (pushTimer) clearTimeout(pushTimer);
    };
  }, [userId]);

  return status;
}
