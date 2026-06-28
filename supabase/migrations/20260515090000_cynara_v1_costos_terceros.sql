create table if not exists public.costos_terceros (
  id uuid primary key default gen_random_uuid(),
  proceso text not null default 'MULTIAGUJA',
  cantidad_agujas integer null,
  nombre_taller text not null default '',
  costo_unitario numeric(12,2) not null default 0,
  moneda text not null default 'PEN',
  observacion text not null default '',
  estado text not null default 'ACTIVO',
  fecharegistro timestamptz not null default now(),
  fechaactualizacion timestamptz not null default now()
);

create unique index if not exists costos_terceros_proceso_taller_uidx
on public.costos_terceros (proceso, coalesce(cantidad_agujas, 0), nombre_taller);
