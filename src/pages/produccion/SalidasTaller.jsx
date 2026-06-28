import { useEffect } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, UserAuth } from "../../index";
import { VisorFotosModelo } from "../../components/moleculas/VisorFotosModelo";
import { leerCatalogosProduccion } from "../../utils/catalogosProduccion";
import {
  leerCostosTallerModelo,
  obtenerCostoTallerPorModelo,
} from "../../utils/costosTaller";
import {
  confirmarAccionSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
  mostrarProcesoSistema,
  cerrarProcesoSistema,
  mostrarErrorSistema,
} from "../../utils/notificaciones";
import { obtenerNombreResponsableActivo } from "../../utils/responsableActivo";
import { crearEstadoHabilitadoTaller, leerHabilitadoTaller } from "../../utils/habilitadoTaller";
import { eliminarIngresosProductosTerminadosPorRecepciones } from "../../utils/productosTerminados";
import {
  sincronizarTallerStockDesdeLocalASupabase,
  sincronizarTallerStockDesdeSupabase,
} from "../../supabase/flujoTallerStockCore";
import {

  calcularSiguienteCorrelativoSistemaConfiguracion,
  guardarCostoTallerConfiguracion,
  listarCostosTallerConfiguracion,
  listarModelosProductoConfiguracion,
  listarTalleresConfiguracion,
  leerCorrelativoSistemaConfiguracion,
  registrarUsoCorrelativoSistemaConfiguracion,
} from "../../supabase/configuracionCore.js";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

// Este modulo muestra las OP listas para salir al taller principal.
// Los procesos externos quedan solo como apoyo manual y no se generan solos
// por llevar multiaguja; si se tercerizan despues, nacen desde recepcion parcial.
const CLAVE_CORTE_ACTUAL = "cynara_detalle_corte_actual";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_CABECERA_SALIDA_TALLER = "cynara_cabecera_salida_taller";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_SOLICITUDES_PROCESOS_EXTERNOS =
  "cynara_solicitudes_procesos_externos";
const CLAVE_TERCERIZACIONES = "cynara_tercerizaciones_op";
const CLAVE_DESCUENTOS_TALLER = "cynara_descuentos_taller";
const CLAVE_AJUSTES_RECEPCION_PRODUCCION =
  "cynara_ajustes_recepcion_produccion";
const CLAVE_ACONDICIONADO_PT = "cynara_acondicionado_producto_terminado";
const CLAVE_REMATES_PT = "cynara_remates_producto_terminado";
const CLAVE_PRODUCTOS_TERMINADOS = "cynara_productos_terminados";
const CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS =
  "cynara_movimientos_productos_terminados";
const CLAVE_LOTES_PRODUCTOS_TERMINADOS = "cynara_lotes_productos_terminados";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();
const TIPOS_PROCESO_EXTERNO = [
  "MULTIAGUJA",
  "ESTAMPADO",
  "BORDADO",
  "LAVADO",
  "OTRO",
];
const TALLAS_DISPONIBLES = ["S", "M", "L", "XL", "XXL"];

const obtenerDatoGuardado = (clave) => {
  const contenido = localStorage.getItem(clave);

  if (!contenido) {
    return null;
  }

  try {
    return JSON.parse(contenido);
  } catch {
    return null;
  }
};

const obtenerListaGuardada = (clave) => {
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

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const formatearMoneda = (valor) =>
  convertirNumero(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatearMontoSoles = (valor) => `S/ ${formatearMoneda(valor)}`;

const obtenerTallasActivas = (tallasSeleccionadas = [], totales = {}) => {
  const tallasConContenido = TALLAS_DISPONIBLES.filter(
    (talla) => convertirNumero(totales?.[talla]) > 0
  );

  if (Array.isArray(tallasSeleccionadas) && tallasSeleccionadas.length > 0) {
    const tallasNormalizadas = TALLAS_DISPONIBLES.filter((talla) =>
      tallasSeleccionadas.includes(talla)
    );
    const tallasCombinadas = Array.from(
      new Set([...tallasNormalizadas, ...tallasConContenido])
    );

    return tallasCombinadas.length > 0
      ? tallasCombinadas
      : [...TALLAS_DISPONIBLES];
  }

  return tallasConContenido.length > 0 ? tallasConContenido : [...TALLAS_DISPONIBLES];
};

const calcularTotalDesdeTotales = (totales = {}) =>
  TALLAS_DISPONIBLES.reduce(
    (total, talla) => total + convertirNumero(totales?.[talla]),
    0
  );

const construirClaveTercerizacion = (registro = {}) =>
  [
    registro?.itemSalidaId || "",
    registro?.codigoOp || "",
    registro?.proceso || "MULTIAGUJA",
  ].join("::");

const construirClaveTercerizacionSecundaria = (registro = {}) =>
  [
    registro?.codigoOp || "",
    registro?.modelo || "",
    registro?.proceso || "MULTIAGUJA",
    registro?.tallerTercero || "",
  ].join("::");

const obtenerPuntajeTercerizacion = (registro = {}) => {
  let puntaje = 0;

  if (registro?.itemSalidaId) puntaje += 2;
  if (registro?.tallerTercero) puntaje += 2;
  if (convertirNumero(registro?.cantidadAgujas) > 0) puntaje += 2;
  if (convertirNumero(registro?.cantidad) > 0) puntaje += 2;
  if (convertirNumero(registro?.costoUnitario) > 0) puntaje += 2;
  if (registro?.fechaRecepcionAlmacen) puntaje += 4;
  if (registro?.fechaEnvioTercero) puntaje += 8;
  if (registro?.fechaRetornoTercero) puntaje += 16;
  if (registro?.aprobadoProduccion) puntaje += 32;
  if (convertirNumero(registro?.montoPagadoAcumulado) > 0 || registro?.pagadoProduccion) puntaje += 64;

  return puntaje;
};

const normalizarHistorialTercerizaciones = (lista = []) => {
  const mapa = new Map();
  const mapaSecundario = new Map();

  lista.forEach((registro) => {
    const clave = construirClaveTercerizacion(registro);
    const claveSecundaria = construirClaveTercerizacionSecundaria(registro);
    if (!registro?.codigoOp || !clave) {
      return;
    }

    const previo = mapa.get(clave) || mapaSecundario.get(claveSecundaria);
    if (!previo) {
      mapa.set(clave, registro);
      mapaSecundario.set(claveSecundaria, registro);
      return;
    }

    const preferido =
      obtenerPuntajeTercerizacion(registro) >= obtenerPuntajeTercerizacion(previo)
        ? { ...previo, ...registro, id: registro?.id || previo?.id }
        : { ...registro, ...previo, id: previo?.id || registro?.id };

    mapa.set(clave, preferido);
    mapaSecundario.set(claveSecundaria, preferido);
  });

  return [...new Set(mapaSecundario.values())];
};

const crearTotalesPorTallaVacio = () =>
  TALLAS_DISPONIBLES.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: 0,
    }),
    {}
  );

const crearDetalleColorTalla = (filas = []) => {
  const mapa = new Map();

  filas.forEach((fila, indice) => {
    const colorBase = fila?.colorBase || `COLOR ${indice + 1}`;
    const actual = mapa.get(colorBase) || {
      id: `${colorBase}-${indice + 1}`,
      colorBase,
      tipoHijo: "PRINCIPAL",
      origenMaterial: "TELA_NORMAL",
      colorNuevo: false,
      salidas: crearTotalesPorTallaVacio(),
    };

    TALLAS_DISPONIBLES.forEach((talla) => {
      actual.salidas[talla] =
        convertirNumero(actual.salidas?.[talla]) +
        convertirNumero(fila?.salidas?.[talla]);
    });

    actual.colorNuevo = Boolean(actual.colorNuevo || fila?.colorNuevo);

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

const filtrarDetalleColorTallaPorTallas = (
  detalleColorTalla = [],
  tallasSeleccionadas = []
) =>
  (Array.isArray(detalleColorTalla) ? detalleColorTalla : [])
    .map((fila, indice) => ({
      id: fila?.id || `detalle-color-${indice + 1}`,
      colorBase: fila?.colorBase || `COLOR ${indice + 1}`,
      tipoHijo: fila?.tipoHijo || "PRINCIPAL",
      origenMaterial: fila?.origenMaterial || "TELA_NORMAL",
      colorNuevo: Boolean(fila?.colorNuevo),
      salidas: TALLAS_DISPONIBLES.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: tallasSeleccionadas.includes(talla)
            ? convertirNumero(fila?.salidas?.[talla])
            : 0,
        }),
        crearTotalesPorTallaVacio()
      ),
    }))
    .filter((fila) =>
      tallasSeleccionadas.some((talla) => convertirNumero(fila?.salidas?.[talla]) > 0)
    );

const crearCodigoSalida = (codigoOp = "", correlativo = 1, prefijo = "ST") =>
  `${codigoOp}-${prefijo}${String(Math.max(1, Number(correlativo) || 1)).padStart(2, "0")}`;

const CAMPOS_REFERENCIA_CODIGO_SALIDA = new Set([
  "codigoSalida",
  "pedidoOrigen",
  "ultimaSalida",
]);

const remapearReferenciasCodigoSalida = (valor, mapaCodigos = new Map()) => {
  if (Array.isArray(valor)) {
    return valor.map((item) => remapearReferenciasCodigoSalida(item, mapaCodigos));
  }

  if (!valor || typeof valor !== "object") {
    return valor;
  }

  return Object.entries(valor).reduce((acumulado, [clave, contenido]) => {
    if (
      CAMPOS_REFERENCIA_CODIGO_SALIDA.has(clave) &&
      typeof contenido === "string" &&
      mapaCodigos.has(contenido)
    ) {
      acumulado[clave] = mapaCodigos.get(contenido);
      return acumulado;
    }

    acumulado[clave] = remapearReferenciasCodigoSalida(contenido, mapaCodigos);
    return acumulado;
  }, {});
};

const normalizarCodigosSalidaTallerGlobales = (prefijo = "ST") => {
  const salidasActuales = obtenerListaGuardada(CLAVE_SALIDAS_TALLER);
  const envios = salidasActuales.filter((item) => item?.tipoRegistro === "envio_taller");

  if (envios.length === 0) {
    return false;
  }

  const enviosOrdenados = envios
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => {
      const fechaA = String(a.item?.fechaEnvio || a.item?.fechaEntrega || "");
      const fechaB = String(b.item?.fechaEnvio || b.item?.fechaEntrega || "");

      if (fechaA !== fechaB) {
        return fechaA.localeCompare(fechaB);
      }

      const numeroA = Number(String(a.item?.codigoSalida || "").match(/(\d+)$/)?.[1] || "0");
      const numeroB = Number(String(b.item?.codigoSalida || "").match(/(\d+)$/)?.[1] || "0");

      if (numeroA !== numeroB) {
        return numeroA - numeroB;
      }

      return a.indice - b.indice;
    });

  const mapaPorId = new Map();
  const mapaCodigos = new Map();

  enviosOrdenados.forEach(({ item }, indice) => {
    const nuevoCodigo = crearCodigoSalida(
      item?.codigoOp || "",
      indice + 1,
      prefijo
    );
    mapaPorId.set(item?.id || item?.codigoSalida || `${item?.codigoOp}-${indice}`, nuevoCodigo);

    if (item?.codigoSalida && item.codigoSalida !== nuevoCodigo) {
      mapaCodigos.set(item.codigoSalida, nuevoCodigo);
    }
  });

  if (mapaCodigos.size === 0) {
    return false;
  }

  const salidasNormalizadas = salidasActuales.map((item, indice) => {
    if (item?.tipoRegistro !== "envio_taller") {
      return item;
    }

    const clave =
      item?.id || item?.codigoSalida || `${item?.codigoOp || "op"}-${indice}`;
    const nuevoCodigo = mapaPorId.get(clave) || item?.codigoSalida || "";

    return {
      ...item,
      codigoSalida: nuevoCodigo,
    };
  });

  const clavesActualizar = [
    CLAVE_RECEPCIONES_TALLER,
    CLAVE_SOLICITUDES_PROCESOS_EXTERNOS,
    CLAVE_TERCERIZACIONES,
    CLAVE_ACONDICIONADO_PT,
    CLAVE_REMATES_PT,
    CLAVE_PRODUCTOS_TERMINADOS,
    CLAVE_MOVIMIENTOS_PRODUCTOS_TERMINADOS,
    CLAVE_LOTES_PRODUCTOS_TERMINADOS,
  ];

  localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(salidasNormalizadas));

  clavesActualizar.forEach((clave) => {
    const lista = obtenerListaGuardada(clave);
    if (lista.length > 0) {
      localStorage.setItem(
        clave,
        JSON.stringify(remapearReferenciasCodigoSalida(lista, mapaCodigos))
      );
    }
  });

  const cabeceraGuardada = obtenerDatoGuardado(CLAVE_CABECERA_SALIDA_TALLER);
  if (cabeceraGuardada) {
    localStorage.setItem(
      CLAVE_CABECERA_SALIDA_TALLER,
      JSON.stringify(remapearReferenciasCodigoSalida(cabeceraGuardada, mapaCodigos))
    );
  }

  return true;
};

const formatearResumenTallas = (totales = {}, tallasActivas = TALLAS_DISPONIBLES) =>
  tallasActivas
    .map((talla) => `${talla}: ${convertirNumero(totales?.[talla])}`)
    .join(" | ");

const calcularTotalUnidades = (filas = [], tallasActivas = TALLAS_DISPONIBLES) =>
  filas.reduce(
    (total, fila) =>
      total +
      tallasActivas.reduce(
        (subTotal, talla) => subTotal + convertirNumero(fila?.salidas?.[talla]),
        0
      ),
    0
  );

const calcularTotalesPorTalla = (filas = [], tallasActivas = TALLAS_DISPONIBLES) =>
  tallasActivas.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: filas.reduce(
        (total, fila) => total + convertirNumero(fila?.salidas?.[talla]),
        0
      ),
    }),
    crearTotalesPorTallaVacio()
  );

const normalizarClaveDetalle = (valor = "") =>
  valor
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizarClaveDerivado = (valor = "") =>
  valor
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const obtenerDetallesActivos = (detalles = {}, catalogo = []) =>
  catalogo.filter((detalle) => Boolean(detalles?.[normalizarClaveDetalle(detalle)]));

const crearProcesoExternoInicial = ({
  tipoProceso = "OTRO",
  cantidad = "",
  nombreTaller = "",
  costoUnitario = "",
  responsable = "",
  observacion = "",
  id,
} = {}) => ({
  id: id || `proceso-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  tipoProceso,
  nombreTaller,
  costoUnitario,
  cantidad,
  responsable,
  observacion,
});

const normalizarProcesosExternos = (procesos = [], cantidadTotal = 0) =>
  procesos.map((proceso, indice) =>
    crearProcesoExternoInicial({
      ...proceso,
      id: proceso?.id || `proceso-${indice + 1}`,
      cantidad:
        proceso?.cantidad === "" || proceso?.cantidad === undefined
          ? cantidadTotal
          : proceso.cantidad,
    })
  );

const crearCabeceraSalidaVacia = () => ({
  itemSalidaId: "",
  codigoSalida: "",
  tipoSalida: "",
  nombreTaller: "",
  tallerReservado: "",
  fechaReservaTaller: "",
  responsableReservaTaller: "",
  fechaEnvio: "",
  codigoOp: "",
  modelo: "",
  cantidadTotal: 0,
  tallasActivas: [],
  totalesPorTalla: crearTotalesPorTallaVacio(),
  tallasSeleccionadasEnvio: [],
  dividirPorTallas: false,
  detalleColorTalla: [],
  costoProduccion: "0",
  fechaEntrega: "",
  responsableEnvio: "",
  detallesConfeccion: {},
  productosDerivados: [],
  elastico: false,
  poliamidas: false,
  avios: false,
  listoEnviar: false,
  servicioATerceros: false,
  tipoProcesoTercero: "MULTIAGUJA",
  tallerTercero: "",
  observacionTercero: "",
  observacionesGenerales: "",
});

const generarCodigoTercerizacion = (
  codigoOp,
  historial = [],
  codigoExcluir = "",
  prefijo = "T",
) => {
  const correlativos = historial
    .filter(
      (item) =>
        item?.codigoOp === codigoOp &&
        item?.codigoTercerizacion &&
        item?.codigoTercerizacion !== codigoExcluir
    )
    .map((item) => {
      const match = String(item.codigoTercerizacion).match(/-([A-Z]+)(\d+)$/);
      if (!match) return 0;
      return match[1] === prefijo ? Number(match[2]) : 0;
    })
    .filter((numero) => Number.isFinite(numero));

  const correlativo = correlativos.length === 0 ? 1 : Math.max(...correlativos) + 1;
  return `${codigoOp}-${prefijo}${String(correlativo).padStart(2, "0")}`;
};

const crearSalidasDerivadoInicial = () => ({
  S: "",
  M: "",
  L: "",
  XL: "",
  XXL: "",
});

const normalizarTextoDerivado = (valor = "") => String(valor || "").trim().toUpperCase();
const normalizarTipoHijoDerivado = (derivado = {}, modeloPadre = "") => {
  if (derivado?.tipoHijo) {
    return derivado.tipoHijo;
  }

  return normalizarTextoDerivado(derivado?.modeloBase) === normalizarTextoDerivado(modeloPadre)
    ? "MISMO_MODELO"
    : "OTRO_MODELO";
};

const mezclarDetalleColorTalla = (base = [], extras = []) => {
  const mapa = new Map();

  [...(Array.isArray(base) ? base : []), ...(Array.isArray(extras) ? extras : [])].forEach(
    (fila, indice) => {
      const colorBase = fila?.colorBase || `COLOR ${indice + 1}`;
      const clave = normalizarTextoDerivado(colorBase) || `COLOR_${indice + 1}`;
      const existente = mapa.get(clave) || {
        id: fila?.id || `${clave}-${indice + 1}`,
        colorBase,
        tipoHijo: fila?.tipoHijo || "PRINCIPAL",
        origenMaterial: fila?.origenMaterial || "TELA_NORMAL",
        colorNuevo: Boolean(fila?.colorNuevo),
        salidas: crearTotalesPorTallaVacio(),
      };

      TALLAS_DISPONIBLES.forEach((talla) => {
        existente.salidas[talla] =
          convertirNumero(existente.salidas?.[talla]) +
          convertirNumero(fila?.salidas?.[talla]);
      });

      existente.colorNuevo = Boolean(existente.colorNuevo || fila?.colorNuevo);
      if ((fila?.tipoHijo || "").toString().trim()) {
        existente.tipoHijo = fila.tipoHijo;
      }
      if ((fila?.origenMaterial || "").toString().trim()) {
        existente.origenMaterial = fila.origenMaterial;
      }

      mapa.set(clave, existente);
    }
  );

  return Array.from(mapa.values());
};

const agruparProductosDerivados = (productosDerivados = []) => {
  const mapa = new Map();

  productosDerivados.forEach((derivado, indice) => {
    const claveAgrupacion = [
      normalizarClaveDerivado(derivado?.modeloBase || ""),
      normalizarClaveDerivado(derivado?.tipoTela || ""),
    ]
      .filter(Boolean)
      .join("__") || `DERIVADO_${indice + 1}`;

    const actual = mapa.get(claveAgrupacion) || {
      id: claveAgrupacion,
      modeloBase: derivado?.modeloBase || "",
      tipoTela: derivado?.tipoTela || "",
      colorBase: derivado?.colorBase || "",
      coloresBase: [],
      salidas: crearSalidasDerivadoInicial(),
      detalleColorTalla: [],
    };

    if (derivado?.colorBase) {
      actual.coloresBase = Array.from(
        new Set([...(actual.coloresBase || []), derivado.colorBase])
      );
    }

    const salidasActuales = {
      ...crearSalidasDerivadoInicial(),
      ...(derivado?.salidas || {}),
      ...(derivado?.cantidad ? { S: derivado.cantidad } : {}),
    };

    ["S", "M", "L", "XL", "XXL"].forEach((talla) => {
      actual.salidas[talla] = String(
        convertirNumero(actual.salidas?.[talla]) + convertirNumero(salidasActuales?.[talla])
      );
    });

    const colorDetalle = derivado?.colorBase || "VARIOS";
    const detalleExistente = actual.detalleColorTalla.find(
      (fila) => fila.colorBase === colorDetalle
    );

    if (detalleExistente) {
      TALLAS_DISPONIBLES.forEach((talla) => {
        detalleExistente.salidas[talla] =
          convertirNumero(detalleExistente.salidas?.[talla]) +
          convertirNumero(salidasActuales?.[talla]);
      });
      detalleExistente.colorNuevo = Boolean(
        detalleExistente.colorNuevo || derivado?.colorNuevo
      );
      if (derivado?.tipoHijo) {
        detalleExistente.tipoHijo = derivado.tipoHijo;
      }
      if (derivado?.origenMaterial) {
        detalleExistente.origenMaterial = derivado.origenMaterial;
      }
    } else {
      actual.detalleColorTalla.push({
        id: `${claveAgrupacion}-${normalizarClaveDerivado(colorDetalle)}`,
        colorBase: colorDetalle,
        tipoHijo: derivado?.tipoHijo || "OTRO_MODELO",
        origenMaterial: derivado?.origenMaterial || "RETAZO",
        colorNuevo: Boolean(derivado?.colorNuevo),
        salidas: TALLAS_DISPONIBLES.reduce(
          (acumulado, talla) => ({
            ...acumulado,
            [talla]: convertirNumero(salidasActuales?.[talla]),
          }),
          crearTotalesPorTallaVacio()
        ),
      });
    }

    actual.colorBase =
      actual.coloresBase.length <= 1
        ? actual.coloresBase[0] || actual.colorBase || ""
        : "VARIOS";

    mapa.set(claveAgrupacion, actual);
  });

  return Array.from(mapa.values());
};

const construirItemsDesdeCorte = (corte, estadoGuardado = {}) => {
  const codigoOp = corte?.cabeceraCorte?.codigoCorte || "-";
  const detallesConfeccion = corte?.cabeceraCorte?.detallesConfeccion || {};
  const productosDerivadosAgrupados = agruparProductosDerivados(
    corte?.cabeceraCorte?.productosDerivados || []
  );
  const productosDerivadosMismoModelo = productosDerivadosAgrupados.filter(
    (derivado) =>
      normalizarTipoHijoDerivado(derivado, corte?.cabeceraCorte?.modeloBase || "") ===
      "MISMO_MODELO"
  );
  const productosDerivadosOtroModelo = productosDerivadosAgrupados.filter(
    (derivado) =>
      normalizarTipoHijoDerivado(derivado, corte?.cabeceraCorte?.modeloBase || "") ===
      "OTRO_MODELO"
  );
  const detalleColorTalla = crearDetalleColorTalla(corte?.filasCorte || []);
  const detalleColorTallaIntegrado = mezclarDetalleColorTalla(
    detalleColorTalla,
    productosDerivadosMismoModelo.flatMap((item) => item?.detalleColorTalla || [])
  );
  const tallasActivas = obtenerTallasActivas(
    corte?.cabeceraCorte?.tallasSeleccionadas || []
  );
  const totalesBasePorTalla = calcularTotalesPorTalla(
    corte?.filasCorte || [],
    tallasActivas
  );
  const totalesPorTalla = TALLAS_DISPONIBLES.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]:
        convertirNumero(totalesBasePorTalla?.[talla]) +
        productosDerivadosMismoModelo.reduce(
          (total, derivado) => total + convertirNumero(derivado?.salidas?.[talla]),
          0
        ),
    }),
    crearTotalesPorTallaVacio()
  );
  const itemPrincipalId = `${codigoOp}-principal`;
  const estadoPrincipal = estadoGuardado[itemPrincipalId] || {};

  const items = [
    {
      id: itemPrincipalId,
      tipoRegistro: "op_base",
      codigoOp,
      tipoSalida: "PRINCIPAL",
      fechaCorte: corte?.cabeceraCorte?.fechaCorte || "-",
      pedidoOrigen: corte?.cabeceraCorte?.pedidoOrigen || "-",
      opOrigen: corte?.cabeceraCorte?.opOrigen || "-",
      modeloBase: corte?.cabeceraCorte?.modeloBase || "-",
      tallasActivas,
      totalesPorTalla,
      totalUnidades: calcularTotalDesdeTotales(totalesPorTalla),
      detalleColorTalla: detalleColorTallaIntegrado,
      detallesConfeccion,
      productosDerivados: productosDerivadosMismoModelo,
      productoDerivado: false,
      elastico: estadoPrincipal?.elastico || false,
      poliamidas: estadoPrincipal?.poliamidas || false,
      avios: estadoPrincipal?.avios || false,
      listoEnviar: estadoPrincipal?.listoEnviar || false,
      enviadoTaller: estadoPrincipal?.enviadoTaller || false,
    },
  ];

  productosDerivadosOtroModelo.forEach((derivado, indice) => {
    const itemId = `${codigoOp}-derivado-${derivado.id || indice + 1}`;
    const estadoDerivado = estadoGuardado[itemId] || {};
    const salidasDerivado = {
      ...crearSalidasDerivadoInicial(),
      ...(derivado?.salidas || {}),
      ...(derivado?.cantidad ? { S: derivado.cantidad } : {}),
    };
    items.push({
      id: itemId,
      tipoRegistro: "op_base",
      codigoOp,
      tipoSalida: "HIJO DE OP",
      fechaCorte: corte?.cabeceraCorte?.fechaCorte || "-",
      pedidoOrigen: corte?.cabeceraCorte?.pedidoOrigen || "-",
      opOrigen: corte?.cabeceraCorte?.opOrigen || "-",
      modeloBase: derivado?.modeloBase || "-",
      tallasActivas,
      totalesPorTalla: TALLAS_DISPONIBLES.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: convertirNumero(salidasDerivado[talla]),
        }),
        crearTotalesPorTallaVacio()
      ),
      totalUnidades:
        tallasActivas.reduce(
          (total, talla) => total + convertirNumero(salidasDerivado[talla]),
          0
        ),
      detalleColorTalla:
        Array.isArray(derivado?.detalleColorTalla) && derivado.detalleColorTalla.length > 0
          ? derivado.detalleColorTalla
          : [
              {
                id: `${itemId}-detalle`,
                colorBase: derivado?.colorBase || "VARIOS",
                salidas: {
                  ...crearTotalesPorTallaVacio(),
                  ...TALLAS_DISPONIBLES.reduce(
                    (acumulado, talla) => ({
                      ...acumulado,
                      [talla]: convertirNumero(salidasDerivado[talla]),
                    }),
                    {}
                  ),
                },
              },
            ],
      detallesConfeccion: {},
      productosDerivados: [derivado],
      productoDerivado: true,
      elastico: estadoDerivado?.elastico || false,
      poliamidas: estadoDerivado?.poliamidas || false,
      avios: estadoDerivado?.avios || false,
      listoEnviar: estadoDerivado?.listoEnviar || false,
      enviadoTaller: estadoDerivado?.enviadoTaller || false,
      tipoTela: derivado?.tipoTela || "",
      colorBase: derivado?.colorBase || "",
      tipoHijo: derivado?.tipoHijo || "OTRO_MODELO",
      origenMaterial: derivado?.origenMaterial || "RETAZO",
      colorNuevo: Boolean(derivado?.colorNuevo),
    });
  });

  return items;
};

const crearCortesDisponibles = () => {
  const historial = obtenerListaGuardada(CLAVE_HISTORIAL_CORTES);
  const corteActual = obtenerDatoGuardado(CLAVE_CORTE_ACTUAL);
  const estadosHabilitado = leerHabilitadoTaller();
  const estadoHabilitadoPorCodigo = new Map(
    estadosHabilitado.map((item) => [
      item?.codigoOp || "",
      crearEstadoHabilitadoTaller(item),
    ])
  );
  const estadosGuardados = obtenerListaGuardada(CLAVE_SALIDAS_TALLER).map((registro) => ({
    ...registro,
    tipoRegistro:
      registro?.tipoRegistro ||
      (registro?.enviadoTaller ? "envio_taller" : "op_base"),
    totalesPorTalla: {
      ...crearTotalesPorTallaVacio(),
      ...(registro?.totalesPorTalla || {}),
    },
    tallasActivas: obtenerTallasActivas(
      registro?.tallasActivas || [],
      {
        ...crearTotalesPorTallaVacio(),
        ...(registro?.totalesPorTalla || {}),
      }
    ),
    totalUnidades: calcularTotalDesdeTotales({
      ...crearTotalesPorTallaVacio(),
      ...(registro?.totalesPorTalla || {}),
    }),
    detalleColorTalla: Array.isArray(registro?.detalleColorTalla)
      ? registro.detalleColorTalla
      : [],
  }));
  const estadosPorId = new Map(
    estadosGuardados
      .filter((registro) => registro?.tipoRegistro === "op_base")
      .map((registro) => [registro.id, registro])
  );
  const cortesBase = (
    historial.length > 0 ? historial : corteActual ? [corteActual] : []
  ).filter((corte) => corte?.estado === "confirmado");

  if (cortesBase.length > 0) {
    const items = cortesBase.flatMap((corte) =>
      construirItemsDesdeCorte(corte, Object.fromEntries(estadosPorId))
    );

    const mapaPorId = new Map();
    items.forEach((item) => {
      const estadoHabilitado = estadoHabilitadoPorCodigo.get(item?.codigoOp || "") || {};
      const totalesNormalizados = {
        ...crearTotalesPorTallaVacio(),
        ...(item?.totalesPorTalla || {}),
        ...((estadosPorId.get(item.id) || {})?.totalesPorTalla || {}),
      };
      mapaPorId.set(item.id, {
        ...item,
        ...(estadosPorId.get(item.id) || {}),
        elastico:
          (estadosPorId.get(item.id) || {})?.elastico ?? Boolean(estadoHabilitado?.elastico),
        poliamidas:
          (estadosPorId.get(item.id) || {})?.poliamidas ??
          Boolean(estadoHabilitado?.poliamidas),
        avios:
          (estadosPorId.get(item.id) || {})?.avios ?? Boolean(estadoHabilitado?.avios),
        listoEnviar:
          (estadosPorId.get(item.id) || {})?.listoEnviar ??
          Boolean(estadoHabilitado?.listoEnviar),
        tipoRegistro: "op_base",
        tallerReservado: (estadosPorId.get(item.id) || {})?.tallerReservado || "",
        fechaReservaTaller: (estadosPorId.get(item.id) || {})?.fechaReservaTaller || "",
        responsableReservaTaller:
          (estadosPorId.get(item.id) || {})?.responsableReservaTaller || "",
        totalesPorTalla: totalesNormalizados,
        tallasActivas: obtenerTallasActivas(
          (estadosPorId.get(item.id) || {})?.tallasActivas || item?.tallasActivas || [],
          totalesNormalizados
        ),
        totalUnidades: calcularTotalDesdeTotales(totalesNormalizados),
      });
    });

    const baseNormalizada = Array.from(mapaPorId.values());
    const enviosGuardados = estadosGuardados
      .filter((registro) => registro?.tipoRegistro === "envio_taller")
      .map((registro) => {
        const estadoHabilitado = estadoHabilitadoPorCodigo.get(registro?.codigoOp || "") || {};

        return {
          ...registro,
          elastico: Boolean(estadoHabilitado?.elastico ?? registro?.elastico),
          poliamidas: Boolean(estadoHabilitado?.poliamidas ?? registro?.poliamidas),
          avios: Boolean(estadoHabilitado?.avios ?? registro?.avios),
          listoEnviar: Boolean(estadoHabilitado?.listoEnviar ?? registro?.listoEnviar),
        };
      });

    return [...baseNormalizada, ...enviosGuardados];
  }

  return [
    {
      id: "110426-01",
      tipoRegistro: "op_base",
      codigoOp: "110426-01",
      tipoSalida: "PRINCIPAL",
      fechaCorte: "2026-04-11",
      pedidoOrigen: "PED110426-01",
      opOrigen: "110426-01",
      modeloBase: "SHORT PALAZO CHALIS",
      tallasActivas: [...TALLAS_DISPONIBLES],
      totalesPorTalla: { S: 9, M: 18, L: 24, XL: 6, XXL: 6 },
      totalUnidades: 63,
      detallesConfeccion: { BOLSILLOS: true, FRANJA: true, MULTIAGUJA: true, cantidadAgujas: "4" },
      elastico: false,
      poliamidas: false,
      avios: false,
      listoEnviar: false,
      enviadoTaller: false,
    },
  ];
};

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const leerRecepcionesTaller = () => obtenerListaGuardada(CLAVE_RECEPCIONES_TALLER);

const leerProcesosExternos = () =>
  normalizarHistorialTercerizaciones(
    obtenerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS)
  );

const obtenerRecepcionPorSalida = (salida = {}) => {
  const recepciones = leerRecepcionesTaller();
  const itemSalidaId = salida?.id || "";
  const codigoSalida = salida?.codigoSalida || "";
  const codigoOp = salida?.codigoOp || "";

  return (
    recepciones.find((registro) => {
      const cabecera = registro?.cabeceraRecepcion || {};
      return (
        (itemSalidaId && cabecera?.itemSalidaId === itemSalidaId) ||
        (codigoSalida && cabecera?.codigoSalida === codigoSalida) ||
        (!itemSalidaId && !codigoSalida && codigoOp && cabecera?.codigoOp === codigoOp)
      );
    }) || null
  );
};

const obtenerProcesoExternoPorSalida = (salida = {}) => {
  const procesos = leerProcesosExternos();
  const itemSalidaId = salida?.id || "";
  const codigoSalida = salida?.codigoSalida || "";
  const codigoOp = salida?.codigoOp || "";

  const exacto = procesos.find((proceso) => {
    const referencias = [
      proceso?.itemSalidaId || "",
      proceso?.codigoSalida || "",
    ].filter(Boolean);

    return (
      (itemSalidaId && referencias.includes(itemSalidaId)) ||
      (codigoSalida && referencias.includes(codigoSalida))
    );
  });

  if (exacto) {
    return exacto;
  }

  return (
    procesos.find(
      (proceso) =>
        proceso?.codigoOp === codigoOp &&
        String(proceso?.tallerPrincipal || "").trim().toUpperCase() ===
          String(salida?.nombreTaller || "").trim().toUpperCase()
    ) || null
  );
};

const obtenerEstadoRecepcionSeguimiento = (salida = {}) => {
  const recepcion = obtenerRecepcionPorSalida(salida);
  const cabecera = recepcion?.cabeceraRecepcion || {};

  if (cabecera?.tipoRecepcion === "final" && cabecera?.aprobadoCalidad) {
    return { texto: "Recepcion final", clase: "chip_estado_despacho_ok" };
  }

  if (cabecera?.tipoRecepcion === "final") {
    return { texto: "Recepcion final pendiente", clase: "chip_estado_despacho_pendiente" };
  }

  if (cabecera?.tipoRecepcion === "parcial") {
    return { texto: "Pendiente final", clase: "chip_estado_despacho_pendiente" };
  }

  return { texto: "En taller principal", clase: "chip_estado_despacho_pendiente" };
};

const obtenerEstadoTerceroSeguimiento = (salida = {}) => {
  const proceso = obtenerProcesoExternoPorSalida(salida);

  if (!salida?.servicioATerceros && !proceso) {
    return { texto: "Sin tercero", clase: "chip_estado_despacho_neutro" };
  }

  if (!proceso) {
    return { texto: "Listo para enviar", clase: "chip_estado_despacho_pendiente" };
  }

  if (proceso?.cancelado) {
    return { texto: "Cancelado", clase: "chip_estado_despacho_neutro" };
  }

  if (proceso?.fechaRetornoTercero) {
    return { texto: "Retornado", clase: "chip_estado_despacho_ok" };
  }

  if (proceso?.fechaEnvioTercero) {
    return { texto: "En tercero", clase: "chip_estado_despacho_alerta" };
  }

  if (proceso?.fechaRecepcionAlmacen) {
    return { texto: "Listo para enviar", clase: "chip_estado_despacho_pendiente" };
  }

  return { texto: "Pendiente tercero", clase: "chip_estado_despacho_pendiente" };
};

const obtenerUbicacionSeguimiento = (salida = {}) => {
  const recepcion = obtenerRecepcionPorSalida(salida);
  const cabecera = recepcion?.cabeceraRecepcion || {};
  const proceso = obtenerProcesoExternoPorSalida(salida);

  if (proceso?.fechaRetornoTercero && proceso?.reingresoTallerPrincipal) {
    return "Retorno del tercero / taller principal";
  }

  if (proceso?.fechaRetornoTercero) {
    return "Retornado desde tercero";
  }

  if (proceso?.fechaEnvioTercero) {
    return `Tercero: ${proceso?.tallerTercero || "-"}`;
  }

  if (cabecera?.tipoRecepcion === "final") {
    return "Almacen / cierre final";
  }

  if (cabecera?.tipoRecepcion === "parcial") {
    return "Almacen / pendiente final";
  }

  return salida?.nombreTaller || "Taller principal";
};

const construirDetalleHistorialSalida = (salida = {}) => {
  if (Array.isArray(salida?.detalleColorTalla) && salida.detalleColorTalla.length > 0) {
    return salida.detalleColorTalla
      .map((detalle, indice) => {
        const salidas = {
          ...crearTotalesPorTallaVacio(),
          ...(detalle?.salidas || {}),
        };
        const total = TALLAS_DISPONIBLES.reduce(
          (acumulado, talla) => acumulado + convertirNumero(salidas?.[talla]),
          0
        );

        return {
          id: detalle?.id || `detalle-historial-${indice + 1}`,
          colorBase: detalle?.colorBase || "VARIOS",
          salidas,
          total,
        };
      })
      .filter((detalle) => detalle.total > 0);
  }

  const salidas = {
    ...crearTotalesPorTallaVacio(),
    ...(salida?.totalesPorTalla || {}),
  };
  const total = TALLAS_DISPONIBLES.reduce(
    (acumulado, talla) => acumulado + convertirNumero(salidas?.[talla]),
    0
  );

  return total > 0
    ? [
        {
          id: `${salida?.id || salida?.codigoSalida || salida?.codigoOp || "salida"}-resumen`,
          colorBase: salida?.colorBase || "VARIOS",
          salidas,
          total,
        },
      ]
    : [];
};

const obtenerTallasHistorialActivas = (detalleHistorial = []) =>
  TALLAS_DISPONIBLES.filter((talla) =>
    (Array.isArray(detalleHistorial) ? detalleHistorial : []).some(
      (detalle) => convertirNumero(detalle?.salidas?.[talla]) > 0
    )
  );

export function SalidasTaller() {
  const { user } = UserAuth();
  const responsableActivo = useMemo(
    () => obtenerNombreResponsableActivo(user),
    [user]
  );
  const [catalogosProduccion, setCatalogosProduccion] = useState(() =>
    leerCatalogosProduccion()
  );
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [pestanaVista, setPestanaVista] = useState("operacion");
  const [historialSeleccionado, setHistorialSeleccionado] = useState(null);
  const [cabeceraSalida, setCabeceraSalida] = useState(crearCabeceraSalidaVacia);
  const [cortesDisponibles, setCortesDisponibles] = useState(crearCortesDisponibles);
  const [costosTaller, setCostosTaller] = useState(() => leerCostosTallerModelo());
  const [configSalidaTaller, setConfigSalidaTaller] = useState(null);
  const [configTercerizacion, setConfigTercerizacion] = useState(null);

  useEffect(() => {
    if (!responsableActivo) return;

    setCabeceraSalida((anterior) =>
      anterior?.responsableEnvio?.trim()
        ? anterior
        : {
            ...anterior,
            responsableEnvio: responsableActivo,
          }
    );
  }, [responsableActivo]);

  useEffect(() => {
    const cabeceraVacia = crearCabeceraSalidaVacia();
    setCabeceraSalida(cabeceraVacia);
    localStorage.setItem(
      CLAVE_CABECERA_SALIDA_TALLER,
      JSON.stringify(cabeceraVacia)
    );

    const sincronizar = async () => {
      try {
        const [cfgSalida, cfgTercero] = await Promise.all([
          leerCorrelativoSistemaConfiguracion("SALIDA_TALLER"),
          leerCorrelativoSistemaConfiguracion("TERCERIZACION"),
          listarTalleresConfiguracion(),
          listarCostosTallerConfiguracion(),
          sincronizarTallerStockDesdeSupabase(),
        ]);
        setConfigSalidaTaller(cfgSalida);
        setConfigTercerizacion(cfgTercero);
        setCatalogosProduccion(leerCatalogosProduccion());
        normalizarCodigosSalidaTallerGlobales(cfgSalida?.prefijo || "ST");
        setCostosTaller(leerCostosTallerModelo());
        setCortesDisponibles(crearCortesDisponibles());
      } catch (error) {
        console.error("No se pudo sincronizar salidas de taller:", error);
      }
    };

    sincronizar();
  }, []);

  const resolverCostoAutomatico = ({
    modelo = "",
    nombreTaller = "",
  } = {}) => {
    const encontrado = obtenerCostoTallerPorModelo({
      modelo,
      nombreTaller,
      lista: costosTaller,
    });

    return encontrado ? String(Number(encontrado.costoUnitario || 0)) : "0";
  };

  const obtenerCostoConfiguradoActual = ({
    modelo = "",
    nombreTaller = "",
  } = {}) =>
    obtenerCostoTallerPorModelo({
      modelo,
      nombreTaller,
      lista: costosTaller,
    });

  const totalEnSoles =
    convertirNumero(cabeceraSalida.costoProduccion) *
    convertirNumero(cabeceraSalida.cantidadTotal);
  const totalTallerPrincipal = totalEnSoles;
  const totalPagarTaller = totalTallerPrincipal;

  const detallesConfeccionTaller = useMemo(
    () => catalogosProduccion.detallesConfeccion || [],
    [catalogosProduccion]
  );
  const detallesSeleccionados = useMemo(
    () =>
      obtenerDetallesActivos(
        cabeceraSalida.detallesConfeccion || {},
        detallesConfeccionTaller
      ),
    [cabeceraSalida.detallesConfeccion, detallesConfeccionTaller]
  );
  const productosDerivadosResumen = useMemo(
    () =>
      (cabeceraSalida.productosDerivados || []).filter(
        (item) =>
          item?.modeloBase ||
          item?.tipoTela ||
          item?.colorBase ||
          TALLAS_DISPONIBLES.some(
            (talla) =>
              convertirNumero(item?.salidas?.[talla]) > 0 ||
              (item?.detalleColorTalla || []).some(
                (detalle) => convertirNumero(detalle?.salidas?.[talla]) > 0
              )
          )
      ),
    [cabeceraSalida.productosDerivados]
  );
  const productoPrincipalResumen = useMemo(() => {
    if (!cabeceraSalida.codigoOp || cabeceraSalida.productoDerivado) {
      return [];
    }

    if (
      Array.isArray(cabeceraSalida.detalleColorTalla) &&
      cabeceraSalida.detalleColorTalla.length > 0
    ) {
      return cabeceraSalida.detalleColorTalla
        .map((detalle, indice) => ({
          id: detalle?.id || `principal-detalle-${indice + 1}`,
          colorBase: detalle?.colorBase || cabeceraSalida.colorBase || "VARIOS",
          salidas: {
            ...crearTotalesPorTallaVacio(),
            ...(detalle?.salidas || {}),
          },
        }))
        .filter((detalle) =>
          TALLAS_DISPONIBLES.some(
            (talla) => convertirNumero(detalle?.salidas?.[talla]) > 0
          )
        );
    }

    const tieneTotales = TALLAS_DISPONIBLES.some(
      (talla) => convertirNumero(cabeceraSalida.totalesPorTalla?.[talla]) > 0
    );

    if (!tieneTotales) {
      return [];
    }

    return [
      {
        id: `${cabeceraSalida.codigoOp}-principal`,
        colorBase: cabeceraSalida.colorBase || "VARIOS",
        salidas: {
          ...crearTotalesPorTallaVacio(),
          ...(cabeceraSalida.totalesPorTalla || {}),
        },
      },
    ];
  }, [
    cabeceraSalida.codigoOp,
    cabeceraSalida.productoDerivado,
    cabeceraSalida.detalleColorTalla,
    cabeceraSalida.colorBase,
    cabeceraSalida.totalesPorTalla,
  ]);

  const cortesFiltrados = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();
    const cortesPendientes = cortesDisponibles.filter(
      (corte) =>
        corte.tipoRegistro === "op_base" && convertirNumero(corte.totalUnidades) > 0
    );

    if (!textoBusqueda) {
      return cortesPendientes;
    }

    return cortesPendientes.filter((corte) =>
      [corte.tipoSalida, corte.codigoOp, corte.pedidoOrigen, corte.opOrigen, corte.modeloBase]
        .join(" ")
        .toLowerCase()
        .includes(textoBusqueda)
    );
  }, [busqueda, cortesDisponibles]);

  const cortesEnviados = useMemo(
    () => cortesDisponibles.filter((corte) => corte.tipoRegistro === "envio_taller"),
    [cortesDisponibles]
  );
  const cortesEnProcesoEnvio = useMemo(
    () =>
      cortesEnviados.filter((corte) => {
        const recepcion = obtenerRecepcionPorSalida(corte);
        const cabecera = recepcion?.cabeceraRecepcion || {};
        return cabecera?.tipoRecepcion !== "final";
      }),
    [cortesEnviados]
  );

  const totalPaginas = Math.max(1, Math.ceil(cortesFiltrados.length / FILAS_POR_PAGINA));

  const cortesPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return cortesFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [cortesFiltrados, paginaActual]);

  const manejarGuardar = async () => {
    localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(cortesDisponibles));
    localStorage.setItem(CLAVE_CABECERA_SALIDA_TALLER, JSON.stringify(cabeceraSalida));
    await sincronizarTallerStockDesdeLocalASupabase();
    await sincronizarTallerStockDesdeSupabase();
    setCortesDisponibles(crearCortesDisponibles());
    mostrarNotificacionCarga("Cambios guardados en salidas a taller.");
  };

  const manejarCambioCabecera = (evento) => {
    const { name, value, type, checked } = evento.target;
    setCabeceraSalida((anterior) => {
      const siguiente = {
        ...anterior,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "nombreTaller") {
        const costoConfigurado = resolverCostoAutomatico({
          modelo: anterior?.modelo || "",
          nombreTaller: value,
        });

        siguiente.costoProduccion = costoConfigurado;
      }

      return siguiente;
    });
  };

  const manejarAsignarTaller = async () => {
    if (!cabeceraSalida.itemSalidaId) {
      mostrarAlertaSistema("Selecciona primero una OP para asignarle un taller.");
      return;
    }

    if (!cabeceraSalida.nombreTaller) {
      mostrarAlertaSistema("Selecciona el taller que quedara reservado para esta OP.");
      return;
    }

    const confirmarReserva = await confirmarAccionSistema(
      `Seguro que deseas reservar esta OP para el taller seleccionado?\n\nOP: ${
        cabeceraSalida.codigoOp || "-"
      }\nTaller reservado: ${cabeceraSalida.nombreTaller || "-"}\n\nTodavia no se genera la salida. Solo quedara marcada como asignada para que el taller la vea.`
    );

    if (!confirmarReserva) {
      return;
    }

    const fechaReserva = obtenerFechaActual();
    const responsableReserva =
      cabeceraSalida.responsableEnvio || responsableActivo || "";
    const cortesActualizados = cortesDisponibles.map((corte) =>
      corte.id === cabeceraSalida.itemSalidaId && corte.tipoRegistro === "op_base"
        ? {
            ...corte,
            nombreTaller: cabeceraSalida.nombreTaller,
            tallerReservado: cabeceraSalida.nombreTaller,
            fechaReservaTaller: fechaReserva,
            responsableReservaTaller: responsableReserva,
          }
        : corte
    );

    const cabeceraActualizada = {
      ...cabeceraSalida,
      tallerReservado: cabeceraSalida.nombreTaller,
      fechaReservaTaller: fechaReserva,
      responsableReservaTaller: responsableReserva,
    };

    setCortesDisponibles(cortesActualizados);
    setCabeceraSalida(cabeceraActualizada);
    localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(cortesActualizados));
    localStorage.setItem(
      CLAVE_CABECERA_SALIDA_TALLER,
      JSON.stringify(cabeceraActualizada)
    );
    await sincronizarTallerStockDesdeLocalASupabase();
    await sincronizarTallerStockDesdeSupabase();
    setCortesDisponibles(crearCortesDisponibles());
    mostrarNotificacionCarga(
      "Taller reservado correctamente. El taller ya vera esta OP como asignada por recoger."
    );
  };

  const manejarSeleccionTallaEnvio = (talla) => {
    setCabeceraSalida((anterior) => {
      const siguienteSeleccion = anterior.tallasSeleccionadasEnvio.includes(talla)
        ? anterior.tallasSeleccionadasEnvio.filter((item) => item !== talla)
        : [...anterior.tallasSeleccionadasEnvio, talla];

      const cantidadTotal = siguienteSeleccion.reduce(
        (total, tallaActual) =>
          total + convertirNumero(anterior.totalesPorTalla?.[tallaActual]),
        0
      );

      return {
        ...anterior,
        tallasSeleccionadasEnvio: siguienteSeleccion,
        cantidadTotal,
      };
    });
  };

  const manejarModoDivisionTallas = (dividirPorTallas) => {
    setCabeceraSalida((anterior) => ({
      ...anterior,
      dividirPorTallas,
      tallasSeleccionadasEnvio: dividirPorTallas ? anterior.tallasSeleccionadasEnvio : [],
      cantidadTotal: dividirPorTallas
        ? anterior.tallasSeleccionadasEnvio.reduce(
            (total, talla) => total + convertirNumero(anterior.totalesPorTalla?.[talla]),
            0
          )
        : anterior.tallasActivas.reduce(
            (total, talla) => total + convertirNumero(anterior.totalesPorTalla?.[talla]),
            0
          ),
    }));
  };

  const manejarEnvioTaller = async () => {
    if (!cabeceraSalida.nombreTaller || !cabeceraSalida.itemSalidaId) {
      mostrarAlertaSistema("Completa el nombre del taller y selecciona un item antes de enviar.");
      return;
    }

    if (
      cabeceraSalida.dividirPorTallas &&
      (cabeceraSalida.tallasSeleccionadasEnvio || []).length === 0
    ) {
      mostrarAlertaSistema("Selecciona al menos una talla para este envio.");
      return;
    }

    const envioExistente = cortesDisponibles.find(
      (corte) => corte.id === cabeceraSalida.itemSalidaId && corte.tipoRegistro === "envio_taller"
    );
    const confirmarEnvio = await confirmarAccionSistema(
      envioExistente
        ? `Seguro que deseas actualizar esta salida?\n\nOP: ${cabeceraSalida.codigoOp || "-"}\nTaller: ${cabeceraSalida.nombreTaller || "-"}\n\nSe actualizara lo que ve Almacen, Recepcion y Taller.`
        : `Seguro que deseas enviar esta OP a taller?\n\nOP: ${cabeceraSalida.codigoOp || "-"}\nTaller: ${cabeceraSalida.nombreTaller || "-"}\nTotal a pagar: ${formatearMontoSoles(totalPagarTaller)}\n\nEl registro quedara disponible para recepcion y seguimiento.`
    );

    if (!confirmarEnvio) {
      return;
    }

    mostrarProcesoSistema(
      envioExistente
        ? "Actualizando salida a taller..."
        : "Registrando salida a taller..."
    );

    try {
      let costoGuardadoAutomatico = false;
      let costoActualizadoConfiguracion = false;
      const costoExistente = obtenerCostoConfiguradoActual({
        modelo: cabeceraSalida.modelo || "",
        nombreTaller: cabeceraSalida.nombreTaller || "",
      });
      const costoFormulario = convertirNumero(cabeceraSalida.costoProduccion);
      const costoExistenteValor = convertirNumero(costoExistente?.costoUnitario || 0);

      if (
        !costoExistente &&
        costoFormulario > 0 &&
        cabeceraSalida.modelo?.trim()
      ) {
        try {
          const modelosCatalogo = await listarModelosProductoConfiguracion();
          const modeloCoincidente = (modelosCatalogo || []).find(
            (item) =>
              (item?.nombreModelo || "").toString().trim().toUpperCase() ===
              (cabeceraSalida.modelo || "").toString().trim().toUpperCase()
          );

          await guardarCostoTallerConfiguracion({
            modelo: cabeceraSalida.modelo || "",
            codigoModelo: modeloCoincidente?.codigoModelo || cabeceraSalida.modelo || "",
            nombreTaller: cabeceraSalida.nombreTaller || "",
            costoUnitario: costoFormulario,
            moneda: "PEN",
            observacion: "Registrado automaticamente desde salida a taller.",
            estado: "ACTIVO",
          });
          setCostosTaller(leerCostosTallerModelo());
          costoGuardadoAutomatico = true;
        } catch (error) {
          console.error(
            "No se pudo guardar automaticamente el costo del taller:",
            error.message,
          );
        }
      }

      if (
        costoExistente &&
        costoFormulario > 0 &&
        costoFormulario !== costoExistenteValor &&
        cabeceraSalida.modelo?.trim()
      ) {
        try {
          const modelosCatalogo = await listarModelosProductoConfiguracion();
          const modeloCoincidente = (modelosCatalogo || []).find(
            (item) =>
              (item?.nombreModelo || "").toString().trim().toUpperCase() ===
              (cabeceraSalida.modelo || "").toString().trim().toUpperCase()
          );

          await guardarCostoTallerConfiguracion({
            modelo: cabeceraSalida.modelo || "",
            codigoModelo:
              costoExistente?.codigoModelo ||
              modeloCoincidente?.codigoModelo ||
              cabeceraSalida.modelo ||
              "",
            nombreTaller: cabeceraSalida.nombreTaller || "",
            costoUnitario: costoFormulario,
            moneda: costoExistente?.moneda || "PEN",
            observacion:
              costoExistente?.observacion ||
              "Actualizado automaticamente desde salida a taller.",
            estado: costoExistente?.estado || "ACTIVO",
          });
          setCostosTaller(leerCostosTallerModelo());
          costoActualizadoConfiguracion = true;
        } catch (error) {
          console.error(
            "No se pudo actualizar automaticamente el costo del taller:",
            error.message,
          );
        }
      }

      const prefijoSalida = configSalidaTaller?.prefijo || "ST";
      const { correlativo: correlativoSalida } =
        await calcularSiguienteCorrelativoSistemaConfiguracion({
          clave: "SALIDA_TALLER",
          fecha: cabeceraSalida.fechaEnvio || obtenerFechaActual(),
          codigos: cortesDisponibles
            .filter((registro) => registro?.tipoRegistro === "envio_taller")
            .map((registro) => ({
              codigo: registro?.codigoSalida || "",
              fecha: registro?.fechaEnvio || registro?.fechaEntrega || "",
            })),
        });
      const codigoSalida = crearCodigoSalida(
        cabeceraSalida.codigoOp,
        correlativoSalida,
        prefijoSalida,
      );
      const tallasEnvio = cabeceraSalida.dividirPorTallas
        ? cabeceraSalida.tallasSeleccionadasEnvio || []
        : cabeceraSalida.tallasActivas || [];
      const totalesEnvio = TALLAS_DISPONIBLES.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: tallasEnvio.includes(talla)
            ? convertirNumero(cabeceraSalida.totalesPorTalla?.[talla])
            : 0,
        }),
        crearTotalesPorTallaVacio()
      );
      const totalUnidadesEnvio = tallasEnvio.reduce(
        (total, talla) => total + convertirNumero(totalesEnvio[talla]),
        0
      );
      const detalleColorTallaEnvio = filtrarDetalleColorTallaPorTallas(
        cabeceraSalida.detalleColorTalla || [],
        tallasEnvio
      );
      const detalleEnvio = construirDetalleEnvioPorTallas(
        detalleColorTallaEnvio,
        tallasEnvio
      );

      if (envioExistente) {
        const envioActualizado = {
          ...envioExistente,
          codigoOp: cabeceraSalida.codigoOp,
          tipoSalida: cabeceraSalida.tipoSalida,
          modeloBase: cabeceraSalida.modelo,
          modelo: cabeceraSalida.modelo,
          nombreTaller: cabeceraSalida.nombreTaller,
          fechaEnvio: cabeceraSalida.fechaEnvio,
          fechaEntrega: cabeceraSalida.fechaEntrega,
          responsableEnvio: cabeceraSalida.responsableEnvio,
          observacionesGenerales: cabeceraSalida.observacionesGenerales,
          costoProduccion: cabeceraSalida.costoProduccion,
          totalEnSoles,
          totalTallerPrincipal,
          totalPagarTaller,
          cantidadTotal: totalUnidadesEnvio,
          totalUnidades: totalUnidadesEnvio,
          tallasActivas: tallasEnvio,
          totalesPorTalla: totalesEnvio,
          detalleColorTalla: detalleColorTallaEnvio,
          detalleEnvio,
          detallesConfeccion: cabeceraSalida.detallesConfeccion || {},
          productosDerivados: cabeceraSalida.productosDerivados || [],
          elastico: Boolean(cabeceraSalida.elastico),
          poliamidas: Boolean(cabeceraSalida.poliamidas),
          avios: Boolean(cabeceraSalida.avios),
          listoEnviar: Boolean(cabeceraSalida.listoEnviar),
          servicioATerceros: Boolean(cabeceraSalida.servicioATerceros),
          tipoProcesoTercero: cabeceraSalida.tipoProcesoTercero || "MULTIAGUJA",
          tallerTercero: cabeceraSalida.tallerTercero || "",
          observacionTercero: cabeceraSalida.observacionTercero || "",
          enviadoTaller: true,
        };
        const cortesActualizados = cortesDisponibles.map((corte) =>
          corte.id === envioActualizado.id ? envioActualizado : corte
        );

        setCortesDisponibles(cortesActualizados);
        localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(cortesActualizados));
        localStorage.setItem(CLAVE_CABECERA_SALIDA_TALLER, JSON.stringify(envioActualizado));
        if (envioActualizado.servicioATerceros) {
          const historialTercerizaciones = obtenerListaGuardada(CLAVE_TERCERIZACIONES);
          const identificadorSalidaTercero =
            envioActualizado.id ||
            envioActualizado.codigoSalida ||
            envioActualizado.itemSalidaId ||
            "";
          const existente = historialTercerizaciones.find(
            (item) =>
              item?.codigoOp === envioActualizado.codigoOp &&
              ((item?.itemSalidaId || "") === identificadorSalidaTercero ||
                (item?.codigoTercerizacion || "") === (envioActualizado.codigoTercerizacion || "")) &&
              item?.proceso === (envioActualizado.tipoProcesoTercero || "MULTIAGUJA")
          );
          const registroTercero = {
            id: existente?.id || `ter-auto-${Date.now()}`,
            itemSalidaId:
              existente?.itemSalidaId ||
              identificadorSalidaTercero ||
              "",
            codigoTercerizacion: existente?.codigoTercerizacion ||
              generarCodigoTercerizacion(
                envioActualizado.codigoOp,
                historialTercerizaciones,
                "",
                configTercerizacion?.prefijo || "T",
              ),
            codigoOp: envioActualizado.codigoOp,
            modelo: envioActualizado.modelo,
            proceso: envioActualizado.tipoProcesoTercero || "MULTIAGUJA",
            cantidadAgujas:
              envioActualizado.tipoProcesoTercero === "MULTIAGUJA"
                ? envioActualizado.detallesConfeccion?.cantidadAgujas || ""
                : "",
            tallerTercero: envioActualizado.tallerTercero || "",
            cantidad: envioActualizado.cantidadTotal,
            origen: "DESDE RECEPCION ALMACEN",
            fechaSolicitud: envioActualizado.fechaEnvio || obtenerFechaActual(),
            fechaRecepcionAlmacen: "",
            fechaEnvioTercero: "",
            fechaRetornoTercero: "",
            costoUnitario: existente?.costoUnitario || "",
            total: existente?.total || 0,
            observacionProduccion:
              envioActualizado.observacionTercero ||
              existente?.observacionProduccion ||
              "Servicio marcado desde salida de taller.",
            observacionAlmacen: existente?.observacionAlmacen || "",
            aprobadoProduccion: existente?.aprobadoProduccion || false,
          };
          localStorage.setItem(
            CLAVE_TERCERIZACIONES,
            JSON.stringify(normalizarHistorialTercerizaciones([
              registroTercero,
              ...historialTercerizaciones.filter((item) => item?.id !== registroTercero.id),
            ]))
          );
          await registrarUsoCorrelativoSistemaConfiguracion({
            clave: "TERCERIZACION",
            fecha: registroTercero.fechaSolicitud || obtenerFechaActual(),
            correlativo: Number(
              registroTercero.codigoTercerizacion.match(/(\d+)$/)?.[1] || "0"
            ),
          });
        }
        setCabeceraSalida(envioActualizado);
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setCortesDisponibles(crearCortesDisponibles());
        cerrarProcesoSistema();
        mostrarNotificacionCarga(
          costoActualizadoConfiguracion
            ? "Salida actualizada y costo actualizado en Costos y Finanzas."
            : costoGuardadoAutomatico
            ? "Salida actualizada y costo guardado en Costos y Finanzas."
            : "Salida a taller actualizada correctamente."
        );
        return;
      }

      const nuevoEnvio = {
        id: codigoSalida,
        tipoRegistro: "envio_taller",
        parentItemId: cabeceraSalida.itemSalidaId,
        codigoSalida,
        codigoOp: cabeceraSalida.codigoOp,
        tipoSalida: cabeceraSalida.tipoSalida,
        modeloBase: cabeceraSalida.modelo,
        modelo: cabeceraSalida.modelo,
        pedidoOrigen: "",
        nombreTaller: cabeceraSalida.nombreTaller,
        fechaEnvio: cabeceraSalida.fechaEnvio,
        fechaEntrega: cabeceraSalida.fechaEntrega,
        responsableEnvio: cabeceraSalida.responsableEnvio,
        observacionesGenerales: cabeceraSalida.observacionesGenerales,
        costoProduccion: cabeceraSalida.costoProduccion,
        totalEnSoles,
        totalTallerPrincipal,
        totalPagarTaller,
        cantidadTotal: totalUnidadesEnvio,
        totalUnidades: totalUnidadesEnvio,
        tallasActivas: tallasEnvio,
        totalesPorTalla: totalesEnvio,
        detalleColorTalla: detalleColorTallaEnvio,
        detalleEnvio,
        detallesConfeccion: cabeceraSalida.detallesConfeccion || {},
        productosDerivados: cabeceraSalida.productosDerivados || [],
        elastico: Boolean(cabeceraSalida.elastico),
        poliamidas: Boolean(cabeceraSalida.poliamidas),
        avios: Boolean(cabeceraSalida.avios),
        listoEnviar: Boolean(cabeceraSalida.listoEnviar),
        servicioATerceros: Boolean(cabeceraSalida.servicioATerceros),
        tipoProcesoTercero: cabeceraSalida.tipoProcesoTercero || "MULTIAGUJA",
        tallerTercero: cabeceraSalida.tallerTercero || "",
        observacionTercero: cabeceraSalida.observacionTercero || "",
        enviadoTaller: true,
      };

      const cortesActualizados = [
        ...cortesDisponibles.map((corte) =>
          corte.id === cabeceraSalida.itemSalidaId
            ? {
                ...corte,
                totalesPorTalla: TALLAS_DISPONIBLES.reduce(
                  (acumulado, talla) => ({
                    ...acumulado,
                    [talla]: tallasEnvio.includes(talla)
                      ? 0
                      : convertirNumero(corte?.totalesPorTalla?.[talla]),
                  }),
                  crearTotalesPorTallaVacio()
                ),
                tallasActivas: obtenerTallasActivas(
                  TALLAS_DISPONIBLES.filter(
                    (talla) =>
                      !tallasEnvio.includes(talla) &&
                      convertirNumero(corte?.totalesPorTalla?.[talla]) > 0
                  )
                ),
                totalUnidades: TALLAS_DISPONIBLES.reduce(
                  (total, talla) =>
                    total +
                    (tallasEnvio.includes(talla)
                      ? 0
                      : convertirNumero(corte?.totalesPorTalla?.[talla])),
                  0
                ),
                detalleColorTalla: filtrarDetalleColorTallaPorTallas(
                  corte?.detalleColorTalla || [],
                  TALLAS_DISPONIBLES.filter(
                    (talla) =>
                      !tallasEnvio.includes(talla) &&
                      convertirNumero(corte?.totalesPorTalla?.[talla]) > 0
                  )
                ),
                listoEnviar: false,
                nombreTaller: "",
                tallerReservado: "",
                fechaReservaTaller: "",
                responsableReservaTaller: "",
              }
            : corte
        ),
        nuevoEnvio,
      ];

      setCortesDisponibles(cortesActualizados);
      localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(cortesActualizados));
      if (nuevoEnvio.servicioATerceros) {
        const historialTercerizaciones = obtenerListaGuardada(CLAVE_TERCERIZACIONES);
        const identificadorSalidaTercero =
          nuevoEnvio.id ||
          nuevoEnvio.codigoSalida ||
          nuevoEnvio.itemSalidaId ||
          "";
        const existente = historialTercerizaciones.find(
          (item) =>
            item?.codigoOp === nuevoEnvio.codigoOp &&
            (item?.itemSalidaId || "") === identificadorSalidaTercero &&
            item?.proceso === (nuevoEnvio.tipoProcesoTercero || "MULTIAGUJA")
        );
        const registroTercero = {
          id: existente?.id || `ter-auto-${Date.now()}`,
          itemSalidaId:
            existente?.itemSalidaId ||
            identificadorSalidaTercero ||
            "",
          codigoTercerizacion: generarCodigoTercerizacion(
            nuevoEnvio.codigoOp,
            historialTercerizaciones,
            "",
            configTercerizacion?.prefijo || "T"
          ),
          codigoOp: nuevoEnvio.codigoOp,
          modelo: nuevoEnvio.modelo,
          proceso: nuevoEnvio.tipoProcesoTercero || "MULTIAGUJA",
          cantidadAgujas:
            nuevoEnvio.tipoProcesoTercero === "MULTIAGUJA"
              ? nuevoEnvio.detallesConfeccion?.cantidadAgujas || ""
              : "",
          tallerTercero: nuevoEnvio.tallerTercero || "",
          cantidad: nuevoEnvio.cantidadTotal,
          origen: "DESDE RECEPCION ALMACEN",
          fechaSolicitud: nuevoEnvio.fechaEnvio || obtenerFechaActual(),
          fechaRecepcionAlmacen: "",
          fechaEnvioTercero: "",
          fechaRetornoTercero: "",
          costoUnitario: "",
          total: 0,
          observacionProduccion:
            nuevoEnvio.observacionTercero || "Servicio marcado desde salida de taller.",
          observacionAlmacen: "",
          aprobadoProduccion: false,
        };
        localStorage.setItem(
          CLAVE_TERCERIZACIONES,
          JSON.stringify(normalizarHistorialTercerizaciones([registroTercero, ...historialTercerizaciones]))
        );
        await registrarUsoCorrelativoSistemaConfiguracion({
          clave: "TERCERIZACION",
          fecha: registroTercero.fechaSolicitud || obtenerFechaActual(),
          correlativo: Number(
            registroTercero.codigoTercerizacion.match(/(\d+)$/)?.[1] || "0"
          ),
        });
      }
      localStorage.setItem(CLAVE_CABECERA_SALIDA_TALLER, JSON.stringify(cabeceraSalida));
      setCabeceraSalida(crearCabeceraSalidaVacia());
      await registrarUsoCorrelativoSistemaConfiguracion({
        clave: "SALIDA_TALLER",
        fecha: nuevoEnvio.fechaEnvio || new Date().toISOString().slice(0, 10),
        correlativo: Number((codigoSalida.match(/(\d+)$/)?.[1] || "0")),
      });
      await sincronizarTallerStockDesdeLocalASupabase();
      await sincronizarTallerStockDesdeSupabase();
      setCortesDisponibles(crearCortesDisponibles());
      cerrarProcesoSistema();
      mostrarNotificacionCarga(
        costoActualizadoConfiguracion
          ? "Salida registrada y costo actualizado en Costos y Finanzas."
          : costoGuardadoAutomatico
          ? "Salida registrada y costo guardado en Costos y Finanzas."
          : "Salida a taller registrada correctamente."
      );
    } catch (error) {
      cerrarProcesoSistema();
      console.error("No se pudo registrar la salida a taller:", error);
      mostrarErrorSistema(
        error?.message || "No se pudo completar la salida a taller."
      );
    }
  };

  const manejarCancelarEnvio = async (corteSeleccionado = null) => {
    const itemCancelar =
      corteSeleccionado ||
      cortesDisponibles.find((corte) => corte.id === cabeceraSalida.itemSalidaId);

    if (!itemCancelar?.id || itemCancelar?.tipoRegistro !== "envio_taller") {
      mostrarAlertaSistema("Selecciona primero una orden ya enviada para poder cancelarla.");
      return;
    }

    const recepcionesRegistradas = obtenerListaGuardada("cynara_recepciones_taller");
    const yaTieneRecepcion = recepcionesRegistradas.some(
      (registro) => registro?.cabeceraRecepcion?.itemSalidaId === itemCancelar.id
    );

    if (yaTieneRecepcion) {
      mostrarAlertaSistema(
        "Esta orden ya tiene una recepcion registrada. Para evitar inconsistencias, ya no se puede cancelar desde salidas a taller."
      );
      return;
    }

    const confirmarCancelacion = await confirmarAccionSistema(
      `Seguro que deseas cancelar este envio a taller?\n\nOP: ${itemCancelar.codigoOp || "-"}\nTaller: ${itemCancelar.nombreTaller || "-"}\n\nLa orden volvera a quedar disponible para enviarse de nuevo.`
    );

    if (!confirmarCancelacion) {
      return;
    }

    const envioCancelado = itemCancelar;
    const cortesActualizados = cortesDisponibles
      .map((corte) =>
        corte.id === envioCancelado.parentItemId
          ? {
              ...corte,
              totalesPorTalla: TALLAS_DISPONIBLES.reduce(
                (acumulado, talla) => ({
                  ...acumulado,
                  [talla]:
                    convertirNumero(corte?.totalesPorTalla?.[talla]) +
                    convertirNumero(envioCancelado?.totalesPorTalla?.[talla]),
                }),
                crearTotalesPorTallaVacio()
              ),
              tallasActivas: obtenerTallasActivas(
                TALLAS_DISPONIBLES.filter(
                  (talla) =>
                    convertirNumero(corte?.totalesPorTalla?.[talla]) +
                      convertirNumero(envioCancelado?.totalesPorTalla?.[talla]) >
                    0
                )
              ),
              totalUnidades:
                convertirNumero(corte?.totalUnidades) +
                convertirNumero(envioCancelado?.totalUnidades),
            }
          : corte
      )
      .filter((corte) => corte.id !== envioCancelado.id);

    setCortesDisponibles(cortesActualizados);
    localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(cortesActualizados));
    if (envioCancelado?.servicioATerceros) {
      const historialTercerizaciones = obtenerListaGuardada(CLAVE_TERCERIZACIONES);
      const historialFiltrado = historialTercerizaciones.filter((item) => {
        const coincide =
          item?.codigoOp === envioCancelado.codigoOp &&
          item?.origen === "DESDE RECEPCION ALMACEN" &&
          item?.proceso === (envioCancelado.tipoProcesoTercero || "MULTIAGUJA");

        const sinMovimiento =
          !item?.fechaRecepcionAlmacen &&
          !item?.fechaEnvioTercero &&
          !item?.fechaRetornoTercero &&
          !item?.aprobadoProduccion;

        return !(coincide && sinMovimiento);
      });

      localStorage.setItem(CLAVE_TERCERIZACIONES, JSON.stringify(historialFiltrado));
    }

    if (cabeceraSalida.itemSalidaId === itemCancelar.id) {
      const cabeceraVacia = crearCabeceraSalidaVacia();
      setCabeceraSalida(cabeceraVacia);
      localStorage.setItem(CLAVE_CABECERA_SALIDA_TALLER, JSON.stringify(cabeceraVacia));
    }

    await sincronizarTallerStockDesdeLocalASupabase();
    await sincronizarTallerStockDesdeSupabase();
    setCortesDisponibles(crearCortesDisponibles());
    mostrarNotificacionCarga("El envio fue cancelado y la orden volvio a quedar disponible.");
  };

  // Herramienta temporal de saneamiento durante pruebas.
  // Retirar o restringir antes de pasar a operacion real.
  const manejarReiniciarFlujoOp = async (corteSeleccionado = null) => {
    const itemObjetivo =
      corteSeleccionado ||
      cortesDisponibles.find((corte) => corte.id === cabeceraSalida.itemSalidaId);

    if (!itemObjetivo?.codigoOp) {
      mostrarAlertaSistema("Selecciona primero una OP para reiniciar su flujo.");
      return;
    }

    const codigoOpObjetivo = itemObjetivo.codigoOp;
    const tallerObjetivo = itemObjetivo.nombreTaller || cabeceraSalida.nombreTaller || "-";
    const confirmarReinicio = await confirmarAccionSistema(
      `Seguro que deseas reiniciar por completo esta OP?\n\nOP: ${codigoOpObjetivo}\nTaller: ${tallerObjetivo}\n\nSe borraran salidas, recepciones, procesos externos y registros operativos ligados para volver a empezar desde cero.`
    );

    if (!confirmarReinicio) {
      return;
    }

    mostrarProcesoSistema("Reiniciando flujo completo de la OP...");

    try {
      const recepcionesActuales = obtenerListaGuardada(CLAVE_RECEPCIONES_TALLER);
      const recepcionesObjetivo = recepcionesActuales.filter(
        (registro) => registro?.cabeceraRecepcion?.codigoOp === codigoOpObjetivo
      );
      const recepcionIdsObjetivo = recepcionesObjetivo
        .map((registro) => registro?.id || registro?.cabeceraRecepcion?.idRecepcion || "")
        .filter(Boolean);

      eliminarIngresosProductosTerminadosPorRecepciones({
        recepcionIds: recepcionIdsObjetivo,
      });

      const filtrarPorOp = (lista = [], extractor = (item) => item?.codigoOp) =>
        (Array.isArray(lista) ? lista : []).filter(
          (item) => extractor(item) !== codigoOpObjetivo
        );

      localStorage.setItem(
        CLAVE_SALIDAS_TALLER,
        JSON.stringify(
          filtrarPorOp(obtenerListaGuardada(CLAVE_SALIDAS_TALLER))
        )
      );
      localStorage.setItem(
        CLAVE_RECEPCIONES_TALLER,
        JSON.stringify(
          filtrarPorOp(
            recepcionesActuales,
            (item) => item?.cabeceraRecepcion?.codigoOp || ""
          )
        )
      );
      localStorage.setItem(
        CLAVE_SOLICITUDES_PROCESOS_EXTERNOS,
        JSON.stringify(
          filtrarPorOp(obtenerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS))
        )
      );
      localStorage.setItem(
        CLAVE_TERCERIZACIONES,
        JSON.stringify(
          filtrarPorOp(obtenerListaGuardada(CLAVE_TERCERIZACIONES))
        )
      );
      localStorage.setItem(
        CLAVE_DESCUENTOS_TALLER,
        JSON.stringify(
          filtrarPorOp(obtenerListaGuardada(CLAVE_DESCUENTOS_TALLER))
        )
      );
      localStorage.setItem(
        CLAVE_AJUSTES_RECEPCION_PRODUCCION,
        JSON.stringify(
          filtrarPorOp(obtenerListaGuardada(CLAVE_AJUSTES_RECEPCION_PRODUCCION))
        )
      );
      localStorage.setItem(
        CLAVE_ACONDICIONADO_PT,
        JSON.stringify(
          filtrarPorOp(obtenerListaGuardada(CLAVE_ACONDICIONADO_PT))
        )
      );
      localStorage.setItem(
        CLAVE_REMATES_PT,
        JSON.stringify(
          filtrarPorOp(obtenerListaGuardada(CLAVE_REMATES_PT))
        )
      );

      const cabeceraActual = {
        ...crearCabeceraSalidaVacia(),
        ...(obtenerDatoGuardado(CLAVE_CABECERA_SALIDA_TALLER) || {}),
      };
      if ((cabeceraActual?.codigoOp || "") === codigoOpObjetivo) {
        const cabeceraVacia = crearCabeceraSalidaVacia();
        setCabeceraSalida(cabeceraVacia);
        localStorage.setItem(CLAVE_CABECERA_SALIDA_TALLER, JSON.stringify(cabeceraVacia));
      }

      await sincronizarTallerStockDesdeLocalASupabase();
      await sincronizarTallerStockDesdeSupabase();
      setCortesDisponibles(crearCortesDisponibles());
      cerrarProcesoSistema();
      mostrarNotificacionCarga(
        "El flujo completo de la OP fue reiniciado. Ya puedes volver a enviarla desde cero."
      );
    } catch (error) {
      cerrarProcesoSistema();
      console.error("No se pudo reiniciar el flujo completo de la OP:", error);
      mostrarErrorSistema(
        error?.message || "No se pudo reiniciar completamente la OP."
      );
    }
  };

  const manejarSeleccionOp = (corte) => {
    const costoAutomatico = resolverCostoAutomatico({
      modelo: corte.modeloBase || "",
      nombreTaller: corte.nombreTaller || "",
    });
    setCabeceraSalida({
      ...crearCabeceraSalidaVacia(),
      itemSalidaId: corte.id || "",
      codigoSalida: corte.codigoSalida || "",
      tipoSalida: corte.tipoSalida || "",
      nombreTaller: corte.nombreTaller || "",
      tallerReservado: corte.tallerReservado || corte.nombreTaller || "",
      fechaReservaTaller: corte.fechaReservaTaller || "",
      responsableReservaTaller: corte.responsableReservaTaller || "",
      fechaEnvio: corte.fechaEnvio || "",
      codigoOp: corte.codigoOp || corte.opOrigen || "",
      modelo: corte.modeloBase || "",
      cantidadTotal: corte.totalUnidades || 0,
      tallasActivas: corte.tallasActivas || [],
      totalesPorTalla: {
        ...crearTotalesPorTallaVacio(),
        ...(corte.totalesPorTalla || {}),
      },
      colorBase: corte.colorBase || "",
      dividirPorTallas: corte.tipoRegistro === "envio_taller",
      tallasSeleccionadasEnvio:
        corte.tipoRegistro === "envio_taller" ? [...(corte.tallasActivas || [])] : [],
      detalleColorTalla: Array.isArray(corte.detalleColorTalla) ? corte.detalleColorTalla : [],
      costoProduccion: costoAutomatico || corte.costoProduccion || "0",
      fechaEntrega: corte.fechaEntrega || "",
      responsableEnvio: corte.responsableEnvio || responsableActivo || "",
      detallesConfeccion: corte.detallesConfeccion || {},
      productosDerivados: Array.isArray(corte.productosDerivados)
        ? corte.productosDerivados
        : [],
      elastico: Boolean(corte.elastico),
      poliamidas: Boolean(corte.poliamidas),
      avios: Boolean(corte.avios),
      listoEnviar: Boolean(corte.listoEnviar),
      servicioATerceros: Boolean(corte.servicioATerceros),
      tipoProcesoTercero: corte.tipoProcesoTercero || "MULTIAGUJA",
      tallerTercero: corte.tallerTercero || "",
      observacionTercero: corte.observacionTercero || "",
      observacionesGenerales: corte.observacionesGenerales || "",
    });
    mostrarNotificacionCarga(
      corte.tipoRegistro === "envio_taller"
        ? "Salida cargada correctamente."
        : "Orden cargada para salida a taller."
    );
  };

  const totalListos = cortesDisponibles.filter(
    (corte) =>
      corte.tipoRegistro === "op_base" &&
      corte.listoEnviar &&
      convertirNumero(corte.totalUnidades) > 0
  ).length;
  const resumenPendienteCabecera = formatearResumenTallas(
    cabeceraSalida.totalesPorTalla || {},
    cabeceraSalida.tallasActivas || []
  );
  const resumenSeleccionadoCabecera = formatearResumenTallas(
    cabeceraSalida.totalesPorTalla || {},
    cabeceraSalida.dividirPorTallas
      ? cabeceraSalida.tallasSeleccionadasEnvio || []
      : cabeceraSalida.tallasActivas || []
  );
  const salidaCargadaYaEnviada = cortesDisponibles.some(
    (corte) => corte.id === cabeceraSalida.itemSalidaId && corte.tipoRegistro === "envio_taller"
  );
  const detalleHistorialSeleccionado = useMemo(
    () => construirDetalleHistorialSalida(historialSeleccionado || {}),
    [historialSeleccionado]
  );
  const tallasHistorialSeleccionadas = useMemo(
    () => obtenerTallasHistorialActivas(detalleHistorialSeleccionado),
    [detalleHistorialSeleccionado]
  );
  const detallesHistorialSeleccionado = useMemo(
    () =>
      obtenerDetallesActivos(
        historialSeleccionado?.detallesConfeccion || {},
        detallesConfeccionTaller
      ),
    [historialSeleccionado, detallesConfeccionTaller]
  );

  const cambiarPestanaVista = (pestana) => {
    setPestanaVista(pestana);
    setHistorialSeleccionado(null);
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
          <h1>Salidas a taller</h1>
          <p>
            Aqui ves las ordenes de produccion listas para salir al taller principal.
            Si despues una parte vuelve a almacen y se terceriza, ese movimiento se
            registra recien desde recepcion parcial.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Cortes listos para enviar</span>
          <strong>{totalListos}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/produccion" className="boton_volver">
          Volver a Produccion
        </Link>

        <div className="navegacion_superior">
          <Link to="/produccion/cortes" className="btn btn_secundario btn_enlace">
            Atras
          </Link>
          <Link to="/produccion/recepciones" className="btn btn_principal btn_enlace">
            Siguiente
          </Link>
        </div>
      </div>

      <main className="contenido">
        {pestanaVista === "operacion" ? (
        <>
        <section className="tarjeta">
          <div className="pestanas pestanas_bloque">
            <button
              type="button"
              className={`pestana ${pestanaVista === "operacion" ? "pestana_activa" : ""}`}
              onClick={() => cambiarPestanaVista("operacion")}
            >
              Operacion
            </button>
            <button
              type="button"
              title="Historial y seguimiento"
              className={`pestana ${pestanaVista === "historial" ? "pestana_activa" : ""}`}
              onClick={() => cambiarPestanaVista("historial")}
            >
              Seguimiento
            </button>
          </div>
          <div className="tarjeta__encabezado">
            <div>
              <h2>Ordenes de produccion disponibles</h2>
            </div>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por codigo OP, pedido o modelo"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>OP</th>
                  <th>Salida</th>
                  <th>Modelo</th>
                  <th>Taller reservado</th>
                  <th>Tallas trabajando</th>
                  <th>Total unidades</th>
                  <th>Accion</th>
                </tr>
              </thead>

              <tbody>
                {cortesPaginados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="fila_vacia">
                      No hay cortes disponibles para ese filtro.
                    </td>
                  </tr>
                ) : (
                  cortesPaginados.map((corte) => (
                    <tr key={corte.id}>
                      <td>{corte.codigoOp || corte.opOrigen || "-"}</td>
                      <td>{corte.tipoSalida || "-"}</td>
                      <td>{corte.modeloBase}</td>
                      <td>{corte.tallerReservado || corte.nombreTaller || "-"}</td>
                      <td>
                        {formatearResumenTallas(
                          corte.totalesPorTalla || {},
                          corte.tallasActivas || TALLAS_DISPONIBLES
                        )}
                      </td>
                      <td>{corte.totalUnidades}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn_principal btn_tabla"
                          onClick={() => manejarSeleccionOp(corte)}
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {cortesFiltrados.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaActual((anterior) => Math.max(1, anterior - 1))}
                disabled={paginaActual === 1}
              >
                Anterior
              </button>

              <span>
                Pagina {paginaActual} de {totalPaginas}
              </span>

              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaActual((anterior) => Math.min(totalPaginas, anterior + 1))
                }
                disabled={paginaActual === totalPaginas}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Ordenes ya enviadas</h2>
              <p>
                Aqui puedes volver a cargar una orden enviada para revisarla o
                cancelar un envio hecho por error antes de su recepcion.
              </p>
            </div>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>OP</th>
                  <th>Salida</th>
                  <th>Modelo</th>
                  <th>Taller</th>
                  <th>Tallas enviadas</th>
                  <th>Estado habilitado</th>
                  <th>Estado recepcion</th>
                  <th>Estado tercero</th>
                  <th>Ubicacion actual</th>
                  <th>Fecha envio</th>
                  <th>Total unidades</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {cortesEnProcesoEnvio.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="fila_vacia">
                      No hay ordenes en proceso de armado en taller.
                    </td>
                  </tr>
                ) : (
                  cortesEnProcesoEnvio.map((corte) => {
                    const estadoRecepcion = obtenerEstadoRecepcionSeguimiento(corte);
                    const estadoTercero = obtenerEstadoTerceroSeguimiento(corte);
                    const ubicacionActual = obtenerUbicacionSeguimiento(corte);

                    return (
                      <tr key={`enviado-${corte.id}`}>
                        <td>{corte.codigoSalida || corte.codigoOp || "-"}</td>
                        <td>{corte.tipoSalida || "-"}</td>
                        <td>{corte.modeloBase || "-"}</td>
                        <td>{corte.nombreTaller || "-"}</td>
                        <td>
                          {formatearResumenTallas(
                            corte.totalesPorTalla || {},
                            corte.tallasActivas || TALLAS_DISPONIBLES
                          )}
                        </td>
                        <td>
                          <span
                            className={`chip_estado_despacho ${
                              corte.listoEnviar ? "chip_estado_despacho_ok" : "chip_estado_despacho_pendiente"
                            }`}
                          >
                            {corte.listoEnviar ? "Completo" : "Falta habilitar"}
                          </span>
                        </td>
                        <td>
                          <span className={`chip_estado_despacho ${estadoRecepcion.clase}`}>
                            {estadoRecepcion.texto}
                          </span>
                        </td>
                        <td>
                          <span className={`chip_estado_despacho ${estadoTercero.clase}`}>
                            {estadoTercero.texto}
                          </span>
                        </td>
                        <td>{ubicacionActual}</td>
                        <td>{corte.fechaEnvio || "-"}</td>
                        <td>{corte.totalUnidades || 0}</td>
                        <td className="acciones_tabla_inline">
                          <button
                            type="button"
                            className="btn btn_secundario btn_tabla"
                            onClick={() => manejarSeleccionOp(corte)}
                          >
                            Cargar
                          </button>
                          <button
                            type="button"
                            className="btn btn_secundario btn_tabla"
                            onClick={() => manejarCancelarEnvio(corte)}
                          >
                            Cancelar orden
                          </button>
                          <button
                            type="button"
                            className="btn btn_secundario btn_tabla"
                            onClick={() => manejarReiniciarFlujoOp(corte)}
                          >
                            Reiniciar OP
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tarjeta">
          <h2>Cabecera de salida a taller</h2>

          <div className="grid grid-2">
            <Campo className="campo_requerido">
              <label>Nombre del taller</label>
              <input
                type="text"
                list="catalogo-talleres-principales"
                name="nombreTaller"
                value={cabeceraSalida.nombreTaller}
                onChange={manejarCambioCabecera}
                placeholder=""
                autoComplete="off"
              />
              <datalist id="catalogo-talleres-principales">
                {catalogosProduccion.modelosNombreTaller.map((taller) => (
                  <option key={taller} value={taller} />
                ))}
              </datalist>
            </Campo>

            {cabeceraSalida.tallerReservado ? (
              <Campo>
                <label>Taller reservado</label>
                <input
                  type="text"
                  value={`${cabeceraSalida.tallerReservado}${
                    cabeceraSalida.fechaReservaTaller
                      ? ` | reservado el ${cabeceraSalida.fechaReservaTaller}`
                      : ""
                  }`}
                  readOnly
                />
              </Campo>
            ) : null}

            <Campo className="campo_requerido">
              <label>Fecha de envio</label>
              <input
                type="date"
                name="fechaEnvio"
                value={cabeceraSalida.fechaEnvio}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Tipo de salida</label>
              <input type="text" name="tipoSalida" value={cabeceraSalida.tipoSalida} readOnly />
            </Campo>

            <Campo className="campo_requerido">
              <label>Orden de produccion</label>
              <input type="text" name="codigoOp" value={cabeceraSalida.codigoOp} readOnly />
            </Campo>

            <Campo>
              <label>Codigo de salida</label>
              <input type="text" name="codigoSalida" value={cabeceraSalida.codigoSalida || "Se genera al enviar"} readOnly />
            </Campo>

            <Campo>
              <label>Modelo</label>
              <input type="text" name="modelo" value={cabeceraSalida.modelo} readOnly />
            </Campo>

            <Campo>
              <label>Referencia visual</label>
              <div className="campo_accion_visual">
                <VisorFotosModelo
                  modeloBase={cabeceraSalida.modelo || ""}
                  titulo="Fotos del modelo en salida a taller"
                />
              </div>
            </Campo>

            <Campo>
              <label>Cantidad total de unidades</label>
              <input
                type="number"
                name="cantidadTotal"
                value={cabeceraSalida.cantidadTotal}
                readOnly
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Costo de produccion (S/)</label>
              <input
                type="number"
                name="costoProduccion"
                value={cabeceraSalida.costoProduccion}
                onChange={manejarCambioCabecera}
                step="0.01"
                placeholder=""
              />
            </Campo>

            <Campo>
              <label>Total en soles</label>
              <input type="text" value={formatearMontoSoles(totalEnSoles)} readOnly />
            </Campo>

            <Campo className="campo_requerido">
              <label>Fecha de entrega</label>
              <input
                type="date"
                name="fechaEntrega"
                value={cabeceraSalida.fechaEntrega}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo>
              <label>Servicio a terceros</label>
              <div className="grupo_detalles">
                <CheckTalla>
                  <input
                    type="checkbox"
                    name="servicioATerceros"
                    checked={cabeceraSalida.servicioATerceros}
                    onChange={manejarCambioCabecera}
                  />
                  <span>Esta OP regresara a almacen para tercero</span>
                </CheckTalla>
              </div>
            </Campo>

            {cabeceraSalida.servicioATerceros ? (
              <>
                <Campo>
                  <label>Proceso tercero</label>
                  <select
                    name="tipoProcesoTercero"
                    value={cabeceraSalida.tipoProcesoTercero}
                    onChange={manejarCambioCabecera}
                  >
                    {TIPOS_PROCESO_EXTERNO.map((proceso) => (
                      <option key={proceso} value={proceso}>
                        {proceso}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo>
                  <label>Taller tercero</label>
                  <input
                    type="text"
                    list="catalogo-talleres-tercero"
                    name="tallerTercero"
                    value={cabeceraSalida.tallerTercero}
                    onChange={manejarCambioCabecera}
                    placeholder=""
                    autoComplete="off"
                  />
                  <datalist id="catalogo-talleres-tercero">
                    {(catalogosProduccion.modelosNombreTaller || []).map((taller) => (
                      <option key={taller} value={taller} />
                    ))}
                  </datalist>
                </Campo>
              </>
            ) : null}

            <Campo>
              <label>Responsable que envia</label>
              <input
                type="text"
                list="catalogo-personal-envio"
                name="responsableEnvio"
                value={cabeceraSalida.responsableEnvio}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
              <datalist id="catalogo-personal-envio">
                {catalogosProduccion.personal.map((persona) => (
                  <option key={persona} value={persona} />
                ))}
              </datalist>
            </Campo>

            <Campo className="campo-completo">
              <label>Observaciones generales</label>
              <textarea
                name="observacionesGenerales"
                value={cabeceraSalida.observacionesGenerales}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
            </Campo>

            {cabeceraSalida.servicioATerceros ? (
              <Campo className="campo-completo">
                <label>Observacion tercero</label>
                <textarea
                  name="observacionTercero"
                  value={cabeceraSalida.observacionTercero}
                  onChange={manejarCambioCabecera}
                  placeholder=""
                />
              </Campo>
            ) : null}

            <Campo className="campo-completo">
              <label>Detalles de confeccion</label>
              <div className="grupo_detalles">
                {detallesSeleccionados.length > 0 ? (
                  detallesSeleccionados.map((detalle) => (
                    <span key={detalle} className="chip_detalle">
                      {detalle}
                    </span>
                  ))
                ) : (
                  <span className="chip_detalle chip_detalle_vacio">
                    No lleva detalles de confeccion
                  </span>
                )}

                {cabeceraSalida.detallesConfeccion?.MULTIAGUJA &&
                cabeceraSalida.detallesConfeccion?.cantidadAgujas ? (
                  <span className="chip_detalle">
                    {cabeceraSalida.detallesConfeccion.cantidadAgujas} AGUJAS
                  </span>
                ) : null}

                {cabeceraSalida.detallesConfeccion?.otroDetalle ? (
                  <span className="chip_detalle">
                    {cabeceraSalida.detallesConfeccion.otroDetalle}
                  </span>
                ) : null}
              </div>
            </Campo>

            {productoPrincipalResumen.length > 0 ? (
              <Campo className="campo-completo">
                <label>Producto principal de la OP</label>
                <div className="tabla_contenedor">
                  <table className="tabla_derivados_salida">
                    <thead>
                      <tr>
                        <th>Modelo</th>
                        <th>Color</th>
                        <th>S</th>
                        <th>M</th>
                        <th>L</th>
                        <th>XL</th>
                        <th>XXL</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productoPrincipalResumen.map((detalle, indice) => {
                        const totalDetalle = TALLAS_DISPONIBLES.reduce(
                          (total, talla) => total + convertirNumero(detalle?.salidas?.[talla]),
                          0
                        );

                        return (
                          <tr key={`${cabeceraSalida.codigoOp}-${detalle.id || indice}`}>
                            <td>{cabeceraSalida.modelo || "-"}</td>
                            <td>{detalle?.colorBase || "-"}</td>
                            <td>{convertirNumero(detalle?.salidas?.S)}</td>
                            <td>{convertirNumero(detalle?.salidas?.M)}</td>
                            <td>{convertirNumero(detalle?.salidas?.L)}</td>
                            <td>{convertirNumero(detalle?.salidas?.XL)}</td>
                            <td>{convertirNumero(detalle?.salidas?.XXL)}</td>
                            <td>
                              <strong>{totalDetalle}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Campo>
            ) : null}

            {cabeceraSalida.productoDerivado && productosDerivadosResumen.length > 0 ? (
              <Campo className="campo-completo">
                <label>Productos derivados del trazo</label>
                <div className="tabla_contenedor">
                  <table className="tabla_derivados_salida">
                    <thead>
                      <tr>
                        <th>Modelo derivado</th>
                        <th>Tipo de tela</th>
                        <th>Color</th>
                        <th>S</th>
                        <th>M</th>
                        <th>L</th>
                        <th>XL</th>
                        <th>XXL</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosDerivadosResumen.flatMap((item) => {
                        const detalles = Array.isArray(item?.detalleColorTalla) && item.detalleColorTalla.length > 0
                          ? item.detalleColorTalla
                          : [
                              {
                                id: `${item.id || item.modeloBase}-detalle`,
                                colorBase: item.colorBase || "VARIOS",
                                salidas: {
                                  ...crearTotalesPorTallaVacio(),
                                  ...(item?.salidas || {}),
                                },
                              },
                            ];

                        return detalles.map((detalle, indice) => {
                          const totalDetalle = TALLAS_DISPONIBLES.reduce(
                            (total, talla) => total + convertirNumero(detalle?.salidas?.[talla]),
                            0
                          );

                          return (
                            <tr key={`${item.id || item.modeloBase}-${detalle.id || indice}`}>
                              <td>{item.modeloBase || "-"}</td>
                              <td>{item.tipoTela || "-"}</td>
                              <td>{detalle?.colorBase || item.colorBase || "-"}</td>
                              <td>{convertirNumero(detalle?.salidas?.S)}</td>
                              <td>{convertirNumero(detalle?.salidas?.M)}</td>
                              <td>{convertirNumero(detalle?.salidas?.L)}</td>
                              <td>{convertirNumero(detalle?.salidas?.XL)}</td>
                              <td>{convertirNumero(detalle?.salidas?.XXL)}</td>
                              <td>
                                <strong>{totalDetalle}</strong>
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </Campo>
            ) : null}

            <Campo>
              <label>Total taller principal</label>
              <input type="text" value={formatearMontoSoles(totalTallerPrincipal)} readOnly />
            </Campo>

            <Campo>
              <label>Total a pagar</label>
              <input type="text" value={formatearMontoSoles(totalPagarTaller)} readOnly />
            </Campo>
          </div>

          {cabeceraSalida.codigoOp ? (
            <div className="resumen_envio_split">
              <div>
                <span>Tallas aun pendientes de esta OP</span>
                <strong>{resumenPendienteCabecera || "-"}</strong>
              </div>
              <div>
                <span>Tallas elegidas para este envio</span>
                <strong>{resumenSeleccionadoCabecera || "-"}</strong>
              </div>
            </div>
          ) : null}
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Modo de envio al taller</h2>
              <p>
                Por defecto una OP completa se va a un solo taller. Solo usa dividir
                por talleres cuando la misma OP se repartira por tallas.
              </p>
            </div>
          </div>
          {cabeceraSalida.tallasActivas.length === 0 ? (
            <p className="texto_suave">
              Carga una OP para elegir como se enviara al taller.
            </p>
          ) : (
            <>
              <div className="grupo_detalles grupo_modo_envio">
                <CheckTalla>
                  <input
                    type="radio"
                    name="modoEnvioTaller"
                    checked={!cabeceraSalida.dividirPorTallas}
                    onChange={() => manejarModoDivisionTallas(false)}
                  />
                  <span>Enviar OP completa a este taller</span>
                </CheckTalla>
                <CheckTalla>
                  <input
                    type="radio"
                    name="modoEnvioTaller"
                    checked={cabeceraSalida.dividirPorTallas}
                    onChange={() => manejarModoDivisionTallas(true)}
                  />
                  <span>Dividir por talleres</span>
                </CheckTalla>
              </div>

              {!cabeceraSalida.dividirPorTallas ? (
                <div className="aviso_envio_completo">
                  <strong>Se enviara toda la OP disponible</strong>
                  <span>{resumenPendienteCabecera || "-"}</span>
                </div>
              ) : (
                <div className="bloque_division_tallas">
                  <p className="texto_suave">
                    Selecciona solo las tallas completas que se llevara este taller.
                  </p>
                  <div className="grupo_detalles">
                    {cabeceraSalida.tallasActivas.map((talla) => (
                      <CheckTalla key={`envio-${talla}`}>
                        <input
                          type="checkbox"
                          checked={cabeceraSalida.tallasSeleccionadasEnvio.includes(talla)}
                          onChange={() => manejarSeleccionTallaEnvio(talla)}
                        />
                        <span>{`${talla} (${convertirNumero(cabeceraSalida.totalesPorTalla?.[talla])})`}</span>
                      </CheckTalla>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="tarjeta">
          <div className="acciones">
            <button type="button" className="btn btn_secundario" onClick={manejarGuardar}>
              Guardar
            </button>
            {cabeceraSalida.itemSalidaId && !salidaCargadaYaEnviada ? (
              <button
                type="button"
                className="btn btn_secundario"
                onClick={manejarAsignarTaller}
              >
                Asignar taller
              </button>
            ) : null}
            {cabeceraSalida.itemSalidaId &&
            cortesDisponibles.some(
              (corte) => corte.id === cabeceraSalida.itemSalidaId && corte.tipoRegistro === "envio_taller"
            ) ? (
              <>
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => manejarCancelarEnvio()}
                >
                  Cancelar orden
                </button>
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => manejarReiniciarFlujoOp()}
                >
                  Reiniciar OP
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn_principal" onClick={manejarEnvioTaller}>
              {salidaCargadaYaEnviada ? "Actualizar salida" : "Envio taller"}
            </button>
          </div>
        </section>
        </>
        ) : (
        <section className="tarjeta">
          <div className="pestanas pestanas_bloque">
            <button
              type="button"
              className={`pestana ${pestanaVista === "operacion" ? "pestana_activa" : ""}`}
              onClick={() => cambiarPestanaVista("operacion")}
            >
              Operacion
            </button>
            <button
              type="button"
              title="Historial y seguimiento"
              className={`pestana ${pestanaVista === "historial" ? "pestana_activa" : ""}`}
              onClick={() => cambiarPestanaVista("historial")}
            >
              Seguimiento
            </button>
          </div>
          <div className="tarjeta__encabezado">
            <div>
              <h2>Historial de salidas y seguimiento</h2>
              <p>
                Aqui Produccion puede revisar el movimiento de cada salida, su estado de recepcion y si paso por tercero.
              </p>
            </div>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo salida</th>
                  <th>OP</th>
                  <th>Modelo</th>
                  <th>Taller principal</th>
                  <th>Estado recepcion</th>
                  <th>Estado tercero</th>
                  <th>Ubicacion actual</th>
                  <th>Fecha envio</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {cortesEnviados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="fila_vacia">
                      Todavia no hay salidas registradas para seguimiento.
                    </td>
                  </tr>
                ) : (
                  cortesEnviados.map((corte) => {
                    const estadoRecepcion = obtenerEstadoRecepcionSeguimiento(corte);
                    const estadoTercero = obtenerEstadoTerceroSeguimiento(corte);
                    const ubicacionActual = obtenerUbicacionSeguimiento(corte);

                    return (
                      <tr key={`historial-${corte.id}`}>
                        <td>{corte.codigoSalida || corte.codigoOp || "-"}</td>
                        <td>{corte.codigoOp || "-"}</td>
                        <td>{corte.modeloBase || "-"}</td>
                        <td>{corte.nombreTaller || "-"}</td>
                        <td>
                          <span className={`chip_estado_despacho ${estadoRecepcion.clase}`}>
                            {estadoRecepcion.texto}
                          </span>
                        </td>
                        <td>
                          <span className={`chip_estado_despacho ${estadoTercero.clase}`}>
                            {estadoTercero.texto}
                          </span>
                        </td>
                        <td>{ubicacionActual}</td>
                        <td>{corte.fechaEnvio || "-"}</td>
                        <td className="acciones_tabla_inline">
                          <button
                            type="button"
                            className="btn btn_secundario btn_tabla"
                            onClick={() => {
                              setHistorialSeleccionado(corte);
                            }}
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {historialSeleccionado ? (
            <section className="tarjeta tarjeta_interna tarjeta_detalle_historial">
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Detalle de la salida</h2>
                  <p>
                    {historialSeleccionado.codigoSalida || historialSeleccionado.codigoOp || "-"} |{" "}
                    {historialSeleccionado.nombreTaller || "-"}
                  </p>
                </div>
                <VisorFotosModelo
                  modeloBase={historialSeleccionado.modeloBase || historialSeleccionado.modelo || ""}
                  titulo="Fotos del modelo en seguimiento"
                />
              </div>

              <div className="grupo_detalles">
                {detallesHistorialSeleccionado.length > 0 ? (
                  detallesHistorialSeleccionado.map((detalle) => (
                    <span key={detalle} className="chip_detalle">
                      {detalle}
                    </span>
                  ))
                ) : (
                  <span className="chip_detalle chip_detalle_vacio">
                    No lleva detalles de confeccion
                  </span>
                )}
                {historialSeleccionado.detallesConfeccion?.MULTIAGUJA &&
                historialSeleccionado.detallesConfeccion?.cantidadAgujas ? (
                  <span className="chip_detalle">
                    {historialSeleccionado.detallesConfeccion.cantidadAgujas} AGUJAS
                  </span>
                ) : null}
                {historialSeleccionado.detallesConfeccion?.otroDetalle ? (
                  <span className="chip_detalle">
                    {historialSeleccionado.detallesConfeccion.otroDetalle}
                  </span>
                ) : null}
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Color</th>
                      {tallasHistorialSeleccionadas.map((talla) => (
                        <th key={`detalle-historial-${talla}`}>{talla}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalleHistorialSeleccionado.length === 0 ? (
                      <tr>
                        <td colSpan={tallasHistorialSeleccionadas.length + 2} className="fila_vacia">
                          No hay detalle de colores y tallas para esta salida.
                        </td>
                      </tr>
                    ) : (
                      detalleHistorialSeleccionado.map((detalle) => (
                        <tr key={detalle.id}>
                          <td>{detalle.colorBase || "-"}</td>
                          {tallasHistorialSeleccionadas.map((talla) => (
                            <td key={`${detalle.id}-${talla}`}>
                              {convertirNumero(detalle?.salidas?.[talla]) || 0}
                            </td>
                          ))}
                          <td>{detalle.total || 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </section>
        )}
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
  .fila_vacia,
  .texto_suave {
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
    align-items: center;
    justify-content: space-between;
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
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
    text-decoration: none;
    font-weight: 600;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .pestanas {
    display: flex;
    gap: 10px;
    flex-wrap: nowrap;
    padding: 0;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .pestana {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 11px 16px;
    background-color: transparent;
    color: ${({ theme }) => theme.colorSubtitle};
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    min-height: 46px;
    box-sizing: border-box;
    white-space: nowrap;
    line-height: 1;
    min-width: max-content;
  }

  .pestanas_bloque {
    margin-bottom: 16px;
  }

  .tarjeta_detalle_historial {
    margin-top: 22px;
    padding-top: 24px;
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

  .grid {
    display: grid;
    gap: 14px;
  }

  .grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .campo-completo {
    grid-column: 1 / -1;
  }

  .campo_requerido label::after {
    content: " *";
    color: ${({ theme }) => theme.bg5};
    font-weight: 700;
  }

  .tarjeta__encabezado {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .buscador {
    margin-bottom: 16px;
  }

  .buscador input {
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

  .tabla_contenedor {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1180px;
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
    padding: 20px;
  }

  .columna_check {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 44px;
  }

  .columna_check input {
    width: 18px;
    height: 18px;
    accent-color: ${({ theme }) => theme.bg5};
  }

  .acciones_tabla_inline {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
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

  .grupo_detalles {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .grupo_modo_envio {
    margin-top: 14px;
  }

  .aviso_envio_completo,
  .bloque_division_tallas {
    margin-top: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    background: ${({ theme }) => theme.bgtotal};
    padding: 14px;
  }

  .aviso_envio_completo strong,
  .aviso_envio_completo span {
    display: block;
  }

  .aviso_envio_completo strong {
    margin-bottom: 6px;
    color: ${({ theme }) => theme.text};
  }

  .aviso_envio_completo span {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  .resumen_envio_split {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .resumen_envio_split div {
    background-color: ${({ theme }) => theme.bgtotal};
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 14px 16px;
  }

  .resumen_envio_split span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .resumen_envio_split strong {
    font-size: 18px;
    color: ${({ theme }) => theme.text};
  }

  .chip_detalle {
    display: inline-flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 999px;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.08)" : "rgba(255,255,255,0.06)"};
    border: 1px solid ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
    font-size: 13px;
    font-weight: 700;
  }

  .chip_estado_despacho {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid ${({ theme }) => theme.bg4};
    white-space: nowrap;
  }

  .chip_estado_despacho_ok {
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.18)"};
    color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#047857" : "#a7f3d0"};
  }

  .chip_estado_despacho_pendiente {
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.18)"};
    color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#b45309" : "#fde68a"};
  }

  .chip_estado_despacho_neutro {
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(148, 163, 184, 0.16)" : "rgba(148, 163, 184, 0.18)"};
    color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#475569" : "#dbe5f5"};
  }

  .chip_estado_despacho_alerta {
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(79, 70, 229, 0.12)" : "rgba(79, 70, 229, 0.2)"};
    color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#4338ca" : "#c7d2fe"};
  }

  .chip_detalle_vacio {
    color: ${({ theme }) => theme.colorSubtitle};
    font-weight: 500;
  }

  .procesos_externos {
    display: grid;
    gap: 14px;
  }

  .proceso_card {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 16px;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#fbfcfe" : "rgba(255,255,255,0.02)"};
  }

  .acciones_proceso,
  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
  }

  .btn {
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
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

  @media (max-width: 1100px) {
    padding: 12px;

    .cabecera,
    .tarjeta {
      padding: 16px;
    }

    .grid-2,
    .grid-3 {
      grid-template-columns: 1fr;
    }

    table {
      min-width: 1040px;
    }
  }

  @media (max-width: 860px) {
    grid-template-rows: auto auto auto 1fr;
    gap: 12px;
    padding: 10px;

    .encabezado {
      min-height: 72px;
    }

    .cabecera,
    .tarjeta {
      padding: 14px;
      border-radius: 14px;
    }

    .cabecera h1 {
      font-size: 30px;
    }

    .cabecera__estado {
      width: 100%;
    }

    .cabecera__estado strong {
      font-size: 22px;
    }

    .fila_superior,
    .navegacion_superior,
    .tarjeta__encabezado,
    .acciones,
    .acciones_proceso,
    .paginacion {
      flex-direction: column;
      align-items: stretch;
    }

    .buscador input {
      padding: 12px 14px;
      font-size: 16px;
    }

    table {
      min-width: 920px;
    }

    th,
    td {
      padding: 8px;
      font-size: 13px;
    }

    .columna_check {
      min-height: 36px;
    }

    .btn,
    .btn_enlace,
    .boton_volver {
      width: 100%;
      justify-content: center;
    }

    .resumen_envio_split {
      grid-template-columns: 1fr;
    }
  }
`;

const Campo = styled.div`
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
`;

const CheckTalla = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background-color: ${({ theme }) => theme.bg};
  border: 1px solid ${({ theme }) => theme.bg4};
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




