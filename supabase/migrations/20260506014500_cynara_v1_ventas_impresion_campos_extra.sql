alter table if exists public.configuracion_ventas_impresion
  add column if not exists modo_impresion text not null default 'VISTA',
  add column if not exists mostrar_codigo_corto boolean not null default true,
  add column if not exists mostrar_igv boolean not null default true,
  add column if not exists mostrar_total boolean not null default true;
