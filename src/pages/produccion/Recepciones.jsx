import { useEffect } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, UserAuth } from "../../index";
import { VisorFotosModelo } from "../../components/moleculas/VisorFotosModelo";
import {
  leerCatalogosProduccion,
  obtenerMotivosGlobalesSistema,
} from "../../utils/catalogosProduccion";
import { registrarIngresoProductosTerminados } from "../../utils/productosTerminados";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  leerListaPreciosProductos,
  obtenerPrecioVentaProducto,
} from "../../utils/preciosProductos";
import { obtenerNombreResponsableActivo } from "../../utils/responsableActivo";
import {
  sincronizarTallerStockDesdeLocalASupabase,
  sincronizarTallerStockDesdeSupabase,
} from "../../supabase/flujoTallerStockCore";
import {

  leerCorrelativoSistemaConfiguracion,
  registrarUsoCorrelativoSistemaConfiguracion,
} from "../../supabase/configuracionCore.js";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_CORTE_ACTUAL = "cynara_detalle_corte_actual";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_SOLICITUDES_PROCESOS_EXTERNOS =
  "cynara_solicitudes_procesos_externos";
const CLAVE_AJUSTES_RECEPCION_PRODUCCION =
  "cynara_ajustes_recepcion_produccion";
const CLAVE_DESCUENTOS_TALLER = "cynara_descuentos_taller";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();
const TALLAS_DISPONIBLES = ["S", "M", "L", "XL", "XXL"];
const DESTINOS_INCIDENCIA = ["NO PAGAR", "REMATE", "REPROCESO", "EVALUAR"];

const normalizarClaveDetalle = (valor = "") =>
  String(valor || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

const normalizarTextoRecepcion = (valor = "") =>
  String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "");

const extraerCodigoRecepcionVisual = (recepcionId = "", codigoSalida = "") => {
  const recepcion = String(recepcionId || "").trim();
  const salida = String(codigoSalida || "").trim();

  if (!recepcion) {
    return "-";
  }

  if (salida && recepcion.startsWith(`${salida}-`)) {
    return recepcion.slice(salida.length + 1) || "-";
  }

  const coincidencia = recepcion.match(/-([A-Z]+\d+)$/i);
  return coincidencia?.[1] || recepcion;
};

const obtenerDetallesActivos = (detalles = {}, catalogo = []) =>
  (Array.isArray(catalogo) ? catalogo : []).filter((detalle) =>
    Boolean(detalles?.[normalizarClaveDetalle(detalle)])
  );

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

const generarCodigoRecepcion = (
  codigoBase = "",
  historial = [],
  codigoExcluir = "",
  prefijo = "REC",
) => {
  const correlativos = historial
    .filter(
      (item) =>
        (item?.cabeceraRecepcion?.codigoOp === codigoBase ||
          item?.cabeceraRecepcion?.itemSalidaId === codigoBase ||
          item?.cabeceraRecepcion?.codigoSalida === codigoBase) &&
        item?.id &&
        item?.id !== codigoExcluir,
    )
    .map((item) => {
      const match = String(item.id).match(/-([A-Z]+)(\d+)$/);
      if (!match) return 0;
      return match[1] === prefijo ? Number(match[2]) : 0;
    })
    .filter((numero) => Number.isFinite(numero));

  const correlativo = correlativos.length === 0 ? 1 : Math.max(...correlativos) + 1;
  return `${codigoBase}-${prefijo}${String(correlativo).padStart(2, "0")}`;
};

const obtenerCodigoBaseRecepcion = (cabecera = {}) =>
  cabecera?.codigoSalida || cabecera?.itemSalidaId || cabecera?.codigoOp || "";

const calcularDiasParaEntrega = (fechaEntrega = "") => {
  if (!fechaEntrega) {
    return {
      texto: "-",
      clase: "estado_neutro",
    };
  }

  const hoy = new Date(`${obtenerFechaActual()}T00:00:00`);
  const entrega = new Date(`${fechaEntrega}T00:00:00`);
  const diferenciaDias = Math.ceil((entrega - hoy) / (1000 * 60 * 60 * 24));

  if (Number.isNaN(diferenciaDias)) {
    return {
      texto: "-",
      clase: "estado_neutro",
    };
  }

  if (diferenciaDias > 0) {
    return {
      texto: `Faltan ${diferenciaDias} dias`,
      clase: diferenciaDias <= 2 ? "estado_pendiente" : "estado_parcial",
    };
  }

  if (diferenciaDias === 0) {
    return {
      texto: "Entrega hoy",
      clase: "estado_pendiente",
    };
  }

  return {
    texto: `Atrasado ${Math.abs(diferenciaDias)} dias`,
    clase: "estado_observado",
  };
};

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

const leerDatoGuardado = (clave) => {
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

const formatearMoneda = (valor) =>
  Number(valor || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatearMontoSoles = (valor) => `S/ ${formatearMoneda(valor)}`;

const redondearMonedaRecepcion = (valor) =>
  Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;

const formatearDecimalRecepcionInput = (valor) => {
  const numero = redondearMonedaRecepcion(valor);
  return numero > 0 ? numero.toFixed(2) : "";
};

const crearMapaTallasVacio = () =>
  TALLAS_DISPONIBLES.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: "",
    }),
    {}
  );

const crearMapaTallasNumero = () =>
  TALLAS_DISPONIBLES.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: 0,
    }),
    {}
  );

const crearDescuentoPrendaInicial = () => ({
  id: `desc-prenda-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
  colorBase: "",
  talla: "",
  cantidad: "1",
  precioUnitario: 0,
  motivo: "PRENDA QUEDO PARA TALLER",
});

const normalizarDescuentosPrendaTaller = (descuentos = []) =>
  Array.isArray(descuentos)
    ? descuentos.map((descuento, indice) => ({
        ...crearDescuentoPrendaInicial(),
        ...descuento,
        id: descuento?.id || `desc-prenda-guardado-${indice + 1}`,
        precioUnitario: Number(descuento?.precioUnitario || 0),
      }))
    : [];

const calcularCantidadDescuentoPrendaTaller = (descuentos = []) =>
  normalizarDescuentosPrendaTaller(descuentos).reduce(
    (total, descuento) => total + Number(descuento?.cantidad || 0),
    0
  );

const calcularMontoDescuentoPrendaTaller = (descuentos = []) =>
  normalizarDescuentosPrendaTaller(descuentos).reduce(
    (total, descuento) =>
      total +
      Number(descuento?.cantidad || 0) * Number(descuento?.precioUnitario || 0),
    0
  );

const construirDescuentosPagoDesdeRecepcion = ({
  cabecera = {},
  registroId = "",
}) =>
  normalizarDescuentosPrendaTaller(cabecera?.descuentosPrendaTaller || [])
    .filter(
      (descuento) =>
        Number(descuento?.cantidad || 0) > 0 &&
        Number(descuento?.precioUnitario || 0) > 0
    )
    .map((descuento) => ({
      id: `DESC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      tipoPago: "OP_PRINCIPAL",
      registroId,
      idRegistroPago: registroId,
      itemSalidaId: cabecera?.itemSalidaId || "",
      codigoOp: cabecera?.codigoOp || "",
      nombreTaller: cabecera?.nombreTaller || "",
      modelo: cabecera?.modelo || "",
      fechaDescuento: cabecera?.fechaRecepcion || obtenerFechaActual(),
      montoDescuento:
        Number(descuento?.cantidad || 0) * Number(descuento?.precioUnitario || 0),
      motivoDescuento:
        descuento?.motivo || "DESCUENTO POR PRENDA REGISTRADO EN ALMACEN",
      origenDescuento: "RECEPCION_ALMACEN",
      colorBase: descuento?.colorBase || "",
      talla: descuento?.talla || "",
      cantidadPrendas: Number(descuento?.cantidad || 0),
      precioVentaUnitario: Number(descuento?.precioUnitario || 0),
    }));

const normalizarTipoAjusteManualRecepcion = (valor = "DESCUENTA") =>
  String(valor || "").toUpperCase() === "AUMENTA" ? "AUMENTA" : "DESCUENTA";

const construirClaveDescuentoRecepcion = ({
  tipoPago = "",
  registroId = "",
  idRegistroPago = "",
}) => `${tipoPago}|${registroId || idRegistroPago}`;

const calcularAjusteManualAcumuladoRecepcion = (cabecera = {}) => {
  const descuentosActuales = leerListaGuardada(CLAVE_DESCUENTOS_TALLER);
  const referencia = construirClaveDescuentoRecepcion({
    tipoPago: "OP_PRINCIPAL",
    registroId: cabecera?.idRecepcion || "",
    idRegistroPago: cabecera?.idRecepcion || "",
  });

  return descuentosActuales
    .filter(
      (item) =>
        construirClaveDescuentoRecepcion(item) === referencia &&
        item?.origenDescuento !== "RECEPCION_ALMACEN"
    )
    .reduce((total, item) => {
      const monto = Number(item?.montoDescuento || 0);
      return (
        total +
        (normalizarTipoAjusteManualRecepcion(item?.tipoAjusteManual) === "AUMENTA"
          ? -monto
          : monto)
      );
    }, 0);
};

const sincronizarDescuentosTallerDesdeRecepcion = ({
  cabecera = {},
  registroId = "",
}) => {
  if (!registroId) {
    return;
  }

  const descuentosActuales = leerListaGuardada(CLAVE_DESCUENTOS_TALLER);
  const descuentosLimpios = descuentosActuales.filter(
    (item) =>
      !(
        item?.origenDescuento === "RECEPCION_ALMACEN" &&
        item?.tipoPago === "OP_PRINCIPAL" &&
        String(item?.registroId || item?.idRegistroPago || "") === String(registroId)
      )
  );
  const descuentosNuevos = construirDescuentosPagoDesdeRecepcion({
    cabecera,
    registroId,
  });

  localStorage.setItem(
    CLAVE_DESCUENTOS_TALLER,
    JSON.stringify([...descuentosNuevos, ...descuentosLimpios])
  );
};

const normalizarDetalleFila = (fila = {}, indice = 0) => ({
  id: fila.id || `detalle-${indice + 1}`,
  colorBase: fila.colorBase || "-",
  tipoHijo: fila?.tipoHijo || "PRINCIPAL",
  origenMaterial: fila?.origenMaterial || "TELA_NORMAL",
  colorNuevo: Boolean(fila?.colorNuevo),
  plan: { ...crearMapaTallasNumero(), ...(fila.plan || {}) },
  acumulado: { ...crearMapaTallasNumero(), ...(fila.acumulado || {}) },
  recibido: { ...crearMapaTallasVacio(), ...(fila.recibido || {}) },
});

const sumarMapaTallas = (mapa = {}) =>
  TALLAS_DISPONIBLES.reduce((total, talla) => total + Number(mapa?.[talla] || 0), 0);

const normalizarTextoClave = (valor = "") =>
  valor.toString().trim().toUpperCase();

const calcularSaldoPorTalla = (plan = {}, acumulado = {}) =>
  TALLAS_DISPONIBLES.reduce((resultado, talla) => {
    const saldo = Math.max(0, Number(plan?.[talla] || 0) - Number(acumulado?.[talla] || 0));

    return {
      ...resultado,
      [talla]: saldo > 0 ? String(saldo) : "",
    };
  }, {});

const obtenerCortePorOp = (codigoOp) => {
  const historial = leerListaGuardada(CLAVE_HISTORIAL_CORTES);
  const actual = leerDatoGuardado(CLAVE_CORTE_ACTUAL);
  const lista = [...historial, ...(Array.isArray(actual) ? actual : actual ? [actual] : [])];

  return (
    lista.find(
      (item) =>
        item?.cabeceraCorte?.codigoCorte === codigoOp ||
        item?.cabeceraCorte?.opOrigen === codigoOp
    ) || null
  );
};

const construirDetallePlanificadoPorOp = (codigoOp) => {
  const corte = obtenerCortePorOp(codigoOp);
  const filas = corte?.filasCorte || [];
  const tallasActivas = obtenerTallasActivas(
    corte?.cabeceraCorte?.tallasSeleccionadas || []
  );
  const mapaPorColor = new Map();

  filas.forEach((fila, indice) => {
    const color = fila?.colorBase || `COLOR ${indice + 1}`;
    const actual = mapaPorColor.get(color) || {
      id: `${codigoOp}-${color}`,
      colorBase: color,
      plan: crearMapaTallasNumero(),
      acumulado: crearMapaTallasNumero(),
      recibido: crearMapaTallasVacio(),
    };

    tallasActivas.forEach((talla) => {
      actual.plan[talla] = Number(actual.plan[talla] || 0) + Number(fila?.salidas?.[talla] || 0);
    });

    mapaPorColor.set(color, actual);
  });

  return Array.from(mapaPorColor.values()).map((fila, indice) =>
    normalizarDetalleFila(fila, indice)
  );
};

const construirDetallePlanificadoDesdeEnvio = (envio = {}) => {
  const detalleEnvio = Array.isArray(envio?.detalleEnvio)
    ? envio.detalleEnvio
    : Array.isArray(envio?.detalleColorTalla)
      ? envio.detalleColorTalla.map((fila) => ({
          colorBase: fila?.colorBase || "",
          plan: { ...crearMapaTallasNumero(), ...(fila?.salidas || {}) },
        }))
      : [];

  return detalleEnvio.map((fila, indice) =>
    normalizarDetalleFila(
      {
        id: fila?.id || `${envio?.id || envio?.codigoSalida || envio?.codigoOp}-detalle-${indice + 1}`,
        colorBase: fila?.colorBase || `COLOR ${indice + 1}`,
        plan: { ...crearMapaTallasNumero(), ...(fila?.plan || {}) },
        acumulado: crearMapaTallasNumero(),
        recibido: crearMapaTallasVacio(),
      },
      indice
    )
  );
};

const calcularAcumuladoRecepcionesPorOp = (
  identificadorRecepcion,
  recepciones = [],
  recepcionActualId = ""
) => {
  const mapaPorColor = new Map();

  recepciones
    .filter(
      (item) =>
        (item?.cabeceraRecepcion?.itemSalidaId || item?.cabeceraRecepcion?.codigoOp) ===
          identificadorRecepcion &&
        item?.id !== recepcionActualId &&
        Array.isArray(item?.cabeceraRecepcion?.detalleRecepcion)
    )
    .forEach((registro) => {
      (registro.cabeceraRecepcion.detalleRecepcion || []).forEach((fila, indice) => {
        const filaActual = normalizarDetalleFila(fila, indice);
        const acumuladoColor = mapaPorColor.get(filaActual.colorBase) || crearMapaTallasNumero();

        TALLAS_DISPONIBLES.forEach((talla) => {
          acumuladoColor[talla] =
            Number(acumuladoColor[talla] || 0) + Number(filaActual.recibido?.[talla] || 0);
        });

        mapaPorColor.set(filaActual.colorBase, acumuladoColor);
      });

      normalizarIncidenciasRecepcion(
        registro?.cabeceraRecepcion?.incidenciasRecepcion || []
      ).forEach((incidencia) => {
        const colorBase = normalizarTextoClave(incidencia?.colorBase);
        const talla = normalizarTextoClave(incidencia?.talla);

        if (!colorBase || !talla || !TALLAS_DISPONIBLES.includes(talla)) {
          return;
        }

        const acumuladoColor = mapaPorColor.get(colorBase) || crearMapaTallasNumero();
        acumuladoColor[talla] =
          Number(acumuladoColor[talla] || 0) + Number(incidencia?.cantidad || 0);
        mapaPorColor.set(colorBase, acumuladoColor);
      });
    });

  return mapaPorColor;
};

const construirDetalleRecepcion = ({
  codigoOp,
  itemSalidaId = "",
  envioSeleccionado = null,
  recepciones = [],
  detalleGuardado = [],
  recepcionActualId = "",
}) => {
  const usaDetalleGuardado =
    Array.isArray(detalleGuardado) && detalleGuardado.length > 0;
  const base =
    usaDetalleGuardado
      ? detalleGuardado.map((fila, indice) => normalizarDetalleFila(fila, indice))
      : envioSeleccionado
        ? construirDetallePlanificadoDesdeEnvio(envioSeleccionado)
      : construirDetallePlanificadoPorOp(codigoOp);

  const acumulado = calcularAcumuladoRecepcionesPorOp(
    itemSalidaId || codigoOp,
    recepciones,
    recepcionActualId
  );

  return base.map((fila, indice) =>
    {
      const acumuladoFila = {
        ...crearMapaTallasNumero(),
        ...(acumulado.get(fila.colorBase) || {}),
      };
      const recibidoSugerido = usaDetalleGuardado
        ? fila.recibido || {}
        : calcularSaldoPorTalla(fila.plan, acumuladoFila);

      return normalizarDetalleFila(
        {
          ...fila,
          acumulado: acumuladoFila,
          recibido: recibidoSugerido,
        },
        indice
      );
    }
  );
};

const crearIncidenciaRecepcionInicial = () => ({
  id: `inc-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  colorBase: "",
  talla: "",
  cantidad: "",
  motivo: "",
  destino: "NO PAGAR",
});

const normalizarIncidenciasRecepcion = (incidencias = []) =>
  Array.isArray(incidencias)
    ? incidencias.map((incidencia, indice) => ({
        ...crearIncidenciaRecepcionInicial(),
        ...incidencia,
        id: incidencia?.id || `inc-guardada-${indice + 1}`,
      }))
    : [];

const construirMapaIncidenciasPorColorTalla = (incidencias = []) =>
  normalizarIncidenciasRecepcion(incidencias).reduce((acumulado, incidencia) => {
    const colorBase = normalizarTextoClave(incidencia?.colorBase);
    const talla = normalizarTextoClave(incidencia?.talla);

    if (!colorBase || !talla || !TALLAS_DISPONIBLES.includes(talla)) {
      return acumulado;
    }

    return {
      ...acumulado,
      [`${colorBase}__${talla}`]:
        Number(acumulado[`${colorBase}__${talla}`] || 0) + Number(incidencia?.cantidad || 0),
    };
  }, {});

const obtenerCantidadIncidenciaColorTalla = (mapa = {}, colorBase = "", talla = "") =>
  Number(mapa[`${normalizarTextoClave(colorBase)}__${normalizarTextoClave(talla)}`] || 0);

const calcularTotalIncidencias = (incidencias = []) =>
  normalizarIncidenciasRecepcion(incidencias).reduce(
    (total, incidencia) => total + Number(incidencia?.cantidad || 0),
    0
  );

const calcularTotalDetalleRecibido = (detalleRecepcion = [], incidencias = []) => {
  const incidenciasPorColorTalla = construirMapaIncidenciasPorColorTalla(incidencias);

  return detalleRecepcion.reduce((total, fila) => {
    const totalRecibido = sumarMapaTallas(fila?.recibido);
    const totalIncidenciasFila = TALLAS_DISPONIBLES.reduce(
      (subTotal, talla) =>
        subTotal +
        obtenerCantidadIncidenciaColorTalla(incidenciasPorColorTalla, fila?.colorBase, talla),
      0
    );

    return total + totalRecibido + totalIncidenciasFila;
  }, 0);
};

const calcularTotalIncidenciasPorDestino = (incidencias = [], destino = "") =>
  normalizarIncidenciasRecepcion(incidencias)
    .filter((incidencia) => incidencia?.destino === destino)
    .reduce((total, incidencia) => total + Number(incidencia?.cantidad || 0), 0);

const calcularCostoUnitarioPrincipalRecepcion = (cabecera = {}) => {
  const pagoUnitarioManual = Number(cabecera?.pagoUnitarioPrenda || 0);
  if (pagoUnitarioManual > 0) {
    return redondearMonedaRecepcion(pagoUnitarioManual);
  }

  const cantidadBase = Number(cabecera?.cantidadTotal || 0);
  const totalPrincipal = Number(cabecera?.totalTallerPrincipal || 0);

  if (cantidadBase <= 0 || totalPrincipal <= 0) {
    return 0;
  }

  return redondearMonedaRecepcion(totalPrincipal / cantidadBase);
};

const calcularTotalPrincipalRecepcion = (cabecera = {}) =>
  redondearMonedaRecepcion(
    Number(cabecera?.cantidadTotal || 0) *
      calcularCostoUnitarioPrincipalRecepcion(cabecera)
  );

const obtenerPagoUnitarioRecepcionFallback = (cabecera = {}) =>
  formatearDecimalRecepcionInput(
    cabecera?.pagoUnitarioPrenda || calcularCostoUnitarioPrincipalRecepcion(cabecera) || 0
  );

const calcularMontoDescuentoNoPagar = (cabecera = {}) =>
  redondearMonedaRecepcion(
    calcularCostoUnitarioPrincipalRecepcion(cabecera) *
      calcularTotalIncidenciasPorDestino(cabecera?.incidenciasRecepcion || [], "NO PAGAR")
  );

const calcularMontoObservadoEvaluar = (cabecera = {}) =>
  redondearMonedaRecepcion(
    calcularCostoUnitarioPrincipalRecepcion(cabecera) *
      calcularTotalIncidenciasPorDestino(cabecera?.incidenciasRecepcion || [], "EVALUAR")
  );

const calcularTotalPagarRecepcion = (cabecera = {}) => {
  const totalPrincipal = calcularTotalPrincipalRecepcion(cabecera);
  const totalProcesosExternos = Number(cabecera?.totalProcesosExternos || 0);
  const descuentoNoPagar = calcularMontoDescuentoNoPagar(cabecera);

  return redondearMonedaRecepcion(
    Math.max(0, totalPrincipal - descuentoNoPagar) + totalProcesosExternos
  );
};

const calcularMontoPagadoAcumuladoRecepcion = (cabecera = {}) =>
  Number(cabecera?.montoPagadoAcumulado || 0);

const calcularSaldoPagoRecepcion = (cabecera = {}) =>
  redondearMonedaRecepcion(
    calcularTotalPagarRecepcion(cabecera) -
      calcularMontoPagadoAcumuladoRecepcion(cabecera) -
      Number(cabecera?.adelantoTaller || 0) -
      calcularMontoDescuentoPrendaTaller(cabecera?.descuentosPrendaTaller || []) -
      calcularAjusteManualAcumuladoRecepcion(cabecera)
  );

const estaRecepcionPagada = (cabecera = {}) => {
  if (Boolean(cabecera?.pagadoTaller)) {
    return true;
  }

  return Boolean(cabecera?.aprobadoPago) && calcularSaldoPagoRecepcion(cabecera) <= 0;
};

const crearCabeceraRecepcionVacia = () => ({
  itemSalidaId: "",
  codigoSalida: "",
  idRecepcion: "",
  nombreTaller: "",
  fechaRecepcion: obtenerFechaActual(),
  codigoOp: "",
  modelo: "",
  tipoTela: "",
  detallesConfeccion: {},
  tipoRecepcion: "final",
  cantidadTotal: "",
  cantidadRecibida: "",
  totalTallerPrincipal: "",
  pagoUnitarioPrenda: "",
  totalProcesosExternos: "",
  totalPagarTaller: "",
  procesosExternos: [],
  detalleRecepcion: [],
  incidenciasRecepcion: [],
  derivarProcesoExterno: false,
  tipoProcesoExterno: "MULTIAGUJA",
  nombreTallerTercero: "",
  cantidadProcesoExterno: "",
  costoUnitarioProcesoExterno: "",
  observacionProcesoExterno: "",
  adelantoTaller: "",
  motivoAdelanto: "",
  recibidoPor: "",
  aprobadoCalidad: false,
  aprobadoPago: false,
  pagadoTaller: false,
  fechaPago: "",
  montoPagadoAcumulado: 0,
  observaciones: "",
  descuentosPrendaTaller: [],
});

const obtenerDetallesConfeccionRecepcion = ({
  cabecera = {},
  envioSeleccionado = null,
  corteRelacionado = null,
} = {}) => {
  const modeloCabeceraNormalizado = normalizarTextoRecepcion(
    cabecera?.modelo || envioSeleccionado?.modelo || ""
  );
  const modeloPrincipalNormalizado = normalizarTextoRecepcion(
    corteRelacionado?.cabeceraCorte?.modeloBase || ""
  );
  const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER);
  const salidaRelacionada =
    salidas.find(
      (item) =>
        (cabecera?.itemSalidaId && item?.id === cabecera.itemSalidaId) ||
        (cabecera?.codigoSalida && item?.codigoSalida === cabecera.codigoSalida)
    ) ||
    salidas.find(
      (item) =>
        cabecera?.codigoOp &&
        item?.codigoOp === cabecera.codigoOp &&
        (!cabecera?.nombreTaller || item?.nombreTaller === cabecera.nombreTaller)
    ) ||
    null;

  const esDerivadoOtroModelo =
    (salidaRelacionada?.tipoSalida === "HIJO DE OP" ||
      cabecera?.tipoSalida === "HIJO DE OP" ||
      (Boolean(modeloCabeceraNormalizado) &&
        Boolean(modeloPrincipalNormalizado) &&
        modeloCabeceraNormalizado !== modeloPrincipalNormalizado) ||
      envioSeleccionado?.tipoSalida === "HIJO DE OP") &&
    String(
      salidaRelacionada?.tipoHijo || cabecera?.tipoHijo || envioSeleccionado?.tipoHijo || ""
    )
      .trim()
      .toUpperCase() === "OTRO_MODELO";

  const esModeloDistintoDelPrincipal =
    Boolean(modeloCabeceraNormalizado) &&
    Boolean(modeloPrincipalNormalizado) &&
    modeloCabeceraNormalizado !== modeloPrincipalNormalizado;

  const detallesSalida = salidaRelacionada?.detallesConfeccion || {};
  if (Object.keys(detallesSalida).length > 0) {
    return detallesSalida;
  }

  if (esDerivadoOtroModelo || esModeloDistintoDelPrincipal) {
    return {};
  }

  const detallesCabecera = cabecera?.detallesConfeccion || {};
  if (Object.keys(detallesCabecera).length > 0) {
    return detallesCabecera;
  }

  const detallesEnvio = envioSeleccionado?.detallesConfeccion || {};
  if (Object.keys(detallesEnvio).length > 0) {
    return detallesEnvio;
  }

  return corteRelacionado?.cabeceraCorte?.detallesConfeccion || {};
};

const construirEnviosDisponibles = () => {
  const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER);
  const recepciones = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);
  const codigosRecibidos = new Set(
    recepciones
      .filter((item) => item?.cabeceraRecepcion?.tipoRecepcion === "final")
      .flatMap((item) => [
        item?.cabeceraRecepcion?.itemSalidaId || "",
        item?.cabeceraRecepcion?.codigoSalida || "",
        !item?.cabeceraRecepcion?.itemSalidaId ? item?.cabeceraRecepcion?.codigoOp || "" : "",
      ])
      .filter(Boolean)
  );

  return salidas.filter(
    (salida) =>
      salida?.tipoRegistro === "envio_taller" &&
      salida?.enviadoTaller &&
      !codigosRecibidos.has(salida.id) &&
      !codigosRecibidos.has(salida.codigoSalida)
  );
};

const obtenerProcesoTercerizacionActual = (envio = {}) => {
  const procesos = leerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS);
  const tieneIdentificadorPropio = Boolean(envio?.id || envio?.codigoSalida);
  const tallerPrincipalNormalizado = String(envio?.nombreTaller || "").trim().toUpperCase();

  return [...procesos]
    .filter((registro) => {
      const mismoItem =
        envio?.id && (registro?.itemSalidaId || "") === String(envio.id);
      const mismaSalida =
        envio?.codigoSalida &&
        ((registro?.itemSalidaId || "") === String(envio.codigoSalida) ||
          (registro?.codigoSalida || "") === String(envio.codigoSalida));
      const mismaOp =
        !tieneIdentificadorPropio &&
        envio?.codigoOp &&
        registro?.codigoOp === envio.codigoOp &&
        (!tallerPrincipalNormalizado ||
          String(registro?.tallerPrincipal || "").trim().toUpperCase() ===
            tallerPrincipalNormalizado);
      return mismoItem || mismaSalida || mismaOp;
    })
    .sort((a, b) => {
      const fechaA = new Date(
        a?.fechaReingresoTallerPrincipal ||
          a?.fechaRetornoTercero ||
          a?.fechaEnvioTercero ||
          a?.fechaRecepcionAlmacen ||
          a?.fechaSolicitud ||
          0
      ).getTime();
      const fechaB = new Date(
        b?.fechaReingresoTallerPrincipal ||
          b?.fechaRetornoTercero ||
          b?.fechaEnvioTercero ||
          b?.fechaRecepcionAlmacen ||
          b?.fechaSolicitud ||
          0
      ).getTime();
      return fechaB - fechaA;
    })[0] || null;
};

const obtenerEstadoTerceroRecepcion = (envio = {}) => {
  const proceso = obtenerProcesoTercerizacionActual(envio);

  if (!proceso) {
    if (envio?.servicioATerceros || envio?.tallerTercero) {
      return { texto: "Con tercero", clase: "estado_parcial" };
    }

    return { texto: "Sin tercero", clase: "estado_neutro" };
  }

  if (proceso?.fechaRetornoTercero) {
    return { texto: "Retornado de tercero", clase: "estado_recibido" };
  }

  if (proceso?.fechaEnvioTercero) {
    return { texto: "En servicio tercerizado", clase: "estado_activo" };
  }

  if (proceso?.fechaRecepcionAlmacen) {
    return { texto: "Listo para enviar a tercero", clase: "estado_pendiente" };
  }

  return { texto: "Con tercero", clase: "estado_parcial" };
};

const obtenerEstadoRecepcionLista = (envio = {}) => {
  const proceso = obtenerProcesoTercerizacionActual(envio);

  if (proceso?.fechaRetornoTercero && proceso?.reingresoTallerPrincipal) {
    return { texto: "Por recibir", clase: "estado_pendiente" };
  }

  if (envio?.tipoRecepcionActual === "parcial") {
    return { texto: "Recepcion parcial", clase: "estado_parcial" };
  }

  return { texto: "Por recibir", clase: "estado_neutro" };
};

const construirRecepcionesRegistradas = () =>
  leerListaGuardada(CLAVE_RECEPCIONES_TALLER).filter(
    (recepcion) => recepcion?.cabeceraRecepcion?.codigoOp
  );

const obtenerRecepcionEnProcesoPorEnvio = ({
  itemSalidaId = "",
  codigoOp = "",
  recepciones = [],
}) => {
  const recepcionesParciales = [...recepciones]
    .filter((registro) => registro?.cabeceraRecepcion?.tipoRecepcion === "parcial")
    .sort((a, b) =>
      String(b?.cabeceraRecepcion?.fechaRecepcion || "").localeCompare(
        String(a?.cabeceraRecepcion?.fechaRecepcion || "")
      )
    );

  if (itemSalidaId) {
    return (
      recepcionesParciales.find(
        (registro) => registro?.cabeceraRecepcion?.itemSalidaId === itemSalidaId
      ) || null
    );
  }

  return (
    recepcionesParciales.find((registro) => {
      const cabecera = registro?.cabeceraRecepcion || {};

      return codigoOp && cabecera?.codigoOp === codigoOp && !cabecera?.itemSalidaId;
    }) || null
  );
};

const calcularCantidadRecibida = (cabecera = {}) =>
  Array.isArray(cabecera?.detalleRecepcion) && cabecera.detalleRecepcion.length > 0
    ? calcularTotalDetalleRecibido(
        cabecera?.detalleRecepcion || [],
        cabecera?.incidenciasRecepcion || []
      )
    : Number(cabecera.cantidadTotal || 0);

const obtenerTipoRecepcionVisible = (cabecera = {}) => {
  if (cabecera?.tipoRecepcion === "parcial" && cabecera?.derivarProcesoExterno) {
    return "Tercerizado";
  }

  return cabecera?.tipoRecepcion === "parcial" ? "Parcial" : "Final";
};

const construirIdProcesoExterno = (cabecera = {}) => {
  const base = cabecera.itemSalidaId || cabecera.codigoSalida || cabecera.codigoOp || "sin-op";
  const proceso = (cabecera.tipoProcesoExterno || "MULTIAGUJA").toString().trim().toUpperCase();
  const taller = (cabecera.nombreTallerTercero || "sin-taller")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");

  return `${base}-${proceso}-${taller}`;
};

const construirClaveProcesoExterno = (proceso = {}) => {
  const base =
    proceso?.itemSalidaId || proceso?.codigoSalida || proceso?.codigoOp || "sin-op";
  const tipo = (proceso?.tipoProceso || proceso?.tipoProcesoExterno || "MULTIAGUJA")
    .toString()
    .trim()
    .toUpperCase();
  const taller = (
    proceso?.nombreTallerExterno ||
    proceso?.nombreTallerTercero ||
    proceso?.nombreTaller ||
    "sin-taller"
  )
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
  const tallerPrincipal = (proceso?.tallerPrincipal || "sin-taller-principal")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");

  const claveSemantica = `${base}-${tipo}-${tallerPrincipal}-${taller}`;

  return claveSemantica === "sin-op-MULTIAGUJA-sin-taller-principal-sin-taller"
    ? String(proceso?.id || claveSemantica)
    : claveSemantica;
};

const obtenerPuntajeProcesoExterno = (proceso = {}) =>
  [
    proceso?.fechaSolicitud,
    proceso?.fechaEntregaAlTercero,
    proceso?.fechaRetornoDesdeTercero,
    proceso?.responsable,
    proceso?.observacion,
    proceso?.nombreTallerExterno,
    proceso?.nombreTallerTercero,
    proceso?.cantidad,
    proceso?.costoUnitario,
    proceso?.total,
  ].filter((valor) => valor !== undefined && valor !== null && String(valor).trim() !== "").length;

const normalizarProcesosExternos = (procesos = []) => {
  const mapa = new Map();

  procesos.forEach((proceso) => {
    if (!proceso || !proceso.codigoOp) {
      return;
    }

    const clave = construirClaveProcesoExterno(proceso);
    const actual = mapa.get(clave);

    if (!actual) {
      mapa.set(clave, {
        ...proceso,
        id: proceso?.id || clave,
        procesoId: proceso?.procesoId || proceso?.id || clave,
      });
      return;
    }

    const candidatoActual = {
      ...actual,
      ...proceso,
      id: actual?.id || proceso?.id || clave,
      procesoId: actual?.procesoId || proceso?.procesoId || actual?.id || proceso?.id || clave,
    };

    mapa.set(
      clave,
      obtenerPuntajeProcesoExterno(proceso) >= obtenerPuntajeProcesoExterno(actual)
        ? candidatoActual
        : actual
    );
  });

  return Array.from(mapa.values());
};

const leerProcesosExternosRelacionados = ({
  codigoOp = "",
  itemSalidaId = "",
  codigoSalida = "",
  nombreTaller = "",
} = {}) => {
  const procesos = normalizarProcesosExternos(
    leerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS)
  );

  if (itemSalidaId || codigoSalida) {
    const referencia = itemSalidaId || codigoSalida;
    const procesosExactos = procesos.filter(
      (registro) =>
        registro?.itemSalidaId === referencia ||
        registro?.codigoSalida === codigoSalida ||
        registro?.codigoSalida === referencia
    );

    if (procesosExactos.length > 0) {
      return procesosExactos;
    }

    return procesos.filter((registro) => {
      const tieneReferenciaPropia = Boolean(
        String(registro?.itemSalidaId || "").trim() || String(registro?.codigoSalida || "").trim()
      );
      const tieneTallerPrincipalRegistro = Boolean(String(registro?.tallerPrincipal || "").trim());
      const coincideTallerPrincipal =
        String(registro?.tallerPrincipal || "").trim().toUpperCase() ===
        String(nombreTaller || "").trim().toUpperCase();

      return (
        !tieneReferenciaPropia &&
        registro?.codigoOp === codigoOp &&
        (!String(nombreTaller || "").trim() ||
          (tieneTallerPrincipalRegistro && coincideTallerPrincipal))
      );
    });
  }

  return procesos.filter((registro) => {
    const tieneTallerPrincipalRegistro = Boolean(String(registro?.tallerPrincipal || "").trim());
    const coincideTallerPrincipal =
      String(registro?.tallerPrincipal || "").trim().toUpperCase() ===
      String(nombreTaller || "").trim().toUpperCase();

    return (
      registro?.codigoOp === codigoOp &&
      (!String(nombreTaller || "").trim() ||
        (tieneTallerPrincipalRegistro && coincideTallerPrincipal))
    );
  });
};

const construirProcesoExternoDesdeCabecera = (cabecera = {}) => ({
  id: construirIdProcesoExterno(cabecera),
  procesoId: construirIdProcesoExterno(cabecera),
  itemSalidaId: cabecera.itemSalidaId || cabecera.codigoSalida || cabecera.codigoOp,
  codigoSalida: cabecera.codigoSalida || "",
  codigoOp: cabecera.codigoOp,
  modelo: cabecera.modelo,
  tallerPrincipal: cabecera.nombreTaller,
  proceso: cabecera.tipoProcesoExterno || "MULTIAGUJA",
  tipoProceso: cabecera.tipoProcesoExterno || "MULTIAGUJA",
  tallerTercero: cabecera.nombreTallerTercero || "",
  nombreTallerExterno: cabecera.nombreTallerTercero,
  responsable: cabecera.recibidoPor,
  cantidadAgujas:
    cabecera?.detalleRecepcion?.[0]?.cantidadAgujas ||
    cabecera?.detallesConfeccion?.cantidadAgujas ||
    "",
  cantidad: cabecera.cantidadProcesoExterno,
  costoUnitario: cabecera.costoUnitarioProcesoExterno,
  total:
    Number(cabecera.cantidadProcesoExterno || 0) *
    Number(cabecera.costoUnitarioProcesoExterno || 0),
  observacion: cabecera.observacionProcesoExterno,
  fechaSolicitud: cabecera.fechaRecepcion,
  fechaRecepcionAlmacen: cabecera.fechaRecepcion || obtenerFechaActual(),
  fechaEnvioTercero: "",
  fechaRetornoTercero: "",
  fechaEntregaAlTercero: "",
  fechaRetornoDesdeTercero: "",
  estado: "listo_para_enviar_tercero",
  estadoMovimiento: "listo_para_enviar_tercero",
});

const obtenerEstadoPagoRecepcion = (cabecera = {}) => {
  if (cabecera.tipoRecepcion === "parcial") {
    return {
      texto: cabecera.derivarProcesoExterno
        ? "Tercerizado"
        : "Recepcion parcial",
      clase: "estado_parcial",
    };
  }

  if (estaRecepcionPagada(cabecera)) {
    return {
      texto: "Pagado",
      clase: "estado_pagado",
    };
  }

  if (cabecera.aprobadoPago) {
    return {
      texto: "Aprobado para pago",
      clase: "estado_aprobado",
    };
  }

  if (calcularTotalIncidencias(cabecera?.incidenciasRecepcion || []) > 0) {
    return {
      texto: "Observado",
      clase: "estado_observado",
    };
  }

  return {
    texto: "Pendiente de revision",
    clase: "estado_pendiente",
  };
};

export function Recepciones({ moduloOrigen = "produccion" }) {
  const { user } = UserAuth();
  const responsableActivo = useMemo(
    () => obtenerNombreResponsableActivo(user),
    [user]
  );
  const catalogosProduccion = useMemo(leerCatalogosProduccion, []);
  const motivosGlobales = useMemo(
    () => obtenerMotivosGlobalesSistema(catalogosProduccion),
    [catalogosProduccion]
  );
  const listaPreciosProductos = useMemo(leerListaPreciosProductos, []);
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [pestanaAlmacen, setPestanaAlmacen] = useState("disponibles");
  const [pestanaRecepciones, setPestanaRecepciones] = useState("recepcionadas");
  const [configRecepcion, setConfigRecepcion] = useState(null);
  const [cabeceraRecepcion, setCabeceraRecepcion] = useState(crearCabeceraRecepcionVacia);
  const [recepcionesRegistradas, setRecepcionesRegistradas] = useState(
    construirRecepcionesRegistradas
  );
  const enviosDisponibles = useMemo(
    () => construirEnviosDisponibles(),
    [recepcionesRegistradas]
  );
  const tallasActivasRecepcion = useMemo(
    () => obtenerTallasActivas(obtenerCortePorOp(cabeceraRecepcion.codigoOp)?.cabeceraCorte?.tallasSeleccionadas || []),
    [cabeceraRecepcion.codigoOp]
  );

  useEffect(() => {
    if (!responsableActivo) return;

    setCabeceraRecepcion((anterior) =>
      anterior?.recibidoPor?.trim()
        ? anterior
        : {
            ...anterior,
            recibidoPor: responsableActivo,
          }
    );
  }, [responsableActivo]);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const data = await leerCorrelativoSistemaConfiguracion("RECEPCION_TALLER");
        if (!activo) return;
        setConfigRecepcion(data);
      } catch (error) {
        console.error("No se pudo cargar el correlativo de recepciones:", error.message);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const procesosActuales = leerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS);
    const procesosNormalizados = normalizarProcesosExternos(procesosActuales);

    if (procesosNormalizados.length !== procesosActuales.length) {
      localStorage.setItem(
        CLAVE_SOLICITUDES_PROCESOS_EXTERNOS,
        JSON.stringify(procesosNormalizados)
      );
    }
  }, []);

  const enviosFiltrados = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();

    return enviosDisponibles.filter((envio) =>
      [envio.codigoOp, envio.nombreTaller, envio.modelo, envio.fechaEnvio, envio.fechaEntrega]
        .join(" ")
        .toLowerCase()
        .includes(textoBusqueda)
    );
  }, [busqueda, enviosDisponibles]);

  const totalPaginas = Math.max(1, Math.ceil(enviosFiltrados.length / FILAS_POR_PAGINA));
  const enviosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return enviosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [enviosFiltrados, paginaActual]);

  useEffect(() => {
    const sincronizar = async () => {
      try {
        await sincronizarTallerStockDesdeSupabase();
        setRecepcionesRegistradas(construirRecepcionesRegistradas());
      } catch (error) {
        console.error("No se pudo sincronizar recepciones de taller:", error);
      }
    };

    sincronizar();
  }, []);

  const totalPendientes = enviosDisponibles.length;
  const esModuloAlmacen = moduloOrigen === "almacen";
  const recepcionesCerradasHistorial = useMemo(
    () =>
      recepcionesRegistradas.filter((registro) => {
        const cabecera = registro?.cabeceraRecepcion || {};
        return cabecera?.tipoRecepcion === "final" && Boolean(cabecera?.aprobadoCalidad);
      }),
    [recepcionesRegistradas]
  );
  const recepcionesFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();

    if (!textoBusqueda) {
      return recepcionesCerradasHistorial;
    }

    return recepcionesCerradasHistorial.filter((registro) =>
      [
        registro?.cabeceraRecepcion?.codigoOp,
        registro?.cabeceraRecepcion?.nombreTaller,
        registro?.cabeceraRecepcion?.modelo,
        registro?.cabeceraRecepcion?.fechaRecepcion,
      ]
        .join(" ")
        .toLowerCase()
        .includes(textoBusqueda)
    );
  }, [busqueda, recepcionesCerradasHistorial]);
  const recepcionesPagadasLista = useMemo(
    () =>
      recepcionesFiltradas.filter((registro) =>
        estaRecepcionPagada(registro?.cabeceraRecepcion)
      ),
    [recepcionesFiltradas]
  );
  const recepcionesNoPagadasLista = useMemo(
    () =>
      recepcionesFiltradas.filter(
        (registro) => !estaRecepcionPagada(registro?.cabeceraRecepcion)
      ),
    [recepcionesFiltradas]
  );
  const recepcionesAprobadas = recepcionesCerradasHistorial.filter(
    (registro) =>
      Boolean(registro?.cabeceraRecepcion?.aprobadoPago) &&
      !estaRecepcionPagada(registro?.cabeceraRecepcion)
  ).length;
  const recepcionesPagadas = recepcionesCerradasHistorial.filter((registro) =>
    estaRecepcionPagada(registro?.cabeceraRecepcion)
  ).length;
  const recepcionesObservadas = recepcionesCerradasHistorial.filter((registro) => {
    const estado = obtenerEstadoPagoRecepcion(registro?.cabeceraRecepcion);
    return estado.clase === "estado_observado";
  }).length;
  const recepcionesPendientesRevision = recepcionesCerradasHistorial.filter((registro) => {
    const estado = obtenerEstadoPagoRecepcion(registro?.cabeceraRecepcion);
    return estado.clase === "estado_pendiente";
  }).length;
  const recepcionYaRegistrada = Boolean(cabeceraRecepcion.idRecepcion);
  const produccionListaParaAprobarPago =
    !esModuloAlmacen &&
    recepcionYaRegistrada &&
    Boolean(cabeceraRecepcion.aprobadoPago);
  const textoAccionRecepcion =
    produccionListaParaAprobarPago
      ? "Aprobar pago"
      : esModuloAlmacen && cabeceraRecepcion.aprobadoCalidad
      ? "Confirmar recepcion"
      : recepcionYaRegistrada
        ? "Actualizar recepcion"
        : "Confirmar recepcion";
  const incidenciasPorColorTalla = useMemo(
    () => construirMapaIncidenciasPorColorTalla(cabeceraRecepcion.incidenciasRecepcion || []),
    [cabeceraRecepcion.incidenciasRecepcion]
  );
  const descuentoNoPagarActual = calcularMontoDescuentoNoPagar(cabeceraRecepcion);
  const montoEvaluarActual = calcularMontoObservadoEvaluar(cabeceraRecepcion);
  const totalPagarActual = calcularTotalPagarRecepcion(cabeceraRecepcion);
  const montoPagadoActual = calcularMontoPagadoAcumuladoRecepcion(cabeceraRecepcion);
  const saldoPagoActual = calcularSaldoPagoRecepcion(cabeceraRecepcion);
  const descuentosPrendaActivos = useMemo(
    () =>
      normalizarDescuentosPrendaTaller(
        cabeceraRecepcion?.descuentosPrendaTaller || []
      ),
    [cabeceraRecepcion?.descuentosPrendaTaller]
  );
  const cantidadDescuentoPrendaActual = calcularCantidadDescuentoPrendaTaller(
    descuentosPrendaActivos
  );
  const montoDescuentoPrendaActual = calcularMontoDescuentoPrendaTaller(
    descuentosPrendaActivos
  );
  const detallesConfeccionActivos = useMemo(
    () =>
      obtenerDetallesActivos(
        cabeceraRecepcion.detallesConfeccion || {},
        catalogosProduccion.detallesConfeccion || []
      ),
    [cabeceraRecepcion.detallesConfeccion, catalogosProduccion.detallesConfeccion]
  );
  const procesoExternoActivoCabecera = useMemo(
    () =>
      obtenerProcesoTercerizacionActual({
        id: cabeceraRecepcion.itemSalidaId || cabeceraRecepcion.codigoSalida,
        codigoSalida: cabeceraRecepcion.codigoSalida,
        codigoOp: cabeceraRecepcion.codigoOp,
      }),
    [
      cabeceraRecepcion.itemSalidaId,
      cabeceraRecepcion.codigoSalida,
      cabeceraRecepcion.codigoOp,
      cabeceraRecepcion.procesosExternos,
    ]
  );
  const puedeVolverATallerPrincipal = Boolean(
    procesoExternoActivoCabecera?.fechaRetornoTercero &&
      !procesoExternoActivoCabecera?.reingresoTallerPrincipal
  );
  const coloresDisponiblesRecepcion = useMemo(
    () =>
      Array.from(
        new Set(
          (cabeceraRecepcion?.detalleRecepcion || [])
            .map((fila) => fila?.colorBase || "")
            .filter(Boolean)
        )
      ),
    [cabeceraRecepcion?.detalleRecepcion]
  );

  const manejarCambioCabecera = (evento) => {
    const { name, value, type, checked } = evento.target;

    setCabeceraRecepcion((anterior) => {
      if (type === "checkbox" && name === "aprobadoPago") {
      return {
          ...anterior,
          aprobadoPago: checked,
          pagadoTaller: checked ? anterior.pagadoTaller : false,
          fechaPago: checked ? anterior.fechaPago : "",
        };
      }

      if (name === "pagoUnitarioPrenda") {
        const limpio = String(value ?? "").replace(",", ".").trim();
        return {
          ...anterior,
          pagoUnitarioPrenda: limpio,
        };
      }

      return {
        ...anterior,
        [name]: type === "checkbox" ? checked : value,
      };
    });
  };

  const manejarCambioDetalleRecepcion = (idFila, talla, valor) => {
    setCabeceraRecepcion((anterior) => ({
      ...anterior,
      detalleRecepcion: (anterior.detalleRecepcion || []).map((fila) =>
        fila.id === idFila
          ? {
              ...fila,
              recibido: {
                ...(fila.recibido || {}),
                [talla]: valor,
              },
            }
          : fila
      ),
    }));
  };

  const manejarAgregarIncidencia = () => {
    setCabeceraRecepcion((anterior) => ({
      ...anterior,
      incidenciasRecepcion: [
        ...(anterior.incidenciasRecepcion || []),
        crearIncidenciaRecepcionInicial(),
      ],
    }));
  };

  const manejarCambioIncidencia = (idIncidencia, campo, valor) => {
    setCabeceraRecepcion((anterior) => ({
      ...anterior,
      incidenciasRecepcion: normalizarIncidenciasRecepcion(
        anterior.incidenciasRecepcion || []
      ).map((incidencia) =>
        incidencia.id === idIncidencia
          ? {
              ...incidencia,
              [campo]: valor,
            }
          : incidencia
      ),
    }));
  };

  const manejarQuitarIncidencia = async (idIncidencia) => {
    const confirmarQuitar = await confirmarAccionSistema(
      "Seguro que deseas quitar esta incidencia de recepcion?"
    );

    if (!confirmarQuitar) {
      return;
    }

    setCabeceraRecepcion((anterior) => ({
      ...anterior,
      incidenciasRecepcion: normalizarIncidenciasRecepcion(
        anterior.incidenciasRecepcion || []
      ).filter((incidencia) => incidencia.id !== idIncidencia),
    }));
  };

  const manejarAgregarDescuentoPrenda = () => {
    setCabeceraRecepcion((anterior) => ({
      ...anterior,
      descuentosPrendaTaller: [
        ...(anterior.descuentosPrendaTaller || []),
        crearDescuentoPrendaInicial(),
      ],
    }));
  };

  const manejarCambioDescuentoPrenda = (idDescuento, campo, valor) => {
    setCabeceraRecepcion((anterior) => ({
      ...anterior,
      descuentosPrendaTaller: normalizarDescuentosPrendaTaller(
        anterior.descuentosPrendaTaller || []
      ).map((descuento) => {
        if (descuento.id !== idDescuento) {
          return descuento;
        }

        const siguiente = {
          ...descuento,
          [campo]:
            campo === "precioUnitario"
              ? (() => {
                  const limpio = String(valor ?? "").replace(",", ".").trim();
                  if (!limpio) {
                    return 0;
                  }
                  const numero = Number(limpio);
                  return Number.isFinite(numero) ? numero : 0;
                })()
              : valor,
        };

        if (campo === "talla") {
          siguiente.precioUnitario = obtenerPrecioVentaProducto({
            modelo: anterior?.modelo || "",
            talla: valor,
            lista: listaPreciosProductos,
          });
        }

        return siguiente;
      }),
    }));
  };

  const manejarQuitarDescuentoPrenda = async (idDescuento) => {
    const confirmar = await confirmarAccionSistema(
      "Seguro que deseas quitar este descuento por prenda?"
    );

    if (!confirmar) {
      return;
    }

    setCabeceraRecepcion((anterior) => ({
      ...anterior,
      descuentosPrendaTaller: normalizarDescuentosPrendaTaller(
        anterior.descuentosPrendaTaller || []
      ).filter((descuento) => descuento.id !== idDescuento),
    }));
  };

  const manejarSeleccionEnvio = (envio) => {
    const procesosExternosActualizados = leerProcesosExternosRelacionados({
      codigoOp: envio.codigoOp,
      itemSalidaId: envio.id || "",
      codigoSalida: envio.codigoSalida || "",
      nombreTaller: envio.nombreTaller || "",
    });
    const corteRelacionado = obtenerCortePorOp(envio.codigoOp);
    const recepcionEnProceso = obtenerRecepcionEnProcesoPorEnvio({
      itemSalidaId: envio.id || "",
      codigoOp: envio.codigoOp || "",
      recepciones: recepcionesRegistradas,
    });
    const detalleRecepcion = construirDetalleRecepcion({
      codigoOp: envio.codigoOp || "",
      itemSalidaId: envio.id || "",
      envioSeleccionado: envio,
      recepciones: recepcionesRegistradas,
      detalleGuardado: recepcionEnProceso?.cabeceraRecepcion?.detalleRecepcion || [],
      recepcionActualId: recepcionEnProceso?.id || "",
    });

    setCabeceraRecepcion({
      ...crearCabeceraRecepcionVacia(),
      ...(recepcionEnProceso?.cabeceraRecepcion || {}),
      itemSalidaId: envio.id || "",
      codigoSalida: envio.codigoSalida || "",
      idRecepcion: recepcionEnProceso?.id || "",
      nombreTaller:
        recepcionEnProceso?.cabeceraRecepcion?.nombreTaller || envio.nombreTaller || "",
      fechaRecepcion:
        recepcionEnProceso?.cabeceraRecepcion?.fechaRecepcion || obtenerFechaActual(),
      codigoOp: envio.codigoOp || "",
      modelo: recepcionEnProceso?.cabeceraRecepcion?.modelo || envio.modelo || "",
      categoriaModelo:
        recepcionEnProceso?.cabeceraRecepcion?.categoriaModelo ||
        envio.categoriaModelo ||
        corteRelacionado?.cabeceraCorte?.categoriaModelo ||
        "",
      modeloCatalogo:
        recepcionEnProceso?.cabeceraRecepcion?.modeloCatalogo ||
        envio.modeloCatalogo ||
        corteRelacionado?.cabeceraCorte?.modeloCatalogo ||
        "",
      telaModelo:
        recepcionEnProceso?.cabeceraRecepcion?.telaModelo ||
        envio.telaModelo ||
        corteRelacionado?.cabeceraCorte?.telaModelo ||
        "",
      tipoTela:
        recepcionEnProceso?.cabeceraRecepcion?.tipoTela ||
        envio.tipoTela ||
        corteRelacionado?.cabeceraCorte?.tipoTela ||
        "",
      detallesConfeccion: obtenerDetallesConfeccionRecepcion({
        cabecera: recepcionEnProceso?.cabeceraRecepcion || {},
        envioSeleccionado: envio,
        corteRelacionado,
      }),
      tipoRecepcion: recepcionEnProceso?.cabeceraRecepcion?.tipoRecepcion || "final",
      cantidadTotal: envio.cantidadTotal || "",
      cantidadRecibida:
        recepcionEnProceso?.cabeceraRecepcion?.cantidadRecibida || envio.cantidadTotal || "",
      totalTallerPrincipal:
        recepcionEnProceso?.cabeceraRecepcion?.totalTallerPrincipal ||
        envio.totalTallerPrincipal ||
        "",
      pagoUnitarioPrenda: obtenerPagoUnitarioRecepcionFallback({
        cantidadTotal:
          recepcionEnProceso?.cabeceraRecepcion?.cantidadTotal ||
          envio.cantidadTotal ||
          0,
        totalTallerPrincipal:
          recepcionEnProceso?.cabeceraRecepcion?.totalTallerPrincipal ||
          envio.totalTallerPrincipal ||
          0,
        pagoUnitarioPrenda:
          recepcionEnProceso?.cabeceraRecepcion?.pagoUnitarioPrenda || "",
      }),
      totalProcesosExternos:
        recepcionEnProceso?.cabeceraRecepcion?.totalProcesosExternos ||
        envio.totalProcesosExternos ||
        "",
      totalPagarTaller:
        recepcionEnProceso?.cabeceraRecepcion?.totalPagarTaller ||
        envio.totalPagarTaller ||
        "",
      montoPagadoAcumulado:
        recepcionEnProceso?.cabeceraRecepcion?.montoPagadoAcumulado ||
        envio.montoPagadoAcumulado ||
        0,
      procesosExternos: procesosExternosActualizados,
      detalleRecepcion,
      incidenciasRecepcion: normalizarIncidenciasRecepcion(
        recepcionEnProceso?.cabeceraRecepcion?.incidenciasRecepcion || []
      ),
      derivarProcesoExterno:
        recepcionEnProceso?.cabeceraRecepcion?.derivarProcesoExterno ||
        envio?.servicioATerceros ||
        false,
      tipoProcesoExterno:
        recepcionEnProceso?.cabeceraRecepcion?.tipoProcesoExterno ||
        envio?.tipoProcesoTercero ||
        "MULTIAGUJA",
      nombreTallerTercero:
        recepcionEnProceso?.cabeceraRecepcion?.nombreTallerTercero ||
        envio?.tallerTercero ||
        "",
      cantidadProcesoExterno:
        recepcionEnProceso?.cabeceraRecepcion?.cantidadProcesoExterno ||
        envio.cantidadTotal ||
        "",
      costoUnitarioProcesoExterno:
        recepcionEnProceso?.cabeceraRecepcion?.costoUnitarioProcesoExterno || "",
      observacionProcesoExterno:
        recepcionEnProceso?.cabeceraRecepcion?.observacionProcesoExterno ||
        envio?.observacionTercero ||
        "",
      adelantoTaller: recepcionEnProceso?.cabeceraRecepcion?.adelantoTaller || "",
      motivoAdelanto: recepcionEnProceso?.cabeceraRecepcion?.motivoAdelanto || "",
      recibidoPor:
        recepcionEnProceso?.cabeceraRecepcion?.recibidoPor || responsableActivo || "",
      aprobadoCalidad:
        recepcionEnProceso?.cabeceraRecepcion?.aprobadoCalidad || false,
      aprobadoPago: recepcionEnProceso?.cabeceraRecepcion?.aprobadoPago || false,
      pagadoTaller: recepcionEnProceso?.cabeceraRecepcion?.pagadoTaller || false,
      fechaPago: recepcionEnProceso?.cabeceraRecepcion?.fechaPago || "",
      observaciones: recepcionEnProceso?.cabeceraRecepcion?.observaciones || "",
      descuentosPrendaTaller: normalizarDescuentosPrendaTaller(
        recepcionEnProceso?.cabeceraRecepcion?.descuentosPrendaTaller || []
      ),
    });
    mostrarNotificacionCarga(
      recepcionEnProceso
        ? "Recepcion parcial cargada correctamente."
        : "Recepcion cargada correctamente."
    );
  };

  const manejarSeleccionRecepcionRegistrada = (registro) => {
    if (!registro?.cabeceraRecepcion) {
      return;
    }

    const cabecera = registro.cabeceraRecepcion;
    const corteRelacionado = obtenerCortePorOp(cabecera.codigoOp);
    const procesosExternosActualizados = leerProcesosExternosRelacionados({
      codigoOp: cabecera.codigoOp,
      itemSalidaId: cabecera.itemSalidaId || "",
      codigoSalida: cabecera.codigoSalida || "",
      nombreTaller: cabecera.nombreTaller || "",
    });
    const detalleRecepcion = construirDetalleRecepcion({
      codigoOp: cabecera.codigoOp,
      itemSalidaId: cabecera.itemSalidaId || "",
      recepciones: recepcionesRegistradas,
      detalleGuardado: cabecera.detalleRecepcion || [],
      recepcionActualId: registro.id,
    });

    setCabeceraRecepcion({
      ...crearCabeceraRecepcionVacia(),
      ...cabecera,
      detallesConfeccion: obtenerDetallesConfeccionRecepcion({
        cabecera,
        corteRelacionado,
      }),
      recibidoPor: cabecera?.recibidoPor || responsableActivo || "",
      idRecepcion: registro.id,
      procesosExternos:
        procesosExternosActualizados.length > 0
          ? procesosExternosActualizados
          : Array.isArray(cabecera.procesosExternos)
            ? cabecera.procesosExternos
            : [],
      detalleRecepcion,
      incidenciasRecepcion: normalizarIncidenciasRecepcion(
        cabecera?.incidenciasRecepcion || []
      ),
      descuentosPrendaTaller: normalizarDescuentosPrendaTaller(
        cabecera?.descuentosPrendaTaller || []
      ),
      pagoUnitarioPrenda: obtenerPagoUnitarioRecepcionFallback(cabecera),
    });
    mostrarNotificacionCarga("Revision de recepcion cargada correctamente.");
  };

  const manejarGuardar = async () => {
    if (!cabeceraRecepcion.codigoOp || !cabeceraRecepcion.nombreTaller) {
      mostrarAlertaSistema("Selecciona primero una OP enviada a taller.");
      return;
    }

    const cantidadRecibida = calcularCantidadRecibida(cabeceraRecepcion);

    if (cantidadRecibida <= 0) {
      mostrarAlertaSistema("Registra al menos una cantidad recibida antes de guardar el avance.");
      return;
    }

    const hayDescuentoSinPrecio = descuentosPrendaActivos.some(
      (descuento) =>
        Number(descuento?.cantidad || 0) > 0 &&
        Number(descuento?.precioUnitario || 0) <= 0
    );

    if (hayDescuentoSinPrecio) {
      mostrarAlertaSistema(
        "Hay descuentos por prenda sin precio configurado. Revisa la talla o configura la lista de precios."
      );
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando avance parcial de recepcion...",
      mensajeExito:
        "Recepcion parcial guardada. Produccion ya puede verla en su historial de recepciones.",
      mensajeError: "No se pudo guardar el avance parcial de recepcion.",
      accion: async () => {
        const idRecepcion =
          cabeceraRecepcion.idRecepcion ||
          generarCodigoRecepcion(
            obtenerCodigoBaseRecepcion(cabeceraRecepcion),
            recepcionesRegistradas,
            "",
            configRecepcion?.prefijo || "REC",
          );
        const cabeceraGuardada = {
          ...cabeceraRecepcion,
          idRecepcion,
          tipoRecepcion: "parcial",
          cantidadRecibida,
          totalTallerPrincipal: calcularTotalPrincipalRecepcion(cabeceraRecepcion),
          totalPagarTaller: calcularTotalPagarRecepcion(cabeceraRecepcion),
          aprobadoPago: false,
          pagadoTaller: false,
          fechaPago: "",
          montoPagadoAcumulado: 0,
          descuentosPrendaTaller: descuentosPrendaActivos,
        };
        const recepcionParcial = {
          id: idRecepcion,
          cabeceraRecepcion: cabeceraGuardada,
          estado: "parcial",
        };
        const recepcionesActuales = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);
        const recepcionesActualizadas = [
          recepcionParcial,
          ...recepcionesActuales.filter((item) => item?.id !== idRecepcion),
        ];

        localStorage.setItem(CLAVE_RECEPCIONES_TALLER, JSON.stringify(recepcionesActualizadas));
        sincronizarDescuentosTallerDesdeRecepcion({
          cabecera: cabeceraGuardada,
          registroId: idRecepcion,
        });
        setRecepcionesRegistradas(construirRecepcionesRegistradas());

        const salidasActualizadas = leerListaGuardada(CLAVE_SALIDAS_TALLER).map((salida) =>
          salida?.id === cabeceraRecepcion.itemSalidaId
            ? {
                ...salida,
                cantidadRecibida,
                diferenciaCantidad:
                  cantidadRecibida - Number(cabeceraRecepcion.cantidadTotal || 0),
                tipoRecepcionActual: "parcial",
                recepcionFinalizada: false,
              }
            : salida
        );

        localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(salidasActualizadas));
        const corteRelacionado = obtenerCortePorOp(cabeceraGuardada.codigoOp);
        await registrarIngresoProductosTerminados({
          recepcionId: recepcionParcial.id,
          fecha: cabeceraGuardada.fechaRecepcion || obtenerFechaActual(),
          codigoOp: cabeceraGuardada.codigoOp || "",
          codigoSalida: cabeceraGuardada.codigoSalida || "",
          modeloId: corteRelacionado?.cabeceraCorte?.modeloId || "",
          codigoModelo:
            cabeceraGuardada.codigoModelo ||
            corteRelacionado?.cabeceraCorte?.codigoModelo ||
            "",
          categoriaModelo:
            cabeceraGuardada.categoriaModelo ||
            corteRelacionado?.cabeceraCorte?.categoriaModelo ||
            "",
          modeloCatalogo:
            cabeceraGuardada.modeloCatalogo ||
            corteRelacionado?.cabeceraCorte?.modeloCatalogo ||
            "",
          telaModelo:
            cabeceraGuardada.telaModelo ||
            corteRelacionado?.cabeceraCorte?.telaModelo ||
            "",
          modelo: cabeceraGuardada.modelo || "",
          tipoTela:
            cabeceraGuardada.tipoTela ||
            corteRelacionado?.cabeceraCorte?.tipoTela ||
            "",
          detalleRecepcion: cabeceraGuardada.detalleRecepcion || [],
          tipoSalida: cabeceraGuardada.tipoSalida || "PRINCIPAL",
          tipoHijo: cabeceraGuardada.tipoHijo || "",
          origenMaterial: cabeceraGuardada.origenMaterial || "",
          colorNuevo: Boolean(cabeceraGuardada.colorNuevo),
        });
        setCabeceraRecepcion(cabeceraGuardada);
        await registrarUsoCorrelativoSistemaConfiguracion({
          clave: "RECEPCION_TALLER",
          fecha: cabeceraGuardada.fechaRecepcion || obtenerFechaActual(),
          correlativo: Number((idRecepcion.match(/(\d+)$/)?.[1] || "0")),
        });
        await sincronizarTallerStockDesdeLocalASupabase();
      },
    });
  };

  const manejarEnviarATerceros = async () => {
    if (!esModuloAlmacen) {
      return;
    }

    if (!cabeceraRecepcion.codigoOp || !cabeceraRecepcion.nombreTaller) {
      mostrarAlertaSistema("Selecciona primero una OP enviada a taller.");
      return;
    }

    const cantidadRecibida = calcularCantidadRecibida(cabeceraRecepcion);
    if (cantidadRecibida <= 0) {
      mostrarAlertaSistema("Registra al menos una cantidad recibida antes de enviar a terceros.");
      return;
    }

    const hayDescuentoSinPrecio = descuentosPrendaActivos.some(
      (descuento) =>
        Number(descuento?.cantidad || 0) > 0 &&
        Number(descuento?.precioUnitario || 0) <= 0
    );

    if (hayDescuentoSinPrecio) {
      mostrarAlertaSistema(
        "Hay descuentos por prenda sin precio configurado. Revisa la talla o configura la lista de precios."
      );
      return;
    }

    if (
      !cabeceraRecepcion.derivarProcesoExterno ||
      !cabeceraRecepcion.nombreTallerTercero ||
      Number(cabeceraRecepcion.cantidadProcesoExterno || 0) <= 0
    ) {
      mostrarAlertaSistema("Completa la derivacion, taller tercero y cantidad antes de enviar a terceros.");
      return;
    }

    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas enviar esta recepcion a terceros?\n\nOP: ${cabeceraRecepcion.codigoOp || "-"}\nTaller tercero: ${cabeceraRecepcion.nombreTallerTercero || "-"}`
    );

    if (!confirmar) {
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Enviando recepcion a terceros...",
      mensajeExito: "Recepcion enviada a terceros correctamente.",
      mensajeError: "No se pudo enviar la recepcion a terceros.",
      accion: async () => {
        const idRecepcion =
          cabeceraRecepcion.idRecepcion ||
          generarCodigoRecepcion(
            obtenerCodigoBaseRecepcion(cabeceraRecepcion),
            recepcionesRegistradas,
            "",
            configRecepcion?.prefijo || "REC",
          );
        const cabeceraGuardada = {
          ...cabeceraRecepcion,
          idRecepcion,
          tipoRecepcion: "parcial",
          cantidadRecibida,
          totalTallerPrincipal: calcularTotalPrincipalRecepcion(cabeceraRecepcion),
          totalPagarTaller: calcularTotalPagarRecepcion(cabeceraRecepcion),
          aprobadoPago: false,
          pagadoTaller: false,
          fechaPago: "",
          montoPagadoAcumulado: 0,
          descuentosPrendaTaller: descuentosPrendaActivos,
        };
        const recepcionParcial = {
          id: idRecepcion,
          cabeceraRecepcion: cabeceraGuardada,
          estado: "parcial",
        };

        const recepcionesActuales = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);
        const recepcionesActualizadas = [
          recepcionParcial,
          ...recepcionesActuales.filter((item) => item?.id !== idRecepcion),
        ];
        localStorage.setItem(CLAVE_RECEPCIONES_TALLER, JSON.stringify(recepcionesActualizadas));
        sincronizarDescuentosTallerDesdeRecepcion({
          cabecera: cabeceraGuardada,
          registroId: idRecepcion,
        });
        setRecepcionesRegistradas(construirRecepcionesRegistradas());

        const solicitudesActuales = leerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS);
        const nuevoProceso = construirProcesoExternoDesdeCabecera(cabeceraGuardada);
        const procesosSinDuplicado = solicitudesActuales.filter(
          (item) => item?.id !== nuevoProceso.id
        );
        const procesosGlobalesActualizados = normalizarProcesosExternos([
          nuevoProceso,
          ...procesosSinDuplicado,
        ]);
        localStorage.setItem(
          CLAVE_SOLICITUDES_PROCESOS_EXTERNOS,
          JSON.stringify(procesosGlobalesActualizados)
        );

        const procesosRelacionadosActualizados = leerProcesosExternosRelacionados({
          codigoOp: cabeceraGuardada.codigoOp || "",
          itemSalidaId: cabeceraGuardada.itemSalidaId || "",
          codigoSalida: cabeceraGuardada.codigoSalida || "",
          nombreTaller: cabeceraGuardada.nombreTaller || "",
        });

        const salidasActualizadas = leerListaGuardada(CLAVE_SALIDAS_TALLER).map((salida) =>
          salida?.id === cabeceraRecepcion.itemSalidaId
            ? (() => {
                const totalProcesosExternosActualizado = procesosRelacionadosActualizados.reduce(
                  (total, item) => total + Number(item?.total || 0),
                  0
                );

                return {
                  ...salida,
                  cantidadRecibida,
                  diferenciaCantidad:
                    cantidadRecibida - Number(cabeceraRecepcion.cantidadTotal || 0),
                  tipoRecepcionActual: "parcial",
                  recepcionFinalizada: false,
                  procesosExternos: procesosRelacionadosActualizados,
                  totalProcesosExternos: totalProcesosExternosActualizado,
                  totalPagarTaller:
                    Number(salida?.totalTallerPrincipal || 0) + totalProcesosExternosActualizado,
                };
              })()
            : salida
        );
        localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(salidasActualizadas));

        setCabeceraRecepcion({
          ...cabeceraGuardada,
          procesosExternos: procesosRelacionadosActualizados,
        });
        await registrarUsoCorrelativoSistemaConfiguracion({
          clave: "RECEPCION_TALLER",
          fecha: cabeceraGuardada.fechaRecepcion || obtenerFechaActual(),
          correlativo: Number((idRecepcion.match(/(\d+)$/)?.[1] || "0")),
        });
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setRecepcionesRegistradas(construirRecepcionesRegistradas());
      },
    });
  };

  const manejarVolverATallerPrincipal = async () => {
    if (!esModuloAlmacen || !cabeceraRecepcion.codigoOp || !procesoExternoActivoCabecera?.id) {
      return;
    }

    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas marcar que esta OP regreso al taller principal?\n\nOP: ${cabeceraRecepcion.codigoOp || "-"}`
    );

    if (!confirmar) {
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Marcando reingreso al taller principal...",
      mensajeExito: "La OP volvio al taller principal correctamente.",
      mensajeError: "No se pudo marcar el reingreso al taller principal.",
      accion: async () => {
        const procesosActuales = leerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS);
        const procesosActualizados = procesosActuales.map((registro) =>
          registro?.id === procesoExternoActivoCabecera.id
            ? {
                ...registro,
                reingresoTallerPrincipal: true,
                fechaReingresoTallerPrincipal:
                  registro?.fechaReingresoTallerPrincipal || obtenerFechaActual(),
              }
            : registro
        );

        localStorage.setItem(
          CLAVE_SOLICITUDES_PROCESOS_EXTERNOS,
          JSON.stringify(procesosActualizados)
        );
        const salidasActualizadas = leerListaGuardada(CLAVE_SALIDAS_TALLER).map((salida) =>
          salida?.id === cabeceraRecepcion.itemSalidaId
            ? {
                ...salida,
                tipoRecepcionActual: "pendiente_reingreso_taller",
                procesosExternos: procesosActualizados.filter(
                  (registro) => registro?.codigoOp === cabeceraRecepcion.codigoOp
                ),
              }
            : salida
        );
        localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(salidasActualizadas));

        setCabeceraRecepcion((anterior) => ({
          ...anterior,
          procesosExternos: procesosActualizados.filter(
            (registro) => registro?.codigoOp === anterior.codigoOp
          ),
        }));
        setRecepcionesRegistradas(construirRecepcionesRegistradas());
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
      },
    });
  };

  const manejarConfirmarRecepcion = async ({
    forzarSinAprobacionPago = false,
  } = {}) => {
    const cabeceraObjetivo = forzarSinAprobacionPago
      ? {
          ...cabeceraRecepcion,
          aprobadoPago: false,
        }
      : cabeceraRecepcion;

    if (!cabeceraObjetivo.codigoOp || !cabeceraObjetivo.nombreTaller) {
      mostrarAlertaSistema("Selecciona primero una OP enviada a taller.");
      return;
    }

  const cantidadBase = Number(cabeceraObjetivo.cantidadTotal || 0);
  const cantidadRecibida = calcularCantidadRecibida(cabeceraObjetivo);
  const retornoTerceroRegistrado = Boolean(procesoExternoActivoCabecera?.fechaRetornoTercero);
  const retornoTerceroConReingreso = Boolean(
    retornoTerceroRegistrado && procesoExternoActivoCabecera?.reingresoTallerPrincipal
  );
  const cierreManualAlmacen =
    esModuloAlmacen &&
    recepcionYaRegistrada &&
    Boolean(cabeceraObjetivo.aprobadoCalidad);
  const tipoRecepcionEfectiva =
    cabeceraObjetivo.tipoRecepcion === "final" ||
    (cantidadBase > 0 &&
      cantidadRecibida >= cantidadBase &&
      (!cabeceraObjetivo.derivarProcesoExterno ||
        retornoTerceroConReingreso ||
        retornoTerceroRegistrado ||
        cierreManualAlmacen))
      ? "final"
      : "parcial";

    if (
      esModuloAlmacen &&
      tipoRecepcionEfectiva === "final" &&
      !cabeceraObjetivo.aprobadoCalidad
    ) {
      mostrarAlertaSistema(
        "Primero marca Aprobado por calidad / almacen antes de confirmar la recepcion final."
      );
      return;
    }

    if (cantidadRecibida < 0) {
      mostrarAlertaSistema("La cantidad recibida no puede quedar en negativo.");
      return;
    }

    if (cantidadRecibida <= 0) {
      mostrarAlertaSistema("Debes registrar al menos una talla o color recibido en el detalle de la recepcion.");
      return;
    }

    const hayDescuentoSinPrecio = descuentosPrendaActivos.some(
      (descuento) =>
        Number(descuento?.cantidad || 0) > 0 &&
        Number(descuento?.precioUnitario || 0) <= 0
    );

    if (hayDescuentoSinPrecio) {
      mostrarAlertaSistema(
        "Hay descuentos por prenda sin precio configurado. Revisa la talla o configura la lista de precios."
      );
      return;
    }

    if (
      esModuloAlmacen &&
      cabeceraRecepcion.derivarProcesoExterno
    ) {
      if (
        !cabeceraRecepcion.nombreTallerTercero ||
        Number(cabeceraRecepcion.cantidadProcesoExterno || 0) <= 0
      ) {
        mostrarAlertaSistema(
          "Completa taller tercero y cantidad del proceso externo para registrar la derivacion."
        );
        return;
      }
    }

    const confirmarRecepcion = await confirmarAccionSistema(
      produccionListaParaAprobarPago
        ? `Seguro que deseas aprobar esta recepcion para pago?\n\nOP: ${cabeceraObjetivo.codigoOp || "-"}\nTaller: ${cabeceraObjetivo.nombreTaller || "-"}\n\nLa recepcion quedara lista para pasar al resumen de pagos.`
        : recepcionYaRegistrada
        ? `Seguro que deseas actualizar esta recepcion?\n\nOP: ${cabeceraObjetivo.codigoOp || "-"}\nTaller: ${cabeceraObjetivo.nombreTaller || "-"}\n\nSe conservara el mismo registro y se actualizaran cantidades, incidencias y pago.`
        : esModuloAlmacen
        ? tipoRecepcionEfectiva === "parcial"
          ? "Seguro que deseas registrar esta recepcion parcial?\n\nLa OP seguira abierta y, si corresponde, podras derivarla a un tercero."
          : "Seguro que deseas registrar esta recepcion final?\n\nProduccion la vera luego en su historial para revisar pago y ajustes."
        : "Seguro que deseas guardar esta revision de recepcion?\n\nLos cambios quedaran registrados en el historial de recepciones."
    );

    if (!confirmarRecepcion) {
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso:
        produccionListaParaAprobarPago
          ? "Aprobando recepcion para pago..."
          : tipoRecepcionEfectiva === "final"
          ? "Confirmando recepcion final..."
          : "Guardando recepcion parcial...",
      mensajeExito: produccionListaParaAprobarPago
        ? "Recepcion aprobada para pago correctamente."
        : !esModuloAlmacen && !recepcionYaRegistrada
        ? "Revision de recepcion guardada correctamente."
        : recepcionYaRegistrada
          ? "Recepcion de taller actualizada correctamente."
          : "Recepcion de taller registrada correctamente.",
      mensajeError: "No se pudo guardar la recepcion de taller.",
      accion: async () => {
        const recepcionAnterior =
          recepcionesRegistradas.find((item) => item?.id === cabeceraRecepcion.idRecepcion) ||
          (cabeceraRecepcion.itemSalidaId
            ? recepcionesRegistradas.find(
                (item) =>
                  item?.cabeceraRecepcion?.itemSalidaId === cabeceraRecepcion.itemSalidaId
              )
            : recepcionesRegistradas.find(
              (item) =>
                  item?.cabeceraRecepcion?.codigoOp === cabeceraObjetivo.codigoOp &&
                  item?.cabeceraRecepcion?.tipoRecepcion === "final" &&
                  !item?.cabeceraRecepcion?.itemSalidaId
              ));

        const cabeceraConfirmada = {
          ...cabeceraObjetivo,
          tipoRecepcion: tipoRecepcionEfectiva,
          idRecepcion:
            cabeceraObjetivo.idRecepcion ||
            recepcionAnterior?.id ||
            generarCodigoRecepcion(
              obtenerCodigoBaseRecepcion(cabeceraObjetivo),
              recepcionesRegistradas,
              recepcionAnterior?.id || "",
              configRecepcion?.prefijo || "REC",
            ),
          totalTallerPrincipal: calcularTotalPrincipalRecepcion(cabeceraObjetivo),
          totalPagarTaller: calcularTotalPagarRecepcion(cabeceraObjetivo),
          aprobadoPago:
            tipoRecepcionEfectiva === "parcial"
              ? false
              : esModuloAlmacen
                ? Boolean(recepcionAnterior?.cabeceraRecepcion?.aprobadoPago)
                : cabeceraObjetivo.aprobadoPago,
          pagadoTaller:
            tipoRecepcionEfectiva === "parcial"
              ? false
              : esModuloAlmacen
                ? Boolean(recepcionAnterior?.cabeceraRecepcion?.pagadoTaller)
                : cabeceraObjetivo.pagadoTaller,
          fechaPago:
            tipoRecepcionEfectiva === "parcial"
              ? ""
              : esModuloAlmacen
                ? recepcionAnterior?.cabeceraRecepcion?.fechaPago || ""
                : cabeceraObjetivo.fechaPago || "",
          montoPagadoAcumulado:
            tipoRecepcionEfectiva === "parcial"
              ? 0
              : esModuloAlmacen
                ? Number(recepcionAnterior?.cabeceraRecepcion?.montoPagadoAcumulado || 0)
                : Number(cabeceraObjetivo.montoPagadoAcumulado || 0),
          cantidadRecibida,
          descuentosPrendaTaller: descuentosPrendaActivos,
        };
        cabeceraConfirmada.pagadoTaller = estaRecepcionPagada(cabeceraConfirmada);

        const idRecepcionFinalExistente =
          tipoRecepcionEfectiva === "final"
            ? cabeceraRecepcion.idRecepcion || recepcionAnterior?.id || ""
            : "";

        const recepcionCompleta = {
          id: cabeceraConfirmada.idRecepcion || idRecepcionFinalExistente,
          cabeceraRecepcion: cabeceraConfirmada,
          estado: tipoRecepcionEfectiva === "parcial" ? "parcial" : "recepcionado",
        };

        const recepcionesActualizadas = [
          recepcionCompleta,
          ...recepcionesRegistradas.filter((item) => {
            if (item?.id === recepcionCompleta.id) {
              return false;
            }

            if (tipoRecepcionEfectiva !== "final") {
              return true;
            }

            const cabeceraItem = item?.cabeceraRecepcion || {};
            const mismoEnvio =
              (cabeceraRecepcion.itemSalidaId &&
                cabeceraItem?.itemSalidaId === cabeceraRecepcion.itemSalidaId) ||
              (cabeceraRecepcion.codigoSalida &&
                cabeceraItem?.codigoSalida === cabeceraRecepcion.codigoSalida);
            const mismaOpSinEnvio =
              !cabeceraRecepcion.itemSalidaId &&
              !cabeceraRecepcion.codigoSalida &&
              cabeceraItem?.codigoOp === cabeceraRecepcion.codigoOp &&
              !cabeceraItem?.itemSalidaId &&
              !cabeceraItem?.codigoSalida;

            return !(mismoEnvio || mismaOpSinEnvio);
          }),
        ];

        localStorage.setItem(CLAVE_RECEPCIONES_TALLER, JSON.stringify(recepcionesActualizadas));
        sincronizarDescuentosTallerDesdeRecepcion({
          cabecera: cabeceraConfirmada,
          registroId: recepcionCompleta.id,
        });
        setRecepcionesRegistradas(recepcionesActualizadas);
        const salidasActuales = leerListaGuardada(CLAVE_SALIDAS_TALLER);
        let salidasActualizadas = salidasActuales.map((salida) =>
          salida?.id === cabeceraRecepcion.itemSalidaId ||
          (cabeceraRecepcion.codigoSalida &&
            salida?.codigoSalida === cabeceraRecepcion.codigoSalida)
            ? {
                ...salida,
                cantidadRecibida,
                diferenciaCantidad:
                  cantidadRecibida - Number(cabeceraRecepcion.cantidadTotal || 0),
                tipoRecepcionActual: tipoRecepcionEfectiva,
                recepcionFinalizada: tipoRecepcionEfectiva === "final",
                totalPagarTaller: calcularTotalPagarRecepcion(cabeceraRecepcion),
                aprobadoPago:
                  tipoRecepcionEfectiva === "final"
                    ? cabeceraConfirmada.aprobadoPago
                    : Boolean(salida?.aprobadoPago),
                montoPagadoAcumulado:
                  tipoRecepcionEfectiva === "final"
                    ? Number(cabeceraConfirmada.montoPagadoAcumulado || 0)
                    : Number(salida?.montoPagadoAcumulado || 0),
                pagadoTaller:
                  tipoRecepcionEfectiva === "final"
                    ? Number(cabeceraConfirmada.montoPagadoAcumulado || 0) >=
                      Number(cabeceraConfirmada.totalPagarTaller || 0)
                    : Number(salida?.montoPagadoAcumulado || 0) >=
                      Number(salida?.totalPagarTaller || 0),
                fechaPago:
                  tipoRecepcionEfectiva === "final"
                    ? cabeceraConfirmada.fechaPago || ""
                    : salida?.fechaPago || "",
                adelantoAcumulado: Number(cabeceraConfirmada.adelantoTaller || 0),
              }
            : salida
        );

        localStorage.setItem(
          CLAVE_SALIDAS_TALLER,
          JSON.stringify(salidasActualizadas)
        );
        const corteRelacionado = obtenerCortePorOp(cabeceraConfirmada.codigoOp);
        await registrarIngresoProductosTerminados({
          recepcionId: recepcionCompleta.id,
          fecha: cabeceraConfirmada.fechaRecepcion || obtenerFechaActual(),
          codigoOp: cabeceraConfirmada.codigoOp || "",
          codigoSalida: cabeceraConfirmada.codigoSalida || "",
          modeloId: corteRelacionado?.cabeceraCorte?.modeloId || "",
          codigoModelo:
            cabeceraConfirmada.codigoModelo ||
            corteRelacionado?.cabeceraCorte?.codigoModelo ||
            "",
          categoriaModelo:
            cabeceraConfirmada.categoriaModelo ||
            corteRelacionado?.cabeceraCorte?.categoriaModelo ||
            "",
          modeloCatalogo:
            cabeceraConfirmada.modeloCatalogo ||
            corteRelacionado?.cabeceraCorte?.modeloCatalogo ||
            "",
          telaModelo:
            cabeceraConfirmada.telaModelo ||
            corteRelacionado?.cabeceraCorte?.telaModelo ||
            "",
          modelo: cabeceraConfirmada.modelo || "",
          tipoTela:
            cabeceraConfirmada.tipoTela ||
            corteRelacionado?.cabeceraCorte?.tipoTela ||
            "",
          detalleRecepcion: cabeceraConfirmada.detalleRecepcion || [],
          tipoSalida: cabeceraConfirmada.tipoSalida || "PRINCIPAL",
          tipoHijo: cabeceraConfirmada.tipoHijo || "",
          origenMaterial: cabeceraConfirmada.origenMaterial || "",
          colorNuevo: Boolean(cabeceraConfirmada.colorNuevo),
        });
        const totalIncidencias = calcularTotalIncidencias(
          cabeceraRecepcion.incidenciasRecepcion || []
        );
        if (totalIncidencias > 0) {
          const ajustesActuales = leerListaGuardada(CLAVE_AJUSTES_RECEPCION_PRODUCCION);
          const ajustesActualizados = [
            {
              id: `${cabeceraRecepcion.codigoOp}-ajuste-recepcion`,
              codigoOp: cabeceraRecepcion.codigoOp,
              modelo: cabeceraRecepcion.modelo,
              cantidadOriginal: cantidadBase,
              cantidadReportada: cantidadRecibida,
              incidencias: normalizarIncidenciasRecepcion(
                cabeceraRecepcion.incidenciasRecepcion || []
              ),
              motivo: "Incidencias registradas en recepcion de taller",
              estado: "pendiente",
              fechaRegistro: cabeceraRecepcion.fechaRecepcion,
            },
            ...ajustesActuales.filter((ajuste) => ajuste?.codigoOp !== cabeceraRecepcion.codigoOp),
          ];
          localStorage.setItem(
            CLAVE_AJUSTES_RECEPCION_PRODUCCION,
            JSON.stringify(ajustesActualizados)
          );
        }
        setCabeceraRecepcion(crearCabeceraRecepcionVacia());
        await registrarUsoCorrelativoSistemaConfiguracion({
          clave: "RECEPCION_TALLER",
          fecha: cabeceraConfirmada.fechaRecepcion || obtenerFechaActual(),
          correlativo: Number((recepcionCompleta.id.match(/(\d+)$/)?.[1] || "0")),
        });
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setRecepcionesRegistradas(construirRecepcionesRegistradas());
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
          <h1>{esModuloAlmacen ? "Recepcion de taller" : "Recepciones"}</h1>
          <p>
            {esModuloAlmacen
              ? "Aqui Almacen recibe lo que devuelve el taller, registra diferencias de cantidad y deja el ajuste listo para que Produccion lo valide."
              : "Aqui se registran las prendas que regresan del taller y tambien se visualizan los procesos externos que estuvieron amarrados a esa OP."}
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Recepciones pendientes</span>
          <strong>{totalPendientes}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to={esModuloAlmacen ? "/almacen/producto-terminado" : "/produccion"} className="boton_volver">
          {esModuloAlmacen ? "Volver a Almacen" : "Volver a Produccion"}
        </Link>

        <div className="navegacion_superior">
          {esModuloAlmacen ? (
            <Link to="/almacen/devolucion-produccion" className="btn btn_secundario btn_enlace">
              Atras
            </Link>
          ) : (
            <>
              <Link to="/produccion/salidas-taller" className="btn btn_secundario btn_enlace">
                Atras
              </Link>
              <button type="button" className="btn btn_principal" disabled>
                Siguiente
              </button>
            </>
          )}
        </div>
      </div>

      <main className="contenido">
        {esModuloAlmacen ? (
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaAlmacen === "disponibles" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaAlmacen("disponibles")}
            >
              OP por recibir
            </button>
            <button
              type="button"
              className={`pestana ${pestanaAlmacen === "recepcionadas" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaAlmacen("recepcionadas")}
            >
              OP recepcionadas
            </button>
            <button
              type="button"
              className={`pestana ${pestanaAlmacen === "historial" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaAlmacen("historial")}
            >
              Historial
            </button>
          </div>
        ) : (
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaRecepciones === "recepcionadas" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaRecepciones("recepcionadas")}
            >
              OP recepcionadas
            </button>
            <button
              type="button"
              className={`pestana ${pestanaRecepciones === "historial" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaRecepciones("historial")}
            >
              Historial
            </button>
          </div>
        )}

        {!esModuloAlmacen && pestanaRecepciones === "recepcionadas" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>OP recepcionadas</h2>
                <p>
                  Aqui Produccion revisa el estado real de cada OP recibida por Almacen, carga cualquier registro para ver detalles y decide si queda aprobada para pago.
                </p>
              </div>
              <div className="resumen_estados">
                <span className="chip_estado estado_pendiente">
                  Pendientes: {recepcionesPendientesRevision}
                </span>
                <span className="chip_estado estado_observado">
                  Observadas: {recepcionesObservadas}
                </span>
                <span className="chip_estado estado_aprobado">
                  Aprobadas: {recepcionesAprobadas}
                </span>
                <span className="chip_estado estado_recibido">
                  Pagadas: {recepcionesPagadas}
                </span>
              </div>
            </div>

            <div className="buscador">
              <input
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por OP, taller, modelo o fecha"
              />
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo OP</th>
                    <th>Salida</th>
                    <th>Recepcion</th>
                    <th>Taller</th>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Total recibido</th>
                    <th>Fecha recepcion</th>
                    <th>Estado</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {recepcionesNoPagadasLista.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="fila_vacia">
                        Todavia no hay OP recepcionadas pendientes de control o pago.
                      </td>
                    </tr>
                  ) : (
                    recepcionesNoPagadasLista.map((registro) => {
                      const estadoPago = obtenerEstadoPagoRecepcion(
                        registro?.cabeceraRecepcion
                      );

                      return (
                      <tr key={registro.id}>
                        <td>{registro?.cabeceraRecepcion?.codigoOp || "-"}</td>
                        <td>{registro?.cabeceraRecepcion?.codigoSalida || "-"}</td>
                        <td>
                          {extraerCodigoRecepcionVisual(
                            registro?.id,
                            registro?.cabeceraRecepcion?.codigoSalida
                          )}
                        </td>
                        <td>{registro?.cabeceraRecepcion?.nombreTaller || "-"}</td>
                        <td>{registro?.cabeceraRecepcion?.modelo || "-"}</td>
                        <td>{obtenerTipoRecepcionVisible(registro?.cabeceraRecepcion)}</td>
                        <td>{registro?.cabeceraRecepcion?.cantidadRecibida || registro?.cabeceraRecepcion?.cantidadTotal || 0}</td>
                        <td>{registro?.cabeceraRecepcion?.fechaRecepcion || "-"}</td>
                        <td>
                          <span className={`chip_estado ${estadoPago.clase}`}>
                            {estadoPago.texto}
                          </span>
                          {calcularTotalIncidencias(
                            registro?.cabeceraRecepcion?.incidenciasRecepcion || []
                          ) > 0 ? (
                            <small className="texto_incidencias_historial">
                              Incidencias:{" "}
                              {calcularTotalIncidencias(
                                registro?.cabeceraRecepcion?.incidenciasRecepcion || []
                              )}
                            </small>
                          ) : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn_principal btn_tabla"
                            onClick={() => manejarSeleccionRecepcionRegistrada(registro)}
                          >
                            Revisar
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
        ) : null}

        {!esModuloAlmacen && pestanaRecepciones === "historial" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Historial</h2>
                <p>
                  Aqui Produccion consulta solo las OP que ya cerraron su recorrido y quedaron pagadas.
                </p>
              </div>
              <div className="resumen_estados">
                <span className="chip_estado estado_pagado">
                  Pagadas: {recepcionesPagadas}
                </span>
              </div>
            </div>

            <div className="buscador">
              <input
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por OP, taller, modelo o fecha"
              />
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo OP</th>
                    <th>Salida</th>
                    <th>Recepcion</th>
                    <th>Taller</th>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Total recibido</th>
                    <th>Fecha recepcion</th>
                    <th>Estado</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {recepcionesPagadasLista.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="fila_vacia">
                        Todavia no hay OP pagadas en el historial.
                      </td>
                    </tr>
                  ) : (
                    recepcionesPagadasLista.map((registro) => {
                      const estadoPago = obtenerEstadoPagoRecepcion(
                        registro?.cabeceraRecepcion
                      );

                      return (
                        <tr key={registro.id}>
                          <td>{registro?.cabeceraRecepcion?.codigoOp || "-"}</td>
                          <td>{registro?.cabeceraRecepcion?.codigoSalida || "-"}</td>
                          <td>
                            {extraerCodigoRecepcionVisual(
                              registro?.id,
                              registro?.cabeceraRecepcion?.codigoSalida
                            )}
                          </td>
                          <td>{registro?.cabeceraRecepcion?.nombreTaller || "-"}</td>
                          <td>{registro?.cabeceraRecepcion?.modelo || "-"}</td>
                          <td>{obtenerTipoRecepcionVisible(registro?.cabeceraRecepcion)}</td>
                          <td>{registro?.cabeceraRecepcion?.cantidadRecibida || registro?.cabeceraRecepcion?.cantidadTotal || 0}</td>
                          <td>{registro?.cabeceraRecepcion?.fechaRecepcion || "-"}</td>
                          <td>
                            <span className={`chip_estado ${estadoPago.clase}`}>
                              {estadoPago.texto}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn_principal btn_tabla"
                              onClick={() => manejarSeleccionRecepcionRegistrada(registro)}
                            >
                              Revisar
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
        ) : null}

        {esModuloAlmacen && pestanaAlmacen === "disponibles" ? (
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>OP enviadas disponibles</h2>
              <p>
                Selecciona una salida ya enviada para cargar su cabecera y registrar la recepcion.
              </p>
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
              placeholder="Buscar por OP, taller, modelo o fecha"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo OP</th>
                  <th>Taller</th>
                  <th>Modelo</th>
                  <th>Estado recepcion</th>
                  <th>Estado tercero</th>
                  <th>Total unidades</th>
                  <th>Fecha envio</th>
                  <th>Fecha entrega</th>
                  <th>Dias entrega</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {enviosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="fila_vacia">
                      No hay OP enviadas pendientes de recepcion.
                    </td>
                  </tr>
                ) : (
                  enviosPaginados.map((envio) => {
                    const estadoEntrega = calcularDiasParaEntrega(envio.fechaEntrega);
                    const estadoRecepcion = obtenerEstadoRecepcionLista(envio);
                    const estadoTercero = obtenerEstadoTerceroRecepcion(envio);

                    return (
                      <tr key={envio.id || envio.codigoOp}>
                        <td>{envio.codigoOp}</td>
                        <td>{envio.nombreTaller || "-"}</td>
                        <td>{envio.modelo || "-"}</td>
                        <td>
                          <span className={`chip_estado ${estadoRecepcion.clase}`}>
                            {estadoRecepcion.texto}
                          </span>
                        </td>
                        <td>
                          <span className={`chip_estado ${estadoTercero.clase}`}>
                            {estadoTercero.texto}
                          </span>
                        </td>
                        <td>{envio.cantidadTotal || 0}</td>
                        <td>{envio.fechaEnvio || "-"}</td>
                        <td>{envio.fechaEntrega || "-"}</td>
                        <td>
                          <span className={`chip_estado chip_entrega ${estadoEntrega.clase}`}>
                            {estadoEntrega.texto}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn_principal btn_tabla"
                            onClick={() => manejarSeleccionEnvio(envio)}
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {enviosFiltrados.length > FILAS_POR_PAGINA ? (
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
        ) : null}

        {esModuloAlmacen && pestanaAlmacen === "recepcionadas" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>OP recepcionadas</h2>
                <p>
                  Aqui Almacen puede revisar lo recibido y cargar una recepcion para corregir cantidades, incidencias o prendas adicionales.
                </p>
              </div>
              <div className="resumen_estados">
                <span className="chip_estado estado_pendiente">
                  Pendientes: {recepcionesPendientesRevision}
                </span>
                <span className="chip_estado estado_observado">
                  Observadas: {recepcionesObservadas}
                </span>
              </div>
            </div>

            <div className="buscador">
              <input
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por OP, taller, modelo o fecha"
              />
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo OP</th>
                    <th>Salida</th>
                    <th>Recepcion</th>
                    <th>Taller</th>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Total recibido</th>
                    <th>Fecha recepcion</th>
                    <th>Estado</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {recepcionesNoPagadasLista.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="fila_vacia">
                        Todavia no hay OP recepcionadas pendientes de cierre final.
                      </td>
                    </tr>
                  ) : (
                    recepcionesNoPagadasLista.map((registro) => {
                      const estadoPago = obtenerEstadoPagoRecepcion(
                        registro?.cabeceraRecepcion
                      );

                      return (
                        <tr key={registro.id}>
                          <td>{registro?.cabeceraRecepcion?.codigoOp || "-"}</td>
                          <td>{registro?.cabeceraRecepcion?.nombreTaller || "-"}</td>
                          <td>{registro?.cabeceraRecepcion?.modelo || "-"}</td>
                          <td>{obtenerTipoRecepcionVisible(registro?.cabeceraRecepcion)}</td>
                          <td>{registro?.cabeceraRecepcion?.cantidadRecibida || registro?.cabeceraRecepcion?.cantidadTotal || 0}</td>
                          <td>{registro?.cabeceraRecepcion?.fechaRecepcion || "-"}</td>
                          <td>
                            <span className={`chip_estado ${estadoPago.clase}`}>
                              {estadoPago.texto}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn_principal btn_tabla"
                              onClick={() => manejarSeleccionRecepcionRegistrada(registro)}
                            >
                              Actualizar
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
        ) : null}

        {esModuloAlmacen && pestanaAlmacen === "historial" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Historial</h2>
                <p>
                  Aqui Almacen consulta solo las OP que ya cerraron completamente y quedaron pagadas.
                </p>
              </div>
              <div className="resumen_estados">
                <span className="chip_estado estado_pagado">
                  Pagadas: {recepcionesPagadas}
                </span>
              </div>
            </div>

            <div className="buscador">
              <input
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por OP, taller, modelo o fecha"
              />
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo OP</th>
                    <th>Taller</th>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Total recibido</th>
                    <th>Fecha recepcion</th>
                    <th>Estado</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {recepcionesPagadasLista.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="fila_vacia">
                        Todavia no hay OP pagadas en el historial.
                      </td>
                    </tr>
                  ) : (
                    recepcionesPagadasLista.map((registro) => {
                      const estadoPago = obtenerEstadoPagoRecepcion(
                        registro?.cabeceraRecepcion
                      );

                      return (
                        <tr key={registro.id}>
                          <td>{registro?.cabeceraRecepcion?.codigoOp || "-"}</td>
                          <td>{registro?.cabeceraRecepcion?.codigoSalida || "-"}</td>
                          <td>
                            {extraerCodigoRecepcionVisual(
                              registro?.id,
                              registro?.cabeceraRecepcion?.codigoSalida
                            )}
                          </td>
                          <td>{registro?.cabeceraRecepcion?.nombreTaller || "-"}</td>
                          <td>{registro?.cabeceraRecepcion?.modelo || "-"}</td>
                          <td>{obtenerTipoRecepcionVisible(registro?.cabeceraRecepcion)}</td>
                          <td>{registro?.cabeceraRecepcion?.cantidadRecibida || registro?.cabeceraRecepcion?.cantidadTotal || 0}</td>
                          <td>{registro?.cabeceraRecepcion?.fechaRecepcion || "-"}</td>
                          <td>
                            <span className={`chip_estado ${estadoPago.clase}`}>
                              {estadoPago.texto}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn_principal btn_tabla"
                              onClick={() => manejarSeleccionRecepcionRegistrada(registro)}
                            >
                              Solo lectura
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
        ) : null}

        <section className="tarjeta">
          <h2>Cabecera de recepcion</h2>

          {cabeceraRecepcion.codigoOp || cabeceraRecepcion.codigoSalida || cabeceraRecepcion.nombreTaller ? (
            <div className="resumen_recepcion_principal">
              <div>
                <span>OP</span>
                <strong>{cabeceraRecepcion.codigoOp || "-"}</strong>
              </div>
              <div>
                <span>Taller</span>
                <strong>{cabeceraRecepcion.nombreTaller || "-"}</strong>
              </div>
            </div>
          ) : null}

          <div className="grid grid-2">
            <Campo className="campo_requerido">
              <label>Nombre del taller</label>
              <select
                name="nombreTaller"
                value={cabeceraRecepcion.nombreTaller}
                onChange={manejarCambioCabecera}
              >
                <option value="">Selecciona un taller</option>
                {catalogosProduccion.modelosNombreTaller.map((taller) => (
                  <option key={taller} value={taller}>
                    {taller}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo className="campo_requerido">
              <label>Fecha de recepcion</label>
              <input
                type="date"
                name="fechaRecepcion"
                value={cabeceraRecepcion.fechaRecepcion}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Codigo OP</label>
              <input type="text" name="codigoOp" value={cabeceraRecepcion.codigoOp} readOnly />
            </Campo>

            <Campo className="campo_requerido">
              <label>Codigo salida</label>
              <input
                type="text"
                name="codigoSalida"
                value={cabeceraRecepcion.codigoSalida || ""}
                readOnly
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Codigo recepcion</label>
              <input
                type="text"
                value={extraerCodigoRecepcionVisual(
                  cabeceraRecepcion.idRecepcion,
                  cabeceraRecepcion.codigoSalida
                )}
                readOnly
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Modelo</label>
              <input type="text" name="modelo" value={cabeceraRecepcion.modelo} readOnly />
            </Campo>

            <Campo>
              <label>Referencia visual</label>
              <div className="campo_accion_visual">
                <VisorFotosModelo
                  modeloBase={cabeceraRecepcion.modelo || ""}
                  titulo="Fotos del modelo en recepcion"
                />
              </div>
            </Campo>

            {esModuloAlmacen ? (
              <Campo className="campo_requerido">
                <label>Tipo de recepcion</label>
                <select
                  name="tipoRecepcion"
                  value={cabeceraRecepcion.tipoRecepcion}
                  onChange={manejarCambioCabecera}
                >
                  <option value="final">Final</option>
                  <option value="parcial">Parcial</option>
                </select>
              </Campo>
            ) : null}

            <Campo className="campo_requerido">
              <label>Total unidades</label>
              <input
                type="text"
                name="cantidadTotal"
                value={cabeceraRecepcion.cantidadTotal}
                readOnly
              />
            </Campo>

            <Campo>
              <label>Total recibido</label>
              <input
                type="text"
                name="cantidadRecibida"
                value={calcularCantidadRecibida(cabeceraRecepcion)}
                readOnly
              />
            </Campo>

            {esModuloAlmacen ? (
              <Campo>
                <label>Total incidencias</label>
                <input
                  type="text"
                  value={calcularTotalIncidencias(cabeceraRecepcion.incidenciasRecepcion || [])}
                  readOnly
                />
              </Campo>
            ) : (
              <Campo>
                <label>Pago por prenda (S/)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="pagoUnitarioPrenda"
                  value={cabeceraRecepcion.pagoUnitarioPrenda}
                  onChange={manejarCambioCabecera}
                  placeholder=""
                />
              </Campo>
            )}

            {esModuloAlmacen ? (
              <>
                <Campo>
                  <label>No pagables</label>
                  <input
                    type="text"
                    value={calcularTotalIncidenciasPorDestino(
                      cabeceraRecepcion.incidenciasRecepcion || [],
                      "NO PAGAR"
                    )}
                    readOnly
                  />
                </Campo>

                <Campo>
                  <label>Prendas a descontar</label>
                  <input type="text" value={cantidadDescuentoPrendaActual} readOnly />
                </Campo>

                <Campo>
                  <label>Descuento por prenda (S/)</label>
                  <input
                    type="text"
                    value={formatearMoneda(montoDescuentoPrendaActual)}
                    readOnly
                  />
                </Campo>
              </>
            ) : (
              <Campo>
                <label>Total bruto de la OP (S/)</label>
                <input
                  type="text"
                  value={formatearMoneda(calcularTotalPagarRecepcion({
                    ...cabeceraRecepcion,
                    incidenciasRecepcion: [],
                    descuentosPrendaTaller: [],
                    adelantoTaller: 0,
                  }))}
                  readOnly
                />
              </Campo>
            )}


            <Campo className="campo_requerido">
              <label>Recibido por</label>
              <input
                type="text"
                list="catalogo-personal-recepcion"
                name="recibidoPor"
                value={cabeceraRecepcion.recibidoPor}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
              <datalist id="catalogo-personal-recepcion">
                {catalogosProduccion.personal.map((persona) => (
                  <option key={persona} value={persona} />
                ))}
              </datalist>
            </Campo>

            <Campo className="campo-completo">
              <label>Observaciones</label>
              <textarea
                name="observaciones"
                value={cabeceraRecepcion.observaciones}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
            </Campo>

            <Campo className="campo-completo">
              <label>Detalles de confeccion</label>
              <div className="grupo_detalles_resumen">
                {detallesConfeccionActivos.length > 0 ? (
                  detallesConfeccionActivos.map((detalle) => (
                    <span key={detalle} className="chip_detalle_recepcion">
                      {detalle}
                    </span>
                  ))
                ) : (
                  <span className="chip_detalle_recepcion chip_detalle_recepcion_vacio">
                    No lleva detalles de confeccion
                  </span>
                )}
                {cabeceraRecepcion.detallesConfeccion?.MULTIAGUJA &&
                cabeceraRecepcion.detallesConfeccion?.cantidadAgujas ? (
                  <span className="chip_detalle_recepcion">
                    {cabeceraRecepcion.detallesConfeccion.cantidadAgujas} AGUJAS
                  </span>
                ) : null}
                {cabeceraRecepcion.detallesConfeccion?.otroDetalle ? (
                  <span className="chip_detalle_recepcion">
                    {cabeceraRecepcion.detallesConfeccion.otroDetalle}
                  </span>
                ) : null}
              </div>
            </Campo>

            {!esModuloAlmacen ? (
              <>
                <Campo>
                  <label>Adelanto al taller (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="adelantoTaller"
                    value={cabeceraRecepcion.adelantoTaller}
                    onChange={manejarCambioCabecera}
                    placeholder=""
                  />
                </Campo>

                <Campo>
                  <label>Motivo del adelanto</label>
                  <input
                    type="text"
                    name="motivoAdelanto"
                    value={cabeceraRecepcion.motivoAdelanto}
                    onChange={manejarCambioCabecera}
                    placeholder=""
                  />
                </Campo>
              </>
            ) : null}

            {esModuloAlmacen ? (
              <>
                <Campo className="campo-completo">
                  <label className="label_check">
                    <input
                      type="checkbox"
                      name="derivarProcesoExterno"
                      checked={cabeceraRecepcion.derivarProcesoExterno}
                      onChange={manejarCambioCabecera}
                    />
                    <span>Derivar esta recepcion a un taller tercero</span>
                  </label>
                </Campo>

                <div className="aviso_tercerizacion">
                  Almacen recibe, cuenta y deriva estas unidades al taller tercero.
                  El pago del tercero queda separado del taller principal y luego
                  Produccion lo revisa en su control economico.
                </div>

                {cabeceraRecepcion.derivarProcesoExterno ? (
                  <>
                    <Campo>
                      <label>Proceso externo</label>
                      <select
                        name="tipoProcesoExterno"
                        value={cabeceraRecepcion.tipoProcesoExterno}
                        onChange={manejarCambioCabecera}
                      >
                        <option value="MULTIAGUJA">MULTIAGUJA</option>
                        <option value="ESTAMPADO">ESTAMPADO</option>
                        <option value="BORDADO">BORDADO</option>
                        <option value="LAVADO">LAVADO</option>
                        <option value="OTRO">OTRO</option>
                      </select>
                    </Campo>

                    <Campo className="campo_requerido">
                      <label>Taller tercero</label>
                      <select
                        name="nombreTallerTercero"
                        value={cabeceraRecepcion.nombreTallerTercero}
                        onChange={manejarCambioCabecera}
                      >
                        <option value="">Selecciona un taller</option>
                        {catalogosProduccion.modelosNombreTaller.map((taller) => (
                          <option key={`tercero-${taller}`} value={taller}>
                            {taller}
                          </option>
                        ))}
                      </select>
                    </Campo>

                    <Campo className="campo_requerido">
                      <label>Cantidad a tercero</label>
                      <input
                        type="number"
                        name="cantidadProcesoExterno"
                        value={cabeceraRecepcion.cantidadProcesoExterno}
                        onChange={manejarCambioCabecera}
                        placeholder=""
                      />
                    </Campo>

                    {!esModuloAlmacen ? (
                      <Campo>
                        <label>Costo unitario tercero (S/)</label>
                        <input
                          type="number"
                          step="0.01"
                          name="costoUnitarioProcesoExterno"
                          value={cabeceraRecepcion.costoUnitarioProcesoExterno}
                          onChange={manejarCambioCabecera}
                          placeholder=""
                        />
                      </Campo>
                    ) : null}

                    <Campo className="campo-completo">
                      <label>Observacion del proceso externo</label>
                      <textarea
                        name="observacionProcesoExterno"
                        value={cabeceraRecepcion.observacionProcesoExterno}
                        onChange={manejarCambioCabecera}
                        placeholder=""
                      />
                    </Campo>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Detalle de recepcion</h2>
              <p>
                Aqui Almacen trabaja con el mismo detalle que viene desde Produccion: color por color y talla por talla, tanto para parcial como para final.
              </p>
            </div>
          </div>

          {(cabeceraRecepcion.detalleRecepcion || []).length === 0 ? (
            <p className="texto_suave">
              Esta OP todavia no tiene detalle de color y talla disponible para recepcion.
            </p>
          ) : (
            <div className="tabla_contenedor tabla_detalle_recepcion">
              <table className="tabla_recepcion_operativa">
                <thead>
                  <tr>
                    <th className="columna_color_recepcion" rowSpan={2}>Color</th>
                    <th
                      className="columna_grupo_recepcion columna_grupo_recepcion_divisor"
                      colSpan={tallasActivasRecepcion.length}
                    >
                      Totales ({tallasActivasRecepcion.join("-")})
                    </th>
                    <th
                      className="columna_grupo_recepcion"
                      colSpan={tallasActivasRecepcion.length}
                    >
                      Recibido ({tallasActivasRecepcion.join("-")})
                    </th>
                    <th
                      className="columna_grupo_recepcion"
                      colSpan={tallasActivasRecepcion.length}
                    >
                      Recibe ({tallasActivasRecepcion.join("-")})
                    </th>
                    <th className="columna_total_recepcion" rowSpan={2}>Total recibido</th>
                    <th className="columna_total_recepcion" rowSpan={2}>Saldo</th>
                  </tr>
                  <tr>
                    {tallasActivasRecepcion.map((talla, indice) => (
                      <th
                        key={`plan-${talla}`}
                        className={`columna_plan_recepcion ${
                          indice === tallasActivasRecepcion.length - 1
                            ? "columna_bloque_divisor"
                            : ""
                        }`}
                      >
                        {talla}
                      </th>
                    ))}
                    {tallasActivasRecepcion.map((talla, indice) => (
                      <th
                        key={`acu-${talla}`}
                        className={`columna_acumulado_recepcion ${
                          indice === tallasActivasRecepcion.length - 1
                            ? "columna_bloque_divisor"
                            : ""
                        }`}
                      >
                        {talla}
                      </th>
                    ))}
                    {tallasActivasRecepcion.map((talla, indice) => (
                      <th
                        key={`rec-${talla}`}
                        className={`columna_recibe_recepcion ${
                          indice === tallasActivasRecepcion.length - 1
                            ? "columna_bloque_divisor"
                            : ""
                        }`}
                      >
                        {talla}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cabeceraRecepcion.detalleRecepcion.map((fila) => {
                    const totalFilaRecibida = sumarMapaTallas(fila.recibido);
                    const totalIncidenciasFila = TALLAS_DISPONIBLES.reduce(
                      (total, talla) =>
                        total +
                        obtenerCantidadIncidenciaColorTalla(
                          incidenciasPorColorTalla,
                          fila.colorBase,
                          talla
                        ),
                      0
                    );
                    const totalFilaCompletada = totalFilaRecibida + totalIncidenciasFila;
                    const saldoFila =
                      sumarMapaTallas(fila.acumulado) +
                      totalFilaCompletada -
                      sumarMapaTallas(fila.plan);

                    return (
                      <tr key={fila.id}>
                        <td className="celda_color_recepcion">{fila.colorBase || "-"}</td>
                        {tallasActivasRecepcion.map((talla, indice) => (
                          <td
                            key={`${fila.id}-plan-${talla}`}
                            className={`celda_plan_recepcion ${
                              indice === tallasActivasRecepcion.length - 1
                                ? "celda_bloque_divisor"
                                : ""
                            }`}
                          >
                            {Number(fila.plan?.[talla] || 0)}
                          </td>
                        ))}
                        {tallasActivasRecepcion.map((talla, indice) => (
                          <td
                            key={`${fila.id}-acu-${talla}`}
                            className={`celda_acumulado_recepcion ${
                              indice === tallasActivasRecepcion.length - 1
                                ? "celda_bloque_divisor"
                                : ""
                            }`}
                          >
                            {Number(fila.acumulado?.[talla] || 0)}
                          </td>
                        ))}
                        {tallasActivasRecepcion.map((talla, indice) => (
                          <td
                            key={`${fila.id}-rec-${talla}`}
                            className={`celda_recibe_recepcion ${
                              indice === tallasActivasRecepcion.length - 1
                                ? "celda_bloque_divisor"
                                : ""
                            }`}
                          >
                            <input
                              type="number"
                              min="0"
                              value={fila.recibido?.[talla] || ""}
                              onChange={(evento) =>
                                manejarCambioDetalleRecepcion(
                                  fila.id,
                                  talla,
                                  evento.target.value
                                )
                              }
                              placeholder=""
                            />
                          </td>
                        ))}
                        <td className="celda_total_recepcion">{totalFilaCompletada}</td>
                        <td className="celda_total_recepcion">{saldoFila}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Incidencias de recepcion</h2>
              <p>
                Aqui registras prendas o piezas observadas por falla, remate o
                reproceso. Estas incidencias no se mezclan con el recibido normal.
              </p>
            </div>

            <button
              type="button"
              className="btn btn_secundario"
              onClick={manejarAgregarIncidencia}
            >
              Agregar incidencia
            </button>
          </div>

          {(cabeceraRecepcion.incidenciasRecepcion || []).length === 0 ? (
            <p className="texto_suave">
              Esta recepcion no tiene incidencias registradas.
            </p>
          ) : (
            <div className="tabla_contenedor">
              <table className="tabla_incidencias_recepcion">
                <thead>
                  <tr>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                    <th>Destino</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizarIncidenciasRecepcion(
                    cabeceraRecepcion.incidenciasRecepcion || []
                  ).map((incidencia) => (
                    <tr key={incidencia.id}>
                      <td>
                        <input
                          type="text"
                          list={`catalogo-color-incidencia-${incidencia.id}`}
                          value={incidencia.colorBase}
                          onChange={(evento) =>
                            manejarCambioIncidencia(
                              incidencia.id,
                              "colorBase",
                              evento.target.value.toUpperCase()
                            )
                          }
                          placeholder=""
                        />
                        <datalist id={`catalogo-color-incidencia-${incidencia.id}`}>
                          {coloresDisponiblesRecepcion.map((color) => (
                            <option key={`${incidencia.id}-${color}`} value={color} />
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <select
                          value={incidencia.talla}
                          onChange={(evento) =>
                            manejarCambioIncidencia(
                              incidencia.id,
                              "talla",
                              evento.target.value
                            )
                          }
                        >
                          <option value="">Selecciona</option>
                          {tallasActivasRecepcion.map((talla) => (
                            <option key={`${incidencia.id}-${talla}`} value={talla}>
                              {talla}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={incidencia.cantidad}
                          onChange={(evento) =>
                            manejarCambioIncidencia(
                              incidencia.id,
                              "cantidad",
                              evento.target.value
                            )
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          list="catalogo-motivos-globales-recepcion-incidencia"
                          value={incidencia.motivo}
                          onChange={(evento) =>
                            manejarCambioIncidencia(
                              incidencia.id,
                              "motivo",
                              evento.target.value
                            )
                          }
                          placeholder=""
                        />
                        <datalist id="catalogo-motivos-globales-recepcion-incidencia">
                          {motivosGlobales.map((motivo) => (
                            <option key={`incidencia-motivo-${motivo}`} value={motivo}>
                              {motivo}
                            </option>
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <input
                          type="text"
                          list={`catalogo-destino-incidencia-${incidencia.id}`}
                          value={incidencia.destino}
                          onChange={(evento) =>
                            manejarCambioIncidencia(
                              incidencia.id,
                              "destino",
                              evento.target.value
                            )
                          }
                          placeholder=""
                        />
                        <datalist id={`catalogo-destino-incidencia-${incidencia.id}`}>
                          {DESTINOS_INCIDENCIA.map((destino) => (
                            <option key={`${incidencia.id}-${destino}`} value={destino}>
                              {destino}
                            </option>
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn_secundario btn_tabla"
                          onClick={() => manejarQuitarIncidencia(incidencia.id)}
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

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Descuento por prenda al taller</h2>
              <p>
                Si el taller se queda con una prenda, aqui la registras y el sistema
                jala el precio de venta desde Configuracion para descontarlo luego del pago.
              </p>
            </div>

            <button
              type="button"
              className="btn btn_secundario"
              onClick={manejarAgregarDescuentoPrenda}
            >
              Agregar descuento
            </button>
          </div>

          {descuentosPrendaActivos.length === 0 ? (
            <p className="texto_suave">
              Esta recepcion no tiene descuentos por prenda registrados.
            </p>
          ) : (
            <div className="tabla_contenedor">
              <table className="tabla_incidencias_recepcion">
                <thead>
                  <tr>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Cantidad</th>
                    <th>Precio venta</th>
                    <th>Total</th>
                    <th>Motivo</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {descuentosPrendaActivos.map((descuento) => {
                    const montoTotal =
                      Number(descuento?.cantidad || 0) *
                      Number(descuento?.precioUnitario || 0);

                    return (
                      <tr key={descuento.id}>
                        <td>
                          <select
                            value={descuento.colorBase}
                            onChange={(evento) =>
                              manejarCambioDescuentoPrenda(
                                descuento.id,
                                "colorBase",
                                evento.target.value
                              )
                            }
                          >
                            <option value="">Sin color</option>
                            {coloresDisponiblesRecepcion.map((color) => (
                              <option key={`desc-color-${color}`} value={color}>
                                {color}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={descuento.talla}
                            onChange={(evento) =>
                              manejarCambioDescuentoPrenda(
                                descuento.id,
                                "talla",
                                evento.target.value
                              )
                            }
                          >
                            <option value="">Talla</option>
                            {tallasActivasRecepcion.map((talla) => (
                              <option key={`desc-talla-${talla}`} value={talla}>
                                {talla}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={descuento.cantidad}
                            onChange={(evento) =>
                              manejarCambioDescuentoPrenda(
                                descuento.id,
                                "cantidad",
                                evento.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={String(descuento?.precioUnitario ?? "")}
                            onChange={(evento) =>
                              manejarCambioDescuentoPrenda(
                                descuento.id,
                                "precioUnitario",
                                evento.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={formatearMontoSoles(montoTotal)}
                            readOnly
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            list="catalogo-motivos-globales-recepcion-descuento"
                            value={descuento.motivo}
                            onChange={(evento) =>
                              manejarCambioDescuentoPrenda(
                                descuento.id,
                                "motivo",
                                evento.target.value.toUpperCase()
                              )
                            }
                            placeholder="PRENDA QUEDO PARA TALLER"
                          />
                          <datalist id="catalogo-motivos-globales-recepcion-descuento">
                            {motivosGlobales.map((motivo) => (
                              <option key={`descuento-motivo-${motivo}`} value={motivo}>
                                {motivo}
                              </option>
                            ))}
                          </datalist>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn_secundario btn_tabla"
                            onClick={() => manejarQuitarDescuentoPrenda(descuento.id)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <h2>{esModuloAlmacen ? "Checks de recepcion" : "Checks de aprobacion"}</h2>
          <div className="grupo_checks">
            <CheckItem>
              <input
                type="checkbox"
                name="aprobadoCalidad"
                checked={cabeceraRecepcion.aprobadoCalidad}
                onChange={manejarCambioCabecera}
              />
              <span>Aprobado por calidad / almacen</span>
            </CheckItem>
            {!esModuloAlmacen ? (
              <CheckItem>
                <input
                  type="checkbox"
                  name="aprobadoPago"
                  checked={cabeceraRecepcion.aprobadoPago}
                  onChange={manejarCambioCabecera}
                />
                <span>Aprobado para pago</span>
              </CheckItem>
            ) : null}
          </div>
        </section>

        <section className="tarjeta">
          <h2>Procesos externos registrados</h2>
          {normalizarProcesosExternos(cabeceraRecepcion.procesosExternos || []).length === 0 ? (
            <p className="texto_suave">
              Esta OP no registra procesos externos.
            </p>
          ) : (
            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Proceso</th>
                    <th>Taller tercero</th>
                    <th>Estado</th>
                    <th>Responsable</th>
                    <th>Cantidad</th>
                    {!esModuloAlmacen ? <th>Costo unitario</th> : null}
                    {!esModuloAlmacen ? <th>Total</th> : null}
                    <th>Observacion</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizarProcesosExternos(cabeceraRecepcion.procesosExternos || []).map((proceso) => (
                    <tr key={proceso.id || `${proceso.tipoProceso}-${proceso.nombreTaller}`}>
                      <td>{proceso.tipoProceso || "-"}</td>
                      <td>{proceso.nombreTallerExterno || proceso.nombreTaller || "-"}</td>
                      <td>{proceso.estadoMovimiento || "-"}</td>
                      <td>{proceso.responsable || "-"}</td>
                      <td>{proceso.cantidad || 0}</td>
                      {!esModuloAlmacen ? (
                        <td>{formatearMontoSoles(proceso.costoUnitario)}</td>
                      ) : null}
                      {!esModuloAlmacen ? <td>{formatearMontoSoles(proceso.total)}</td> : null}
                      <td>{proceso.observacion || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta resumen">
          <h2>{esModuloAlmacen ? "Resumen rapido" : "Resumen de pago de la OP"}</h2>
          <div className="resumen__grid">
            {esModuloAlmacen ? (
              <>
                <div>
                  <span>Recepciones registradas</span>
                  <strong>{recepcionesRegistradas.length}</strong>
                </div>
                <div>
                  <span>Codigo OP</span>
                  <strong>{cabeceraRecepcion.codigoOp || "-"}</strong>
                </div>
                <div>
                  <span>Taller principal</span>
                  <strong>{cabeceraRecepcion.nombreTaller || "-"}</strong>
                </div>
                <div>
                  <span>Total recibido</span>
                  <strong>{calcularCantidadRecibida(cabeceraRecepcion)}</strong>
                </div>
                <div>
                  <span>Total incidencias</span>
                  <strong>
                    {calcularTotalIncidencias(cabeceraRecepcion.incidenciasRecepcion || [])}
                  </strong>
                </div>
                <div>
                  <span>Descuento por prenda</span>
                  <strong>{formatearMontoSoles(montoDescuentoPrendaActual)}</strong>
                </div>
                <div>
                  <span>Prendas descontadas</span>
                  <strong>{cantidadDescuentoPrendaActual}</strong>
                </div>
                <div>
                  <span>No pagables</span>
                  <strong>
                    {calcularTotalIncidenciasPorDestino(
                      cabeceraRecepcion.incidenciasRecepcion || [],
                      "NO PAGAR"
                    )}
                  </strong>
                </div>
                {cabeceraRecepcion.tipoRecepcion === "parcial" ? (
                  <div>
                    <span>Saldo pendiente de la OP</span>
                    <strong>
                      {Math.max(
                        0,
                        Number(cabeceraRecepcion.cantidadTotal || 0) -
                          calcularCantidadRecibida(cabeceraRecepcion)
                      )}
                    </strong>
                  </div>
                ) : null}
                <div>
                  <span>Procesos externos</span>
                  <strong>{normalizarProcesosExternos(cabeceraRecepcion.procesosExternos || []).length}</strong>
                </div>
                <div>
                  <span>Estado calidad</span>
                  <strong>{cabeceraRecepcion.aprobadoCalidad ? "Aprobado" : "Pendiente"}</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>Estado pago</span>
                  <strong className={`texto_estado ${obtenerEstadoPagoRecepcion(cabeceraRecepcion).clase}`}>
                    {obtenerEstadoPagoRecepcion(cabeceraRecepcion).texto}
                  </strong>
                </div>
                <div>
                  <span>Codigo OP</span>
                  <strong>{cabeceraRecepcion.codigoOp || "-"}</strong>
                </div>
                <div>
                  <span>Taller principal</span>
                  <strong>{cabeceraRecepcion.nombreTaller || "-"}</strong>
                </div>
                <div>
                  <span>Total taller principal</span>
                  <strong>{formatearMontoSoles(calcularTotalPrincipalRecepcion(cabeceraRecepcion))}</strong>
                </div>
                <div>
                  <span>Total procesos externos</span>
                  <strong>{formatearMontoSoles(cabeceraRecepcion.totalProcesosExternos)}</strong>
                </div>
                <div>
                  <span>Total general</span>
                  <strong>{formatearMontoSoles(totalPagarActual)}</strong>
                </div>
                <div>
                  <span>Descuento por prenda</span>
                  <strong>{formatearMontoSoles(montoDescuentoPrendaActual)}</strong>
                </div>
                <div>
                  <span>Ajuste no pagar</span>
                  <strong>{formatearMontoSoles(descuentoNoPagarActual)}</strong>
                </div>
                <div>
                  <span>Adelanto registrado</span>
                  <strong>{formatearMontoSoles(cabeceraRecepcion.adelantoTaller)}</strong>
                </div>
                <div>
                  <span>Ya pagado</span>
                  <strong>{formatearMontoSoles(montoPagadoActual)}</strong>
                </div>
                <div>
                  <span>Saldo final a pagar</span>
                  <strong>{formatearMontoSoles(saldoPagoActual)}</strong>
                </div>
                <div>
                  <span>Total recibido</span>
                  <strong>{calcularCantidadRecibida(cabeceraRecepcion)}</strong>
                </div>
                <div>
                  <span>Estado calidad</span>
                  <strong>{cabeceraRecepcion.aprobadoCalidad ? "Aprobado" : "Pendiente"}</strong>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="acciones">
          {!recepcionYaRegistrada ? (
            <button type="button" className="btn btn_secundario" onClick={manejarGuardar}>
              Guardar
            </button>
          ) : null}
          {esModuloAlmacen && puedeVolverATallerPrincipal ? (
            <button
              type="button"
              className="btn btn_secundario"
              onClick={manejarVolverATallerPrincipal}
            >
              Volver al taller principal
            </button>
          ) : null}
          {esModuloAlmacen && cabeceraRecepcion.derivarProcesoExterno ? (
            <button
              type="button"
              className="btn btn_secundario"
              onClick={manejarEnviarATerceros}
            >
              Enviar a terceros
            </button>
          ) : null}
          {produccionListaParaAprobarPago ? (
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() =>
                manejarConfirmarRecepcion({ forzarSinAprobacionPago: true })
              }
            >
              Actualizar recepcion
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn_principal"
            onClick={manejarConfirmarRecepcion}
          >
            {textoAccionRecepcion}
          </button>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
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

  .resumen_recepcion_principal {
    margin-bottom: 18px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .resumen_recepcion_principal div {
    background-color: ${({ theme }) => theme.bgtotal};
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 14px 16px;
  }

  .resumen_recepcion_principal span {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .resumen_recepcion_principal strong {
    font-size: 18px;
    color: ${({ theme }) => theme.text};
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
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 6px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    background: ${({ theme }) => theme.bgcards};
    width: fit-content;
  }

  .pestana {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 10px;
    padding: 10px 14px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    font-weight: 700;
    cursor: pointer;
  }

  .pestana_activa {
    border-color: ${({ theme }) => theme.bg5};
    background: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .grid {
    display: grid;
    gap: 14px;
  }

  .grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  .tabla_detalle_recepcion {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 6px;
    background-color: ${({ theme }) => theme.bgtotal};
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 780px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d6dee8" : theme.bg4)};
    text-align: left;
    vertical-align: top;
  }

  th {
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    background-color: ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#f7f9fc" : "transparent")};
  }

  .tabla_recepcion_operativa {
    min-width: 1320px;
  }

  .columna_color_recepcion {
    min-width: 130px;
  }

  .columna_grupo_recepcion {
    text-align: center;
    font-size: 12px;
    letter-spacing: 0.02em;
  }

  .columna_grupo_recepcion_divisor,
  .columna_bloque_divisor,
  .celda_bloque_divisor {
    border-right: 1px solid
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(117, 1, 152, 0.22)"
          : "rgba(230, 205, 238, 0.18)"};
  }

  .columna_plan_recepcion,
  .columna_acumulado_recepcion {
    min-width: 58px;
    text-align: center;
    font-size: 11px;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .columna_recibe_recepcion {
    min-width: 62px;
    text-align: center;
    font-size: 12px;
    color: ${({ theme }) => theme.text};
  }

  .columna_total_recepcion {
    min-width: 88px;
    text-align: center;
  }

  .celda_color_recepcion {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    white-space: nowrap;
  }

  .celda_plan_recepcion,
  .celda_acumulado_recepcion,
  .celda_total_recepcion {
    text-align: center;
    font-size: 13px;
  }

  .celda_plan_recepcion,
  .celda_acumulado_recepcion {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .celda_total_recepcion {
    font-weight: 700;
  }

  .celda_recibe_recepcion {
    padding: 5px 3px;
  }

  .celda_recibe_recepcion input {
    width: 58px;
    min-width: 58px;
    min-height: 34px;
    border-radius: 8px;
    border: 1px solid ${({ theme }) => theme.bg5};
    background: rgba(117, 1, 152, 0.12);
    color: ${({ theme }) => theme.text};
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    padding: 0 4px;
  }

  .tabla_incidencias_recepcion input,
  .tabla_incidencias_recepcion select {
    width: 100%;
    min-height: 36px;
    border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 8px;
    padding: 8px 10px;
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
  }

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 20px;
  }

  .texto_incidencias_historial {
    display: block;
    margin-top: 6px;
    color: #ffcf70;
    font-size: 12px;
    font-weight: 600;
  }

  .aviso_tercerizacion {
    grid-column: 1 / -1;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(100, 196, 255, 0.24);
    background: rgba(100, 196, 255, 0.08);
    color: ${({ theme }) => theme.text};
    font-size: 13px;
    line-height: 1.5;
  }

  .grupo_detalles_resumen {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    min-height: 44px;
    align-items: center;
    padding: 10px 0 4px;
  }

  .chip_detalle_recepcion {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#f4f7fb" : "rgba(255,255,255,0.04)"};
    color: ${({ theme }) => theme.text};
    font-size: 13px;
    font-weight: 700;
  }

  .chip_detalle_recepcion_vacio {
    color: ${({ theme }) => theme.colorSubtitle};
    font-weight: 600;
  }

  .grupo_checks {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
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

  .resumen_estados {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .chip_estado {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .chip_entrega {
    min-height: 30px;
    font-size: 12px;
    padding: 5px 10px;
  }

  .estado_neutro {
    background: rgba(255, 255, 255, 0.08);
    color: ${({ theme }) => theme.colorSubtitle};
    border-color: ${({ theme }) => theme.bg4};
  }

  .estado_pendiente {
    background: rgba(255, 184, 77, 0.12);
    color: #ffcf70;
    border-color: rgba(255, 184, 77, 0.35);
  }

  .estado_observado {
    background: rgba(255, 122, 89, 0.12);
    color: #ff9f85;
    border-color: rgba(255, 122, 89, 0.35);
  }

  .estado_activo {
    background: rgba(111, 127, 255, 0.14);
    color: #b2bcff;
    border-color: rgba(111, 127, 255, 0.36);
  }

  .estado_parcial {
    background: rgba(100, 196, 255, 0.12);
    color: #9fdcff;
    border-color: rgba(100, 196, 255, 0.35);
  }

  .estado_recibido {
    background: rgba(100, 196, 255, 0.12);
    color: #9fdcff;
    border-color: rgba(100, 196, 255, 0.35);
  }

  .estado_aprobado {
    background: rgba(78, 201, 140, 0.12);
    color: #86e0ad;
    border-color: rgba(78, 201, 140, 0.35);
  }

  .estado_pagado {
    background: rgba(100, 196, 255, 0.12);
    color: #9fdcff;
    border-color: rgba(100, 196, 255, 0.35);
  }

  .texto_estado {
    display: inline-block;
  }

  .acciones,
  .paginacion {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
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

  .btn_principal:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
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

  @media (min-width: 900px) and (max-width: 1366px) and (orientation: landscape) {
    gap: 12px;
    padding: 12px;

    .cabecera,
    .tarjeta {
      padding: 16px;
      border-radius: 14px;
    }

    .cabecera {
      gap: 10px;
    }

    .cabecera h1 {
      font-size: 30px;
      line-height: 1.08;
    }

    .tarjeta h2 {
      font-size: 18px;
      margin-bottom: 6px;
    }

    .cabecera p,
    .tarjeta p,
    .texto_suave {
      font-size: 12px;
      line-height: 1.35;
    }

    .cabecera__estado {
      padding: 10px 12px;
      border-radius: 12px;
    }

    .cabecera__estado span {
      font-size: 12px;
      margin-bottom: 4px;
    }

    .cabecera__estado strong {
      font-size: 20px;
    }

    .resumen_recepcion_principal {
      margin-bottom: 14px;
      gap: 10px;
    }

    .resumen_recepcion_principal div {
      padding: 12px 14px;
      border-radius: 12px;
    }

    .resumen_recepcion_principal strong {
      font-size: 16px;
    }

    .fila_superior,
    .navegacion_superior,
    .tarjeta__encabezado,
    .acciones,
    .paginacion,
    .resumen_estados,
    .grupo_checks,
    .grupo_detalles_resumen,
    .resumen__grid {
      gap: 10px;
    }

    .pestanas {
      gap: 8px;
      padding: 6px;
    }

    .pestana,
    .btn,
    .btn_enlace,
    .boton_volver {
      min-height: 38px;
      padding: 8px 12px;
      font-size: 12px;
      border-radius: 10px;
    }

    .btn_tabla {
      padding: 8px 10px;
    }

    .buscador {
      margin-bottom: 12px;
    }

    .buscador input {
      padding: 11px 13px;
      font-size: 13px;
    }

    .grid {
      gap: 12px;
    }

    .grid-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tabla_detalle_recepcion {
      padding: 4px;
      border-radius: 12px;
    }

    table {
      min-width: 720px;
    }

    .tabla_recepcion_operativa {
      min-width: 1120px;
    }

    th,
    td {
      padding: 8px 7px;
      font-size: 12px;
    }

    th {
      font-size: 11px;
      line-height: 1.2;
    }

    .columna_color_recepcion {
      min-width: 118px;
    }

    .columna_plan_recepcion,
    .columna_acumulado_recepcion,
    .columna_recibe_recepcion {
      min-width: 52px;
    }

    .columna_total_recepcion {
      min-width: 76px;
    }

    .celda_plan_recepcion,
    .celda_acumulado_recepcion,
    .celda_total_recepcion {
      font-size: 12px;
    }

    .celda_recibe_recepcion {
      padding: 4px 2px;
    }

    .celda_recibe_recepcion input {
      width: 50px;
      min-width: 50px;
      min-height: 30px;
      font-size: 12px;
    }

    .tabla_incidencias_recepcion input,
    .tabla_incidencias_recepcion select {
      min-height: 34px;
      padding: 7px 9px;
      font-size: 12px;
    }

    .chip_detalle_recepcion,
    .chip_estado {
      min-height: 30px;
      padding: 5px 10px;
      font-size: 12px;
    }

    .resumen__grid span {
      font-size: 12px;
    }

    .resumen__grid strong {
      font-size: 16px;
    }
  }

  @media (max-width: 860px) {
    .grid-2,
    .resumen__grid,
    .resumen_recepcion_principal {
      grid-template-columns: 1fr;
    }

    .fila_superior,
    .navegacion_superior,
    .tarjeta__encabezado,
    .resumen_estados,
    .acciones,
    .paginacion {
      flex-direction: column;
      align-items: stretch;
    }

    .btn,
    .btn_enlace,
    .boton_volver {
      width: 100%;
      justify-content: center;
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
    border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  input[type="date"]::-webkit-calendar-picker-indicator {
    cursor: pointer;
    filter: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "none" : "invert(1) brightness(1.15)"};
    opacity: 1;
  }

  input[type="date"]::-moz-calendar-picker-indicator {
    filter: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "none" : "invert(1) brightness(1.15)"};
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

  @media (min-width: 900px) and (max-width: 1366px) and (orientation: landscape) {
    gap: 6px;

    label {
      font-size: 12px;
    }

    input,
    textarea,
    select {
      min-height: 38px;
      padding: 9px 10px;
      font-size: 13px;
      border-radius: 10px;
    }

    textarea {
      min-height: 88px;
    }
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

const CheckItem = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background-color: ${({ theme }) => theme.bg};
  border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
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



