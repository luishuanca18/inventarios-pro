create table if not exists public.compras_materia_prima (
  id uuid primary key default gen_random_uuid(),
  codigo_compra text not null unique,
  fecha_compra date not null,
  proveedor_id uuid references public.clientes_proveedores(id) on delete set null,
  proveedor_nombre text not null default '',
  tipo_comprobante text not null default '',
  serie_comprobante text not null default '',
  numero_comprobante text not null default '',
  moneda text not null default 'PEN',
  subtotal numeric(12,2) not null default 0,
  igv numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  usuario_registro text not null default '',
  observacion text not null default '',
  payload jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.adjuntos_compras_materia_prima (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras_materia_prima(id) on delete cascade,
  tipo_adjunto text not null default 'COMPROBANTE',
  nombre_archivo text not null default '',
  ruta_storage text not null default '',
  url_publica text not null default '',
  tipo_mime text not null default '',
  tamanio_bytes bigint not null default 0,
  orden_visual integer not null default 1,
  usuario_subida text not null default '',
  observacion text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.fotos_trazos_corte (
  id uuid primary key default gen_random_uuid(),
  corte_id uuid references public.cortes_produccion(id) on delete set null,
  codigo_corte text not null default '',
  modelo text not null default '',
  tipo_foto text not null default 'TRAZO_PRINCIPAL',
  nombre_archivo text not null default '',
  ruta_storage text not null default '',
  url_publica text not null default '',
  tipo_mime text not null default '',
  tamanio_bytes bigint not null default 0,
  orden_visual integer not null default 1,
  usuario_subida text not null default '',
  observacion text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists compras_materia_prima_fecha_idx
  on public.compras_materia_prima (fecha_compra desc);

create index if not exists compras_materia_prima_proveedor_idx
  on public.compras_materia_prima (proveedor_nombre);

create index if not exists adjuntos_compras_materia_prima_compra_idx
  on public.adjuntos_compras_materia_prima (compra_id, orden_visual);

create index if not exists fotos_trazos_corte_codigo_idx
  on public.fotos_trazos_corte (codigo_corte, orden_visual);

create or replace trigger set_updated_at_compras_materia_prima
before update on public.compras_materia_prima
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_adjuntos_compras_materia_prima
before update on public.adjuntos_compras_materia_prima
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_fotos_trazos_corte
before update on public.fotos_trazos_corte
for each row execute function public.set_updated_at();

comment on table public.compras_materia_prima is
  'Cabecera de compras de materia prima con datos contables y referencia al proveedor.';

comment on table public.adjuntos_compras_materia_prima is
  'Archivos adjuntos de cada compra, especialmente comprobantes, vouchers y guias.';

comment on table public.fotos_trazos_corte is
  'Fotos de referencia del trazo de corte para reutilizar el orden visual del armado del molde.';

alter table public.compras_materia_prima enable row level security;
alter table public.adjuntos_compras_materia_prima enable row level security;
alter table public.fotos_trazos_corte enable row level security;

create policy "compras_materia_prima_todo_autenticados"
on public.compras_materia_prima for all
to authenticated
using (true)
with check (true);

create policy "adjuntos_compras_materia_prima_todo_autenticados"
on public.adjuntos_compras_materia_prima for all
to authenticated
using (true)
with check (true);

create policy "fotos_trazos_corte_todo_autenticados"
on public.fotos_trazos_corte for all
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
select 'comprobantes-compra', 'comprobantes-compra', false
where not exists (
  select 1 from storage.buckets where id = 'comprobantes-compra'
);

insert into storage.buckets (id, name, public)
select 'modelos-visuales', 'modelos-visuales', false
where not exists (
  select 1 from storage.buckets where id = 'modelos-visuales'
);

insert into storage.buckets (id, name, public)
select 'trazos-corte', 'trazos-corte', false
where not exists (
  select 1 from storage.buckets where id = 'trazos-corte'
);

create policy "objetos_imagenes_y_comprobantes_todo_autenticados"
on storage.objects for all
to authenticated
using (
  bucket_id in ('comprobantes-compra', 'modelos-visuales', 'trazos-corte')
)
with check (
  bucket_id in ('comprobantes-compra', 'modelos-visuales', 'trazos-corte')
);
