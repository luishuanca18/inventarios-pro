alter table public.talleres
  add column if not exists codigo_taller text,
  add column if not exists usuario_correo text default '',
  add column if not exists usuario_nombre text default '',
  add column if not exists acceso_estado text default 'SIN_CUENTA',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists talleres_codigo_taller_uidx
  on public.talleres (codigo_taller)
  where codigo_taller is not null;

update public.talleres
set acceso_estado = coalesce(nullif(acceso_estado, ''), 'SIN_CUENTA');
