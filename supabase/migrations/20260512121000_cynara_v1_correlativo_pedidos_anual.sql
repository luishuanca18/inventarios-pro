alter table public.configuracion_empresa
add column if not exists anio_correlativo_pedido integer not null default (extract(year from now())::integer);

alter table public.configuracion_empresa
add column if not exists ultimo_correlativo_pedido integer not null default 0;

alter table public.configuracion_empresa
add column if not exists siguiente_correlativo_pedido_forzado integer not null default 0;

update public.configuracion_empresa
set
  anio_correlativo_pedido = coalesce(anio_correlativo_pedido, extract(year from now())::integer),
  ultimo_correlativo_pedido = coalesce(ultimo_correlativo_pedido, 0),
  siguiente_correlativo_pedido_forzado = coalesce(siguiente_correlativo_pedido_forzado, 0);
