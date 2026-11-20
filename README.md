# Agenda — Planificador académico y personal

App web (React + TypeScript + Vite) para cargar actividades fijas, rutina
diaria, materias con exámenes/TPs y mesas de examen, y generar un horario
semanal automático que reparte el estudio según prioridad.

Desplegada en Vercel, con login y sincronización entre dispositivos vía
Supabase (ver sección **Despliegue y sincronización** más abajo).

## Cómo correrla

```bash
npm install
npm run dev
npm test    # tests de la sync y del scheduler (Vitest)
```

Si ya está configurada la sincronización con Supabase (ver abajo), copiar
`.env.example` a `.env.local` y completar las claves antes de correr `npm run dev`.

## Estructura

```
src/
├── types/models.ts        # Modelos de dominio (única fuente de verdad de tipos)
├── lib/time.ts            # Utilidades de tiempo (HH:mm ↔ minutos) e IDs
├── store/usePlannerStore.ts  # Estado global (Zustand) + persistencia localStorage
├── lib/supabase.ts        # Cliente de Supabase (auth + DB)
├── lib/sync.ts            # Lectura/escritura del estado en Supabase (tabla planner_state) y metadatos de sync
├── components/ui.tsx      # Primitivas visuales compartidas (Card con modo desplegable y badge de cantidad)
├── features/
│   ├── auth/              # Login (email + contraseña, con ver/ocultar), barra de usuario y sync remoto
│   ├── fixed/             # Actividades fijas (día + horario exacto, franjas por día, editable)
│   ├── flexible/          # Rutina diaria (duración, sin horario fijo; opcionalmente dentro de una franja preferida)
│   ├── examBoards/        # Mesas de examen (turnos globales; de 1 día o por rango de semanas)
│   ├── subjects/          # Materias, parciales/finales (finales se inscriben en una mesa), TPs
│   ├── scheduler/         # Algoritmo de asignación: relleno de huecos por prioridad, con avisos de lo que no entra
│   └── calendar/          # Vista semanal 06:00–23:59 con los bloques y avisos del scheduler
├── App.tsx                # Shell con pestañas
└── index.css              # Tokens de diseño (fondo marrón, tarjetas crema, tipografía Outfit)
```

## Despliegue y sincronización entre dispositivos

Los datos se sincronizan entre dispositivos con [Supabase](https://supabase.com)
(Postgres + Auth + cliente JS, free tier). Sin las variables de entorno, la app
funciona igual pero solo con `localStorage`. Arquitectura:

- **Auth**: login con email + contraseña, para que el deploy público no quede
  abierto a cualquiera y para poder identificar a qué usuario le corresponden
  los datos.
- **DB**: una sola tabla `planner_state (user_id, data jsonb, updated_at)` —
  el store de Zustand ya es un único blob JSON, así que no hace falta modelar
  tablas relacionales.
- **Sync** (`src/features/auth/useRemoteSync.ts`): cada cambio se marca como
  "sin subir" en `localStorage` y se sube con debounce. Mientras haya algo
  sin subir (pestaña cerrada antes de tiempo, sin internet, Supabase en
  pausa), lo local gana y se reintenta solo. Si no hay nada pendiente, manda
  la nube: se baja al abrir, al volver a la pestaña y al recuperar conexión.
  Cada subida verifica `updated_at`; si otro dispositivo escribió en el medio,
  se pregunta con qué versión quedarse en vez de pisarla. Al salir se sube lo
  pendiente y se vacía el navegador; los datos de otra cuenta nunca se suben.
- **Keep-alive**: el plan gratis de Supabase pausa el proyecto tras ~1 semana
  sin uso. Un Vercel Cron diario (`vercel.json` → `api/keepalive.js`) hace una
  consulta a la base para evitarlo.
- **Variables de entorno** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`):
  son públicas (van en el bundle del front), la seguridad real la da Row Level
  Security en Supabase. Se configuran en `.env.local` para desarrollo y en el
  dashboard de Vercel (Production + Preview) para el deploy. El keep-alive
  también las lee en runtime.

## Roadmap

### Hecho

- [x] Módulo de carga de datos
- [x] Scheduler: prioridad = f(complejidad, días restantes), relleno de huecos
- [x] Vista calendario semanal con grilla horaria
- [x] Mesas de examen (globales, de 1 día o por rango) — los finales se inscriben ahí en vez de tipear una fecha suelta
- [x] Reparto proporcional del estudio: cada día se divide entre los ítems elegibles según su peso de prioridad, en vez de dárselo todo al de mayor prioridad y dejar al resto sin nada
  - Pendiente si hace falta más adelante: tope diario global de estudio, permitir más de 90 min/día cuando quedan pocos días, horas de estudio editables a mano por examen (hoy sale de complejidad × heurística fija)
- [x] Login con Supabase (email + contraseña, con opción de ver la contraseña)
- [x] Hidratar/persistir el store contra Supabase, con `localStorage` como caché
- [x] Rediseño visual: fondo marrón, tarjetas crema, tipografía Outfit y favicon
- [x] Secciones de la pestaña Datos desplegables, con badge que muestra cuántos ítems hay cargados
- [x] Sync robusta: cambios pendientes no se pierden, detección de conflictos entre dispositivos, reintentos y keep-alive de Supabase
- [x] Primer login sube solo los datos que ya había en el navegador (reemplaza la idea del botón de migración única)
- [x] Recuperar contraseña por mail y cambiarla desde la barra de usuario
- [x] Avisos en el calendario de lo que no entró: rutina sin hueco, rutina fuera de su franja, estudio que no llega antes del examen
- [x] Rutina con franja preferida: la duración es independiente de la franja ("45 min entre 12 y 15") y, si no entra, va al hueco más cercano
- [x] Tests con Vitest (`npm test`): sync y scheduler

### Pendiente

Ordenado por prioridad (sale de la revisión general del proyecto de noviembre 2026).

**Exámenes** (detalle en **Idea: exámenes por materia, resultados y pestaña Fechas**, más abajo)
- [ ] Separar parciales y finales dentro de cada materia, cada uno con su formulario
- [ ] Resultado de un examen (aprobado / desaprobado / ausente, nota opcional)
- [ ] Pestaña "Fechas" con todas las materias y sus parciales, recuperatorios y finales

**Datos y edición**
- [ ] Confirmar o deshacer al borrar (hoy borrar una materia se lleva todos sus exámenes y TPs de un clic)
- [ ] Editar rutinas, materias, exámenes y TPs (hoy solo se editan las actividades fijas; `updateFlexible` y `updateSubject` existen en el store pero sin UI)
- [ ] Export/import JSON de los datos (backup independiente de Supabase)
- [ ] Guardar `version` dentro del blob remoto, para poder migrar también los datos de la nube si cambia el modelo

**Calendario y scheduler**
- [ ] Mostrar los días de examen y entrega en el calendario
- [ ] Navegar entre semanas (◀ ▶); el scheduler ya recibe `now`
- [ ] Vista por día en celular (hoy la grilla de 720 px obliga a scrollear de costado)
- [ ] Avisar cuando dos actividades fijas se pisan (hoy se dibujan una encima de la otra)
- [ ] Llevar la cuenta del estudio hecho: cada semana se recalcula desde cero con el total de horas del examen o crear un apartado para poder cargar progreso de estudio (formato barra o similar)
- [ ] Estimación de mesas ("vas bien / no llegás") más realista: hoy no considera el tope de 90 min por sesión ni los parciales que compiten por el mismo tiempo
- [ ] Rutinas con franja que cruza la medianoche

**UX menor**
- [ ] Recordar qué tarjetas desplegables quedaron abiertas
- [ ] Traducir los mensajes de error de Supabase (hoy salen en inglés)

**Herramientas y seguridad**
- [ ] ESLint y CI que corra `tsc` + tests antes de deployar
- [ ] Desactivar el registro público en Supabase si la app es solo para uso personal
- [ ] Verificar que el keep-alive corre bien (Vercel → Settings → Cron Jobs)

**Ideas**
- [ ] **Importar planes de estudio** (ver más abajo)

## Idea: exámenes por materia, resultados y pestaña Fechas

Tres cambios relacionados sobre cómo se cargan y siguen los exámenes. Conviene
hacerlos en este orden, porque la pestaña Fechas muestra lo que agregan los
dos primeros.

**1. Parciales y finales separados dentro de cada materia**

Hoy cada materia tiene un único formulario de examen que cambia según se
elija "Parcial" o "Final". La idea es que la tarjeta de la materia tenga dos
bloques, **Parciales** y **Finales**, cada uno con su lista y su formulario:
el de parciales pide una fecha y el de finales pide elegir una mesa.

Se descartó hacer secciones globales aparte ("Finales", "Parciales") donde
se elige la materia: duplica el lugar donde se carga lo mismo y obliga a
elegir la materia cada vez. La vista de todas las materias juntas la da la
pestaña Fechas.

**2. Resultado de cada examen**

- Cuando la fecha ya pasó, el examen muestra botones **Aprobado /
  Desaprobado / Ausente**, con nota opcional.
- Un examen con resultado deja de generar estudio en el calendario.
- Parcial desaprobado → botón "Agregar recuperatorio". Final desaprobado o
  ausente → "Anotarse en otra mesa".
- Final aprobado → la materia queda marcada como aprobada.

Cambio de modelo: `Exam` suma `result?` y `grade?`.

**3. Pestaña "Fechas"**

Una tercera pestaña, junto a Datos y Calendario, con una tabla:

| Materia  | Parcial 1 | Parcial 2 | Recuperatorio | Final  |
|----------|-----------|-----------|---------------|--------|
| Redes    | 12/09 ✓   | 24/10 ✗   | 07/11 ✓       | 15/12  |
| Sistemas | 20/09 ✓   | en 5 días | —             | —      |

- Cada celda muestra la fecha, los días que faltan si es futura y el
  resultado con un color (aprobado / desaprobado / ausente).
- En celular, la tabla no entra a lo ancho: se muestra una tarjeta por materia.

**Decisiones abiertas**

- ¿El recuperatorio es un tipo propio de examen (Parcial / Recuperatorio /
  Final)? Recomendado: sí, así la tabla sabe en qué columna va.
- ¿Los parciales se numeran solos por fecha (el primero es "Parcial 1")? ¿O
  se les pone nombre a mano? Recomendado: numeración automática, con nombre
  opcional.
- Si una materia tiene más de dos parciales, ¿la tabla agrega columnas o se
  fija en dos?

## Idea: importar planes de estudio

Poder pedirle a Claude (u otra IA) un plan, o armarlo a mano, importarlo y que el
calendario lo acomode en los huecos libres. Ejemplo: "aprender ciberseguridad
a partir de lo que ya sé y de lo nuevo".

**Cómo funcionaría**

1. La app ofrece un botón **"Copiar prompt"** con las instrucciones y el formato
   esperado. El usuario lo pega en la IA que prefiera y le agrega su contexto
   (qué sabe, cuántas horas por semana tiene, el objetivo).
2. La IA devuelve un JSON, que el usuario pega en la app (o sube como archivo).
3. La app lo valida, muestra una vista previa y, si todo está bien, lo guarda
   como un plan.
4. El scheduler ubica las tareas del plan en los huecos libres, respetando
   actividades fijas, rutina, exámenes y estudio de materias.

No usa la API de ninguna IA: nada de claves, costos ni backend nuevo.

**Formato (borrador)**

Un plan es una lista de tareas, sin horarios fijos:

```json
{
  "name": "Ciberseguridad",
  "tasks": [
    { "title": "Fundamentos de redes y criptografía", "durationMin": 90, "order": 1 },
    { "title": "Laboratorio de análisis de tráfico", "durationMin": 120, "order": 2, "dependsOn": [1] },
    { "title": "Informe final", "durationMin": 60, "order": 3, "deadline": "2026-12-15" }
  ]
}
```

Campos: `title` y `durationMin` obligatorios; `order`, `dependsOn` y `deadline`
opcionales.

**Decisiones abiertas**

- **Prioridad:** cuando un plan compite con el estudio de un final, ganan los
  exámenes; los planes quedan con prioridad baja.
- **Lo que no entra:** las tareas que no se puedan ubicar se muestran como
  "sin ubicar". Nunca se descartan en silencio.
- **Validación:** el JSON de una IA suele venir con errores, así que hacen falta
  mensajes de error claros indicando qué campo falla.
- **Reutilización:** primero revisar cómo reparte hoy el estudio el scheduler
  (`src/features/scheduler/`) para ver cuánto se puede reaprovechar.
- **Integración directa por API con una IA:** queda para más adelante.
