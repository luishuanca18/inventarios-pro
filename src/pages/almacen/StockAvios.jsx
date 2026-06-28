import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { leerCatalogosProduccion } from "../../utils/catalogosProduccion";
import {
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {

  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const CLAVE_AJUSTES_AVIOS = "cynara_ajustes_avios";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

const stockAviosEjemplo = [
  {
    id: "demo-avio-1",
    codigoIngreso: "CMP100426-01",
    fechaCompra: "2026-04-10",
    proveedor: "Avios del Peru",
    tipoDocumento: "Factura",
    numeroDocumento: "F001-9001",
    tipoAvio: "Elastico",
    descripcion: "Elastico pretina",
    anchoAvioCm: 3,
    metrosRollo: 50,
    colorBase: "Negro",
    acabadoDiseno: "",
    cantidad: 10,
    unidad: "Paquete",
    precioUnitario: 85,
    total: 850,
  },
  {
    id: "demo-avio-2",
    codigoIngreso: "CMP090426-02",
    fechaCompra: "2026-04-09",
    proveedor: "Servicios Textiles",
    tipoDocumento: "Boleta",
    numeroDocumento: "B002-1103",
    tipoAvio: "Etiqueta",
    descripcion: "Etiqueta interna Cynara",
    anchoAvioCm: 0,
    metrosRollo: 0,
    colorBase: "Blanco",
    acabadoDiseno: "",
    cantidad: 12,
    unidad: "Docena",
    precioUnitario: 24,
    total: 288,
  },
  {
    id: "demo-avio-3",
    codigoIngreso: "CMP070426-04",
    fechaCompra: "2026-04-07",
    proveedor: "Cierres y Mas",
    tipoDocumento: "Nota de venta",
    numeroDocumento: "NV-4450",
    tipoAvio: "Cierre",
    descripcion: "Cierre metalico corto",
    anchoAvioCm: 0,
    metrosRollo: 0,
    colorBase: "Dorado",
    acabadoDiseno: "",
    cantidad: 40,
    unidad: "Unidad",
    precioUnitario: 2.5,
    total: 100,
  },
];

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

const formatearNumero = (valor) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor || 0));

const construirStockAvios = () => {
  const historialIngresos = leerListaGuardada(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);
  const ajustesAvios = leerListaGuardada(CLAVE_AJUSTES_AVIOS);
  const mapaAjustes = new Map(
    ajustesAvios.map((ajuste) => [ajuste?.idAvio || ajuste?.id, ajuste])
  );

  if (historialIngresos.length === 0) {
    return stockAviosEjemplo.map((avio) => {
      const ajuste = mapaAjustes.get(avio.id);
      const cantidad = Number(ajuste?.cantidad ?? avio.cantidad ?? 0);
      const precioUnitario = Number(avio.precioUnitario || 0);

      return {
        ...avio,
        cantidad,
        precioUnitario,
        total: cantidad * precioUnitario,
        motivoAjuste: ajuste?.motivoAjuste || "",
        observacionAjuste: ajuste?.observacionAjuste || "",
      };
    });
  }

  return historialIngresos.flatMap((ingreso, indiceIngreso) => {
    const cabeceraCompra = ingreso?.cabeceraCompra || {};
    const filasAvios = ingreso?.filasAvios || [];

    return filasAvios.map((avio, indiceAvio) => {
      const idAvio = `${cabeceraCompra.codigoInterno || "ingreso"}-avio-${
        avio.id || indiceAvio
      }-${indiceIngreso}`;
      const ajuste = mapaAjustes.get(idAvio);
      const cantidad = Number(ajuste?.cantidad ?? avio.cantidad ?? 0);
      const precioUnitario = Number(avio.precioUnitario || 0);

      return {
        id: idAvio,
        codigoIngreso: cabeceraCompra.codigoInterno || "-",
        fechaCompra: cabeceraCompra.fechaCompra || "-",
        proveedor: cabeceraCompra.proveedor || "-",
        tipoDocumento: cabeceraCompra.tipoDocumento || "-",
        numeroDocumento: cabeceraCompra.numeroDocumento || "-",
        tipoAvio:
          avio.tipoAvio === "Otro"
            ? avio.tipoAvioManual || "Otro"
            : avio.tipoAvio || "-",
        descripcion: avio.descripcion || "-",
        anchoAvioCm: Number(avio.anchoAvioCm || 0),
        metrosRollo: Number(avio.metrosRollo || 0),
        colorBase: avio.colorBase || "-",
        acabadoDiseno: avio.acabadoDiseno || "-",
        cantidad,
        unidad: avio.unidad || "-",
        precioUnitario,
        total: cantidad * precioUnitario,
        motivoAjuste: ajuste?.motivoAjuste || "",
        observacionAjuste: ajuste?.observacionAjuste || "",
      };
    });
  });
};

export function StockAvios({ modo = "stock" }) {
  const catalogosProduccion = useMemo(leerCatalogosProduccion, []);
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipoAvio, setFiltroTipoAvio] = useState("");
  const [filtroColorAvio, setFiltroColorAvio] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [stockAvios, setStockAvios] = useState(construirStockAvios);
  const [ajusteAvioActual, setAjusteAvioActual] = useState(null);
  const [formularioAjuste, setFormularioAjuste] = useState({
    cantidad: "",
    motivoAjuste: "",
    observacionAjuste: "",
  });

  const aviosFiltrados = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();
    const tipoAvioSeleccionado = filtroTipoAvio.trim().toLowerCase();
    const colorAvioSeleccionado = filtroColorAvio.trim().toLowerCase();

    return stockAvios.filter((avio) => {
      const coincideTipo =
        !tipoAvioSeleccionado ||
        (avio.tipoAvio || "").toLowerCase() === tipoAvioSeleccionado;
      const coincideColor =
        !colorAvioSeleccionado ||
        (avio.colorBase || "").toLowerCase() === colorAvioSeleccionado;
      const coincideTexto =
        !textoBusqueda ||
        [
          avio.codigoIngreso,
          avio.tipoAvio,
          avio.descripcion,
          avio.colorBase,
          avio.acabadoDiseno,
          avio.proveedor,
          avio.numeroDocumento,
          avio.unidad,
        ]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);

      return coincideTipo && coincideColor && coincideTexto;
    });
  }, [busqueda, filtroColorAvio, filtroTipoAvio, stockAvios]);

  const totalPaginas = Math.max(1, Math.ceil(aviosFiltrados.length / FILAS_POR_PAGINA));
  const aviosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return aviosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [aviosFiltrados, paginaActual]);

  const totalCantidadAvios = aviosFiltrados.reduce(
    (total, avio) => total + Number(avio.cantidad || 0),
    0
  );
  const totalValorAvios = aviosFiltrados.reduce(
    (total, avio) => total + Number(avio.total || 0),
    0
  );
  const esModoAjustes = modo === "ajustes";

  const abrirAjuste = (avio) => {
    setAjusteAvioActual(avio);
    setFormularioAjuste({
      cantidad: String(avio?.cantidad ?? ""),
      motivoAjuste: avio?.motivoAjuste || "",
      observacionAjuste: avio?.observacionAjuste || "",
    });
  };

  const manejarCambioAjuste = (evento) => {
    const { name, value } = evento.target;
    setFormularioAjuste((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const guardarAjuste = async () => {
    if (!ajusteAvioActual?.id) {
      await mostrarAlertaSistema("Selecciona primero un avio para ajustar.");
      return;
    }

    if (!formularioAjuste.motivoAjuste.trim()) {
      await mostrarAlertaSistema("Selecciona un motivo de ajuste.");
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando ajuste de avios...",
      mensajeExito: "Ajuste de avios guardado.",
      mensajeError: "No se pudo guardar el ajuste de avios.",
      accion: async () => {
        const cantidad = Number(formularioAjuste.cantidad || 0);
        const ajustesActuales = leerListaGuardada(CLAVE_AJUSTES_AVIOS);
        const nuevoAjuste = {
          id: ajusteAvioActual.id,
          idAvio: ajusteAvioActual.id,
          cantidad,
          motivoAjuste: formularioAjuste.motivoAjuste,
          observacionAjuste: formularioAjuste.observacionAjuste,
          fechaAjuste: new Date().toISOString(),
        };

        const ajustesActualizados = [
          nuevoAjuste,
          ...ajustesActuales.filter((item) => item?.idAvio !== ajusteAvioActual.id),
        ];

        localStorage.setItem(CLAVE_AJUSTES_AVIOS, JSON.stringify(ajustesActualizados));

        setStockAvios((anterior) =>
          anterior.map((avio) =>
            avio.id === ajusteAvioActual.id
              ? {
                  ...avio,
                  cantidad,
                  total: cantidad * Number(avio.precioUnitario || 0),
                  motivoAjuste: formularioAjuste.motivoAjuste,
                  observacionAjuste: formularioAjuste.observacionAjuste,
                }
              : avio
          )
        );

        setAjusteAvioActual(null);
        setFormularioAjuste({
          cantidad: "",
          motivoAjuste: "",
          observacionAjuste: "",
        });
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
          <h1>{esModoAjustes ? "Ajustes de avios" : "Stock de avios"}</h1>
          <p>
            {esModoAjustes
              ? "Aqui corriges cantidades de avios por conteo, consumo, diferencia fisica o regularizacion."
              : "Aqui revisas el stock general de avios con buscador, filtros y ajuste de cantidades."}
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Filas visibles</span>
          <strong>{aviosFiltrados.length}</strong>
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
              <h2>Buscador de stock</h2>
              <p>Busca por tipo de avio, descripcion, color, proveedor o documento.</p>
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
              placeholder="Buscar por codigo, tipo de avio, descripcion, color o proveedor"
            />

            <input
              type="text"
              list="filtro-stock-tipo-avio"
              value={filtroTipoAvio}
              onChange={(evento) => {
                setFiltroTipoAvio(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Filtrar por tipo de avio"
            />
            <datalist id="filtro-stock-tipo-avio">
              {(catalogosProduccion.avios || []).map((avio) => (
                <option key={avio} value={avio} />
              ))}
            </datalist>

            <input
              type="text"
              list="filtro-stock-color-avio"
              value={filtroColorAvio}
              onChange={(evento) => {
                setFiltroColorAvio(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Filtrar por color base"
            />
            <datalist id="filtro-stock-color-avio">
              {catalogosProduccion.colores.map((color) => (
                <option key={color} value={color} />
              ))}
            </datalist>
          </div>
        </section>

        <section className="tarjeta">
          <h2>{esModoAjustes ? "Panel de ajustes de avios" : "Stock general de avios"}</h2>

          {ajusteAvioActual ? (
            <div className="panel_ajuste">
              <strong>Ajustar: {ajusteAvioActual.tipoAvio}</strong>
              <div className="panel_ajuste__grid">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  name="cantidad"
                  value={formularioAjuste.cantidad}
                  onChange={manejarCambioAjuste}
                  placeholder="Cantidad"
                />
                <select
                  name="motivoAjuste"
                  value={formularioAjuste.motivoAjuste}
                  onChange={manejarCambioAjuste}
                >
                  <option value="">Motivo ajuste</option>
                  {(catalogosProduccion.motivosAjuste || []).map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {motivo}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="observacionAjuste"
                  value={formularioAjuste.observacionAjuste}
                  onChange={manejarCambioAjuste}
                  placeholder="Observacion"
                />
              </div>
              <div className="panel_ajuste__acciones">
                <button
                  type="button"
                  className="pestana"
                  onClick={() => setAjusteAvioActual(null)}
                >
                  Cancelar
                </button>
                <button type="button" className="btn_ajuste" onClick={guardarAjuste}>
                  Guardar ajuste
                </button>
              </div>
            </div>
          ) : null}

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo ingreso</th>
                  <th>Fecha compra</th>
                  <th>Proveedor</th>
                  <th>Tipo avio</th>
                  <th>Descripcion</th>
                  <th>Ancho (cm)</th>
                  <th>Metros rollo</th>
                  <th>Color base</th>
                  <th>Acabado / diseno</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Total</th>
                  <th>Ajuste</th>
                </tr>
              </thead>

              <tbody>
                {aviosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="fila_vacia">
                      Todavia no hay stock de avios para mostrar con ese filtro.
                    </td>
                  </tr>
                ) : (
                  aviosPaginados.map((avio) => (
                    <tr key={avio.id}>
                      <td>{avio.codigoIngreso}</td>
                      <td>{avio.fechaCompra}</td>
                      <td>{avio.proveedor}</td>
                      <td>{avio.tipoAvio}</td>
                      <td>{avio.descripcion}</td>
                      <td>{avio.anchoAvioCm ? formatearNumero(avio.anchoAvioCm) : "-"}</td>
                      <td>{avio.metrosRollo ? formatearNumero(avio.metrosRollo) : "-"}</td>
                      <td>{avio.colorBase}</td>
                      <td>{avio.acabadoDiseno}</td>
                      <td>{formatearNumero(avio.cantidad)}</td>
                      <td>{avio.unidad}</td>
                      <td>S/ {formatearNumero(avio.total)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn_ajuste btn_ajuste_tabla"
                          onClick={() => abrirAjuste(avio)}
                        >
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {aviosFiltrados.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="pestana"
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
                className="pestana"
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

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Filas visibles</span>
              <strong>{aviosFiltrados.length}</strong>
            </div>
            <div>
              <span>Total cantidad</span>
              <strong>{formatearNumero(totalCantidadAvios)}</strong>
            </div>
            <div>
              <span>Total valor avios</span>
              <strong>S/ {formatearNumero(totalValorAvios)}</strong>
            </div>
            <div>
              <span>Registros totales</span>
              <strong>{stockAvios.length}</strong>
            </div>
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
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .cabecera__estado {
    min-width: 170px;
    padding: 14px 16px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .cabecera__estado span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .cabecera__estado strong {
    font-size: 30px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior {
    display: flex;
    justify-content: flex-start;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .tarjeta__encabezado {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .boton_volver,
  .btn,
  .pestana {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 600;
  }

  .boton_volver {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .buscador {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) repeat(2, minmax(180px, 220px));
    gap: 12px;
  }

  .buscador input,
  .buscador select,
  .panel_ajuste__grid input,
  .panel_ajuste__grid select {
    width: 100%;
    border: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .buscador input:focus,
  .buscador select:focus,
  .panel_ajuste__grid input:focus,
  .panel_ajuste__grid select:focus {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(117, 1, 152, 0.14)"
          : "rgba(117, 1, 152, 0.2)"};
  }

  .panel_ajuste {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bg};
  }

  .panel_ajuste strong {
    font-size: 15px;
  }

  .panel_ajuste__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .panel_ajuste__acciones {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn_ajuste {
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 700;
    cursor: pointer;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .btn_ajuste_tabla {
    width: 100%;
    padding: 9px 12px;
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1100px;
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

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 20px;
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

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;




