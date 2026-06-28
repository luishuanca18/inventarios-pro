create table if not exists public.correlativos_sistema (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  prefijo text not null default '',
  formato text not null default 'DDMMAA-01',
  alcance text not null default 'ANUAL',
  anio_actual integer not null default (extract(year from now())::integer),
  ultimo_correlativo integer not null default 0,
  siguiente_forzado integer not null default 0,
  activo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists correlativos_sistema_clave_idx
  on public.correlativos_sistema (clave);

create or replace trigger set_updated_at_correlativos_sistema
before update on public.correlativos_sistema
for each row
execute function public.set_updated_at();

alter table public.correlativos_sistema enable row level security;

drop policy if exists "correlativos_sistema_all_authenticated" on public.correlativos_sistema;
create policy "correlativos_sistema_all_authenticated"
on public.correlativos_sistema for all
to authenticated
using (true)
with check (true);

insert into public.correlativos_sistema
  (clave, nombre, prefijo, formato, alcance, anio_actual, ultimo_correlativo, siguiente_forzado, activo, metadata)
values
  ('PEDIDO_PRODUCCION', 'Pedidos de produccion', 'PED', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"PRODUCCION","submodulo":"PEDIDOS"}'::jsonb),
  ('OP_PRODUCCION', 'Ordenes de produccion', 'OP', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"PRODUCCION","submodulo":"CORTES"}'::jsonb),
  ('INGRESO_MATERIA_PRIMA', 'Ingresos de materia prima', 'CMP', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"ALMACEN","submodulo":"INGRESO_MATERIA_PRIMA"}'::jsonb),
  ('SALIDA_TALLER', 'Salidas a taller', 'SAL', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"PRODUCCION","submodulo":"SALIDA_TALLER"}'::jsonb),
  ('RECEPCION_TALLER', 'Recepciones de taller', 'REC', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"PRODUCCION","submodulo":"RECEPCIONES"}'::jsonb),
  ('SALIDA_TIENDA', 'Salidas a tienda', 'TIE', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"TIENDAS","submodulo":"SALIDAS"}'::jsonb),
  ('VENTA_TIENDA', 'Ventas de tienda', 'VTI', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"TIENDAS","submodulo":"VENTAS"}'::jsonb),
  ('CAMBIO_VENTA', 'Cambios de venta', 'CVT', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"ALMACEN","submodulo":"CAMBIOS_VENTA"}'::jsonb),
  ('TERCERIZACION', 'Tercerizaciones', 'TER', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"PRODUCCION","submodulo":"TERCERIZACIONES"}'::jsonb),
  ('DEVOLUCION_PRODUCCION', 'Devoluciones de produccion', 'DEV', 'DDMMAA-01', 'ANUAL', extract(year from now())::integer, 0, 0, true, '{"modulo":"ALMACEN","submodulo":"DEVOLUCIONES"}'::jsonb)
on conflict (clave) do update
set
  nombre = excluded.nombre,
  prefijo = excluded.prefijo,
  formato = excluded.formato,
  alcance = excluded.alcance,
  activo = excluded.activo,
  metadata = excluded.metadata;
