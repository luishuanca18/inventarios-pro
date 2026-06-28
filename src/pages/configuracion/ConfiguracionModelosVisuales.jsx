import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, leerCatalogosProduccion } from "../../index";
import {
  confirmarAccionSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  construirModeloBaseVisual,
  leerModelosVisuales,
  leerModelosVisualesColor,
  obtenerVistasModeloVisual,
} from "../../utils/modelosVisuales";
import {
  eliminarModeloVisualColorConfiguracion,
  eliminarModeloVisualConfiguracion,
  guardarModeloVisualColorConfiguracion,
  guardarModeloVisualConfiguracion,
  listarModelosProductoConfiguracion,
  listarModelosVisualesColorConfiguracion,
  listarModelosVisualesConfiguracion,
} from "../../supabase/configuracionCore.js";

const crearFormularioVacio = () => ({
  categoriaModelo: "",
  modeloCatalogo: "",
  telaModelo: "",
  modeloBase: "",
  descripcionVisual: "",
  fotoFrente: "",
  fotoEspalda: "",
  fotoCostado: "",
  fotoDetalle: "",
});

const crearFormularioColorVacio = () => ({
  modeloBase: "",
  colorBase: "",
  fotoColor: "",
  descripcionColor: "",
});

const leerArchivoComoDataUrl = (archivo) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = reject;
    lector.readAsDataURL(archivo);
  });

const redimensionarImagen = (dataUrl, maximo = 1400) =>
  new Promise((resolve) => {
    const imagen = new Image();
    imagen.onload = () => {
      const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
      const ancho = Math.round(imagen.width * escala);
      const alto = Math.round(imagen.height * escala);

      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const contexto = canvas.getContext("2d");
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, ancho, alto);
      contexto.drawImage(imagen, 0, 0, ancho, alto);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    imagen.onerror = () => resolve(dataUrl);
    imagen.src = dataUrl;
  });

const obtenerFotoFrontal = (ficha = {}) =>
  obtenerVistasModeloVisual(ficha).find((item) => item.clave === "frente")?.url || "";

const inferirPartesModeloLargo = (nombreModelo = "") => {
  const palabras = String(nombreModelo || "")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  return {
    categoriaModelo: palabras[0] || "",
    modeloCatalogo: palabras[1] || "",
    telaModelo: palabras.slice(2).join(" "),
  };
};

export function ConfiguracionModelosVisuales() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const catalogos = useMemo(leerCatalogosProduccion, []);
  const [busquedaModeloCatalogo, setBusquedaModeloCatalogo] = useState("");
  const [modelosCatalogo, setModelosCatalogo] = useState([]);
  const [fichas, setFichas] = useState(leerModelosVisuales);
  const [fichasColor, setFichasColor] = useState(leerModelosVisualesColor);
  const [formulario, setFormulario] = useState(crearFormularioVacio);
  const [formularioColor, setFormularioColor] = useState(crearFormularioColorVacio);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const [lista, modelos] = await Promise.all([
          listarModelosVisualesConfiguracion(),
          listarModelosProductoConfiguracion(),
        ]);
        const listaColores = await listarModelosVisualesColorConfiguracion();
        if (activo) {
          setFichas(lista);
          setFichasColor(listaColores);
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

  const actualizarModeloBase = (parcial = {}) => {
    const siguiente = {
      ...formulario,
      ...parcial,
    };

    return {
      ...siguiente,
      modeloBase: construirModeloBaseVisual(siguiente),
    };
  };

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

    setFormulario(
      actualizarModeloBase({
        categoriaModelo: modelo.categoria || partesInferidas.categoriaModelo || "",
        modeloCatalogo: modelo.modeloCatalogo || partesInferidas.modeloCatalogo || "",
        telaModelo: modelo.telaNombre || partesInferidas.telaModelo || "",
        modeloBase: modelo.nombreModelo || "",
      }),
    );

    setBusquedaModeloCatalogo(
      `${modelo.codigoModelo || "-"} | ${modelo.codigoCorto || "-"} | ${modelo.nombreModelo || ""}`,
    );
  };

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setFormulario(actualizarModeloBase({ [name]: value.toUpperCase() }));
  };

  const manejarCargaImagen = async (campo, evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    try {
      const dataUrlOriginal = await leerArchivoComoDataUrl(archivo);
      const dataUrl = await redimensionarImagen(dataUrlOriginal, 1400);
      setFormulario((anterior) => ({
        ...anterior,
        [campo]: dataUrl,
      }));
    } catch {
      mostrarErrorSistema("No se pudo cargar la imagen del modelo.");
    }
  };

  const manejarCargaImagenColor = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    try {
      const dataUrlOriginal = await leerArchivoComoDataUrl(archivo);
      const dataUrl = await redimensionarImagen(dataUrlOriginal, 1400);
      setFormularioColor((anterior) => ({
        ...anterior,
        fotoColor: dataUrl,
      }));
    } catch {
      mostrarErrorSistema("No se pudo cargar la imagen del color del modelo.");
    }
  };

  const guardarFicha = async () => {
    if (!formulario.categoriaModelo || !formulario.modeloCatalogo || !formulario.telaModelo) {
      mostrarAlertaSistema("Completa categoria, modelo y tela para nombre.");
      return;
    }

    if (!formulario.fotoFrente) {
      mostrarAlertaSistema("Carga al menos la foto frontal del modelo.");
      return;
    }

    try {
      setGuardando(true);
      await guardarModeloVisualConfiguracion(formulario);
      setFichas(await listarModelosVisualesConfiguracion());
      setFormulario(crearFormularioVacio());
      setBusquedaModeloCatalogo("");
      mostrarNotificacionCarga("Ficha visual del modelo guardada.");
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar la ficha visual: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const guardarFichaColor = async () => {
    if (!formularioColor.modeloBase || !formularioColor.colorBase) {
      mostrarAlertaSistema("Completa el modelo y el color para guardar la foto especifica.");
      return;
    }

    if (!formularioColor.fotoColor) {
      mostrarAlertaSistema("Carga la foto especifica del modelo con ese color.");
      return;
    }

    try {
      setGuardando(true);
      await guardarModeloVisualColorConfiguracion(formularioColor);
      setFichasColor(await listarModelosVisualesColorConfiguracion());
      setFormularioColor(crearFormularioColorVacio());
      mostrarNotificacionCarga("Foto especifica por color guardada.");
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar la foto por color: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cargarFicha = (ficha) => {
    const partesInferidas = inferirPartesModeloLargo(ficha?.modeloBase || "");
    setFormulario({
      categoriaModelo: ficha?.categoriaModelo || partesInferidas.categoriaModelo || "",
      modeloCatalogo: ficha?.modeloCatalogo || partesInferidas.modeloCatalogo || "",
      telaModelo: ficha?.telaModelo || partesInferidas.telaModelo || "",
      modeloBase: ficha?.modeloBase || "",
      descripcionVisual: ficha?.descripcionVisual || "",
      fotoFrente: ficha?.fotoFrente || ficha?.fotoModelo || "",
      fotoEspalda: ficha?.fotoEspalda || "",
      fotoCostado: ficha?.fotoCostado || "",
      fotoDetalle: ficha?.fotoDetalle || "",
    });
    const modeloRelacionado =
      modelosCatalogo.find((item) => item.nombreModelo === ficha?.modeloBase) || null;
    setBusquedaModeloCatalogo(
      modeloRelacionado
        ? `${modeloRelacionado.codigoModelo || "-"} | ${modeloRelacionado.codigoCorto || "-"} | ${modeloRelacionado.nombreModelo || ""}`
        : ficha?.modeloBase || "",
    );
  };

  const cargarFichaColor = (ficha = {}) => {
    setFormularioColor({
      modeloBase: ficha?.modeloBase || "",
      colorBase: ficha?.colorBase || "",
      fotoColor: ficha?.fotoColor || "",
      descripcionColor: ficha?.descripcionColor || "",
    });
  };

  const quitarFicha = async (modeloBase) => {
    const confirmar = await confirmarAccionSistema(
      "Seguro que deseas quitar esta ficha visual del modelo?",
      { titulo: "Quitar ficha visual", confirmarTexto: "Quitar" }
    );
    if (!confirmar) return;

    try {
      setGuardando(true);
      await eliminarModeloVisualConfiguracion(modeloBase);
      setFichas(await listarModelosVisualesConfiguracion());
      if (formulario.modeloBase === modeloBase) {
        setFormulario(crearFormularioVacio());
      }
    } catch (error) {
      mostrarErrorSistema(`No se pudo quitar la ficha visual: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const quitarFichaColor = async ({ modeloBase, colorBase }) => {
    const confirmar = await confirmarAccionSistema(
      "Seguro que deseas quitar esta foto especifica del modelo por color?",
      { titulo: "Quitar foto por color", confirmarTexto: "Quitar" }
    );
    if (!confirmar) return;

    try {
      setGuardando(true);
      await eliminarModeloVisualColorConfiguracion({ modeloBase, colorBase });
      setFichasColor(await listarModelosVisualesColorConfiguracion());
      if (
        formularioColor.modeloBase === modeloBase &&
        formularioColor.colorBase === colorBase
      ) {
        setFormularioColor(crearFormularioColorVacio());
      }
    } catch (error) {
      mostrarErrorSistema(`No se pudo quitar la foto por color: ${error.message}`);
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
          <h1>Fichas visuales de modelos</h1>
          <p>
            Aqui guardas la ficha visual del modelo con frente, espalda, costado y
            detalle para que Produccion y Talleres lo reconozcan rapido.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Ficha del modelo</h2>
              <p>
                Usa categoria, modelo y tela para nombre. El sistema arma solo el
                nombre comercial y lo usa como referencia para las cuatro vistas.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo className="campo_completo">
              <label>Modelo desde catalogo</label>
              <input
                type="text"
                list="modelos-catalogo-visual"
                value={busquedaModeloCatalogo}
                onChange={(evento) => setBusquedaModeloCatalogo(evento.target.value)}
                placeholder="Ejemplo: MOD-0201 o codigo corto o nombre del modelo"
              />
              <datalist id="modelos-catalogo-visual">
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
                    : "Busca un modelo del catalogo para completar categoria, modelo y tela automaticamente."}
                </small>
              </div>
            </Campo>
            <Campo>
              <label>Categoria</label>
              <input type="text" list="categoria-modelo-visual" name="categoriaModelo" value={formulario.categoriaModelo} onChange={manejarCambio} />
              <datalist id="categoria-modelo-visual">
                {(catalogos.categorias || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Modelo</label>
              <input type="text" list="modelo-catalogo-visual" name="modeloCatalogo" value={formulario.modeloCatalogo} onChange={manejarCambio} />
              <datalist id="modelo-catalogo-visual">
                {(catalogos.modelos || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Tela para nombre</label>
              <input type="text" list="tela-modelo-visual" name="telaModelo" value={formulario.telaModelo} onChange={manejarCambio} />
              <datalist id="tela-modelo-visual">
                {(catalogos.telasModelo || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo className="campo_completo">
              <label>Nombre comercial</label>
              <input type="text" value={formulario.modeloBase} readOnly />
            </Campo>
            <Campo className="campo_completo">
              <label>Descripcion visual</label>
              <textarea name="descripcionVisual" value={formulario.descripcionVisual} onChange={manejarCambio} />
            </Campo>
            <Campo className="campo_completo">
              <label>Foto frontal</label>
              <input type="file" accept="image/*" onChange={(evento) => manejarCargaImagen("fotoFrente", evento)} />
              <small className="texto_ayuda_imagen">
                Recomendado: foto vertical clara. El sistema la ajusta automaticamente
                hasta un maximo aproximado de 1400 px.
              </small>
            </Campo>
            <Campo>
              <label>Foto espalda</label>
              <input type="file" accept="image/*" onChange={(evento) => manejarCargaImagen("fotoEspalda", evento)} />
            </Campo>
            <Campo>
              <label>Foto costado</label>
              <input type="file" accept="image/*" onChange={(evento) => manejarCargaImagen("fotoCostado", evento)} />
            </Campo>
            <Campo>
              <label>Foto detalle</label>
              <input type="file" accept="image/*" onChange={(evento) => manejarCargaImagen("fotoDetalle", evento)} />
            </Campo>
          </div>

          <div className="galeria_visual">
            {obtenerVistasModeloVisual(formulario).map((item) => (
              <div key={item.clave} className="bloque_visual">
                <span className="bloque_visual__titulo">{item.titulo}</span>
                {item.url ? (
                  <img src={item.url} alt={`${formulario.modeloBase || "Modelo"} ${item.titulo}`} />
                ) : (
                  <div className="visual_vacio">Sin vista {item.titulo.toLowerCase()}.</div>
                )}
              </div>
            ))}
          </div>

          <div className="acciones">
            <Link to="/configurar" className="btn btn_secundario btn_enlace">
              Volver a Configuracion
            </Link>
            <button type="button" className="btn btn_principal" onClick={guardarFicha} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar ficha visual"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Modelos registrados</h2>
              <p>
                Desde aqui puedes volver a cargar una ficha y seguir mejorando la foto
                o la descripcion visual.
              </p>
            </div>
          </div>

          <div className="grid_fichas">
            {cargando ? (
              <div className="ficha_vacia">Cargando fichas visuales...</div>
            ) : fichas.length === 0 ? (
              <div className="ficha_vacia">Todavia no hay fichas visuales registradas.</div>
            ) : (
              fichas.map((ficha) => (
                <article key={ficha.modeloBase} className="ficha_card">
                  {obtenerFotoFrontal(ficha) ? (
                    <img src={obtenerFotoFrontal(ficha)} alt={ficha.modeloBase} />
                  ) : (
                    <div className="mini_vacio">Sin foto</div>
                  )}
                  <strong>{ficha.modeloBase}</strong>
                  <p>{ficha.descripcionVisual || "Sin descripcion visual."}</p>
                  <small className="ficha_detalle_vistas">
                    {obtenerVistasModeloVisual(ficha).filter((item) => item.url).length} vistas cargadas
                  </small>
                  <div className="ficha_acciones">
                    <button type="button" className="btn btn_principal" onClick={() => cargarFicha(ficha)}>
                      Cargar
                    </button>
                    <button type="button" className="btn btn_secundario" onClick={() => quitarFicha(ficha.modeloBase)}>
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
              <h2>Foto especifica por color</h2>
              <p>
                Aqui guardas una foto real de un modelo con un color puntual. Sirve
                sobre todo para stock y ventas, donde importa ver el color exacto.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo className="campo_completo">
              <label>Modelo comercial</label>
              <input
                type="text"
                list="modelo-base-color-visual"
                value={formularioColor.modeloBase}
                onChange={(evento) =>
                  setFormularioColor((anterior) => ({
                    ...anterior,
                    modeloBase: evento.target.value.toUpperCase(),
                  }))
                }
                placeholder="Escribe o escoge el modelo comercial"
              />
              <datalist id="modelo-base-color-visual">
                {fichas.map((item) => (
                  <option key={item.modeloBase} value={item.modeloBase} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Color</label>
              <input
                type="text"
                list="color-base-visual"
                value={formularioColor.colorBase}
                onChange={(evento) =>
                  setFormularioColor((anterior) => ({
                    ...anterior,
                    colorBase: evento.target.value.toUpperCase(),
                  }))
                }
                placeholder="Ejemplo: NEGRO"
              />
              <datalist id="color-base-visual">
                {(catalogos.colores || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo className="campo_completo">
              <label>Descripcion del color</label>
              <textarea
                value={formularioColor.descripcionColor}
                onChange={(evento) =>
                  setFormularioColor((anterior) => ({
                    ...anterior,
                    descripcionColor: evento.target.value.toUpperCase(),
                  }))
                }
              />
            </Campo>
            <Campo className="campo_completo">
              <label>Foto del modelo + color</label>
              <input type="file" accept="image/*" onChange={manejarCargaImagenColor} />
            </Campo>
          </div>

          <div className="galeria_visual galeria_color">
            <div className="bloque_visual">
              <span className="bloque_visual__titulo">
                {formularioColor.colorBase
                  ? `${formularioColor.modeloBase || "Modelo"} + ${formularioColor.colorBase}`
                  : "Vista por color"}
              </span>
              {formularioColor.fotoColor ? (
                <img
                  src={formularioColor.fotoColor}
                  alt={`${formularioColor.modeloBase || "Modelo"} ${formularioColor.colorBase || ""}`}
                />
              ) : (
                <div className="visual_vacio">Sin foto especifica para este color.</div>
              )}
            </div>
          </div>

          <div className="acciones">
            <button
              type="button"
              className="btn btn_principal"
              onClick={guardarFichaColor}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Guardar foto por color"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Variantes por color registradas</h2>
              <p>
                Desde aqui puedes volver a cargar la foto de un color exacto o quitarla si ya no corresponde.
              </p>
            </div>
          </div>

          <div className="grid_fichas">
            {cargando ? (
              <div className="ficha_vacia">Cargando fotos por color...</div>
            ) : fichasColor.length === 0 ? (
              <div className="ficha_vacia">Todavia no hay fotos especificas por color.</div>
            ) : (
              fichasColor.map((ficha) => (
                <article key={`${ficha.modeloBase}-${ficha.colorBase}`} className="ficha_card">
                  {ficha.fotoColor ? (
                    <img src={ficha.fotoColor} alt={`${ficha.modeloBase} ${ficha.colorBase}`} />
                  ) : (
                    <div className="mini_vacio">Sin foto</div>
                  )}
                  <strong>{ficha.modeloBase}</strong>
                  <small className="ficha_color">Color: {ficha.colorBase || "-"}</small>
                  <p>{ficha.descripcionColor || "Sin descripcion del color."}</p>
                  <div className="ficha_acciones">
                    <button type="button" className="btn btn_principal" onClick={() => cargarFichaColor(ficha)}>
                      Cargar
                    </button>
                    <button
                      type="button"
                      className="btn btn_secundario"
                      onClick={() =>
                        quitarFichaColor({
                          modeloBase: ficha.modeloBase,
                          colorBase: ficha.colorBase,
                        })
                      }
                    >
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
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .ficha_vacia,
  .visual_vacio {
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

  .galeria_visual {
    margin-top: 16px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .galeria_color {
    grid-template-columns: minmax(0, 1fr);
  }

  .selector_modelo_catalogo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .selector_modelo_catalogo small {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  .bloque_visual {
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    min-height: 260px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }

  .bloque_visual__titulo {
    width: 100%;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
  }

  .bloque_visual img {
    width: 100%;
    height: 320px;
    object-fit: contain;
    background: #0f0f11;
    padding: 10px;
  }

  .visual_vacio,
  .mini_vacio,
  .ficha_vacia {
    padding: 18px;
    text-align: center;
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
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .ficha_card {
    display: grid;
    gap: 10px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg};
  }

  .ficha_card img {
    width: 100%;
    height: 220px;
    object-fit: contain;
    border-radius: 12px;
    background: #0f0f11;
    padding: 8px;
  }

  .ficha_detalle_vistas {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;
  }

  .ficha_color {
    color: ${({ theme }) => theme.main};
    font-size: 12px;
    font-weight: 700;
  }

  .texto_ayuda_imagen {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;
    line-height: 1.4;
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

  @media (max-width: 900px) {
    .grid_formulario {
      grid-template-columns: 1fr;
    }

    .galeria_visual {
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
