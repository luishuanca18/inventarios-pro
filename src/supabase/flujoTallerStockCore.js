import { supabase } from "./supabase.config.jsx";

const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_SOLICITUDES_PROCESOS_EXTERNOS =
  "cynara_solicitudes_procesos_externos";
const CLAVE_DESCUENTOS_TALLER = "cynara_descuentos_taller";
const CLAVE_AJUSTES_RECEPCION_PRODUCCION =
  "cynara_ajustes_recepcion_produccion";
const CLAVE_ACONDICIONADO_PT = "cynara_acondicionado_producto_terminado";
const CLAVE_REMATES_PT = "cynara_remates_producto_terminado";
const CLAVE_PRODUCTOS_TERMINADOS = "cynara_productos_terminados";
const CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS =
  "cynara_movimientos_productos_terminados";
const CLAVE_LOTES_PRODUCTOS_TERMINADOS =
  "cynara_lotes_productos_terminados";
const CLAVE_VENTAS_ALMACEN_PT = "cynara_ventas_almacen_pt";

const leerListaLocal = (clave) => {
  const contenido = localStorage.getItem(clave);
  if (!contenido) return [];
  try {
    const data = JSON.parse(contenido);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const guardarListaLocal = (clave, valor = []) => {
  localStorage.setItem(clave, JSON.stringify(valor));
  return valor;
};

const hoy = () => new Date().toISOString().slice(0, 10);

const limpiarTexto = (valor = "") => valor?.toString?.().trim?.() || "";

const resolverCodigoSalidaDesdeRecepcionId = (recepcionId = "", codigoSalida = "") => {
  const codigoLimpio = limpiarTexto(codigoSalida);
  if (codigoLimpio) {
    return codigoLimpio;
  }

  const recepcionLimpia = limpiarTexto(recepcionId);
  if (!recepcionLimpia) {
    return "";
  }

  const coincidencia = recepcionLimpia.match(/^(.*)-(?:INTA|REC)\d+$/i);
  return limpiarTexto(coincidencia?.[1] || "");
};

const normalizarRegistroAcondicionadoHistorico = (registro = {}) => {
  const recepcionId = registro?.recepcionId || registro?.recepcion_id || "";
  const codigoSalida = resolverCodigoSalidaDesdeRecepcionId(
    recepcionId,
    registro?.codigoSalida || registro?.codigo_salida || ""
  );

  return {
    ...registro,
    recepcionId,
    codigoSalida,
  };
};

const resolverEstadoProcesoExterno = (registro = {}) => {
  if (registro?.cancelado) {
    return "cancelado";
  }

  if (registro?.aprobadoProduccion) {
    return "aprobado_produccion";
  }

  if (registro?.fechaRetornoTercero || registro?.fechaRetornoDesdeTercero) {
    return "retornado_tercero";
  }

  if (registro?.fechaEnvioTercero || registro?.fechaEntregaAlTercero) {
    return "en_servicio_tercerizado";
  }

  if (registro?.fechaRecepcionAlmacen) {
    return "listo_para_enviar_tercero";
  }

  return registro?.estadoMovimiento || registro?.estado || "pendiente";
};

const mapearSalidaTaller = (registro = {}) => ({
  id_salida: registro?.id || registro?.codigoSalida || `salida-${Date.now()}`,
  codigo_op: registro?.codigoOp || registro?.opOrigen || "",
  codigo_salida: registro?.codigoSalida || registro?.id || "",
  parent_item_id: registro?.parentItemId || "",
  nombre_taller: registro?.nombreTaller || "",
  fecha_envio: registro?.fechaEnvio || null,
  fecha_entrega: registro?.fechaEntrega || null,
  estado:
    registro?.tipoRegistro === "envio_taller"
      ? "enviado"
      : registro?.enviadoTaller
        ? "enviado"
        : "pendiente",
  servicio_a_terceros: Boolean(registro?.servicioATerceros),
  payload: registro,
});

const mapearRecepcionTaller = (registro = {}) => {
  const cabecera = registro?.cabeceraRecepcion || {};
  return {
    id_recepcion:
      registro?.id ||
      cabecera?.idRecepcion ||
      `${cabecera?.codigoOp || "sin-op"}-recepcion`,
    codigo_op: cabecera?.codigoOp || "",
    codigo_salida: cabecera?.codigoSalida || "",
    nombre_taller: cabecera?.nombreTaller || "",
    fecha_recepcion: cabecera?.fechaRecepcion || null,
    tipo_recepcion: cabecera?.tipoRecepcion || "",
    estado: registro?.estado || "pendiente",
    aprobado_calidad: Boolean(cabecera?.aprobadoCalidad),
    payload: registro,
  };
};

const mapearProcesoExterno = (registro = {}) => ({
  id_proceso: registro?.id || `proceso-${Date.now()}`,
  codigo_op: registro?.codigoOp || "",
  proceso: registro?.proceso || registro?.tipoProceso || "",
  taller_tercero: registro?.tallerTercero || "",
  fecha_solicitud:
    registro?.fechaSolicitud ||
    registro?.fechaRecepcionAlmacen ||
    registro?.fechaEnvioTercero ||
    null,
  estado: resolverEstadoProcesoExterno(registro),
  payload: registro,
});

const mapearDescuentoTaller = (registro = {}) => ({
  id_descuento: registro?.id || `desc-${Date.now()}`,
  registro_id: registro?.registroId || registro?.idRegistroPago || "",
  codigo_op: registro?.codigoOp || "",
  nombre_taller: registro?.nombreTaller || "",
  fecha_descuento: registro?.fechaDescuento || null,
  monto_descuento: Number(registro?.montoDescuento || 0),
  origen_descuento: registro?.origenDescuento || "",
  payload: registro,
});

const mapearAjusteRecepcion = (registro = {}) => ({
  id_ajuste: registro?.id || `ajuste-${Date.now()}`,
  codigo_op: registro?.codigoOp || "",
  fecha_registro: registro?.fechaRegistro || null,
  estado: registro?.estado || "pendiente",
  payload: registro,
});

const mapearAcondicionado = (registro = {}) => {
  const normalizado = normalizarRegistroAcondicionadoHistorico(registro);
  return {
    recepcion_id: normalizado?.recepcionId || `acond-${Date.now()}`,
    codigo_op: normalizado?.codigoOp || "",
    codigo_salida: normalizado?.codigoSalida || "",
    fecha_recepcion: normalizado?.fechaRecepcion || null,
    estado: normalizado?.estado || "pendiente",
    total_apto: Number(normalizado?.totalApto || 0),
    total_incidencias: Number(normalizado?.totalIncidencias || 0),
    total_remate: Number(normalizado?.totalRemate || 0),
    payload: normalizado,
  };
};

const mapearRemate = (registro = {}) => {
  const normalizado = normalizarRegistroAcondicionadoHistorico(registro);
  return {
    recepcion_id: normalizado?.recepcionId || `remate-${Date.now()}`,
    codigo_op: normalizado?.codigoOp || "",
    codigo_salida: normalizado?.codigoSalida || "",
    fecha_recepcion: normalizado?.fechaRecepcion || null,
    total_remate: Number(normalizado?.totalRemate || 0),
    payload: normalizado,
  };
};

const mapearProductoTerminado = (registro = {}) => ({
  clave_producto: registro?.claveProducto || registro?.id || "",
  codigo_producto: registro?.codigoProducto || "",
  codigo_corto: registro?.codigoCorto || "",
  modelo: registro?.modelo || "",
  color_base: registro?.colorBase || "",
  talla: registro?.talla || "",
  stock_actual: Number(registro?.stockActual || 0),
  payload: registro,
});

const mapearMovimientoProducto = (registro = {}) => ({
  id_movimiento: registro?.id || `mov-${Date.now()}`,
  clave_producto: registro?.claveProducto || "",
  codigo_producto: registro?.codigoProducto || "",
  codigo_op: registro?.codigoOp || registro?.origenOp || "",
  salida_id: registro?.salidaId || "",
  recepcion_id: registro?.recepcionId || "",
  fecha_movimiento: registro?.fecha || null,
  tipo_movimiento: registro?.tipoMovimiento || "",
  cantidad: Number(registro?.cantidad || 0),
  payload: registro,
});

const mapearLoteProducto = (registro = {}) => ({
  lote_id: registro?.loteId || registro?.id || "",
  clave_producto: registro?.claveProducto || "",
  codigo_producto: registro?.codigoProducto || "",
  codigo_op: registro?.codigoOp || "",
  fecha_ingreso: registro?.fechaIngreso || registro?.ultimaFechaIngreso || null,
  stock_actual_lote: Number(registro?.stockActualLote || 0),
  cantidad_ingresada_total: Number(registro?.cantidadIngresadaTotal || 0),
  cantidad_salida_total: Number(registro?.cantidadSalidaTotal || 0),
  payload: registro,
});

const mapearVentaAlmacenPt = (registro = {}) => ({
  id_venta: registro?.id || `venta-${Date.now()}`,
  fecha_venta: registro?.fecha || null,
  canal: registro?.canal || "",
  cliente: registro?.cliente || "",
  tipo_comprobante: registro?.tipoComprobante || "",
  total_prendas: Number(registro?.totalPrendas || 0),
  total_venta: Number(registro?.totalVenta || 0),
  payload: registro,
});

const reemplazarTablaDesdeLista = async (tabla, idColumn, filas = []) => {
  const { data, error } = await supabase.from(tabla).select(idColumn);
  if (error) {
    throw new Error(error.message);
  }

  const idsLocales = filas.map((item) => limpiarTexto(item?.[idColumn])).filter(Boolean);
  const idsRemotos = (data || [])
    .map((item) => limpiarTexto(item?.[idColumn]))
    .filter(Boolean);
  const idsEliminar = idsRemotos.filter((id) => !idsLocales.includes(id));

  if (idsEliminar.length > 0) {
    const { error: errorDelete } = await supabase.from(tabla).delete().in(idColumn, idsEliminar);
    if (errorDelete) {
      throw new Error(errorDelete.message);
    }
  }

  if (filas.length > 0) {
    const { error: errorUpsert } = await supabase
      .from(tabla)
      .upsert(filas, { onConflict: idColumn });
    if (errorUpsert) {
      throw new Error(errorUpsert.message);
    }
  }
};

export const sincronizarTallerStockDesdeLocalASupabase = async () => {
  const salidas = leerListaLocal(CLAVE_SALIDAS_TALLER).map(mapearSalidaTaller);
  const recepciones = leerListaLocal(CLAVE_RECEPCIONES_TALLER).map(mapearRecepcionTaller);
  const procesos = leerListaLocal(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS).map(mapearProcesoExterno);
  const descuentos = leerListaLocal(CLAVE_DESCUENTOS_TALLER).map(mapearDescuentoTaller);
  const ajustes = leerListaLocal(CLAVE_AJUSTES_RECEPCION_PRODUCCION).map(mapearAjusteRecepcion);
  const acondicionados = leerListaLocal(CLAVE_ACONDICIONADO_PT).map(mapearAcondicionado);
  const remates = leerListaLocal(CLAVE_REMATES_PT).map(mapearRemate);
  const productos = leerListaLocal(CLAVE_PRODUCTOS_TERMINADOS)
    .map(mapearProductoTerminado)
    .filter((item) => item.clave_producto);
  const movimientos = leerListaLocal(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS)
    .map(mapearMovimientoProducto)
    .filter((item) => item.id_movimiento);
  const lotes = leerListaLocal(CLAVE_LOTES_PRODUCTOS_TERMINADOS)
    .map(mapearLoteProducto)
    .filter((item) => item.lote_id);
  const ventas = leerListaLocal(CLAVE_VENTAS_ALMACEN_PT)
    .map(mapearVentaAlmacenPt)
    .filter((item) => item.id_venta);

  await reemplazarTablaDesdeLista("salidas_taller", "id_salida", salidas);
  await reemplazarTablaDesdeLista("recepciones_taller", "id_recepcion", recepciones);
  await reemplazarTablaDesdeLista(
    "solicitudes_procesos_externos",
    "id_proceso",
    procesos,
  );
  await reemplazarTablaDesdeLista("descuentos_taller", "id_descuento", descuentos);
  await reemplazarTablaDesdeLista(
    "ajustes_recepcion_produccion",
    "id_ajuste",
    ajustes,
  );
  await reemplazarTablaDesdeLista(
    "acondicionado_producto_terminado",
    "recepcion_id",
    acondicionados,
  );
  await reemplazarTablaDesdeLista(
    "remates_producto_terminado",
    "recepcion_id",
    remates,
  );
  await reemplazarTablaDesdeLista(
    "productos_terminados_stock",
    "clave_producto",
    productos,
  );
  await reemplazarTablaDesdeLista(
    "movimientos_productos_terminados",
    "id_movimiento",
    movimientos,
  );
  await reemplazarTablaDesdeLista(
    "lotes_productos_terminados",
    "lote_id",
    lotes,
  );
  await reemplazarTablaDesdeLista(
    "ventas_almacen_producto_terminado",
    "id_venta",
    ventas,
  );

  return true;
};

const tomarPayloads = (data = [], clave = "payload") =>
  (data || []).map((item) => item?.[clave]).filter(Boolean);

const repararHistoricosCalidadLocal = () => {
  const acondicionados = leerListaLocal(CLAVE_ACONDICIONADO_PT).map(
    normalizarRegistroAcondicionadoHistorico
  );
  const remates = leerListaLocal(CLAVE_REMATES_PT).map(
    normalizarRegistroAcondicionadoHistorico
  );

  guardarListaLocal(CLAVE_ACONDICIONADO_PT, acondicionados);
  guardarListaLocal(CLAVE_REMATES_PT, remates);

  return { acondicionados, remates };
};

export const sincronizarTallerStockDesdeSupabase = async () => {
  const [
    salidasResp,
    recepcionesResp,
    procesosResp,
    descuentosResp,
    ajustesResp,
    acondicionadosResp,
    rematesResp,
    productosResp,
    movimientosResp,
    lotesResp,
    ventasResp,
  ] = await Promise.all([
    supabase
      .from("salidas_taller")
      .select("*")
      .order("fecha_envio", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("recepciones_taller")
      .select("*")
      .order("fecha_recepcion", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("solicitudes_procesos_externos")
      .select("*")
      .order("fecha_solicitud", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("descuentos_taller")
      .select("*")
      .order("fecha_descuento", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("ajustes_recepcion_produccion")
      .select("*")
      .order("fecha_registro", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("acondicionado_producto_terminado")
      .select("*")
      .order("fecha_recepcion", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("remates_producto_terminado")
      .select("*")
      .order("fecha_recepcion", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("productos_terminados_stock")
      .select("*")
      .order("modelo", { ascending: true })
      .order("color_base", { ascending: true })
      .order("talla", { ascending: true }),
    supabase
      .from("movimientos_productos_terminados")
      .select("*")
      .order("fecha_movimiento", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("lotes_productos_terminados")
      .select("*")
      .order("fecha_ingreso", { ascending: true, nullsFirst: false })
      .order("codigo_op", { ascending: true }),
    supabase
      .from("ventas_almacen_producto_terminado")
      .select("*")
      .order("fecha_venta", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
  ]);

  [
    salidasResp,
    recepcionesResp,
    procesosResp,
    descuentosResp,
    ajustesResp,
    acondicionadosResp,
    rematesResp,
    productosResp,
    movimientosResp,
    lotesResp,
    ventasResp,
  ].forEach((respuesta) => {
    if (respuesta.error) {
      throw new Error(respuesta.error.message);
    }
  });

  const salidas = tomarPayloads(salidasResp.data);
  const recepciones = tomarPayloads(recepcionesResp.data);
  const procesos = tomarPayloads(procesosResp.data);
  const descuentos = tomarPayloads(descuentosResp.data);
  const ajustes = tomarPayloads(ajustesResp.data);
  const acondicionados = tomarPayloads(acondicionadosResp.data).map(
    normalizarRegistroAcondicionadoHistorico
  );
  const remates = tomarPayloads(rematesResp.data).map(
    normalizarRegistroAcondicionadoHistorico
  );
  const productos = tomarPayloads(productosResp.data);
  const movimientos = tomarPayloads(movimientosResp.data);
  const lotes = tomarPayloads(lotesResp.data);
  const ventas = tomarPayloads(ventasResp.data);

  // En salidas de taller la base remota manda: si no existe en Supabase,
  // no debe seguir apareciendo como registro activo en la pantalla.
  guardarListaLocal(CLAVE_SALIDAS_TALLER, salidas);
  guardarListaLocal(
    CLAVE_RECEPCIONES_TALLER,
    recepciones.length > 0
      ? recepciones
      : leerListaLocal(CLAVE_RECEPCIONES_TALLER),
  );
  guardarListaLocal(
    CLAVE_SOLICITUDES_PROCESOS_EXTERNOS,
    procesos.length > 0
      ? procesos
      : leerListaLocal(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS),
  );
  guardarListaLocal(
    CLAVE_DESCUENTOS_TALLER,
    descuentos.length > 0
      ? descuentos
      : leerListaLocal(CLAVE_DESCUENTOS_TALLER),
  );
  guardarListaLocal(
    CLAVE_AJUSTES_RECEPCION_PRODUCCION,
    ajustes.length > 0
      ? ajustes
      : leerListaLocal(CLAVE_AJUSTES_RECEPCION_PRODUCCION),
  );
  guardarListaLocal(
    CLAVE_ACONDICIONADO_PT,
    acondicionados.length > 0
      ? acondicionados
      : leerListaLocal(CLAVE_ACONDICIONADO_PT),
  );
  guardarListaLocal(
    CLAVE_REMATES_PT,
    remates.length > 0 ? remates : leerListaLocal(CLAVE_REMATES_PT),
  );
  repararHistoricosCalidadLocal();
  guardarListaLocal(
    CLAVE_PRODUCTOS_TERMINADOS,
    productos.length > 0 ? productos : leerListaLocal(CLAVE_PRODUCTOS_TERMINADOS),
  );
  guardarListaLocal(
    CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS,
    movimientos.length > 0
      ? movimientos
      : leerListaLocal(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS),
  );
  guardarListaLocal(
    CLAVE_LOTES_PRODUCTOS_TERMINADOS,
    lotes.length > 0 ? lotes : leerListaLocal(CLAVE_LOTES_PRODUCTOS_TERMINADOS),
  );
  guardarListaLocal(
    CLAVE_VENTAS_ALMACEN_PT,
    ventas.length > 0 ? ventas : leerListaLocal(CLAVE_VENTAS_ALMACEN_PT),
  );

  return {
    salidas: salidas.length > 0 ? salidas : leerListaLocal(CLAVE_SALIDAS_TALLER),
    recepciones:
      recepciones.length > 0 ? recepciones : leerListaLocal(CLAVE_RECEPCIONES_TALLER),
    procesos:
      procesos.length > 0
        ? procesos
        : leerListaLocal(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS),
    descuentos:
      descuentos.length > 0 ? descuentos : leerListaLocal(CLAVE_DESCUENTOS_TALLER),
    ajustes:
      ajustes.length > 0
        ? ajustes
        : leerListaLocal(CLAVE_AJUSTES_RECEPCION_PRODUCCION),
    acondicionados:
      acondicionados.length > 0
        ? acondicionados
        : leerListaLocal(CLAVE_ACONDICIONADO_PT),
    remates: remates.length > 0 ? remates : leerListaLocal(CLAVE_REMATES_PT),
    productos:
      productos.length > 0 ? productos : leerListaLocal(CLAVE_PRODUCTOS_TERMINADOS),
    movimientos:
      movimientos.length > 0
        ? movimientos
        : leerListaLocal(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS),
    lotes: lotes.length > 0 ? lotes : leerListaLocal(CLAVE_LOTES_PRODUCTOS_TERMINADOS),
    ventas:
      ventas.length > 0 ? ventas : leerListaLocal(CLAVE_VENTAS_ALMACEN_PT),
  };
};
