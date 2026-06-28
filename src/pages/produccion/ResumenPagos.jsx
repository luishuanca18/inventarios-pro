import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {
  confirmarAccionSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";
import {
  sincronizarTallerStockDesdeLocalASupabase,
  sincronizarTallerStockDesdeSupabase,
} from "../../supabase/flujoTallerStockCore";

const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_TERCERIZACIONES = "cynara_tercerizaciones_op";
const CLAVE_HISTORIAL_PAGOS = "cynara_historial_pagos";
const CLAVE_DESCUENTOS_TALLER = "cynara_descuentos_taller";
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

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
};

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const redondearMoneda = (valor) =>
  Math.round((convertirNumero(valor) + Number.EPSILON) * 100) / 100;

const normalizarTipoAjusteManual = (valor = "DESCUENTA") =>
  String(valor || "").toUpperCase() === "AUMENTA" ? "AUMENTA" : "DESCUENTA";

const formatearMontoSoles = (valor) =>
  `S/ ${convertirNumero(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatearMontoAjuste = (valor) => {
  const monto = convertirNumero(valor);

  if (monto === 0) {
    return formatearMontoSoles(0);
  }

  return `${monto < 0 ? "+" : "-"} ${formatearMontoSoles(Math.abs(monto))}`;
};

const calcularDescuentoDetalladoRecepcion = (cabecera = {}) =>
  (Array.isArray(cabecera?.descuentosPrendaTaller)
    ? cabecera.descuentosPrendaTaller
    : []
  ).reduce(
    (total, item) =>
      total +
      convertirNumero(item?.cantidad) * convertirNumero(item?.precioUnitario),
    0
  );

const calcularPagoUnitarioRecepcion = (cabecera = {}) => {
  const pagoUnitario = convertirNumero(cabecera?.pagoUnitarioPrenda);
  if (pagoUnitario > 0) {
    return pagoUnitario;
  }

  const cantidadTotal = convertirNumero(cabecera?.cantidadTotal);
  if (cantidadTotal <= 0) {
    return 0;
  }

  return convertirNumero(cabecera?.totalPagarTaller) / cantidadTotal;
};

const calcularMontoIncidenciasRecepcion = (cabecera = {}, destinoBuscado = "") => {
  const destinoNormalizado = String(destinoBuscado || "").trim().toUpperCase();
  const pagoUnitario = calcularPagoUnitarioRecepcion(cabecera);

  if (!destinoNormalizado || pagoUnitario <= 0) {
    return 0;
  }

  return redondearMoneda(
    (Array.isArray(cabecera?.incidenciasRecepcion) ? cabecera.incidenciasRecepcion : [])
      .filter(
        (item) =>
          String(item?.destino || "").trim().toUpperCase() === destinoNormalizado
      )
      .reduce((total, item) => total + convertirNumero(item?.cantidad) * pagoUnitario, 0)
  );
};

const calcularTotalNetoRecepcion = (cabecera = {}) =>
  redondearMoneda(
    convertirNumero(cabecera?.totalPagarTaller) -
      convertirNumero(cabecera?.adelantoTaller) -
      calcularDescuentoDetalladoRecepcion(cabecera)
  );

const calcularSaldoPago = (cabecera = {}, descuentoManual = 0) =>
  redondearMoneda(
    calcularTotalNetoRecepcion(cabecera) -
      convertirNumero(cabecera?.montoPagadoAcumulado) -
      descuentoManual
  );

const calcularDescuentoDetalladoTercero = (descuentos = []) =>
  (Array.isArray(descuentos) ? descuentos : []).reduce(
    (total, item) =>
      total +
      convertirNumero(item?.cantidad) * convertirNumero(item?.precioUnitario),
    0
  );

const calcularTotalBrutoTercero = (registro = {}) => {
  const subtotal = convertirNumero(registro?.subtotalServicio);
  if (subtotal > 0) {
    return subtotal;
  }

  const cantidadPorCosto =
    convertirNumero(registro?.cantidad) * convertirNumero(registro?.costoUnitario);
  if (cantidadPorCosto > 0) {
    return cantidadPorCosto;
  }

  return (
    convertirNumero(registro?.total) +
    convertirNumero(registro?.totalDescuento) +
    calcularDescuentoDetalladoTercero(registro?.descuentosPrendaTercero || [])
  );
};

const calcularTotalNetoTercero = (registro = {}) => {
  const bruto = calcularTotalBrutoTercero(registro);
  const descuentoDetallado =
    convertirNumero(registro?.totalDescuento) ||
    calcularDescuentoDetalladoTercero(registro?.descuentosPrendaTercero || []);
  const netoGuardado = convertirNumero(registro?.total);

  if (netoGuardado > 0 && convertirNumero(registro?.subtotalServicio) > 0) {
    return netoGuardado;
  }

  return Math.max(0, bruto - descuentoDetallado);
};

const calcularSaldoPagoTercero = (registro = {}, descuentoManual = 0) =>
  calcularTotalNetoTercero(registro) -
  convertirNumero(registro?.montoPagadoAcumulado) -
  descuentoManual;

const generarIdHistorialPago = () =>
  `PAGO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const leerDescuentosTaller = () => leerListaGuardada(CLAVE_DESCUENTOS_TALLER);

const construirClaveDescuento = ({
  tipoPago = "",
  registroId = "",
  idRegistroPago = "",
}) => `${tipoPago}|${registroId || idRegistroPago}`;

const calcularDescuentoAcumulado = (descuentos = [], referencia = {}) =>
  descuentos
    .filter(
      (item) =>
        construirClaveDescuento(item) === construirClaveDescuento(referencia) &&
        item?.origenDescuento !== "RECEPCION_ALMACEN"
    )
    .reduce((total, item) => {
      const monto = convertirNumero(item?.montoDescuento);
      return (
        total +
        (normalizarTipoAjusteManual(item?.tipoAjusteManual) === "AUMENTA"
          ? -monto
          : monto)
      );
    }, 0);

const obtenerAjustesManualesPago = (descuentos = [], referencia = {}) =>
  descuentos
    .filter(
      (item) =>
        construirClaveDescuento(item) === construirClaveDescuento(referencia)
    )
    .sort((a, b) =>
      String(b?.fechaDescuento || "").localeCompare(String(a?.fechaDescuento || ""))
    );

const resumirIncidenciasPago = (item = {}) => {
  if (item?.tipoPago === "SERVICIO_TERCERO") {
    const incidencias = Array.isArray(item?.incidencias) ? item.incidencias : [];
    if (incidencias.length === 0) {
      return ["Sin incidencias registradas para este servicio tercero."];
    }

    return incidencias.map((incidencia) => {
      const color = incidencia?.colorBase || "-";
      const talla = incidencia?.talla || "-";
      const cantidad = convertirNumero(incidencia?.cantidad);
      const motivo = incidencia?.motivo || "Sin motivo";
      return `${color} / ${talla} / ${cantidad} prenda(s) / ${motivo}`;
    });
  }

  const incidencias = Array.isArray(item?.incidencias) ? item.incidencias : [];
  const lineas = [];

  if (item?.montoNoPagar > 0) {
    lineas.push(`Merma / no pagar registrada: ${formatearMontoSoles(item.montoNoPagar)}`);
  }

  if (item?.descuentoDetallado > 0) {
    lineas.push(
      `Descuento por prenda registrado: ${formatearMontoSoles(item.descuentoDetallado)}`
    );
  }

  incidencias.forEach((incidencia) => {
    const color = incidencia?.colorBase || "-";
    const talla = incidencia?.talla || "-";
    const cantidad = convertirNumero(incidencia?.cantidad);
    const motivo = incidencia?.motivo || "Sin motivo";
    const destino = incidencia?.destino || "SIN DESTINO";
    lineas.push(`${color} / ${talla} / ${cantidad} prenda(s) / ${destino} / ${motivo}`);
  });

  return lineas.length > 0 ? lineas : ["Sin incidencias registradas para esta OP."];
};

const construirPagosPendientes = () => {
  const recepciones = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);
  const tercerizaciones = leerListaGuardada(CLAVE_TERCERIZACIONES);
  const descuentos = leerDescuentosTaller();

  const pagosRecepcion = recepciones
    .map((registro) => {
      const referencia = {
        tipoPago: "OP_PRINCIPAL",
        registroId: registro.id,
        idRegistroPago: registro.id,
      };
      const descuentoManual = calcularDescuentoAcumulado(descuentos, referencia);
      const descuentoDetallado = calcularDescuentoDetalladoRecepcion(
        registro?.cabeceraRecepcion
      );
      const montoNoPagar = calcularMontoIncidenciasRecepcion(
        registro?.cabeceraRecepcion,
        "NO PAGAR"
      );
      const totalNetoPagar = Math.max(
        0,
        calcularTotalNetoRecepcion(registro?.cabeceraRecepcion)
      );
      const saldoBruto = Math.max(
        0,
        calcularSaldoPago(registro?.cabeceraRecepcion, descuentoManual)
      );

      return {
        id: registro.id,
        registroId: registro.id,
        itemSalidaId: registro?.cabeceraRecepcion?.itemSalidaId || "",
        codigoSalida: registro?.cabeceraRecepcion?.codigoSalida || "",
        codigoMostrado:
          registro?.cabeceraRecepcion?.codigoSalida ||
          registro?.cabeceraRecepcion?.codigoOp ||
          "-",
        codigoOp: registro?.cabeceraRecepcion?.codigoOp || "-",
        nombreTaller: registro?.cabeceraRecepcion?.nombreTaller || "-",
        modelo: registro?.cabeceraRecepcion?.modelo || "-",
        fechaRecepcion: registro?.cabeceraRecepcion?.fechaRecepcion || "-",
        cantidadRecibida:
          registro?.cabeceraRecepcion?.cantidadRecibida ||
          registro?.cabeceraRecepcion?.cantidadTotal ||
          0,
        totalPagarTaller: totalNetoPagar,
        montoPagadoAcumulado: convertirNumero(
          registro?.cabeceraRecepcion?.montoPagadoAcumulado
        ),
        adelantoTaller: convertirNumero(registro?.cabeceraRecepcion?.adelantoTaller),
        descuentoAcumulado: descuentoManual,
        descuentoDetallado,
        montoNoPagar,
        saldoPagar: saldoBruto,
        incidencias: Array.isArray(registro?.cabeceraRecepcion?.incidenciasRecepcion)
          ? registro.cabeceraRecepcion.incidenciasRecepcion
          : [],
        tipoPago: "OP_PRINCIPAL",
        referenciaPago:
          registro?.cabeceraRecepcion?.codigoSalida ||
          registro?.cabeceraRecepcion?.codigoOp ||
          "-",
      };
    })
    .filter(
      (item) =>
        item?.saldoPagar > 0 &&
        item?.registroId &&
        recepciones.find((registro) => registro?.id === item.registroId)?.cabeceraRecepcion
          ?.tipoRecepcion === "final" &&
        Boolean(
          recepciones.find((registro) => registro?.id === item.registroId)?.cabeceraRecepcion
            ?.aprobadoPago
        )
    );

  const pagosTerceros = tercerizaciones
    .map((registro) => {
      const referencia = {
        tipoPago: "SERVICIO_TERCERO",
        registroId: registro.id,
        idRegistroPago: `tercero-${registro.id}`,
      };
      const descuentoManual = calcularDescuentoAcumulado(descuentos, referencia);
      const descuentoDetallado = calcularDescuentoDetalladoTercero(
        registro?.descuentosPrendaTercero || []
      );
      const totalNetoPagar = Math.max(0, calcularTotalNetoTercero(registro));
      const saldoBruto = Math.max(0, calcularSaldoPagoTercero(registro, descuentoManual));

      return {
        id: `tercero-${registro.id}`,
        registroId: registro.id,
        itemSalidaId: "",
        codigoSalida: "",
        codigoMostrado: registro?.codigoTercerizacion || registro?.codigoOp || "-",
        codigoOp: registro?.codigoTercerizacion || registro?.codigoOp || "-",
        nombreTaller: registro?.tallerTercero || "-",
        modelo: `${registro?.proceso || "SERVICIO"} | ${registro?.modelo || "-"}`,
        fechaRecepcion: registro?.fechaRetornoTercero || registro?.fechaSolicitud || "-",
        cantidadRecibida: convertirNumero(registro?.cantidad),
        totalPagarTaller: totalNetoPagar,
        montoPagadoAcumulado: convertirNumero(registro?.montoPagadoAcumulado),
        adelantoTaller: 0,
        descuentoAcumulado: descuentoManual,
        descuentoDetallado,
        saldoPagar: saldoBruto,
        incidencias: Array.isArray(registro?.descuentosPrendaTercero)
          ? registro.descuentosPrendaTercero.filter(
              (item) =>
                convertirNumero(item?.cantidad) > 0 &&
                convertirNumero(item?.precioUnitario) > 0
            )
          : [],
        tipoPago: "SERVICIO_TERCERO",
        referenciaPago: registro?.codigoTercerizacion || registro?.codigoOp || "-",
      };
    })
    .filter((item) => item?.saldoPagar > 0);

  return [...pagosRecepcion, ...pagosTerceros]
    .sort((a, b) => String(b.fechaRecepcion).localeCompare(String(a.fechaRecepcion)));
};

const deduplicarHistorialPagos = (historial = []) => {
  const mapa = new Map();

  historial.forEach((item) => {
    const clave = [
      item?.tipoPago || "",
      item?.registroId || item?.idRegistroPago || "",
      item?.itemSalidaId || "",
      item?.fechaPago || "",
      convertirNumero(item?.montoPago),
    ].join("|");

    if (!mapa.has(clave)) {
      mapa.set(clave, item);
    }
  });

  return Array.from(mapa.values()).sort((a, b) =>
    String(b?.fechaPago || "").localeCompare(String(a?.fechaPago || ""))
  );
};

const construirHistorialPagos = () => {
  const historialNormalizado = deduplicarHistorialPagos(
    leerListaGuardada(CLAVE_HISTORIAL_PAGOS)
  );
  localStorage.setItem(CLAVE_HISTORIAL_PAGOS, JSON.stringify(historialNormalizado));
  return historialNormalizado;
};

export function ResumenPagos() {
  const navigate = useNavigate();
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [paginaPendientes, setPaginaPendientes] = useState(1);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [fechaPago, setFechaPago] = useState(obtenerFechaActual());
  const [versionDatos, setVersionDatos] = useState(0);
  const [seleccionados, setSeleccionados] = useState([]);
  const [descuentoActivo, setDescuentoActivo] = useState(null);
  const [fechaDescuento, setFechaDescuento] = useState(obtenerFechaActual());
  const [montoDescuento, setMontoDescuento] = useState("");
  const [motivoDescuento, setMotivoDescuento] = useState("");
  const [tipoAjusteManual, setTipoAjusteManual] = useState("DESCUENTA");
  const [detalleActivo, setDetalleActivo] = useState(null);
  const panelAjusteRef = useRef(null);
  const montoAjusteRef = useRef(null);

  const pagosPendientes = useMemo(construirPagosPendientes, [versionDatos]);
  const historialPagos = useMemo(construirHistorialPagos, [versionDatos]);
  const descuentosManuales = useMemo(leerDescuentosTaller, [versionDatos]);

  const pagosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return pagosPendientes;
    }

    return pagosPendientes.filter((item) =>
      [item.codigoMostrado || item.codigoOp, item.nombreTaller, item.modelo, item.fechaRecepcion, item.tipoPago]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, pagosPendientes]);

  const historialFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return historialPagos;
    }

    return historialPagos.filter((item) =>
      [
        item.codigoMostrado || item.codigoOp,
        item.nombreTaller,
        item.modelo,
        item.fechaPago,
        item.tipoPago,
        item.estadoPago,
        item.observacionPago,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, historialPagos]);

  const totalPaginasPendientes = Math.max(
    1,
    Math.ceil(pagosFiltrados.length / FILAS_POR_PAGINA)
  );
  const totalPaginasHistorial = Math.max(
    1,
    Math.ceil(historialFiltrado.length / FILAS_POR_PAGINA)
  );

  const pagosPendientesPagina = useMemo(() => {
    const inicio = (paginaPendientes - 1) * FILAS_POR_PAGINA;
    return pagosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [pagosFiltrados, paginaPendientes]);

  const historialPagina = useMemo(() => {
    const inicio = (paginaHistorial - 1) * FILAS_POR_PAGINA;
    return historialFiltrado.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [historialFiltrado, paginaHistorial]);

  useEffect(() => {
    if (paginaPendientes > totalPaginasPendientes) {
      setPaginaPendientes(totalPaginasPendientes);
    }
    if (paginaHistorial > totalPaginasHistorial) {
      setPaginaHistorial(totalPaginasHistorial);
    }
  }, [paginaPendientes, paginaHistorial, totalPaginasPendientes, totalPaginasHistorial]);

  const todosFiltradosSeleccionados =
    pagosFiltrados.length > 0 &&
    pagosFiltrados.every((item) => seleccionados.includes(item.id));

  const totalSeleccionado = pagosPendientes
    .filter((item) => seleccionados.includes(item.id))
    .reduce((total, item) => total + convertirNumero(item.saldoPagar), 0);

  const totalGeneralPendiente = pagosFiltrados.reduce(
    (total, item) => total + convertirNumero(item.saldoPagar),
    0
  );
  const totalGeneralHistorial = historialFiltrado.reduce(
    (total, item) => total + convertirNumero(item.montoPago),
    0
  );

  const totalOpsSeleccionadas = pagosPendientes.filter((item) =>
    seleccionados.includes(item.id)
  ).length;

  const manejarSeleccion = (idPago) => {
    setSeleccionados((anterior) =>
      anterior.includes(idPago)
        ? anterior.filter((item) => item !== idPago)
        : [...anterior, idPago]
    );
  };

  const manejarSeleccionarTodo = () => {
    if (todosFiltradosSeleccionados) {
      const idsFiltrados = new Set(pagosFiltrados.map((item) => item.id));
      setSeleccionados((anterior) => anterior.filter((id) => !idsFiltrados.has(id)));
      return;
    }

    setSeleccionados((anterior) => [
      ...new Set([...anterior, ...pagosFiltrados.map((item) => item.id)]),
    ]);
  };

  const abrirDescuento = (item) => {
    setDescuentoActivo(item);
    setFechaDescuento(obtenerFechaActual());
    setMontoDescuento("");
    setMotivoDescuento("");
    setTipoAjusteManual("DESCUENTA");
  };

  const abrirDetalle = (item) => {
    setDetalleActivo(item);
  };

  const cerrarDetalle = () => {
    setDetalleActivo(null);
  };

  const irAModuloOrigen = (item) => {
    if (!item) return;
    if (item.tipoPago === "SERVICIO_TERCERO") {
      navigate("/produccion/tercerizaciones");
      return;
    }

    navigate("/produccion/recepciones");
  };

  const ajustesManualesActivos = useMemo(() => {
    if (!descuentoActivo) {
      return [];
    }

    return obtenerAjustesManualesPago(descuentosManuales, {
      tipoPago: descuentoActivo.tipoPago,
      registroId: descuentoActivo.registroId || descuentoActivo.id,
      idRegistroPago: descuentoActivo.id,
    });
  }, [descuentosManuales, descuentoActivo]);

  const guardarDescuento = async () => {
    if (!descuentoActivo) {
      return;
    }

    const monto = convertirNumero(montoDescuento);
    if (monto <= 0) {
      await mostrarAlertaSistema("Ingresa un monto de ajuste valido.");
      return;
    }

    const tipoAjuste = normalizarTipoAjusteManual(tipoAjusteManual);

    if (
      tipoAjuste === "DESCUENTA" &&
      monto > convertirNumero(descuentoActivo?.saldoPagar)
    ) {
      await mostrarAlertaSistema("El ajuste no puede descontar mas que el saldo pendiente.");
      return;
    }

    const descuentosActuales = leerDescuentosTaller();
    const nuevoDescuento = {
      id: `DESC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      tipoPago: descuentoActivo.tipoPago,
      registroId: descuentoActivo.registroId || descuentoActivo.id,
      idRegistroPago: descuentoActivo.id,
      itemSalidaId: descuentoActivo.itemSalidaId || "",
      codigoOp: descuentoActivo.codigoOp,
      nombreTaller: descuentoActivo.nombreTaller,
      modelo: descuentoActivo.modelo,
      tipoAjusteManual: tipoAjuste,
      fechaDescuento,
      montoDescuento: monto,
      motivoDescuento:
        motivoDescuento ||
        (tipoAjuste === "AUMENTA"
          ? "AUMENTO MANUAL DE SALDO"
          : "DESCUENTO MANUAL DE SALDO"),
    };

    localStorage.setItem(
      CLAVE_DESCUENTOS_TALLER,
      JSON.stringify([nuevoDescuento, ...descuentosActuales])
    );

    setDescuentoActivo(null);
    setMontoDescuento("");
    setMotivoDescuento("");
    setTipoAjusteManual("DESCUENTA");
    setVersionDatos((anterior) => anterior + 1);
    await mostrarNotificacionCarga(
      tipoAjuste === "AUMENTA"
        ? "Ajuste manual guardado. El saldo pendiente aumento."
        : "Ajuste manual guardado. El saldo pendiente se desconto."
    );
  };

  const borrarAjusteManual = async (idAjuste) => {
    const descuentosActuales = leerDescuentosTaller();
    const existe = descuentosActuales.some((item) => item?.id === idAjuste);

    if (!existe) {
      await mostrarAlertaSistema("Ese ajuste ya no existe o ya fue borrado.");
      return;
    }

    localStorage.setItem(
      CLAVE_DESCUENTOS_TALLER,
      JSON.stringify(descuentosActuales.filter((item) => item?.id !== idAjuste))
    );

    setVersionDatos((anterior) => anterior + 1);
    await mostrarNotificacionCarga("Ajuste manual borrado correctamente.");
  };

  useEffect(() => {
    if (!descuentoActivo) {
      return;
    }

    const timeout = setTimeout(() => {
      const rectTop = panelAjusteRef.current?.getBoundingClientRect().top ?? 0;
      const top = rectTop + window.scrollY;

      window.scrollTo({
        top: Math.max(0, top - 24),
        behavior: "smooth",
      });
      montoAjusteRef.current?.focus();
      montoAjusteRef.current?.select?.();
    }, 120);

    return () => {
      clearTimeout(timeout);
    };
  }, [descuentoActivo]);

  const manejarMarcarPagadas = async () => {
    if (seleccionados.length === 0) {
      await mostrarAlertaSistema("Selecciona al menos una OP para marcarla como pagada.");
      return;
    }

    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas marcar ${totalOpsSeleccionadas} registros como pagados?\n\nTotal a cancelar: ${formatearMontoSoles(totalSeleccionado)}`
    );

    if (!confirmar) {
      return;
    }

    const recepcionesActuales = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);
    const salidasActuales = leerListaGuardada(CLAVE_SALIDAS_TALLER);
    const tercerizacionesActuales = leerListaGuardada(CLAVE_TERCERIZACIONES);
    const historialActual = leerListaGuardada(CLAVE_HISTORIAL_PAGOS);

    const idsSeleccionados = new Set(seleccionados);
    const pagosSeleccionados = pagosPendientes.filter(
      (item) => idsSeleccionados.has(item.id) && convertirNumero(item?.saldoPagar) > 0
    );

    if (pagosSeleccionados.length === 0) {
      await mostrarAlertaSistema(
        "Los registros seleccionados ya no tienen saldo pendiente. Actualiza la vista antes de volver a pagar."
      );
      setSeleccionados([]);
      setVersionDatos((anterior) => anterior + 1);
      return;
    }
    const saldoPorPago = new Map(
      pagosSeleccionados.map((item) => [item.id, convertirNumero(item.saldoPagar)])
    );
    const idsRecepcionSeleccionados = new Set(
      pagosSeleccionados
        .filter((item) => item.tipoPago === "OP_PRINCIPAL")
        .map((item) => item.id)
    );
    const idsTercerizacionSeleccionados = new Set(
      pagosSeleccionados
        .filter((item) => item.tipoPago === "SERVICIO_TERCERO")
        .map((item) => item.registroId)
    );

    const recepcionesActualizadas = recepcionesActuales.map((registro) =>
      idsRecepcionSeleccionados.has(registro?.id)
        ? {
            ...registro,
            cabeceraRecepcion: {
              ...registro.cabeceraRecepcion,
              aprobadoPago: true,
              montoPagadoAcumulado:
                convertirNumero(registro?.cabeceraRecepcion?.montoPagadoAcumulado) +
                convertirNumero(saldoPorPago.get(registro.id)),
              pagadoTaller: true,
              fechaPago,
            },
          }
        : registro
    );

    const itemSalidaIds = new Set(
      recepcionesActualizadas
        .filter((registro) => idsRecepcionSeleccionados.has(registro?.id))
        .map((registro) => registro?.cabeceraRecepcion?.itemSalidaId)
        .filter(Boolean)
    );

    const salidasActualizadas = salidasActuales.map((salida) =>
      itemSalidaIds.has(salida?.id)
        ? {
            ...salida,
            aprobadoPago: true,
            montoPagadoAcumulado:
              convertirNumero(salida?.montoPagadoAcumulado) +
              convertirNumero(
                saldoPorPago.get(
                  recepcionesActualizadas.find(
                    (registro) => registro?.cabeceraRecepcion?.itemSalidaId === salida?.id
                  )?.id
                )
              ),
            pagadoTaller: true,
            fechaPago,
          }
        : salida
    );

    const tercerizacionesActualizadas = tercerizacionesActuales.map((registro) =>
      idsTercerizacionSeleccionados.has(registro?.id)
        ? {
            ...registro,
            aprobadoProduccion: true,
            montoPagadoAcumulado:
              convertirNumero(registro?.montoPagadoAcumulado) +
              convertirNumero(saldoPorPago.get(`tercero-${registro.id}`)),
            pagadoProduccion: true,
            fechaPago,
          }
        : registro
    );

    const historialNuevo = pagosSeleccionados.map((item) => ({
      id: generarIdHistorialPago(),
      idRegistroPago: item.id,
      registroId: item.registroId || item.id,
      itemSalidaId: item.itemSalidaId || "",
      referenciaPago: item.referenciaPago || item.codigoOp || "-",
      tipoPago: item.tipoPago,
      codigoOp: item.codigoOp,
      nombreTaller: item.nombreTaller,
      modelo: item.modelo,
      cantidadRecibida: item.cantidadRecibida,
      montoPago: convertirNumero(item.saldoPagar),
      fechaPago,
      observacionPago:
        item.descuentoAcumulado > 0
          ? `Incluye ajuste que descuenta ${formatearMontoSoles(item.descuentoAcumulado)}`
          : item.descuentoAcumulado < 0
            ? `Incluye ajuste que aumenta ${formatearMontoSoles(
                Math.abs(item.descuentoAcumulado)
              )}`
          : "",
      estadoPago: "pagado",
    }));

    localStorage.setItem(CLAVE_RECEPCIONES_TALLER, JSON.stringify(recepcionesActualizadas));
    localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(salidasActualizadas));
    localStorage.setItem(CLAVE_TERCERIZACIONES, JSON.stringify(tercerizacionesActualizadas));
    localStorage.setItem(
      CLAVE_HISTORIAL_PAGOS,
      JSON.stringify([...historialNuevo, ...historialActual])
    );
    await sincronizarTallerStockDesdeLocalASupabase();
    await sincronizarTallerStockDesdeSupabase();
    setSeleccionados([]);
    setVersionDatos((anterior) => anterior + 1);
    await mostrarNotificacionCarga(
      "Los registros seleccionados ya pasaron a estado pagado."
    );
  };

  const refrescarVista = () => {
    setVersionDatos((anterior) => anterior + 1);
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
          <h1>Resumen de pagos</h1>
          <p>
            Aqui Produccion revisa lo pendiente por pagar y tambien consulta el historial
            de pagos ya realizados para mantener el control completo.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>{pestanaActiva === "pendientes" ? "Registros por pagar" : "Pagos registrados"}</span>
          <strong>
            {pestanaActiva === "pendientes" ? pagosPendientes.length : historialPagos.length}
          </strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/produccion" className="boton_volver">
          Volver a Produccion
        </Link>

        <div className="navegacion_superior">
          <Link to="/produccion/recepciones" className="btn btn_secundario btn_enlace">
            Atras
          </Link>
          <button type="button" className="btn btn_principal" disabled>
            Siguiente
          </button>
        </div>
      </div>

      <main className="contenido">
        <section className="tarjeta pestañas">
          <button
            type="button"
            className={`tab ${pestanaActiva === "pendientes" ? "activo" : ""}`}
            onClick={() => setPestanaActiva("pendientes")}
          >
            Pagos pendientes
          </button>
          <button
            type="button"
            className={`tab ${pestanaActiva === "historial" ? "activo" : ""}`}
            onClick={() => setPestanaActiva("historial")}
          >
            Historial de pagos
          </button>
        </section>

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>
                {pestanaActiva === "pendientes" ? "Registros filtrados" : "Pagos filtrados"}
              </span>
              <strong>
                {pestanaActiva === "pendientes" ? pagosFiltrados.length : historialFiltrado.length}
              </strong>
            </div>
            <div>
              <span>{pestanaActiva === "pendientes" ? "Total por pagar" : "Total pagado"}</span>
              <strong>
                {formatearMontoSoles(
                  pestanaActiva === "pendientes"
                    ? totalGeneralPendiente
                    : totalGeneralHistorial
                )}
              </strong>
            </div>
            <div>
              <span>
                {pestanaActiva === "pendientes"
                  ? "Registros seleccionados"
                  : "Pagos registrados"}
              </span>
              <strong>
                {pestanaActiva === "pendientes" ? totalOpsSeleccionadas : historialFiltrado.length}
              </strong>
            </div>
            <div>
              <span>
                {pestanaActiva === "pendientes"
                  ? "Total seleccionado"
                  : "Ultimo pago visible"}
              </span>
              <strong>
                {formatearMontoSoles(
                  pestanaActiva === "pendientes"
                    ? totalSeleccionado
                    : historialFiltrado[0]?.montoPago || 0
                )}
              </strong>
            </div>
          </div>
        </section>

        {pestanaActiva === "historial" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Historial de pagos</h2>
                <p>
                  Aqui puedes buscar pagos ya registrados y revisar su trazabilidad.
                </p>
              </div>

              <div className="acciones_superiores">
                <button type="button" className="btn btn_secundario" onClick={refrescarVista}>
                  Actualizar vista
                </button>
              </div>
            </div>

            <div className="buscador">
              <input
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por codigo, taller, modelo, tipo, fecha u observacion"
              />
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Tipo</th>
                    <th>Taller</th>
                    <th>Modelo</th>
                    <th>Unidades</th>
                    <th>Fecha pago</th>
                    <th>Monto</th>
                    <th>Observacion</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPagina.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="fila_vacia">
                        Todavia no hay pagos registrados en el historial.
                      </td>
                    </tr>
                  ) : (
                    historialPagina.map((item) => (
                      <tr key={item.id}>
                        <td>{item.codigoMostrado || item.codigoOp}</td>
                        <td>
                          {item.tipoPago === "SERVICIO_TERCERO"
                            ? "Servicio tercero"
                            : "OP principal"}
                        </td>
                        <td>{item.nombreTaller}</td>
                        <td>{item.modelo}</td>
                        <td>{item.cantidadRecibida}</td>
                        <td>{item.fechaPago}</td>
                        <td>{formatearMontoSoles(item.montoPago)}</td>
                        <td>{item.observacionPago || "-"}</td>
                      </tr>
                    ))
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
                  setPaginaHistorial((valor) =>
                    Math.min(totalPaginasHistorial, valor + 1)
                  )
                }
                disabled={paginaHistorial >= totalPaginasHistorial}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>
        ) : (
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Lista de pagos pendientes</h2>
              <p>
                Aqui se juntan las OP principales y tambien los servicios terceros aprobados.
              </p>
            </div>

            <div className="acciones_superiores">
              <Campo>
                <label>Fecha de pago</label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(evento) => setFechaPago(evento.target.value)}
                />
              </Campo>
              <button type="button" className="btn btn_secundario" onClick={refrescarVista}>
                Actualizar vista
              </button>
              <button type="button" className="btn btn_principal" onClick={manejarMarcarPagadas}>
                Marcar seleccionadas como pagadas
              </button>
            </div>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por codigo, taller, modelo, tipo o fecha"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th className="columna_check">
                    <input
                      type="checkbox"
                      checked={todosFiltradosSeleccionados}
                      onChange={manejarSeleccionarTodo}
                    />
                  </th>
                  <th>Codigo</th>
                  <th>Tipo</th>
                  <th>Taller</th>
                  <th>Modelo</th>
                  <th>Unidades</th>
                  <th>Fecha recepcion</th>
                  <th className="columna_monto">Total bruto</th>
                  <th className="columna_monto">Ajuste</th>
                  <th className="columna_monto">Adelanto</th>
                  <th className="columna_monto">Pagado acumulado</th>
                  <th className="columna_monto">Pago aprobado</th>
                  <th className="columna_incidencias">Incidencias</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {pagosPendientesPagina.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="fila_vacia">
                      No hay pagos aprobados pendientes.
                    </td>
                  </tr>
                ) : (
                  pagosPendientesPagina.map((item) => (
                    <tr key={item.id}>
                      <td className="columna_check">
                        <input
                          type="checkbox"
                          checked={seleccionados.includes(item.id)}
                          onChange={() => manejarSeleccion(item.id)}
                        />
                      </td>
                      <td>{item.codigoMostrado || item.codigoOp}</td>
                      <td>{item.tipoPago === "SERVICIO_TERCERO" ? "Servicio tercero" : "OP principal"}</td>
                      <td>{item.nombreTaller}</td>
                      <td>{item.modelo}</td>
                      <td>{item.cantidadRecibida}</td>
                      <td>{item.fechaRecepcion}</td>
                      <td className="columna_monto">{formatearMontoSoles(item.totalPagarTaller)}</td>
                      <td className="columna_monto">{formatearMontoAjuste(item.descuentoAcumulado)}</td>
                      <td className="columna_monto">{formatearMontoSoles(item.adelantoTaller)}</td>
                      <td className="columna_monto">{formatearMontoSoles(item.montoPagadoAcumulado)}</td>
                      <td className="columna_monto">{formatearMontoSoles(item.saldoPagar)}</td>
                      <td className="columna_incidencias">
                        {item.incidencias.length > 0 ? (
                          <small>{item.incidencias.length} registradas</small>
                        ) : (
                          <span className="texto_suave">Sin incidencias</span>
                        )}
                      </td>
                      <td>
                        <div className="acciones_tabla">
                          <button
                            type="button"
                            className="btn btn_secundario"
                            onClick={() => abrirDetalle(item)}
                          >
                            Ver detalle
                          </button>
                          <button
                            type="button"
                            className="btn btn_secundario"
                            onClick={() => abrirDescuento(item)}
                          >
                            Ajuste manual
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagosFiltrados.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaPendientes((valor) => Math.max(1, valor - 1))}
                disabled={paginaPendientes === 1}
              >
                Anterior
              </button>
              <span>
                Pagina {paginaPendientes} de {totalPaginasPendientes}
              </span>
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaPendientes((valor) =>
                    Math.min(totalPaginasPendientes, valor + 1)
                  )
                }
                disabled={paginaPendientes >= totalPaginasPendientes}
              >
                Siguiente
              </button>
            </div>
          ) : null}

          {descuentoActivo ? (
            <div ref={panelAjusteRef} className="panel_descuento">
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Ajuste manual de pago</h2>
                  <p>
                    Aqui decides si el ajuste descuenta del saldo o si lo aumenta para la siguiente quincena.
                  </p>
                </div>
              </div>

              <div className="aviso_ajuste_manual">
                Completa los cuadros antes de guardar. Usa este ajuste solo para correcciones finales de pago:
                si eliges <strong>Descuenta del saldo</strong>, el pago aprobado baja; si eliges
                <strong> Aumenta el saldo</strong>, el pago aprobado sube.
              </div>

              <div className="resumen__grid">
                <div>
                  <span>Codigo</span>
                  <strong>{descuentoActivo.codigoMostrado || descuentoActivo.codigoOp}</strong>
                </div>
                <div>
                  <span>Taller</span>
                  <strong>{descuentoActivo.nombreTaller}</strong>
                </div>
                <div>
                  <span>Saldo actual</span>
                  <strong>{formatearMontoSoles(descuentoActivo.saldoPagar)}</strong>
                </div>
                <div>
                  <span>Ajuste acumulado</span>
                  <strong>{formatearMontoAjuste(descuentoActivo.descuentoAcumulado)}</strong>
                </div>
              </div>

              {ajustesManualesActivos.length > 0 ? (
                <div className="ajustes_existentes">
                  <span className="ajustes_existentes__titulo">Ajustes manuales ya registrados</span>
                  <div className="ajustes_existentes__lista">
                    {ajustesManualesActivos.map((ajuste) => (
                      <div key={ajuste.id} className="ajuste_existente_item">
                        <div>
                          <strong>
                            {normalizarTipoAjusteManual(ajuste?.tipoAjusteManual) === "AUMENTA"
                              ? "Aumento manual"
                              : "Descuento manual"}{" "}
                            {formatearMontoAjuste(
                              normalizarTipoAjusteManual(ajuste?.tipoAjusteManual) === "AUMENTA"
                                ? -convertirNumero(ajuste?.montoDescuento)
                                : convertirNumero(ajuste?.montoDescuento)
                            )}
                          </strong>
                          <small>
                            {ajuste?.fechaDescuento || "-"} | {ajuste?.motivoDescuento || "Sin motivo"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn btn_secundario"
                          onClick={() => borrarAjusteManual(ajuste.id)}
                        >
                          Borrar ajuste
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="acciones_superiores">
                <Campo>
                  <label>Tipo de ajuste</label>
                  <select
                    value={tipoAjusteManual}
                    onChange={(evento) => setTipoAjusteManual(evento.target.value)}
                  >
                    <option value="DESCUENTA">Descuenta del saldo</option>
                    <option value="AUMENTA">Aumenta el saldo</option>
                  </select>
                </Campo>
                <Campo>
                  <label>Fecha ajuste</label>
                  <input
                    type="date"
                    value={fechaDescuento}
                    onChange={(evento) => setFechaDescuento(evento.target.value)}
                  />
                </Campo>
                <Campo>
                  <label>Monto ajuste</label>
                  <input
                    ref={montoAjusteRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoDescuento}
                    onChange={(evento) => setMontoDescuento(evento.target.value)}
                  />
                </Campo>
                <Campo className="campo_motivo">
                  <label>Motivo</label>
                  <input
                    type="text"
                    value={motivoDescuento}
                    onChange={(evento) => setMotivoDescuento(evento.target.value.toUpperCase())}
                    placeholder="Ejemplo: PRENDA QUEDO PARA TALLER"
                  />
                </Campo>
              </div>

              <div className="acciones_superiores">
                <button type="button" className="btn btn_secundario" onClick={() => setDescuentoActivo(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn_principal" onClick={guardarDescuento}>
                  Guardar ajuste
                </button>
              </div>
            </div>
          ) : null}

          {detalleActivo ? (
            <div className="overlay_detalle" onClick={cerrarDetalle}>
              <div className="modal_detalle" onClick={(evento) => evento.stopPropagation()}>
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Detalle de incidencias</h2>
                    <p>
                      Aqui puedes recordar rapido el origen del descuento o ajuste antes de salir del resumen.
                    </p>
                  </div>
                </div>

                <div className="resumen__grid">
                  <div>
                    <span>Codigo</span>
                    <strong>{detalleActivo.codigoMostrado || detalleActivo.codigoOp}</strong>
                  </div>
                  <div>
                    <span>Tipo</span>
                    <strong>
                      {detalleActivo.tipoPago === "SERVICIO_TERCERO"
                        ? "Servicio tercero"
                        : "OP principal"}
                    </strong>
                  </div>
                  <div>
                    <span>Taller</span>
                    <strong>{detalleActivo.nombreTaller}</strong>
                  </div>
                  <div>
                    <span>Pago aprobado</span>
                    <strong>{formatearMontoSoles(detalleActivo.saldoPagar)}</strong>
                  </div>
                </div>

                {detalleActivo.tipoPago === "OP_PRINCIPAL" ? (
                  <div className="resumen__grid">
                    <div>
                      <span>Merma / no pagar</span>
                      <strong>{formatearMontoSoles(detalleActivo.montoNoPagar || 0)}</strong>
                    </div>
                    <div>
                      <span>Descuento por prenda</span>
                      <strong>{formatearMontoSoles(detalleActivo.descuentoDetallado || 0)}</strong>
                    </div>
                    <div>
                      <span>Adelanto</span>
                      <strong>{formatearMontoSoles(detalleActivo.adelantoTaller || 0)}</strong>
                    </div>
                    <div>
                      <span>Ajuste manual</span>
                      <strong>{formatearMontoAjuste(detalleActivo.descuentoAcumulado || 0)}</strong>
                    </div>
                  </div>
                ) : null}

                <div className="detalle_incidencias">
                  <span className="detalle_incidencias__titulo">Resumen de incidencias</span>
                  <div className="detalle_incidencias__lista">
                    {resumirIncidenciasPago(detalleActivo).map((linea, indice) => (
                      <div key={`${detalleActivo.id}-inc-${indice}`} className="detalle_incidencia_item">
                        {linea}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="acciones">
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={() => irAModuloOrigen(detalleActivo)}
                  >
                    {detalleActivo.tipoPago === "SERVICIO_TERCERO"
                      ? "Abrir tercero"
                      : "Abrir recepcion"}
                  </button>
                  <button type="button" className="btn btn_principal" onClick={cerrarDetalle}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
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
  background:
    radial-gradient(circle at top left, rgba(117, 1, 152, 0.16), transparent 28%),
    linear-gradient(180deg, ${({ theme }) => theme.bgtotal} 0%, ${({ theme }) => theme.bg2} 100%);
  color: ${({ theme }) => theme.text};
  display: grid;
  padding: 15px;
  gap: 15px;
  grid-template:
    "encabezado" 90px
    "cabecera" auto
    "fila_superior" auto
    "contenido" 1fr;

  .encabezado,
  .cabecera,
  .contenido {
    border-radius: 20px;
  }

  .encabezado {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: ${({ theme }) => theme.bgcards};
    padding-right: 10px;
  }

  .cabecera,
  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    padding: 22px;
    border-radius: 20px;
  }

  .pestañas {
    display: flex;
    gap: 10px;
    padding: 12px;
    flex-wrap: wrap;
  }

  .tab {
    min-height: 42px;
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    font-weight: 700;
    cursor: pointer;
  }

  .tab.activo {
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
    border-color: ${({ theme }) => theme.bg5};
  }

  .cabecera {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .cabecera__estado {
    min-width: 180px;
    padding: 14px 18px;
    border-radius: 16px;
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
  .tarjeta__encabezado,
  .acciones_superiores {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .boton_volver,
  .btn_enlace,
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 42px;
    padding: 10px 16px;
    border-radius: 12px;
    border: none;
    text-decoration: none;
    font-weight: 700;
    cursor: pointer;
  }

  .boton_volver,
  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .acciones_tabla {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .resumen__grid div {
    background-color: ${({ theme }) => theme.bgtotal};
    border: 1px solid ${({ theme }) => theme.bg3};
    border-radius: 14px;
    padding: 14px;
  }

  .resumen__grid span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .resumen__grid strong {
    font-size: 18px;
  }

  .buscador input,
  input[type="date"] {
    width: 100%;
    min-height: 42px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    padding: 0 12px;
    outline: none;
  }

  .tabla_contenedor {
    width: 100%;
    overflow-x: auto;
  }

  .panel_descuento {
    margin-top: 18px;
    border: 1px solid ${({ theme }) => theme.bg3};
    border-radius: 16px;
    padding: 16px;
    background-color: ${({ theme }) => theme.bgtotal};
    display: grid;
    gap: 14px;
  }

  .overlay_detalle {
    position: fixed;
    inset: 0;
    z-index: 1200;
    background: rgba(8, 11, 18, 0.72);
    display: grid;
    place-items: center;
    padding: 20px;
  }

  .modal_detalle {
    width: min(760px, 100%);
    max-height: 86vh;
    overflow: auto;
    border-radius: 18px;
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg3};
    padding: 18px;
    display: grid;
    gap: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.36);
  }

  .detalle_incidencias {
    display: grid;
    gap: 10px;
  }

  .detalle_incidencias__titulo {
    font-size: 14px;
    font-weight: 700;
    color: ${({ theme }) => theme.text};
  }

  .detalle_incidencias__lista {
    display: grid;
    gap: 10px;
  }

  .detalle_incidencia_item {
    border: 1px solid ${({ theme }) => theme.bg3};
    background-color: ${({ theme }) => theme.bgtotal};
    border-radius: 12px;
    padding: 12px 14px;
    line-height: 1.55;
    color: ${({ theme }) => theme.text};
  }

  .aviso_ajuste_manual {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.16)" : "rgba(255,255,255,0.08)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.05)" : "rgba(255,255,255,0.03)"};
    color: ${({ theme }) => theme.text};
    line-height: 1.6;
  }

  .ajustes_existentes {
    display: grid;
    gap: 10px;
  }

  .ajustes_existentes__titulo {
    font-size: 14px;
    font-weight: 700;
    color: ${({ theme }) => theme.text};
  }

  .ajustes_existentes__lista {
    display: grid;
    gap: 10px;
  }

  .ajuste_existente_item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg3};
    background-color: ${({ theme }) => theme.bgcards};
    flex-wrap: wrap;
  }

  .ajuste_existente_item strong,
  .ajuste_existente_item small {
    display: block;
  }

  .ajuste_existente_item small {
    color: ${({ theme }) => theme.colorSubtitle};
    margin-top: 4px;
  }

  .campo_motivo {
    min-width: min(320px, 100%);
  }

  table {
    width: 100%;
    min-width: 1080px;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: 12px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg3};
    vertical-align: middle;
  }

  .columna_check {
    width: 48px;
    text-align: center;
  }

  .columna_monto {
    min-width: 118px;
    white-space: nowrap;
  }

  .columna_incidencias {
    min-width: 132px;
  }

  .fila_vacia,
  .texto_suave {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .fila_vacia {
    text-align: center;
    padding: 20px;
  }

  @media (max-width: 980px) {
    .resumen__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .fila_superior,
    .navegacion_superior,
    .tarjeta__encabezado,
    .acciones_superiores,
    .cabecera {
      flex-direction: column;
      align-items: stretch;
    }

    .resumen__grid {
      grid-template-columns: 1fr;
    }

    .acciones_tabla {
      min-width: 130px;
    }

    .boton_volver,
    .btn_enlace,
    .btn {
      width: 100%;
    }
  }
`;

const Campo = styled.div`
  display: grid;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  input,
  select,
  textarea {
    width: 100%;
    min-height: 42px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    padding: 0 12px;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  textarea {
    min-height: 96px;
    padding: 12px;
    resize: vertical;
  }

  input::placeholder,
  textarea::placeholder {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px rgba(117, 1, 152, 0.12);
  }
`;
