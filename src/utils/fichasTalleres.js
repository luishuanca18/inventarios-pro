export const CLAVE_FICHAS_TALLERES = "cynara_fichas_talleres";

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const ordenarFichas = (fichas = []) =>
  [...fichas].sort((a, b) =>
    (a.nombreTaller || "").localeCompare(b.nombreTaller || ""),
  );

export const crearFichaTallerVacia = () => ({
  id: "",
  codigoTaller: "",
  nombreTaller: "",
  responsable: "",
  telefonoPrincipal: "",
  telefonoSecundario: "",
  direccion: "",
  referencia: "",
  especialidad: "",
  tiposMaquinas: "",
  capacidadDiaria: "",
  tiempoRespuesta: "",
  estado: "EN PRUEBA",
  correoUsuario: "",
  nombreUsuario: "",
  passwordTemporal: "",
  accesoEstado: "SIN_CUENTA",
  observacion: "",
});

export const normalizarFichaTallerLocal = (item = {}) => ({
  id: item?.id || "",
  codigoTaller: normalizarTexto(item?.codigoTaller),
  nombreTaller: normalizarTexto(item?.nombreTaller),
  responsable: normalizarTexto(item?.responsable),
  telefonoPrincipal: (item?.telefonoPrincipal || "").toString().trim(),
  telefonoSecundario: (item?.telefonoSecundario || "").toString().trim(),
  direccion: normalizarTexto(item?.direccion),
  referencia: normalizarTexto(item?.referencia),
  especialidad: normalizarTexto(item?.especialidad),
  tiposMaquinas: normalizarTexto(item?.tiposMaquinas),
  capacidadDiaria: (item?.capacidadDiaria || "").toString().trim(),
  tiempoRespuesta: normalizarTexto(item?.tiempoRespuesta),
  estado: normalizarTexto(item?.estado) || "EN PRUEBA",
  correoUsuario: (item?.correoUsuario || "").toString().trim().toLowerCase(),
  nombreUsuario: normalizarTexto(item?.nombreUsuario),
  accesoEstado: normalizarTexto(item?.accesoEstado) || "SIN_CUENTA",
  observacion: normalizarTexto(item?.observacion),
  creadoEn: item?.creadoEn || "",
  actualizadoEn: item?.actualizadoEn || "",
});

export const leerFichasTalleres = () => {
  const contenido = localStorage.getItem(CLAVE_FICHAS_TALLERES);

  if (!contenido) {
    return [];
  }

  try {
    const fichas = JSON.parse(contenido);
    if (!Array.isArray(fichas)) return [];

    return ordenarFichas(fichas.map(normalizarFichaTallerLocal));
  } catch {
    return [];
  }
};

export const buscarFichaTaller = (nombreTaller = "") => {
  const nombreNormalizado = normalizarTexto(nombreTaller);
  return (
    leerFichasTalleres().find((item) => item.nombreTaller === nombreNormalizado) ||
    null
  );
};

export const guardarFichaTaller = (ficha = {}) => {
  const registro = normalizarFichaTallerLocal(ficha);
  const nombreTaller = registro.nombreTaller;

  if (!nombreTaller) {
    throw new Error("El nombre del taller es obligatorio.");
  }

  const ahora = new Date().toISOString();
  const existente = buscarFichaTaller(nombreTaller);
  registro.creadoEn = existente?.creadoEn || ahora;
  registro.actualizadoEn = ahora;

  const actual = leerFichasTalleres().filter(
    (item) => item.nombreTaller !== nombreTaller,
  );
  const siguiente = ordenarFichas([...actual, registro]);
  localStorage.setItem(CLAVE_FICHAS_TALLERES, JSON.stringify(siguiente));
  return registro;
};

export const eliminarFichaTaller = (nombreTaller = "") => {
  const nombreNormalizado = normalizarTexto(nombreTaller);
  const siguiente = leerFichasTalleres().filter(
    (item) => item.nombreTaller !== nombreNormalizado,
  );
  localStorage.setItem(CLAVE_FICHAS_TALLERES, JSON.stringify(siguiente));
  return siguiente;
};

export const obtenerNombresTalleres = () =>
  leerFichasTalleres()
    .map((item) => item.nombreTaller)
    .filter(Boolean);
