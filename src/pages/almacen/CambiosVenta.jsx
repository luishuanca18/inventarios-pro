import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {
  leerProductosTerminados,
  registrarAjusteProductoTerminado,
  registrarSalidaProductosTerminados,
} from "../../utils/productosTerminados";
import { leerConfiguracionVentasImpresion } from "../../utils/configuracionVentasImpresion";
import {
  leerListaPreciosProductos,
  obtenerPrecioVentaProducto,
} from "../../utils/preciosProductos";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import {
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  calcularSiguienteCorrelativoSistemaConfiguracion,
  registrarUsoCorrelativoSistemaConfiguracion,
} from "../../supabase/configuracionCore.js";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_VENTAS_ALMACEN_PT = "cynara_ventas_almacen_pt";
const CLAVE_CAMBIOS_VENTA_PT = "cynara_cambios_venta_pt";
const CLAVE_CAJA_CAMBIOS_VENTA_PT = "cynara_caja_cambios_venta_pt";
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

const guardarLista = (clave, lista = []) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

const obtenerFechaActual = () => {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const construirCodigoConCorrelativo = (prefijo, fechaBase, correlativo) => {
  const fecha = new Date();
  if (fechaBase) {
    const [anio, mes, dia] = fechaBase.split("-");
    fecha.setFullYear(Number(anio || fecha.getFullYear()));
    fecha.setMonth(Math.max(0, Number(mes || 1) - 1));
    fecha.setDate(Number(dia || 1));
  }
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yy = String(fecha.getFullYear()).slice(-2);
  return `${prefijo}${dd}${mm}${yy}-${String(correlativo).padStart(2, "0")}`;
};

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const formatearMonto = (valor) =>
  `S/ ${convertirNumero(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatearFechaImpresion = (fecha = "") => {
  if (!fecha || !fecha.includes("-")) return fecha || "-";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
};

const escaparHtml = (valor = "") =>
  valor
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizarTexto = (valor = "") => valor.toString().trim().toLowerCase();

const crearFormularioCambio = () => ({
  id: "",
  ventaId: "",
  fecha: obtenerFechaActual(),
  cliente: "",
  tipoDocumentoOrigen: "",
  serieDocumentoOrigen: "",
  numeroDocumentoOrigen: "",
  observacion: "",
  detalleDevuelve: [],
  detalleEntrega: [],
});

const crearNumeroNotaCambio = (historial = [], configuracion = {}) => {
  const serie = configuracion?.serieNotaCambio || "NCI001";
  const base = convertirNumero(configuracion?.correlativoInicial || 1);
  const siguiente = base + (Array.isArray(historial) ? historial.length : 0);
  return `${serie}-${String(siguiente).padStart(6, "0")}`;
};

const abrirImpresionNotaCambio = (cambio, configuracion = {}) => {
  if (!cambio) return;

  const anchoTicket = configuracion?.anchoPapel === "58" ? 58 : 80;
  const anchoCaja = anchoTicket === 58 ? 300 : 380;
  const detalleDevuelveHtml = (cambio.detalleDevuelve || [])
    .map(
      (item) => `
        <tr>
          <td>${escaparHtml(item.modelo || "-")}</td>
          <td>${escaparHtml(item.colorBase || "-")}</td>
          <td>${escaparHtml(item.talla || "-")}</td>
          <td style="text-align:center;">${convertirNumero(item.cantidadDevuelve)}</td>
          <td style="text-align:right;">${escaparHtml(formatearMonto(item.precioUnitarioOriginal))}</td>
        </tr>
      `
    )
    .join("");
  const detalleEntregaHtml = (cambio.detalleEntrega || [])
    .map(
      (item) => `
        <tr>
          <td>${escaparHtml(item.modelo || "-")}</td>
          <td>${escaparHtml(item.colorBase || "-")}</td>
          <td>${escaparHtml(item.talla || "-")}</td>
          <td style="text-align:center;">${convertirNumero(item.cantidadEntrega)}</td>
          <td style="text-align:right;">${escaparHtml(formatearMonto(item.precioUnitarioNuevo))}</td>
        </tr>
      `
    )
    .join("");

  const estadoDiferencia =
    cambio.diferencia > 0
      ? "COBRAR ADICIONAL"
      : cambio.diferencia < 0
        ? "SALDO A FAVOR"
        : "SIN DIFERENCIA";

  const html = `
    <html>
      <head>
        <title>${escaparHtml(cambio.notaInternaCambio || "NOTA INTERNA DE CAMBIO")}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111111;
          }
          .ticket {
            width: ${anchoCaja}px;
            margin: 0 auto;
            padding: 12px 14px 20px;
            box-sizing: border-box;
          }
          .centro { text-align: center; }
          .titulo { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
          .subtitulo { font-size: 12px; margin-bottom: 2px; }
          .bloque { margin-top: 12px; }
          .linea {
            border-top: 1px dashed #333;
            margin: 10px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          th, td {
            padding: 4px 0;
            vertical-align: top;
            border-bottom: 1px solid #e3e3e3;
          }
          th {
            text-align: left;
            font-size: 10px;
          }
          .resumen td {
            border: none;
            padding: 3px 0;
          }
          .resumen td:last-child {
            text-align: right;
            font-weight: 700;
          }
          .etiqueta {
            font-size: 11px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .nota {
            font-size: 11px;
            line-height: 1.45;
          }
          @media print {
            body { margin: 0; }
            .ticket { width: 100%; }
          }
        </style>
      </head>
      <body onload="window.print();window.close();">
        <div class="ticket">
          <div class="centro">
            <div class="titulo">${escaparHtml(configuracion?.nombreComercial || "CORPORACION CYNARA")}</div>
            ${configuracion?.razonSocial ? `<div class="subtitulo">${escaparHtml(configuracion.razonSocial)}</div>` : ""}
            ${configuracion?.ruc ? `<div class="subtitulo">RUC: ${escaparHtml(configuracion.ruc)}</div>` : ""}
            ${configuracion?.direccion ? `<div class="subtitulo">${escaparHtml(configuracion.direccion)}</div>` : ""}
            ${configuracion?.telefono ? `<div class="subtitulo">Tel: ${escaparHtml(configuracion.telefono)}</div>` : ""}
          </div>

          <div class="linea"></div>

          <div class="centro">
            <div class="titulo" style="font-size:16px;">NOTA INTERNA DE CAMBIO</div>
            <div class="subtitulo">${escaparHtml(cambio.notaInternaCambio || "-")}</div>
          </div>

          <div class="bloque nota">
            <div><strong>Fecha:</strong> ${escaparHtml(formatearFechaImpresion(cambio.fecha))}</div>
            <div><strong>Cliente:</strong> ${escaparHtml(cambio.cliente || "-")}</div>
            <div><strong>Documento origen:</strong> ${escaparHtml(
              [cambio.tipoDocumentoOrigen, cambio.serieDocumentoOrigen, cambio.numeroDocumentoOrigen]
                .filter(Boolean)
                .join(" / ") || "-"
            )}</div>
            <div><strong>Venta origen:</strong> ${escaparHtml(cambio.ventaId || "-")}</div>
          </div>

          <div class="linea"></div>

          <div class="bloque">
            <div class="etiqueta">PRENDAS QUE DEVUELVE</div>
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Color</th>
                  <th>Talla</th>
                  <th style="text-align:center;">Cant.</th>
                  <th style="text-align:right;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${detalleDevuelveHtml || '<tr><td colspan="5">Sin prendas devueltas.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="bloque">
            <div class="etiqueta">PRENDAS QUE SE ENTREGA</div>
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Color</th>
                  <th>Talla</th>
                  <th style="text-align:center;">Cant.</th>
                  <th style="text-align:right;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${detalleEntregaHtml || '<tr><td colspan="5">Sin prendas entregadas.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="linea"></div>

          <table class="resumen">
            <tr>
              <td>Valor devuelve</td>
              <td>${escaparHtml(formatearMonto(cambio.totalDevuelve))}</td>
            </tr>
            <tr>
              <td>Valor entrega</td>
              <td>${escaparHtml(formatearMonto(cambio.totalEntrega))}</td>
            </tr>
            <tr>
              <td>${escaparHtml(estadoDiferencia)}</td>
              <td>${escaparHtml(formatearMonto(Math.abs(convertirNumero(cambio.diferencia))))}</td>
            </tr>
            <tr>
              <td>Ingresa a caja</td>
              <td>${escaparHtml(formatearMonto(cambio.montoIngresoCaja))}</td>
            </tr>
          </table>

          ${
            cambio.observacion
              ? `<div class="bloque nota"><strong>Observacion:</strong> ${escaparHtml(cambio.observacion)}</div>`
              : ""
          }

          <div class="linea"></div>

          <div class="centro nota">
            ${configuracion?.mensajePie1 ? `<div>${escaparHtml(configuracion.mensajePie1)}</div>` : ""}
            ${configuracion?.mensajePie2 ? `<div>${escaparHtml(configuracion.mensajePie2)}</div>` : ""}
          </div>
        </div>
      </body>
    </html>
  `;

  const ventana = window.open("", "_blank", "width=520,height=760");
  if (!ventana) {
    mostrarErrorSistema("No se pudo abrir la vista de impresion. Revisa si el navegador bloqueo la ventana.");
    return;
  }
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
};

export function CambiosVenta() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [versionDatos, setVersionDatos] = useState(0);
  const [paginaVentas, setPaginaVentas] = useState(1);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [paginaCaja, setPaginaCaja] = useState(1);
  const [formulario, setFormulario] = useState(crearFormularioCambio);
  const [cambioVistaPrevia, setCambioVistaPrevia] = useState(null);
  const [configCambioVenta, setConfigCambioVenta] = useState(null);
  const configuracionVenta = useMemo(() => leerConfiguracionVentasImpresion(), []);
  const listaPrecios = useMemo(() => leerListaPreciosProductos(), [versionDatos]);

  const ventas = useMemo(
    () =>
      leerListaGuardada(CLAVE_VENTAS_ALMACEN_PT).sort((a, b) =>
        String(b?.fecha || "").localeCompare(String(a?.fecha || ""))
      ),
    [versionDatos]
  );
  const historialCambios = useMemo(
    () =>
      leerListaGuardada(CLAVE_CAMBIOS_VENTA_PT).sort((a, b) =>
        String(b?.fecha || "").localeCompare(String(a?.fecha || ""))
      ),
    [versionDatos]
  );
  const productos = useMemo(() => leerProductosTerminados(), [versionDatos]);
  const movimientosCaja = useMemo(
    () =>
      leerListaGuardada(CLAVE_CAJA_CAMBIOS_VENTA_PT).sort((a, b) =>
        String(b?.fecha || "").localeCompare(String(a?.fecha || ""))
      ),
    [versionDatos]
  );
  const numeroNotaCambioPreview = useMemo(
    () => crearNumeroNotaCambio(historialCambios, configuracionVenta),
    [configuracionVenta, historialCambios]
  );

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const resultado = await calcularSiguienteCorrelativoSistemaConfiguracion({
          clave: "CAMBIO_VENTA",
          fecha: obtenerFechaActual(),
          codigos: historialCambios.map((item) => ({
            codigo: item?.id || "",
            fecha: item?.fecha || "",
          })),
        });
        if (!activo) return;
        setConfigCambioVenta(resultado?.configuracion || null);
      } catch (error) {
        console.error("No se pudo cargar el correlativo de cambios de venta:", error.message);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, [historialCambios]);

  const ventasFiltradas = useMemo(() => {
    const texto = normalizarTexto(busqueda);
    return ventas.filter(
      (venta) =>
        !texto ||
        [
          venta?.id,
          venta?.fecha,
          venta?.cliente,
          venta?.canal,
          venta?.observacion,
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto)
    );
  }, [busqueda, ventas]);

  const productosFiltrados = useMemo(() => {
    const texto = normalizarTexto(busqueda);
    return productos.filter(
      (item) =>
        Number(item?.stockActual || 0) > 0 &&
        (!texto ||
          [
            item?.codigoCorto,
            item?.modelo,
            item?.colorBase,
            item?.talla,
          ]
            .join(" ")
            .toLowerCase()
            .includes(texto))
    );
  }, [busqueda, productos]);

  useEffect(() => {
    setPaginaVentas(1);
  }, [busqueda, versionDatos]);

  useEffect(() => {
    setPaginaHistorial(1);
    setPaginaCaja(1);
  }, [versionDatos]);

  const totalPaginasVentas = Math.max(
    1,
    Math.ceil(ventasFiltradas.length / FILAS_POR_PAGINA)
  );
  const totalPaginasHistorial = Math.max(
    1,
    Math.ceil(historialCambios.length / FILAS_POR_PAGINA)
  );
  const totalPaginasCaja = Math.max(
    1,
    Math.ceil(movimientosCaja.length / FILAS_POR_PAGINA)
  );

  const ventasPagina = ventasFiltradas.slice(
    (paginaVentas - 1) * FILAS_POR_PAGINA,
    paginaVentas * FILAS_POR_PAGINA
  );
  const historialPagina = historialCambios.slice(
    (paginaHistorial - 1) * FILAS_POR_PAGINA,
    paginaHistorial * FILAS_POR_PAGINA
  );
  const cajaPagina = movimientosCaja.slice(
    (paginaCaja - 1) * FILAS_POR_PAGINA,
    paginaCaja * FILAS_POR_PAGINA
  );

  const cargarVenta = (venta) => {
    setFormulario({
      id: "",
      ventaId: venta?.id || "",
      fecha: obtenerFechaActual(),
      cliente: venta?.cliente || "",
      tipoDocumentoOrigen: venta?.tipoComprobante || "NOTA DE VENTA",
      serieDocumentoOrigen: venta?.serieComprobante || "",
      numeroDocumentoOrigen: venta?.numeroComprobante || venta?.id || "",
      observacion: "",
      detalleDevuelve: (venta?.detalle || []).map((item, indice) => ({
        id: `${venta?.id}-dev-${indice + 1}`,
        claveProducto: item?.claveProducto || "",
        codigoCorto: item?.codigoCorto || "",
        codigoProducto: item?.codigoProducto || "",
        modelo: item?.modelo || "",
        colorBase: item?.colorBase || "",
        talla: item?.talla || "",
        cantidadOriginal: convertirNumero(item?.cantidadAtendida),
        cantidadDevuelve: "0",
        precioUnitarioOriginal: convertirNumero(item?.precioUnitario),
      })),
      detalleEntrega: [],
    });
  };

  const actualizarDevuelve = (id, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      detalleDevuelve: (anterior.detalleDevuelve || []).map((item) =>
        item.id !== id ? item : { ...item, cantidadDevuelve: valor }
      ),
    }));
  };

  const agregarEntrega = (producto) => {
    setFormulario((anterior) => {
      if ((anterior.detalleEntrega || []).some((item) => item.claveProducto === producto.claveProducto)) {
        return anterior;
      }

      return {
        ...anterior,
        detalleEntrega: [
          ...(anterior.detalleEntrega || []),
          {
            claveProducto: producto.claveProducto,
            codigoCorto: producto.codigoCorto || "",
            codigoProducto: producto.codigoProducto || "",
            modelo: producto.modelo || "",
            colorBase: producto.colorBase || "",
            talla: producto.talla || "",
            stockActual: convertirNumero(producto.stockActual),
            cantidadEntrega: "1",
            precioUnitarioNuevo: String(
              obtenerPrecioVentaProducto({
                modelo: producto.modelo,
                talla: producto.talla,
                lista: listaPrecios,
              }) || ""
            ),
          },
        ],
      };
    });
  };

  const actualizarEntrega = (claveProducto, campo, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      detalleEntrega: (anterior.detalleEntrega || []).map((item) =>
        item.claveProducto !== claveProducto ? item : { ...item, [campo]: valor }
      ),
    }));
  };

  const quitarEntrega = (claveProducto) => {
    setFormulario((anterior) => ({
      ...anterior,
      detalleEntrega: (anterior.detalleEntrega || []).filter(
        (item) => item.claveProducto !== claveProducto
      ),
    }));
  };

  const resumenCambio = useMemo(() => {
    const totalDevuelve = (formulario.detalleDevuelve || []).reduce(
      (total, item) =>
        total +
        convertirNumero(item?.cantidadDevuelve) *
          convertirNumero(item?.precioUnitarioOriginal),
      0
    );

    const totalEntrega = (formulario.detalleEntrega || []).reduce(
      (total, item) =>
        total +
        convertirNumero(item?.cantidadEntrega) *
          convertirNumero(item?.precioUnitarioNuevo),
      0
    );

    return {
      totalDevuelve,
      totalEntrega,
      diferencia: totalEntrega - totalDevuelve,
    };
  }, [formulario.detalleDevuelve, formulario.detalleEntrega]);

  const guardarCambio = async () => {
    if (!formulario.ventaId) {
      mostrarAlertaSistema("Carga primero una venta.");
      return;
    }

    const detalleDevuelve = (formulario.detalleDevuelve || [])
      .map((item) => ({
        ...item,
        cantidadDevuelve: convertirNumero(item?.cantidadDevuelve),
      }))
      .filter((item) => item.cantidadDevuelve > 0);

    const detalleEntrega = (formulario.detalleEntrega || [])
      .map((item) => ({
        ...item,
        cantidadEntrega: convertirNumero(item?.cantidadEntrega),
        precioUnitarioNuevo: convertirNumero(item?.precioUnitarioNuevo),
      }))
      .filter((item) => item.cantidadEntrega > 0);

    if (detalleDevuelve.length === 0 && detalleEntrega.length === 0) {
      mostrarAlertaSistema("Registra al menos una prenda devuelta o entregada.");
      return;
    }

    if (
      detalleDevuelve.some(
        (item) => item.cantidadDevuelve > convertirNumero(item?.cantidadOriginal)
      )
    ) {
      mostrarAlertaSistema("No puedes devolver mas de lo que salio en la venta original.");
      return;
    }

    if (
      detalleEntrega.some(
        (item) =>
          item.cantidadEntrega > convertirNumero(item?.stockActual) ||
          item.precioUnitarioNuevo <= 0
      )
    ) {
      mostrarAlertaSistema("Revisa cantidades y precios de las prendas entregadas.");
      return;
    }

    const historialActual = leerListaGuardada(CLAVE_CAMBIOS_VENTA_PT);
    const correlativoCambio = (
      await calcularSiguienteCorrelativoSistemaConfiguracion({
        clave: "CAMBIO_VENTA",
        fecha: formulario.fecha,
        codigos: historialActual.map((item) => ({
          codigo: item?.id || "",
          fecha: item?.fecha || "",
        })),
      })
    ).correlativo;
    const cambioId = construirCodigoConCorrelativo(
      configCambioVenta?.prefijo || "CVT",
      formulario.fecha,
      correlativoCambio,
    );

    detalleDevuelve.forEach((item, indice) => {
      const productoActual = leerProductosTerminados().find(
        (producto) => producto?.claveProducto === item.claveProducto
      );
      if (!productoActual) return;

      registrarAjusteProductoTerminado({
        ajusteId: `${cambioId}-DEV-${indice + 1}`,
        fecha: formulario.fecha,
        motivoAjuste: "CAMBIO VENTA DEVOLUCION",
        observacionAjuste: [
          formulario.ventaId,
          formulario.cliente,
          formulario.observacion,
        ]
          .filter(Boolean)
          .join(" | "),
        producto: productoActual,
        stockFisico:
          convertirNumero(productoActual?.stockActual) + item.cantidadDevuelve,
      });
    });

    if (detalleEntrega.length > 0) {
      registrarSalidaProductosTerminados({
        salidaId: `CAMBIO-${cambioId}`,
        pedidoId: formulario.ventaId,
        fecha: formulario.fecha,
        tienda: "CAMBIO VENTA",
        observacion: [formulario.cliente, formulario.observacion]
          .filter(Boolean)
          .join(" | "),
        detalleSalida: detalleEntrega.map((item) => ({
          ...item,
          cantidadAtendida: item.cantidadEntrega,
        })),
      });
    }

    const notaInternaCambio = crearNumeroNotaCambio(
      historialActual,
      configuracionVenta
    );
    const montoIngresoCaja = Math.max(0, resumenCambio.diferencia);
    const montoSalidaCaja = Math.max(0, resumenCambio.diferencia * -1);
    const cambioRegistro = {
      id: cambioId,
      ventaId: formulario.ventaId,
      fecha: formulario.fecha,
      cliente: formulario.cliente,
      tipoDocumentoOrigen: formulario.tipoDocumentoOrigen || "NOTA DE VENTA",
      serieDocumentoOrigen: formulario.serieDocumentoOrigen || "",
      numeroDocumentoOrigen:
        formulario.numeroDocumentoOrigen || formulario.ventaId || "",
      notaInternaCambio,
      tipoDocumentoCambio: "NOTA INTERNA DE CAMBIO",
      observacion: formulario.observacion,
      detalleDevuelve,
      detalleEntrega,
      totalDevuelve: resumenCambio.totalDevuelve,
      totalEntrega: resumenCambio.totalEntrega,
      diferencia: resumenCambio.diferencia,
      montoIngresoCaja,
      montoSalidaCaja,
      estadoDiferencia:
        resumenCambio.diferencia > 0
          ? "COBRAR ADICIONAL"
          : resumenCambio.diferencia < 0
            ? "SALDO A FAVOR"
            : "SIN DIFERENCIA",
    };

    guardarLista(CLAVE_CAMBIOS_VENTA_PT, [cambioRegistro, ...historialActual]);
    if (montoIngresoCaja > 0 || montoSalidaCaja > 0) {
      const historialCaja = leerListaGuardada(CLAVE_CAJA_CAMBIOS_VENTA_PT);
      guardarLista(CLAVE_CAJA_CAMBIOS_VENTA_PT, [
        {
          id: `CJ-${cambioRegistro.id}`,
          fecha: formulario.fecha,
          ventaId: formulario.ventaId,
          cambioId: cambioRegistro.id,
          notaInternaCambio,
          cliente: formulario.cliente,
          tipoMovimiento: montoIngresoCaja > 0 ? "INGRESO CAMBIO" : "SALIDA CAMBIO",
          monto: montoIngresoCaja > 0 ? montoIngresoCaja : montoSalidaCaja,
          observacion: formulario.observacion || "Cambio vinculado a documento emitido",
        },
        ...historialCaja,
      ]);
    }
    setFormulario(crearFormularioCambio());
    setVersionDatos((anterior) => anterior + 1);
    await registrarUsoCorrelativoSistemaConfiguracion({
      clave: "CAMBIO_VENTA",
      fecha: formulario.fecha,
      correlativo: correlativoCambio,
    });
    mostrarNotificacionCarga("Cambio de venta registrado con nota interna.");
  };

  const imprimirCambio = (cambio) => {
    abrirImpresionNotaCambio(cambio, configuracionVenta);
  };

  const abrirVistaPrevia = (cambio) => {
    setCambioVistaPrevia(cambio);
  };

  const cerrarVistaPrevia = () => {
    setCambioVistaPrevia(null);
  };

  const anchoVistaPrevia = configuracionVenta?.anchoPapel === "58" ? "320px" : "420px";

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
          <h1>Cambios de venta</h1>
          <p>
            Aqui Almacen registra cambios de color, talla o modelo sin borrar la venta original y dejando clara la diferencia de dinero.
          </p>
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
              <span>Ventas registradas</span>
              <strong>{ventas.length}</strong>
            </div>
            <div>
              <span>Cambios registrados</span>
              <strong>{historialCambios.length}</strong>
            </div>
            <div>
              <span>Valor devuelto</span>
              <strong>{formatearMonto(resumenCambio.totalDevuelve)}</strong>
            </div>
            <div>
              <span>Valor entregado</span>
              <strong>{formatearMonto(resumenCambio.totalEntrega)}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar venta, cliente, modelo, color o talla"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Documento</th>
                  <th>Fecha</th>
                  <th>Canal</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.length === 0 ? (
                  <tr><td colSpan="7" className="sin_datos">No hay ventas para cargar.</td></tr>
                ) : (
                  ventasPagina.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{[item.tipoComprobante, item.serieComprobante].filter(Boolean).join(" / ") || "-"}</td>
                      <td>{item.fecha || "-"}</td>
                      <td>{item.canal || "-"}</td>
                      <td>{item.cliente || "-"}</td>
                      <td>{formatearMonto(item.totalVenta)}</td>
                      <td>
                        <button type="button" className="btn btn_secundario" onClick={() => cargarVenta(item)}>
                          Cargar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {ventasFiltradas.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaVentas((actual) => Math.max(1, actual - 1))}
                disabled={paginaVentas === 1}
              >
                Anterior
              </button>
              <span>
                Pagina {paginaVentas} de {totalPaginasVentas}
              </span>
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaVentas((actual) =>
                    Math.min(totalPaginasVentas, actual + 1)
                  )
                }
                disabled={paginaVentas === totalPaginasVentas}
              >
                Siguiente
              </button>
            </div>
          ) : null}

          <div className="grid_cabecera">
            <Campo><label>Venta original</label><input value={formulario.ventaId} readOnly /></Campo>
            <Campo><label>Documento origen</label><input value={[formulario.tipoDocumentoOrigen, formulario.serieDocumentoOrigen, formulario.numeroDocumentoOrigen].filter(Boolean).join(" / ")} readOnly /></Campo>
            <Campo><label>Nota interna cambio</label><input value={numeroNotaCambioPreview} readOnly /></Campo>
            <Campo><label>Fecha cambio</label><input type="date" value={formulario.fecha} onChange={(evento) => setFormulario((anterior) => ({ ...anterior, fecha: evento.target.value }))} /></Campo>
            <Campo><label>Cliente</label><input value={formulario.cliente} onChange={(evento) => setFormulario((anterior) => ({ ...anterior, cliente: evento.target.value.toUpperCase() }))} /></Campo>
            <Campo className="campo-completo"><label>Observacion</label><input value={formulario.observacion} onChange={(evento) => setFormulario((anterior) => ({ ...anterior, observacion: evento.target.value }))} /></Campo>
          </div>

          <div className="subbloque">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Prendas que devuelve el cliente</h2>
                <p>Si cambia color o talla del mismo precio, registra aqui lo que regresa.</p>
              </div>
            </div>
            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Modelo</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Vendio</th>
                    <th>P. unitario</th>
                    <th>Devuelve</th>
                  </tr>
                </thead>
                <tbody>
                  {(formulario.detalleDevuelve || []).length === 0 ? (
                    <tr><td colSpan="7" className="sin_datos">Carga una venta para empezar.</td></tr>
                  ) : (
                    formulario.detalleDevuelve.map((item) => (
                      <tr key={item.id}>
                        <td>{item.codigoCorto || "-"}</td>
                        <td>{item.modelo || "-"}</td>
                        <td>{item.colorBase || "-"}</td>
                        <td>{item.talla || "-"}</td>
                        <td>{item.cantidadOriginal}</td>
                        <td>{formatearMonto(item.precioUnitarioOriginal)}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={item.cantidadOriginal}
                            value={item.cantidadDevuelve}
                            onChange={(evento) => actualizarDevuelve(item.id, evento.target.value)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="subbloque">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Prendas nuevas que salen</h2>
                <p>Si cambia a otro modelo mas caro o mas barato, aqui sale la nueva prenda y el sistema calcula la diferencia.</p>
              </div>
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Modelo</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Stock</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.length === 0 ? (
                    <tr><td colSpan="6" className="sin_datos">No hay prendas disponibles con ese filtro.</td></tr>
                  ) : (
                    productosFiltrados.map((item) => (
                      <tr key={item.claveProducto || item.id}>
                        <td>{item.codigoCorto || "-"}</td>
                        <td>{item.modelo || "-"}</td>
                        <td>{item.colorBase || "-"}</td>
                        <td>{item.talla || "-"}</td>
                        <td>{convertirNumero(item.stockActual)}</td>
                        <td>
                          <button type="button" className="btn btn_secundario" onClick={() => agregarEntrega(item)}>
                            Agregar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Modelo</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Stock</th>
                    <th>Entrega</th>
                    <th>P. unitario</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {(formulario.detalleEntrega || []).length === 0 ? (
                    <tr><td colSpan="8" className="sin_datos">Todavia no agregaste prendas nuevas.</td></tr>
                  ) : (
                    formulario.detalleEntrega.map((item) => (
                      <tr key={item.claveProducto}>
                        <td>{item.codigoCorto || "-"}</td>
                        <td>{item.modelo || "-"}</td>
                        <td>{item.colorBase || "-"}</td>
                        <td>{item.talla || "-"}</td>
                        <td>{item.stockActual}</td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            max={item.stockActual}
                            value={item.cantidadEntrega}
                            onChange={(evento) =>
                              actualizarEntrega(item.claveProducto, "cantidadEntrega", evento.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.precioUnitarioNuevo}
                            onChange={(evento) =>
                              actualizarEntrega(item.claveProducto, "precioUnitarioNuevo", evento.target.value)
                            }
                          />
                        </td>
                        <td>
                          <button type="button" className="btn btn_secundario" onClick={() => quitarEntrega(item.claveProducto)}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="resumen_cambio">
            <div>
              <span>Valor devuelve</span>
              <strong>{formatearMonto(resumenCambio.totalDevuelve)}</strong>
            </div>
            <div>
              <span>Valor entrega</span>
              <strong>{formatearMonto(resumenCambio.totalEntrega)}</strong>
            </div>
            <div>
              <span>Diferencia</span>
              <strong>{formatearMonto(resumenCambio.diferencia)}</strong>
              <small>
                {resumenCambio.diferencia > 0
                  ? "Cobrar adicional"
                  : resumenCambio.diferencia < 0
                    ? "Saldo a favor"
                    : "Sin diferencia"}
              </small>
            </div>
            <div>
              <span>Ingresa a caja</span>
              <strong>{formatearMonto(Math.max(0, resumenCambio.diferencia))}</strong>
              <small>Solo entra el adicional del cambio, no una venta nueva completa.</small>
            </div>
          </div>

          <div className="acciones">
            <button type="button" className="btn btn_principal" onClick={guardarCambio}>
              Guardar cambio de venta
            </button>
          </div>

          <div className="subbloque">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Historial de cambios vinculados</h2>
                <p>
                  Aqui ves la boleta o factura origen, la nota interna del cambio y solo el dinero adicional que entro o salio por caja.
                </p>
              </div>
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Nota interna</th>
                    <th>Documento origen</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Ingresa caja</th>
                    <th>Sale caja</th>
                    <th>Estado</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {historialCambios.length === 0 ? (
                    <tr><td colSpan="8" className="sin_datos">Todavia no hay cambios registrados.</td></tr>
                  ) : (
                    historialPagina.map((item) => (
                      <tr key={item.id}>
                        <td>{item.notaInternaCambio || "-"}</td>
                        <td>
                          {[item.tipoDocumentoOrigen, item.serieDocumentoOrigen, item.numeroDocumentoOrigen]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </td>
                        <td>{item.fecha || "-"}</td>
                        <td>{item.cliente || "-"}</td>
                        <td>{formatearMonto(item.montoIngresoCaja)}</td>
                        <td>{formatearMonto(item.montoSalidaCaja)}</td>
                        <td>{item.estadoDiferencia || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn_secundario"
                            onClick={() => abrirVistaPrevia(item)}
                          >
                            Vista previa
                          </button>
                          <button
                            type="button"
                            className="btn btn_secundario btn_inline"
                            onClick={() => imprimirCambio(item)}
                          >
                            Imprimir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {historialCambios.length > FILAS_POR_PAGINA ? (
              <div className="paginacion">
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => setPaginaHistorial((actual) => Math.max(1, actual - 1))}
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
                    setPaginaHistorial((actual) =>
                      Math.min(totalPaginasHistorial, actual + 1)
                    )
                  }
                  disabled={paginaHistorial === totalPaginasHistorial}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>

          <div className="subbloque">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Movimientos de caja por cambios</h2>
                <p>
                  Este bloque solo registra la diferencia de los cambios vinculados a boleta o factura.
                </p>
              </div>
            </div>
            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Movimiento</th>
                    <th>Fecha</th>
                    <th>Nota interna</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosCaja.length === 0 ? (
                    <tr><td colSpan="6" className="sin_datos">Todavia no hay movimientos de caja por cambios.</td></tr>
                  ) : (
                    cajaPagina.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.fecha || "-"}</td>
                        <td>{item.notaInternaCambio || "-"}</td>
                        <td>{item.cliente || "-"}</td>
                        <td>{item.tipoMovimiento || "-"}</td>
                        <td>{formatearMonto(item.monto)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {movimientosCaja.length > FILAS_POR_PAGINA ? (
              <div className="paginacion">
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => setPaginaCaja((actual) => Math.max(1, actual - 1))}
                  disabled={paginaCaja === 1}
                >
                  Anterior
                </button>
                <span>
                  Pagina {paginaCaja} de {totalPaginasCaja}
                </span>
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() =>
                    setPaginaCaja((actual) =>
                      Math.min(totalPaginasCaja, actual + 1)
                    )
                  }
                  disabled={paginaCaja === totalPaginasCaja}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      {cambioVistaPrevia ? (
        <div className="modal_fondo" onClick={cerrarVistaPrevia}>
          <div className="modal_contenido" onClick={(evento) => evento.stopPropagation()}>
            <div className="modal_encabezado">
              <div>
                <h2>Vista previa nota interna</h2>
                <p>
                  Revisa la nota antes de mandarla a imprimir.
                </p>
              </div>
              <button type="button" className="btn btn_secundario" onClick={cerrarVistaPrevia}>
                Cerrar
              </button>
            </div>

            <div className="ticket_preview" style={{ width: anchoVistaPrevia }}>
              <div className="ticket_centro">
                <div className="ticket_titulo">
                  {configuracionVenta?.nombreComercial || "CORPORACION CYNARA"}
                </div>
                {configuracionVenta?.razonSocial ? (
                  <div className="ticket_subtitulo">{configuracionVenta.razonSocial}</div>
                ) : null}
                {configuracionVenta?.ruc ? (
                  <div className="ticket_subtitulo">RUC: {configuracionVenta.ruc}</div>
                ) : null}
                {configuracionVenta?.direccion ? (
                  <div className="ticket_subtitulo">{configuracionVenta.direccion}</div>
                ) : null}
                {configuracionVenta?.telefono ? (
                  <div className="ticket_subtitulo">Tel: {configuracionVenta.telefono}</div>
                ) : null}
              </div>

              <div className="ticket_linea" />

              <div className="ticket_centro">
                <div className="ticket_titulo ticket_titulo_secundario">
                  NOTA INTERNA DE CAMBIO
                </div>
                <div className="ticket_subtitulo">
                  {cambioVistaPrevia.notaInternaCambio || "-"}
                </div>
              </div>

              <div className="ticket_bloque ticket_texto">
                <div><strong>Fecha:</strong> {formatearFechaImpresion(cambioVistaPrevia.fecha)}</div>
                <div><strong>Cliente:</strong> {cambioVistaPrevia.cliente || "-"}</div>
                <div>
                  <strong>Documento origen:</strong>{" "}
                  {[cambioVistaPrevia.tipoDocumentoOrigen, cambioVistaPrevia.serieDocumentoOrigen, cambioVistaPrevia.numeroDocumentoOrigen]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </div>
                <div><strong>Venta origen:</strong> {cambioVistaPrevia.ventaId || "-"}</div>
              </div>

              <div className="ticket_linea" />

              <div className="ticket_bloque">
                <div className="ticket_etiqueta">PRENDAS QUE DEVUELVE</div>
                <table className="ticket_tabla">
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Cant.</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cambioVistaPrevia.detalleDevuelve || []).length === 0 ? (
                      <tr><td colSpan="5">Sin prendas devueltas.</td></tr>
                    ) : (
                      cambioVistaPrevia.detalleDevuelve.map((item, indice) => (
                        <tr key={`${cambioVistaPrevia.id}-dev-preview-${indice + 1}`}>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td className="ticket_celda_centro">{convertirNumero(item.cantidadDevuelve)}</td>
                          <td className="ticket_celda_derecha">{formatearMonto(item.precioUnitarioOriginal)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ticket_bloque">
                <div className="ticket_etiqueta">PRENDAS QUE SE ENTREGA</div>
                <table className="ticket_tabla">
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Cant.</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cambioVistaPrevia.detalleEntrega || []).length === 0 ? (
                      <tr><td colSpan="5">Sin prendas entregadas.</td></tr>
                    ) : (
                      cambioVistaPrevia.detalleEntrega.map((item, indice) => (
                        <tr key={`${cambioVistaPrevia.id}-ent-preview-${indice + 1}`}>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td className="ticket_celda_centro">{convertirNumero(item.cantidadEntrega)}</td>
                          <td className="ticket_celda_derecha">{formatearMonto(item.precioUnitarioNuevo)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ticket_linea" />

              <table className="ticket_resumen">
                <tbody>
                  <tr>
                    <td>Valor devuelve</td>
                    <td>{formatearMonto(cambioVistaPrevia.totalDevuelve)}</td>
                  </tr>
                  <tr>
                    <td>Valor entrega</td>
                    <td>{formatearMonto(cambioVistaPrevia.totalEntrega)}</td>
                  </tr>
                  <tr>
                    <td>
                      {cambioVistaPrevia.diferencia > 0
                        ? "COBRAR ADICIONAL"
                        : cambioVistaPrevia.diferencia < 0
                          ? "SALDO A FAVOR"
                          : "SIN DIFERENCIA"}
                    </td>
                    <td>{formatearMonto(Math.abs(convertirNumero(cambioVistaPrevia.diferencia)))}</td>
                  </tr>
                  <tr>
                    <td>Ingresa a caja</td>
                    <td>{formatearMonto(cambioVistaPrevia.montoIngresoCaja)}</td>
                  </tr>
                </tbody>
              </table>

              {cambioVistaPrevia.observacion ? (
                <div className="ticket_bloque ticket_texto">
                  <strong>Observacion:</strong> {cambioVistaPrevia.observacion}
                </div>
              ) : null}

              <div className="ticket_linea" />

              <div className="ticket_centro ticket_texto">
                {configuracionVenta?.mensajePie1 ? <div>{configuracionVenta.mensajePie1}</div> : null}
                {configuracionVenta?.mensajePie2 ? <div>{configuracionVenta.mensajePie2}</div> : null}
              </div>
            </div>

            <div className="modal_acciones">
              <button
                type="button"
                className="btn btn_principal"
                onClick={() => imprimirCambio(cambioVistaPrevia)}
              >
                Imprimir nota
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

  .cabecera,
  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 20px;
    border-radius: 20px;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .cabecera p,
  .tarjeta p,
  .sin_datos {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.6;
  }

  .fila_superior {
    display: flex;
    justify-content: flex-start;
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

  .btn_inline {
    margin-left: 8px;
  }

  .contenido_principal {
    display: grid;
    gap: 16px;
  }

  .resumen__grid,
  .grid_cabecera,
  .resumen_cambio {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .resumen__grid div,
  .resumen_cambio div {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg2};
  }

  .resumen__grid span,
  .resumen_cambio span {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
  }

  .resumen__grid strong,
  .resumen_cambio strong {
    display: block;
    margin-top: 6px;
    color: ${({ theme }) => theme.text};
    font-size: 20px;
  }

  .resumen_cambio small {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .buscador,
  .subbloque,
  .acciones,
  .grid_cabecera {
    margin-top: 16px;
  }

  .grid_cabecera .campo-completo {
    grid-column: 1 / -1;
  }

  input {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  .tabla_contenedor {
    margin-top: 16px;
    overflow: auto;
  }

  .paginacion {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 14px;
    flex-wrap: wrap;
    color: ${({ theme }) => theme.text};
  }

  .modal_fondo {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    z-index: 1200;
  }

  .modal_contenido {
    width: min(920px, 100%);
    max-height: 92vh;
    overflow: auto;
    background: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 22px;
    padding: 18px;
  }

  .modal_encabezado {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .modal_acciones {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .ticket_preview {
    margin: 0 auto;
    background: #ffffff;
    color: #111111;
    border-radius: 14px;
    padding: 14px 16px 18px;
    box-sizing: border-box;
  }

  .ticket_centro {
    text-align: center;
  }

  .ticket_titulo {
    font-size: 18px;
    font-weight: 800;
    margin-bottom: 4px;
  }

  .ticket_titulo_secundario {
    font-size: 16px;
  }

  .ticket_subtitulo {
    font-size: 12px;
    margin-bottom: 2px;
  }

  .ticket_linea {
    border-top: 1px dashed #333333;
    margin: 10px 0;
  }

  .ticket_bloque {
    margin-top: 12px;
  }

  .ticket_texto {
    font-size: 11px;
    line-height: 1.45;
  }

  .ticket_etiqueta {
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .ticket_tabla,
  .ticket_resumen {
    width: 100%;
    border-collapse: collapse;
    min-width: 0;
    font-size: 11px;
  }

  .ticket_tabla th,
  .ticket_tabla td {
    color: #111111;
    border-bottom: 1px solid #e3e3e3;
    padding: 5px 0;
    font-size: 11px;
  }

  .ticket_tabla th {
    font-size: 10px;
  }

  .ticket_celda_centro {
    text-align: center;
  }

  .ticket_celda_derecha {
    text-align: right;
  }

  .ticket_resumen td {
    color: #111111;
    border: none;
    padding: 4px 0;
    font-size: 11px;
  }

  .ticket_resumen td:last-child {
    text-align: right;
    font-weight: 700;
  }

  table {
    width: 100%;
    min-width: 980px;
    border-collapse: collapse;
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

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}

  @media (max-width: 720px) {
    .modal_encabezado {
      flex-direction: column;
    }

    .btn_inline {
      margin-left: 0;
      margin-top: 8px;
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
`;
