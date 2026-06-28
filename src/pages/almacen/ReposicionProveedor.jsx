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

const CLAVE_DEVOLUCIONES_PROVEEDOR_MP = "cynara_devoluciones_proveedor_mp";
const CLAVE_REPOSICIONES_PROVEEDOR_MP = "cynara_reposiciones_proveedor_mp";

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

const crearFormularioInicial = () => ({
  idDevolucion: "",
  fechaReposicion: obtenerFechaActual(),
  codigoUnidadNuevo: "",
  tipoTela: "",
  colorBase: "",
  acabadoDiseno: "",
  partida: "",
  ancho: "",
  kilos: "",
  metros: "",
  observacion: "",
});

export function ReposicionProveedor() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [formulario, setFormulario] = useState(crearFormularioInicial);
  const [devoluciones, setDevoluciones] = useState(() =>
    leerListaGuardada(CLAVE_DEVOLUCIONES_PROVEEDOR_MP)
  );
  const [reposiciones, setReposiciones] = useState(() =>
    leerListaGuardada(CLAVE_REPOSICIONES_PROVEEDOR_MP)
  );

  const devolucionesPendientes = useMemo(
    () => devoluciones.filter((registro) => registro?.estado === "enviado"),
    [devoluciones]
  );

  const devolucionSeleccionada = devolucionesPendientes.find(
    (registro) => registro.id === formulario.idDevolucion
  );

  const manejarSeleccionDevolucion = (registro) => {
    setFormulario({
      idDevolucion: registro.id,
      fechaReposicion: obtenerFechaActual(),
      codigoUnidadNuevo: registro.codigoUnidad || "",
      tipoTela: registro.tipoTela || "",
      colorBase: registro.colorBase || "",
      acabadoDiseno: registro.acabadoDiseno || "",
      partida: registro.partida || "",
      ancho: registro.ancho ? String(registro.ancho) : "",
      kilos: registro.kilos ? String(registro.kilos) : "",
      metros: registro.metros ? String(registro.metros) : "",
      observacion: "",
    });
    mostrarNotificacionCarga("Devolucion cargada para registrar la reposicion.");
  };

  const manejarCambioFormulario = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const guardarReposicion = () => {
    if (!devolucionSeleccionada?.id) {
      alert("Selecciona primero la devolucion que el proveedor esta reponiendo.");
      return;
    }

    if (!formulario.codigoUnidadNuevo.trim()) {
      alert("Completa el codigo de la tela repuesta.");
      return;
    }

    if (!formulario.tipoTela.trim() || !formulario.colorBase.trim()) {
      alert("Completa tipo de tela y color base de la reposicion.");
      return;
    }

    const nuevaReposicion = {
      id: `rep-prov-${Date.now()}`,
      idDevolucion: devolucionSeleccionada.id,
      fechaReposicion: formulario.fechaReposicion || obtenerFechaActual(),
      proveedor: devolucionSeleccionada.proveedor || "",
      origenMovimiento: "reposicion_proveedor",
      codigoUnidad: formulario.codigoUnidadNuevo.trim().toUpperCase(),
      tipoTela: formulario.tipoTela.trim().toUpperCase(),
      colorBase: formulario.colorBase.trim().toUpperCase(),
      acabadoDiseno: formulario.acabadoDiseno.trim().toUpperCase(),
      partida: formulario.partida.trim().toUpperCase(),
      ancho: Number(formulario.ancho || 0),
      kilos: Number(formulario.kilos || 0),
      metros: Number(formulario.metros || 0),
      observacion: formulario.observacion.trim(),
      referenciaDevolucion: devolucionSeleccionada.codigoUnidad || "",
      referenciaInterna: devolucionSeleccionada.referenciaInterna || "",
      proveedorOriginal: devolucionSeleccionada.proveedor || "",
    };

    const reposicionesActualizadas = [nuevaReposicion, ...reposiciones];
    const devolucionesActualizadas = devoluciones.map((registro) =>
      registro.id === devolucionSeleccionada.id
        ? {
            ...registro,
            estado: "repuesto",
            fechaReposicion: nuevaReposicion.fechaReposicion,
            codigoReposicion: nuevaReposicion.codigoUnidad,
          }
        : registro
    );

    localStorage.setItem(
      CLAVE_REPOSICIONES_PROVEEDOR_MP,
      JSON.stringify(reposicionesActualizadas)
    );
    localStorage.setItem(
      CLAVE_DEVOLUCIONES_PROVEEDOR_MP,
      JSON.stringify(devolucionesActualizadas)
    );
    setReposiciones(reposicionesActualizadas);
    setDevoluciones(devolucionesActualizadas);
    setFormulario(crearFormularioInicial());
    alert("Reposicion del proveedor registrada. Esta tela vuelve al stock sin pasar como compra.");
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
          <h1>Reposicion de proveedor</h1>
          <p>
            Aqui Almacen registra la tela que vuelve por cambio del proveedor.
            Este ingreso repone stock, pero no suma una compra nueva.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Devoluciones pendientes</span>
          <strong>{devolucionesPendientes.length}</strong>
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
              <h2>Devoluciones pendientes de cambio</h2>
              <p>
                Selecciona la tela enviada al proveedor para registrar la reposicion correcta.
              </p>
            </div>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Fecha salida</th>
                  <th>Codigo</th>
                  <th>Tipo tela</th>
                  <th>Color</th>
                  <th>Proveedor</th>
                  <th>Motivo</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {devolucionesPendientes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="fila_vacia">
                      No hay devoluciones pendientes de reposicion.
                    </td>
                  </tr>
                ) : (
                  devolucionesPendientes.map((registro) => (
                    <tr key={registro.id}>
                      <td>{registro.fechaSalida || "-"}</td>
                      <td>{registro.codigoUnidad || "-"}</td>
                      <td>{registro.tipoTela || "-"}</td>
                      <td>{registro.colorBase || "-"}</td>
                      <td>{registro.proveedor || "-"}</td>
                      <td>{registro.motivoFalla || "-"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn_principal btn_tabla"
                          onClick={() => manejarSeleccionDevolucion(registro)}
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
              <h2>Registrar reposicion</h2>
              <p>
                Puedes registrar el mismo color o uno distinto si el proveedor repuso la tela fallada con otra variante.
              </p>
            </div>
          </div>

          <div className="grid grid-3">
            <Campo>
              <label>Codigo original</label>
              <input type="text" value={devolucionSeleccionada?.codigoUnidad || ""} readOnly />
            </Campo>
            <Campo>
              <label>Proveedor</label>
              <input type="text" value={devolucionSeleccionada?.proveedor || ""} readOnly />
            </Campo>
            <Campo>
              <label>Fecha reposicion</label>
              <input
                type="date"
                name="fechaReposicion"
                value={formulario.fechaReposicion}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Codigo unidad nuevo</label>
              <input
                type="text"
                name="codigoUnidadNuevo"
                value={formulario.codigoUnidadNuevo}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Tipo de tela</label>
              <input
                type="text"
                name="tipoTela"
                value={formulario.tipoTela}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Color base</label>
              <input
                type="text"
                name="colorBase"
                value={formulario.colorBase}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Acabado / diseño</label>
              <input
                type="text"
                name="acabadoDiseno"
                value={formulario.acabadoDiseno}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Partida</label>
              <input
                type="text"
                name="partida"
                value={formulario.partida}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Ancho</label>
              <input
                type="number"
                step="0.01"
                name="ancho"
                value={formulario.ancho}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Kilos</label>
              <input
                type="number"
                step="0.01"
                name="kilos"
                value={formulario.kilos}
                onChange={manejarCambioFormulario}
              />
            </Campo>
            <Campo>
              <label>Metros</label>
              <input
                type="number"
                step="0.01"
                name="metros"
                value={formulario.metros}
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
            <button type="button" className="btn btn_principal" onClick={guardarReposicion}>
              Guardar reposicion
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
