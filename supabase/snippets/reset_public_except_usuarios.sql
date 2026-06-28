begin;

do $$
declare
  registro record;
begin
  for registro in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('usuarios')
    order by tablename
  loop
    execute format('drop table if exists public.%I cascade', registro.tablename);
  end loop;
end;
$$;

drop function if exists public.set_updated_at() cascade;

commit;
