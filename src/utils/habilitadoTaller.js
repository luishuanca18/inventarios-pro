export const CLAVE_HABILITADO_TALLER = "cynara_habilitado_taller";

const leerListaSegura = (clave) => {
  const contenido = localStorage.getItem(clave);

  if (!contenido) {
    return [];
  }

  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

export const leerHabilitadoTaller = () => leerListaSegura(CLAVE_HABILITADO_TALLER);

export const crearEstadoHabilitadoTaller = (registro = {}) => {
  const elastico = Boolean(registro?.elastico);
  const poliamidas = Boolean(registro?.poliamidas);
  const totalListos = [elastico, poliamidas].filter(Boolean).length;

  return {
    id: registro?.id || registro?.codigoOp || "",
    codigoOp: registro?.codigoOp || "",
    pedidoOrigen: registro?.pedidoOrigen || "",
    modeloBase: registro?.modeloBase || registro?.modelo || "",
    tipoSalida: registro?.tipoSalida || "PRINCIPAL",
    productoDerivado: Boolean(registro?.productoDerivado),
    tipoTela: registro?.tipoTela || "",
    colorBase: registro?.colorBase || "",
    fechaCorte: registro?.fechaCorte || "",
    fechaUltimaSalida: registro?.fechaUltimaSalida || "",
    talleres: Array.isArray(registro?.talleres) ? registro.talleres : [],
    totalesPorTalla:
      registro?.totalesPorTalla && typeof registro.totalesPorTalla === "object"
        ? registro.totalesPorTalla
        : {},
    productosDerivados: Array.isArray(registro?.productosDerivados)
      ? registro.productosDerivados
      : [],
    enviadoTaller: Boolean(registro?.enviadoTaller),
    elastico,
    poliamidas,
    avios: Boolean(registro?.avios),
    totalListos,
    listoEnviar: elastico && poliamidas,
    fechaActualizacion: registro?.fechaActualizacion || "",
    responsable: registro?.responsable || "",
    observacion: registro?.observacion || "",
  };
};

export const obtenerEstadoVisualHabilitado = (registro = {}) => {
  const totalListos =
    Number.isFinite(Number(registro?.totalListos))
      ? Number(registro.totalListos)
      : [Boolean(registro?.elastico), Boolean(registro?.poliamidas)].filter(Boolean).length;

  if (Boolean(registro?.listoEnviar)) {
    return {
      texto: "Completo",
      clase: "chip_estado_listo",
    };
  }

  if (Boolean(registro?.enviadoTaller)) {
    return {
      texto: "En alerta",
      clase: "chip_estado_alerta",
    };
  }

  if (totalListos > 0) {
    return {
      texto: "Parcial",
      clase: "chip_estado_parcial",
    };
  }

  return {
    texto: "Pendiente",
    clase: "chip_estado_pendiente",
  };
};

export const guardarHabilitadoTaller = (lista = []) => {
  const normalizada = lista.map((item) => crearEstadoHabilitadoTaller(item));
  localStorage.setItem(CLAVE_HABILITADO_TALLER, JSON.stringify(normalizada));
  return normalizada;
};

export const obtenerFaltantesHabilitado = (registro = {}) => {
  const faltantes = [];

  if (!registro?.elastico) {
    faltantes.push("Elastico");
  }

  if (!registro?.poliamidas) {
    faltantes.push("Poliamidas");
  }

  return faltantes;
};
