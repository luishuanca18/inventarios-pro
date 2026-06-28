alter table public.modelos_producto
  add column if not exists codigo_corto text not null default '',
  add column if not exists origen_carga text not null default '';

alter table public.modelos_producto_variantes
  add column if not exists codigo_corto text not null default '',
  add column if not exists origen_carga text not null default '';

create index if not exists modelos_producto_codigo_corto_idx
  on public.modelos_producto (codigo_corto);

create index if not exists modelos_producto_origen_carga_idx
  on public.modelos_producto (origen_carga);

create index if not exists modelos_producto_variantes_codigo_corto_idx
  on public.modelos_producto_variantes (codigo_corto);

create index if not exists modelos_producto_variantes_origen_carga_idx
  on public.modelos_producto_variantes (origen_carga);
