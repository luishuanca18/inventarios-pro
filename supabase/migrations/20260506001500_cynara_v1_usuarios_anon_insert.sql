do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'usuarios'
      and policyname = 'usuarios_insert_anon'
  ) then
    create policy "usuarios_insert_anon"
    on public.usuarios
    for insert
    to anon
    with check (true);
  end if;
end;
$$;
