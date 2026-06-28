import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../index";
import { VERSION_SISTEMA } from "../utils/versionSistema";
import { resolverIdentidadVisualPorRuta } from "../utils/identidadVisual";
import {
  crearJornalVacio,
  crearTrabajadorVacio,
  eliminarJornalRrhh,
  eliminarTrabajadorRrhh,
  guardarJornalRrhh,
  guardarTrabajadorRrhh,
  leerJornalesRrhh,
  leerTrabajadoresRrhh,
  resumirQuincenaRrhh,
} from "../utils/recursosHumanos";

const formatearSoles = (valor) =>
  `S/ ${Number(valor || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function RecursosHumanos() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadModulo = resolverIdentidadVisualPorRuta("/recursos-humanos");
  const [pestanaActiva, setPestanaActiva] = useState("trabajadores");
  const [trabajadores, setTrabajadores] = useState(leerTrabajadoresRrhh);
  const [jornales, setJornales] = useState(leerJornalesRrhh);
  const [formularioTrabajador, setFormularioTrabajador] = useState(crearTrabajadorVacio);
  const [formularioJornal, setFormularioJornal] = useState(crearJornalVacio);
  const fechaActual = new Date();
  const [periodo, setPeriodo] = useState({
    anio: String(fechaActual.getFullYear()),
    mes: String(fechaActual.getMonth() + 1).padStart(2, "0"),
    quincena: fechaActual.getDate() <= 15 ? "1" : "2",
  });

  const resumenQuincena = useMemo(
    () =>
      resumirQuincenaRrhh({
        trabajadores,
        jornales,
        anio: periodo.anio,
        mes: periodo.mes,
        quincena: periodo.quincena,
      }),
    [jornales, periodo, trabajadores]
  );

  const manejarCambioTrabajador = (evento) => {
    const { name, value } = evento.target;
    setFormularioTrabajador((anterior) => ({
      ...anterior,
      [name]:
        name === "telefono" || name === "pagoDiario" || name === "pagoHoraExtra"
          ? value
          : value.toUpperCase(),
    }));
  };

  const manejarCambioJornal = (evento) => {
    const { name, value } = evento.target;
    setFormularioJornal((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const guardarTrabajador = () => {
    if (!formularioTrabajador.nombreCompleto.trim()) {
      alert("Completa el nombre del trabajador.");
      return;
    }

    guardarTrabajadorRrhh(formularioTrabajador);
    setTrabajadores(leerTrabajadoresRrhh());
    setFormularioTrabajador(crearTrabajadorVacio());
    alert("Trabajador guardado correctamente.");
  };

  const guardarJornal = () => {
    if (!formularioJornal.trabajadorId || !formularioJornal.fecha) {
      alert("Selecciona trabajador y fecha.");
      return;
    }

    guardarJornalRrhh(formularioJornal);
    setJornales(leerJornalesRrhh());
    setFormularioJornal(crearJornalVacio());
    alert("Jornal guardado correctamente.");
  };

  const cargarTrabajador = (item) => {
    setFormularioTrabajador({
      id: item.id,
      nombreCompleto: item.nombreCompleto || "",
      documento: item.documento || "",
      telefono: item.telefono || "",
      cargo: item.cargo || "",
      area: item.area || "PRODUCCION",
      pagoDiario: String(item.pagoDiario || 0),
      pagoHoraExtra: String(item.pagoHoraExtra || 0),
      estado: item.estado || "ACTIVO",
      observacion: item.observacion || "",
    });
    setPestanaActiva("trabajadores");
  };

  const cargarJornal = (item) => {
    setFormularioJornal({
      id: item.id,
      trabajadorId: item.trabajadorId || "",
      fecha: item.fecha || "",
      jornadas: String(item.jornadas || 0),
      horasExtra: String(item.horasExtra || 0),
      adelanto: String(item.adelanto || 0),
      observacion: item.observacion || "",
    });
    setPestanaActiva("jornales");
  };

  const quitarTrabajador = (id) => {
    if (!window.confirm("Seguro que deseas quitar este trabajador?")) return;
    eliminarTrabajadorRrhh(id);
    setTrabajadores(leerTrabajadoresRrhh());
  };

  const quitarJornal = (id) => {
    if (!window.confirm("Seguro que deseas quitar este registro de jornal?")) return;
    eliminarJornalRrhh(id);
    setJornales(leerJornalesRrhh());
  };

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
          <h1>Recursos humanos</h1>
          <p>
            Aqui registras trabajadores, su pago diario y sus dias trabajados para
            saber cuanto dinero pedir en cada quincena.
          </p>
          <small className="version_actual">{VERSION_SISTEMA} | Recursos humanos</small>
        </div>
        <div className="cabecera__estado">
          <span>Total quincena</span>
          <strong>{formatearSoles(resumenQuincena.totalGeneral)}</strong>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Trabajadores activos</span>
              <strong>{trabajadores.filter((item) => item.estado === "ACTIVO").length}</strong>
            </div>
            <div>
              <span>Registros de jornal</span>
              <strong>{jornales.length}</strong>
            </div>
            <div>
              <span>Periodo actual</span>
              <strong>{resumenQuincena.desde} al {resumenQuincena.hasta}</strong>
            </div>
            <div>
              <span>Monto a solicitar</span>
              <strong>{formatearSoles(resumenQuincena.totalGeneral)}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="pestanas">
            <button type="button" className={`pestana ${pestanaActiva === "trabajadores" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("trabajadores")}>
              Trabajadores
            </button>
            <button type="button" className={`pestana ${pestanaActiva === "jornales" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("jornales")}>
              Dias trabajados
            </button>
            <button type="button" className={`pestana ${pestanaActiva === "quincena" ? "pestana_activa" : ""}`} onClick={() => setPestanaActiva("quincena")}>
              Resumen quincenal
            </button>
          </div>

          {pestanaActiva === "trabajadores" ? (
            <>
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Ficha del trabajador</h2>
                  <p>
                    Aqui dejas su pago diario y, si quieres, pago por hora extra para
                    que la quincena salga automatico.
                  </p>
                </div>
              </div>

              <div className="grid_formulario">
                <Campo><label>Nombre completo</label><input type="text" name="nombreCompleto" value={formularioTrabajador.nombreCompleto} onChange={manejarCambioTrabajador} /></Campo>
                <Campo><label>Documento</label><input type="text" name="documento" value={formularioTrabajador.documento} onChange={manejarCambioTrabajador} /></Campo>
                <Campo><label>Telefono</label><input type="text" name="telefono" value={formularioTrabajador.telefono} onChange={manejarCambioTrabajador} /></Campo>
                <Campo><label>Area</label><input type="text" name="area" value={formularioTrabajador.area} onChange={manejarCambioTrabajador} /></Campo>
                <Campo><label>Cargo</label><input type="text" name="cargo" value={formularioTrabajador.cargo} onChange={manejarCambioTrabajador} /></Campo>
                <Campo><label>Estado</label><select name="estado" value={formularioTrabajador.estado} onChange={manejarCambioTrabajador}><option value="ACTIVO">ACTIVO</option><option value="PAUSADO">PAUSADO</option></select></Campo>
                <Campo><label>Pago diario</label><input type="number" step="0.01" name="pagoDiario" value={formularioTrabajador.pagoDiario} onChange={manejarCambioTrabajador} /></Campo>
                <Campo><label>Pago hora extra</label><input type="number" step="0.01" name="pagoHoraExtra" value={formularioTrabajador.pagoHoraExtra} onChange={manejarCambioTrabajador} /></Campo>
                <Campo className="campo_completo"><label>Observacion</label><textarea name="observacion" value={formularioTrabajador.observacion} onChange={manejarCambioTrabajador} /></Campo>
              </div>

              <div className="acciones">
                <button type="button" className="btn btn_secundario" onClick={() => setFormularioTrabajador(crearTrabajadorVacio())}>Limpiar</button>
                <button type="button" className="btn btn_principal" onClick={guardarTrabajador}>Guardar trabajador</button>
              </div>

              <div className="grid_historial">
                {trabajadores.map((item) => (
                  <article key={item.id} className="historial_card">
                    <strong>{item.nombreCompleto}</strong>
                    <p>{item.area || "-"} · {item.cargo || "-"}</p>
                    <small>{formatearSoles(item.pagoDiario)} por dia</small>
                    <div className="historial_acciones">
                      <button type="button" className="btn btn_principal" onClick={() => cargarTrabajador(item)}>Cargar</button>
                      <button type="button" className="btn btn_secundario" onClick={() => quitarTrabajador(item.id)}>Quitar</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : pestanaActiva === "jornales" ? (
            <>
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Registro de dias trabajados</h2>
                  <p>
                    Puedes poner 1 dia completo, medio dia con 0.5, horas extra y
                    adelantos para que la quincena quede mas real.
                  </p>
                </div>
              </div>

              <div className="grid_formulario">
                <Campo>
                  <label>Trabajador</label>
                  <select name="trabajadorId" value={formularioJornal.trabajadorId} onChange={manejarCambioJornal}>
                    <option value="">Selecciona</option>
                    {trabajadores.filter((item) => item.estado === "ACTIVO").map((item) => (
                      <option key={item.id} value={item.id}>{item.nombreCompleto}</option>
                    ))}
                  </select>
                </Campo>
                <Campo><label>Fecha</label><input type="date" name="fecha" value={formularioJornal.fecha} onChange={manejarCambioJornal} /></Campo>
                <Campo><label>Jornadas</label><input type="number" step="0.25" name="jornadas" value={formularioJornal.jornadas} onChange={manejarCambioJornal} /></Campo>
                <Campo><label>Horas extra</label><input type="number" step="0.5" name="horasExtra" value={formularioJornal.horasExtra} onChange={manejarCambioJornal} /></Campo>
                <Campo><label>Adelanto</label><input type="number" step="0.01" name="adelanto" value={formularioJornal.adelanto} onChange={manejarCambioJornal} /></Campo>
                <Campo className="campo_completo"><label>Observacion</label><textarea name="observacion" value={formularioJornal.observacion} onChange={manejarCambioJornal} /></Campo>
              </div>

              <div className="acciones">
                <button type="button" className="btn btn_secundario" onClick={() => setFormularioJornal(crearJornalVacio())}>Limpiar</button>
                <button type="button" className="btn btn_principal" onClick={guardarJornal}>Guardar jornal</button>
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Trabajador</th>
                      <th>Jornadas</th>
                      <th>Horas extra</th>
                      <th>Adelanto</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jornales.length === 0 ? (
                      <tr><td colSpan="6" className="sin_datos">Todavia no hay jornales registrados.</td></tr>
                    ) : (
                      jornales.map((item) => {
                        const trabajador = trabajadores.find((trab) => trab.id === item.trabajadorId);
                        return (
                          <tr key={item.id}>
                            <td>{item.fecha}</td>
                            <td>{trabajador?.nombreCompleto || "-"}</td>
                            <td>{item.jornadas}</td>
                            <td>{item.horasExtra}</td>
                            <td>{formatearSoles(item.adelanto)}</td>
                            <td>
                              <div className="tabla_acciones">
                                <button type="button" className="btn btn_principal btn_tabla" onClick={() => cargarJornal(item)}>Cargar</button>
                                <button type="button" className="btn btn_secundario btn_tabla" onClick={() => quitarJornal(item.id)}>Quitar</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="tarjeta__encabezado">
                <div>
                  <h2>Resumen quincenal</h2>
                  <p>
                    Desde aqui ya puedes saber cuanto dinero pedir para la quincena
                    segun dias trabajados, horas extra y adelantos.
                  </p>
                </div>
              </div>

              <div className="grid_formulario filtros_periodo">
                <Campo><label>Año</label><input type="number" value={periodo.anio} onChange={(e) => setPeriodo((a) => ({ ...a, anio: e.target.value }))} /></Campo>
                <Campo><label>Mes</label><input type="month" value={`${periodo.anio}-${periodo.mes}`} onChange={(e) => { const [anio, mes] = e.target.value.split('-'); setPeriodo((a) => ({ ...a, anio, mes })); }} /></Campo>
                <Campo>
                  <label>Quincena</label>
                  <select value={periodo.quincena} onChange={(e) => setPeriodo((a) => ({ ...a, quincena: e.target.value }))}>
                    <option value="1">1 al 15</option>
                    <option value="2">16 al fin de mes</option>
                  </select>
                </Campo>
              </div>

              <div className="resumen__grid resumen_quincena">
                <div>
                  <span>Desde</span>
                  <strong>{resumenQuincena.desde}</strong>
                </div>
                <div>
                  <span>Hasta</span>
                  <strong>{resumenQuincena.hasta}</strong>
                </div>
                <div>
                  <span>Trabajadores liquidados</span>
                  <strong>{resumenQuincena.detalle.length}</strong>
                </div>
                <div>
                  <span>Total a solicitar</span>
                  <strong>{formatearSoles(resumenQuincena.totalGeneral)}</strong>
                </div>
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Trabajador</th>
                      <th>Area</th>
                      <th>Jornadas</th>
                      <th>Horas extra</th>
                      <th>Adelantos</th>
                      <th>Subtotal</th>
                      <th>Total pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenQuincena.detalle.length === 0 ? (
                      <tr><td colSpan="7" className="sin_datos">Todavia no hay datos para esta quincena.</td></tr>
                    ) : (
                      resumenQuincena.detalle.map((item) => (
                        <tr key={item.trabajadorId}>
                          <td>{item.nombreCompleto}</td>
                          <td>{item.area}</td>
                          <td>{item.jornadas}</td>
                          <td>{item.horasExtra}</td>
                          <td>{formatearSoles(item.adelantos)}</td>
                          <td>{formatearSoles(item.subtotal)}</td>
                          <td><strong className="monto_destacado">{formatearSoles(item.totalPagar)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="acciones acciones_finales">
          <Link to="/" className="btn btn_secundario btn_enlace">Volver al inicio</Link>
          <Link to="/contabilidad" className="btn btn_principal btn_enlace">Ir a contabilidad</Link>
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
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
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
    min-width: 220px;
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

  .contenido {
    display: grid;
    gap: 16px;
  }

  .resumen__grid,
  .grid_formulario {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .resumen__grid div {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg2};
    min-height: 110px;
    display: grid;
    align-content: start;
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
    font-size: 18px;
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

  .tarjeta__encabezado {
    margin-bottom: 16px;
  }

  .campo_completo {
    grid-column: 1 / -1;
  }

  .tabla_contenedor {
    margin-top: 16px;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 860px;
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

  .tabla_acciones,
  .acciones,
  .historial_acciones,
  .acciones_finales {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .acciones,
  .acciones_finales {
    margin-top: 16px;
  }

  .grid_historial {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 14px;
    margin-top: 16px;
  }

  .historial_card {
    display: grid;
    gap: 8px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 14px;
    background: ${({ theme }) => theme.bg};
  }

  .historial_card small {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .btn {
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn_principal {
    background-color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_tabla {
    padding: 8px 10px;
  }

  .btn_enlace {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  .monto_destacado {
    color: var(--modulo-acento, ${({ theme }) => theme.bg5});
  }

  @media (max-width: 960px) {
    .cabecera {
      flex-direction: column;
    }

    .cabecera__estado {
      width: 100%;
    }

    .acciones,
    .acciones_finales,
    .historial_acciones,
    .tabla_acciones {
      flex-direction: column;
    }
  }
`;

const Campo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input,
  select,
  textarea {
    border: 1px solid ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  textarea {
    min-height: 90px;
    resize: vertical;
  }
`;
