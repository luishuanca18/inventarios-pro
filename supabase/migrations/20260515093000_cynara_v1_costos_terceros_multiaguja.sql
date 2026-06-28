alter table if exists public.costos_terceros
add column if not exists cantidad_agujas integer null;

drop index if exists public.costos_terceros_proceso_taller_uidx;

create unique index if not exists costos_terceros_proceso_taller_uidx
on public.costos_terceros (proceso, coalesce(cantidad_agujas, 0), nombre_taller);
