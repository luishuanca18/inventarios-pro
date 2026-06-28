import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { leerCatalogosProduccion } from "../../utils/catalogosProduccion";
import {

  sincronizarFlujoProduccionDesdeSupabase,
  sincronizarPedidoFlujoDesdeLocalASupabase,
} from "../../supabase/flujoProduccionCore.js";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_DETALLE_PEDIDO = "cynara_detalle_pedido_actual";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_DETALLE_OP = "cynara_detalle_op_actual";
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

const leerDatoGuardado = (clave) => {
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

const filaPedidoEstaVacia = (fila = {}) =>
  !fila.codigoUnidad &&
  !fila.colorBase &&
  !fila.acabadoDiseno &&
  !fila.partida &&
  !fila.pesoTela &&
  !fila.cantidad &&
  !fila.observacion;

const pedidoTieneContenido = (pedido) => {
  const cabecera = pedido?.datosCabecera || {};
  const filas = pedido?.filasPedido || [];

  return Boolean(
    cabecera?.codigoInterno &&
      (cabecera?.solicitante ||
        cabecera?.categoriaModelo ||
        cabecera?.modeloCatalogo ||
        cabecera?.telaModelo ||
        cabecera?.modeloBase ||
        cabecera?.tipoTela ||
        cabecera?.observacionesGenerales ||
        filas.some((fila) => !filaPedidoEstaVacia(fila)))
  );
};

const crearPedidosRegistrados = () => {
  const historial = leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
  const pedidoActual = leerDatoGuardado(CLAVE_DETALLE_PEDIDO);
  const listaBase = [...historial];

  if (
    pedidoActual?.datosCabecera?.codigoInterno &&
    pedidoTieneContenido(pedidoActual) &&
    !listaBase.some(
      (pedido) =>
        pedido?.datosCabecera?.codigoInterno ===
        pedidoActual?.datosCabecera?.codigoInterno
    )
  ) {
    listaBase.unshift(pedidoActual);
  }

  return listaBase;
};

const obtenerEstadoPedido = (pedido) => {
  if (pedido?.cancelado) {
    return "Cancelado";
  }

  if (pedido?.opGenerada) {
    return "Con OP generada";
  }

  if (pedido?.despachoMateriaPrima) {
    return "Despachado a produccion";
  }

  return "Pendiente de despacho";
};

export function PedidosRegistrados() {
  const catalogosProduccion = useMemo(leerCatalogosProduccion, []);
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroTipoTela, setFiltroTipoTela] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState("");
  const [pedidosRegistrados, setPedidosRegistrados] = useState(crearPedidosRegistrados);

  useEffect(() => {
    let activo = true;
    const sincronizar = async () => {
      try {
        const data = await sincronizarFlujoProduccionDesdeSupabase();
        if (!activo) return;
        setPedidosRegistrados(data?.pedidos || []);
      } catch (error) {
        console.error("No se pudo sincronizar historial de pedidos:", error.message);
      }
    };
    sincronizar();
    return () => {
      activo = false;
    };
  }, []);

  const pedidosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const estadoBuscado = filtroEstado.trim().toLowerCase();
    const tipoTelaBuscada = filtroTipoTela.trim().toLowerCase();
    const responsableBuscado = filtroResponsable.trim().toLowerCase();

    return pedidosRegistrados.filter((pedido) => {
      const fechaPedido = pedido?.datosCabecera?.fechaSolicitud || "";
      const estadoPedido = obtenerEstadoPedido(pedido).toLowerCase();
      const tipoTelaPedido = (pedido?.datosCabecera?.tipoTela || "").toLowerCase();
      const responsablePedido = (pedido?.datosCabecera?.solicitante || "").toLowerCase();
      const coincideFechaDesde = !fechaDesde || (fechaPedido && fechaPedido >= fechaDesde);
      const coincideFechaHasta = !fechaHasta || (fechaPedido && fechaPedido <= fechaHasta);
      const coincideEstado = !estadoBuscado || estadoPedido === estadoBuscado;
      const coincideTipoTela =
        !tipoTelaBuscada || tipoTelaPedido.includes(tipoTelaBuscada);
      const coincideResponsable =
        !responsableBuscado || responsablePedido.includes(responsableBuscado);
      const coincideTexto =
        !texto ||
        [
          pedido?.datosCabecera?.codigoInterno,
          pedido?.datosCabecera?.modeloBase,
          pedido?.datosCabecera?.tipoTela,
          pedido?.datosCabecera?.solicitante,
          obtenerEstadoPedido(pedido),
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto);

      return (
        coincideFechaDesde &&
        coincideFechaHasta &&
        coincideEstado &&
        coincideTipoTela &&
        coincideResponsable &&
        coincideTexto
      );
    });
  }, [
    busqueda,
    fechaDesde,
    fechaHasta,
    filtroEstado,
    filtroTipoTela,
    filtroResponsable,
    pedidosRegistrados,
  ]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(pedidosFiltrados.length / FILAS_POR_PAGINA)
  );

  const pedidosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return pedidosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [paginaActual, pedidosFiltrados]);

  const pedidoSeleccionado =
    pedidosRegistrados.find(
      (pedido) => pedido?.datosCabecera?.codigoInterno === pedidoSeleccionadoId
    ) || pedidosFiltrados[0] || null;

  const manejarCancelarPedido = async (pedido) => {
    const codigoPedido = pedido?.datosCabecera?.codigoInterno || "";

    if (!codigoPedido) {
      alert("Selecciona primero un pedido valido.");
      return;
    }

    if (pedido?.cancelado) {
      alert("Este pedido ya esta cancelado.");
      return;
    }

    const confirmar = window.confirm(
      `Seguro que deseas cancelar esta orden de pedido?\n\nPedido: ${codigoPedido}\nModelo: ${pedido?.datosCabecera?.modeloBase || "-"}\n\nEl pedido dejara de aparecer en el flujo activo, aunque ya tenga avance en Produccion.`
    );

    if (!confirmar) {
      return;
    }

    const fechaCancelacion = new Date().toISOString().slice(0, 10);
    const historialPedidos = leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
    const historialPedidosActualizado = historialPedidos.map((item) =>
      item?.datosCabecera?.codigoInterno === codigoPedido
        ? {
            ...item,
            cancelado: true,
            fechaCancelacion,
          }
        : item
    );

    localStorage.setItem(
      CLAVE_HISTORIAL_PEDIDOS,
      JSON.stringify(historialPedidosActualizado)
    );

    const pedidoActual = leerDatoGuardado(CLAVE_DETALLE_PEDIDO);
    if (pedidoActual?.datosCabecera?.codigoInterno === codigoPedido) {
      localStorage.setItem(
        CLAVE_DETALLE_PEDIDO,
        JSON.stringify({
          ...pedidoActual,
          cancelado: true,
          fechaCancelacion,
        })
      );
    }

    const historialOp = leerListaGuardada(CLAVE_HISTORIAL_OP);
    localStorage.setItem(
      CLAVE_HISTORIAL_OP,
      JSON.stringify(
        historialOp.map((item) =>
          item?.cabeceraOp?.pedidoOrigen === codigoPedido
            ? { ...item, cancelado: true }
            : item
        )
      )
    );

    const detalleOpActual = leerDatoGuardado(CLAVE_DETALLE_OP);
    if (detalleOpActual?.cabeceraOp?.pedidoOrigen === codigoPedido) {
      localStorage.setItem(
        CLAVE_DETALLE_OP,
        JSON.stringify({
          ...detalleOpActual,
          cancelado: true,
        })
      );
    }

    setPedidosRegistrados(crearPedidosRegistrados());
    setPedidoSeleccionadoId(codigoPedido);

    try {
      await sincronizarPedidoFlujoDesdeLocalASupabase(codigoPedido);
      const data = await sincronizarFlujoProduccionDesdeSupabase();
      setPedidosRegistrados(data?.pedidos || crearPedidosRegistrados());
    } catch (error) {
      console.error("No se pudo sincronizar la cancelacion del historial:", error.message);
    }
    alert("Pedido cancelado desde historial.");
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
          <h1>Pedidos registrados</h1>
          <p>
            Aqui puedes revisar rapido si ya existe un pedido, que modelo lleva y
            que telas tiene asignadas sin entrar a editarlo.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Pedidos visibles</span>
          <strong>{pedidosFiltrados.length}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/produccion" className="boton_volver">
          Volver a Produccion
        </Link>

        <div className="navegacion_superior">
          <Link to="/produccion" className="btn btn_secundario btn_enlace">
            Atras
          </Link>
          <Link to="/produccion/detalle-pedido" className="btn btn_principal btn_enlace">
            Siguiente
          </Link>
        </div>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Historial de pedidos</h2>
              <p>
                Usa filtros para encontrar rapido un pedido y luego carga su
                detalle abajo.
              </p>
            </div>
          </div>

          <div className="filtros">
            <input
              type="date"
              value={fechaDesde}
              onChange={(evento) => {
                setFechaDesde(evento.target.value);
                setPaginaActual(1);
              }}
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={(evento) => {
                setFechaHasta(evento.target.value);
                setPaginaActual(1);
              }}
            />
            <input
              type="text"
              list="filtro-estados-pedido"
              value={filtroEstado}
              onChange={(evento) => {
                setFiltroEstado(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Filtrar por estado"
            />
            <datalist id="filtro-estados-pedido">
              <option value="Cancelado" />
              <option value="Pendiente de despacho" />
              <option value="Despachado a produccion" />
              <option value="Con OP generada" />
            </datalist>
            <input
              type="text"
              list="filtro-tipo-tela-pedido"
              value={filtroTipoTela}
              onChange={(evento) => {
                setFiltroTipoTela(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Filtrar por tipo de tela"
            />
            <datalist id="filtro-tipo-tela-pedido">
              {catalogosProduccion.tiposTela.map((tipoTela) => (
                <option key={tipoTela} value={tipoTela} />
              ))}
            </datalist>
            <input
              type="text"
              list="filtro-responsable-pedido"
              value={filtroResponsable}
              onChange={(evento) => {
                setFiltroResponsable(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Filtrar por responsable"
            />
            <datalist id="filtro-responsable-pedido">
              {catalogosProduccion.personal.map((persona) => (
                <option key={persona} value={persona} />
              ))}
            </datalist>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por codigo, modelo, tela, responsable o estado"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo pedido</th>
                  <th>Fecha</th>
                  <th>Modelo completo</th>
                  <th>Tipo de tela</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {pedidosPaginados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="fila_vacia">
                      Todavia no hay pedidos registrados para mostrar.
                    </td>
                  </tr>
                ) : (
                  pedidosPaginados.map((pedido) => {
                    const codigoPedido = pedido?.datosCabecera?.codigoInterno || "";
                    const estaActivo =
                      codigoPedido ===
                      (pedidoSeleccionado?.datosCabecera?.codigoInterno || "");

                    return (
                      <tr
                        key={codigoPedido}
                        className={estaActivo ? "fila_activa" : ""}
                      >
                        <td>{codigoPedido || "-"}</td>
                        <td>{pedido?.datosCabecera?.fechaSolicitud || "-"}</td>
                        <td>{pedido?.datosCabecera?.modeloBase || "-"}</td>
                        <td>{pedido?.datosCabecera?.tipoTela || "-"}</td>
                        <td>{pedido?.datosCabecera?.solicitante || "-"}</td>
                        <td>{obtenerEstadoPedido(pedido)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn_principal btn_tabla"
                            onClick={() => setPedidoSeleccionadoId(codigoPedido)}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {pedidosFiltrados.length > FILAS_POR_PAGINA ? (
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

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Detalle del pedido</h2>
              <p>
                Aqui ves el modelo completo, la tela principal y la lista real de
                telas que acompanan al pedido.
              </p>
            </div>
          </div>

          {!pedidoSeleccionado ? (
            <div className="pedido_vacio">
              Selecciona un pedido para ver su detalle.
            </div>
          ) : (
            <>
              <div className="resumen_detalle">
                <div>
                  <span>Codigo pedido</span>
                  <strong>{pedidoSeleccionado?.datosCabecera?.codigoInterno || "-"}</strong>
                </div>
                <div>
                  <span>Modelo completo</span>
                  <strong>{pedidoSeleccionado?.datosCabecera?.modeloBase || "-"}</strong>
                </div>
                <div>
                  <span>Tipo de tela</span>
                  <strong>{pedidoSeleccionado?.datosCabecera?.tipoTela || "-"}</strong>
                </div>
                <div>
                  <span>Responsable</span>
                  <strong>{pedidoSeleccionado?.datosCabecera?.solicitante || "-"}</strong>
                </div>
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Codigo unidad</th>
                      <th>Color base</th>
                      <th>Acabado / diseÃ±o</th>
                      <th>Partida</th>
                      <th>Peso tela</th>
                      <th>Observacion</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(pedidoSeleccionado?.filasPedido || []).filter(
                      (fila) => !filaPedidoEstaVacia(fila)
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="fila_vacia">
                          Este pedido todavia no tiene telas visibles.
                        </td>
                      </tr>
                    ) : (
                      (pedidoSeleccionado?.filasPedido || [])
                        .filter((fila) => !filaPedidoEstaVacia(fila))
                        .map((fila, indice) => (
                          <tr key={fila.id || indice}>
                            <td>{fila.codigoUnidad || "-"}</td>
                            <td>{fila.colorBase || "-"}</td>
                            <td>{fila.acabadoDiseno || "-"}</td>
                            <td>{fila.partida || "-"}</td>
                            <td>{fila.pesoTela || "-"}</td>
                            <td>{fila.observacion || "-"}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              {!pedidoSeleccionado?.cancelado ? (
                <div className="acciones_detalle">
                  <button
                    type="button"
                    className="btn btn_peligro"
                    onClick={() => manejarCancelarPedido(pedidoSeleccionado)}
                  >
                    Cancelar pedido
                  </button>
                </div>
              ) : null}
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
  .tarjeta p {
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
  .resumen_detalle span,
  .paginacion span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 14px;
  }

  .cabecera__estado strong,
  .resumen_detalle strong {
    font-size: 28px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior {
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
    padding: 12px 18px;
    border-radius: 12px;
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
    text-decoration: none;
    font-weight: 700;
  }

  .navegacion_superior {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
  }

  .btn_peligro {
    background-color: #b3261e;
    color: #fff;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .tarjeta__encabezado {
    margin-bottom: 16px;
  }

  .acciones_detalle {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
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

  .filtros {
    display: grid;
    grid-template-columns: repeat(3, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .filtros input {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.colorline};
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .pedido_vacio {
    padding: 18px;
    border-radius: 14px;
    border: 1px dashed ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .resumen_detalle {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .resumen_detalle > div {
    background-color: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.colorline};
    border-radius: 14px;
    padding: 14px;
    display: grid;
    gap: 6px;
  }

  .resumen_detalle strong {
    font-size: 16px;
    color: ${({ theme }) => theme.text};
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 720px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid ${({ theme }) => theme.colorline};
    text-align: left;
  }

  .fila_activa {
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.08)" : "rgba(117, 1, 152, 0.12)"};
  }

  .btn_tabla {
    padding: 9px 14px;
    border-radius: 10px;
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
      grid-template-columns: 1fr;
      display: grid;
    }

    .filtros {
      grid-template-columns: 1fr;
    }

    .cabecera__estado {
      min-width: 100%;
    }
  }
`;




