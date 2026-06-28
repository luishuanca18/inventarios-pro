import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Header } from "../../index";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import {
  leerMovimientosTienda,
  leerStockTiendas,
  leerVentasTienda,
  registrarVentaTiendaRapida,
  resumirStockTiendaPorModelo,
} from "../../utils/stockTiendas";
import {
  formatearResumenTarifario,
  leerListaPreciosProductos,
} from "../../utils/preciosProductos";
import {
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";
import { VERSION_SISTEMA } from "../../utils/versionSistema";
import {
  calcularSiguienteCorrelativoSistemaConfiguracion,
  registrarUsoCorrelativoSistemaConfiguracion,
} from "../../supabase/configuracionCore.js";
import { resolverIdentidadVisualPorRuta } from "../../utils/identidadVisual";

const CLAVE_PEDIDOS_TIENDA = "cynara_pedidos_tienda";
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

const obtenerFechaActual = () => {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const crearFormularioPedido = () => ({
  id: "",
  tienda: "",
  fechaSolicitud: obtenerFechaActual(),
  observacion: "",
  detalle: [],
});

const crearFormularioVenta = () => ({
  id: "",
  tienda: "",
  fecha: obtenerFechaActual(),
  cliente: "",
  observacion: "",
  detalle: [],
});

const formatearSoles = (valor) =>
  `S/ ${Number(valor || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function Tiendas() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadModulo = resolverIdentidadVisualPorRuta("/tiendas");
  const [pestanaActiva, setPestanaActiva] = useState("pedidos");
  const [busqueda, setBusqueda] = useState("");
  const [paginaStock, setPaginaStock] = useState(1);
  const [paginaPedidos, setPaginaPedidos] = useState(1);
  const [paginaVentas, setPaginaVentas] = useState(1);
  const [paginaControl, setPaginaControl] = useState(1);
  const [formularioPedido, setFormularioPedido] = useState(crearFormularioPedido);
  const [formularioVenta, setFormularioVenta] = useState(crearFormularioVenta);
  const [pedidos, setPedidos] = useState(() => leerListaGuardada(CLAVE_PEDIDOS_TIENDA));
  const [stockTienda, setStockTienda] = useState(leerStockTiendas);
  const [movimientosTienda, setMovimientosTienda] = useState(leerMovimientosTienda);
  const [ventasTienda, setVentasTienda] = useState(leerVentasTienda);
  const [configPedidoTienda, setConfigPedidoTienda] = useState(null);
  const [configVentaTienda, setConfigVentaTienda] = useState(null);
  const listaPrecios = useMemo(() => leerListaPreciosProductos(), []);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const [pedidoCfg, ventaCfg] = await Promise.all([
          calcularSiguienteCorrelativoSistemaConfiguracion({
            clave: "SALIDA_TIENDA",
            fecha: obtenerFechaActual(),
            codigos: pedidos.map((item) => ({
              codigo: item?.id || "",
              fecha: item?.fechaSolicitud || "",
            })),
          }),
          calcularSiguienteCorrelativoSistemaConfiguracion({
            clave: "VENTA_TIENDA",
            fecha: obtenerFechaActual(),
            codigos: ventasTienda.map((item) => ({
              codigo: item?.id || "",
              fecha: item?.fecha || "",
            })),
          }),
        ]);
        if (!activo) return;
        setConfigPedidoTienda(pedidoCfg?.configuracion || null);
        setConfigVentaTienda(ventaCfg?.configuracion || null);
      } catch (error) {
        console.error("No se pudieron cargar los correlativos de tiendas:", error.message);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, [pedidos, ventasTienda]);

  const stockPorModelo = useMemo(() => resumirStockTiendaPorModelo(), [stockTienda]);

  const movimientosIngresoTienda = useMemo(
    () =>
      movimientosTienda.filter((item) => item?.tipoMovimiento === "INGRESO_TIENDA"),
    [movimientosTienda]
  );

  const movimientosVentaDetallada = useMemo(
    () =>
      movimientosTienda.filter((item) =>
        ["VENTA_TIENDA", "VENTA_TIENDA_RAPIDA"].includes(item?.tipoMovimiento)
      ),
    [movimientosTienda]
  );

  const stockFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return stockPorModelo.filter(
      (item) =>
        !texto ||
        [item?.tienda, item?.modelo, ...(item?.colores || []), ...(item?.tallas || [])]
          .join(" ")
          .toLowerCase()
          .includes(texto)
    );
  }, [busqueda, stockPorModelo]);

  const historialVentas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return ventasTienda.filter(
      (item) =>
        !texto ||
        [item?.id, item?.tienda, item?.fecha, item?.cliente]
          .join(" ")
          .toLowerCase()
          .includes(texto)
    );
  }, [busqueda, ventasTienda]);

  const pedidosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pedidos.filter(
      (item) =>
        !texto ||
        [item?.id, item?.tienda, item?.fechaSolicitud, item?.estado]
          .join(" ")
          .toLowerCase()
          .includes(texto)
    );
  }, [busqueda, pedidos]);

  const modelosMasVendidos = useMemo(() => {
    const mapa = new Map();
    ventasTienda.forEach((venta) => {
      (venta?.detalleVenta || []).forEach((detalle) => {
        const clave = (detalle?.modelo || "").toString().trim().toUpperCase();
        if (!clave) return;
        mapa.set(clave, Number(mapa.get(clave) || 0) + Number(detalle?.cantidadVendida || 0));
      });
    });

    return Array.from(mapa.entries())
      .map(([modelo, total]) => ({ modelo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [ventasTienda]);

  const productosMasDespachados = useMemo(() => {
    const mapa = new Map();
    movimientosIngresoTienda.forEach((movimiento) => {
        const clave = `${movimiento?.modelo || ""}|${movimiento?.colorBase || ""}|${movimiento?.talla || ""}`;
        const actual = mapa.get(clave) || {
          modelo: movimiento?.modelo || "",
          colorBase: movimiento?.colorBase || "",
          talla: movimiento?.talla || "",
          total: 0,
        };
        actual.total += Number(movimiento?.cantidad || 0);
        mapa.set(clave, actual);
      });

    return Array.from(mapa.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [movimientosIngresoTienda]);

  const controlInventarioDetallado = useMemo(() => {
    const mapa = new Map();

    const asegurarRegistro = ({
      tienda = "",
      modelo = "",
      colorBase = "",
      talla = "",
    }) => {
      const clave = [tienda, modelo, colorBase, talla].join("|").toUpperCase();
      const actual = mapa.get(clave) || {
        id: clave,
        tienda,
        modelo,
        colorBase,
        talla,
        stockSistema: 0,
        ingresosAlmacen: 0,
        ventasTienda: 0,
      };
      mapa.set(clave, actual);
      return actual;
    };

    stockTienda.forEach((item) => {
      const actual = asegurarRegistro(item || {});
      actual.stockSistema += Number(item?.stockActual || 0);
    });

    movimientosIngresoTienda.forEach((movimiento) => {
      const actual = asegurarRegistro(movimiento || {});
      actual.ingresosAlmacen += Number(movimiento?.cantidad || 0);
    });

    movimientosVentaDetallada.forEach((movimiento) => {
      const actual = asegurarRegistro(movimiento || {});
      actual.ventasTienda += Number(movimiento?.cantidad || 0);
    });

    return Array.from(mapa.values())
      .map((item) => {
        const stockInicialEstimado =
          Number(item?.stockSistema || 0) -
          Number(item?.ingresosAlmacen || 0) +
          Number(item?.ventasTienda || 0);

        return {
          ...item,
          stockInicialEstimado,
          estado:
            stockInicialEstimado < 0
              ? "REVISAR"
              : Number(item?.stockSistema || 0) <= 0
                ? "AGOTADO"
                : "CON STOCK",
        };
      })
      .sort((a, b) =>
        `${a.tienda}${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
          `${b.tienda}${b.modelo}${b.colorBase}${b.talla}`
        )
      );
  }, [movimientosIngresoTienda, movimientosVentaDetallada, stockTienda]);

  const controlFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return controlInventarioDetallado.filter(
      (item) =>
        !texto ||
        [item?.tienda, item?.modelo, item?.colorBase, item?.talla, item?.estado]
          .join(" ")
          .toLowerCase()
          .includes(texto)
    );
  }, [busqueda, controlInventarioDetallado]);
  const totalPaginasStock = Math.max(1, Math.ceil(stockFiltrado.length / FILAS_POR_PAGINA));
  const totalPaginasPedidos = Math.max(1, Math.ceil(pedidosFiltrados.length / FILAS_POR_PAGINA));
  const totalPaginasVentas = Math.max(1, Math.ceil(historialVentas.length / FILAS_POR_PAGINA));
  const totalPaginasControl = Math.max(1, Math.ceil(controlFiltrado.length / FILAS_POR_PAGINA));
  const stockPagina = useMemo(() => {
    const inicio = (paginaStock - 1) * FILAS_POR_PAGINA;
    return stockFiltrado.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [stockFiltrado, paginaStock]);
  const pedidosPagina = useMemo(() => {
    const inicio = (paginaPedidos - 1) * FILAS_POR_PAGINA;
    return pedidosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [pedidosFiltrados, paginaPedidos]);
  const ventasPagina = useMemo(() => {
    const inicio = (paginaVentas - 1) * FILAS_POR_PAGINA;
    return historialVentas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [historialVentas, paginaVentas]);
  const controlPagina = useMemo(() => {
    const inicio = (paginaControl - 1) * FILAS_POR_PAGINA;
    return controlFiltrado.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [controlFiltrado, paginaControl]);

  const resumenControl = useMemo(() => {
    return controlFiltrado.reduce(
      (acumulado, item) => ({
        stockSistema: acumulado.stockSistema + Number(item?.stockSistema || 0),
        ingresosAlmacen: acumulado.ingresosAlmacen + Number(item?.ingresosAlmacen || 0),
        ventasTienda: acumulado.ventasTienda + Number(item?.ventasTienda || 0),
      }),
      {
        stockSistema: 0,
        ingresosAlmacen: 0,
        ventasTienda: 0,
      }
    );
  }, [controlFiltrado]);

  const agregarModeloPedido = (item) => {
    setFormularioPedido((anterior) => {
      if ((anterior.detalle || []).some((detalle) => detalle.id === item.id)) {
        return anterior;
      }

      return {
        ...anterior,
        detalle: [
          ...(anterior.detalle || []),
          {
            id: item.id,
            tienda: item.tienda,
            modelo: item.modelo,
            stockTotal: Number(item.stockTotal || 0),
            cantidadSolicitada: "1",
          },
        ],
      };
    });
  };

  const actualizarCantidadPedido = (id, valor) => {
    setFormularioPedido((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).map((item) =>
        item.id !== id ? item : { ...item, cantidadSolicitada: valor }
      ),
    }));
  };

  const quitarModeloPedido = (id) => {
    setFormularioPedido((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).filter((item) => item.id !== id),
    }));
  };

  const guardarPedido = async () => {
    if (!formularioPedido.tienda.trim()) {
      mostrarAlertaSistema("Completa el nombre de tienda.");
      return;
    }

    if ((formularioPedido.detalle || []).length === 0) {
      mostrarAlertaSistema("Agrega al menos un modelo al pedido.");
      return;
    }

    const detalleNormalizado = (formularioPedido.detalle || []).map((item) => ({
      ...item,
      cantidadSolicitada: Number(item?.cantidadSolicitada || 0),
    }));

    const correlativoPedido = formularioPedido.id
      ? Number((formularioPedido.id.split("-")[1] || "0").trim())
      : (
          await calcularSiguienteCorrelativoSistemaConfiguracion({
            clave: "SALIDA_TIENDA",
            fecha: formularioPedido.fechaSolicitud,
            codigos: pedidos.map((item) => ({
              codigo: item?.id || "",
              fecha: item?.fechaSolicitud || "",
            })),
          })
        ).correlativo;

    const pedido = {
      id:
        formularioPedido.id ||
        construirCodigoConCorrelativo(
          configPedidoTienda?.prefijo || "TIE",
          formularioPedido.fechaSolicitud,
          correlativoPedido,
        ),
      tienda: formularioPedido.tienda.toUpperCase(),
      fechaSolicitud: formularioPedido.fechaSolicitud,
      observacion: formularioPedido.observacion,
      detalle: detalleNormalizado,
      estado: "PENDIENTE",
      fechaActualizacion: new Date().toISOString(),
      tipoPedido: "RESUMIDO_POR_MODELO",
    };

    const listaActualizada = [
      pedido,
      ...pedidos.filter((item) => item?.id !== pedido.id),
    ];

    setPedidos(listaActualizada);
    guardarLista(CLAVE_PEDIDOS_TIENDA, listaActualizada);
    setFormularioPedido(crearFormularioPedido());
    await registrarUsoCorrelativoSistemaConfiguracion({
      clave: "SALIDA_TIENDA",
      fecha: pedido.fechaSolicitud,
      correlativo: correlativoPedido,
    });
    mostrarNotificacionCarga(formularioPedido.id ? "Pedido actualizado." : "Pedido guardado.");
  };

  const agregarModeloVenta = (item) => {
    setFormularioVenta((anterior) => {
      if ((anterior.detalle || []).some((detalle) => detalle.id === item.id)) {
        return anterior;
      }

      return {
        ...anterior,
        tienda: anterior.tienda || item.tienda || "",
        detalle: [
          ...(anterior.detalle || []),
          {
            id: item.id,
            tienda: item.tienda,
            modelo: item.modelo,
            stockTotal: Number(item.stockTotal || 0),
            cantidadVendida: "1",
          },
        ],
      };
    });
  };

  const actualizarCantidadVenta = (id, valor) => {
    setFormularioVenta((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).map((item) =>
        item.id !== id ? item : { ...item, cantidadVendida: valueOrZero(valor) }
      ),
    }));
  };

  const quitarModeloVenta = (id) => {
    setFormularioVenta((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).filter((item) => item.id !== id),
    }));
  };

  const registrarVentaRapida = async () => {
    if (!formularioVenta.tienda.trim()) {
      mostrarAlertaSistema("Completa la tienda.");
      return;
    }

    if ((formularioVenta.detalle || []).length === 0) {
      mostrarAlertaSistema("Agrega al menos un modelo a la venta.");
      return;
    }

    const detalleNormalizado = (formularioVenta.detalle || []).map((item) => ({
      modelo: item.modelo,
      cantidadVendida: Number(item?.cantidadVendida || 0),
    }));

    if (detalleNormalizado.some((item) => item.cantidadVendida <= 0)) {
      mostrarAlertaSistema("Todas las cantidades vendidas deben ser mayores a cero.");
      return;
    }

    const correlativoVenta = formularioVenta.id
      ? Number((formularioVenta.id.split("-")[1] || "0").trim())
      : (
          await calcularSiguienteCorrelativoSistemaConfiguracion({
            clave: "VENTA_TIENDA",
            fecha: formularioVenta.fecha,
            codigos: ventasTienda.map((item) => ({
              codigo: item?.id || "",
              fecha: item?.fecha || "",
            })),
          })
        ).correlativo;

    registrarVentaTiendaRapida({
      ventaId:
        formularioVenta.id ||
        construirCodigoConCorrelativo(
          configVentaTienda?.prefijo || "VTI",
          formularioVenta.fecha,
          correlativoVenta,
        ),
      tienda: formularioVenta.tienda,
      fecha: formularioVenta.fecha,
      cliente: formularioVenta.cliente,
      observacion: formularioVenta.observacion,
      detalleVenta: detalleNormalizado,
    });

    setStockTienda(leerStockTiendas());
    setMovimientosTienda(leerMovimientosTienda());
    setVentasTienda(leerVentasTienda());
    setFormularioVenta(crearFormularioVenta());
    await registrarUsoCorrelativoSistemaConfiguracion({
      clave: "VENTA_TIENDA",
      fecha: formularioVenta.fecha,
      correlativo: correlativoVenta,
    });
    mostrarNotificacionCarga("Venta rapida registrada.");
  };

  const totalPendientes = pedidos.filter((item) => item?.estado !== "COMPLETO").length;

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
          <h1>Tiendas</h1>
          <p>
            Aqui Tienda puede trabajar rapido: pedir por modelo general, vender por
            modelo general y revisar su stock detallado que viene desde Almacen.
          </p>
          <small className="version_actual">{VERSION_SISTEMA} | Tiendas</small>
        </div>

        <div className="cabecera__estado">
          <span>Pedidos pendientes</span>
          <strong>{totalPendientes}</strong>
        </div>
      </section>

      <main className="contenido_principal">
        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Modelos con stock</span>
              <strong>{stockPorModelo.length}</strong>
            </div>
            <div>
              <span>Pedidos pendientes</span>
              <strong>{totalPendientes}</strong>
            </div>
            <div>
              <span>Ventas registradas</span>
              <strong>{ventasTienda.length}</strong>
            </div>
            <div>
              <span>Movimientos de tienda</span>
              <strong>{movimientosTienda.length}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta ayuda_visual">
          <div className="ayuda_visual__grid">
            <div className="ayuda_visual__item">
              <span>Venta rapida</span>
              <strong>Solo por modelo general</strong>
              <small>La vendedora no se frena con color y talla en cada venta.</small>
            </div>
            <div className="ayuda_visual__item">
              <span>Stock de tienda</span>
              <strong>Detallado por color y talla</strong>
              <small>Eso sigue llegando desde Almacen y se conserva para conteo.</small>
            </div>
            <div className="ayuda_visual__item">
              <span>Control</span>
              <strong>Ingreso Almacen - venta tienda</strong>
              <small>Luego puedes contar un modelo puntual y comparar contra sistema.</small>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="pestanas">
            <button type="button" className={`pestana ${pestanaActiva === "pedidos" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("pedidos")}>
              Pedido a almacen
            </button>
            <button type="button" className={`pestana ${pestanaActiva === "stock" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("stock")}>
              Stock de tienda
            </button>
            <button type="button" className={`pestana ${pestanaActiva === "venta" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("venta")}>
              Venta rapida
            </button>
            <button type="button" className={`pestana ${pestanaActiva === "control" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("control")}>
              Control
            </button>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder=""
            />
          </div>

          {pestanaActiva === "pedidos" ? (
            <>
              <div className="grid_cabecera">
                <Campo><label>Pedido tienda</label><input type="text" value={formularioPedido.id || "Nuevo"} readOnly /></Campo>
                <Campo><label>Tienda</label><input type="text" value={formularioPedido.tienda} onChange={(e) => setFormularioPedido((a) => ({ ...a, tienda: e.target.value.toUpperCase() }))} /></Campo>
                <Campo><label>Fecha solicitud</label><input type="date" value={formularioPedido.fechaSolicitud} onChange={(e) => setFormularioPedido((a) => ({ ...a, fechaSolicitud: e.target.value }))} /></Campo>
                <Campo className="campo-completo"><label>Observacion</label><textarea value={formularioPedido.observacion} onChange={(e) => setFormularioPedido((a) => ({ ...a, observacion: e.target.value }))} /></Campo>
              </div>

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Modelos disponibles para pedir</h2>
                    <p>
                      Aqui Tienda solo trabaja con el modelo general. El detalle de color y talla ya queda en Almacen.
                    </p>
                  </div>
                </div>

                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Tienda</th>
                        <th>Modelo general</th>
                        <th>Stock total</th>
                        <th>Precios</th>
                        <th>Colores</th>
                        <th>Tallas</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockFiltrado.length === 0 ? (
                        <tr><td colSpan="7" className="sin_datos">No hay stock disponible con ese filtro.</td></tr>
                      ) : (
                        stockFiltrado.map((item) => (
                          <tr key={item.id}>
                            <td>{item.tienda || "-"}</td>
                            <td>{item.modelo || "-"}</td>
                            <td>{Number(item.stockTotal || 0)}</td>
                            <td>{formatearResumenTarifario(item.modelo, listaPrecios)}</td>
                            <td>{(item.colores || []).join(", ") || "-"}</td>
                            <td>{(item.tallas || []).join(", ") || "-"}</td>
                            <td>
                              <button type="button" className="btn btn_principal btn_tabla" onClick={() => agregarModeloPedido(item)}>
                                Agregar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Detalle del pedido</h2>
                    <p>La tienda solo pide el modelo general y la cantidad.</p>
                  </div>
                </div>

                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Tienda</th>
                        <th>Modelo general</th>
                        <th>Stock total</th>
                        <th>Tarifa ref.</th>
                        <th>Solicita</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formularioPedido.detalle || []).length === 0 ? (
                        <tr><td colSpan="6" className="sin_datos">Todavia no agregaste modelos al pedido.</td></tr>
                      ) : (
                        formularioPedido.detalle.map((item) => (
                          <tr key={item.id}>
                            <td>{item.tienda || "-"}</td>
                            <td>{item.modelo || "-"}</td>
                            <td>{Number(item.stockTotal || 0)}</td>
                            <td>{formatearResumenTarifario(item.modelo, listaPrecios)}</td>
                            <td className="celda_input">
                              <input type="number" min="1" max={Number(item.stockTotal || 0)} value={item.cantidadSolicitada} onChange={(e) => actualizarCantidadPedido(item.id, e.target.value)} />
                            </td>
                            <td>
                              <button type="button" className="btn btn_secundario btn_tabla" onClick={() => quitarModeloPedido(item.id)}>
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

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Historial de pedidos</h2>
                    <p>Los pedidos quedan resumidos por modelo general para no frenar la atencion.</p>
                  </div>
                </div>
                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Tienda</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Total modelos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosPagina.length === 0 ? (
                        <tr><td colSpan="5" className="sin_datos">Todavia no hay pedidos de tienda.</td></tr>
                      ) : (
                        pedidosPagina.map((pedido) => (
                          <tr key={pedido.id}>
                            <td>{pedido.id}</td>
                            <td>{pedido.tienda || "-"}</td>
                            <td>{pedido.fechaSolicitud || "-"}</td>
                            <td>{pedido.estado || "-"}</td>
                            <td>{(pedido.detalle || []).reduce((total, item) => total + Number(item?.cantidadSolicitada || 0), 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {pedidosFiltrados.length > FILAS_POR_PAGINA ? (
                  <div className="paginacion">
                    <button type="button" className="btn btn_secundario" onClick={() => setPaginaPedidos((v) => Math.max(1, v - 1))} disabled={paginaPedidos === 1}>Anterior</button>
                    <span>Pagina {paginaPedidos} de {totalPaginasPedidos}</span>
                    <button type="button" className="btn btn_secundario" onClick={() => setPaginaPedidos((v) => Math.min(totalPaginasPedidos, v + 1))} disabled={paginaPedidos >= totalPaginasPedidos}>Siguiente</button>
                  </div>
                ) : null}
              </div>

              <div className="acciones">
                <button type="button" className="btn btn_principal" onClick={guardarPedido}>
                  {formularioPedido.id ? "Actualizar pedido" : "Guardar pedido"}
                </button>
              </div>
            </>
          ) : pestanaActiva === "stock" ? (
            <>
              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Tienda</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock actual</th>
                      <th>Precio ref.</th>
                      <th>Ultimo ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockPagina.length === 0 ? (
                      <tr><td colSpan="7" className="sin_datos">Todavia no hay stock recibido en tienda.</td></tr>
                    ) : (
                      stockPagina.map((item) => (
                          <tr key={item.id}>
                            <td>{item.tienda || "-"}</td>
                            <td>{item.modelo || "-"}</td>
                            <td>{item.colorBase || "-"}</td>
                            <td>{item.talla || "-"}</td>
                            <td>{Number(item.stockActual || 0)}</td>
                            <td>{formatearResumenTarifario(item.modelo, listaPrecios)}</td>
                            <td>{item.ultimaFechaIngreso || "-"}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              {stockFiltrado.length > FILAS_POR_PAGINA ? (
                <div className="paginacion">
                  <button type="button" className="btn btn_secundario" onClick={() => setPaginaStock((v) => Math.max(1, v - 1))} disabled={paginaStock === 1}>Anterior</button>
                  <span>Pagina {paginaStock} de {totalPaginasStock}</span>
                  <button type="button" className="btn btn_secundario" onClick={() => setPaginaStock((v) => Math.min(totalPaginasStock, v + 1))} disabled={paginaStock >= totalPaginasStock}>Siguiente</button>
                </div>
              ) : null}
            </>
          ) : pestanaActiva === "venta" ? (
            <>
              <div className="grid_cabecera">
                <Campo><label>Venta</label><input type="text" value={formularioVenta.id || "Nueva"} readOnly /></Campo>
                <Campo><label>Tienda</label><input type="text" value={formularioVenta.tienda} onChange={(e) => setFormularioVenta((a) => ({ ...a, tienda: e.target.value.toUpperCase() }))} /></Campo>
                <Campo><label>Fecha</label><input type="date" value={formularioVenta.fecha} onChange={(e) => setFormularioVenta((a) => ({ ...a, fecha: e.target.value }))} /></Campo>
                <Campo><label>Cliente</label><input type="text" value={formularioVenta.cliente} onChange={(e) => setFormularioVenta((a) => ({ ...a, cliente: e.target.value.toUpperCase() }))} /></Campo>
                <Campo className="campo-completo"><label>Observacion</label><textarea value={formularioVenta.observacion} onChange={(e) => setFormularioVenta((a) => ({ ...a, observacion: e.target.value }))} /></Campo>
              </div>

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Modelos disponibles para venta rapida</h2>
                    <p>Se vende por modelo general. El sistema descuenta por detras el detalle de color y talla.</p>
                  </div>
                </div>

                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Tienda</th>
                        <th>Modelo general</th>
                        <th>Stock total</th>
                        <th>Precios</th>
                        <th>Colores</th>
                        <th>Tallas</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockFiltrado.length === 0 ? (
                        <tr><td colSpan="7" className="sin_datos">No hay stock para venta con ese filtro.</td></tr>
                      ) : (
                        stockFiltrado.map((item) => (
                          <tr key={item.id}>
                            <td>{item.tienda || "-"}</td>
                            <td>{item.modelo || "-"}</td>
                            <td>{Number(item.stockTotal || 0)}</td>
                            <td>{formatearResumenTarifario(item.modelo, listaPrecios)}</td>
                            <td>{(item.colores || []).join(", ") || "-"}</td>
                            <td>{(item.tallas || []).join(", ") || "-"}</td>
                            <td>
                              <button type="button" className="btn btn_principal btn_tabla" onClick={() => agregarModeloVenta(item)}>
                                Agregar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Detalle de venta rapida</h2>
                    <p>Solo se registra el modelo general y la cantidad. El resto lo resuelve el sistema.</p>
                  </div>
                </div>

                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Tienda</th>
                        <th>Modelo general</th>
                        <th>Stock total</th>
                        <th>Tarifa ref.</th>
                        <th>Vende</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formularioVenta.detalle || []).length === 0 ? (
                        <tr><td colSpan="6" className="sin_datos">Todavia no agregaste modelos a la venta.</td></tr>
                      ) : (
                        formularioVenta.detalle.map((item) => (
                          <tr key={item.id}>
                            <td>{item.tienda || "-"}</td>
                            <td>{item.modelo || "-"}</td>
                            <td>{Number(item.stockTotal || 0)}</td>
                            <td>{formatearResumenTarifario(item.modelo, listaPrecios)}</td>
                            <td className="celda_input">
                              <input type="number" min="1" max={Number(item.stockTotal || 0)} value={item.cantidadVendida} onChange={(e) => actualizarCantidadVenta(item.id, e.target.value)} />
                            </td>
                            <td>
                              <button type="button" className="btn btn_secundario btn_tabla" onClick={() => quitarModeloVenta(item.id)}>
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

              <div className="acciones">
                <button type="button" className="btn btn_principal" onClick={registrarVentaRapida}>
                  Registrar venta rapida
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid_control">
                <article className="tarjeta tarjeta_interna">
                  <div className="tarjeta__encabezado">
                    <div>
                      <h2>Modelos mas vendidos</h2>
                      <p>Esto sale de la venta rapida por modelo general.</p>
                    </div>
                  </div>
                  <div className="lista_resumen">
                    {modelosMasVendidos.length === 0 ? (
                      <div className="item_resumen">Todavia no hay ventas registradas.</div>
                    ) : (
                      modelosMasVendidos.map((item, indice) => (
                        <div key={item.modelo} className="item_resumen">
                          {indice + 1}. {item.modelo} - {item.total} unid
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="tarjeta tarjeta_interna">
                  <div className="tarjeta__encabezado">
                    <div>
                      <h2>Productos mas enviados a tienda</h2>
                      <p>Esto te muestra que colores y tallas rotan mas segun el envio desde Almacen.</p>
                    </div>
                  </div>
                  <div className="lista_resumen">
                    {productosMasDespachados.length === 0 ? (
                      <div className="item_resumen">Todavia no hay ingresos desde Almacen.</div>
                    ) : (
                      productosMasDespachados.map((item, indice) => (
                        <div key={`${item.modelo}-${item.colorBase}-${item.talla}`} className="item_resumen">
                          {indice + 1}. {item.modelo} / {item.colorBase} / {item.talla} - {item.total}
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Control detallado de inventario</h2>
                    <p>
                      Aqui puedes revisar un modelo puntual por color y talla usando la
                      formula: stock inicial estimado + ingresos de Almacen - ventas de
                      tienda = stock sistema.
                    </p>
                  </div>
                </div>

                <div className="resumen__grid resumen__grid_control">
                  <div>
                    <span>Stock sistema</span>
                    <strong>{Number(resumenControl.stockSistema || 0)}</strong>
                  </div>
                  <div>
                    <span>Ingresos Almacen</span>
                    <strong>{Number(resumenControl.ingresosAlmacen || 0)}</strong>
                  </div>
                  <div>
                    <span>Ventas tienda</span>
                    <strong>{Number(resumenControl.ventasTienda || 0)}</strong>
                  </div>
                  <div>
                    <span>Registros visibles</span>
                    <strong>{controlFiltrado.length}</strong>
                  </div>
                </div>

                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Tienda</th>
                        <th>Modelo</th>
                        <th>Color</th>
                        <th>Talla</th>
                        <th>Stock inicial estimado</th>
                        <th>Ingresos Almacen</th>
                        <th>Ventas tienda</th>
                        <th>Stock sistema</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {controlPagina.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="sin_datos">
                            No hay registros detallados con ese filtro.
                          </td>
                        </tr>
                      ) : (
                        controlPagina.map((item) => (
                          <tr key={item.id}>
                            <td>{item.tienda || "-"}</td>
                            <td>{item.modelo || "-"}</td>
                            <td>{item.colorBase || "-"}</td>
                            <td>{item.talla || "-"}</td>
                            <td>{Number(item.stockInicialEstimado || 0)}</td>
                            <td>{Number(item.ingresosAlmacen || 0)}</td>
                            <td>{Number(item.ventasTienda || 0)}</td>
                            <td>{Number(item.stockSistema || 0)}</td>
                            <td>
                              <span
                                className={`chip_estado ${
                                  item.estado === "REVISAR"
                                    ? "chip_estado_revisar"
                                    : item.estado === "AGOTADO"
                                      ? "chip_estado_agotado"
                                      : "chip_estado_stock"
                                }`}
                              >
                                {item.estado}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {controlFiltrado.length > FILAS_POR_PAGINA ? (
                  <div className="paginacion">
                    <button type="button" className="btn btn_secundario" onClick={() => setPaginaControl((v) => Math.max(1, v - 1))} disabled={paginaControl === 1}>Anterior</button>
                    <span>Pagina {paginaControl} de {totalPaginasControl}</span>
                    <button type="button" className="btn btn_secundario" onClick={() => setPaginaControl((v) => Math.min(totalPaginasControl, v + 1))} disabled={paginaControl >= totalPaginasControl}>Siguiente</button>
                  </div>
                ) : null}
              </div>

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Como cuadrar un modelo puntual</h2>
                    <p>
                      Para controlar un modelo, color y talla en tienda usa esta logica:
                      stock de tienda detallado + ingresos de almacen - ventas de tienda.
                      Luego cuentas ese modelo fisicamente y lo comparas contra el saldo.
                    </p>
                  </div>
                </div>

                <div className="lista_resumen">
                  <div className="item_resumen">1. Recibe stock detallado desde Almacen por modelo, color y talla.</div>
                  <div className="item_resumen">2. La vendedora vende rapido solo por modelo general.</div>
                  <div className="item_resumen">3. El sistema descuenta ese modelo internamente del detalle de tienda.</div>
                  <div className="item_resumen">4. Si quieres revisar un modelo puntual, lo cuentas y lo comparas con el saldo del sistema.</div>
                  <div className="item_resumen">5. Lo que mas vende Tienda sale del modulo de ventas; colores y tallas con mas rotacion salen del envio desde Almacen.</div>
                </div>
              </div>

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Historial de ventas rapidas</h2>
                    <p>Te ayuda a ver cuanto se vendio por modelo general y a que tienda.</p>
                  </div>
                </div>
                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Venta</th>
                        <th>Tienda</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Total prendas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventasPagina.length === 0 ? (
                        <tr><td colSpan="5" className="sin_datos">Todavia no hay ventas registradas.</td></tr>
                      ) : (
                        ventasPagina.map((item) => (
                          <tr key={item.id}>
                            <td>{item.id}</td>
                            <td>{item.tienda || "-"}</td>
                            <td>{item.fecha || "-"}</td>
                            <td>{item.cliente || "-"}</td>
                            <td>{Number(item.totalPrendas || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {historialVentas.length > FILAS_POR_PAGINA ? (
                  <div className="paginacion">
                    <button type="button" className="btn btn_secundario" onClick={() => setPaginaVentas((v) => Math.max(1, v - 1))} disabled={paginaVentas === 1}>Anterior</button>
                    <span>Pagina {paginaVentas} de {totalPaginasVentas}</span>
                    <button type="button" className="btn btn_secundario" onClick={() => setPaginaVentas((v) => Math.min(totalPaginasVentas, v + 1))} disabled={paginaVentas >= totalPaginasVentas}>Siguiente</button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </main>
    </ContenedorPagina>
  );
}

const valueOrZero = (valor) => (valor === "" ? "0" : valor);

const ContenedorPagina = styled.div`
  min-height: 100vh;
  width: 100%;
  background: ${({ theme }) => theme.bgtotal};
  color: ${({ theme }) => theme.text};
  display: grid;
  grid-template:
    "encabezado" 90px
    "cabecera" auto
    "contenido_principal" 1fr;
  gap: 15px;
  padding: 15px;

  .encabezado,
  .cabecera,
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
  .grid_cabecera,
  .grid_control,
  .ayuda_visual__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .resumen__grid div,
  .ayuda_visual__item {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg2};
    min-height: 110px;
    display: grid;
    align-content: start;
  }

  .resumen__grid span,
  .ayuda_visual__item span {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
  }

  .resumen__grid strong,
  .ayuda_visual__item strong {
    display: block;
    margin-top: 6px;
    color: ${({ theme }) => theme.text};
    font-size: 20px;
  }

  .resumen__grid_control {
    margin-bottom: 16px;
  }

  .ayuda_visual__item small {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
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
    border-radius: 12px;
    padding: 10px 16px;
    background: transparent;
    color: ${({ theme }) => theme.text};
    font-weight: 800;
    cursor: pointer;
  }

  .pestana_activa {
    background: var(--modulo-acento, ${({ theme }) => theme.bg5});
    border-color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .buscador,
  .tarjeta__encabezado {
    margin-bottom: 16px;
  }

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

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 960px;
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

  .celda_input input {
    max-width: 90px;
    text-align: center;
  }

  .lista_resumen {
    display: grid;
    gap: 10px;
  }

  .item_resumen {
    border-radius: 12px;
    padding: 12px 14px;
    background-color: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.bg4};
    font-weight: 600;
    min-height: 68px;
    display: grid;
    align-content: start;
  }

  .chip_estado {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 92px;
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
  }

  .chip_estado_stock {
    background: rgba(25, 135, 84, 0.18);
    color: #9cf0c0;
    border: 1px solid rgba(25, 135, 84, 0.35);
  }

  .chip_estado_agotado {
    background: rgba(108, 117, 125, 0.2);
    color: #f5f5f5;
    border: 1px solid rgba(173, 181, 189, 0.35);
  }

  .chip_estado_revisar {
    background: rgba(220, 53, 69, 0.18);
    color: #ffb3bd;
    border: 1px solid rgba(220, 53, 69, 0.35);
  }

  .acciones,
  .tabla_acciones {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn_secundario {
    background: #5b5b60;
    color: #ffffff;
  }

  .btn_principal {
    background: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .btn_tabla {
    width: 100%;
    padding: 8px 10px;
  }

  @media (max-width: 960px) {
    .cabecera {
      flex-direction: column;
    }

    .cabecera__estado {
      width: 100%;
    }

    .acciones,
    .tabla_acciones {
      flex-direction: column;
    }
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
