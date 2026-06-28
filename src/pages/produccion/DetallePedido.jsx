import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, UserAuth } from "../../index";
import {
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import { enfocarCampoValidacion } from "../../utils/validacionCampos";
import {
  construirNombreModelo,
  leerCatalogosProduccion,
} from "../../utils/catalogosProduccion";
import {
  buscarModeloVisual,
  obtenerFotosModeloVisual,
  obtenerVistasModeloVisual,
} from "../../utils/modelosVisuales";
import {
  sincronizarFlujoProduccionDesdeSupabase,
  sincronizarPedidoFlujoDesdeLocalASupabase,
} from "../../supabase/flujoProduccionCore.js";
import { obtenerNombreResponsableActivo } from "../../utils/responsableActivo";
import {

  guardarCorrelativoSistemaConfiguracion,
  leerCorrelativoSistemaConfiguracion,
  listarModelosProductoConfiguracion,
  listarVariantesProductoConfiguracion,
  registrarModeloYVariantesDesdePedido,
} from "../../supabase/configuracionCore.js";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

// Claves locales para guardar el pedido actual, el historial y el stock comprado.
const CLAVE_DETALLE_PEDIDO = "cynara_detalle_pedido_actual";
const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const CLAVE_DEVOLUCIONES_PRODUCCION = "cynara_devoluciones_produccion";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();
const TALLAS_POR_DEFECTO = ["S", "M", "L", "XL", "XXL"];

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
};

const obtenerAnioDesdeFecha = (fecha = "") => {
  const [anio] = (fecha || obtenerFechaActual()).split("-");
  const numero = Number(anio);
  return Number.isFinite(numero) ? numero : new Date().getFullYear();
};

const generarCodigoInternoPedido = (fechaSolicitud, correlativo = 1) => {
  const fechaBase = fechaSolicitud || obtenerFechaActual();
  const [anio, mes, dia] = fechaBase.split("-");
  const anioCorto = anio.slice(-2);
  const correlativoVisual = String(correlativo).padStart(2, "0");

  return `PED${dia}${mes}${anioCorto}-${correlativoVisual}`;
};

const extraerCorrelativoCodigoPedido = (codigoPedido = "") => {
  const partesCodigo = (codigoPedido || "").split("-");
  if (partesCodigo.length < 2) return 0;
  const numero = Number(partesCodigo[1]);
  return Number.isFinite(numero) ? numero : 0;
};

const crearCurvaVacia = () => ({
  S: "",
  M: "",
  L: "",
  XL: "",
  XXL: "",
});

// Busca el siguiente correlativo del anio para no repetir pedidos dentro del mismo ejercicio.
const obtenerCorrelativoPedido = (
  fechaSolicitud,
  historialPedidos,
  codigoExcluir = "",
  configuracionCorrelativo = {},
) => {
  const fechaBase = fechaSolicitud || obtenerFechaActual();
  const anioPedido = obtenerAnioDesdeFecha(fechaBase);
  const codigosDelAnio = historialPedidos
    .filter((pedido) => {
      const codigoPedido = pedido?.datosCabecera?.codigoInterno || "";
      const fechaPedido = pedido?.datosCabecera?.fechaSolicitud || "";

      return (
        obtenerAnioDesdeFecha(fechaPedido) === anioPedido &&
        codigoPedido !== codigoExcluir
      );
    })
    .map((pedido) => pedido.datosCabecera.codigoInterno);

  const correlativos = codigosDelAnio
    .map((codigoPedido) => extraerCorrelativoCodigoPedido(codigoPedido))
    .filter((correlativo) => Number.isFinite(correlativo));

  const correlativoMaximoHistorial =
    correlativos.length === 0 ? 0 : Math.max(...correlativos);
  const anioConfigurado = Number(configuracionCorrelativo?.anioActual || 0);
  const ultimoConfigurado = Number(configuracionCorrelativo?.ultimoCorrelativo || 0);
  const correlativoForzado = Number(
    configuracionCorrelativo?.siguienteForzado || 0,
  );

  if (anioConfigurado === anioPedido && correlativoForzado > 0) {
    return correlativoForzado;
  }

  const baseConfiguracion = anioConfigurado === anioPedido ? ultimoConfigurado : 0;
  return Math.max(correlativoMaximoHistorial, baseConfiguracion) + 1;
};

const buscarPedidoPorCorrelativoAnual = (
  fechaSolicitud,
  correlativoBuscado,
  historialPedidos = [],
  codigoExcluir = "",
) =>
  historialPedidos.find((pedido) => {
    const codigoPedido = pedido?.datosCabecera?.codigoInterno || "";
    const fechaPedido = pedido?.datosCabecera?.fechaSolicitud || "";

    return (
      codigoPedido !== codigoExcluir &&
      obtenerAnioDesdeFecha(fechaPedido) === obtenerAnioDesdeFecha(fechaSolicitud) &&
      extraerCorrelativoCodigoPedido(codigoPedido) === Number(correlativoBuscado || 0)
    );
  }) || null;

const crearCabeceraVacia = (historialPedidos = [], configuracionCorrelativo = {}) => {
  const fechaInicial = obtenerFechaActual();
  const correlativo = obtenerCorrelativoPedido(
    fechaInicial,
    historialPedidos,
    "",
    configuracionCorrelativo,
  );

  return {
    codigoInterno: generarCodigoInternoPedido(fechaInicial, correlativo),
    empresa: "Cynara",
    fechaSolicitud: fechaInicial,
    solicitante: "",
    modoModelo: "EXISTENTE",
    categoriaModelo: "",
    modeloCatalogo: "",
    telaModelo: "",
    modeloBase: "",
    tipoTela: "",
    tallasBase: "",
    tallasSeleccionadas: [],
    curvaTallas: crearCurvaVacia(),
    observacionesGenerales: "",
  };
};

// Cada fila representa una tela elegida para el pedido.
const filaInicial = {
  id: 1,
  codigoUnidad: "",
  colorBase: "",
  acabadoDiseno: "",
  anchoTela: "",
  partida: "",
  pesoTela: "",
  cantidad: "",
  observacion: "",
};

const telasBaseEjemplo = [
  {
    proveedor: "TEXTILES ANDINOS",
    tipoTela: "CHALIZ",
    colorBase: "NEGRO",
    acabadoDiseno: "",
    codigoBase: "CHNE",
    partidaBase: "P",
  },
  {
    proveedor: "IMPORTADORA SANTA FE",
    tipoTela: "FRENCH TERRY",
    colorBase: "NEGRO",
    acabadoDiseno: "LINEAS DORADAS",
    codigoBase: "FTNE",
    partidaBase: "FT",
  },
  {
    proveedor: "CORPORACION TEXTIL SUR",
    tipoTela: "FULL LICRA",
    colorBase: "AZUL MARINO",
    acabadoDiseno: "",
    codigoBase: "FLAZMA",
    partidaBase: "FL",
  },
  {
    proveedor: "TEXTILES PREMIUM",
    tipoTela: "DENIM",
    colorBase: "AZUL",
    acabadoDiseno: "ANIMAL PRINT",
    codigoBase: "DENAZ",
    partidaBase: "DN",
  },
  {
    proveedor: "AVANCE TEXTIL",
    tipoTela: "PERCHADO",
    colorBase: "ROJO",
    acabadoDiseno: "",
    codigoBase: "PERO",
    partidaBase: "PE",
  },
  {
    proveedor: "CASA DEL TEJIDO",
    tipoTela: "PERCHADO",
    colorBase: "AMARILLO",
    acabadoDiseno: "",
    codigoBase: "PEAM",
    partidaBase: "PE",
  },
  {
    proveedor: "TEJIDOS DEL NORTE",
    tipoTela: "FRENCH TERRY",
    colorBase: "BLANCO",
    acabadoDiseno: "",
    codigoBase: "FTBL",
    partidaBase: "FT",
  },
  {
    proveedor: "MODA TEXTIL SAC",
    tipoTela: "PIEL DE DURAZNO",
    colorBase: "BEIGE",
    acabadoDiseno: "",
    codigoBase: "PDBE",
    partidaBase: "PD",
  },
  {
    proveedor: "SUR TEXTILES",
    tipoTela: "CHOMPERO",
    colorBase: "GRIS",
    acabadoDiseno: "",
    codigoBase: "CHGR",
    partidaBase: "CH",
  },
  {
    proveedor: "REPRESENTACIONES LIMA",
    tipoTela: "FULL LICRA",
    colorBase: "AZUL MILITAR",
    acabadoDiseno: "",
    codigoBase: "FLAZMI",
    partidaBase: "FL",
  },
];

const stockTelasEjemplo = Array.from({ length: 30 }, (_, indice) => {
  const base = telasBaseEjemplo[indice % telasBaseEjemplo.length];
  const numero = indice + 1;
  const correlativo = String(numero).padStart(2, "0");
  const kilos = 12 + (indice % 7);
  const metros = 28 + (indice % 9);

  return {
    id: `demo-tela-${numero}`,
    codigoUnidad: `${base.codigoBase}${correlativo}`,
    tipoTela: base.tipoTela,
    colorBase: base.colorBase,
    acabadoDiseno: base.acabadoDiseno,
    partida: `${base.partidaBase}${String(100 + numero).padStart(3, "0")}`,
    proveedor: base.proveedor,
    kilos,
    metros,
  };
});

const crearFilasVacias = () => [
  {
    ...filaInicial,
  },
];

const filaPedidoEstaVacia = (fila) =>
  !fila.codigoUnidad &&
  !fila.colorBase &&
  !fila.acabadoDiseno &&
  !fila.partida &&
  !fila.pesoTela &&
  !fila.cantidad &&
  !fila.observacion;

const obtenerCamposFaltantesPedido = (datosCabecera, filasPedido) => {
  const faltantes = [];
  const esModeloNuevo = (datosCabecera?.modoModelo || "EXISTENTE") === "NUEVO";

  if (!datosCabecera.empresa?.trim()) faltantes.push({ clave: "empresa", etiqueta: "Empresa" });
  if (!datosCabecera.solicitante?.trim()) faltantes.push({ clave: "responsable_solicitante", etiqueta: "Responsable" });
  if (!datosCabecera.modeloBase?.trim()) faltantes.push({ clave: "modeloBase", etiqueta: "Nombre del modelo" });
  if (esModeloNuevo) {
    if (!datosCabecera.categoriaModelo?.trim()) faltantes.push({ clave: "categoriaModelo", etiqueta: "Categoria" });
    if (!datosCabecera.modeloCatalogo?.trim()) faltantes.push({ clave: "modeloCatalogo", etiqueta: "Modelo" });
    if (!datosCabecera.telaModelo?.trim()) faltantes.push({ clave: "telaModelo", etiqueta: "Tela para nombre" });
  }
  if (!datosCabecera.tipoTela?.trim()) faltantes.push({ clave: "tipoTela", etiqueta: "Variante tecnica / tipo de tela" });
  if (!datosCabecera.tallasSeleccionadas?.length) faltantes.push({ clave: "tallas", etiqueta: "Tallas" });

  const tieneTelasSeleccionadas = filasPedido.some(
    (fila) => !filaPedidoEstaVacia(fila) && fila.codigoUnidad?.trim()
  );
  if (!tieneTelasSeleccionadas) {
    faltantes.push({ clave: "telasSeleccionadas", etiqueta: "Al menos una tela seleccionada" });
  }

  return faltantes;
};

// Mantiene compatibilidad con pedidos viejos que guardaban mas columnas.
const normalizarFilasPedido = (filasPedido = []) => {
  if (!filasPedido.length) {
    return crearFilasVacias();
  }

  return filasPedido.map((fila, indice) => ({
    ...filaInicial,
    id: fila.id || Date.now() + indice,
    codigoUnidad: fila.codigoUnidad || "",
    colorBase: fila.colorBase || fila.color || "",
    acabadoDiseno: fila.acabadoDiseno || "",
    anchoTela: fila.anchoTela || "",
    partida: fila.partida || "",
    pesoTela: fila.pesoTela || "",
    cantidad: fila.cantidad || "",
    observacion: fila.observacion || "",
  }));
};

const unirTallasSeleccionadas = (tallasSeleccionadas) => tallasSeleccionadas.join("-");

const normalizarCabeceraPedido = (
  datosCabecera = {},
  historialPedidos = [],
  configuracionCorrelativo = {},
) => {
  const fechaSolicitud = datosCabecera.fechaSolicitud || obtenerFechaActual();
  const correlativo = obtenerCorrelativoPedido(
    fechaSolicitud,
    historialPedidos,
    datosCabecera.codigoInterno || "",
    configuracionCorrelativo,
  );

  return {
    ...crearCabeceraVacia(historialPedidos, configuracionCorrelativo),
    ...datosCabecera,
    modoModelo: datosCabecera.modoModelo || "EXISTENTE",
    codigoInterno:
      datosCabecera.codigoInterno ||
      generarCodigoInternoPedido(fechaSolicitud, correlativo),
    fechaSolicitud,
    tallasSeleccionadas: Array.isArray(datosCabecera.tallasSeleccionadas)
      ? datosCabecera.tallasSeleccionadas
      : [],
    curvaTallas: {
      ...crearCurvaVacia(),
      ...(datosCabecera.curvaTallas || {}),
    },
  };
};

const leerHistorialPedidos = () => {
  const contenido = localStorage.getItem(CLAVE_HISTORIAL_PEDIDOS);

  if (!contenido) {
    return [];
  }

  try {
    return JSON.parse(contenido);
  } catch {
    return [];
  }
};

const pedidoSigueActivo = (pedido) =>
  !pedido?.opGenerada &&
  !pedido?.despachoMateriaPrima &&
  !pedido?.cancelado &&
  !pedido?.eliminado;

const obtenerEstadoPedidoHistorial = (pedido = {}) => {
  if (pedido?.eliminado) return "ELIMINADO";
  if (pedido?.cancelado) return "CANCELADO";
  if (pedido?.opGenerada) return "OP GENERADA";
  if (pedido?.despachoMateriaPrima) return "DESPACHADO";
  return "PENDIENTE";
};

const pedidoTieneContenido = (pedido) => {
  const cabecera = pedido?.datosCabecera || {};
  const filas = pedido?.filasPedido || [];

  return Boolean(
    cabecera?.solicitante ||
      cabecera?.categoriaModelo ||
      cabecera?.modeloCatalogo ||
      cabecera?.telaModelo ||
      cabecera?.modeloBase ||
      cabecera?.tipoTela ||
      cabecera?.observacionesGenerales ||
      filas.some((fila) => !filaPedidoEstaVacia(fila))
  );
};

const construirPedidosVisibles = (historialPedidos = [], pedidoActual = null) => {
  const visibles = historialPedidos.filter(pedidoSigueActivo);

  if (
    pedidoActual?.datosCabecera &&
    pedidoTieneContenido(pedidoActual) &&
    pedidoSigueActivo(pedidoActual) &&
    !visibles.some(
      (pedido) =>
        pedido?.datosCabecera?.codigoInterno === pedidoActual?.datosCabecera?.codigoInterno
    )
  ) {
    return [pedidoActual, ...visibles];
  }

  return visibles;
};

const obtenerCodigosReservados = (historialPedidos = [], codigoExcluir = "") =>
  new Set(
    historialPedidos.flatMap((pedido) => {
      if (pedido?.datosCabecera?.codigoInterno === codigoExcluir) {
        return [];
      }

      return (pedido?.filasPedido || [])
        .map((fila) => fila?.codigoUnidad || "")
        .filter(Boolean);
    })
  );

const leerPedidoActual = () => {
  const contenido = localStorage.getItem(CLAVE_DETALLE_PEDIDO);

  if (!contenido) {
    return null;
  }

  try {
    return JSON.parse(contenido);
  } catch {
    return null;
  }
};

const leerHistorialIngresos = () => {
  const contenido = localStorage.getItem(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const crearNuevoPedidoEnBlanco = (historialPedidos = [], configuracionCorrelativo = {}) => ({
  datosCabecera: crearCabeceraVacia(historialPedidos, configuracionCorrelativo),
  filasPedido: crearFilasVacias(),
});

// Lleva el stock de telas al modulo de pedido para evitar pedir colores que no existen.
const construirStockTelasDisponibles = () => {
  const historialIngresos = leerHistorialIngresos();
  const historialPedidos = leerHistorialPedidos();
  const devolucionesProduccion = (() => {
    try {
      const contenido = localStorage.getItem(CLAVE_DEVOLUCIONES_PRODUCCION);
      const lista = contenido ? JSON.parse(contenido) : [];
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  })();

  if (historialIngresos.length === 0) {
    return stockTelasEjemplo;
  }

  const codigosDespachados = new Set(
    historialPedidos.flatMap((pedido) => {
      if (!pedido?.despachoMateriaPrima) {
        return [];
      }

      return (pedido?.filasPedido || [])
        .map((fila) => fila?.codigoUnidad || "")
        .filter(Boolean);
    }),
  );

  const devolucionesAceptadas = devolucionesProduccion.filter(
    (registro) => registro?.estado === "aceptada" && registro?.codigoUnidad,
  );
  const devolucionesPorCodigo = new Map(
    devolucionesAceptadas.map((registro) => [registro.codigoUnidad, registro]),
  );

  return historialIngresos.flatMap((ingreso, indiceIngreso) => {
    const cabeceraCompra = ingreso?.cabeceraCompra || {};
    const filasCompra = ingreso?.filasCompra || [];

    return filasCompra.flatMap((fila, indiceFila) => {
      const codigoUnidad = fila.codigoUnidad || "-";
      const devolucionAceptada = devolucionesPorCodigo.get(codigoUnidad);
      const fueDespachada = codigosDespachados.has(codigoUnidad);
      const baseComun = {
        codigoUnidad,
        tipoTela:
          fila.tipoTela === "Otro" ? fila.tipoTelaManual || "Otro" : fila.tipoTela || "-",
        colorBase: fila.colorBase || "-",
        acabadoDiseno: fila.acabadoDiseno || "",
        partida: fila.partida || "-",
        proveedor: cabeceraCompra.proveedor || "-",
      };

      if (devolucionAceptada?.tipoDevolucion === "SOBRANTE_PRODUCCION") {
        return [
          {
            id: `${cabeceraCompra.codigoInterno || "ingreso"}-sobrante-${fila.id || indiceFila}-${indiceIngreso}`,
            ...baseComun,
            kilos: Number(
              devolucionAceptada?.pesoDevuelto || devolucionAceptada?.pesoTela || 0,
            ),
            metros: 0,
            origenStock: "SOBRANTE",
          },
        ];
      }

      if (fueDespachada && !devolucionAceptada) {
        return [];
      }

      if (devolucionAceptada?.tipoDevolucion === "DEVOLUCION_TOTAL") {
        return [
          {
            id: `${cabeceraCompra.codigoInterno || "ingreso"}-devuelto-${fila.id || indiceFila}-${indiceIngreso}`,
            ...baseComun,
            kilos: Number(
              devolucionAceptada?.pesoDevuelto ||
                devolucionAceptada?.pesoTela ||
                fila.kilos ||
                0,
            ),
            metros: Number(fila.metros || 0),
            origenStock: "DEVOLUCION_TOTAL",
          },
        ];
      }

      return [
        {
          id: `${cabeceraCompra.codigoInterno || "ingreso"}-tela-${fila.id || indiceFila}-${indiceIngreso}`,
          ...baseComun,
          kilos: Number(fila.kilos || 0),
          metros: Number(fila.metros || 0),
          origenStock: "ROLLO",
        },
      ];
    });
  });
};

const formatearStockDisponible = (tela) => {
  if (Number(tela.kilos || 0) > 0) {
    return `${Number(tela.kilos).toFixed(2)} KG${
      tela?.origenStock === "SOBRANTE" ? " | SOBRANTE" : ""
    }`;
  }

  if (Number(tela.metros || 0) > 0) {
    return `${Number(tela.metros).toFixed(2)} MTS${
      tela?.origenStock === "SOBRANTE" ? " | SOBRANTE" : ""
    }`;
  }

  return "-";
};

const formatearPesoDecimal = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero.toFixed(2) : "";
};

export function DetallePedido() {
  const { user } = UserAuth();
  const responsableActivo = useMemo(
    () => obtenerNombreResponsableActivo(user),
    [user]
  );
  const catalogosProduccion = useMemo(leerCatalogosProduccion, []);
  const tallasDisponibles = catalogosProduccion.tallas?.length
    ? catalogosProduccion.tallas
    : TALLAS_POR_DEFECTO;
  const pedidoActualGuardado = leerPedidoActual();
  const historialInicial = leerHistorialPedidos();
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [historialPedidosCompleto, setHistorialPedidosCompleto] = useState(() => {
    if (historialInicial.length > 0) {
      return historialInicial;
    }

    if (pedidoActualGuardado?.datosCabecera && pedidoTieneContenido(pedidoActualGuardado)) {
      return [pedidoActualGuardado];
    }

    return [];
  });
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState(
    pedidoActualGuardado?.datosCabecera?.codigoInterno || ""
  );
  const [datosCabecera, setDatosCabecera] = useState(
    normalizarCabeceraPedido(pedidoActualGuardado?.datosCabecera, historialInicial)
  );

  useEffect(() => {
    if (!responsableActivo) return;

    setDatosCabecera((anterior) =>
      anterior?.solicitante?.trim()
        ? anterior
        : {
            ...anterior,
            solicitante: responsableActivo,
          }
    );
  }, [responsableActivo]);
  const [filasPedido, setFilasPedido] = useState(
    normalizarFilasPedido(pedidoActualGuardado?.filasPedido)
  );
  const [busquedaStock, setBusquedaStock] = useState("");
  const [filtroTipoTelaStock, setFiltroTipoTelaStock] = useState("");
  const [filtroColorStock, setFiltroColorStock] = useState("");
  const [paginaPedidos, setPaginaPedidos] = useState(1);
  const [paginaStock, setPaginaStock] = useState(1);
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [catalogoVariantes, setCatalogoVariantes] = useState([]);
  const [configuracionCorrelativoPedido, setConfiguracionCorrelativoPedido] = useState({
    clave: "PEDIDO_PRODUCCION",
    anioActual: new Date().getFullYear(),
    ultimoCorrelativo: 0,
    siguienteForzado: 0,
  });
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [camposInvalidos, setCamposInvalidos] = useState([]);

  const historialPedidos = useMemo(
    () => construirPedidosVisibles(historialPedidosCompleto, pedidoActualGuardado),
    [historialPedidosCompleto, pedidoActualGuardado]
  );
  const historialPedidosNoActivos = useMemo(
    () =>
      historialPedidosCompleto.filter(
        (pedido) =>
          !pedidoSigueActivo(pedido) &&
          pedido?.datosCabecera?.codigoInterno,
      ),
    [historialPedidosCompleto],
  );
  const esPedidoExistente = useMemo(
    () =>
      historialPedidosCompleto.some(
        (pedido) =>
          pedido?.datosCabecera?.codigoInterno === datosCabecera.codigoInterno
      ),
    [historialPedidosCompleto, datosCabecera.codigoInterno]
  );

  const stockTelasDisponibles = useMemo(construirStockTelasDisponibles, []);
  const codigosReservados = useMemo(
    () => obtenerCodigosReservados(historialPedidosCompleto, datosCabecera.codigoInterno),
    [historialPedidosCompleto, datosCabecera.codigoInterno]
  );

  // Filtra el stock por tipo de tela del pedido y luego por texto de busqueda.
  const telasDisponiblesFiltradas = useMemo(() => {
    const tipoTelaBuscada = (datosCabecera.tipoTela || "").trim().toLowerCase();
    const textoBusqueda = busquedaStock.trim().toLowerCase();
    const filtroTipoTela = filtroTipoTelaStock.trim().toLowerCase();
    const filtroColor = filtroColorStock.trim().toLowerCase();
    const codigosDelPedidoActual = new Set(
      filasPedido.map((fila) => fila.codigoUnidad).filter(Boolean)
    );
    const existeCoincidenciaConTipoPedido = tipoTelaBuscada
      ? stockTelasDisponibles.some((fila) =>
          (fila.tipoTela || "").toLowerCase().includes(tipoTelaBuscada)
        )
      : false;

    const stockPorTipoTela = stockTelasDisponibles.filter((fila) => {
      const estaReservada =
        codigosReservados.has(fila.codigoUnidad) &&
        !codigosDelPedidoActual.has(fila.codigoUnidad);

      if (estaReservada) {
        return false;
      }

      if (!tipoTelaBuscada || !existeCoincidenciaConTipoPedido) {
        return (
          (!filtroTipoTela || (fila.tipoTela || "").toLowerCase() === filtroTipoTela) &&
          (!filtroColor || (fila.colorBase || "").toLowerCase() === filtroColor)
        );
      }

      const coincideTipoPedido = (fila.tipoTela || "").toLowerCase().includes(tipoTelaBuscada);
      const coincideTipoFiltro =
        !filtroTipoTela || (fila.tipoTela || "").toLowerCase() === filtroTipoTela;
      const coincideColorFiltro =
        !filtroColor || (fila.colorBase || "").toLowerCase() === filtroColor;

      return coincideTipoPedido && coincideTipoFiltro && coincideColorFiltro;
    });

    return stockPorTipoTela.filter((fila) => {
      if (!textoBusqueda) {
        return true;
      }

      return [
        fila.codigoUnidad,
        fila.tipoTela,
        fila.colorBase,
        fila.acabadoDiseno,
        fila.partida,
        fila.proveedor,
      ]
        .join(" ")
        .toLowerCase()
        .includes(textoBusqueda);
    }).sort((a, b) => {
      const aEsSobrante = a?.origenStock === "SOBRANTE" ? 0 : 1;
      const bEsSobrante = b?.origenStock === "SOBRANTE" ? 0 : 1;
      if (aEsSobrante !== bEsSobrante) {
        return aEsSobrante - bEsSobrante;
      }

      const colorComparacion = (a?.colorBase || "").localeCompare(b?.colorBase || "");
      if (colorComparacion !== 0) {
        return colorComparacion;
      }

      return (a?.codigoUnidad || "").localeCompare(b?.codigoUnidad || "");
    });
  }, [
    busquedaStock,
    datosCabecera.tipoTela,
    filtroTipoTelaStock,
    filtroColorStock,
    stockTelasDisponibles,
    codigosReservados,
    filasPedido,
  ]);

  const totalPaginasPedidos = Math.max(
    1,
    Math.ceil(historialPedidos.length / FILAS_POR_PAGINA)
  );
  const totalPaginasStock = Math.max(
    1,
    Math.ceil(telasDisponiblesFiltradas.length / FILAS_POR_PAGINA)
  );

  // Estas listas ya salen recortadas para que el listview no se vuelva gigante en tablet.
  const pedidosPaginados = useMemo(() => {
    const inicio = (paginaPedidos - 1) * FILAS_POR_PAGINA;
    return historialPedidos.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [historialPedidos, paginaPedidos]);

  const stockPaginado = useMemo(() => {
    const inicio = (paginaStock - 1) * FILAS_POR_PAGINA;
    return telasDisponiblesFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [telasDisponiblesFiltradas, paginaStock]);
  const coloresYaElegidos = useMemo(
    () =>
      Array.from(
        new Set(
          filasPedido
            .map((fila) => (fila?.colorBase || "").trim().toUpperCase())
            .filter(Boolean),
        ),
      ),
    [filasPedido],
  );
  const tallasActivas = tallasDisponibles.filter((talla) =>
    datosCabecera.tallasSeleccionadas.includes(talla)
  );
  const nombresCatalogoProductos = useMemo(
    () => catalogoProductos.map((item) => item?.nombreModelo).filter(Boolean),
    [catalogoProductos],
  );
  const modeloSeleccionadoCatalogo = useMemo(
    () =>
      catalogoProductos.find(
        (item) => item?.nombreModelo === (datosCabecera.modeloBase || "").trim().toUpperCase(),
      ) || null,
    [catalogoProductos, datosCabecera.modeloBase],
  );
  const resumenRapidoStockTipoTela = useMemo(() => {
    const tipoTelaBuscada = (datosCabecera.tipoTela || "").trim().toLowerCase();
    const codigosDelPedidoActual = new Set(
      filasPedido.map((fila) => fila.codigoUnidad).filter(Boolean),
    );

    if (!tipoTelaBuscada) {
      return [];
    }

    const filasTipoTela = stockTelasDisponibles.filter((fila) => {
      const estaReservada =
        codigosReservados.has(fila.codigoUnidad) &&
        !codigosDelPedidoActual.has(fila.codigoUnidad);

      if (estaReservada) {
        return false;
      }

      return (fila.tipoTela || "").toLowerCase().includes(tipoTelaBuscada);
    });

    const mapa = new Map();
    filasTipoTela.forEach((fila) => {
      const color = (fila.colorBase || "SIN COLOR").trim().toUpperCase();
      const actual = mapa.get(color) || {
        colorBase: color,
        rollos: 0,
        sobrantes: [],
        kilosTotales: 0,
      };

      const kilosFila = Number(fila.kilos || 0);
      actual.kilosTotales += kilosFila;

      if (fila.origenStock === "SOBRANTE") {
        actual.sobrantes.push({
          codigoUnidad: fila.codigoUnidad || "",
          kilos: kilosFila,
        });
      } else {
        actual.rollos += 1;
      }

      mapa.set(color, actual);
    });

    return Array.from(mapa.values()).sort((a, b) => {
      if (b.rollos !== a.rollos) return b.rollos - a.rollos;
      return a.colorBase.localeCompare(b.colorBase);
    });
  }, [
    datosCabecera.tipoTela,
    stockTelasDisponibles,
    codigosReservados,
    filasPedido,
  ]);
  const fichaVisualModelo = useMemo(
    () =>
      buscarModeloVisual({
        categoriaModelo: datosCabecera.categoriaModelo,
        modeloCatalogo: datosCabecera.modeloCatalogo,
        telaModelo: datosCabecera.telaModelo,
        modeloBase: datosCabecera.modeloBase,
      }),
    [
      datosCabecera.categoriaModelo,
      datosCabecera.modeloCatalogo,
      datosCabecera.telaModelo,
      datosCabecera.modeloBase,
    ]
  );
  const [vistaModeloActiva, setVistaModeloActiva] = useState("frente");
  const vistasModelo = useMemo(
    () => obtenerVistasModeloVisual(fichaVisualModelo || {}),
    [fichaVisualModelo]
  );

  useEffect(() => {
    const primeraVistaDisponible =
      vistasModelo.find((item) => item.url)?.clave || "frente";

    setVistaModeloActiva((anterior) => {
      if (vistasModelo.some((item) => item.clave === anterior && item.url)) {
        return anterior;
      }

      return primeraVistaDisponible;
    });
  }, [vistasModelo]);

  useEffect(() => {
    let activo = true;
    const cargarConfiguracionCorrelativo = async () => {
      try {
        const data = await leerCorrelativoSistemaConfiguracion("PEDIDO_PRODUCCION");
        if (!activo) return;
        setConfiguracionCorrelativoPedido(data);
        setDatosCabecera((anterior) =>
          normalizarCabeceraPedido(anterior, historialPedidosCompleto, data),
        );
      } catch (error) {
        console.error("No se pudo cargar el correlativo de pedidos:", error.message);
      }
    };
    cargarConfiguracionCorrelativo();
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;
    const sincronizar = async () => {
      try {
        const data = await sincronizarFlujoProduccionDesdeSupabase();
        if (!activo) return;
        const pedidosSincronizados = data?.pedidos || [];
        setHistorialPedidosCompleto(pedidosSincronizados);
        setDatosCabecera((anterior) => {
          const siguienteCabecera = normalizarCabeceraPedido(
            {
              ...anterior,
              codigoInterno: pedidoSeleccionadoId ? anterior.codigoInterno : "",
            },
            pedidosSincronizados,
            configuracionCorrelativoPedido,
          );

          if (!pedidoSeleccionadoId) {
            const detalleActual = leerPedidoActual();
            localStorage.setItem(
              CLAVE_DETALLE_PEDIDO,
              JSON.stringify({
                ...(detalleActual || crearNuevoPedidoEnBlanco(pedidosSincronizados)),
                datosCabecera: siguienteCabecera,
                filasPedido: normalizarFilasPedido(
                  detalleActual?.filasPedido || filasPedido
                ),
              })
            );
          }

          return siguienteCabecera;
        });
      } catch (error) {
        console.error("No se pudo sincronizar pedidos desde Supabase:", error.message);
      }
    };
    sincronizar();
    return () => {
      activo = false;
    };
  }, [pedidoSeleccionadoId, configuracionCorrelativoPedido]);

  useEffect(() => {
    let activo = true;
    const cargarCatalogo = async () => {
      try {
        const [listaModelos, listaVariantes] = await Promise.all([
          listarModelosProductoConfiguracion(),
          listarVariantesProductoConfiguracion(),
        ]);
        if (!activo) return;
        setCatalogoProductos(listaModelos);
        setCatalogoVariantes(listaVariantes);
      } catch (error) {
        console.error("No se pudo cargar el catalogo de productos:", error.message);
      }
    };
    cargarCatalogo();
    return () => {
      activo = false;
    };
  }, []);

  // Actualiza los inputs simples de la cabecera.
  const manejarCambioCabecera = (evento) => {
    const { name, value } = evento.target;
    setCamposInvalidos((anterior) => anterior.filter((item) => item !== name));

    setDatosCabecera((anterior) => {
      const siguienteCabecera = {
        ...anterior,
        codigoInterno:
          name === "fechaSolicitud"
            ? generarCodigoInternoPedido(
                value,
                obtenerCorrelativoPedido(
                  value,
                  historialPedidosCompleto,
                  anterior.codigoInterno,
                  configuracionCorrelativoPedido,
                )
              )
            : anterior.codigoInterno,
        [name]:
          name === "tipoTela" ||
          name === "categoriaModelo" ||
          name === "modeloCatalogo" ||
          name === "telaModelo" ||
          name === "modeloBase"
            ? value.toUpperCase()
            : value,
      };

      if (
        ["categoriaModelo", "modeloCatalogo", "telaModelo", "tipoTela"].includes(name) &&
        siguienteCabecera.modoModelo === "NUEVO"
      ) {
        siguienteCabecera.modeloBase = construirNombreModelo({
          categoria:
            name === "categoriaModelo" ? value : siguienteCabecera.categoriaModelo,
          telaModelo: name === "telaModelo" ? value : siguienteCabecera.telaModelo,
          modelo:
            name === "modeloCatalogo" ? value : siguienteCabecera.modeloCatalogo,
          tipoTela: name === "tipoTela" ? value : siguienteCabecera.tipoTela,
        });
      }

      return siguienteCabecera;
    });
  };

  const manejarCambioModoModelo = (modo) => {
    setCamposInvalidos((anterior) =>
      anterior.filter(
        (item) =>
          ![
            "modeloBase",
            "categoriaModelo",
            "modeloCatalogo",
            "telaModelo",
          ].includes(item),
      ),
    );
    setDatosCabecera((anterior) => ({
      ...anterior,
      modoModelo: modo,
      categoriaModelo: modo === "NUEVO" ? anterior.categoriaModelo : "",
      modeloCatalogo: modo === "NUEVO" ? anterior.modeloCatalogo : "",
      telaModelo: modo === "NUEVO" ? anterior.telaModelo : "",
      modeloBase: modo === "NUEVO" ? anterior.modeloBase : "",
    }));
  };

  const manejarSeleccionModeloExistente = (valor) => {
    const nombreModelo = valor.toUpperCase();
    setCamposInvalidos((anterior) => anterior.filter((item) => item !== "modeloBase"));
    const modelo = catalogoProductos.find(
      (item) => item?.nombreModelo === nombreModelo,
    );

    setDatosCabecera((anterior) => ({
      ...anterior,
      modoModelo: "EXISTENTE",
      modeloBase: nombreModelo,
      categoriaModelo: modelo?.categoria || "",
      modeloCatalogo: modelo?.modeloCatalogo || "",
      telaModelo: modelo?.telaNombre || "",
    }));
  };

  // Activa o desactiva tallas con check para que sea mas rapido en tablet.
  const manejarCambioTalla = (talla) => {
    setCamposInvalidos((anterior) => anterior.filter((item) => item !== "tallas"));
    setDatosCabecera((anterior) => ({
      ...anterior,
      tallasSeleccionadas: anterior.tallasSeleccionadas.includes(talla)
        ? anterior.tallasSeleccionadas.filter((item) => item !== talla)
        : [...anterior.tallasSeleccionadas, talla],
    }));
  };

  const manejarCambioCurva = (talla, valor) => {
    setDatosCabecera((anterior) => ({
      ...anterior,
      curvaTallas: {
        ...crearCurvaVacia(),
        ...(anterior.curvaTallas || {}),
        [talla]: valor,
      },
    }));
  };

  // Actualiza un textbox especifico dentro de la tabla del pedido.
  const manejarCambioFila = (idFila, campo, valor) => {
    setCamposInvalidos((anterior) =>
      campo === "codigoUnidad"
        ? anterior.filter((item) => item !== "telasSeleccionadas")
        : anterior,
    );
    setFilasPedido((anterior) =>
      anterior.map((fila) =>
        fila.id === idFila
          ? {
              ...fila,
              [campo]:
                campo === "codigoUnidad" || campo === "colorBase"
                  ? valor.toUpperCase()
                  : valor,
            }
          : fila
      )
    );
  };

  // Agrega una fila manual para casos especiales.
  const agregarFila = () => {
    setFilasPedido((anterior) => [
      ...anterior,
      {
        ...filaInicial,
        id: Date.now(),
      },
    ]);
  };

  // Al tocar una tela del stock, se agrega al detalle con sus datos base.
  const agregarTelaDesdeStock = (tela) => {
    const yaExiste = filasPedido.some(
      (fila) => fila.codigoUnidad && fila.codigoUnidad === tela.codigoUnidad
    );

    if (yaExiste) {
      return;
    }

    setCamposInvalidos((anterior) => anterior.filter((item) => item !== "telasSeleccionadas"));
    setFilasPedido((anterior) => {
      const nuevaFila = {
        ...filaInicial,
        id: Date.now(),
        codigoUnidad: tela.codigoUnidad,
        colorBase: tela.colorBase,
        acabadoDiseno: tela.acabadoDiseno,
        anchoTela: tela.ancho ? String(tela.ancho) : "",
        partida: tela.partida && tela.partida !== "-" ? tela.partida : "",
        pesoTela: formatearPesoDecimal(tela.kilos),
        observacion: "",
      };

      if (anterior.length === 1 && filaPedidoEstaVacia(anterior[0])) {
        return [{ ...anterior[0], ...nuevaFila, id: anterior[0].id || Date.now() }];
      }

      return [...anterior, nuevaFila];
    });
  };

  // Permite quitar filas, pero siempre deja al menos una visible.
  const eliminarFila = (idFila) => {
    const confirmarQuitar = window.confirm(
      "Seguro que deseas quitar la tela seleccionada?\n\nSi aun la necesitas, elige 'Cancelar'."
    );

    if (!confirmarQuitar) {
      return;
    }

    if (filasPedido.length === 1) {
      setFilasPedido((anterior) =>
        anterior.map((fila) =>
          fila.id === idFila ? { ...filaInicial, id: fila.id } : fila
        )
      );
      return;
    }

    setFilasPedido((anterior) => anterior.filter((fila) => fila.id !== idFila));
  };

  // Reabre un pedido guardado para seguir editandolo.
  const manejarSeleccionPedido = (pedido) => {
    setPedidoSeleccionadoId(pedido.datosCabecera.codigoInterno);
    const cabeceraNormalizada = normalizarCabeceraPedido(
      pedido.datosCabecera,
      historialPedidosCompleto,
      configuracionCorrelativoPedido,
    );
    setDatosCabecera({
      ...cabeceraNormalizada,
      solicitante: cabeceraNormalizada?.solicitante || responsableActivo || "",
    });
    setFilasPedido(normalizarFilasPedido(pedido.filasPedido));
    mostrarNotificacionCarga("Pedido cargado correctamente.");
  };

  const manejarCrearNuevoPedido = () => {
    const historialActual = historialPedidosCompleto;
    const nuevoBorrador = crearNuevoPedidoEnBlanco(
      historialActual,
      configuracionCorrelativoPedido,
    );

    localStorage.setItem(CLAVE_DETALLE_PEDIDO, JSON.stringify(nuevoBorrador));
    setPedidoSeleccionadoId("");
    setDatosCabecera(
      normalizarCabeceraPedido(
        nuevoBorrador.datosCabecera,
        historialActual,
        configuracionCorrelativoPedido,
      )
    );
    setFilasPedido(nuevoBorrador.filasPedido);
    mostrarNotificacionCarga("Formulario listo para un pedido nuevo.");
  };

  const manejarCancelarPedido = async () => {
    if (!esPedidoExistente || !datosCabecera.codigoInterno) {
      alert("Primero carga un pedido existente para cancelarlo.");
      return;
    }

    const confirmar = window.confirm(
      `Seguro que deseas cancelar esta orden de pedido?\n\nPedido: ${datosCabecera.codigoInterno}\nModelo: ${datosCabecera.modeloBase || "-"}\n\nEl pedido ya no seguira a Almacen ni Produccion, pero quedara en historial como cancelado.`
    );

    if (!confirmar) {
      return;
    }

    const historialCompleto = historialPedidosCompleto;
    const historialActualizado = historialCompleto.map((pedido) =>
      pedido?.datosCabecera?.codigoInterno === datosCabecera.codigoInterno
        ? {
            ...pedido,
            cancelado: true,
            fechaCancelacion: obtenerFechaActual(),
          }
        : pedido
    );

    localStorage.setItem(CLAVE_HISTORIAL_PEDIDOS, JSON.stringify(historialActualizado));

    const nuevoBorrador = crearNuevoPedidoEnBlanco(
      historialActualizado,
      configuracionCorrelativoPedido,
    );
    localStorage.setItem(CLAVE_DETALLE_PEDIDO, JSON.stringify(nuevoBorrador));
    setHistorialPedidosCompleto(historialActualizado);
    setPedidoSeleccionadoId("");
    setDatosCabecera(
      normalizarCabeceraPedido(
        nuevoBorrador.datosCabecera,
        historialActualizado,
        configuracionCorrelativoPedido,
      )
    );
    setFilasPedido(nuevoBorrador.filasPedido);
    setPaginaPedidos(1);

    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(datosCabecera.codigoInterno);
      const data = await sincronizarFlujoProduccionDesdeSupabase();
      setHistorialPedidosCompleto(data?.pedidos || historialActualizado);
    } catch (error) {
      console.error("No se pudo sincronizar la cancelacion del pedido:", error.message);
    }

    alert("Orden de pedido cancelada.");
  };

  // Solo esta pantalla puede eliminar pedidos del historial.
  const manejarEliminarPedido = async (codigoPedido) => {
    const historialCompleto = historialPedidosCompleto;
    const historialActualizado = historialCompleto.map((pedido) =>
      pedido?.datosCabecera?.codigoInterno === codigoPedido
        ? {
            ...pedido,
            eliminado: true,
            fechaEliminacion: obtenerFechaActual(),
          }
        : pedido
    );

    const pedidoActualEsEliminado =
      datosCabecera.codigoInterno === codigoPedido ||
      pedidoSeleccionadoId === codigoPedido;

    localStorage.setItem(CLAVE_HISTORIAL_PEDIDOS, JSON.stringify(historialActualizado));

    if (pedidoActualEsEliminado) {
      localStorage.removeItem(CLAVE_DETALLE_PEDIDO);
      setPedidoSeleccionadoId("");
      setDatosCabecera(
        normalizarCabeceraPedido({}, historialActualizado, configuracionCorrelativoPedido),
      );
      setFilasPedido(crearFilasVacias());
    }

    setHistorialPedidosCompleto(historialActualizado);
    setPaginaPedidos(1);

    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(codigoPedido);
      const data = await sincronizarFlujoProduccionDesdeSupabase();
      setHistorialPedidosCompleto(data?.pedidos || historialActualizado);
    } catch (error) {
      console.error("No se pudo marcar el pedido como eliminado en Supabase:", error.message);
    }
  };

  // Guarda el pedido actual y actualiza el historial local.
  const manejarGuardar = async () => {
    if (guardandoPedido) {
      return;
    }

    const faltantes = obtenerCamposFaltantesPedido(datosCabecera, filasPedido);

    if (faltantes.length > 0) {
      const clavesFaltantes = faltantes.map((item) => item.clave);
      setCamposInvalidos(clavesFaltantes);
      mostrarAlertaSistema(
        `Revisa estos campos:\n- ${faltantes.map((item) => item.etiqueta).join("\n- ")}`
      );
      enfocarCampoValidacion(clavesFaltantes[0]);
      return;
    }

    setCamposInvalidos([]);

    const historialCompleto = leerHistorialPedidos();
    const esModeloNuevo = (datosCabecera.modoModelo || "EXISTENTE") === "NUEVO";
    setGuardandoPedido(true);

    const datosCabeceraNormalizados = {
      ...normalizarCabeceraPedido(
        datosCabecera,
        historialCompleto,
        configuracionCorrelativoPedido,
      ),
      tallasBase: unirTallasSeleccionadas(datosCabecera.tallasSeleccionadas),
    };

    const correlativoAsignado = extraerCorrelativoCodigoPedido(
      datosCabeceraNormalizados.codigoInterno,
    );
    const pedidoEnConflicto = buscarPedidoPorCorrelativoAnual(
      datosCabeceraNormalizados.fechaSolicitud,
      correlativoAsignado,
      historialCompleto,
      datosCabeceraNormalizados.codigoInterno,
    );

    if (pedidoEnConflicto) {
      setGuardandoPedido(false);
      mostrarErrorSistema(
        `Ese correlativo anual ya existe en el historial: ${pedidoEnConflicto?.datosCabecera?.codigoInterno || "-"} (${pedidoEnConflicto?.datosCabecera?.modeloBase || "-"})`,
      );
      return;
    }

    const pedidoCompleto = {
      datosCabecera: datosCabeceraNormalizados,
      filasPedido,
    };

    const historialActualizado = [
      pedidoCompleto,
      ...historialCompleto.filter(
        (pedido) =>
          pedido.datosCabecera.codigoInterno !== datosCabeceraNormalizados.codigoInterno
      ),
    ];

    const anioPedidoGuardado = obtenerAnioDesdeFecha(
      datosCabeceraNormalizados.fechaSolicitud,
    );
    const configActualizada = {
      ...configuracionCorrelativoPedido,
      anioActual: anioPedidoGuardado,
      ultimoCorrelativo:
        anioPedidoGuardado === Number(configuracionCorrelativoPedido?.anioActual || 0)
          ? Math.max(
              Number(configuracionCorrelativoPedido?.ultimoCorrelativo || 0),
              correlativoAsignado,
            )
          : correlativoAsignado,
      siguienteForzado:
        Number(configuracionCorrelativoPedido?.siguienteForzado || 0) === correlativoAsignado
          ? 0
          : Number(configuracionCorrelativoPedido?.siguienteForzado || 0),
    };

    const respaldoDetallePedido = localStorage.getItem(CLAVE_DETALLE_PEDIDO);
    const respaldoHistorialPedidos = localStorage.getItem(CLAVE_HISTORIAL_PEDIDOS);

    localStorage.setItem(CLAVE_DETALLE_PEDIDO, JSON.stringify(pedidoCompleto));
    localStorage.setItem(CLAVE_HISTORIAL_PEDIDOS, JSON.stringify(historialActualizado));

    try {
      await guardarCorrelativoSistemaConfiguracion(configActualizada);
      await sincronizarPedidoFlujoDesdeLocalASupabase(
        datosCabeceraNormalizados.codigoInterno,
      );
    } catch (error) {
      if (respaldoDetallePedido) {
        localStorage.setItem(CLAVE_DETALLE_PEDIDO, respaldoDetallePedido);
      } else {
        localStorage.removeItem(CLAVE_DETALLE_PEDIDO);
      }

      if (respaldoHistorialPedidos) {
        localStorage.setItem(CLAVE_HISTORIAL_PEDIDOS, respaldoHistorialPedidos);
      } else {
        localStorage.removeItem(CLAVE_HISTORIAL_PEDIDOS);
      }

      setGuardandoPedido(false);
      mostrarErrorSistema(
        `No se pudo guardar el pedido en la base principal: ${error.message}`,
      );
      return;
    }

    setConfiguracionCorrelativoPedido(configActualizada);
    setHistorialPedidosCompleto(historialActualizado);
    const nuevaCabecera = crearCabeceraVacia(historialActualizado, configActualizada);
    const nuevoBorrador = {
      datosCabecera: nuevaCabecera,
      filasPedido: crearFilasVacias(),
    };

    localStorage.setItem(CLAVE_DETALLE_PEDIDO, JSON.stringify(nuevoBorrador));
    setPedidoSeleccionadoId("");
    setDatosCabecera(
      normalizarCabeceraPedido(
        nuevaCabecera,
        historialActualizado,
        configActualizada,
      ),
    );
    setFilasPedido(crearFilasVacias());
    setPaginaPedidos(1);

    setGuardandoPedido(false);
    mostrarNotificacionCarga(
      esPedidoExistente
        ? "Pedido actualizado. Los cambios ya quedaron listos para seguir el flujo."
        : "Pedido creado. Ya quedo listo para seguir el flujo."
    );

    Promise.resolve()
      .then(async () => {
        await registrarModeloYVariantesDesdePedido({
          modeloId: esModeloNuevo ? "" : modeloSeleccionadoCatalogo?.id || "",
          codigoModelo: esModeloNuevo ? "" : modeloSeleccionadoCatalogo?.codigoModelo || "",
          nombreModelo: datosCabecera.modeloBase,
          categoria: esModeloNuevo
            ? datosCabecera.categoriaModelo
            : modeloSeleccionadoCatalogo?.categoria || datosCabecera.categoriaModelo,
          modeloCatalogo: esModeloNuevo
            ? datosCabecera.modeloCatalogo
            : modeloSeleccionadoCatalogo?.modeloCatalogo || datosCabecera.modeloCatalogo,
          telaNombre: esModeloNuevo
            ? datosCabecera.telaModelo
            : modeloSeleccionadoCatalogo?.telaNombre || datosCabecera.telaModelo,
          colores: filasPedido.map((fila) => fila?.colorBase).filter(Boolean),
          tallas: datosCabecera.tallasSeleccionadas || [],
          metadata: {
            pedido_origen: datosCabecera.codigoInterno,
            creado_desde_pedido: true,
          },
        });
        const listaModelos = await listarModelosProductoConfiguracion();
        setCatalogoProductos(listaModelos);
        const data = await sincronizarFlujoProduccionDesdeSupabase();
        setHistorialPedidosCompleto(data?.pedidos || historialActualizado);
      })
      .catch((error) => {
        console.error("No se pudo completar la sincronizacion del pedido:", error.message);
      });
  };

  return (
    <ContenedorPagina>
      <header className="encabezado">
        <Header
          stateConfig={{
            state: estadoMenuUsuario,
            setState: () => setEstadoMenuUsuario(!estadoMenuUsuario),
          }}
        />
      </header>

      <section className="cabecera">
        <div>
          <h1>Detalle de pedido</h1>
          <p>
            Aqui se registra lo que se necesita producir antes de convertirlo en
            detalle de OP y luego pasarlo a corte.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Variantes cargadas</span>
          <strong>{filasPedido.length}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/produccion" className="boton_volver">
          Volver a Produccion
        </Link>

        <div className="navegacion_superior">
          <Link to="/produccion" className="btn btn_secundario btn_enlace">
            Atras
          </Link>
          <Link to="/produccion/detalle-op" className="btn btn_principal btn_enlace">
            Siguiente
          </Link>
        </div>
      </div>

      <main className="contenido">
        <section
          className={`tarjeta ${camposInvalidos.includes("telasSeleccionadas") ? "tarjeta_error_validacion" : ""}`}
          data-campo-validacion="telasSeleccionadas"
        >
          <div className="tarjeta__encabezado">
            <div>
              <h2>Pedidos disponibles</h2>
              <p>
                Puedes volver a abrir un pedido guardado para corregirlo o agregar otra tela.
              </p>
            </div>
          </div>

          <div className="lista_pedidos">
            {historialPedidos.length === 0 ? (
              <div className="pedido_vacio">Todavia no hay pedidos guardados en este equipo.</div>
            ) : (
              pedidosPaginados.map((pedido) => (
                <div
                  key={pedido.datosCabecera.codigoInterno}
                  className={`tarjeta_pedido ${
                    pedidoSeleccionadoId === pedido.datosCabecera.codigoInterno
                      ? "tarjeta_pedido_activa"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className="tarjeta_pedido__contenido"
                    onClick={() => manejarSeleccionPedido(pedido)}
                  >
                    <strong>{pedido.datosCabecera.codigoInterno}</strong>
                    <span>{pedido.datosCabecera.modeloBase || "Sin modelo"}</span>
                    <small>{pedido.datosCabecera.tipoTela || "Sin tela"}</small>
                  </button>

                  <button
                    type="button"
                    className="btn btn_peligro"
                    onClick={() => manejarEliminarPedido(pedido.datosCabecera.codigoInterno)}
                  >
                    Eliminar
                  </button>
                </div>
              ))
            )}
          </div>

          {historialPedidos.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaPedidos((anterior) => Math.max(1, anterior - 1))}
                disabled={paginaPedidos === 1}
              >
                Anterior
              </button>

              <span>
                Pagina {paginaPedidos} de {totalPaginasPedidos}
              </span>

              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaPedidos((anterior) =>
                    Math.min(totalPaginasPedidos, anterior + 1)
                  )
                }
                disabled={paginaPedidos === totalPaginasPedidos}
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {historialPedidosNoActivos.length > 0 ? (
            <div className="historial_secundario">
              <h3>Historial reciente</h3>
              <div className="lista_historial_secundario">
                {historialPedidosNoActivos
                  .slice()
                  .sort((a, b) =>
                    String(b?.datosCabecera?.fechaSolicitud || "").localeCompare(
                      String(a?.datosCabecera?.fechaSolicitud || "")
                    )
                  )
                  .slice(0, 12)
                  .map((pedido) => (
                    <div
                      key={`hist-${pedido?.datosCabecera?.codigoInterno}`}
                      className="historial_secundario__item"
                    >
                      <strong>{pedido?.datosCabecera?.codigoInterno || "-"}</strong>
                      <span>{pedido?.datosCabecera?.modeloBase || "Sin modelo"}</span>
                      <small>{obtenerEstadoPedidoHistorial(pedido)}</small>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="tarjeta">
          <h2>Datos generales</h2>

          <div className="grid_datos_generales">
            <div className="columna_datos">
              <Campo>
                <label>Codigo interno</label>
                <input type="text" name="codigoInterno" value={datosCabecera.codigoInterno} readOnly />
              </Campo>

              <Campo>
                <label>Fecha de solicitud</label>
                <input
                  type="date"
                  name="fechaSolicitud"
                  value={datosCabecera.fechaSolicitud}
                  onChange={manejarCambioCabecera}
                />
              </Campo>

              <Campo
                data-campo-validacion="modeloBase"
                className={`campo_requerido ${camposInvalidos.includes("modeloBase") ? "campo_error" : ""}`}
              >
                <label>Tipo de modelo</label>
                <div className="grupo_checks">
                  <CheckTalla>
                    <input
                      type="checkbox"
                      checked={datosCabecera.modoModelo === "EXISTENTE"}
                      onChange={() => manejarCambioModoModelo("EXISTENTE")}
                    />
                    <span>Modelo antiguo</span>
                  </CheckTalla>
                  <CheckTalla>
                    <input
                      type="checkbox"
                      checked={datosCabecera.modoModelo === "NUEVO"}
                      onChange={() => manejarCambioModoModelo("NUEVO")}
                    />
                    <span>Modelo nuevo</span>
                  </CheckTalla>
                </div>
              </Campo>

              <Campo
                data-campo-validacion="tipoTela"
                className={`campo_requerido ${camposInvalidos.includes("tipoTela") ? "campo_error" : ""}`}
              >
                <label>Nombre del modelo</label>
                {datosCabecera.modoModelo === "EXISTENTE" ? (
                  <>
                    <input
                      type="text"
                      list="catalogo-modelos-base-existentes"
                      name="modeloBase"
                      value={datosCabecera.modeloBase}
                      onChange={(evento) =>
                        manejarSeleccionModeloExistente(evento.target.value)
                      }
                      placeholder="Buscar modelo ya registrado"
                    />
                    <datalist id="catalogo-modelos-base-existentes">
                      {nombresCatalogoProductos.map((modelo) => (
                        <option key={modelo} value={modelo} />
                      ))}
                    </datalist>
                    <small className="texto_ayuda">
                      Si este modelo ya existe, aqui lo escoges y solo agregas tallas o
                      colores nuevos si hace falta.
                    </small>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      name="modeloBase"
                      value={datosCabecera.modeloBase}
                      readOnly
                      placeholder=""
                    />
                    <small className="texto_ayuda">
                      El sistema arma el nombre automaticamente desde categoria, modelo y
                      tela para nombre.
                    </small>
                  </>
                )}
              </Campo>

              <Campo
                data-campo-validacion="tipoTela"
                className={`campo_requerido ${camposInvalidos.includes("tipoTela") ? "campo_error" : ""}`}
              >
                <label>Variante tecnica / tipo de tela</label>
                <input
                  type="text"
                  list="catalogo-tipos-tela"
                  name="tipoTela"
                  value={datosCabecera.tipoTela}
                  onChange={manejarCambioCabecera}
                  placeholder="Buscar variante tecnica"
                />
                <datalist id="catalogo-tipos-tela">
                  {catalogosProduccion.tiposTela.map((tipoTela) => (
                    <option key={tipoTela} value={tipoTela} />
                  ))}
                </datalist>
              </Campo>

              <Campo
                data-campo-validacion="tallas"
                className={`campo_requerido ${camposInvalidos.includes("tallas") ? "campo_error" : ""}`}
              >
                <label>Tallas</label>
                <div className="grupo_checks">
                  {tallasDisponibles.map((talla) => (
                    <CheckTalla key={talla}>
                      <input
                        type="checkbox"
                        checked={datosCabecera.tallasSeleccionadas.includes(talla)}
                        onChange={() => manejarCambioTalla(talla)}
                      />
                      <span>{talla}</span>
                    </CheckTalla>
                  ))}
                </div>
              </Campo>

              <Campo className="campo_requerido">
                <label>Curva de tallas</label>
                <div className="grupo_checks grupo_curvas">
                  {tallasActivas.length === 0 ? (
                    <small className="texto_ayuda">
                      Primero marca las tallas del pedido para cargar su curva.
                    </small>
                  ) : (
                    tallasActivas.map((talla) => (
                      <CampoCurva key={talla}>
                        <span>{talla}</span>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={datosCabecera.curvaTallas?.[talla] || ""}
                          onChange={(evento) =>
                            manejarCambioCurva(talla, evento.target.value)
                          }
                          placeholder=""
                        />
                      </CampoCurva>
                    ))
                  )}
                </div>
              </Campo>

              <Campo>
                <label>Observaciones generales</label>
                <textarea
                  name="observacionesGenerales"
                  value={datosCabecera.observacionesGenerales}
                  onChange={manejarCambioCabecera}
                  placeholder=""
                />
              </Campo>
            </div>

            <div className="columna_datos">
              <Campo
                data-campo-validacion="empresa"
                className={`campo_requerido ${camposInvalidos.includes("empresa") ? "campo_error" : ""}`}
              >
                <label>Empresa</label>
                <input
                  type="text"
                  list="catalogo-empresas"
                  name="empresa"
                  value={datosCabecera.empresa}
                  onChange={manejarCambioCabecera}
                  placeholder=""
                />
                <datalist id="catalogo-empresas">
                  {catalogosProduccion.empresas.map((empresa) => (
                    <option key={empresa} value={empresa} />
                  ))}
                </datalist>
              </Campo>

              <Campo
                data-campo-validacion="responsable_solicitante"
                className={`campo_requerido ${camposInvalidos.includes("responsable_solicitante") ? "campo_error" : ""}`}
              >
                <label>Responsable</label>
                <input
                  type="text"
                  list="catalogo-personal-solicitante"
                  name="solicitante"
                  value={datosCabecera.solicitante}
                  onChange={manejarCambioCabecera}
                  placeholder=""
                />
                <datalist id="catalogo-personal-solicitante">
                  {catalogosProduccion.personal.map((persona) => (
                    <option key={persona} value={persona} />
                  ))}
                </datalist>
              </Campo>

              {datosCabecera.modoModelo === "NUEVO" ? (
                <>
                  <Campo
                    data-campo-validacion="categoriaModelo"
                    className={`campo_requerido ${camposInvalidos.includes("categoriaModelo") ? "campo_error" : ""}`}
                  >
                    <label>Categoria</label>
                    <input
                      type="text"
                      list="catalogo-categorias"
                      name="categoriaModelo"
                      value={datosCabecera.categoriaModelo}
                      onChange={manejarCambioCabecera}
                      placeholder="Buscar categoria"
                    />
                    <datalist id="catalogo-categorias">
                      {catalogosProduccion.categorias.map((categoria) => (
                        <option key={categoria} value={categoria} />
                      ))}
                    </datalist>
                  </Campo>

                  <Campo
                    data-campo-validacion="modeloCatalogo"
                    className={`campo_requerido ${camposInvalidos.includes("modeloCatalogo") ? "campo_error" : ""}`}
                  >
                    <label>Modelo</label>
                    <input
                      type="text"
                      list="catalogo-modelos"
                      name="modeloCatalogo"
                      value={datosCabecera.modeloCatalogo}
                      onChange={manejarCambioCabecera}
                      placeholder="Buscar modelo"
                    />
                    <datalist id="catalogo-modelos">
                      {catalogosProduccion.modelos.map((modelo) => (
                        <option key={modelo} value={modelo} />
                      ))}
                    </datalist>
                  </Campo>

                  <Campo
                    data-campo-validacion="telaModelo"
                    className={`campo_requerido ${camposInvalidos.includes("telaModelo") ? "campo_error" : ""}`}
                  >
                    <label>Tela para nombre</label>
                    <input
                      type="text"
                      list="catalogo-telas-modelo"
                      name="telaModelo"
                      value={datosCabecera.telaModelo}
                      onChange={manejarCambioCabecera}
                      placeholder="Buscar tela para nombre"
                    />
                    <datalist id="catalogo-telas-modelo">
                      {catalogosProduccion.telasModelo.map((tela) => (
                        <option key={tela} value={tela} />
                      ))}
                    </datalist>
                  </Campo>
                </>
              ) : (
                <Campo className="campo-completo">
                  <label>Referencia del catalogo</label>
                  <div className="resumen_catalogo_existente">
                    <strong>{modeloSeleccionadoCatalogo?.codigoModelo || "-"}</strong>
                    <span>
                      Categoria: {modeloSeleccionadoCatalogo?.categoria || "-"} | Modelo:{" "}
                      {modeloSeleccionadoCatalogo?.modeloCatalogo || "-"} | Tela:{" "}
                      {modeloSeleccionadoCatalogo?.telaNombre || "-"}
                    </span>
                  </div>
                </Campo>
              )}
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Stock disponible de telas</h2>
              <p>
                Toca una tela del stock para agregarla automatico al detalle del pedido.
              </p>
            </div>
          </div>

          <div className="resumen_stock_tipo_tela">
            <div className="resumen_stock_tipo_tela__encabezado">
              <strong>Resumen rapido por color</strong>
              <span>
                {datosCabecera.tipoTela
                  ? `Tipo de tela: ${datosCabecera.tipoTela}`
                  : "Selecciona primero el tipo de tela"}
              </span>
            </div>

            {!datosCabecera.tipoTela ? (
              <div className="estado_vacio estado_vacio_compacto">
                Aqui te mostraremos por color cuantos rollos hay disponibles y, aparte,
                cuantos kilos vienen de sobrantes aceptados.
              </div>
            ) : resumenRapidoStockTipoTela.length === 0 ? (
              <div className="estado_vacio estado_vacio_compacto">
                No hay stock disponible para ese tipo de tela.
              </div>
            ) : (
              <div className="resumen_stock_tipo_tela__grid">
                {resumenRapidoStockTipoTela.map((item) => (
                  <article
                    key={item.colorBase}
                    className={`tarjeta_resumen_color ${
                      filtroColorStock.trim().toUpperCase() === item.colorBase
                        ? "tarjeta_resumen_color_activa"
                        : ""
                    } ${coloresYaElegidos.includes(item.colorBase) ? "tarjeta_resumen_color_elegida" : ""}`}
                  >
                    <button
                      type="button"
                      className="tarjeta_resumen_color__boton"
                      onClick={() => {
                        setFiltroColorStock(item.colorBase);
                        setPaginaStock(1);
                      }}
                    >
                      <strong>{item.colorBase}</strong>
                      <span>{item.rollos} rollos disponibles</span>
                      {item.sobrantes.length > 0 ? (
                        <small>
                          {item.sobrantes.length} sobrante{item.sobrantes.length === 1 ? "" : "s"}:
                          {" "}
                          {item.sobrantes
                            .map((sobrante) => `${sobrante.kilos.toFixed(2)} kg`)
                            .join(" | ")}
                        </small>
                      ) : (
                        <small>Total visible: {item.kilosTotales.toFixed(2)} kg</small>
                      )}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="buscador_stock">
            <input
              type="text"
              value={busquedaStock}
              onChange={(evento) => {
                setBusquedaStock(evento.target.value);
                setPaginaStock(1);
              }}
              placeholder="Buscar por codigo, color base, acabado, partida o proveedor"
            />

            <input
              type="text"
              list="filtro-tipos-tela-stock"
              value={filtroTipoTelaStock}
              onChange={(evento) => {
                setFiltroTipoTelaStock(evento.target.value);
                setPaginaStock(1);
              }}
              placeholder="Filtrar por tipo de tela"
            />
            <datalist id="filtro-tipos-tela-stock">
              {catalogosProduccion.tiposTela.map((tipoTela) => (
                <option key={tipoTela} value={tipoTela} />
              ))}
            </datalist>

            <input
              type="text"
              list="filtro-colores-stock"
              value={filtroColorStock}
              onChange={(evento) => {
                setFiltroColorStock(evento.target.value);
                setPaginaStock(1);
              }}
              placeholder="Filtrar por color base"
            />
            <datalist id="filtro-colores-stock">
              {catalogosProduccion.colores.map((color) => (
                <option key={color} value={color} />
              ))}
            </datalist>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo unidad</th>
                  <th>Tipo tela</th>
                  <th>Color base</th>
                  <th>Acabado / diseÃ±o</th>
                  <th>Partida</th>
                  <th>Stock disponible</th>
                  <th>Accion</th>
                </tr>
              </thead>

              <tbody>
                {telasDisponiblesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="fila_vacia">
                      No hay telas disponibles para ese tipo de tela o filtro.
                    </td>
                  </tr>
                ) : (
                  stockPaginado.map((tela) => {
                    const telaYaElegida = filasPedido.some(
                      (fila) => fila.codigoUnidad && fila.codigoUnidad === tela.codigoUnidad
                    );
                    const colorYaElegido = coloresYaElegidos.includes(
                      (tela.colorBase || "").trim().toUpperCase(),
                    );
                    const esSobrante = tela?.origenStock === "SOBRANTE";

                    return (
                      <tr
                        key={tela.id}
                        className={`${esSobrante ? "fila_stock_sobrante" : ""} ${
                          colorYaElegido ? "fila_stock_color_elegido" : ""
                        } ${telaYaElegida ? "fila_stock_agregada" : ""}`}
                      >
                        <td>{tela.codigoUnidad}</td>
                        <td>{tela.tipoTela}</td>
                        <td>{tela.colorBase || "-"}</td>
                        <td>{tela.acabadoDiseno || "-"}</td>
                        <td>{tela.partida || "-"}</td>
                        <td>{formatearStockDisponible(tela)}</td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn_tabla ${
                              telaYaElegida ? "btn_secundario" : "btn_principal"
                            }`}
                            onClick={() => agregarTelaDesdeStock(tela)}
                            disabled={telaYaElegida}
                          >
                            {telaYaElegida ? "Agregada" : "Agregar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {telasDisponiblesFiltradas.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaStock((anterior) => Math.max(1, anterior - 1))}
                disabled={paginaStock === 1}
              >
                Anterior
              </button>

              <span>
                Pagina {paginaStock} de {totalPaginasStock}
              </span>

              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaStock((anterior) => Math.min(totalPaginasStock, anterior + 1))
                }
                disabled={paginaStock === totalPaginasStock}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Telas seleccionadas</h2>
              <p>
                Aqui el responsable revisa las telas elegidas antes de pasar a detalle de OP.
              </p>
            </div>

            <button type="button" className="btn btn_principal" onClick={agregarFila}>
              Agregar manual
            </button>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo unidad</th>
                  <th>Color base</th>
                  <th>Peso tela</th>
                  <th>Observacion</th>
                  <th>Accion</th>
                </tr>
              </thead>

              <tbody>
                {filasPedido.map((fila) => (
                  <tr key={fila.id}>
                    <td>
                      <input
                        type="text"
                        value={fila.codigoUnidad}
                        onChange={(evento) =>
                          manejarCambioFila(fila.id, "codigoUnidad", evento.target.value)
                        }
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={fila.colorBase}
                        onChange={(evento) =>
                          manejarCambioFila(fila.id, "colorBase", evento.target.value)
                        }
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={fila.pesoTela || ""}
                        onChange={(evento) =>
                          manejarCambioFila(fila.id, "pesoTela", evento.target.value)
                        }
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={fila.observacion}
                        onChange={(evento) =>
                          manejarCambioFila(fila.id, "observacion", evento.target.value)
                        }
                        placeholder=""
                      />
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn btn_secundario btn_tabla"
                        onClick={() => eliminarFila(fila.id)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Total de telas</span>
              <strong>{filasPedido.length}</strong>
            </div>

            <div>
              <span>Modelo base</span>
              <strong>{datosCabecera.modeloBase || "-"}</strong>
            </div>

            <div>
              <span>Tallas base</span>
              <strong>
                {unirTallasSeleccionadas(datosCabecera.tallasSeleccionadas) || "-"}
              </strong>
            </div>

            <div>
              <span>Tipo de tela</span>
              <strong>{datosCabecera.tipoTela || "-"}</strong>
            </div>
          </div>
        </section>

        {fichaVisualModelo ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Referencia visual del modelo</h2>
                <p>
                  Esta ficha visual ayuda a reconocer el modelo real desde varios
                  angulos antes de seguir con el pedido.
                </p>
              </div>
            </div>

            <div className="modelo_visual">
              <div className="modelo_visual__imagen">
                {obtenerFotosModeloVisual(fichaVisualModelo)[vistaModeloActiva] ? (
                <img
                    src={obtenerFotosModeloVisual(fichaVisualModelo)[vistaModeloActiva]}
                  alt={fichaVisualModelo.modeloBase || "Modelo"}
                />
                ) : (
                  <div className="modelo_visual__vacio">
                    Esta vista todavia no fue cargada.
                  </div>
                )}
                <div className="modelo_visual__tabs">
                  {vistasModelo.map((item) => (
                    <button
                      key={item.clave}
                      type="button"
                      className={`btn_vista_modelo ${
                        vistaModeloActiva === item.clave ? "btn_vista_modelo_activa" : ""
                      }`}
                      onClick={() => setVistaModeloActiva(item.clave)}
                      disabled={!item.url}
                    >
                      {item.titulo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modelo_visual__texto">
                <strong>{fichaVisualModelo.modeloBase}</strong>
                <p>{fichaVisualModelo.descripcionVisual || "Sin descripcion visual."}</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="acciones">
          <button
            type="button"
            className="btn btn_secundario"
            onClick={manejarCrearNuevoPedido}
            disabled={guardandoPedido}
          >
            Crear nuevo pedido
          </button>
          {esPedidoExistente ? (
            <button
              type="button"
              className="btn btn_peligro"
              onClick={manejarCancelarPedido}
              disabled={guardandoPedido}
            >
              Cancelar pedido
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn_principal"
            onClick={manejarGuardar}
            disabled={guardandoPedido}
          >
            {guardandoPedido
              ? "Guardando..."
              : esPedidoExistente
                ? "Actualizar pedido"
                : "Hacer pedido"}
          </button>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
  /* Estructura general de la pantalla: header, cabecera y contenido. */
  min-height: 100vh;
  width: 100%;
  background-color: ${({ theme }) => theme.bgtotal};
  color: ${({ theme }) => theme.text};
  display: grid;
  grid-template-rows: 90px auto auto 1fr;
  gap: 16px;
  padding: 15px;

  .encabezado {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: ${({ theme }) => theme.bgcards};
    border-radius: 16px;
    padding-right: 10px;
  }

  .cabecera,
  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border-radius: 16px;
    padding: 20px;
  }

  .tarjeta_error_validacion {
    border: 1px solid rgba(220, 53, 69, 0.55);
    box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.12);
  }

  .cabecera {
    display: grid;
    gap: 14px;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .resumen span,
  .pedido_vacio {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .cabecera__estado {
    width: fit-content;
    padding: 14px 18px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bgtotal};
  }

  .cabecera__estado span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .cabecera__estado strong {
    font-size: 26px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .navegacion_superior {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .boton_volver {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 10px;
    font-weight: 600;
  }

  .boton_volver {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
    text-decoration: none;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .grid {
    display: grid;
    gap: 14px;
  }

  .grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid_datos_generales {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .columna_datos {
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .campo-completo {
    grid-column: 1 / -1;
  }

  .campo_requerido label::after {
    content: " *";
    color: ${({ theme }) => theme.bg5};
    font-weight: 700;
  }

  .grupo_checks {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .grupo_curvas {
    align-items: flex-start;
  }

  .texto_ayuda {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .resumen_catalogo_existente {
    display: grid;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 12px;
    background: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .resumen_catalogo_existente strong {
    color: ${({ theme }) => theme.bg5};
    font-size: 15px;
  }

  .resumen_catalogo_existente span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
    line-height: 1.5;
  }

  .resumen_stock_tipo_tela {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
    padding: 14px;
    border-radius: 14px;
    background: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .resumen_stock_tipo_tela__encabezado {
    display: grid;
    gap: 4px;
  }

  .resumen_stock_tipo_tela__encabezado strong {
    font-size: 14px;
  }

  .resumen_stock_tipo_tela__encabezado span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .resumen_stock_tipo_tela__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .tarjeta_resumen_color {
    min-width: 170px;
    flex: 1 1 170px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
  }

  .tarjeta_resumen_color_activa {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 1px ${({ theme }) => theme.bg5};
  }

  .tarjeta_resumen_color_elegida {
    background: rgba(35, 163, 91, 0.12);
    border-color: rgba(35, 163, 91, 0.45);
  }

  .tarjeta_resumen_color__boton {
    width: 100%;
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    text-align: left;
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.text};
    cursor: pointer;
  }

  .tarjeta_resumen_color__boton:hover {
    background: ${({ theme }) => theme.bg3};
    border-radius: 12px;
  }

  .tarjeta_resumen_color strong {
    font-size: 14px;
  }

  .tarjeta_resumen_color span,
  .tarjeta_resumen_color small {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.4;
  }

  .estado_vacio_compacto {
    padding: 10px 12px;
    border-radius: 12px;
    background: ${({ theme }) => theme.bg2};
  }

  .fila_stock_sobrante td {
    background: rgba(255, 179, 0, 0.08);
  }

  .fila_stock_color_elegido td {
    background: rgba(35, 163, 91, 0.08);
  }

  .fila_stock_agregada td {
    opacity: 0.72;
  }

  .tarjeta__encabezado {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .lista_pedidos,
  .lista_stock_telas {
    display: grid;
    gap: 12px;
  }

  .pedido_vacio {
    padding: 16px;
    border-radius: 14px;
    border: 1px dashed ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgtotal};
  }

  .tarjeta_pedido,
  .tarjeta_stock {
    display: grid;
    gap: 6px;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg};
  }

  .tarjeta_pedido__contenido,
  .tarjeta_stock {
    text-align: left;
    color: ${({ theme }) => theme.text};
  }

  .tarjeta_pedido__contenido {
    display: grid;
    gap: 6px;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }

  .tarjeta_pedido_activa {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px rgba(117, 1, 152, 0.14);
  }

  .historial_secundario {
    margin-top: 18px;
    display: grid;
    gap: 12px;
  }

  .historial_secundario h3 {
    font-size: 15px;
    margin: 0;
    color: ${({ theme }) => theme.text};
  }

  .lista_historial_secundario {
    display: grid;
    gap: 10px;
  }

  .historial_secundario__item {
    display: grid;
    gap: 4px;
    border-radius: 14px;
    padding: 12px 14px;
    background: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .historial_secundario__item strong {
    font-size: 14px;
  }

  .historial_secundario__item span,
  .historial_secundario__item small {
    color: ${({ theme }) => theme.text};
    opacity: 0.86;
  }

  .buscador_stock {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) repeat(2, minmax(180px, 220px));
    gap: 12px;
    margin-bottom: 16px;
  }

  .buscador_stock input,
  .buscador_stock select {
    width: 100%;
    border: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .buscador_stock select {
    background-color: #f3f4f6;
    color: #111827;
    padding-right: 40px;
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  @media (max-width: 980px) {
    .buscador_stock {
      grid-template-columns: 1fr;
    }
  }

  .paginacion {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    flex-wrap: wrap;
  }

  .paginacion span {
    font-size: 14px;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 620px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d6dee8" : theme.bg4)};
    text-align: left;
    vertical-align: top;
  }

  th {
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#f7f9fc" : "transparent"};
  }

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 20px;
  }

  td input,
  td select {
    width: 100%;
    min-width: 110px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
  }

  td input:not([readonly]):not([type="checkbox"]),
  td select:not([readonly]) {
    min-height: 34px;
    border: 1px solid ${({ theme }) => theme.bg5};
    border-radius: 8px;
    background: rgba(117, 1, 152, 0.12);
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
    font-weight: 700;
    padding: 6px 8px;
    outline: none;
  }

  td input:not([readonly]):not([type="checkbox"]):focus,
  td select:not([readonly]):focus {
    box-shadow: 0 0 0 3px rgba(117, 1, 152, 0.2);
  }

  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .resumen__grid span {
    display: block;
    font-size: 13px;
    margin-bottom: 6px;
  }

  .resumen__grid strong {
    font-size: 18px;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .modelo_visual {
    display: grid;
    grid-template-columns: minmax(220px, 320px) 1fr;
    gap: 16px;
    align-items: start;
  }

  .modelo_visual img {
    width: 100%;
    height: 260px;
    object-fit: contain;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: #0f0f11;
    padding: 10px;
  }

  .modelo_visual__imagen {
    display: grid;
    gap: 10px;
  }

  .modelo_visual__vacio {
    min-height: 260px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    border: 1px dashed ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.colorSubtitle};
    background: ${({ theme }) => theme.bg2};
    text-align: center;
    padding: 16px;
  }

  .modelo_visual__tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn_vista_modelo {
    border: 1px solid ${({ theme }) => theme.bg4};
    background: transparent;
    color: ${({ theme }) => theme.text};
    border-radius: 10px;
    padding: 8px 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn_vista_modelo:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn_vista_modelo_activa {
    background: ${({ theme }) => theme.bg5};
    border-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .modelo_visual__texto {
    display: grid;
    gap: 8px;
  }

  .modelo_visual__texto strong {
    font-size: 18px;
  }

  .btn {
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_peligro {
    background-color: #c62828;
    color: #ffffff;
    padding: 10px 12px;
  }

  .btn_tabla {
    width: 100%;
    padding: 10px 12px;
  }

  .btn_enlace {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  @media (min-width: 860px) {
    .lista_pedidos {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .grid-2,
    .grid_datos_generales,
    .resumen__grid {
      grid-template-columns: 1fr;
    }

    .tarjeta__encabezado,
    .acciones,
    .fila_superior,
    .navegacion_superior {
      flex-direction: column;
    }

    .modelo_visual {
      grid-template-columns: 1fr;
    }

    .navegacion_superior {
      align-items: stretch;
    }
  }
`;

const Campo = styled.div`
  /* Aqui se da estilo base a los textbox, textarea y selects del formulario. */
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input,
  textarea,
  select {
    border: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  input:focus,
  textarea:focus,
  select:focus {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(117, 1, 152, 0.14)"
          : "rgba(117, 1, 152, 0.2)"};
  }

  textarea {
    min-height: 90px;
    resize: vertical;
  }

  &.campo_requerido input,
  &.campo_requerido textarea,
  &.campo_requerido select {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.35)" : "rgba(230, 205, 238, 0.38)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.05)" : "rgba(117, 1, 152, 0.14)"};
  }

  &.campo_requerido input[readonly],
  &.campo_requerido textarea[readonly],
  &.campo_requerido select[readonly] {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4};
    background-color: ${({ theme }) => theme.bg};
  }

  &.campo_error input,
  &.campo_error textarea,
  &.campo_error select,
  &.campo_error .grupo_checks {
    border-color: rgba(220, 53, 69, 0.75) !important;
    box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.12);
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 53, 69, 0.05)" : "rgba(220, 53, 69, 0.12)"};
  }
`;

const CheckTalla = styled.label`
  /* Estilo de los checks de talla para que sean mas comodos en tablet. */
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background-color: ${({ theme }) => theme.bg};
  border: 1px solid
    ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    accent-color: ${({ theme }) => theme.bg5};
  }

  span {
    font-size: 14px;
    font-weight: 600;
  }
`;

const CampoCurva = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 78px;
  min-width: 78px;

  span {
    font-size: 12px;
    font-weight: 700;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  input {
    width: 78px;
    min-width: 78px;
    padding: 8px 6px;
    font-size: 13px;
    text-align: center;
  }
`;




