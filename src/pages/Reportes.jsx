import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { utils as XLSXUtils, writeFile as writeExcelFile } from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Header } from "../index";
import { leerFilasPorPaginaSistema } from "../utils/paginacionSistema";
import { leerProductosTerminados } from "../utils/productosTerminados";
import { VERSION_SISTEMA } from "../utils/versionSistema";
import { resolverIdentidadVisualPorRuta } from "../utils/identidadVisual";
import { leerConfiguracionSeguimientoOp } from "../utils/configuracionSeguimientoOp";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../styles/tabletLayout";

const TALLAS = ["S", "M", "L", "XL", "XXL"];
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_HISTORIAL_PAGOS = "cynara_historial_pagos";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_SOLICITUDES_PROCESOS_EXTERNOS =
  "cynara_solicitudes_procesos_externos";
const CLAVE_ACONDICIONADO_PT = "cynara_acondicionado_producto_terminado";
const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const CLAVE_REPOSICIONES_PROVEEDOR_MP = "cynara_reposiciones_proveedor_mp";
const CLAVE_AJUSTES_MATERIA_PRIMA = "cynara_ajustes_materia_prima";
const CLAVE_DEVOLUCIONES_PRODUCCION = "cynara_devoluciones_produccion";
const CLAVE_DEVOLUCIONES_PROVEEDOR_MP = "cynara_devoluciones_proveedor_mp";
const CLAVE_REMATES_PT = "cynara_remates_producto_terminado";
const CLAVE_PEDIDOS_TIENDA = "cynara_pedidos_tienda";
const CLAVE_VENTAS_ALMACEN_PT = "cynara_ventas_almacen_pt";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

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

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const formatearNumero = (valor, decimales = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(convertirNumero(valor));

const formatearMonto = (valor) => `S/ ${formatearNumero(valor, 2)}`;

const normalizarBusqueda = (valor = "") => valor.toString().trim().toLowerCase();
const obtenerFechaActual = () => new Date().toISOString().slice(0, 10);
const extraerFechaComparable = (fila = {}) =>
  String(
    fila?.fecha ||
      fila?.fechaPago ||
      fila?.fechaRecepcion ||
      fila?.ultimoMovimientoFecha ||
      fila?.ultimaFecha ||
      ""
  )
    .trim()
    .slice(0, 10);

const normalizarTextoClave = (valor = "") =>
  String(valor || "").trim().toUpperCase();

const formatearFechaVisible = (valor = "") => {
  const texto = String(valor || "").trim();
  if (!texto) return "-";
  const base = texto.length >= 10 ? texto.slice(0, 10) : texto;
  const fecha = new Date(`${base}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return base;
  return fecha.toLocaleDateString("es-PE");
};

const calcularDiasTranscurridos = (fecha = "") => {
  const texto = String(fecha || "").trim();
  if (!texto) return 0;
  const base = texto.length >= 10 ? texto.slice(0, 10) : texto;
  const inicio = new Date(`${base}T00:00:00`);
  const hoy = new Date(`${obtenerFechaActual()}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
  );
};

const resolverAlertaSeguimiento = (etapaClave = "", dias = 0, finalizado = false) => {
  const configuracion = leerConfiguracionSeguimientoOp();
  if (finalizado) {
    return { texto: "Cerrada", clase: "estado_ok" };
  }

  const etapa = normalizarTextoClave(etapaClave);
  const limite = etapa === "EN_CALIDAD"
    ? Number(configuracion?.alertas?.diasCalidad || 2)
    : etapa === "EN_SERVICIO_TERCERO"
      ? Number(configuracion?.alertas?.diasTercero || 3)
      : etapa === "EN_TALLER"
        ? Number(configuracion?.alertas?.diasTaller || 4)
        : Number(configuracion?.alertas?.diasGeneral || 3);

  if (dias > limite) {
    return { texto: `Alerta ${dias} dia(s)`, clase: "estado_alerta" };
  }

  if (dias >= Math.max(1, limite - 1)) {
    return { texto: `Por revisar ${dias} dia(s)`, clase: "estado_atencion" };
  }

  if (dias > 0) {
    return { texto: `${dias} dia(s)`, clase: "estado_avance" };
  }

  return { texto: "Hoy", clase: "estado_ok" };
};

const obtenerTallasActivas = (tallasSeleccionadas = []) =>
  Array.isArray(tallasSeleccionadas) && tallasSeleccionadas.length > 0
    ? TALLAS.filter((talla) => tallasSeleccionadas.includes(talla))
    : [...TALLAS];

const calcularTotalUnidadesCorte = (filas = [], tallasActivas = TALLAS) =>
  (Array.isArray(filas) ? filas : []).reduce(
    (total, fila) =>
      total +
      tallasActivas.reduce(
        (subtotal, talla) => subtotal + convertirNumero(fila?.salidas?.[talla]),
        0
      ),
    0
  );

const construirReporteOps = () =>
  leerListaGuardada(CLAVE_HISTORIAL_CORTES)
    .filter((registro) => Boolean(registro?.cabeceraCorte?.codigoCorte))
    .map((registro) => {
      const cabecera = registro?.cabeceraCorte || {};
      const tallasActivas = obtenerTallasActivas(cabecera?.tallasSeleccionadas);
      return {
        id: registro?.id || cabecera?.codigoCorte,
        codigoOp: cabecera?.codigoCorte || "-",
        pedido: cabecera?.pedidoOrigen || "-",
        fecha: cabecera?.fechaCorte || "-",
        modelo: cabecera?.modeloBase || "-",
        tipoTela: cabecera?.tipoTela || "-",
        totalUnidades: calcularTotalUnidadesCorte(registro?.filasCorte || [], tallasActivas),
        estado: registro?.cancelado
          ? "Cancelado"
          : registro?.estado === "confirmado"
          ? "Confirmado"
          : registro?.estado || "-",
      };
    })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

const construirReportePagos = () =>
  leerListaGuardada(CLAVE_HISTORIAL_PAGOS)
    .map((item) => ({
      id: item?.id,
      codigo: item?.codigoOp || "-",
      tipo:
        item?.tipoPago === "SERVICIO_TERCERO" ? "Servicio tercero" : "OP principal",
      taller: item?.nombreTaller || "-",
      modelo: item?.modelo || "-",
      fecha: item?.fechaPago || "-",
      monto: convertirNumero(item?.montoPago),
      estado: item?.estadoPago || "pagado",
    }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

const construirReporteTelas = () => {
  const ingresos = leerListaGuardada(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);
  const ajustes = leerListaGuardada(CLAVE_AJUSTES_MATERIA_PRIMA);
  const devoluciones = leerListaGuardada(CLAVE_DEVOLUCIONES_PRODUCCION);
  const devolucionesProveedor = leerListaGuardada(CLAVE_DEVOLUCIONES_PROVEEDOR_MP);
  const reposicionesProveedor = leerListaGuardada(CLAVE_REPOSICIONES_PROVEEDOR_MP);
  const mapaAjustes = new Map(
    ajustes.map((ajuste) => [ajuste?.codigoUnidad || ajuste?.id, ajuste])
  );
  const codigosDevueltosAceptados = new Set(
    devoluciones
      .filter((registro) => registro?.estado === "aceptada")
      .map((registro) => registro?.codigoUnidad || "")
      .filter(Boolean)
  );
  const codigosEnviadosProveedor = new Set(
    devolucionesProveedor
      .filter((registro) => registro?.estado === "enviado")
      .map((registro) => registro?.codigoUnidad || "")
      .filter(Boolean)
  );

  const stockIngresos = ingresos.flatMap((ingreso, indiceIngreso) => {
    const cabeceraCompra = ingreso?.cabeceraCompra || {};
    const filasCompra = ingreso?.filasCompra || [];
    return filasCompra.map((fila, indiceFila) => {
      const codigoUnidad = fila?.codigoUnidad || `TELA-${indiceIngreso}-${indiceFila}`;
      const ajuste = mapaAjustes.get(codigoUnidad);
      return {
        id: `${codigoUnidad}-${indiceIngreso}`,
        codigoIngreso: cabeceraCompra?.codigoInterno || "-",
        fecha: cabeceraCompra?.fechaCompra || "-",
        proveedor: cabeceraCompra?.proveedor || "-",
        codigoUnidad,
        tipoTela:
          fila?.tipoTela === "Otro"
            ? fila?.tipoTelaManual || "Otro"
            : fila?.tipoTela || "-",
        color: fila?.colorBase || "-",
        partida: fila?.partida || "-",
        ancho: convertirNumero(fila?.ancho),
        kilos: convertirNumero(ajuste?.kilos ?? fila?.kilos),
        metros: convertirNumero(ajuste?.metros ?? fila?.metros),
        estado: codigosEnviadosProveedor.has(codigoUnidad)
          ? "Enviado proveedor"
          : codigosDevueltosAceptados.has(codigoUnidad)
          ? "Devuelto a almacen"
          : "Stock",
      };
    });
  });

  const stockReposiciones = reposicionesProveedor.map((registro, indice) => ({
    id: `REP-${indice + 1}`,
    codigoIngreso: `REP-${String(indice + 1).padStart(3, "0")}`,
    fecha: registro?.fechaReposicion || "-",
    proveedor: registro?.proveedor || registro?.proveedorOriginal || "-",
    codigoUnidad: registro?.codigoUnidad || "-",
    tipoTela: registro?.tipoTela || "-",
    color: registro?.colorBase || "-",
    partida: registro?.partida || "-",
    ancho: convertirNumero(registro?.ancho),
    kilos: convertirNumero(registro?.kilos),
    metros: convertirNumero(registro?.metros),
    estado: "Reposicion proveedor",
  }));

  return [...stockIngresos, ...stockReposiciones]
    .filter((item) => !codigosEnviadosProveedor.has(item.codigoUnidad) || item.estado === "Reposicion proveedor")
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
};

const construirReporteProductosTerminados = () =>
  leerProductosTerminados()
    .map((item) => ({
      id: item?.claveProducto || item?.id,
      codigoCorto: item?.codigoCorto || "-",
      modelo: item?.modelo || "-",
      color: item?.colorBase || "-",
      talla: item?.talla || "-",
      stock: convertirNumero(item?.stockActual),
      ultimaOp: item?.ultimaOp || "-",
      ultimaFecha:
        item?.ultimaFechaRecepcion ||
        item?.ultimaFechaProduccion ||
        item?.ultimaFechaAjuste ||
        "-",
    }))
    .sort((a, b) =>
      `${a.modelo}${a.color}${a.talla}`.localeCompare(`${b.modelo}${b.color}${b.talla}`)
    );

const construirReporteRemates = () =>
  leerListaGuardada(CLAVE_REMATES_PT)
    .flatMap((registro) =>
      (Array.isArray(registro?.detalleRemate) ? registro.detalleRemate : []).flatMap((fila) =>
        TALLAS.map((talla) => ({
          id: `${registro?.recepcionId || registro?.codigoOp}-${fila?.colorBase}-${talla}`,
          codigoOp: registro?.codigoOp || "-",
          fecha: registro?.fechaRecepcion || "-",
          modelo: registro?.modelo || "-",
          color: fila?.colorBase || "-",
          talla,
          cantidad: convertirNumero(fila?.cantidades?.[talla]),
        })).filter((item) => item.cantidad > 0)
      )
    )
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

const construirReportePedidosTienda = () =>
  leerListaGuardada(CLAVE_PEDIDOS_TIENDA)
    .map((pedido) => ({
      id: pedido?.id,
      pedido: pedido?.id || "-",
      tienda: pedido?.tienda || "-",
      fecha: pedido?.fechaSolicitud || "-",
      estado: pedido?.estado || "-",
      totalSolicitado: (pedido?.detalle || []).reduce(
        (total, item) => total + convertirNumero(item?.cantidadSolicitada),
        0
      ),
      totalAtendido: convertirNumero(pedido?.totalAtendido),
    }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

const construirReporteVentasAlmacen = () =>
  leerListaGuardada(CLAVE_VENTAS_ALMACEN_PT)
    .map((venta) => ({
      id: venta?.id,
      venta: venta?.id || "-",
      fecha: venta?.fecha || "-",
      canal: venta?.canal || "DIRECTA",
      cliente: venta?.cliente || "-",
      totalPrendas: convertirNumero(venta?.totalPrendas),
      detalleModelos: (Array.isArray(venta?.detalle) ? venta.detalle : [])
        .map(
          (item) =>
            `${item?.modelo || "-"} / ${item?.colorBase || "-"} / ${item?.talla || "-"} / ${
              convertirNumero(item?.cantidadAtendida)
            }`
        )
        .join(" | "),
      observacion: venta?.observacion || "-",
    }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

const construirLineaTiempoSeguimiento = ({
  salida = {},
  recepcion = null,
  tercero = null,
  acondicionado = null,
  pago = null,
}) => {
  const eventos = [];

  if (salida?.fechaEnvio) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-salida`,
      fecha: salida.fechaEnvio,
      titulo: "Salida a taller",
      detalle: salida?.nombreTaller || "Taller principal",
      clase: "estado_avance",
    });
  }

  if (recepcion?.cabeceraRecepcion?.fechaRecepcion) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-recepcion`,
      fecha: recepcion.cabeceraRecepcion.fechaRecepcion,
      titulo: "Recepcion en almacen",
      detalle: recepcion?.cabeceraRecepcion?.tipoRecepcion || "Recepcion final",
      clase: "estado_ok",
    });
  }

  if (tercero?.fechaRecepcionAlmacen) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-tercero-listo`,
      fecha: tercero.fechaRecepcionAlmacen,
      titulo: "Lista para tercero",
      detalle: tercero?.proceso || "Proceso externo",
      clase: "estado_avance",
    });
  }

  if (tercero?.fechaEnvioTercero) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-tercero-envio`,
      fecha: tercero.fechaEnvioTercero,
      titulo: "Enviado a tercero",
      detalle: tercero?.tallerTercero || tercero?.proceso || "Servicio externo",
      clase: "estado_alerta",
    });
  }

  if (tercero?.fechaRetornoTercero) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-tercero-retorno`,
      fecha: tercero.fechaRetornoTercero,
      titulo: "Retorno de tercero",
      detalle: tercero?.tallerTercero || "Retorno confirmado",
      clase: "estado_ok",
    });
  }

  if (recepcion?.cabeceraRecepcion?.aprobadoPago) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-pago-aprobado`,
      fecha:
        recepcion?.cabeceraRecepcion?.fechaPago ||
        recepcion?.cabeceraRecepcion?.fechaRecepcion ||
        "",
      titulo: "Pago aprobado",
      detalle: "Lista para cancelar al taller",
      clase: "estado_avance",
    });
  }

  if (acondicionado?.recepcionId) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-calidad`,
      fecha:
        String(acondicionado?.fechaAcondicionado || "").trim() ||
        recepcion?.cabeceraRecepcion?.fechaRecepcion ||
        "",
      titulo: acondicionado?.cerradoStock ? "Ingreso a stock" : "En calidad",
      detalle: acondicionado?.estado || "Control de calidad",
      clase: acondicionado?.cerradoStock ? "estado_ok" : "estado_alerta",
    });
  } else if (recepcion?.cabeceraRecepcion?.aprobadoCalidad) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-calidad-pendiente`,
      fecha: recepcion?.cabeceraRecepcion?.fechaRecepcion || "",
      titulo: "En calidad",
      detalle: "Pendiente de ingreso a stock",
      clase: "estado_alerta",
    });
  }

  if (pago?.fechaPago) {
    eventos.push({
      id: `${salida?.codigoSalida || salida?.id}-pagado`,
      fecha: pago.fechaPago,
      titulo: "Pagado",
      detalle: pago?.tipoPago === "SERVICIO_TERCERO" ? "Pago de tercero" : "Pago al taller",
      clase: "estado_ok",
    });
  }

  return eventos
    .filter((item) => String(item?.fecha || "").trim())
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
};

const construirReporteSeguimientoOp = () => {
  const configuracionSeguimiento = leerConfiguracionSeguimientoOp();
  const etiquetas = configuracionSeguimiento?.estados || {};
  const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER);
  const recepciones = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);
  const procesos = leerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS);
  const acondicionados = leerListaGuardada(CLAVE_ACONDICIONADO_PT);
  const pagos = leerListaGuardada(CLAVE_HISTORIAL_PAGOS);

  return salidas
    .filter((salida) => Boolean(salida?.codigoSalida || salida?.id))
    .map((salida) => {
      const codigoSalida = String(salida?.codigoSalida || salida?.id || "").trim();
      const codigoOp = String(salida?.codigoOp || "").trim();
      const recepcion = recepciones.find((item) => {
        const cabecera = item?.cabeceraRecepcion || {};
        return (
          String(cabecera?.codigoSalida || "").trim() === codigoSalida ||
          (!codigoSalida &&
            codigoOp &&
            String(cabecera?.codigoOp || "").trim() === codigoOp)
        );
      }) || null;
      const tercero = procesos.find((item) => {
        const referencia = String(item?.codigoSalida || item?.itemSalidaId || "").trim();
        return (
          (codigoSalida && referencia === codigoSalida) ||
          (!codigoSalida && codigoOp && String(item?.codigoOp || "").trim() === codigoOp)
        );
      }) || null;
      const acondicionado = acondicionados.find((item) => {
        const referencia = String(item?.codigoSalida || "").trim();
        return (
          (codigoSalida && referencia === codigoSalida) ||
          (!codigoSalida && codigoOp && String(item?.codigoOp || "").trim() === codigoOp)
        );
      }) || null;
      const pago = pagos.find((item) => {
        const referencia = String(item?.itemSalidaId || "").trim();
        return (
          (codigoSalida && referencia === codigoSalida) ||
          (!codigoSalida && codigoOp && String(item?.codigoOp || "").trim() === codigoOp)
        );
      }) || null;

      const tieneTercero = Boolean(
        tercero?.fechaRecepcionAlmacen ||
          tercero?.fechaEnvioTercero ||
          tercero?.fechaRetornoTercero ||
          tercero?.aprobadoProduccion
      );
      const pagoAprobado = Boolean(
        recepcion?.cabeceraRecepcion?.aprobadoPago || tercero?.aprobadoProduccion
      );
      const pagoRealizado = Boolean(
        recepcion?.cabeceraRecepcion?.pagadoTaller ||
          tercero?.pagadoProduccion ||
          pago?.fechaPago
      );
      const enCalidad = Boolean(
        recepcion?.cabeceraRecepcion?.aprobadoCalidad && !acondicionado?.cerradoStock
      );
      const stockIngresado = Boolean(acondicionado?.cerradoStock);

      let etapaActualClave = "EN_TALLER";
      let estadoActual = etiquetas.enTaller || "En taller";
      let ubicacionActual = salida?.nombreTaller || "Taller principal";
      let fechaEstadoActual = salida?.fechaEnvio || "";

      if (tieneTercero && tercero?.fechaEnvioTercero && !tercero?.fechaRetornoTercero) {
        etapaActualClave = "EN_SERVICIO_TERCERO";
        estadoActual = etiquetas.enServicioTercero || "En servicio tercero";
        ubicacionActual = tercero?.tallerTercero || "Taller tercero";
        fechaEstadoActual = tercero?.fechaEnvioTercero || fechaEstadoActual;
      } else if (tieneTercero && tercero?.fechaRetornoTercero) {
        etapaActualClave = "RETORNO_TERCERO";
        estadoActual = etiquetas.retornoTercero || "Retornado de tercero";
        ubicacionActual = "Taller principal";
        fechaEstadoActual = tercero?.fechaRetornoTercero || fechaEstadoActual;
      } else if (recepcion?.cabeceraRecepcion?.fechaRecepcion) {
        etapaActualClave = "RECEPCION_ALMACEN";
        estadoActual = etiquetas.recepcionAlmacen || "Recepcionada en almacen";
        ubicacionActual = "Almacen recepcion";
        fechaEstadoActual = recepcion?.cabeceraRecepcion?.fechaRecepcion || fechaEstadoActual;
      }

      if (enCalidad) {
        etapaActualClave = "EN_CALIDAD";
        estadoActual = etiquetas.enCalidad || "En calidad";
        ubicacionActual = "Control de calidad";
        fechaEstadoActual = recepcion?.cabeceraRecepcion?.fechaRecepcion || fechaEstadoActual;
      }

      if (stockIngresado) {
        etapaActualClave = "INGRESADO_STOCK";
        estadoActual = etiquetas.ingresadoStock || "Ingresado a stock";
        ubicacionActual = "Stock de productos terminados";
        fechaEstadoActual =
          String(acondicionado?.fechaAcondicionado || "").trim() || fechaEstadoActual;
      }

      if (pagoAprobado && !pagoRealizado) {
        etapaActualClave = "PAGO_APROBADO";
        estadoActual = etiquetas.pagoAprobado || "Pago aprobado";
        ubicacionActual = "Pendiente de cancelacion";
        fechaEstadoActual =
          recepcion?.cabeceraRecepcion?.fechaPago ||
          tercero?.fechaRetornoTercero ||
          recepcion?.cabeceraRecepcion?.fechaRecepcion ||
          fechaEstadoActual;
      }

      if (pagoRealizado) {
        etapaActualClave = "PAGADA";
        estadoActual = etiquetas.pagada || "Pagada";
        ubicacionActual = stockIngresado ? "Flujo cerrado" : "Pago cerrado";
        fechaEstadoActual =
          pago?.fechaPago ||
          recepcion?.cabeceraRecepcion?.fechaPago ||
          tercero?.fechaPago ||
          fechaEstadoActual;
      }

      const ultimoMovimientoFecha =
        pago?.fechaPago ||
        String(acondicionado?.fechaAcondicionado || "").trim() ||
        recepcion?.cabeceraRecepcion?.fechaPago ||
        tercero?.fechaRetornoTercero ||
        tercero?.fechaEnvioTercero ||
        recepcion?.cabeceraRecepcion?.fechaRecepcion ||
        salida?.fechaEnvio ||
        "";
      const diasEstadoActual = calcularDiasTranscurridos(fechaEstadoActual);
      const alerta = resolverAlertaSeguimiento(
        etapaActualClave,
        diasEstadoActual,
        pagoRealizado || stockIngresado
      );
      const lineaTiempo = construirLineaTiempoSeguimiento({
        salida,
        recepcion,
        tercero,
        acondicionado,
        pago,
      });

      return {
        id: salida?.id || codigoSalida || `${codigoOp}-${salida?.nombreTaller || "taller"}`,
        codigoSalida: codigoSalida || "-",
        codigoOp: codigoOp || "-",
        modelo: salida?.modeloBase || salida?.modelo || "-",
        taller: salida?.nombreTaller || "-",
        tercero: tieneTercero
          ? etiquetas.conTercero || "Con tercero"
          : etiquetas.sinTercero || "Sin tercero",
        pago:
          pagoRealizado
            ? etiquetas.pagada || "Pagada"
            : pagoAprobado
              ? etiquetas.pagoAprobado || "Pago aprobado"
              : etiquetas.pendientePago || "Pendiente",
        calidad:
          stockIngresado
            ? etiquetas.ingresadoStock || "Ingresado a stock"
            : enCalidad
              ? etiquetas.enCalidad || "En calidad"
              : etiquetas.calidadPendiente || "Pendiente",
        etapaActualClave,
        estadoActual,
        ubicacionActual,
        diasEstadoActual,
        ultimoMovimientoFecha,
        alertaTexto: alerta.texto,
        alertaClase: alerta.clase,
        recepcionFecha: recepcion?.cabeceraRecepcion?.fechaRecepcion || "",
        fechaPago:
          pago?.fechaPago || recepcion?.cabeceraRecepcion?.fechaPago || tercero?.fechaPago || "",
        lineaTiempo,
        detalleSeguimiento: {
          salida,
          recepcion,
          tercero,
          acondicionado,
          pago,
        },
      };
    })
    .sort((a, b) =>
      String(b.ultimoMovimientoFecha || "").localeCompare(String(a.ultimoMovimientoFecha || ""))
    );
};

const CONFIG_REPORTES = {
  ops: {
    titulo: "Reporte de OP",
    columnas: [
      { key: "codigoOp", label: "Codigo OP" },
      { key: "pedido", label: "Pedido" },
      { key: "fecha", label: "Fecha" },
      { key: "modelo", label: "Modelo" },
      { key: "tipoTela", label: "Tipo tela" },
      { key: "totalUnidades", label: "Total unidades" },
      { key: "estado", label: "Estado" },
    ],
  },
  pagos: {
    titulo: "Reporte de pagos a talleres",
    columnas: [
      { key: "codigo", label: "Codigo" },
      { key: "tipo", label: "Tipo" },
      { key: "taller", label: "Taller" },
      { key: "modelo", label: "Modelo" },
      { key: "fecha", label: "Fecha pago" },
      { key: "monto", label: "Monto" },
      { key: "estado", label: "Estado" },
    ],
  },
  telas: {
    titulo: "Reporte de stock de telas",
    columnas: [
      { key: "codigoIngreso", label: "Ingreso" },
      { key: "fecha", label: "Fecha" },
      { key: "proveedor", label: "Proveedor" },
      { key: "codigoUnidad", label: "Codigo unidad" },
      { key: "tipoTela", label: "Tipo tela" },
      { key: "color", label: "Color" },
      { key: "partida", label: "Partida" },
      { key: "kilos", label: "Kilos" },
      { key: "metros", label: "Metros" },
      { key: "estado", label: "Estado" },
    ],
  },
  terminados: {
    titulo: "Reporte de producto terminado",
    columnas: [
      { key: "codigoCorto", label: "Codigo corto" },
      { key: "modelo", label: "Modelo" },
      { key: "color", label: "Color" },
      { key: "talla", label: "Talla" },
      { key: "stock", label: "Stock" },
      { key: "ultimaOp", label: "Ultima OP" },
      { key: "ultimaFecha", label: "Ultima fecha" },
    ],
  },
  remates: {
    titulo: "Reporte de remates",
    columnas: [
      { key: "codigoOp", label: "Codigo OP" },
      { key: "fecha", label: "Fecha" },
      { key: "modelo", label: "Modelo" },
      { key: "color", label: "Color" },
      { key: "talla", label: "Talla" },
      { key: "cantidad", label: "Cantidad" },
    ],
  },
  tiendas: {
    titulo: "Reporte de pedidos de tienda",
    columnas: [
      { key: "pedido", label: "Pedido" },
      { key: "tienda", label: "Tienda" },
      { key: "fecha", label: "Fecha" },
      { key: "estado", label: "Estado" },
      { key: "totalSolicitado", label: "Total solicitado" },
      { key: "totalAtendido", label: "Total atendido" },
    ],
  },
  ventasAlmacen: {
    titulo: "Reporte de ventas directas de almacen",
    columnas: [
      { key: "venta", label: "Venta" },
      { key: "fecha", label: "Fecha" },
      { key: "canal", label: "Canal" },
      { key: "cliente", label: "Cliente" },
      { key: "totalPrendas", label: "Total prendas" },
      { key: "detalleModelos", label: "Detalle" },
      { key: "observacion", label: "Observacion" },
    ],
  },
  seguimiento: {
    titulo: "Seguimiento de OP",
    columnas: [
      { key: "codigoOp", label: "OP" },
      { key: "modelo", label: "Modelo" },
      { key: "taller", label: "Taller" },
      { key: "tercero", label: "Tercero" },
      { key: "pago", label: "Pago" },
      { key: "calidad", label: "Calidad / stock" },
      { key: "estadoActual", label: "Estado actual" },
      { key: "diasEstadoActual", label: "Dias" },
      { key: "accion", label: "Accion" },
    ],
  },
};

const exportarExcel = (titulo, columnas, filas) => {
  const data = filas.map((fila) =>
    columnas.reduce((acumulado, columna) => {
      acumulado[columna.label] = fila[columna.key];
      return acumulado;
    }, {})
  );

  const hoja = XLSXUtils.json_to_sheet(data);
  const libro = XLSXUtils.book_new();
  XLSXUtils.book_append_sheet(libro, hoja, "Reporte");
  writeExcelFile(libro, `${titulo}.xlsx`);
};

const exportarPdf = (titulo, columnas, filas) => {
  const doc = new jsPDF({
    orientation: columnas.length > 6 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  doc.setFontSize(14);
  doc.text(titulo, 40, 32);

  autoTable(doc, {
    startY: 48,
    head: [columnas.map((columna) => columna.label)],
    body: filas.map((fila) => columnas.map((columna) => fila[columna.key])),
    styles: {
      fontSize: 8,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [117, 1, 152],
    },
    margin: { left: 26, right: 26 },
  });

  doc.save(`${titulo}.pdf`);
};

export function Reportes() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadModulo = resolverIdentidadVisualPorRuta("/reportes");
  const [pestanaActiva, setPestanaActiva] = useState("ops");
  const [seguimientoSeleccionado, setSeguimientoSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState(obtenerFechaActual());

  const reportes = useMemo(
    () => ({
      ops: construirReporteOps(),
      pagos: construirReportePagos(),
      telas: construirReporteTelas(),
      terminados: construirReporteProductosTerminados(),
      remates: construirReporteRemates(),
      tiendas: construirReportePedidosTienda(),
      ventasAlmacen: construirReporteVentasAlmacen(),
      seguimiento: construirReporteSeguimientoOp(),
    }),
    []
  );

  const configActual = CONFIG_REPORTES[pestanaActiva];
  const filasActuales = reportes[pestanaActiva] || [];
  const textoBusqueda = normalizarBusqueda(busqueda);
  const filasFiltradas = useMemo(
    () =>
      filasActuales.filter((fila) =>
        (!textoBusqueda ||
          Object.values(fila)
            .join(" ")
            .toLowerCase()
            .includes(textoBusqueda)) &&
        (() => {
          const fechaFila = extraerFechaComparable(fila);
          if (!fechaDesde && !fechaHasta) return true;
          if (!fechaFila || fechaFila === "-") return false;
          if (fechaDesde && fechaFila < fechaDesde) return false;
          if (fechaHasta && fechaFila > fechaHasta) return false;
          return true;
        })()
      ),
    [fechaDesde, fechaHasta, filasActuales, textoBusqueda]
  );

  const totalPrincipal = useMemo(() => {
    switch (pestanaActiva) {
      case "seguimiento":
        return formatearNumero(
          filasFiltradas.filter((item) => item?.etapaActualClave === "INGRESADO_STOCK").length,
          0
        );
      case "pagos":
        return formatearMonto(
          filasFiltradas.reduce((total, item) => total + convertirNumero(item?.monto), 0)
        );
      case "telas":
        return formatearNumero(
          filasFiltradas.reduce((total, item) => total + convertirNumero(item?.kilos), 0)
        );
      case "terminados":
        return formatearNumero(
          filasFiltradas.reduce((total, item) => total + convertirNumero(item?.stock), 0),
          0
        );
      case "remates":
        return formatearNumero(
          filasFiltradas.reduce((total, item) => total + convertirNumero(item?.cantidad), 0),
          0
        );
      case "tiendas":
        return formatearNumero(
          filasFiltradas.reduce(
            (total, item) => total + convertirNumero(item?.totalSolicitado),
            0
          ),
          0
        );
      case "ventasAlmacen":
        return formatearNumero(
          filasFiltradas.reduce(
            (total, item) => total + convertirNumero(item?.totalPrendas),
            0
          ),
          0
        );
      default:
        return formatearNumero(
          filasFiltradas.reduce(
            (total, item) => total + convertirNumero(item?.totalUnidades),
            0
          ),
          0
        );
    }
  }, [filasFiltradas, pestanaActiva]);
  const resumenSeguimiento = useMemo(() => {
    if (pestanaActiva !== "seguimiento") {
      return null;
    }

    return {
      enTaller: filasFiltradas.filter((item) => item?.etapaActualClave === "EN_TALLER").length,
      enTercero: filasFiltradas.filter((item) => item?.etapaActualClave === "EN_SERVICIO_TERCERO").length,
      enCalidad: filasFiltradas.filter((item) => item?.etapaActualClave === "EN_CALIDAD").length,
      pagoAprobado: filasFiltradas.filter((item) => item?.etapaActualClave === "PAGO_APROBADO").length,
      pagadas: filasFiltradas.filter((item) => item?.etapaActualClave === "PAGADA").length,
      ingresadasStock: filasFiltradas.filter((item) => item?.etapaActualClave === "INGRESADO_STOCK").length,
      alertas: filasFiltradas.filter((item) => item?.alertaClase === "estado_alerta").length,
    };
  }, [filasFiltradas, pestanaActiva]);
  const totalPaginas = Math.max(1, Math.ceil(filasFiltradas.length / FILAS_POR_PAGINA));
  const filasPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return filasFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [filasFiltradas, paginaActual]);

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  useEffect(() => {
    setPaginaActual(1);
    setSeguimientoSeleccionado(null);
  }, [pestanaActiva]);

  return (
    <ContenedorPagina
      style={{
        "--modulo-acento": identidadModulo.acento,
        "--modulo-fondo": identidadModulo.fondo,
      }}
    >
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
          <h1>Reportes</h1>
          <p>
            Aqui puedes consultar los reportes principales del sistema y exportarlos a
            Excel o PDF para contabilidad, control interno o revision operativa.
          </p>
          <small className="version_actual">{VERSION_SISTEMA} | Reportes</small>
        </div>

        <div className="cabecera__estado">
          <span>Filas visibles</span>
          <strong>{filasFiltradas.length}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/" className="boton_volver">
          Volver al inicio
        </Link>
      </div>

      <main className="contenido_principal">
        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Reporte actual</span>
              <strong>{configActual.titulo}</strong>
            </div>
            <div>
              <span>Registros</span>
              <strong>{filasFiltradas.length}</strong>
            </div>
            <div>
              <span>Total principal</span>
              <strong>{totalPrincipal}</strong>
            </div>
          </div>
          {resumenSeguimiento ? (
            <div className="resumen__grid resumen__grid_secundario">
              <div>
                <span>En taller</span>
                <strong>{resumenSeguimiento.enTaller}</strong>
              </div>
              <div>
                <span>En tercero</span>
                <strong>{resumenSeguimiento.enTercero}</strong>
              </div>
              <div>
                <span>En calidad</span>
                <strong>{resumenSeguimiento.enCalidad}</strong>
              </div>
              <div>
                <span>Pago aprobado</span>
                <strong>{resumenSeguimiento.pagoAprobado}</strong>
              </div>
              <div>
                <span>Pagadas</span>
                <strong>{resumenSeguimiento.pagadas}</strong>
              </div>
              <div>
                <span>Ingresadas a stock</span>
                <strong>{resumenSeguimiento.ingresadasStock}</strong>
              </div>
              <div>
                <span>Alertas</span>
                <strong>{resumenSeguimiento.alertas}</strong>
              </div>
            </div>
          ) : null}
        </section>

        <section className="tarjeta">
          <div className="pestanas">
            {Object.entries(CONFIG_REPORTES).map(([clave, config]) => (
              <button
                key={clave}
                type="button"
                className={`pestana ${pestanaActiva === clave ? "pestana_activa" : ""}`}
                onClick={() => setPestanaActiva(clave)}
              >
                {config.titulo}
              </button>
            ))}
          </div>

          <div className="tarjeta__encabezado">
            <div>
              <h2>{configActual.titulo}</h2>
              <p>
                {pestanaActiva === "seguimiento"
                  ? "Aqui ves en que punto exacto esta cada salida, cuantos dias lleva ahi y puedes abrir su recorrido completo."
                  : "El buscador trabaja sobre el reporte visible y la exportacion respeta lo que estas filtrando en pantalla."}
              </p>
            </div>

            <div className="acciones_superiores">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  exportarExcel(
                    configActual.titulo.replace(/\s+/g, "_"),
                    configActual.columnas.filter((columna) => columna.key !== "accion"),
                    filasFiltradas
                  )
                }
              >
                Exportar Excel
              </button>
              <button
                type="button"
                className="btn btn_principal"
                onClick={() =>
                  exportarPdf(
                    configActual.titulo.replace(/\s+/g, "_"),
                    configActual.columnas.filter((columna) => columna.key !== "accion"),
                    filasFiltradas
                  )
                }
              >
                Exportar PDF
              </button>
            </div>
          </div>

          <div className="filtros_superiores">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por codigo, modelo, color, taller, tienda o estado"
            />
            <input
              type="date"
              value={fechaDesde}
              onChange={(evento) => setFechaDesde(evento.target.value)}
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={(evento) => setFechaHasta(evento.target.value)}
            />
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() => {
                setBusqueda("");
                setFechaDesde("");
                setFechaHasta(obtenerFechaActual());
              }}
            >
              Limpiar filtros
            </button>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  {configActual.columnas.map((columna) => (
                    <th key={columna.key}>{columna.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasPagina.length === 0 ? (
                  <tr>
                    <td colSpan={configActual.columnas.length} className="fila_vacia">
                      No hay registros para mostrar en este reporte.
                    </td>
                  </tr>
                ) : (
                  filasPagina.map((fila) => (
                    <tr key={fila.id}>
                      {configActual.columnas.map((columna) => (
                        <td key={`${fila.id}-${columna.key}`}>
                          {columna.key === "monto" ? (
                            formatearMonto(fila[columna.key])
                          ) : columna.key === "accion" ? (
                            <button
                              type="button"
                              className="btn btn_secundario btn_tabla"
                              onClick={() => setSeguimientoSeleccionado(fila)}
                            >
                              Ver recorrido
                            </button>
                          ) : columna.key === "diasEstadoActual" ? (
                            <span className={`chip_estado ${fila?.alertaClase || "estado_avance"}`}>
                              {fila?.alertaTexto || `${fila[columna.key]} dia(s)`}
                            </span>
                          ) : (
                            fila[columna.key]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pestanaActiva === "seguimiento" && seguimientoSeleccionado ? (
            <section className="tarjeta tarjeta_interna">
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Recorrido de la OP</h2>
                  <p>
                    {seguimientoSeleccionado.codigoSalida} | {seguimientoSeleccionado.codigoOp} |{" "}
                    {seguimientoSeleccionado.taller}
                  </p>
                </div>
              </div>

              <div className="resumen__grid resumen__grid_secundario">
                <div>
                  <span>Estado actual</span>
                  <strong>{seguimientoSeleccionado.estadoActual}</strong>
                </div>
                <div>
                  <span>Ubicacion actual</span>
                  <strong>{seguimientoSeleccionado.ubicacionActual}</strong>
                </div>
                <div>
                  <span>Tercero</span>
                  <strong>{seguimientoSeleccionado.tercero}</strong>
                </div>
                <div>
                  <span>Pago</span>
                  <strong>{seguimientoSeleccionado.pago}</strong>
                </div>
                <div>
                  <span>Calidad / stock</span>
                  <strong>{seguimientoSeleccionado.calidad}</strong>
                </div>
                <div>
                  <span>Ultimo movimiento</span>
                  <strong>{formatearFechaVisible(seguimientoSeleccionado.ultimoMovimientoFecha)}</strong>
                </div>
              </div>

              <div className="linea_tiempo">
                {seguimientoSeleccionado.lineaTiempo.length === 0 ? (
                  <div className="item_vacio">
                    Todavia no hay movimientos registrados para esta salida.
                  </div>
                ) : (
                  seguimientoSeleccionado.lineaTiempo.map((evento) => (
                    <article key={evento.id} className={`linea_tiempo__item ${evento.clase}`}>
                      <span className="linea_tiempo__fecha">
                        {formatearFechaVisible(evento.fecha)}
                      </span>
                      <strong>{evento.titulo}</strong>
                      <p>{evento.detalle}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {filasFiltradas.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaActual((valor) => Math.max(1, valor - 1))}
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
                onClick={() => setPaginaActual((valor) => Math.min(totalPaginas, valor + 1))}
                disabled={paginaActual >= totalPaginas}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
  min-height: 100vh;
  width: 100%;
  background: ${({ theme }) => theme.bgtotal};
  color: ${({ theme }) => theme.text};
  display: grid;
  grid-template:
    "encabezado" 90px
    "cabecera" auto
    "fila_superior" auto
    "contenido_principal" 1fr;
  gap: 15px;
  padding: 15px;

  .encabezado,
  .cabecera,
  .fila_superior,
  .contenido_principal {
    border-radius: 20px;
  }

  .encabezado {
    grid-area: encabezado;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: ${({ theme }) => theme.bgcards};
    padding-right: 10px;
  }

  .cabecera {
    grid-area: cabecera;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 24px;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .cabecera p,
  .tarjeta__encabezado p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.6;
  }

  .version_actual {
    display: inline-block;
    margin-top: 10px;
    color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    font-size: 13px;
    font-weight: 700;
  }

  .cabecera__estado {
    min-width: 180px;
    padding: 16px 18px;
    border-radius: 16px;
    background: var(--modulo-fondo, rgba(117, 1, 152, 0.12));
    border: 1px solid var(--modulo-acento, rgba(117, 1, 152, 0.24));
  }

  .cabecera__estado span {
    display: block;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .cabecera__estado strong {
    display: block;
    margin-top: 8px;
    font-size: 28px;
    color: var(--modulo-acento, ${({ theme }) => theme.bg5});
  }

  .fila_superior {
    grid-area: fila_superior;
    display: flex;
    justify-content: flex-start;
  }

  .contenido_principal {
    grid-area: contenido_principal;
    display: grid;
    gap: 16px;
  }

  .boton_volver,
  .btn,
  .pestana {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .boton_volver,
  .btn_secundario {
    background: #5b5b60;
    color: #ffffff;
  }

  .btn_principal {
    background: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 20px;
    padding: 20px;
  }

  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .resumen__grid div {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg2};
    min-height: 110px;
    display: grid;
    align-content: start;
  }

  .resumen__grid span {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
  }

  .resumen__grid strong {
    display: block;
    margin-top: 6px;
    color: ${({ theme }) => theme.text};
    font-size: 20px;
  }

  .resumen__grid_secundario {
    margin-top: 12px;
  }

  .pestanas {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
    padding: 8px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    background: ${({ theme }) => theme.bg2};
  }

  .pestana {
    border: 1px solid ${({ theme }) => theme.bg4};
    background: transparent;
    color: ${({ theme }) => theme.text};
  }

  .pestana_activa {
    background: var(--modulo-acento, ${({ theme }) => theme.bg5});
    border-color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .tarjeta__encabezado,
  .acciones_superiores {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .filtros_superiores {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) 160px 160px auto;
    gap: 12px;
    margin: 16px 0;
  }

  .filtros_superiores input {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  .tabla_contenedor {
    overflow: auto;
  }

  table {
    width: 100%;
    min-width: 920px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 12px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
    text-align: left;
    vertical-align: top;
  }

  th {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  td {
    color: #ffffff;
    font-size: 14px;
  }

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 18px;
  }

  .tarjeta_interna {
    margin-top: 18px;
    background: ${({ theme }) => theme.bg2};
  }

  .btn_tabla {
    width: 100%;
    min-width: 140px;
  }

  .chip_estado {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 92px;
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }

  .estado_ok {
    background: rgba(78, 201, 140, 0.12);
    color: #86e0ad;
    border: 1px solid rgba(78, 201, 140, 0.35);
  }

  .estado_avance {
    background: rgba(100, 196, 255, 0.12);
    color: #9fdcff;
    border: 1px solid rgba(100, 196, 255, 0.35);
  }

  .estado_atencion {
    background: rgba(214, 146, 32, 0.12);
    color: #ffd278;
    border: 1px solid rgba(214, 146, 32, 0.38);
  }

  .estado_alerta {
    background: rgba(255, 122, 89, 0.12);
    color: #ff9f85;
    border: 1px solid rgba(255, 122, 89, 0.35);
  }

  .linea_tiempo {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .linea_tiempo__item {
    border-radius: 16px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bgcards};
    padding: 14px;
    display: grid;
    gap: 8px;
  }

  .linea_tiempo__fecha {
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .linea_tiempo__item strong {
    color: ${({ theme }) => theme.text};
    font-size: 15px;
  }

  .linea_tiempo__item p,
  .item_vacio {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  @media (max-width: 900px) {
    .cabecera,
    .tarjeta__encabezado,
    .acciones_superiores {
      flex-direction: column;
      align-items: stretch;
    }

    .cabecera__estado {
      width: 100%;
    }

    .filtros_superiores {
      grid-template-columns: 1fr;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;
