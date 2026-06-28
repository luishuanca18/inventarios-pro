import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import styled from "styled-components";
import { Header } from "../../index";
import { VisorFotosModelo } from "../../components/moleculas/VisorFotosModelo";
import {
  leerCatalogosProduccion,
  obtenerDecimalesSistemaConfigurados,
  obtenerMotivosGlobalesSistema,
} from "../../utils/catalogosProduccion";
import {
  construirProductosTerminadosDesdeCorte,
  sincronizarMaestroProductosTerminados,
} from "../../utils/productosTerminados";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import { enfocarCampoValidacion } from "../../utils/validacionCampos";
import { obtenerColoresDisponiblesPorTipoTela } from "../../utils/stockMateriaPrima";
import {
  sincronizarFlujoProduccionDesdeSupabase,
  sincronizarPedidoFlujoDesdeLocalASupabase,
} from "../../supabase/flujoProduccionCore.js";
import {

  guardarCorrelativoSistemaConfiguracion,
  leerCorrelativoSistemaConfiguracion,
  listarVariantesProductoConfiguracion,
} from "../../supabase/configuracionCore.js";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_DETALLE_PEDIDO = "cynara_detalle_pedido_actual";
const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_DETALLE_OP = "cynara_detalle_op_actual";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_CORTE_ACTUAL = "cynara_detalle_corte_actual";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_CABECERA_SALIDA_TALLER = "cynara_cabecera_salida_taller";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_AJUSTES_RECEPCION_PRODUCCION =
  "cynara_ajustes_recepcion_produccion";
const CLAVE_DEVOLUCIONES_PRODUCCION = "cynara_devoluciones_produccion";
const CLAVE_SOLICITUDES_HABILITADO = "cynara_solicitudes_habilitado";
const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const TALLAS_DISPONIBLES = ["S", "M", "L", "XL", "XXL"];
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

const obtenerTallasActivas = (tallasSeleccionadas = []) =>
  Array.isArray(tallasSeleccionadas) && tallasSeleccionadas.length > 0
    ? TALLAS_DISPONIBLES.filter((talla) => tallasSeleccionadas.includes(talla))
    : [...TALLAS_DISPONIBLES];

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

const extraerCorrelativoCodigo = (codigo = "") => {
  const partes = (codigo || "").split("-");
  if (partes.length < 2) return 0;
  const numero = Number(partes[1]);
  return Number.isFinite(numero) ? numero : 0;
};

const obtenerDatoGuardado = (clave) => {
  const contenido = localStorage.getItem(clave);
  if (!contenido) return null;
  try {
    return JSON.parse(contenido);
  } catch {
    return null;
  }
};

const obtenerListaGuardada = (clave) => {
  const contenido = localStorage.getItem(clave);
  if (!contenido) return [];
  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

const telasBaseEjemplo = [
  { tipoTela: "CHALIZ", colorBase: "NEGRO", acabadoDiseno: "", codigoBase: "CHNE", partidaBase: "P", ancho: 1.50 },
  { tipoTela: "FRENCH TERRY", colorBase: "NEGRO", acabadoDiseno: "LINEAS DORADAS", codigoBase: "FTNE", partidaBase: "FT", ancho: 1.80 },
  { tipoTela: "FULL LICRA", colorBase: "AZUL MARINO", acabadoDiseno: "", codigoBase: "FLAZMA", partidaBase: "FL", ancho: 1.60 },
  { tipoTela: "DENIM", colorBase: "AZUL", acabadoDiseno: "ANIMAL PRINT", codigoBase: "DENAZ", partidaBase: "DN", ancho: 1.50 },
  { tipoTela: "PERCHADO", colorBase: "ROJO", acabadoDiseno: "", codigoBase: "PERO", partidaBase: "PE", ancho: 1.70 },
  { tipoTela: "PERCHADO", colorBase: "AMARILLO", acabadoDiseno: "", codigoBase: "PEAM", partidaBase: "PE", ancho: 1.70 },
  { tipoTela: "FRENCH TERRY", colorBase: "BLANCO", acabadoDiseno: "", codigoBase: "FTBL", partidaBase: "FT", ancho: 1.80 },
  { tipoTela: "PIEL DE DURAZNO", colorBase: "BEIGE", acabadoDiseno: "", codigoBase: "PDBE", partidaBase: "PD", ancho: 1.55 },
  { tipoTela: "CHOMPERO", colorBase: "GRIS", acabadoDiseno: "", codigoBase: "CHGR", partidaBase: "CH", ancho: 1.60 },
  { tipoTela: "FULL LICRA", colorBase: "AZUL MILITAR", acabadoDiseno: "", codigoBase: "FLAZMI", partidaBase: "FL", ancho: 1.60 },
];

const stockTelasEjemplo = Array.from({ length: 30 }, (_, indice) => {
  const base = telasBaseEjemplo[indice % telasBaseEjemplo.length];
  const numero = indice + 1;
  const correlativo = String(numero).padStart(2, "0");
  const kilos = 12 + (indice % 7);
  const metros = 28 + (indice % 9);

  return {
    codigoUnidad: `${base.codigoBase}${correlativo}`,
    tipoTela: base.tipoTela,
    colorBase: base.colorBase,
    acabadoDiseno: base.acabadoDiseno,
    ancho: base.ancho,
    partida: `${base.partidaBase}${String(100 + numero).padStart(3, "0")}`,
    kilos,
    metros,
  };
});

const construirStockTelasAlmacen = () => {
  const historialIngresos = obtenerListaGuardada(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);

  if (historialIngresos.length === 0) {
    return stockTelasEjemplo;
  }

  return historialIngresos.flatMap((ingreso) => {
    const filasTela = ingreso?.filasTela || ingreso?.filasCompra || [];

    return filasTela.map((fila) => ({
      codigoUnidad: fila?.codigoUnidad || "",
      tipoTela:
        fila?.tipoTela === "Otro"
          ? fila?.tipoTelaManual || "Otro"
          : fila?.tipoTela || "",
      colorBase: fila?.colorBase || "",
      acabadoDiseno: fila?.acabadoDiseno || "",
      ancho: Number(fila?.ancho || 0),
      kilos: Number(fila?.kilos || 0),
      metros: Number(fila?.metros || 0),
      partida: fila?.partida || "",
    }));
  });
};

const obtenerTelaStockPorCodigo = (codigoUnidad) => {
  if (!codigoUnidad) return null;

  const codigoBuscado = codigoUnidad.trim().toUpperCase();
  return construirStockTelasAlmacen().find(
    (fila) => (fila.codigoUnidad || "").trim().toUpperCase() === codigoBuscado
  ) || null;
};

const obtenerPesoTelaPorCodigo = (codigoUnidad) => {
  const telaStock = obtenerTelaStockPorCodigo(codigoUnidad);
  if (telaStock && Number(telaStock.kilos || 0) > 0) {
    return formatearPesoDecimal(telaStock.kilos);
  }

  return "";
};

const ordenarFilasPorAnchoDesc = (filas = []) =>
  [...filas].sort((filaA, filaB) => {
    const anchoA = Number(filaA?.anchoTela || 0);
    const anchoB = Number(filaB?.anchoTela || 0);

    if (anchoA !== anchoB) {
      return anchoB - anchoA;
    }

    return String(filaA?.codigoUnidad || "").localeCompare(String(filaB?.codigoUnidad || ""));
  });

const obtenerCorrelativoOp = (
  fechaCorte,
  historialCortes = [],
  codigoExcluir = ""
) => {
  const fechaBase = fechaCorte || obtenerFechaActual();
  const anioCorte = obtenerAnioDesdeFecha(fechaBase);
  const codigosDelAnio = historialCortes
    .filter((corte) => {
      const fechaRegistro = corte?.cabeceraCorte?.fechaCorte || "";
      const codigoRegistro =
        corte?.cabeceraCorte?.codigoCorte || corte?.cabeceraCorte?.opOrigen || "";

      return (
        obtenerAnioDesdeFecha(fechaRegistro) === anioCorte &&
        codigoRegistro &&
        codigoRegistro !== codigoExcluir
      );
    })
    .map((corte) => corte?.cabeceraCorte?.codigoCorte || corte?.cabeceraCorte?.opOrigen || "");

  const correlativos = codigosDelAnio
    .map((codigoRegistro) => {
      const partesCodigo = codigoRegistro.split("-");
      return partesCodigo.length < 2 ? 0 : Number(partesCodigo[1]);
    })
    .filter((correlativo) => Number.isFinite(correlativo));

  return correlativos.length === 0 ? 1 : Math.max(...correlativos) + 1;
};

// Genera el codigo OP final cuando el corte se confirma.
// Si luego quieres otro formato, esta es la primera funcion que debes modificar.
const generarCodigoCorte = (
  fechaCorte,
  historialCortes = [],
  codigoExcluir = ""
) => {
  const fechaBase = fechaCorte || obtenerFechaActual();
  const [anio, mes, dia] = fechaBase.split("-");
  const correlativo = obtenerCorrelativoOp(fechaBase, historialCortes, codigoExcluir);

  return `${dia}${mes}${anio.slice(-2)}-${String(correlativo).padStart(2, "0")}`;
};

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const redondearCantidadOperativa = (valor) =>
  Math.round(convertirNumero(valor) * 100) / 100;

const formatearNumero = (valor) => {
  const numero = redondearCantidadOperativa(valor);
  return numero === 0 ? "" : String(numero);
};

const formatearPesoDecimal = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero.toFixed(2) : "";
};

const obtenerPesoEnviadoFila = (fila = {}) =>
  convertirNumero(fila?.pesoEnviado || 0);

const obtenerPesoUsadoFila = (fila = {}) =>
  convertirNumero(fila?.pesoTela || 0);

const obtenerSaldoSobranteFila = (fila = {}) =>
  Math.max(0, obtenerPesoEnviadoFila(fila) - obtenerPesoUsadoFila(fila));

const obtenerMultiplicadorTrazo = (tipoTrazo = "TRAZO_1") =>
  tipoTrazo === "TRAZO_2" ? 2 : 1;

const valueToUpper = (valor) => (typeof valor === "string" ? valor.toUpperCase() : valor);
const normalizarTextoBasico = (valor = "") => valueToUpper(String(valor || "").trim());
const normalizarClaveDetalle = (valor = "") =>
  valor
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const formatearTipoDerivadoVisible = (valor = "") =>
  String(valor || "").toUpperCase() === "MISMO_MODELO"
    ? "Mismo modelo"
    : "Modelo diferente";

const filaInicial = {
  id: 1,
  codigoUnidad: "",
  tipoTela: "",
  colorBase: "",
  acabadoDiseno: "",
  anchoTela: "",
  pesoEnviado: "",
  pesoTela: "",
  partida: "",
  panos: "",
  salidas: { S: "", M: "", L: "", XL: "", XXL: "" },
};

const curvaInicial = { S: "", M: "", L: "", XL: "", XXL: "" };
const crearDetallesConfeccionInicial = (detallesCatalogo = []) =>
  detallesCatalogo.reduce(
    (acumulado, detalle) => ({
      ...acumulado,
      [normalizarClaveDetalle(detalle)]: false,
    }),
    { cantidadAgujas: "", otroDetalle: "" }
  );

const filtrarDetallesConfeccion = (detallesGuardados = {}, detallesCatalogo = []) => {
  const base = crearDetallesConfeccionInicial(detallesCatalogo);

  return {
    ...base,
    ...Object.keys(base).reduce((acumulado, clave) => {
      if (clave in detallesGuardados) {
        acumulado[clave] = detallesGuardados[clave];
      }
      return acumulado;
    }, {}),
  };
};

const calcularTotalFila = (fila, tallasActivas = TALLAS_DISPONIBLES) =>
  redondearCantidadOperativa(
    tallasActivas.reduce(
      (total, talla) => total + convertirNumero(fila.salidas?.[talla]),
      0
    )
  );

const calcularTotalUnidades = (filas = [], tallasActivas = TALLAS_DISPONIBLES) =>
  redondearCantidadOperativa(
    filas.reduce((total, fila) => total + calcularTotalFila(fila, tallasActivas), 0)
  );

const crearTotalesPorTallaVacio = () =>
  TALLAS_DISPONIBLES.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: 0,
    }),
    {}
  );

const calcularTotalesPorTalla = (filas = [], tallasActivas = TALLAS_DISPONIBLES) =>
  tallasActivas.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: redondearCantidadOperativa(
        filas.reduce(
          (total, fila) => total + convertirNumero(fila?.salidas?.[talla]),
          0
        )
      ),
    }),
    crearTotalesPorTallaVacio()
  );

const crearDetalleColorTalla = (filas = []) => {
  const mapa = new Map();

  filas.forEach((fila, indice) => {
    const colorBase = fila?.colorBase || `COLOR ${indice + 1}`;
    const actual = mapa.get(colorBase) || {
      id: `${colorBase}-${indice + 1}`,
      colorBase,
      salidas: crearTotalesPorTallaVacio(),
    };

    TALLAS_DISPONIBLES.forEach((talla) => {
      actual.salidas[talla] =
        convertirNumero(actual.salidas?.[talla]) +
        convertirNumero(fila?.salidas?.[talla]);
    });

    mapa.set(colorBase, actual);
  });

  return Array.from(mapa.values());
};

const construirDetalleEnvioPorTallas = (
  detalleColorTalla = [],
  tallasSeleccionadas = []
) =>
  detalleColorTalla
    .map((fila, indice) => ({
      id: fila?.id || `detalle-envio-${indice + 1}`,
      colorBase: fila?.colorBase || `COLOR ${indice + 1}`,
      plan: TALLAS_DISPONIBLES.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: tallasSeleccionadas.includes(talla)
            ? convertirNumero(fila?.salidas?.[talla])
            : 0,
        }),
        {}
      ),
    }))
    .filter((fila) =>
      tallasSeleccionadas.some((talla) => convertirNumero(fila?.plan?.[talla]) > 0)
    );

const calcularSalidasAutomaticas = (
  panos,
  curvaCabecera,
  tallasActivas = TALLAS_DISPONIBLES,
  tipoTrazo = "TRAZO_1"
) =>
  TALLAS_DISPONIBLES.reduce((acumulado, talla) => {
    const curva = convertirNumero(curvaCabecera[talla]);
    const multiplicadorTrazo = obtenerMultiplicadorTrazo(tipoTrazo);
    const resultado = tallasActivas.includes(talla)
      ? convertirNumero(panos) * multiplicadorTrazo * curva
      : 0;
    return { ...acumulado, [talla]: tallasActivas.includes(talla) ? formatearNumero(resultado) : "" };
  }, {});

const crearCabeceraDesdeOp = (detalleOp, detallesCatalogo = []) => {
  const cabeceraOp = detalleOp?.cabeceraOp;
  if (!cabeceraOp) return null;
  const fechaInicial = obtenerFechaActual();
  return {
    codigoCorte: "",
    opOrigen: "",
    listoParaCortar: false,
    pedidoOrigen: cabeceraOp.pedidoOrigen || "",
    fechaCorte: fechaInicial,
    empresa: cabeceraOp.empresa || "Cynara",
    categoriaModelo: cabeceraOp.categoriaModelo || "",
    modeloCatalogo: cabeceraOp.modeloCatalogo || "",
    telaModelo: cabeceraOp.telaModelo || "",
    modeloBase: cabeceraOp.modeloBase || "",
    tipoTela: cabeceraOp.tipoTela || "",
    tallasSeleccionadas: cabeceraOp.tallasSeleccionadas || [...TALLAS_DISPONIBLES],
    curvaCabecera: { ...curvaInicial, ...(cabeceraOp.curvaCabecera || {}) },
    detallesConfeccion: filtrarDetallesConfeccion(
      cabeceraOp.detallesConfeccion || {},
      detallesCatalogo
    ),
    tipoTrazo: cabeceraOp.tipoTrazo || "TRAZO_1",
    largoTrazo: "",
    anchoTrazo: "",
    merma: "",
    pesoTelaCorte: "",
    unidadMerma: "KG",
    productosDerivados: [],
    observacionesGenerales: cabeceraOp.observacionesGenerales || "",
  };
};

const crearFilasDesdeOp = (detalleOp) => {
  if (!detalleOp?.filasOp?.length) {
    return [{ ...filaInicial, codigoUnidad: "CHAZ01", tipoTela: "CHALIZ", colorBase: "AZUL", anchoTela: "1.50", partida: "P101" }];
  }
  return ordenarFilasPorAnchoDesc(detalleOp.filasOp).map((fila, indice) => ({
      ...filaInicial,
      id: fila.id || Date.now() + indice,
      codigoUnidad: fila.codigoUnidad || "",
    tipoTela:
      fila.tipoTela ||
      obtenerTelaStockPorCodigo(fila.codigoUnidad || "")?.tipoTela ||
      detalleOp?.cabeceraOp?.tipoTela ||
      "",
    colorBase: fila.colorBase || obtenerTelaStockPorCodigo(fila.codigoUnidad || "")?.colorBase || "",
    acabadoDiseno:
      fila.acabadoDiseno || obtenerTelaStockPorCodigo(fila.codigoUnidad || "")?.acabadoDiseno || "",
    anchoTela:
      fila.anchoTela ||
      (obtenerTelaStockPorCodigo(fila.codigoUnidad || "")?.ancho
        ? String(obtenerTelaStockPorCodigo(fila.codigoUnidad || "").ancho)
        : ""),
    ...(() => {
      const telaStock = obtenerTelaStockPorCodigo(fila.codigoUnidad || "");
      const pesoBase =
        (fila.pesoEnviado ? formatearPesoDecimal(fila.pesoEnviado) : "") ||
        (fila.pesoTela ? formatearPesoDecimal(fila.pesoTela) : "") ||
        (telaStock?.kilos ? formatearPesoDecimal(telaStock.kilos) : "") ||
        obtenerPesoTelaPorCodigo(fila.codigoUnidad || "");

      return {
        pesoEnviado: pesoBase,
        pesoTela:
          fila.pesoUsado !== undefined && fila.pesoUsado !== null && fila.pesoUsado !== ""
            ? String(fila.pesoUsado)
            : pesoBase,
      };
    })(),
    partida: fila.partida || obtenerTelaStockPorCodigo(fila.codigoUnidad || "")?.partida || "",
    panos: "",
  }));
};

const crearCabeceraInicial = (detallesCatalogo = []) => {
  const corteGuardado = obtenerDatoGuardado(CLAVE_CORTE_ACTUAL);
  if (corteGuardado?.estado === "borrador") {
    return {
      ...crearCabeceraInicialBase(detallesCatalogo),
      ...(corteGuardado?.cabeceraCorte || {}),
      curvaCabecera: {
        ...curvaInicial,
        ...(corteGuardado?.cabeceraCorte?.curvaCabecera || {}),
      },
      detallesConfeccion: filtrarDetallesConfeccion(
        corteGuardado?.cabeceraCorte?.detallesConfeccion || {},
        detallesCatalogo
      ),
      productosDerivados: Array.isArray(corteGuardado?.cabeceraCorte?.productosDerivados)
        ? corteGuardado.cabeceraCorte.productosDerivados
        : [],
    };
  }

  return crearCabeceraInicialBase(detallesCatalogo);
};

const crearCabeceraInicialBase = (detallesCatalogo = []) => {
  const fechaInicial = obtenerFechaActual();
  return {
    codigoCorte: "",
    opOrigen: "",
    listoParaCortar: false,
    pedidoOrigen: "",
    fechaCorte: fechaInicial,
    empresa: "",
    categoriaModelo: "",
    modeloCatalogo: "",
    telaModelo: "",
    modeloBase: "",
    tipoTela: "",
    tallasSeleccionadas: [],
    curvaCabecera: { ...curvaInicial },
    detallesConfeccion: crearDetallesConfeccionInicial(detallesCatalogo),
    tipoTrazo: "TRAZO_1",
    largoTrazo: "",
    anchoTrazo: "",
    merma: "",
    pesoTelaCorte: "",
    unidadMerma: "KG",
    productosDerivados: [],
    observacionesGenerales: "",
  };
};

const crearFilasIniciales = () => {
  const corteGuardado = obtenerDatoGuardado(CLAVE_CORTE_ACTUAL);
  if (corteGuardado?.estado === "borrador") {
    return Array.isArray(corteGuardado?.filasCorte) && corteGuardado.filasCorte.length > 0
      ? corteGuardado.filasCorte.map((fila, indice) => ({
          ...filaInicial,
          ...fila,
          id: fila.id || Date.now() + indice,
          pesoEnviado:
            fila?.pesoEnviado ||
            fila?.pesoTela ||
            obtenerPesoTelaPorCodigo(fila.codigoUnidad || ""),
          salidas: { S: "", M: "", L: "", XL: "", XXL: "", ...(fila.salidas || {}) },
        }))
      : [{ ...filaInicial }];
  }

  return [{ ...filaInicial }];
};

const obtenerCamposFaltantesCorte = (cabeceraCorte, filasCorte = []) => {
  const faltantes = [];

  if (!cabeceraCorte.fechaCorte?.trim()) faltantes.push({ clave: "fechaCorte", etiqueta: "Fecha de corte" });
  if (!cabeceraCorte.pedidoOrigen?.trim()) faltantes.push({ clave: "pedidoOrigen", etiqueta: "Orden de pedido" });
  if (!cabeceraCorte.empresa?.trim()) faltantes.push({ clave: "empresa", etiqueta: "Empresa" });
  if (!cabeceraCorte.modeloBase?.trim()) faltantes.push({ clave: "modeloBase", etiqueta: "Modelo base" });
  if (!cabeceraCorte.tipoTela?.trim()) faltantes.push({ clave: "tipoTela", etiqueta: "Tipo de tela" });
  if (!cabeceraCorte.tipoTrazo?.trim()) faltantes.push({ clave: "tipoTrazo", etiqueta: "Tipo de trazo" });
  if (!String(cabeceraCorte.largoTrazo || "").trim()) faltantes.push({ clave: "largoTrazo", etiqueta: "Largo del trazo" });
  if (!String(cabeceraCorte.anchoTrazo || "").trim()) faltantes.push({ clave: "anchoTrazo", etiqueta: "Ancho del trazo" });
  if (!cabeceraCorte.tallasSeleccionadas?.length) faltantes.push({ clave: "tallas", etiqueta: "Tallas" });

  const filasValidas = filasCorte.filter(
    (fila) =>
      fila?.codigoUnidad?.trim() ||
      fila?.tipoTela?.trim() ||
      fila?.colorBase?.trim()
  );

  if (filasValidas.length === 0) {
    faltantes.push({ clave: "telasSeleccionadas", etiqueta: "Al menos una tela cargada" });
  } else if (filasValidas.some((fila) => String(fila?.panos || "").trim() === "")) {
    faltantes.push({ clave: "panos", etiqueta: "Paños por tela" });
  }

  return faltantes;
};

const normalizarCorteGuardado = (corteGuardado, detallesCatalogo = []) => ({
  cabeceraCorte: {
    ...crearCabeceraInicial(detallesCatalogo),
    ...(corteGuardado?.cabeceraCorte || {}),
    curvaCabecera: { ...curvaInicial, ...(corteGuardado?.cabeceraCorte?.curvaCabecera || {}) },
    detallesConfeccion: filtrarDetallesConfeccion(
      corteGuardado?.cabeceraCorte?.detallesConfeccion || {},
      detallesCatalogo
    ),
    productosDerivados: Array.isArray(corteGuardado?.cabeceraCorte?.productosDerivados)
      ? corteGuardado.cabeceraCorte.productosDerivados.map((item, indice) => ({
          ...crearProductoDerivadoInicial(),
          ...item,
          salidas: {
            ...crearSalidasDerivadoInicial(),
            ...(item?.salidas || {}),
            ...(item?.cantidad ? { S: item.cantidad } : {}),
          },
          tipoHijo:
            item?.tipoHijo ||
            (normalizarTextoBasico(item?.modeloBase || "") ===
            normalizarTextoBasico(corteGuardado?.cabeceraCorte?.modeloBase || "")
              ? "MISMO_MODELO"
              : "OTRO_MODELO"),
          origenMaterial: item?.origenMaterial || "RETAZO",
          colorNuevo: Boolean(item?.colorNuevo),
          id: item.id || Date.now() + indice,
        }))
      : [],
    tallasSeleccionadas: corteGuardado?.cabeceraCorte?.tallasSeleccionadas || [...TALLAS_DISPONIBLES],
    listoParaCortar: corteGuardado?.cabeceraCorte?.listoParaCortar || false,
  },
  filasCorte:
    corteGuardado?.filasCorte?.map((fila, indice) => ({
      ...filaInicial,
      ...fila,
      id: fila.id || Date.now() + indice,
      pesoEnviado:
        fila?.pesoEnviado ||
        fila?.pesoTela ||
        obtenerPesoTelaPorCodigo(fila.codigoUnidad || ""),
      salidas: { S: "", M: "", L: "", XL: "", XXL: "", ...(fila.salidas || {}) },
    })) || crearFilasIniciales(),
});

const crearOpsDisponibles = () => {
  const historial = obtenerListaGuardada(CLAVE_HISTORIAL_OP).filter(
    (op) => op?.estado === "confirmado" && !op?.cancelado
  );
  const actual = obtenerDatoGuardado(CLAVE_DETALLE_OP);
  const listaBase = [...historial];

  if (
    actual?.estado === "confirmado" &&
    !actual?.cancelado &&
    actual?.cabeceraOp?.pedidoOrigen &&
    !listaBase.some(
      (op) => op?.cabeceraOp?.pedidoOrigen === actual.cabeceraOp.pedidoOrigen
    )
  ) {
    listaBase.unshift(actual);
  }

  const mapaPorPedido = new Map();

  listaBase.forEach((op) => {
    const pedidoOrigen = op?.cabeceraOp?.pedidoOrigen || "";
    if (!pedidoOrigen) return;
    mapaPorPedido.set(pedidoOrigen, op);
  });

  return Array.from(mapaPorPedido.values());
};

const crearCortesRealizados = () => {
  const historial = obtenerListaGuardada(CLAVE_HISTORIAL_CORTES);
  const actual = obtenerDatoGuardado(CLAVE_CORTE_ACTUAL);
  const mapaPorPedido = new Map();

  [...historial, ...(actual ? [actual] : [])].forEach((corte) => {
    const pedidoOrigen = corte?.cabeceraCorte?.pedidoOrigen || corte?.cabeceraCorte?.codigoCorte;
    if (!pedidoOrigen) {
      return;
    }

    mapaPorPedido.set(pedidoOrigen, corte);
  });

  return Array.from(mapaPorPedido.values());
};

// Combina las OP pendientes con los borradores de corte.
// Si un pedido ya tiene borrador, se muestra ese borrador arriba.
// Si un pedido ya fue confirmado, deja de aparecer en pendientes.
const crearPendientesParaCortar = (opsDisponibles, historialCortes) => {
  const borradores = historialCortes.filter((corte) => corte?.estado === "borrador");
  const confirmados = new Set(
    historialCortes
      .filter((corte) => corte?.estado === "confirmado")
      .map((corte) => corte?.cabeceraCorte?.pedidoOrigen || "")
  );
  const borradoresPorPedido = new Map(
    borradores.map((corte) => [corte?.cabeceraCorte?.pedidoOrigen || "", corte])
  );

  const pendientesDesdeOp = opsDisponibles
    .filter((op) => !confirmados.has(op?.cabeceraOp?.pedidoOrigen || ""))
    .map((op) => {
      const pedidoOrigen = op?.cabeceraOp?.pedidoOrigen || "";
      return borradoresPorPedido.get(pedidoOrigen) || { tipoRegistro: "op", ...op };
    });

  const borradoresSinOp = borradores.filter(
    (corte) =>
      !opsDisponibles.some(
        (op) =>
          (op?.cabeceraOp?.pedidoOrigen || "") ===
          (corte?.cabeceraCorte?.pedidoOrigen || "")
      )
  );

  const listaUnificada = [...pendientesDesdeOp, ...borradoresSinOp];
  const mapaPorPedido = new Map();

  listaUnificada.forEach((registro) => {
    const pedidoOrigen =
      registro?.cabeceraOp?.pedidoOrigen ||
      registro?.cabeceraCorte?.pedidoOrigen ||
      "";

    if (!pedidoOrigen) return;
    mapaPorPedido.set(pedidoOrigen, registro);
  });

  return Array.from(mapaPorPedido.values());
};

const marcarPedidoComoGenerado = (pedidoOrigen, codigoOp) => {
  if (!pedidoOrigen) return;

  const historialPedidos = obtenerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
  const historialActualizado = historialPedidos.map((pedido) =>
    pedido?.datosCabecera?.codigoInterno === pedidoOrigen
      ? {
          ...pedido,
          opGenerada: true,
          codigoOpGenerada: codigoOp || "",
        }
      : pedido
  );

  localStorage.setItem(CLAVE_HISTORIAL_PEDIDOS, JSON.stringify(historialActualizado));

  const pedidoActual = obtenerDatoGuardado(CLAVE_DETALLE_PEDIDO);
  if (pedidoActual?.datosCabecera?.codigoInterno === pedidoOrigen) {
    localStorage.setItem(
      CLAVE_DETALLE_PEDIDO,
      JSON.stringify({
        ...pedidoActual,
        opGenerada: true,
        codigoOpGenerada: codigoOp || "",
      })
    );
  }
};

const sincronizarSalidaTaller = (cabeceraCorte, filasCorte) => {
  const codigoOp = cabeceraCorte?.codigoCorte || cabeceraCorte?.opOrigen || "";
  if (!codigoOp) return;
  const totalesPorTalla = calcularTotalesPorTalla(filasCorte);
  const totalUnidadesActualizado = calcularTotalUnidades(filasCorte);
  const detalleColorTallaActualizado = crearDetalleColorTalla(filasCorte);

  const salidasTaller = obtenerListaGuardada(CLAVE_SALIDAS_TALLER);
  if (salidasTaller.length > 0) {
    const enviosDeLaOp = salidasTaller.filter(
      (salida) => salida?.tipoRegistro === "envio_taller" && salida?.codigoOp === codigoOp
    );
    const tallasEnviadas = enviosDeLaOp.reduce(
      (acumulado, envio) => {
        (envio?.tallasActivas || []).forEach((talla) => acumulado.add(talla));
        return acumulado;
      },
      new Set()
    );
    const totalPendiente = TALLAS_DISPONIBLES.reduce(
      (total, talla) =>
        total + (tallasEnviadas.has(talla) ? 0 : convertirNumero(totalesPorTalla[talla])),
      0
    );

    const salidasActualizadas = salidasTaller.map((salida) => {
      const perteneceAOp =
        salida?.codigoOp === codigoOp || salida?.opOrigen === codigoOp || salida?.id === codigoOp;

      if (!perteneceAOp) {
        return salida;
      }

      if (salida?.tipoRegistro === "envio_taller" && salida?.tipoSalida !== "DERIVADO") {
        const tallasEnvio = salida?.tallasActivas?.length
          ? salida.tallasActivas
          : [...TALLAS_DISPONIBLES];
        const totalesEnvio = TALLAS_DISPONIBLES.reduce(
          (acumulado, talla) => ({
            ...acumulado,
            [talla]: tallasEnvio.includes(talla) ? convertirNumero(totalesPorTalla[talla]) : 0,
          }),
          crearTotalesPorTallaVacio()
        );
        const totalEnvioActualizado = tallasEnvio.reduce(
          (total, talla) => total + convertirNumero(totalesEnvio[talla]),
          0
        );
        const totalPagoActualizado =
          convertirNumero(salida?.costoProduccion) * totalEnvioActualizado;
        const montoPagadoAcumulado = convertirNumero(salida?.montoPagadoAcumulado);
        const detalleEnvioActualizado = construirDetalleEnvioPorTallas(
          detalleColorTallaActualizado,
          tallasEnvio
        );

        return {
          ...salida,
          codigoOp,
          opOrigen: codigoOp,
          modeloBase: cabeceraCorte?.modeloBase || salida?.modeloBase || "",
          modelo: cabeceraCorte?.modeloBase || salida?.modelo || "",
          totalS: totalesEnvio.S,
          totalM: totalesEnvio.M,
          totalL: totalesEnvio.L,
          totalXL: totalesEnvio.XL,
          totalXXL: totalesEnvio.XXL,
          totalUnidades: totalEnvioActualizado,
          cantidadTotal: totalEnvioActualizado,
          totalEnSoles: totalPagoActualizado,
          totalTallerPrincipal: totalPagoActualizado,
          totalPagarTaller: totalPagoActualizado,
          montoPagadoAcumulado,
          pagadoTaller: montoPagadoAcumulado >= totalPagoActualizado && totalPagoActualizado > 0,
          totalesPorTalla: totalesEnvio,
          detalleColorTalla: detalleColorTallaActualizado,
          detalleEnvio: detalleEnvioActualizado,
          detallesConfeccion: cabeceraCorte?.detallesConfeccion || {},
          productosDerivados: cabeceraCorte?.productosDerivados || [],
        };
      }

      if (salida?.tipoRegistro === "op_base" && salida?.tipoSalida !== "DERIVADO") {
        const totalesPendientes = TALLAS_DISPONIBLES.reduce(
          (acumulado, talla) => ({
            ...acumulado,
            [talla]: tallasEnviadas.has(talla) ? 0 : convertirNumero(totalesPorTalla[talla]),
          }),
          crearTotalesPorTallaVacio()
        );

        return {
          ...salida,
          codigoOp,
          opOrigen: codigoOp,
          modeloBase: cabeceraCorte?.modeloBase || salida?.modeloBase || "",
          modelo: cabeceraCorte?.modeloBase || salida?.modelo || "",
          totalS: totalesPendientes.S,
          totalM: totalesPendientes.M,
          totalL: totalesPendientes.L,
          totalXL: totalesPendientes.XL,
          totalXXL: totalesPendientes.XXL,
          totalUnidades: totalPendiente,
          cantidadTotal: totalPendiente,
          totalesPorTalla: totalesPendientes,
          tallasActivas: TALLAS_DISPONIBLES.filter(
            (talla) => convertirNumero(totalesPendientes[talla]) > 0
          ),
          detalleColorTalla: detalleColorTallaActualizado,
          detallesConfeccion: cabeceraCorte?.detallesConfeccion || {},
          productosDerivados: cabeceraCorte?.productosDerivados || [],
        };
      }

      return {
        ...salida,
        detallesConfeccion: cabeceraCorte?.detallesConfeccion || salida?.detallesConfeccion || {},
        productosDerivados: cabeceraCorte?.productosDerivados || salida?.productosDerivados || [],
      };
    });

    localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(salidasActualizadas));
  }

  const cabeceraSalida = obtenerDatoGuardado(CLAVE_CABECERA_SALIDA_TALLER);
  if (
    cabeceraSalida?.codigoOp &&
    (cabeceraSalida.codigoOp === codigoOp || cabeceraSalida.opOrigen === codigoOp)
  ) {
    localStorage.setItem(
      CLAVE_CABECERA_SALIDA_TALLER,
      JSON.stringify({
        ...cabeceraSalida,
        codigoOp,
        modelo: cabeceraCorte?.modeloBase || cabeceraSalida?.modelo || "",
        cantidadTotal: totalUnidadesActualizado,
        totalesPorTalla,
        detalleColorTalla: detalleColorTallaActualizado,
        detallesConfeccion: cabeceraCorte?.detallesConfeccion || {},
        productosDerivados: cabeceraCorte?.productosDerivados || [],
      })
    );
  }

  const recepcionesTaller = obtenerListaGuardada(CLAVE_RECEPCIONES_TALLER);
  if (recepcionesTaller.length > 0) {
    const recepcionesActualizadas = recepcionesTaller.map((recepcion) =>
      recepcion?.cabeceraRecepcion?.codigoOp === codigoOp
        ? {
            ...recepcion,
            cabeceraRecepcion: {
              ...recepcion.cabeceraRecepcion,
              codigoOp,
              modelo: cabeceraCorte?.modeloBase || recepcion?.cabeceraRecepcion?.modelo || "",
              cantidadTotal: totalUnidadesActualizado,
              totalTallerPrincipal:
                convertirNumero(recepcion?.cabeceraRecepcion?.totalTallerPrincipal) > 0
                  ? convertirNumero(recepcion?.cabeceraRecepcion?.totalTallerPrincipal) /
                    Math.max(
                      1,
                      convertirNumero(recepcion?.cabeceraRecepcion?.cantidadTotal)
                    ) *
                    totalUnidadesActualizado
                  : recepcion?.cabeceraRecepcion?.totalTallerPrincipal,
              totalPagarTaller:
                convertirNumero(recepcion?.cabeceraRecepcion?.totalPagarTaller) > 0
                  ? convertirNumero(recepcion?.cabeceraRecepcion?.totalPagarTaller) /
                    Math.max(
                      1,
                      convertirNumero(recepcion?.cabeceraRecepcion?.cantidadTotal)
                    ) *
                    totalUnidadesActualizado
                  : recepcion?.cabeceraRecepcion?.totalPagarTaller,
              pagadoTaller:
                convertirNumero(recepcion?.cabeceraRecepcion?.montoPagadoAcumulado) >=
                (convertirNumero(recepcion?.cabeceraRecepcion?.totalPagarTaller) > 0
                  ? (convertirNumero(recepcion?.cabeceraRecepcion?.totalPagarTaller) /
                      Math.max(
                        1,
                        convertirNumero(recepcion?.cabeceraRecepcion?.cantidadTotal)
                      )) *
                    totalUnidadesActualizado
                  : convertirNumero(recepcion?.cabeceraRecepcion?.totalPagarTaller)),
              detalleRecepcion: Array.isArray(recepcion?.cabeceraRecepcion?.detalleRecepcion)
                ? recepcion.cabeceraRecepcion.detalleRecepcion.map((fila) => {
                    const detalleActualizado = detalleColorTallaActualizado.find(
                      (detalle) => detalle.colorBase === fila.colorBase
                    );

                    if (!detalleActualizado) {
                      return fila;
                    }

                    return {
                      ...fila,
                      plan: {
                        ...(fila.plan || {}),
                        ...(detalleActualizado.salidas || {}),
                      },
                    };
                  })
                : recepcion?.cabeceraRecepcion?.detalleRecepcion,
            },
          }
        : recepcion
    );
    localStorage.setItem(CLAVE_RECEPCIONES_TALLER, JSON.stringify(recepcionesActualizadas));
  }
};

const registrarDevolucionesProduccion = (
  cabeceraAnterior,
  filasAnteriores = [],
  filasActuales = []
) => {
  const codigoOp = cabeceraAnterior?.codigoCorte || cabeceraAnterior?.opOrigen || "";
  const pedidoOrigen = cabeceraAnterior?.pedidoOrigen || "";

  if (!codigoOp || !pedidoOrigen) {
    return;
  }

  const filasAnterioresConCodigo = filasAnteriores.filter((fila) => fila?.codigoUnidad);
  const codigosActuales = new Set(
    filasActuales.map((fila) => (fila?.codigoUnidad || "").trim().toUpperCase()).filter(Boolean)
  );

  const devolucionesNuevas = filasAnterioresConCodigo
    .filter((fila) => !codigosActuales.has((fila?.codigoUnidad || "").trim().toUpperCase()))
    .map((fila) => ({
      id: `${codigoOp}-${(fila.codigoUnidad || "").trim().toUpperCase()}`,
      codigoOp,
      pedidoOrigen,
      modeloBase: cabeceraAnterior?.modeloBase || "",
      fechaSolicitud: obtenerFechaActual(),
      codigoUnidad: fila?.codigoUnidad || "",
      tipoTela: fila?.tipoTela || "",
      colorBase: fila?.colorBase || "",
      acabadoDiseno: fila?.acabadoDiseno || "",
      partida: fila?.partida || "",
      pesoTela:
        formatearPesoDecimal(
          obtenerPesoEnviadoFila(fila) > 0
            ? obtenerPesoEnviadoFila(fila)
            : convertirNumero(fila?.pesoTela)
        ) || "",
      pesoEnviado: fila?.pesoEnviado || fila?.pesoTela || "",
      pesoUsado: fila?.pesoTela || "",
      observacion: fila?.observacion || "",
      estado: "pendiente",
    }));

  const devolucionesActuales = obtenerListaGuardada(CLAVE_DEVOLUCIONES_PRODUCCION);
  const devolucionesLimpias = devolucionesActuales.filter((registro) => {
    if ((registro?.codigoOp || "") !== codigoOp) {
      return true;
    }

    if (registro?.estado === "aceptada") {
      return true;
    }

    return !codigosActuales.has((registro?.codigoUnidad || "").trim().toUpperCase());
  });

  const mapaFinal = new Map(
    [...devolucionesLimpias, ...devolucionesNuevas].map((registro) => [registro.id, registro])
  );

  localStorage.setItem(
    CLAVE_DEVOLUCIONES_PRODUCCION,
    JSON.stringify(Array.from(mapaFinal.values()))
  );
};

const normalizarRegistroPendiente = (registro) => ({
  id:
    registro?.cabeceraOp?.pedidoOrigen ||
    registro?.cabeceraCorte?.pedidoOrigen ||
    registro?.cabeceraCorte?.codigoCorte ||
    String(Date.now()),
  estado:
    registro?.estado === "borrador"
      ? "Guardado"
      : registro?.estado === "confirmado"
      ? "Disponible"
      : "Pendiente",
  pedido:
    registro?.cabeceraOp?.pedidoOrigen ||
    registro?.cabeceraCorte?.pedidoOrigen ||
    "-",
  fecha:
    registro?.cabeceraOp?.fechaOp ||
    registro?.cabeceraCorte?.fechaCorte ||
    "-",
  modelo:
    registro?.cabeceraOp?.modeloBase ||
    registro?.cabeceraCorte?.modeloBase ||
    "-",
    tipoTela:
      registro?.cabeceraOp?.tipoTela ||
      registro?.cabeceraCorte?.tipoTela ||
      "-",
    variantes: registro?.filasOp?.length || registro?.filasCorte?.length || 0,
  });

const obtenerEstadoVisibleCorte = (corte = {}) => {
  if (corte?.cancelado || corte?.estado === "cancelado") {
    return "Cancelado";
  }

  if (corte?.estado === "confirmado") {
    return "Confirmado";
  }

  if (corte?.estado === "borrador") {
    return "Guardado";
  }

  return "Pendiente";
};

const crearSolicitudMaterialInicial = () => ({
  tipoTela: "",
  colorBase: "",
  motivo: "",
});

const crearSalidasDerivadoInicial = () => ({
  S: "",
  M: "",
  L: "",
  XL: "",
  XXL: "",
});

const crearProductoDerivadoInicial = () => ({
  id: Date.now(),
  modeloBase: "",
  tipoTela: "",
  colorBase: "",
  tipoHijo: "MISMO_MODELO",
  origenMaterial: "RETAZO",
  colorNuevo: false,
  salidas: crearSalidasDerivadoInicial(),
});

const calcularTotalDerivado = (item = {}, tallasActivas = TALLAS_DISPONIBLES) =>
  tallasActivas.reduce(
    (total, talla) => total + convertirNumero(item?.salidas?.[talla]),
    0
  );

const limpiarVistaCorte = (detallesCatalogo = []) => ({
  cabeceraCorte: crearCabeceraInicialBase(detallesCatalogo),
  filasCorte: crearFilasVaciasCorte(),
});

const crearFilasVaciasCorte = () => [{ ...filaInicial }];

const filtrarFilasCorteConDevolucionActiva = (
  filas = [],
  solicitudes = [],
  pedidoOrigen = ""
) =>
  filas.filter((fila) => {
    const codigoUnidad = (fila?.codigoUnidad || "").trim().toUpperCase();
    if (!codigoUnidad || !pedidoOrigen) {
      return true;
    }

    const tieneDevolucionActiva = solicitudes.some(
      (solicitud) =>
        solicitud?.pedidoOrigen === pedidoOrigen &&
        solicitud?.areaOrigen === "Ordenes de produccion" &&
        solicitud?.tipoSolicitud === "devolucion" &&
        solicitud?.ocultarEnProduccion === true &&
        solicitud?.estado !== "rechazada" &&
        (solicitud?.codigoUnidad || "").trim().toUpperCase() === codigoUnidad
    );

    return !tieneDevolucionActiva;
  });

const obtenerHistorialCortesCompleto = () => {
  const historial = obtenerListaGuardada(CLAVE_HISTORIAL_CORTES);
  const actual = obtenerDatoGuardado(CLAVE_CORTE_ACTUAL);

  if (actual && actual?.cabeceraCorte?.pedidoOrigen) {
    return [actual, ...historial];
  }

  return historial;
};

export function Cortes() {
  const catalogosProduccion = useMemo(leerCatalogosProduccion, []);
  const motivosGlobales = useMemo(
    () => obtenerMotivosGlobalesSistema(catalogosProduccion),
    [catalogosProduccion]
  );
  const decimalesSistema = useMemo(
    () => obtenerDecimalesSistemaConfigurados(catalogosProduccion),
    [catalogosProduccion]
  );
  const unidadesControlPeso = useMemo(
    () =>
      catalogosProduccion.unidadesMedida?.length
        ? catalogosProduccion.unidadesMedida
        : ["KG", "METROS"],
    [catalogosProduccion]
  );
  const detallesConfeccionDisponibles = useMemo(
    () =>
      catalogosProduccion.detallesConfeccion?.length
        ? catalogosProduccion.detallesConfeccion
        : ["PINZAS", "OJAL", "BOLSILLOS", "VENAS", "FRANJA", "AUMENTA FRANJA", "PASADORES", "MULTIAGUJA"],
    [catalogosProduccion]
  );
  const detallesConfeccionConfigurados = useMemo(
    () =>
      detallesConfeccionDisponibles.map((detalle) => ({
        etiqueta: detalle,
        clave: normalizarClaveDetalle(detalle),
      })),
    [detallesConfeccionDisponibles]
  );
  const tiposHijoOpDisponibles = useMemo(
    () =>
      catalogosProduccion.tiposHijoOp?.length
        ? catalogosProduccion.tiposHijoOp
        : ["MISMO_MODELO", "OTRO_MODELO"],
    [catalogosProduccion]
  );
  const origenesHijoOpDisponibles = useMemo(
    () =>
      catalogosProduccion.origenesHijoOp?.length
        ? catalogosProduccion.origenesHijoOp
        : ["RETAZO", "SOBRANTE", "TELA_NORMAL"],
    [catalogosProduccion]
  );
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState("por_cortar");
  const [busquedaOp, setBusquedaOp] = useState("");
  const [busquedaCortes, setBusquedaCortes] = useState("");
  const [paginaOp, setPaginaOp] = useState(1);
  const [paginaCortes, setPaginaCortes] = useState(1);
  const [modoActualizacionOp, setModoActualizacionOp] = useState(false);
  const [filasOriginalesOp, setFilasOriginalesOp] = useState([]);
  const [solicitudesMateriales, setSolicitudesMateriales] = useState(() =>
    obtenerListaGuardada(CLAVE_SOLICITUDES_HABILITADO)
  );
  const [solicitudNueva, setSolicitudNueva] = useState(crearSolicitudMaterialInicial);
  const coloresDisponiblesSolicitud = useMemo(
    () => obtenerColoresDisponiblesPorTipoTela(solicitudNueva.tipoTela),
    [solicitudNueva.tipoTela]
  );
  const [cabeceraCorte, setCabeceraCorte] = useState(() =>
    crearCabeceraInicial(detallesConfeccionDisponibles)
  );
  const [filasCorte, setFilasCorte] = useState(crearFilasIniciales);
  const [opsDisponibles, setOpsDisponibles] = useState(crearOpsDisponibles);
  const [cortesRealizados, setCortesRealizados] = useState(crearCortesRealizados);
  const [variantesCatalogo, setVariantesCatalogo] = useState([]);
  const [ajustesRecepcion, setAjustesRecepcion] = useState(() =>
    obtenerListaGuardada(CLAVE_AJUSTES_RECEPCION_PRODUCCION)
  );
  const [configuracionCorrelativoOp, setConfiguracionCorrelativoOp] = useState({
    clave: "OP_PRODUCCION",
    anioActual: new Date().getFullYear(),
    ultimoCorrelativo: 0,
    siguienteForzado: 0,
  });
  const [camposInvalidos, setCamposInvalidos] = useState([]);
  const coloresPorModelo = useMemo(() => {
    const mapa = new Map();

    (variantesCatalogo || []).forEach((item) => {
      const nombreModelo = normalizarTextoBasico(item?.nombreModelo || "");
      const color = valueToUpper(item?.color || "");
      if (!nombreModelo || !color) return;

      const actual = mapa.get(nombreModelo) || new Set();
      actual.add(color);
      mapa.set(nombreModelo, actual);
    });

    return mapa;
  }, [variantesCatalogo]);

  useEffect(() => {
    let activo = true;
    const cargarCorrelativo = async () => {
      try {
        const data = await leerCorrelativoSistemaConfiguracion("OP_PRODUCCION");
        if (!activo) return;
        setConfiguracionCorrelativoOp(data);
      } catch (error) {
        console.error("No se pudo cargar el correlativo de OP:", error.message);
      }
    };
    cargarCorrelativo();
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;
    const sincronizar = async () => {
      try {
        const [, variantes] = await Promise.all([
          sincronizarFlujoProduccionDesdeSupabase(),
          listarVariantesProductoConfiguracion({ incluirInactivos: true }),
        ]);
        if (!activo) return;
        setOpsDisponibles(crearOpsDisponibles());
        setCortesRealizados(crearCortesRealizados());
        setVariantesCatalogo(Array.isArray(variantes) ? variantes : []);
      } catch (error) {
        console.error("No se pudo sincronizar ordenes de produccion:", error.message);
      }
    };
    sincronizar();
    return () => {
      activo = false;
    };
  }, []);
  const tallasActivasCorte = obtenerTallasActivas(cabeceraCorte.tallasSeleccionadas);
  const pedidoRelacionadoProduccion = useMemo(() => {
    if (!cabeceraCorte.pedidoOrigen) {
      return null;
    }

    const historialPedidos = obtenerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
    const pedidoEnHistorial = historialPedidos.find(
      (pedido) => pedido?.datosCabecera?.codigoInterno === cabeceraCorte.pedidoOrigen
    );

    if (pedidoEnHistorial) {
      return pedidoEnHistorial;
    }

    const pedidoActual = obtenerDatoGuardado(CLAVE_DETALLE_PEDIDO);
    if (pedidoActual?.datosCabecera?.codigoInterno === cabeceraCorte.pedidoOrigen) {
      return pedidoActual;
    }

    return null;
  }, [cabeceraCorte.pedidoOrigen, opsDisponibles, cortesRealizados]);
  const esPedidoCancelableEnProduccion = Boolean(
    cabeceraCorte.pedidoOrigen &&
      pedidoRelacionadoProduccion &&
      !pedidoRelacionadoProduccion?.cancelado &&
      !cabeceraCorte.codigoCorte
  );
  const configuracionTrazoBloqueada = Boolean(cabeceraCorte.codigoCorte);

  const totalUnidades = filasCorte.reduce(
    (total, fila) => total + calcularTotalFila(fila, tallasActivasCorte),
    0
  );
  const totalPesoEnviado = filasCorte.reduce(
    (total, fila) => total + obtenerPesoEnviadoFila(fila),
    0
  );
  const totalPesoTelas = filasCorte.reduce(
    (total, fila) => total + obtenerPesoUsadoFila(fila),
    0
  );
  const totalPesoSobrante = filasCorte.reduce(
    (total, fila) => total + obtenerSaldoSobranteFila(fila),
    0
  );
  const totalControlCorte =
    convertirNumero(cabeceraCorte.pesoTelaCorte) + convertirNumero(cabeceraCorte.merma);
  const diferenciaControlPeso =
    totalControlCorte -
    totalPesoTelas;
  const totalesPorTalla = tallasActivasCorte.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: filasCorte.reduce(
        (total, fila) => total + convertirNumero(fila.salidas?.[talla]),
        0
      ),
    }),
    {}
  );
  const resumenDerivados = (cabeceraCorte.productosDerivados || [])
    .filter(
      (item) => item?.modeloBase || calcularTotalDerivado(item, tallasActivasCorte) > 0
    )
    .map((item) => ({
      id: item.id,
      modelo: item.modeloBase || "DERIVADO",
      total: calcularTotalDerivado(item, tallasActivasCorte),
      tipoHijo: item?.tipoHijo || "MISMO_MODELO",
      origenMaterial: item?.origenMaterial || "RETAZO",
    }));
  const resumenProductosTerminados = useMemo(
    () => construirProductosTerminadosDesdeCorte(cabeceraCorte, filasCorte),
    [cabeceraCorte, filasCorte]
  );
  const ajusteRecepcionActual = useMemo(
    () =>
      ajustesRecepcion.find(
        (ajuste) =>
          ajuste?.codigoOp === (cabeceraCorte.codigoCorte || cabeceraCorte.opOrigen) &&
          ajuste?.estado === "pendiente"
      ) || null,
    [ajustesRecepcion, cabeceraCorte.codigoCorte, cabeceraCorte.opOrigen]
  );
  const pendientesParaCortar = useMemo(
    () => crearPendientesParaCortar(opsDisponibles, cortesRealizados),
    [opsDisponibles, cortesRealizados]
  );
  const opsFiltradas = useMemo(() => {
    const texto = busquedaOp.trim().toLowerCase();
    if (!texto) return pendientesParaCortar;
    return pendientesParaCortar.filter((op) =>
      [
        op?.cabeceraOp?.pedidoOrigen,
        op?.cabeceraOp?.modeloBase,
        op?.cabeceraOp?.tipoTela,
        op?.cabeceraCorte?.pedidoOrigen,
        op?.cabeceraCorte?.modeloBase,
        op?.cabeceraCorte?.tipoTela,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busquedaOp, pendientesParaCortar]);

  const cortesFiltrados = useMemo(() => {
    const texto = busquedaCortes.trim().toLowerCase();
    const cortesConfirmados = cortesRealizados.filter(
      (corte) => corte?.estado === "confirmado" || corte?.estado === "cancelado" || corte?.cancelado
    );
    if (!texto) return cortesConfirmados;
    return cortesConfirmados.filter((corte) =>
      [
        corte?.cabeceraCorte?.codigoCorte,
        corte?.cabeceraCorte?.pedidoOrigen,
        corte?.cabeceraCorte?.opOrigen,
        corte?.cabeceraCorte?.modeloBase,
        corte?.cabeceraCorte?.tipoTela,
        corte?.motivoCancelacion,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busquedaCortes, cortesRealizados]);

  const totalPaginasOp = Math.max(1, Math.ceil(opsFiltradas.length / FILAS_POR_PAGINA));
  const totalPaginasCortes = Math.max(1, Math.ceil(cortesFiltrados.length / FILAS_POR_PAGINA));

  const opsPaginadas = useMemo(() => {
    const inicio = (paginaOp - 1) * FILAS_POR_PAGINA;
    return opsFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [opsFiltradas, paginaOp]);

  const cortesPaginados = useMemo(() => {
    const inicio = (paginaCortes - 1) * FILAS_POR_PAGINA;
    return cortesFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [cortesFiltrados, paginaCortes]);

  const solicitudesPedidoActual = useMemo(
    () =>
      solicitudesMateriales.filter(
        (solicitud) =>
          solicitud?.pedidoOrigen === cabeceraCorte.pedidoOrigen &&
          solicitud?.areaOrigen === "Ordenes de produccion"
      ),
    [solicitudesMateriales, cabeceraCorte.pedidoOrigen]
  );

  const guardarSolicitudesMateriales = (solicitudesActualizadas) => {
    setSolicitudesMateriales(solicitudesActualizadas);
    localStorage.setItem(
      CLAVE_SOLICITUDES_HABILITADO,
      JSON.stringify(solicitudesActualizadas)
    );
  };

  const manejarCambioCabecera = (evento) => {
    const { name, value } = evento.target;
    setCamposInvalidos((anterior) => anterior.filter((item) => item !== name));

    if (name === "tipoTrazo") {
      setCabeceraCorte((anterior) => ({
        ...anterior,
        [name]: value,
      }));
      setFilasCorte((anterior) =>
        anterior.map((fila) => ({
          ...fila,
          salidas: calcularSalidasAutomaticas(
            fila.panos,
            cabeceraCorte.curvaCabecera,
            tallasActivasCorte,
            value
          ),
        }))
      );
      return;
    }

    setCabeceraCorte((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const manejarCambioTalla = (talla) => {
    if (configuracionTrazoBloqueada) {
      return;
    }

    setCamposInvalidos((anterior) => anterior.filter((item) => item !== "tallas"));

    setCabeceraCorte((anterior) => ({
      ...anterior,
      tallasSeleccionadas: anterior.tallasSeleccionadas.includes(talla)
        ? anterior.tallasSeleccionadas.filter((item) => item !== talla)
        : [...anterior.tallasSeleccionadas, talla],
    }));
  };

  const manejarCambioCurva = (talla, valor) => {
    if (configuracionTrazoBloqueada) {
      return;
    }

    setCabeceraCorte((anterior) => ({
      ...anterior,
      curvaCabecera: { ...anterior.curvaCabecera, [talla]: valor },
    }));
  };

  const manejarCambioDetalleConfeccion = (campo, valor) => {
    setCabeceraCorte((anterior) => ({
      ...anterior,
      detallesConfeccion: {
        ...anterior.detallesConfeccion,
        [campo]: valor,
      },
    }));
  };

  const manejarCheckDetalleConfeccion = (campo) => {
    setCabeceraCorte((anterior) => {
      const siguienteValor = !anterior.detallesConfeccion[campo];
      return {
        ...anterior,
        detallesConfeccion: {
          ...anterior.detallesConfeccion,
          [campo]: siguienteValor,
          ...(campo === "MULTIAGUJA" && !siguienteValor ? { cantidadAgujas: "" } : {}),
        },
      };
    });
  };

  const manejarCambioSolicitud = (evento) => {
    const { name, value } = evento.target;
    setSolicitudNueva((anterior) => ({
      ...anterior,
      [name]:
        name === "tipoTela" || name === "colorBase"
          ? value.toUpperCase()
          : value,
      ...(name === "tipoTela" ? { colorBase: "" } : {}),
    }));
  };

  const obtenerColoresDisponiblesDerivado = (item = {}) => {
    const modeloReferencia =
      (item?.tipoHijo || "MISMO_MODELO") === "MISMO_MODELO"
        ? cabeceraCorte.modeloBase || item?.modeloBase || ""
        : item?.modeloBase || "";

    const coloresModelo = Array.from(
      coloresPorModelo.get(normalizarTextoBasico(modeloReferencia)) || []
    );

    return coloresModelo.length > 0
      ? coloresModelo
      : catalogosProduccion.colores || [];
  };

  const manejarCambioDerivado = (idDerivado, campo, valor) => {
    setCabeceraCorte((anterior) => ({
      ...anterior,
      productosDerivados: (anterior.productosDerivados || []).map((item) =>
        item.id === idDerivado
          ? {
              ...item,
              ...(campo.startsWith("salidas.")
                ? {
                    salidas: {
                      ...crearSalidasDerivadoInicial(),
                      ...(item.salidas || {}),
                      [campo.split(".")[1]]: valor,
                    },
                  }
                : {
                    ...(campo === "tipoHijo" && valor === "MISMO_MODELO"
                      ? { modeloBase: anterior.modeloBase || item.modeloBase || "" }
                      : {}),
                    [campo]:
                      campo === "modeloBase" || campo === "tipoTela" || campo === "colorBase"
                        ? valueToUpper(valor)
                        : campo === "colorNuevo"
                          ? Boolean(valor)
                        : valor,
                  }),
            }
          : item
      ),
    }));
  };

  const agregarProductoDerivado = () => {
    setCabeceraCorte((anterior) => ({
      ...anterior,
      productosDerivados: [
        ...(anterior.productosDerivados || []),
        {
          ...crearProductoDerivadoInicial(),
          id: Date.now(),
          modeloBase: anterior.modeloBase || "",
        },
      ],
    }));
  };

  const quitarProductoDerivado = (idDerivado) => {
    const confirmar = window.confirm(
      "Seguro que deseas quitar este producto derivado?\n\nSi aun lo necesitas, elige 'Cancelar'."
    );

    if (!confirmar) {
      return;
    }

    setCabeceraCorte((anterior) => ({
      ...anterior,
      productosDerivados:
        (anterior.productosDerivados || []).length <= 1
          ? []
          : (anterior.productosDerivados || []).filter((item) => item.id !== idDerivado),
    }));
  };

  // Este boton genera la OP final del dia real del corte.
  const manejarGenerarOp = () => {
    const faltantes = obtenerCamposFaltantesCorte(cabeceraCorte, filasCorte);

    if (faltantes.length > 0) {
      const clavesFaltantes = faltantes.map((item) => item.clave);
      setCamposInvalidos(clavesFaltantes);
      alert(`Falta completar:\n- ${faltantes.map((item) => item.etiqueta).join("\n- ")}`);
      enfocarCampoValidacion(clavesFaltantes[0]);
      return;
    }

    setCamposInvalidos([]);
    const confirmarGeneracion = window.confirm(
      "Seguro que quieres generar la OP?\n\nUna vez generada, este codigo sera el que acompanara todo el flujo de produccion."
    );

    if (!confirmarGeneracion) {
      return;
    }

    setCabeceraCorte((anterior) => {
      const correlativoHistorial = obtenerCorrelativoOp(
        anterior.fechaCorte,
        obtenerHistorialCortesCompleto(),
        anterior.codigoCorte || anterior.opOrigen || ""
      );
      const correlativoForzado =
        obtenerAnioDesdeFecha(anterior.fechaCorte) ===
        Number(configuracionCorrelativoOp?.anioActual || 0)
          ? Number(configuracionCorrelativoOp?.siguienteForzado || 0)
          : 0;
      const correlativoConfigurado =
        obtenerAnioDesdeFecha(anterior.fechaCorte) ===
        Number(configuracionCorrelativoOp?.anioActual || 0)
          ? Number(configuracionCorrelativoOp?.ultimoCorrelativo || 0) + 1
          : 1;
      const correlativoFinal =
        correlativoForzado > 0
          ? correlativoForzado
          : Math.max(correlativoHistorial, correlativoConfigurado);
      const codigoGenerado =
        anterior.codigoCorte ||
        generarCodigoCorte(
          anterior.fechaCorte,
          [],
          anterior.codigoCorte || anterior.opOrigen || ""
        ).replace(/-\d+$/, `-${String(correlativoFinal).padStart(2, "0")}`);
      marcarPedidoComoGenerado(anterior.pedidoOrigen, codigoGenerado);

      return {
        ...anterior,
        listoParaCortar: true,
        codigoCorte: codigoGenerado,
        opOrigen: codigoGenerado,
      };
    });
  };

  // Aqui se actualizan los textbox del detalle de corte.
  const manejarCambioFila = (idFila, campo, valor) => {
    if (campo === "codigoUnidad" || campo === "tipoTela" || campo === "colorBase") {
      setCamposInvalidos((anterior) =>
        anterior.filter((item) => item !== "telasSeleccionadas")
      );
    }

    setFilasCorte((anterior) =>
      anterior.map((fila) => {
        if (fila.id !== idFila) {
          return fila;
        }

        return {
          ...fila,
          [campo]:
            campo === "tipoTela" || campo === "colorBase"
              ? valueToUpper(valor)
              : valor,
        };
      })
    );
  };

  const manejarCambioPanos = (idFila, valor) => {
    setCamposInvalidos((anterior) => anterior.filter((item) => item !== "panos"));
    setFilasCorte((anterior) =>
      anterior.map((fila) =>
        fila.id === idFila
          ? {
              ...fila,
              panos: valor,
              salidas: calcularSalidasAutomaticas(
                valor,
                cabeceraCorte.curvaCabecera,
                tallasActivasCorte,
                cabeceraCorte.tipoTrazo
              ),
            }
          : fila
      )
    );
  };

  const manejarCambioPesoUsado = (idFila, valor) => {
    setFilasCorte((anterior) =>
      anterior.map((fila) => {
        if (fila.id !== idFila) {
          return fila;
        }

        return {
          ...fila,
          pesoTela: valor,
        };
      })
    );
  };

  const manejarBlurPesoUsado = (idFila) => {
    setFilasCorte((anterior) =>
      anterior.map((fila) => {
        if (fila.id !== idFila) {
          return fila;
        }

        if (fila.pesoTela === "") {
          return {
            ...fila,
            pesoTela: "",
          };
        }

        const pesoEnviado = obtenerPesoEnviadoFila(fila);
        const pesoIngresado = convertirNumero(fila.pesoTela);
        const pesoAjustado =
          pesoEnviado > 0 && pesoIngresado > pesoEnviado ? pesoEnviado : pesoIngresado;

        return {
          ...fila,
          pesoTela: formatearPesoDecimal(pesoAjustado),
        };
      })
    );
  };

  const manejarCambioSalida = (idFila, talla, valor) => {
    setFilasCorte((anterior) =>
      anterior.map((fila) =>
        fila.id === idFila ? { ...fila, salidas: { ...fila.salidas, [talla]: valor } } : fila
      )
    );
  };

  // Limpia solo las tallas calculadas/manuales sin borrar paños ni datos base de la fila.
  const manejarLimpiarTallas = () => {
    setFilasCorte((anterior) =>
      anterior.map((fila) => ({
        ...fila,
        salidas: calcularSalidasAutomaticas(
          "",
          cabeceraCorte.curvaCabecera,
          [],
          cabeceraCorte.tipoTrazo
        ),
      }))
    );
  };

  const solicitarAumentoAlmacen = async () => {
    if (!cabeceraCorte.pedidoOrigen) {
      mostrarAlertaSistema("Primero carga una orden para poder solicitar aumento a almacen.");
      return;
    }

    if (!solicitudNueva.tipoTela.trim() || !solicitudNueva.colorBase.trim()) {
      mostrarAlertaSistema("Completa Tipo de tela y Color base para pedir aumento a almacen.");
      return;
    }

    const nuevaSolicitud = {
      id: `sol-${Date.now()}`,
      pedidoOrigen: cabeceraCorte.pedidoOrigen,
      codigoOp: cabeceraCorte.codigoCorte || cabeceraCorte.opOrigen || "",
      modeloBase: cabeceraCorte.modeloBase || "",
      fechaSolicitud: obtenerFechaActual(),
      areaOrigen: "Ordenes de produccion",
      tipoSolicitud: "aumento",
      tipoTela: solicitudNueva.tipoTela.trim().toUpperCase(),
      colorBase: solicitudNueva.colorBase.trim().toUpperCase(),
      motivo: solicitudNueva.motivo.trim(),
      estado: "pendiente",
    };

    const solicitudesActualizadas = [nuevaSolicitud, ...solicitudesMateriales];
    guardarSolicitudesMateriales(solicitudesActualizadas);
    setSolicitudNueva(crearSolicitudMaterialInicial());
    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraCorte.pedidoOrigen);
      await sincronizarFlujoProduccionDesdeSupabase();
    } catch (error) {
      console.error("No se pudo sincronizar la solicitud de aumento:", error.message);
    }
    mostrarNotificacionCarga("Solicitud de aumento enviada a Almacen.");
  };

  const obtenerSolicitudDevolucionExistente = (fila, tipoDevolucion) =>
    solicitudesMateriales.find(
      (solicitud) =>
        solicitud?.pedidoOrigen === cabeceraCorte.pedidoOrigen &&
        solicitud?.areaOrigen === "Ordenes de produccion" &&
        solicitud?.tipoSolicitud === "devolucion" &&
        solicitud?.tipoDevolucion === tipoDevolucion &&
        solicitud?.codigoUnidad === fila?.codigoUnidad &&
        solicitud?.estado !== "rechazada"
    );

  const solicitarDevolucionSobranteAlmacen = async (fila) => {
    if (!cabeceraCorte.pedidoOrigen || !fila?.codigoUnidad?.trim()) {
      mostrarAlertaSistema("Carga primero una tela valida para poder solicitar devolucion a Almacen.");
      return;
    }

    const pesoSobrante = obtenerSaldoSobranteFila(fila);

    if (pesoSobrante <= 0) {
      mostrarAlertaSistema("Primero registra un peso usado menor al peso enviado para poder devolver sobrante.");
      return;
    }

    const confirmarSolicitud = await confirmarAccionSistema(
      "La tela seguira en la OP hasta que Almacen atienda la solicitud.",
      {
        titulo: "Solicitar devolucion de sobrante",
        confirmarTexto: "Solicitar devolucion",
      }
    );

    if (!confirmarSolicitud) {
      return;
    }

    const solicitudExistente = obtenerSolicitudDevolucionExistente(
      fila,
      "SOBRANTE_PRODUCCION"
    );

    if (solicitudExistente) {
      mostrarAlertaSistema("Este sobrante ya fue devuelto o ya tiene una solicitud activa.");
      return;
    }

    const nuevaSolicitud = {
      id: `sol-${Date.now()}`,
      pedidoOrigen: cabeceraCorte.pedidoOrigen,
      codigoOp: cabeceraCorte.codigoCorte || cabeceraCorte.opOrigen || "",
      modeloBase: cabeceraCorte.modeloBase || "",
      fechaSolicitud: obtenerFechaActual(),
      areaOrigen: "Ordenes de produccion",
      tipoSolicitud: "devolucion",
      codigoUnidad: fila.codigoUnidad || "",
      tipoTela: fila.tipoTela || "",
      colorBase: fila.colorBase || "",
      partida: fila.partida || "",
      pesoTela: formatearPesoDecimal(obtenerSaldoSobranteFila(fila)) || "",
      pesoDevuelto: formatearPesoDecimal(obtenerSaldoSobranteFila(fila)) || "",
      pesoEnviado: fila.pesoEnviado || "",
      pesoUsado: fila.pesoTela || "",
      unidadControl: cabeceraCorte.unidadMerma || "KG",
      motivo: "SOBRANTE",
      observacion: fila.observacion || "",
      estado: "pendiente",
      ocultarEnProduccion: false,
      tipoDevolucion: "SOBRANTE_PRODUCCION",
    };

    const solicitudesActualizadas = [nuevaSolicitud, ...solicitudesMateriales];
    guardarSolicitudesMateriales(solicitudesActualizadas);
    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraCorte.pedidoOrigen);
      await sincronizarFlujoProduccionDesdeSupabase();
    } catch (error) {
      console.error("No se pudo sincronizar la devolucion de sobrante:", error.message);
    }
    mostrarNotificacionCarga("Solicitud de devolucion a Almacen enviada correctamente.");
  };

  const solicitarDevolucionTotalAlmacen = async (fila) => {
    if (!cabeceraCorte.pedidoOrigen || !fila?.codigoUnidad?.trim()) {
      mostrarAlertaSistema("Carga primero una tela valida para poder devolverla completa a Almacen.");
      return;
    }

    const solicitudExistente = obtenerSolicitudDevolucionExistente(
      fila,
      "DEVOLUCION_TOTAL"
    );

    if (solicitudExistente) {
      mostrarAlertaSistema("Esta tela ya fue devuelta completa o ya tiene una solicitud activa.");
      return;
    }

    const confirmarSolicitud = await confirmarAccionSistema(
      "La tela saldra de Produccion y quedara pendiente de atencion en Almacen.",
      {
        titulo: "Solicitar devolucion total",
        confirmarTexto: "Devolver toda la tela",
      }
    );

    if (!confirmarSolicitud) {
      return;
    }

    const nuevaSolicitud = {
      id: `sol-${Date.now()}`,
      pedidoOrigen: cabeceraCorte.pedidoOrigen,
      codigoOp: cabeceraCorte.codigoCorte || cabeceraCorte.opOrigen || "",
      modeloBase: cabeceraCorte.modeloBase || "",
      fechaSolicitud: obtenerFechaActual(),
      areaOrigen: "Ordenes de produccion",
      tipoSolicitud: "devolucion",
      tipoDevolucion: "DEVOLUCION_TOTAL",
      codigoUnidad: fila.codigoUnidad || "",
      tipoTela: fila.tipoTela || "",
      colorBase: fila.colorBase || "",
      partida: fila.partida || "",
      pesoTela: fila.pesoEnviado || fila.pesoTela || "",
      pesoDevuelto: fila.pesoEnviado || fila.pesoTela || "",
      pesoEnviado: fila.pesoEnviado || "",
      pesoUsado: fila.pesoTela || "",
      unidadControl: cabeceraCorte.unidadMerma || "KG",
      motivo: "DEVOLUCION TOTAL",
      observacion: fila.observacion || "",
      estado: "pendiente",
      ocultarEnProduccion: true,
    };

    const solicitudesActualizadas = [nuevaSolicitud, ...solicitudesMateriales];
    guardarSolicitudesMateriales(solicitudesActualizadas);
    setFilasCorte((anterior) =>
      filtrarFilasCorteConDevolucionActiva(
        anterior,
        solicitudesActualizadas,
        cabeceraCorte.pedidoOrigen
      )
    );
    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraCorte.pedidoOrigen);
      await sincronizarFlujoProduccionDesdeSupabase();
    } catch (error) {
      console.error("No se pudo sincronizar la devolucion total:", error.message);
    }
    mostrarNotificacionCarga("Solicitud de devolucion total enviada a Almacen.");
  };

  const manejarSeleccionOp = (registroPendiente) => {
    setCamposInvalidos([]);
    setModoActualizacionOp(false);
    setFilasOriginalesOp([]);
    if (registroPendiente?.estado === "borrador") {
      const corteNormalizado = normalizarCorteGuardado(
        registroPendiente,
        detallesConfeccionDisponibles
      );
      setCabeceraCorte(corteNormalizado.cabeceraCorte);
      setFilasCorte(
        filtrarFilasCorteConDevolucionActiva(
          corteNormalizado.filasCorte,
          solicitudesMateriales,
          corteNormalizado.cabeceraCorte.pedidoOrigen
        )
      );
      mostrarNotificacionCarga("Orden cargada en produccion.");
      return;
    }

    const nuevaCabecera = crearCabeceraDesdeOp(
      registroPendiente,
      detallesConfeccionDisponibles
    );
    const nuevasFilas = crearFilasDesdeOp(registroPendiente);
    setCabeceraCorte(nuevaCabecera);
    setFilasCorte(
      filtrarFilasCorteConDevolucionActiva(
        nuevasFilas,
        solicitudesMateriales,
        nuevaCabecera.pedidoOrigen
      )
    );
    mostrarNotificacionCarga("Orden cargada en produccion.");
  };

  const manejarSeleccionCorte = (corteGuardado) => {
    setCamposInvalidos([]);
    setModoActualizacionOp(true);
    const corteNormalizado = normalizarCorteGuardado(
      corteGuardado,
      detallesConfeccionDisponibles
    );
    const filasVisibles = filtrarFilasCorteConDevolucionActiva(
      corteNormalizado.filasCorte,
      solicitudesMateriales,
      corteNormalizado.cabeceraCorte.pedidoOrigen
    );
    setCabeceraCorte(corteNormalizado.cabeceraCorte);
    setFilasCorte(filasVisibles);
    setFilasOriginalesOp(filasVisibles);
    mostrarNotificacionCarga("OP cargada para actualizar.");
  };

  const manejarCancelarPedidoProduccion = () => {
    if (!esPedidoCancelableEnProduccion || !cabeceraCorte.pedidoOrigen) {
      alert("Primero carga un pedido existente para cancelarlo.");
      return;
    }

    const motivoCancelacion = window
      .prompt(
        "Escribe el motivo de cancelacion para dejarlo registrado en el historial:",
        ""
      )
      ?.trim();

    if (!motivoCancelacion) {
      alert("Debes indicar el motivo de cancelacion.");
      return;
    }

    const confirmar = window.confirm(
      `Seguro que deseas cancelar este pedido desde Produccion?\n\nPedido: ${cabeceraCorte.pedidoOrigen}\nModelo: ${
        cabeceraCorte.modeloBase || "-"
      }\n\nEl pedido ya no seguira en el flujo activo y quedara en historial como cancelado.`
    );

    if (!confirmar) {
      return;
    }

    const fechaCancelacion = new Date().toISOString();

    const historialPedidosActualizado = obtenerListaGuardada(CLAVE_HISTORIAL_PEDIDOS).map(
      (pedido) =>
        pedido?.datosCabecera?.codigoInterno === cabeceraCorte.pedidoOrigen
          ? {
              ...pedido,
              cancelado: true,
              fechaCancelacion,
              motivoCancelacion,
              areaCancelacion: "Ordenes de produccion",
              produccionInfo: {
                ...(pedido?.produccionInfo || {}),
                estado: "cancelado",
                fechaCancelacion,
                motivoCancelacion,
                areaCancelacion: "Ordenes de produccion",
                codigoOp: cabeceraCorte.codigoCorte || cabeceraCorte.opOrigen || "",
              },
            }
          : pedido
    );
    localStorage.setItem(
      CLAVE_HISTORIAL_PEDIDOS,
      JSON.stringify(historialPedidosActualizado)
    );

    const detallePedidoActual = obtenerDatoGuardado(CLAVE_DETALLE_PEDIDO);
    if (
      detallePedidoActual?.datosCabecera?.codigoInterno === cabeceraCorte.pedidoOrigen
    ) {
      localStorage.setItem(
        CLAVE_DETALLE_PEDIDO,
        JSON.stringify({
          ...detallePedidoActual,
          cancelado: true,
          fechaCancelacion,
          motivoCancelacion,
          areaCancelacion: "Ordenes de produccion",
          produccionInfo: {
            ...(detallePedidoActual?.produccionInfo || {}),
            estado: "cancelado",
            fechaCancelacion,
            motivoCancelacion,
            areaCancelacion: "Ordenes de produccion",
            codigoOp: cabeceraCorte.codigoCorte || cabeceraCorte.opOrigen || "",
          },
        })
      );
    }

    const historialOpActualizado = obtenerListaGuardada(CLAVE_HISTORIAL_OP).map((op) =>
      op?.cabeceraOp?.pedidoOrigen === cabeceraCorte.pedidoOrigen
        ? {
            ...op,
            estado: "cancelado",
            cancelado: true,
            fechaCancelacion,
            motivoCancelacion,
            areaCancelacion: "Ordenes de produccion",
          }
        : op
    );
    localStorage.setItem(CLAVE_HISTORIAL_OP, JSON.stringify(historialOpActualizado));

    const detalleOpActual = obtenerDatoGuardado(CLAVE_DETALLE_OP);
    if (detalleOpActual?.cabeceraOp?.pedidoOrigen === cabeceraCorte.pedidoOrigen) {
      localStorage.setItem(
        CLAVE_DETALLE_OP,
        JSON.stringify({
          ...detalleOpActual,
          estado: "cancelado",
          cancelado: true,
          fechaCancelacion,
          motivoCancelacion,
          areaCancelacion: "Ordenes de produccion",
        })
      );
    }

    const historialCortesActualizado = obtenerListaGuardada(CLAVE_HISTORIAL_CORTES).map(
      (corte) =>
        corte?.cabeceraCorte?.pedidoOrigen === cabeceraCorte.pedidoOrigen
          ? {
              ...corte,
              estado: "cancelado",
              cancelado: true,
              fechaCancelacion,
              motivoCancelacion,
              areaCancelacion: "Ordenes de produccion",
            }
          : corte
    );
    localStorage.setItem(
      CLAVE_HISTORIAL_CORTES,
      JSON.stringify(historialCortesActualizado)
    );

    const corteActual = obtenerDatoGuardado(CLAVE_CORTE_ACTUAL);
    if (corteActual?.cabeceraCorte?.pedidoOrigen === cabeceraCorte.pedidoOrigen) {
      localStorage.setItem(
        CLAVE_CORTE_ACTUAL,
        JSON.stringify({
          ...corteActual,
          estado: "cancelado",
          cancelado: true,
          fechaCancelacion,
          motivoCancelacion,
          areaCancelacion: "Ordenes de produccion",
        })
      );
    }

    setOpsDisponibles(crearOpsDisponibles());
    setCortesRealizados(crearCortesRealizados());

    const vistaLimpia = limpiarVistaCorte(detallesConfeccionDisponibles);
    setCabeceraCorte(vistaLimpia.cabeceraCorte);
    setFilasCorte(vistaLimpia.filasCorte);
    setFilasOriginalesOp([]);
    setSolicitudNueva(crearSolicitudMaterialInicial());
    setModoActualizacionOp(false);
    setPestanaActiva("por_cortar");

    alert("Pedido cancelado desde Produccion.");
  };

  const guardarEnHistorial = (estadoRegistro, cabeceraPersonalizada = cabeceraCorte) => {
    const corteCompleto = {
      cabeceraCorte: {
        ...cabeceraPersonalizada,
        detallesConfeccion: filtrarDetallesConfeccion(
          cabeceraPersonalizada.detallesConfeccion || {},
          detallesConfeccionDisponibles
        ),
        productosDerivados: (cabeceraPersonalizada.productosDerivados || [])
          .filter(
            (item) =>
              item?.modeloBase ||
              item?.tipoTela ||
              item?.colorBase ||
              calcularTotalDerivado(item) > 0
          )
          .map((item) => ({
            ...item,
            salidas: {
              ...crearSalidasDerivadoInicial(),
              ...(item?.salidas || {}),
            },
          })),
      },
      filasCorte,
      productosTerminados: construirProductosTerminadosDesdeCorte(
        cabeceraPersonalizada,
        filasCorte
      ),
      estado: estadoRegistro,
    };
    const historialActual = obtenerListaGuardada(CLAVE_HISTORIAL_CORTES);
    const historialActualizado = [
      corteCompleto,
      ...historialActual.filter(
        (corte) =>
          (corte?.cabeceraCorte?.pedidoOrigen || "") !==
          (cabeceraPersonalizada.pedidoOrigen || "")
      ),
    ];

    localStorage.setItem(CLAVE_CORTE_ACTUAL, JSON.stringify(corteCompleto));
    localStorage.setItem(CLAVE_HISTORIAL_CORTES, JSON.stringify(historialActualizado));
    setCortesRealizados(historialActualizado);
    return corteCompleto;
  };

  // Guarda el trabajo avanzado sin generar todavia el codigo OP final.
  const manejarGuardar = async () => {
    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando borrador de corte...",
      mensajeExito:
        "Cambios guardados. Este pedido queda pendiente para cortar despues.",
      mensajeError: "No se pudo guardar el borrador de corte.",
      accion: async () => {
        setModoActualizacionOp(false);
        setFilasOriginalesOp([]);
        const corteGuardado = guardarEnHistorial("borrador");
        setPaginaOp(1);

        try {
          await sincronizarPedidoFlujoDesdeLocalASupabase(
            corteGuardado?.cabeceraCorte?.pedidoOrigen || cabeceraCorte.pedidoOrigen,
          );
          await sincronizarFlujoProduccionDesdeSupabase();
          setOpsDisponibles(crearOpsDisponibles());
          setCortesRealizados(crearCortesRealizados());
        } catch (error) {
          console.error("No se pudo sincronizar el borrador de corte:", error.message);
        }

        console.log("Cabecera del corte:", cabeceraCorte);
        console.log("Detalle del corte:", filasCorte);
      },
    });
  };

  // Recien aqui nace el codigo OP final, el dia real del corte.
  const manejarConfirmarCorte = async () => {
    const faltantes = obtenerCamposFaltantesCorte(cabeceraCorte, filasCorte);

    if (faltantes.length > 0) {
      const clavesFaltantes = faltantes.map((item) => item.clave);
      setCamposInvalidos(clavesFaltantes);
      mostrarAlertaSistema(
        `Revisa estos campos:\n- ${faltantes.map((item) => item.etiqueta).join("\n- ")}`
      );
      enfocarCampoValidacion(clavesFaltantes[0]);
      return;
    }

    if (!cabeceraCorte.codigoCorte) {
      await mostrarAlertaSistema("Primero genera la OP para poder confirmarla.");
      return;
    }

    setCamposInvalidos([]);

    const confirmarAccion = await confirmarAccionSistema(
      `Seguro que deseas confirmar esta OP?\n\nOP: ${cabeceraCorte.codigoCorte}\nModelo: ${cabeceraCorte.modeloBase || "-"}\n\nLuego pasara al flujo de envio a taller.`
    );

    if (!confirmarAccion) {
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Confirmando OP...",
      mensajeExito:
        "OP confirmada. Desde aqui ya sigue el flujo normal de produccion.",
      mensajeError: "No se pudo confirmar la OP.",
      accion: async () => {
        const codigoConfirmado =
          cabeceraCorte.codigoCorte ||
          generarCodigoCorte(
            cabeceraCorte.fechaCorte,
            obtenerHistorialCortesCompleto(),
            cabeceraCorte.codigoCorte || cabeceraCorte.opOrigen || ""
          );
        const anioOp = obtenerAnioDesdeFecha(cabeceraCorte.fechaCorte);
        const correlativoOp = extraerCorrelativoCodigo(codigoConfirmado);

        const cabeceraConfirmada = {
          ...cabeceraCorte,
          codigoCorte: codigoConfirmado,
          opOrigen: codigoConfirmado,
        };

        const corteConfirmado = guardarEnHistorial("confirmado", cabeceraConfirmada);
        const nuevaConfiguracionCorrelativoOp = {
          ...configuracionCorrelativoOp,
          anioActual: anioOp,
          ultimoCorrelativo:
            anioOp === Number(configuracionCorrelativoOp?.anioActual || 0)
              ? Math.max(
                  Number(configuracionCorrelativoOp?.ultimoCorrelativo || 0),
                  correlativoOp
                )
              : correlativoOp,
          siguienteForzado:
            Number(configuracionCorrelativoOp?.siguienteForzado || 0) === correlativoOp
              ? 0
              : Number(configuracionCorrelativoOp?.siguienteForzado || 0),
        };
        setConfiguracionCorrelativoOp(nuevaConfiguracionCorrelativoOp);
        sincronizarMaestroProductosTerminados(
          corteConfirmado.cabeceraCorte,
          corteConfirmado.filasCorte
        );
        sincronizarSalidaTaller(corteConfirmado.cabeceraCorte, corteConfirmado.filasCorte);
        setBusquedaCortes("");
        setPaginaCortes(1);
        setPestanaActiva("realizados");
        setModoActualizacionOp(false);
        setFilasOriginalesOp(corteConfirmado.filasCorte);

        console.log("Cabecera del corte:", corteConfirmado.cabeceraCorte);
        console.log("Detalle del corte:", corteConfirmado.filasCorte);
        const vistaLimpia = limpiarVistaCorte(detallesConfeccionDisponibles);
        localStorage.setItem(
          CLAVE_CORTE_ACTUAL,
          JSON.stringify({
            cabeceraCorte: vistaLimpia.cabeceraCorte,
            filasCorte: vistaLimpia.filasCorte,
            estado: "borrador",
          })
        );
        localStorage.setItem(
          CLAVE_DETALLE_OP,
          JSON.stringify({
            cabeceraOp: {
              pedidoOrigen: "",
              fechaOp: obtenerFechaActual(),
              empresa: "",
              modeloBase: "",
              tipoTela: "",
              tallas: "",
              tallasSeleccionadas: [],
              observacionesGenerales: "",
              curvaCabecera: { S: "", M: "", L: "", XL: "", XXL: "" },
            },
            filasOp: [],
            estado: "borrador",
          })
        );

        try {
          await guardarCorrelativoSistemaConfiguracion(nuevaConfiguracionCorrelativoOp);
        } catch (error) {
          console.error("No se pudo guardar el correlativo de OP:", error.message);
        }
        setCabeceraCorte(vistaLimpia.cabeceraCorte);
        setFilasCorte(vistaLimpia.filasCorte);
        setFilasOriginalesOp([]);
        setSolicitudNueva(crearSolicitudMaterialInicial());
        setPestanaActiva("por_cortar");

        try {
          await sincronizarPedidoFlujoDesdeLocalASupabase(
            corteConfirmado?.cabeceraCorte?.pedidoOrigen || cabeceraCorte.pedidoOrigen,
          );
          await sincronizarFlujoProduccionDesdeSupabase();
          setOpsDisponibles(crearOpsDisponibles());
          setCortesRealizados(crearCortesRealizados());
        } catch (error) {
          console.error("No se pudo sincronizar la OP confirmada:", error.message);
        }
      },
    });
  };

  const manejarActualizarOp = async () => {
    const faltantes = obtenerCamposFaltantesCorte(cabeceraCorte, filasCorte);

    if (faltantes.length > 0) {
      const clavesFaltantes = faltantes.map((item) => item.clave);
      setCamposInvalidos(clavesFaltantes);
      mostrarAlertaSistema(
        `Revisa estos campos:\n- ${faltantes.map((item) => item.etiqueta).join("\n- ")}`
      );
      enfocarCampoValidacion(clavesFaltantes[0]);
      return;
    }

    if (!cabeceraCorte.codigoCorte) {
      await mostrarAlertaSistema("Carga primero una OP ya generada para poder actualizarla.");
      return;
    }

    setCamposInvalidos([]);

    const confirmarAccion = await confirmarAccionSistema(
      `Seguro que deseas actualizar esta OP?\n\nOP: ${cabeceraCorte.codigoCorte}\nModelo: ${cabeceraCorte.modeloBase || "-"}\n\nLos cambios se reflejaran tambien en taller y recepcion.`
    );

    if (!confirmarAccion) {
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Actualizando OP...",
      mensajeExito:
        "OP actualizada. Los cambios ya quedaron listos para seguir hacia taller.",
      mensajeError: "No se pudo actualizar la OP.",
      accion: async () => {
        const opActualizada = guardarEnHistorial("confirmado", cabeceraCorte);
        sincronizarMaestroProductosTerminados(
          opActualizada.cabeceraCorte,
          opActualizada.filasCorte
        );
        sincronizarSalidaTaller(opActualizada.cabeceraCorte, opActualizada.filasCorte);
        const codigoOpActualizado =
          opActualizada?.cabeceraCorte?.codigoCorte || opActualizada?.cabeceraCorte?.opOrigen || "";
        if (codigoOpActualizado) {
          const ajustesActualizados = ajustesRecepcion.map((ajuste) =>
            ajuste?.codigoOp === codigoOpActualizado && ajuste?.estado === "pendiente"
              ? {
                  ...ajuste,
                  estado: "aplicado",
                  fechaAplicacion: obtenerFechaActual(),
                }
              : ajuste
          );
          setAjustesRecepcion(ajustesActualizados);
          localStorage.setItem(
            CLAVE_AJUSTES_RECEPCION_PRODUCCION,
            JSON.stringify(ajustesActualizados)
          );
        }
        const vistaLimpia = limpiarVistaCorte(detallesConfeccionDisponibles);
        localStorage.setItem(
          CLAVE_CORTE_ACTUAL,
          JSON.stringify({
            cabeceraCorte: vistaLimpia.cabeceraCorte,
            filasCorte: vistaLimpia.filasCorte,
            estado: "borrador",
          })
        );
        localStorage.setItem(
          CLAVE_DETALLE_OP,
          JSON.stringify({
            cabeceraOp: {
              pedidoOrigen: "",
              fechaOp: obtenerFechaActual(),
              empresa: "",
              modeloBase: "",
              tipoTela: "",
              tallas: "",
              tallasSeleccionadas: [],
              observacionesGenerales: "",
              curvaCabecera: { S: "", M: "", L: "", XL: "", XXL: "" },
            },
            filasOp: [],
            estado: "borrador",
          })
        );
        setCabeceraCorte(vistaLimpia.cabeceraCorte);
        setFilasCorte(vistaLimpia.filasCorte);
        setFilasOriginalesOp([]);
        setSolicitudNueva(crearSolicitudMaterialInicial());
        setModoActualizacionOp(false);
        setPestanaActiva("realizados");
        setBusquedaCortes("");
        setPaginaCortes(1);
      },
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
          <h1>Detalles de produccion</h1>
          <p>
            Aqui Produccion escoge primero la OP que va a cortar y aparte puede
            reabrir cortes ya realizados para corregirlos.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Pedidos pendientes de corte</span>
          <strong>{pendientesParaCortar.length}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/produccion" className="boton_volver">
          Volver a Produccion
        </Link>

        <div className="navegacion_superior">
          <Link to="/produccion/detalle-op" className="btn btn_secundario btn_enlace">Atras</Link>
          <Link to="/produccion/salidas-taller" className="btn btn_principal btn_enlace">Siguiente</Link>
        </div>
      </div>

      <main className="contenido">
        {ajusteRecepcionActual ? (
          <section className="tarjeta alerta_ajuste">
            <strong>Ajuste reportado desde recepcion</strong>
            <span>
              Esta OP tiene un reporte pendiente: {ajusteRecepcionActual.prendasMas || 0} prendas de mas y{" "}
              {ajusteRecepcionActual.prendasMenos || 0} prendas de menos.
            </span>
            <small>
              Cuando termines de revisar y guardes la correccion con `Actualizar OP`, este ajuste quedara marcado como aplicado.
            </small>
          </section>
        ) : null}
        <section className="tarjeta">
          <div className="pestanas">
            <button type="button" className={`pestana ${pestanaActiva === "por_cortar" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("por_cortar")}>OP disponibles para cortar</button>
            <button type="button" className={`pestana ${pestanaActiva === "realizados" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("realizados")}>Historial de ordenes de produccion</button>
          </div>
          {pestanaActiva === "por_cortar" ? (
            <>
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Pedidos listos para cortar</h2>
                  <p>
                    Aqui se muestran los detalle de OP y tambien los pedidos guardados
                    que siguen pendientes para cortar en otra mesa o al dia siguiente.
                  </p>
                </div>
              </div>
              <div className="buscador">
                <input type="text" value={busquedaOp} onChange={(evento) => { setBusquedaOp(evento.target.value); setPaginaOp(1); }} placeholder="Buscar por pedido, modelo o tela" />
              </div>
              <div className="tabla_contenedor">
                <table className="tabla_listview">
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Pedido</th>
                      <th>Fecha</th>
                      <th>Modelo</th>
                      <th>Tipo de tela</th>
                      <th>Variantes</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opsPaginadas.length === 0 ? (
                      <tr><td colSpan={7} className="fila_vacia">Todavia no hay pedidos disponibles para cortar.</td></tr>
                    ) : (
                      opsPaginadas.map((op, indice) => {
                        const registroNormalizado = normalizarRegistroPendiente(op);

                        return (
                          <tr key={registroNormalizado.id || indice}>
                            <td>{registroNormalizado.estado}</td>
                            <td>{registroNormalizado.pedido}</td>
                            <td>{registroNormalizado.fecha}</td>
                            <td>{registroNormalizado.modelo}</td>
                            <td>{registroNormalizado.tipoTela}</td>
                            <td>{registroNormalizado.variantes}</td>
                            <td><button type="button" className="btn btn_principal btn_tabla" onClick={() => manejarSeleccionOp(op)}>Cargar</button></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {opsFiltradas.length > FILAS_POR_PAGINA ? (
                <div className="paginacion">
                  <button type="button" className="btn btn_secundario" onClick={() => setPaginaOp((anterior) => Math.max(1, anterior - 1))} disabled={paginaOp === 1}>Anterior</button>
                  <span>Pagina {paginaOp} de {totalPaginasOp}</span>
                  <button type="button" className="btn btn_secundario" onClick={() => setPaginaOp((anterior) => Math.min(totalPaginasOp, anterior + 1))} disabled={paginaOp === totalPaginasOp}>Siguiente</button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Historial de ordenes de produccion</h2>
                  <p>
                    Aqui quedan las OP ya generadas para reabrirlas si hace
                    falta corregir cantidades, tallas, curva o cualquier otro dato.
                  </p>
                </div>
              </div>
              <div className="buscador">
                <input type="text" value={busquedaCortes} onChange={(evento) => { setBusquedaCortes(evento.target.value); setPaginaCortes(1); }} placeholder="Buscar por codigo corte, pedido, OP, modelo o tela" />
              </div>
              <div className="tabla_contenedor">
                <table className="tabla_listview">
                    <thead>
                      <tr>
                        <th>Codigo corte</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Pedido</th>
                        <th>OP</th>
                        <th>Modelo</th>
                        <th>Tipo de tela</th>
                        <th>Colores</th>
                        <th>Total unidades</th>
                        <th>Motivo cancelacion</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cortesPaginados.length === 0 ? (
                        <tr><td colSpan={11} className="fila_vacia">Todavia no hay cortes guardados para actualizar.</td></tr>
                      ) : (
                        cortesPaginados.map((corte, indice) => (
                          <tr key={corte?.cabeceraCorte?.codigoCorte || indice}>
                            <td>{corte?.cabeceraCorte?.codigoCorte || "-"}</td>
                            <td>{obtenerEstadoVisibleCorte(corte)}</td>
                            <td>{corte?.cabeceraCorte?.fechaCorte || "-"}</td>
                            <td>{corte?.cabeceraCorte?.pedidoOrigen || "-"}</td>
                            <td>{corte?.cabeceraCorte?.opOrigen || "-"}</td>
                            <td>{corte?.cabeceraCorte?.modeloBase || "-"}</td>
                            <td>{corte?.cabeceraCorte?.tipoTela || "-"}</td>
                            <td>{corte?.filasCorte?.length || 0}</td>
                            <td>{corte?.filasCorte?.reduce((total, fila) => total + calcularTotalFila(fila), 0) || 0}</td>
                            <td>{corte?.motivoCancelacion || "-"}</td>
                            <td><button type="button" className="btn btn_principal btn_tabla" onClick={() => manejarSeleccionCorte(corte)}>Cargar</button></td>
                          </tr>
                        ))
                      )}
                  </tbody>
                </table>
              </div>
              {cortesFiltrados.length > FILAS_POR_PAGINA ? (
                <div className="paginacion">
                  <button type="button" className="btn btn_secundario" onClick={() => setPaginaCortes((anterior) => Math.max(1, anterior - 1))} disabled={paginaCortes === 1}>Anterior</button>
                  <span>Pagina {paginaCortes} de {totalPaginasCortes}</span>
                  <button type="button" className="btn btn_secundario" onClick={() => setPaginaCortes((anterior) => Math.min(totalPaginasCortes, anterior + 1))} disabled={paginaCortes === totalPaginasCortes}>Siguiente</button>
                </div>
              ) : null}
            </>
          )}
        </section>

          <section
            data-campo-validacion={camposInvalidos.includes("panos") ? "panos" : "telasSeleccionadas"}
            className={`tarjeta ${
              camposInvalidos.includes("telasSeleccionadas") || camposInvalidos.includes("panos")
                ? "tarjeta_error_validacion"
                : ""
            }`}
          >
            <h2>Cabecera de produccion</h2>
            <div className="grid grid-2">
              <Campo><label>Codigo OP</label><input type="text" value={cabeceraCorte.codigoCorte || "Se genera al presionar Generar OP"} readOnly /></Campo>
              <Campo data-campo-validacion="fechaCorte" className={`campo_requerido ${camposInvalidos.includes("fechaCorte") ? "campo_error" : ""}`}><label>Fecha de corte</label><input type="date" name="fechaCorte" value={cabeceraCorte.fechaCorte} onChange={manejarCambioCabecera} /></Campo>
              <Campo data-campo-validacion="pedidoOrigen" className={`campo_requerido ${camposInvalidos.includes("pedidoOrigen") ? "campo_error" : ""}`}><label>Orden de Pedido </label><input type="text" name="pedidoOrigen" value={cabeceraCorte.pedidoOrigen} onChange={manejarCambioCabecera} readOnly /></Campo>
              <Campo data-campo-validacion="empresa" className={`campo_requerido ${camposInvalidos.includes("empresa") ? "campo_error" : ""}`}><label>Empresa</label><input type="text" name="empresa" value={cabeceraCorte.empresa} onChange={manejarCambioCabecera} readOnly /></Campo>
              <Campo data-campo-validacion="modeloBase" className={`campo_requerido ${camposInvalidos.includes("modeloBase") ? "campo_error" : ""}`}><label>Modelo base</label><input type="text" name="modeloBase" value={cabeceraCorte.modeloBase} onChange={manejarCambioCabecera} readOnly /></Campo>
              <Campo><label>Referencia visual</label><div className="campo_accion_visual"><VisorFotosModelo modeloBase={cabeceraCorte.modeloBase || ""} titulo="Fotos del modelo en corte" /></div></Campo>
              <Campo data-campo-validacion="tipoTela" className={`campo_requerido ${camposInvalidos.includes("tipoTela") ? "campo_error" : ""}`}><label>Tipo de tela</label><input type="text" name="tipoTela" value={cabeceraCorte.tipoTela} onChange={manejarCambioCabecera} readOnly /></Campo>
              <Campo data-campo-validacion="tipoTrazo" className={`campo_requerido ${camposInvalidos.includes("tipoTrazo") ? "campo_error" : ""}`}>
                <label>Tipo de trazo</label>
                <select
                  name="tipoTrazo"
                  value={cabeceraCorte.tipoTrazo || "TRAZO_1"}
                  onChange={manejarCambioCabecera}
                  disabled={configuracionTrazoBloqueada}
                >
                  <option value="TRAZO_1">Trazo 1: 1 paño = 1 curva</option>
                  <option value="TRAZO_2">Trazo 2: 1 paño = 2 curvas</option>
                </select>
                {configuracionTrazoBloqueada ? (
                  <small className="texto_bloqueo">
                    El tipo de trazo ya no se puede cambiar despues de generar la OP.
                  </small>
                ) : null}
              </Campo>
              <Campo data-campo-validacion="largoTrazo" className={`campo_requerido ${camposInvalidos.includes("largoTrazo") ? "campo_error" : ""}`}><label>Largo del trazo</label><input type="number" step="0.01" inputMode="decimal" name="largoTrazo" value={cabeceraCorte.largoTrazo} onChange={manejarCambioCabecera} placeholder="" /></Campo>
              <Campo data-campo-validacion="anchoTrazo" className={`campo_requerido ${camposInvalidos.includes("anchoTrazo") ? "campo_error" : ""}`}><label>Ancho del trazo</label><input type="number" step="0.01" inputMode="decimal" name="anchoTrazo" value={cabeceraCorte.anchoTrazo} onChange={manejarCambioCabecera} placeholder="" /></Campo>
              <Campo data-campo-validacion="tallas" className={`campo-completo campo_requerido ${camposInvalidos.includes("tallas") ? "campo_error" : ""}`}>
                <label>Tallas</label>
                <div className="grupo_checks">
                {TALLAS_DISPONIBLES.map((talla) => (
                  <CheckTalla key={talla}><input type="checkbox" checked={cabeceraCorte.tallasSeleccionadas.includes(talla)} onChange={() => manejarCambioTalla(talla)} disabled={configuracionTrazoBloqueada} /><span>{talla}</span></CheckTalla>
                ))}
              </div>
              {configuracionTrazoBloqueada ? (
                <small className="texto_bloqueo">
                  Las tallas ya quedaron cerradas porque la OP fue generada.
                </small>
              ) : null}
            </Campo>
            <Campo className="campo-completo campo_requerido">
              <label>Curva del corte</label>
              <div className="grupo_curvas">
                {tallasActivasCorte.map((talla) => (
                  <CampoCurva key={talla}><span>{talla}</span><input type="number" step="0.01" inputMode="decimal" value={cabeceraCorte.curvaCabecera[talla]} onChange={(evento) => manejarCambioCurva(talla, evento.target.value)} placeholder="0" disabled={configuracionTrazoBloqueada} /></CampoCurva>
                ))}
              </div>
              {configuracionTrazoBloqueada ? (
                <small className="texto_bloqueo">
                  La curva ya no se puede editar despues de generar la OP. Solo se ajustan unidades por talla.
                </small>
              ) : null}
            </Campo>
              <Campo className="campo-completo"><label>Observaciones generales</label><textarea name="observacionesGenerales" value={cabeceraCorte.observacionesGenerales} onChange={manejarCambioCabecera} placeholder="" /></Campo>
            </div>
          </section>
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
              <h2>Detalles del trazo</h2>
              <p>
                Aqui se trabajan los colores reales del corte. El ancho de tela va
                por color y las salidas por talla se calculan automatico desde los paños.
              </p>
            </div>
            <div className="acciones_tabla">
              <button type="button" className="btn btn_secundario" onClick={manejarLimpiarTallas}>Limpiar</button>
            </div>
          </div>

          <div className="trazo_tablet">
            {filasCorte.map((fila) => (
              <article key={`tablet-${fila.id}`} className="trazo_card">
                <div className="trazo_card__encabezado">
                  <div>
                    <strong>{fila.colorBase || "SIN COLOR"}</strong>
                    <span>{fila.tipoTela || "SIN TELA"}</span>
                  </div>
                  <small>{fila.codigoUnidad || "-"}</small>
                </div>

                <div className="trazo_card__resumen">
                  <div className="trazo_card__dato trazo_card__dato_largo">
                    <label>Acabado / diseño</label>
                    <input type="text" value={fila.acabadoDiseno} readOnly placeholder="" />
                  </div>
                  <div className="trazo_card__dato">
                    <label>Partida</label>
                    <input type="text" value={fila.partida} readOnly placeholder="" />
                  </div>
                  <div className="trazo_card__dato">
                    <label>Peso enviado</label>
                    <input type="number" step="0.01" inputMode="decimal" value={fila.pesoEnviado} readOnly placeholder="" />
                  </div>
                  <div className="trazo_card__dato">
                    <label>Peso usado</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={fila.pesoTela}
                      onChange={(evento) => manejarCambioPesoUsado(fila.id, evento.target.value)}
                      onBlur={() => manejarBlurPesoUsado(fila.id)}
                      placeholder=""
                    />
                  </div>
                  <div className="trazo_card__dato">
                    <label>Sobrante</label>
                    <input type="text" value={formatearPesoDecimal(obtenerSaldoSobranteFila(fila))} readOnly placeholder="" />
                  </div>
                  <div className="trazo_card__dato">
                    <label>Ancho</label>
                    <input type="number" step="0.01" inputMode="decimal" value={fila.anchoTela} readOnly placeholder="" />
                  </div>
                  <div className={`trazo_card__dato ${camposInvalidos.includes("panos") && String(fila.panos || "").trim() === "" ? "trazo_card__dato_error" : ""}`}>
                    <label>Paños</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={fila.panos}
                      onChange={(evento) => manejarCambioPanos(fila.id, evento.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="trazo_card__tallas">
                  {tallasActivasCorte.map((talla) => (
                    <div key={`${fila.id}-${talla}`} className="trazo_card__talla">
                      <span>{talla}</span>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={fila.salidas[talla]}
                        onChange={(evento) => manejarCambioSalida(fila.id, talla, evento.target.value)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>

                <div className="trazo_card__pie">
                  <div className="trazo_card__total">
                    <span>Total unidades</span>
                    <strong>{calcularTotalFila(fila, tallasActivasCorte)}</strong>
                  </div>
                  <div className="acciones_tabla_dobles">
                    <button
                      type="button"
                      className="btn btn_secundario"
                      onClick={() => solicitarDevolucionSobranteAlmacen(fila)}
                    >
                      Devolver sobrante
                    </button>
                    <button
                      type="button"
                      className="btn btn_principal"
                      onClick={() => solicitarDevolucionTotalAlmacen(fila)}
                    >
                      Devolver toda la tela
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="tabla_contenedor trazo_tabla_escritorio">
            <table>
              <thead>
                <tr>
                  <th>Codigo unidad</th>
                  <th>Tipo de tela</th>
                  <th>Color base</th>
                  <th>Acabado / diseño</th>
                  <th>Ancho de tela</th>
                  <th>Peso enviado</th>
                  <th>Peso usado</th>
                  <th>Sobrante</th>
                  <th>Partida</th>
                  <th>Paños</th>
                  {tallasActivasCorte.map((talla) => (<th key={talla}>{talla}</th>))}
                  <th>Total unidades</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {filasCorte.map((fila) => (
                  <tr key={fila.id}>
                    <td className="columna_codigo"><input type="text" value={fila.codigoUnidad} readOnly placeholder="" /></td>
                    <td className="columna_tipo_tela"><input type="text" value={fila.tipoTela} readOnly placeholder="" /></td>
                    <td className="columna_color"><input type="text" value={fila.colorBase} readOnly placeholder="" /></td>
                    <td className="columna_acabado"><input type="text" value={fila.acabadoDiseno} readOnly placeholder="" /></td>
                    <td className="columna_ancho"><input type="number" step="0.01" inputMode="decimal" value={fila.anchoTela} readOnly placeholder="" /></td>
                    <td className="columna_peso"><input type="number" step="0.01" inputMode="decimal" value={fila.pesoEnviado} readOnly placeholder="" /></td>
                    <td className="columna_peso"><input type="number" step="0.01" inputMode="decimal" value={fila.pesoTela} onChange={(evento) => manejarCambioPesoUsado(fila.id, evento.target.value)} onBlur={() => manejarBlurPesoUsado(fila.id)} placeholder="" /></td>
                    <td className="columna_peso"><input type="text" value={formatearPesoDecimal(obtenerSaldoSobranteFila(fila))} readOnly placeholder="" /></td>
                    <td className="columna_partida"><input type="text" value={fila.partida} readOnly placeholder="" /></td>
                    <td className={`columna_corta ${camposInvalidos.includes("panos") && String(fila.panos || "").trim() === "" ? "celda_error_validacion" : ""}`}><input type="number" step="0.01" inputMode="decimal" value={fila.panos} onChange={(evento) => manejarCambioPanos(fila.id, evento.target.value)} placeholder="0" /></td>
                    {tallasActivasCorte.map((talla) => (<td key={talla} className="columna_corta"><input type="number" step="0.01" inputMode="decimal" value={fila.salidas[talla]} onChange={(evento) => manejarCambioSalida(fila.id, talla, evento.target.value)} placeholder="0" /></td>))}
                    <td className="columna_total"><strong>{calcularTotalFila(fila, tallasActivasCorte)}</strong></td>
                    <td>
                      <div className="acciones_tabla_dobles">
                        <button
                          type="button"
                          className="btn btn_secundario btn_tabla"
                          onClick={() => solicitarDevolucionSobranteAlmacen(fila)}
                        >
                          Devolver sobrante
                        </button>
                        <button
                          type="button"
                          className="btn btn_principal btn_tabla"
                          onClick={() => solicitarDevolucionTotalAlmacen(fila)}
                        >
                          Devolver toda la tela
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="pie_trazo">
              <Campo className="campo_requerido campo_merma campo_pie_trazo">
                <label>Merma</label>
                <div className="campo_merma__grupo">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    name="merma"
                    value={cabeceraCorte.merma}
                    onChange={manejarCambioCabecera}
                    placeholder=""
                  />
                  <select
                    name="unidadMerma"
                    value={cabeceraCorte.unidadMerma}
                    onChange={manejarCambioCabecera}
                  >
                    {unidadesControlPeso.map((unidad) => (
                      <option key={unidad} value={unidad}>
                        {unidad}
                      </option>
                    ))}
                  </select>
                </div>
              </Campo>
              <Campo className="campo_requerido campo_pie_trazo">
                <label>Peso corte</label>
                <div className="campo_unidad__grupo">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    name="pesoTelaCorte"
                    value={cabeceraCorte.pesoTelaCorte}
                    onChange={manejarCambioCabecera}
                    placeholder=""
                  />
                  <select
                    name="unidadMerma"
                    value={cabeceraCorte.unidadMerma}
                    onChange={manejarCambioCabecera}
                  >
                    {unidadesControlPeso.map((unidad) => (
                      <option key={unidad} value={unidad}>
                        {unidad}
                      </option>
                    ))}
                  </select>
                </div>
              </Campo>
              <Campo className="campo_pie_trazo">
                <label>Merma + corte</label>
                <div className="campo_unidad__grupo">
                  <input type="text" value={totalControlCorte.toFixed(2)} readOnly />
                  <select value={cabeceraCorte.unidadMerma} disabled>
                    <option value={cabeceraCorte.unidadMerma}>
                      {cabeceraCorte.unidadMerma}
                    </option>
                  </select>
                </div>
              </Campo>
              <Campo className="campo_pie_trazo">
                <label>Total peso usado</label>
                <div className="campo_unidad__grupo">
                  <input type="text" value={totalPesoTelas.toFixed(2)} readOnly />
                  <select value={cabeceraCorte.unidadMerma} disabled>
                    <option value={cabeceraCorte.unidadMerma}>
                      {cabeceraCorte.unidadMerma}
                    </option>
                  </select>
                </div>
              </Campo>
              <Campo className="campo_pie_trazo">
                <label>Total sobrante</label>
                <div className="campo_unidad__grupo">
                  <input type="text" value={totalPesoSobrante.toFixed(2)} readOnly />
                  <select value={cabeceraCorte.unidadMerma} disabled>
                    <option value={cabeceraCorte.unidadMerma}>
                      {cabeceraCorte.unidadMerma}
                    </option>
                  </select>
                </div>
              </Campo>
              <Campo className="campo_pie_trazo">
                <label>Total peso enviado</label>
                <div className="campo_unidad__grupo">
                  <input type="text" value={totalPesoEnviado.toFixed(2)} readOnly />
                  <select value={cabeceraCorte.unidadMerma} disabled>
                    <option value={cabeceraCorte.unidadMerma}>
                      {cabeceraCorte.unidadMerma}
                    </option>
                  </select>
                </div>
              </Campo>
              <Campo>
                <label>Diferencia de control</label>
                <div className="campo_unidad__grupo">
                  <input
                    type="text"
                    value={diferenciaControlPeso.toFixed(2)}
                    readOnly
                  />
                  <select value={cabeceraCorte.unidadMerma} disabled>
                    <option value={cabeceraCorte.unidadMerma}>
                      {cabeceraCorte.unidadMerma}
                    </option>
                  </select>
                </div>
              </Campo>
            </div>
          </section>

          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Solicitudes a almacen</h2>
                <p>
                  Si Produccion necesita aumentar tela o devolver una tela del trazo,
                  aqui solo se solicita. Almacen es quien confirma el movimiento real.
                </p>
              </div>
            </div>

            <div className="grid grid-3">
              <Campo className="campo_requerido">
                <label>Tipo de tela</label>
                <input
                  type="text"
                  list="catalogo-solicitud-corte-tela"
                  name="tipoTela"
                  value={solicitudNueva.tipoTela}
                  onChange={manejarCambioSolicitud}
                />
                <datalist id="catalogo-solicitud-corte-tela">
                  {catalogosProduccion.tiposTela.map((tipoTela) => (
                    <option key={tipoTela} value={tipoTela} />
                  ))}
                </datalist>
              </Campo>

              <Campo className="campo_requerido">
                <label>Color base</label>
                <input
                  type="text"
                  list="catalogo-solicitud-corte-color"
                  name="colorBase"
                  value={solicitudNueva.colorBase}
                  onChange={manejarCambioSolicitud}
                />
                <datalist id="catalogo-solicitud-corte-color">
                  {coloresDisponiblesSolicitud.map((color) => (
                    <option key={color} value={color} />
                  ))}
                </datalist>
                {solicitudNueva.tipoTela && coloresDisponiblesSolicitud.length === 0 ? (
                  <small>No hay colores con rollo completo o sobrante disponible para esta tela.</small>
                ) : null}
              </Campo>

              <Campo>
                <label>Motivo</label>
                <input
                  type="text"
                  list="catalogo-solicitud-corte-motivo"
                  name="motivo"
                  value={solicitudNueva.motivo}
                  onChange={manejarCambioSolicitud}
                  placeholder="Selecciona o escribe un motivo"
                />
                <datalist id="catalogo-solicitud-corte-motivo">
                  {motivosGlobales.map((motivo) => (
                    <option key={motivo} value={motivo} />
                  ))}
                </datalist>
              </Campo>
            </div>

            <div className="acciones_solicitud">
              <button
                type="button"
                className="btn btn_principal"
                onClick={solicitarAumentoAlmacen}
              >
                Solicitar aumento a almacen
              </button>
            </div>

            <div className="movimientos_materiales">
              <div className="movimiento_bloque">
                <span className="movimiento_titulo">Solicitudes de esta OP</span>
                {solicitudesPedidoActual.length === 0 ? (
                  <small>Todavia no hay solicitudes registradas para esta OP.</small>
                ) : (
                  solicitudesPedidoActual.map((solicitud) => (
                    <div
                      key={solicitud.id}
                      className={`movimiento_chip ${
                        solicitud.tipoSolicitud === "aumento"
                          ? "movimiento_chip--aumento"
                          : solicitud.tipoDevolucion === "SOBRANTE_PRODUCCION"
                            ? "movimiento_chip--sobrante"
                            : solicitud.tipoDevolucion === "DEVOLUCION_TOTAL"
                              ? "movimiento_chip--total"
                              : ""
                      }`}
                    >
                      <strong>
                        {solicitud.tipoSolicitud === "aumento"
                          ? "Aumento solicitado"
                          : solicitud.tipoDevolucion === "SOBRANTE_PRODUCCION"
                            ? "Sobrante solicitado"
                            : solicitud.tipoDevolucion === "DEVOLUCION_TOTAL"
                              ? "Devolucion total solicitada"
                              : "Devolucion solicitada"}
                      </strong>
                      <span>
                        {solicitud.codigoUnidad ? `${solicitud.codigoUnidad} | ` : ""}
                        {solicitud.tipoTela || "-"} | {solicitud.colorBase || "-"}
                        {solicitud.tipoSolicitud === "devolucion" &&
                        (solicitud.pesoDevuelto || solicitud.pesoTela)
                          ? ` | ${Number(
                              solicitud.pesoDevuelto || solicitud.pesoTela || 0
                            ).toFixed(decimalesSistema)} ${solicitud.unidadControl || "KG"}`
                          : ""}
                      </span>
                      <small>
                        {solicitud.estado || "-"}
                        {solicitud.motivo ? ` | ${solicitud.motivo}` : ""}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Detalles de confeccion</h2>
                <p>
                  Aqui puedes marcar procesos y detalles del modelo para que Produccion y taller
                  tengan claro que trabajo acompana a esta OP.
                </p>
              </div>
            </div>
            <div className="grid grid-2">
              <Campo className="campo-completo">
                <label>Detalles del modelo</label>
                <div className="grupo_checks">
                  {detallesConfeccionConfigurados.map((detalle) => (
                    <CheckTalla key={detalle.clave}>
                      <input
                        type="checkbox"
                        checked={Boolean(cabeceraCorte.detallesConfeccion?.[detalle.clave])}
                        onChange={() => manejarCheckDetalleConfeccion(detalle.clave)}
                      />
                      <span>{detalle.etiqueta}</span>
                    </CheckTalla>
                  ))}
                </div>
              </Campo>
              {cabeceraCorte.detallesConfeccion.MULTIAGUJA ? (
                <Campo>
                  <label>Cantidad de agujas</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="1"
                    inputMode="numeric"
                    value={cabeceraCorte.detallesConfeccion.cantidadAgujas}
                    onChange={(evento) =>
                      manejarCambioDetalleConfeccion("cantidadAgujas", evento.target.value)
                    }
                    placeholder=""
                  />
                </Campo>
              ) : null}
              <Campo className="campo-completo">
                <label>Otro detalle</label>
                <input
                  type="text"
                  value={cabeceraCorte.detallesConfeccion.otroDetalle}
                  onChange={(evento) =>
                    manejarCambioDetalleConfeccion("otroDetalle", evento.target.value)
                  }
                  placeholder=""
                />
              </Campo>
            </div>
          </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Productos derivados del trazo</h2>
              <p>
                Aqui registras lo que tambien salio del mismo corte, pero como
                otro producto aprovechado. Luego podra ir a otro taller con otro costo.
              </p>
              <div className="aviso_derivados_corte">
                <strong>Mismo modelo:</strong> se integra a la OP principal, solo suma colores o tallas y hereda los detalles de confeccion.
                <br />
                <strong>Modelo diferente:</strong> sale como otra orden para envio a taller y no hereda los detalles de la OP principal.
              </div>
            </div>
            <button
              type="button"
              className="btn btn_principal"
              onClick={agregarProductoDerivado}
            >
              Agregar derivado
            </button>
          </div>

          {(cabeceraCorte.productosDerivados || []).length === 0 ? (
            <div className="movimiento_bloque">
              <small>Todavia no hay productos derivados registrados en esta OP.</small>
            </div>
          ) : (
            <div className="tabla_contenedor">
              <table className="tabla_derivados">
                <thead>
                  <tr>
                    <th>Tipo derivado</th>
                    <th>Origen</th>
                    <th>Modelo derivado</th>
                    <th>Tipo de tela</th>
                    <th>Color base</th>
                    <th>Color nuevo</th>
                    <th>S</th>
                    <th>M</th>
                    <th>L</th>
                    <th>XL</th>
                    <th>XXL</th>
                    <th>Total</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {cabeceraCorte.productosDerivados.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <select
                          value={item.tipoHijo || "MISMO_MODELO"}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "tipoHijo", evento.target.value)
                          }
                        >
                          {tiposHijoOpDisponibles.map((tipo) => (
                            <option key={`${item.id}-tipo-${tipo}`} value={tipo}>
                              {formatearTipoDerivadoVisible(tipo)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={item.origenMaterial || "RETAZO"}
                          onChange={(evento) =>
                            manejarCambioDerivado(
                              item.id,
                              "origenMaterial",
                              evento.target.value
                            )
                          }
                        >
                          {origenesHijoOpDisponibles.map((origen) => (
                            <option key={`${item.id}-origen-${origen}`} value={origen}>
                              {origen.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          list={`catalogo-derivado-modelo-${item.id}`}
                          value={item.modeloBase}
                          readOnly={(item.tipoHijo || "MISMO_MODELO") === "MISMO_MODELO"}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "modeloBase", evento.target.value)
                          }
                          placeholder=""
                        />
                        <datalist id={`catalogo-derivado-modelo-${item.id}`}>
                          {(
                            catalogosProduccion.modelosDerivados?.length
                              ? catalogosProduccion.modelosDerivados
                              : catalogosProduccion.modelos || []
                          ).map((modelo) => (
                            <option key={modelo} value={modelo} />
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <input
                          type="text"
                          list={`catalogo-derivado-tela-${item.id}`}
                          value={item.tipoTela}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "tipoTela", evento.target.value)
                          }
                          placeholder=""
                        />
                        <datalist id={`catalogo-derivado-tela-${item.id}`}>
                          {catalogosProduccion.tiposTela.map((tipoTela) => (
                            <option key={tipoTela} value={tipoTela} />
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <input
                          type="text"
                          list={`catalogo-derivado-color-${item.id}`}
                          value={item.colorBase}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "colorBase", evento.target.value)
                          }
                          placeholder=""
                        />
                        <datalist id={`catalogo-derivado-color-${item.id}`}>
                          {obtenerColoresDisponiblesDerivado(item).map((color) => (
                            <option key={color} value={color} />
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(item.colorNuevo)}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "colorNuevo", evento.target.checked)
                          }
                        />
                      </td>
                      <td className="columna_corta">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={item?.salidas?.S || ""}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "salidas.S", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td className="columna_corta">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={item?.salidas?.M || ""}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "salidas.M", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td className="columna_corta">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={item?.salidas?.L || ""}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "salidas.L", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td className="columna_corta">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={item?.salidas?.XL || ""}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "salidas.XL", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td className="columna_corta">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={item?.salidas?.XXL || ""}
                          onChange={(evento) =>
                            manejarCambioDerivado(item.id, "salidas.XXL", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>{calcularTotalDerivado(item)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn_secundario btn_tabla"
                          onClick={() => quitarProductoDerivado(item.id)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div><span>Modelo</span><strong>{cabeceraCorte.modeloBase || "-"}</strong></div>
            {tallasActivasCorte.map((talla) => (
              <div key={talla}><span>{`Total ${talla}`}</span><strong>{totalesPorTalla[talla] || 0}</strong></div>
            ))}
            <div><span>Total general</span><strong>{totalUnidades}</strong></div>
          </div>
          {resumenDerivados.length > 0 ? (
            <div className="movimientos_materiales resumen_derivados">
              <div className="movimiento_bloque">
                <span className="movimiento_titulo">Productos derivados</span>
                {resumenDerivados.map((item) => (
                  <div key={item.id} className="movimiento_chip">
                    <strong>{item.modelo}</strong>
                    <span>{formatearTipoDerivadoVisible(item.tipoHijo)}</span>
                    <span>{item.origenMaterial === "SOBRANTE" ? "Sobrante" : item.origenMaterial === "TELA_NORMAL" ? "Tela normal" : "Retazo"}</span>
                    <span>Total derivado: {item.total}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="acciones">
          {esPedidoCancelableEnProduccion ? (
            <button
              type="button"
              className="btn btn_peligro"
              onClick={manejarCancelarPedidoProduccion}
            >
              Cancelar pedido
            </button>
          ) : null}
          {!modoActualizacionOp ? (
            <button type="button" className="btn btn_secundario" onClick={manejarGuardar}>Guardar</button>
          ) : null}
          {!modoActualizacionOp && !cabeceraCorte.codigoCorte ? (
            <button type="button" className="btn btn_secundario" onClick={manejarGenerarOp}>Generar OP</button>
          ) : null}
          {!modoActualizacionOp && cabeceraCorte.codigoCorte ? (
            <button type="button" className="btn btn_principal" onClick={manejarConfirmarCorte}>Confirmar OP</button>
          ) : null}
          {modoActualizacionOp ? (
            <button type="button" className="btn btn_principal" onClick={manejarActualizarOp}>Actualizar OP</button>
          ) : null}
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  background-color: ${({ theme }) => theme.bgtotal};
  color: ${({ theme }) => theme.text};
  display: grid;
  grid-template-rows: 90px auto auto 1fr;
  gap: 16px;
  padding: 15px;

  .encabezado { display: flex; align-items: center; justify-content: flex-end; background-color: ${({ theme }) => theme.bgcards}; border-radius: 16px; padding-right: 10px; }
  .cabecera, .tarjeta { background-color: ${({ theme }) => theme.bgcards}; border-radius: 16px; padding: 20px; }
  .cabecera { display: grid; gap: 14px; }
  .cabecera h1, .tarjeta h2 { margin: 0 0 8px; }
  .cabecera p, .tarjeta p, .resumen span { margin: 0; color: ${({ theme }) => theme.colorSubtitle}; }
  .cabecera__estado { width: fit-content; padding: 14px 18px; border-radius: 14px; background-color: ${({ theme }) => theme.bgtotal}; }
  .cabecera__estado span { display: block; font-size: 13px; color: ${({ theme }) => theme.colorSubtitle}; margin-bottom: 6px; }
  .cabecera__estado strong { font-size: 26px; color: ${({ theme }) => theme.bg5}; }
  .fila_superior { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .navegacion_superior { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
  .boton_volver { display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border-radius: 10px; background-color: ${({ theme }) => theme.bg4}; color: ${({ theme }) => theme.text}; text-decoration: none; font-weight: 600; }
  .contenido { display: grid; gap: 16px; }
  .alerta_ajuste {
    border: 1px solid ${({ theme }) => theme.bg5};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.06)" : "rgba(117, 1, 152, 0.14)"};
    display: grid;
    gap: 6px;
  }
  .alerta_ajuste strong { color: ${({ theme }) => theme.bg5}; }
  .alerta_ajuste span,
  .alerta_ajuste small { color: ${({ theme }) => theme.text}; }
  .tarjeta_error_validacion {
    border: 1px solid ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 38, 38, 0.5)" : "rgba(248, 113, 113, 0.55)"};
    box-shadow: 0 0 0 3px
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(220, 38, 38, 0.12)"
          : "rgba(248, 113, 113, 0.14)"};
  }
  .celda_error_validacion input,
  .trazo_card__dato_error input {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 38, 38, 0.78)" : "rgba(248, 113, 113, 0.85)"} !important;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 38, 38, 0.06)" : "rgba(127, 29, 29, 0.25)"} !important;
  }
  .grid { display: grid; gap: 14px; }
  .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .campo-completo { grid-column: 1 / -1; }
  .campo_requerido label::after { content: " *"; color: ${({ theme }) => theme.bg5}; font-weight: 700; }
  .grupo_checks, .grupo_curvas { display: flex; flex-wrap: wrap; gap: 12px; }
  .texto_bloqueo { display: block; margin-top: 8px; color: ${({ theme }) => theme.colorSubtitle}; }
  .pestanas {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 18px;
    padding: 10px;
    border-radius: 16px;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#f6f1fa" : "rgba(255,255,255,0.04)"};
    border: 1px solid ${({ theme }) => theme.bg4};
  }
  .pestana {
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 11px 16px;
    background-color: transparent;
    color: ${({ theme }) => theme.colorSubtitle};
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }
  .pestana:hover {
    color: ${({ theme }) => theme.text};
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.18)" : "rgba(255,255,255,0.08)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.03)"};
  }
  .pestana_activa {
    background-color: ${({ theme }) => theme.bg5};
    border-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    box-shadow: 0 8px 18px rgba(117, 1, 152, 0.22);
    transform: translateY(-1px);
  }
  .tarjeta__encabezado { display: flex; align-items: start; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
  .acciones_tabla { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .trazo_tablet { display: none; }
  .trazo_card {
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bgtotal};
    border: 1px solid ${({ theme }) => theme.bg4};
  }
  .trazo_card__encabezado {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 10px;
  }
  .trazo_card__encabezado strong {
    display: block;
    font-size: 15px;
  }
  .trazo_card__encabezado span,
  .trazo_card__encabezado small,
  .trazo_card__total span,
  .trazo_card__dato label,
  .trazo_card__talla span {
    color: ${({ theme }) => theme.colorSubtitle};
  }
  .trazo_card__encabezado span {
    display: block;
    margin-top: 3px;
    font-size: 13px;
  }
  .trazo_card__resumen {
    display: grid;
    grid-template-columns: 1.5fr repeat(4, minmax(0, 96px));
    gap: 10px;
  }
  .trazo_card__dato {
    display: grid;
    gap: 6px;
  }
  .trazo_card__dato label,
  .trazo_card__talla span {
    font-size: 12px;
    font-weight: 700;
  }
  .trazo_card__dato input,
  .trazo_card__talla input {
    width: 100%;
    border-radius: 8px;
    outline: none;
  }
  .trazo_card__dato input {
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
    padding: 8px 9px;
  }
  .trazo_card__dato input:not([readonly]),
  .trazo_card__talla input {
    border: 1px solid ${({ theme }) => theme.bg5};
    background: rgba(117, 1, 152, 0.12);
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
    font-weight: 700;
    text-align: center;
  }
  .trazo_card__tallas {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .trazo_card__talla {
    display: grid;
    gap: 6px;
  }
  .trazo_card__pie {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .trazo_card__total {
    display: grid;
    gap: 4px;
  }
  .trazo_card__total strong {
    font-size: 22px;
  }
  .pie_trazo { margin-top: 12px; display: grid; grid-template-columns: repeat(4, minmax(186px, max-content)); gap: 18px 20px; align-items: end; justify-content: start; }
  .campo_merma { width: 166px; max-width: 166px; }
  .campo_pie_trazo { width: 208px; max-width: 208px; }
  .campo_pie_trazo input,
  .campo_pie_trazo select {
    padding: 8px 10px;
    font-size: 13px;
    min-height: 38px;
    text-align: center;
  }
  .campo_pie_trazo label { font-size: 13px; }
  .campo_merma__grupo {
      display: grid;
      grid-template-columns: minmax(108px, 1fr) 58px;
      gap: 8px;
      align-items: center;
    }
  .campo_unidad__grupo {
      display: grid;
      grid-template-columns: minmax(112px, 1fr) 76px;
      gap: 8px;
      align-items: center;
    }
  .campo_merma__grupo input {
      max-width: 108px;
      text-align: center;
    }
  .campo_unidad__grupo input {
      text-align: center;
    }
  .campo_merma__grupo select {
      min-width: 58px;
      max-width: 58px;
      text-align: center;
      padding-left: 6px;
      padding-right: 6px;
    }
  .campo_unidad__grupo select {
      min-width: 76px;
      max-width: 76px;
      text-align: center;
      padding-left: 6px;
      padding-right: 6px;
    }
  .buscador { margin-bottom: 16px; }
  .buscador input { width: 100%; border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)}; border-radius: 12px; padding: 14px 16px; font-size: 14px; background-color: ${({ theme }) => theme.bg}; color: ${({ theme }) => theme.text}; outline: none; }
  .tabla_contenedor { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { width: 100%; border-collapse: collapse; min-width: 1380px; }
  .tabla_listview { min-width: 920px; }
  th, td { padding: 10px; border-bottom: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d6dee8" : theme.bg4)}; text-align: left; vertical-align: top; }
  th { font-size: 13px; color: ${({ theme }) => theme.colorSubtitle}; background-color: ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#f7f9fc" : "transparent")}; }
  .fila_vacia { text-align: center; padding: 20px; color: ${({ theme }) => theme.colorSubtitle}; }
  td input {
    width: 100%;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
  }
  td input:not([readonly]):not([type="checkbox"]) {
    min-height: 34px;
    border: 1px solid ${({ theme }) => theme.bg5};
    border-radius: 8px;
    background: rgba(117, 1, 152, 0.12);
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
    font-weight: 700;
    outline: none;
  }
  td input:not([readonly]):not([type="checkbox"]):focus {
    box-shadow: 0 0 0 3px rgba(117, 1, 152, 0.2);
  }
  td select {
    width: 100%;
    min-height: 34px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 8px;
    padding: 8px 10px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
    outline: none;
  }
  td select:focus {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px rgba(117, 1, 152, 0.2);
  }
  .columna_codigo { min-width: 86px; }
  .columna_codigo input { max-width: 84px; padding: 8px 6px; font-size: 13px; }
  .columna_tipo_tela { min-width: 150px; }
  .columna_color { min-width: 140px; }
  .columna_corta { min-width: 56px; }
  .columna_corta input { min-width: 50px; max-width: 54px; padding: 7px 4px; font-size: 13px; line-height: 1.1; text-align: center; }
  .columna_ancho { min-width: 74px; }
  .columna_ancho input { max-width: 72px; padding: 8px 5px; font-size: 13px; text-align: center; }
  .columna_peso { min-width: 78px; }
  .columna_peso input { max-width: 76px; padding: 8px 5px; font-size: 13px; text-align: center; }
  .columna_partida { min-width: 76px; }
  .columna_partida input { max-width: 74px; padding: 8px 5px; font-size: 13px; text-align: center; }
  .columna_acabado { min-width: 190px; }
  .columna_total { min-width: 90px; text-align: center; }
  .resumen__grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 14px; }
  .resumen__grid span { display: block; font-size: 13px; margin-bottom: 6px; }
  .resumen__grid strong { font-size: 18px; }
  .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .acciones_solicitud { display: flex; justify-content: flex-end; margin-top: 14px; }
  .movimientos_materiales { display: grid; gap: 16px; margin-top: 18px; }
  .movimiento_bloque {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bgtotal};
  }
  .movimiento_titulo { font-size: 14px; font-weight: 700; }
  .aviso_derivados_corte {
    margin-top: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.16)" : "rgba(255,255,255,0.08)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.05)" : "rgba(255,255,255,0.03)"};
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
    line-height: 1.6;
  }
  .movimiento_chip {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.colorline};
    background-color: ${({ theme }) => theme.bgcards};
  }
  .movimiento_chip--aumento {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(3, 105, 161, 0.28)" : "rgba(125, 211, 252, 0.34)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(3, 105, 161, 0.06)" : "rgba(3, 105, 161, 0.16)"};
  }
  .movimiento_chip--sobrante {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(180, 83, 9, 0.28)" : "rgba(251, 191, 36, 0.34)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(180, 83, 9, 0.06)" : "rgba(180, 83, 9, 0.16)"};
  }
  .movimiento_chip--total {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(185, 28, 28, 0.28)" : "rgba(248, 113, 113, 0.34)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(185, 28, 28, 0.06)" : "rgba(185, 28, 28, 0.16)"};
  }
  .movimiento_chip span,
  .movimiento_chip small,
  .movimiento_bloque small { color: ${({ theme }) => theme.colorSubtitle}; }
  .acciones { display: flex; justify-content: flex-end; gap: 12px; }
  .paginacion { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
  .paginacion span { font-size: 14px; color: ${({ theme }) => theme.colorSubtitle}; }
  .btn { border: none; border-radius: 10px; padding: 12px 18px; font-weight: 600; cursor: pointer; }
  .btn_principal { background-color: ${({ theme }) => theme.bg5}; color: #ffffff; }
  .btn_peligro { background-color: #b3261e; color: #ffffff; }
  .btn_secundario { background-color: ${({ theme }) => theme.bg4}; color: ${({ theme }) => theme.text}; }
  .btn_tabla { width: 100%; padding: 10px 12px; }
  .acciones_tabla_dobles { display: flex; gap: 8px; flex-wrap: wrap; }
  .acciones_tabla_dobles .btn { flex: 1 1 160px; }
  .btn_enlace { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }

  @media (min-width: 1024px) and (max-width: 1700px) {
    padding: 12px;
    gap: 12px;

    .cabecera,
    .tarjeta {
      padding: 16px;
      border-radius: 14px;
    }

    .cabecera {
      grid-template-columns: minmax(0, 1fr) 200px;
      align-items: end;
    }

    .cabecera h1 {
      font-size: 34px;
    }

    .cabecera__estado {
      width: 100%;
      padding: 12px 14px;
    }

    .cabecera__estado strong {
      font-size: 22px;
    }

    .fila_superior,
    .navegacion_superior,
    .tarjeta__encabezado,
    .acciones_tabla,
    .acciones,
    .paginacion {
      flex-direction: row;
      align-items: center;
    }

    .navegacion_superior,
    .acciones {
      justify-content: flex-end;
    }

    .btn,
    .btn_enlace,
    .boton_volver {
      width: auto;
      min-width: 132px;
      padding: 10px 14px;
    }

    .pestanas {
      gap: 8px;
      padding: 8px;
    }

    .pestana {
      padding: 9px 14px;
      font-size: 13px;
    }

      .pie_trazo {
        grid-template-columns: repeat(3, minmax(0, max-content));
        gap: 12px 16px;
      }
    .campo_merma {
        width: 154px;
        max-width: 154px;
      }
    .campo_pie_trazo {
        width: 196px;
        max-width: 196px;
      }
    .campo_unidad__grupo {
        grid-template-columns: minmax(108px, 1fr) 72px;
      }
    .campo_unidad__grupo select {
        min-width: 72px;
        max-width: 72px;
        font-size: 12px;
      }

    .resumen__grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .resumen__grid strong {
      font-size: 16px;
    }

    .buscador input {
      padding: 12px 14px;
      font-size: 14px;
    }

    .trazo_tablet { display: none; }
    .trazo_tabla_escritorio { display: block; }

    .trazo_card {
      gap: 10px;
      padding: 12px;
    }

    .trazo_card__encabezado strong {
      font-size: 14px;
    }

    .trazo_card__encabezado span,
    .trazo_card__encabezado small {
      font-size: 12px;
    }

    .trazo_card__resumen {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .trazo_card__dato_largo {
      grid-column: 1 / -1;
    }

    .trazo_card__dato input,
    .trazo_card__talla input {
      min-height: 30px;
      padding: 6px 8px;
      font-size: 12px;
    }

    .trazo_card__tallas {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .trazo_card__pie {
      align-items: end;
      flex-wrap: wrap;
    }

    .trazo_card__pie .btn {
      min-width: 170px;
      margin-left: auto;
    }

    table { min-width: 1180px; }

    .tabla_listview {
      min-width: 700px;
    }

    th,
    td {
      padding: 7px 6px;
      font-size: 12px;
    }

    th {
      font-size: 12px;
      line-height: 1.25;
    }

    td input:not([readonly]):not([type="checkbox"]) {
      min-height: 28px;
      padding-top: 4px;
      padding-bottom: 4px;
      line-height: 1;
    }

    .columna_codigo { min-width: 78px; }
    .columna_codigo input { max-width: 76px; padding: 5px 4px; font-size: 11px; }
    .columna_tipo_tela { min-width: 112px; }
    .columna_color { min-width: 108px; }
    .columna_acabado { min-width: 132px; }
    .columna_ancho { min-width: 64px; }
    .columna_ancho input { max-width: 62px; padding: 4px 3px; font-size: 11px; line-height: 1; }
    .columna_peso { min-width: 68px; }
    .columna_peso input { max-width: 66px; padding: 4px 3px; font-size: 11px; line-height: 1; }
    .columna_partida { min-width: 66px; }
    .columna_partida input { max-width: 64px; padding: 4px 3px; font-size: 11px; line-height: 1; }
    .columna_corta { min-width: 48px; }
    .columna_corta input { min-width: 44px; max-width: 46px; padding: 4px 2px; font-size: 11px; line-height: 1; }
    .columna_total { min-width: 68px; }
  }

  @media (max-width: 1100px) {
    padding: 12px;
    .cabecera,
    .tarjeta { padding: 16px; }
    .grid-2,
    .grid-3 { grid-template-columns: 1fr; }
    .pestanas {
      margin-bottom: 14px;
      padding: 8px;
      border-radius: 14px;
    }
    .pestana {
      padding: 8px 12px;
      font-size: 13px;
    }
    .trazo_card {
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
    }
    .trazo_card__encabezado strong {
      font-size: 14px;
    }
    .trazo_card__encabezado span,
    .trazo_card__encabezado small {
      font-size: 12px;
    }
    .trazo_card__total strong {
      font-size: 18px;
    }
    .movimiento_bloque {
      padding: 12px;
      border-radius: 12px;
    }
    .movimiento_chip {
      padding: 8px 10px;
      border-radius: 10px;
    }
      .pie_trazo { grid-template-columns: repeat(2, minmax(0, max-content)); gap: 8px 12px; }
      .campo_merma { max-width: 100%; }
      .campo_pie_trazo { max-width: 100%; }
    .resumen__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    table { min-width: 1220px; }
    .tabla_listview { min-width: 860px; }
  }

  @media (max-width: 1023px) {
    .trazo_tablet {
      display: grid;
      gap: 12px;
    }

    .trazo_tabla_escritorio {
      display: none;
    }
  }

  @media (max-width: 860px) {
    grid-template-rows: auto auto auto 1fr;
    gap: 12px;
    padding: 10px;
    .encabezado { min-height: 72px; }
    .cabecera,
    .tarjeta { padding: 14px; border-radius: 14px; }
    .cabecera h1 { font-size: 30px; }
    .cabecera__estado { width: 100%; }
      .cabecera__estado strong { font-size: 22px; }
      .fila_superior,
      .navegacion_superior,
      .tarjeta__encabezado,
      .acciones_tabla,
      .acciones,
      .paginacion { flex-direction: column; align-items: stretch; }
    .pestanas { gap: 8px; }
    .pestana { width: 100%; justify-content: center; text-align: center; }
    .trazo_card {
      padding: 10px;
      gap: 8px;
    }
    .trazo_card__resumen,
    .trazo_card__tallas {
      gap: 8px;
    }
    .trazo_card__total strong {
      font-size: 17px;
    }
    .movimiento_bloque {
      padding: 10px;
    }
    .movimiento_chip {
      padding: 8px 9px;
    }
    .buscador input { padding: 12px 14px; font-size: 16px; }
    table { min-width: 1080px; }
    .tabla_listview { min-width: 780px; }
    th,
    td { padding: 8px; font-size: 13px; }
    .columna_codigo { min-width: 80px; }
    .columna_codigo input { max-width: 78px; padding: 7px 5px; font-size: 12px; }
    .columna_tipo_tela { min-width: 130px; }
    .columna_color { min-width: 126px; }
    .columna_acabado { min-width: 150px; }
    .columna_ancho { min-width: 64px; }
    .columna_ancho input { max-width: 62px; }
    .columna_peso { min-width: 68px; }
    .columna_peso input { max-width: 66px; }
    .columna_partida { min-width: 66px; }
    .columna_partida input { max-width: 64px; }
    .columna_corta { min-width: 50px; }
    .columna_corta input { min-width: 44px; max-width: 48px; padding: 6px 3px; font-size: 12px; }
    .columna_total { min-width: 70px; }
    .pie_trazo { grid-template-columns: 1fr; gap: 8px; }
    .campo_pie_trazo { max-width: 100%; }
      .campo_merma__grupo { grid-template-columns: minmax(102px, 1fr) 56px; }
      .campo_unidad__grupo { grid-template-columns: minmax(108px, 1fr) 70px; }
    .resumen__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .resumen__grid strong { font-size: 16px; }
    .btn,
    .btn_enlace,
    .boton_volver { width: 100%; justify-content: center; }
  }
`;

const Campo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  label { font-size: 14px; font-weight: 600; }
  input, textarea, select { border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)}; border-radius: 10px; padding: 12px; font-size: 14px; background-color: ${({ theme }) => theme.bg}; color: ${({ theme }) => theme.text}; outline: none; }
  input:focus, textarea:focus, select:focus { border-color: ${({ theme }) => theme.bg5}; box-shadow: 0 0 0 3px ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.14)" : "rgba(117, 1, 152, 0.2)")}; }
  textarea { min-height: 90px; resize: vertical; }
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
  &.campo_error select {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 38, 38, 0.78)" : "rgba(248, 113, 113, 0.85)"} !important;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 38, 38, 0.06)" : "rgba(127, 29, 29, 0.25)"} !important;
  }
`;

const CampoCurva = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 78px;
  span { font-size: 12px; font-weight: 700; color: ${({ theme }) => theme.colorSubtitle}; }
  input { width: 78px; min-width: 78px; border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)}; border-radius: 10px; padding: 8px 6px; font-size: 13px; background-color: ${({ theme }) => theme.bg}; color: ${({ theme }) => theme.text}; text-align: center; outline: none; }
`;

const CheckTalla = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background-color: ${({ theme }) => theme.bg};
  border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
  cursor: pointer;
  input { width: 16px; height: 16px; accent-color: ${({ theme }) => theme.bg5}; }
  span { font-size: 14px; font-weight: 600; }
`;




