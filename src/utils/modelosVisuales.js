import { construirNombreModelo, normalizarTextoCatalogo } from "./catalogosProduccion";

export const CLAVE_MODELOS_VISUALES = "cynara_modelos_visuales";
export const CLAVE_MODELOS_VISUALES_COLOR = "cynara_modelos_visuales_color";

export const normalizarFichaVisual = (ficha = {}) => {
  const fotoFrente = ficha?.fotoFrente || ficha?.fotoModelo || "";

  return {
    ...ficha,
    fotoModelo: fotoFrente,
    fotoFrente,
    fotoEspalda: ficha?.fotoEspalda || "",
    fotoCostado: ficha?.fotoCostado || "",
    fotoDetalle: ficha?.fotoDetalle || "",
  };
};

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

const guardarLista = (clave, lista) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

export const normalizarFichaVisualColor = (ficha = {}) => ({
  ...ficha,
  modeloBase: normalizarTextoCatalogo(ficha?.modeloBase || ""),
  colorBase: normalizarTextoCatalogo(ficha?.colorBase || ""),
  fotoColor: ficha?.fotoColor || ficha?.fotoFrente || ficha?.fotoModelo || "",
  descripcionColor: ficha?.descripcionColor || "",
});

export const leerModelosVisuales = () =>
  leerListaGuardada(CLAVE_MODELOS_VISUALES)
    .map(normalizarFichaVisual)
    .sort((a, b) =>
      String(a?.modeloBase || "").localeCompare(String(b?.modeloBase || "")),
    );

export const leerModelosVisualesColor = () =>
  leerListaGuardada(CLAVE_MODELOS_VISUALES_COLOR)
    .map(normalizarFichaVisualColor)
    .sort((a, b) =>
      `${a?.modeloBase || ""} ${a?.colorBase || ""}`.localeCompare(
        `${b?.modeloBase || ""} ${b?.colorBase || ""}`,
      ),
    );

export const construirModeloBaseVisual = ({
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
}) =>
  construirNombreModelo({
    categoria: categoriaModelo,
    modelo: modeloCatalogo,
    telaModelo,
  });

export const guardarModeloVisual = (ficha = {}) => {
  const modeloBase = normalizarTextoCatalogo(ficha?.modeloBase || "");
  if (!modeloBase) return null;

  const fotoFrente = ficha?.fotoFrente || ficha?.fotoModelo || "";
  const fotoEspalda = ficha?.fotoEspalda || "";
  const fotoCostado = ficha?.fotoCostado || "";
  const fotoDetalle = ficha?.fotoDetalle || "";

  const actualizados = [
    {
      id: ficha?.id || modeloBase,
      categoriaModelo: normalizarTextoCatalogo(ficha?.categoriaModelo || ""),
      modeloCatalogo: normalizarTextoCatalogo(ficha?.modeloCatalogo || ""),
      telaModelo: normalizarTextoCatalogo(ficha?.telaModelo || ""),
      modeloBase,
      descripcionVisual: ficha?.descripcionVisual || "",
      fotoModelo: fotoFrente,
      fotoFrente,
      fotoEspalda,
      fotoCostado,
      fotoDetalle,
      fechaActualizacion: new Date().toISOString(),
    },
    ...leerModelosVisuales().filter((item) => item?.modeloBase !== modeloBase),
  ];

  guardarLista(CLAVE_MODELOS_VISUALES, actualizados);
  return actualizados[0];
};

export const guardarListaModelosVisuales = (lista = []) => {
  const normalizada = (lista || []).map(normalizarFichaVisual);
  guardarLista(CLAVE_MODELOS_VISUALES, normalizada);
  return normalizada;
};

export const guardarListaModelosVisualesColor = (lista = []) => {
  const normalizada = (lista || []).map(normalizarFichaVisualColor);
  guardarLista(CLAVE_MODELOS_VISUALES_COLOR, normalizada);
  return normalizada;
};

export const eliminarModeloVisual = (modeloBase = "") => {
  const clave = normalizarTextoCatalogo(modeloBase);
  guardarLista(
    CLAVE_MODELOS_VISUALES,
    leerModelosVisuales().filter((item) => item?.modeloBase !== clave),
  );
};

export const eliminarModeloVisualColor = ({
  modeloBase = "",
  colorBase = "",
} = {}) => {
  const modeloClave = normalizarTextoCatalogo(modeloBase);
  const colorClave = normalizarTextoCatalogo(colorBase);
  guardarLista(
    CLAVE_MODELOS_VISUALES_COLOR,
    leerModelosVisualesColor().filter(
      (item) =>
        !(
          normalizarTextoCatalogo(item?.modeloBase || "") === modeloClave &&
          normalizarTextoCatalogo(item?.colorBase || "") === colorClave
        ),
    ),
  );
};

export const buscarModeloVisual = ({
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modeloBase = "",
} = {}) => {
  const claveDirecta = normalizarTextoCatalogo(
    modeloBase ||
      construirModeloBaseVisual({ categoriaModelo, modeloCatalogo, telaModelo }),
  );

  return (
    leerModelosVisuales().find(
      (item) => normalizarTextoCatalogo(item?.modeloBase || "") === claveDirecta,
    ) || null
  );
};

export const buscarFotoModeloColor = ({
  modeloBase = "",
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  colorBase = "",
} = {}) => {
  const claveModelo = normalizarTextoCatalogo(
    modeloBase ||
      construirModeloBaseVisual({ categoriaModelo, modeloCatalogo, telaModelo }),
  );
  const claveColor = normalizarTextoCatalogo(colorBase);

  if (!claveModelo || !claveColor) {
    return null;
  }

  return (
    leerModelosVisualesColor().find(
      (item) =>
        normalizarTextoCatalogo(item?.modeloBase || "") === claveModelo &&
        normalizarTextoCatalogo(item?.colorBase || "") === claveColor,
    ) || null
  );
};

export const obtenerFotosModeloVisual = (ficha = {}) => ({
  frente: ficha?.fotoFrente || ficha?.fotoModelo || "",
  espalda: ficha?.fotoEspalda || "",
  costado: ficha?.fotoCostado || "",
  detalle: ficha?.fotoDetalle || "",
});

export const obtenerVistasModeloVisual = (ficha = {}) => {
  const fotos = obtenerFotosModeloVisual(ficha);

  return [
    { clave: "frente", titulo: "Frente", url: fotos.frente },
    { clave: "espalda", titulo: "Espalda", url: fotos.espalda },
    { clave: "costado", titulo: "Costado", url: fotos.costado },
    { clave: "detalle", titulo: "Detalle", url: fotos.detalle },
  ];
};
