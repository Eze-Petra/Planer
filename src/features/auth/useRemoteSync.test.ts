// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlannerStore, type SyncableData } from "../../store/usePlannerStore";
import { readSyncMeta, writeSyncMeta } from "../../lib/sync";
import { startSync, type SyncEngine, type SyncStatus } from "./useRemoteSync";

/**
 * Servidor falso en memoria que imita la tabla planner_state: una fila por
 * usuario con `updated_at` que cambia en cada escritura, y la misma regla de
 * concurrencia que `pushRemoteState` (solo escribe si `updated_at` coincide).
 */
const server = vi.hoisted(() => ({
  row: null as null | { data: unknown; updatedAt: string },
  online: true,
  clock: 0,
  /** Se ejecuta en medio de una subida, antes de escribir (simula editar mientras sube). */
  duringWrite: null as null | (() => void),
}));

vi.mock("../../lib/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));

vi.mock("../../lib/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/sync")>();
  return {
    ...actual,
    pullRemoteState: async () => {
      if (!server.online) throw new Error("offline");
      return server.row ? structuredClone(server.row) : null;
    },
    pushRemoteState: async (
      _userId: string, data: unknown, expected: string | null, force = false,
    ) => {
      if (!server.online) throw new Error("offline");
      const matches =
        force || (expected === null ? server.row === null : server.row?.updatedAt === expected);
      if (!matches) return { ok: false };
      const hook = server.duringWrite;
      server.duringWrite = null;
      hook?.();
      server.row = { data: structuredClone(data), updatedAt: `t${++server.clock}` };
      return { ok: true, updatedAt: server.row.updatedAt };
    },
  };
});

const EMPTY: SyncableData = { fixed: [], flexible: [], subjects: [], examBoards: [] };

const subjectNames = () => usePlannerStore.getState().subjects.map((s) => s.name);
const remoteSubjectNames = () =>
  ((server.row?.data as SyncableData | undefined)?.subjects ?? []).map((s) => s.name);

/** Simula que otro dispositivo escribió en la nube. */
function writeFromOtherDevice(names: string[]) {
  server.row = {
    data: { ...EMPTY, subjects: names.map((name, i) => ({ id: `r${i}`, name, color: "#000", exams: [], tasks: [] })) },
    updatedAt: `t${++server.clock}`,
  };
}

let engines: SyncEngine[] = [];
let statuses: SyncStatus[] = [];

/** Arranca el motor (como al abrir la app) y espera la primera sync. */
async function open(userId = "me") {
  const engine = startSync(userId, (s) => statuses.push(s));
  engines.push(engine);
  await engine.flush();
  return engine;
}

/** Cierra la pestaña: el motor se detiene sin esperar nada pendiente. */
function close(engine: SyncEngine) {
  engine.stop();
  engines = engines.filter((e) => e !== engine);
}

beforeEach(() => {
  localStorage.clear();
  usePlannerStore.setState(EMPTY);
  localStorage.clear(); // el setState de arriba lo vuelve a escribir vía persist
  Object.assign(server, { row: null, online: true, clock: 0, duringWrite: null });
  statuses = [];
});

afterEach(() => {
  engines.forEach((e) => e.stop());
  engines = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sync con Supabase", () => {
  it("primer login sin fila remota: sube lo que había en el navegador", async () => {
    usePlannerStore.getState().addSubject("Álgebra", "#000");
    await open();
    expect(remoteSubjectNames()).toEqual(["Álgebra"]);
    expect(readSyncMeta()?.dirty).toBe(false);
  });

  it("sin cambios pendientes, la nube manda", async () => {
    writeFromOtherDevice(["Física"]);
    await open();
    expect(subjectNames()).toEqual(["Física"]);
  });

  it("cerrar la pestaña antes del debounce no pierde el cambio", async () => {
    const tab = await open();
    usePlannerStore.getState().addSubject("Redes", "#000");
    close(tab); // antes de que pasen los 1,5 s
    expect(server.row && remoteSubjectNames()).toEqual([]);
    expect(readSyncMeta()?.dirty).toBe(true);

    await open(); // se vuelve a abrir la app
    expect(subjectNames()).toEqual(["Redes"]);
    expect(remoteSubjectNames()).toEqual(["Redes"]);
  });

  it("cambios hechos sin conexión (o con Supabase en pausa) se suben al volver", async () => {
    const tab = await open();
    server.online = false;
    usePlannerStore.getState().addSubject("Análisis", "#000");
    expect(await tab.flush()).toBe(false);
    expect(statuses.at(-1)).toBe("error");
    close(tab);

    server.online = true;
    await open();
    expect(subjectNames()).toEqual(["Análisis"]);
    expect(remoteSubjectNames()).toEqual(["Análisis"]);
  });

  it("reintenta solo cuando falla", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const tab = await open();
    server.online = false;
    usePlannerStore.getState().addSubject("Química", "#000");
    await vi.advanceTimersByTimeAsync(1_500); // debounce → falla
    expect(statuses.at(-1)).toBe("error");

    server.online = true;
    await vi.advanceTimersByTimeAsync(5_000); // primer reintento
    await tab.flush();
    expect(remoteSubjectNames()).toEqual(["Química"]);
    expect(statuses.at(-1)).toBe("synced");
  });

  it("vuelve a la pestaña: trae lo que cambió en otro dispositivo", async () => {
    await open();
    writeFromOtherDevice(["Desde el celular"]);
    document.dispatchEvent(new Event("visibilitychange")); // jsdom: visibilityState = "visible"
    await engines[0].flush();
    expect(subjectNames()).toEqual(["Desde el celular"]);
  });

  it("conflicto: si elige este dispositivo, se sube lo local", async () => {
    const tab = await open();
    writeFromOtherDevice(["Del celular"]);
    usePlannerStore.getState().addSubject("De la PC", "#000");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await tab.flush();
    expect(confirm).toHaveBeenCalledOnce();
    expect(remoteSubjectNames()).toEqual(["De la PC"]);
  });

  it("conflicto: si elige la nube, se descarta lo local", async () => {
    const tab = await open();
    writeFromOtherDevice(["Del celular"]);
    usePlannerStore.getState().addSubject("De la PC", "#000");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await tab.flush();
    expect(subjectNames()).toEqual(["Del celular"]);
    expect(remoteSubjectNames()).toEqual(["Del celular"]);
    expect(readSyncMeta()?.dirty).toBe(false);
  });

  it("una edición hecha mientras sube no se pierde", async () => {
    const tab = await open();
    usePlannerStore.getState().addSubject("Primera", "#000");
    server.duringWrite = () => usePlannerStore.getState().addSubject("Segunda", "#000");
    await tab.flush();
    expect(remoteSubjectNames()).toEqual(["Primera", "Segunda"]);
    expect(readSyncMeta()?.dirty).toBe(false);
  });

  it("datos de otra cuenta en el navegador no se suben a esta", async () => {
    usePlannerStore.getState().addSubject("De otra persona", "#000");
    writeSyncMeta({ userId: "other", dirty: true, remoteUpdatedAt: null });
    await open("me");
    expect(subjectNames()).toEqual([]);
    expect(remoteSubjectNames()).toEqual([]);
  });

  it("salir con todo subido vacía el navegador", async () => {
    const tab = await open();
    usePlannerStore.getState().addSubject("Algo", "#000");
    expect(await tab.flush()).toBe(true);
    tab.clearLocal();
    expect(subjectNames()).toEqual([]);
    expect(readSyncMeta()).toBeNull();
    expect(remoteSubjectNames()).toEqual(["Algo"]); // la nube no se toca
  });
});
