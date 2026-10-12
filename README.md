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
├── components/ui.tsx      # Primitivas visuales compartidas
├── features/
│   ├── fixed/             # Actividades fijas (día + horario exacto, franjas por día, editable)
│   ├── flexible/          # Rutina diaria (duración, sin horario; se calcula sola si hay franja preferida)
│   ├── examBoards/        # Mesas de examen (turnos globales; de 1 día o por rango de semanas)
│   ├── subjects/          # Materias, parciales/finales (finales se inscriben en una mesa), TPs
│   ├── scheduler/         # Algoritmo de asignación: relleno de huecos por prioridad
│   └── calendar/          # Vista semanal 06:00–23:59 con los bloques del scheduler
├── App.tsx                # Shell con pestañas
└── index.css              # Tokens de diseño (tema "agenda de papel técnico")
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

- [x] Módulo de carga de datos
- [x] Scheduler: prioridad = f(complejidad, días restantes), relleno de huecos
- [x] Vista calendario semanal con grilla horaria
- [x] Mesas de examen (globales, de 1 día o por rango) — los finales se inscriben ahí en vez de tipear una fecha suelta
- [x] Reparto proporcional del estudio: cada día se divide entre los ítems elegibles según su peso de prioridad, en vez de dárselo todo al de mayor prioridad y dejar al resto sin nada
  - Pendiente si hace falta más adelante: tope diario global de estudio, permitir más de 90 min/día cuando quedan pocos días, horas de estudio editables a mano por examen (hoy sale de complejidad × heurística fija)
- [ ] Export/import JSON de los datos
- [ ] Sincronización entre dispositivos vía Supabase (Auth + Postgres)
  - [ ] Alta de proyecto Supabase, tabla `planner_state` y políticas de RLS
  - [ ] Pantalla de login (email + contraseña)
  - [ ] Hidratar/persistir el store contra Supabase (con `localStorage` como caché offline)
  - [ ] Botón de migración única: subir los datos locales existentes a la nube
  - [ ] Variables de entorno en Vercel (Production + Preview)
