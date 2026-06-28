import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {
  sincronizarFlujoProduccionDesdeSupabase,
  sincronizarPedidoFlujoDesdeLocalASupabase,
} from "../../supabase/flujoProduccionCore.js";
import {
  confirmarAccionSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  normalizarTextoStock,
  obtenerStockMateriaPrimaDisponible,
} from "../../utils/stockMateriaPrima";
import {

  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_DEVOLUCIONES_PRODUCCION = "cynara_devoluciones_produccion";
const CLAVE_SOLICITUDES_HABILITADO = "cynara_solicitudes_habilitado";
const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_DETALLE_PEDIDO = "cynara_detalle_pedido_actual";
const CLAVE_DETALLE_OP = "cynara_detalle_op_actual";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_CORTE_ACTUAL = "cynara_detalle_corte_actual";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_SOLICITUDES_PROCESOS_EXTERNOS =
  "cynara_solicitudes_procesos_externos";
const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const CLAVE_DEVOLUCIONES_PROVEEDOR_MP = "cynara_devoluciones_proveedor_mp";
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

const leerDetalleGuardado = (clave) => {
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

const normalizarTexto = normalizarTextoStock;

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const convertirPesoVisual = (valor = "") => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero.toFixed(2) : "-";
};

const formatearPesoConUnidad = (valor = "", unidad = "KG") => {
  const peso = convertirPesoVisual(valor);
  return peso === "-" ? "-" : `${peso} ${unidad}`;
};

const obtenerPesoDevueltoSolicitud = (solicitud = {}) =>
  solicitud?.pesoDevuelto || solicitud?.pesoTela || "";

const obtenerTipoDevolucionVisible = (solicitud = {}) => {
  if (solicitud?.tipoSolicitud === "aumento") {
    return "AUMENTO";
  }

  if (solicitud?.tipoDevolucion === "SOBRANTE_PRODUCCION") {
    return "SOBRANTE";
  }

  if (solicitud?.tipoDevolucion === "DEVOLUCION_TOTAL") {
    return "TOTAL";
  }

  return "DEVOLUCION";
};

const construirFilaDesdeTela = (tela) => ({
  id: Date.now(),
  codigoUnidad: tela.codigoUnidad || "",
  tipoTela: tela.tipoTela || "",
  colorBase: tela.colorBase || "",
  acabadoDiseno: tela.acabadoDiseno || "",
  anchoTela: tela.ancho ? String(tela.ancho) : "",
  pesoTela:
    Number(tela.kilos || 0) > 0 ? Number(tela.kilos).toFixed(2) : "",
  partida: tela.partida || "",
  cantidad: "",
  observacion: "",
});

const obtenerStockDisponible = () => obtenerStockMateriaPrimaDisponible();

export function DevolucionProduccion() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroProcesoOp, setFiltroProcesoOp] = useState("");
  const [filtroProcesoTaller, setFiltroProcesoTaller] = useState("");
  const [filtroProcesoEstado, setFiltroProcesoEstado] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [solicitudes, setSolicitudes] = useState(() =>
    leerListaGuardada(CLAVE_SOLICITUDES_HABILITADO)
  );
  const [devoluciones, setDevoluciones] = useState(() =>
    leerListaGuardada(CLAVE_DEVOLUCIONES_PRODUCCION)
  );
  const [solicitudesProcesosExternos, setSolicitudesProcesosExternos] = useState(() =>
    leerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS)
  );
  const [devolucionesProveedor, setDevolucionesProveedor] = useState(() =>
    leerListaGuardada(CLAVE_DEVOLUCIONES_PROVEEDOR_MP)
  );
  const [stockDisponible, setStockDisponible] = useState(obtenerStockDisponible);
  const [solicitudSeleccionadaId, setSolicitudSeleccionadaId] = useState("");
  const [codigoTelaSeleccionada, setCodigoTelaSeleccionada] = useState("");

  useEffect(() => {
    const cargarSolicitudes = async () => {
      try {
        const data = await sincronizarFlujoProduccionDesdeSupabase();
        if (Array.isArray(data?.solicitudes)) {
          setSolicitudes(data.solicitudes);
        }
      } catch (error) {
        console.error("No se pudieron cargar las solicitudes desde Supabase:", error.message);
      }
    };

    cargarSolicitudes();
  }, []);

  const solicitudesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return solicitudes;
    }

    return solicitudes.filter((registro) =>
      [
        registro?.pedidoOrigen,
        registro?.modeloBase,
        registro?.codigoUnidad,
        registro?.tipoSolicitud,
        registro?.tipoDevolucion,
        registro?.tipoTela,
        registro?.colorBase,
        registro?.partida,
        registro?.motivo,
        registro?.estado,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, solicitudes]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(solicitudesFiltradas.length / FILAS_POR_PAGINA)
  );

  const solicitudesPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return solicitudesFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [solicitudesFiltradas, paginaActual]);

  const totalPendientes = solicitudes.filter(
    (registro) => registro?.estado === "pendiente"
  ).length;
  const totalAtendidas = solicitudes.filter(
    (registro) => registro?.estado === "atendida"
  ).length;
  const procesosExternosPendientes = solicitudesProcesosExternos.filter(
    (registro) => registro?.estadoMovimiento !== "recibido"
  ).length;
  const procesosExternosFiltrados = useMemo(() => {
    return solicitudesProcesosExternos.filter((proceso) => {
      const coincideOp = filtroProcesoOp.trim()
        ? (proceso?.codigoOp || "")
            .toLowerCase()
            .includes(filtroProcesoOp.trim().toLowerCase())
        : true;
      const coincideTaller = filtroProcesoTaller.trim()
        ? (proceso?.nombreTallerExterno || "")
            .toLowerCase()
            .includes(filtroProcesoTaller.trim().toLowerCase())
        : true;
      const coincideEstado = filtroProcesoEstado
        ? (proceso?.estadoMovimiento || "") === filtroProcesoEstado
        : true;

      return coincideOp && coincideTaller && coincideEstado;
    });
  }, [
    solicitudesProcesosExternos,
    filtroProcesoOp,
    filtroProcesoTaller,
    filtroProcesoEstado,
  ]);

  const solicitudSeleccionada =
    solicitudes.find((solicitud) => solicitud?.id === solicitudSeleccionadaId) ||
    null;

  const existeDerivacionProveedor = (solicitud) =>
    devolucionesProveedor.some(
      (registro) =>
        registro?.pedidoOrigen === solicitud?.pedidoOrigen &&
        registro?.codigoUnidad === solicitud?.codigoUnidad
    );

  const stockCompatible = useMemo(() => {
    if (!solicitudSeleccionada || solicitudSeleccionada.tipoSolicitud !== "aumento") {
      return [];
    }

    return stockDisponible.filter((tela) => {
      const coincideTela = solicitudSeleccionada.tipoTela
        ? tela.tipoTela
            ?.toLowerCase()
            .includes(solicitudSeleccionada.tipoTela.toLowerCase())
        : true;
      const coincideColor = solicitudSeleccionada.colorBase
        ? tela.colorBase
            ?.toLowerCase()
            .includes(solicitudSeleccionada.colorBase.toLowerCase())
        : true;

      return coincideTela && coincideColor;
    });
  }, [solicitudSeleccionada, stockDisponible]);

  const telaSeleccionadaParaDespacho =
    stockCompatible.find(
      (tela) => (tela?.codigoUnidad || "") === codigoTelaSeleccionada
    ) || null;

  const persistirSolicitudes = (solicitudesActualizadas) => {
    setSolicitudes(solicitudesActualizadas);
    localStorage.setItem(
      CLAVE_SOLICITUDES_HABILITADO,
      JSON.stringify(solicitudesActualizadas)
    );
  };

  const sincronizarSolicitudConSupabase = async (pedidoOrigen) => {
    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(pedidoOrigen);
      const data = await sincronizarFlujoProduccionDesdeSupabase();
      if (Array.isArray(data?.solicitudes)) {
        setSolicitudes(data.solicitudes);
      }
    } catch (error) {
      console.error("No se pudo sincronizar la solicitud con Supabase:", error.message);
    }
  };

  const persistirProcesosExternos = (procesosActualizados) => {
    setSolicitudesProcesosExternos(procesosActualizados);
    localStorage.setItem(
      CLAVE_SOLICITUDES_PROCESOS_EXTERNOS,
      JSON.stringify(procesosActualizados)
    );
  };

  const actualizarSolicitud = (idSolicitud, cambios = {}) => {
    const solicitudesActualizadas = solicitudes.map((solicitud) =>
      solicitud?.id === idSolicitud
        ? {
            ...solicitud,
            ...cambios,
          }
        : solicitud
    );

    persistirSolicitudes(solicitudesActualizadas);
  };

  const actualizarPedidoYOpConTela = (pedidoOrigen, tela) => {
    const historialPedidos = leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
    const detallePedidoActual = leerDetalleGuardado(CLAVE_DETALLE_PEDIDO);
    const historialOp = leerListaGuardada(CLAVE_HISTORIAL_OP);
    const detalleOpActual = leerDetalleGuardado(CLAVE_DETALLE_OP);
    const nuevaFila = construirFilaDesdeTela(tela);

    const agregarFila = (filas = []) =>
      filas.some((fila) => fila?.codigoUnidad === nuevaFila.codigoUnidad)
        ? filas
        : [...filas, nuevaFila];

    localStorage.setItem(
      CLAVE_HISTORIAL_PEDIDOS,
      JSON.stringify(
        historialPedidos.map((pedido) =>
          pedido?.datosCabecera?.codigoInterno === pedidoOrigen
            ? {
                ...pedido,
                filasPedido: agregarFila(pedido?.filasPedido || []),
                habilitadoMaterialesInfo: pedido?.habilitadoMaterialesInfo
                  ? {
                      ...pedido.habilitadoMaterialesInfo,
                      filasHabilitadas: agregarFila(
                        pedido?.habilitadoMaterialesInfo?.filasHabilitadas || []
                      ),
                    }
                  : pedido?.habilitadoMaterialesInfo,
              }
            : pedido
        )
      )
    );

    if (detallePedidoActual?.datosCabecera?.codigoInterno === pedidoOrigen) {
      localStorage.setItem(
        CLAVE_DETALLE_PEDIDO,
        JSON.stringify({
          ...detallePedidoActual,
          filasPedido: agregarFila(detallePedidoActual?.filasPedido || []),
          habilitadoMaterialesInfo: detallePedidoActual?.habilitadoMaterialesInfo
            ? {
                ...detallePedidoActual.habilitadoMaterialesInfo,
                filasHabilitadas: agregarFila(
                  detallePedidoActual?.habilitadoMaterialesInfo?.filasHabilitadas || []
                ),
              }
            : detallePedidoActual?.habilitadoMaterialesInfo,
        })
      );
    }

    const actualizarOp = (registro) =>
      registro?.cabeceraOp?.pedidoOrigen === pedidoOrigen
        ? {
            ...registro,
            filasOp: agregarFila(registro?.filasOp || []),
          }
        : registro;

    localStorage.setItem(
      CLAVE_HISTORIAL_OP,
      JSON.stringify(historialOp.map(actualizarOp))
    );

    if (detalleOpActual?.cabeceraOp?.pedidoOrigen === pedidoOrigen) {
      localStorage.setItem(
        CLAVE_DETALLE_OP,
        JSON.stringify(actualizarOp(detalleOpActual))
      );
    }
  };

  const quitarTelaDePedidoYOp = (pedidoOrigen, codigoUnidad) => {
    const historialPedidos = leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
    const detallePedidoActual = leerDetalleGuardado(CLAVE_DETALLE_PEDIDO);
    const historialOp = leerListaGuardada(CLAVE_HISTORIAL_OP);
    const detalleOpActual = leerDetalleGuardado(CLAVE_DETALLE_OP);

    const quitarFila = (filas = []) =>
      filas.filter((fila) => fila?.codigoUnidad !== codigoUnidad);

    localStorage.setItem(
      CLAVE_HISTORIAL_PEDIDOS,
      JSON.stringify(
        historialPedidos.map((pedido) =>
          pedido?.datosCabecera?.codigoInterno === pedidoOrigen
            ? {
                ...pedido,
                filasPedido: quitarFila(pedido?.filasPedido || []),
                habilitadoMaterialesInfo: pedido?.habilitadoMaterialesInfo
                  ? {
                      ...pedido.habilitadoMaterialesInfo,
                      filasHabilitadas: quitarFila(
                        pedido?.habilitadoMaterialesInfo?.filasHabilitadas || []
                      ),
                    }
                  : pedido?.habilitadoMaterialesInfo,
              }
            : pedido
        )
      )
    );

    if (detallePedidoActual?.datosCabecera?.codigoInterno === pedidoOrigen) {
      localStorage.setItem(
        CLAVE_DETALLE_PEDIDO,
        JSON.stringify({
          ...detallePedidoActual,
          filasPedido: quitarFila(detallePedidoActual?.filasPedido || []),
          habilitadoMaterialesInfo: detallePedidoActual?.habilitadoMaterialesInfo
            ? {
                ...detallePedidoActual.habilitadoMaterialesInfo,
                filasHabilitadas: quitarFila(
                  detallePedidoActual?.habilitadoMaterialesInfo?.filasHabilitadas || []
                ),
              }
            : detallePedidoActual?.habilitadoMaterialesInfo,
        })
      );
    }

    const actualizarOp = (registro) =>
      registro?.cabeceraOp?.pedidoOrigen === pedidoOrigen
        ? {
            ...registro,
            filasOp: quitarFila(registro?.filasOp || []),
          }
        : registro;

    localStorage.setItem(
      CLAVE_HISTORIAL_OP,
      JSON.stringify(historialOp.map(actualizarOp))
    );

    if (detalleOpActual?.cabeceraOp?.pedidoOrigen === pedidoOrigen) {
      localStorage.setItem(
        CLAVE_DETALLE_OP,
        JSON.stringify(actualizarOp(detalleOpActual))
      );
    }
  };

  const quitarTelaDeCorte = (pedidoOrigen, codigoUnidad) => {
    const historialCortes = leerListaGuardada(CLAVE_HISTORIAL_CORTES);
    const detalleCorteActual = leerDetalleGuardado(CLAVE_CORTE_ACTUAL);

    const quitarFila = (filas = []) =>
      filas.filter((fila) => fila?.codigoUnidad !== codigoUnidad);

    localStorage.setItem(
      CLAVE_HISTORIAL_CORTES,
      JSON.stringify(
        historialCortes.map((corte) =>
          corte?.cabeceraCorte?.pedidoOrigen === pedidoOrigen
            ? {
                ...corte,
                filasCorte: quitarFila(corte?.filasCorte || []),
              }
            : corte
        )
      )
    );

    if (detalleCorteActual?.cabeceraCorte?.pedidoOrigen === pedidoOrigen) {
      localStorage.setItem(
        CLAVE_CORTE_ACTUAL,
        JSON.stringify({
          ...detalleCorteActual,
          filasCorte: quitarFila(detalleCorteActual?.filasCorte || []),
        })
      );
    }
  };

  const manejarDespacharAumento = async () => {
    if (!solicitudSeleccionada) {
      return;
    }

    if (!telaSeleccionadaParaDespacho) {
      mostrarAlertaSistema("Selecciona primero el codigo de tela que Almacen enviara a habilitado.");
      return;
    }

    const confirmar = await confirmarAccionSistema(
      "Este movimiento actualizara el pedido y descontara esa tela del stock real.",
      {
        titulo: "Despachar aumento a habilitado",
        confirmarTexto: "Despachar tela",
      }
    );

    if (!confirmar) {
      return;
    }

    actualizarPedidoYOpConTela(
      solicitudSeleccionada.pedidoOrigen,
      telaSeleccionadaParaDespacho
    );
    actualizarSolicitud(solicitudSeleccionada.id, {
      estado: "atendida",
      fechaAtencion: obtenerFechaActual(),
      codigoUnidad: telaSeleccionadaParaDespacho.codigoUnidad,
      partida: telaSeleccionadaParaDespacho.partida,
      pesoTela:
        Number(telaSeleccionadaParaDespacho.kilos || 0) > 0
          ? Number(telaSeleccionadaParaDespacho.kilos).toFixed(2)
          : "",
    });
    setStockDisponible(obtenerStockDisponible());
    setCodigoTelaSeleccionada("");
    setSolicitudSeleccionadaId("");
    await sincronizarSolicitudConSupabase(solicitudSeleccionada.pedidoOrigen);
    mostrarNotificacionCarga("Aumento atendido. La tela ya quedo agregada al pedido.");
  };

  const manejarAceptarDevolucion = async (solicitud) => {
    const confirmar = await confirmarAccionSistema(
      "Almacen recibira la tela y recien ahi volvera al stock real.",
      {
        titulo: "Aceptar devolucion",
        confirmarTexto: "Aceptar devolucion",
      }
    );

    if (!confirmar) {
      return;
    }

    const esSobranteProduccion =
      solicitud?.areaOrigen === "Ordenes de produccion" ||
      solicitud?.tipoDevolucion === "SOBRANTE_PRODUCCION";

    if (!esSobranteProduccion) {
      quitarTelaDePedidoYOp(solicitud.pedidoOrigen, solicitud.codigoUnidad);
      quitarTelaDeCorte(solicitud.pedidoOrigen, solicitud.codigoUnidad);
    }

    const devolucionesActualizadas = [
      {
        id: `dev-${Date.now()}`,
        pedidoOrigen: solicitud.pedidoOrigen,
        codigoOp: solicitud.codigoOp || "",
        codigoUnidad: solicitud.codigoUnidad || "",
        tipoTela: solicitud.tipoTela || "",
        colorBase: solicitud.colorBase || "",
        partida: solicitud.partida || "",
        pesoTela: solicitud.pesoTela || "",
        pesoDevuelto: obtenerPesoDevueltoSolicitud(solicitud),
        pesoEnviado: solicitud.pesoEnviado || "",
        pesoUsado: solicitud.pesoUsado || "",
        tipoDevolucion: solicitud.tipoDevolucion || "",
        motivo: solicitud.motivo || "",
        unidadControl: solicitud.unidadControl || "KG",
        estado: "aceptada",
        fechaRecepcion: obtenerFechaActual(),
      },
      ...devoluciones,
    ];

    setDevoluciones(devolucionesActualizadas);
    localStorage.setItem(
      CLAVE_DEVOLUCIONES_PRODUCCION,
      JSON.stringify(devolucionesActualizadas)
    );
    actualizarSolicitud(solicitud.id, {
      estado: "atendida",
      fechaAtencion: obtenerFechaActual(),
    });
    setStockDisponible(obtenerStockDisponible());
    await sincronizarSolicitudConSupabase(solicitud.pedidoOrigen);

    mostrarNotificacionCarga("Devolucion aceptada. La tela ya puede volver al stock real.");
  };

  const manejarRechazarDevolucion = async (solicitud) => {
    const confirmar = await confirmarAccionSistema(
      "La tela seguira en Produccion y la solicitud quedara como rechazada.",
      {
        titulo: "Rechazar devolucion",
        confirmarTexto: "Rechazar",
      }
    );

    if (!confirmar) {
      return;
    }

    actualizarSolicitud(solicitud.id, {
      estado: "rechazada",
      fechaAtencion: obtenerFechaActual(),
      motivoRechazo: "Rechazada por almacen",
    });
    await sincronizarSolicitudConSupabase(solicitud.pedidoOrigen);

    mostrarNotificacionCarga("Devolucion rechazada. La tela sigue en Produccion.");
  };

  const manejarDerivarAProveedor = (solicitud) => {
    if (!solicitud?.codigoUnidad) {
      alert("Esta devolucion no tiene un codigo de tela valido para derivar al proveedor.");
      return;
    }

    if (existeDerivacionProveedor(solicitud)) {
      alert("Esta tela ya fue derivada al proveedor.");
      return;
    }

    const proveedorSugerido = normalizarTexto(
      solicitud?.proveedor || solicitud?.proveedorOriginal || "POR DEFINIR"
    );
    const proveedor = window
      .prompt(
        "Indica el proveedor al que se enviara esta tela fallada:",
        proveedorSugerido
      )
      ?.trim();

    if (!proveedor) {
      alert("Debes indicar el proveedor para derivar la tela.");
      return;
    }

    const motivoFalla = window
      .prompt(
        "Indica el motivo de falla para el proveedor:",
        solicitud?.observacion || "FALLA DE TELA"
      )
      ?.trim();

    if (!motivoFalla) {
      alert("Debes indicar el motivo de falla para dejar trazabilidad.");
      return;
    }

    const devolucionAceptada =
      devoluciones.find(
        (registro) =>
          registro?.pedidoOrigen === solicitud?.pedidoOrigen &&
          registro?.codigoUnidad === solicitud?.codigoUnidad
      ) || {};

    const nuevaDerivacion = {
      id: `dev-prov-${Date.now()}`,
      pedidoOrigen: solicitud?.pedidoOrigen || "",
      codigoOp: solicitud?.codigoOp || "",
      fechaSalida: obtenerFechaActual(),
      proveedor: normalizarTexto(proveedor),
      motivoFalla,
      observacion: solicitud?.observacion || "",
      origenMovimiento: "devolucion_proveedor",
      estado: "enviado",
      referenciaInterna: devolucionAceptada?.codigoOp || solicitud?.codigoOp || "",
      codigoUnidad: solicitud?.codigoUnidad || "",
      tipoTela: solicitud?.tipoTela || "",
      colorBase: solicitud?.colorBase || "",
      acabadoDiseno: devolucionAceptada?.acabadoDiseno || "",
      partida: solicitud?.partida || "",
      ancho: Number(devolucionAceptada?.anchoTela || 0),
      kilos: Number(devolucionAceptada?.pesoTela || 0),
      metros: Number(devolucionAceptada?.metros || 0),
    };

    const devolucionesProveedorActualizadas = [
      nuevaDerivacion,
      ...devolucionesProveedor,
    ];
    setDevolucionesProveedor(devolucionesProveedorActualizadas);
    localStorage.setItem(
      CLAVE_DEVOLUCIONES_PROVEEDOR_MP,
      JSON.stringify(devolucionesProveedorActualizadas)
    );

    alert("Tela derivada al proveedor. Ahora su seguimiento continua en Reposicion de proveedor.");
  };

  const actualizarEstadoProcesoExterno = (idProceso, cambios = {}) => {
    const procesosActualizados = solicitudesProcesosExternos.map((registro) =>
      registro?.id === idProceso
        ? {
            ...registro,
            ...cambios,
          }
        : registro
    );

    persistirProcesosExternos(procesosActualizados);

    const salidasTaller = leerListaGuardada("cynara_salidas_taller");
    const salidasActualizadas = salidasTaller.map((salida) => {
      if (salida?.codigoOp !== cambios.codigoOp) {
        return salida;
      }

      return {
        ...salida,
        procesosExternos: (salida?.procesosExternos || []).map((proceso) =>
          `${salida.codigoOp}-${proceso.id}` === idProceso
            ? {
                ...proceso,
                ...cambios,
              }
            : proceso
        ),
      };
    });

    localStorage.setItem("cynara_salidas_taller", JSON.stringify(salidasActualizadas));
  };

  const manejarEntregarProcesoExterno = (proceso) => {
    const confirmar = window.confirm(
      "Seguro que deseas registrar la entrega de este proceso externo al taller tercero?"
    );

    if (!confirmar) {
      return;
    }

    actualizarEstadoProcesoExterno(proceso.id, {
      codigoOp: proceso.codigoOp,
      estadoMovimiento: "entregado",
      fechaEntregaAlTercero: obtenerFechaActual(),
    });
  };

  const manejarRecibirProcesoExterno = (proceso) => {
    const confirmar = window.confirm(
      "Seguro que deseas registrar el retorno de este proceso externo desde el taller tercero?"
    );

    if (!confirmar) {
      return;
    }

    actualizarEstadoProcesoExterno(proceso.id, {
      codigoOp: proceso.codigoOp,
      estadoMovimiento: "recibido",
      fechaRetornoDesdeTercero: obtenerFechaActual(),
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
          <h1>Movimientos de produccion</h1>
          <p>
            Aqui almacen atiende los aumentos y devoluciones que pide el area de
            habilitado y tambien controla las entregas y retornos de procesos
            externos que salen a terceros.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Solicitudes pendientes</span>
          <strong>{totalPendientes}</strong>
          <small>
            {totalAtendidas} atendidas | {procesosExternosPendientes} procesos externos abiertos
          </small>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/almacen/materia-prima" className="boton_volver">
          Volver a Almacen
        </Link>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Bandeja de solicitudes</h2>
              <p>
                Escoge una solicitud pendiente para atenderla desde almacen.
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
              placeholder="Buscar por pedido, modelo, codigo unidad, tipo de solicitud, tela, color o estado"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Modelo</th>
                  <th>Tipo</th>
                  <th>Codigo unidad</th>
                  <th>Tipo de tela</th>
                  <th>Color base</th>
                  <th>Peso enviado</th>
                  <th>Peso usado</th>
                  <th>Peso a devolver</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>

              <tbody>
                {solicitudesPaginadas.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="fila_vacia">
                      Todavia no hay solicitudes registradas desde Produccion.
                    </td>
                  </tr>
                ) : (
                  solicitudesPaginadas.map((registro) => (
                    <tr key={registro.id}>
                      <td>{registro.pedidoOrigen || "-"}</td>
                      <td>{registro.modeloBase || "-"}</td>
                      <td>{obtenerTipoDevolucionVisible(registro)}</td>
                      <td>{registro.codigoUnidad || "-"}</td>
                      <td>{registro.tipoTela || "-"}</td>
                      <td>{registro.colorBase || "-"}</td>
                      <td>
                        {registro.tipoSolicitud === "aumento"
                          ? "-"
                          : formatearPesoConUnidad(
                              registro.pesoEnviado,
                              registro.unidadControl || "KG"
                            )}
                      </td>
                      <td>
                        {registro.tipoSolicitud === "aumento"
                          ? "-"
                          : formatearPesoConUnidad(
                              registro.pesoUsado,
                              registro.unidadControl || "KG"
                            )}
                      </td>
                      <td>
                        {registro.tipoSolicitud === "aumento"
                          ? "-"
                          : formatearPesoConUnidad(
                              obtenerPesoDevueltoSolicitud(registro),
                              registro.unidadControl || "KG"
                            )}
                      </td>
                      <td>{registro.motivo || registro.observacion || "-"}</td>
                      <td>{registro.estado || "-"}</td>
                      <td>
                        {registro.estado === "atendida" && registro.tipoSolicitud === "devolucion" ? (
                          existeDerivacionProveedor(registro) ? (
                            <span className="estado_aceptado">Derivada a proveedor</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn_secundario btn_tabla"
                              onClick={() => manejarDerivarAProveedor(registro)}
                            >
                              Derivar a proveedor
                            </button>
                          )
                        ) : registro.estado === "atendida" ? (
                          <span className="estado_aceptado">Atendida</span>
                        ) : registro.estado === "rechazada" ? (
                          <span className="estado_observado">Rechazada</span>
                        ) : registro.tipoSolicitud === "aumento" ? (
                          <button
                            type="button"
                            className="btn btn_principal btn_tabla"
                            onClick={() => {
                              setSolicitudSeleccionadaId(registro.id);
                              setCodigoTelaSeleccionada("");
                            }}
                          >
                            Atender aumento
                          </button>
                        ) : (
                          <div className="acciones_tabla_dobles">
                            <button
                              type="button"
                              className="btn btn_principal btn_tabla"
                              onClick={() => manejarAceptarDevolucion(registro)}
                            >
                              Aceptar devolucion
                            </button>
                            <button
                              type="button"
                              className="btn btn_secundario btn_tabla"
                              onClick={() => manejarRechazarDevolucion(registro)}
                            >
                              Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {solicitudesFiltradas.length > FILAS_POR_PAGINA ? (
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

        {solicitudSeleccionada?.tipoSolicitud === "aumento" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Stock para atender aumento</h2>
                <p>
                  Selecciona la tela real que almacen enviara a habilitado para
                  este pedido.
                </p>
              </div>
            </div>

            <div className="resumen_solicitud">
              <span>Pedido: {solicitudSeleccionada.pedidoOrigen || "-"}</span>
              <span>Tela: {solicitudSeleccionada.tipoTela || "-"}</span>
              <span>Color: {solicitudSeleccionada.colorBase || "-"}</span>
            </div>

            <div className="resumen_solicitud">
              <span>
                Codigo elegido: {telaSeleccionadaParaDespacho?.codigoUnidad || "Todavia no seleccionado"}
              </span>
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Elegir</th>
                    <th>Codigo unidad</th>
                    <th>Tipo de tela</th>
                    <th>Color base</th>
                    <th>Partida</th>
                    <th>Ancho</th>
                    <th>Peso</th>
                  </tr>
                </thead>

                <tbody>
                  {stockCompatible.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="fila_vacia">
                        No hay stock compatible disponible para esta solicitud.
                      </td>
                    </tr>
                  ) : (
                    stockCompatible.map((tela) => (
                      <tr key={tela.id}>
                        <td>
                          <input
                            type="radio"
                            name="tela-aumento"
                            checked={codigoTelaSeleccionada === (tela.codigoUnidad || "")}
                            onChange={() =>
                              setCodigoTelaSeleccionada(tela.codigoUnidad || "")
                            }
                          />
                        </td>
                        <td>{tela.codigoUnidad || "-"}</td>
                        <td>{tela.tipoTela || "-"}</td>
                        <td>{tela.colorBase || "-"}</td>
                        <td>{tela.partida || "-"}</td>
                        <td>{tela.ancho || "-"}</td>
                        <td>
                          {Number(tela.kilos || 0) > 0
                            ? Number(tela.kilos).toFixed(2)
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="acciones acciones_solicitud">
              <button
                type="button"
                className="btn btn_principal"
                onClick={manejarDespacharAumento}
                disabled={!telaSeleccionadaParaDespacho}
              >
                Despachar tela seleccionada
              </button>
            </div>
          </section>
        ) : null}

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Procesos externos de taller</h2>
              <p>
                Aqui Almacen registra cuando una OP o parte de ella sale a un
                tercero y cuando regresa para seguir su ruta normal.
              </p>
            </div>
          </div>

          <div className="filtros_procesos">
            <input
              type="text"
              value={filtroProcesoOp}
              onChange={(evento) => setFiltroProcesoOp(evento.target.value)}
              placeholder="Filtrar por OP"
            />

            <input
              type="text"
              value={filtroProcesoTaller}
              onChange={(evento) => setFiltroProcesoTaller(evento.target.value)}
              placeholder="Filtrar por taller tercero"
            />

            <select
              value={filtroProcesoEstado}
              onChange={(evento) => setFiltroProcesoEstado(evento.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="pendiente_entrega">Pendiente entrega</option>
              <option value="entregado">Entregado</option>
              <option value="recibido">Recibido</option>
            </select>

            <button
              type="button"
              className="btn btn_secundario btn_filtro_limpiar"
              onClick={() => {
                setFiltroProcesoOp("");
                setFiltroProcesoTaller("");
                setFiltroProcesoEstado("");
              }}
            >
              Limpiar filtros
            </button>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>OP</th>
                  <th>Modelo</th>
                  <th>Proceso</th>
                  <th>Taller principal</th>
                  <th>Taller tercero</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th>Entrega</th>
                  <th>Retorno</th>
                  <th>Accion</th>
                </tr>
              </thead>

              <tbody>
                {procesosExternosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="fila_vacia">
                      No hay procesos externos que coincidan con ese filtro.
                    </td>
                  </tr>
                ) : (
                  procesosExternosFiltrados.map((proceso) => (
                    <tr key={proceso.id}>
                      <td>{proceso.codigoOp || "-"}</td>
                      <td>{proceso.modelo || "-"}</td>
                      <td>{proceso.tipoProceso || "-"}</td>
                      <td>{proceso.tallerPrincipal || "-"}</td>
                      <td>{proceso.nombreTallerExterno || "-"}</td>
                      <td>{proceso.cantidad || 0}</td>
                      <td>{proceso.estadoMovimiento || "-"}</td>
                      <td>{proceso.fechaEntregaAlTercero || "-"}</td>
                      <td>{proceso.fechaRetornoDesdeTercero || "-"}</td>
                      <td>
                        {proceso.estadoMovimiento === "pendiente_entrega" ? (
                          <button
                            type="button"
                            className="btn btn_principal btn_tabla"
                            onClick={() => manejarEntregarProcesoExterno(proceso)}
                          >
                            Entregar a tercero
                          </button>
                        ) : proceso.estadoMovimiento === "entregado" ? (
                          <button
                            type="button"
                            className="btn btn_principal btn_tabla"
                            onClick={() => manejarRecibirProcesoExterno(proceso)}
                          >
                            Recibir de tercero
                          </button>
                        ) : (
                          <span className="estado_aceptado">Cerrado</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
    border-radius: 18px;
    padding: 22px;
    border: 1px solid ${({ theme }) => theme.colorline};
  }

  .cabecera {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .cabecera__estado small {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  .cabecera__estado {
    min-width: 170px;
    border-radius: 16px;
    padding: 18px;
    background-color: ${({ theme }) => theme.bg};
    display: grid;
    gap: 6px;
  }

  .cabecera__estado span,
  .paginacion span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 14px;
  }

  .cabecera__estado strong {
    font-size: 28px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .boton_volver {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 18px;
    border-radius: 12px;
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
    text-decoration: none;
    font-weight: 700;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .tarjeta__encabezado {
    margin-bottom: 16px;
  }

  .buscador {
    margin-bottom: 16px;
  }

  .buscador input {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.colorline};
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .resumen_solicitud {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
  }

  .acciones_tabla_dobles {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .resumen_solicitud span {
    padding: 8px 12px;
    border-radius: 999px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    font-size: 13px;
    font-weight: 600;
  }

  .filtros_procesos {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    align-items: stretch;
  }

  .filtros_procesos input,
  .filtros_procesos select {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.colorline};
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .btn_filtro_limpiar {
    width: 100%;
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 940px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid ${({ theme }) => theme.colorline};
    text-align: left;
  }

  th {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 18px;
  }

  .btn {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
  }

  .btn_tabla {
    padding: 9px 14px;
    border-radius: 10px;
  }

  .estado_aceptado {
    color: ${({ theme }) => theme.text};
    font-weight: 700;
  }

  .paginacion {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
    flex-wrap: wrap;
  }

  @media (max-width: 860px) {
    .cabecera,
    .fila_superior {
      display: grid;
      grid-template-columns: 1fr;
    }

    .filtros_procesos {
      grid-template-columns: 1fr;
    }

    .cabecera__estado {
      min-width: 100%;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;




