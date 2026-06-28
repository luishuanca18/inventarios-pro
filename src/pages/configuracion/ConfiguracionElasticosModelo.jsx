import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { leerCatalogosProduccion } from "../../utils/catalogosProduccion";
import {
  confirmarAccionSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  calcularCostoPrendaDesdeLargo,
  construirClaveFichaElastico,
  construirNombreFichaElastico,
  leerFichasElasticosModelo,
  obtenerCostoMetroElasticoPorAncho,
  obtenerTallasFichaElastico,
} from "../../utils/elasticosModelo";
import {
  eliminarElasticoModeloConfiguracion,
  guardarElasticoModeloConfiguracion,
  listarModelosProductoConfiguracion,
  listarElasticosModeloConfiguracion,
} from "../../supabase/configuracionCore.js";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";

const crearFormularioVacio = (tallas = []) => ({
  id: "",
  categoria: "",
  modelo: "",
  telaModelo: "",
  nombreModelo: "",
  anchoElasticoCm: "",
  costoMetro: "0",
  largosPorTalla: tallas.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: "",
    }),
    {},
  ),
  observacion: "",
});

const formatearNumero = (valor) =>
  Number(valor || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const inferirPartesModeloLargo = (nombreModelo = "") => {
  const palabras = String(nombreModelo || "")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  return {
    categoria: palabras[0] || "",
    modelo: palabras[1] || "",
    telaModelo: palabras.slice(2).join(" "),
  };
};

export function ConfiguracionElasticosModelo() {
  const catalogos = useMemo(leerCatalogosProduccion, []);
  const tallas = useMemo(obtenerTallasFichaElastico, []);
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaModeloCatalogo, setBusquedaModeloCatalogo] = useState("");
  const [modelosCatalogo, setModelosCatalogo] = useState([]);
  const [fichas, setFichas] = useState(() => leerFichasElasticosModelo());
  const [formulario, setFormulario] = useState(() => crearFormularioVacio(tallas));
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const [lista, modelos] = await Promise.all([
          listarElasticosModeloConfiguracion(),
          listarModelosProductoConfiguracion(),
        ]);
        if (activo) {
          setFichas(lista);
          setModelosCatalogo(Array.isArray(modelos) ? modelos : []);
        }
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  const fichasFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();

    if (!textoBusqueda) {
      return fichas;
    }

    return fichas.filter((ficha) =>
      [
        ficha.nombreModelo,
        ficha.categoria,
        ficha.modelo,
        ficha.telaModelo,
        ficha.anchoElasticoCm,
        ficha.observacion,
      ]
        .join(" ")
        .toLowerCase()
        .includes(textoBusqueda),
    );
  }, [busqueda, fichas]);

  const modeloCatalogoSeleccionado = useMemo(() => {
    const texto = busquedaModeloCatalogo.trim().toUpperCase();
    if (!texto) return null;

    const codigoBuscado = texto.split("|")[0]?.trim() || texto;
    return (
      modelosCatalogo.find((item) => item.codigoModelo === codigoBuscado) ||
      modelosCatalogo.find((item) => item.codigoCorto === codigoBuscado) ||
      modelosCatalogo.find((item) => item.nombreModelo === texto) ||
      modelosCatalogo.find((item) =>
        [item.codigoModelo, item.codigoCorto, item.nombreModelo]
          .join(" ")
          .toUpperCase()
          .includes(texto),
      ) ||
      null
    );
  }, [busquedaModeloCatalogo, modelosCatalogo]);

  const aplicarModeloCatalogo = (modelo) => {
    if (!modelo) return;

    const partesInferidas = inferirPartesModeloLargo(modelo.nombreModelo || "");

    setFormulario((anterior) => {
      const siguiente = {
        ...anterior,
        categoria: modelo.categoria || partesInferidas.categoria || "",
        modelo: modelo.modeloCatalogo || partesInferidas.modelo || "",
        telaModelo: modelo.telaNombre || partesInferidas.telaModelo || "",
        nombreModelo: modelo.nombreModelo || "",
      };

      return {
        ...siguiente,
        nombreModelo: construirNombreFichaElastico(siguiente),
      };
    });

    setBusquedaModeloCatalogo(
      `${modelo.codigoModelo || "-"} | ${modelo.codigoCorto || "-"} | ${modelo.nombreModelo || ""}`,
    );
  };

  const manejarCambioBase = (campo, valor) => {
    setFormulario((anterior) => {
      const siguiente = {
        ...anterior,
        [campo]: valor.toUpperCase(),
      };

      return {
        ...siguiente,
        nombreModelo: construirNombreFichaElastico(siguiente),
      };
    });
  };

  const manejarCambioNumero = (campo, valor) => {
    setFormulario((anterior) => {
      const siguiente = {
        ...anterior,
        [campo]: valor,
      };

      if (campo === "anchoElasticoCm") {
        return {
          ...siguiente,
          costoMetro: String(
            obtenerCostoMetroElasticoPorAncho(valor || siguiente.anchoElasticoCm || 0),
          ),
        };
      }

      return siguiente;
    });
  };

  const manejarCambioLargo = (talla, valor) => {
    setFormulario((anterior) => ({
      ...anterior,
      largosPorTalla: {
        ...anterior.largosPorTalla,
        [talla]: valor,
      },
    }));
  };

  const limpiarFormulario = () => {
    setFormulario(crearFormularioVacio(tallas));
    setBusquedaModeloCatalogo("");
  };

  const guardarFicha = async () => {
    if (!formulario.categoria || !formulario.modelo || !formulario.telaModelo) {
      mostrarAlertaSistema("Completa categoria, modelo y tela para el nombre del modelo.");
      return;
    }

    if (!formulario.anchoElasticoCm) {
      mostrarAlertaSistema("Escribe el ancho del elastico.");
      return;
    }

    const nuevaFicha = {
      ...formulario,
      id: formulario.id || `elastico-${Date.now()}`,
      claveFicha: construirClaveFichaElastico(formulario),
      nombreModelo: construirNombreFichaElastico(formulario),
      anchoElasticoCm: Number(formulario.anchoElasticoCm || 0),
      costoMetro: Number(
        obtenerCostoMetroElasticoPorAncho(formulario.anchoElasticoCm) ||
          formulario.costoMetro ||
          0,
      ),
      largosPorTalla: tallas.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: Number(formulario.largosPorTalla?.[talla] || 0),
        }),
        {},
      ),
      fechaActualizacion: new Date().toISOString(),
    };

    try {
      setGuardando(true);
      await guardarElasticoModeloConfiguracion(nuevaFicha);
      setFichas(await listarElasticosModeloConfiguracion());
      limpiarFormulario();
      mostrarNotificacionCarga("Ficha tecnica de elastico guardada correctamente.");
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar la ficha tecnica: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cargarFicha = (ficha) => {
    setFormulario({
      id: ficha.id || "",
      categoria: ficha.categoria || "",
      modelo: ficha.modelo || "",
      telaModelo: ficha.telaModelo || "",
      nombreModelo: ficha.nombreModelo || "",
      anchoElasticoCm: String(ficha.anchoElasticoCm || ""),
      costoMetro: String(
        obtenerCostoMetroElasticoPorAncho(ficha.anchoElasticoCm) || ficha.costoMetro || 0,
      ),
      largosPorTalla: tallas.reduce(
        (acumulado, talla) => ({
          ...acumulado,
          [talla]: String(ficha.largosPorTalla?.[talla] || ""),
        }),
        {},
      ),
      observacion: ficha.observacion || "",
    });
    const modeloRelacionado =
      modelosCatalogo.find((item) => item.nombreModelo === ficha.nombreModelo) || null;
    setBusquedaModeloCatalogo(
      modeloRelacionado
        ? `${modeloRelacionado.codigoModelo || "-"} | ${modeloRelacionado.codigoCorto || "-"} | ${modeloRelacionado.nombreModelo || ""}`
        : ficha.nombreModelo || "",
    );
    mostrarNotificacionCarga("Ficha cargada correctamente.");
  };

  const eliminarFicha = async (ficha) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas quitar la ficha de ${ficha.nombreModelo || "este modelo"}?`,
      { titulo: "Quitar ficha tecnica", confirmarTexto: "Quitar" }
    );

    if (!confirmar) {
      return;
    }

    try {
      setGuardando(true);
      await eliminarElasticoModeloConfiguracion(ficha.nombreModelo);
      setFichas(await listarElasticosModeloConfiguracion());
      if (formulario.id === ficha.id) {
        limpiarFormulario();
      }
    } catch (error) {
      mostrarErrorSistema(`No se pudo quitar la ficha tecnica: ${error.message}`);
    } finally {
      setGuardando(false);
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
          <h1>Ficha tecnica de elastico por modelo</h1>
          <p>
            Aqui defines el ancho del elastico, el largo por talla y el costo por
            prenda para que Produccion y contabilidad usen la misma base tecnica.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Formulario tecnico</h2>
              <p>
                El nombre del modelo se arma automaticamente para evitar errores
                de escritura.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo className="campo-completo">
              <label>Modelo desde catalogo</label>
              <input
                type="text"
                list="elasticos-modelos-catalogo"
                value={busquedaModeloCatalogo}
                onChange={(evento) => setBusquedaModeloCatalogo(evento.target.value)}
                placeholder="Ejemplo: MOD-0098 o codigo corto o nombre del modelo"
              />
              <datalist id="elasticos-modelos-catalogo">
                {modelosCatalogo.map((item) => (
                  <option
                    key={item.id}
                    value={`${item.codigoModelo || "-"} | ${item.codigoCorto || "-"} | ${item.nombreModelo || ""}`}
                  />
                ))}
              </datalist>
              <div className="selector_modelo_catalogo">
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => aplicarModeloCatalogo(modeloCatalogoSeleccionado)}
                  disabled={!modeloCatalogoSeleccionado}
                >
                  Usar modelo
                </button>
                <small>
                  {modeloCatalogoSeleccionado
                    ? `${modeloCatalogoSeleccionado.codigoModelo} | ${modeloCatalogoSeleccionado.codigoCorto || "-"}`
                    : "Busca un modelo existente para completar el formulario automatico."}
                </small>
              </div>
            </Campo>

            <Campo>
              <label>Categoria</label>
              <input type="text" list="elasticos-categoria" value={formulario.categoria} onChange={(evento) => manejarCambioBase("categoria", evento.target.value)} />
              <datalist id="elasticos-categoria">
                {(catalogos.categorias || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>

            <Campo>
              <label>Modelo</label>
              <input type="text" list="elasticos-modelo" value={formulario.modelo} onChange={(evento) => manejarCambioBase("modelo", evento.target.value)} />
              <datalist id="elasticos-modelo">
                {(catalogos.modelos || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>

            <Campo>
              <label>Tela para nombre</label>
              <input type="text" list="elasticos-tela-modelo" value={formulario.telaModelo} onChange={(evento) => manejarCambioBase("telaModelo", evento.target.value)} />
              <datalist id="elasticos-tela-modelo">
                {(catalogos.telasModelo || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>

            <Campo className="campo-completo">
              <label>Modelo completo</label>
              <input type="text" value={formulario.nombreModelo} readOnly />
            </Campo>

            <Campo>
              <label>Ancho del elastico (cm)</label>
              <input type="number" step="0.1" inputMode="decimal" value={formulario.anchoElasticoCm} onChange={(evento) => manejarCambioNumero("anchoElasticoCm", evento.target.value)} />
            </Campo>

            <Campo>
              <label>Costo por metro (automatico)</label>
              <input value={formulario.costoMetro} readOnly />
              <small className="texto_ayuda">
                El costo sale de la ultima compra real del elastico con ese ancho y sus metros por rollo.
              </small>
            </Campo>

            <Campo className="campo-completo">
              <label>Observacion</label>
              <textarea
                value={formulario.observacion}
                onChange={(evento) =>
                  setFormulario((anterior) => ({
                    ...anterior,
                    observacion: evento.target.value.toUpperCase(),
                  }))
                }
              />
            </Campo>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Talla</th>
                  <th>Largo elastico (cm)</th>
                  <th>Costo por prenda</th>
                </tr>
              </thead>
              <tbody>
                {tallas.map((talla) => (
                  <tr key={talla}>
                    <td>{talla}</td>
                    <td>
                      <input type="number" step="0.01" inputMode="decimal" value={formulario.largosPorTalla?.[talla] || ""} onChange={(evento) => manejarCambioLargo(talla, evento.target.value)} />
                    </td>
                    <td>
                      S/{" "}
                      {formatearNumero(
                        calcularCostoPrendaDesdeLargo({
                          largoCm: formulario.largosPorTalla?.[talla],
                          costoMetro: formulario.costoMetro,
                        }),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="acciones">
            <button type="button" className="btn btn_secundario" onClick={limpiarFormulario}>
              Limpiar
            </button>
            <button type="button" className="btn btn_principal" onClick={guardarFicha} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar ficha"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Lista tecnica</h2>
              <p>Busca rapido por modelo para revisar ancho, largos y costo por talla.</p>
            </div>
          </div>

          <div className="buscador">
            <input type="text" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar por modelo, categoria, tela o observacion" />
          </div>

          <div className="lista_fichas">
            {cargando ? (
              <div className="item_vacio">Cargando fichas tecnicas...</div>
            ) : fichasFiltradas.length ? (
              fichasFiltradas.map((ficha) => (
                <article key={ficha.id || ficha.nombreModelo} className="tarjeta_ficha">
                  <div className="tarjeta_ficha__cabecera">
                    <div>
                      <h3>{ficha.nombreModelo}</h3>
                      <p>
                        Elastico de {ficha.anchoElasticoCm} cm | Costo metro: S/{" "}
                        {formatearNumero(ficha.costoMetro)}
                      </p>
                    </div>
                    <div className="tarjeta_ficha__acciones">
                      <button type="button" className="btn btn_secundario" onClick={() => cargarFicha(ficha)}>
                        Cargar
                      </button>
                      <button type="button" className="btn btn_secundario" onClick={() => eliminarFicha(ficha)}>
                        Quitar
                      </button>
                    </div>
                  </div>

                  <div className="grid_costos">
                    {tallas.map((talla) => (
                      <div key={`${ficha.id}-${talla}`} className="chip_costo">
                        <strong>{talla}</strong>
                        <span>{formatearNumero(ficha.largosPorTalla?.[talla])} cm</span>
                        <small>
                          S/{" "}
                          {formatearNumero(
                            calcularCostoPrendaDesdeLargo({
                              largoCm: ficha.largosPorTalla?.[talla],
                              costoMetro: ficha.costoMetro,
                            }),
                          )}
                        </small>
                      </div>
                    ))}
                  </div>

                  {ficha.observacion ? (
                    <div className="observacion_ficha">{ficha.observacion}</div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="item_vacio">Todavia no hay fichas tecnicas de elastico.</div>
            )}
          </div>
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

  .cabecera h1,
  .tarjeta h2,
  .tarjeta_ficha h3 {
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
    gap: 14px;
  }

  .campo-completo {
    grid-column: 1 / -1;
  }

  .tabla_contenedor {
    overflow-x: auto;
    margin-top: 16px;
  }

  .selector_modelo_catalogo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .selector_modelo_catalogo small,
  .texto_ayuda {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 680px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
    text-align: left;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn {
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
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

  .buscador input,
  .grid_formulario input,
  .grid_formulario select,
  .grid_formulario textarea,
  .tabla_contenedor input {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .grid_formulario textarea {
    min-height: 84px;
    resize: vertical;
  }

  .lista_fichas {
    display: grid;
    gap: 14px;
  }

  .tarjeta_ficha {
    display: grid;
    gap: 12px;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 16px;
    background-color: ${({ theme }) => theme.bg};
  }

  .tarjeta_ficha__cabecera,
  .tarjeta_ficha__acciones {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .grid_costos {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }

  .chip_costo {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgcards};
  }

  .chip_costo span,
  .chip_costo small,
  .observacion_ficha,
  .texto_ayuda {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .item_vacio {
    padding: 16px;
    border: 1px dashed ${({ theme }) => theme.bg4};
    border-radius: 12px;
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}

  @media (max-width: 860px) {
    .grid_formulario,
    .grid_costos {
      grid-template-columns: 1fr;
    }

    .tarjeta_ficha__cabecera,
    .tarjeta_ficha__acciones {
      align-items: stretch;
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
`;
