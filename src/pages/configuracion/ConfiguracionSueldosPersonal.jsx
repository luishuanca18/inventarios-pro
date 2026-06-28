import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Header } from "../../index";
import {
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  crearFormularioSueldoPersonal,
  leerSueldosPersonal,
} from "../../utils/sueldosPersonal";
import { leerPersonalSistema } from "../../utils/seguridadUsuarios";
import {
  eliminarSueldoPersonalConfiguracion,
  guardarSueldoPersonalConfiguracion,
  listarSueldosPersonalConfiguracion,
  listarUsuariosSistemaConfiguracion,
} from "../../supabase/configuracionCore";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";

const formatearMonto = (valor) =>
  `S/ ${Number(valor || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function ConfiguracionSueldosPersonal() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Costos y Finanzas");
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(crearFormularioSueldoPersonal);
  const [listaSueldos, setListaSueldos] = useState(() => leerSueldosPersonal());
  const [opcionesPersonal, setOpcionesPersonal] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const recargarDatos = async () => {
    const [sueldos, usuarios] = await Promise.all([
      listarSueldosPersonalConfiguracion(),
      listarUsuariosSistemaConfiguracion(),
    ]);

    const personalLocal = leerPersonalSistema();
    const sugerencias = [
      ...usuarios.map((item) => ({
        correo: item?.correo || "",
        nombrePersonal: item?.nombreCompleto || "",
        cargo: item?.rol || "",
        area: item?.area || "",
      })),
      ...personalLocal.map((item) => ({
        correo: "",
        nombrePersonal: item?.nombreCompleto || "",
        cargo: item?.cargo || "",
        area: item?.area || "",
      })),
    ];

    setListaSueldos(sueldos);
    setOpcionesPersonal(
      sugerencias.filter(
        (item, indice, lista) =>
          item?.nombrePersonal &&
          lista.findIndex(
            (comparar) =>
              comparar?.nombrePersonal === item?.nombrePersonal &&
              comparar?.correo === item?.correo
          ) === indice
      )
    );
  };

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const [sueldos, usuarios] = await Promise.all([
          listarSueldosPersonalConfiguracion(),
          listarUsuariosSistemaConfiguracion(),
        ]);
        const personalLocal = leerPersonalSistema();
        if (!activo) return;
        setListaSueldos(sueldos);
        setOpcionesPersonal(
          [
            ...usuarios.map((item) => ({
              correo: item?.correo || "",
              nombrePersonal: item?.nombreCompleto || "",
              cargo: item?.rol || "",
              area: item?.area || "",
            })),
            ...personalLocal.map((item) => ({
              correo: "",
              nombrePersonal: item?.nombreCompleto || "",
              cargo: item?.cargo || "",
              area: item?.area || "",
            })),
          ].filter(
            (item, indice, lista) =>
              item?.nombrePersonal &&
              lista.findIndex(
                (comparar) =>
                  comparar?.nombrePersonal === item?.nombrePersonal &&
                  comparar?.correo === item?.correo
              ) === indice
          )
        );
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  const listaFiltrada = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return listaSueldos;

    return listaSueldos.filter((item) =>
      [item?.nombrePersonal, item?.correo, item?.cargo, item?.area, item?.observacion]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, listaSueldos]);

  const actualizarCampo = (campo, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]:
        campo === "nombrePersonal" || campo === "cargo" || campo === "area"
          ? valor.toUpperCase()
          : valor,
    }));
  };

  const seleccionarPersonal = (valor) => {
    const encontrado =
      opcionesPersonal.find(
        (item) =>
          String(item?.nombrePersonal || "").toUpperCase() === valueToUpper(valor) ||
          String(item?.correo || "").toLowerCase() === String(valor || "").toLowerCase()
      ) || null;

    setFormulario((anterior) => ({
      ...anterior,
      correo: encontrado?.correo || anterior.correo || "",
      nombrePersonal: encontrado?.nombrePersonal || valor.toUpperCase(),
      cargo: encontrado?.cargo || anterior.cargo || "",
      area: encontrado?.area || anterior.area || "",
      clave:
        encontrado?.correo ||
        encontrado?.nombrePersonal ||
        valor.toUpperCase(),
    }));
  };

  const limpiarFormulario = () => setFormulario(crearFormularioSueldoPersonal());

  const guardarRegistro = async () => {
    if (!formulario.nombrePersonal.trim()) {
      mostrarAlertaSistema("Selecciona o escribe el nombre del personal.");
      return;
    }

    if (Number(formulario.sueldoMensual || 0) <= 0) {
      mostrarAlertaSistema("Escribe un sueldo mensual mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      await guardarSueldoPersonalConfiguracion({
        ...formulario,
        clave: formulario.clave || formulario.correo || formulario.nombrePersonal,
      });
      await recargarDatos();
      limpiarFormulario();
      mostrarNotificacionCarga("Sueldo mensual guardado.");
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar el sueldo: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cargarRegistro = (item) => {
    setFormulario({
      id: item?.id || "",
      clave: item?.clave || "",
      correo: item?.correo || "",
      nombrePersonal: item?.nombrePersonal || "",
      cargo: item?.cargo || "",
      area: item?.area || "",
      sueldoMensual: String(item?.sueldoMensual || ""),
      moneda: item?.moneda || "PEN",
      fechaInicio: item?.fechaInicio || "",
      estado: item?.estado || "ACTIVO",
      observacion: item?.observacion || "",
    });
    mostrarNotificacionCarga("Sueldo cargado correctamente.");
  };

  const quitarRegistro = async (item) => {
    try {
      await eliminarSueldoPersonalConfiguracion(item?.clave || "");
      await recargarDatos();
      mostrarNotificacionCarga("Sueldo eliminado.");
    } catch (error) {
      mostrarErrorSistema(`No se pudo eliminar el sueldo: ${error.message}`);
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
          <h1>Sueldos del personal</h1>
          <p>
            Aqui dejas el sueldo mensual del personal interno para que mas adelante
            la parte de costos y reportes pueda trabajar con una base real.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Registrar sueldo</h2>
              <p>
                Puedes escoger a una persona ya registrada o escribirla manualmente si
                todavia no tiene cuenta del sistema.
              </p>
            </div>
          </div>

          <div className="grid grid-2">
            <Campo>
              <label>Personal</label>
              <input
                type="text"
                list="lista-personal-sueldo"
                value={formulario.nombrePersonal}
                onChange={(e) => seleccionarPersonal(e.target.value)}
                placeholder=""
              />
              <datalist id="lista-personal-sueldo">
                {opcionesPersonal.map((item) => (
                  <option
                    key={`${item.correo}-${item.nombrePersonal}`}
                    value={item.nombrePersonal}
                  />
                ))}
              </datalist>
            </Campo>

            <Campo>
              <label>Correo</label>
              <input
                type="text"
                value={formulario.correo}
                onChange={(e) => actualizarCampo("correo", e.target.value)}
                placeholder=""
              />
            </Campo>

            <Campo>
              <label>Cargo</label>
              <input
                type="text"
                value={formulario.cargo}
                onChange={(e) => actualizarCampo("cargo", e.target.value)}
                placeholder=""
              />
            </Campo>

            <Campo>
              <label>Area</label>
              <input
                type="text"
                value={formulario.area}
                onChange={(e) => actualizarCampo("area", e.target.value)}
                placeholder=""
              />
            </Campo>

            <Campo>
              <label>Sueldo mensual</label>
              <input
                type="number"
                step="0.01"
                value={formulario.sueldoMensual}
                onChange={(e) => actualizarCampo("sueldoMensual", e.target.value)}
                placeholder=""
              />
            </Campo>

            <Campo>
              <label>Moneda</label>
              <select
                value={formulario.moneda}
                onChange={(e) => actualizarCampo("moneda", e.target.value)}
              >
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </Campo>

            <Campo>
              <label>Fecha de inicio</label>
              <input
                type="date"
                value={formulario.fechaInicio}
                onChange={(e) => actualizarCampo("fechaInicio", e.target.value)}
              />
            </Campo>

            <Campo>
              <label>Estado</label>
              <select
                value={formulario.estado}
                onChange={(e) => actualizarCampo("estado", e.target.value)}
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </Campo>

            <Campo className="campo-completo">
              <label>Observacion</label>
              <input
                type="text"
                value={formulario.observacion}
                onChange={(e) => actualizarCampo("observacion", e.target.value)}
                placeholder=""
              />
            </Campo>
          </div>

          <div className="acciones">
            <button type="button" className="btn btn_secundario" onClick={limpiarFormulario}>
              Limpiar
            </button>
            <button type="button" className="btn btn_principal" onClick={guardarRegistro}>
              {guardando ? "Guardando..." : "Guardar sueldo"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Sueldos registrados</h2>
              <p>Aqui puedes revisar o corregir la base mensual del personal.</p>
            </div>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, correo, cargo, area u observacion"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Personal</th>
                  <th>Correo</th>
                  <th>Cargo</th>
                  <th>Area</th>
                  <th>Sueldo</th>
                  <th>Moneda</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="8" className="sin_datos">Cargando sueldos...</td>
                  </tr>
                ) : listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="sin_datos">Todavia no hay sueldos registrados.</td>
                  </tr>
                ) : (
                  listaFiltrada.map((item) => (
                    <tr key={item.id || item.clave}>
                      <td>{item.nombrePersonal || "-"}</td>
                      <td>{item.correo || "-"}</td>
                      <td>{item.cargo || "-"}</td>
                      <td>{item.area || "-"}</td>
                      <td>{formatearMonto(item.sueldoMensual)}</td>
                      <td>{item.moneda || "PEN"}</td>
                      <td>{item.estado || "-"}</td>
                      <td>
                        <div className="acciones_tabla">
                          <button type="button" className="btn_tabla" onClick={() => cargarRegistro(item)}>
                            Cargar
                          </button>
                          <button type="button" className="btn_tabla btn_tabla_peligro" onClick={() => quitarRegistro(item)}>
                            Quitar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const valueToUpper = (valor = "") => valor.toString().trim().toUpperCase();

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
      linear-gradient(135deg, var(--modulo-fondo, rgba(22, 101, 52, 0.12)) 0%, ${({ theme }) => theme.bgcards} 100%);
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

  .contenido {
    display: grid;
    gap: 16px;
  }

  .tarjeta__encabezado {
    margin-bottom: 18px;
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

  .buscador {
    margin-bottom: 16px;
  }

  .buscador input,
  input,
  select {
    width: 100%;
    min-height: 42px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    padding: 0 12px;
    outline: none;
  }

  .tabla_contenedor {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 920px;
  }

  th,
  td {
    text-align: left;
    padding: 12px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg3};
    vertical-align: middle;
  }

  .sin_datos {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 20px;
  }

  .acciones,
  .acciones_tabla {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .acciones {
    margin-top: 16px;
    justify-content: flex-end;
  }

  .btn,
  .btn_tabla {
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn_principal,
  .btn_tabla {
    background-color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #fff;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_tabla_peligro {
    background: rgba(255, 92, 92, 0.12);
    color: #ff9c9c;
    border: 1px solid rgba(255, 92, 92, 0.28);
  }

  @media (max-width: 860px) {
    .grid-2 {
      grid-template-columns: 1fr;
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
`;
