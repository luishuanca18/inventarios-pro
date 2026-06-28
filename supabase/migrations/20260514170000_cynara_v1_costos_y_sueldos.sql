create table if not exists public.costos_taller_modelo (
  id uuid primary key default gen_random_uuid(),
  modelo text not null default '',
  codigo_modelo text not null default '',
  nombre_taller text not null default '',
  costo_unitario numeric(12,2) not null default 0,
  moneda text not null default 'PEN',
  observacion text not null default '',
  estado text not null default 'ACTIVO',
  fecharegistro timestamptz not null default now(),
  fechaactualizacion timestamptz not null default now()
);

create unique index if not exists costos_taller_modelo_codigo_taller_uidx
on public.costos_taller_modelo (codigo_modelo, nombre_taller);

create table if not exists public.sueldos_personal (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  correo text not null default '',
  nombre_personal text not null default '',
  cargo text not null default '',
  area text not null default '',
  sueldo_mensual numeric(12,2) not null default 0,
  moneda text not null default 'PEN',
  fecha_inicio date null,
  estado text not null default 'ACTIVO',
  observacion text not null default '',
  fecharegistro timestamptz not null default now(),
  fechaactualizacion timestamptz not null default now()
);

create unique index if not exists sueldos_personal_clave_uidx
on public.sueldos_personal (clave);
