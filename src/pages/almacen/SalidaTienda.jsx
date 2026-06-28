import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { registrarSalidaProductosTerminados } from "../../utils/productosTerminados";
import { registrarIngresoTienda } from "../../utils/stockTiendas";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";

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

const crearPedidoId = () => {
  const fecha = new Date();
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yy = String(fecha.getFullYear()).slice(-2);
  const correlativo = String(Date.now()).slice(-3);
  return `TIE${dd}${mm}${yy}-${correlativo}`;
};

const obtenerFechaActual = () => {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const crearFormularioVacio = () => ({
  id: "",
  tienda: "",
  fechaSolicitud: obtenerFechaActual(),
  fechaSalida: obtenerFechaActual(),
  observacion: "",
  detalle: [],
});

export function SalidaTienda() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState("pedidos");
  const [busqueda, setBusqueda] = useState("");
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [paginaPendientes, setPaginaPendientes] = useState(1);
  const [formulario, setFormulario] = useState(crearFormularioVacio);
  const [pedidos, setPedidos] = useState(() => leerListaGuardada(CLAVE_PEDIDOS_TIENDA));

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

  const pedidosPendientes = useMemo(
    () => pedidosFiltrados.filter((item) => item?.estado !== "COMPLETO"),
    [pedidosFiltrados]
  );
  const totalPaginasHistorial = Math.max(
    1,
    Math.ceil(pedidosFiltrados.length / FILAS_POR_PAGINA)
  );
  const totalPaginasPendientes = Math.max(
    1,
    Math.ceil(pedidosPendientes.length / FILAS_POR_PAGINA)
  );
  const pedidosHistorialPagina = useMemo(() => {
    const inicio = (paginaHistorial - 1) * FILAS_POR_PAGINA;
    return pedidosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [pedidosFiltrados, paginaHistorial]);
  const pedidosPendientesPagina = useMemo(() => {
    const inicio = (paginaPendientes - 1) * FILAS_POR_PAGINA;
    return pedidosPendientes.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [pedidosPendientes, paginaPendientes]);

  const cargarPedido = (pedido) => {
    setFormulario({
      id: pedido?.id || "",
      tienda: pedido?.tienda || "",
      fechaSolicitud: pedido?.fechaSolicitud || obtenerFechaActual(),
      fechaSalida: pedido?.fechaSalida || obtenerFechaActual(),
      observacion: pedido?.observacion || pedido?.observacionSalida || "",
      detalle: (pedido?.detalle || []).map((item) => ({
        ...item,
        cantidadSolicitada: String(item?.cantidadSolicitada || 0),
        cantidadAtendida: String(item?.cantidadAtendida || item?.cantidadSolicitada || 0),
      })),
    });
    setPestanaActiva("salida");
  };

  const actualizarCantidadSolicitada = (claveProducto, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).map((item) =>
        item.claveProducto !== claveProducto
          ? item
          : {
              ...item,
              cantidadSolicitada: valor,
              cantidadAtendida:
                Number(valor || 0) < Number(item?.cantidadAtendida || 0)
                  ? valor
                  : item.cantidadAtendida,
            }
      ),
    }));
  };

  const actualizarCantidadAtendida = (claveProducto, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).map((item) =>
        item.claveProducto !== claveProducto
          ? item
          : {
              ...item,
              cantidadAtendida: valor,
            }
      ),
    }));
  };

  const quitarProducto = (claveProducto) => {
    setFormulario((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).filter((item) => item.claveProducto !== claveProducto),
    }));
  };

  const guardarPedidoTienda = () => {
    if (!formulario.tienda.trim()) {
      alert("Completa el nombre de tienda.");
      return;
    }

    if ((formulario.detalle || []).length === 0) {
      alert("Agrega al menos una prenda al pedido.");
      return;
    }

    const detalleNormalizado = (formulario.detalle || []).map((item) => ({
      ...item,
      cantidadSolicitada: Number(item?.cantidadSolicitada || 0),
      cantidadAtendida: Number(item?.cantidadAtendida || 0),
    }));

    if (detalleNormalizado.some((item) => item.cantidadSolicitada <= 0)) {
      alert("Todas las cantidades solicitadas deben ser mayores a cero.");
      return;
    }

    const pedido = {
      id: formulario.id || crearPedidoId(),
      tienda: formulario.tienda,
      fechaSolicitud: formulario.fechaSolicitud,
      observacion: formulario.observacion,
      detalle: detalleNormalizado,
      estado: "PENDIENTE",
      fechaActualizacion: new Date().toISOString(),
    };

    const listaActualizada = [
      pedido,
      ...pedidos.filter((item) => item?.id !== pedido.id),
    ];

    setPedidos(listaActualizada);
    guardarLista(CLAVE_PEDIDOS_TIENDA, listaActualizada);
    setFormulario(crearFormularioVacio());
    alert(formulario.id ? "Pedido de tienda actualizado." : "Pedido de tienda creado.");
  };

  const confirmarSalida = () => {
    if (!formulario.id) {
      alert("Carga primero un pedido de tienda.");
      return;
    }

    const detalleNormalizado = (formulario.detalle || []).map((item) => ({
      ...item,
      cantidadSolicitada: Number(item?.cantidadSolicitada || 0),
      cantidadAtendida: Number(item?.cantidadAtendida || 0),
    }));

    if (detalleNormalizado.some((item) => item.cantidadAtendida < 0)) {
      alert("La cantidad atendida no puede ser negativa.");
      return;
    }

    if (detalleNormalizado.some((item) => item.cantidadAtendida > Number(item?.stockActual || 0))) {
      alert("No puedes atender mas de lo que hay en stock.");
      return;
    }

    registrarSalidaProductosTerminados({
      salidaId: `SALTIE-${formulario.id}`,
      pedidoId: formulario.id,
      fecha: formulario.fechaSalida,
      tienda: formulario.tienda,
      observacion: formulario.observacion,
      detalleSalida: detalleNormalizado,
    });

    registrarIngresoTienda({
      salidaId: `SALTIE-${formulario.id}`,
      pedidoId: formulario.id,
      fecha: formulario.fechaSalida,
      tienda: formulario.tienda,
      observacion: formulario.observacion,
      detalle: detalleNormalizado,
    });

    const totalSolicitado = detalleNormalizado.reduce(
      (total, item) => total + Number(item?.cantidadSolicitada || 0),
      0
    );
    const totalAtendido = detalleNormalizado.reduce(
      (total, item) => total + Number(item?.cantidadAtendida || 0),
      0
    );

    const estado =
      totalAtendido === 0
        ? "PENDIENTE"
        : totalAtendido >= totalSolicitado
          ? "COMPLETO"
          : "PARCIAL";

    const listaActualizada = pedidos.map((pedido) =>
      pedido?.id !== formulario.id
        ? pedido
        : {
            ...pedido,
            detalle: detalleNormalizado,
            estado,
            fechaSalida: formulario.fechaSalida,
            observacionSalida: formulario.observacion,
            totalAtendido,
          }
    );

    setPedidos(listaActualizada);
    guardarLista(CLAVE_PEDIDOS_TIENDA, listaActualizada);
    alert("Salida a tienda registrada correctamente.");
  };

  const totalPendientes = pedidos.filter((item) => item?.estado !== "COMPLETO").length;

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
          <h1>Pedidos y salida a tienda</h1>
          <p>
            Aqui se registran los pedidos que hacen las tiendas y tambien se confirma
            la salida real desde Almacen cuando las prendas ya fueron alistadas.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Pedidos pendientes</span>
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
              <span>Pedidos registrados</span>
              <strong>{pedidos.length}</strong>
            </div>
            <div>
              <span>Pendientes</span>
              <strong>{totalPendientes}</strong>
            </div>
            <div>
              <span>Completos</span>
              <strong>{pedidos.filter((item) => item?.estado === "COMPLETO").length}</strong>
            </div>
            <div>
              <span>Parciales</span>
              <strong>{pedidos.filter((item) => item?.estado === "PARCIAL").length}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaActiva === "pedidos" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaActiva("pedidos")}
            >
              Pedidos de tienda
            </button>
            <button
              type="button"
              className={`pestana ${pestanaActiva === "salida" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaActiva("salida")}
            >
              Salida a tienda
            </button>
          </div>

          {pestanaActiva === "pedidos" ? (
            <>
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Pedidos emitidos por tienda</h2>
                  <p>
                    Aqui Almacen puede registrar, revisar o actualizar el pedido antes de alistarlo.
                  </p>
                </div>
              </div>

              <div className="grid_cabecera">
                <Campo>
                  <label>Pedido tienda</label>
                  <input type="text" value={formulario.id || "Nuevo"} readOnly />
                </Campo>
                <Campo>
                  <label>Tienda</label>
                  <input
                    type="text"
                    value={formulario.tienda}
                    onChange={(evento) =>
                      setFormulario((anterior) => ({ ...anterior, tienda: evento.target.value }))
                    }
                    placeholder=""
                  />
                </Campo>
                <Campo>
                  <label>Fecha solicitud</label>
                  <input
                    type="date"
                    value={formulario.fechaSolicitud}
                    onChange={(evento) =>
                      setFormulario((anterior) => ({
                        ...anterior,
                        fechaSolicitud: evento.target.value,
                      }))
                    }
                  />
                </Campo>
                <Campo className="campo-completo">
                  <label>Observacion</label>
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
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Codigo corto</th>
                      <th>Modelo</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>Stock</th>
                      <th>Solicita</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formulario.detalle || []).length === 0 ? (
                      <tr>
                        <td colSpan="7" className="sin_datos">
                          Carga un pedido desde abajo o deja esta pantalla lista para usarla despues.
                        </td>
                      </tr>
                    ) : (
                      (formulario.detalle || []).map((item) => (
                        <tr key={item.claveProducto}>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                          <td className="celda_input">
                            <input
                              type="number"
                              min="1"
                              max={Number(item.stockActual || 0)}
                              value={item.cantidadSolicitada}
                              onChange={(evento) =>
                                actualizarCantidadSolicitada(item.claveProducto, evento.target.value)
                              }
                              placeholder=""
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn_secundario btn_tabla"
                              onClick={() => quitarProducto(item.claveProducto)}
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

              <div className="tarjeta tarjeta_interna">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Historial de pedidos</h2>
                    <p>Revisa y carga cualquier pedido para volver a trabajarlo.</p>
                  </div>
                </div>

                <div className="buscador">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder=""
                  />
                </div>

                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Tienda</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Total prendas</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosHistorialPagina.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="sin_datos">
                            Todavia no hay pedidos de tienda registrados.
                          </td>
                        </tr>
                      ) : (
                        pedidosHistorialPagina.map((pedido) => (
                          <tr key={pedido.id}>
                            <td>{pedido.id}</td>
                            <td>{pedido.tienda || "-"}</td>
                            <td>{pedido.fechaSolicitud || "-"}</td>
                            <td>{pedido.estado || "-"}</td>
                            <td>
                              {(pedido.detalle || []).reduce(
                                (total, item) => total + Number(item?.cantidadSolicitada || 0),
                                0
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn_principal btn_tabla"
                                onClick={() => cargarPedido(pedido)}
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

                {pedidosFiltrados.length > FILAS_POR_PAGINA ? (
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
              </div>

              <div className="acciones">
                <button type="button" className="btn btn_principal" onClick={guardarPedidoTienda}>
                  {formulario.id ? "Actualizar pedido" : "Guardar pedido"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Salida a tienda</h2>
                  <p>
                    Carga un pedido pendiente y confirma cuanta cantidad sale realmente desde Almacen.
                  </p>
                </div>
              </div>

              <div className="buscador">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder=""
                />
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Tienda</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Total solicitado</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosPendientesPagina.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="sin_datos">
                          No hay pedidos de tienda pendientes.
                        </td>
                      </tr>
                    ) : (
                      pedidosPendientesPagina.map((pedido) => (
                        <tr key={pedido.id}>
                          <td>{pedido.id}</td>
                          <td>{pedido.tienda || "-"}</td>
                          <td>{pedido.fechaSolicitud || "-"}</td>
                          <td>{pedido.estado || "-"}</td>
                          <td>
                            {(pedido.detalle || []).reduce(
                              (total, item) => total + Number(item?.cantidadSolicitada || 0),
                              0
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn_principal btn_tabla"
                              onClick={() => cargarPedido(pedido)}
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

              {pedidosPendientes.length > FILAS_POR_PAGINA ? (
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

              <div className="grid_cabecera top_spacing">
                <Campo>
                  <label>Pedido tienda</label>
                  <input type="text" value={formulario.id} readOnly />
                </Campo>
                <Campo>
                  <label>Tienda</label>
                  <input type="text" value={formulario.tienda} readOnly />
                </Campo>
                <Campo>
                  <label>Fecha salida</label>
                  <input
                    type="date"
                    value={formulario.fechaSalida}
                    onChange={(evento) =>
                      setFormulario((anterior) => ({ ...anterior, fechaSalida: evento.target.value }))
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
                      <th>Stock</th>
                      <th>Solicitado</th>
                      <th>Atiende</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formulario.detalle || []).length === 0 ? (
                      <tr>
                        <td colSpan="7" className="sin_datos">
                          Carga un pedido de tienda para atenderlo.
                        </td>
                      </tr>
                    ) : (
                      (formulario.detalle || []).map((item) => (
                        <tr key={item.claveProducto}>
                          <td>{item.codigoCorto || "-"}</td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{Number(item.stockActual || 0)}</td>
                          <td>{Number(item.cantidadSolicitada || 0)}</td>
                          <td className="celda_input">
                            <input
                              type="number"
                              min="0"
                              max={Number(item.stockActual || 0)}
                              value={item.cantidadAtendida}
                              onChange={(evento) =>
                                actualizarCantidadAtendida(item.claveProducto, evento.target.value)
                              }
                              placeholder=""
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="acciones">
                <button type="button" className="btn btn_principal" onClick={confirmarSalida}>
                  Confirmar salida a tienda
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
  .tarjeta__encabezado,
  .top_spacing {
    margin-bottom: 16px;
  }

  input,
  textarea {
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
    min-width: 920px;
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

  .acciones {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
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
