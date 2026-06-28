alter table public.modelos_producto
  add column if not exists categoria text not null default '',
  add column if not exists modelo_catalogo text not null default '',
  add column if not exists tela_nombre text not null default '';

create index if not exists modelos_producto_categoria_idx
  on public.modelos_producto (categoria);

create index if not exists modelos_producto_modelo_catalogo_idx
  on public.modelos_producto (modelo_catalogo);
