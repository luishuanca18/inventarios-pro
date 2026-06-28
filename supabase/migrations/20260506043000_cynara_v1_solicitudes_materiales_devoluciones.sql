alter table public.solicitudes_materiales
  add column if not exists tipo_devolucion text default '',
  add column if not exists motivo text default '',
  add column if not exists peso_devuelto numeric(12,2) not null default 0,
  add column if not exists peso_enviado numeric(12,2) not null default 0,
  add column if not exists peso_usado numeric(12,2) not null default 0,
  add column if not exists unidad_control text default 'KG';

create index if not exists solicitudes_materiales_tipo_devolucion_idx
  on public.solicitudes_materiales (tipo_devolucion, estado);
