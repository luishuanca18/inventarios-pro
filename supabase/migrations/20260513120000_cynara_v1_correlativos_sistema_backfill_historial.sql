-- Alinea correlativos reales contra el historial ya existente.
-- Por ahora se respalda desde tablas remotas de pedidos y OP.

update public.correlativos_sistema as cs
set
  anio_actual = datos.anio,
  ultimo_correlativo = greatest(coalesce(cs.ultimo_correlativo, 0), datos.maximo)
from (
  select
    'PEDIDO_PRODUCCION'::text as clave,
    extract(year from coalesce(fecha_solicitud, now()))::int as anio,
    max(coalesce(nullif(substring(codigo_pedido from '.*-(\d+)$'), ''), '0')::int) as maximo
  from public.pedidos_produccion
  where codigo_pedido is not null
  group by extract(year from coalesce(fecha_solicitud, now()))::int
) as datos
where cs.clave = datos.clave
  and cs.anio_actual = datos.anio;

update public.correlativos_sistema as cs
set
  anio_actual = datos.anio,
  ultimo_correlativo = greatest(coalesce(cs.ultimo_correlativo, 0), datos.maximo)
from (
  select
    'OP_PRODUCCION'::text as clave,
    extract(year from coalesce(fecha_corte, now()))::int as anio,
    max(coalesce(nullif(substring(codigo_op from '.*-(\d+)$'), ''), '0')::int) as maximo
  from public.cortes_produccion
  where codigo_op is not null
  group by extract(year from coalesce(fecha_corte, now()))::int
) as datos
where cs.clave = datos.clave
  and cs.anio_actual = datos.anio;
