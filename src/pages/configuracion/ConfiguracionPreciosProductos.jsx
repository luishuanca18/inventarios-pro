import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  crearFormularioPrecioProducto,
  formatearResumenTarifario,
  leerListaPreciosProductos,
  normalizarTextoPrecio,
} from "../../utils/preciosProductos";
import {
  eliminarPrecioProductoConfiguracion,
  guardarPrecioProductoConfiguracion,
  listarModelosProductoConfiguracion,
  listarPreciosProductosConfiguracion,
} from "../../supabase/configuracionCore.js";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";

const formatearMonto = (valor) =>
  `S/ ${Number(valor || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function ConfiguracionPreciosProductos() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Costos y Finanzas");
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(crearFormularioPrecioProducto);
  const [listaPrecios, setListaPrecios] = useState(() => leerListaPreciosProductos());
  const [modelosCatalogo, setModelosCatalogo] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const combinarPreciosConCatalogo = (precios = [], modelos = []) => {
    const preciosPorModelo = new Map(
      (precios || []).map((item) => [normalizarTextoPrecio(item?.modelo), item]),
    );

    return (modelos || [])
      .map((modelo) => {
        const precio = preciosPorModelo.get(normalizarTextoPrecio(modelo?.nombreModelo || ""));
        return {
          id: precio?.id || "",
          modelo: modelo?.nombreModelo || "",
          codigoModelo: modelo?.codigoModelo || "",
          codigoCorto: modelo?.codigoCorto || "",
          precioBase: Number(precio?.precioBase || 0),
          precioXL: Number(precio?.precioXL || 0),
          precioXXL: Number(precio?.precioXXL || 0),
          observacion: precio?.observacion || "",
          fechaActualizacion: precio?.fechaActualizacion || "",
        };
      })
      .sort((a, b) => (a?.modelo || "").localeCompare(b?.modelo || ""));
  };

  const recargarDatos = async () => {
    const [precios, modelos] = await Promise.all([
      listarPreciosProductosConfiguracion(),
      listarModelosProductoConfiguracion(),
    ]);

    setModelosCatalogo(modelos);
    setListaPrecios(combinarPreciosConCatalogo(precios, modelos));
  };

  useEffect(() => {
    let activo = true;

    const cargarDesdeSupabase = async () => {
      try {
        const [precios, modelos] = await Promise.all([
          listarPreciosProductosConfiguracion(),
          listarModelosProductoConfiguracion(),
        ]);
        if (!activo) return;
        setModelosCatalogo(modelos);
        setListaPrecios(combinarPreciosConCatalogo(precios, modelos));
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargarDesdeSupabase();

    return () => {
      activo = false;
    };
  }, []);

  const modelosDisponibles = useMemo(() => {
    return (modelosCatalogo || []).map((item) => ({
      id: item?.id || "",
      modelo: item?.nombreModelo || "",
      codigoModelo: item?.codigoModelo || "",
      codigoCorto: item?.codigoCorto || "",
    }));
  }, [modelosCatalogo]);

  const listaFiltrada = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return listaPrecios;
    return listaPrecios.filter((item) =>
      [item?.codigoCorto, item?.codigoModelo, item?.modelo, item?.observacion]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [busqueda, listaPrecios]);

  const actualizarCampo = (campo, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]:
        campo === "modelo" || campo === "observacion"
          ? valor.toUpperCase()
          : valor,
    }));
  };

  const limpiarFormulario = () => setFormulario(crearFormularioPrecioProducto());

  const guardarTarifario = async () => {
    if (!formulario.modelo.trim()) {
      await mostrarAlertaSistema("Selecciona o escribe un modelo.");
      return;
    }

    try {
      setGuardando(true);
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Guardando lista de precios...",
        mensajeExito: "Lista de precios guardada.",
        mensajeError: "No se pudo guardar la lista de precios.",
        accion: async () => {
          await guardarPrecioProductoConfiguracion({
            ...formulario,
            modelo: normalizarTextoPrecio(formulario.modelo),
          });
          await recargarDatos();
          limpiarFormulario();
        },
      });
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar el precio: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cargarTarifario = (item) => {
    setFormulario({
      id: item?.id || "",
      modelo: item?.modelo || "",
      precioBase: String(item?.precioBase || ""),
      precioXL: String(item?.precioXL || ""),
      precioXXL: String(item?.precioXXL || ""),
      observacion: item?.observacion || "",
    });
  };

  const eliminarTarifario = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas quitar el precio de ${item?.modelo || "este modelo"}?`,
    );
    if (!confirmar) return;

    try {
      setGuardando(true);
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Quitando precio del modelo...",
        mensajeExito: "Precio eliminado.",
        mensajeError: "No se pudo quitar el precio del modelo.",
        accion: async () => {
          await eliminarPrecioProductoConfiguracion(item?.modelo);
          await recargarDatos();
          if (formulario.id === item.id) limpiarFormulario();
        },
      });
    } catch (error) {
      mostrarErrorSistema(`No se pudo quitar el precio: ${error.message}`);
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
          <h1>Precio de venta por modelo</h1>
          <p>
            Aqui defines el precio de venta de cada modelo. `Tiendas` y `Almacen`
            jalan este valor para vender, mientras `S-M-L` usan el precio base y
            `XL-XXL` pueden llevar otro precio mayor.
          </p>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/configurar" className="boton_volver">
          Volver a Configuracion
        </Link>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Tarifario por modelo</h2>
              <p>
                El color no cambia precio. Solo se diferencia el precio base frente a `XL` y `XXL`,
                y desde aqui se alimentan las ventas de `Tiendas` y `Almacen`.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Modelo</label>
              <input
                list="lista-modelos-precio"
                value={formulario.modelo}
                onChange={(e) => actualizarCampo("modelo", e.target.value)}
                placeholder="Busca por nombre del modelo"
              />
              <datalist id="lista-modelos-precio">
                {modelosDisponibles.map((modelo) => (
                  <option
                    key={modelo.id || modelo.codigoModelo || modelo.modelo}
                    value={modelo.modelo}
                  >
                    {`${modelo.codigoCorto || "-"} | ${modelo.codigoModelo || "-"}`}
                  </option>
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Precio base S-M-L</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formulario.precioBase}
                onChange={(e) => actualizarCampo("precioBase", e.target.value)}
              />
            </Campo>
            <Campo>
              <label>Precio XL</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formulario.precioXL}
                onChange={(e) => actualizarCampo("precioXL", e.target.value)}
              />
            </Campo>
            <Campo>
              <label>Precio XXL</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formulario.precioXXL}
                onChange={(e) => actualizarCampo("precioXXL", e.target.value)}
              />
            </Campo>
            <Campo className="campo-completo">
              <label>Observacion</label>
              <input
                value={formulario.observacion}
                onChange={(e) => actualizarCampo("observacion", e.target.value)}
              />
            </Campo>
          </div>

          <div className="acciones">
            <button type="button" className="btn btn_secundario" onClick={limpiarFormulario}>
              Limpiar
            </button>
            <button type="button" className="btn btn_principal" onClick={guardarTarifario} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar lista de precios"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Historial de precios</h2>
              <p>
                Aqui aparecen todos los modelos del catalogo maestro. Si todavia no tienen precio,
                salen en `0` para que los vayas completando.
              </p>
            </div>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar modelo"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo corto</th>
                  <th>Codigo maestro</th>
                  <th>Modelo</th>
                  <th>Base</th>
                  <th>XL</th>
                  <th>XXL</th>
                  <th>Resumen</th>
                  <th>Fecha</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="9" className="sin_datos">Cargando precios...</td>
                  </tr>
                ) : listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="sin_datos">
                      No se encontraron modelos para esa busqueda.
                    </td>
                  </tr>
                ) : (
                  listaFiltrada.map((item) => (
                    <tr key={item.id || item.codigoModelo || item.modelo}>
                      <td>{item.codigoCorto || "-"}</td>
                      <td>{item.codigoModelo || "-"}</td>
                      <td>{item.modelo || "-"}</td>
                      <td>{formatearMonto(item.precioBase)}</td>
                      <td>{formatearMonto(item.precioXL || item.precioBase)}</td>
                      <td>{formatearMonto(item.precioXXL || item.precioXL || item.precioBase)}</td>
                      <td>{formatearResumenTarifario(item.modelo, listaPrecios)}</td>
                      <td>{item.fechaActualizacion || "-"}</td>
                      <td>
                        <button type="button" className="btn btn_secundario btn_inline" onClick={() => cargarTarifario(item)}>
                          Cargar
                        </button>
                        <button type="button" className="btn btn_secundario btn_inline" onClick={() => eliminarTarifario(item)}>
                          Quitar
                        </button>
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
  grid-template-rows: 90px auto auto 1fr;
  gap: 16px;
  padding: 15px;

  .encabezado,
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

  .encabezado {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 10px;
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

  .contenido {
    display: grid;
    gap: 16px;
  }

  .fila_superior,
  .acciones {
    display: flex;
    justify-content: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .acciones {
    justify-content: flex-end;
    margin-top: 16px;
  }

  .boton_volver,
  .btn {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .boton_volver,
  .btn_secundario {
    background: #5b5b60;
    color: #ffffff;
  }

  .btn_principal {
    background: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .btn_inline {
    margin-right: 8px;
    margin-bottom: 8px;
  }

  .tarjeta__encabezado,
  .buscador {
    margin-bottom: 16px;
  }

  .grid_formulario {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .campo-completo {
    grid-column: 1 / -1;
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

  .tabla_contenedor {
    overflow: auto;
  }

  table {
    width: 100%;
    min-width: 900px;
    border-collapse: collapse;
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
