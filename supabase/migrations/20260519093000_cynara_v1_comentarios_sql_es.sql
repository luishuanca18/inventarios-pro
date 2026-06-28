comment on function public.set_updated_at() is
  'Funcion interna que actualiza automaticamente el campo updated_at cuando una fila cambia.';

comment on table public.usuarios is
  'Cuentas y perfiles del sistema. Aqui se guarda el acceso operativo de personal, talleres y administradores.';
comment on table public.configuracion_empresa is
  'Configuracion general de la empresa: datos base, alertas y correlativos principales.';
comment on table public.configuracion_ventas_impresion is
  'Preferencias de ventas, impresion y documentos comerciales.';
comment on table public.catalogo_items is
  'Catalogos auxiliares del sistema: colores, tallas, motivos, canales y otras listas configurables.';
comment on table public.talleres is
  'Fichas maestras de talleres externos con sus datos operativos y de acceso.';
comment on table public.clientes_proveedores is
  'Maestro de clientes y proveedores.';
comment on table public.precios_productos is
  'Lista de precios de venta por modelo.';
comment on table public.modelos_visuales is
  'Fichas visuales y referencias graficas de los modelos.';
comment on table public.elasticos_modelo is
  'Fichas tecnicas de elasticos y referencias por modelo.';
comment on table public.historial_versiones is
  'Bitacora general de cambios o versiones guardadas por el sistema.';

comment on table public.pedidos_produccion is
  'Pedidos registrados para iniciar el flujo productivo.';
comment on table public.ops_produccion is
  'Ordenes de produccion derivadas del pedido y listas para pasar a corte.';
comment on table public.cortes_produccion is
  'Cortes y trazos confirmados dentro del flujo de produccion.';
comment on table public.solicitudes_materiales is
  'Solicitudes de aumento, devolucion o movimientos de material entre produccion y almacen.';

comment on table public.salidas_taller is
  'Envios de prendas o paquetes desde produccion hacia talleres.';
comment on table public.recepciones_taller is
  'Recepciones de talleres en almacen o produccion.';
comment on table public.solicitudes_procesos_externos is
  'Servicios o procesos enviados a terceros.';
comment on table public.descuentos_taller is
  'Descuentos aplicados a talleres por observaciones, fallas o diferencias.';
comment on table public.ajustes_recepcion_produccion is
  'Ajustes pendientes o aplicados sobre recepciones de produccion.';
comment on table public.acondicionado_producto_terminado is
  'Control de calidad y acondicionado previo al ingreso de producto terminado.';
comment on table public.remates_producto_terminado is
  'Prendas destinadas a remate u observacion luego del acondicionado.';
comment on table public.productos_terminados_stock is
  'Stock actual de productos terminados.';
comment on table public.movimientos_productos_terminados is
  'Movimientos historicos del stock de productos terminados.';
comment on table public.lotes_productos_terminados is
  'Lotes de ingreso de producto terminado para trazabilidad.';
comment on table public.ventas_almacen_producto_terminado is
  'Ventas directas registradas desde almacen.';

comment on table public.modelos_producto is
  'Catalogo maestro de modelos de producto.';
comment on table public.modelos_producto_variantes is
  'Variantes del catalogo por color, talla u otras combinaciones del modelo.';

comment on table public.correlativos_sistema is
  'Control central de correlativos por modulo, anio y prefijo.';
comment on table public.costos_taller_modelo is
  'Costos de pago por prenda segun modelo y, si aplica, segun taller.';
comment on table public.sueldos_personal is
  'Sueldos mensuales del personal interno.';
comment on table public.costos_terceros is
  'Tarifas de procesos tercerizados, incluyendo multiaguja y otros servicios.';

comment on column public.pedidos_produccion.payload is
  'Detalle flexible del pedido. Se usa para guardar informacion extensa mientras el flujo sigue evolucionando.';
comment on column public.ops_produccion.payload is
  'Detalle flexible de la OP y su estado operativo.';
comment on column public.cortes_produccion.payload is
  'Detalle flexible del corte, trazo, hijos de OP y configuraciones relacionadas.';
comment on column public.solicitudes_materiales.payload is
  'Detalle flexible de solicitudes de aumento, devolucion y movimientos de material.';
comment on column public.salidas_taller.payload is
  'Detalle flexible de envios a taller, incluidos hijos de OP, procesos y observaciones.';
comment on column public.recepciones_taller.payload is
  'Detalle flexible de recepciones y conteos por color y talla.';
comment on column public.solicitudes_procesos_externos.payload is
  'Detalle flexible de servicios enviados a terceros.';
comment on column public.descuentos_taller.payload is
  'Detalle flexible de descuentos y motivos aplicados al taller.';
comment on column public.ajustes_recepcion_produccion.payload is
  'Detalle flexible de ajustes detectados despues de una recepcion.';
comment on column public.acondicionado_producto_terminado.payload is
  'Detalle flexible del acondicionado, incidencias y clasificacion.';
comment on column public.remates_producto_terminado.payload is
  'Detalle flexible de remates y observaciones.';
comment on column public.productos_terminados_stock.payload is
  'Detalle flexible de cada registro de stock terminado.';
comment on column public.movimientos_productos_terminados.payload is
  'Detalle flexible de cada movimiento de entrada, salida o ajuste.';
comment on column public.lotes_productos_terminados.payload is
  'Detalle flexible del lote para auditoria y trazabilidad.';
comment on column public.ventas_almacen_producto_terminado.payload is
  'Detalle flexible de ventas y su composicion por producto.';
