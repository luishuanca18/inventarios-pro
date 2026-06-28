import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, UserAuth } from "../../index";
import {
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import { obtenerNombreResponsableActivo } from "../../utils/responsableActivo";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import {

  sincronizarFlujoProduccionDesdeSupabase,
  sincronizarPedidoFlujoDesdeLocalASupabase,
} from "../../supabase/flujoProduccionCore.js";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

// Este modulo alista telas desde almacen para enviarlas a Produccion.
const CLAVE_DETALLE_PEDIDO = "cynara_detalle_pedido_actual";
const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_DETALLE_OP = "cynara_detalle_op_actual";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const TALLAS_DISPONIBLES = ["S", "M", "L", "XL", "XXL"];
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

const unirTallasSeleccionadas = (tallasSeleccionadas) =>
  tallasSeleccionadas.join("-");

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
};

const obtenerDetalleGuardado = (clave) => {
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

const obtenerListaGuardada = (clave) => {
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

const generarCodigoDespacho = (fechaDespacho) => {
  const fechaBase = fechaDespacho || obtenerFechaActual();
  const [anio, mes, dia] = fechaBase.split("-");
  const anioCorto = anio.slice(-2);

  return `DSP${dia}${mes}${anioCorto}-01`;
};

const crearCabeceraVacia = () => ({
  codigoDespacho: generarCodigoDespacho(obtenerFechaActual()),
  pedidoOrigen: "",
  empresa: "",
  modeloBase: "",
  tipoTela: "",
  tallas: "",
  tallasSeleccionadas: [],
  responsableAlmacen: "",
  observacionesGenerales: "",
});

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

// Une pedidos y OP para que almacen pueda escoger que orden va a alistar.
const crearOrdenesDisponibles = () => {
  const historialPedidos = obtenerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
  const detallePedidoActual = obtenerDetalleGuardado(CLAVE_DETALLE_PEDIDO);
  const ordenes = [];

  historialPedidos.forEach((pedido, indice) => {
    if (!pedido?.datosCabecera || !pedidoTieneContenido(pedido) || pedido?.despachoMateriaPrima) {
      return;
    }

    ordenes.push({
      id: pedido.datosCabecera.codigoInterno || `pedido-${indice + 1}`,
      tipo: "Pedido",
      pedidoOrigen: pedido.datosCabecera.codigoInterno || "",
      empresa: pedido.datosCabecera.empresa || "Cynara",
      modeloBase: pedido.datosCabecera.modeloBase || "",
      tipoTela: pedido.datosCabecera.tipoTela || "",
      observacionesGenerales: pedido.datosCabecera.observacionesGenerales || "",
      tallas: pedido.datosCabecera.tallasBase || "",
      tallasSeleccionadas:
        pedido.datosCabecera.tallasSeleccionadas || TALLAS_DISPONIBLES,
      filasPedido: pedido.filasPedido || [],
    });
  });

  if (
    detallePedidoActual?.datosCabecera &&
    pedidoTieneContenido(detallePedidoActual) &&
    !detallePedidoActual?.despachoMateriaPrima &&
    !ordenes.some(
      (orden) => orden.pedidoOrigen === detallePedidoActual.datosCabecera.codigoInterno
    )
  ) {
    ordenes.unshift({
      id: detallePedidoActual.datosCabecera.codigoInterno || "pedido-actual",
      tipo: "Pedido",
      pedidoOrigen: detallePedidoActual.datosCabecera.codigoInterno || "",
      empresa: detallePedidoActual.datosCabecera.empresa || "Cynara",
      modeloBase: detallePedidoActual.datosCabecera.modeloBase || "",
      tipoTela: detallePedidoActual.datosCabecera.tipoTela || "",
      observacionesGenerales:
        detallePedidoActual.datosCabecera.observacionesGenerales || "",
      tallas: detallePedidoActual.datosCabecera.tallasBase || "",
      tallasSeleccionadas:
        detallePedidoActual.datosCabecera.tallasSeleccionadas ||
        TALLAS_DISPONIBLES,
      filasPedido: detallePedidoActual.filasPedido || [],
    });
  }

  return ordenes;
};

const construirStockTelas = () => {
  const historialIngresos = obtenerListaGuardada(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);

  return historialIngresos.flatMap((ingreso, indiceIngreso) => {
    const cabeceraCompra = ingreso?.cabeceraCompra || {};
    const filasCompra = ingreso?.filasCompra || [];

    return filasCompra.map((fila, indiceFila) => ({
      id: `${cabeceraCompra.codigoInterno || "ingreso"}-tela-${fila.id || indiceFila}-${indiceIngreso}`,
      codigoIngreso: cabeceraCompra.codigoInterno || "-",
      codigoUnidad: fila.codigoUnidad || "-",
      tipoTela:
        fila.tipoTela === "Otro" ? fila.tipoTelaManual || "Otro" : fila.tipoTela || "-",
      colorBase: fila.colorBase || "-",
      acabadoDiseno: fila.acabadoDiseno || "",
      partida: fila.partida || "-",
      proveedor: cabeceraCompra.proveedor || "-",
      ancho: Number(fila.ancho || 0),
      kilos: Number(fila.kilos || 0),
      metros: Number(fila.metros || 0),
    }));
  });
};

const crearFilasDespachoDesdeOrden = (orden, stockTelas) => {
  if (!orden?.filasPedido?.length) {
    return [];
  }

  return orden.filasPedido.map((fila, indice) => {
    const telaEncontrada = stockTelas.find((stock) => {
      if (fila.codigoUnidad) {
        return stock.codigoUnidad === fila.codigoUnidad;
      }

      return (
        stock.tipoTela === (orden.tipoTela || "") &&
        stock.colorBase === (fila.colorBase || fila.color || "")
      );
    });

    return {
      id: fila.id || Date.now() + indice,
      codigoUnidad: fila.codigoUnidad || telaEncontrada?.codigoUnidad || "",
      tipoTela: orden.tipoTela || telaEncontrada?.tipoTela || "",
      colorBase: fila.colorBase || fila.color || "",
      acabadoDiseno: fila.acabadoDiseno || telaEncontrada?.acabadoDiseno || "",
      anchoTela: telaEncontrada?.ancho ? String(telaEncontrada.ancho) : "",
      partida: telaEncontrada?.partida || "",
      observacion:
        fila.observacion ||
        (telaEncontrada?.partida && telaEncontrada.partida !== "-"
          ? `PARTIDA ${telaEncontrada.partida}`
          : ""),
      verificado: false,
      listoEnviar: false,
    };
  });
};

export function DespachoProduccion() {
  const { user } = UserAuth();
  const responsableActivo = useMemo(
    () => obtenerNombreResponsableActivo(user),
    [user]
  );
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [ordenesDisponibles, setOrdenesDisponibles] = useState(crearOrdenesDisponibles);
  const [stockTelas] = useState(construirStockTelas);
  const [ordenSeleccionadaId, setOrdenSeleccionadaId] = useState("");
  const [cabeceraDespacho, setCabeceraDespacho] = useState(crearCabeceraVacia);

  useEffect(() => {
    if (!responsableActivo) return;

    setCabeceraDespacho((anterior) =>
      anterior?.responsableAlmacen?.trim()
        ? anterior
        : {
            ...anterior,
            responsableAlmacen: responsableActivo,
          }
    );
  }, [responsableActivo]);
  const [filasDespacho, setFilasDespacho] = useState([]);
  const [paginaOrdenes, setPaginaOrdenes] = useState(1);

  const totalPaginasOrdenes = Math.max(
    1,
    Math.ceil(ordenesDisponibles.length / FILAS_POR_PAGINA)
  );

  const ordenesPaginadas = useMemo(() => {
    const inicio = (paginaOrdenes - 1) * FILAS_POR_PAGINA;
    return ordenesDisponibles.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [ordenesDisponibles, paginaOrdenes]);

  useEffect(() => {
    let activo = true;
    const sincronizar = async () => {
      try {
        await sincronizarFlujoProduccionDesdeSupabase();
        if (!activo) return;
        setOrdenesDisponibles(crearOrdenesDisponibles());
      } catch (error) {
        console.error("No se pudo sincronizar despacho a produccion:", error.message);
      }
    };
    sincronizar();
    return () => {
      activo = false;
    };
  }, []);

  // Al escoger una orden se llena la cabecera y se prepara la lista de telas a alistar.
  const manejarSeleccionOrden = (orden) => {
    setOrdenSeleccionadaId(orden.id);
    setCabeceraDespacho({
      codigoDespacho: generarCodigoDespacho(obtenerFechaActual()),
      pedidoOrigen: orden.pedidoOrigen || "",
      empresa: orden.empresa || "",
      modeloBase: orden.modeloBase || "",
      tipoTela: orden.tipoTela || "",
      observacionesGenerales: orden.observacionesGenerales || "",
      tallas:
        orden.tallas || unirTallasSeleccionadas(orden.tallasSeleccionadas || []),
      tallasSeleccionadas: orden.tallasSeleccionadas || [],
      responsableAlmacen: responsableActivo || "",
    });
    setFilasDespacho(crearFilasDespachoDesdeOrden(orden, stockTelas));
    mostrarNotificacionCarga("Orden cargada para despacho.");
  };

  // Cambios simples de la cabecera del despacho.
  const manejarCambioCabecera = (evento) => {
    const { name, value } = evento.target;

    setCabeceraDespacho((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const manejarCambioTalla = (talla) => {
    setCabeceraDespacho((anterior) => {
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

  // Cambios puntuales de cada tela alistada.
  const manejarCambioFila = (idFila, campo, valor) => {
    setFilasDespacho((anterior) =>
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

  // Estos checks marcan el progreso de alistado de cada tela.
  const manejarCheckFila = (idFila, campo) => {
    setFilasDespacho((anterior) =>
      anterior.map((fila) => {
        if (fila.id !== idFila) {
          return fila;
        }

        const filaActualizada = {
          ...fila,
          [campo]: !fila[campo],
        };

        if (campo === "verificado" && !filaActualizada.verificado) {
          filaActualizada.listoEnviar = false;
        }

        if (campo === "listoEnviar" && filaActualizada.listoEnviar) {
          filaActualizada.verificado = true;
        }

        return filaActualizada;
      })
    );
  };

  const totalVerificadas = filasDespacho.filter((fila) => fila.verificado).length;
  const totalListas = filasDespacho.filter((fila) => fila.listoEnviar).length;

  const manejarGuardar = async () => {
    if (!cabeceraDespacho.pedidoOrigen) {
      await mostrarAlertaSistema("Selecciona primero una orden para confirmar el despacho.");
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Confirmando despacho de materia prima...",
      mensajeExito: "Despacho de materia prima confirmado.",
      mensajeError: "No se pudo confirmar el despacho de materia prima.",
      accion: async () => {
        const historialPedidos = obtenerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
        const datosDespacho = {
          codigoDespacho: cabeceraDespacho.codigoDespacho,
          fechaDespacho: obtenerFechaActual(),
          responsableAlmacen: cabeceraDespacho.responsableAlmacen,
          observacionesGenerales: cabeceraDespacho.observacionesGenerales,
          filasDespacho,
        };

        const historialActualizado = historialPedidos.map((pedido) =>
          pedido?.datosCabecera?.codigoInterno === cabeceraDespacho.pedidoOrigen
            ? {
                ...pedido,
                datosCabecera: {
                  ...(pedido?.datosCabecera || {}),
                  observacionesGenerales: cabeceraDespacho.observacionesGenerales || "",
                },
                despachoMateriaPrima: true,
                despachoMateriaPrimaInfo: datosDespacho,
              }
            : pedido
        );

        localStorage.setItem(CLAVE_HISTORIAL_PEDIDOS, JSON.stringify(historialActualizado));

        const pedidoActual = obtenerDetalleGuardado(CLAVE_DETALLE_PEDIDO);
        if (pedidoActual?.datosCabecera?.codigoInterno === cabeceraDespacho.pedidoOrigen) {
          localStorage.setItem(
            CLAVE_DETALLE_PEDIDO,
            JSON.stringify({
              ...pedidoActual,
              datosCabecera: {
                ...(pedidoActual?.datosCabecera || {}),
                observacionesGenerales: cabeceraDespacho.observacionesGenerales || "",
              },
              despachoMateriaPrima: true,
              despachoMateriaPrimaInfo: datosDespacho,
            })
          );
        }

        const historialOp = obtenerListaGuardada(CLAVE_HISTORIAL_OP);
        localStorage.setItem(
          CLAVE_HISTORIAL_OP,
          JSON.stringify(
            historialOp.map((registro) =>
              registro?.cabeceraOp?.pedidoOrigen === cabeceraDespacho.pedidoOrigen
                ? {
                    ...registro,
                    cabeceraOp: {
                      ...(registro?.cabeceraOp || {}),
                      observacionesGenerales:
                        cabeceraDespacho.observacionesGenerales || "",
                    },
                  }
                : registro
            )
          )
        );

        const detalleOpActual = obtenerDetalleGuardado(CLAVE_DETALLE_OP);
        if (detalleOpActual?.cabeceraOp?.pedidoOrigen === cabeceraDespacho.pedidoOrigen) {
          localStorage.setItem(
            CLAVE_DETALLE_OP,
            JSON.stringify({
              ...detalleOpActual,
              cabeceraOp: {
                ...(detalleOpActual?.cabeceraOp || {}),
                observacionesGenerales: cabeceraDespacho.observacionesGenerales || "",
              },
            })
          );
        }

        setOrdenesDisponibles((anterior) =>
          anterior.filter((orden) => orden.pedidoOrigen !== cabeceraDespacho.pedidoOrigen)
        );
        setOrdenSeleccionadaId("");
        setCabeceraDespacho(crearCabeceraVacia());
        setFilasDespacho([]);
        setPaginaOrdenes(1);

        try {
          await sincronizarPedidoFlujoDesdeLocalASupabase(cabeceraDespacho.pedidoOrigen);
          await sincronizarFlujoProduccionDesdeSupabase();
          setOrdenesDisponibles(crearOrdenesDisponibles());
        } catch (error) {
          console.error("No se pudo sincronizar el despacho en Supabase:", error.message);
        }
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
          <h1>Despacho a produccion</h1>
          <p>
            Almacen elige la orden, alista las telas, marca verificacion
            y recien las deja listas para enviar a Produccion.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Telas listas para enviar</span>
          <strong>{totalListas}</strong>
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
              <h2>Ordenes disponibles</h2>
              <p>
                Escoge el pedido u OP que quieres alistar desde almacen.
              </p>
            </div>
          </div>

          <div className="lista_ordenes">
            {ordenesDisponibles.length === 0 ? (
              <div className="orden_vacia">
                Todavia no hay pedidos u OP guardados para despachar a Produccion.
              </div>
            ) : (
              ordenesPaginadas.map((orden) => (
                <button
                  type="button"
                  key={orden.id}
                  className={`tarjeta_orden ${
                    ordenSeleccionadaId === orden.id ? "tarjeta_orden_activa" : ""
                  }`}
                  onClick={() => manejarSeleccionOrden(orden)}
                >
                  <span className="tarjeta_orden__tipo">{orden.tipo}</span>
                  <strong>{orden.pedidoOrigen || "Sin codigo"}</strong>
                  <p>{orden.modeloBase || "Sin modelo"}</p>
                  <small>{orden.tipoTela || "Sin tela"}</small>
                </button>
              ))
            )}
          </div>

          {ordenesDisponibles.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaOrdenes((anterior) => Math.max(1, anterior - 1))}
                disabled={paginaOrdenes === 1}
              >
                Anterior
              </button>

              <span>
                Pagina {paginaOrdenes} de {totalPaginasOrdenes}
              </span>

              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaOrdenes((anterior) =>
                    Math.min(totalPaginasOrdenes, anterior + 1)
                  )
                }
                disabled={paginaOrdenes === totalPaginasOrdenes}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>

        <section className="tarjeta">
          <h2>Cabecera de despacho a produccion</h2>

          <div className="grid grid-2">
            <Campo>
              <label>Codigo despacho</label>
              <input type="text" value={cabeceraDespacho.codigoDespacho} readOnly />
            </Campo>

            <Campo>
              <label>Pedido origen</label>
              <input
                type="text"
                name="pedidoOrigen"
                value={cabeceraDespacho.pedidoOrigen}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo>
              <label>Empresa</label>
              <input
                type="text"
                name="empresa"
                value={cabeceraDespacho.empresa}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo>
              <label>Modelo base</label>
              <input
                type="text"
                name="modeloBase"
                value={cabeceraDespacho.modeloBase}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo>
              <label>Tipo de tela</label>
              <input
                type="text"
                name="tipoTela"
                value={cabeceraDespacho.tipoTela}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo>
              <label>Responsable de almacen</label>
              <input
                type="text"
                name="responsableAlmacen"
                value={cabeceraDespacho.responsableAlmacen}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
            </Campo>

            <Campo className="campo-completo">
              <label>Observaciones generales</label>
              <textarea
                name="observacionesGenerales"
                value={cabeceraDespacho.observacionesGenerales}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
            </Campo>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Telas alistadas para Produccion</h2>
              <p>
                Aqui almacen revisa las telas heredadas de la orden y marca su
                estado antes del envio.
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
                  <th>Acabado / diseÃ±o</th>
                  <th>Ancho de tela</th>
                  <th>Partida</th>
                  <th>Verificado</th>
                  <th>Listo para enviar</th>
                </tr>
              </thead>

              <tbody>
                {filasDespacho.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="tabla_vacia">
                      Primero selecciona una orden para ver las telas que se van a alistar.
                    </td>
                  </tr>
                ) : (
                  filasDespacho.map((fila) => (
                    <tr key={fila.id}>
                    <td>
                      <input
                        type="text"
                        value={fila.codigoUnidad}
                          onChange={(evento) =>
                            manejarCambioFila(fila.id, "codigoUnidad", evento.target.value)
                          }
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={fila.tipoTela || ""}
                        onChange={(evento) =>
                          manejarCambioFila(fila.id, "tipoTela", evento.target.value)
                        }
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                          value={fila.colorBase}
                          onChange={(evento) =>
                            manejarCambioFila(fila.id, "colorBase", evento.target.value)
                          }
                        placeholder=""
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={fila.acabadoDiseno || ""}
                        onChange={(evento) =>
                          manejarCambioFila(fila.id, "acabadoDiseno", evento.target.value)
                        }
                        placeholder=""
                      />
                    </td>

                    <td>
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

                    <td>
                      <input
                        type="text"
                        value={fila.partida || ""}
                        onChange={(evento) =>
                          manejarCambioFila(fila.id, "partida", evento.target.value)
                        }
                        placeholder=""
                      />
                    </td>

                      <td>
                        <div className="columna_check">
                          <input
                            type="checkbox"
                            checked={fila.verificado}
                            onChange={() => manejarCheckFila(fila.id, "verificado")}
                          />
                        </div>
                      </td>

                      <td>
                        <div className="columna_check">
                          <input
                            type="checkbox"
                            checked={fila.listoEnviar}
                            onChange={() => manejarCheckFila(fila.id, "listoEnviar")}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Telas alistadas</span>
              <strong>{filasDespacho.length}</strong>
            </div>

            <div>
              <span>Verificadas</span>
              <strong>{totalVerificadas}</strong>
            </div>

            <div>
              <span>Listas para enviar</span>
              <strong>{totalListas}</strong>
            </div>
          </div>
        </section>

        <section className="acciones">
          <button type="button" className="btn btn_secundario">
            Cancelar
          </button>
          <button type="button" className="btn btn_secundario">
            Guardar borrador
          </button>
          <button type="button" className="btn btn_principal" onClick={manejarGuardar}>
            Confirmar despacho
          </button>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
  /* Contenedor principal del modulo de despacho a produccion. */
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
  .resumen span,
  .tabla_vacia,
  .orden_vacia {
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

  .fila_superior {
    display: flex;
    justify-content: flex-start;
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

  .lista_ordenes {
    display: grid;
    gap: 12px;
  }

  .orden_vacia {
    padding: 16px;
    border-radius: 14px;
    border: 1px dashed ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgtotal};
  }

  .tarjeta_orden {
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

  .tarjeta_orden_activa {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px rgba(117, 1, 152, 0.14);
  }

  .tarjeta_orden__tipo {
    display: inline-flex;
    width: fit-content;
    padding: 4px 8px;
    border-radius: 999px;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
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

  .columna_check {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 44px;
  }

  .columna_check input {
    width: 18px;
    height: 18px;
    accent-color: ${({ theme }) => theme.bg5};
  }

  .tabla_vacia {
    text-align: center;
    padding: 18px 10px;
  }

  .paginacion {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    flex-wrap: wrap;
  }

  .paginacion span {
    font-size: 14px;
    color: ${({ theme }) => theme.colorSubtitle};
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

  .btn_tabla {
    width: 100%;
    padding: 10px 12px;
  }

  @media (min-width: 860px) {
    .lista_ordenes {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .grid-2,
    .resumen__grid {
      grid-template-columns: 1fr;
    }

    .tarjeta__encabezado,
    .acciones,
    .paginacion {
      flex-direction: column;
      align-items: stretch;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;

const Campo = styled.div`
  /* Estilo base de inputs, textarea y select del formulario. */
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
`;

const CheckTalla = styled.label`
  /* Checks de talla heredados del pedido u OP. */
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




