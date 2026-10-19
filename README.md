# Agenda — Planificador académico y personal

App web (React + TypeScript + Vite) para cargar actividades fijas, rutina
diaria, materias con exámenes/TPs y mesas de examen, y generar un horario
semanal automático que reparte el estudio según prioridad.

Desplegada en Vercel: https://vercel.com (ver sección **Despliegue y sincronización**
más abajo — por ahora cada navegador guarda sus propios datos en `localStorage`,
está en curso la migración a sincronización en la nube).

## Cómo correrla

```bash
npm install
npm run dev
```

Si ya está configurada la sincronización con Supabase (ver abajo), copiar
`.env.example` a `.env.local` y completar las claves antes de correr `npm run dev`.

## Estructura

```
src/
├── types/models.ts        # Modelos de dominio (única fuente de verdad de tipos)
├── lib/time.ts            # Utilidades de tiempo (HH:mm ↔ minutos) e IDs
├── store/usePlannerStore.ts  # Estado global (Zustand) + persistencia localStorage (y, a futuro, sync remoto)
├── lib/supabase.ts        # Cliente de Supabase (auth + DB) — en construcción
├── lib/sync.ts            # Lectura/escritura del estado en Supabase (tabla planner_state)
├── components/ui.tsx      # Primitivas visuales compartidas (Card con modo desplegable y badge de cantidad)
├── features/
│   ├── auth/              # Login (email + contraseña, con ver/ocultar), barra de usuario y sync remoto
│   ├── fixed/             # Actividades fijas (día + horario exacto, franjas por día, editable)
│   ├── flexible/          # Rutina diaria (duración, sin horario; se calcula sola si hay franja preferida)
│   ├── examBoards/        # Mesas de examen (turnos globales; de 1 día o por rango de semanas)
│   ├── subjects/          # Materias, parciales/finales (finales se inscriben en una mesa), TPs
│   ├── scheduler/         # Algoritmo de asignación: relleno de huecos por prioridad
│   └── calendar/          # Vista semanal 06:00–23:59 con los bloques del scheduler
├── App.tsx                # Shell con pestañas
└── index.css              # Tokens de diseño (fondo marrón, tarjetas crema, tipografía Outfit)
```

## Despliegue y sincronización entre dispositivos

Hoy la app es 100% client-side: no hay backend ni base de datos, todo vive en
el `localStorage` del navegador donde se usa. Eso significa que el deploy en
Vercel ya funciona sin prender nada en local, pero los datos **no viajan**
entre dispositivos (PC, celular, etc.) porque cada navegador tiene su propia copia.

Para resolver eso se está integrando [Supabase](https://supabase.com) (Postgres
+ Auth + cliente JS, free tier), con esta arquitectura mínima:

- **Auth**: login con email + contraseña, para que el deploy público no quede
  abierto a cualquiera y para poder identificar a qué usuario le corresponden
  los datos.
- **DB**: una sola tabla `planner_state (user_id, data jsonb, updated_at)` —
  el store de Zustand ya es un único blob JSON, así que no hace falta modelar
  tablas relacionales.
- **Sync**: al loguearse se hidrata el store desde Supabase; cada cambio se
  sube con debounce. `localStorage` queda como caché offline, no como única
  fuente de verdad.
- **Variables de entorno** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`):
  son públicas (van en el bundle del front), la seguridad real la da Row Level
  Security en Supabase. Se configuran en `.env.local` para desarrollo y en el
  dashboard de Vercel (Production + Preview) para el deploy.

Este trabajo se está haciendo en la rama `feature` y se mergea a
`main` recién cuando esté probado con un Preview Deployment de Vercel.

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

### Pendiente

- [ ] Export/import JSON de los datos
- [ ] Sincronización entre dispositivos: cerrar lo que falte
  - [ ] Botón de migración única: subir los datos locales existentes a la nube
  - [ ] Variables de entorno en Vercel (Production + Preview)
- [ ] **Importar planes de estudio** (ver más abajo)
- [ ] Marcar el resultado de un examen (aprobado / desaprobado) y agregar una nueva instancia, para que el calendario se recalcule. Baja prioridad: hoy se puede resolver cargando otra fecha de final.

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
