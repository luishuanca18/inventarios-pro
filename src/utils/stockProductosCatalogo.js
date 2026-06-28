const normalizarTextoClave = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const formatearTallaVisualStock = (valor = "") =>
  String(valor || "").toUpperCase() === "STANDAR" ? "ST" : valor;

export const crearClaveCatalogoProducto = ({
  modelo = "",
  colorBase = "",
  talla = "",
}) =>
  [
    normalizarTextoClave(modelo),
    normalizarTextoClave(colorBase),
    normalizarTextoClave(talla),
  ].join("|");

const crearClaveCompatibilidadCatalogoProducto = ({
  varianteId = "",
  codigoVariante = "",
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modelo = "",
  colorBase = "",
  talla = "",
}) =>
  [
    normalizarTextoClave(varianteId || codigoVariante || ""),
    normalizarTextoClave(categoriaModelo),
    normalizarTextoClave(modeloCatalogo),
    normalizarTextoClave(telaModelo),
    normalizarTextoClave(modelo),
    normalizarTextoClave(colorBase),
    normalizarTextoClave(talla),
  ].join("|");

const crearSegmentoColorOperativo = (color = "", limite = 6) => {
  const limpio = normalizarTextoClave(color).replace(/[^A-Z0-9 ]/g, " ");
  const palabras = limpio.split(/\s+/).filter(Boolean);

  if (palabras.length === 0) {
    return "COLOR";
  }

  if (palabras.length === 1) {
    return palabras[0].slice(0, limite);
  }

  return palabras
    .map((palabra) => palabra.slice(0, 3))
    .join("")
    .slice(0, limite);
};

const crearCodigoCortoVarianteVisual = ({
  codigoCortoModelo = "",
  color = "",
  talla = "",
}) =>
  `${normalizarTextoClave(codigoCortoModelo).replace(/[^A-Z0-9]/g, "").slice(0, 30)}${crearSegmentoColorOperativo(
    color,
    6,
  )}${normalizarTextoClave(talla).replace(/[^A-Z0-9]/g, "").slice(0, 2) || "S"}`.slice(0, 40);

const resolverCodigosCortosVisuales = ({
  catalogoVariantes = [],
  catalogoModelosPorId = new Map(),
  catalogoModelosPorCodigo = new Map(),
}) => {
  const mapa = new Map();
  const usadas = new Set();

  [...(Array.isArray(catalogoVariantes) ? catalogoVariantes : [])]
    .sort((a, b) =>
      [
        a?.codigoModelo || "",
        a?.nombreModelo || "",
        a?.color || "",
        a?.talla || "",
        a?.id || "",
      ]
        .join("|")
        .localeCompare(
          [
            b?.codigoModelo || "",
            b?.nombreModelo || "",
            b?.color || "",
            b?.talla || "",
            b?.id || "",
          ].join("|"),
        ),
    )
    .forEach((variante) => {
      const modelo =
        catalogoModelosPorId.get(variante?.modeloId) ||
        catalogoModelosPorCodigo.get(variante?.codigoModelo) ||
        null;
      const base = crearCodigoCortoVarianteVisual({
        codigoCortoModelo: modelo?.codigoCorto || "",
        color: variante?.color || "",
        talla: variante?.talla || "",
      }).slice(0, 38);

      let candidato = base;
      if (usadas.has(candidato)) {
        for (let correlativo = 1; correlativo <= 99; correlativo += 1) {
          const posible = `${base}${String(correlativo).padStart(2, "0")}`.slice(0, 40);
          if (!usadas.has(posible)) {
            candidato = posible;
            break;
          }
        }
      }

      usadas.add(candidato);
      mapa.set(variante?.id || variante?.codigoVariante || "", candidato);
    });

  return mapa;
};

export const mezclarCatalogoConStock = ({
  productosTerminados = [],
  catalogoModelos = [],
  catalogoVariantes = [],
}) => {
  const catalogoModelosPorId = new Map();
  const catalogoModelosPorCodigo = new Map();

  catalogoModelos.forEach((item) => {
    if (item?.id) {
      catalogoModelosPorId.set(item.id, item);
    }
    if (item?.codigoModelo) {
      catalogoModelosPorCodigo.set(item.codigoModelo, item);
    }
  });

  const codigosCortosVisuales = resolverCodigosCortosVisuales({
    catalogoVariantes,
    catalogoModelosPorId,
    catalogoModelosPorCodigo,
  });

  const mapaProductos = new Map();

  productosTerminados.forEach((item) => {
    const clave = crearClaveCompatibilidadCatalogoProducto({
      varianteId: item?.varianteId,
      codigoVariante: item?.codigoVariante || item?.codigoProducto,
      categoriaModelo: item?.categoriaModelo,
      modeloCatalogo: item?.modeloCatalogo,
      telaModelo: item?.telaModelo,
      modelo: item?.modelo,
      colorBase: item?.colorBase,
      talla: item?.talla,
    });
    const actual = mapaProductos.get(clave);

    if (actual) {
      mapaProductos.set(clave, {
        ...actual,
        ...item,
        stockActual: Number(actual?.stockActual || 0) + Number(item?.stockActual || 0),
        ultimaOp: item?.ultimaOp || actual?.ultimaOp || "",
        ultimaSalida: item?.ultimaSalida || actual?.ultimaSalida || "",
        ultimaFechaRecepcion:
          item?.ultimaFechaRecepcion || actual?.ultimaFechaRecepcion || "",
        esCatalogoSinStock: false,
      });
      return;
    }

    mapaProductos.set(clave, {
      ...item,
      esCatalogoSinStock: false,
    });
  });

  catalogoVariantes.forEach((variante) => {
    const modelo =
      catalogoModelosPorId.get(variante?.modeloId) ||
      catalogoModelosPorCodigo.get(variante?.codigoModelo) ||
      null;
    const nombreModelo = modelo?.nombreModelo || variante?.nombreModelo || "";
    const clave = crearClaveCompatibilidadCatalogoProducto({
      varianteId: variante?.id,
      codigoVariante: variante?.codigoVariante,
      categoriaModelo: modelo?.categoria,
      modeloCatalogo: modelo?.modeloCatalogo,
      telaModelo: modelo?.telaNombre,
      modelo: nombreModelo,
      colorBase: variante?.color,
      talla: variante?.talla,
    });
    const actual = mapaProductos.get(clave);

    if (actual) {
      mapaProductos.set(clave, {
        ...actual,
        codigoCorto:
          codigosCortosVisuales.get(variante?.id || variante?.codigoVariante || "") ||
          variante?.codigoCorto ||
          actual?.codigoCorto ||
          "",
        codigoProducto: variante?.codigoVariante || actual?.codigoProducto || "",
        modelo: nombreModelo || actual?.modelo || "",
        categoriaModelo: modelo?.categoria || actual?.categoriaModelo || "",
        modeloCatalogo: modelo?.modeloCatalogo || actual?.modeloCatalogo || "",
        telaModelo: modelo?.telaNombre || actual?.telaModelo || "",
        colorBase: variante?.color || actual?.colorBase || "",
        talla: variante?.talla || actual?.talla || "",
        estadoCatalogo: variante?.estado || "ACTIVO",
        esCatalogoSinStock: false,
      });
      return;
    }

    mapaProductos.set(clave, {
      id: variante?.id || clave,
      claveProducto: clave,
      codigoCorto:
        codigosCortosVisuales.get(variante?.id || variante?.codigoVariante || "") ||
        variante?.codigoCorto ||
        "",
      codigoProducto: variante?.codigoVariante || "",
      codigoBarraTexto: "",
      modelo: nombreModelo,
      categoriaModelo: modelo?.categoria || "",
      modeloCatalogo: modelo?.modeloCatalogo || "",
      telaModelo: modelo?.telaNombre || "",
      tipoTela: "",
      colorBase: variante?.color || "",
      talla: variante?.talla || "",
      stockActual: 0,
      stockSeguridad: 0,
      ultimaOp: "",
      ultimaFechaRecepcion: "",
      ultimaFechaProduccion: "",
      ultimaFechaSalida: "",
      estadoCatalogo: variante?.estado || "ACTIVO",
      esCatalogoSinStock: true,
    });
  });

  return Array.from(mapaProductos.values()).sort((a, b) => {
    const stockA = Number(a?.stockActual || 0);
    const stockB = Number(b?.stockActual || 0);
    const conStockA = stockA > 0 ? 1 : 0;
    const conStockB = stockB > 0 ? 1 : 0;

    if (conStockA !== conStockB) {
      return conStockB - conStockA;
    }

    if (stockA !== stockB) {
      return stockB - stockA;
    }

    return [
      a?.modelo || "",
      a?.colorBase || "",
      a?.talla || "",
      a?.codigoCorto || "",
    ]
      .join("|")
      .localeCompare(
        [
          b?.modelo || "",
          b?.colorBase || "",
          b?.talla || "",
          b?.codigoCorto || "",
        ].join("|"),
      );
  });
};

export const normalizarUmbralesStock = (configuracion = {}) => {
  const bajo = Math.max(1, Number(configuracion?.stockBajo || configuracion?.stockMinimoAlerta || 5));
  const medio = Math.max(bajo, Number(configuracion?.stockMedio || configuracion?.stockMedioAlerta || 10));
  const optimo = Math.max(medio, Number(configuracion?.stockOptimo || configuracion?.stockOptimoAlerta || 15));

  return {
    bajo,
    medio,
    optimo,
  };
};

export const calcularAlertaStock = (stockActual = 0, configuracion = {}) => {
  const stock = Number(stockActual || 0);
  const umbrales = normalizarUmbralesStock(configuracion);

  if (stock <= 0) {
    return {
      nivel: "critico",
      etiqueta: "Sin stock",
      color: "rojo",
      esAlerta: true,
    };
  }

  if (stock <= umbrales.bajo) {
    return {
      nivel: "bajo",
      etiqueta: `Bajo (${umbrales.bajo})`,
      color: "rojo",
      esAlerta: true,
    };
  }

  if (stock <= umbrales.medio) {
    return {
      nivel: "medio",
      etiqueta: `Medio bajo (${umbrales.medio})`,
      color: "amarillo",
      esAlerta: true,
    };
  }

  if (stock <= umbrales.optimo) {
    return {
      nivel: "optimo",
      etiqueta: `Optimo (${umbrales.optimo})`,
      color: "verde",
      esAlerta: false,
    };
  }

  return {
    nivel: "sobrado",
    etiqueta: "Sobre optimo",
    color: "verde",
    esAlerta: false,
  };
};
