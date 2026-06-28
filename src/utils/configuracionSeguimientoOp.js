export const CLAVE_CONFIGURACION_SEGUIMIENTO_OP =
  "cynara_configuracion_seguimiento_op";

export const CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO = {
  estados: {
    enTaller: "En taller",
    recepcionAlmacen: "Recepcionada en almacen",
    enServicioTercero: "En servicio tercero",
    retornoTercero: "Retornado de tercero",
    pagoAprobado: "Pago aprobado",
    pagada: "Pagada",
    enCalidad: "En calidad",
    ingresadoStock: "Ingresado a stock",
    conTercero: "Con tercero",
    sinTercero: "Sin tercero",
    pendientePago: "Pendiente",
    calidadPendiente: "Pendiente",
  },
  alertas: {
    diasTaller: 4,
    diasTercero: 3,
    diasCalidad: 2,
    diasGeneral: 3,
  },
};

const normalizarTexto = (valor = "") =>
  valor.toString().trim().replace(/\s+/g, " ");

const normalizarNumero = (valor, respaldo = 0) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : respaldo;
};

const normalizarConfiguracion = (configuracion = {}) => ({
  estados: {
    enTaller:
      normalizarTexto(configuracion?.estados?.enTaller) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.enTaller,
    recepcionAlmacen:
      normalizarTexto(configuracion?.estados?.recepcionAlmacen) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.recepcionAlmacen,
    enServicioTercero:
      normalizarTexto(configuracion?.estados?.enServicioTercero) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.enServicioTercero,
    retornoTercero:
      normalizarTexto(configuracion?.estados?.retornoTercero) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.retornoTercero,
    pagoAprobado:
      normalizarTexto(configuracion?.estados?.pagoAprobado) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.pagoAprobado,
    pagada:
      normalizarTexto(configuracion?.estados?.pagada) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.pagada,
    enCalidad:
      normalizarTexto(configuracion?.estados?.enCalidad) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.enCalidad,
    ingresadoStock:
      normalizarTexto(configuracion?.estados?.ingresadoStock) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.ingresadoStock,
    conTercero:
      normalizarTexto(configuracion?.estados?.conTercero) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.conTercero,
    sinTercero:
      normalizarTexto(configuracion?.estados?.sinTercero) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.sinTercero,
    pendientePago:
      normalizarTexto(configuracion?.estados?.pendientePago) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.pendientePago,
    calidadPendiente:
      normalizarTexto(configuracion?.estados?.calidadPendiente) ||
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados.calidadPendiente,
  },
  alertas: {
    diasTaller: normalizarNumero(
      configuracion?.alertas?.diasTaller,
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.alertas.diasTaller
    ),
    diasTercero: normalizarNumero(
      configuracion?.alertas?.diasTercero,
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.alertas.diasTercero
    ),
    diasCalidad: normalizarNumero(
      configuracion?.alertas?.diasCalidad,
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.alertas.diasCalidad
    ),
    diasGeneral: normalizarNumero(
      configuracion?.alertas?.diasGeneral,
      CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.alertas.diasGeneral
    ),
  },
});

export const leerConfiguracionSeguimientoOp = () => {
  if (typeof window === "undefined") {
    return CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO;
  }

  const contenido = localStorage.getItem(CLAVE_CONFIGURACION_SEGUIMIENTO_OP);
  if (!contenido) {
    return CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO;
  }

  try {
    return normalizarConfiguracion(JSON.parse(contenido));
  } catch {
    return CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO;
  }
};

export const guardarConfiguracionSeguimientoOp = (configuracion = {}) => {
  const normalizada = normalizarConfiguracion(configuracion);
  if (typeof window !== "undefined") {
    localStorage.setItem(
      CLAVE_CONFIGURACION_SEGUIMIENTO_OP,
      JSON.stringify(normalizada)
    );
  }
  return normalizada;
};

export const restaurarConfiguracionSeguimientoOp = () =>
  guardarConfiguracionSeguimientoOp(CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO);
