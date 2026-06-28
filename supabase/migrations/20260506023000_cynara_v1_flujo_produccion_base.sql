create table if not exists public.pedidos_produccion (
  id uuid primary key default gen_random_uuid(),
  codigo_pedido text not null unique,
  fecha_solicitud date,
  empresa text default '',
  modelo_base text default '',
  tipo_tela text default '',
  responsable text default '',
  estado text not null default 'pendiente',
  cancelado boolean not null default false,
  despacho_materia_prima boolean not null default false,
  op_generada boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists pedidos_produccion_fecha_idx
  on public.pedidos_produccion (fecha_solicitud desc);

create table if not exists public.ops_produccion (
  id uuid primary key default gen_random_uuid(),
  pedido_origen text not null unique,
  fecha_op date,
  empresa text default '',
  modelo_base text default '',
  tipo_tela text default '',
  estado text not null default 'borrador',
  cancelado boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists ops_produccion_fecha_idx
  on public.ops_produccion (fecha_op desc);

create table if not exists public.cortes_produccion (
  id uuid primary key default gen_random_uuid(),
  pedido_origen text not null unique,
  codigo_op text default '',
  fecha_corte date,
  empresa text default '',
  modelo_base text default '',
  tipo_tela text default '',
  estado text not null default 'borrador',
  cancelado boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists cortes_produccion_fecha_idx
  on public.cortes_produccion (fecha_corte desc);

create table if not exists public.solicitudes_materiales (
  id text primary key,
  pedido_origen text not null,
  fecha_solicitud date,
  area_origen text default '',
  tipo_solicitud text default '',
  codigo_unidad text default '',
  tipo_tela text default '',
  color_base text default '',
  estado text not null default 'pendiente',
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists solicitudes_materiales_pedido_idx
  on public.solicitudes_materiales (pedido_origen, fecha_solicitud desc);
