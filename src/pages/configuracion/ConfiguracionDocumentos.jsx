import { useEffect, useState } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { Header } from "../../index";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";
import {
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  guardarCorrelativoSistemaConfiguracion,
  listarCorrelativosSistemaConfiguracion,
  sincronizarCorrelativoSistemaConfiguracion,
  sincronizarTodosLosCorrelativosSistemaConfiguracion,
} from "../../supabase/configuracionCore.js";

const crearRegistroEditable = (item = {}) => ({
  id: item?.id || "",
  clave: item?.clave || "",
  nombre: item?.nombre || "",
  prefijo: item?.prefijo || "",
  formato: item?.formato || "DDMMAA-01",
  alcance: item?.alcance || "ANUAL",
  anioActual: Number(item?.anioActual || new Date().getFullYear()),
  ultimoCorrelativo: Number(item?.ultimoCorrelativo || 0),
  siguienteForzado: Number(item?.siguienteForzado || 0),
  activo: item?.activo !== false,
  metadata: item?.metadata || {},
});

export function ConfiguracionDocumentos() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Operacion");
  const [correlativos, setCorrelativos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoClave, setGuardandoClave] = useState("");
  const [sincronizandoClave, setSincronizandoClave] = useState("");

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const lista = await sincronizarTodosLosCorrelativosSistemaConfiguracion();
        if (!activo) return;
        setCorrelativos(lista.map(crearRegistroEditable));
      } catch (error) {
        mostrarErrorSistema(`No se pudo cargar los correlativos: ${error.message}`);
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  const actualizarCampo = (clave, campo, valor) => {
    setCorrelativos((anterior) =>
      anterior.map((item) =>
        item.clave === clave
          ? {
              ...item,
              [campo]:
                campo === "prefijo" || campo === "formato" || campo === "alcance"
                  ? valueToUpper(valor)
                  : valor,
            }
          : item,
      ),
    );
  };

  const sincronizarRegistro = async (registro) => {
    try {
      setSincronizandoClave(registro.clave);
      const sincronizado = await sincronizarCorrelativoSistemaConfiguracion(registro.clave);
      setCorrelativos((anterior) =>
        anterior.map((item) =>
          item.clave === registro.clave ? crearRegistroEditable(sincronizado) : item,
        ),
      );
      mostrarNotificacionCarga(`Correlativo ${registro.nombre} sincronizado con historial.`);
    } catch (error) {
      mostrarErrorSistema(`No se pudo sincronizar ${registro.nombre}: ${error.message}`);
    } finally {
      setSincronizandoClave("");
    }
  };

  const guardarRegistro = async (registro) => {
    try {
      setGuardandoClave(registro.clave);
      const guardado = await guardarCorrelativoSistemaConfiguracion({
        ...registro,
        prefijo: registro.prefijo,
        formato: registro.formato,
        alcance: registro.alcance,
        anioActual: Number(registro.anioActual || new Date().getFullYear()),
        ultimoCorrelativo: Number(registro.ultimoCorrelativo || 0),
        siguienteForzado: Number(registro.siguienteForzado || 0),
      });

      setCorrelativos((anterior) =>
        anterior.map((item) =>
          item.clave === registro.clave ? crearRegistroEditable(guardado) : item,
        ),
      );
      mostrarNotificacionCarga(`Correlativo ${registro.nombre} guardado.`);
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar ${registro.nombre}: ${error.message}`);
    } finally {
      setGuardandoClave("");
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
          <h1>Documentos y numeracion</h1>
          <p>
            Aqui se controla el correlativo real de cada codigo del sistema. Desde
            aqui puedes ver en que numero va, forzar el siguiente y mantener el
            orden por anio.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Correlativos del sistema</h2>
              <p>
                Pedidos, OP, ingresos, salidas, recepciones y demas codigos que el
                sistema genera de forma correlativa.
              </p>
            </div>
          </div>

          {cargando ? (
            <div className="estado_vacio">Cargando correlativos...</div>
          ) : (
            <div className="lista_correlativos">
              {correlativos.map((registro) => (
                <article key={registro.clave} className="bloque_correlativo">
                  <div className="bloque_correlativo__cabecera">
                    <div>
                      <h3>{registro.nombre}</h3>
                      <small>{registro.clave}</small>
                    </div>
                    <div className="acciones_correlativo">
                      <button
                        type="button"
                        className="btn btn_secundario"
                        onClick={() => sincronizarRegistro(registro)}
                        disabled={sincronizandoClave === registro.clave}
                      >
                        {sincronizandoClave === registro.clave
                          ? "Sincronizando..."
                          : "Sincronizar historial"}
                      </button>
                      <button
                        type="button"
                        className="btn btn_principal"
                        onClick={() => guardarRegistro(registro)}
                        disabled={guardandoClave === registro.clave}
                      >
                        {guardandoClave === registro.clave ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>

                  <div className="grid_formulario">
                    <Campo>
                      <label>Prefijo</label>
                      <input
                        value={registro.prefijo}
                        onChange={(e) =>
                          actualizarCampo(registro.clave, "prefijo", e.target.value)
                        }
                      />
                    </Campo>
                    <Campo>
                      <label>Formato</label>
                      <input
                        value={registro.formato}
                        onChange={(e) =>
                          actualizarCampo(registro.clave, "formato", e.target.value)
                        }
                      />
                    </Campo>
                    <Campo>
                      <label>Alcance</label>
                      <input
                        value={registro.alcance}
                        onChange={(e) =>
                          actualizarCampo(registro.clave, "alcance", e.target.value)
                        }
                      />
                    </Campo>
                    <Campo>
                      <label>Anio actual</label>
                      <input
                        type="number"
                        min="2020"
                        value={registro.anioActual}
                        onChange={(e) =>
                          actualizarCampo(registro.clave, "anioActual", e.target.value)
                        }
                      />
                    </Campo>
                    <Campo>
                      <label>Ultimo correlativo</label>
                      <input
                        type="number"
                        min="0"
                        value={registro.ultimoCorrelativo}
                        onChange={(e) =>
                          actualizarCampo(
                            registro.clave,
                            "ultimoCorrelativo",
                            e.target.value,
                          )
                        }
                      />
                    </Campo>
                    <Campo>
                      <label>Forzar siguiente</label>
                      <input
                        type="number"
                        min="0"
                        value={registro.siguienteForzado}
                        onChange={(e) =>
                          actualizarCampo(
                            registro.clave,
                            "siguienteForzado",
                            e.target.value,
                          )
                        }
                      />
                    </Campo>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="acciones">
          <Link to="/configurar" className="btn btn_secundario btn_enlace">
            Volver a Configuracion
          </Link>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const valueToUpper = (valor) => (typeof valor === "string" ? valor.toUpperCase() : valor);

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
      linear-gradient(135deg, var(--modulo-fondo, rgba(180, 83, 9, 0.12)) 0%, ${({ theme }) => theme.bgcards} 100%);
  }

  .cabecera h1,
  .tarjeta h2,
  .bloque_correlativo h3 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .estado_vacio,
  .bloque_correlativo small {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .contenido,
  .lista_correlativos {
    display: grid;
    gap: 16px;
  }

  .bloque_correlativo {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 16px;
    background:
      linear-gradient(180deg, ${({ theme }) => theme.bg} 0%, ${({ theme }) => theme.bgcards} 100%);
    display: grid;
    gap: 16px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  }

  .bloque_correlativo__cabecera {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .acciones_correlativo {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .grid_formulario {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
`;

const Campo = styled.div`
  display: grid;
  gap: 8px;

  label {
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  input {
    width: 100%;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }
`;
