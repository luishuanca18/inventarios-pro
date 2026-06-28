export const CLAVE_COSTOS_TALLER_MODELO = "cynara_costos_taller_modelo";

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

export const normalizarTextoCosto = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const crearFormularioCostoTaller = () => ({
  id: "",
  modelo: "",
  codigoModelo: "",
  nombreTaller: "",
  costoUnitario: "",
  moneda: "PEN",
  observacion: "",
  estado: "ACTIVO",
});

export const normalizarRegistroCostoTaller = (item = {}) => ({
  id: item?.id || "",
  modelo: normalizarTextoCosto(item?.modelo || ""),
  codigoModelo: normalizarTextoCosto(item?.codigoModelo || ""),
  nombreTaller: normalizarTextoCosto(item?.nombreTaller || ""),
  costoUnitario: Number(item?.costoUnitario || 0),
  moneda: normalizarTextoCosto(item?.moneda || "PEN") || "PEN",
  observacion: item?.observacion || "",
  estado: normalizarTextoCosto(item?.estado || "ACTIVO") || "ACTIVO",
  fechaActualizacion: item?.fechaActualizacion || "",
});

export const leerCostosTallerModelo = () =>
  leerListaGuardada(CLAVE_COSTOS_TALLER_MODELO).map(normalizarRegistroCostoTaller);

export const guardarCostosTallerModelo = (lista = []) => {
  const normalizada = (lista || []).map(normalizarRegistroCostoTaller);
  guardarLista(CLAVE_COSTOS_TALLER_MODELO, normalizada);
  return normalizada;
};

export const obtenerCostoTallerPorModelo = ({
  modelo = "",
  codigoModelo = "",
  nombreTaller = "",
  lista = [],
}) => {
  const registros = Array.isArray(lista) ? lista : [];
  const modeloNormalizado = normalizarTextoCosto(modelo);
  const codigoNormalizado = normalizarTextoCosto(codigoModelo);
  const tallerNormalizado = normalizarTextoCosto(nombreTaller);

  const activos = registros.filter((item) => item?.estado !== "INACTIVO");
  const buscarCoincidencia = (registro) =>
    (codigoNormalizado && normalizarTextoCosto(registro?.codigoModelo) === codigoNormalizado) ||
    normalizarTextoCosto(registro?.modelo) === modeloNormalizado;

  const especifico = activos.find(
    (item) => buscarCoincidencia(item) && normalizarTextoCosto(item?.nombreTaller) === tallerNormalizado
  );

  if (especifico) {
    return especifico;
  }

  return (
    activos.find(
      (item) => buscarCoincidencia(item) && !normalizarTextoCosto(item?.nombreTaller)
    ) || null
  );
};
