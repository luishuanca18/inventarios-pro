create table if not exists public.modelos_visuales_color (
  id uuid primary key default gen_random_uuid(),
  modelo_completo text not null,
  color_base text not null default '',
  foto_color text default '',
  descripcion_color text default '',
  fecharegistro timestamptz not null default timezone('utc', now()),
  fechaactualizacion timestamptz not null default timezone('utc', now()),
  constraint modelos_visuales_color_modelo_color_unique unique (modelo_completo, color_base)
);

create or replace trigger set_updated_at_modelos_visuales_color
before update on public.modelos_visuales_color
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.modelos_visuales_color enable row level security;

create policy "modelos_visuales_color_all_authenticated"
on public.modelos_visuales_color for all
to authenticated
using (true)
with check (true);
