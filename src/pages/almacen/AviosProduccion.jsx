import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import {

  crearEstadoHabilitadoTaller,
  guardarHabilitadoTaller,
  leerHabilitadoTaller,
} from "../../utils/habilitadoTaller";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_CABECERA_SALIDA_TALLER = "cynara_cabecera_salida_taller";
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

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const crearFormularioVacio = () => ({
  fechaEntregaAvios: obtenerFechaActual(),
  responsableAvios: "",
  observacionAvios: "",
});

const construirSalidasAvios = () =>
  leerListaGuardada(CLAVE_SALIDAS_TALLER)
    .filter((item) => item?.tipoRegistro === "envio_taller")
    .map((item) => ({
      ...item,
      totalUnidades: convertirNumero(item?.totalUnidades ?? item?.cantidadTotal),
      estadoAvios: item?.avios ? "LISTO" : "PENDIENTE",
    }));

export function AviosProduccion() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [salidasAvios, setSalidasAvios] = useState(construirSalidasAvios);
  const [itemActual, setItemActual] = useState(null);
  const [formulario, setFormulario] = useState(crearFormularioVacio);

  const salidasFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();

    return salidasAvios.filter((item) => {
      const coincidePestana =
        pestanaActiva === "pendientes" ? !item?.avios : Boolean(item?.avios);
      const coincideTexto =
        !textoBusqueda ||
        [
          item?.codigoOp,
          item?.codigoSalida,
          item?.modelo,
          item?.modeloBase,
          item?.nombreTaller,
          item?.responsableAvios,
          item?.observacionAvios,
        ]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);

      return coincidePestana && coincideTexto;
    });
  }, [busqueda, pestanaActiva, salidasAvios]);

  const totalPaginas = Math.max(1, Math.ceil(salidasFiltradas.length / FILAS_POR_PAGINA));
  const salidasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return salidasFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [paginaActual, salidasFiltradas]);

  const resumenPendientes = salidasAvios.filter((item) => !item?.avios).length;
  const resumenListas = salidasAvios.filter((item) => item?.avios).length;

  const cargarItem = (item) => {
    setItemActual(item);
    setFormulario({
      fechaEntregaAvios: item?.fechaEntregaAvios || obtenerFechaActual(),
      responsableAvios: item?.responsableAvios || "",
      observacionAvios: item?.observacionAvios || "",
    });
    alert("Avios cargados correctamente.");
  };

  const manejarCambioFormulario = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const actualizarCabeceraActual = (itemActualizado) => {
    const cabeceraActual = leerDatoGuardado(CLAVE_CABECERA_SALIDA_TALLER);

    if (!cabeceraActual?.id || cabeceraActual.id !== itemActualizado.id) {
      return;
    }

    localStorage.setItem(
      CLAVE_CABECERA_SALIDA_TALLER,
      JSON.stringify({
        ...cabeceraActual,
        avios: itemActualizado.avios,
        fechaEntregaAvios: itemActualizado.fechaEntregaAvios || "",
        responsableAvios: itemActualizado.responsableAvios || "",
        observacionAvios: itemActualizado.observacionAvios || "",
      })
    );
  };

  const guardarEstadoAvios = (estadoAvios = true) => {
    if (!itemActual?.id) {
      alert("Carga primero una salida para trabajar sus avios.");
      return;
    }

    if (estadoAvios && !formulario.responsableAvios.trim()) {
      alert("Escribe quien entrega o prepara los avios.");
      return;
    }

    const itemActualizado = {
      ...itemActual,
      avios: estadoAvios,
      fechaEntregaAvios: estadoAvios ? formulario.fechaEntregaAvios : "",
      responsableAvios: estadoAvios ? formulario.responsableAvios : "",
      observacionAvios: formulario.observacionAvios,
      estadoAvios: estadoAvios ? "LISTO" : "PENDIENTE",
    };

    const listaActualizada = salidasAvios.map((item) =>
      item.id === itemActual.id ? itemActualizado : item
    );

    setSalidasAvios(listaActualizada);
    localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(listaActualizada));
    actualizarCabeceraActual(itemActualizado);
    const habilitadosActuales = leerHabilitadoTaller();
    const registroExistente =
      habilitadosActuales.find((item) => item?.codigoOp === itemActual?.codigoOp) || {};
    guardarHabilitadoTaller([
      crearEstadoHabilitadoTaller({
        ...registroExistente,
        codigoOp: itemActual?.codigoOp || "",
        modeloBase:
          registroExistente?.modeloBase || itemActual?.modelo || itemActual?.modeloBase || "",
        avios: estadoAvios,
      }),
      ...habilitadosActuales.filter((item) => item?.codigoOp !== itemActual?.codigoOp),
    ]);
    setItemActual(itemActualizado);
    alert(
      estadoAvios
        ? "Avios marcados como listos para esta salida."
        : "Avios devueltos a estado pendiente."
    );
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
          <h1>Avios a produccion</h1>
          <p>
            Aqui Almacen controla que cada salida al taller tenga sus avios listos y
            deja registrada la entrega para que Produccion vea el mismo estado.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Pendientes</span>
          <strong>{resumenPendientes}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/almacen/materia-prima" className="boton_volver">
          Volver a Almacen
        </Link>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaActiva === "pendientes" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("pendientes");
                setPaginaActual(1);
              }}
            >
              Pendientes
            </button>
            <button
              type="button"
              className={`pestana ${pestanaActiva === "listos" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("listos");
                setPaginaActual(1);
              }}
            >
              Historial atendido
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Lista de salidas</h2>
              <p>Busca por OP, salida, modelo o taller.</p>
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
              placeholder="Buscar por codigo OP, salida, modelo o taller"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo OP</th>
                  <th>Codigo salida</th>
                  <th>Modelo</th>
                  <th>Taller</th>
                  <th>Fecha envio</th>
                  <th>Total unidades</th>
                  <th>Estado avios</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {salidasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="fila_vacia">
                      Todavia no hay salidas para mostrar en esta bandeja.
                    </td>
                  </tr>
                ) : (
                  salidasPaginadas.map((item) => (
                    <tr key={item.id}>
                      <td>{item.codigoOp || "-"}</td>
                      <td>{item.codigoSalida || "-"}</td>
                      <td>{item.modelo || item.modeloBase || "-"}</td>
                      <td>{item.nombreTaller || "-"}</td>
                      <td>{item.fechaEnvio || "-"}</td>
                      <td>{item.totalUnidades}</td>
                      <td>
                        <span
                          className={`chip_estado ${
                            item.avios ? "chip_estado_listo" : "chip_estado_pendiente"
                          }`}
                        >
                          {item.avios ? "Listo" : "Pendiente"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn_ajuste btn_ajuste_tabla"
                          onClick={() => cargarItem(item)}
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

          {salidasFiltradas.length > FILAS_POR_PAGINA ? (
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

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Detalle de entrega de avios</h2>
              <p>Aqui dejas registro del abastecimiento para la salida seleccionada.</p>
            </div>
          </div>

          <div className="grid-2">
            <Campo>
              <label>Codigo OP</label>
              <input type="text" value={itemActual?.codigoOp || ""} readOnly />
            </Campo>
            <Campo>
              <label>Codigo salida</label>
              <input type="text" value={itemActual?.codigoSalida || ""} readOnly />
            </Campo>
            <Campo>
              <label>Modelo</label>
              <input type="text" value={itemActual?.modelo || itemActual?.modeloBase || ""} readOnly />
            </Campo>
            <Campo>
              <label>Taller</label>
              <input type="text" value={itemActual?.nombreTaller || ""} readOnly />
            </Campo>
            <Campo>
              <label>Fecha entrega avios</label>
              <input
                type="date"
                name="fechaEntregaAvios"
                value={formulario.fechaEntregaAvios}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Responsable</label>
              <input
                type="text"
                name="responsableAvios"
                value={formulario.responsableAvios}
                onChange={manejarCambioFormulario}
                placeholder="Quien entrega o alista"
              />
            </Campo>
            <Campo className="campo-completo">
              <label>Observacion</label>
              <textarea
                name="observacionAvios"
                value={formulario.observacionAvios}
                onChange={manejarCambioFormulario}
                placeholder="Detalle de entrega o faltante"
              />
            </Campo>
          </div>

          <div className="acciones">
            <button
              type="button"
              className="pestana"
              onClick={() => guardarEstadoAvios(false)}
            >
              Dejar pendiente
            </button>
            <button
              type="button"
              className="btn_ajuste"
              onClick={() => guardarEstadoAvios(true)}
            >
              Marcar avios listos
            </button>
          </div>
        </section>

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Pendientes</span>
              <strong>{resumenPendientes}</strong>
            </div>
            <div>
              <span>Listos</span>
              <strong>{resumenListas}</strong>
            </div>
            <div>
              <span>Total salidas</span>
              <strong>{salidasAvios.length}</strong>
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

  .fila_superior,
  .acciones,
  .paginacion,
  .tarjeta__encabezado {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .grid-2,
  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .campo-completo {
    grid-column: 1 / -1;
  }

  .pestanas {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .boton_volver,
  .pestana {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 600;
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .pestana_activa,
  .btn_ajuste {
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .btn_ajuste {
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn_ajuste_tabla {
    width: 100%;
    padding: 9px 12px;
  }

  .buscador input,
  input,
  textarea {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 12px;
    padding: 12px 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  textarea {
    min-height: 90px;
    resize: vertical;
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 920px;
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

  .chip_estado {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 96px;
    padding: 6px 10px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 12px;
  }

  .chip_estado_pendiente {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .chip_estado_listo {
    background-color: rgba(117, 1, 152, 0.2);
    color: #ffffff;
    border: 1px solid rgba(117, 1, 152, 0.35);
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




