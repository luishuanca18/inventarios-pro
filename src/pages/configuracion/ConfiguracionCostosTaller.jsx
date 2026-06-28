import { useEffect, useMemo, useState } from "react";
import { Header } from "../../index";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  crearFormularioCostoTaller,
  leerCostosTallerModelo,
  normalizarTextoCosto,
} from "../../utils/costosTaller";
import {
  eliminarCostoTallerConfiguracion,
  guardarCostoTallerConfiguracion,
  listarCostosTallerConfiguracion,
  listarModelosProductoConfiguracion,
  listarTalleresConfiguracion,
} from "../../supabase/configuracionCore";
import styled from "styled-components";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";

const formatearMonto = (valor) =>
  `S/ ${Number(valor || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function ConfiguracionCostosTaller() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Costos y Finanzas");
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(crearFormularioCostoTaller);
  const [listaCostos, setListaCostos] = useState(() => leerCostosTallerModelo());
  const [modelosCatalogo, setModelosCatalogo] = useState([]);
  const [talleres, setTalleres] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const recargarDatos = async () => {
    const [costos, modelos, talleresCargados] = await Promise.all([
      listarCostosTallerConfiguracion(),
      listarModelosProductoConfiguracion(),
      listarTalleresConfiguracion(),
    ]);

    setListaCostos(costos);
    setModelosCatalogo(modelos);
    setTalleres(talleresCargados.filter((item) => item?.estado !== "INACTIVO"));
  };

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const [costos, modelos, talleresCargados] = await Promise.all([
          listarCostosTallerConfiguracion(),
          listarModelosProductoConfiguracion(),
          listarTalleresConfiguracion(),
        ]);
        if (!activo) return;
        setListaCostos(costos);
        setModelosCatalogo(modelos);
        setTalleres(talleresCargados.filter((item) => item?.estado !== "INACTIVO"));
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  const modelosDisponibles = useMemo(
    () =>
      (modelosCatalogo || []).map((item) => ({
        id: item?.id || "",
        modelo: item?.nombreModelo || "",
        codigoModelo: item?.codigoModelo || "",
        codigoCorto: item?.codigoCorto || "",
      })),
    [modelosCatalogo]
  );

  const listaFiltrada = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return listaCostos;

    return listaCostos.filter((item) =>
      [item?.codigoModelo, item?.modelo, item?.nombreTaller, item?.observacion]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, listaCostos]);

  const actualizarCampo = (campo, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]:
        campo === "modelo" || campo === "codigoModelo" || campo === "nombreTaller"
          ? valor.toUpperCase()
          : valor,
    }));
  };

  const manejarSeleccionModelo = (valor) => {
    const texto = normalizarTextoCosto(valor);
    const encontrado =
      modelosDisponibles.find(
        (item) =>
          normalizarTextoCosto(item?.modelo) === texto ||
          normalizarTextoCosto(item?.codigoModelo) === texto ||
          normalizarTextoCosto(item?.codigoCorto) === texto
      ) || null;

    setFormulario((anterior) => ({
      ...anterior,
      modelo: encontrado?.modelo || valor.toUpperCase(),
      codigoModelo: encontrado?.codigoModelo || anterior.codigoModelo || "",
    }));
  };

  const limpiarFormulario = () => setFormulario(crearFormularioCostoTaller());

  const guardarRegistro = async () => {
    if (!formulario.modelo.trim()) {
      await mostrarAlertaSistema("Selecciona un modelo para registrar el costo.");
      return;
    }

    if (Number(formulario.costoUnitario || 0) <= 0) {
      await mostrarAlertaSistema("Escribe un costo unitario mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Guardando costo por prenda...",
        mensajeExito: "Costo por prenda guardado.",
        mensajeError: "No se pudo guardar el costo por prenda.",
        accion: async () => {
          await guardarCostoTallerConfiguracion(formulario);
          await recargarDatos();
          limpiarFormulario();
        },
      });
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar el costo: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cargarRegistro = (item) => {
    setFormulario({
      id: item?.id || "",
      modelo: item?.modelo || "",
      codigoModelo: item?.codigoModelo || "",
      nombreTaller: item?.nombreTaller || "",
      costoUnitario: String(item?.costoUnitario || ""),
      moneda: item?.moneda || "PEN",
      observacion: item?.observacion || "",
      estado: item?.estado || "ACTIVO",
    });
    mostrarNotificacionCarga("Costo cargado correctamente.");
  };

  const quitarRegistro = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas quitar el costo de ${item?.modelo || "este modelo"}${
        item?.nombreTaller ? ` para ${item.nombreTaller}` : ""
      }?`
    );

    if (!confirmar) return;

    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Eliminando costo por prenda...",
        mensajeExito: "Costo eliminado.",
        mensajeError: "No se pudo eliminar el costo por prenda.",
        accion: async () => {
          await eliminarCostoTallerConfiguracion({
            codigoModelo: item?.codigoModelo || "",
            nombreTaller: item?.nombreTaller || "",
          });
          await recargarDatos();
        },
      });
    } catch (error) {
      mostrarErrorSistema(`No se pudo eliminar el costo: ${error.message}`);
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
          <h1>Pago por prenda a taller</h1>
          <p>
            Aqui defines cuanto se paga por modelo. Si un taller cobra distinto,
            puedes guardarlo con su nombre y tendra prioridad sobre el costo general.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Registrar costo</h2>
              <p>
                Si dejas el taller vacio, el costo queda como tarifa general del modelo.
              </p>
            </div>
          </div>

          <div className="grid grid-2">
            <Campo>
              <label>Modelo</label>
              <input
                type="text"
                list="lista-modelos-costo-taller"
                value={formulario.modelo}
                onChange={(e) => manejarSeleccionModelo(e.target.value)}
                placeholder=""
              />
              <datalist id="lista-modelos-costo-taller">
                {modelosDisponibles.map((item) => (
                  <option
                    key={item.id || item.codigoModelo || item.modelo}
                    value={item.modelo}
                  >
                    {item.codigoModelo}
                  </option>
                ))}
              </datalist>
            </Campo>

            <Campo>
              <label>Codigo maestro</label>
              <input
                type="text"
                value={formulario.codigoModelo}
                onChange={(e) => actualizarCampo("codigoModelo", e.target.value)}
                placeholder=""
              />
            </Campo>

            <Campo>
              <label>Taller especifico</label>
              <select
                value={formulario.nombreTaller}
                onChange={(e) => actualizarCampo("nombreTaller", e.target.value)}
              >
                <option value="">GENERAL PARA TODOS</option>
                {talleres.map((taller) => (
                  <option key={taller.id || taller.codigoTaller || taller.nombreTaller} value={taller.nombreTaller}>
                    {taller.codigoTaller ? `${taller.codigoTaller} | ` : ""}
                    {taller.nombreTaller}
                  </option>
                ))}
              </select>
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
              <label>Costo unitario</label>
              <input
                type="number"
                step="0.01"
                value={formulario.costoUnitario}
                onChange={(e) => actualizarCampo("costoUnitario", e.target.value)}
                placeholder=""
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
              {guardando ? "Guardando..." : "Guardar costo"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Tarifario de taller</h2>
              <p>
                Aqui aparece el costo general por modelo y, si existe, la tarifa especial por taller.
              </p>
            </div>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por codigo, modelo, taller u observacion"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo maestro</th>
                  <th>Modelo</th>
                  <th>Taller</th>
                  <th>Costo unitario</th>
                  <th>Moneda</th>
                  <th>Estado</th>
                  <th>Observacion</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="8" className="sin_datos">Cargando costos...</td>
                  </tr>
                ) : listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="sin_datos">Todavia no hay costos registrados.</td>
                  </tr>
                ) : (
                  listaFiltrada.map((item) => (
                    <tr key={`${item.codigoModelo}-${item.nombreTaller || "GENERAL"}`}>
                      <td>{item.codigoModelo || "-"}</td>
                      <td>{item.modelo || "-"}</td>
                      <td>{item.nombreTaller || "GENERAL"}</td>
                      <td>{formatearMonto(item.costoUnitario)}</td>
                      <td>{item.moneda || "PEN"}</td>
                      <td>{item.estado || "-"}</td>
                      <td>{item.observacion || "-"}</td>
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
