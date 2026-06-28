import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, UserAuth } from "../index";
import { guardarPerfilUsuario, leerPerfilUsuario } from "../utils/perfilUsuario";
import { traducirMensajeAuth } from "../utils/authMensajes";
import { supabase } from "../supabase/supabase.config.jsx";
import { RiEyeLine, RiEyeOffLine } from "react-icons/ri";

const esperarConTimeout = async (promesa, tiempoMs = 15000, mensaje = "La operacion tardo demasiado.") =>
  Promise.race([
    promesa,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(mensaje)), tiempoMs),
    ),
  ]);

export function MiPerfil() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const { user } = UserAuth();
  const perfilBase = useMemo(() => leerPerfilUsuario(user), [user]);
  const [formulario, setFormulario] = useState(perfilBase);
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmacion, setPasswordConfirmacion] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [passwordTemporalActiva, setPasswordTemporalActiva] = useState(false);
  const [mostrarPasswordNueva, setMostrarPasswordNueva] = useState(false);
  const [mostrarPasswordConfirmacion, setMostrarPasswordConfirmacion] = useState(false);
  const [mensajePassword, setMensajePassword] = useState("");
  const [tipoMensajePassword, setTipoMensajePassword] = useState("exito");

  useEffect(() => {
    let activo = true;

    const cargarEstadoPasswordTemporal = async () => {
      const correo = (perfilBase?.correo || "").trim().toLowerCase();
      if (!correo) return;

      const { data } = await supabase
        .from("usuarios")
        .select("metadata")
        .ilike("correo", correo)
        .maybeSingle();

      if (!activo) return;
      setPasswordTemporalActiva(Boolean(data?.metadata?.passwordTemporalActiva));
    };

    cargarEstadoPasswordTemporal();
    return () => {
      activo = false;
    };
  }, [perfilBase?.correo]);

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const guardarPerfil = async () => {
    if (!formulario?.correo) {
      alert("No se pudo identificar el usuario actual.");
      return;
    }

    guardarPerfilUsuario(formulario);
    const { error } = await supabase
      .from("usuarios")
      .update({
        nombre: (formulario.nombreVisible || "").toString().trim().toUpperCase(),
        nombres: (formulario.nombreVisible || "").toString().trim().toUpperCase() || "GENERICO",
        area: (formulario.area || "").toString().trim().toUpperCase(),
        sede: (formulario.sede || "").toString().trim().toUpperCase(),
        telefono: (formulario.telefono || "").toString().trim(),
      })
      .ilike("correo", formulario.correo || "");

    if (error) {
      alert("El perfil local se guardo, pero no se pudo sincronizar el nombre visible con la base.");
      return;
    }

    alert("Perfil actualizado correctamente.");
  };

  const actualizarPassword = async () => {
    setMensajePassword("");

    if (!passwordNueva || passwordNueva.length < 6) {
      setTipoMensajePassword("error");
      setMensajePassword("La nueva contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (passwordNueva !== passwordConfirmacion) {
      setTipoMensajePassword("error");
      setMensajePassword("La confirmacion de contrasena no coincide.");
      return;
    }

    try {
      setGuardandoPassword(true);
      const { error } = await esperarConTimeout(
        supabase.auth.updateUser({ password: passwordNueva }),
        15000,
        "La actualizacion de contrasena esta tardando demasiado. Intenta nuevamente.",
      );
      if (error) throw error;

      setPasswordNueva("");
      setPasswordConfirmacion("");
      setPasswordTemporalActiva(false);

      supabase
        .from("usuarios")
        .select("metadata")
        .ilike("correo", formulario.correo || "")
        .maybeSingle()
        .then(({ data }) =>
          supabase
            .from("usuarios")
            .update({
              metadata: {
                ...(data?.metadata || {}),
                passwordTemporalActiva: false,
                fechaCambioPasswordPerfil: new Date().toISOString(),
              },
            })
            .ilike("correo", formulario.correo || ""),
        )
        .catch(() => {
          // Si el metadata no se puede actualizar, no bloqueamos el cambio real de password.
        });

      setTipoMensajePassword("exito");
      setMensajePassword("Contrasena actualizada correctamente.");
    } catch (error) {
      setTipoMensajePassword("error");
      setMensajePassword(
        traducirMensajeAuth(error?.message || "No se pudo actualizar la contrasena."),
      );
    } finally {
      setGuardandoPassword(false);
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
          <h1>Mi perfil</h1>
          <p>
            Aqui puedes revisar con que cuenta estas trabajando y guardar datos
            basicos para identificar mejor a cada persona del sistema.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Rol actual</span>
          <strong>{formulario.rol || "-"}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/" className="boton_volver">
          Volver al inicio
        </Link>
      </div>

      <main className="contenido">
        <section className="tarjeta resumen">
          <h2>Resumen del usuario</h2>
          <div className="resumen__grid">
            <div>
              <span>Nombre visible</span>
              <strong>{formulario.nombreVisible || "-"}</strong>
            </div>
            <div>
              <span>Correo</span>
              <strong>{formulario.correo || "-"}</strong>
            </div>
            <div>
              <span>Area</span>
              <strong>{formulario.area || "-"}</strong>
            </div>
            <div>
              <span>Sede</span>
              <strong>{formulario.sede || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Datos del perfil</h2>
              <p>
                Esto sirve para identificar mejor a la persona que esta usando la
                cuenta, sin tocar todavia permisos ni seguridad avanzada.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Nombre visible</label>
              <input
                type="text"
                name="nombreVisible"
                value={formulario.nombreVisible || ""}
                onChange={manejarCambio}
                placeholder=""
              />
            </Campo>
            <Campo>
              <label>Correo</label>
              <input type="text" value={formulario.correo || ""} readOnly />
            </Campo>
            <Campo>
              <label>Rol</label>
              <input type="text" value={formulario.rol || ""} readOnly />
            </Campo>
            <Campo>
              <label>Area</label>
              <input
                type="text"
                name="area"
                value={formulario.area || ""}
                onChange={manejarCambio}
                placeholder=""
              />
            </Campo>
            <Campo>
              <label>Sede</label>
              <input
                type="text"
                name="sede"
                value={formulario.sede || ""}
                onChange={manejarCambio}
                placeholder=""
              />
            </Campo>
            <Campo>
              <label>Telefono</label>
              <input
                type="text"
                name="telefono"
                value={formulario.telefono || ""}
                onChange={manejarCambio}
                placeholder=""
              />
            </Campo>
          </div>

          <div className="acciones">
            <button type="button" className="btn_guardar" onClick={guardarPerfil}>
              Guardar perfil
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Actualizar contrasena</h2>
              <p>
                Si entraste con una contrasena temporal o simplemente quieres cambiarla,
                puedes hacerlo aqui mismo sin pasar por el correo.
              </p>
            </div>
          </div>

          {passwordTemporalActiva ? (
            <div className="alerta_password_temporal">
              Estas usando una contrasena temporal. Cambiala ahora para dejar tu cuenta lista.
            </div>
          ) : null}
          {mensajePassword ? (
            <div
              className={
                tipoMensajePassword === "error"
                  ? "alerta_password_temporal alerta_password_error"
                  : "alerta_password_temporal alerta_password_exito"
              }
            >
              {mensajePassword}
            </div>
          ) : null}

          <div className="grid_formulario">
            <Campo>
              <label>Nueva contrasena</label>
              <div className="passwordField">
                <input
                  type={mostrarPasswordNueva ? "text" : "password"}
                  value={passwordNueva}
                  onChange={(evento) => setPasswordNueva(evento.target.value)}
                  placeholder=""
                />
                <button
                  type="button"
                  className="togglePassword"
                  onClick={() => setMostrarPasswordNueva((estado) => !estado)}
                  aria-label={
                    mostrarPasswordNueva ? "Ocultar contrasena nueva" : "Mostrar contrasena nueva"
                  }
                >
                  {mostrarPasswordNueva ? <RiEyeOffLine /> : <RiEyeLine />}
                </button>
              </div>
            </Campo>
            <Campo>
              <label>Confirmar contrasena</label>
              <div className="passwordField">
                <input
                  type={mostrarPasswordConfirmacion ? "text" : "password"}
                  value={passwordConfirmacion}
                  onChange={(evento) => setPasswordConfirmacion(evento.target.value)}
                  placeholder=""
                />
                <button
                  type="button"
                  className="togglePassword"
                  onClick={() => setMostrarPasswordConfirmacion((estado) => !estado)}
                  aria-label={
                    mostrarPasswordConfirmacion
                      ? "Ocultar confirmacion de contrasena"
                      : "Mostrar confirmacion de contrasena"
                  }
                >
                  {mostrarPasswordConfirmacion ? <RiEyeOffLine /> : <RiEyeLine />}
                </button>
              </div>
            </Campo>
          </div>

          <div className="acciones">
            <button
              type="button"
              className="btn_guardar"
              onClick={actualizarPassword}
              disabled={guardandoPassword}
            >
              {guardandoPassword ? "Guardando..." : "Actualizar contrasena"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Modulos visibles</h2>
              <p>
                Esto ayuda a que el usuario sepa rapidamente a que partes del sistema
                suele tener acceso con esta cuenta.
              </p>
            </div>
          </div>

          <div className="chips_modulos">
            {(formulario.modulos || []).map((modulo) => (
              <span key={modulo} className="chip_modulo">
                {modulo}
              </span>
            ))}
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
    "contenido" 1fr;
  gap: 15px;
  padding: 15px;

  .encabezado,
  .cabecera,
  .contenido {
    border-radius: 20px;
  }

  .encabezado {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: ${({ theme }) => theme.bgcards};
    padding-right: 10px;
  }

  .cabecera,
  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 20px;
    padding: 22px;
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
    display: flex;
    justify-content: flex-start;
  }

  .boton_volver,
  .btn_guardar {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    text-decoration: none;
  }

  .boton_volver {
    background: #5b5b60;
    color: #ffffff;
  }

  .btn_guardar {
    background: ${({ theme }) => theme.bg5};
    color: #ffffff;
    cursor: pointer;
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

  .tarjeta__encabezado {
    margin-bottom: 16px;
  }

  .acciones {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }

  .chips_modulos {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .alerta_password_temporal {
    margin-bottom: 16px;
    border-radius: 16px;
    padding: 14px 16px;
    background: rgba(255, 179, 0, 0.14);
    border: 1px solid rgba(255, 179, 0, 0.34);
    color: ${({ theme }) => theme.text};
    font-weight: 700;
  }

  .alerta_password_error {
    background: rgba(184, 46, 46, 0.14);
    border: 1px solid rgba(184, 46, 46, 0.34);
    color: #ffd1d1;
  }

  .alerta_password_exito {
    background: rgba(34, 160, 96, 0.14);
    border: 1px solid rgba(34, 160, 96, 0.34);
    color: #c8ffe0;
  }

  .chip_modulo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(117, 1, 152, 0.15);
    border: 1px solid rgba(117, 1, 152, 0.28);
    color: #ffffff;
    font-weight: 700;
  }

  @media (max-width: 900px) {
    .cabecera {
      flex-direction: column;
    }

    .cabecera__estado {
      width: 100%;
    }
  }
`;

const Campo = styled.div`
  display: grid;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  .passwordField {
    position: relative;
  }

  .togglePassword {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    color: #7c7c85;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    font-size: 18px;
  }
`;
