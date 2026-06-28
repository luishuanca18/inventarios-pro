export const CLAVE_COSTOS_TERCEROS = "cynara_costos_terceros";

const leerListaGuardada = (clave) => {
  const contenido = localStorage.getItem(clave);
  if (!contenido) return [];

  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

const guardarLista = (clave, lista = []) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

export const normalizarTextoCostoTercero = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const crearFormularioCostoTercero = () => ({
  id: "",
  proceso: "MULTIAGUJA",
  cantidadAgujas: "",
  nombreTaller: "",
  costoUnitario: "",
  moneda: "PEN",
  observacion: "",
  estado: "ACTIVO",
});

export const normalizarRegistroCostoTercero = (item = {}) => ({
  id: item?.id || "",
  proceso: normalizarTextoCostoTercero(item?.proceso || "MULTIAGUJA") || "MULTIAGUJA",
  cantidadAgujas:
    item?.cantidadAgujas === "" || item?.cantidadAgujas === undefined || item?.cantidadAgujas === null
      ? ""
      : String(item?.cantidadAgujas),
  nombreTaller: normalizarTextoCostoTercero(item?.nombreTaller || ""),
  costoUnitario: Number(item?.costoUnitario || 0),
  moneda: normalizarTextoCostoTercero(item?.moneda || "PEN") || "PEN",
  observacion: item?.observacion || "",
  estado: normalizarTextoCostoTercero(item?.estado || "ACTIVO") || "ACTIVO",
  fechaActualizacion: item?.fechaActualizacion || "",
});

const COSTOS_MULTIAGUJA_POR_DEFECTO = {
  1: 0.2,
  2: 0.3,
  3: 0.4,
  4: 0.5,
};

export const leerCostosTerceros = () =>
  leerListaGuardada(CLAVE_COSTOS_TERCEROS).map(normalizarRegistroCostoTercero);

export const guardarCostosTerceros = (lista = []) => {
  const normalizada = (lista || []).map(normalizarRegistroCostoTercero);
  guardarLista(CLAVE_COSTOS_TERCEROS, normalizada);
  return normalizada;
};

export const obtenerCostoTerceroPorProceso = ({
  proceso = "",
  cantidadAgujas = "",
  nombreTaller = "",
  lista = [],
}) => {
  const registros = Array.isArray(lista) ? lista : [];
  const procesoNormalizado = normalizarTextoCostoTercero(proceso);
  const tallerNormalizado = normalizarTextoCostoTercero(nombreTaller);
  const agujasNormalizadas =
    cantidadAgujas === "" || cantidadAgujas === undefined || cantidadAgujas === null
      ? ""
      : String(Number(cantidadAgujas) || "");

  const activos = registros.filter((item) => item?.estado !== "INACTIVO");
  const especifico = activos.find(
    (item) =>
      normalizarTextoCostoTercero(item?.proceso) === procesoNormalizado &&
      String(item?.cantidadAgujas || "") === agujasNormalizadas &&
      normalizarTextoCostoTercero(item?.nombreTaller) === tallerNormalizado,
  );

  if (especifico) {
    return especifico;
  }

  return (
    activos.find(
      (item) =>
        normalizarTextoCostoTercero(item?.proceso) === procesoNormalizado &&
        String(item?.cantidadAgujas || "") === agujasNormalizadas &&
        !normalizarTextoCostoTercero(item?.nombreTaller),
    ) ||
    (procesoNormalizado === "MULTIAGUJA" && COSTOS_MULTIAGUJA_POR_DEFECTO[Number(agujasNormalizadas)]
      ? {
          id: "",
          proceso: "MULTIAGUJA",
          cantidadAgujas: agujasNormalizadas,
          nombreTaller: "",
          costoUnitario: COSTOS_MULTIAGUJA_POR_DEFECTO[Number(agujasNormalizadas)],
          moneda: "PEN",
          observacion: "Tarifa base automatica por cantidad de agujas.",
          estado: "ACTIVO",
        }
      : null)
  );
};
