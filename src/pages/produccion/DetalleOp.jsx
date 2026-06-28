import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  leerCatalogosProduccion,
  obtenerMotivosGlobalesSistema,
} from "../../utils/catalogosProduccion";
import { obtenerColoresDisponiblesPorTipoTela } from "../../utils/stockMateriaPrima";
import { enfocarCampoValidacion } from "../../utils/validacionCampos";
import {
  sincronizarFlujoProduccionDesdeSupabase,
  sincronizarPedidoFlujoDesdeLocalASupabase,
} from "../../supabase/flujoProduccionCore.js";

// El detalle de OP nace desde un pedido y luego alimenta el corte.
const CLAVE_DETALLE_PEDIDO = "cynara_detalle_pedido_actual";
const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_DETALLE_OP = "cynara_detalle_op_actual";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_SOLICITUDES_HABILITADO = "cynara_solicitudes_habilitado";
const TALLAS_POR_DEFECTO = ["S", "M", "L", "XL", "XXL"];

const unirTallasSeleccionadas = (tallasSeleccionadas) =>
  tallasSeleccionadas.join("-");

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
};

// Genera el codigo principal de la OP. Si quieres cambiar el formato,
// este es el punto correcto para actualizarlo.
const filaInicial = {
  id: 1,
  codigoUnidad: "",
  tipoTela: "",
  colorBase: "",
  acabadoDiseno: "",
  anchoTela: "",
  pesoTela: "",
  partida: "",
  cantidad: "",
  observacion: "",
};

// Curva inicial de la OP. Se deja vacia para que Produccion la defina segun el caso real.
const curvaInicial = {
  S: "",
  M: "",
  L: "",
  XL: "",
  XXL: "",
};

const obtenerTallasVisibles = (tallasSeleccionadas = [], tallasCatalogo = []) => {
  if (Array.isArray(tallasSeleccionadas) && tallasSeleccionadas.length > 0) {
    return tallasCatalogo.filter((talla) => tallasSeleccionadas.includes(talla));
  }

  return tallasCatalogo.length > 0 ? tallasCatalogo : TALLAS_POR_DEFECTO;
};

const obtenerDetallePedidoGuardado = () => {
  const detalleGuardado = localStorage.getItem(CLAVE_DETALLE_PEDIDO);

  if (!detalleGuardado) {
    return null;
  }

  try {
    return JSON.parse(detalleGuardado);
  } catch {
    return null;
  }
};

const leerHistorialPedidos = () => {
  const historialGuardado = localStorage.getItem(CLAVE_HISTORIAL_PEDIDOS);

  if (!historialGuardado) {
    return [];
  }

  try {
    const historial = JSON.parse(historialGuardado);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const leerHistorialOp = () => {
  const historialGuardado = localStorage.getItem(CLAVE_HISTORIAL_OP);

  if (!historialGuardado) {
    return [];
  }

  try {
    const historial = JSON.parse(historialGuardado);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const leerSolicitudesHabilitado = () => {
  const solicitudesGuardadas = localStorage.getItem(CLAVE_SOLICITUDES_HABILITADO);

  if (!solicitudesGuardadas) {
    return [];
  }

  try {
    const solicitudes = JSON.parse(solicitudesGuardadas);
    return Array.isArray(solicitudes) ? solicitudes : [];
  } catch {
    return [];
  }
};

const obtenerDetalleOpGuardado = () => {
  const detalleGuardado = localStorage.getItem(CLAVE_DETALLE_OP);

  if (!detalleGuardado) {
    return null;
  }

  try {
    return JSON.parse(detalleGuardado);
  } catch {
    return null;
  }
};

// Convierte un pedido en cabecera lista para trabajar la OP.
const crearCabeceraDesdePedido = (pedido) => {
  const fechaInicial = obtenerFechaActual();
  const datosCabeceraPedido = pedido?.datosCabecera;

  if (!datosCabeceraPedido) {
    return {
      pedidoOrigen: "",
      fechaOp: fechaInicial,
      empresa: "Cynara",
      categoriaModelo: "",
      modeloCatalogo: "",
      telaModelo: "",
      modeloBase: "",
      tipoTela: "",
      tallas: "",
      tallasSeleccionadas: [],
      observacionesGenerales: "",
      curvaCabecera: { ...curvaInicial },
    };
  }

  return {
    pedidoOrigen: datosCabeceraPedido.codigoInterno || "PED100426-01",
    fechaOp: fechaInicial,
    empresa: datosCabeceraPedido.empresa || "Cynara",
    categoriaModelo: datosCabeceraPedido.categoriaModelo || "",
    modeloCatalogo: datosCabeceraPedido.modeloCatalogo || "",
    telaModelo: datosCabeceraPedido.telaModelo || "",
    modeloBase: datosCabeceraPedido.modeloBase || "",
    tipoTela: datosCabeceraPedido.tipoTela || "",
    tallas: datosCabeceraPedido.tallasBase || "S-M-L-XL-XXL",
    tallasSeleccionadas:
      datosCabeceraPedido.tallasSeleccionadas || TALLAS_POR_DEFECTO,
    observacionesGenerales: datosCabeceraPedido.observacionesGenerales || "",
    curvaCabecera: {
      ...curvaInicial,
      ...(datosCabeceraPedido.curvaTallas || {}),
    },
  };
};

const crearCabeceraInicial = () => {
  const detalleOpGuardado = obtenerDetalleOpGuardado();
  if (detalleOpGuardado?.estado === "borrador") {
    return {
      ...crearCabeceraDesdePedido(null),
      ...(detalleOpGuardado.cabeceraOp || {}),
      curvaCabecera: {
        ...curvaInicial,
        ...(detalleOpGuardado?.cabeceraOp?.curvaCabecera || {}),
      },
    };
  }

  const detallePedidoGuardado = obtenerDetallePedidoGuardado();
  return crearCabeceraDesdePedido(detallePedidoGuardado);
};

// Convierte las filas del pedido en filas editables para produccion.
const crearFilasDesdePedido = (pedido) => {
  const filasBase = Array.isArray(pedido?.despachoMateriaPrimaInfo?.filasDespacho) &&
    pedido.despachoMateriaPrimaInfo.filasDespacho.length > 0
      ? pedido.despachoMateriaPrimaInfo.filasDespacho
      : Array.isArray(pedido?.filasPedido)
        ? pedido.filasPedido
        : [];

  if (!filasBase.length) {
    return [
      {
        ...filaInicial,
      },
    ];
  }

  return filasBase.map((fila, indice) => ({
    ...filaInicial,
    id: fila.id || Date.now() + indice,
    codigoUnidad: fila.codigoUnidad || "",
    tipoTela: fila.tipoTela || pedido?.datosCabecera?.tipoTela || "",
    colorBase: fila.colorBase || fila.color || "",
    acabadoDiseno: fila.acabadoDiseno || "",
    anchoTela: fila.anchoTela || "",
    pesoTela: fila.pesoTela ? formatearPesoDecimal(fila.pesoTela) : "",
    partida: fila.partida || "",
    cantidad: fila.cantidad || "",
    observacion: fila.observacion || "",
  }));
};

const crearFilasIniciales = () => {
  const detalleOpGuardado = obtenerDetalleOpGuardado();
  if (detalleOpGuardado?.estado === "borrador") {
    return Array.isArray(detalleOpGuardado.filasOp) && detalleOpGuardado.filasOp.length > 0
      ? detalleOpGuardado.filasOp.map((fila, indice) => ({
          ...filaInicial,
          ...fila,
          id: fila.id || Date.now() + indice,
        }))
      : [{ ...filaInicial }];
  }

  const detallePedidoGuardado = obtenerDetallePedidoGuardado();
  return crearFilasDesdePedido(detallePedidoGuardado);
};

const filaOpEstaVacia = (fila) =>
  !fila.codigoUnidad &&
  !fila.tipoTela &&
  !fila.colorBase &&
  !fila.acabadoDiseno &&
  !fila.anchoTela &&
  !fila.pesoTela &&
  !fila.partida &&
  !fila.cantidad &&
  !fila.observacion;

const obtenerCamposFaltantesDetalleOp = (cabeceraOp, filasOp) => {
  const faltantes = [];

  if (!cabeceraOp.pedidoOrigen?.trim()) faltantes.push({ clave: "pedidoOrigen", etiqueta: "Orden de pedido" });
  if (!cabeceraOp.empresa?.trim()) faltantes.push({ clave: "empresa", etiqueta: "Empresa" });
  if (!cabeceraOp.modeloBase?.trim()) faltantes.push({ clave: "modeloBase", etiqueta: "Modelo base" });
  if (!cabeceraOp.tipoTela?.trim()) faltantes.push({ clave: "tipoTela", etiqueta: "Tipo de tela" });
  if (!cabeceraOp.tallasSeleccionadas?.length) faltantes.push({ clave: "tallas", etiqueta: "Tallas" });

  const tieneTelasSeleccionadas = filasOp.some(
    (fila) => !filaOpEstaVacia(fila) && fila.codigoUnidad?.trim()
  );
  if (!tieneTelasSeleccionadas) {
    faltantes.push({ clave: "telasSeleccionadas", etiqueta: "Al menos una tela seleccionada" });
  }

  return faltantes;
};

const formatearPesoDecimal = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero.toFixed(2) : "";
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

const pedidoListoParaVerificacion = (pedido) =>
  Boolean(pedido?.despachoMateriaPrima) && !pedido?.opGenerada && !pedido?.cancelado;

const crearVistaLimpiaDetalleOp = () => ({
  pedidoSeleccionadoId: "",
  cabeceraOp: crearCabeceraDesdePedido(null),
  filasOp: crearFilasDesdePedido(null),
});

const construirCabeceraDesdeHabilitado = (pedido) => ({
  ...crearCabeceraDesdePedido(pedido),
  ...(pedido?.habilitadoMaterialesInfo?.cabeceraOp || {}),
  curvaCabecera: {
    ...curvaInicial,
    ...(pedido?.habilitadoMaterialesInfo?.cabeceraOp?.curvaCabecera || {}),
  },
});

const construirFilasDesdeHabilitado = (pedido) => {
  const filasGuardadas = pedido?.habilitadoMaterialesInfo?.filasHabilitadas;

  if (!Array.isArray(filasGuardadas) || filasGuardadas.length === 0) {
    return crearFilasDesdePedido(pedido);
  }

  return filasGuardadas.map((fila, indice) => ({
    ...filaInicial,
    ...fila,
    id: fila.id || Date.now() + indice,
  }));
};

const crearSolicitudInicial = () => ({
  tipoTela: "",
  colorBase: "",
  motivo: "",
});

const filtrarFilasConDevolucionActiva = (
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
        solicitud?.areaOrigen === "Habilitado de materiales" &&
        solicitud?.tipoSolicitud === "devolucion" &&
        solicitud?.ocultarEnProduccion === true &&
        solicitud?.estado !== "rechazada" &&
        (solicitud?.codigoUnidad || "").trim().toUpperCase() === codigoUnidad
    );

    return !tieneDevolucionActiva;
  });

export function DetalleOp() {
  const catalogosProduccion = leerCatalogosProduccion();
  const motivosGlobales = obtenerMotivosGlobalesSistema(catalogosProduccion);
  const tallasDisponibles = catalogosProduccion.tallas?.length
    ? catalogosProduccion.tallas
    : TALLAS_POR_DEFECTO;
  const [historialPedidos, setHistorialPedidos] = useState(leerHistorialPedidos);
  const detallePedidoActual = obtenerDetallePedidoGuardado();
  const [historialOp, setHistorialOp] = useState(leerHistorialOp);
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const pedidosDisponibles = useMemo(() => {
    const listaBase = historialPedidos.length > 0
      ? historialPedidos
      : detallePedidoActual?.datosCabecera
      ? [detallePedidoActual]
      : [];

    const pedidosConfirmados = new Set(
      historialOp
        .filter((op) => op?.estado === "confirmado")
        .map((op) => op?.cabeceraOp?.pedidoOrigen || "")
        .filter(Boolean)
    );

    return listaBase.filter(
      (pedido) =>
        pedidoListoParaVerificacion(pedido) &&
        !pedidosConfirmados.has(pedido?.datosCabecera?.codigoInterno || "")
    );
  }, [historialPedidos, detallePedidoActual, historialOp]);
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState(
    detallePedidoActual?.datosCabecera?.codigoInterno || ""
  );
  const [cabeceraOp, setCabeceraOp] = useState(crearCabeceraInicial);
  const [filasOp, setFilasOp] = useState(crearFilasIniciales);
  const [solicitudesHabilitado, setSolicitudesHabilitado] = useState(
    leerSolicitudesHabilitado
  );
  const [solicitudNueva, setSolicitudNueva] = useState(crearSolicitudInicial);
  const [camposInvalidos, setCamposInvalidos] = useState([]);
  const coloresDisponiblesSolicitud = useMemo(
    () => obtenerColoresDisponiblesPorTipoTela(solicitudNueva.tipoTela),
    [solicitudNueva.tipoTela]
  );
  const totalPedidosPendientes = pedidosDisponibles.length;
  const pedidoRelacionado = useMemo(() => {
    if (!cabeceraOp.pedidoOrigen) {
      return null;
    }

    const pedidoEnHistorial = historialPedidos.find(
      (pedido) => pedido?.datosCabecera?.codigoInterno === cabeceraOp.pedidoOrigen
    );

    if (pedidoEnHistorial) {
      return pedidoEnHistorial;
    }

    if (
      detallePedidoActual?.datosCabecera?.codigoInterno === cabeceraOp.pedidoOrigen
    ) {
      return detallePedidoActual;
    }

    return null;
  }, [cabeceraOp.pedidoOrigen, historialPedidos, detallePedidoActual]);
  const esPedidoExistente = Boolean(
    cabeceraOp.pedidoOrigen && pedidoRelacionado && !pedidoRelacionado?.cancelado
  );
  const tallasVisiblesCabecera = obtenerTallasVisibles(
    cabeceraOp.tallasSeleccionadas,
    tallasDisponibles
  );
  const solicitudesPedidoActual = useMemo(
    () =>
      solicitudesHabilitado.filter(
        (solicitud) => solicitud?.pedidoOrigen === cabeceraOp.pedidoOrigen
      ),
    [solicitudesHabilitado, cabeceraOp.pedidoOrigen]
  );

  useEffect(() => {
    let activo = true;
    const sincronizar = async () => {
      try {
        const data = await sincronizarFlujoProduccionDesdeSupabase();
        if (!activo) return;
        setHistorialPedidos(data?.pedidos || []);
        setHistorialOp(data?.ops || []);
        setSolicitudesHabilitado(data?.solicitudes || []);
      } catch (error) {
        console.error("No se pudo sincronizar habilitado desde Supabase:", error.message);
      }
    };
    sincronizar();
    return () => {
      activo = false;
    };
  }, []);

  const limpiarFormularioDespuesDeGuardar = () => {
    const vistaLimpia = crearVistaLimpiaDetalleOp();
    const borradorLimpio = {
      cabeceraOp: vistaLimpia.cabeceraOp,
      filasOp: vistaLimpia.filasOp,
      estado: "borrador",
    };

    localStorage.setItem(CLAVE_DETALLE_OP, JSON.stringify(borradorLimpio));
    setPedidoSeleccionadoId(vistaLimpia.pedidoSeleccionadoId);
    setCabeceraOp(vistaLimpia.cabeceraOp);
    setFilasOp(vistaLimpia.filasOp);
    setSolicitudNueva(crearSolicitudInicial());
    setCamposInvalidos([]);
  };

  // Cambios simples de la cabecera de la OP.
  const manejarCambioCabecera = (evento) => {
    const { name, value } = evento.target;
    setCamposInvalidos((anterior) => anterior.filter((item) => item !== name));

    setCabeceraOp((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  // Checks de talla heredados del pedido, editables por produccion.
  const manejarCambioTalla = (talla) => {
    setCamposInvalidos((anterior) => anterior.filter((item) => item !== "tallas"));
    setCabeceraOp((anterior) => {
      const tallasSeleccionadas = anterior.tallasSeleccionadas.includes(talla)
        ? anterior.tallasSeleccionadas.filter((item) => item !== talla)
        : [...anterior.tallasSeleccionadas, talla];

      return {
        ...anterior,
        tallasSeleccionadas,
        tallas: unirTallasSeleccionadas(tallasSeleccionadas),
      };
    });
  };

  // La curva se define en cabecera porque aplica a toda la OP.
  const manejarCambioCurva = (talla, valor) => {
    setCabeceraOp((anterior) => ({
      ...anterior,
      curvaCabecera: {
        ...anterior.curvaCabecera,
        [talla]: valor,
      },
    }));
  };

  // Cambia una celda puntual de la tabla operativa.
  const manejarCambioFila = (idFila, campo, valor) => {
    if (campo === "codigoUnidad" || campo === "tipoTela" || campo === "colorBase") {
      setCamposInvalidos((anterior) =>
        anterior.filter((item) => item !== "telasSeleccionadas")
      );
    }

    setFilasOp((anterior) =>
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

  const guardarSolicitudes = (solicitudesActualizadas) => {
    localStorage.setItem(
      CLAVE_SOLICITUDES_HABILITADO,
      JSON.stringify(solicitudesActualizadas)
    );
    setSolicitudesHabilitado(solicitudesActualizadas);
  };

  const solicitarAumentoAlmacen = async () => {
    if (!cabeceraOp.pedidoOrigen) {
      mostrarAlertaSistema("Primero carga un pedido para poder solicitar aumento a almacen.");
      return;
    }

    if (!solicitudNueva.tipoTela.trim() || !solicitudNueva.colorBase.trim()) {
      mostrarAlertaSistema("Completa Tipo de tela y Color base para pedir aumento a almacen.");
      return;
    }

    const nuevaSolicitud = {
      id: `sol-${Date.now()}`,
      pedidoOrigen: cabeceraOp.pedidoOrigen,
      modeloBase: cabeceraOp.modeloBase || "",
      fechaSolicitud: obtenerFechaActual(),
      areaOrigen: "Habilitado de materiales",
      tipoSolicitud: "aumento",
      tipoTela: solicitudNueva.tipoTela.trim().toUpperCase(),
      colorBase: solicitudNueva.colorBase.trim().toUpperCase(),
      motivo: solicitudNueva.motivo.trim(),
      estado: "pendiente",
    };

    const solicitudesActualizadas = [nuevaSolicitud, ...solicitudesHabilitado];
    guardarSolicitudes(solicitudesActualizadas);
    setSolicitudNueva(crearSolicitudInicial());

    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraOp.pedidoOrigen);
      const data = await sincronizarFlujoProduccionDesdeSupabase();
      setSolicitudesHabilitado(data?.solicitudes || solicitudesActualizadas);
    } catch (error) {
      console.error("No se pudo sincronizar la solicitud de aumento:", error.message);
    }
    mostrarNotificacionCarga("Solicitud de aumento enviada a Almacen.");
  };

  const solicitarDevolucionAlmacen = async (fila) => {
    if (!cabeceraOp.pedidoOrigen || !fila?.codigoUnidad?.trim()) {
      mostrarAlertaSistema("Primero carga una tela valida para solicitar su devolucion a Almacen.");
      return;
    }

    const confirmarSolicitud = await confirmarAccionSistema(
      "La tela seguira en pantalla hasta que Almacen atienda la solicitud.",
      {
        titulo: "Solicitar devolucion a almacen",
        confirmarTexto: "Solicitar devolucion",
      }
    );

    if (!confirmarSolicitud) {
      return;
    }

    const yaSolicitada = solicitudesHabilitado.some(
      (solicitud) =>
        solicitud?.pedidoOrigen === cabeceraOp.pedidoOrigen &&
        solicitud?.tipoSolicitud === "devolucion" &&
        solicitud?.codigoUnidad === fila.codigoUnidad &&
        solicitud?.estado === "pendiente"
    );

    if (yaSolicitada) {
      mostrarAlertaSistema("Esta tela ya tiene una solicitud pendiente de devolucion.");
      return;
    }

    const nuevaSolicitud = {
      id: `sol-${Date.now()}`,
      pedidoOrigen: cabeceraOp.pedidoOrigen,
      modeloBase: cabeceraOp.modeloBase || "",
      fechaSolicitud: obtenerFechaActual(),
      areaOrigen: "Habilitado de materiales",
      tipoSolicitud: "devolucion",
      tipoDevolucion: "DEVOLUCION_TOTAL",
      codigoUnidad: fila.codigoUnidad || "",
      tipoTela: fila.tipoTela || cabeceraOp.tipoTela || "",
      colorBase: fila.colorBase || "",
      partida: fila.partida || "",
      pesoTela: fila.pesoTela || "",
      pesoDevuelto: fila.pesoTela || "",
      pesoEnviado: fila.pesoTela || "",
      pesoUsado: "",
      unidadControl: "KG",
      motivo: fila.observacion || "DEVOLUCION TOTAL",
      ocultarEnProduccion: true,
      estado: "pendiente",
    };

    const solicitudesActualizadas = [nuevaSolicitud, ...solicitudesHabilitado];
    guardarSolicitudes(solicitudesActualizadas);
    setFilasOp((anterior) =>
      filtrarFilasConDevolucionActiva(
        anterior,
        solicitudesActualizadas,
        cabeceraOp.pedidoOrigen
      )
    );

    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraOp.pedidoOrigen);
      const data = await sincronizarFlujoProduccionDesdeSupabase();
      setSolicitudesHabilitado(data?.solicitudes || solicitudesActualizadas);
    } catch (error) {
      console.error("No se pudo sincronizar la solicitud de devolucion:", error.message);
    }
    mostrarNotificacionCarga("Solicitud de devolucion a Almacen enviada correctamente.");
  };

  // Carga un pedido del historial para convertirlo en OP.
  const manejarSeleccionPedido = (pedido) => {
    setCamposInvalidos([]);
    setPedidoSeleccionadoId(pedido.datosCabecera.codigoInterno);
    setSolicitudNueva(crearSolicitudInicial());
    const borradorGuardado = historialOp.find(
      (op) =>
        op?.estado === "borrador" &&
        op?.cabeceraOp?.pedidoOrigen === pedido.datosCabecera.codigoInterno
    );

    if (borradorGuardado) {
      setCabeceraOp({
        ...crearCabeceraDesdePedido(null),
        ...(borradorGuardado.cabeceraOp || {}),
        curvaCabecera: {
          ...curvaInicial,
          ...(borradorGuardado?.cabeceraOp?.curvaCabecera || {}),
        },
      });
      setFilasOp(
        filtrarFilasConDevolucionActiva(
          Array.isArray(borradorGuardado.filasOp) && borradorGuardado.filasOp.length > 0
            ? borradorGuardado.filasOp.map((fila, indice) => ({
                ...filaInicial,
                ...fila,
                id: fila.id || Date.now() + indice,
              }))
            : [{ ...filaInicial }],
          solicitudesHabilitado,
          pedido.datosCabecera.codigoInterno
        )
      );
      mostrarNotificacionCarga("Borrador cargado en habilitado de materiales.");
      return;
    }

    const tieneAvanceGuardado = Boolean(pedido?.habilitadoMaterialesInfo);

    setCabeceraOp(
      tieneAvanceGuardado
        ? construirCabeceraDesdeHabilitado(pedido)
        : crearCabeceraDesdePedido(pedido)
    );
    setFilasOp(
      filtrarFilasConDevolucionActiva(
        tieneAvanceGuardado
          ? construirFilasDesdeHabilitado(pedido)
          : crearFilasDesdePedido(pedido),
        solicitudesHabilitado,
        pedido.datosCabecera.codigoInterno
      )
    );
    mostrarNotificacionCarga("Pedido cargado en habilitado de materiales.");
  };

  const guardarDetalleOp = (estadoRegistro) => {
    const filasOrdenadas = ordenarFilasPorAnchoDesc(filasOp);
    const opCompleta = {
      cabeceraOp,
      filasOp: filasOrdenadas,
      estado: estadoRegistro,
    };
    const historialActual = leerHistorialOp();
    const historialActualizado = [
      opCompleta,
      ...historialActual.filter(
        (op) => op?.cabeceraOp?.pedidoOrigen !== cabeceraOp.pedidoOrigen
      ),
    ];

    localStorage.setItem(
      CLAVE_DETALLE_OP,
      JSON.stringify(opCompleta)
    );
    localStorage.setItem(CLAVE_HISTORIAL_OP, JSON.stringify(historialActualizado));

    const historialPedidosActual = leerHistorialPedidos();
    const historialPedidosActualizado = historialPedidosActual.map((pedido) =>
      pedido?.datosCabecera?.codigoInterno === cabeceraOp.pedidoOrigen
        ? {
            ...pedido,
            habilitadoMaterialesInfo: {
              estado: estadoRegistro,
                fechaActualizacion: obtenerFechaActual(),
                cabeceraOp,
                filasHabilitadas: filasOrdenadas,
              },
            }
          : pedido
    );

    localStorage.setItem(
      CLAVE_HISTORIAL_PEDIDOS,
      JSON.stringify(historialPedidosActualizado)
    );

    if (detallePedidoActual?.datosCabecera?.codigoInterno === cabeceraOp.pedidoOrigen) {
      localStorage.setItem(
        CLAVE_DETALLE_PEDIDO,
        JSON.stringify({
          ...detallePedidoActual,
          habilitadoMaterialesInfo: {
            estado: estadoRegistro,
              fechaActualizacion: obtenerFechaActual(),
              cabeceraOp,
              filasHabilitadas: filasOrdenadas,
            },
          })
        );
    }

    setHistorialOp(historialActualizado);
    return opCompleta;
  };

  // Guarda un avance de verificacion sin mandarlo todavia a Ordenes de produccion.
  const manejarGuardar = async () => {
    const faltantes = obtenerCamposFaltantesDetalleOp(cabeceraOp, filasOp);

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
    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando avance de habilitado...",
      mensajeExito:
        "Avance guardado. Este pedido aun no pasa a Ordenes de produccion.",
      mensajeError: "No se pudo guardar el avance de habilitado.",
      accion: async () => {
        guardarDetalleOp("borrador");
        limpiarFormularioDespuesDeGuardar();

        try {
          await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraOp.pedidoOrigen);
          const data = await sincronizarFlujoProduccionDesdeSupabase();
          setHistorialPedidos(data?.pedidos || []);
          setHistorialOp(data?.ops || []);
        } catch (error) {
          console.error("No se pudo sincronizar el borrador de habilitado:", error.message);
        }

        console.log("Cabecera borrador de detalle de OP:", cabeceraOp);
        console.log("Filas borrador de detalle de OP:", filasOp);
      },
    });
  };

  // Confirma la verificacion y recien aqui la deja lista para pasar al corte.
  const manejarConfirmarDetalleOp = async () => {
    const faltantes = obtenerCamposFaltantesDetalleOp(cabeceraOp, filasOp);

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
    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Confirmando detalle de OP...",
      mensajeExito:
        "Detalle de OP confirmado. Ya puede pasar a Ordenes de produccion.",
      mensajeError: "No se pudo confirmar el detalle de OP.",
      accion: async () => {
        guardarDetalleOp("confirmado");

        // Despues de confirmar, el formulario vuelve a quedar en blanco.
        // Asi el usuario decide manualmente que pedido cargar despues.
        limpiarFormularioDespuesDeGuardar();

        try {
          await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraOp.pedidoOrigen);
          const data = await sincronizarFlujoProduccionDesdeSupabase();
          setHistorialPedidos(data?.pedidos || []);
          setHistorialOp(data?.ops || []);
          setSolicitudesHabilitado(data?.solicitudes || []);
        } catch (error) {
          console.error("No se pudo sincronizar la confirmacion de habilitado:", error.message);
        }

        console.log("Cabecera de detalle de OP:", cabeceraOp);
        console.log("Filas de detalle de OP:", filasOp);
      },
    });
  };

  const manejarCancelarPedido = async () => {
    if (!esPedidoExistente || !cabeceraOp.pedidoOrigen) {
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
      `Seguro que deseas cancelar este pedido desde habilitado?\n\nPedido: ${cabeceraOp.pedidoOrigen}\nModelo: ${cabeceraOp.modeloBase || "-"}\n\nEl pedido ya no seguira a Produccion y quedara en historial como cancelado.`
    );

    if (!confirmar) {
      return;
    }

    const historialActualizado = historialPedidos.map((pedido) =>
      pedido?.datosCabecera?.codigoInterno === cabeceraOp.pedidoOrigen
        ? {
            ...pedido,
            cancelado: true,
            fechaCancelacion: obtenerFechaActual(),
            motivoCancelacion,
            areaCancelacion: "Habilitado de materiales",
            habilitadoMaterialesInfo: {
              ...(pedido?.habilitadoMaterialesInfo || {}),
              estado: "cancelado",
              fechaCancelacion: obtenerFechaActual(),
              motivoCancelacion,
              areaCancelacion: "Habilitado de materiales",
            },
          }
        : pedido
    );

    localStorage.setItem(
      CLAVE_HISTORIAL_PEDIDOS,
      JSON.stringify(historialActualizado)
    );

    if (detallePedidoActual?.datosCabecera?.codigoInterno === cabeceraOp.pedidoOrigen) {
      localStorage.setItem(
        CLAVE_DETALLE_PEDIDO,
        JSON.stringify({
          ...detallePedidoActual,
          cancelado: true,
          fechaCancelacion: obtenerFechaActual(),
          motivoCancelacion,
          areaCancelacion: "Habilitado de materiales",
          habilitadoMaterialesInfo: {
            ...(detallePedidoActual?.habilitadoMaterialesInfo || {}),
            estado: "cancelado",
            fechaCancelacion: obtenerFechaActual(),
            motivoCancelacion,
            areaCancelacion: "Habilitado de materiales",
          },
        })
      );
    }

    const historialOpActualizado = historialOp.map((op) =>
      op?.cabeceraOp?.pedidoOrigen === cabeceraOp.pedidoOrigen
        ? {
            ...op,
            estado: "cancelado",
            cancelado: true,
            fechaCancelacion: obtenerFechaActual(),
            motivoCancelacion,
            areaCancelacion: "Habilitado de materiales",
          }
        : op
    );
    localStorage.setItem(CLAVE_HISTORIAL_OP, JSON.stringify(historialOpActualizado));

    const vistaLimpia = crearVistaLimpiaDetalleOp();
    localStorage.setItem(
      CLAVE_DETALLE_OP,
      JSON.stringify({
        cabeceraOp: vistaLimpia.cabeceraOp,
        filasOp: vistaLimpia.filasOp,
        estado: "borrador",
      })
    );

    setHistorialPedidos(historialActualizado);
    setHistorialOp(historialOpActualizado);
    setPedidoSeleccionadoId("");
    setCabeceraOp(vistaLimpia.cabeceraOp);
    setFilasOp(vistaLimpia.filasOp);
    setSolicitudNueva(crearSolicitudInicial());

    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraOp.pedidoOrigen);
      const data = await sincronizarFlujoProduccionDesdeSupabase();
      setHistorialPedidos(data?.pedidos || historialActualizado);
      setHistorialOp(data?.ops || historialOpActualizado);
    } catch (error) {
      console.error("No se pudo sincronizar la cancelacion en habilitado:", error.message);
    }
    alert("Pedido cancelado desde habilitado de materiales.");
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
          <h1>Habilitado de materiales</h1>
          <p>
            Aqui Produccion habilita las telas y materiales del pedido, revisa
            avances reales y deja listo lo que pasara al area de corte.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Pedidos por hacer</span>
          <strong>{totalPedidosPendientes}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/produccion" className="boton_volver">
          Volver a Produccion
        </Link>

        <div className="navegacion_superior">
          <Link to="/produccion/detalle-pedido" className="btn btn_secundario btn_enlace">
            Atras
          </Link>
          <Link to="/produccion/cortes" className="btn btn_principal btn_enlace">
            Siguiente
          </Link>
        </div>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Pedidos disponibles</h2>
              <p>
                Escoge el pedido que quieres convertir en OP. Asi puedes avanzar
                primero el urgente y dejar otro para despues.
              </p>
            </div>
          </div>

          <div className="lista_pedidos">
            {pedidosDisponibles.length === 0 ? (
              <div className="pedido_vacio">
                Todavia no hay pedidos guardados para convertir a OP.
              </div>
            ) : (
              pedidosDisponibles.map((pedido) => (
                <button
                  type="button"
                  key={pedido.datosCabecera.codigoInterno}
                  className={`tarjeta_pedido ${
                    pedidoSeleccionadoId === pedido.datosCabecera.codigoInterno
                      ? "tarjeta_pedido_activa"
                      : ""
                  }`}
                  onClick={() => manejarSeleccionPedido(pedido)}
                >
                  <strong>{pedido.datosCabecera.codigoInterno}</strong>
                  <span>{pedido.datosCabecera.modeloBase || "Sin modelo"}</span>
                  <small>{pedido.datosCabecera.tipoTela || "Sin tela"}</small>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="tarjeta">
          <h2>Cabecera de la OP</h2>

          <div className="grid grid-2">
            <Campo
              data-campo-validacion="pedidoOrigen"
              className={`campo_requerido ${camposInvalidos.includes("pedidoOrigen") ? "campo_error" : ""}`}
            >
              <label>Orden de Pedido</label>
              <input
                type="text"
                name="pedidoOrigen"
                value={cabeceraOp.pedidoOrigen}
                onChange={manejarCambioCabecera}
                readOnly
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Fecha OP</label>
              <input
                type="date"
                name="fechaOp"
                value={cabeceraOp.fechaOp}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo
              data-campo-validacion="empresa"
              className={`campo_requerido ${camposInvalidos.includes("empresa") ? "campo_error" : ""}`}
            >
              <label>Empresa</label>
              <input
                type="text"
                list="catalogo-empresas-op"
                name="empresa"
                value={cabeceraOp.empresa}
                onChange={manejarCambioCabecera}
                readOnly
              />
              <datalist id="catalogo-empresas-op">
                {catalogosProduccion.empresas.map((empresa) => (
                  <option key={empresa} value={empresa} />
                ))}
              </datalist>
            </Campo>

            <Campo
              data-campo-validacion="modeloBase"
              className={`campo_requerido ${camposInvalidos.includes("modeloBase") ? "campo_error" : ""}`}
            >
              <label>Modelo base</label>
              <input
                type="text"
                name="modeloBase"
                value={cabeceraOp.modeloBase}
                onChange={manejarCambioCabecera}
                readOnly
              />
            </Campo>

            <Campo
              data-campo-validacion="tipoTela"
              className={`campo_requerido ${camposInvalidos.includes("tipoTela") ? "campo_error" : ""}`}
            >
              <label>Tipo de tela</label>
              <input
                type="text"
                list="catalogo-tipo-tela-op"
                name="tipoTela"
                value={cabeceraOp.tipoTela}
                onChange={manejarCambioCabecera}
                readOnly
              />
              <datalist id="catalogo-tipo-tela-op">
                {catalogosProduccion.tiposTela.map((tipoTela) => (
                  <option key={tipoTela} value={tipoTela} />
                ))}
              </datalist>
            </Campo>

            <Campo
              data-campo-validacion="tallas"
              className={`campo-completo campo_requerido ${camposInvalidos.includes("tallas") ? "campo_error" : ""}`}
            >
              <label>Tallas</label>
              <div className="grupo_checks">
                {tallasDisponibles.map((talla) => (
                  <CheckTalla key={talla}>
                    <input
                      type="checkbox"
                      checked={cabeceraOp.tallasSeleccionadas.includes(talla)}
                      onChange={() => manejarCambioTalla(talla)}
                    />
                    <span>{talla}</span>
                  </CheckTalla>
                ))}
              </div>
            </Campo>

            <Campo className="campo-completo campo_requerido">
              <label>Curva de la OP</label>
              <div className="grupo_curvas">
                {tallasVisiblesCabecera.map((talla) => (
                  <CampoCurva key={talla}>
                    <span>{talla}</span>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={cabeceraOp.curvaCabecera[talla]}
                      onChange={(evento) =>
                        manejarCambioCurva(talla, evento.target.value)
                      }
                      placeholder="0"
                    />
                  </CampoCurva>
                ))}
              </div>
            </Campo>

            <Campo className="campo-completo">
              <label>Observaciones generales</label>
              <textarea
                name="observacionesGenerales"
                value={cabeceraOp.observacionesGenerales}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
            </Campo>
          </div>
        </section>

        <section
          data-campo-validacion="telasSeleccionadas"
          className={`tarjeta ${camposInvalidos.includes("telasSeleccionadas") ? "tarjeta_error_validacion" : ""}`}
        >
          <div className="tarjeta__encabezado">
            <div>
              <h2>Tabla operativa</h2>
              <p>
                Aqui se trabajan las telas que Almacen ya despacho al area de
                habilitado. Si hace falta aumentar o devolver algo, se solicita
                a Almacen sin saltar su control.
              </p>
            </div>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo unidad</th>
                  <th>Tipo de tela</th>
                  <th>Color base</th>
                  <th>Acabado / diseño</th>
                  <th>Ancho de tela</th>
                  <th>Peso tela</th>
                  <th>Partida</th>
                  <th>Observacion</th>
                  <th>Accion</th>
                </tr>
              </thead>

              <tbody>
                {filasOp.map((fila) => (
                  <tr key={fila.id}>
                    <td className="columna_codigo">
                      <input
                        type="text"
                        value={fila.codigoUnidad}
                        readOnly
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={fila.tipoTela || ""}
                        readOnly
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={fila.colorBase}
                        readOnly
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={fila.acabadoDiseno || ""}
                        readOnly
                        placeholder=""
                      />
                    </td>

                    <td className="columna_ancho">
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={fila.anchoTela || ""}
                        onChange={(evento) =>
                          manejarCambioFila(fila.id, "anchoTela", evento.target.value)
                        }
                        placeholder=""
                      />
                    </td>

                    <td className="columna_peso">
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={fila.pesoTela || ""}
                        readOnly
                        placeholder=""
                      />
                    </td>

                    <td className="columna_partida">
                      <input
                        type="text"
                        value={fila.partida || ""}
                        readOnly
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
                        onClick={() => solicitarDevolucionAlmacen(fila)}
                      >
                        Devolver tela completa a Almacen
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
              <span>Variantes en OP</span>
              <strong>{filasOp.length}</strong>
            </div>

            <div>
              <span>Modelo base</span>
              <strong>{cabeceraOp.modeloBase || "-"}</strong>
            </div>

            <div>
              <span>Pedido origen</span>
              <strong>{cabeceraOp.pedidoOrigen || "-"}</strong>
            </div>

            <div>
              <span>Tallas</span>
              <strong>{cabeceraOp.tallas || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Solicitudes a almacen</h2>
              <p>
                Desde habilitado solo se solicitan aumentos o devoluciones.
                Almacen es quien atiende el movimiento real y recien ahi se actualiza el pedido.
              </p>
            </div>
          </div>

          <div className="grid grid-3">
            <Campo className="campo_requerido">
              <label>Tipo de tela</label>
              <input
                type="text"
                list="catalogo-solicitud-tela"
                name="tipoTela"
                value={solicitudNueva.tipoTela}
                onChange={manejarCambioSolicitud}
              />
              <datalist id="catalogo-solicitud-tela">
                {catalogosProduccion.tiposTela.map((tipoTela) => (
                  <option key={tipoTela} value={tipoTela} />
                ))}
              </datalist>
            </Campo>

            <Campo className="campo_requerido">
              <label>Color base</label>
              <input
                type="text"
                list="catalogo-solicitud-color"
                name="colorBase"
                value={solicitudNueva.colorBase}
                onChange={manejarCambioSolicitud}
              />
              <datalist id="catalogo-solicitud-color">
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
                list="catalogo-solicitud-motivo-global"
                name="motivo"
                value={solicitudNueva.motivo}
                onChange={manejarCambioSolicitud}
                placeholder="Selecciona o escribe un motivo"
              />
              <datalist id="catalogo-solicitud-motivo-global">
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
              <span className="movimiento_titulo">Solicitudes del pedido</span>
              {solicitudesPedidoActual.length === 0 ? (
                <small>Todavia no hay solicitudes registradas para este pedido.</small>
              ) : (
                solicitudesPedidoActual.map((solicitud) => (
                  <div
                    key={solicitud.id}
                    className={`movimiento_chip ${
                      solicitud.tipoSolicitud === "aumento"
                        ? "movimiento_chip--aumento"
                        : solicitud.tipoDevolucion === "DEVOLUCION_TOTAL"
                          ? "movimiento_chip--total"
                          : "movimiento_chip--devolucion"
                    }`}
                  >
                    <strong>
                      {solicitud.tipoSolicitud === "aumento"
                        ? "Aumento solicitado"
                        : solicitud.tipoDevolucion === "DEVOLUCION_TOTAL"
                          ? "Devolucion total solicitada"
                          : "Devolucion solicitada"}
                    </strong>
                    <span>
                      {solicitud.codigoUnidad
                        ? `${solicitud.codigoUnidad} | `
                        : ""}
                      {solicitud.tipoTela || "-"} | {solicitud.colorBase || "-"}
                      {solicitud.tipoSolicitud === "devolucion" &&
                      (solicitud.pesoDevuelto || solicitud.pesoTela)
                        ? ` | ${Number(
                            solicitud.pesoDevuelto || solicitud.pesoTela || 0
                          ).toFixed(2)} ${solicitud.unidadControl || "KG"}`
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

        <section className="acciones">
          {esPedidoExistente ? (
            <button
              type="button"
              className="btn btn_peligro"
              onClick={manejarCancelarPedido}
            >
              Cancelar pedido
            </button>
          ) : null}
          <button type="button" className="btn btn_secundario" onClick={manejarGuardar}>
            Guardar
          </button>
          <button type="button" className="btn btn_principal" onClick={manejarConfirmarDetalleOp}>
            Enviar a produccion
          </button>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
  /* Contenedor principal del modulo de detalle de OP. */
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
  .resumen span {
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
  .tarjeta_error_validacion {
    border: 1px solid ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 38, 38, 0.5)" : "rgba(248, 113, 113, 0.55)"};
    box-shadow: 0 0 0 3px
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(220, 38, 38, 0.12)"
          : "rgba(248, 113, 113, 0.14)"};
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

  .grupo_curvas,
  .grupo_checks {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .tarjeta__encabezado {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .lista_pedidos {
    display: grid;
    gap: 12px;
  }

  .pedido_vacio {
    padding: 16px;
    border-radius: 14px;
    border: 1px dashed ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .tarjeta_pedido {
    display: grid;
    gap: 6px;
    text-align: left;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    cursor: pointer;
  }

  .tarjeta_pedido_activa {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px rgba(117, 1, 152, 0.14);
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 980px;
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
    padding: 6px 8px;
    outline: none;
  }

  td input:not([readonly]):not([type="checkbox"]):focus {
    box-shadow: 0 0 0 3px rgba(117, 1, 152, 0.2);
  }

  .columna_codigo {
    min-width: 86px;
  }

  .columna_codigo input {
    max-width: 84px;
    padding: 8px 6px;
    font-size: 13px;
  }

  .columna_ancho {
    min-width: 74px;
  }

  .columna_ancho input {
    max-width: 72px;
    padding: 8px 5px;
    font-size: 13px;
    text-align: center;
  }

  .columna_peso {
    min-width: 78px;
  }

  .columna_peso input {
    max-width: 76px;
    padding: 8px 5px;
    font-size: 13px;
    text-align: center;
  }

  .columna_partida {
    min-width: 76px;
  }

  .columna_partida input {
    max-width: 74px;
    padding: 8px 5px;
    font-size: 13px;
    text-align: center;
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

  .movimientos_materiales {
    display: grid;
    gap: 16px;
    margin-top: 18px;
  }

  .movimiento_bloque {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bgtotal};
  }

  .movimiento_titulo {
    font-size: 14px;
    font-weight: 700;
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

  .movimiento_chip--devolucion {
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
  .movimiento_bloque small {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .acciones_solicitud {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
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
    background-color: #b3261e;
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

  @media (min-width: 860px) {
    .lista_pedidos {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .grid-2,
    .grid-3,
    .resumen__grid {
      grid-template-columns: 1fr;
    }

    .tarjeta__encabezado,
    .acciones,
    .fila_superior,
    .navegacion_superior {
      flex-direction: column;
    }

    .navegacion_superior {
      align-items: stretch;
    }
  }
`;

const Campo = styled.div`
  /* Estilos base de inputs y textarea del formulario. */
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input,
  textarea {
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
  textarea:focus {
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
  &.campo_requerido textarea {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.35)" : "rgba(230, 205, 238, 0.38)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.05)" : "rgba(117, 1, 152, 0.14)"};
  }

  &.campo_requerido input[readonly],
  &.campo_requerido textarea[readonly] {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4};
    background-color: ${({ theme }) => theme.bg};
  }

  &.campo_error input,
  &.campo_error textarea {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 38, 38, 0.78)" : "rgba(248, 113, 113, 0.85)"} !important;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(220, 38, 38, 0.06)" : "rgba(127, 29, 29, 0.25)"} !important;
  }
`;

const CampoCurva = styled.div`
  /* Inputs compactos de curva por talla. */
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 78px;

  span {
    font-size: 12px;
    font-weight: 700;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  input {
    border: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 10px;
    width: 78px;
    min-width: 78px;
    padding: 8px 6px;
    font-size: 13px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    text-align: center;
    outline: none;
  }
`;

const CheckTalla = styled.label`
  /* Checks de talla reutilizados para una captura mas rapida. */
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
