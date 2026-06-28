create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.fechaactualizacion = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  idauth uuid unique references auth.users(id) on delete cascade,
  correo text,
  nombre text default '',
  telefono text default '',
  area text default '',
  sede text default '',
  tipouser text not null default 'admin',
  estado text not null default 'ACTIVO',
  modulos jsonb not null default '[]'::jsonb,
  submodulos jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists usuarios_idauth_idx on public.usuarios (idauth);
create index if not exists usuarios_tipouser_idx on public.usuarios (tipouser);

create table if not exists public.configuracion_empresa (
  id uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text default '',
  ruc text default '',
  direccion text default '',
  telefono text default '',
  whatsapp text default '',
  correo text default '',
  logo_url text default '',
  observacion text default '',
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.configuracion_ventas_impresion (
  id uuid primary key default gen_random_uuid(),
  tipo_comprobante_defecto text not null default 'NOTA DE VENTA',
  serie_nota text not null default 'NV01',
  serie_boleta text not null default 'B001',
  serie_factura text not null default 'F001',
  serie_nota_cambio text not null default 'NC01',
  correlativo_inicial integer not null default 1,
  igv numeric(10,4) not null default 18,
  incluye_igv boolean not null default true,
  ancho_ticket_mm integer not null default 58,
  nombre_impresora text default '',
  pedir_cliente boolean not null default false,
  pedir_documento boolean not null default false,
  pedir_celular boolean not null default false,
  mostrar_color boolean not null default true,
  mostrar_talla boolean not null default true,
  mostrar_precio_unitario boolean not null default true,
  mostrar_subtotal_linea boolean not null default true,
  mensaje_pie_1 text default '',
  mensaje_pie_2 text default '',
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.catalogo_items (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  grupo text not null,
  nombre text not null,
  valor text default '',
  orden integer not null default 0,
  activo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now()),
  unique (modulo, grupo, nombre)
);

create index if not exists catalogo_items_modulo_grupo_idx
  on public.catalogo_items (modulo, grupo);

create table if not exists public.talleres (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  responsable text default '',
  telefono_1 text default '',
  telefono_2 text default '',
  direccion text default '',
  referencia text default '',
  especialidad text default '',
  tipos_maquina jsonb not null default '[]'::jsonb,
  capacidad_diaria integer not null default 0,
  tiempo_respuesta_dias integer not null default 0,
  estado text not null default 'ACTIVO',
  observacion text default '',
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.clientes_proveedores (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'CLIENTE',
  documento text default '',
  nombre text not null,
  telefono text default '',
  correo text default '',
  direccion text default '',
  contacto text default '',
  observacion text default '',
  estado text not null default 'ACTIVO',
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create index if not exists clientes_proveedores_tipo_idx
  on public.clientes_proveedores (tipo);

create table if not exists public.precios_productos (
  id uuid primary key default gen_random_uuid(),
  modelo text not null unique,
  precio_base numeric(10,2) not null default 0,
  precio_xl numeric(10,2) not null default 0,
  precio_xxl numeric(10,2) not null default 0,
  observacion text default '',
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.modelos_visuales (
  id uuid primary key default gen_random_uuid(),
  categoria text default '',
  modelo text not null,
  tela_nombre text default '',
  modelo_completo text not null unique,
  foto_frontal text default '',
  foto_espalda text default '',
  foto_costado text default '',
  foto_detalle text default '',
  descripcion_visual text default '',
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.elasticos_modelo (
  id uuid primary key default gen_random_uuid(),
  categoria text default '',
  modelo text not null,
  tela_nombre text default '',
  modelo_completo text not null unique,
  ancho_cm numeric(10,2) not null default 0,
  costo_por_metro numeric(10,4) not null default 0,
  largo_s_cm numeric(10,2) not null default 0,
  largo_m_cm numeric(10,2) not null default 0,
  largo_l_cm numeric(10,2) not null default 0,
  largo_xl_cm numeric(10,2) not null default 0,
  largo_xxl_cm numeric(10,2) not null default 0,
  observacion text default '',
  metadata jsonb not null default '{}'::jsonb,
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now())
);

create table if not exists public.historial_versiones (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  fecha date not null default current_date,
  titulo text not null,
  detalle text not null,
  fecharegistro timestamptz not null default timezone('utc', now())
);

create or replace trigger set_updated_at_usuarios
before update on public.usuarios
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_configuracion_empresa
before update on public.configuracion_empresa
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_configuracion_ventas_impresion
before update on public.configuracion_ventas_impresion
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_catalogo_items
before update on public.catalogo_items
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_talleres
before update on public.talleres
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_clientes_proveedores
before update on public.clientes_proveedores
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_precios_productos
before update on public.precios_productos
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_modelos_visuales
before update on public.modelos_visuales
for each row execute function public.set_updated_at();

create or replace trigger set_updated_at_elasticos_modelo
before update on public.elasticos_modelo
for each row execute function public.set_updated_at();

alter table public.usuarios enable row level security;
alter table public.configuracion_empresa enable row level security;
alter table public.configuracion_ventas_impresion enable row level security;
alter table public.catalogo_items enable row level security;
alter table public.talleres enable row level security;
alter table public.clientes_proveedores enable row level security;
alter table public.precios_productos enable row level security;
alter table public.modelos_visuales enable row level security;
alter table public.elasticos_modelo enable row level security;
alter table public.historial_versiones enable row level security;

create policy "usuarios_select_authenticated"
on public.usuarios for select
to authenticated
using (true);

create policy "usuarios_insert_authenticated"
on public.usuarios for insert
to authenticated
with check (true);

create policy "usuarios_update_authenticated"
on public.usuarios for update
to authenticated
using (true)
with check (true);

create policy "usuarios_delete_authenticated"
on public.usuarios for delete
to authenticated
using (true);

create policy "configuracion_empresa_all_authenticated"
on public.configuracion_empresa for all
to authenticated
using (true)
with check (true);

create policy "configuracion_ventas_impresion_all_authenticated"
on public.configuracion_ventas_impresion for all
to authenticated
using (true)
with check (true);

create policy "catalogo_items_all_authenticated"
on public.catalogo_items for all
to authenticated
using (true)
with check (true);

create policy "talleres_all_authenticated"
on public.talleres for all
to authenticated
using (true)
with check (true);

create policy "clientes_proveedores_all_authenticated"
on public.clientes_proveedores for all
to authenticated
using (true)
with check (true);

create policy "precios_productos_all_authenticated"
on public.precios_productos for all
to authenticated
using (true)
with check (true);

create policy "modelos_visuales_all_authenticated"
on public.modelos_visuales for all
to authenticated
using (true)
with check (true);

create policy "elasticos_modelo_all_authenticated"
on public.elasticos_modelo for all
to authenticated
using (true)
with check (true);

create policy "historial_versiones_all_authenticated"
on public.historial_versiones for all
to authenticated
using (true)
with check (true);

insert into public.historial_versiones (version, fecha, titulo, detalle)
values
  ('Cynara v1.0.0', current_date, 'Fundacion operativa', 'Primera version operativa antes de migrar modulos a Supabase.')
on conflict (version) do nothing;
