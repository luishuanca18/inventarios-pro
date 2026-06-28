alter table if exists public.usuarios
  add column if not exists nombre text default '',
  add column if not exists area text default '',
  add column if not exists sede text default '',
  add column if not exists modulos jsonb not null default '[]'::jsonb,
  add column if not exists submodulos jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists fechaactualizacion timestamptz not null default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'nombres'
  ) then
    execute $sql$
      update public.usuarios
      set nombre = coalesce(nullif(nombre, ''), nullif(nombres, ''), '')
      where coalesce(nombre, '') = ''
    $sql$;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'updated_at'
  ) then
    execute $sql$
      update public.usuarios
      set fechaactualizacion = coalesce(updated_at, timezone('utc', now()))
      where fechaactualizacion is null
    $sql$;
  else
    execute $sql$
      update public.usuarios
      set fechaactualizacion = timezone('utc', now())
      where fechaactualizacion is null
    $sql$;
  end if;
end;
$$;

drop trigger if exists set_updated_at_usuarios on public.usuarios;

create trigger set_updated_at_usuarios
before update on public.usuarios
for each row execute function public.set_updated_at();
