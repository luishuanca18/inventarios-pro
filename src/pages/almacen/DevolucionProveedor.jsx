import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { mostrarNotificacionCarga } from "../../utils/notificaciones";
import {

  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const CLAVE_AJUSTES_MATERIA_PRIMA = "cynara_ajustes_materia_prima";
const CLAVE_DEVOLUCIONES_PRODUCCION = "cynara_devoluciones_produccion";
const CLAVE_DEVOLUCIONES_PROVEEDOR_MP = "cynara_devoluciones_proveedor_mp";
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

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const stockTelasEjemplo = [
  {
    codigoIngreso: "CMP100426-01",
    fechaCompra: "2026-04-10",
    proveedor: "Importadora Santa Fe",
    codigoUnidad: "FTNE01",
    tipoTela: "FRENCH TERRY",
    colorBase: "NEGRO",
    acabadoDiseno: "LINEAS DORADAS",
    partida: "FT101",
    ancho: 1.6,
    kilos: 20,
    metros: 50,
  },
  {
    codigoIngreso: "CMP110426-02",
    fechaCompra: "2026-04-11",
    proveedor: "Textiles Andinos",
    codigoUnidad: "CHNE02",
    tipoTela: "CHALIZ",
    colorBase: "NEGRO",
    acabadoDiseno: "",
    partida: "P102",
    ancho: 1.5,
    kilos: 18,
    metros: 46,
  },
];

const construirStockDisponible = () => {
  const ingresos = leerListaGuardada(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);
  const ajustes = leerListaGuardada(CLAVE_AJUSTES_MATERIA_PRIMA);
  const devolucionesProduccion = leerListaGuardada(CLAVE_DEVOLUCIONES_PRODUCCION);
  const devolucionesProveedor = leerListaGuardada(CLAVE_DEVOLUCIONES_PROVEEDOR_MP);
  const codigosSalidaProveedor = new Set(
    devolucionesProveedor
      .filter((registro) => registro?.estado === "enviado")
      .map((registro) => registro?.codigoUnidad || "")
      .filter(Boolean)
  );
  const mapaAjustes = new Map(
    ajustes.map((ajuste) => [ajuste?.codigoUnidad || ajuste?.id, ajuste])
  );
  const base =
    ingresos.length === 0
      ? stockTelasEjemplo
      : ingresos.flatMap((ingreso, indiceIngreso) => {
          const cabeceraCompra = ingreso?.cabeceraCompra || {};
          const filasCompra = ingreso?.filasCompra || [];

          return filasCompra.map((fila, indiceFila) => ({
            id: `${cabeceraCompra.codigoInterno || "ingreso"}-${fila.id || indiceFila}-${indiceIngreso}`,
            codigoIngreso: cabeceraCompra.codigoInterno || "-",
            fechaCompra: cabeceraCompra.fechaCompra || "-",
            proveedor: cabeceraCompra.proveedor || "-",
            codigoUnidad: fila.codigoUnidad || "",
            tipoTela:
              fila.tipoTela === "Otro"
                ? fila.tipoTelaManual || "OTRO"
                : fila.tipoTela || "",
            colorBase: fila.colorBase || "",
            acabadoDiseno: fila.acabadoDiseno || "",
            partida: fila.partida || "",
            ancho: Number(fila.ancho || 0),
            kilos: Number(fila.kilos || 0),
            metros: Number(fila.metros || 0),
          }));
        });

  const devolucionesAceptadas = devolucionesProduccion
    .filter((registro) => registro?.estado === "aceptada")
    .map((registro) => ({
      id: registro?.id || `dev-prod-${registro?.codigoUnidad || Date.now()}`,
      codigoIngreso: registro?.codigoOp || "DEV-PROD",
      fechaCompra: registro?.fechaRecepcion || registro?.fechaSolicitud || "-",
      proveedor: registro?.proveedor || "POR DEFINIR",
      codigoUnidad: registro?.codigoUnidad || "",
      tipoTela: registro?.tipoTela || "",
      colorBase: registro?.colorBase || "",
      acabadoDiseno: registro?.acabadoDiseno || "",
      partida: registro?.partida || "",
      ancho: Number(registro?.anchoTela || 0),
      kilos: Number(registro?.pesoTela || 0),
      metros: Number(registro?.metros || 0),
    }));

  return [...base, ...devolucionesAceptadas]
    .map((fila) => ({
      ...fila,
      kilos: Number(mapaAjustes.get(fila.codigoUnidad)?.kilos ?? fila.kilos ?? 0),
      metros: Number(mapaAjustes.get(fila.codigoUnidad)?.metros ?? fila.metros ?? 0),
    }))
    .filter((fila) => fila.codigoUnidad && !codigosSalidaProveedor.has(fila.codigoUnidad));
};

const crearFormularioInicial = () => ({
  idTela: "",
  fechaSalida: obtenerFechaActual(),
  proveedor: "",
  motivoFalla: "",
  observacion: "",
});

export function DevolucionProveedor() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [formulario, setFormulario] = useState(crearFormularioInicial);
  const [historial, setHistorial] = useState(() =>
    leerListaGuardada(CLAVE_DEVOLUCIONES_PROVEEDOR_MP)
  );
  const stockDisponible = useMemo(construirStockDisponible, [historial]);

  const telasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) {
      return stockDisponible;
    }

    return stockDisponible.filter((fila) =>
      [
        fila.codigoUnidad,
        fila.tipoTela,
        fila.colorBase,
        fila.partida,
        fila.proveedor,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, stockDisponible]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(telasFiltradas.length / FILAS_POR_PAGINA)
  );

  const telasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return telasFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [paginaActual, telasFiltradas]);

  const telaSeleccionada = stockDisponible.find(
    (fila) => fila.id === formulario.idTela || fila.codigoUnidad === formulario.idTela
  );

  const manejarSeleccionTela = (fila) => {
    setFormulario((anterior) => ({
      ...anterior,
      idTela: fila.id || fila.codigoUnidad,
      proveedor: fila.proveedor || "",
    }));
    mostrarNotificacionCarga("Tela cargada para devolucion al proveedor.");
  };

  const manejarCambioFormulario = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const guardarDevolucion = () => {
    if (!telaSeleccionada?.codigoUnidad) {
      alert("Selecciona primero una tela para devolver al proveedor.");
      return;
    }

    if (!formulario.proveedor.trim()) {
      alert("Completa el proveedor antes de guardar.");
      return;
    }

    if (!formulario.motivoFalla.trim()) {
      alert("Completa el motivo de falla para dejar trazabilidad.");
      return;
    }

    const nuevaDevolucion = {
      id: `dev-prov-${Date.now()}`,
      fechaSalida: formulario.fechaSalida || obtenerFechaActual(),
      proveedor: formulario.proveedor.trim().toUpperCase(),
      motivoFalla: formulario.motivoFalla.trim(),
      observacion: formulario.observacion.trim(),
      origenMovimiento: "devolucion_proveedor",
      estado: "enviado",
      referenciaInterna: telaSeleccionada.codigoIngreso || "",
      codigoUnidad: telaSeleccionada.codigoUnidad || "",
      tipoTela: telaSeleccionada.tipoTela || "",
      colorBase: telaSeleccionada.colorBase || "",
      acabadoDiseno: telaSeleccionada.acabadoDiseno || "",
      partida: telaSeleccionada.partida || "",
      ancho: Number(telaSeleccionada.ancho || 0),
      kilos: Number(telaSeleccionada.kilos || 0),
      metros: Number(telaSeleccionada.metros || 0),
    };

    const historialActualizado = [nuevaDevolucion, ...historial];
    localStorage.setItem(
      CLAVE_DEVOLUCIONES_PROVEEDOR_MP,
      JSON.stringify(historialActualizado)
    );
    setHistorial(historialActualizado);
    setFormulario(crearFormularioInicial());
    alert("Devolucion al proveedor registrada. Esta tela ya no se tratara como compra nueva.");
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
          <h1>Devolucion a proveedor</h1>
          <p>
            Aqui Almacen registra la salida de una tela fallada hacia el proveedor.
            Este movimiento cierra la tela original y no se trata como compra nueva.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Telas listas para devolver</span>
          <strong>{stockDisponible.length}</strong>
        </div>
      </section>

      <main className="contenido">
        <div className="fila_superior">
          <Link to="/almacen/materia-prima" className="boton_volver">
            Volver a Almacen
          </Link>
        </div>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Telas disponibles para reclamo</h2>
              <p>
                Selecciona la tela fallada para registrar su salida al proveedor.
              </p>
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
              placeholder="Buscar por codigo, tela, color, partida o proveedor"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Tipo tela</th>
                  <th>Color</th>
                  <th>Partida</th>
                  <th>Kilos</th>
                  <th>Metros</th>
                  <th>Proveedor</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {telasPaginadas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="fila_vacia">
                      No hay telas disponibles para reclamo con ese filtro.
                    </td>
                  </tr>
                ) : (
                  telasPaginadas.map((fila) => (
                    <tr key={fila.id || fila.codigoUnidad}>
                      <td>{fila.codigoUnidad || "-"}</td>
                      <td>{fila.tipoTela || "-"}</td>
                      <td>{fila.colorBase || "-"}</td>
                      <td>{fila.partida || "-"}</td>
                      <td>{Number(fila.kilos || 0).toFixed(2)}</td>
                      <td>{Number(fila.metros || 0).toFixed(2)}</td>
                      <td>{fila.proveedor || "-"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn_principal btn_tabla"
                          onClick={() => manejarSeleccionTela(fila)}
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Registrar salida al proveedor</h2>
              <p>
                La tela seleccionada sale por reclamo y su seguimiento continuara en la reposicion del proveedor.
              </p>
            </div>
          </div>

          <div className="grid grid-3">
            <Campo>
              <label>Codigo unidad</label>
              <input type="text" value={telaSeleccionada?.codigoUnidad || ""} readOnly />
            </Campo>
            <Campo>
              <label>Proveedor</label>
              <input
                type="text"
                name="proveedor"
                value={formulario.proveedor}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Fecha salida</label>
              <input
                type="date"
                name="fechaSalida"
                value={formulario.fechaSalida}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo className="col-span-3">
              <label>Motivo de falla</label>
              <input
                type="text"
                name="motivoFalla"
                value={formulario.motivoFalla}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo className="col-span-3">
              <label>Observacion</label>
              <textarea
                name="observacion"
                value={formulario.observacion}
                onChange={manejarCambioFormulario}
              />
            </Campo>
          </div>

          <section className="acciones">
            <button type="button" className="btn btn_principal" onClick={guardarDevolucion}>
              Guardar devolucion
            </button>
          </section>
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
  grid-template-rows: 90px auto 1fr;
  gap: 16px;
  padding: 15px;

  .encabezado,
  .cabecera,
  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border-radius: 18px;
  }

  .encabezado {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 10px;
  }

  .cabecera,
  .tarjeta {
    padding: 18px;
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
  .tarjeta p {
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

  .contenido {
    display: grid;
    gap: 16px;
  }

  .fila_superior {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .boton_volver,
  .btn {
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

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
  }

  .tarjeta__encabezado {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .buscador input,
  input,
  textarea {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 10px;
    padding: 12px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  textarea {
    min-height: 90px;
    resize: vertical;
  }

  .grid {
    display: grid;
    gap: 12px;
  }

  .grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .col-span-3 {
    grid-column: 1 / -1;
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
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
    text-align: left;
  }

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .btn_tabla {
    width: 100%;
  }

  @media (max-width: 860px) {
    .grid-3 {
      grid-template-columns: 1fr;
    }

    .col-span-3 {
      grid-column: auto;
    }

    .fila_superior,
    .acciones {
      flex-direction: column;
      align-items: stretch;
    }

    .boton_volver,
    .btn {
      width: 100%;
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




