create table if not exists public.modelos_producto (
  id uuid primary key default gen_random_uuid(),
  codigo_modelo text not null unique,
  nombre_modelo text not null,
  nombre_normalizado text not null unique,
  estado text not null default 'ACTIVO',
  metadata jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.modelos_producto_variantes (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.modelos_producto(id) on delete cascade,
  codigo_modelo text not null,
  codigo_variante text not null unique,
  nombre_modelo text not null,
  color text not null,
  color_normalizado text not null,
  talla text not null,
  talla_normalizada text not null,
  descripcion_variante text not null,
  estado text not null default 'ACTIVO',
  metadata jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now()),
  unique (modelo_id, color_normalizado, talla_normalizada)
);

create index if not exists modelos_producto_estado_idx
  on public.modelos_producto (estado);

create index if not exists modelos_producto_nombre_idx
  on public.modelos_producto (nombre_modelo);

create index if not exists modelos_producto_variantes_modelo_idx
  on public.modelos_producto_variantes (modelo_id);

create index if not exists modelos_producto_variantes_codigo_modelo_idx
  on public.modelos_producto_variantes (codigo_modelo);

create index if not exists modelos_producto_variantes_busqueda_idx
  on public.modelos_producto_variantes (nombre_modelo, color_normalizado, talla_normalizada);

create or replace trigger set_updated_at_modelos_producto
before update on public.modelos_producto
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_modelos_producto_variantes
before update on public.modelos_producto_variantes
for each row execute function public.set_updated_at();

alter table public.modelos_producto enable row level security;
alter table public.modelos_producto_variantes enable row level security;

create policy "modelos_producto_all_authenticated"
on public.modelos_producto for all
to authenticated
using (true)
with check (true);

create policy "modelos_producto_variantes_all_authenticated"
on public.modelos_producto_variantes for all
to authenticated
using (true)
with check (true);
