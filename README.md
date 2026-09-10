# Agenda — Planificador académico y personal

App web (React + TypeScript + Vite) para cargar actividades fijas, esenciales
variables y materias con exámenes/TPs, y generar un horario semanal automático.

## Cómo correrla

```bash
npm install
npm run dev
```

## Estructura

```
src/
├── types/models.ts        # Modelos de dominio (única fuente de verdad de tipos)
├── lib/time.ts            # Utilidades de tiempo (HH:mm ↔ minutos) e IDs
├── store/usePlannerStore.ts  # Estado global (Zustand) + persistencia localStorage
├── components/ui.tsx      # Primitivas visuales compartidas
├── features/
│   ├── fixed/             # Actividades fijas (día + horario exacto, franjas por día, editable)
│   ├── flexible/          # Rutina diaria (duración, sin horario; se calcula sola si hay franja preferida)
│   ├── examBoards/        # Mesas de examen (turnos globales de la facultad)
│   ├── subjects/          # Materias, parciales/finales (finales se inscriben en una mesa), TPs
│   ├── scheduler/         # Algoritmo de asignación: relleno de huecos por prioridad
│   └── calendar/          # Vista semanal 06:00–23:59 con los bloques del scheduler
├── App.tsx                # Shell con pestañas
└── index.css              # Tokens de diseño (tema "agenda de papel técnico")
```

## Roadmap

- [x] Módulo de carga de datos
- [x] Scheduler: prioridad = f(complejidad, días restantes), relleno de huecos
- [x] Vista calendario semanal con grilla horaria
- [ ] Export/import JSON de los datos
