import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { leerCatalogosProduccion } from "../../utils/catalogosProduccion";
import {
  cerrarProcesoSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
  mostrarProcesoSistema,
} from "../../utils/notificaciones";
import {
  leerAjustesPrendas,
  leerLotesProductosTerminados,
  leerProductosTerminados,
  reconstruirStockProductosTerminadosDesdeLotes,
  repararIdentidadCatalogoProductosTerminados,
  registrarAjusteProductoTerminado,
} from "../../utils/productosTerminados";
import {
  listarModelosProductoConfiguracion,
  listarVariantesProductoConfiguracion,
} from "../../supabase/configuracionCore";
import { mezclarCatalogoConStock } from "../../utils/stockProductosCatalogo";
import {

  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";
import {
  sincronizarTallerStockDesdeLocalASupabase,
  sincronizarTallerStockDesdeSupabase,
} from "../../supabase/flujoTallerStockCore";
import { useEffect } from "react";

const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

const normalizarTextoBusqueda = (valor = "") =>
  valor.toString().trim().toLowerCase();

const formatearNumero = (valor) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(valor || 0));

const crearIdAjuste = () => `AJP-${Date.now()}`;

const construirResumenHistorial = (registros = []) =>
  (Array.isArray(registros) ? registros : []).map((item) => ({
    ...item,
    tipoSaldo:
      Number(item?.diferencia || 0) > 0
        ? "Sobrante"
        : Number(item?.diferencia || 0) < 0
        ? "Faltante"
        : "Sin cambio",
  }));

export function AjustesPrendas() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroModelo, setFiltroModelo] = useState("");
  const [filtroColor, setFiltroColor] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [pestanaActiva, setPestanaActiva] = useState("stock");
  const [productos, setProductos] = useState(leerProductosTerminados);
  const [historialAjustes, setHistorialAjustes] = useState(leerAjustesPrendas);
  const [ajusteActual, setAjusteActual] = useState(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [catalogoModelos, setCatalogoModelos] = useState([]);
  const [catalogoVariantes, setCatalogoVariantes] = useState([]);
  const [formulario, setFormulario] = useState({
    ajusteId: "",
    fecha: new Date().toISOString().slice(0, 10),
    stockFisico: "",
    motivoAjuste: "",
    observacionAjuste: "",
  });

  const catalogos = useMemo(leerCatalogosProduccion, []);
  const motivosDisponibles = useMemo(() => {
    const base = Array.isArray(catalogos?.motivosAjuste)
      ? catalogos.motivosAjuste
      : [];
    const extras = ["Inventario fisico", "Perdida", "Diferencia de conteo"];
    return Array.from(new Set([...extras, ...base])).filter(Boolean);
  }, [catalogos]);

  const construirProductosAjustables = (
    modelos = catalogoModelos,
    variantes = catalogoVariantes
  ) =>
    mezclarCatalogoConStock({
      productosTerminados: leerProductosTerminados(),
      catalogoModelos: Array.isArray(modelos) ? modelos : [],
      catalogoVariantes: Array.isArray(variantes) ? variantes : [],
    });

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargandoDatos(true);
        const [_, modelos, variantes] = await Promise.all([
          sincronizarTallerStockDesdeSupabase(),
          listarModelosProductoConfiguracion(),
          listarVariantesProductoConfiguracion(),
        ]);
        const stockActual = leerProductosTerminados();
        const lotesActuales = leerLotesProductosTerminados();
        if (stockActual.length === 0 && lotesActuales.length > 0) {
          reconstruirStockProductosTerminadosDesdeLotes();
        }
        await repararIdentidadCatalogoProductosTerminados();
        await sincronizarTallerStockDesdeLocalASupabase();
        setCatalogoModelos(Array.isArray(modelos) ? modelos : []);
        setCatalogoVariantes(Array.isArray(variantes) ? variantes : []);
        setProductos(construirProductosAjustables(modelos, variantes));
      } catch (error) {
        console.error("No se pudo sincronizar ajustes de prendas:", error);
      } finally {
        setHistorialAjustes(leerAjustesPrendas());
        setCargandoDatos(false);
      }
    };

    cargarDatos();
  }, []);

  useEffect(() => {
    if (cargandoDatos) {
      mostrarProcesoSistema("Cargando stock y catalogo operativo para ajustes...");
    } else {
      cerrarProcesoSistema();
    }

    return () => {
      cerrarProcesoSistema();
    };
  }, [cargandoDatos]);

  const productosFiltrados = useMemo(() => {
    const texto = normalizarTextoBusqueda(busqueda);
    const modelo = normalizarTextoBusqueda(filtroModelo);
    const color = normalizarTextoBusqueda(filtroColor);
    const talla = normalizarTextoBusqueda(filtroTalla);

    return productos.filter((item) =>
      (!modelo || (item?.modelo || "").toLowerCase() === modelo) &&
      (!color || (item?.colorBase || "").toLowerCase() === color) &&
      (!talla || (item?.talla || "").toLowerCase() === talla) &&
      (!texto ||
        [
          item?.codigoCorto,
          item?.codigoProducto,
          item?.codigoBarraTexto,
          item?.modelo,
          item?.colorBase,
          item?.talla,
          item?.tipoTela,
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto))
    );
  }, [busqueda, filtroColor, filtroModelo, filtroTalla, productos]);

  const modelosDisponibles = useMemo(
    () =>
      Array.from(new Set(productos.map((item) => item?.modelo || "").filter(Boolean))).sort(),
    [productos]
  );
  const coloresDisponibles = useMemo(
    () =>
      Array.from(new Set(productos.map((item) => item?.colorBase || "").filter(Boolean))).sort(),
    [productos]
  );
  const tallasDisponibles = useMemo(
    () =>
      Array.from(new Set(productos.map((item) => item?.talla || "").filter(Boolean))).sort(),
    [productos]
  );

  const historialFiltrado = useMemo(() => {
    const texto = normalizarTextoBusqueda(busqueda);
    return construirResumenHistorial(historialAjustes).filter((item) =>
      !texto ||
      [
        item?.codigoCorto,
        item?.codigoProducto,
        item?.modelo,
        item?.colorBase,
        item?.talla,
        item?.motivoAjuste,
        item?.observacionAjuste,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, historialAjustes]);

  const listaActual = pestanaActiva === "stock" ? productosFiltrados : historialFiltrado;
  const totalPaginas = Math.max(1, Math.ceil(listaActual.length / FILAS_POR_PAGINA));
  const listaPaginada = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return listaActual.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [listaActual, paginaActual]);

  const totalStockActual = useMemo(
    () => productos.reduce((total, item) => total + Number(item?.stockActual || 0), 0),
    [productos]
  );
  const totalDiferencias = useMemo(
    () =>
      historialAjustes.reduce(
        (total, item) => total + Number(item?.diferencia || 0),
        0
      ),
    [historialAjustes]
  );

  const diferenciaCalculada =
    Number(formulario.stockFisico || 0) - Number(ajusteActual?.stockActual || 0);

  const abrirAjuste = (producto, ajusteGuardado = null) => {
    setAjusteActual(producto);
    setFormulario({
      ajusteId: ajusteGuardado?.id || "",
      fecha: ajusteGuardado?.fecha || new Date().toISOString().slice(0, 10),
      stockFisico: String(
        ajusteGuardado?.stockFisico ?? Number(producto?.stockActual || 0)
      ),
      motivoAjuste: ajusteGuardado?.motivoAjuste || "",
      observacionAjuste: ajusteGuardado?.observacionAjuste || "",
    });
  };

  const limpiarFormulario = () => {
    setAjusteActual(null);
    setFormulario({
      ajusteId: "",
      fecha: new Date().toISOString().slice(0, 10),
      stockFisico: "",
      motivoAjuste: "",
      observacionAjuste: "",
    });
  };

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const guardarAjuste = async () => {
    if (guardandoAjuste) {
      return;
    }

    if (!ajusteActual) {
      mostrarAlertaSistema("Selecciona primero una prenda para ajustar.");
      return;
    }

    if (!formulario.motivoAjuste.trim()) {
      mostrarAlertaSistema("Selecciona un motivo de ajuste.");
      return;
    }

    try {
      setGuardandoAjuste(true);
      mostrarProcesoSistema("Guardando ajuste de prenda...");

      const ajusteRegistrado = registrarAjusteProductoTerminado({
        ajusteId: formulario.ajusteId || crearIdAjuste(),
        fecha: formulario.fecha,
        motivoAjuste: formulario.motivoAjuste,
        observacionAjuste: formulario.observacionAjuste,
        producto: ajusteActual,
        stockFisico: formulario.stockFisico,
      });

      if (!ajusteRegistrado) {
        cerrarProcesoSistema();
        mostrarErrorSistema("No se pudo guardar el ajuste de prenda.");
        return;
      }

      await repararIdentidadCatalogoProductosTerminados();
      await sincronizarTallerStockDesdeLocalASupabase();
      setProductos(construirProductosAjustables());
      setHistorialAjustes(leerAjustesPrendas());
      limpiarFormulario();
      cerrarProcesoSistema();
      mostrarNotificacionCarga("Ajuste de prenda guardado.");
    } catch (error) {
      console.error("No se pudo guardar el ajuste de prenda:", error);
      cerrarProcesoSistema();
      mostrarErrorSistema("No se pudo guardar el ajuste de prenda.");
    } finally {
      setGuardandoAjuste(false);
    }
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
          <h1>Ajustes de prendas</h1>
          <p>
            Aqui Almacen corrige el stock de producto terminado cuando hace
            inventario fisico, encuentra faltantes o detecta diferencias contra el
            andamio.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Prendas activas</span>
          <strong>{cargandoDatos ? "..." : productos.length}</strong>
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
              <span>Stock total actual</span>
              <strong>{formatearNumero(totalStockActual)}</strong>
            </div>
            <div>
              <span>Ajustes registrados</span>
              <strong>{historialAjustes.length}</strong>
            </div>
            <div>
              <span>Diferencia acumulada</span>
              <strong>{formatearNumero(totalDiferencias)}</strong>
            </div>
            <div>
              <span>Ultimo ajuste</span>
              <strong>{historialAjustes[0]?.fecha || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Control de inventario</h2>
              <p>
                Busca una prenda, compara el stock actual contra el conteo fisico y
                registra la diferencia con motivo.
              </p>
            </div>
          </div>

          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaActiva === "stock" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("stock");
                setPaginaActual(1);
              }}
            >
              Stock para ajustar
            </button>
            <button
              type="button"
              className={`pestana ${pestanaActiva === "historial" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("historial");
                setPaginaActual(1);
              }}
            >
              Historial de ajustes
            </button>
          </div>

          <div className="filtros">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por codigo corto, modelo, color, talla o codigo maestro"
            />
            <input
              type="text"
              list="ajustes-modelos"
              value={filtroModelo}
              onChange={(evento) => {
                setFiltroModelo(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Todos los modelos"
            />
            <datalist id="ajustes-modelos">
              {modelosDisponibles.map((modelo) => (
                <option key={modelo} value={modelo} />
              ))}
            </datalist>
            <input
              type="text"
              list="ajustes-colores"
              value={filtroColor}
              onChange={(evento) => {
                setFiltroColor(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Todos los colores"
            />
            <datalist id="ajustes-colores">
              {coloresDisponibles.map((color) => (
                <option key={color} value={color} />
              ))}
            </datalist>
            <input
              type="text"
              list="ajustes-tallas"
              value={filtroTalla}
              onChange={(evento) => {
                setFiltroTalla(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Todas las tallas"
            />
            <datalist id="ajustes-tallas">
              {tallasDisponibles.map((talla) => (
                <option key={talla} value={talla} />
              ))}
            </datalist>
          </div>

          {ajusteActual ? (
            <div className="panel_ajuste">
              <div className="panel_ajuste__cabecera">
                <div>
                  <strong>{ajusteActual.modelo || "-"}</strong>
                  <span>
                    {ajusteActual.colorBase || "-"} | {ajusteActual.talla || "-"} |{" "}
                    {ajusteActual.codigoCorto || "-"}
                  </span>
                </div>
                <button type="button" className="pestana" onClick={limpiarFormulario}>
                  Cancelar
                </button>
              </div>

              <div className="panel_ajuste__resumen">
                <div>
                  <span>Stock actual</span>
                  <strong>{formatearNumero(ajusteActual.stockActual)}</strong>
                </div>
                <div>
                  <span>Stock fisico</span>
                  <strong>{formatearNumero(formulario.stockFisico)}</strong>
                </div>
                <div>
                  <span>Diferencia</span>
                  <strong
                    className={
                      diferenciaCalculada > 0
                        ? "saldo_positivo"
                        : diferenciaCalculada < 0
                        ? "saldo_negativo"
                        : ""
                    }
                  >
                    {formatearNumero(diferenciaCalculada)}
                  </strong>
                </div>
              </div>

              <div className="panel_ajuste__grid">
                <input
                  type="date"
                  name="fecha"
                  value={formulario.fecha}
                  onChange={manejarCambio}
                />
                <input
                  type="number"
                  name="stockFisico"
                  step="1"
                  min="0"
                  value={formulario.stockFisico}
                  onChange={manejarCambio}
                  placeholder="Stock fisico"
                />
                <select
                  name="motivoAjuste"
                  value={formulario.motivoAjuste}
                  onChange={manejarCambio}
                >
                  <option value="">Motivo ajuste</option>
                  {motivosDisponibles.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {motivo}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="observacionAjuste"
                  value={formulario.observacionAjuste}
                  onChange={manejarCambio}
                  placeholder="Observacion del inventario"
                />
              </div>

              <div className="panel_ajuste__acciones">
                <button
                  type="button"
                  className="btn_primario"
                  onClick={guardarAjuste}
                  disabled={guardandoAjuste}
                >
                  {guardandoAjuste
                    ? "Guardando..."
                    : formulario.ajusteId
                    ? "Actualizar ajuste"
                    : "Guardar ajuste"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="tabla_contenedor">
            {pestanaActiva === "stock" ? (
              <table>
                <thead>
                  <tr>
                    <th>Codigo corto</th>
                    <th>Modelo</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Stock actual</th>
                    <th>Ultima OP</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPaginada.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="sin_datos">
                        Todavia no hay prendas para ajustar con ese filtro.
                      </td>
                    </tr>
                  ) : (
                    listaPaginada.map((item) => (
                      <tr key={item.claveProducto || item.id}>
                        <td>
                          <strong className="codigo_corto">
                            {item.codigoCorto || "-"}
                          </strong>
                        </td>
                        <td>{item.modelo || "-"}</td>
                        <td>{item.colorBase || "-"}</td>
                        <td>{item.talla || "-"}</td>
                        <td>{formatearNumero(item.stockActual)}</td>
                        <td>{item.ultimaOp || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn_primario btn_tabla"
                            onClick={() => abrirAjuste(item)}
                          >
                            Ajustar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Codigo corto</th>
                    <th>Modelo</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Anterior</th>
                    <th>Fisico</th>
                    <th>Diferencia</th>
                    <th>Motivo</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPaginada.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="sin_datos">
                        Todavia no hay historial de ajustes.
                      </td>
                    </tr>
                  ) : (
                    listaPaginada.map((item) => {
                      const productoRelacionado = productos.find(
                        (producto) =>
                          (producto?.claveProducto || producto?.id) === item?.claveProducto
                      );

                      return (
                        <tr key={item.id}>
                          <td>{item.fecha || "-"}</td>
                          <td>
                            <strong className="codigo_corto">
                              {item.codigoCorto || "-"}
                            </strong>
                          </td>
                          <td>{item.modelo || "-"}</td>
                          <td>{item.colorBase || "-"}</td>
                          <td>{item.talla || "-"}</td>
                          <td>{formatearNumero(item.stockAnterior)}</td>
                          <td>{formatearNumero(item.stockFisico)}</td>
                          <td
                            className={
                              Number(item.diferencia || 0) > 0
                                ? "saldo_positivo"
                                : Number(item.diferencia || 0) < 0
                                ? "saldo_negativo"
                                : ""
                            }
                          >
                            {formatearNumero(item.diferencia)}
                          </td>
                          <td>{item.motivoAjuste || "-"}</td>
                          <td>
                            <button
                              type="button"
                              className="btn_primario btn_tabla"
                              onClick={() =>
                                abrirAjuste(productoRelacionado || item, item)
                              }
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
            )}
          </div>

          <div className="paginacion">
            <button
              type="button"
              className="pestana"
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
              className="pestana"
              onClick={() => setPaginaActual((valor) => Math.min(totalPaginas, valor + 1))}
              disabled={paginaActual === totalPaginas}
            >
              Siguiente
            </button>
          </div>
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
  .tarjeta__encabezado p {
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
  .btn_primario,
  .pestana {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .boton_volver {
    background: #5b5b60;
    color: #ffffff;
  }

  .btn_primario {
    background: ${({ theme }) => theme.bg5};
    color: #ffffff;
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

  .resumen__grid {
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
    margin: 16px 0 14px;
    padding: 8px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    background: ${({ theme }) => theme.bg2};
  }

  .pestana {
    border: 1px solid ${({ theme }) => theme.bg4};
    background: transparent;
    color: ${({ theme }) => theme.text};
  }

  .pestana_activa {
    background: ${({ theme }) => theme.bg5};
    border-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    box-shadow: 0 10px 22px rgba(117, 1, 152, 0.28);
  }

  .buscador,
  .filtros {
    margin-bottom: 16px;
  }

  .filtros {
    display: grid;
    grid-template-columns: minmax(220px, 1.5fr) repeat(3, minmax(160px, 1fr));
    gap: 12px;
  }

  .buscador input,
  .filtros input,
  .panel_ajuste__grid input,
  .panel_ajuste__grid select {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  .panel_ajuste {
    display: grid;
    gap: 14px;
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
  }

  .panel_ajuste__cabecera {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .panel_ajuste__cabecera strong {
    display: block;
    font-size: 17px;
    margin-bottom: 4px;
  }

  .panel_ajuste__cabecera span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .panel_ajuste__resumen {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .panel_ajuste__resumen div {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 12px;
    background: ${({ theme }) => theme.bgcards};
  }

  .panel_ajuste__resumen span {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
  }

  .panel_ajuste__resumen strong {
    display: block;
    margin-top: 6px;
    font-size: 20px;
  }

  .panel_ajuste__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .panel_ajuste__acciones {
    display: flex;
    justify-content: flex-end;
  }

  .saldo_positivo {
    color: #7ee787;
  }

  .saldo_negativo {
    color: #ff8a8a;
  }

  .tabla_contenedor {
    margin-top: 16px;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 980px;
  }

  th,
  td {
    padding: 12px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
    text-align: left;
    vertical-align: top;
  }

  th {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  td {
    color: #ffffff;
    font-size: 14px;
  }

  .codigo_corto {
    color: ${({ theme }) => theme.bg5};
  }

  .btn_tabla {
    width: 100%;
    padding: 10px 12px;
  }

  .sin_datos {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .paginacion {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  @media (max-width: 900px) {
    .cabecera,
    .panel_ajuste__cabecera {
      flex-direction: column;
      align-items: stretch;
    }

    .cabecera__estado {
      width: 100%;
    }

    .filtros,
    .panel_ajuste__resumen,
    .panel_ajuste__grid {
      grid-template-columns: 1fr;
    }

    .paginacion {
      flex-direction: column;
      align-items: stretch;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;




