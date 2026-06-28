create table if not exists public.salidas_taller (
  id_salida text primary key,
  codigo_op text default '',
  codigo_salida text default '',
  parent_item_id text default '',
  nombre_taller text default '',
  fecha_envio date,
  fecha_entrega date,
  estado text not null default 'pendiente',
  servicio_a_terceros boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists salidas_taller_op_fecha_idx
  on public.salidas_taller (codigo_op, fecha_envio desc);

create table if not exists public.recepciones_taller (
  id_recepcion text primary key,
  codigo_op text default '',
  codigo_salida text default '',
  nombre_taller text default '',
  fecha_recepcion date,
  tipo_recepcion text default '',
  estado text not null default 'pendiente',
  aprobado_calidad boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists recepciones_taller_op_fecha_idx
  on public.recepciones_taller (codigo_op, fecha_recepcion desc);

create table if not exists public.solicitudes_procesos_externos (
  id_proceso text primary key,
  codigo_op text default '',
  proceso text default '',
  taller_tercero text default '',
  fecha_solicitud date,
  estado text not null default 'pendiente',
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists procesos_externos_op_fecha_idx
  on public.solicitudes_procesos_externos (codigo_op, fecha_solicitud desc);

create table if not exists public.descuentos_taller (
  id_descuento text primary key,
  registro_id text default '',
  codigo_op text default '',
  nombre_taller text default '',
  fecha_descuento date,
  monto_descuento numeric(12,2) not null default 0,
  origen_descuento text default '',
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists descuentos_taller_registro_idx
  on public.descuentos_taller (registro_id, fecha_descuento desc);

create table if not exists public.ajustes_recepcion_produccion (
  id_ajuste text primary key,
  codigo_op text default '',
  fecha_registro date,
  estado text not null default 'pendiente',
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists ajustes_recepcion_op_idx
  on public.ajustes_recepcion_produccion (codigo_op, fecha_registro desc);

create table if not exists public.acondicionado_producto_terminado (
  recepcion_id text primary key,
  codigo_op text default '',
  codigo_salida text default '',
  fecha_recepcion date,
  estado text not null default 'pendiente',
  total_apto integer not null default 0,
  total_incidencias integer not null default 0,
  total_remate integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists acondicionado_pt_op_fecha_idx
  on public.acondicionado_producto_terminado (codigo_op, fecha_recepcion desc);

create table if not exists public.remates_producto_terminado (
  recepcion_id text primary key,
  codigo_op text default '',
  codigo_salida text default '',
  fecha_recepcion date,
  total_remate integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists remates_pt_op_fecha_idx
  on public.remates_producto_terminado (codigo_op, fecha_recepcion desc);

create table if not exists public.productos_terminados_stock (
  clave_producto text primary key,
  codigo_producto text default '',
  codigo_corto text default '',
  modelo text default '',
  color_base text default '',
  talla text default '',
  stock_actual integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists productos_terminados_stock_modelo_idx
  on public.productos_terminados_stock (modelo, color_base, talla);

create table if not exists public.movimientos_productos_terminados (
  id_movimiento text primary key,
  clave_producto text default '',
  codigo_producto text default '',
  codigo_op text default '',
  salida_id text default '',
  recepcion_id text default '',
  fecha_movimiento date,
  tipo_movimiento text default '',
  cantidad integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists movimientos_pt_fecha_idx
  on public.movimientos_productos_terminados (fecha_movimiento desc, tipo_movimiento);

create table if not exists public.lotes_productos_terminados (
  lote_id text primary key,
  clave_producto text default '',
  codigo_producto text default '',
  codigo_op text default '',
  fecha_ingreso date,
  stock_actual_lote integer not null default 0,
  cantidad_ingresada_total integer not null default 0,
  cantidad_salida_total integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists lotes_pt_fifo_idx
  on public.lotes_productos_terminados (fecha_ingreso asc, codigo_op asc);

create table if not exists public.ventas_almacen_producto_terminado (
  id_venta text primary key,
  fecha_venta date,
  canal text default '',
  cliente text default '',
  tipo_comprobante text default '',
  total_prendas integer not null default 0,
  total_venta numeric(12,2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists ventas_almacen_pt_fecha_idx
  on public.ventas_almacen_producto_terminado (fecha_venta desc);

alter table public.pedidos_produccion enable row level security;
alter table public.ops_produccion enable row level security;
alter table public.cortes_produccion enable row level security;
alter table public.solicitudes_materiales enable row level security;
alter table public.salidas_taller enable row level security;
alter table public.recepciones_taller enable row level security;
alter table public.solicitudes_procesos_externos enable row level security;
alter table public.descuentos_taller enable row level security;
alter table public.ajustes_recepcion_produccion enable row level security;
alter table public.acondicionado_producto_terminado enable row level security;
alter table public.remates_producto_terminado enable row level security;
alter table public.productos_terminados_stock enable row level security;
alter table public.movimientos_productos_terminados enable row level security;
alter table public.lotes_productos_terminados enable row level security;
alter table public.ventas_almacen_producto_terminado enable row level security;

drop policy if exists "pedidos_produccion_all_authenticated" on public.pedidos_produccion;
create policy "pedidos_produccion_all_authenticated"
on public.pedidos_produccion for all
to authenticated
using (true)
with check (true);

drop policy if exists "ops_produccion_all_authenticated" on public.ops_produccion;
create policy "ops_produccion_all_authenticated"
on public.ops_produccion for all
to authenticated
using (true)
with check (true);

drop policy if exists "cortes_produccion_all_authenticated" on public.cortes_produccion;
create policy "cortes_produccion_all_authenticated"
on public.cortes_produccion for all
to authenticated
using (true)
with check (true);

drop policy if exists "solicitudes_materiales_all_authenticated" on public.solicitudes_materiales;
create policy "solicitudes_materiales_all_authenticated"
on public.solicitudes_materiales for all
to authenticated
using (true)
with check (true);

drop policy if exists "salidas_taller_all_authenticated" on public.salidas_taller;
create policy "salidas_taller_all_authenticated"
on public.salidas_taller for all
to authenticated
using (true)
with check (true);

drop policy if exists "recepciones_taller_all_authenticated" on public.recepciones_taller;
create policy "recepciones_taller_all_authenticated"
on public.recepciones_taller for all
to authenticated
using (true)
with check (true);

drop policy if exists "procesos_externos_all_authenticated" on public.solicitudes_procesos_externos;
create policy "procesos_externos_all_authenticated"
on public.solicitudes_procesos_externos for all
to authenticated
using (true)
with check (true);

drop policy if exists "descuentos_taller_all_authenticated" on public.descuentos_taller;
create policy "descuentos_taller_all_authenticated"
on public.descuentos_taller for all
to authenticated
using (true)
with check (true);

drop policy if exists "ajustes_recepcion_all_authenticated" on public.ajustes_recepcion_produccion;
create policy "ajustes_recepcion_all_authenticated"
on public.ajustes_recepcion_produccion for all
to authenticated
using (true)
with check (true);

drop policy if exists "acondicionado_pt_all_authenticated" on public.acondicionado_producto_terminado;
create policy "acondicionado_pt_all_authenticated"
on public.acondicionado_producto_terminado for all
to authenticated
using (true)
with check (true);

drop policy if exists "remates_pt_all_authenticated" on public.remates_producto_terminado;
create policy "remates_pt_all_authenticated"
on public.remates_producto_terminado for all
to authenticated
using (true)
with check (true);

drop policy if exists "productos_stock_all_authenticated" on public.productos_terminados_stock;
create policy "productos_stock_all_authenticated"
on public.productos_terminados_stock for all
to authenticated
using (true)
with check (true);

drop policy if exists "movimientos_pt_all_authenticated" on public.movimientos_productos_terminados;
create policy "movimientos_pt_all_authenticated"
on public.movimientos_productos_terminados for all
to authenticated
using (true)
with check (true);

drop policy if exists "lotes_pt_all_authenticated" on public.lotes_productos_terminados;
create policy "lotes_pt_all_authenticated"
on public.lotes_productos_terminados for all
to authenticated
using (true)
with check (true);

drop policy if exists "ventas_almacen_pt_all_authenticated" on public.ventas_almacen_producto_terminado;
create policy "ventas_almacen_pt_all_authenticated"
on public.ventas_almacen_producto_terminado for all
to authenticated
using (true)
with check (true);
