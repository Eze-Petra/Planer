-- Esquema para la sincronización del planificador entre dispositivos.
-- Pegar y correr esto en el SQL Editor de Supabase (Project → SQL Editor).
-- No requiere la service_role key: se corre con tu usuario de owner del proyecto.

-- Una sola tabla: el store de la app ya es un blob JSON único
-- (fixed, flexible, subjects, examBoards), así que no hace falta modelar
-- tablas relacionales — alcanza con guardar/leer ese blob por usuario.
create table if not exists public.planner_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: cada usuario autenticado solo puede leer y escribir
-- su propia fila. Sin esto, cualquiera con la anon/publishable key podría
-- leer o pisar los datos de otro usuario.
alter table public.planner_state enable row level security;

drop policy if exists "select own row" on public.planner_state;
create policy "select own row"
  on public.planner_state for select
  using (auth.uid() = user_id);

drop policy if exists "insert own row" on public.planner_state;
create policy "insert own row"
  on public.planner_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own row" on public.planner_state;
create policy "update own row"
  on public.planner_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Mantener updated_at al día en cada escritura, sin depender de que el
-- cliente lo mande bien.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_planner_state_updated_at on public.planner_state;
create trigger set_planner_state_updated_at
  before update on public.planner_state
  for each row
  execute function public.set_updated_at();
