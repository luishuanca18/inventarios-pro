import { supabase } from "./supabase.config.jsx";

const CLAVE_DETALLE_PEDIDO = "cynara_detalle_pedido_actual";
const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_DETALLE_OP = "cynara_detalle_op_actual";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_CORTE_ACTUAL = "cynara_detalle_corte_actual";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_SOLICITUDES_HABILITADO = "cynara_solicitudes_habilitado";

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

const leerDatoLocal = (clave) => {
  const contenido = localStorage.getItem(clave);
  if (!contenido) return null;
  try {
    return JSON.parse(contenido);
  } catch {
    return null;
  }
};

const guardarListaLocal = (clave, valor = []) => {
  localStorage.setItem(clave, JSON.stringify(valor));
  return valor;
};

const guardarDatoLocal = (clave, valor = null) => {
  if (valor === null || valor === undefined) {
    localStorage.removeItem(clave);
    return null;
  }
  localStorage.setItem(clave, JSON.stringify(valor));
  return valor;
};

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const convertirNumeroSeguro = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const hoy = () => new Date().toISOString().slice(0, 10);

const obtenerPedidoLocalPorCodigo = (codigoPedido = "") => {
  const codigo = (codigoPedido || "").trim();
  if (!codigo) return null;

  const historial = leerListaLocal(CLAVE_HISTORIAL_PEDIDOS);
  const pedidoActual = leerDatoLocal(CLAVE_DETALLE_PEDIDO);

  const encontrado =
    historial.find((pedido) => pedido?.datosCabecera?.codigoInterno === codigo) ||
    (pedidoActual?.datosCabecera?.codigoInterno === codigo ? pedidoActual : null);

  return encontrado || null;
};

const obtenerOpLocalPorPedido = (pedidoOrigen = "") => {
  const codigo = (pedidoOrigen || "").trim();
  if (!codigo) return null;

  const historial = leerListaLocal(CLAVE_HISTORIAL_OP);
  const actual = leerDatoLocal(CLAVE_DETALLE_OP);

  const encontrado =
    historial.find((registro) => registro?.cabeceraOp?.pedidoOrigen === codigo) ||
    (actual?.cabeceraOp?.pedidoOrigen === codigo ? actual : null);

  return encontrado || null;
};

const obtenerCorteLocalPorPedido = (pedidoOrigen = "") => {
  const codigo = (pedidoOrigen || "").trim();
  if (!codigo) return null;

  const historial = leerListaLocal(CLAVE_HISTORIAL_CORTES);
  const actual = leerDatoLocal(CLAVE_CORTE_ACTUAL);

  const encontrado =
    historial.find((registro) => registro?.cabeceraCorte?.pedidoOrigen === codigo) ||
    (actual?.cabeceraCorte?.pedidoOrigen === codigo ? actual : null);

  return encontrado || null;
};

const obtenerSolicitudesLocalesPorPedido = (pedidoOrigen = "") => {
  const codigo = (pedidoOrigen || "").trim();
  return leerListaLocal(CLAVE_SOLICITUDES_HABILITADO).filter(
    (solicitud) => solicitud?.pedidoOrigen === codigo,
  );
};

const mapearPedidoASupabase = (pedido = {}) => {
  const cabecera = pedido?.datosCabecera || {};
  return {
    codigo_pedido: cabecera?.codigoInterno || "",
    fecha_solicitud: cabecera?.fechaSolicitud || null,
    empresa: cabecera?.empresa || "",
    modelo_base: cabecera?.modeloBase || "",
    tipo_tela: cabecera?.tipoTela || "",
    responsable: cabecera?.solicitante || "",
    estado: pedido?.eliminado
      ? "eliminado"
      : pedido?.cancelado
      ? "cancelado"
      : pedido?.opGenerada
      ? "op_generada"
      : pedido?.despachoMateriaPrima
      ? "despachado"
      : "pendiente",
    cancelado: Boolean(pedido?.cancelado),
    despacho_materia_prima: Boolean(pedido?.despachoMateriaPrima),
    op_generada: Boolean(pedido?.opGenerada),
    payload: pedido,
  };
};

const mapearOpASupabase = (registro = {}) => {
  const cabecera = registro?.cabeceraOp || {};
  return {
    pedido_origen: cabecera?.pedidoOrigen || "",
    fecha_op: cabecera?.fechaOp || null,
    empresa: cabecera?.empresa || "",
    modelo_base: cabecera?.modeloBase || "",
    tipo_tela: cabecera?.tipoTela || "",
    estado: registro?.cancelado ? "cancelado" : registro?.estado || "borrador",
    cancelado: Boolean(registro?.cancelado),
    payload: registro,
  };
};

const mapearCorteASupabase = (registro = {}) => {
  const cabecera = registro?.cabeceraCorte || {};
  return {
    pedido_origen: cabecera?.pedidoOrigen || "",
    codigo_op: cabecera?.codigoCorte || cabecera?.opOrigen || "",
    fecha_corte: cabecera?.fechaCorte || null,
    empresa: cabecera?.empresa || "",
    modelo_base: cabecera?.modeloBase || "",
    tipo_tela: cabecera?.tipoTela || "",
    estado: registro?.cancelado ? "cancelado" : registro?.estado || "borrador",
    cancelado: Boolean(registro?.cancelado),
    payload: registro,
  };
};

const mapearSolicitudASupabase = (registro = {}) => ({
  id: registro?.id || `sol-${Date.now()}`,
  pedido_origen: registro?.pedidoOrigen || "",
  fecha_solicitud: registro?.fechaSolicitud || hoy(),
  area_origen: registro?.areaOrigen || "",
  tipo_solicitud: registro?.tipoSolicitud || "",
  tipo_devolucion: registro?.tipoDevolucion || "",
  codigo_unidad: registro?.codigoUnidad || "",
  tipo_tela: registro?.tipoTela || "",
  color_base: registro?.colorBase || "",
  motivo: registro?.motivo || registro?.observacion || "",
  peso_devuelto: convertirNumeroSeguro(registro?.pesoDevuelto || registro?.pesoTela || 0),
  peso_enviado: convertirNumeroSeguro(registro?.pesoEnviado || 0),
  peso_usado: convertirNumeroSeguro(registro?.pesoUsado || 0),
  unidad_control: registro?.unidadControl || "KG",
  estado: registro?.estado || "pendiente",
  payload: registro,
});

export const sincronizarPedidoFlujoDesdeLocalASupabase = async (pedidoOrigen = "") => {
  const codigo = (pedidoOrigen || "").trim();
  if (!codigo) return false;

  const pedido = obtenerPedidoLocalPorCodigo(codigo);
  if (pedido?.datosCabecera?.codigoInterno) {
    const { error } = await supabase
      .from("pedidos_produccion")
      .upsert(mapearPedidoASupabase(pedido), { onConflict: "codigo_pedido" });
    if (error) throw new Error(error.message);
  }

  const op = obtenerOpLocalPorPedido(codigo);
  if (op?.cabeceraOp?.pedidoOrigen) {
    const { error } = await supabase
      .from("ops_produccion")
      .upsert(mapearOpASupabase(op), { onConflict: "pedido_origen" });
    if (error) throw new Error(error.message);
  }

  const corte = obtenerCorteLocalPorPedido(codigo);
  if (corte?.cabeceraCorte?.pedidoOrigen) {
    const { error } = await supabase
      .from("cortes_produccion")
      .upsert(mapearCorteASupabase(corte), { onConflict: "pedido_origen" });
    if (error) throw new Error(error.message);
  }

  const solicitudes = obtenerSolicitudesLocalesPorPedido(codigo).map(mapearSolicitudASupabase);
  if (solicitudes.length > 0) {
    const { error } = await supabase
      .from("solicitudes_materiales")
      .upsert(solicitudes, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  return true;
};

export const eliminarPedidoProduccionSupabase = async (codigoPedido = "") => {
  const codigo = (codigoPedido || "").trim();
  if (!codigo) return;
  const { error } = await supabase
    .from("pedidos_produccion")
    .delete()
    .eq("codigo_pedido", codigo);
  if (error) throw new Error(error.message);
};

export const sincronizarFlujoProduccionDesdeSupabase = async () => {
  const [pedidosResp, opsResp, cortesResp, solicitudesResp] = await Promise.all([
    supabase
      .from("pedidos_produccion")
      .select("*")
      .order("fecha_solicitud", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("ops_produccion")
      .select("*")
      .order("fecha_op", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("cortes_produccion")
      .select("*")
      .order("fecha_corte", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
    supabase
      .from("solicitudes_materiales")
      .select("*")
      .order("fecha_solicitud", { ascending: false, nullsFirst: false })
      .order("fechaactualizacion", { ascending: false }),
  ]);

  if (pedidosResp.error) throw new Error(pedidosResp.error.message);
  if (opsResp.error) throw new Error(opsResp.error.message);
  if (cortesResp.error) throw new Error(cortesResp.error.message);
  if (solicitudesResp.error) throw new Error(solicitudesResp.error.message);

  const pedidos = (pedidosResp.data || [])
    .map((item) => item?.payload)
    .filter(Boolean);
  const ops = (opsResp.data || [])
    .map((item) => item?.payload)
    .filter(Boolean);
  const cortes = (cortesResp.data || [])
    .map((item) => item?.payload)
    .filter(Boolean);
  const solicitudes = (solicitudesResp.data || [])
    .map((item) => item?.payload)
    .filter(Boolean);

  const pedidosFinales =
    pedidos.length > 0 ? pedidos : leerListaLocal(CLAVE_HISTORIAL_PEDIDOS);
  const opsFinales = ops.length > 0 ? ops : leerListaLocal(CLAVE_HISTORIAL_OP);
  const cortesFinales =
    cortes.length > 0 ? cortes : leerListaLocal(CLAVE_HISTORIAL_CORTES);
  const solicitudesFinales =
    solicitudes.length > 0
      ? solicitudes
      : leerListaLocal(CLAVE_SOLICITUDES_HABILITADO);

  guardarListaLocal(CLAVE_HISTORIAL_PEDIDOS, pedidosFinales);
  guardarListaLocal(CLAVE_HISTORIAL_OP, opsFinales);
  guardarListaLocal(CLAVE_HISTORIAL_CORTES, cortesFinales);
  guardarListaLocal(CLAVE_SOLICITUDES_HABILITADO, solicitudesFinales);

  const pedidoActualLocal = leerDatoLocal(CLAVE_DETALLE_PEDIDO);
  if (
    pedidoActualLocal?.datosCabecera?.codigoInterno &&
    !pedidosFinales.some(
      (pedido) =>
        pedido?.datosCabecera?.codigoInterno ===
        pedidoActualLocal?.datosCabecera?.codigoInterno,
    )
  ) {
    guardarDatoLocal(CLAVE_DETALLE_PEDIDO, pedidoActualLocal);
  }

  const opActualLocal = leerDatoLocal(CLAVE_DETALLE_OP);
  if (
    opActualLocal?.cabeceraOp?.pedidoOrigen &&
    !opsFinales.some(
      (registro) =>
        registro?.cabeceraOp?.pedidoOrigen === opActualLocal?.cabeceraOp?.pedidoOrigen,
    )
  ) {
    guardarDatoLocal(CLAVE_DETALLE_OP, opActualLocal);
  }

  const corteActualLocal = leerDatoLocal(CLAVE_CORTE_ACTUAL);
  if (
    corteActualLocal?.cabeceraCorte?.pedidoOrigen &&
    !cortesFinales.some(
      (registro) =>
        registro?.cabeceraCorte?.pedidoOrigen ===
        corteActualLocal?.cabeceraCorte?.pedidoOrigen,
    )
  ) {
    guardarDatoLocal(CLAVE_CORTE_ACTUAL, corteActualLocal);
  }

    return {
    pedidos: pedidosFinales,
    ops: opsFinales,
    cortes: cortesFinales,
    solicitudes: solicitudesFinales,
  };
};
