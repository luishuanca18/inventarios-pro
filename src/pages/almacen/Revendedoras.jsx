import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";
import {
  leerProductosTerminados,
  registrarAjusteProductoTerminado,
  registrarSalidaProductosTerminados,
} from "../../utils/productosTerminados";
import {
  leerMovimientosRevendedoras,
  leerStockRevendedoras,
  leerVentasRevendedoras,
  registrarDevolucionRevendedora,
  registrarSalidaRevendedora,
  registrarVentaRevendedora,
} from "../../utils/revendedoras";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import {
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

const obtenerFechaActual = () => {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const crearId = (prefijo = "REV") => {
  const fecha = new Date();
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yy = String(fecha.getFullYear()).slice(-2);
  const correlativo = String(Date.now()).slice(-3);
  return `${prefijo}${dd}${mm}${yy}-${correlativo}`;
};

const crearFormularioSalida = () => ({
  revendedora: "",
  fecha: obtenerFechaActual(),
  observacion: "",
  detalle: [],
});

const crearFormularioMovimiento = () => ({
  revendedora: "",
  fecha: obtenerFechaActual(),
  observacion: "",
  detalle: [],
});

const normalizar = (valor = "") => valor.toString().trim().toLowerCase();

export function Revendedoras() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState("salida");
  const [busqueda, setBusqueda] = useState("");
  const [paginaProductos, setPaginaProductos] = useState(1);
  const [paginaStock, setPaginaStock] = useState(1);
  const [versionDatos, setVersionDatos] = useState(0);
  const [formularioSalida, setFormularioSalida] = useState(crearFormularioSalida);
  const [formularioVenta, setFormularioVenta] = useState(crearFormularioMovimiento);
  const [formularioDevolucion, setFormularioDevolucion] = useState(crearFormularioMovimiento);

  const productos = useMemo(() => leerProductosTerminados(), [versionDatos]);
  const stockRevendedoras = useMemo(() => leerStockRevendedoras(), [versionDatos]);
  const ventasRevendedoras = useMemo(() => leerVentasRevendedoras(), [versionDatos]);
  const movimientosRevendedoras = useMemo(() => leerMovimientosRevendedoras(), [versionDatos]);

  const productosFiltrados = useMemo(() => {
    const texto = normalizar(busqueda);
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

  const stockRevendedorasFiltrado = useMemo(() => {
    const texto = normalizar(busqueda);
    return stockRevendedoras.filter(
      (item) =>
        Number(item?.stockActual || 0) > 0 &&
        (!texto ||
          [
            item?.revendedora,
            item?.codigoCorto,
            item?.modelo,
            item?.colorBase,
            item?.talla,
          ]
            .join(" ")
            .toLowerCase()
            .includes(texto))
    );
  }, [busqueda, stockRevendedoras]);

  const resumenPorRevendedora = useMemo(() => {
    const mapa = new Map();
    stockRevendedorasFiltrado.forEach((item) => {
      const clave = item?.revendedora || "SIN NOMBRE";
      const actual = mapa.get(clave) || {
        revendedora: clave,
        stockActual: 0,
        modelos: new Set(),
      };
      actual.stockActual += Number(item?.stockActual || 0);
      if (item?.modelo) actual.modelos.add(item.modelo);
      mapa.set(clave, actual);
    });

    return Array.from(mapa.values()).map((item) => ({
      ...item,
      modelos: Array.from(item.modelos),
    }));
  }, [stockRevendedorasFiltrado]);
  const totalPaginasProductos = Math.max(
    1,
    Math.ceil(productosFiltrados.length / FILAS_POR_PAGINA)
  );
  const totalPaginasStock = Math.max(
    1,
    Math.ceil(stockRevendedorasFiltrado.length / FILAS_POR_PAGINA)
  );
  const productosPagina = useMemo(() => {
    const inicio = (paginaProductos - 1) * FILAS_POR_PAGINA;
    return productosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [productosFiltrados, paginaProductos]);
  const stockPagina = useMemo(() => {
    const inicio = (paginaStock - 1) * FILAS_POR_PAGINA;
    return stockRevendedorasFiltrado.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [stockRevendedorasFiltrado, paginaStock]);

  const agregarProductoSalida = (producto) => {
    setFormularioSalida((anterior) => {
      if ((anterior.detalle || []).some((item) => item.claveProducto === producto.claveProducto)) {
        return anterior;
      }
      return {
        ...anterior,
        detalle: [
          ...(anterior.detalle || []),
          {
            claveProducto: producto.claveProducto,
            codigoCorto: producto.codigoCorto || "",
            codigoProducto: producto.codigoProducto || "",
            modelo: producto.modelo || "",
            colorBase: producto.colorBase || "",
            talla: producto.talla || "",
            stockActual: Number(producto.stockActual || 0),
            cantidad: "1",
          },
        ],
      };
    });
  };

  const agregarStockRevendedora = (stockItem, destino = "venta") => {
    const setter = destino === "venta" ? setFormularioVenta : setFormularioDevolucion;
    setter((anterior) => {
      if ((anterior.detalle || []).some((item) => item.stockId === stockItem.id)) {
        return anterior;
      }
      return {
        ...anterior,
        revendedora: anterior.revendedora || stockItem.revendedora || "",
        detalle: [
          ...(anterior.detalle || []),
          {
            stockId: stockItem.id,
            claveProducto: stockItem.claveProducto,
            codigoCorto: stockItem.codigoCorto || "",
            codigoProducto: stockItem.codigoProducto || "",
            modelo: stockItem.modelo || "",
            colorBase: stockItem.colorBase || "",
            talla: stockItem.talla || "",
            stockActual: Number(stockItem.stockActual || 0),
            cantidad: "1",
          },
        ],
      };
    });
  };

  const actualizarDetalle = (setter, clave, valor, campo = "cantidad", llave = "claveProducto") => {
    setter((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).map((item) =>
        item[llave] !== clave ? item : { ...item, [campo]: valor }
      ),
    }));
  };

  const quitarDetalle = (setter, clave, llave = "claveProducto") => {
    setter((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).filter((item) => item[llave] !== clave),
    }));
  };

  const guardarSalida = () => {
    if (!formularioSalida.revendedora.trim()) {
      mostrarAlertaSistema("Completa el nombre de la revendedora.");
      return;
    }
    if ((formularioSalida.detalle || []).length === 0) {
      mostrarAlertaSistema("Agrega al menos una prenda.");
      return;
    }

    const detalle = formularioSalida.detalle.map((item) => ({
      ...item,
      cantidad: Number(item?.cantidad || 0),
      cantidadAtendida: Number(item?.cantidad || 0),
    }));

    if (detalle.some((item) => item.cantidad <= 0 || item.cantidad > Number(item?.stockActual || 0))) {
      mostrarAlertaSistema("Revisa las cantidades separadas para la revendedora.");
      return;
    }

    const salidaId = crearId("SRV");
    registrarSalidaProductosTerminados({
      salidaId: `REV-${salidaId}`,
      pedidoId: salidaId,
      fecha: formularioSalida.fecha,
      tienda: `REVENDEDORA ${formularioSalida.revendedora.toUpperCase()}`,
      observacion: formularioSalida.observacion,
      detalleSalida: detalle,
    });
    registrarSalidaRevendedora({
      salidaId,
      fecha: formularioSalida.fecha,
      revendedora: formularioSalida.revendedora.toUpperCase(),
      observacion: formularioSalida.observacion,
      detalle,
    });

    setFormularioSalida(crearFormularioSalida());
    setVersionDatos((anterior) => anterior + 1);
    mostrarNotificacionCarga("Stock separado para revendedora.");
  };

  const guardarVenta = () => {
    if (!formularioVenta.revendedora.trim()) {
      mostrarAlertaSistema("Completa la revendedora.");
      return;
    }
    if ((formularioVenta.detalle || []).length === 0) {
      mostrarAlertaSistema("Agrega al menos una prenda vendida.");
      return;
    }

    const detalle = formularioVenta.detalle.map((item) => ({
      ...item,
      cantidad: Number(item?.cantidad || 0),
    }));

    if (detalle.some((item) => item.cantidad <= 0 || item.cantidad > Number(item?.stockActual || 0))) {
      mostrarAlertaSistema("Revisa las cantidades vendidas reportadas.");
      return;
    }

    registrarVentaRevendedora({
      ventaId: crearId("VRV"),
      fecha: formularioVenta.fecha,
      revendedora: formularioVenta.revendedora.toUpperCase(),
      observacion: formularioVenta.observacion,
      detalle,
    });

    setFormularioVenta(crearFormularioMovimiento());
    setVersionDatos((anterior) => anterior + 1);
    mostrarNotificacionCarga("Venta de revendedora registrada.");
  };

  const guardarDevolucion = () => {
    if (!formularioDevolucion.revendedora.trim()) {
      mostrarAlertaSistema("Completa la revendedora.");
      return;
    }
    if ((formularioDevolucion.detalle || []).length === 0) {
      mostrarAlertaSistema("Agrega al menos una prenda devuelta.");
      return;
    }

    const detalle = formularioDevolucion.detalle.map((item) => ({
      ...item,
      cantidad: Number(item?.cantidad || 0),
    }));

    if (detalle.some((item) => item.cantidad <= 0 || item.cantidad > Number(item?.stockActual || 0))) {
      mostrarAlertaSistema("Revisa las cantidades devueltas.");
      return;
    }

    registrarDevolucionRevendedora({
      devolucionId: crearId("DRV"),
      fecha: formularioDevolucion.fecha,
      revendedora: formularioDevolucion.revendedora.toUpperCase(),
      observacion: formularioDevolucion.observacion,
      detalle,
    });

    detalle.forEach((item, indice) => {
      const productoActual = leerProductosTerminados().find(
        (producto) => producto?.claveProducto === item.claveProducto
      );
      if (!productoActual) return;

      registrarAjusteProductoTerminado({
        ajusteId: `${crearId("AJR")}-${indice + 1}`,
        fecha: formularioDevolucion.fecha,
        motivoAjuste: "DEVOLUCION REVENDEDORA",
        observacionAjuste: [
          formularioDevolucion.revendedora,
          formularioDevolucion.observacion,
        ]
          .filter(Boolean)
          .join(" | "),
        producto: productoActual,
        stockFisico: Number(productoActual?.stockActual || 0) + Number(item?.cantidad || 0),
      });
    });

    setFormularioDevolucion(crearFormularioMovimiento());
    setVersionDatos((anterior) => anterior + 1);
    mostrarNotificacionCarga("Devolucion de revendedora registrada y regresada al stock central.");
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
          <h1>Revendedoras</h1>
          <p>
            Aqui Almacen separa stock para chicas que venden en sus redes, sin mostrarles el stock global ni mezclarlo con tienda normal.
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
              <span>Revendedoras con stock</span>
              <strong>{resumenPorRevendedora.length}</strong>
            </div>
            <div>
              <span>Stock reservado</span>
              <strong>
                {stockRevendedorasFiltrado.reduce((total, item) => total + Number(item?.stockActual || 0), 0)}
              </strong>
            </div>
            <div>
              <span>Ventas reportadas</span>
              <strong>{ventasRevendedoras.length}</strong>
            </div>
            <div>
              <span>Movimientos</span>
              <strong>{movimientosRevendedoras.length}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="pestanas">
            <button type="button" className={`pestana ${pestanaActiva === "salida" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("salida")}>
              Salida a revendedora
            </button>
            <button type="button" className={`pestana ${pestanaActiva === "stock" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("stock")}>
              Stock revendedoras
            </button>
            <button type="button" className={`pestana ${pestanaActiva === "ventas" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("ventas")}>
              Ventas reportadas
            </button>
            <button type="button" className={`pestana ${pestanaActiva === "devolucion" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("devolucion")}>
              Devolucion
            </button>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por revendedora, modelo, color, talla o codigo"
            />
          </div>

          {pestanaActiva === "salida" ? (
            <>
              <div className="grid_cabecera">
                <Campo>
                  <label>Revendedora</label>
                  <input
                    type="text"
                    value={formularioSalida.revendedora}
                    onChange={(evento) =>
                      setFormularioSalida((anterior) => ({
                        ...anterior,
                        revendedora: evento.target.value.toUpperCase(),
                      }))
                    }
                  />
                </Campo>
                <Campo>
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={formularioSalida.fecha}
                    onChange={(evento) =>
                      setFormularioSalida((anterior) => ({
                        ...anterior,
                        fecha: evento.target.value,
                      }))
                    }
                  />
                </Campo>
                <Campo className="campo-completo">
                  <label>Observacion</label>
                  <input
                    type="text"
                    value={formularioSalida.observacion}
                    onChange={(evento) =>
                      setFormularioSalida((anterior) => ({
                        ...anterior,
                        observacion: evento.target.value,
                      }))
                    }
                  />
                </Campo>
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Codigo corto</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock central</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosPagina.length === 0 ? (
                      <tr><td colSpan="6" className="sin_datos">No hay stock disponible.</td></tr>
                    ) : (
                      productosPagina.map((item) => (
                        <tr key={item.claveProducto || item.id}>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                          <td>
                            <button type="button" className="btn btn_secundario" onClick={() => agregarProductoSalida(item)}>
                              Agregar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {productosFiltrados.length > FILAS_POR_PAGINA ? (
                <div className="paginacion">
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={() => setPaginaProductos((valor) => Math.max(1, valor - 1))}
                    disabled={paginaProductos === 1}
                  >
                    Anterior
                  </button>
                  <span>
                    Pagina {paginaProductos} de {totalPaginasProductos}
                  </span>
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={() =>
                      setPaginaProductos((valor) =>
                        Math.min(totalPaginasProductos, valor + 1)
                      )
                    }
                    disabled={paginaProductos >= totalPaginasProductos}
                  >
                    Siguiente
                  </button>
                </div>
              ) : null}

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Codigo corto</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock central</th>
                      <th>Separa</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formularioSalida.detalle || []).length === 0 ? (
                      <tr><td colSpan="7" className="sin_datos">Todavia no agregaste prendas.</td></tr>
                    ) : (
                      formularioSalida.detalle.map((item) => (
                        <tr key={item.claveProducto}>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              max={Number(item.stockActual || 0)}
                              value={item.cantidad}
                              onChange={(evento) =>
                                actualizarDetalle(setFormularioSalida, item.claveProducto, evento.target.value)
                              }
                            />
                          </td>
                          <td>
                            <button type="button" className="btn btn_secundario" onClick={() => quitarDetalle(setFormularioSalida, item.claveProducto)}>
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="acciones">
                <button type="button" className="btn btn_principal" onClick={guardarSalida}>
                  Guardar salida a revendedora
                </button>
              </div>
            </>
          ) : pestanaActiva === "stock" ? (
            <>
              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Revendedora</th>
                      <th>Codigo corto</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock reservado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockPagina.length === 0 ? (
                      <tr><td colSpan="6" className="sin_datos">Todavia no hay stock separado.</td></tr>
                    ) : (
                      stockPagina.map((item) => (
                        <tr key={item.id}>
                          <td>{item.revendedora || "-"}</td>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {stockRevendedorasFiltrado.length > FILAS_POR_PAGINA ? (
                <div className="paginacion">
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={() => setPaginaStock((valor) => Math.max(1, valor - 1))}
                    disabled={paginaStock === 1}
                  >
                    Anterior
                  </button>
                  <span>
                    Pagina {paginaStock} de {totalPaginasStock}
                  </span>
                  <button
                    type="button"
                    className="btn btn_secundario"
                    onClick={() => setPaginaStock((valor) => Math.min(totalPaginasStock, valor + 1))}
                    disabled={paginaStock >= totalPaginasStock}
                  >
                    Siguiente
                  </button>
                </div>
              ) : null}
            </>
          ) : pestanaActiva === "ventas" ? (
            <>
              <div className="grid_cabecera">
                <Campo>
                  <label>Revendedora</label>
                  <input
                    type="text"
                    value={formularioVenta.revendedora}
                    onChange={(evento) =>
                      setFormularioVenta((anterior) => ({
                        ...anterior,
                        revendedora: evento.target.value.toUpperCase(),
                      }))
                    }
                  />
                </Campo>
                <Campo>
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={formularioVenta.fecha}
                    onChange={(evento) =>
                      setFormularioVenta((anterior) => ({
                        ...anterior,
                        fecha: evento.target.value,
                      }))
                    }
                  />
                </Campo>
                <Campo className="campo-completo">
                  <label>Observacion</label>
                  <input
                    type="text"
                    value={formularioVenta.observacion}
                    onChange={(evento) =>
                      setFormularioVenta((anterior) => ({
                        ...anterior,
                        observacion: evento.target.value,
                      }))
                    }
                  />
                </Campo>
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Revendedora</th>
                      <th>Codigo corto</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock reservado</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRevendedorasFiltrado.length === 0 ? (
                      <tr><td colSpan="7" className="sin_datos">No hay stock reservado para reportar ventas.</td></tr>
                    ) : (
                      stockRevendedorasFiltrado.map((item) => (
                        <tr key={`venta-${item.id}`}>
                          <td>{item.revendedora || "-"}</td>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                          <td>
                            <button type="button" className="btn btn_secundario" onClick={() => agregarStockRevendedora(item, "venta")}>
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
                      <th>Codigo corto</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock reservado</th>
                      <th>Vendio</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formularioVenta.detalle || []).length === 0 ? (
                      <tr><td colSpan="7" className="sin_datos">Todavia no agregaste ventas.</td></tr>
                    ) : (
                      formularioVenta.detalle.map((item) => (
                        <tr key={item.stockId}>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              max={Number(item.stockActual || 0)}
                              value={item.cantidad}
                              onChange={(evento) =>
                                actualizarDetalle(setFormularioVenta, item.stockId, evento.target.value, "cantidad", "stockId")
                              }
                            />
                          </td>
                          <td>
                            <button type="button" className="btn btn_secundario" onClick={() => quitarDetalle(setFormularioVenta, item.stockId, "stockId")}>
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="acciones">
                <button type="button" className="btn btn_principal" onClick={guardarVenta}>
                  Guardar venta reportada
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid_cabecera">
                <Campo>
                  <label>Revendedora</label>
                  <input
                    type="text"
                    value={formularioDevolucion.revendedora}
                    onChange={(evento) =>
                      setFormularioDevolucion((anterior) => ({
                        ...anterior,
                        revendedora: evento.target.value.toUpperCase(),
                      }))
                    }
                  />
                </Campo>
                <Campo>
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={formularioDevolucion.fecha}
                    onChange={(evento) =>
                      setFormularioDevolucion((anterior) => ({
                        ...anterior,
                        fecha: evento.target.value,
                      }))
                    }
                  />
                </Campo>
                <Campo className="campo-completo">
                  <label>Observacion</label>
                  <input
                    type="text"
                    value={formularioDevolucion.observacion}
                    onChange={(evento) =>
                      setFormularioDevolucion((anterior) => ({
                        ...anterior,
                        observacion: evento.target.value,
                      }))
                    }
                  />
                </Campo>
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Revendedora</th>
                      <th>Codigo corto</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock reservado</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRevendedorasFiltrado.length === 0 ? (
                      <tr><td colSpan="7" className="sin_datos">No hay stock reservado para devolver.</td></tr>
                    ) : (
                      stockRevendedorasFiltrado.map((item) => (
                        <tr key={`dev-${item.id}`}>
                          <td>{item.revendedora || "-"}</td>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                          <td>
                            <button type="button" className="btn btn_secundario" onClick={() => agregarStockRevendedora(item, "devolucion")}>
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
                      <th>Codigo corto</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock reservado</th>
                      <th>Devuelve</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formularioDevolucion.detalle || []).length === 0 ? (
                      <tr><td colSpan="7" className="sin_datos">Todavia no agregaste devoluciones.</td></tr>
                    ) : (
                      formularioDevolucion.detalle.map((item) => (
                        <tr key={item.stockId}>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              max={Number(item.stockActual || 0)}
                              value={item.cantidad}
                              onChange={(evento) =>
                                actualizarDetalle(setFormularioDevolucion, item.stockId, evento.target.value, "cantidad", "stockId")
                              }
                            />
                          </td>
                          <td>
                            <button type="button" className="btn btn_secundario" onClick={() => quitarDetalle(setFormularioDevolucion, item.stockId, "stockId")}>
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="acciones">
                <button type="button" className="btn btn_principal" onClick={guardarDevolucion}>
                  Guardar devolucion
                </button>
              </div>
            </>
          )}
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

  .cabecera p {
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

  .contenido_principal {
    display: grid;
    gap: 16px;
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
    background: ${({ theme }) => theme.bg5};
    border-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .buscador,
  .acciones {
    margin-top: 16px;
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
    vertical-align: middle;
  }

  th {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .sin_datos {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .campo-completo {
    grid-column: 1 / -1;
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
