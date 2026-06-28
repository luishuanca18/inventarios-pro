export const CLAVE_SUELDOS_PERSONAL = "cynara_sueldos_personal";

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

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const crearFormularioSueldoPersonal = () => ({
  id: "",
  clave: "",
  correo: "",
  nombrePersonal: "",
  cargo: "",
  area: "",
  sueldoMensual: "",
  moneda: "PEN",
  fechaInicio: "",
  estado: "ACTIVO",
  observacion: "",
});

export const normalizarRegistroSueldoPersonal = (item = {}) => ({
  id: item?.id || "",
  clave: normalizarTexto(item?.clave || item?.correo || item?.nombrePersonal || ""),
  correo: (item?.correo || "").toString().trim().toLowerCase(),
  nombrePersonal: normalizarTexto(item?.nombrePersonal || ""),
  cargo: normalizarTexto(item?.cargo || ""),
  area: normalizarTexto(item?.area || ""),
  sueldoMensual: Number(item?.sueldoMensual || 0),
  moneda: normalizarTexto(item?.moneda || "PEN") || "PEN",
  fechaInicio: item?.fechaInicio || "",
  estado: normalizarTexto(item?.estado || "ACTIVO") || "ACTIVO",
  observacion: item?.observacion || "",
  fechaActualizacion: item?.fechaActualizacion || "",
});

export const leerSueldosPersonal = () =>
  leerListaGuardada(CLAVE_SUELDOS_PERSONAL).map(normalizarRegistroSueldoPersonal);

export const guardarSueldosPersonal = (lista = []) => {
  const normalizada = (lista || []).map(normalizarRegistroSueldoPersonal);
  guardarLista(CLAVE_SUELDOS_PERSONAL, normalizada);
  return normalizada;
};
