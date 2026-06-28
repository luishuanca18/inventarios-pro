import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Header, leerCatalogosProduccion } from "../../index";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  crearFormularioCostoTercero,
  leerCostosTerceros,
} from "../../utils/costosTerceros";
import {
  eliminarCostoTerceroConfiguracion,
  guardarCostoTerceroConfiguracion,
  listarCostosTercerosConfiguracion,
  listarTalleresConfiguracion,
} from "../../supabase/configuracionCore";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";

const PROCESOS_TERCEROS = ["MULTIAGUJA", "ESTAMPADO", "BORDADO", "LAVADO", "OTRO"];

const formatearMonto = (valor) =>
  `S/ ${Number(valor || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizarEntradaNumerica = (valor = "", { permitirDecimales = false } = {}) => {
  const texto = String(valor ?? "");
  if (!texto) return "";

  return permitirDecimales
    ? texto.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
    : texto.replace(/\D/g, "");
};

export function ConfiguracionCostosTerceros() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Costos y Finanzas");
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(crearFormularioCostoTercero);
  const [listaCostos, setListaCostos] = useState(() => leerCostosTerceros());
  const [talleres, setTalleres] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const catalogos = useMemo(() => leerCatalogosProduccion(), []);

  const recargarDatos = async () => {
    const [costos, talleresCargados] = await Promise.all([
      listarCostosTercerosConfiguracion(),
      listarTalleresConfiguracion(),
    ]);

    setListaCostos(costos);
    setTalleres(talleresCargados.filter((item) => item?.estado !== "INACTIVO"));
  };

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const [costos, talleresCargados] = await Promise.all([
          listarCostosTercerosConfiguracion(),
          listarTalleresConfiguracion(),
        ]);
        if (!activo) return;
        setListaCostos(costos);
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

  const listaFiltrada = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return listaCostos;

    return listaCostos.filter((item) =>
      [item?.proceso, item?.nombreTaller, item?.observacion]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, listaCostos]);

  const procesosDisponibles = useMemo(() => {
    const adicionales = (catalogos?.tiposProcesosTerceros || []).filter(Boolean);
    return Array.from(new Set([...PROCESOS_TERCEROS, ...adicionales]));
  }, [catalogos]);

  const actualizarCampo = (campo, valor) => {
    const valorNormalizado =
      campo === "cantidadAgujas"
        ? normalizarEntradaNumerica(valor)
        : campo === "costoUnitario"
          ? normalizarEntradaNumerica(valor, { permitirDecimales: true })
          : valor;

    setFormulario((anterior) => ({
      ...anterior,
      ...(campo === "proceso" && valorNormalizado !== "MULTIAGUJA" ? { cantidadAgujas: "" } : {}),
      [campo]:
        campo === "proceso" ||
        campo === "nombreTaller" ||
        campo === "moneda" ||
        campo === "estado"
          ? String(valorNormalizado).toUpperCase()
          : valorNormalizado,
    }));
  };

  const limpiarFormulario = () => setFormulario(crearFormularioCostoTercero());

  const guardarRegistro = async () => {
    if (!formulario.proceso.trim()) {
      await mostrarAlertaSistema("Selecciona un proceso para registrar el costo.");
      return;
    }

    if (Number(formulario.costoUnitario || 0) <= 0) {
      await mostrarAlertaSistema("Escribe un costo unitario mayor a cero.");
      return;
    }

    setGuardando(true);
    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Guardando costo de tercero...",
        mensajeExito: "Costo de tercero guardado.",
        mensajeError: "No se pudo guardar el costo de tercero.",
        accion: async () => {
          await guardarCostoTerceroConfiguracion(formulario);
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
      proceso: item?.proceso || "MULTIAGUJA",
      cantidadAgujas: String(item?.cantidadAgujas || ""),
      nombreTaller: item?.nombreTaller || "",
      costoUnitario: String(item?.costoUnitario || ""),
      moneda: item?.moneda || "PEN",
      observacion: item?.observacion || "",
      estado: item?.estado || "ACTIVO",
    });
    mostrarNotificacionCarga("Costo de tercero cargado correctamente.");
  };

  const quitarRegistro = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas quitar el costo de ${item?.proceso || "este proceso"}${
        item?.nombreTaller ? ` para ${item.nombreTaller}` : ""
      }?`
    );

    if (!confirmar) return;

    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Eliminando costo de tercero...",
        mensajeExito: "Costo eliminado.",
        mensajeError: "No se pudo eliminar el costo de tercero.",
        accion: async () => {
          await eliminarCostoTerceroConfiguracion({
            proceso: item?.proceso || "",
            cantidadAgujas: item?.cantidadAgujas || "",
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
          <h1>Costos de terceros</h1>
          <p>
            Aqui defines cuanto cuesta cada proceso tercerizado. Si dejas el taller vacio,
            el costo queda como tarifa general por proceso.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Registrar costo</h2>
              <p>
                Tercerizaciones puede aprender este costo sola, pero aqui tambien puedes sembrarlo
                primero para que salga automatico.
              </p>
            </div>
          </div>

          <div className="grid grid-2">
            <Campo>
              <label>Proceso</label>
              <select
                value={formulario.proceso}
                onChange={(e) => actualizarCampo("proceso", e.target.value)}
              >
                {procesosDisponibles.map((proceso) => (
                  <option key={proceso} value={proceso}>
                    {proceso}
                  </option>
                ))}
              </select>
            </Campo>

            {formulario.proceso === "MULTIAGUJA" ? (
              <Campo>
                <label>Cantidad de agujas</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  value={formulario.cantidadAgujas}
                  onChange={(e) => actualizarCampo("cantidadAgujas", e.target.value)}
                  placeholder=""
                />
              </Campo>
            ) : null}

            <Campo>
              <label>Taller tercero</label>
              <select
                value={formulario.nombreTaller}
                onChange={(e) => actualizarCampo("nombreTaller", e.target.value)}
              >
                <option value="">GENERAL PARA TODOS</option>
                {talleres.map((taller) => (
                  <option
                    key={taller.id || taller.codigoTaller || taller.nombreTaller}
                    value={taller.nombreTaller}
                  >
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
            <button type="button" className="btn btn_principal" onClick={guardarRegistro} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar costo"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Costos registrados</h2>
              <p>
                Aqui aparece el costo general por proceso y, si existe, la tarifa especial por taller.
              </p>
            </div>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por proceso o taller"
            />
          </div>

          {cargando ? (
            <div className="estado_vacio">Cargando costos...</div>
          ) : listaFiltrada.length === 0 ? (
            <div className="estado_vacio">Todavia no hay costos registrados.</div>
          ) : (
            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Proceso</th>
                    <th>Agujas</th>
                    <th>Taller</th>
                    <th>Costo</th>
                    <th>Moneda</th>
                    <th>Estado</th>
                    <th>Observacion</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((item) => (
                    <tr key={`${item.proceso}-${item.cantidadAgujas || "0"}-${item.nombreTaller || "GENERAL"}`}>
                      <td>{item.proceso || "-"}</td>
                      <td>{item.proceso === "MULTIAGUJA" ? item.cantidadAgujas || "-" : "-"}</td>
                      <td>{item.nombreTaller || "GENERAL"}</td>
                      <td>{formatearMonto(item.costoUnitario)}</td>
                      <td>{item.moneda || "PEN"}</td>
                      <td>{item.estado || "ACTIVO"}</td>
                      <td>{item.observacion || "-"}</td>
                      <td className="acciones_tabla">
                        <button type="button" className="btn btn_secundario btn_tabla" onClick={() => cargarRegistro(item)}>
                          Cargar
                        </button>
                        <button type="button" className="btn btn_secundario btn_tabla" onClick={() => quitarRegistro(item)}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 18px;
    flex-wrap: wrap;
  }

  .buscador {
    margin-bottom: 16px;
  }

  .buscador input {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
    text-align: left;
    vertical-align: top;
  }

  th {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .acciones_tabla {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .estado_vacio {
    color: ${({ theme }) => theme.colorSubtitle};
    text-align: center;
    padding: 20px 0;
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
    padding: 9px 12px;
  }

  @media (max-width: 860px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }

    .acciones {
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
  select {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }
`;
