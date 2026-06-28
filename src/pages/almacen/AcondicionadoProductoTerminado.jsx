import { useEffect } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, UserAuth } from "../../index";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  eliminarIngresosProductosTerminadosPorRecepciones,
  registrarIngresoProductosTerminados,
  reconstruirStockProductosTerminadosDesdeLotes,
} from "../../utils/productosTerminados";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import {

  sincronizarTallerStockDesdeLocalASupabase,
  sincronizarTallerStockDesdeSupabase,
} from "../../supabase/flujoTallerStockCore";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";
import { leerPerfilUsuario } from "../../utils/perfilUsuario";
import { obtenerNombreResponsableActivo } from "../../utils/responsableActivo";
import { leerEtiquetasCalidadSistema } from "../../utils/configuracionEstadosCalidad";

const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_ACONDICIONADO_PT = "cynara_acondicionado_producto_terminado";
const CLAVE_REMATES_PT = "cynara_remates_producto_terminado";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();
const TALLAS = ["S", "M", "L", "XL", "XXL"];
const DESTINOS_INCIDENCIA = ["REMATE", "ARREGLO", "DEVOLUCION POR FALLA"];
const ROLES_AUTORIZAN_EXCEPCION = ["ADMINISTRADOR", "ADMIN", "GERENCIA"];

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

const guardarLista = (clave, lista = []) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

const crearMapaVacio = (valor = "") =>
  TALLAS.reduce((acumulado, talla) => ({ ...acumulado, [talla]: valor }), {});

const crearMapaNumero = () => crearMapaVacio(0);

const normalizarNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const normalizarTextoClave = (valor = "") => valor.toString().trim().toUpperCase();

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

const obtenerTallasActivas = (tallasSeleccionadas = []) =>
  Array.isArray(tallasSeleccionadas) && tallasSeleccionadas.length > 0
    ? TALLAS.filter((talla) => tallasSeleccionadas.includes(talla))
    : [...TALLAS];

const detectarTallasActivasDesdeDetalle = (detalle = [], incidencias = []) => {
  const tallasDetalle = TALLAS.filter((talla) =>
    (Array.isArray(detalle) ? detalle : []).some(
      (fila) =>
        normalizarNumero(fila?.recibido?.[talla]) > 0 ||
        normalizarNumero(fila?.apto?.[talla]) > 0
    )
  );

  const tallasIncidencia = TALLAS.filter((talla) =>
    (Array.isArray(incidencias) ? incidencias : []).some(
      (incidencia) =>
        normalizarTextoClave(incidencia?.talla) === talla &&
        normalizarNumero(incidencia?.cantidad) > 0
    )
  );

  const unicas = Array.from(new Set([...tallasDetalle, ...tallasIncidencia]));
  return unicas.length > 0 ? unicas : [...TALLAS];
};

const crearIncidenciaInicial = (colorBase = "", talla = "") => ({
  id: `inc-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  colorBase,
  talla,
  cantidad: "",
  motivo: "",
  destino: "REMATE",
});

const normalizarIncidencia = (incidencia = {}, indice = 0) => ({
  ...crearIncidenciaInicial(),
  ...incidencia,
  id: incidencia?.id || `inc-${indice + 1}`,
});

const normalizarDescuentoRecepcion = (descuento = {}, indice = 0) => ({
  ...descuento,
  id: descuento?.id || `desc-rec-${indice + 1}`,
});

const sumarTotalesDetalle = (detalle = []) =>
  (Array.isArray(detalle) ? detalle : []).reduce(
    (total, fila) =>
      total +
      TALLAS.reduce(
        (subtotal, talla) => subtotal + normalizarNumero(fila?.recibido?.[talla]),
        0
      ),
    0
  );

const construirDetalleOficialDesdeRecepcion = (detalle = [], incidenciasNoPagar = []) => {
  const detalleOficial = (Array.isArray(detalle) ? detalle : []).map((fila, indice) =>
    normalizarFilaAcondicionado(
      {
        ...fila,
        id: fila?.id || `detalle-oficial-${indice + 1}`,
        colorBase: fila?.colorBase || `COLOR ${indice + 1}`,
        recibido: TALLAS.reduce(
          (acumulado, talla) => ({
            ...acumulado,
            [talla]: normalizarNumero(fila?.recibido?.[talla]),
          }),
          {}
        ),
      },
      indice
    )
  );

  (Array.isArray(incidenciasNoPagar) ? incidenciasNoPagar : []).forEach((incidencia, indice) => {
    const filaIncidencia = normalizarIncidencia(incidencia, indice);
    const colorBase = normalizarTextoClave(filaIncidencia?.colorBase);
    let cantidadPendiente = normalizarNumero(filaIncidencia?.cantidad);

    if (!colorBase || cantidadPendiente <= 0) {
      return;
    }

    const filaDetalle = detalleOficial.find(
      (fila) => normalizarTextoClave(fila?.colorBase) === colorBase
    );

    if (!filaDetalle) {
      return;
    }

    const tallaExacta = normalizarTextoClave(filaIncidencia?.talla);
    const tallasObjetivo =
      tallaExacta && TALLAS.includes(tallaExacta)
        ? [tallaExacta]
        : TALLAS.filter((talla) => normalizarNumero(filaDetalle?.recibido?.[talla]) >= 0);

    tallasObjetivo.forEach((talla) => {
      if (cantidadPendiente <= 0) {
        return;
      }

      filaDetalle.recibido[talla] =
        normalizarNumero(filaDetalle?.recibido?.[talla]) + 1;
      cantidadPendiente -= 1;
    });
  });

  return detalleOficial;
};

const extraerIncidenciasLegacy = (filas = []) =>
  (Array.isArray(filas) ? filas : []).flatMap((fila, indiceFila) => {
    const colorBase = fila?.colorBase || `COLOR ${indiceFila + 1}`;

    return ["arreglo", "remate"].flatMap((tipo) =>
      TALLAS.flatMap((talla) => {
        const cantidad = normalizarNumero(fila?.[tipo]?.[talla]);
        if (cantidad <= 0) return [];

        return [
          normalizarIncidencia(
            {
              colorBase,
              talla,
              cantidad: String(cantidad),
              motivo: tipo === "remate" ? "Registro migrado desde remate" : "Registro migrado desde arreglo",
              destino: tipo === "remate" ? "REMATE" : "ARREGLO",
            },
            indiceFila
          ),
        ];
      })
    );
  });

const normalizarFilaAcondicionado = (fila = {}, indice = 0) => ({
  id: fila?.id || `fila-${indice + 1}`,
  colorBase: fila?.colorBase || `COLOR ${indice + 1}`,
  recibido: { ...crearMapaNumero(), ...(fila?.recibido || {}) },
  apto: { ...crearMapaVacio(""), ...(fila?.apto || {}) },
});

const construirMapaIncidenciasPorColorTalla = (incidencias = []) =>
  (Array.isArray(incidencias) ? incidencias : []).reduce((acumulado, incidencia, indice) => {
    const fila = normalizarIncidencia(incidencia, indice);
    const colorBase = normalizarTextoClave(fila?.colorBase);
    const talla = normalizarTextoClave(fila?.talla);

    if (!colorBase || !talla || !TALLAS.includes(talla)) {
      return acumulado;
    }

    return {
      ...acumulado,
      [`${colorBase}__${talla}`]:
        Number(acumulado[`${colorBase}__${talla}`] || 0) + Number(fila?.cantidad || 0),
    };
  }, {});

const obtenerCantidadIncidenciaColorTalla = (mapa = {}, colorBase = "", talla = "") =>
  Number(mapa[`${normalizarTextoClave(colorBase)}__${normalizarTextoClave(talla)}`] || 0);

const ajustarDetalleRecepcionPorDescuentos = (detalle = [], descuentos = []) => {
  const detalleAjustado = (Array.isArray(detalle) ? detalle : []).map((fila, indice) =>
    normalizarFilaAcondicionado(
      {
        ...fila,
        id: fila?.id || `detalle-ajustado-${indice + 1}`,
        colorBase: fila?.colorBase || `COLOR ${indice + 1}`,
        recibido: TALLAS.reduce(
          (acumulado, talla) => ({
            ...acumulado,
            [talla]: normalizarNumero(fila?.recibido?.[talla]),
          }),
          {}
        ),
      },
      indice
    )
  );

  const descuentosDistribuidos = [];

  (Array.isArray(descuentos) ? descuentos : []).forEach((descuento, indice) => {
    const filaAjuste = normalizarDescuentoRecepcion(descuento, indice);
    const colorBase = normalizarTextoClave(filaAjuste?.colorBase);
    let cantidadPendiente = normalizarNumero(filaAjuste?.cantidad);

    if (!colorBase || cantidadPendiente <= 0) {
      return;
    }

    const filaDetalle = detalleAjustado.find(
      (fila) => normalizarTextoClave(fila?.colorBase) === colorBase
    );

    if (!filaDetalle) {
      return;
    }

    const tallaExacta = normalizarTextoClave(filaAjuste?.talla);
    const tallasObjetivo =
      tallaExacta && TALLAS.includes(tallaExacta)
        ? [tallaExacta]
        : TALLAS.filter((talla) => normalizarNumero(filaDetalle?.recibido?.[talla]) > 0);

    tallasObjetivo.forEach((talla) => {
      if (cantidadPendiente <= 0) {
        return;
      }

      const disponible = normalizarNumero(filaDetalle?.recibido?.[talla]);
      if (disponible <= 0) {
        return;
      }

      const aDescontar = Math.min(disponible, cantidadPendiente);
      filaDetalle.recibido[talla] = Math.max(0, disponible - aDescontar);
      descuentosDistribuidos.push(
        normalizarIncidencia(
          {
            colorBase: filaDetalle?.colorBase || filaAjuste?.colorBase || "",
            talla,
            cantidad: aDescontar,
            motivo: filaAjuste?.motivo || "Descuento por prenda desde recepcion",
            destino: "DESCUENTO RECEPCION",
          },
          indice
        )
      );
      cantidadPendiente -= aDescontar;
    });
  });

  return {
    detalleAjustado,
    descuentosDistribuidos,
  };
};

const obtenerCortePorCodigoOp = (codigoOp = "") =>
  leerListaGuardada(CLAVE_HISTORIAL_CORTES).find(
    (item) =>
      item?.cabeceraCorte?.codigoCorte === codigoOp ||
      item?.cabeceraCorte?.opOrigen === codigoOp
  ) || null;

const obtenerSalidaPorRecepcion = (cabecera = {}) =>
  leerListaGuardada(CLAVE_SALIDAS_TALLER).find((item) => {
    if (!item) return false;

    if (
      cabecera?.codigoSalida &&
      String(item?.codigoSalida || "").trim() === String(cabecera.codigoSalida).trim()
    ) {
      return true;
    }

    if (
      cabecera?.itemSalidaId &&
      String(item?.id || "").trim() === String(cabecera.itemSalidaId).trim()
    ) {
      return true;
    }

    return (
      String(item?.codigoOp || "").trim() === String(cabecera?.codigoOp || "").trim() &&
      String(item?.nombreTaller || "").trim() === String(cabecera?.nombreTaller || "").trim()
    );
  }) || null;

const construirDetallePrincipalDesdeCorte = (
  cabecera = {},
  salidaRelacionada = null,
  corteRelacionado = null
) => {
  const tallasActivas = obtenerTallasActivas(
    salidaRelacionada?.tallasActivas ||
      corteRelacionado?.cabeceraCorte?.tallasSeleccionadas ||
      []
  );
  const filasPrincipal = Array.isArray(corteRelacionado?.filasCorte)
    ? corteRelacionado.filasCorte
    : [];

  const detallePrincipal = filasPrincipal
    .map((fila, indice) =>
      normalizarFilaAcondicionado(
        {
          id:
            fila?.id ||
            `detalle-corte-principal-${cabecera?.codigoSalida || cabecera?.codigoOp || "op"}-${indice + 1}`,
          colorBase: fila?.color || fila?.colorBase || cabecera?.colorBase || "VARIOS",
          recibido: TALLAS.reduce(
            (acumulado, talla) => ({
              ...acumulado,
              [talla]: tallasActivas.includes(talla)
                ? normalizarNumero(
                    fila?.salidas?.[talla] ?? fila?.cantidades?.[talla] ?? fila?.[talla]
                  )
                : 0,
            }),
            {}
          ),
        },
        indice
      )
    )
    .filter((fila) =>
      TALLAS.some((talla) => normalizarNumero(fila?.recibido?.[talla]) > 0)
    );

  return detallePrincipal;
};

const construirDetallePrincipalDesdeSalida = (cabecera = {}, salidaRelacionada = null) => {
  const tallasActivas = obtenerTallasActivas(salidaRelacionada?.tallasActivas || []);
  const totalesDerivadosMismoModelo = TALLAS.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: normalizarNumero(
        (salidaRelacionada?.productosDerivados || []).reduce((total, derivado) => {
          const esMismoModelo =
            String(derivado?.tipoHijo || "")
              .trim()
              .toUpperCase() === "MISMO_MODELO" ||
            String(derivado?.tipoSalida || "")
              .trim()
              .toUpperCase() === "MISMO_MODELO";
          return esMismoModelo
            ? total + normalizarNumero(derivado?.salidas?.[talla])
            : total;
        }, 0)
      ),
    }),
    {}
  );

  const totalesSalida = TALLAS.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: Math.max(
        0,
        normalizarNumero(salidaRelacionada?.totalesPorTalla?.[talla]) -
          normalizarNumero(totalesDerivadosMismoModelo?.[talla])
      ),
    }),
    {}
  );

  const totalDesdeSalida = TALLAS.reduce(
    (total, talla) =>
      total +
      (tallasActivas.includes(talla)
        ? normalizarNumero(totalesSalida?.[talla])
        : 0),
    0
  );

  if (totalDesdeSalida <= 0) {
    return [];
  }

  return [
    normalizarFilaAcondicionado(
      {
        id: `detalle-salida-principal-${cabecera?.codigoSalida || cabecera?.codigoOp || "op"}`,
        colorBase: salidaRelacionada?.colorBase || cabecera?.colorBase || "VARIOS",
        recibido: TALLAS.reduce(
          (acumulado, talla) => ({
            ...acumulado,
            [talla]: tallasActivas.includes(talla)
              ? normalizarNumero(totalesSalida?.[talla])
              : 0,
          }),
          {}
        ),
      },
      0
    ),
  ];
};

const construirDetalleRecepcionRespaldo = (cabecera = {}, corteRelacionado = null) => {
  const salidaRelacionada = obtenerSalidaPorRecepcion(cabecera);
  const detallePrincipalDesdeCorte = construirDetallePrincipalDesdeCorte(
    cabecera,
    salidaRelacionada,
    corteRelacionado
  );

  if (detallePrincipalDesdeCorte.length > 0) {
    return detallePrincipalDesdeCorte;
  }

  const detallePrincipalDesdeSalida = construirDetallePrincipalDesdeSalida(
    cabecera,
    salidaRelacionada
  );

  if (detallePrincipalDesdeSalida.length > 0) {
    return detallePrincipalDesdeSalida;
  }

  const tallasActivas = obtenerTallasActivas(
    salidaRelacionada?.tallasActivas ||
      corteRelacionado?.cabeceraCorte?.tallasSeleccionadas ||
      []
  );

  const totalRespaldo = normalizarNumero(
    cabecera?.cantidadRecibida || cabecera?.cantidadTotal || salidaRelacionada?.cantidadTotal || 0
  );

  if (totalRespaldo <= 0) {
    return [];
  }

  const primeraTalla = tallasActivas[0] || "S";

  return [
    normalizarFilaAcondicionado(
      {
        id: `detalle-respaldo-${cabecera?.codigoSalida || cabecera?.codigoOp || "op"}`,
        colorBase: salidaRelacionada?.colorBase || cabecera?.colorBase || "VARIOS",
        recibido: TALLAS.reduce(
          (acumulado, talla) => ({
            ...acumulado,
            [talla]: talla === primeraTalla ? totalRespaldo : 0,
          }),
          {}
        ),
      },
      0
    ),
  ];
};

const crearRecepcionesDisponibles = () =>
  leerListaGuardada(CLAVE_RECEPCIONES_TALLER)
    .filter(
      (item) =>
        item?.cabeceraRecepcion?.tipoRecepcion === "final" &&
        item?.cabeceraRecepcion?.aprobadoCalidad
    )
    .map((item) => {
      const cabecera = item?.cabeceraRecepcion || {};
      const corteRelacionado = obtenerCortePorCodigoOp(cabecera?.codigoOp || "");
      const incidenciasNoPagar = (Array.isArray(cabecera?.incidenciasRecepcion)
        ? cabecera.incidenciasRecepcion
        : []
      ).filter(
        (incidencia) =>
          String(incidencia?.destino || "").trim().toUpperCase() === "NO PAGAR" &&
          normalizarNumero(incidencia?.cantidad) > 0
      );
      const descuentosRecepcion = (Array.isArray(cabecera?.descuentosPrendaTaller)
        ? cabecera.descuentosPrendaTaller
        : []
      ).filter((descuento) => normalizarNumero(descuento?.cantidad) > 0);
      const detalleRecepcionBase = Array.isArray(cabecera?.detalleRecepcion)
        ? cabecera.detalleRecepcion.map((fila, indice) =>
            normalizarFilaAcondicionado(
              {
                id: fila?.id || `detalle-${indice + 1}`,
                colorBase: fila?.colorBase || "",
                recibido: TALLAS.reduce(
                  (acumulado, talla) => ({
                    ...acumulado,
                    [talla]: normalizarNumero(fila?.recibido?.[talla]),
                  }),
                  {}
                ),
              },
              indice
            )
          )
        : [];
      const totalRecibidoBase = detalleRecepcionBase.reduce(
        (total, fila) =>
          total +
          TALLAS.reduce(
            (subtotal, talla) => subtotal + normalizarNumero(fila?.recibido?.[talla]),
            0
          ),
        0
      );
      const detalleRecepcion =
        totalRecibidoBase > 0
          ? detalleRecepcionBase
          : construirDetalleRecepcionRespaldo(cabecera, corteRelacionado);
      const detalleOficial = construirDetalleOficialDesdeRecepcion(
        detalleRecepcion,
        incidenciasNoPagar
      );
      const { detalleAjustado: detalleAptoBase, descuentosDistribuidos } =
        ajustarDetalleRecepcionPorDescuentos(
        detalleRecepcion,
        descuentosRecepcion
      );
      const totalRecibido = sumarTotalesDetalle(detalleRecepcion);
      const cantidadOficial = Math.max(
        sumarTotalesDetalle(
          construirDetallePrincipalDesdeCorte(cabecera, obtenerSalidaPorRecepcion(cabecera), corteRelacionado)
        ),
        sumarTotalesDetalle(
          construirDetallePrincipalDesdeSalida(cabecera, obtenerSalidaPorRecepcion(cabecera))
        ),
        totalRecibido + incidenciasNoPagar.reduce((total, item) => total + normalizarNumero(item?.cantidad), 0)
      );
      const incidenciasBaseRecepcion = [
        ...incidenciasNoPagar.map((incidencia, indice) =>
          normalizarIncidencia(
            {
              ...incidencia,
              destino: incidencia?.destino || "NO PAGAR",
            },
            indice
          )
        ),
        ...descuentosDistribuidos,
      ];

      return {
        id: item?.id || cabecera?.idRecepcion || cabecera?.codigoSalida || cabecera?.codigoOp,
        recepcionId:
          item?.id || cabecera?.idRecepcion || cabecera?.codigoSalida || cabecera?.codigoOp,
        codigoOp: cabecera?.codigoOp || "",
        codigoSalida: cabecera?.codigoSalida || "",
        modelo: cabecera?.modelo || "",
        tipoTela: cabecera?.tipoTela || "",
        nombreTaller: cabecera?.nombreTaller || "",
        fechaRecepcion: cabecera?.fechaRecepcion || "",
        categoriaModelo:
          cabecera?.categoriaModelo || corteRelacionado?.cabeceraCorte?.categoriaModelo || "",
        modeloCatalogo:
          cabecera?.modeloCatalogo || corteRelacionado?.cabeceraCorte?.modeloCatalogo || "",
        telaModelo:
          cabecera?.telaModelo || corteRelacionado?.cabeceraCorte?.telaModelo || "",
        tallasActivas: obtenerTallasActivas(
          corteRelacionado?.cabeceraCorte?.tallasSeleccionadas || []
        ),
        detalleRecepcion,
        detalleOficial,
        detalleAptoBase,
        totalRecibido,
        cantidadOficial,
        incidenciasNoPagar,
        descuentosRecepcion,
        incidenciasBaseRecepcion,
      };
    })
    .sort((a, b) => (b.fechaRecepcion || "").localeCompare(a.fechaRecepcion || ""));

const leerAcondicionados = () => leerListaGuardada(CLAVE_ACONDICIONADO_PT);

const leerRemates = () => leerListaGuardada(CLAVE_REMATES_PT);

const convertirDetalleApto = (filas = []) =>
  (Array.isArray(filas) ? filas : []).map((fila, indice) => ({
    id: fila?.id || `apto-${indice + 1}`,
    colorBase: fila?.colorBase || `COLOR ${indice + 1}`,
    recibido: TALLAS.reduce(
      (acumulado, talla) => ({
        ...acumulado,
        [talla]: normalizarNumero(fila?.apto?.[talla]),
      }),
      {}
    ),
  }));

const construirRemateDesdeIncidencias = (incidencias = []) => {
  const mapa = new Map();

  (Array.isArray(incidencias) ? incidencias : []).forEach((incidencia, indice) => {
    const fila = normalizarIncidencia(incidencia, indice);
    if (fila?.destino !== "REMATE") return;

    const colorBase = fila?.colorBase || `COLOR ${indice + 1}`;
    const actual = mapa.get(colorBase) || {
      id: `remate-${colorBase}`,
      colorBase,
      cantidades: crearMapaNumero(),
    };

    if (TALLAS.includes(fila?.talla)) {
      actual.cantidades[fila.talla] =
        Number(actual.cantidades[fila.talla] || 0) + Number(fila?.cantidad || 0);
    }

    mapa.set(colorBase, actual);
  });

  return Array.from(mapa.values()).filter((fila) =>
    TALLAS.some((talla) => normalizarNumero(fila?.cantidades?.[talla]) > 0)
  );
};

const obtenerEstadoAcondicionado = (
  filas = [],
  incidencias = [],
  cantidadObjetivo = 0,
  detalleOficial = []
) => {
  const etiquetas = leerEtiquetasCalidadSistema();
  const mapaIncidencias = construirMapaIncidenciasPorColorTalla(incidencias);
  let totalRecibido = 0;
  let totalApto = 0;
  let totalIncidencias = 0;
  let tieneRemate = false;
  let tieneObservacion = false;

  (Array.isArray(filas) ? filas : []).forEach((fila) => {
    TALLAS.forEach((talla) => {
      totalRecibido += normalizarNumero(fila?.recibido?.[talla]);
      totalApto += normalizarNumero(fila?.apto?.[talla]);
      totalIncidencias += obtenerCantidadIncidenciaColorTalla(mapaIncidencias, fila?.colorBase, talla);
    });
  });

  (Array.isArray(incidencias) ? incidencias : []).forEach((incidencia, indice) => {
    const fila = normalizarIncidencia(incidencia, indice);
    if (normalizarNumero(fila?.cantidad) <= 0) return;
    if (fila?.destino === "REMATE") {
      tieneRemate = true;
    } else {
      tieneObservacion = true;
    }
  });
  const totalRemate = (Array.isArray(incidencias) ? incidencias : []).reduce(
    (total, incidencia) =>
      incidencia?.destino === "REMATE" ? total + normalizarNumero(incidencia?.cantidad) : total,
    0
  );

  const totalControl =
    sumarTotalesDetalle(detalleOficial) > 0
      ? sumarTotalesDetalle(detalleOficial)
      : normalizarNumero(cantidadObjetivo) > 0
        ? normalizarNumero(cantidadObjetivo)
        : totalRecibido;
  const diferencias = construirDiferenciasAcondicionado(filas, incidencias, detalleOficial);
  const completo = diferencias.length === 0;

  if (!completo) {
    const tieneFaltante = diferencias.some((item) => item?.tipo === "FALTA");
    const tieneSobrante = diferencias.some((item) => item?.tipo === "SOBRA");

    return {
      texto:
        tieneFaltante && tieneSobrante
          ? etiquetas.diferenciasConteo
          : tieneFaltante
            ? etiquetas.faltanCantidades
            : etiquetas.sobranCantidades,
      clase: tieneFaltante ? "estado_pendiente" : "estado_observado",
      totalControl,
      totalRecibido,
      totalApto,
      totalIncidencias,
      totalRemate,
      completo,
    };
  }

  return {
    texto: tieneRemate ? etiquetas.opCompletaConRemate : etiquetas.opCompleta,
    clase: "estado_aprobado",
    totalControl,
    totalRecibido,
    totalApto,
    totalIncidencias,
    totalRemate,
    completo,
  };
};

const construirDiferenciasAcondicionado = (filas = [], incidencias = [], detalleOficial = []) => {
  const mapaIncidencias = construirMapaIncidenciasPorColorTalla(incidencias);
  const diferencias = [];
  const mapaOficial = (Array.isArray(detalleOficial) ? detalleOficial : []).reduce(
    (acumulado, fila) => ({
      ...acumulado,
      [normalizarTextoClave(fila?.colorBase)]: TALLAS.reduce(
        (sub, talla) => ({
          ...sub,
          [talla]: normalizarNumero(fila?.recibido?.[talla]),
        }),
        {}
      ),
    }),
    {}
  );

  (Array.isArray(filas) ? filas : []).forEach((fila) => {
    TALLAS.forEach((talla) => {
      const colorBase = fila?.colorBase || "-";
      const oficial =
        normalizarNumero(
          mapaOficial[normalizarTextoClave(colorBase)]?.[talla]
        ) || normalizarNumero(fila?.recibido?.[talla]);
      const apto = normalizarNumero(fila?.apto?.[talla]);
      const incidencia = obtenerCantidadIncidenciaColorTalla(
        mapaIncidencias,
        colorBase,
        talla
      );
      const controlado = apto + incidencia;
      const diferencia = oficial - controlado;

      if (oficial <= 0 && controlado <= 0) {
        return;
      }

      if (diferencia !== 0) {
        diferencias.push({
          colorBase,
          talla,
          recibido: oficial,
          controlado,
          diferencia: Math.abs(diferencia),
          tipo: diferencia > 0 ? "FALTA" : "SOBRA",
        });
      }
    });
  });

  return diferencias;
};

const resolverEstadoListaCalidad = (registro = null) => {
  const etiquetas = leerEtiquetasCalidadSistema();
  if (!registro) {
    return etiquetas.pendienteCalidad;
  }

  if (registro?.cerradoStock && registro?.cierreForzado) {
    return etiquetas.observadaDiferencia;
  }

  if (registro?.cerradoStock && normalizarNumero(registro?.totalRemate) > 0) {
    return etiquetas.conRemate;
  }

  if (registro?.cerradoStock) {
    return etiquetas.ingresadaStock;
  }

  if (normalizarNumero(registro?.totalRemate) > 0) {
    return etiquetas.conRemate;
  }

  if (String(registro?.estado || "").trim()) {
    return etiquetas.guardadoAvance;
  }

  return etiquetas.pendienteCalidad;
};

const resolverEstadoHistorialCalidad = (registro = {}) => {
  const etiquetas = leerEtiquetasCalidadSistema();
  if (registro?.cerradoStock && registro?.cierreForzado) {
    return etiquetas.ingresoIncompleto;
  }

  if (registro?.cerradoStock && normalizarNumero(registro?.totalRemate) > 0) {
    return etiquetas.ingresoConRemate;
  }

  if (registro?.cerradoStock) {
    return etiquetas.ingresoCompleto;
  }

  return registro?.estado || etiquetas.guardadoAvance;
};

const crearFormularioVacio = () => ({
  recepcionId: "",
  codigoOp: "",
  codigoSalida: "",
  modelo: "",
  tipoTela: "",
  nombreTaller: "",
  fechaRecepcion: "",
  categoriaModelo: "",
  modeloCatalogo: "",
  telaModelo: "",
  tallasActivas: [...TALLAS],
  cantidadOficial: 0,
  detalleOficial: [],
  detalle: [],
  incidencias: [],
  incidenciasBaseRecepcion: [],
  incidenciasNoPagar: [],
  descuentosRecepcion: [],
  observacion: "",
});

export function AcondicionadoProductoTerminado() {
  const { user } = UserAuth();
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [mostrarCantidadesOficiales, setMostrarCantidadesOficiales] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [pestanaActiva, setPestanaActiva] = useState("pendientes");
  const [formulario, setFormulario] = useState(crearFormularioVacio);
  const [acondicionados, setAcondicionados] = useState(leerAcondicionados);
  const perfilUsuario = useMemo(() => leerPerfilUsuario(user), [user]);
  const responsableActivo = useMemo(() => obtenerNombreResponsableActivo(user), [user]);
  const puedeAutorizarExcepcion = ROLES_AUTORIZAN_EXCEPCION.includes(
    String(perfilUsuario?.rol || "").toUpperCase()
  );

  const sincronizarDespuesDeCalidad = async () => {
    try {
      await sincronizarTallerStockDesdeLocalASupabase();
      await sincronizarTallerStockDesdeSupabase();
      setAcondicionados(leerAcondicionados());
      return "";
    } catch (error) {
      console.error("No se pudo sincronizar control de calidad con Supabase:", error);
      setAcondicionados(leerAcondicionados());
      return error?.message || "No se pudo sincronizar con Supabase.";
    }
  };

  useEffect(() => {
    const sincronizar = async () => {
      try {
        await sincronizarTallerStockDesdeSupabase();
        setAcondicionados(leerAcondicionados());
      } catch (error) {
        console.error("No se pudo sincronizar control de calidad:", error);
      }
    };

    sincronizar();
  }, []);

  const recepcionesDisponibles = useMemo(() => {
    const registrosGuardados = leerAcondicionados();

    return crearRecepcionesDisponibles()
      .map((recepcion) => {
        const registroGuardado =
          registrosGuardados.find((item) => item?.recepcionId === recepcion?.recepcionId) || null;

        return {
          ...recepcion,
          estadoLista: resolverEstadoListaCalidad(registroGuardado),
          cerradoStock: Boolean(registroGuardado?.cerradoStock),
        };
      })
      .filter((recepcion) => !recepcion?.cerradoStock);
  }, [acondicionados]);

  const recepcionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return recepcionesDisponibles.filter((item) =>
      !texto ||
      [item?.codigoOp, item?.codigoSalida, item?.modelo, item?.nombreTaller, item?.fechaRecepcion]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, recepcionesDisponibles]);

  const totalPaginas = Math.max(1, Math.ceil(recepcionesFiltradas.length / FILAS_POR_PAGINA));
  const recepcionesPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return recepcionesFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [paginaActual, recepcionesFiltradas]);

  const incidenciasControlVisibles = useMemo(
    () => [
      ...(formulario.incidenciasBaseRecepcion || []),
      ...(formulario.incidencias || []),
    ],
    [formulario.incidenciasBaseRecepcion, formulario.incidencias]
  );

  const resumenActual = useMemo(
    () =>
      obtenerEstadoAcondicionado(
        formulario.detalle || [],
        incidenciasControlVisibles,
        formulario.cantidadOficial,
        formulario.detalleOficial || []
      ),
    [formulario.detalle, incidenciasControlVisibles, formulario.cantidadOficial, formulario.detalleOficial]
  );

  const tallasActivasFormulario = useMemo(
    () =>
      obtenerTallasActivas(
        Array.isArray(formulario.tallasActivas) && formulario.tallasActivas.length > 0
          ? formulario.tallasActivas
          : detectarTallasActivasDesdeDetalle(formulario.detalle, incidenciasControlVisibles)
      ),
    [formulario.tallasActivas, formulario.detalle, incidenciasControlVisibles]
  );

  const historialFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return acondicionados
      .filter((item) => Boolean(item?.cerradoStock))
      .filter(
        (item) =>
          !texto ||
          [
            item?.codigoOp,
            item?.codigoSalida,
            item?.modelo,
            item?.nombreTaller,
            item?.fechaRecepcion,
            item?.estado,
          ]
            .join(" ")
            .toLowerCase()
            .includes(texto)
      )
      .sort((a, b) => String(b?.fechaAcondicionado || "").localeCompare(String(a?.fechaAcondicionado || "")));
  }, [acondicionados, busqueda]);

  const mapaIncidenciasActual = useMemo(
    () => construirMapaIncidenciasPorColorTalla(incidenciasControlVisibles),
    [incidenciasControlVisibles]
  );
  const totalesTablaCalidad = useMemo(
    () => ({
      recibido: TALLAS.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: (formulario.detalle || []).reduce(
            (total, fila) => total + normalizarNumero(fila?.recibido?.[talla]),
            0
          ),
        }),
        {}
      ),
      apto: TALLAS.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: (formulario.detalle || []).reduce(
            (total, fila) => total + normalizarNumero(fila?.apto?.[talla]),
            0
          ),
        }),
        {}
      ),
      incidencia: TALLAS.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: (formulario.detalle || []).reduce(
            (total, fila) =>
              total +
              obtenerCantidadIncidenciaColorTalla(
                mapaIncidenciasActual,
                fila?.colorBase,
                talla
              ),
            0
          ),
        }),
        {}
      ),
    }),
    [formulario.detalle, mapaIncidenciasActual]
  );
  const diferenciasControlActual = useMemo(
    () =>
      construirDiferenciasAcondicionado(
        formulario.detalle || [],
        incidenciasControlVisibles,
        formulario.detalleOficial || []
      ),
    [formulario.detalle, incidenciasControlVisibles, formulario.detalleOficial]
  );
  const mensajeDiferenciasControl = useMemo(() => {
    if (diferenciasControlActual.length === 0) {
      return "";
    }

    return diferenciasControlActual
      .map((item) =>
        item.tipo === "FALTA"
          ? `Falta ${item.diferencia} unidad(es) en ${item.colorBase} / ${item.talla}`
          : `Sobra ${item.diferencia} unidad(es) en ${item.colorBase} / ${item.talla}`
      )
      .join(". ");
  }, [diferenciasControlActual]);
  const resumenIngresoStock = useMemo(
    () => ({
      cantidadOficial: normalizarNumero(formulario.cantidadOficial),
      totalRecibido: normalizarNumero(resumenActual.totalRecibido),
      totalApto: normalizarNumero(resumenActual.totalApto),
      totalRemate: normalizarNumero(resumenActual.totalRemate),
      totalIncidencias: normalizarNumero(resumenActual.totalIncidencias),
      totalControlado:
        normalizarNumero(resumenActual.totalApto) +
        normalizarNumero(resumenActual.totalIncidencias),
    }),
    [
      formulario.cantidadOficial,
      resumenActual.totalApto,
      resumenActual.totalIncidencias,
      resumenActual.totalRecibido,
      resumenActual.totalRemate,
    ]
  );

  const ajustesRecepcionResumen = useMemo(() => {
    const mermas = (formulario.incidenciasNoPagar || []).map((incidencia, indice) => ({
      id: incidencia?.id || `merma-${indice + 1}`,
      tipo: "MERMA / NO PAGAR",
      colorBase: incidencia?.colorBase || "-",
      talla: incidencia?.talla || "-",
      cantidad: normalizarNumero(incidencia?.cantidad),
      motivo: incidencia?.motivo || "Sin motivo",
    }));

    const descuentos = (formulario.descuentosRecepcion || []).map((descuento, indice) => ({
      id: descuento?.id || `desc-${indice + 1}`,
      tipo: "DESCUENTO POR PRENDA",
      colorBase: descuento?.colorBase || "-",
      talla: descuento?.talla || "-",
      cantidad: normalizarNumero(descuento?.cantidad),
      motivo: descuento?.motivo || "Sin motivo",
    }));

    return [...mermas, ...descuentos];
  }, [formulario.incidenciasNoPagar, formulario.descuentosRecepcion]);

  const totalMermaRecepcion = useMemo(
    () =>
      (formulario.incidenciasNoPagar || []).reduce(
        (total, incidencia) => total + normalizarNumero(incidencia?.cantidad),
        0
      ),
    [formulario.incidenciasNoPagar]
  );

  const totalDescuentoRecepcion = useMemo(
    () =>
      (formulario.descuentosRecepcion || []).reduce(
        (total, descuento) => total + normalizarNumero(descuento?.cantidad),
        0
      ),
    [formulario.descuentosRecepcion]
  );
  const etiquetasCalidad = useMemo(() => leerEtiquetasCalidadSistema(), []);

  const cargarRecepcion = (recepcion) => {
    const registroGuardado =
      acondicionados.find((item) => item?.recepcionId === recepcion?.recepcionId) || null;

    const incidenciasGuardadas =
      (registroGuardado?.incidencias || []).length > 0
        ? registroGuardado.incidencias
        : extraerIncidenciasLegacy(registroGuardado?.detalle || []);

    const detalleBaseRecepcion = (recepcion?.detalleRecepcion || []).map((fila, indice) => {
      const filaBase = normalizarFilaAcondicionado(
        {
          ...fila,
          recibido: fila?.recibido || {},
        },
        indice
      );
      const filaAptoBase =
        (recepcion?.detalleAptoBase || []).find(
          (item) =>
            normalizarTextoClave(item?.colorBase) === normalizarTextoClave(filaBase?.colorBase)
        ) || filaBase;
      const filaGuardada = (registroGuardado?.detalle || []).find(
        (item) =>
          normalizarTextoClave(item?.colorBase) === normalizarTextoClave(filaBase?.colorBase)
      );

      return {
        ...filaBase,
        apto: TALLAS.reduce(
          (acumulado, talla) => ({
            ...acumulado,
            [talla]:
              filaGuardada?.apto?.[talla] ??
              normalizarNumero(filaAptoBase?.recibido?.[talla]) ??
              "",
          }),
          {}
        ),
      };
    });

    setFormulario({
      recepcionId: recepcion?.recepcionId || "",
      codigoOp: recepcion?.codigoOp || "",
      codigoSalida: recepcion?.codigoSalida || "",
      modelo: recepcion?.modelo || "",
      tipoTela: recepcion?.tipoTela || "",
      nombreTaller: recepcion?.nombreTaller || "",
      fechaRecepcion: recepcion?.fechaRecepcion || "",
      categoriaModelo: recepcion?.categoriaModelo || "",
      modeloCatalogo: recepcion?.modeloCatalogo || "",
      telaModelo: recepcion?.telaModelo || "",
      cantidadOficial: normalizarNumero(recepcion?.cantidadOficial),
      detalleOficial: (recepcion?.detalleOficial || []).map((fila, indice) =>
        normalizarFilaAcondicionado(fila, indice)
      ),
      tallasActivas:
        registroGuardado?.tallasActivas ||
        recepcion?.tallasActivas ||
        detectarTallasActivasDesdeDetalle(
          detalleBaseRecepcion,
          incidenciasGuardadas
        ),
      detalle: detalleBaseRecepcion,
      incidencias: incidenciasGuardadas.map((incidencia, indice) =>
        normalizarIncidencia(incidencia, indice)
      ),
      incidenciasBaseRecepcion:
        (registroGuardado?.incidenciasBaseRecepcion || recepcion?.incidenciasBaseRecepcion || []).map(
          (incidencia, indice) => normalizarIncidencia(incidencia, indice)
        ),
      incidenciasNoPagar:
        (registroGuardado?.incidenciasNoPagar || recepcion?.incidenciasNoPagar || []).map(
          (incidencia, indice) => normalizarIncidencia(incidencia, indice)
        ),
      descuentosRecepcion:
        (registroGuardado?.descuentosRecepcion || recepcion?.descuentosRecepcion || []).map(
          (descuento, indice) => normalizarDescuentoRecepcion(descuento, indice)
        ),
      observacion: registroGuardado?.observacion || "",
    });

    mostrarNotificacionCarga("OP cargada para acondicionado");
  };

  const cargarDesdeHistorial = (registro = {}) => {
    setFormulario({
      recepcionId: registro?.recepcionId || "",
      codigoOp: registro?.codigoOp || "",
      codigoSalida: registro?.codigoSalida || "",
      modelo: registro?.modelo || "",
      tipoTela: registro?.tipoTela || "",
      nombreTaller: registro?.nombreTaller || "",
      fechaRecepcion: registro?.fechaRecepcion || "",
      categoriaModelo: registro?.categoriaModelo || "",
      modeloCatalogo: registro?.modeloCatalogo || "",
      telaModelo: registro?.telaModelo || "",
      cantidadOficial: normalizarNumero(registro?.cantidadOficial),
      detalleOficial: (registro?.detalleOficial || []).map((fila, indice) =>
        normalizarFilaAcondicionado(fila, indice)
      ),
      tallasActivas:
        registro?.tallasActivas ||
        detectarTallasActivasDesdeDetalle(registro?.detalle || [], registro?.incidencias || []),
      detalle: (registro?.detalle || []).map((fila, indice) =>
        normalizarFilaAcondicionado(fila, indice)
      ),
      incidencias: ((registro?.incidencias || []).length > 0
        ? registro?.incidencias || []
        : extraerIncidenciasLegacy(registro?.detalle || [])
      ).map((incidencia, indice) => normalizarIncidencia(incidencia, indice)),
      incidenciasBaseRecepcion: (registro?.incidenciasBaseRecepcion || []).map(
        (incidencia, indice) => normalizarIncidencia(incidencia, indice)
      ),
      incidenciasNoPagar: (registro?.incidenciasNoPagar || []).map((incidencia, indice) =>
        normalizarIncidencia(incidencia, indice)
      ),
      descuentosRecepcion: (registro?.descuentosRecepcion || []).map((descuento, indice) =>
        normalizarDescuentoRecepcion(descuento, indice)
      ),
      observacion: registro?.observacion || "",
    });

    mostrarNotificacionCarga("Acondicionado cargado desde historial");
  };

  const actualizarCantidad = (idFila, talla, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).map((fila) =>
        fila.id !== idFila
          ? fila
          : {
              ...fila,
              apto: {
                ...fila.apto,
                [talla]: valor,
              },
            }
      ),
    }));
  };

  const agregarIncidencia = () => {
    const colorBaseDefecto = formulario?.detalle?.[0]?.colorBase || "";
    const tallaDefecto = tallasActivasFormulario?.[0] || "";
    setFormulario((anterior) => ({
      ...anterior,
      incidencias: [
        ...(anterior.incidencias || []),
        crearIncidenciaInicial(colorBaseDefecto, tallaDefecto),
      ],
    }));
  };

  const actualizarIncidencia = (idIncidencia, campo, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      incidencias: (anterior.incidencias || []).map((incidencia) =>
        incidencia.id !== idIncidencia
          ? incidencia
          : {
              ...incidencia,
              [campo]: valor,
            }
      ),
    }));
  };

  const quitarIncidencia = (idIncidencia) => {
    setFormulario((anterior) => ({
      ...anterior,
      incidencias: (anterior.incidencias || []).filter(
        (incidencia) => incidencia.id !== idIncidencia
      ),
    }));
  };

  const construirRegistroAcondicionado = (extras = {}) => ({
    recepcionId: formulario.recepcionId,
    codigoOp: formulario.codigoOp,
    codigoSalida: formulario.codigoSalida,
    modelo: formulario.modelo,
    tipoTela: formulario.tipoTela,
    nombreTaller: formulario.nombreTaller,
    fechaRecepcion: formulario.fechaRecepcion,
    categoriaModelo: formulario.categoriaModelo,
    modeloCatalogo: formulario.modeloCatalogo,
    telaModelo: formulario.telaModelo,
    tallasActivas: tallasActivasFormulario,
    cantidadOficial: formulario.cantidadOficial,
    detalleOficial: formulario.detalleOficial,
    detalle: formulario.detalle,
    incidencias: formulario.incidencias,
    incidenciasBaseRecepcion: formulario.incidenciasBaseRecepcion,
    incidenciasNoPagar: formulario.incidenciasNoPagar,
    descuentosRecepcion: formulario.descuentosRecepcion,
    observacion: formulario.observacion,
    estado: resumenActual.texto,
    totalApto: resumenActual.totalApto,
    totalIncidencias: resumenActual.totalIncidencias,
    totalRemate: resumenActual.totalRemate,
    fechaAcondicionado: new Date().toISOString(),
    ...extras,
  });

  const guardarSoloAcondicionado = async () => {
    if (!formulario.recepcionId) {
      await mostrarAlertaSistema("Carga primero una recepcion.");
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando avance de acondicionado...",
      mensajeExito: "Acondicionado guardado correctamente.",
      mensajeError: "No se pudo guardar el acondicionado.",
      accion: async () => {
        const registroPrevio =
          acondicionados.find((item) => item?.recepcionId === formulario.recepcionId) || null;
        const registro = construirRegistroAcondicionado({
          cerradoStock: Boolean(registroPrevio?.cerradoStock),
          cierreForzado: Boolean(registroPrevio?.cierreForzado),
          diferenciasControl: registroPrevio?.diferenciasControl || [],
          resumenDiferencias: registroPrevio?.resumenDiferencias || "",
          autorizadoPor: registroPrevio?.autorizadoPor || "",
          rolAutorizador: registroPrevio?.rolAutorizador || "",
          fechaAutorizacion: registroPrevio?.fechaAutorizacion || "",
        });
        const listaActualizada = [
          registro,
          ...acondicionados.filter((item) => item?.recepcionId !== registro.recepcionId),
        ];
        setAcondicionados(listaActualizada);
        guardarLista(CLAVE_ACONDICIONADO_PT, listaActualizada);
        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setAcondicionados(leerAcondicionados());
      },
    });
  };

  const guardarAcondicionado = async () => {
    if (!formulario.recepcionId) {
      await mostrarAlertaSistema("Carga primero una recepcion.");
      return;
    }

    if (!resumenActual.completo) {
      await mostrarAlertaSistema(
        `Revisa el conteo. Recibido debe ser igual a apto + incidencias.\n\n${mensajeDiferenciasControl || "Todavia falta cuadrar cantidades en esta OP."}`
      );
      return;
    }

    const registroPrevio =
      acondicionados.find((item) => item?.recepcionId === formulario.recepcionId) || null;
    const recepcionYaRegistrada = Boolean(registroPrevio?.cerradoStock);
    const confirmarIngreso = await confirmarAccionSistema(
      [
        `Apto a stock normal: ${resumenIngresoStock.totalApto}`,
        `Ingreso a remates: ${resumenIngresoStock.totalRemate}`,
        `Total controlado: ${resumenIngresoStock.totalControlado}`,
        `Cantidad oficial OP: ${resumenIngresoStock.cantidadOficial}`,
      ].join("\n"),
      {
        titulo: recepcionYaRegistrada
          ? "Confirmar actualizacion de stock"
          : "Confirmar ingreso a stock",
        icono: "question",
        confirmarTexto: recepcionYaRegistrada ? "Actualizar" : "Ingresar",
        cancelarTexto: "Revisar",
      }
    );

    if (!confirmarIngreso) {
      return;
    }

    let advertenciaSincronizacion = "";
    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Ingresando producto terminado y remates...",
      mensajeExito: recepcionYaRegistrada
        ? "Acondicionado actualizado correctamente."
        : "Producto terminado ingresado correctamente al stock y remate.",
      mensajeError: "No se pudo cerrar el acondicionado.",
      accion: async () => {
        const registro = construirRegistroAcondicionado({
          estado:
            normalizarNumero(resumenActual.totalRemate) > 0
              ? etiquetasCalidad.ingresoConRemate
              : etiquetasCalidad.ingresoCompleto,
          cerradoStock: true,
          cierreForzado: false,
          diferenciasControl: [],
          resumenDiferencias: "",
          autorizadoPor: "",
          rolAutorizador: "",
          fechaAutorizacion: "",
        });
        const listaActualizada = [
          registro,
          ...acondicionados.filter((item) => item?.recepcionId !== registro.recepcionId),
        ];
        setAcondicionados(listaActualizada);
        guardarLista(CLAVE_ACONDICIONADO_PT, listaActualizada);
        const corteRelacionado = obtenerCortePorCodigoOp(formulario.codigoOp || "");

        await registrarIngresoProductosTerminados({
          recepcionId: formulario.recepcionId,
          fecha: formulario.fechaRecepcion,
          codigoOp: formulario.codigoOp,
          codigoSalida: formulario.codigoSalida,
          modeloId: corteRelacionado?.cabeceraCorte?.modeloId || "",
          codigoModelo: corteRelacionado?.cabeceraCorte?.codigoModelo || "",
          categoriaModelo: formulario.categoriaModelo,
          modeloCatalogo: formulario.modeloCatalogo,
          telaModelo: formulario.telaModelo,
          modelo: formulario.modelo,
          tipoTela: formulario.tipoTela,
          detalleRecepcion: convertirDetalleApto(formulario.detalle || []),
        });

        const rematesActuales = leerRemates();
        const detalleRemate = construirRemateDesdeIncidencias(formulario.incidencias || []);
        const registroRemate = {
          recepcionId: formulario.recepcionId,
          codigoOp: formulario.codigoOp,
          codigoSalida: formulario.codigoSalida,
          modelo: formulario.modelo,
          fechaRecepcion: formulario.fechaRecepcion,
          detalleRemate,
          totalRemate: resumenActual.totalRemate,
        };

        guardarLista(CLAVE_REMATES_PT, [
          registroRemate,
          ...rematesActuales.filter((item) => item?.recepcionId !== formulario.recepcionId),
        ]);

        await sincronizarTallerStockDesdeLocalASupabase();
        await sincronizarTallerStockDesdeSupabase();
        setAcondicionados(leerAcondicionados());
      },
    });
  };

  const autorizarIngresoConObservacion = async () => {
    if (!formulario.recepcionId) {
      await mostrarAlertaSistema("Carga primero una recepcion.");
      return;
    }

    if (resumenActual.completo) {
      await mostrarAlertaSistema("Esta OP ya cuadra correctamente. No necesita autorizacion especial.");
      return;
    }

    if (!puedeAutorizarExcepcion) {
      await mostrarAlertaSistema(
        "Solo un usuario de gerencia o administrador puede autorizar un ingreso con observacion."
      );
      return;
    }

    let advertenciaSincronizacion = "";
    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Autorizando ingreso con observacion...",
      mensajeExito: "Ingreso autorizado con observacion y diferencia registrada.",
      mensajeError: "No se pudo autorizar el ingreso con observacion.",
      accion: async () => {
        const registro = construirRegistroAcondicionado({
          estado: etiquetasCalidad.ingresoIncompleto,
          claseEstado: "estado_observado",
          cerradoStock: true,
          cierreForzado: true,
          diferenciasControl: diferenciasControlActual,
          resumenDiferencias: mensajeDiferenciasControl,
          autorizadoPor: responsableActivo || perfilUsuario?.nombreVisible || "Usuario autorizado",
          rolAutorizador: perfilUsuario?.rol || "",
          fechaAutorizacion: new Date().toISOString(),
        });
        const listaActualizada = [
          registro,
          ...acondicionados.filter((item) => item?.recepcionId !== registro.recepcionId),
        ];
        setAcondicionados(listaActualizada);
        guardarLista(CLAVE_ACONDICIONADO_PT, listaActualizada);
        const corteRelacionado = obtenerCortePorCodigoOp(formulario.codigoOp || "");

        await registrarIngresoProductosTerminados({
          recepcionId: formulario.recepcionId,
          fecha: formulario.fechaRecepcion,
          codigoOp: formulario.codigoOp,
          codigoSalida: formulario.codigoSalida,
          modeloId: corteRelacionado?.cabeceraCorte?.modeloId || "",
          codigoModelo: corteRelacionado?.cabeceraCorte?.codigoModelo || "",
          categoriaModelo: formulario.categoriaModelo,
          modeloCatalogo: formulario.modeloCatalogo,
          telaModelo: formulario.telaModelo,
          modelo: formulario.modelo,
          tipoTela: formulario.tipoTela,
          detalleRecepcion: convertirDetalleApto(formulario.detalle || []),
        });

        const rematesActuales = leerRemates();
        const detalleRemate = construirRemateDesdeIncidencias(formulario.incidencias || []);
        const registroRemate = {
          recepcionId: formulario.recepcionId,
          codigoOp: formulario.codigoOp,
          codigoSalida: formulario.codigoSalida,
          modelo: formulario.modelo,
          fechaRecepcion: formulario.fechaRecepcion,
          detalleRemate,
          totalRemate: resumenActual.totalRemate,
        };

        guardarLista(CLAVE_REMATES_PT, [
          registroRemate,
          ...rematesActuales.filter((item) => item?.recepcionId !== formulario.recepcionId),
        ]);

        advertenciaSincronizacion = await sincronizarDespuesDeCalidad();
      },
    });

    if (advertenciaSincronizacion) {
      await mostrarAlertaSistema(
        `La OP se guardo correctamente, pero la sincronizacion con Supabase quedo pendiente.\n\nDetalle: ${advertenciaSincronizacion}`,
        {
          titulo: "Guardado local completado",
          icono: "info",
          confirmarTexto: "Entendido",
        }
      );
    }
  };

  const revertirIngresoStock = async () => {
    if (!formulario.recepcionId) {
      await mostrarAlertaSistema("Carga primero una recepcion.");
      return;
    }

    if (!puedeAutorizarExcepcion) {
      await mostrarAlertaSistema(
        "Solo un usuario de gerencia o administrador puede revertir un ingreso a stock."
      );
      return;
    }

    const confirmarReversion = await confirmarAccionSistema(
      [
        `Se revertira el ingreso de la salida ${formulario.codigoSalida || "-"}.`,
        "Se descontara del stock normal y de lotes.",
        "Tambien se quitara el remate guardado de esta recepcion.",
        "La OP volvera a quedar abierta en calidad para corregirla.",
      ].join("\n"),
      {
        titulo: "Revertir ingreso a stock",
        icono: "warning",
        confirmarTexto: "Revertir",
        cancelarTexto: "Cancelar",
      }
    );

    if (!confirmarReversion) {
      return;
    }

    let advertenciaSincronizacion = "";
    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Revirtiendo ingreso a stock...",
      mensajeExito: "Ingreso revertido. La OP volvio a calidad para corregirla.",
      mensajeError: "No se pudo revertir el ingreso a stock.",
      accion: async () => {
        eliminarIngresosProductosTerminadosPorRecepciones({
          recepcionIds: [formulario.recepcionId],
        });
        reconstruirStockProductosTerminadosDesdeLotes();

        const rematesActuales = leerRemates().filter(
          (item) => item?.recepcionId !== formulario.recepcionId
        );
        guardarLista(CLAVE_REMATES_PT, rematesActuales);

        const listaAcondicionados = acondicionados.map((item) =>
          item?.recepcionId !== formulario.recepcionId
            ? item
            : {
                ...item,
                cerradoStock: false,
                cierreForzado: false,
                diferenciasControl: [],
                resumenDiferencias: "",
                autorizadoPor: "",
                rolAutorizador: "",
                fechaAutorizacion: "",
                estado: etiquetasCalidad.guardadoAvance,
                fechaAcondicionado: new Date().toISOString(),
              }
        );

        guardarLista(CLAVE_ACONDICIONADO_PT, listaAcondicionados);

        advertenciaSincronizacion = await sincronizarDespuesDeCalidad();
      },
    });

    if (advertenciaSincronizacion) {
      await mostrarAlertaSistema(
        `La reversion se guardo correctamente, pero la sincronizacion con Supabase quedo pendiente.\n\nDetalle: ${advertenciaSincronizacion}`,
        {
          titulo: "Guardado local completado",
          icono: "info",
          confirmarTexto: "Entendido",
        }
      );
    }
  };

  const totalPendientes = recepcionesDisponibles.length;
  const totalCompletas = acondicionados.filter((item) => item?.estado === "OP completa").length;
  const totalIncompletas = acondicionados.filter((item) => item?.estado === "OP incompleta").length;
  const totalRemate = acondicionados.filter((item) => item?.totalRemate > 0).length;
  const recepcionYaRegistrada = Boolean(
    acondicionados.find((item) => item?.recepcionId === formulario.recepcionId)?.cerradoStock
  );

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
          <h1>Control de calidad</h1>
          <p>
            Aqui Almacen revisa la OP ya recepcionada, dobla, clasifica incidencias de calidad
            y despues ingresa al stock normal solo lo apto para andamios.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>OP pendientes</span>
          <strong>{totalPendientes}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/almacen/producto-terminado" className="boton_volver">
          Volver a Almacen
        </Link>
      </div>

      <main className="contenido_principal">
        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Pendientes</span>
              <strong>{totalPendientes}</strong>
            </div>
            <div>
              <span>OP completas</span>
              <strong>{totalCompletas}</strong>
            </div>
            <div>
              <span>OP incompletas</span>
              <strong>{totalIncompletas}</strong>
            </div>
            <div>
              <span>Con remate</span>
              <strong>{totalRemate}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>{pestanaActiva === "pendientes" ? "Lista de OP para calidad" : "Historial de acondicionado"}</h2>
              <p>
                {pestanaActiva === "pendientes"
                  ? "Busca por OP, estado, modelo o taller."
                  : "Carga una OP ya acondicionada para actualizarla cuando regresen prendas arregladas."}
              </p>
            </div>
          </div>

          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaActiva === "pendientes" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("pendientes");
                setPaginaActual(1);
              }}
            >
              OP pendientes
            </button>
            <button
              type="button"
              className={`pestana ${pestanaActiva === "historial" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("historial");
                setPaginaActual(1);
              }}
            >
              Historial
            </button>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder=""
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>OP</th>
                  <th>Salida</th>
                  <th>Recepcion</th>
                  <th>Modelo</th>
                  <th>{pestanaActiva === "pendientes" ? "Estado" : "Estado final"}</th>
                  <th>{pestanaActiva === "pendientes" ? "Taller" : "Taller"}</th>
                  <th>{pestanaActiva === "pendientes" ? "Fecha recepcion" : "Fecha acondicionado"}</th>
                  <th>{pestanaActiva === "pendientes" ? "Total recibido" : "Apto"}</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {(pestanaActiva === "pendientes" ? recepcionesPaginadas : historialFiltrado).length === 0 ? (
                  <tr>
                    <td colSpan="9" className="sin_datos">
                      {pestanaActiva === "pendientes"
                        ? "Todavia no hay OP listas para calidad."
                        : "Todavia no hay OP guardadas en el historial."}
                    </td>
                  </tr>
                ) : (
                  (pestanaActiva === "pendientes" ? recepcionesPaginadas : historialFiltrado).map((item) => (
                    <tr key={item.recepcionId}>
                      <td>{item.codigoOp || "-"}</td>
                      <td>{item.codigoSalida || "-"}</td>
                      <td>{extraerCodigoRecepcionVisual(item.recepcionId, item.codigoSalida)}</td>
                      <td>{item.modelo || "-"}</td>
                      <td>
                        {pestanaActiva === "pendientes"
                          ? item.estadoLista || "-"
                          : resolverEstadoHistorialCalidad(item)}
                      </td>
                      <td>{item.nombreTaller || "-"}</td>
                      <td>
                        {pestanaActiva === "pendientes"
                          ? item.fechaRecepcion || "-"
                          : item.fechaAcondicionado
                            ? new Date(item.fechaAcondicionado).toLocaleDateString("es-PE")
                            : "-"}
                      </td>
                      <td>{pestanaActiva === "pendientes" ? item.totalRecibido || 0 : item.totalApto || 0}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn_principal btn_tabla"
                          onClick={() =>
                            pestanaActiva === "pendientes"
                              ? cargarRecepcion(item)
                              : cargarDesdeHistorial(item)
                          }
                        >
                          {pestanaActiva === "pendientes" ? "Cargar" : "Actualizar"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
              disabled={paginaActual === totalPaginas}
            >
              Siguiente
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Detalles de calidad</h2>
              <p>
                Recibido siempre debe ser igual a apto + incidencias de calidad. Las prendas
                observadas van abajo como remate, arreglo o devolucion por falla.
              </p>
            </div>
            <div className="acciones_encabezado_calidad">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setMostrarCantidadesOficiales(true)}
              >
                Ver cantidades oficiales
              </button>
              <span className={`chip_estado ${resumenActual.clase}`}>{resumenActual.texto}</span>
            </div>
          </div>

          <div className="grid_cabecera">
            <Campo>
              <label>OP</label>
              <input type="text" value={formulario.codigoOp} readOnly />
            </Campo>
            <Campo>
              <label>Salida</label>
              <input type="text" value={formulario.codigoSalida} readOnly />
            </Campo>
            <Campo>
              <label>Recepcion</label>
              <input
                type="text"
                value={extraerCodigoRecepcionVisual(formulario.recepcionId, formulario.codigoSalida)}
                readOnly
              />
            </Campo>
            <Campo className="campo-completo">
              <label>Modelo</label>
              <input type="text" value={formulario.modelo} readOnly />
            </Campo>
          </div>

          <div className="tabla_detalle_recepcion tabla_contenedor">
            <table className="tabla_operativa">
              <thead>
                <tr>
                  <th rowSpan="2" className="columna_color_recepcion columna_bloque_divisor">
                    Color
                  </th>
                  <th
                    colSpan={tallasActivasFormulario.length}
                    className="columna_grupo_recepcion columna_grupo_recepcion_divisor"
                  >
                    Totales recibidos
                  </th>
                  <th
                    colSpan={tallasActivasFormulario.length}
                    className="columna_grupo_recepcion columna_grupo_recepcion_divisor"
                  >
                    Apto para stock
                  </th>
                  <th colSpan={tallasActivasFormulario.length} className="columna_grupo_recepcion">
                    Incidencias de calidad
                  </th>
                </tr>
                <tr>
                  {tallasActivasFormulario.map((talla) => (
                    <th key={`rec-${talla}`} className="columna_plan_recepcion">
                      {talla}
                    </th>
                  ))}
                  {tallasActivasFormulario.map((talla) => (
                    <th key={`apto-${talla}`} className="columna_recibe_recepcion">
                      {talla}
                    </th>
                  ))}
                  {tallasActivasFormulario.map((talla) => (
                    <th key={`inc-${talla}`} className="columna_plan_recepcion">
                      {talla}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(formulario.detalle || []).length === 0 ? (
                  <tr>
                    <td colSpan={1 + tallasActivasFormulario.length * 3} className="fila_vacia">
                      Carga una OP para revisar su producto terminado.
                    </td>
                  </tr>
                ) : (
                  <>
                    {(formulario.detalle || []).map((fila) => (
                      <tr key={fila.id}>
                        <td className="celda_color_recepcion celda_bloque_divisor">
                          {fila.colorBase || "-"}
                        </td>
                        {tallasActivasFormulario.map((talla, indice) => (
                          <td
                            key={`${fila.id}-rec-${talla}`}
                            className={`celda_plan_recepcion ${
                              indice === tallasActivasFormulario.length - 1
                                ? "celda_bloque_divisor"
                                : ""
                            }`}
                          >
                            {normalizarNumero(fila?.recibido?.[talla])}
                          </td>
                        ))}
                        {tallasActivasFormulario.map((talla, indice) => (
                          <td
                            key={`${fila.id}-apto-${talla}`}
                            className={`celda_recibe_recepcion ${
                              indice === tallasActivasFormulario.length - 1
                                ? "celda_bloque_divisor"
                                : ""
                            }`}
                          >
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={fila?.apto?.[talla] ?? ""}
                              onChange={(evento) =>
                                actualizarCantidad(fila.id, talla, evento.target.value)
                              }
                              placeholder=""
                            />
                          </td>
                        ))}
                        {tallasActivasFormulario.map((talla) => (
                          <td key={`${fila.id}-inc-${talla}`} className="celda_plan_recepcion">
                            {obtenerCantidadIncidenciaColorTalla(
                              mapaIncidenciasActual,
                              fila?.colorBase,
                              talla
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="fila_total_calidad">
                      <td className="celda_color_recepcion celda_bloque_divisor">
                        Total oficial: {normalizarNumero(formulario.cantidadOficial)}
                      </td>
                      <td
                        colSpan={tallasActivasFormulario.length}
                        className="celda_plan_recepcion celda_bloque_divisor"
                      >
                        {resumenActual.totalRecibido}
                      </td>
                      <td
                        colSpan={tallasActivasFormulario.length}
                        className="celda_plan_recepcion celda_bloque_divisor"
                      >
                        {resumenActual.totalApto}
                      </td>
                      <td
                        colSpan={tallasActivasFormulario.length}
                        className="celda_plan_recepcion"
                      >
                        {resumenActual.totalIncidencias}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <section className="tarjeta tarjeta_interna">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Ajustes que vienen desde recepcion</h2>
                <p>
                  Aqui ves las mermas y descuentos por prenda que ya reducen lo que realmente debe ingresar al stock.
                </p>
              </div>
            </div>

          <div className="resumen__grid">
            <div>
              <span>Total merma</span>
              <strong>{totalMermaRecepcion}</strong>
            </div>
            <div>
              <span>Total descuento</span>
              <strong>{totalDescuentoRecepcion}</strong>
            </div>
          </div>

            <div className="tabla_contenedor">
              <table className="tabla_incidencias_recepcion">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {ajustesRecepcionResumen.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="fila_vacia">
                        Esta OP no trae mermas ni descuentos registrados desde recepcion.
                      </td>
                    </tr>
                  ) : (
                    ajustesRecepcionResumen.map((ajuste) => (
                      <tr key={ajuste.id}>
                        <td>{ajuste.tipo}</td>
                        <td>{ajuste.colorBase}</td>
                        <td>{ajuste.talla}</td>
                        <td>{ajuste.cantidad}</td>
                        <td>{ajuste.motivo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="tarjeta tarjeta_interna">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Incidencias de calidad</h2>
                <p>
                  Aqui registras remate, arreglo o devolucion por falla. Estas incidencias de calidad
                  completan la diferencia entre recibido y apto.
                </p>
              </div>
              <button type="button" className="btn btn_secundario" onClick={agregarIncidencia}>
                Agregar incidencia
              </button>
            </div>

            <div className="tabla_contenedor">
              <table className="tabla_incidencias_recepcion">
                <thead>
                  <tr>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Cantidad</th>
                    <th>Destino</th>
                    <th>Motivo</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {(formulario.incidencias || []).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="fila_vacia">
                        Esta OP todavia no tiene incidencias de calidad registradas.
                      </td>
                    </tr>
                  ) : (
                    (formulario.incidencias || []).map((incidencia) => (
                      <tr key={incidencia.id}>
                        <td>
                          <select
                            value={incidencia.colorBase}
                            onChange={(evento) =>
                              actualizarIncidencia(incidencia.id, "colorBase", evento.target.value)
                            }
                          >
                            <option value="">Selecciona</option>
                            {Array.from(
                              new Set(
                                (formulario.detalle || [])
                                  .map((fila) => fila?.colorBase || "")
                                  .filter(Boolean)
                              )
                            ).map((color) => (
                              <option key={`${incidencia.id}-${color}`} value={color}>
                                {color}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={incidencia.talla}
                            onChange={(evento) =>
                              actualizarIncidencia(incidencia.id, "talla", evento.target.value)
                            }
                          >
                            <option value="">Selecciona</option>
                            {tallasActivasFormulario.map((talla) => (
                              <option key={talla} value={talla}>
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
                              actualizarIncidencia(incidencia.id, "cantidad", evento.target.value)
                            }
                            placeholder=""
                          />
                        </td>
                        <td>
                          <select
                            value={incidencia.destino}
                            onChange={(evento) =>
                              actualizarIncidencia(incidencia.id, "destino", evento.target.value)
                            }
                          >
                            {DESTINOS_INCIDENCIA.map((destino) => (
                              <option key={destino} value={destino}>
                                {destino}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={incidencia.motivo}
                            onChange={(evento) =>
                              actualizarIncidencia(incidencia.id, "motivo", evento.target.value)
                            }
                            placeholder=""
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn_secundario btn_tabla"
                            onClick={() => quitarIncidencia(incidencia.id)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="resumen_ingreso_stock">
            <div className="resumen_ingreso_stock__encabezado">
              <div className="resumen_ingreso_stock__titulo">
                <div>
                  <h3>Resumen de ingreso a stock</h3>
                  <p>
                    Aqui ves cuanto ingresara al stock normal, cuanto se ira a remates y cuanto queda controlado en total.
                  </p>
                </div>
                <span className={`chip_estado ${resumenActual.clase}`}>{resumenActual.texto}</span>
              </div>
            </div>
            <div className="resumen_ingreso_stock__grid">
              <div>
                <span>Ingreso a stock normal</span>
                <strong>{resumenIngresoStock.totalApto}</strong>
              </div>
              <div>
                <span>Total incidencias</span>
                <strong>{resumenIngresoStock.totalIncidencias}</strong>
              </div>
              <div>
                <span>Ingreso a stock remate</span>
                <strong>{resumenIngresoStock.totalRemate}</strong>
              </div>
              <div>
                <span>Total controlado</span>
                <strong>{resumenIngresoStock.totalControlado}</strong>
              </div>
              <div>
                <span>Cantidad oficial OP</span>
                <strong>{resumenIngresoStock.cantidadOficial}</strong>
              </div>
            </div>
          </section>

          <Campo className="campo-completo">
            <label>Observacion general</label>
            <textarea
              value={formulario.observacion}
              onChange={(evento) =>
                setFormulario((anterior) => ({
                  ...anterior,
                  observacion: evento.target.value,
                }))
              }
              placeholder=""
            />
          </Campo>

          {!resumenActual.completo ? (
            <div className="alerta_diferencia_control">
              <strong>Faltan cantidades por cuadrar</strong>
              <p>
                {mensajeDiferenciasControl ||
                  "Revisa el conteo. Esta OP todavia no cuadra entre recibido, apto e incidencias de calidad."}
              </p>
            </div>
          ) : null}

          <div className="acciones">
            <button type="button" className="btn btn_secundario" onClick={guardarSoloAcondicionado}>
              Guardar
            </button>
            {recepcionYaRegistrada && puedeAutorizarExcepcion ? (
              <button
                type="button"
                className="btn btn_secundario"
                onClick={revertirIngresoStock}
              >
                Revertir ingreso a stock
              </button>
            ) : null}
            {!resumenActual.completo && puedeAutorizarExcepcion ? (
              <button
                type="button"
                className="btn btn_secundario"
                onClick={autorizarIngresoConObservacion}
              >
                Autorizar ingreso con observacion
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn_principal"
              onClick={guardarAcondicionado}
              title={
                resumenActual.completo
                  ? ""
                  : "Primero debe cuadrar recibido = apto + incidencias de calidad, o una gerencia/admin debe autorizar la excepcion."
              }
            >
              {recepcionYaRegistrada ? "Actualizar OP" : "Ingresar a stock"}
            </button>
          </div>
        </section>

        {mostrarCantidadesOficiales ? (
          <div
            className="overlay_detalle_calidad"
            onClick={() => setMostrarCantidadesOficiales(false)}
          >
            <div
              className="modal_detalle_calidad"
              onClick={(evento) => evento.stopPropagation()}
            >
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Cantidades oficiales de la OP</h2>
                  <p>
                    Aqui ves la referencia oficial por color y talla para corroborar el control de calidad.
                  </p>
                </div>
              </div>

              <div className="tabla_contenedor">
                <table className="tabla_operativa">
                  <thead>
                    <tr>
                      <th>Color</th>
                      {tallasActivasFormulario.map((talla) => (
                        <th key={`oficial-${talla}`}>{talla}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formulario.detalleOficial || []).length === 0 ? (
                      <tr>
                        <td colSpan={tallasActivasFormulario.length + 2} className="fila_vacia">
                          Esta OP todavia no tiene cantidades oficiales cargadas.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {(formulario.detalleOficial || []).map((fila) => (
                          <tr key={`oficial-${fila.id}`}>
                            <td>{fila.colorBase || "-"}</td>
                            {tallasActivasFormulario.map((talla) => (
                              <td key={`oficial-${fila.id}-${talla}`}>
                                {normalizarNumero(fila?.recibido?.[talla])}
                              </td>
                            ))}
                            <td>
                              {tallasActivasFormulario.reduce(
                                (total, talla) => total + normalizarNumero(fila?.recibido?.[talla]),
                                0
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="fila_total_calidad">
                          <td>Total oficial</td>
                          {tallasActivasFormulario.map((talla) => (
                            <td key={`oficial-total-${talla}`}>
                              {(formulario.detalleOficial || []).reduce(
                                (total, fila) => total + normalizarNumero(fila?.recibido?.[talla]),
                                0
                              )}
                            </td>
                          ))}
                          <td>{normalizarNumero(formulario.cantidadOficial)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="acciones">
                <button
                  type="button"
                  className="btn btn_principal"
                  onClick={() => setMostrarCantidadesOficiales(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
  .tarjeta__encabezado p,
  .sin_datos {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.6;
  }

  .cabecera__estado {
    min-width: 180px;
    padding: 16px 18px;
    border-radius: 16px;
    background: rgba(117, 1, 152, 0.12);
    border: 1px solid rgba(117, 1, 152, 0.24);
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
    color: ${({ theme }) => theme.bg5};
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

  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 20px;
    padding: 20px;
  }

  .tarjeta_interna {
    margin-top: 18px;
    padding: 18px;
    background: ${({ theme }) => theme.bgtotal};
  }

  .resumen__grid,
  .grid_cabecera {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .resumen__grid div {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg2};
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

  .alerta_diferencia_control {
    border: 1px solid rgba(214, 146, 32, 0.4);
    background: rgba(214, 146, 32, 0.12);
    border-radius: 16px;
    padding: 14px 16px;
  }

  .alerta_diferencia_control strong {
    display: block;
    color: #f0c36a;
    font-size: 15px;
  }

  .alerta_diferencia_control p {
    margin: 8px 0 0;
    color: ${({ theme }) => theme.text};
    line-height: 1.6;
  }

  .fila_total_calidad td {
    font-weight: 800;
    background: rgba(255, 255, 255, 0.04);
  }

  .tarjeta__encabezado {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .acciones_encabezado_calidad {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .pestanas {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 14px;
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

  .buscador {
    margin-bottom: 16px;
  }

  .buscador input,
  input,
  textarea,
  select {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  textarea {
    min-height: 90px;
    resize: vertical;
  }

  .tabla_contenedor {
    margin-top: 16px;
    overflow: auto;
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
    min-width: 980px;
  }

  .tabla_operativa {
    min-width: 1360px;
  }

  th,
  td {
    padding: 12px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  td {
    color: #ffffff;
    font-size: 14px;
  }

  .fila_vacia,
  .sin_datos {
    text-align: center;
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
    border-right: 1px solid rgba(230, 205, 238, 0.18);
  }

  .columna_plan_recepcion,
  .columna_recibe_recepcion {
    min-width: 58px;
    text-align: center;
    font-size: 12px;
  }

  .celda_color_recepcion {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    white-space: nowrap;
  }

  .celda_plan_recepcion {
    text-align: center;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
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
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 8px;
    padding: 8px 10px;
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
  }

  .chip_estado {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 120px;
    padding: 8px 12px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 12px;
  }

  .estado_pendiente {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .estado_observado {
    background: rgba(255, 122, 89, 0.12);
    color: #ff9f85;
    border: 1px solid rgba(255, 122, 89, 0.35);
  }

  .estado_parcial {
    background: rgba(100, 196, 255, 0.12);
    color: #9fdcff;
    border: 1px solid rgba(100, 196, 255, 0.35);
  }

  .estado_aprobado {
    background: rgba(78, 201, 140, 0.12);
    color: #86e0ad;
    border: 1px solid rgba(78, 201, 140, 0.35);
  }

  .resumen_ingreso_stock {
    border: 1px solid rgba(168, 85, 247, 0.24);
    background: rgba(24, 24, 27, 0.88);
    border-radius: 20px;
    padding: 18px;
    display: grid;
    gap: 16px;
  }

  .resumen_ingreso_stock__encabezado {
    display: grid;
    gap: 6px;
  }

  .resumen_ingreso_stock__titulo {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .resumen_ingreso_stock__encabezado h3 {
    margin: 0;
    font-size: 1.02rem;
    color: #ffffff;
  }

  .resumen_ingreso_stock__encabezado p {
    margin: 0;
    color: rgba(226, 232, 240, 0.82);
    font-size: 0.95rem;
  }

  .resumen_ingreso_stock__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .resumen_ingreso_stock__grid div {
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.34);
    padding: 14px 16px;
    display: grid;
    gap: 6px;
  }

  .resumen_ingreso_stock__grid span {
    font-size: 0.84rem;
    color: rgba(226, 232, 240, 0.76);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .resumen_ingreso_stock__grid strong {
    font-size: 1.38rem;
    color: #ffffff;
  }

  .acciones,
  .paginacion {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .boton_volver,
  .btn {
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
    background: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .btn_tabla {
    width: 100%;
  }

  .overlay_detalle_calidad {
    position: fixed;
    inset: 0;
    z-index: 1200;
    background: rgba(5, 7, 14, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
  }

  .modal_detalle_calidad {
    width: min(960px, 100%);
    max-height: 85vh;
    overflow-y: auto;
    border-radius: 22px;
    background: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 22px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;

const Campo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
  }
`;




