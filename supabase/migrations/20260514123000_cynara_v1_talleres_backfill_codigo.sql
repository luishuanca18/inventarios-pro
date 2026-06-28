with talleres_sin_codigo as (
  select
    id,
    row_number() over (order by coalesce(fecharegistro, timezone('utc', now())), nombre, id) as orden
  from public.talleres
  where coalesce(codigo_taller, '') = ''
)
update public.talleres t
set codigo_taller = 'TAL-' || lpad(talleres_sin_codigo.orden::text, 4, '0')
from talleres_sin_codigo
where t.id = talleres_sin_codigo.id;
