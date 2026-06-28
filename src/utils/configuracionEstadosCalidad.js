export const CLAVE_CONFIGURACION_ESTADOS_CALIDAD =
  "cynara_configuracion_estados_calidad";

export const ETIQUETAS_CALIDAD_POR_DEFECTO = {
  pendienteCalidad: "Pendiente de calidad",
  guardadoAvance: "Guardado en avance",
  diferenciasConteo: "Diferencias de conteo",
  faltanCantidades: "Faltan cantidades",
  sobranCantidades: "Sobran cantidades",
  opCompleta: "OP completa",
  opCompletaConRemate: "OP completa con remate",
  observadaDiferencia: "Observada por diferencia",
  conRemate: "Con remate",
  ingresadaStock: "Ingresada a stock",
  ingresoIncompleto: "Ingreso incompleto",
  ingresoCompleto: "Ingreso completo",
  ingresoConRemate: "Ingreso con remate",
};

const normalizarTexto = (valor = "") =>
  valor.toString().trim().replace(/\s+/g, " ");

const normalizarEtiquetas = (configuracion = {}) => ({
  pendienteCalidad:
    normalizarTexto(configuracion?.pendienteCalidad) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.pendienteCalidad,
  guardadoAvance:
    normalizarTexto(configuracion?.guardadoAvance) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.guardadoAvance,
  diferenciasConteo:
    normalizarTexto(configuracion?.diferenciasConteo) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.diferenciasConteo,
  faltanCantidades:
    normalizarTexto(configuracion?.faltanCantidades) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.faltanCantidades,
  sobranCantidades:
    normalizarTexto(configuracion?.sobranCantidades) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.sobranCantidades,
  opCompleta:
    normalizarTexto(configuracion?.opCompleta) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.opCompleta,
  opCompletaConRemate:
    normalizarTexto(configuracion?.opCompletaConRemate) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.opCompletaConRemate,
  observadaDiferencia:
    normalizarTexto(configuracion?.observadaDiferencia) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.observadaDiferencia,
  conRemate:
    normalizarTexto(configuracion?.conRemate) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.conRemate,
  ingresadaStock:
    normalizarTexto(configuracion?.ingresadaStock) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.ingresadaStock,
  ingresoIncompleto:
    normalizarTexto(configuracion?.ingresoIncompleto) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.ingresoIncompleto,
  ingresoCompleto:
    normalizarTexto(configuracion?.ingresoCompleto) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.ingresoCompleto,
  ingresoConRemate:
    normalizarTexto(configuracion?.ingresoConRemate) ||
    ETIQUETAS_CALIDAD_POR_DEFECTO.ingresoConRemate,
});

export const leerEtiquetasCalidadSistema = () => {
  if (typeof window === "undefined") {
    return { ...ETIQUETAS_CALIDAD_POR_DEFECTO };
  }

  const contenido = localStorage.getItem(CLAVE_CONFIGURACION_ESTADOS_CALIDAD);
  if (!contenido) {
    return { ...ETIQUETAS_CALIDAD_POR_DEFECTO };
  }

  try {
    return normalizarEtiquetas(JSON.parse(contenido));
  } catch {
    return { ...ETIQUETAS_CALIDAD_POR_DEFECTO };
  }
};

export const guardarEtiquetasCalidadSistema = (configuracion = {}) => {
  const normalizada = normalizarEtiquetas(configuracion);
  if (typeof window !== "undefined") {
    localStorage.setItem(
      CLAVE_CONFIGURACION_ESTADOS_CALIDAD,
      JSON.stringify(normalizada)
    );
  }
  return normalizada;
};

export const restaurarEtiquetasCalidadSistema = () =>
  guardarEtiquetasCalidadSistema(ETIQUETAS_CALIDAD_POR_DEFECTO);
