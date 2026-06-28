import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, leerCatalogosProduccion } from "../../index";
import {
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  leerCostosTerceros,
  obtenerCostoTerceroPorProceso,
} from "../../utils/costosTerceros";
import {
  guardarCostoTerceroConfiguracion,
  listarCostosTercerosConfiguracion,
  leerCorrelativoSistemaConfiguracion,
  registrarUsoCorrelativoSistemaConfiguracion,
} from "../../supabase/configuracionCore.js";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";
import {
  sincronizarTallerStockDesdeLocalASupabase,
  sincronizarTallerStockDesdeSupabase,
} from "../../supabase/flujoTallerStockCore";

// Este catalogo local guarda cada servicio tercerizado como documento hijo de una OP.
const CLAVE_TERCERIZACIONES = "cynara_tercerizaciones_op";
const CLAVE_SOLICITUDES_PROCESOS_EXTERNOS = "cynara_solicitudes_procesos_externos";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const PROCESOS_TERCEROS = ["MULTIAGUJA", "ESTAMPADO", "BORDADO", "LAVADO", "OTRO"];
const TALLAS_DISPONIBLES = ["S", "M", "L", "XL", "XXL"];
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

const leerListaGuardada = (clave) => {
  const contenido = localStorage.getItem(clave);

  if (!contenido) {
    return [];
  }

  try {
    const data = JSON.parse(contenido);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const guardarListaGuardada = (clave, data) => {
  localStorage.setItem(clave, JSON.stringify(data));
};

const leerHistorialTercerizaciones = () => {
  const historialPrincipal = leerListaGuardada(CLAVE_TERCERIZACIONES);
  const historialProcesos = leerListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS);

  return normalizarHistorialTercerizaciones([
    ...historialPrincipal,
    ...historialProcesos,
  ]);
};

const guardarHistorialTercerizaciones = (data = []) => {
  guardarListaGuardada(CLAVE_TERCERIZACIONES, data);
  guardarListaGuardada(CLAVE_SOLICITUDES_PROCESOS_EXTERNOS, data);
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

const formatearMoneda = (valor) =>
  convertirNumero(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatearMontoSoles = (valor) => `S/ ${formatearMoneda(valor)}`;

const normalizarNumeroEntrada = (valor = "", { permitirDecimales = false } = {}) => {
  const texto = String(valor ?? "");

  if (!texto) {
    return "";
  }

  const limpio = permitirDecimales
    ? texto.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
    : texto.replace(/\D/g, "");

  return limpio;
};

const crearDescuentoTerceroVacio = () => ({
  id: `desc-ter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  colorBase: "",
  talla: "",
  cantidad: "",
  precioUnitario: "",
  motivo: "FALLA DE SERVICIO",
});

const normalizarDescuentosTercero = (descuentos = []) =>
  Array.isArray(descuentos)
    ? descuentos.map((descuento, indice) => ({
        ...descuento,
        id: descuento?.id || `desc-ter-guardado-${indice + 1}`,
        colorBase: descuento?.colorBase || "",
        talla: descuento?.talla || "",
        cantidad: String(descuento?.cantidad ?? ""),
        precioUnitario: String(descuento?.precioUnitario ?? ""),
        motivo: descuento?.motivo || "FALLA DE SERVICIO",
      }))
    : [];

const calcularTotalBrutoTercerizacion = (registro = {}) =>
  convertirNumero(registro?.cantidad) * convertirNumero(registro?.costoUnitario);

const calcularMontoDescuentoTercero = (descuentos = []) =>
  normalizarDescuentosTercero(descuentos).reduce(
    (total, descuento) =>
      total +
      convertirNumero(descuento?.cantidad) * convertirNumero(descuento?.precioUnitario),
    0
  );

const calcularTotalNetoTercerizacion = (registro = {}) =>
  Math.max(
    0,
    calcularTotalBrutoTercerizacion(registro) -
      calcularMontoDescuentoTercero(registro?.descuentosPrendaTercero || [])
  );

const calcularSaldoPendienteTercero = (registro = {}) =>
  convertirNumero(registro?.total) - convertirNumero(registro?.montoPagadoAcumulado);

const obtenerEstadoTercerizacion = (registro = {}) => {
  if (registro?.aprobadoProduccion && calcularSaldoPendienteTercero(registro) <= 0) {
    return { texto: "Pagado", clase: "estado_aprobado" };
  }

  if (registro?.aprobadoProduccion) {
    return { texto: "Aprobado por produccion", clase: "estado_aprobado" };
  }

  if (registro?.fechaRetornoTercero) {
    return { texto: "Retornado de tercero", clase: "estado_recibido" };
  }

  if (registro?.fechaEnvioTercero) {
    return { texto: "En servicio tercerizado", clase: "estado_activo" };
  }

  if (registro?.fechaRecepcionAlmacen) {
    return { texto: "Listo para enviar a tercero", clase: "estado_pendiente" };
  }

  return { texto: "Pendiente de control almacen", clase: "estado_observado" };
};

const resolverEstadoRegistroTercerizacion = (registro = {}) => {
  if (registro?.cancelado) {
    return "cancelado";
  }

  if (registro?.aprobadoProduccion && calcularSaldoPendienteTercero(registro) <= 0) {
    return "pagado";
  }

  if (registro?.aprobadoProduccion) {
    return "aprobado_produccion";
  }

  if (registro?.fechaRetornoTercero) {
    return "retornado_tercero";
  }

  if (registro?.fechaEnvioTercero) {
    return "en_servicio_tercerizado";
  }

  if (registro?.fechaRecepcionAlmacen) {
    return "listo_para_enviar_tercero";
  }

  return "pendiente_control_almacen";
};

const estaTercerizacionEnHistorial = (registro = {}) =>
  Boolean(
    registro?.fechaEnvioTercero ||
      registro?.fechaRetornoTercero ||
      registro?.aprobadoProduccion ||
      convertirNumero(registro?.montoPagadoAcumulado) > 0
  );

const obtenerOpsConfirmadas = () =>
  leerListaGuardada(CLAVE_HISTORIAL_CORTES).filter((corte) => corte?.estado === "confirmado");

const construirClaveTercerizacion = (registro = {}) =>
  [
    registro?.itemSalidaId || registro?.codigoSalida || "",
    registro?.codigoOp || "",
    registro?.tallerPrincipal || "",
    registro?.proceso || "MULTIAGUJA",
  ].join("::");

const construirClaveTercerizacionSecundaria = (registro = {}) =>
  [
    registro?.codigoOp || "",
    registro?.itemSalidaId || registro?.codigoSalida || "",
    registro?.modelo || "",
    registro?.tallerPrincipal || "",
    registro?.proceso || "MULTIAGUJA",
    registro?.tallerTercero || "",
  ].join("::");

const obtenerNumeroCorrelativoTercerizacion = (codigo = "") =>
  Number(String(codigo).match(/(\d+)$/)?.[1] || "0");

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

const fusionarTercerizaciones = (base = {}, extra = {}) => {
  const preferida =
    obtenerPuntajeTercerizacion(extra) >= obtenerPuntajeTercerizacion(base) ? extra : base;
  const secundaria = preferida === extra ? base : extra;
  const correlativoBase = obtenerNumeroCorrelativoTercerizacion(base?.codigoTercerizacion);
  const correlativoExtra = obtenerNumeroCorrelativoTercerizacion(extra?.codigoTercerizacion);
  const codigoConservado =
    correlativoBase > 0 && correlativoExtra > 0
      ? correlativoBase <= correlativoExtra
        ? base?.codigoTercerizacion
        : extra?.codigoTercerizacion
      : preferida?.codigoTercerizacion || secundaria?.codigoTercerizacion || "";

  return {
    ...secundaria,
    ...preferida,
    id: preferida?.id || secundaria?.id || `ter-${Date.now()}`,
    itemSalidaId: preferida?.itemSalidaId || secundaria?.itemSalidaId || "",
    codigoSalida: preferida?.codigoSalida || secundaria?.codigoSalida || "",
    codigoTercerizacion: codigoConservado,
    codigoOp: preferida?.codigoOp || secundaria?.codigoOp || "",
    tallerPrincipal:
      preferida?.tallerPrincipal || secundaria?.tallerPrincipal || "",
    proceso: preferida?.proceso || secundaria?.proceso || "MULTIAGUJA",
    tallerTercero: preferida?.tallerTercero || secundaria?.tallerTercero || "",
    cantidadAgujas:
      preferida?.cantidadAgujas || secundaria?.cantidadAgujas || "",
    observacionProduccion:
      preferida?.observacionProduccion || secundaria?.observacionProduccion || "",
    observacionAlmacen:
      preferida?.observacionAlmacen || secundaria?.observacionAlmacen || "",
    descuentosPrendaTercero: normalizarDescuentosTercero(
      preferida?.descuentosPrendaTercero?.length
        ? preferida?.descuentosPrendaTercero
        : secundaria?.descuentosPrendaTercero || []
    ),
  };
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

    const previoPorClave = mapa.get(clave);
    const previoPorClaveSecundaria = mapaSecundario.get(claveSecundaria);
    const previo = previoPorClave || previoPorClaveSecundaria;
    const fusionado = previo ? fusionarTercerizaciones(previo, registro) : registro;

    mapa.set(clave, fusionado);
    mapaSecundario.set(claveSecundaria, fusionado);
  });

  return [...new Set(mapaSecundario.values())].sort((a, b) => {
    const fechaA = new Date(
      a?.fechaRetornoTercero ||
        a?.fechaEnvioTercero ||
        a?.fechaRecepcionAlmacen ||
        a?.fechaSolicitud ||
        0,
    ).getTime();
    const fechaB = new Date(
      b?.fechaRetornoTercero ||
        b?.fechaEnvioTercero ||
        b?.fechaRecepcionAlmacen ||
        b?.fechaSolicitud ||
        0,
    ).getTime();

    return fechaB - fechaA;
  });
};

const obtenerSalidaConTercerizacion = ({ codigoOp = "", itemSalidaId = "" } = {}) => {
  const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER);
  const candidatas = salidas.filter((salida) => {
    if (!salida?.servicioATerceros) {
      return false;
    }

    if (
      itemSalidaId &&
      [
        salida?.itemSalidaId || "",
        salida?.id || "",
        salida?.codigoSalida || "",
        salida?.parentItemId || "",
      ].includes(itemSalidaId)
    ) {
      return true;
    }

    return codigoOp && (salida?.codigoOp || "") === codigoOp;
  });

  if (candidatas.length === 0) {
    return null;
  }

  return candidatas.sort((a, b) => {
    const fechaA = new Date(a?.fechaEnvio || a?.updatedAt || a?.createdAt || 0).getTime();
    const fechaB = new Date(b?.fechaEnvio || b?.updatedAt || b?.createdAt || 0).getTime();
    return fechaB - fechaA;
  })[0];
};

const buscarSalidaAsociadaParaRegistro = (registro = {}) => {
  const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER).filter(
    (salida) => salida?.servicioATerceros && salida?.codigoOp === registro?.codigoOp
  );

  if (salidas.length === 0) {
    return null;
  }

  const referenciasRegistro = [
    registro?.itemSalidaId || "",
    registro?.codigoSalida || "",
    registro?.id || "",
  ].filter(Boolean);

  const candidatas = salidas
    .map((salida) => {
      let puntaje = 0;
      const referenciasSalida = [
        salida?.itemSalidaId || "",
        salida?.id || "",
        salida?.codigoSalida || "",
        salida?.parentItemId || "",
      ].filter(Boolean);

      if (
        referenciasRegistro.length > 0 &&
        referenciasRegistro.some((referencia) => referenciasSalida.includes(referencia))
      ) {
        puntaje += 100;
      }

      if ((salida?.tipoProcesoTercero || "MULTIAGUJA") === (registro?.proceso || "MULTIAGUJA")) {
        puntaje += 40;
      }

      if ((salida?.modelo || salida?.modeloBase || "") === (registro?.modelo || "")) {
        puntaje += 20;
      }

      if (convertirNumero(salida?.cantidadTotal) === convertirNumero(registro?.cantidad)) {
        puntaje += 10;
      }

      return { salida, puntaje };
    })
    .filter((item) => item.puntaje > 0)
    .sort((a, b) => {
      if (b.puntaje !== a.puntaje) {
        return b.puntaje - a.puntaje;
      }

      const fechaA = new Date(
        a?.salida?.fechaEnvio || a?.salida?.updatedAt || a?.salida?.createdAt || 0
      ).getTime();
      const fechaB = new Date(
        b?.salida?.fechaEnvio || b?.salida?.updatedAt || b?.salida?.createdAt || 0
      ).getTime();
      return fechaB - fechaA;
    });

  return candidatas[0]?.salida || null;
};

const repararHistorialTercerizacionesDesdeSalidas = (lista = []) => {
  let huboCambios = false;

  const reparada = lista.map((registro) => {
    const necesitaTaller = !String(registro?.tallerTercero || "").trim();
    const necesitaAgujas =
      (registro?.proceso || "MULTIAGUJA") === "MULTIAGUJA" &&
      !String(registro?.cantidadAgujas || "").trim();

    if (!necesitaTaller && !necesitaAgujas) {
      return registro;
    }

    const salida = buscarSalidaAsociadaParaRegistro(registro);
    if (!salida) {
      return registro;
    }

    const siguiente = {
      ...registro,
      itemSalidaId:
        registro?.itemSalidaId ||
        salida?.id ||
        salida?.codigoSalida ||
        salida?.itemSalidaId ||
        "",
      tallerTercero: registro?.tallerTercero || salida?.tallerTercero || "",
      cantidadAgujas:
        registro?.cantidadAgujas ||
        ((registro?.proceso || "MULTIAGUJA") === "MULTIAGUJA"
          ? salida?.detallesConfeccion?.cantidadAgujas || ""
          : ""),
      observacionProduccion:
        registro?.observacionProduccion || salida?.observacionTercero || "",
    };

    if (
      siguiente.itemSalidaId !== registro?.itemSalidaId ||
      siguiente.tallerTercero !== registro?.tallerTercero ||
      siguiente.cantidadAgujas !== registro?.cantidadAgujas ||
      siguiente.observacionProduccion !== registro?.observacionProduccion
    ) {
      huboCambios = true;
    }

    return siguiente;
  });

  return {
    lista: reparada,
    huboCambios,
  };
};

const buscarTercerizacionExistente = (
  historial = [],
  { codigoOp = "", itemSalidaId = "", codigoSalida = "", tallerPrincipal = "", proceso = "" } = {},
) => {
  if (!codigoOp) {
    return null;
  }

  const referencias = [itemSalidaId, codigoSalida].filter(Boolean);
  const tallerPrincipalNormalizado = String(tallerPrincipal || "").trim().toUpperCase();
  const porReferencia = referencias.length > 0
    ? historial.find(
        (item) =>
          item?.codigoOp === codigoOp &&
          referencias.some((referencia) =>
            [
              item?.itemSalidaId || "",
              item?.codigoSalida || "",
              item?.id || "",
              item?.codigoTercerizacion || "",
            ].includes(referencia)
          ) &&
          (!proceso || (item?.proceso || "MULTIAGUJA") === proceso),
      )
    : null;

  if (porReferencia) {
    return porReferencia;
  }

  if (tallerPrincipalNormalizado) {
    const porTaller = historial.find(
      (item) =>
        item?.codigoOp === codigoOp &&
        String(item?.tallerPrincipal || "").trim().toUpperCase() === tallerPrincipalNormalizado &&
        (!proceso || (item?.proceso || "MULTIAGUJA") === proceso)
    );

    if (porTaller) {
      return porTaller;
    }
  }

  if (referencias.length > 0 || tallerPrincipalNormalizado) {
    return null;
  }

  return (
    historial.find(
      (item) =>
        item?.codigoOp === codigoOp &&
        (!proceso || (item?.proceso || "MULTIAGUJA") === proceso),
    ) || null
  );
};

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

const crearRegistroVacio = () => ({
  id: "",
  itemSalidaId: "",
  codigoSalida: "",
  codigoTercerizacion: "",
  codigoOp: "",
  modelo: "",
  tallerPrincipal: "",
  proceso: "MULTIAGUJA",
  cantidadAgujas: "",
  tallerTercero: "",
  cantidad: "",
  origen: "PRODUCCION DIRECTA",
  fechaSolicitud: obtenerFechaActual(),
  fechaRecepcionAlmacen: "",
  fechaEnvioTercero: "",
  fechaRetornoTercero: "",
  costoUnitario: "",
  total: 0,
  observacionProduccion: "",
  observacionAlmacen: "",
  aprobadoProduccion: false,
  montoPagadoAcumulado: 0,
  fechaPago: "",
  pagadoProduccion: false,
  descuentosPrendaTercero: [],
});

const construirRegistroDesdeOp = (op, historial = [], prefijo = "T") => {
  const codigoOp = op?.cabeceraCorte?.codigoCorte || op?.cabeceraCorte?.opOrigen || "";
  const salidaAsociada = obtenerSalidaConTercerizacion({ codigoOp, itemSalidaId: op?.id || "" });
  const procesoBase =
    salidaAsociada?.tipoProcesoTercero ||
    op?.tipoProcesoTercero ||
    op?.cabeceraCorte?.tipoProcesoTercero ||
    "MULTIAGUJA";
  const existente = buscarTercerizacionExistente(historial, {
    codigoOp,
    itemSalidaId: op?.id || "",
    codigoSalida: op?.codigoSalida || "",
    tallerPrincipal: op?.nombreTaller || "",
    proceso: procesoBase,
  });

  return {
    ...crearRegistroVacio(),
    ...existente,
    codigoOp,
    itemSalidaId: existente?.itemSalidaId || op?.id || "",
    codigoSalida: existente?.codigoSalida || salidaAsociada?.codigoSalida || "",
    codigoTercerizacion:
      existente?.codigoTercerizacion ||
      generarCodigoTercerizacion(codigoOp, historial, "", prefijo),
    modelo: op?.cabeceraCorte?.modeloBase || salidaAsociada?.modelo || existente?.modelo || "",
    proceso: procesoBase,
    cantidadAgujas:
      salidaAsociada?.detallesConfeccion?.cantidadAgujas ||
      existente?.cantidadAgujas ||
      op?.cabeceraCorte?.detallesConfeccion?.cantidadAgujas ||
      "",
    tallerTercero: salidaAsociada?.tallerTercero || existente?.tallerTercero || op?.tallerTercero || "",
    observacionProduccion:
      salidaAsociada?.observacionTercero ||
      existente?.observacionProduccion ||
      op?.observacionTercero ||
      "Servicio marcado desde salida de taller.",
    cantidad: String(
      salidaAsociada?.cantidadTotal ||
        salidaAsociada?.totalUnidades ||
        existente?.cantidad ||
        op?.cantidadTotal ||
        ""
    ),
  };
};

const construirRegistroDesdeRecepcion = (recepcion, historial = [], prefijo = "T") => {
  const cabecera = recepcion?.cabeceraRecepcion || {};
  const codigoOp = cabecera?.codigoOp || "";
  const itemSalidaId = cabecera?.itemSalidaId || "";
  const salidaAsociada = obtenerSalidaConTercerizacion({ codigoOp, itemSalidaId });
  const procesoBase =
    cabecera?.tipoProcesoExterno ||
    salidaAsociada?.tipoProcesoTercero ||
    "MULTIAGUJA";
  const existente = buscarTercerizacionExistente(historial, {
    codigoOp,
    itemSalidaId,
    codigoSalida: cabecera?.codigoSalida || "",
    tallerPrincipal: cabecera?.nombreTaller || "",
    proceso: procesoBase,
  });

  return {
    ...crearRegistroVacio(),
    ...existente,
    itemSalidaId: cabecera?.itemSalidaId || "",
    codigoSalida: cabecera?.codigoSalida || salidaAsociada?.codigoSalida || existente?.codigoSalida || "",
    codigoOp,
    codigoTercerizacion:
      existente?.codigoTercerizacion ||
      generarCodigoTercerizacion(codigoOp, historial, "", prefijo),
    modelo: cabecera?.modelo || "",
    tallerPrincipal: cabecera?.nombreTaller || "",
    proceso: procesoBase,
    cantidadAgujas:
      cabecera?.detallesConfeccion?.cantidadAgujas ||
      salidaAsociada?.detallesConfeccion?.cantidadAgujas ||
      existente?.cantidadAgujas ||
      "",
    tallerTercero:
      cabecera?.nombreTallerTercero || salidaAsociada?.tallerTercero || existente?.tallerTercero || "",
    cantidad: String(cabecera?.cantidadRecibida || cabecera?.cantidadTotal || ""),
    origen: "DESDE RECEPCION ALMACEN",
    fechaSolicitud: cabecera?.fechaRecepcion || obtenerFechaActual(),
    fechaRecepcionAlmacen:
      existente?.fechaRecepcionAlmacen ||
      cabecera?.fechaRecepcion ||
      obtenerFechaActual(),
    observacionProduccion:
      cabecera?.observacionProcesoExterno ||
      salidaAsociada?.observacionTercero ||
      existente?.observacionProduccion ||
      "",
    observacionAlmacen:
      cabecera?.observaciones || "Tercerizacion abierta desde recepcion de almacen.",
  };
};

const coincideTercerizacionConRecepcion = (item = {}, cabecera = {}) => {
  const referenciasRecepcion = [
    cabecera?.itemSalidaId || "",
    cabecera?.codigoSalida || "",
    cabecera?.codigoOp || "",
  ].filter(Boolean);
  const referenciasItem = [
    item?.itemSalidaId || "",
    item?.codigoSalida || "",
    item?.codigoOp || "",
  ].filter(Boolean);
  const hayReferenciaEspecificaRecepcion = Boolean(
    String(cabecera?.itemSalidaId || "").trim() || String(cabecera?.codigoSalida || "").trim()
  );
  const hayReferenciaEspecificaItem = Boolean(
    String(item?.itemSalidaId || "").trim() || String(item?.codigoSalida || "").trim()
  );
  const coincideTallerPrincipal =
    !String(cabecera?.nombreTaller || "").trim() ||
    String(item?.tallerPrincipal || "")
      .trim()
      .toUpperCase() === String(cabecera?.nombreTaller || "").trim().toUpperCase();

  if (!coincideTallerPrincipal) {
    return false;
  }

  if (hayReferenciaEspecificaRecepcion) {
    return (
      referenciasRecepcion
        .filter((referencia) => referencia !== cabecera?.codigoOp)
        .some((referencia) => referenciasItem.includes(referencia)) ||
      (!hayReferenciaEspecificaItem && item?.codigoOp === cabecera?.codigoOp)
    );
  }

  return referenciasRecepcion.some((referencia) => referenciasItem.includes(referencia));
};

const existeRecepcionFinalParaTercerizacion = (recepciones = [], cabecera = {}) => {
  const itemSalidaId = String(cabecera?.itemSalidaId || "").trim();
  const codigoSalida = String(cabecera?.codigoSalida || "").trim();
  const codigoOp = String(cabecera?.codigoOp || "").trim();
  const tallerPrincipal = String(cabecera?.nombreTaller || "")
    .trim()
    .toUpperCase();

  return recepciones.some((registro) => {
    const cabeceraRegistro = registro?.cabeceraRecepcion || {};
    if (cabeceraRegistro?.tipoRecepcion !== "final") {
      return false;
    }

    const itemRegistro = String(cabeceraRegistro?.itemSalidaId || "").trim();
    const codigoRegistro = String(cabeceraRegistro?.codigoSalida || "").trim();
    const opRegistro = String(cabeceraRegistro?.codigoOp || "").trim();
    const tallerRegistro = String(cabeceraRegistro?.nombreTaller || "")
      .trim()
      .toUpperCase();

    if (itemSalidaId && itemRegistro && itemRegistro === itemSalidaId) {
      return true;
    }

    if (codigoSalida && codigoRegistro && codigoRegistro === codigoSalida) {
      return true;
    }

    return (
      !itemSalidaId &&
      !codigoSalida &&
      codigoOp &&
      opRegistro === codigoOp &&
      (!tallerPrincipal || !tallerRegistro || tallerRegistro === tallerPrincipal)
    );
  });
};

const obtenerRecepcionesDisponiblesParaTercerizar = (historial = []) => {
  const recepciones = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);

  return recepciones.filter((registro) => {
    const cabecera = registro?.cabeceraRecepcion || {};
    if (
      !cabecera?.codigoOp ||
      !cabecera?.derivarProcesoExterno ||
      cabecera?.tipoRecepcion !== "parcial"
    ) {
      return false;
    }

    if (existeRecepcionFinalParaTercerizacion(recepciones, cabecera)) {
      return false;
    }

    const relacionados = historial.filter(
      (item) => !item?.cancelado && coincideTercerizacionConRecepcion(item, cabecera)
    );

    if (relacionados.length === 0) {
      return true;
    }

    const yaCaminoConTercero = relacionados.some(
      (item) =>
        Boolean(
          item?.fechaEnvioTercero ||
            item?.fechaRetornoTercero ||
            item?.aprobadoProduccion ||
            convertirNumero(item?.montoPagadoAcumulado) > 0
        )
    );

    return !yaCaminoConTercero;
  });
};

const obtenerRecepcionRelacionadaTercerizacion = (registro = {}) => {
  const recepciones = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);
  const itemSalidaId = String(registro?.itemSalidaId || "").trim();
  const codigoSalida = String(registro?.codigoSalida || "").trim();
  const codigoOp = String(registro?.codigoOp || "").trim();
  const tallerPrincipal = String(registro?.tallerPrincipal || "")
    .trim()
    .toUpperCase();

  return (
    recepciones.find((item) => {
      const cabecera = item?.cabeceraRecepcion || {};
      const itemRecepcion = String(cabecera?.itemSalidaId || "").trim();
      const codigoRecepcion = String(cabecera?.codigoSalida || "").trim();
      const opRecepcion = String(cabecera?.codigoOp || "").trim();
      const tallerRecepcion = String(cabecera?.nombreTaller || "")
        .trim()
        .toUpperCase();

      if (itemSalidaId && itemRecepcion && itemRecepcion === itemSalidaId) {
        return true;
      }

      if (codigoSalida && codigoRecepcion && codigoRecepcion === codigoSalida) {
        return true;
      }

      return (
        codigoOp &&
        opRecepcion === codigoOp &&
        (!tallerPrincipal || !tallerRecepcion || tallerRecepcion === tallerPrincipal)
      );
    }) || null
  );
};

const obtenerSalidaRelacionadaTercerizacion = (registro = {}) => {
  const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER);
  const itemSalidaId = String(registro?.itemSalidaId || "").trim();
  const codigoSalida = String(registro?.codigoSalida || "").trim();
  const codigoOp = String(registro?.codigoOp || "").trim();
  const tallerPrincipal = String(registro?.tallerPrincipal || "")
    .trim()
    .toUpperCase();

  return (
    salidas.find((item) => {
      const itemSalida = String(item?.id || "").trim();
      const codigoSalidaItem = String(item?.codigoSalida || "").trim();
      const opSalida = String(item?.codigoOp || "").trim();
      const tallerSalida = String(item?.nombreTaller || "")
        .trim()
        .toUpperCase();

      if (itemSalidaId && itemSalida && itemSalida === itemSalidaId) {
        return true;
      }

      if (codigoSalida && codigoSalidaItem && codigoSalidaItem === codigoSalida) {
        return true;
      }

      return (
        codigoOp &&
        opSalida === codigoOp &&
        (!tallerPrincipal || !tallerSalida || tallerSalida === tallerPrincipal)
      );
    }) || null
  );
};

const obtenerDetalleBaseTercerizacion = (registro = {}) => {
  const recepcion = obtenerRecepcionRelacionadaTercerizacion(registro);
  const detalleRecepcion = recepcion?.cabeceraRecepcion?.detalleRecepcion || [];

  if (Array.isArray(detalleRecepcion) && detalleRecepcion.length > 0) {
    return detalleRecepcion.map((fila, indice) => ({
      id: fila?.id || `det-rec-ter-${indice + 1}`,
      colorBase: fila?.colorBase || "",
      cantidades: TALLAS_DISPONIBLES.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: convertirNumero(fila?.recibido?.[talla]),
        }),
        {}
      ),
    }));
  }

  const salida = obtenerSalidaRelacionadaTercerizacion(registro);
  const detalleSalida = salida?.detalleColorTalla || [];

  return (Array.isArray(detalleSalida) ? detalleSalida : []).map((fila, indice) => ({
    id: fila?.id || `det-sal-ter-${indice + 1}`,
    colorBase: fila?.colorBase || "",
    cantidades: TALLAS_DISPONIBLES.reduce(
      (acumulado, talla) => ({
        ...acumulado,
        [talla]: convertirNumero(fila?.salidas?.[talla]),
      }),
      {}
    ),
  }));
};

const obtenerOpsDisponiblesParaTercerizacionManual = (
  ops = [],
  historial = [],
  recepciones = []
) =>
  (Array.isArray(ops) ? ops : []).filter((op) => {
    const codigoOp = String(
      op?.cabeceraCorte?.codigoCorte || op?.cabeceraCorte?.opOrigen || ""
    ).trim();

    if (!codigoOp) {
      return false;
    }

    const tieneTercerizacion = historial.some(
      (item) => !item?.cancelado && String(item?.codigoOp || "").trim() === codigoOp
    );

    if (tieneTercerizacion) {
      return false;
    }

    const tieneRecepcionRelacionada = recepciones.some((registro) => {
      const cabecera = registro?.cabeceraRecepcion || {};
      return String(cabecera?.codigoOp || "").trim() === codigoOp;
    });

    return !tieneRecepcionRelacionada;
  });

export function Tercerizaciones({ moduloOrigen = "produccion" }) {
  const catalogosProduccion = useMemo(leerCatalogosProduccion, []);
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [paginaOps, setPaginaOps] = useState(1);
  const [paginaRecepciones, setPaginaRecepciones] = useState(1);
  const [pestanaAlmacen, setPestanaAlmacen] = useState("disponibles");
  const [pestanaProduccion, setPestanaProduccion] = useState("historial");
  const [historialTercerizaciones, setHistorialTercerizaciones] = useState(() =>
    leerHistorialTercerizaciones()
  );
  const [registroActual, setRegistroActual] = useState(crearRegistroVacio);
  const [configTercerizacion, setConfigTercerizacion] = useState(null);
  const [costosTerceros, setCostosTerceros] = useState(() => leerCostosTerceros());
  const esModuloAlmacen = moduloOrigen === "almacen";
  const pestanaActiva = esModuloAlmacen ? pestanaAlmacen : pestanaProduccion;
  const envioATercero = Boolean(registroActual.fechaEnvioTercero);
  const retornoTercero = Boolean(registroActual.fechaRetornoTercero);
  const registroExistente = Boolean(registroActual.id);
  const puedeEnviarATercero = esModuloAlmacen && registroExistente && !envioATercero && !retornoTercero;
  const puedeRegistrarRetorno = esModuloAlmacen && registroExistente && envioATercero && !retornoTercero;
  const puedeCancelarTercerizacion = esModuloAlmacen && registroExistente && !retornoTercero;
  const opsConfirmadas = useMemo(obtenerOpsConfirmadas, []);
  const recepcionesDisponiblesParaTercerizar = useMemo(
    () => obtenerRecepcionesDisponiblesParaTercerizar(historialTercerizaciones),
    [historialTercerizaciones]
  );
  const opsDisponiblesManual = useMemo(
    () =>
      obtenerOpsDisponiblesParaTercerizacionManual(
        opsConfirmadas,
        historialTercerizaciones,
        leerListaGuardada(CLAVE_RECEPCIONES_TALLER)
      ),
    [historialTercerizaciones, opsConfirmadas]
  );

  const resolverCostoAutomaticoTercero = ({
    proceso = "",
    cantidadAgujas = "",
    nombreTaller = "",
  } = {}) => {
    const encontrado = obtenerCostoTerceroPorProceso({
      proceso,
      cantidadAgujas,
      nombreTaller,
      lista: costosTerceros,
    });

    return encontrado
      ? {
          valor: String(Number(encontrado.costoUnitario || 0)),
          detalle:
            encontrado.observacion ||
            (proceso === "MULTIAGUJA" && cantidadAgujas
              ? `${cantidadAgujas} agujas`
              : "Tarifa configurada"),
        }
      : {
          valor: "0",
          detalle: "Sin tarifa configurada",
        };
  };

  const tarifaAplicada = resolverCostoAutomaticoTercero({
    proceso: registroActual.proceso,
    cantidadAgujas: registroActual.cantidadAgujas,
    nombreTaller: registroActual.tallerTercero,
  });
  const detalleBaseTercerizacion = useMemo(
    () => obtenerDetalleBaseTercerizacion(registroActual),
    [
      registroActual.itemSalidaId,
      registroActual.codigoSalida,
      registroActual.codigoOp,
      registroActual.tallerPrincipal,
    ]
  );
  const coloresDisponiblesTercerizacion = useMemo(
    () =>
      Array.from(
        new Set(
          detalleBaseTercerizacion
            .map((fila) => fila?.colorBase || "")
            .filter(Boolean)
        )
      ),
    [detalleBaseTercerizacion]
  );
  const tallasDisponiblesTercerizacion = useMemo(
    () =>
      TALLAS_DISPONIBLES.filter((talla) =>
        detalleBaseTercerizacion.some(
          (fila) => convertirNumero(fila?.cantidades?.[talla]) > 0
        )
      ),
    [detalleBaseTercerizacion]
  );
  const descuentosPrendaTerceroActivos = useMemo(
    () => normalizarDescuentosTercero(registroActual?.descuentosPrendaTercero || []),
    [registroActual?.descuentosPrendaTercero]
  );
  const totalBrutoTerceroActual = calcularTotalBrutoTercerizacion(registroActual);
  const totalDescuentoTerceroActual = calcularMontoDescuentoTercero(
    descuentosPrendaTerceroActivos
  );
  const totalNetoTerceroActual = Math.max(
    0,
    totalBrutoTerceroActual - totalDescuentoTerceroActual
  );
  const textoTarifaAplicada = `${tarifaAplicada.detalle} | ${formatearMontoSoles(
    tarifaAplicada.valor || registroActual.costoUnitario || 0,
  )}`;

  useEffect(() => {
    const sincronizarHistorial = async () => {
      const historialNormalizado = leerHistorialTercerizaciones();
      const reparacion = repararHistorialTercerizacionesDesdeSalidas(historialNormalizado);
      const historialFinal = normalizarHistorialTercerizaciones(reparacion.lista);

      setHistorialTercerizaciones(historialFinal);
      guardarHistorialTercerizaciones(historialFinal);

      if (reparacion.huboCambios) {
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setHistorialTercerizaciones(leerHistorialTercerizaciones());
      }
    };

    sincronizarHistorial();
  }, []);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const [data] = await Promise.all([
          leerCorrelativoSistemaConfiguracion("TERCERIZACION"),
          listarCostosTercerosConfiguracion(),
        ]);
        if (!activo) return;
        setConfigTercerizacion(data);
        setCostosTerceros(leerCostosTerceros());
      } catch (error) {
        console.error("No se pudo cargar el correlativo de tercerizacion:", error.message);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  const opsFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) {
      return opsDisponiblesManual;
    }

    return opsDisponiblesManual.filter((op) =>
      [
        op?.cabeceraCorte?.codigoCorte,
        op?.cabeceraCorte?.modeloBase,
        op?.cabeceraCorte?.pedidoOrigen,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, opsDisponiblesManual]);

  const tercerizacionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) {
      return historialTercerizaciones;
    }

    return historialTercerizaciones.filter((item) =>
      [
        item?.codigoTercerizacion,
        item?.codigoOp,
        item?.modelo,
        item?.proceso,
        item?.tallerTercero,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, historialTercerizaciones]);
  const tercerizacionesActivasFiltradas = useMemo(
    () =>
      tercerizacionesFiltradas.filter(
        (item) => !item?.cancelado && estaTercerizacionEnHistorial(item)
      ),
    [tercerizacionesFiltradas]
  );
  const totalPaginasHistorial = Math.max(
    1,
    Math.ceil(tercerizacionesActivasFiltradas.length / FILAS_POR_PAGINA)
  );
  const totalPaginasOps = Math.max(1, Math.ceil(opsFiltradas.length / FILAS_POR_PAGINA));
  const totalPaginasRecepciones = Math.max(
    1,
    Math.ceil(recepcionesDisponiblesParaTercerizar.length / FILAS_POR_PAGINA)
  );
  const historialPagina = useMemo(() => {
    const inicio = (paginaHistorial - 1) * FILAS_POR_PAGINA;
    return tercerizacionesActivasFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [tercerizacionesActivasFiltradas, paginaHistorial]);
  const opsPagina = useMemo(() => {
    const inicio = (paginaOps - 1) * FILAS_POR_PAGINA;
    return opsFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [opsFiltradas, paginaOps]);
  const recepcionesPagina = useMemo(() => {
    const inicio = (paginaRecepciones - 1) * FILAS_POR_PAGINA;
    return recepcionesDisponiblesParaTercerizar.slice(
      inicio,
      inicio + FILAS_POR_PAGINA
    );
  }, [recepcionesDisponiblesParaTercerizar, paginaRecepciones]);

  useEffect(() => {
    if (paginaHistorial > totalPaginasHistorial) {
      setPaginaHistorial(totalPaginasHistorial);
    }
  }, [paginaHistorial, totalPaginasHistorial]);

  useEffect(() => {
    if (paginaOps > totalPaginasOps) {
      setPaginaOps(totalPaginasOps);
    }
  }, [paginaOps, totalPaginasOps]);

  useEffect(() => {
    if (paginaRecepciones > totalPaginasRecepciones) {
      setPaginaRecepciones(totalPaginasRecepciones);
    }
  }, [paginaRecepciones, totalPaginasRecepciones]);

  const manejarSeleccionOp = (op) => {
    const base = construirRegistroDesdeOp(
      op,
      historialTercerizaciones,
      configTercerizacion?.prefijo || "T"
    );
    const costoAutomatico = resolverCostoAutomaticoTercero({
      proceso: base.proceso,
      cantidadAgujas: base.cantidadAgujas,
      nombreTaller: base.tallerTercero,
    });
    setRegistroActual({
      ...base,
      descuentosPrendaTercero: normalizarDescuentosTercero(
        base?.descuentosPrendaTercero || []
      ),
      costoUnitario: costoAutomatico.valor,
      total: Math.max(
        0,
        convertirNumero(base.cantidad) * convertirNumero(costoAutomatico.valor) -
          calcularMontoDescuentoTercero(base?.descuentosPrendaTercero || [])
      ),
    });
    mostrarNotificacionCarga("Tercerizacion cargada correctamente.");
  };

  const manejarSeleccionRegistro = (registro) => {
    const base = {
      ...crearRegistroVacio(),
      ...registro,
    };
    const costoAutomatico = resolverCostoAutomaticoTercero({
      proceso: base.proceso,
      cantidadAgujas: base.cantidadAgujas,
      nombreTaller: base.tallerTercero,
    });
    setRegistroActual({
      ...base,
      descuentosPrendaTercero: normalizarDescuentosTercero(
        base?.descuentosPrendaTercero || []
      ),
      costoUnitario:
        convertirNumero(base.costoUnitario) > 0 ? base.costoUnitario : costoAutomatico.valor,
      total:
        Math.max(
          0,
          convertirNumero(base.cantidad) *
            convertirNumero(
              convertirNumero(base.costoUnitario) > 0
                ? base.costoUnitario
                : costoAutomatico.valor,
            ) -
            calcularMontoDescuentoTercero(base?.descuentosPrendaTercero || [])
        ),
    });
    mostrarNotificacionCarga("Registro de tercerizacion cargado correctamente.");
  };

  const manejarSeleccionRecepcionAlmacen = (recepcion) => {
    const base = construirRegistroDesdeRecepcion(
      recepcion,
      historialTercerizaciones,
      configTercerizacion?.prefijo || "T"
    );
    const costoAutomatico = resolverCostoAutomaticoTercero({
      proceso: base.proceso,
      cantidadAgujas: base.cantidadAgujas,
      nombreTaller: base.tallerTercero,
    });
    setRegistroActual({
      ...base,
      descuentosPrendaTercero: normalizarDescuentosTercero(
        base?.descuentosPrendaTercero || []
      ),
      costoUnitario: costoAutomatico.valor,
      total: Math.max(
        0,
        convertirNumero(base.cantidad) * convertirNumero(costoAutomatico.valor) -
          calcularMontoDescuentoTercero(base?.descuentosPrendaTercero || [])
      ),
    });
    mostrarNotificacionCarga("Recepcion cargada para crear tercerizacion.");
  };

  const manejarCambio = (evento) => {
    const { name, value, type, checked } = evento.target;
    setRegistroActual((anterior) => {
      const valorNormalizado =
        name === "cantidadAgujas"
          ? normalizarNumeroEntrada(value)
          : name === "costoUnitario" || name === "cantidad"
            ? normalizarNumeroEntrada(value, { permitirDecimales: true })
            : value;

      const siguiente = {
        ...anterior,
        [name]: type === "checkbox" ? checked : valorNormalizado,
      };

      if (name === "proceso" && valorNormalizado !== "MULTIAGUJA") {
        siguiente.cantidadAgujas = "";
      }

      if (name === "proceso" || name === "tallerTercero" || name === "cantidadAgujas") {
        const costoConfigurado = resolverCostoAutomaticoTercero({
          proceso: name === "proceso" ? valorNormalizado : siguiente.proceso,
          cantidadAgujas:
            name === "cantidadAgujas" ? valorNormalizado : siguiente.cantidadAgujas,
          nombreTaller:
            name === "tallerTercero" ? valorNormalizado : siguiente.tallerTercero,
        });

        siguiente.costoUnitario = costoConfigurado.valor;
      }

      siguiente.total =
        Math.max(
          0,
          convertirNumero(siguiente.cantidad) * convertirNumero(siguiente.costoUnitario) -
            calcularMontoDescuentoTercero(siguiente.descuentosPrendaTercero || [])
        );

      return siguiente;
    });
  };

  const manejarAgregarDescuentoTercero = () => {
    setRegistroActual((anterior) => ({
      ...anterior,
      descuentosPrendaTercero: [
        ...(normalizarDescuentosTercero(anterior?.descuentosPrendaTercero || [])),
        {
          ...crearDescuentoTerceroVacio(),
          precioUnitario:
            String(
              convertirNumero(anterior?.costoUnitario) > 0
                ? anterior.costoUnitario
                : tarifaAplicada.valor || ""
            ) || "",
        },
      ],
      total: Math.max(
        0,
        calcularTotalBrutoTercerizacion(anterior) -
          calcularMontoDescuentoTercero([
            ...(normalizarDescuentosTercero(anterior?.descuentosPrendaTercero || [])),
            {
              ...crearDescuentoTerceroVacio(),
              precioUnitario:
                String(
                  convertirNumero(anterior?.costoUnitario) > 0
                    ? anterior.costoUnitario
                    : tarifaAplicada.valor || ""
                ) || "",
            },
          ])
      ),
    }));
  };

  const manejarCambioDescuentoTercero = (idDescuento, campo, valor) => {
    setRegistroActual((anterior) => {
      const descuentosActualizados = normalizarDescuentosTercero(
        anterior?.descuentosPrendaTercero || []
      ).map((descuento) => {
        if (descuento.id !== idDescuento) {
          return descuento;
        }

        const valorNormalizado =
          campo === "cantidad" || campo === "precioUnitario"
            ? normalizarNumeroEntrada(valor, { permitirDecimales: true })
            : valor;

        return {
          ...descuento,
          [campo]: valorNormalizado,
        };
      });

      return {
        ...anterior,
        descuentosPrendaTercero: descuentosActualizados,
        total: Math.max(
          0,
          calcularTotalBrutoTercerizacion(anterior) -
            calcularMontoDescuentoTercero(descuentosActualizados)
        ),
      };
    });
  };

  const manejarQuitarDescuentoTercero = (idDescuento) => {
    setRegistroActual((anterior) => {
      const descuentosActualizados = normalizarDescuentosTercero(
        anterior?.descuentosPrendaTercero || []
      ).filter((descuento) => descuento.id !== idDescuento);

      return {
        ...anterior,
        descuentosPrendaTercero: descuentosActualizados,
        total: Math.max(
          0,
          calcularTotalBrutoTercerizacion(anterior) -
            calcularMontoDescuentoTercero(descuentosActualizados)
        ),
      };
    });
  };

  const guardarRegistro = async () => {
    if (
      !registroActual.codigoOp ||
      !registroActual.codigoTercerizacion ||
      !registroActual.proceso ||
      !registroActual.tallerTercero ||
      convertirNumero(registroActual.cantidad) <= 0
    ) {
      await mostrarAlertaSistema(
        "Completa codigo de tercerizacion, OP, proceso, taller tercero y cantidad antes de guardar."
      );
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando registro...",
      mensajeExito: "Registro de tercerizacion guardado correctamente.",
      mensajeError: "No se pudo guardar la tercerizacion.",
      accion: async () => {
        const nuevoRegistro = {
          ...registroActual,
          descuentosPrendaTercero: descuentosPrendaTerceroActivos,
          id:
            registroActual.id ||
            buscarTercerizacionExistente(historialTercerizaciones, {
              codigoOp: registroActual.codigoOp,
              itemSalidaId: registroActual.itemSalidaId,
              codigoSalida: registroActual.codigoSalida,
              tallerPrincipal: registroActual.tallerPrincipal,
              proceso: registroActual.proceso,
            })?.id ||
            `ter-${Date.now()}`,
          subtotalServicio: totalBrutoTerceroActual,
          totalDescuento: totalDescuentoTerceroActual,
          total: totalNetoTerceroActual,
        };
        nuevoRegistro.estado = resolverEstadoRegistroTercerizacion(nuevoRegistro);

        const costoExistente = obtenerCostoTerceroPorProceso({
          proceso: nuevoRegistro.proceso || "",
          cantidadAgujas: nuevoRegistro.cantidadAgujas || "",
          nombreTaller: nuevoRegistro.tallerTercero || "",
          lista: costosTerceros,
        });

        let costoGuardadoAutomatico = false;
        if (
          !costoExistente &&
          convertirNumero(nuevoRegistro.costoUnitario) > 0 &&
          nuevoRegistro.proceso
        ) {
          try {
            await guardarCostoTerceroConfiguracion({
              proceso: nuevoRegistro.proceso || "MULTIAGUJA",
              cantidadAgujas: nuevoRegistro.cantidadAgujas || "",
              nombreTaller: nuevoRegistro.tallerTercero || "",
              costoUnitario: convertirNumero(nuevoRegistro.costoUnitario),
              moneda: "PEN",
              observacion: "Registrado automaticamente desde tercerizaciones.",
              estado: "ACTIVO",
            });
            setCostosTerceros(leerCostosTerceros());
            costoGuardadoAutomatico = true;
          } catch (error) {
            console.error(
              "No se pudo guardar automaticamente el costo del tercero:",
              error.message,
            );
          }
        }

        const historialActualizado = normalizarHistorialTercerizaciones([
          nuevoRegistro,
          ...historialTercerizaciones.filter((item) => item?.id !== nuevoRegistro.id),
        ]);

        setHistorialTercerizaciones(historialActualizado);
        guardarHistorialTercerizaciones(historialActualizado);
        setRegistroActual(crearRegistroVacio());
        await registrarUsoCorrelativoSistemaConfiguracion({
          clave: "TERCERIZACION",
          fecha: nuevoRegistro.fechaSolicitud || obtenerFechaActual(),
          correlativo: Number((nuevoRegistro.codigoTercerizacion.match(/(\d+)$/)?.[1] || "0")),
        });
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setHistorialTercerizaciones(leerHistorialTercerizaciones());

        if (costoGuardadoAutomatico) {
          await mostrarNotificacionCarga(
            "Tercerizacion registrada y costo guardado en Costos y Finanzas."
          );
        }
      },
    });
  };

  const manejarControlAlmacen = async (accion) => {
    if (!registroActual.codigoOp) {
      await mostrarAlertaSistema("Selecciona primero una tercerizacion.");
      return;
    }

    const mensajesPorAccion = {
      recibir: "Registrando recepcion en almacen...",
      enviar: "Registrando envio a tercero...",
      retornar: "Registrando retorno de tercero...",
    };

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: mensajesPorAccion[accion] || "Actualizando tercerizacion...",
      mensajeExito: "Movimiento de tercerizacion actualizado.",
      mensajeError: "No se pudo actualizar el movimiento de tercerizacion.",
      accion: async () => {
        const registroBase = {
          ...registroActual,
          descuentosPrendaTercero: descuentosPrendaTerceroActivos,
          id: registroActual.id || `ter-${Date.now()}`,
          codigoTercerizacion:
            registroActual.codigoTercerizacion ||
            generarCodigoTercerizacion(
              registroActual.codigoOp,
              historialTercerizaciones,
              "",
              configTercerizacion?.prefijo || "T"
            ),
        };
        const registroActualizado = {
          ...registroBase,
          subtotalServicio: totalBrutoTerceroActual,
          totalDescuento: totalDescuentoTerceroActual,
          total: totalNetoTerceroActual,
          fechaRecepcionAlmacen:
            accion === "recibir" || accion === "enviar"
              ? registroBase.fechaRecepcionAlmacen || obtenerFechaActual()
              : registroBase.fechaRecepcionAlmacen,
          fechaEnvioTercero:
            accion === "enviar"
              ? registroBase.fechaEnvioTercero || obtenerFechaActual()
              : registroBase.fechaEnvioTercero,
          fechaRetornoTercero:
            accion === "retornar"
              ? registroBase.fechaRetornoTercero || obtenerFechaActual()
              : registroBase.fechaRetornoTercero,
        };
        registroActualizado.estado = resolverEstadoRegistroTercerizacion(registroActualizado);

        const historialActualizado = normalizarHistorialTercerizaciones([
          registroActualizado,
          ...historialTercerizaciones.filter((item) => item.id !== registroActualizado.id),
        ]);

        setHistorialTercerizaciones(historialActualizado);
        setRegistroActual(registroActualizado);
        guardarHistorialTercerizaciones(historialActualizado);
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setHistorialTercerizaciones(leerHistorialTercerizaciones());
      },
    });
  };

  const aprobarProduccion = async () => {
    if (!registroActual.id) {
      await mostrarAlertaSistema("Selecciona primero una tercerizacion.");
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Aprobando servicio tercerizado...",
      mensajeExito: "Produccion aprobo el servicio tercerizado.",
      mensajeError: "No se pudo aprobar el servicio tercerizado.",
      accion: async () => {
        const registroActualizado = {
          ...registroActual,
          descuentosPrendaTercero: descuentosPrendaTerceroActivos,
          subtotalServicio: totalBrutoTerceroActual,
          totalDescuento: totalDescuentoTerceroActual,
          total: totalNetoTerceroActual,
          aprobadoProduccion: true,
        };
        registroActualizado.estado = resolverEstadoRegistroTercerizacion(registroActualizado);

        const historialActualizado = normalizarHistorialTercerizaciones(
          historialTercerizaciones.map((item) =>
            item.id === registroActualizado.id ? registroActualizado : item
          )
        );

        setHistorialTercerizaciones(historialActualizado);
        setRegistroActual(registroActualizado);
        guardarHistorialTercerizaciones(historialActualizado);
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setHistorialTercerizaciones(leerHistorialTercerizaciones());
      },
    });
  };

  const cancelarTercerizacion = async () => {
    if (!registroActual.id) {
      await mostrarAlertaSistema("Selecciona primero una tercerizacion.");
      return;
    }

    const confirmar = window.confirm(
      `Seguro que deseas cancelar esta tercerizacion?\n\nOP: ${registroActual.codigoOp || "-"}\nTaller tercero: ${registroActual.tallerTercero || "-"}\n\nLa orden volvera a quedar disponible para enviarse a otro tercero.`
    );

    if (!confirmar) {
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Cancelando tercerizacion...",
      mensajeExito: "Tercerizacion cancelada correctamente.",
      mensajeError: "No se pudo cancelar la tercerizacion.",
      accion: async () => {
        const historialActualizado = normalizarHistorialTercerizaciones(
          historialTercerizaciones.map((item) =>
            item.id === registroActual.id
              ? {
                  ...item,
                  cancelado: true,
                  fechaCancelacion: item?.fechaCancelacion || obtenerFechaActual(),
                  fechaRecepcionAlmacen: "",
                  fechaEnvioTercero: "",
                  fechaRetornoTercero: "",
                  estado: "cancelado",
                }
              : item
          )
        );

        setHistorialTercerizaciones(historialActualizado);
        guardarHistorialTercerizaciones(historialActualizado);
        setRegistroActual(crearRegistroVacio());
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setHistorialTercerizaciones(leerHistorialTercerizaciones());
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
          <h1>{esModuloAlmacen ? "Control de tercerizacion" : "Envios a terceros"}</h1>
          <p>
            {esModuloAlmacen
              ? "Aqui Almacen recibe, cuenta, despacha y retorna cada servicio tercerizado usando un codigo hijo amarrado a la OP principal."
              : "Aqui Produccion revisa los servicios a terceros. Muchos ya nacen desde salida de taller y aqui solo se completan costo, observaciones y aprobacion de pago."}
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Servicios registrados</span>
          <strong>{historialTercerizaciones.length}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to={esModuloAlmacen ? "/almacen/producto-terminado" : "/produccion"} className="boton_volver">
          {esModuloAlmacen ? "Volver a Almacen" : "Volver a Produccion"}
        </Link>

        <div className="navegacion_superior">
          {!esModuloAlmacen ? (
            <Link to="/produccion/recepciones" className="btn btn_secundario btn_enlace">
              Atras
            </Link>
          ) : (
            <Link to="/almacen/recepcion-taller" className="btn btn_secundario btn_enlace">
              Atras
            </Link>
          )}
        </div>
      </div>

      <main className="contenido">
        <div className="pestanas">
          <button
            type="button"
            className={`pestana ${pestanaActiva === "disponibles" ? "pestana_activa" : ""}`}
            onClick={() =>
              esModuloAlmacen
                ? setPestanaAlmacen("disponibles")
                : setPestanaProduccion("disponibles")
            }
          >
            {esModuloAlmacen ? "Por enviar a tercero" : "OP disponibles para tercerizar"}
          </button>
          <button
            type="button"
            className={`pestana ${pestanaActiva === "historial" ? "pestana_activa" : ""}`}
            onClick={() =>
              esModuloAlmacen
                ? setPestanaAlmacen("historial")
                : setPestanaProduccion("historial")
            }
          >
            Historial de tercerizaciones
          </button>
        </div>

        {pestanaActiva === "historial" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Historial de tercerizaciones</h2>
                <p>
                  Aqui se ve el mismo codigo hijo durante todo el flujo hasta su pago final.
                </p>
              </div>
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>OP</th>
                    <th>Proceso</th>
                    <th>Taller tercero</th>
                    <th>Cantidad</th>
                    {!esModuloAlmacen ? <th>Total</th> : null}
                    <th>Estado</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPagina.length === 0 ? (
                    <tr>
                      <td colSpan={esModuloAlmacen ? 7 : 8} className="fila_vacia">
                        Todavia no hay tercerizaciones registradas.
                      </td>
                    </tr>
                  ) : (
                    historialPagina.map((item) => {
                      const estado = obtenerEstadoTercerizacion(item);

                      return (
                        <tr key={item.id}>
                          <td>{item.codigoTercerizacion || "-"}</td>
                          <td>{item.codigoOp || "-"}</td>
                          <td>{item.proceso || "-"}</td>
                          <td>{item.tallerTercero || "-"}</td>
                          <td>{item.cantidad || 0}</td>
                          {!esModuloAlmacen ? (
                            <td>{formatearMontoSoles(item.total || 0)}</td>
                          ) : null}
                          <td>
                            <span className={`chip_estado ${estado.clase}`}>{estado.texto}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn_principal btn_tabla"
                              onClick={() => manejarSeleccionRegistro(item)}
                            >
                              Cargar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {tercerizacionesActivasFiltradas.length > FILAS_POR_PAGINA ? (
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
        ) : null}

        {!esModuloAlmacen && pestanaActiva === "disponibles" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>OP disponibles para tercerizar</h2>
                <p>
                  Si necesitas crear una tercerizacion manual todavia puedes hacerlo aqui, aunque ahora normalmente nace desde salida de taller.
                </p>
              </div>
            </div>

            <div className="buscador">
              <input
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por OP, pedido o modelo"
              />
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>OP</th>
                    <th>Pedido</th>
                    <th>Modelo</th>
                    <th>Fecha</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {opsPagina.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="fila_vacia">
                        No hay OP confirmadas para ese filtro.
                      </td>
                    </tr>
                  ) : (
                    opsPagina.map((op) => (
                      <tr key={op?.cabeceraCorte?.codigoCorte || op?.cabeceraCorte?.pedidoOrigen}>
                        <td>{op?.cabeceraCorte?.codigoCorte || "-"}</td>
                        <td>{op?.cabeceraCorte?.pedidoOrigen || "-"}</td>
                        <td>{op?.cabeceraCorte?.modeloBase || "-"}</td>
                        <td>{op?.cabeceraCorte?.fechaCorte || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn_principal btn_tabla"
                            onClick={() => manejarSeleccionOp(op)}
                          >
                            Cargar
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {opsFiltradas.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaOps((valor) => Math.max(1, valor - 1))}
                disabled={paginaOps === 1}
              >
                Anterior
              </button>
              <span>
                Pagina {paginaOps} de {totalPaginasOps}
              </span>
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaOps((valor) => Math.min(totalPaginasOps, valor + 1))}
                disabled={paginaOps >= totalPaginasOps}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>
        ) : pestanaActiva === "disponibles" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Recepciones disponibles para tercerizar</h2>
                <p>
                  Aqui aparecen las recepciones que Almacen ya derivo a tercero desde recepcion de taller y todavia faltan salir al taller tercero.
                </p>
              </div>
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>OP</th>
                    <th>Taller principal</th>
                    <th>Modelo</th>
                    <th>Fecha recepcion</th>
                    <th>Cantidad</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {recepcionesPagina.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="fila_vacia">
                        No hay recepciones nuevas disponibles para abrir tercerizacion.
                      </td>
                    </tr>
                  ) : (
                    recepcionesPagina.map((registro) => {
                      const cabecera = registro?.cabeceraRecepcion || {};
                      return (
                        <tr key={registro?.id || `${cabecera?.itemSalidaId}-${cabecera?.codigoOp}`}>
                          <td>{cabecera?.codigoOp || "-"}</td>
                          <td>{cabecera?.nombreTaller || "-"}</td>
                          <td>{cabecera?.modelo || "-"}</td>
                          <td>{cabecera?.fechaRecepcion || "-"}</td>
                          <td>{cabecera?.cantidadRecibida || cabecera?.cantidadTotal || "-"}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn_principal btn_tabla"
                              onClick={() => manejarSeleccionRecepcionAlmacen(registro)}
                            >
                              Cargar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {recepcionesDisponiblesParaTercerizar.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaRecepciones((valor) => Math.max(1, valor - 1))
                }
                disabled={paginaRecepciones === 1}
              >
                Anterior
              </button>
              <span>
                Pagina {paginaRecepciones} de {totalPaginasRecepciones}
              </span>
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaRecepciones((valor) =>
                    Math.min(totalPaginasRecepciones, valor + 1)
                  )
                }
                disabled={paginaRecepciones >= totalPaginasRecepciones}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>
        ) : null}

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>
                {esModuloAlmacen
                  ? "Movimiento de tercerizacion"
                  : "Cabecera del envio a terceros"}
              </h2>
              <p>
                Este codigo hijo sigue siendo el mismo en Produccion, Almacen y el
                taller tercero.
              </p>
            </div>
          </div>

          <div className="grid grid-2">
            <Campo className="campo_requerido">
              <label>Codigo tercerizacion</label>
              <input
                type="text"
                name="codigoTercerizacion"
                value={registroActual.codigoTercerizacion}
                readOnly
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Orden de produccion principal</label>
              <input type="text" name="codigoOp" value={registroActual.codigoOp} readOnly />
            </Campo>

            <Campo>
              <label>Modelo principal</label>
              <input type="text" name="modelo" value={registroActual.modelo} readOnly />
            </Campo>

            <Campo>
              <label>Taller principal</label>
              <input type="text" name="tallerPrincipal" value={registroActual.tallerPrincipal} readOnly />
            </Campo>

            <Campo className="campo_requerido">
              <label>Fecha solicitud</label>
              <input
                type="date"
                name="fechaSolicitud"
                value={registroActual.fechaSolicitud}
                onChange={manejarCambio}
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Proceso tercerizado</label>
              <select name="proceso" value={registroActual.proceso} onChange={manejarCambio}>
                {PROCESOS_TERCEROS.map((proceso) => (
                  <option key={proceso} value={proceso}>
                    {proceso}
                  </option>
                ))}
              </select>
            </Campo>

            {registroActual.proceso === "MULTIAGUJA" ? (
              <Campo>
                <label>Cantidad de agujas</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  name="cantidadAgujas"
                  value={registroActual.cantidadAgujas}
                  onChange={manejarCambio}
                  placeholder=""
                />
              </Campo>
            ) : null}

            <Campo className="campo_requerido">
              <label>Taller tercero</label>
              <select
                name="tallerTercero"
                value={registroActual.tallerTercero}
                onChange={manejarCambio}
              >
                <option value="">Selecciona taller</option>
                {(catalogosProduccion.modelosNombreTaller || []).map((taller) => (
                  <option key={taller} value={taller}>
                    {taller}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo className="campo_requerido">
              <label>Cantidad</label>
              <input
                type="number"
                name="cantidad"
                value={registroActual.cantidad}
                onChange={manejarCambio}
                placeholder=""
              />
            </Campo>

            <Campo>
              <label>Origen del movimiento</label>
              <select name="origen" value={registroActual.origen} onChange={manejarCambio}>
                <option value="PRODUCCION DIRECTA">PRODUCCION DIRECTA</option>
                <option value="DESDE RECEPCION ALMACEN">DESDE RECEPCION ALMACEN</option>
              </select>
            </Campo>

            {!esModuloAlmacen ? (
              <>
                <Campo>
                  <label>Costo unitario (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="costoUnitario"
                    value={registroActual.costoUnitario}
                    onChange={manejarCambio}
                    placeholder=""
                  />
                </Campo>

                <Campo>
                  <label>Tarifa aplicada</label>
                  <input
                    type="text"
                    value={textoTarifaAplicada}
                    readOnly
                  />
                </Campo>

                <Campo>
                  <label>Total del servicio</label>
                  <input type="text" value={formatearMontoSoles(registroActual.total)} readOnly />
                </Campo>
              </>
            ) : null}

            {esModuloAlmacen ? (
              <>
                <Campo>
                  <label>Recepcion en almacen</label>
                  <input type="date" value={registroActual.fechaRecepcionAlmacen} readOnly />
                </Campo>

                <Campo>
                  <label>Envio al tercero</label>
                  <input type="date" value={registroActual.fechaEnvioTercero} readOnly />
                </Campo>

                <Campo>
                  <label>Retorno del tercero</label>
                  <input type="date" value={registroActual.fechaRetornoTercero} readOnly />
                </Campo>
              </>
            ) : null}

            <Campo className="campo-completo">
              <label>{esModuloAlmacen ? "Observacion de almacen" : "Observacion de produccion"}</label>
              <textarea
                name={esModuloAlmacen ? "observacionAlmacen" : "observacionProduccion"}
                value={
                  esModuloAlmacen
                    ? registroActual.observacionAlmacen
                    : registroActual.observacionProduccion
                }
                onChange={manejarCambio}
                placeholder=""
              />
            </Campo>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Descuento por prenda al tercero</h2>
              <p>
                Aqui {esModuloAlmacen ? "Almacen" : "Produccion"} puede detallar color, talla, cantidad y motivo cuando el tercero malogra prendas y ese servicio ya no debe pagarse completo.
              </p>
            </div>
          </div>

          {!registroActual.codigoOp ? (
            <p className="texto_suave">
              Carga primero una tercerizacion para registrar descuentos detallados.
            </p>
          ) : (
            <>
              <div className="grid_resumen_descuento">
                <Campo>
                  <label>Total bruto del servicio</label>
                  <input type="text" value={formatearMontoSoles(totalBrutoTerceroActual)} readOnly />
                </Campo>
                <Campo>
                  <label>Total descuento aplicado</label>
                  <input type="text" value={formatearMontoSoles(totalDescuentoTerceroActual)} readOnly />
                </Campo>
                <Campo>
                  <label>Total neto a pagar</label>
                  <input type="text" value={formatearMontoSoles(totalNetoTerceroActual)} readOnly />
                </Campo>
              </div>

              <div className="acciones acciones_secundarias">
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={manejarAgregarDescuentoTercero}
                >
                  Agregar descuento por prenda
                </button>
              </div>

              {descuentosPrendaTerceroActivos.length === 0 ? (
                <p className="texto_suave">
                  Todavia no hay descuentos detallados para este servicio.
                </p>
              ) : (
                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Color</th>
                        <th>Talla</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Total</th>
                        <th>Motivo</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descuentosPrendaTerceroActivos.map((descuento) => {
                        const totalFila =
                          convertirNumero(descuento?.cantidad) *
                          convertirNumero(descuento?.precioUnitario);

                        return (
                          <tr key={descuento.id}>
                            <td>
                              <select
                                value={descuento.colorBase}
                                onChange={(evento) =>
                                  manejarCambioDescuentoTercero(
                                    descuento.id,
                                    "colorBase",
                                    evento.target.value
                                  )
                                }
                              >
                                <option value="">Sin color</option>
                                {coloresDisponiblesTercerizacion.map((color) => (
                                  <option key={`desc-ter-color-${color}`} value={color}>
                                    {color}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                value={descuento.talla}
                                onChange={(evento) =>
                                  manejarCambioDescuentoTercero(
                                    descuento.id,
                                    "talla",
                                    evento.target.value
                                  )
                                }
                              >
                                <option value="">Talla</option>
                                {tallasDisponiblesTercerizacion.map((talla) => (
                                  <option key={`desc-ter-talla-${talla}`} value={talla}>
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
                                  manejarCambioDescuentoTercero(
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
                                  manejarCambioDescuentoTercero(
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
                                value={formatearMontoSoles(totalFila)}
                                readOnly
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={descuento.motivo}
                                onChange={(evento) =>
                                  manejarCambioDescuentoTercero(
                                    descuento.id,
                                    "motivo",
                                    evento.target.value.toUpperCase()
                                  )
                                }
                                placeholder="FALLA DE SERVICIO"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn_secundario btn_tabla"
                                onClick={() => manejarQuitarDescuentoTercero(descuento.id)}
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
            </>
          )}
        </section>

        <section className="tarjeta">
          <div className="acciones">
            {!esModuloAlmacen ? (
              <>
                <button type="button" className="btn btn_principal" onClick={guardarRegistro}>
                  {registroExistente ? "Actualizar registro" : "Guardar registro"}
                </button>
                {registroActual.id && !registroActual.aprobadoProduccion ? (
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={aprobarProduccion}
                  >
                    Aprobar pago tercero
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={registroActual.codigoOp ? "btn btn_principal" : "btn btn_secundario"}
                  onClick={guardarRegistro}
                >
                  {registroExistente ? "Actualizar registro" : "Guardar registro"}
                </button>
                {puedeEnviarATercero ? (
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={() => manejarControlAlmacen("enviar")}
                  >
                    Enviar a tercero
                  </button>
                ) : null}
                {puedeRegistrarRetorno ? (
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={() => manejarControlAlmacen("retornar")}
                  >
                    Retorno de tercero
                  </button>
                ) : null}
                {puedeCancelarTercerizacion ? (
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={cancelarTercerizacion}
                  >
                    Cancelar tercerizacion
                  </button>
                ) : null}
              </>
            )}
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
  .fila_vacia {
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

  .fila_superior,
  .navegacion_superior,
  .tarjeta__encabezado,
  .acciones {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .grid_resumen_descuento {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .campo-completo {
    grid-column: 1 / -1;
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

  .campo_requerido label::after {
    content: " *";
    color: ${({ theme }) => theme.bg5};
    font-weight: 700;
  }

  .buscador input,
  table input,
  table select {
    width: 100%;
  }

  table input,
  table select {
    border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  table input[readonly] {
    background-color: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
  }

  .buscador input {
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

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 860px;
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
  }

  .fila_vacia {
    text-align: center;
    padding: 20px;
  }

  .texto_suave {
    color: ${({ theme }) => theme.colorSubtitle};
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

  .btn {
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
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
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 860px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }

    .fila_superior,
    .navegacion_superior,
    .tarjeta__encabezado,
    .acciones {
      flex-direction: column;
      align-items: stretch;
    }

    .btn,
    .boton_volver,
    .btn_enlace {
      width: 100%;
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

  textarea {
    min-height: 90px;
    resize: vertical;
  }

  input[type="date"]::-webkit-calendar-picker-indicator {
    cursor: pointer;
    filter: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "none" : "invert(1) brightness(1.15)"};
    opacity: 1;
  }
`;
