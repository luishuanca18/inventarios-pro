import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { buscarFichaTaller, crearFichaTallerVacia, leerFichasTalleres } from "../../utils/fichasTalleres";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  crearAccesoTemporalUsuarioConfiguracion,
  eliminarTallerConfiguracion,
  guardarTallerConfiguracion,
  listarTalleresConfiguracion,
} from "../../supabase/configuracionCore.js";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";

const CAMPOS_OBLIGATORIOS = ["nombreTaller", "responsable", "telefonoPrincipal"];
const resolverClaseEstadoTaller = (estado = "") => {
  const valor = (estado || "").toString().trim().toUpperCase();
  if (valor === "ACTIVO") return "chip_estado_activo";
  if (valor === "EN PRUEBA") return "chip_estado_prueba";
  return "chip_estado_pausado";
};

export function ConfiguracionTalleres() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Maestros");
  const [fichas, setFichas] = useState(leerFichasTalleres);
  const [formulario, setFormulario] = useState(crearFichaTallerVacia);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    const cargarDesdeSupabase = async () => {
      try {
        const lista = await listarTalleresConfiguracion();
        if (activo) setFichas(lista);
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargarDesdeSupabase();

    return () => {
      activo = false;
    };
  }, []);

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({
      ...anterior,
      [name]:
        name.includes("telefono") ||
        name === "capacidadDiaria" ||
        name === "correoUsuario" ||
        name === "passwordTemporal"
          ? value
          : value.toUpperCase(),
    }));
  };

  const guardar = async () => {
    const faltantes = CAMPOS_OBLIGATORIOS.filter((campo) => !formulario[campo]?.trim());
    if (faltantes.length) {
      await mostrarAlertaSistema("Completa al menos nombre del taller, responsable y telefono principal.");
      return;
    }

    setGuardando(true);
    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Guardando ficha del taller...",
        mensajeExito: "Ficha del taller guardada correctamente.",
        mensajeError: "No se pudo guardar la ficha del taller.",
        accion: async () => {
          await guardarTallerConfiguracion(formulario);
          setFichas(await listarTalleresConfiguracion());
          setFormulario(crearFichaTallerVacia());
        },
      });
    } catch (error) {
      console.error("No se pudo guardar el taller:", error.message);
    } finally {
      setGuardando(false);
    }
  };

  const crearAcceso = async () => {
    const faltantes = CAMPOS_OBLIGATORIOS.filter((campo) => !formulario[campo]?.trim());
    if (faltantes.length) {
      await mostrarAlertaSistema("Completa primero la ficha del taller antes de crear el acceso.");
      return;
    }

    if (!formulario.correoUsuario?.trim()) {
      await mostrarAlertaSistema("Escribe el correo del taller antes de crear el acceso.");
      return;
    }

    if ((formulario.passwordTemporal || "").trim().length < 6) {
      await mostrarAlertaSistema("Escribe una contrasena inicial de al menos 6 caracteres.");
      return;
    }

    setGuardando(true);
    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Creando acceso del taller...",
        mensajeExito: "Acceso del taller creado correctamente.",
        mensajeError: "No se pudo crear el acceso del taller.",
        accion: async () => {
          const accesoEstado =
            formulario.accesoEstado === "BLOQUEADO" ? "BLOQUEADO" : "ACTIVO";
          const fichaGuardada = await guardarTallerConfiguracion({
            ...formulario,
            accesoEstado,
          });
          await crearAccesoTemporalUsuarioConfiguracion({
            correo: fichaGuardada.correoUsuario || formulario.correoUsuario,
            nombreCompleto:
              fichaGuardada.nombreUsuario ||
              fichaGuardada.responsable ||
              fichaGuardada.nombreTaller,
            passwordTemporal: (formulario.passwordTemporal || "").trim(),
            rol: "TALLER",
            area: "TALLERES",
            estado: accesoEstado,
            modulos: ["TALLERES"],
            submodulos: {
              TALLERES: ["OP DISPONIBLES", "MI PRODUCCION", "HISTORIAL", "PAGOS"],
            },
            tallerAsignado: fichaGuardada.nombreTaller || formulario.nombreTaller,
            tallerId: fichaGuardada.id || formulario.id || "",
            tallerCodigo: fichaGuardada.codigoTaller || formulario.codigoTaller || "",
            observacion: fichaGuardada.observacion || formulario.observacion || "",
            metadata: {
              tallerAsignado: fichaGuardada.nombreTaller || formulario.nombreTaller,
              tallerId: fichaGuardada.id || formulario.id || "",
              tallerCodigo: fichaGuardada.codigoTaller || formulario.codigoTaller || "",
              accesoSistemaCreado: true,
            },
          });
          setFichas(await listarTalleresConfiguracion());
          setFormulario((anterior) => ({
            ...anterior,
            passwordTemporal: "",
            accesoEstado,
          }));
        },
      });
    } catch (error) {
      console.error("No se pudo crear el acceso:", error.message);
    } finally {
      setGuardando(false);
    }
  };

  const cargar = (nombreTaller) => {
    const ficha = buscarFichaTaller(nombreTaller);
    if (!ficha) return;
    setFormulario({
      id: ficha.id || "",
      codigoTaller: ficha.codigoTaller || "",
      nombreTaller: ficha.nombreTaller || "",
      responsable: ficha.responsable || "",
      telefonoPrincipal: ficha.telefonoPrincipal || "",
      telefonoSecundario: ficha.telefonoSecundario || "",
      direccion: ficha.direccion || "",
      referencia: ficha.referencia || "",
      especialidad: ficha.especialidad || "",
      tiposMaquinas: ficha.tiposMaquinas || "",
      capacidadDiaria: ficha.capacidadDiaria || "",
      tiempoRespuesta: ficha.tiempoRespuesta || "",
      estado: ficha.estado || "EN PRUEBA",
      correoUsuario: ficha.correoUsuario || "",
      nombreUsuario: ficha.nombreUsuario || "",
      passwordTemporal: "",
      accesoEstado: ficha.accesoEstado || "SIN_CUENTA",
      observacion: ficha.observacion || "",
    });
    mostrarNotificacionCarga("Ficha del taller cargada.");
  };

  const quitar = async (nombreTaller) => {
    const confirmar = await confirmarAccionSistema(
      "Seguro que deseas quitar esta ficha de taller?",
      { titulo: "Quitar ficha de taller", confirmarTexto: "Quitar" }
    );
    if (!confirmar) return;

    try {
      setGuardando(true);
      await eliminarTallerConfiguracion(nombreTaller);
      setFichas(await listarTalleresConfiguracion());
      if (formulario.nombreTaller === nombreTaller) {
        setFormulario(crearFichaTallerVacia());
      }
    } catch (error) {
      mostrarErrorSistema(`No se pudo quitar el taller: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ContenedorPagina
      style={{
        "--modulo-acento": identidadVisual.acento,
        "--modulo-fondo": identidadVisual.fondo,
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
          <h1>Fichas de talleres</h1>
          <p>
            Aqui registras los datos base del taller para que Produccion, Almacen y
            pagos trabajen con el mismo nombre y una referencia clara de contacto.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Datos basicos del taller</h2>
              <p>
                Tambien deje especialidad, tipos de maquinas, capacidad diaria y
                tiempo de respuesta, porque luego ayudan mucho para decidir a que
                taller enviar una OP. El acceso al sistema va aparte, pero queda
                amarrado aqui mismo para no perder la relacion. Desde esta misma ficha
                puedes crear o actualizar el acceso del taller.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Codigo del taller</label>
              <input type="text" name="codigoTaller" value={formulario.codigoTaller} readOnly />
            </Campo>
            <Campo>
              <label>Nombre del taller</label>
              <input type="text" name="nombreTaller" value={formulario.nombreTaller} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Responsable</label>
              <input type="text" name="responsable" value={formulario.responsable} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Estado</label>
              <select name="estado" value={formulario.estado} onChange={manejarCambio}>
                <option value="EN PRUEBA">EN PRUEBA</option>
                <option value="ACTIVO">ACTIVO</option>
                <option value="PAUSADO">PAUSADO</option>
              </select>
            </Campo>
            <Campo>
              <label>Telefono principal</label>
              <input type="text" name="telefonoPrincipal" value={formulario.telefonoPrincipal} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Telefono secundario</label>
              <input type="text" name="telefonoSecundario" value={formulario.telefonoSecundario} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Capacidad diaria (prendas)</label>
              <input type="text" name="capacidadDiaria" value={formulario.capacidadDiaria} onChange={manejarCambio} />
            </Campo>
            <Campo className="campo_completo">
              <label>Direccion</label>
              <input type="text" name="direccion" value={formulario.direccion} onChange={manejarCambio} />
            </Campo>
            <Campo className="campo_completo">
              <label>Referencia</label>
              <input type="text" name="referencia" value={formulario.referencia} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Especialidad</label>
              <input type="text" name="especialidad" value={formulario.especialidad} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Tipos de maquinas</label>
              <textarea name="tiposMaquinas" value={formulario.tiposMaquinas} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Tiempo de respuesta</label>
              <input type="text" name="tiempoRespuesta" value={formulario.tiempoRespuesta} onChange={manejarCambio} />
            </Campo>
            <Campo className="campo_completo">
              <label>Observacion</label>
              <textarea name="observacion" value={formulario.observacion} onChange={manejarCambio} />
            </Campo>
          </div>

          <div className="tarjeta_subseccion">
            <h3>Acceso al sistema</h3>
            <p>
              Aqui puedes dejar amarrada la cuenta del taller. Si llenas el correo,
              al guardar se vinculara como usuario de rol `TALLER` con este taller.
            </p>
            <div className="grid_formulario">
              <Campo>
                <label>Correo de acceso</label>
                <input
                  type="email"
                  name="correoUsuario"
                  value={formulario.correoUsuario}
                  onChange={manejarCambio}
                  placeholder="taller@correo.com"
                />
              </Campo>
              <Campo>
                <label>Nombre visible de la cuenta</label>
                <input
                  type="text"
                  name="nombreUsuario"
                  value={formulario.nombreUsuario}
                  onChange={manejarCambio}
                  placeholder="TALLER ROSA"
                />
              </Campo>
              <Campo>
                <label>Contrasena inicial</label>
                <input
                  type="text"
                  name="passwordTemporal"
                  value={formulario.passwordTemporal || ""}
                  onChange={manejarCambio}
                  placeholder="La defines tu para el primer ingreso"
                />
              </Campo>
              <Campo>
                <label>Estado del acceso</label>
                <select
                  name="accesoEstado"
                  value={formulario.accesoEstado}
                  onChange={manejarCambio}
                >
                  <option value="SIN_CUENTA">SIN CUENTA</option>
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="BLOQUEADO">BLOQUEADO</option>
                </select>
              </Campo>
            </div>
          </div>

          <div className="acciones">
            <Link to="/configurar" className="btn btn_secundario btn_enlace">
              Volver a Configuracion
            </Link>
            <button type="button" className="btn btn_secundario" onClick={() => setFormulario(crearFichaTallerVacia())}>
              Limpiar
            </button>
            <button
              type="button"
              className="btn btn_secundario"
              onClick={crearAcceso}
              disabled={guardando}
            >
              {guardando ? "Procesando..." : "Crear acceso"}
            </button>
            <button type="button" className="btn btn_principal" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar ficha"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Talleres registrados</h2>
              <p>
                Desde aqui puedes cargar una ficha para actualizar telefono,
                direccion, maquinas o dejar un taller en pausa sin borrarlo del
                historial.
              </p>
            </div>
          </div>

          <div className="grid_fichas">
            {cargando ? (
              <div className="ficha_vacia">Cargando talleres...</div>
            ) : fichas.length === 0 ? (
              <div className="ficha_vacia">Todavia no hay talleres registrados.</div>
            ) : (
              fichas.map((ficha) => (
                <article key={ficha.id || ficha.nombreTaller} className="ficha_card">
                  <div className="ficha_card__top">
                    <div className="ficha_card__titulo">
                      <strong>{ficha.nombreTaller}</strong>
                      <small>{ficha.codigoTaller || "SIN CODIGO"}</small>
                    </div>
                    <span className={`chip_estado ${resolverClaseEstadoTaller(ficha.estado)}`}>
                      {ficha.estado}
                    </span>
                  </div>
                  <p><strong>Responsable:</strong> {ficha.responsable || "-"}</p>
                  <p><strong>Telefono:</strong> {ficha.telefonoPrincipal || "-"}</p>
                  <p><strong>Especialidad:</strong> {ficha.especialidad || "-"}</p>
                  <p><strong>Cuenta:</strong> {ficha.correoUsuario || "SIN CUENTA"}</p>
                  <p><strong>Estado acceso:</strong> {ficha.accesoEstado || "SIN CUENTA"}</p>
                  <p><strong>Maquinas:</strong> {ficha.tiposMaquinas || "-"}</p>
                  <p><strong>Direccion:</strong> {ficha.direccion || "-"}</p>
                  <div className="ficha_acciones">
                    <button type="button" className="btn btn_principal" onClick={() => cargar(ficha.nombreTaller)}>
                      Cargar
                    </button>
                    <button type="button" className="btn btn_secundario" onClick={() => quitar(ficha.nombreTaller)}>
                      Quitar
                    </button>
                  </div>
                </article>
              ))
            )}
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
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .cabecera {
    background:
      linear-gradient(135deg, var(--modulo-fondo, rgba(15, 118, 110, 0.12)) 0%, ${({ theme }) => theme.bgcards} 100%);
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .ficha_vacia {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .tarjeta__encabezado {
    margin-bottom: 18px;
  }

  .grid_formulario {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .campo_completo {
    grid-column: 1 / -1;
  }

  .acciones,
  .ficha_acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .grid_fichas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }

  .ficha_card {
    display: grid;
    gap: 10px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 16px;
    background:
      linear-gradient(180deg, ${({ theme }) => theme.bg} 0%, ${({ theme }) => theme.bgcards} 100%);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  }

  .ficha_card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .ficha_card__titulo {
    display: grid;
    gap: 2px;
  }

  .ficha_card__titulo small,
  .tarjeta_subseccion p {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .tarjeta_subseccion {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid ${({ theme }) => theme.bg4};
    display: grid;
    gap: 10px;
  }

  .chip_estado {
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
  }

  .chip_estado_activo {
    background: rgba(0, 180, 90, 0.14);
    color: #7ef0a8;
  }

  .chip_estado_prueba {
    background: rgba(59, 130, 246, 0.16);
    color: #93c5fd;
  }

  .chip_estado_pausado {
    background: rgba(255, 180, 0, 0.14);
    color: #ffd67a;
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

  .btn_enlace {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  @media (max-width: 960px) {
    .grid_formulario {
      grid-template-columns: 1fr;
    }

    .acciones,
    .ficha_acciones {
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
