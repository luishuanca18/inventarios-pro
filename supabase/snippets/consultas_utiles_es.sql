-- CONSULTAS UTILES EN ESPANOL PARA EL SQL EDITOR
-- Estas consultas no cambian datos. Sirven para entender mejor la base.

-- 1. Ver pedidos de produccion recientes
select
  id,
  codigo as "Codigo",
  estado as "Estado",
  created_at as "Creado"
from public.pedidos_produccion
order by created_at desc
limit 50;

-- 2. Ver ordenes de produccion recientes
select
  id,
  codigo as "Codigo OP",
  estado as "Estado",
  created_at as "Creado"
from public.ops_produccion
order by created_at desc
limit 50;

-- 3. Ver cortes confirmados
select
  id,
  codigo as "Codigo corte",
  estado as "Estado",
  created_at as "Creado"
from public.cortes_produccion
order by created_at desc
limit 50;

-- 4. Ver talleres registrados
select
  id,
  codigo_taller as "Codigo taller",
  nombre_taller as "Nombre taller",
  responsable as "Responsable",
  estado as "Estado"
from public.talleres
order by nombre_taller asc;

-- 5. Ver correlativos del sistema
select
  clave as "Modulo",
  anio as "Anio",
  prefijo as "Prefijo",
  ultimo_correlativo as "Ultimo correlativo",
  siguiente_forzado as "Siguiente forzado"
from public.correlativos_sistema
order by clave asc, anio desc;

-- 6. Ver modelos del catalogo
select
  id,
  codigo_modelo as "Codigo maestro",
  codigo_corto as "Codigo corto",
  nombre_modelo as "Nombre modelo",
  categoria as "Categoria",
  modelo_catalogo as "Modelo corto",
  tela_nombre as "Tela para nombre",
  estado as "Estado"
from public.modelos_producto
order by nombre_modelo asc;

-- 7. Ver variantes del catalogo
select
  id,
  codigo_variante as "Codigo variante",
  codigo_corto_variante as "Codigo corto variante",
  nombre_modelo as "Modelo",
  color as "Color",
  talla as "Talla",
  estado as "Estado"
from public.modelos_producto_variantes
order by nombre_modelo asc, color asc, talla asc;

-- 8. Ver stock de producto terminado
select
  id,
  modelo as "Modelo",
  color as "Color",
  talla as "Talla",
  stock_actual as "Stock actual",
  updated_at as "Ultima actualizacion"
from public.productos_terminados_stock
order by updated_at desc
limit 100;

-- 9. Ver costos por modelo para taller
select
  codigo_modelo as "Codigo modelo",
  modelo as "Modelo",
  nombre_taller as "Taller",
  costo_unitario as "Costo unitario",
  moneda as "Moneda",
  estado as "Estado"
from public.costos_taller_modelo
order by modelo asc, nombre_taller asc nulls first;

-- 10. Ver costos de terceros
select
  proceso as "Proceso",
  cantidad_agujas as "Cantidad agujas",
  nombre_taller as "Taller tercero",
  costo_unitario as "Costo unitario",
  moneda as "Moneda",
  estado as "Estado"
from public.costos_terceros
order by proceso asc, cantidad_agujas asc nulls first;
