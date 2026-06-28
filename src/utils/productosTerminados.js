import {
  guardarModeloProductoConfiguracion,
  guardarVarianteProductoConfiguracion,
  listarModelosProductoConfiguracion,
  listarVariantesProductoPorModeloConfiguracion,
} from "../supabase/configuracionCore.js";

export const CLAVE_PRODUCTOS_TERMINADOS = "cynara_productos_terminados";
export const CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS =
  "cynara_movimientos_productos_terminados";
export const CLAVE_AJUSTES_PRENDAS = "cynara_ajustes_prendas";
export const CLAVE_LOTES_PRODUCTOS_TERMINADOS =
  "cynara_lotes_productos_terminados";

const TALLAS_DISPONIBLES = ["S", "M", "L", "XL", "XXL"];

const leerListaGuardada = (clave) => {
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

const guardarLista = (clave, lista) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const crearHashDeterministico = (texto = "") => {
  let hash = 0;

  for (let indice = 0; indice < texto.length; indice += 1) {
    hash = (hash * 31 + texto.charCodeAt(indice)) % 1679616;
  }

  return hash.toString(36).toUpperCase().padStart(4, "0").slice(-4);
};

const crearAbreviatura = (texto = "", limite = 9) => {
  const limpio = normalizarTexto(texto).replace(/[^A-Z0-9\s]/g, "");
  const palabras = limpio.split(" ").filter(Boolean);

  if (palabras.length === 0) {
    return "GEN";
  }

  const abreviado = palabras.map((palabra) => palabra.slice(0, 3)).join("");
  return abreviado.slice(0, limite) || "GEN";
};

const crearAbreviaturaOperativa = (texto = "", limite = 4) => {
  const limpio = normalizarTexto(texto).replace(/[^A-Z0-9\s]/g, "");
  const palabras = limpio.split(" ").filter(Boolean);

  if (palabras.length === 0) {
    return "GEN";
  }

  if (palabras.length === 1) {
    return palabras[0].slice(0, limite) || "GEN";
  }

  return palabras
    .slice(0, limite)
    .map((palabra) => palabra[0] || "")
    .join("")
    .slice(0, limite) || "GEN";
};

const crearClaveProducto = ({ modelo = "", colorBase = "", talla = "" }) =>
  `${normalizarTexto(modelo)}|${normalizarTexto(colorBase)}|${normalizarTexto(talla)}`;

const construirDescriptorProducto = ({
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modeloBase = "",
  tipoTela = "",
  colorBase = "",
  talla = "",
}) => {
  const categoriaNormalizada = normalizarTexto(categoriaModelo);
  const modeloNormalizado = normalizarTexto(modeloCatalogo);
  const telaNombreNormalizada = normalizarTexto(telaModelo);
  const tipoTelaNormalizado = normalizarTexto(tipoTela);
  const nombreCompletoNormalizado =
    [categoriaNormalizada, modeloNormalizado, telaNombreNormalizada]
      .filter(Boolean)
      .join(" ") || normalizarTexto(modeloBase);

  return {
    categoriaModelo: categoriaNormalizada,
    modeloCatalogo: modeloNormalizado,
    telaModelo: telaNombreNormalizada,
    tipoTela: tipoTelaNormalizado,
    nombreCompleto: nombreCompletoNormalizado,
    colorBase: normalizarTexto(colorBase),
    talla: normalizarTexto(talla),
  };
};

const normalizarBooleano = (valor) => Boolean(valor);

const crearClaveProductoDetallada = ({
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modeloBase = "",
  tipoTela = "",
  colorBase = "",
  talla = "",
}) => {
  const descriptor = construirDescriptorProducto({
    categoriaModelo,
    modeloCatalogo,
    telaModelo,
    modeloBase,
    tipoTela,
    colorBase,
    talla,
  });

  return [
    descriptor.categoriaModelo,
    descriptor.modeloCatalogo,
    descriptor.telaModelo,
    descriptor.tipoTela,
    descriptor.nombreCompleto,
    descriptor.colorBase,
    descriptor.talla,
  ]
    .filter(Boolean)
    .join("|");
};

export const crearCodigoProductoTerminado = ({
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modelo = "",
  tipoTela = "",
  colorBase = "",
  talla = "",
}) => {
  const clave = crearClaveProductoDetallada({
    categoriaModelo,
    modeloCatalogo,
    telaModelo,
    modeloBase: modelo,
    tipoTela,
    colorBase,
    talla,
  });
  const hash = crearHashDeterministico(clave);
  const modeloAbreviado = crearAbreviatura(modelo, 9);
  const colorAbreviado = crearAbreviatura(colorBase, 6);
  const tallaNormalizada = normalizarTexto(talla) || "UNI";

  return `PT-${modeloAbreviado}-${colorAbreviado}-${tallaNormalizada}-${hash}`;
};

export const crearCodigoCortoProducto = ({
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modelo = "",
  tipoTela = "",
  colorBase = "",
  talla = "",
}) => {
  const descriptor = construirDescriptorProducto({
    categoriaModelo,
    modeloCatalogo,
    telaModelo,
    modeloBase: modelo,
    tipoTela,
    colorBase,
    talla,
  });
  const baseCorta =
    [descriptor.categoriaModelo, descriptor.modeloCatalogo, descriptor.telaModelo]
      .filter(Boolean)
      .join(" ") || modelo;
  const modeloCorto = crearAbreviaturaOperativa(baseCorta, 4);
  const varianteCorta = descriptor.tipoTela
    ? crearAbreviaturaOperativa(descriptor.tipoTela, 3)
    : "";
  const colorCorto = crearAbreviaturaOperativa(colorBase, 3);
  const tallaNormalizada = normalizarTexto(talla) || "UNI";

  return [modeloCorto, varianteCorta, colorCorto, tallaNormalizada]
    .filter(Boolean)
    .join("-");
};

const agruparProductosTerminadosCompatibles = (lista = []) => {
  const mapa = new Map();

  lista.forEach((item) => {
    if (!item) {
      return;
    }

    const claveCompatibilidad =
      construirClaveCompatibilidadProducto(item) ||
      item?.claveProducto ||
      item?.id ||
      crearClaveProducto({
        modelo: item?.modelo || "",
        colorBase: item?.colorBase || "",
        talla: item?.talla || "",
      });

    if (!claveCompatibilidad) {
      return;
    }

    const actual = mapa.get(claveCompatibilidad);

    if (!actual) {
      mapa.set(claveCompatibilidad, {
        ...item,
        claveProducto: item?.claveProducto || item?.id || claveCompatibilidad,
        id: item?.claveProducto || item?.id || claveCompatibilidad,
        stockActual: Number(item?.stockActual || 0),
        totalProgramado: Number(item?.totalProgramado || 0),
      });
      return;
    }

    const stockActual = Number(actual?.stockActual || 0);
    const stockNuevo = Number(item?.stockActual || 0);
    const fechaActual = String(
      actual?.ultimaFechaRecepcion ||
        actual?.ultimaFechaProduccion ||
        actual?.ultimaFechaSalida ||
        ""
    ).trim();
    const fechaNueva = String(
      item?.ultimaFechaRecepcion ||
        item?.ultimaFechaProduccion ||
        item?.ultimaFechaSalida ||
        ""
    ).trim();
    const usarNuevo =
      stockNuevo > stockActual ||
      (stockNuevo === stockActual && fechaNueva.localeCompare(fechaActual) > 0);

    mapa.set(claveCompatibilidad, {
      ...(usarNuevo ? actual : item),
      ...(usarNuevo ? item : actual),
      claveProducto:
        actual?.claveProducto ||
        actual?.id ||
        item?.claveProducto ||
        item?.id ||
        claveCompatibilidad,
      id:
        actual?.claveProducto ||
        actual?.id ||
        item?.claveProducto ||
        item?.id ||
        claveCompatibilidad,
      stockActual: stockActual + stockNuevo,
      totalProgramado: Math.max(
        Number(actual?.totalProgramado || 0),
        Number(item?.totalProgramado || 0)
      ),
    });
  });

  return Array.from(mapa.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );
};

export const leerProductosTerminados = () =>
  agruparProductosTerminadosCompatibles(
    leerListaGuardada(CLAVE_PRODUCTOS_TERMINADOS)
  );

export const leerMovimientosProductosTerminados = () =>
  leerListaGuardada(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS);

export const leerLotesProductosTerminados = () =>
  leerListaGuardada(CLAVE_LOTES_PRODUCTOS_TERMINADOS);

const crearLoteId = ({ codigoOp = "", codigoSalida = "", claveProducto = "" }) =>
  [
    normalizarTexto(codigoOp),
    normalizarTexto(codigoSalida || "SIN-SALIDA"),
    normalizarTexto(claveProducto),
  ].join("|");

const crearReferenciaIngreso = ({ recepcionId = "", codigoSalida = "" }) =>
  normalizarTexto(codigoSalida) || normalizarTexto(recepcionId);

const ordenarLotesFifo = (lotes = []) =>
  [...lotes].sort((a, b) => {
    const fechaA = a?.fechaIngreso || a?.ultimaFechaIngreso || "";
    const fechaB = b?.fechaIngreso || b?.ultimaFechaIngreso || "";

    if (fechaA !== fechaB) {
      return `${fechaA}`.localeCompare(`${fechaB}`);
    }

    return `${a?.codigoOp || ""}`.localeCompare(`${b?.codigoOp || ""}`);
  });

const crearLoteLegacyDesdeProducto = (producto = {}) => {
  const stockActual = Number(producto?.stockActual || 0);
  if (stockActual <= 0) {
    return null;
  }

  const codigoOp = producto?.ultimaOp || "SIN OP";
  const loteId = crearLoteId({
    codigoOp,
    codigoSalida: producto?.ultimaSalida || producto?.pedidoOrigen || "",
    claveProducto: producto?.claveProducto || producto?.id || "",
  });

  return {
    id: loteId,
    loteId,
    codigoOp,
    pedidoOrigen: producto?.pedidoOrigen || "",
    claveProducto: producto?.claveProducto || producto?.id || "",
    codigoProducto: producto?.codigoProducto || "",
    codigoCorto: producto?.codigoCorto || "",
    modelo: producto?.modelo || "",
    categoriaModelo: producto?.categoriaModelo || "",
    modeloCatalogo: producto?.modeloCatalogo || "",
    telaModelo: producto?.telaModelo || "",
    tipoTela: producto?.tipoTela || "",
    colorBase: producto?.colorBase || "",
    talla: producto?.talla || "",
    fechaIngreso:
      producto?.ultimaFechaRecepcion ||
      producto?.ultimaFechaProduccion ||
      producto?.ultimaFechaSalida ||
      "",
    ultimaFechaIngreso:
      producto?.ultimaFechaRecepcion ||
      producto?.ultimaFechaProduccion ||
      producto?.ultimaFechaSalida ||
      "",
    cantidadIngresadaTotal: stockActual,
    cantidadSalidaTotal: 0,
    stockActualLote: stockActual,
    origenLote: "SALDO INICIAL",
  };
};

const asegurarLotesPorProducto = (mapaLotes, producto = {}) => {
  const claveProducto = producto?.claveProducto || producto?.id || "";
  if (!claveProducto) return;

  const yaTieneLotes = Array.from(mapaLotes.values()).some(
    (item) => item?.claveProducto === claveProducto
  );

  if (yaTieneLotes) return;

  const loteLegacy = crearLoteLegacyDesdeProducto(producto);
  if (loteLegacy) {
    mapaLotes.set(loteLegacy.loteId, loteLegacy);
  }
};

const reconstruirCatalogoDesdeLotes = ({
  catalogoBase = [],
  lotes = [],
} = {}) => {
  const mapaBase = new Map(
    (Array.isArray(catalogoBase) ? catalogoBase : []).map((item) => [
      item?.claveProducto || item?.id,
      item,
    ])
  );
  const mapaReconstruido = new Map();

  (Array.isArray(lotes) ? lotes : []).forEach((lote) => {
    const claveProducto = lote?.claveProducto || "";
    if (!claveProducto) {
      return;
    }

    const base = mapaReconstruido.get(claveProducto) || mapaBase.get(claveProducto) || {};
    const stockLote = Number(lote?.stockActualLote || 0);

    mapaReconstruido.set(claveProducto, {
      ...base,
      id: claveProducto,
      claveProducto,
      codigoProducto: lote?.codigoProducto || base?.codigoProducto || "",
      codigoCorto: lote?.codigoCorto || base?.codigoCorto || "",
      modeloId: lote?.modeloId || base?.modeloId || "",
      codigoModelo: lote?.codigoModelo || base?.codigoModelo || "",
      varianteId: lote?.varianteId || base?.varianteId || "",
      codigoVariante: lote?.codigoVariante || base?.codigoVariante || "",
      codigoCortoVariante:
        lote?.codigoCortoVariante || base?.codigoCortoVariante || "",
      modelo: lote?.modelo || base?.modelo || "",
      categoriaModelo: lote?.categoriaModelo || base?.categoriaModelo || "",
      modeloCatalogo: lote?.modeloCatalogo || base?.modeloCatalogo || "",
      telaModelo: lote?.telaModelo || base?.telaModelo || "",
      tipoTela: lote?.tipoTela || base?.tipoTela || "",
      colorBase: lote?.colorBase || base?.colorBase || "",
      talla: lote?.talla || base?.talla || "",
      tipoSalida: lote?.tipoSalida || base?.tipoSalida || "PRINCIPAL",
      tipoHijo: lote?.tipoHijo || base?.tipoHijo || "",
      origenMaterial: lote?.origenMaterial || base?.origenMaterial || "",
      colorNuevo: Boolean(lote?.colorNuevo || base?.colorNuevo),
      stockActual: Number(base?.stockActual || 0) + stockLote,
      ultimaOp: lote?.codigoOp || base?.ultimaOp || "",
      ultimaSalida: lote?.codigoSalida || base?.ultimaSalida || "",
      ultimaFechaRecepcion:
        lote?.ultimaFechaIngreso || lote?.fechaIngreso || base?.ultimaFechaRecepcion || "",
    });
  });

  return Array.from(mapaReconstruido.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );
};

const revertirMovimientosRecepcionEnMapas = ({
  movimientosPrevios = [],
  mapaCatalogo = new Map(),
  mapaLotes = new Map(),
}) => {
  movimientosPrevios.forEach((movimiento) => {
    const actual = mapaCatalogo.get(movimiento?.claveProducto);

    if (actual) {
      mapaCatalogo.set(movimiento.claveProducto, {
        ...actual,
        modeloId: movimiento?.modeloId || actual?.modeloId || "",
        codigoModelo: movimiento?.codigoModelo || actual?.codigoModelo || "",
        varianteId: movimiento?.varianteId || actual?.varianteId || "",
        codigoVariante: movimiento?.codigoVariante || actual?.codigoVariante || "",
        codigoCortoVariante:
          movimiento?.codigoCortoVariante || actual?.codigoCortoVariante || "",
        stockActual: Math.max(
          0,
          Number(actual?.stockActual || 0) - Number(movimiento?.cantidad || 0)
        ),
      });
    }

    const loteActual = mapaLotes.get(movimiento?.loteId);
    if (loteActual) {
      mapaLotes.set(movimiento.loteId, {
        ...loteActual,
        modeloId: movimiento?.modeloId || loteActual?.modeloId || "",
        codigoModelo: movimiento?.codigoModelo || loteActual?.codigoModelo || "",
        varianteId: movimiento?.varianteId || loteActual?.varianteId || "",
        codigoVariante: movimiento?.codigoVariante || loteActual?.codigoVariante || "",
        codigoCortoVariante:
          movimiento?.codigoCortoVariante || loteActual?.codigoCortoVariante || "",
        cantidadIngresadaTotal: Math.max(
          0,
          Number(loteActual?.cantidadIngresadaTotal || 0) -
            Number(movimiento?.cantidad || 0)
        ),
        stockActualLote: Math.max(
          0,
          Number(loteActual?.stockActualLote || 0) - Number(movimiento?.cantidad || 0)
        ),
      });
    }
  });
};

const obtenerTallasActivas = (tallasSeleccionadas = []) =>
  Array.isArray(tallasSeleccionadas) && tallasSeleccionadas.length > 0
    ? TALLAS_DISPONIBLES.filter((talla) => tallasSeleccionadas.includes(talla))
    : [...TALLAS_DISPONIBLES];

// Este resumen concentra el catalogo de productos terminados que nacen desde la OP.
// El mismo codigo se reutiliza siempre que modelo, color y talla sean exactamente iguales.
export const construirProductosTerminadosDesdeCorte = (
  cabeceraCorte = {},
  filasCorte = []
) => {
  const tallasActivas = obtenerTallasActivas(cabeceraCorte?.tallasSeleccionadas || []);
  const mapa = new Map();

  filasCorte.forEach((fila) => {
    const colorBase = fila?.colorBase || "";

    tallasActivas.forEach((talla) => {
      const cantidad = Number(fila?.salidas?.[talla] || 0);

      if (cantidad <= 0) {
        return;
      }

      const modelo = cabeceraCorte?.modeloBase || "";
      const descriptor = construirDescriptorProducto({
        categoriaModelo: cabeceraCorte?.categoriaModelo || "",
        modeloCatalogo: cabeceraCorte?.modeloCatalogo || "",
        telaModelo: cabeceraCorte?.telaModelo || "",
        modeloBase: modelo,
        tipoTela: cabeceraCorte?.tipoTela || fila?.tipoTela || "",
        colorBase,
        talla,
      });
      const claveProducto = crearClaveProductoDetallada({
        categoriaModelo: cabeceraCorte?.categoriaModelo || "",
        modeloCatalogo: cabeceraCorte?.modeloCatalogo || "",
        telaModelo: cabeceraCorte?.telaModelo || "",
        modeloBase: modelo,
        tipoTela: cabeceraCorte?.tipoTela || fila?.tipoTela || "",
        colorBase,
        talla,
      });
      const actual = mapa.get(claveProducto) || {
        id: claveProducto,
        claveProducto,
        codigoProducto: crearCodigoProductoTerminado({
          categoriaModelo: descriptor.categoriaModelo,
          modeloCatalogo: descriptor.modeloCatalogo,
          telaModelo: descriptor.telaModelo,
          modelo: descriptor.nombreCompleto,
          tipoTela: descriptor.tipoTela,
          colorBase,
          talla,
        }),
        codigoCorto: crearCodigoCortoProducto({
          categoriaModelo: descriptor.categoriaModelo,
          modeloCatalogo: descriptor.modeloCatalogo,
          telaModelo: descriptor.telaModelo,
          modelo: descriptor.nombreCompleto,
          tipoTela: descriptor.tipoTela,
          colorBase,
          talla,
        }),
        codigoBarraTexto: crearCodigoCortoProducto({
          categoriaModelo: descriptor.categoriaModelo,
          modeloCatalogo: descriptor.modeloCatalogo,
          telaModelo: descriptor.telaModelo,
          modelo: descriptor.nombreCompleto,
          tipoTela: descriptor.tipoTela,
          colorBase,
          talla,
        }),
        codigoOp: cabeceraCorte?.codigoCorte || cabeceraCorte?.opOrigen || "",
        pedidoOrigen: cabeceraCorte?.pedidoOrigen || "",
        categoriaModelo: descriptor.categoriaModelo,
        modeloCatalogo: descriptor.modeloCatalogo,
        telaModelo: descriptor.telaModelo,
        modelo: descriptor.nombreCompleto,
        tipoTela: cabeceraCorte?.tipoTela || fila?.tipoTela || "",
        colorBase,
        talla,
        totalProgramado: 0,
      };

      actual.totalProgramado += cantidad;
      mapa.set(claveProducto, actual);
    });
  });

  return Array.from(mapa.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );
};

export const construirProductosTerminadosDesdeRecepcion = ({
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modelo = "",
  tipoTela = "",
  detalleRecepcion = [],
  tipoSalida = "PRINCIPAL",
  tipoHijo = "",
  origenMaterial = "",
  colorNuevo = false,
}) => {
  const mapa = new Map();

  (detalleRecepcion || []).forEach((fila) => {
    const colorBase = fila?.colorBase || "";

    TALLAS_DISPONIBLES.forEach((talla) => {
      const cantidad = Number(fila?.recibido?.[talla] || 0);

      if (cantidad <= 0) {
        return;
      }

      const descriptor = construirDescriptorProducto({
        categoriaModelo,
        modeloCatalogo,
        telaModelo,
        modeloBase: modelo,
        tipoTela,
        colorBase,
        talla,
      });
      const claveProducto = crearClaveProductoDetallada({
        categoriaModelo,
        modeloCatalogo,
        telaModelo,
        modeloBase: modelo,
        tipoTela,
        colorBase,
        talla,
      });
      const actual = mapa.get(claveProducto) || {
        id: claveProducto,
        claveProducto,
        codigoProducto: crearCodigoProductoTerminado({
          categoriaModelo: descriptor.categoriaModelo,
          modeloCatalogo: descriptor.modeloCatalogo,
          telaModelo: descriptor.telaModelo,
          modelo: descriptor.nombreCompleto,
          tipoTela: descriptor.tipoTela,
          colorBase,
          talla,
        }),
        codigoCorto: crearCodigoCortoProducto({
          categoriaModelo: descriptor.categoriaModelo,
          modeloCatalogo: descriptor.modeloCatalogo,
          telaModelo: descriptor.telaModelo,
          modelo: descriptor.nombreCompleto,
          tipoTela: descriptor.tipoTela,
          colorBase,
          talla,
        }),
        codigoBarraTexto: crearCodigoCortoProducto({
          categoriaModelo: descriptor.categoriaModelo,
          modeloCatalogo: descriptor.modeloCatalogo,
          telaModelo: descriptor.telaModelo,
          modelo: descriptor.nombreCompleto,
          tipoTela: descriptor.tipoTela,
          colorBase,
          talla,
        }),
        categoriaModelo: descriptor.categoriaModelo,
        modeloCatalogo: descriptor.modeloCatalogo,
        telaModelo: descriptor.telaModelo,
        modelo: descriptor.nombreCompleto,
        tipoTela,
        colorBase,
        talla,
        cantidadRecibida: 0,
        tipoSalida: normalizarTexto(tipoSalida) || "PRINCIPAL",
        tipoHijo: normalizarTexto(fila?.tipoHijo || tipoHijo),
        origenMaterial: normalizarTexto(fila?.origenMaterial || origenMaterial),
        colorNuevo: normalizarBooleano(fila?.colorNuevo ?? colorNuevo),
      };

      actual.cantidadRecibida += cantidad;
      mapa.set(claveProducto, actual);
    });
  });

  return Array.from(mapa.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );
};

export const sincronizarMaestroProductosTerminados = (
  cabeceraCorte = {},
  filasCorte = []
) => {
  const catalogoActual = leerProductosTerminados();
  const generados = construirProductosTerminadosDesdeCorte(cabeceraCorte, filasCorte);
  const mapaCatalogo = new Map(
    catalogoActual.map((item) => [item?.claveProducto || item?.id, item])
  );

  generados.forEach((producto) => {
    const actual = mapaCatalogo.get(producto.claveProducto) || {};

    mapaCatalogo.set(producto.claveProducto, {
      ...actual,
      ...producto,
      stockActual: Number(actual?.stockActual || 0),
      totalProgramado: Number(producto.totalProgramado || 0),
      ultimaOp: cabeceraCorte?.codigoCorte || cabeceraCorte?.opOrigen || "",
      ultimaFechaProduccion: cabeceraCorte?.fechaCorte || "",
    });
  });

  const catalogoActualizado = Array.from(mapaCatalogo.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );

  guardarLista(CLAVE_PRODUCTOS_TERMINADOS, catalogoActualizado);
  return generados;
};

const crearClaveVarianteCatalogo = (colorBase = "", talla = "") =>
  `${normalizarTexto(colorBase)}|${normalizarTexto(talla)}`;

const construirClaveCompatibilidadProducto = (producto = {}) =>
  [
    normalizarTexto(
      producto?.varianteId ||
        producto?.codigoVariante ||
        producto?.codigoCortoVariante ||
        ""
    ),
    normalizarTexto(producto?.categoriaModelo || ""),
    normalizarTexto(producto?.modeloCatalogo || ""),
    normalizarTexto(producto?.telaModelo || ""),
    normalizarTexto(producto?.modelo || ""),
    normalizarTexto(producto?.colorBase || ""),
    normalizarTexto(producto?.talla || ""),
  ].join("|");

const resolverClaveProductoExistente = ({
  producto = {},
  mapaCatalogo = new Map(),
} = {}) => {
  const claveDirecta = producto?.claveProducto || producto?.id || "";
  const claveCompatibilidad = construirClaveCompatibilidadProducto(producto);
  const claveBasicaProducto = crearClaveProducto({
    modelo: producto?.modelo || "",
    colorBase: producto?.colorBase || "",
    talla: producto?.talla || "",
  });

  const candidatos = Array.from(mapaCatalogo.values()).filter((item) => {
    if (!item) return false;
    return (
      (claveDirecta && (item?.claveProducto === claveDirecta || item?.id === claveDirecta)) ||
      (claveCompatibilidad &&
        construirClaveCompatibilidadProducto(item) === claveCompatibilidad) ||
      crearClaveProducto({
        modelo: item?.modelo || "",
        colorBase: item?.colorBase || "",
        talla: item?.talla || "",
      }) === claveBasicaProducto
    );
  });

  if (candidatos.length === 0) {
    return claveDirecta;
  }

  const existente = candidatos.sort((a, b) => {
    const stockA = Number(a?.stockActual || 0);
    const stockB = Number(b?.stockActual || 0);
    if (stockA !== stockB) {
      return stockB - stockA;
    }

    const fechaA = String(
      a?.ultimaFechaRecepcion || a?.ultimaFechaProduccion || a?.ultimaFechaSalida || ""
    ).trim();
    const fechaB = String(
      b?.ultimaFechaRecepcion || b?.ultimaFechaProduccion || b?.ultimaFechaSalida || ""
    ).trim();
    return fechaB.localeCompare(fechaA);
  })[0];

  return existente?.claveProducto || existente?.id || claveDirecta;
};

const resolverModeloCatalogoBase = async ({
  modeloId = "",
  codigoModelo = "",
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modelo = "",
} = {}) => {
  const modelos = await listarModelosProductoConfiguracion({ incluirInactivos: true });
  const nombreCompuesto = construirDescriptorProducto({
    categoriaModelo,
    modeloCatalogo,
    telaModelo,
    modeloBase: modelo,
  }).nombreCompleto;
  const candidatosNombre = Array.from(
    new Set([nombreCompuesto, modelo].map((item) => normalizarTexto(item)).filter(Boolean))
  );

  return (
    modelos.find((item) => item?.id && item.id === modeloId) ||
    modelos.find(
      (item) =>
        normalizarTexto(item?.codigoModelo || "") === normalizarTexto(codigoModelo || "")
    ) ||
    modelos.find((item) =>
      candidatosNombre.includes(
        normalizarTexto(item?.nombreNormalizado || item?.nombreModelo || "")
      )
    ) ||
    null
  );
};

const asegurarVariantesCatalogoParaIngreso = async ({
  resumenIngresado = [],
  modeloId = "",
  codigoModelo = "",
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modelo = "",
} = {}) => {
  if (!Array.isArray(resumenIngresado) || resumenIngresado.length === 0) {
    return [];
  }

  const modeloBase = await resolverModeloCatalogoBase({
    modeloId,
    codigoModelo,
    categoriaModelo,
    modeloCatalogo,
    telaModelo,
    modelo,
  });

  const descriptorModelo = construirDescriptorProducto({
    categoriaModelo,
    modeloCatalogo,
    telaModelo,
    modeloBase: modelo,
  });

  const modeloBaseAsegurado = modeloBase?.id
    ? modeloBase
    : await guardarModeloProductoConfiguracion({
        codigoModelo,
        nombreModelo:
          descriptorModelo.nombreCompleto || modelo || modeloCatalogo || "MODELO NUEVO",
        categoria: categoriaModelo || descriptorModelo.categoriaModelo || "",
        modeloCatalogo: modeloCatalogo || descriptorModelo.modeloCatalogo || "",
        telaNombre: telaModelo || descriptorModelo.telaModelo || "",
        estado: "ACTIVO",
        origenCarga: "INGRESO_STOCK",
        metadata: {
          creadoAutomaticamente: true,
          creadoDesde: "PRODUCTOS_TERMINADOS",
        },
      });

  if (!modeloBaseAsegurado?.id) {
    return resumenIngresado;
  }

  const variantesActuales = await listarVariantesProductoPorModeloConfiguracion({
    modeloId: modeloBaseAsegurado.id,
    codigoModelo: modeloBaseAsegurado.codigoModelo,
    nombreModelo: modeloBaseAsegurado.nombreModelo,
    incluirInactivos: true,
  });
  const mapaVariantes = new Map(
    variantesActuales.map((item) => [
      crearClaveVarianteCatalogo(item?.color, item?.talla),
      item,
    ])
  );

  const resumenConVariantes = [];

  for (const producto of resumenIngresado) {
    const claveVariante = crearClaveVarianteCatalogo(producto?.colorBase, producto?.talla);
    let variante = mapaVariantes.get(claveVariante) || null;

    if (!variante) {
      variante = await guardarVarianteProductoConfiguracion({
        modeloId: modeloBaseAsegurado.id,
        color: producto?.colorBase || "",
        talla: producto?.talla || "",
        estado: "ACTIVO",
        origenCarga: normalizarTexto(producto?.origenMaterial || "") || "RECEPCION",
        metadata: {
          creadoDesdeRecepcion: true,
          tipoSalida: producto?.tipoSalida || "PRINCIPAL",
          tipoHijo: producto?.tipoHijo || "",
          origenMaterial: producto?.origenMaterial || "",
          colorNuevo: Boolean(producto?.colorNuevo),
        },
      });
      mapaVariantes.set(claveVariante, variante);
    }

    resumenConVariantes.push({
      ...producto,
      modeloId: modeloBaseAsegurado.id,
      codigoModelo: modeloBaseAsegurado.codigoModelo || codigoModelo || "",
      varianteId: variante?.id || "",
      codigoVariante: variante?.codigoVariante || "",
      codigoCortoVariante: variante?.codigoCorto || "",
      modelo:
        modeloBaseAsegurado?.nombreModelo ||
        producto?.modelo ||
        descriptorModelo.nombreCompleto,
      categoriaModelo:
        modeloBaseAsegurado?.categoria || producto?.categoriaModelo || "",
      modeloCatalogo:
        modeloBaseAsegurado?.modeloCatalogo || producto?.modeloCatalogo || "",
      telaModelo:
        modeloBaseAsegurado?.telaNombre || producto?.telaModelo || "",
    });
  }

  return resumenConVariantes;
};

// Recepcion suma stock terminado segun lo recibido y reemplaza el movimiento
// previo de la misma recepcion para evitar duplicados al editarla.
export const registrarIngresoProductosTerminados = async ({
  recepcionId = "",
  fecha = "",
  codigoOp = "",
  codigoSalida = "",
  modeloId = "",
  codigoModelo = "",
  categoriaModelo = "",
  modeloCatalogo = "",
  telaModelo = "",
  modelo = "",
  tipoTela = "",
  detalleRecepcion = [],
  tipoSalida = "PRINCIPAL",
  tipoHijo = "",
  origenMaterial = "",
  colorNuevo = false,
}) => {
  if (!recepcionId) {
    return [];
  }

  const referenciaIngreso = crearReferenciaIngreso({ recepcionId, codigoSalida });

  const catalogoActual = leerProductosTerminados();
  const movimientosActuales = leerMovimientosProductosTerminados();
  const lotesActuales = leerLotesProductosTerminados();
  const mapaCatalogo = new Map(
    catalogoActual.map((item) => [item?.claveProducto || item?.id, item])
  );
  const mapaLotes = new Map(
    lotesActuales.map((item) => [item?.loteId || item?.id, item])
  );
  const movimientosPrevios = movimientosActuales.filter(
    (movimiento) =>
      crearReferenciaIngreso({
        recepcionId: movimiento?.recepcionId,
        codigoSalida: movimiento?.codigoSalida,
      }) === referenciaIngreso
  );

  revertirMovimientosRecepcionEnMapas({
    movimientosPrevios,
    mapaCatalogo,
    mapaLotes,
  });

  const resumenBase = construirProductosTerminadosDesdeRecepcion({
    categoriaModelo,
    modeloCatalogo,
    telaModelo,
    modelo,
    tipoTela,
    detalleRecepcion,
    tipoSalida,
    tipoHijo,
    origenMaterial,
    colorNuevo,
  });
  const resumenIngresado = await asegurarVariantesCatalogoParaIngreso({
    resumenIngresado: resumenBase,
    modeloId,
    codigoModelo,
    categoriaModelo,
    modeloCatalogo,
    telaModelo,
    modelo,
  });
  const resumenNormalizado = resumenIngresado.map((producto) => {
    const claveProductoReal = resolverClaveProductoExistente({
      producto,
      mapaCatalogo,
    });
    const productoExistente = mapaCatalogo.get(claveProductoReal) || {};

    return {
      ...producto,
      id: claveProductoReal || producto?.id || producto?.claveProducto,
      claveProducto: claveProductoReal || producto?.claveProducto,
      codigoProducto:
        productoExistente?.codigoProducto || producto?.codigoProducto || "",
      codigoCorto:
        producto?.codigoCortoVariante ||
        productoExistente?.codigoCortoVariante ||
        productoExistente?.codigoCorto ||
        producto?.codigoCorto ||
        "",
      codigoBarraTexto:
        productoExistente?.codigoBarraTexto || producto?.codigoBarraTexto || "",
    };
  });

  const nuevosMovimientos = resumenNormalizado.map((producto) => ({
    id: `${referenciaIngreso}-${producto.codigoProducto}`,
    recepcionId,
    referenciaIngreso,
    fecha,
    codigoOp,
    codigoSalida,
    loteId: crearLoteId({
      codigoOp,
      codigoSalida,
      claveProducto: producto.claveProducto,
    }),
    claveProducto: producto.claveProducto,
    codigoProducto: producto.codigoProducto,
    modeloId: producto.modeloId || "",
    codigoModelo: producto.codigoModelo || "",
    varianteId: producto.varianteId || "",
    codigoVariante: producto.codigoVariante || "",
    codigoCortoVariante: producto.codigoCortoVariante || "",
    modelo: producto.modelo,
    tipoTela: producto.tipoTela,
    colorBase: producto.colorBase,
    talla: producto.talla,
    cantidad: Number(producto.cantidadRecibida || 0),
    tipoMovimiento: "INGRESO_TALLER",
    tipoSalida: producto.tipoSalida || "PRINCIPAL",
    tipoHijo: producto.tipoHijo || "",
    origenMaterial: producto.origenMaterial || "",
    colorNuevo: Boolean(producto.colorNuevo),
  }));

  resumenNormalizado.forEach((producto) => {
    const actual = mapaCatalogo.get(producto.claveProducto) || {};
    const loteId = crearLoteId({
      codigoOp,
      codigoSalida,
      claveProducto: producto.claveProducto,
    });
    const loteActual = mapaLotes.get(loteId) || {};

    mapaCatalogo.set(producto.claveProducto, {
      ...actual,
      ...producto,
      modeloId: producto.modeloId || actual?.modeloId || "",
      codigoModelo: producto.codigoModelo || actual?.codigoModelo || "",
      varianteId: producto.varianteId || actual?.varianteId || "",
      codigoVariante: producto.codigoVariante || actual?.codigoVariante || "",
      codigoCorto:
        producto.codigoCortoVariante ||
        actual?.codigoCortoVariante ||
        producto.codigoCorto ||
        actual?.codigoCorto ||
        "",
      codigoCortoVariante:
        producto.codigoCortoVariante || actual?.codigoCortoVariante || "",
      stockActual:
        Number(actual?.stockActual || 0) + Number(producto.cantidadRecibida || 0),
      ultimaOp: codigoOp,
      ultimaSalida: codigoSalida,
      ultimaFechaRecepcion: fecha,
      tipoSalida: producto.tipoSalida || actual?.tipoSalida || "PRINCIPAL",
      tipoHijo: producto.tipoHijo || actual?.tipoHijo || "",
      origenMaterial: producto.origenMaterial || actual?.origenMaterial || "",
      colorNuevo: Boolean(producto.colorNuevo || actual?.colorNuevo),
    });

    mapaLotes.set(loteId, {
      ...loteActual,
      id: loteId,
      loteId,
      codigoOp,
      codigoSalida,
      pedidoOrigen: codigoSalida || "",
      claveProducto: producto.claveProducto,
      codigoProducto: producto.codigoProducto,
      codigoCorto:
        producto.codigoCortoVariante ||
        loteActual?.codigoCortoVariante ||
        producto.codigoCorto ||
        loteActual?.codigoCorto ||
        "",
      modeloId: producto.modeloId || loteActual?.modeloId || "",
      codigoModelo: producto.codigoModelo || loteActual?.codigoModelo || "",
      varianteId: producto.varianteId || loteActual?.varianteId || "",
      codigoVariante: producto.codigoVariante || loteActual?.codigoVariante || "",
      codigoCortoVariante:
        producto.codigoCortoVariante || loteActual?.codigoCortoVariante || "",
      modelo: producto.modelo,
      categoriaModelo: producto.categoriaModelo,
      modeloCatalogo: producto.modeloCatalogo,
      telaModelo: producto.telaModelo,
      tipoTela: producto.tipoTela,
      colorBase: producto.colorBase,
      talla: producto.talla,
      tipoSalida: producto.tipoSalida || loteActual?.tipoSalida || "PRINCIPAL",
      tipoHijo: producto.tipoHijo || loteActual?.tipoHijo || "",
      origenMaterial: producto.origenMaterial || loteActual?.origenMaterial || "",
      colorNuevo: Boolean(producto.colorNuevo || loteActual?.colorNuevo),
      fechaIngreso: loteActual?.fechaIngreso || fecha,
      ultimaFechaIngreso: fecha,
      cantidadIngresadaTotal:
        Number(loteActual?.cantidadIngresadaTotal || 0) +
        Number(producto.cantidadRecibida || 0),
      cantidadSalidaTotal: Number(loteActual?.cantidadSalidaTotal || 0),
      stockActualLote:
        Number(loteActual?.stockActualLote || 0) +
        Number(producto.cantidadRecibida || 0),
      origenLote: "RECEPCION_TALLER",
    });
  });

  const catalogoActualizado = Array.from(mapaCatalogo.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );
  const movimientosActualizados = [
    ...nuevosMovimientos,
    ...movimientosActuales.filter(
      (movimiento) =>
        crearReferenciaIngreso({
          recepcionId: movimiento?.recepcionId,
          codigoSalida: movimiento?.codigoSalida,
        }) !== referenciaIngreso
    ),
  ];
  const lotesActualizados = ordenarLotesFifo(Array.from(mapaLotes.values())).filter(
    (item) =>
      Number(item?.cantidadIngresadaTotal || 0) > 0 ||
      Number(item?.stockActualLote || 0) > 0
  );

  guardarLista(CLAVE_PRODUCTOS_TERMINADOS, catalogoActualizado);
  guardarLista(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS, movimientosActualizados);
  guardarLista(CLAVE_LOTES_PRODUCTOS_TERMINADOS, lotesActualizados);

  return resumenNormalizado;
};

export const repararIdentidadCatalogoProductosTerminados = async () => {
  const productos = leerListaGuardada(CLAVE_PRODUCTOS_TERMINADOS);
  const movimientos = leerListaGuardada(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS);
  const lotes = leerListaGuardada(CLAVE_LOTES_PRODUCTOS_TERMINADOS);

  if (productos.length === 0 && movimientos.length === 0 && lotes.length === 0) {
    return {
      productos: [],
      movimientos: [],
      lotes: [],
    };
  }

  const referencias = [
    ...productos.map((item) => ({
      modelo: item?.modelo || "",
      categoriaModelo: item?.categoriaModelo || "",
      modeloCatalogo: item?.modeloCatalogo || "",
      telaModelo: item?.telaModelo || "",
      colorBase: item?.colorBase || "",
      talla: item?.talla || "",
      tipoSalida: item?.tipoSalida || "PRINCIPAL",
      tipoHijo: item?.tipoHijo || "",
      origenMaterial: item?.origenMaterial || "",
      colorNuevo: Boolean(item?.colorNuevo),
    })),
    ...lotes.map((item) => ({
      modelo: item?.modelo || "",
      categoriaModelo: item?.categoriaModelo || "",
      modeloCatalogo: item?.modeloCatalogo || "",
      telaModelo: item?.telaModelo || "",
      colorBase: item?.colorBase || "",
      talla: item?.talla || "",
      tipoSalida: item?.tipoSalida || "PRINCIPAL",
      tipoHijo: item?.tipoHijo || "",
      origenMaterial: item?.origenMaterial || "",
      colorNuevo: Boolean(item?.colorNuevo),
    })),
    ...movimientos.map((item) => ({
      modelo: item?.modelo || "",
      categoriaModelo: item?.categoriaModelo || "",
      modeloCatalogo: item?.modeloCatalogo || "",
      telaModelo: item?.telaModelo || "",
      colorBase: item?.colorBase || "",
      talla: item?.talla || "",
      tipoSalida: item?.tipoSalida || "PRINCIPAL",
      tipoHijo: item?.tipoHijo || "",
      origenMaterial: item?.origenMaterial || "",
      colorNuevo: Boolean(item?.colorNuevo),
    })),
  ].filter(
    (item) =>
      String(item?.modelo || "").trim() &&
      String(item?.colorBase || "").trim() &&
      String(item?.talla || "").trim()
  );

  const referenciasReparadas = await asegurarVariantesCatalogoParaIngreso({
    resumenIngresado: referencias,
  });

  const mapaReparacion = new Map(
    referenciasReparadas.map((item) => [
      construirClaveCompatibilidadProducto(item),
      item,
    ])
  );

  const resolverReparacion = (item = {}) =>
    mapaReparacion.get(construirClaveCompatibilidadProducto(item)) || null;

  const productosReparados = productos.map((item) => {
    const reparado = resolverReparacion(item);
    if (!reparado) {
      return item;
    }

    return {
      ...item,
      modeloId: reparado.modeloId || item?.modeloId || "",
      codigoModelo: reparado.codigoModelo || item?.codigoModelo || "",
      varianteId: reparado.varianteId || item?.varianteId || "",
      codigoVariante: reparado.codigoVariante || item?.codigoVariante || "",
      codigoCorto:
        reparado.codigoCortoVariante || item?.codigoCortoVariante || item?.codigoCorto || "",
      codigoCortoVariante:
        reparado.codigoCortoVariante || item?.codigoCortoVariante || "",
      modelo: reparado.modelo || item?.modelo || "",
      categoriaModelo: reparado.categoriaModelo || item?.categoriaModelo || "",
      modeloCatalogo: reparado.modeloCatalogo || item?.modeloCatalogo || "",
      telaModelo: reparado.telaModelo || item?.telaModelo || "",
      tipoSalida: reparado.tipoSalida || item?.tipoSalida || "PRINCIPAL",
      tipoHijo: reparado.tipoHijo || item?.tipoHijo || "",
      origenMaterial: reparado.origenMaterial || item?.origenMaterial || "",
      colorNuevo: Boolean(reparado.colorNuevo || item?.colorNuevo),
    };
  });

  const movimientosReparados = movimientos.map((item) => {
    const reparado = resolverReparacion(item);
    if (!reparado) {
      return item;
    }

    return {
      ...item,
      modeloId: reparado.modeloId || item?.modeloId || "",
      codigoModelo: reparado.codigoModelo || item?.codigoModelo || "",
      varianteId: reparado.varianteId || item?.varianteId || "",
      codigoVariante: reparado.codigoVariante || item?.codigoVariante || "",
      codigoCorto:
        reparado.codigoCortoVariante || item?.codigoCortoVariante || item?.codigoCorto || "",
      codigoCortoVariante:
        reparado.codigoCortoVariante || item?.codigoCortoVariante || "",
      modelo: reparado.modelo || item?.modelo || "",
      categoriaModelo: reparado.categoriaModelo || item?.categoriaModelo || "",
      modeloCatalogo: reparado.modeloCatalogo || item?.modeloCatalogo || "",
      telaModelo: reparado.telaModelo || item?.telaModelo || "",
      tipoSalida: reparado.tipoSalida || item?.tipoSalida || "PRINCIPAL",
      tipoHijo: reparado.tipoHijo || item?.tipoHijo || "",
      origenMaterial: reparado.origenMaterial || item?.origenMaterial || "",
      colorNuevo: Boolean(reparado.colorNuevo || item?.colorNuevo),
    };
  });

  const lotesReparados = lotes.map((item) => {
    const reparado = resolverReparacion(item);
    if (!reparado) {
      return item;
    }

    return {
      ...item,
      modeloId: reparado.modeloId || item?.modeloId || "",
      codigoModelo: reparado.codigoModelo || item?.codigoModelo || "",
      varianteId: reparado.varianteId || item?.varianteId || "",
      codigoVariante: reparado.codigoVariante || item?.codigoVariante || "",
      codigoCorto:
        reparado.codigoCortoVariante || item?.codigoCortoVariante || item?.codigoCorto || "",
      codigoCortoVariante:
        reparado.codigoCortoVariante || item?.codigoCortoVariante || "",
      modelo: reparado.modelo || item?.modelo || "",
      categoriaModelo: reparado.categoriaModelo || item?.categoriaModelo || "",
      modeloCatalogo: reparado.modeloCatalogo || item?.modeloCatalogo || "",
      telaModelo: reparado.telaModelo || item?.telaModelo || "",
      tipoSalida: reparado.tipoSalida || item?.tipoSalida || "PRINCIPAL",
      tipoHijo: reparado.tipoHijo || item?.tipoHijo || "",
      origenMaterial: reparado.origenMaterial || item?.origenMaterial || "",
      colorNuevo: Boolean(reparado.colorNuevo || item?.colorNuevo),
    };
  });

  guardarLista(CLAVE_PRODUCTOS_TERMINADOS, productosReparados);
  guardarLista(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS, movimientosReparados);
  guardarLista(CLAVE_LOTES_PRODUCTOS_TERMINADOS, lotesReparados);

  return {
    productos: productosReparados,
    movimientos: movimientosReparados,
    lotes: lotesReparados,
  };
};

export const reconstruirStockProductosTerminadosDesdeLotes = () => {
  const catalogoBase = leerListaGuardada(CLAVE_PRODUCTOS_TERMINADOS);
  const lotes = leerListaGuardada(CLAVE_LOTES_PRODUCTOS_TERMINADOS);
  const catalogoReconstruido = reconstruirCatalogoDesdeLotes({
    catalogoBase,
    lotes,
  });

  guardarLista(CLAVE_PRODUCTOS_TERMINADOS, catalogoReconstruido);
  return catalogoReconstruido;
};

export const eliminarIngresosProductosTerminadosPorRecepciones = ({
  recepcionIds = [],
} = {}) => {
  const idsObjetivo = Array.from(
    new Set(
      (Array.isArray(recepcionIds) ? recepcionIds : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );

  if (idsObjetivo.length === 0) {
    return [];
  }

  const catalogoActual = leerListaGuardada(CLAVE_PRODUCTOS_TERMINADOS);
  const movimientosActuales = leerMovimientosProductosTerminados();
  const lotesActuales = leerLotesProductosTerminados();
  const mapaCatalogo = new Map(
    catalogoActual.map((item) => [item?.claveProducto || item?.id, item])
  );
  const mapaLotes = new Map(
    lotesActuales.map((item) => [item?.loteId || item?.id, item])
  );
  const movimientosPrevios = movimientosActuales.filter((movimiento) =>
    idsObjetivo.includes(String(movimiento?.recepcionId || "").trim())
  );

  if (movimientosPrevios.length === 0) {
    return [];
  }

  revertirMovimientosRecepcionEnMapas({
    movimientosPrevios,
    mapaCatalogo,
    mapaLotes,
  });

  const movimientosActualizados = movimientosActuales.filter(
    (movimiento) => !idsObjetivo.includes(String(movimiento?.recepcionId || "").trim())
  );
  const lotesActualizados = ordenarLotesFifo(Array.from(mapaLotes.values())).filter(
    (item) =>
      Number(item?.cantidadIngresadaTotal || 0) > 0 ||
      Number(item?.stockActualLote || 0) > 0
  );
  const catalogoActualizado = reconstruirCatalogoDesdeLotes({
    catalogoBase: catalogoActual,
    lotes: lotesActualizados,
  });

  guardarLista(CLAVE_PRODUCTOS_TERMINADOS, catalogoActualizado);
  guardarLista(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS, movimientosActualizados);
  guardarLista(CLAVE_LOTES_PRODUCTOS_TERMINADOS, lotesActualizados);

  return movimientosPrevios;
};

// Las salidas a tienda descuentan stock solo cuando Almacen confirma el despacho.
// Si la misma salida se actualiza, primero se revierte el movimiento previo y luego se aplica el nuevo.
export const registrarSalidaProductosTerminados = ({
  salidaId = "",
  pedidoId = "",
  fecha = "",
  tienda = "",
  observacion = "",
  detalleSalida = [],
}) => {
  if (!salidaId) {
    return [];
  }

  const catalogoActual = leerProductosTerminados();
  const movimientosActuales = leerMovimientosProductosTerminados();
  const lotesActuales = leerLotesProductosTerminados();
  const mapaCatalogo = new Map(
    catalogoActual.map((item) => [item?.claveProducto || item?.id, item])
  );
  const mapaLotes = new Map(
    lotesActuales.map((item) => [item?.loteId || item?.id, item])
  );
  const movimientosPrevios = movimientosActuales.filter(
    (movimiento) => movimiento?.salidaId === salidaId
  );

  movimientosPrevios.forEach((movimiento) => {
    const actual = mapaCatalogo.get(movimiento?.claveProducto);

    if (!actual) {
      return;
    }

    mapaCatalogo.set(movimiento.claveProducto, {
      ...actual,
      stockActual:
        Number(actual?.stockActual || 0) + Number(movimiento?.cantidad || 0),
    });

    const loteActual = mapaLotes.get(movimiento?.loteId);
    if (loteActual) {
      mapaLotes.set(movimiento.loteId, {
        ...loteActual,
        stockActualLote:
          Number(loteActual?.stockActualLote || 0) + Number(movimiento?.cantidad || 0),
        cantidadSalidaTotal: Math.max(
          0,
          Number(loteActual?.cantidadSalidaTotal || 0) - Number(movimiento?.cantidad || 0)
        ),
      });
    }
  });

  const nuevosMovimientos = (Array.isArray(detalleSalida) ? detalleSalida : [])
    .flatMap((item, indice) => {
      const claveProducto = item?.claveProducto || item?.id;
      const actual = mapaCatalogo.get(claveProducto);
      const cantidad = Number(item?.cantidadAtendida || 0);

      if (!actual || cantidad <= 0) {
        return [];
      }

      asegurarLotesPorProducto(mapaLotes, actual);
      const lotesDisponibles = ordenarLotesFifo(
        Array.from(mapaLotes.values()).filter(
          (lote) =>
            lote?.claveProducto === claveProducto &&
            Number(lote?.stockActualLote || 0) > 0
        )
      );

      let saldoPendiente = cantidad;
      const movimientosLote = [];

      lotesDisponibles.forEach((lote) => {
        if (saldoPendiente <= 0) return;
        const stockLote = Number(lote?.stockActualLote || 0);
        if (stockLote <= 0) return;

        const cantidadLote = Math.min(stockLote, saldoPendiente);
        saldoPendiente -= cantidadLote;

        mapaLotes.set(lote.loteId, {
          ...lote,
          stockActualLote: stockLote - cantidadLote,
          cantidadSalidaTotal:
            Number(lote?.cantidadSalidaTotal || 0) + cantidadLote,
          ultimaFechaSalidaTienda: fecha,
          ultimaSalidaTienda: salidaId,
        });

        movimientosLote.push({
          id: `${salidaId}-${actual.codigoProducto || claveProducto}-${indice + 1}-${movimientosLote.length + 1}`,
          salidaId,
          pedidoId,
          fecha,
          tienda,
          observacion,
          loteId: lote.loteId,
          origenOp: lote.codigoOp || "",
          claveProducto,
          codigoProducto: actual.codigoProducto || "",
          codigoCorto: actual.codigoCorto || "",
          modelo: actual.modelo || "",
          colorBase: actual.colorBase || "",
          talla: actual.talla || "",
          cantidad: cantidadLote,
          tipoMovimiento: "SALIDA_TIENDA",
        });
      });

      if (saldoPendiente > 0) {
        const loteFallback =
          lotesDisponibles[0] || crearLoteLegacyDesdeProducto(actual);

        if (loteFallback) {
          const loteActual = mapaLotes.get(loteFallback.loteId) || loteFallback;
          mapaLotes.set(loteFallback.loteId, {
            ...loteActual,
            stockActualLote: Math.max(
              0,
              Number(loteActual?.stockActualLote || 0) - saldoPendiente
            ),
            cantidadSalidaTotal:
              Number(loteActual?.cantidadSalidaTotal || 0) + saldoPendiente,
            ultimaFechaSalidaTienda: fecha,
            ultimaSalidaTienda: salidaId,
          });

          movimientosLote.push({
            id: `${salidaId}-${actual.codigoProducto || claveProducto}-${indice + 1}-${movimientosLote.length + 1}`,
            salidaId,
            pedidoId,
            fecha,
            tienda,
            observacion,
            loteId: loteFallback.loteId,
            origenOp: loteFallback.codigoOp || "",
            claveProducto,
            codigoProducto: actual.codigoProducto || "",
            codigoCorto: actual.codigoCorto || "",
            modelo: actual.modelo || "",
            colorBase: actual.colorBase || "",
            talla: actual.talla || "",
            cantidad: saldoPendiente,
            tipoMovimiento: "SALIDA_TIENDA",
          });
        }
      }

      mapaCatalogo.set(claveProducto, {
        ...actual,
        stockActual: Math.max(0, Number(actual?.stockActual || 0) - cantidad),
        ultimaSalidaTienda: salidaId,
        ultimaFechaSalidaTienda: fecha,
      });

      return movimientosLote;
    })
    .filter(Boolean);

  const catalogoActualizado = Array.from(mapaCatalogo.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );

  const movimientosActualizados = [
    ...nuevosMovimientos,
    ...movimientosActuales.filter((movimiento) => movimiento?.salidaId !== salidaId),
  ];
  const lotesActualizados = ordenarLotesFifo(Array.from(mapaLotes.values())).filter(
    (item) =>
      Number(item?.cantidadIngresadaTotal || 0) > 0 ||
      Number(item?.stockActualLote || 0) > 0
  );

  guardarLista(CLAVE_PRODUCTOS_TERMINADOS, catalogoActualizado);
  guardarLista(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS, movimientosActualizados);
  guardarLista(CLAVE_LOTES_PRODUCTOS_TERMINADOS, lotesActualizados);

  return nuevosMovimientos;
};

export const leerAjustesPrendas = () => leerListaGuardada(CLAVE_AJUSTES_PRENDAS);

// Inventario fisico de producto terminado. Ajusta el stock actual y deja trazabilidad
// del cambio para futuros conteos o auditorias.
export const registrarAjusteProductoTerminado = ({
  ajusteId = "",
  fecha = "",
  motivoAjuste = "",
  observacionAjuste = "",
  producto = {},
  stockFisico = 0,
}) => {
  const catalogoActual = leerProductosTerminados();
  const movimientosActuales = leerMovimientosProductosTerminados();
  const ajustesActuales = leerAjustesPrendas();
  const mapaCatalogo = new Map(
    catalogoActual.map((item) => [item?.claveProducto || item?.id, item])
  );
  const claveProducto =
    resolverClaveProductoExistente({
      producto,
      mapaCatalogo,
    }) ||
    producto?.claveProducto ||
    producto?.id ||
    crearClaveProductoDetallada({
      categoriaModelo: producto?.categoriaModelo || "",
      modeloCatalogo: producto?.modeloCatalogo || "",
      telaModelo: producto?.telaModelo || "",
      modeloBase: producto?.modelo || "",
      tipoTela: producto?.tipoTela || "",
      colorBase: producto?.colorBase || "",
      talla: producto?.talla || "",
    });

  if (!ajusteId || !claveProducto) {
    return null;
  }

  const actual = mapaCatalogo.get(claveProducto) || {
    id: claveProducto,
    claveProducto,
    codigoProducto: producto?.codigoProducto || "",
    codigoCorto: producto?.codigoCorto || "",
    codigoBarraTexto: producto?.codigoBarraTexto || "",
    modeloId: producto?.modeloId || "",
    codigoModelo: producto?.codigoModelo || "",
    varianteId: producto?.varianteId || "",
    codigoVariante: producto?.codigoVariante || "",
    codigoCortoVariante: producto?.codigoCortoVariante || "",
    modelo: producto?.modelo || "",
    categoriaModelo: producto?.categoriaModelo || "",
    modeloCatalogo: producto?.modeloCatalogo || "",
    telaModelo: producto?.telaModelo || "",
    tipoTela: producto?.tipoTela || "",
    colorBase: producto?.colorBase || "",
    talla: producto?.talla || "",
    stockActual: 0,
    tipoSalida: producto?.tipoSalida || "PRINCIPAL",
    tipoHijo: producto?.tipoHijo || "",
    origenMaterial: producto?.origenMaterial || "",
    colorNuevo: Boolean(producto?.colorNuevo),
  };

  const stockAnterior = Number(actual?.stockActual || 0);
  const nuevoStock = Math.max(0, Number(stockFisico || 0));
  const diferencia = nuevoStock - stockAnterior;

  const registroAjuste = {
    id: ajusteId,
    fecha,
    claveProducto,
    codigoProducto: actual.codigoProducto || "",
    codigoCorto: actual.codigoCorto || "",
    modelo: actual.modelo || "",
    colorBase: actual.colorBase || "",
    talla: actual.talla || "",
    stockAnterior,
    stockFisico: nuevoStock,
    diferencia,
    motivoAjuste,
    observacionAjuste,
  };

  mapaCatalogo.set(claveProducto, {
    ...actual,
    stockActual: nuevoStock,
    ultimaFechaAjuste: fecha,
    ultimoMotivoAjuste: motivoAjuste,
  });

  const catalogoActualizado = Array.from(mapaCatalogo.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );

  const movimientoAjuste = {
    id: `AJP-${ajusteId}`,
    ajusteId,
    fecha,
    claveProducto,
    codigoProducto: actual.codigoProducto || "",
    codigoCorto: actual.codigoCorto || "",
    modelo: actual.modelo || "",
    colorBase: actual.colorBase || "",
    talla: actual.talla || "",
    cantidad: Math.abs(diferencia),
    diferencia,
    motivoAjuste,
    observacionAjuste,
    tipoMovimiento: "AJUSTE_PRENDA",
  };

  const movimientosActualizados = [
    movimientoAjuste,
    ...movimientosActuales.filter((movimiento) => movimiento?.ajusteId !== ajusteId),
  ];

  const ajustesActualizados = [
    registroAjuste,
    ...ajustesActuales.filter((item) => item?.id !== ajusteId),
  ];

  guardarLista(CLAVE_PRODUCTOS_TERMINADOS, catalogoActualizado);
  guardarLista(CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS, movimientosActualizados);
  guardarLista(CLAVE_AJUSTES_PRENDAS, ajustesActualizados);

  return registroAjuste;
};
