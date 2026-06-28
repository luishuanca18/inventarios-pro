import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, UserAuth } from "../../index";
import { VisorFotosModelo } from "../../components/moleculas/VisorFotosModelo";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";
import { leerFichasTalleres } from "../../utils/fichasTalleres";
import { leerPerfilUsuario } from "../../utils/perfilUsuario";
import { VERSION_SISTEMA } from "../../utils/versionSistema";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";

const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_TERCERIZACIONES = "cynara_tercerizaciones_op";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_TALLER_SELECCIONADO = "cynara_taller_sesion_demo";
const CLAVE_ASIGNACIONES_TALLER = "cynara_asignaciones_taller";
const CLAVE_DESCUENTOS_TALLER = "cynara_descuentos_taller";
const TALLAS_DISPONIBLES = ["S", "M", "L", "XL", "XXL"];
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

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

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const normalizarTipoAjusteManual = (valor = "DESCUENTA") =>
  String(valor || "").toUpperCase() === "AUMENTA" ? "AUMENTA" : "DESCUENTA";

const formatearMoneda = (valor) =>
  convertirNumero(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatearMontoSoles = (valor) => `S/ ${formatearMoneda(valor)}`;

const convertirFechaTextoAFecha = (valor = "") => {
  const texto = String(valor || "").trim();

  if (!texto) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [anio, mes, dia] = texto.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, anio] = texto.split("/").map(Number);
    return new Date(anio, mes - 1, dia);
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(texto)) {
    const [dia, mes, anio] = texto.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
  }

  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const formatearFechaCorta = (valor = "") => {
  const fecha = convertirFechaTextoAFecha(valor);

  if (!fecha) {
    return valor || "-";
  }

  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();

  return `${dia}/${mes}/${anio}`;
};

const calcularResumenEntrega = (fechaEntrega = "") => {
  const fecha = convertirFechaTextoAFecha(fechaEntrega);

  if (!fecha) {
    return {
      texto: "Sin fecha",
      clase: "entrega_sin_fecha",
      diasRestantes: null,
      esHoy: false,
      estaAtrasada: false,
      porVencer: false,
    };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaNormalizada = new Date(fecha);
  fechaNormalizada.setHours(0, 0, 0, 0);

  const diferenciaMs = fechaNormalizada.getTime() - hoy.getTime();
  const diasRestantes = Math.round(diferenciaMs / 86400000);

  if (diasRestantes < 0) {
    const atraso = Math.abs(diasRestantes);
    return {
      texto: `${atraso} dia${atraso === 1 ? "" : "s"} de atraso`,
      clase: "entrega_atrasada",
      diasRestantes,
      esHoy: false,
      estaAtrasada: true,
      porVencer: false,
    };
  }

  if (diasRestantes === 0) {
    return {
      texto: "Entrega hoy",
      clase: "entrega_hoy",
      diasRestantes,
      esHoy: true,
      estaAtrasada: false,
      porVencer: false,
    };
  }

  if (diasRestantes <= 2) {
    return {
      texto: `Vence en ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`,
      clase: "entrega_por_vencer",
      diasRestantes,
      esHoy: false,
      estaAtrasada: false,
      porVencer: true,
    };
  }

  return {
    texto: `${diasRestantes} dias restantes`,
    clase: "entrega_programada",
    diasRestantes,
    esHoy: false,
    estaAtrasada: false,
    porVencer: false,
  };
};

const leerDescuentosTaller = () => leerListaGuardada(CLAVE_DESCUENTOS_TALLER);

const normalizarTextoTaller = (valor = "") =>
  String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "");

const obtenerDetallesConfeccionTaller = (salida = {}) => {
  const detallesSalida = salida?.detallesConfeccion || {};
  if (Object.keys(detallesSalida).length > 0) {
    return detallesSalida;
  }

  const cortes = leerListaGuardada(CLAVE_HISTORIAL_CORTES);
  const corteRelacionado = cortes.find(
    (item) => item?.cabeceraCorte?.codigoCorte === salida?.codigoOp
  );

  const modeloSalidaNormalizado = normalizarTextoTaller(
    salida?.modelo || salida?.modeloBase || ""
  );
  const modeloPrincipalNormalizado = normalizarTextoTaller(
    corteRelacionado?.cabeceraCorte?.modeloBase || ""
  );
  const esDerivadoOtroModelo =
    salida?.tipoSalida === "HIJO DE OP" &&
    String(salida?.tipoHijo || "").trim().toUpperCase() === "OTRO_MODELO";
  const esModeloDistintoDelPrincipal =
    Boolean(modeloSalidaNormalizado) &&
    Boolean(modeloPrincipalNormalizado) &&
    modeloSalidaNormalizado !== modeloPrincipalNormalizado;

  if (esDerivadoOtroModelo || esModeloDistintoDelPrincipal) {
    return {};
  }

  return corteRelacionado?.cabeceraCorte?.detallesConfeccion || {};
};

const obtenerMontoAjusteFirmado = (ajuste = {}) => {
  const monto = convertirNumero(ajuste?.montoDescuento);
  return normalizarTipoAjusteManual(ajuste?.tipoAjusteManual) === "AUMENTA"
    ? -monto
    : monto;
};

const crearTotalesPorTallaVacio = () =>
  TALLAS_DISPONIBLES.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: 0,
    }),
    {}
  );

const obtenerTallasActivas = (tallasSeleccionadas = [], totales = {}) => {
  if (Array.isArray(tallasSeleccionadas) && tallasSeleccionadas.length > 0) {
    return TALLAS_DISPONIBLES.filter((talla) => tallasSeleccionadas.includes(talla));
  }

  const tallasConContenido = TALLAS_DISPONIBLES.filter(
    (talla) => convertirNumero(totales?.[talla]) > 0
  );

  return tallasConContenido.length > 0 ? tallasConContenido : [...TALLAS_DISPONIBLES];
};

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const leerAsignacionesTaller = () => {
  const contenido = localStorage.getItem(CLAVE_ASIGNACIONES_TALLER);

  if (!contenido) {
    return {};
  }

  try {
    const data = JSON.parse(contenido);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
};

const esCuentaAdministrativa = (email = "") => {
  const correo = normalizarTexto(email);

  return (
    correo.includes("admin") ||
    correo.includes("prueba") ||
    correo.includes("rosa") ||
    correo.includes("luis") ||
    correo.includes("produccion") ||
    correo.includes("almacen")
  );
};

const resolverFichaTallerPorIdentidad = (
  { email = "", tallerId = "", tallerCodigo = "", tallerAsignado = "" } = {},
  fichas = [],
) => {
  const lista = Array.isArray(fichas) ? fichas : [];

  if (tallerId) {
    const porId = lista.find((item) => String(item?.id || "") === String(tallerId));
    if (porId) {
      return porId;
    }
  }

  if (tallerCodigo) {
    const codigoNormalizado = normalizarTexto(tallerCodigo);
    const porCodigo = lista.find(
      (item) => normalizarTexto(item?.codigoTaller) === codigoNormalizado,
    );
    if (porCodigo) {
      return porCodigo;
    }
  }

  if (tallerAsignado) {
    const nombreNormalizado = normalizarTexto(tallerAsignado);
    const porNombre = lista.find(
      (item) => normalizarTexto(item?.nombreTaller) === nombreNormalizado,
    );
    if (porNombre) {
      return porNombre;
    }
  }

  if (email) {
    const asignaciones = leerAsignacionesTaller();
    const tallerAsignadoLocal = asignaciones[email] || asignaciones[email.toLowerCase()];

    if (tallerAsignadoLocal) {
      const nombreAsignado = normalizarTexto(tallerAsignadoLocal);
      const porAsignacionLocal = lista.find(
        (item) => normalizarTexto(item?.nombreTaller) === nombreAsignado,
      );
      if (porAsignacionLocal) {
        return porAsignacionLocal;
      }
    }

    const correoNormalizado = normalizarTexto(email);
    const porCorreo = lista.find((item) => {
      const tallerNormalizado = normalizarTexto(
        (item?.nombreTaller || "").replace(/^taller/i, ""),
      );
      return tallerNormalizado && correoNormalizado.includes(tallerNormalizado);
    });

    if (porCorreo) {
      return porCorreo;
    }
  }

  return null;
};

const resolverTallerInicial = (
  { email = "", tallerId = "", tallerCodigo = "", tallerAsignado = "" } = {},
  fichas = [],
) => {
  const talleresDisponibles = (Array.isArray(fichas) ? fichas : [])
    .map((item) => item?.nombreTaller)
    .filter(Boolean);

  if (!esCuentaAdministrativa(email)) {
    return (
      resolverFichaTallerPorIdentidad({ email, tallerId, tallerCodigo, tallerAsignado }, fichas)
        ?.nombreTaller || ""
    );
  }

  const tallerGuardado = localStorage.getItem(CLAVE_TALLER_SELECCIONADO) || "";

  if (tallerGuardado && talleresDisponibles.includes(tallerGuardado)) {
    return tallerGuardado;
  }

  const fichaCoincidente = resolverFichaTallerPorIdentidad(
    { email, tallerId, tallerCodigo, tallerAsignado },
    fichas,
  );

  return fichaCoincidente?.nombreTaller || talleresDisponibles[0] || "";
};

const obtenerEstadoOp = (salida, recepcion) => {
  if (
    recepcion?.cabeceraRecepcion?.aprobadoPago &&
    calcularSaldoPendienteItem({
      totalPagarTaller:
        recepcion?.cabeceraRecepcion?.totalPagarTaller ?? salida?.totalPagarTaller,
      recepcion,
    }) <= 0
  ) {
    return { texto: "Pagado", clase: "estado_aprobado" };
  }

  if (recepcion?.cabeceraRecepcion?.aprobadoPago) {
    return { texto: "Pago pendiente", clase: "estado_recibido" };
  }

  if (recepcion?.cabeceraRecepcion?.codigoOp) {
    return { texto: "Recepcionada", clase: "estado_recibido" };
  }

  if (salida?.enviadoTaller) {
    return { texto: "En produccion", clase: "estado_activo" };
  }

  return { texto: "Pendiente", clase: "estado_pendiente" };
};

const obtenerEstadoServicioTercero = (registro = {}) => {
  if (registro?.aprobadoProduccion) {
    return { texto: "Pago aprobado", clase: "estado_aprobado" };
  }

  if (registro?.fechaRetornoTercero) {
    return { texto: "Retornado", clase: "estado_recibido" };
  }

  if (registro?.fechaEnvioTercero) {
    return { texto: "En tercero", clase: "estado_activo" };
  }

  if (registro?.fechaRecepcionAlmacen) {
    return { texto: "Listo para envio", clase: "estado_pendiente" };
  }

  return { texto: "Pendiente de control", clase: "estado_observado" };
};

const obtenerDetallesActivos = (detalles = {}) =>
  Object.entries(detalles)
    .filter(
      ([clave, valor]) =>
        clave !== "cantidadAgujas" &&
        clave !== "otroDetalle" &&
        Boolean(valor)
    )
    .map(([clave]) => clave.replaceAll("_", " "));

const construirDetalleColorTallaOp = (op = {}) => {
  if (Array.isArray(op?.detalleColorTalla) && op.detalleColorTalla.length > 0) {
    return op.detalleColorTalla.filter((fila) =>
      TALLAS_DISPONIBLES.some((talla) => convertirNumero(fila?.salidas?.[talla]) > 0)
    );
  }

  const tallasActivas = obtenerTallasActivas(op?.tallasActivas || [], op?.totalesPorTalla || {});

  if (tallasActivas.length === 0) {
    return [];
  }

  return [
    {
      id: `${op?.id || op?.codigoOp || "op"}-detalle`,
      colorBase: op?.colorBase || "VARIOS",
      salidas: tallasActivas.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: convertirNumero(op?.totalesPorTalla?.[talla]),
        }),
        {}
      ),
    },
  ];
};

const normalizarIncidenciasRecepcion = (incidencias = []) =>
  Array.isArray(incidencias)
    ? incidencias.map((incidencia, indice) => ({
        id: incidencia?.id || `inc-taller-${indice + 1}`,
        colorBase: incidencia?.colorBase || "",
        talla: incidencia?.talla || "",
        cantidad: convertirNumero(incidencia?.cantidad),
        motivo: incidencia?.motivo || "",
        destino: incidencia?.destino || "NO PAGAR",
      }))
    : [];

const calcularCantidadIncidenciasPorDestino = (incidencias = [], destino = "") =>
  normalizarIncidenciasRecepcion(incidencias)
    .filter((incidencia) => incidencia.destino === destino)
    .reduce((total, incidencia) => total + convertirNumero(incidencia.cantidad), 0);

const calcularCostoUnitarioTaller = (item = {}) => {
  const cantidadBase = convertirNumero(item?.cantidadTotal);

  if (cantidadBase <= 0) {
    return 0;
  }

  const totalPrincipal = convertirNumero(item?.totalTallerPrincipal);

  if (totalPrincipal > 0) {
    return totalPrincipal / cantidadBase;
  }

  return convertirNumero(item?.totalPagarTaller) / cantidadBase;
};

const calcularMontoIncidenciasPorDestino = (item = {}, destino = "") =>
  calcularCostoUnitarioTaller(item) *
  calcularCantidadIncidenciasPorDestino(
    item?.recepcion?.cabeceraRecepcion?.incidenciasRecepcion || [],
    destino
  );

const calcularMontoPagadoAcumuladoItem = (item = {}) =>
  convertirNumero(
    item?.recepcion?.cabeceraRecepcion?.montoPagadoAcumulado ?? item?.montoPagadoAcumulado
  );

const estaOpPagadaItem = (item = {}) =>
  Boolean(item?.recepcion?.cabeceraRecepcion?.pagadoTaller);

const obtenerAdelantoAcumuladoItem = (item = {}) =>
  convertirNumero(
    item?.recepcion?.cabeceraRecepcion?.adelantoTaller ?? item?.adelantoAcumulado
  );

const calcularDescuentoDetalladoServicioTercero = (item = {}) =>
  (Array.isArray(item?.descuentosPrendaTercero) ? item.descuentosPrendaTercero : []).reduce(
    (total, descuento) =>
      total +
      convertirNumero(descuento?.cantidad) * convertirNumero(descuento?.precioUnitario),
    0
  );

const obtenerDetallesDescuentoServicioTercero = (item = {}) =>
  (Array.isArray(item?.descuentosPrendaTercero) ? item.descuentosPrendaTercero : []).filter(
    (descuento) =>
      convertirNumero(descuento?.cantidad) > 0 &&
      convertirNumero(descuento?.precioUnitario) > 0
  );

const calcularTotalBrutoServicioTercero = (item = {}) => {
  const subtotal = convertirNumero(item?.subtotalServicio);
  if (subtotal > 0) {
    return subtotal;
  }

  const cantidadPorCosto =
    convertirNumero(item?.cantidadTotal) * convertirNumero(item?.costoUnitario);
  if (cantidadPorCosto > 0) {
    return cantidadPorCosto;
  }

  return (
    convertirNumero(item?.totalPagarTaller) +
    convertirNumero(item?.totalDescuento) +
    calcularDescuentoDetalladoServicioTercero(item)
  );
};

const calcularTotalNetoServicioTercero = (item = {}) => {
  const esServicioTercero =
    convertirNumero(item?.totalTallerPrincipal) <= 0 &&
    convertirNumero(item?.totalProcesosExternos) > 0;

  if (!esServicioTercero) {
    return convertirNumero(item?.totalPagarTaller);
  }

  if (convertirNumero(item?.subtotalServicio) > 0 && convertirNumero(item?.totalPagarTaller) > 0) {
    return convertirNumero(item?.totalPagarTaller);
  }

  return Math.max(
    0,
    calcularTotalBrutoServicioTercero(item) -
      (convertirNumero(item?.totalDescuento) ||
        calcularDescuentoDetalladoServicioTercero(item))
  );
};

const obtenerAjustesManualesItem = (item = {}) => {
  const descuentos = leerDescuentosTaller();
  const esServicioTercero =
    convertirNumero(item?.totalTallerPrincipal) <= 0 &&
    convertirNumero(item?.totalProcesosExternos) > 0;
  const tipoPago = esServicioTercero ? "SERVICIO_TERCERO" : "OP_PRINCIPAL";
  const registroId = esServicioTercero ? item?.id : item?.recepcion?.id;

  return descuentos
    .filter(
      (descuento) =>
        descuento?.tipoPago === tipoPago &&
        String(descuento?.registroId || "") === String(registroId || "")
    )
    .sort((a, b) => String(b?.fechaDescuento || "").localeCompare(String(a?.fechaDescuento || "")));
};

const calcularDescuentoAcumuladoItem = (item = {}) =>
  obtenerAjustesManualesItem(item).reduce(
    (total, descuento) => total + obtenerMontoAjusteFirmado(descuento),
    0
  );

const formatearMontoAjuste = (valor = 0) => {
  const monto = convertirNumero(valor);

  if (monto === 0) {
    return formatearMontoSoles(0);
  }

  return `${monto < 0 ? "+" : "-"} ${formatearMontoSoles(Math.abs(monto))}`;
};

const calcularSaldoPendienteItem = (item = {}) => {
  if (estaOpPagadaItem(item)) {
    return 0;
  }

  return (
    calcularTotalNetoServicioTercero(item) -
    calcularMontoPagadoAcumuladoItem(item) -
    calcularDescuentoAcumuladoItem(item)
  );
};

const calcularSaldoNetoPendienteItem = (item = {}) =>
  estaOpPagadaItem(item)
    ? 0
    : Math.max(0, calcularSaldoPendienteItem(item) - obtenerAdelantoAcumuladoItem(item));

const construirResumenIncidencias = (item = {}) => {
  const incidencias = normalizarIncidenciasRecepcion(
    item?.recepcion?.cabeceraRecepcion?.incidenciasRecepcion || []
  );
  const noPagarCantidad = calcularCantidadIncidenciasPorDestino(incidencias, "NO PAGAR");
  const evaluarCantidad = calcularCantidadIncidenciasPorDestino(incidencias, "EVALUAR");
  const remateCantidad = calcularCantidadIncidenciasPorDestino(incidencias, "REMATE");
  const reprocesoCantidad = calcularCantidadIncidenciasPorDestino(incidencias, "REPROCESO");
  const descuentoNoPagar = calcularMontoIncidenciasPorDestino(item, "NO PAGAR");
  const montoEvaluar = calcularMontoIncidenciasPorDestino(item, "EVALUAR");
  const motivos = [...new Set(incidencias.map((incidencia) => incidencia?.motivo?.trim()).filter(Boolean))];
  const detalleCorto = incidencias
    .filter((incidencia) => incidencia.cantidad > 0)
    .slice(0, 3)
    .map((incidencia) =>
      `${incidencia.colorBase || "-"} / ${incidencia.talla || "-"} / ${incidencia.cantidad} / ${
        incidencia.destino || "-"
      }`
    );

  return {
    totalIncidencias: incidencias.reduce(
      (total, incidencia) => total + convertirNumero(incidencia.cantidad),
      0
    ),
    noPagarCantidad,
    evaluarCantidad,
    remateCantidad,
    reprocesoCantidad,
    descuentoNoPagar,
    montoEvaluar,
    motivos,
    detalleCorto,
  };
};

const crearDatosTaller = (nombreTaller) => {
  const reservasPendientes = leerListaGuardada(CLAVE_SALIDAS_TALLER).filter(
    (item) =>
      item?.tipoRegistro === "op_base" &&
      !item?.enviadoTaller &&
      convertirNumero(item?.totalUnidades) > 0 &&
      normalizarTexto(item?.tallerReservado || item?.nombreTaller || "") ===
        normalizarTexto(nombreTaller)
  );
  const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER).filter(
    (item) => item?.enviadoTaller && item?.nombreTaller === nombreTaller
  );
  const recepciones = leerListaGuardada(CLAVE_RECEPCIONES_TALLER).filter(
    (item) => item?.cabeceraRecepcion?.nombreTaller === nombreTaller
  );
  const recepcionesPorOp = new Map(
    recepciones.map((item) => [
      item?.cabeceraRecepcion?.itemSalidaId || item?.cabeceraRecepcion?.codigoOp,
      item,
    ])
  );

  const opDelTaller = salidas.map((salida) => {
    const recepcion = recepcionesPorOp.get(salida?.id || salida?.codigoOp);
    const estado = obtenerEstadoOp(salida, recepcion);
    const totalesPorTalla = {
      ...crearTotalesPorTallaVacio(),
      ...(salida?.totalesPorTalla || {}),
    };
    const tallasActivas = obtenerTallasActivas(salida?.tallasActivas || [], totalesPorTalla);

    return {
      ...salida,
      detallesConfeccion: obtenerDetallesConfeccionTaller(salida),
      adelantoAcumulado: obtenerAdelantoAcumuladoItem({
        ...salida,
        recepcion,
      }),
      totalesPorTalla,
      tallasActivas,
      recepcion,
      estado,
      resumenIncidencias: construirResumenIncidencias({
        ...salida,
        recepcion,
      }),
    };
  });

  const opReservadas = reservasPendientes.map((reserva) => {
    const totalesPorTalla = {
      ...crearTotalesPorTallaVacio(),
      ...(reserva?.totalesPorTalla || {}),
    };
    const tallasActivas = obtenerTallasActivas(reserva?.tallasActivas || [], totalesPorTalla);

    return {
      ...reserva,
      nombreTaller: reserva?.tallerReservado || reserva?.nombreTaller || nombreTaller,
      detallesConfeccion: obtenerDetallesConfeccionTaller(reserva),
      adelantoAcumulado: 0,
      totalesPorTalla,
      tallasActivas,
      recepcion: null,
      estado: { texto: "Asignada por produccion", clase: "estado_pendiente" },
      resumenIncidencias: "Sin descuentos ni ajustes registrados.",
      resumenEntrega: calcularResumenEntrega(reserva?.fechaEntrega),
    };
  });

  const serviciosTerceros = leerListaGuardada(CLAVE_TERCERIZACIONES)
    .filter((item) => item?.tallerTercero === nombreTaller)
    .map((registro) => ({
      id: registro?.id || registro?.codigoTercerizacion,
      codigoOp: registro?.codigoTercerizacion || registro?.codigoOp,
      nombreTaller: registro?.tallerTercero || nombreTaller,
      modelo: `${registro?.proceso || "SERVICIO"} | ${registro?.modelo || "-"}`,
      modeloBase: `${registro?.proceso || "SERVICIO"} | ${registro?.modelo || "-"}`,
      fechaEnvio: registro?.fechaEnvioTercero || registro?.fechaSolicitud || "",
      fechaEntrega: registro?.fechaRetornoTercero || "",
      cantidadTotal: convertirNumero(registro?.cantidad),
      totalesPorTalla: {
        ...crearTotalesPorTallaVacio(),
        S: convertirNumero(registro?.cantidad),
      },
      tallasActivas: ["S"],
      totalTallerPrincipal: 0,
      totalProcesosExternos: convertirNumero(registro?.total),
      totalPagarTaller: convertirNumero(registro?.total),
      subtotalServicio: convertirNumero(registro?.subtotalServicio),
      totalDescuento:
        convertirNumero(registro?.totalDescuento) ||
        calcularDescuentoDetalladoServicioTercero(registro),
      descuentosPrendaTercero: Array.isArray(registro?.descuentosPrendaTercero)
        ? registro?.descuentosPrendaTercero
        : [],
      montoPagadoAcumulado: convertirNumero(registro?.montoPagadoAcumulado),
      costoUnitario: convertirNumero(registro?.costoUnitario),
      adelantoAcumulado: 0,
      detallesConfeccion: {},
      procesosExternos: [],
      productoDerivado: false,
      recepcion: registro?.fechaRetornoTercero
        ? {
            cabeceraRecepcion: {
              codigoOp: registro?.codigoTercerizacion,
              aprobadoPago: registro?.aprobadoProduccion,
              pagadoTaller: registro?.pagadoProduccion,
              montoPagadoAcumulado: convertirNumero(registro?.montoPagadoAcumulado),
            },
          }
        : null,
      estado: obtenerEstadoServicioTercero(registro),
      resumenIncidencias: construirResumenIncidencias({
        totalPagarTaller: convertirNumero(registro?.total),
        descuentosPrendaTercero: Array.isArray(registro?.descuentosPrendaTercero)
          ? registro?.descuentosPrendaTercero
          : [],
        recepcion: registro?.fechaRetornoTercero
          ? {
              cabeceraRecepcion: {
                codigoOp: registro?.codigoTercerizacion,
                aprobadoPago: registro?.aprobadoProduccion,
                pagadoTaller: registro?.pagadoProduccion,
                montoPagadoAcumulado: convertirNumero(registro?.montoPagadoAcumulado),
              },
            }
          : null,
      }),
    }));

  const historialBase = [...opDelTaller, ...serviciosTerceros].map((item) => ({
    ...item,
    resumenEntrega: calcularResumenEntrega(item?.fechaEntrega),
  }));
  const opActivas = historialBase.filter(
    (item) => !item?.recepcion?.cabeceraRecepcion?.codigoOp
  );
  const historial = [...historialBase].sort((a, b) =>
    String(b?.fechaEnvio || "").localeCompare(String(a?.fechaEnvio || ""))
  );

  const totalPendientePago = historial.reduce((total, item) => {
    return total + Math.max(0, calcularSaldoPendienteItem(item));
  }, 0);

  const totalAdelantos = historial.reduce(
    (total, item) => total + obtenerAdelantoAcumuladoItem(item),
    0
  );

  const totalAprobadoPago = historial.reduce((total, item) => {
    if (
      !item?.recepcion?.cabeceraRecepcion?.aprobadoPago ||
      calcularSaldoNetoPendienteItem(item) <= 0
    ) {
      return total;
    }

    return total + calcularSaldoNetoPendienteItem(item);
  }, 0);

  const totalPagado = historial.reduce((total, item) => {
    return total + calcularMontoPagadoAcumuladoItem(item);
  }, 0);

  return {
    opReservadas,
    opActivas,
    historial,
    totalReservadas: opReservadas.length,
    entregasHoy: opActivas.filter((item) => item?.resumenEntrega?.esHoy).length,
    opPorVencer: opActivas.filter((item) => item?.resumenEntrega?.porVencer).length,
    opAtrasadas: opActivas.filter((item) => item?.resumenEntrega?.estaAtrasada).length,
    totalPendientePago,
    totalAdelantos,
    saldoPendientePago: Math.max(0, totalPendientePago - totalAdelantos),
    totalAprobadoPago,
    totalPagado,
    totalUnidadesActivas: opActivas.reduce(
      (total, item) => total + convertirNumero(item.cantidadTotal),
      0
    ),
  };
};

const SUBMODULOS_TALLER = [
  {
    ruta: "/talleres/mi-produccion",
    clave: "produccion",
    numero: "01",
    titulo: "Mi produccion",
    descripcion:
      "Aqui se concentra el trabajo activo del taller con detalles, cantidades, procesos y fechas comprometidas.",
  },
  {
    ruta: "/talleres/historial",
    clave: "historial",
    numero: "02",
    titulo: "Historial",
    descripcion:
      "Aqui se revisan las OP ya recepcionadas o cerradas sin mezclarlo con el trabajo activo.",
  },
  {
    ruta: "/talleres/pagos",
    clave: "pagos",
    numero: "03",
    titulo: "Pagos",
    descripcion:
      "Aqui el taller revisa adelantos, pagos pendientes, pagos aprobados y el detalle economico de sus OP.",
  },
];

const NavSubmodulos = ({ rutaActual }) => (
  <div className="submodulos_nav">
    {SUBMODULOS_TALLER.map((item) => (
      <Link
        key={item.ruta}
        to={item.ruta}
        className={`submodulo_link ${rutaActual === item.ruta ? "submodulo_link_activo" : ""}`}
      >
        {item.titulo}
      </Link>
    ))}
  </div>
);

const SelectorCuentaTaller = ({
  user,
  cuentaAdmin,
  tallerSeleccionado,
  fichasTalleres,
  onChange,
}) => (
  <section className="tarjeta">
    <div className="tarjeta__encabezado">
      <div>
        <h2>Cuenta y taller</h2>
        <p>
          La cuenta del taller ya puede quedar amarrada desde Configuracion.
          Aqui el administrador puede cambiar de taller para probar y cada cuenta
          normal solo vera el taller que tenga asignado.
        </p>
      </div>
    </div>

    <div className="grid grid-3">
      <Campo>
        <label>Cuenta actual</label>
        <input type="text" value={user?.email || "Sin sesion"} readOnly />
      </Campo>

      {cuentaAdmin ? (
        <Campo className="campo_requerido">
          <label>Taller</label>
          <select value={tallerSeleccionado} onChange={onChange}>
            {(Array.isArray(fichasTalleres) ? fichasTalleres : []).map((taller) => (
              <option key={taller.id || taller.nombreTaller} value={taller.nombreTaller}>
                {taller.codigoTaller ? `${taller.codigoTaller} | ` : ""}
                {taller.nombreTaller}
              </option>
            ))}
          </select>
        </Campo>
      ) : (
        <Campo>
          <label>Taller asignado</label>
          <input
            type="text"
            value={tallerSeleccionado || "Sin taller asignado"}
            readOnly
          />
        </Campo>
      )}

      <Campo>
        <label>Estado de acceso</label>
        <input
          type="text"
          value={
            cuentaAdmin
              ? "Modo administrador / pruebas"
              : tallerSeleccionado
                ? "Cuenta de taller restringida"
                : "Cuenta sin taller asignado"
          }
          readOnly
        />
      </Campo>
    </div>

    {!cuentaAdmin && !tallerSeleccionado ? (
      <div className="alerta_asignacion">
        Esta cuenta aun no tiene un taller asignado. Vinculala desde
        Configuracion &gt; Fichas de talleres o desde Personal y seguridad.
      </div>
    ) : null}
  </section>
);

const ResumenTaller = ({ datosTaller }) => (
  <section className="tarjeta resumen">
    <h2>Resumen rapido del taller</h2>
    <div className="resumen__grid">
      <div>
        <span>OP activas</span>
        <strong>{datosTaller.opActivas.length}</strong>
      </div>
      <div>
        <span>Unidades activas</span>
        <strong>{datosTaller.totalUnidadesActivas}</strong>
      </div>
      <div>
        <span>Entrega hoy</span>
        <strong>{datosTaller.entregasHoy}</strong>
      </div>
      <div>
        <span>Por vencer</span>
        <strong>{datosTaller.opPorVencer}</strong>
      </div>
      <div>
        <span>Atrasadas</span>
        <strong>{datosTaller.opAtrasadas}</strong>
      </div>
      <div>
        <span>Historial total</span>
        <strong>{datosTaller.historial.length}</strong>
      </div>
      <div>
        <span>Por cobrar</span>
        <strong>{formatearMontoSoles(datosTaller.totalPendientePago)}</strong>
      </div>
      <div>
        <span>Adelantos</span>
        <strong>{formatearMontoSoles(datosTaller.totalAdelantos)}</strong>
      </div>
      <div>
        <span>Por cobrar</span>
        <strong>{formatearMontoSoles(datosTaller.saldoPendientePago)}</strong>
      </div>
      <div>
        <span>Pago aprobado</span>
        <strong>{formatearMontoSoles(datosTaller.totalAprobadoPago)}</strong>
      </div>
      <div>
        <span>Pagado</span>
        <strong>{formatearMontoSoles(datosTaller.totalPagado)}</strong>
      </div>
    </div>
  </section>
);

const ResumenAjustePago = ({ item }) => {
  const resumen = item?.resumenIncidencias || {};
  const ajusteManual = calcularDescuentoAcumuladoItem(item);
  const ajustesManuales = obtenerAjustesManualesItem(item);
  const descuentosTercero = obtenerDetallesDescuentoServicioTercero(item);
  const totalDescuentoTercero = calcularDescuentoDetalladoServicioTercero(item);
  const esServicioTercero =
    convertirNumero(item?.totalTallerPrincipal) <= 0 &&
    convertirNumero(item?.totalProcesosExternos) > 0;

  if (!resumen.totalIncidencias && ajusteManual === 0 && descuentosTercero.length === 0) {
    return <span className="texto_suave">Sin descuentos ni ajustes registrados.</span>;
  }

  return (
    <div className="resumen_ajuste_pago">
      {ajusteManual !== 0 ? (
        <span
          className={`chip_resumen ${
            ajusteManual > 0 ? "chip_descuento" : "chip_evaluar"
          }`}
        >
          Ajuste manual: {formatearMontoAjuste(ajusteManual)}
        </span>
      ) : null}

      {esServicioTercero && totalDescuentoTercero > 0 ? (
        <span className="chip_resumen chip_descuento">
          Descuento tercero: {descuentosTercero.length} reg / {formatearMontoSoles(totalDescuentoTercero)}
        </span>
      ) : null}

      {resumen.noPagarCantidad > 0 ? (
        <span className="chip_resumen chip_descuento">
          No pagar: {resumen.noPagarCantidad} und /{" "}
          {formatearMontoSoles(resumen.descuentoNoPagar)}
        </span>
      ) : null}

      {resumen.evaluarCantidad > 0 ? (
        <span className="chip_resumen chip_evaluar">
          En evaluar: {resumen.evaluarCantidad} und /{" "}
          {formatearMontoSoles(resumen.montoEvaluar)}
        </span>
      ) : null}

      {resumen.remateCantidad > 0 ? (
        <span className="chip_resumen">Remate: {resumen.remateCantidad}</span>
      ) : null}

      {resumen.reprocesoCantidad > 0 ? (
        <span className="chip_resumen">Reproceso: {resumen.reprocesoCantidad}</span>
      ) : null}

      {resumen.detalleCorto.length > 0 ? (
        <small className="texto_detalle_pago">{resumen.detalleCorto.join(" | ")}</small>
      ) : null}

      {resumen.motivos.length > 0 ? (
        <small className="texto_detalle_pago">
          Motivo: {resumen.motivos.slice(0, 2).join(" / ")}
          {resumen.motivos.length > 2 ? "..." : ""}
        </small>
      ) : null}

      {descuentosTercero.slice(0, 2).map((descuento) => (
        <small
          key={descuento?.id || `${descuento?.colorBase}-${descuento?.talla}-${descuento?.cantidad}`}
          className="texto_detalle_pago"
        >
          {descuento?.colorBase || "-"} / {descuento?.talla || "-"} /{" "}
          {convertirNumero(descuento?.cantidad)} und /{" "}
          {formatearMontoSoles(
            convertirNumero(descuento?.cantidad) * convertirNumero(descuento?.precioUnitario)
          )}{" "}
          / {descuento?.motivo || "Falla de servicio"}
        </small>
      ))}

      {ajustesManuales.slice(0, 2).map((ajuste) => {
        const montoFirmado = obtenerMontoAjusteFirmado(ajuste);
        const tipoTexto =
          normalizarTipoAjusteManual(ajuste?.tipoAjusteManual) === "AUMENTA"
            ? "Aumento manual"
            : "Descuento manual";

        return (
          <small key={ajuste?.id || `${ajuste?.fechaDescuento}-${ajuste?.montoDescuento}`} className="texto_detalle_pago">
            {tipoTexto}: {formatearMontoAjuste(montoFirmado)} / {formatearFechaCorta(ajuste?.fechaDescuento)} /{" "}
            {ajuste?.motivoDescuento || "Sin motivo"}
          </small>
        );
      })}
    </div>
  );
};

const DetalleOpSeleccionada = ({ item, titulo = "Detalle de la OP" }) => {
  if (!item) {
    return null;
  }

  const detalles = obtenerDetallesActivos(item.detallesConfeccion);
  const detalleColorTalla = construirDetalleColorTallaOp(item);
  const tallasDetalle = TALLAS_DISPONIBLES.filter((talla) =>
    detalleColorTalla.some((fila) => convertirNumero(fila?.salidas?.[talla]) > 0)
  );
  const tallasVisibles =
    tallasDetalle.length > 0
      ? tallasDetalle
      : obtenerTallasActivas(item?.tallasActivas || [], item?.totalesPorTalla || {});
  return (
    <section className="tarjeta detalle_op_taller">
      <div className="tarjeta__encabezado">
        <div>
          <h2>{titulo}</h2>
          <p>
            Aqui el taller revisa el detalle completo de la OP seleccionada, con
            modelo, colores, tallas, cantidades y referencia visual.
          </p>
        </div>
        <span className={`chip_estado ${item.estado?.clase || "estado_pendiente"}`}>
          {item.estado?.texto || "Pendiente"}
        </span>
      </div>

      <div className="detalle_op_taller__cabecera">
        <div className="detalle_op_taller__datos">
          <div>
            <span>OP</span>
            <strong>{item.codigoOp || "-"}</strong>
          </div>
          <div>
            <span>Modelo</span>
            <strong>{item.modelo || item.modeloBase || "-"}</strong>
          </div>
          <div>
            <span>Fecha envio</span>
            <strong>{formatearFechaCorta(item.fechaEnvio)}</strong>
          </div>
          <div>
            <span>Fecha entrega</span>
            <strong>{formatearFechaCorta(item.fechaEntrega)}</strong>
          </div>
          <div>
            <span>Total unidades</span>
            <strong>{item.cantidadTotal || 0}</strong>
          </div>
          <div>
            <span>Seguimiento</span>
            <strong>{item.resumenEntrega?.texto || "Sin fecha"}</strong>
          </div>
          <div>
            <span>Referencia visual</span>
            <div className="detalle_op_taller__accion_visual">
              <VisorFotosModelo
                modeloBase={item.modelo || item.modeloBase || ""}
                titulo="Fotos del modelo del taller"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="op_card__bloque">
        <span className="subtitulo">Detalles de confeccion</span>
        <div className="chips">
          {detalles.length > 0 ? (
            detalles.map((detalle) => (
              <span key={detalle} className="chip_detalle">
                {detalle}
              </span>
            ))
          ) : (
            <span className="texto_suave">No lleva detalles de confeccion</span>
          )}
          {item.detallesConfeccion?.MULTIAGUJA && item.detallesConfeccion?.cantidadAgujas ? (
            <span className="chip_detalle">
              {item.detallesConfeccion.cantidadAgujas} AGUJAS
            </span>
          ) : null}
          {item.detallesConfeccion?.otroDetalle ? (
            <span className="chip_detalle">{item.detallesConfeccion.otroDetalle}</span>
          ) : null}
        </div>
      </div>

      <div className="op_card__bloque">
        <span className="subtitulo">Observaciones</span>
        <p className="texto_suave">
          {item.observacion || item.observaciones || "Sin observaciones registradas."}
        </p>
      </div>

      <div className="op_card__bloque">
        <span className="subtitulo">Ajustes y descuentos</span>
        <ResumenAjustePago item={item} />
      </div>

      <div className="tabla_contenedor">
        <table>
          <thead>
            <tr>
              <th>Color</th>
              {tallasVisibles.map((talla) => (
                <th key={`${item.id || item.codigoOp}-${talla}`}>{talla}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {detalleColorTalla.length === 0 ? (
              <tr>
                <td colSpan={tallasVisibles.length + 2} className="fila_vacia">
                  No hay detalle de colores y tallas para esta OP.
                </td>
              </tr>
            ) : (
              detalleColorTalla.map((fila) => {
                const totalFila = tallasVisibles.reduce(
                  (total, talla) => total + convertirNumero(fila?.salidas?.[talla]),
                  0
                );

                return (
                  <tr key={fila.id || `${item.id || item.codigoOp}-${fila.colorBase}`}>
                    <td>{fila.colorBase || "-"}</td>
                    {tallasVisibles.map((talla) => (
                      <td key={`${fila.id || fila.colorBase}-${talla}`}>
                        {convertirNumero(fila?.salidas?.[talla]) || "-"}
                      </td>
                    ))}
                    <td>{totalFila}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="op_card__bloque">
        <span className="subtitulo">Procesos externos y apoyo</span>
        {(item.procesosExternos || []).length === 0 ? (
          <p className="texto_suave">Esta OP no registra procesos externos adicionales.</p>
        ) : (
          <div className="procesos">
            {item.procesosExternos.map((proceso) => (
              <div
                key={proceso.id || `${item.id || item.codigoOp}-${proceso.tipoProceso || "OTRO"}`}
                className="proceso_chip"
              >
                <strong>{proceso.tipoProceso || "OTRO"}</strong>
                <span>{proceso.nombreTaller || "-"}</span>
                <span>{formatearMontoSoles(proceso.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const ListaOpActivas = ({
  datosTaller,
  titulo,
  descripcion,
  onVerDetalle,
  items = null,
  mensajeVacio = "Este taller no tiene OP activas en este momento.",
}) => (
  <section className="tarjeta">
    <div className="tarjeta__encabezado">
      <div>
        <h2>{titulo}</h2>
        <p>{descripcion}</p>
      </div>
    </div>

    <div className="tarjetas_op">
      {(items || datosTaller.opActivas).length === 0 ? (
        <div className="tarjeta_vacia">
          {mensajeVacio}
        </div>
      ) : (
        (items || datosTaller.opActivas).map((op) => {
          const detalles = obtenerDetallesActivos(op.detallesConfeccion);

          return (
            <article key={op.id} className="op_card">
              <div className="op_card__cabecera">
                <div>
                  <h3>{op.codigoOp || "-"}</h3>
                  <p>{op.modelo || op.modeloBase || "-"}</p>
                </div>
                <div className="op_card__acciones_superiores">
                  <span className={`chip_estado ${op.estado.clase}`}>{op.estado.texto}</span>
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={() => onVerDetalle?.(op)}
                  >
                    Ver detalle
                  </button>
                </div>
              </div>

              <div className="op_card__grid">
                <div>
                  <span>Fecha envio</span>
                  <strong>{formatearFechaCorta(op.fechaEnvio)}</strong>
                </div>
                <div>
                  <span>Fecha entrega</span>
                  <strong>{formatearFechaCorta(op.fechaEntrega)}</strong>
                </div>
                <div>
                  <span>Total unidades</span>
                  <strong>{op.cantidadTotal || 0}</strong>
                </div>
                <div>
                  <span>Total bruto</span>
                  <strong>{formatearMontoSoles(op.totalPagarTaller)}</strong>
                </div>
                <div>
                  <span>Adelanto</span>
                  <strong>{formatearMontoSoles(obtenerAdelantoAcumuladoItem(op))}</strong>
                </div>
                <div>
                  <span>Referencia visual</span>
                  <div className="detalle_op_taller__accion_visual">
                    <VisorFotosModelo
                      modeloBase={op.modelo || op.modeloBase || ""}
                      titulo="Fotos del modelo del taller"
                    />
                  </div>
                </div>
              </div>

              <div className="op_card__seguimiento">
                <span className="subtitulo">Seguimiento de entrega</span>
                <div className="chips">
                  <span className={`chip_estado ${op.resumenEntrega?.clase || "entrega_sin_fecha"}`}>
                    {op.resumenEntrega?.texto || "Sin fecha"}
                  </span>
                  {op.resumenEntrega?.diasRestantes !== null ? (
                    <span className="chip_detalle">
                      Dias restantes: {op.resumenEntrega.diasRestantes}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="op_card__tallas">
                {(op.tallasActivas || TALLAS_DISPONIBLES).map((talla) => (
                  <span key={`${op.id}-${talla}`}>
                    {talla}: {op.totalesPorTalla?.[talla] || 0}
                  </span>
                ))}
              </div>

              <div className="op_card__bloque">
                <span className="subtitulo">Detalles de confeccion</span>
                <div className="chips">
                  {detalles.length > 0 ? (
                    detalles.map((detalle) => (
                      <span key={detalle} className="chip_detalle">
                        {detalle}
                      </span>
                    ))
                  ) : (
                    <span className="texto_suave">No lleva detalles de confeccion</span>
                  )}
                  {op.detallesConfeccion?.MULTIAGUJA &&
                  op.detallesConfeccion?.cantidadAgujas ? (
                    <span className="chip_detalle">
                      {op.detallesConfeccion.cantidadAgujas} AGUJAS
                    </span>
                  ) : null}
                  {op.detallesConfeccion?.otroDetalle ? (
                    <span className="chip_detalle">{op.detallesConfeccion.otroDetalle}</span>
                  ) : null}
                </div>
              </div>

              <div className="op_card__bloque">
                <span className="subtitulo">Procesos externos</span>
                {(op.procesosExternos || []).length === 0 ? (
                  <p className="texto_suave">Esta OP no registra terceros adicionales.</p>
                ) : (
                  <div className="procesos">
                    {op.procesosExternos.map((proceso) => (
                      <div key={proceso.id} className="proceso_chip">
                        <strong>{proceso.tipoProceso || "OTRO"}</strong>
                        <span>{proceso.nombreTaller || "-"}</span>
                        <span>{formatearMontoSoles(proceso.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="op_card__bloque">
                <span className="subtitulo">Ajustes y descuentos</span>
                <ResumenAjustePago item={op} />
              </div>

            </article>
          );
        })
      )}
    </div>
  </section>
);

const TablaHistorial = ({ datosTaller, onVerDetalle }) => {
  const [filtroAnio, setFiltroAnio] = useState("TODOS");
  const [filtroModelo, setFiltroModelo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [paginaHistorial, setPaginaHistorial] = useState(1);

  const aniosDisponibles = useMemo(() => {
    const lista = [...new Set(
      (datosTaller.historial || [])
        .map((item) => {
          const fecha = item?.recepcion?.cabeceraRecepcion?.fechaRecepcion || item?.fechaEnvio || "";
          const anio = convertirFechaTextoAFecha(fecha)?.getFullYear();
          return anio ? String(anio) : "";
        })
        .filter(Boolean)
    )];

    return lista.sort((a, b) => Number(b) - Number(a));
  }, [datosTaller.historial]);

  const estadosDisponibles = useMemo(() => {
    const lista = [...new Set(
      (datosTaller.historial || [])
        .map((item) => item?.estado?.texto || "")
        .filter(Boolean)
    )];

    return lista;
  }, [datosTaller.historial]);

  const historialFiltrado = useMemo(() => {
    return (datosTaller.historial || []).filter((item) => {
      const fechaBase = item?.recepcion?.cabeceraRecepcion?.fechaRecepcion || item?.fechaEnvio || "";
      const anioItem = convertirFechaTextoAFecha(fechaBase)?.getFullYear();
      const modeloItem = `${item?.modelo || item?.modeloBase || ""}`.toLowerCase();
      const estadoItem = item?.estado?.texto || "";

      if (filtroAnio !== "TODOS" && String(anioItem || "") !== filtroAnio) {
        return false;
      }

      if (filtroEstado !== "TODOS" && estadoItem !== filtroEstado) {
        return false;
      }

      if (filtroModelo.trim() && !modeloItem.includes(filtroModelo.trim().toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [datosTaller.historial, filtroAnio, filtroEstado, filtroModelo]);
  const totalPaginasHistorial = Math.max(
    1,
    Math.ceil(historialFiltrado.length / FILAS_POR_PAGINA)
  );
  const historialPagina = useMemo(() => {
    const inicio = (paginaHistorial - 1) * FILAS_POR_PAGINA;
    return historialFiltrado.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [historialFiltrado, paginaHistorial]);

  useEffect(() => {
    if (paginaHistorial > totalPaginasHistorial) {
      setPaginaHistorial(totalPaginasHistorial);
    }
  }, [paginaHistorial, totalPaginasHistorial]);

  return (
    <section className="tarjeta">
      <div className="tarjeta__encabezado">
        <div>
          <h2>Historial del taller</h2>
          <p>
            Aqui se revisan las ordenes ya recepcionadas o cerradas, sin mezclarlo
            con el trabajo activo del dia.
          </p>
        </div>
      </div>

      <div className="filtros_historial_taller">
        <Campo>
          <label>Año</label>
          <select value={filtroAnio} onChange={(evento) => setFiltroAnio(evento.target.value)}>
            <option value="TODOS">Todos</option>
            {aniosDisponibles.map((anio) => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
          </select>
        </Campo>

        <Campo>
          <label>Modelo</label>
          <input
            type="text"
            value={filtroModelo}
            onChange={(evento) => setFiltroModelo(evento.target.value)}
            placeholder="Buscar modelo"
          />
        </Campo>

        <Campo>
          <label>Estado</label>
          <select value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value)}>
            <option value="TODOS">Todos</option>
            {estadosDisponibles.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="historial_taller__resumen">
        Mostrando {historialFiltrado.length} registro{historialFiltrado.length === 1 ? "" : "s"}
      </div>

      <div className="tabla_contenedor">
        <table>
          <thead>
            <tr>
              <th>OP</th>
              <th>Modelo</th>
              <th>Fecha envio</th>
              <th>Fecha recepcion</th>
              <th>Unidades</th>
              <th>Ajuste</th>
              <th>Total final</th>
              <th>Estado</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {historialPagina.length === 0 ? (
              <tr>
                <td colSpan={9} className="fila_vacia">
                  No hay registros para esos filtros.
                </td>
              </tr>
            ) : (
              historialPagina.map((item) => {
                const cabeceraRecepcion = item?.recepcion?.cabeceraRecepcion || {};
                const diferencia =
                  convertirNumero(cabeceraRecepcion.prendasMas) -
                  convertirNumero(cabeceraRecepcion.prendasMenos);

                return (
                  <tr key={`hist-${item.id}`}>
                    <td>{item.codigoOp || "-"}</td>
                    <td>{item.modelo || item.modeloBase || "-"}</td>
                    <td>{formatearFechaCorta(item.fechaEnvio)}</td>
                    <td>{formatearFechaCorta(cabeceraRecepcion.fechaRecepcion)}</td>
                    <td>
                      <div className="celda_apilada">
                        <strong>{cabeceraRecepcion.cantidadRecibida || item.cantidadTotal || 0}</strong>
                        <small>Diferencia: {diferencia}</small>
                      </div>
                    </td>
                    <td>
                      <ResumenAjustePago item={item} />
                    </td>
                    <td>{formatearMontoSoles(item.totalPagarTaller)}</td>
                    <td>
                      <span className={`chip_estado ${item.estado.clase}`}>
                        {item.estado.texto}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn_secundario"
                        onClick={() => onVerDetalle?.(item)}
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

      {historialFiltrado.length > FILAS_POR_PAGINA ? (
        <div className="paginacion">
          <button
            type="button"
            className="btn btn_secundario"
            onClick={() => setPaginaHistorial((valor) => Math.max(1, valor - 1))}
            disabled={paginaHistorial === 1}
          >
            Anterior
          </button>
          <span>
            Pagina {paginaHistorial} de {totalPaginasHistorial}
          </span>
          <button
            type="button"
            className="btn btn_secundario"
            onClick={() =>
              setPaginaHistorial((valor) => Math.min(totalPaginasHistorial, valor + 1))
            }
            disabled={paginaHistorial >= totalPaginasHistorial}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </section>
  );
};

const TablaPagos = ({ datosTaller }) => (
  <section className="tarjeta">
    <div className="tarjeta__encabezado">
      <div>
        <h2>Pagos del taller</h2>
        <p>
          Aqui el taller revisa el detalle economico de sus OP, adelantos,
          pendientes y pagos aprobados.
        </p>
      </div>
    </div>

    <div className="tabla_contenedor">
      <table>
        <thead>
          <tr>
            <th>OP</th>
            <th>Modelo</th>
            <th>Unidades</th>
            <th>Base</th>
            <th>Ajuste</th>
            <th>Total general</th>
            <th>Adelanto</th>
            <th>Pago aprobado</th>
          </tr>
        </thead>
        <tbody>
          {datosTaller.historial.length === 0 ? (
            <tr>
              <td colSpan={8} className="fila_vacia">
                Todavia no hay pagos registrados para este taller.
              </td>
            </tr>
            ) : (
              datosTaller.historial.map((item) => {
              const saldoPendiente = calcularSaldoPendienteItem(item);
              const saldoNetoPendiente = calcularSaldoNetoPendienteItem(item);
              const pagadoTaller =
                saldoNetoPendiente <= 0 &&
                item?.recepcion?.cabeceraRecepcion?.aprobadoPago;
              const aprobadoPago = item?.recepcion?.cabeceraRecepcion?.aprobadoPago;

                return (
                <tr key={`pago-${item.id}`}>
                  <td>{item.codigoOp || "-"}</td>
                  <td>{item.modelo || item.modeloBase || "-"}</td>
                  <td>{item.cantidadTotal || 0}</td>
                  <td>
                    <div className="celda_apilada">
                      <strong>{formatearMontoSoles(item.totalTallerPrincipal)}</strong>
                      {convertirNumero(item.totalProcesosExternos) > 0 ? (
                        <small>
                          Terceros: {formatearMontoSoles(item.totalProcesosExternos)}
                        </small>
                      ) : null}
                      <small>
                        Ya pagado: {formatearMontoSoles(calcularMontoPagadoAcumuladoItem(item))}
                      </small>
                    </div>
                  </td>
                  <td>
                    <ResumenAjustePago item={item} />
                  </td>
                  <td>
                    <div className="celda_apilada">
                      <strong>{formatearMontoSoles(item.totalPagarTaller)}</strong>
                      <small>
                        Ajuste: {formatearMontoAjuste(calcularDescuentoAcumuladoItem(item))}
                      </small>
                      <small>
                        Pago aprobado: {formatearMontoSoles(saldoNetoPendiente)}
                      </small>
                    </div>
                  </td>
                  <td>{formatearMontoSoles(obtenerAdelantoAcumuladoItem(item))}</td>
                  <td>
                    <span
                      className={`chip_estado ${
                        pagadoTaller
                          ? "estado_aprobado"
                          : aprobadoPago
                            ? "estado_recibido"
                            : "estado_pendiente"
                      }`}
                    >
                      {pagadoTaller ? "Pagado" : aprobadoPago ? "Aprobado" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </section>
);

export function Talleres({ vistaInicial = "portada" }) {
  const { user } = UserAuth();
  const emailUsuario = user?.email || "";
  const perfilUsuario = useMemo(() => leerPerfilUsuario(user), [user]);
  const [versionDatos, setVersionDatos] = useState(0);
  const fichasTalleres = useMemo(
    () => leerFichasTalleres().filter((item) => item?.estado !== "INACTIVO"),
    [versionDatos],
  );
  const talleresDisponibles = useMemo(
    () => fichasTalleres.map((item) => item?.nombreTaller).filter(Boolean),
    [fichasTalleres],
  );
  const cuentaAdmin = esCuentaAdministrativa(emailUsuario);
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState(null);
  const detalleRef = useRef(null);
  const [tallerSeleccionado, setTallerSeleccionado] = useState(() =>
    resolverTallerInicial(
      {
        email: emailUsuario,
        tallerId: perfilUsuario?.tallerId,
        tallerCodigo: perfilUsuario?.tallerCodigo,
        tallerAsignado: perfilUsuario?.tallerAsignado,
      },
      fichasTalleres,
    )
  );

  useEffect(() => {
    const tallerInicial = resolverTallerInicial(
      {
        email: emailUsuario,
        tallerId: perfilUsuario?.tallerId,
        tallerCodigo: perfilUsuario?.tallerCodigo,
        tallerAsignado: perfilUsuario?.tallerAsignado,
      },
      fichasTalleres,
    );

    setTallerSeleccionado((anterior) => {
      if (!cuentaAdmin) {
        return tallerInicial;
      }

      return anterior || tallerInicial;
    });
  }, [emailUsuario, perfilUsuario, fichasTalleres, cuentaAdmin]);

  useEffect(() => {
    if (cuentaAdmin) {
      if (tallerSeleccionado && talleresDisponibles.includes(tallerSeleccionado)) {
        return;
      }

      setTallerSeleccionado(talleresDisponibles[0] || "");
      return;
    }

    if (
      tallerSeleccionado &&
      fichasTalleres.some((item) => item?.nombreTaller === tallerSeleccionado)
    ) {
      return;
    }

    const fichaVinculada = resolverFichaTallerPorIdentidad(
      {
        email: emailUsuario,
        tallerId: perfilUsuario?.tallerId,
        tallerCodigo: perfilUsuario?.tallerCodigo,
        tallerAsignado: perfilUsuario?.tallerAsignado,
      },
      fichasTalleres,
    );

    setTallerSeleccionado(fichaVinculada?.nombreTaller || "");
  }, [
    cuentaAdmin,
    emailUsuario,
    perfilUsuario,
    fichasTalleres,
    talleresDisponibles,
    tallerSeleccionado,
  ]);

  const datosTaller = useMemo(
    () => crearDatosTaller(tallerSeleccionado),
    [tallerSeleccionado, versionDatos]
  );
  const vistaTallerActiva =
    vistaInicial === "disponibles" ? "produccion" : vistaInicial;

  const manejarCambioTaller = (evento) => {
    const nuevoTaller = evento.target.value;
    setDetalleSeleccionado(null);
    setTallerSeleccionado(nuevoTaller);
    localStorage.setItem(CLAVE_TALLER_SELECCIONADO, nuevoTaller);
  };

  const refrescarVista = () => {
    setVersionDatos((anterior) => anterior + 1);
  };

  useEffect(() => {
    setDetalleSeleccionado(null);
  }, [vistaTallerActiva, tallerSeleccionado]);

  useEffect(() => {
    if (!detalleSeleccionado || !detalleRef.current) {
      return;
    }

    detalleRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [detalleSeleccionado]);

  const metaVista =
    vistaTallerActiva === "produccion"
        ? {
            titulo: "Mi produccion",
            descripcion:
              "Aqui el taller revisa el detalle completo de las OP activas que todavia estan en proceso.",
            contador: datosTaller.totalUnidadesActivas,
            rutaActual: "/talleres/mi-produccion",
          }
        : vistaTallerActiva === "historial"
          ? {
              titulo: "Historial",
              descripcion:
                "Aqui se ordena el historial del taller para revisar entregas y diferencias sin cargar la vista operativa.",
              contador: datosTaller.historial.length,
              rutaActual: "/talleres/historial",
            }
          : vistaTallerActiva === "pagos"
            ? {
                titulo: "Pagos",
                descripcion:
                  "Aqui el taller revisa sus montos, adelantos y pagos aprobados de forma separada del trabajo diario.",
                contador: datosTaller.historial.length,
                rutaActual: "/talleres/pagos",
              }
            : {
                titulo: "Talleres",
                descripcion:
                  "Aqui cada taller puede ver sus ordenes activas, su historial anual y el resumen de pagos que le corresponde segun lo que Produccion y Almacen ya registraron en el sistema.",
                contador: datosTaller.opActivas.length,
                rutaActual: "/talleres",
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
          <h1>{metaVista.titulo}</h1>
          <p>{metaVista.descripcion}</p>
          <small className="version_actual">
            {VERSION_SISTEMA} | Talleres
          </small>
        </div>

        <div className="cabecera__estado">
          <span>
            {vistaTallerActiva === "produccion"
              ? "Unidades activas del taller"
              : vistaTallerActiva === "pagos"
                ? "Registros de pago"
                : vistaTallerActiva === "historial"
                  ? "Registros del historial"
                  : "OP activas del taller"}
          </span>
          <strong>{metaVista.contador}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/" className="boton_volver">
          Volver al inicio
        </Link>

        <div className="navegacion_superior">
          <NavSubmodulos rutaActual={metaVista.rutaActual} />
          <button type="button" className="btn btn_secundario" onClick={refrescarVista}>
            Actualizar vista
          </button>
        </div>
      </div>

      <main className="contenido">
        <SelectorCuentaTaller
          user={user}
          cuentaAdmin={cuentaAdmin}
          tallerSeleccionado={tallerSeleccionado}
          fichasTalleres={fichasTalleres}
          onChange={manejarCambioTaller}
        />

        <ResumenTaller datosTaller={datosTaller} />

        {vistaTallerActiva === "portada" ? (
          <>
          {datosTaller.opReservadas.length > 0 ? (
            <ListaOpActivas
              datosTaller={datosTaller}
              items={datosTaller.opReservadas}
              titulo="OP asignadas por recoger"
              descripcion="Aqui el taller ve las OP que Produccion ya le reservo antes de hacer la salida formal."
              mensajeVacio="Este taller no tiene OP reservadas en este momento."
              onVerDetalle={setDetalleSeleccionado}
            />
          ) : null}
          <ListaOpActivas
            datosTaller={datosTaller}
            titulo="Trabajo activo del taller"
            descripcion="Aqui el taller ve sus OP activas, lo que vence pronto y lo que necesita entregar hoy."
            onVerDetalle={setDetalleSeleccionado}
          />
          </>
        ) : null}

        {vistaTallerActiva === "produccion" ? (
          <>
            {datosTaller.opReservadas.length > 0 ? (
              <ListaOpActivas
                datosTaller={datosTaller}
                items={datosTaller.opReservadas}
                titulo="OP asignadas por recoger"
                descripcion="Aqui el taller puede ver lo que Produccion ya le asigno antes de que salga formalmente a taller."
                mensajeVacio="Este taller no tiene OP reservadas en este momento."
                onVerDetalle={setDetalleSeleccionado}
              />
            ) : null}
            <ListaOpActivas
              datosTaller={datosTaller}
              titulo="Mi produccion"
              descripcion="Aqui se muestra el detalle operativo de las OP activas del taller, con cantidades, procesos y fechas."
              onVerDetalle={setDetalleSeleccionado}
            />
          </>
        ) : null}

        {vistaTallerActiva === "historial" && detalleSeleccionado ? (
          <div ref={detalleRef}>
            <DetalleOpSeleccionada
              item={detalleSeleccionado}
              titulo="Detalle del historial"
            />
          </div>
        ) : null}

        {vistaTallerActiva === "historial" ? (
          <TablaHistorial datosTaller={datosTaller} onVerDetalle={setDetalleSeleccionado} />
        ) : null}

        {vistaTallerActiva !== "historial" && detalleSeleccionado ? (
          <div ref={detalleRef}>
            <DetalleOpSeleccionada
              item={detalleSeleccionado}
              titulo="Detalle de la OP seleccionada"
            />
          </div>
        ) : null}

        {vistaTallerActiva === "pagos" ? <TablaPagos datosTaller={datosTaller} /> : null}
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(circle at top right, rgba(117, 1, 152, 0.14), transparent 28%),
    linear-gradient(180deg, ${({ theme }) => theme.bgtotal} 0%, ${({ theme }) => theme.bg2} 100%);
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
    padding: 16px;
  }

  .cabecera {
    display: grid;
    gap: 14px;
  }

  .cabecera h1,
  .tarjeta h2,
  .modulo_card h3,
  .op_card h3 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .texto_suave {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .version_actual {
    display: inline-block;
    margin-top: 10px;
    color: ${({ theme }) => theme.bg5};
    font-size: 13px;
    font-weight: 700;
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
    font-size: 28px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior,
  .navegacion_superior,
  .tarjeta__encabezado {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .submodulos_nav {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .submodulo_link {
    min-width: 180px;
    min-height: 42px;
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: transparent;
    color: ${({ theme }) => theme.text};
    text-decoration: none;
    font-weight: 700;
    justify-content: center;
    text-align: center;
  }

  .submodulo_link_activo {
    background-color: ${({ theme }) => theme.bg5};
    border-color: ${({ theme }) => theme.bg5};
    color: #fff;
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

  .grid {
    display: grid;
    gap: 14px;
  }

  .grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .filtros_historial_taller {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .historial_taller__resumen {
    margin-bottom: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
    font-weight: 600;
  }

  .campo_requerido label::after {
    content: " *";
    color: ${({ theme }) => theme.bg5};
    font-weight: 700;
  }

  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 14px;
  }

  .resumen__grid div,
  .op_card__grid div,
  .modulo_card {
    background-color: ${({ theme }) => theme.bgtotal};
    border: 1px solid ${({ theme }) => theme.bg3};
    border-radius: 14px;
    padding: 12px;
  }

  .resumen__grid span,
  .op_card__grid span,
  .subtitulo {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .resumen__grid strong,
  .op_card__grid strong {
    font-size: 18px;
  }

  .op_card__seguimiento {
    display: grid;
    gap: 8px;
  }

  .mapa_modulo {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .modulo_card {
    display: grid;
    gap: 10px;
  }

  .modulo_numero {
    width: fit-content;
    min-width: 38px;
    min-height: 38px;
    padding: 6px 10px;
    border-radius: 12px;
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .alerta_asignacion {
    margin-top: 14px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(255, 184, 77, 0.08);
    border: 1px solid rgba(255, 184, 77, 0.28);
    color: #ffcf70;
    font-size: 14px;
  }

  .op_card,
  .tarjeta_vacia {
    background-color: ${({ theme }) => theme.bgtotal};
    border: 1px solid ${({ theme }) => theme.bg3};
    border-radius: 16px;
    padding: 14px;
  }

  .tarjetas_op {
    display: grid;
    gap: 12px;
  }

  .op_card {
    display: grid;
    gap: 12px;
  }

  .op_card__acciones,
  .op_card__acciones_superiores {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .op_card__cabecera {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .op_card__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .op_card__visual {
    display: grid;
    grid-template-columns: 132px 1fr;
    gap: 12px;
    align-items: start;
  }

  .op_card__visual img {
    width: 132px;
    height: 132px;
    object-fit: contain;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg3};
    background: #0f0f11;
    padding: 6px;
  }

  .op_card__visual_galeria {
    display: grid;
    gap: 8px;
  }

  .op_card__miniaturas {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .op_card__miniatura_item {
    display: grid;
    gap: 4px;
    justify-items: center;
  }

  .op_card__miniatura_item img {
    width: 52px;
    height: 52px;
    border-radius: 8px;
    object-fit: contain;
    background: #0f0f11;
    padding: 4px;
  }

  .op_card__miniatura_item span {
    font-size: 10px;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .op_card__visual_texto {
    display: grid;
    gap: 6px;
  }

  .op_card__visual_texto small {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  .detalle_op_taller {
    display: grid;
    gap: 14px;
  }

  .detalle_op_taller__cabecera {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 16px;
    align-items: start;
  }

  .detalle_op_taller__datos {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .detalle_op_taller__datos > div {
    background-color: ${({ theme }) => theme.bgtotal};
    border: 1px solid ${({ theme }) => theme.bg3};
    border-radius: 14px;
    padding: 12px;
  }

  .detalle_op_taller__datos span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .detalle_op_taller__visual {
    display: grid;
    gap: 10px;
  }

  .detalle_op_taller__visual > img {
    width: 100%;
    max-width: 280px;
    height: 280px;
    object-fit: contain;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg3};
    background: #0f0f11;
    padding: 8px;
  }

  .detalle_op_taller__miniaturas {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .detalle_op_taller__miniatura {
    display: grid;
    gap: 4px;
    justify-items: center;
  }

  .detalle_op_taller__miniatura img {
    width: 72px;
    height: 72px;
    object-fit: contain;
    border-radius: 10px;
    border: 1px solid ${({ theme }) => theme.bg3};
    background: #0f0f11;
    padding: 6px;
  }

  .detalle_op_taller__miniatura span {
    font-size: 11px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-align: center;
  }

  .op_card__tallas,
  .chips,
  .procesos {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .op_card__tallas span,
  .chip_detalle,
  .proceso_chip,
  .chip_resumen {
    background-color: ${({ theme }) => theme.bg2};
    border: 1px solid ${({ theme }) => theme.bg3};
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
  }

  .proceso_chip {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .chip_descuento {
    background: rgba(255, 184, 77, 0.12);
    border-color: rgba(255, 184, 77, 0.28);
    color: #ffcf70;
  }

  .chip_evaluar {
    background: rgba(111, 127, 255, 0.14);
    border-color: rgba(111, 127, 255, 0.34);
    color: #b2bcff;
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

  .estado_activo {
    background: rgba(111, 127, 255, 0.14);
    color: #b2bcff;
    border-color: rgba(111, 127, 255, 0.36);
  }

  .estado_recibido {
    background: rgba(78, 201, 140, 0.09);
    color: #9fe0bb;
    border-color: rgba(78, 201, 140, 0.28);
  }

  .estado_aprobado {
    background: rgba(78, 201, 140, 0.14);
    color: #86e0ad;
    border-color: rgba(78, 201, 140, 0.36);
  }

  .estado_pendiente {
    background: rgba(255, 184, 77, 0.12);
    color: #ffcf70;
    border-color: rgba(255, 184, 77, 0.35);
  }

  .entrega_sin_fecha {
    background: rgba(125, 125, 125, 0.16);
    color: #d8d8d8;
    border-color: rgba(170, 170, 170, 0.24);
  }

  .entrega_programada {
    background: rgba(56, 189, 248, 0.14);
    color: #9ad8ff;
    border-color: rgba(56, 189, 248, 0.3);
  }

  .entrega_por_vencer,
  .entrega_hoy {
    background: rgba(255, 184, 77, 0.14);
    color: #ffcf70;
    border-color: rgba(255, 184, 77, 0.35);
  }

  .entrega_atrasada {
    background: rgba(248, 113, 113, 0.16);
    color: #ffb0b0;
    border-color: rgba(248, 113, 113, 0.34);
  }

  .tabla_contenedor {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 860px;
  }

  th,
  td {
    text-align: left;
    padding: 12px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg3};
    vertical-align: middle;
  }

  .celda_apilada,
  .resumen_ajuste_pago {
    display: grid;
    gap: 6px;
  }

  .celda_apilada strong {
    font-size: 15px;
  }

  .celda_apilada small,
  .texto_detalle_pago {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;
    line-height: 1.4;
  }

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 20px;
  }

  .btn {
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
  }

  @media (max-width: 980px) {
    .grid-3,
    .filtros_historial_taller,
    .resumen__grid,
    .op_card__grid,
    .mapa_modulo {
      grid-template-columns: 1fr;
    }

    .op_card__visual {
      grid-template-columns: 1fr;
    }

    .detalle_op_taller__cabecera,
    .detalle_op_taller__datos {
      grid-template-columns: 1fr;
    }

    .op_card__visual img {
      width: 100%;
      max-width: 220px;
      height: 220px;
    }
  }

  @media (max-width: 640px) {
    padding: 10px;
    gap: 12px;
    grid-template-rows: 78px auto auto 1fr;

    .encabezado {
      border-radius: 12px;
      padding-right: 6px;
    }

    .cabecera,
    .tarjeta {
      border-radius: 12px;
      padding: 12px;
    }

    .cabecera h1 {
      font-size: 24px;
    }

    .tarjeta h2,
    .modulo_card h3,
    .op_card h3 {
      font-size: 18px;
      margin-bottom: 6px;
    }

    .cabecera p,
    .tarjeta p,
    .texto_suave,
    .celda_apilada small,
    .texto_detalle_pago {
      font-size: 12px;
    }

    .cabecera__estado {
      width: 100%;
      padding: 10px 12px;
      border-radius: 12px;
    }

    .cabecera__estado strong {
      font-size: 22px;
    }

    .submodulo_link,
    .boton_volver,
    .btn {
      min-height: 38px;
      padding: 9px 12px;
      border-radius: 10px;
      font-size: 13px;
    }

    .resumen__grid {
      gap: 10px;
    }

    .resumen__grid div,
    .op_card__grid div,
    .modulo_card {
      border-radius: 12px;
      padding: 10px;
    }

    .resumen__grid strong,
    .op_card__grid strong {
      font-size: 16px;
    }

    .modulo_numero {
      min-width: 32px;
      min-height: 32px;
      border-radius: 10px;
      font-size: 13px;
    }

    .alerta_asignacion {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 12px;
    }

    .op_card,
    .tarjeta_vacia {
      border-radius: 12px;
      padding: 12px;
    }

    .tarjetas_op,
    .op_card,
    .mapa_modulo {
      gap: 10px;
    }

    .op_card__grid {
      gap: 8px;
    }

    .op_card__tallas,
    .chips,
    .procesos {
      gap: 6px;
    }

    .op_card__tallas span,
    .chip_detalle,
    .proceso_chip,
    .chip_resumen {
      padding: 5px 8px;
      font-size: 11px;
    }

    th,
    td {
      padding: 10px 8px;
      font-size: 12px;
    }
  }

  @media (max-width: 860px) {
    .fila_superior,
    .navegacion_superior,
    .tarjeta__encabezado,
    .op_card__cabecera {
      flex-direction: column;
      align-items: stretch;
    }

    .boton_volver,
    .btn,
    .submodulo_link {
      width: 100%;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;

const Campo = styled.div`
  display: grid;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input,
  select {
    width: 100%;
    min-height: 42px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    padding: 0 12px;
    outline: none;
  }
`;
