import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, leerCatalogosProduccion, UserAuth } from "../../index";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
} from "../../utils/notificaciones";
import { obtenerNombresTalleres } from "../../utils/fichasTalleres";
import {
  ACCESOS_SISTEMA,
  crearFichaPersonalVacia,
  crearUsuarioSistemaVacio,
  eliminarPersonalSistema,
  guardarPersonalSistema,
  leerPersonalSistema,
  obtenerAccesoSugeridoPorRol,
  sincronizarCatalogosPersonalSeguridad,
} from "../../utils/seguridadUsuarios";
import {
  activarUsuarioSistemaConfiguracion,
  bloquearUsuarioSistemaConfiguracion,
  crearAccesoTemporalUsuarioConfiguracion,
  eliminarUsuarioSistemaConfiguracion,
  guardarUsuarioSistemaConfiguracion,
  listarUsuariosSistemaConfiguracion,
  restablecerPasswordTemporalUsuarioConfiguracion,
} from "../../supabase/configuracionCore.js";
import { leerPerfilUsuario } from "../../utils/perfilUsuario";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";

const ROLES_BASE = [
  "ADMINISTRADOR",
  "RECURSOS HUMANOS",
  "PRODUCCION",
  "ALMACEN MATERIA PRIMA",
  "ALMACEN PRODUCTO TERMINADO",
  "TALLER",
  "TIENDA",
  "GERENCIA",
  "CONTABILIDAD",
];

const ROLES_GESTION_SEGURIDAD = ["GERENCIA", "RECURSOS HUMANOS", "ADMINISTRADOR", "ADMIN"];

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export function ConfiguracionPersonalSeguridad() {
  const { user } = UserAuth();
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const cuentaSectionRef = useRef(null);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Seguridad");
  const catalogos = useMemo(leerCatalogosProduccion, []);
  const [personal, setPersonal] = useState(leerPersonalSistema);
  const [usuarios, setUsuarios] = useState([]);
  const [formularioPersonal, setFormularioPersonal] = useState(crearFichaPersonalVacia);
  const [formularioUsuario, setFormularioUsuario] = useState(crearUsuarioSistemaVacio);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const perfilUsuario = useMemo(() => leerPerfilUsuario(user), [user]);
  const rolUsuarioActivo = String(perfilUsuario?.rol || "").toUpperCase();
  const puedeAdministrarSeguridad = ROLES_GESTION_SEGURIDAD.includes(rolUsuarioActivo);
  const puedeRestablecerPassword = puedeAdministrarSeguridad;

  useEffect(() => {
    let activo = true;

    const cargarUsuarios = async () => {
      try {
        const lista = await listarUsuariosSistemaConfiguracion();
        if (activo) setUsuarios(lista);
      } catch (error) {
        if (activo) {
          alert(`No se pudieron cargar los usuarios: ${error.message}`);
        }
      } finally {
        if (activo) setCargandoUsuarios(false);
      }
    };

    cargarUsuarios();
    return () => {
      activo = false;
    };
  }, []);

  const rolesDisponibles = Array.from(
    new Set([...(catalogos.rolesUsuario || []), ...ROLES_BASE]),
  ).filter(Boolean);
  const talleresDisponibles = obtenerNombresTalleres();

  const manejarCambioPersonal = (evento) => {
    const { name, value } = evento.target;
    setFormularioPersonal((anterior) => ({
      ...anterior,
      [name]: name === "telefono" ? value : value.toUpperCase(),
    }));
  };

  const manejarCambioUsuario = (evento) => {
    const { name, value } = evento.target;
    setFormularioUsuario((anterior) => ({
      ...anterior,
      [name]:
        name === "correo"
          ? value.trim().toLowerCase()
          : name === "passwordTemporal"
            ? value
            : value.toUpperCase(),
    }));
  };

  const aplicarRolSugerido = (rol) => {
    const sugerido = obtenerAccesoSugeridoPorRol(rol);
    setFormularioUsuario((anterior) => ({
      ...anterior,
      rol,
      modulos: [...sugerido.modulos],
      submodulos: { ...sugerido.submodulos },
    }));
  };

  const alternarModulo = (modulo) => {
    setFormularioUsuario((anterior) => {
      const existe = (anterior.modulos || []).includes(modulo);
      const siguientesModulos = existe
        ? (anterior.modulos || []).filter((item) => item !== modulo)
        : [...(anterior.modulos || []), modulo];

      const siguientesSubmodulos = { ...(anterior.submodulos || {}) };
      if (existe) {
        delete siguientesSubmodulos[modulo];
      } else {
        const base = ACCESOS_SISTEMA.find((item) => item.modulo === modulo);
        siguientesSubmodulos[modulo] = [...(base?.submodulos || [])];
      }

      return {
        ...anterior,
        modulos: siguientesModulos,
        submodulos: siguientesSubmodulos,
      };
    });
  };

  const alternarSubmodulo = (modulo, submodulo) => {
    setFormularioUsuario((anterior) => {
      const actuales = anterior.submodulos?.[modulo] || [];
      const existe = actuales.includes(submodulo);
      return {
        ...anterior,
        submodulos: {
          ...(anterior.submodulos || {}),
          [modulo]: existe
            ? actuales.filter((item) => item !== submodulo)
            : [...actuales, submodulo],
        },
      };
    });
  };

  const guardarFichaPersonal = async () => {
    if (!formularioPersonal.nombreCompleto.trim()) {
      await mostrarAlertaSistema("Completa al menos el nombre del personal.");
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando ficha de personal...",
      mensajeExito: "Ficha guardada. Ya puedes crearle su cuenta del sistema abajo.",
        mensajeError: "No se pudo guardar la ficha de personal.",
        accion: async () => {
          const registro = guardarPersonalSistema(formularioPersonal);
          setPersonal(leerPersonalSistema());
          setFormularioUsuario((anterior) => ({
            ...anterior,
          nombreCompleto: registro?.nombreCompleto || anterior.nombreCompleto,
          area: registro?.area || anterior.area,
          observacion: registro?.observacion || anterior.observacion,
        }));
        setFormularioPersonal(crearFichaPersonalVacia());
        setTimeout(() => {
          cuentaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 160);
      },
    });
  };

  const recargarUsuarios = async () => {
    const lista = await listarUsuariosSistemaConfiguracion();
    setUsuarios(lista);
  };

  const guardarCuentaUsuario = async () => {
    if (!formularioUsuario.correo.trim()) {
      await mostrarAlertaSistema("Completa el correo del usuario.");
      return;
    }

    setGuardandoUsuario(true);
    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Guardando cuenta del sistema...",
        mensajeExito: "Cuenta del sistema guardada en la base.",
        mensajeError: "No se pudo guardar la cuenta del sistema.",
        accion: async () => {
          await guardarUsuarioSistemaConfiguracion(formularioUsuario);
          await recargarUsuarios();
          setFormularioUsuario(crearUsuarioSistemaVacio());
        },
      });
    } catch (error) {
      console.error("No se pudo guardar el usuario:", error.message);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const crearAccesoTemporalUsuario = async () => {
    if (!formularioUsuario.correo.trim()) {
      await mostrarAlertaSistema("Completa el correo del usuario.");
      return;
    }

    if (!formularioUsuario.nombreCompleto.trim()) {
      await mostrarAlertaSistema("Completa el nombre visible del usuario.");
      return;
    }

    if ((formularioUsuario.passwordTemporal || "").trim().length < 6) {
      await mostrarAlertaSistema(
        "Escribe una contrasena temporal de al menos 6 caracteres."
      );
      return;
    }

    setGuardandoUsuario(true);
    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Creando acceso temporal del usuario...",
        mensajeExito: "Acceso temporal creado o reasignado correctamente.",
        mensajeError: "No se pudo crear el acceso temporal del usuario.",
        accion: async () => {
          await crearAccesoTemporalUsuarioConfiguracion(formularioUsuario);
          await recargarUsuarios();
          setFormularioUsuario((anterior) => ({
            ...anterior,
            passwordTemporal: "",
          }));
        },
      });
    } catch (error) {
      console.error("No se pudo crear el acceso temporal:", error.message);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const cargarPersonal = (item) => {
    setFormularioPersonal({
      nombreCompleto: item.nombreCompleto || "",
      telefono: item.telefono || "",
      area: item.area || "",
      cargo: item.cargo || "",
      sede: item.sede || "PRINCIPAL",
      estado: item.estado || "ACTIVO",
      observacion: item.observacion || "",
    });
  };

  const prepararCuentaDesdePersonal = (item) => {
    if (!item) return;
    setFormularioUsuario((anterior) => ({
      ...anterior,
      nombreCompleto: item.nombreCompleto || anterior.nombreCompleto,
      area: item.area || anterior.area,
      observacion: item.observacion || anterior.observacion,
    }));
    setTimeout(() => {
      cuentaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const cargarUsuario = (item) => {
    if (!item) return;
    setFormularioUsuario({
      correo: item.correo || "",
      nombreCompleto: item.nombreCompleto || "",
      passwordTemporal: "",
      rol: item.rol || "PRODUCCION",
      area: item.area || "PRODUCCION",
      estado: item.estado || "ACTIVO",
      modulos: [...(item.modulos || [])],
      submodulos: { ...(item.submodulos || {}) },
      tallerAsignado: item.tallerAsignado || "",
      observacion: item.observacion || "",
    });
  };

  const prepararAccesoUsuario = (item) => {
    if (!item) return;
    cargarUsuario(item);
    setFormularioUsuario((anterior) => ({
      ...anterior,
      passwordTemporal: "",
    }));
    setTimeout(() => {
      cuentaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const quitarPersonal = async (nombreCompleto) => {
    const confirmar = await confirmarAccionSistema(
      "Seguro que deseas quitar esta ficha de personal?",
      { titulo: "Quitar ficha de personal", confirmarTexto: "Quitar" }
    );
    if (!confirmar) return;
    eliminarPersonalSistema(nombreCompleto);
    setPersonal(leerPersonalSistema());
    if (formularioPersonal.nombreCompleto === nombreCompleto) {
      setFormularioPersonal(crearFichaPersonalVacia());
    }
  };

  const cambiarEstadoUsuario = async (item) => {
    if (!item?.correo) return;

    const estaBloqueado = item.estado === "BLOQUEADO";
    const confirmar = await confirmarAccionSistema(
      estaBloqueado
        ? `Seguro que deseas reactivar la cuenta ${item.correo}?`
        : `Seguro que deseas bloquear la cuenta ${item.correo}?`,
      {
        titulo: estaBloqueado ? "Reactivar cuenta" : "Bloquear cuenta",
        confirmarTexto: estaBloqueado ? "Reactivar" : "Bloquear",
      }
    );
    if (!confirmar) return;

    try {
      setGuardandoUsuario(true);
      if (estaBloqueado) {
        await activarUsuarioSistemaConfiguracion(item.correo);
      } else {
        await bloquearUsuarioSistemaConfiguracion(item.correo);
      }
      await recargarUsuarios();
      if (formularioUsuario.correo === item.correo) {
        setFormularioUsuario((anterior) => ({
          ...anterior,
          estado: estaBloqueado ? "ACTIVO" : "BLOQUEADO",
        }));
      }
    } catch (error) {
      mostrarErrorSistema(`No se pudo actualizar el estado del usuario: ${error.message}`);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const borrarUsuario = async (item) => {
    if (!item?.correo) return;
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas borrar del sistema la cuenta ${item.correo}? Esta accion quitara su acceso a la app.`,
      { titulo: "Borrar cuenta", icono: "warning", confirmarTexto: "Borrar" }
    );
    if (!confirmar) return;

    try {
      setGuardandoUsuario(true);
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Borrando cuenta del sistema...",
        mensajeExito: "La cuenta se borro del sistema.",
        mensajeError: "No se pudo borrar la cuenta del sistema.",
        accion: async () => {
          setUsuarios((anterior) =>
            anterior.filter(
              (usuario) =>
                (usuario?.correo || "").toString().trim().toLowerCase() !==
                (item.correo || "").toString().trim().toLowerCase(),
            ),
          );
          await eliminarUsuarioSistemaConfiguracion(item.correo);
          await recargarUsuarios();
          if (formularioUsuario.correo === item.correo) {
            setFormularioUsuario(crearUsuarioSistemaVacio());
          }
        },
      });
    } catch (error) {
      console.error("No se pudo borrar la cuenta:", error.message);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const restablecerPasswordTemporal = async (item) => {
    if (!item?.correo) return;
    const confirmar = await confirmarAccionSistema(
      `Se generara una nueva contrasena temporal para ${item.correo}. Deseas continuar?`,
      { titulo: "Restablecer contrasena temporal", confirmarTexto: "Generar" }
    );
    if (!confirmar) return;

    try {
      setGuardandoUsuario(true);
      const respuesta = await restablecerPasswordTemporalUsuarioConfiguracion(item.correo);
      await mostrarAlertaSistema(
        `Contrasena temporal generada para ${respuesta.correo}:\n\n${respuesta.passwordTemporal}\n\nGuardala o compartela ahora. Luego ya no se podra volver a ver.`,
        {
          titulo: "Contrasena temporal generada",
          icono: "success",
          confirmarTexto: "Entendido",
        }
      );
    } catch (error) {
      mostrarErrorSistema(`No se pudo restablecer la contrasena temporal: ${error.message}`);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const restaurarSincronizacion = () => {
    ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Sincronizando catalogos y asignaciones...",
      mensajeExito: "Catalogos y asignaciones sincronizados otra vez.",
        mensajeError: "No se pudo completar la sincronizacion de catalogos.",
        accion: async () => {
          sincronizarCatalogosPersonalSeguridad();
          setPersonal(leerPersonalSistema());
          await recargarUsuarios();
        },
    }).catch((error) =>
      mostrarErrorSistema(`Se sincronizaron los catalogos, pero fallo usuarios: ${error.message}`),
    );
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
          <h1>Personal y seguridad</h1>
          <p>
            Aqui ya no solo guardamos nombres: ahora puedes registrar la ficha del
            personal y administrar desde aqui las cuentas reales del sistema.
          </p>
        </div>
      </section>

      <main className="contenido">
        {!puedeAdministrarSeguridad ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Acceso restringido</h2>
                <p>
                  Este submodulo solo esta disponible para Gerencia y Recursos Humanos.
                  Si necesitas crear cuentas o recuperar accesos, entra con uno de esos
                  roles autorizados.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
        <section className="tarjeta" ref={cuentaSectionRef}>
          <div className="tarjeta__encabezado">
            <div>
              <h2>Ficha de personal</h2>
              <p>
                Esta ficha identifica a la persona real. Luego, si esa persona usa el
                sistema, se le vincula abajo con sus permisos propios.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Nombre completo</label>
              <input
                type="text"
                name="nombreCompleto"
                value={formularioPersonal.nombreCompleto}
                onChange={manejarCambioPersonal}
              />
            </Campo>
            <Campo>
              <label>Telefono</label>
              <input
                type="text"
                name="telefono"
                value={formularioPersonal.telefono}
                onChange={manejarCambioPersonal}
              />
            </Campo>
            <Campo>
              <label>Area</label>
              <input
                type="text"
                list="areas-personal-sistema"
                name="area"
                value={formularioPersonal.area}
                onChange={manejarCambioPersonal}
              />
              <datalist id="areas-personal-sistema">
                {(catalogos.areasPersonal || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Cargo</label>
              <input
                type="text"
                list="cargos-personal-sistema"
                name="cargo"
                value={formularioPersonal.cargo}
                onChange={manejarCambioPersonal}
              />
              <datalist id="cargos-personal-sistema">
                {(catalogos.cargosPersonal || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Sede</label>
              <input
                type="text"
                name="sede"
                value={formularioPersonal.sede}
                onChange={manejarCambioPersonal}
              />
            </Campo>
            <Campo>
              <label>Estado</label>
              <select
                name="estado"
                value={formularioPersonal.estado}
                onChange={manejarCambioPersonal}
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="PAUSADO">PAUSADO</option>
              </select>
            </Campo>
            <Campo className="campo_completo">
              <label>Observacion</label>
              <textarea
                name="observacion"
                value={formularioPersonal.observacion}
                onChange={manejarCambioPersonal}
              />
            </Campo>
          </div>

          <div className="acciones">
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() => setFormularioPersonal(crearFichaPersonalVacia())}
            >
              Limpiar
            </button>
            <button type="button" className="btn btn_principal" onClick={guardarFichaPersonal}>
              Guardar personal
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Cuenta del sistema</h2>
              <p>
                Aqui defines que usuario puede entrar, que rol tiene y exactamente a
                que modulos y submodulos puede acceder. Guardar usuario solo registra
                la cuenta en la base. Para que ya pueda entrar al login, luego debes
                usar Crear acceso.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Correo</label>
              <input
                type="email"
                name="correo"
                value={formularioUsuario.correo}
                onChange={manejarCambioUsuario}
              />
            </Campo>
            <Campo>
              <label>Nombre visible</label>
              <input
                type="text"
                list="personal-registrado-sistema"
                name="nombreCompleto"
                value={formularioUsuario.nombreCompleto}
                onChange={manejarCambioUsuario}
              />
              <datalist id="personal-registrado-sistema">
                {personal.map((item) => (
                  <option key={item.nombreCompleto} value={item.nombreCompleto} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Contrasena inicial</label>
              <input
                type="text"
                name="passwordTemporal"
                value={formularioUsuario.passwordTemporal}
                onChange={manejarCambioUsuario}
                placeholder="La defines tu para el primer ingreso"
              />
            </Campo>
            <Campo>
              <label>Rol</label>
              <select
                name="rol"
                value={formularioUsuario.rol}
                onChange={(evento) =>
                  aplicarRolSugerido(normalizarTexto(evento.target.value))
                }
              >
                {rolesDisponibles.map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo>
              <label>Area</label>
              <input
                type="text"
                name="area"
                value={formularioUsuario.area}
                onChange={manejarCambioUsuario}
              />
            </Campo>
            <Campo>
              <label>Estado</label>
              <select
                name="estado"
                value={formularioUsuario.estado}
                onChange={manejarCambioUsuario}
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="BLOQUEADO">BLOQUEADO</option>
              </select>
            </Campo>
            <Campo>
              <label>Taller asignado</label>
              <select
                name="tallerAsignado"
                value={formularioUsuario.tallerAsignado}
                onChange={manejarCambioUsuario}
              >
                <option value="">SIN TALLER</option>
                {talleresDisponibles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo className="campo_completo">
              <label>Observacion</label>
              <textarea
                name="observacion"
                value={formularioUsuario.observacion}
                onChange={manejarCambioUsuario}
              />
            </Campo>
          </div>

          <div className="permisos_panel">
            {ACCESOS_SISTEMA.map((item) => {
              const moduloActivo = (formularioUsuario.modulos || []).includes(item.modulo);
              const submodulosActivos = formularioUsuario.submodulos?.[item.modulo] || [];
              return (
                <article key={item.modulo} className="permiso_card">
                  <label className="check_principal">
                    <input
                      type="checkbox"
                      checked={moduloActivo}
                      onChange={() => alternarModulo(item.modulo)}
                    />
                    <span>{item.modulo}</span>
                  </label>

                  <div className="submodulos_grid">
                    {item.submodulos.map((submodulo) => (
                      <label
                        key={submodulo}
                        className={`check_secundario ${
                          !moduloActivo ? "check_secundario_bloqueado" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!moduloActivo}
                          checked={submodulosActivos.includes(submodulo)}
                          onChange={() => alternarSubmodulo(item.modulo, submodulo)}
                        />
                        <span>{submodulo}</span>
                      </label>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="acciones">
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() => setFormularioUsuario(crearUsuarioSistemaVacio())}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="btn btn_principal"
              onClick={guardarCuentaUsuario}
              disabled={guardandoUsuario}
            >
              {guardandoUsuario ? "Guardando..." : "Guardar usuario sin acceso"}
            </button>
            <button
              type="button"
              className="btn btn_secundario"
              onClick={crearAccesoTemporalUsuario}
              disabled={guardandoUsuario}
            >
              {guardandoUsuario ? "Procesando..." : "Crear acceso"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Personal registrado</h2>
              <p>
                Aqui puedes volver a cargar una persona si cambia de area, cargo,
                telefono o estado.
              </p>
            </div>
          </div>

          <div className="grid_historial">
            {personal.length === 0 ? (
              <div className="item_vacio">Todavia no hay personal registrado.</div>
            ) : (
              personal.map((item) => (
                <article key={item.nombreCompleto} className="historial_card">
                  <strong>{item.nombreCompleto}</strong>
                  <p>
                    {item.area || "-"} · {item.cargo || "-"}
                  </p>
                  <small>{item.telefono || "-"}</small>
                  <div className="historial_acciones">
                    <button
                      type="button"
                      className="btn btn_principal"
                      onClick={() => cargarPersonal(item)}
                    >
                      Cargar
                    </button>
                    <button
                      type="button"
                      className="btn btn_secundario"
                      onClick={() => prepararCuentaDesdePersonal(item)}
                    >
                      Crear cuenta
                    </button>
                    <button
                      type="button"
                      className="btn btn_secundario"
                      onClick={() => quitarPersonal(item.nombreCompleto)}
                    >
                      Quitar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Usuarios del sistema</h2>
              <p>
                Esta lista ya muestra las cuentas reales de la base, su rol, estado y
                si una cuenta de taller quedo amarrada a su taller correspondiente.
              </p>
            </div>
          </div>

          <div className="grid_historial">
            {cargandoUsuarios ? (
              <div className="item_vacio">Cargando usuarios de la base...</div>
            ) : usuarios.length === 0 ? (
              <div className="item_vacio">Todavia no hay usuarios del sistema registrados.</div>
            ) : (
              usuarios.map((item) => (
                <article key={item.correo} className="historial_card">
                  <strong>{item.correo}</strong>
                  <p>
                    {item.rol || "-"} · {item.area || "-"}
                  </p>
                  {item.rol === "TALLER" ? <small>Cuenta externa de taller</small> : null}
                  <span
                    className={`estado_acceso ${
                      item.accesoSistemaCreado ? "estado_acceso_ok" : "estado_acceso_pendiente"
                    }`}
                  >
                    {item.accesoSistemaCreado
                      ? "ACCESO CREADO"
                      : "FALTA CREAR ACCESO"}
                  </span>
                  <small>
                    {item.estado || "-"}
                    {item.tallerAsignado ? ` · ${item.tallerAsignado}` : ""}
                  </small>
                  <div className="historial_acciones">
                    <button
                      type="button"
                      className="btn btn_principal"
                      onClick={() => cargarUsuario(item)}
                    >
                      Cargar
                    </button>
                    <button
                      type="button"
                      className="btn btn_secundario"
                      onClick={() => cambiarEstadoUsuario(item)}
                    >
                      {item.estado === "BLOQUEADO" ? "Reactivar" : "Bloquear"}
                    </button>
                    {!item.accesoSistemaCreado ? (
                      <button
                        type="button"
                        className="btn btn_secundario"
                        onClick={() => prepararAccesoUsuario(item)}
                      >
                        Crear acceso ahora
                      </button>
                    ) : null}
                    {puedeRestablecerPassword ? (
                      <button
                        type="button"
                        className="btn btn_secundario"
                        onClick={() => restablecerPasswordTemporal(item)}
                      >
                        Reset temporal
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn_secundario"
                      onClick={() => borrarUsuario(item)}
                    >
                      Borrar cuenta
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="acciones acciones_finales">
          <Link to="/configurar" className="btn btn_secundario btn_enlace">
            Volver a Configuracion
          </Link>
          <button
            type="button"
            className="btn btn_secundario"
            onClick={restaurarSincronizacion}
          >
            Sincronizar catalogos
          </button>
        </section>
          </>
        )}
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
      linear-gradient(135deg, var(--modulo-fondo, rgba(124, 58, 237, 0.12)) 0%, ${({ theme }) => theme.bgcards} 100%);
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .item_vacio {
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

  .permisos_panel {
    display: grid;
    gap: 14px;
    margin-top: 16px;
  }

  .permiso_card {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 14px;
    background:
      linear-gradient(180deg, ${({ theme }) => theme.bg} 0%, ${({ theme }) => theme.bgcards} 100%);
    display: grid;
    gap: 12px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  }

  .check_principal,
  .check_secundario {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
  }

  .submodulos_grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }

  .check_secundario {
    font-weight: 500;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
  }

  .check_secundario_bloqueado {
    opacity: 0.55;
  }

  .grid_historial {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 14px;
  }

  .historial_card {
    display: grid;
    gap: 8px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 14px;
    background:
      linear-gradient(180deg, ${({ theme }) => theme.bg} 0%, ${({ theme }) => theme.bgcards} 100%);
  }

  .historial_card small {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .estado_acceso {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .estado_acceso_ok {
    background: rgba(34, 197, 94, 0.16);
    color: #166534;
    border: 1px solid rgba(34, 197, 94, 0.32);
  }

  .estado_acceso_pendiente {
    background: rgba(245, 158, 11, 0.16);
    color: #92400e;
    border: 1px solid rgba(245, 158, 11, 0.32);
  }

  .acciones,
  .historial_acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .acciones_finales {
    margin-top: 0;
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
    .historial_acciones {
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
    border: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
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
