import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, leerCatalogosProduccion, UserAuth } from "../../index";
import {
  confirmarAccionSistema,
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  activarModeloProductoConfiguracion,
  activarVarianteProductoConfiguracion,
  eliminarModeloProductoConfiguracion,
  eliminarVarianteProductoConfiguracion,
  guardarModeloProductoConfiguracion,
  inactivarModeloProductoConfiguracion,
  inactivarVarianteProductoConfiguracion,
  guardarVarianteProductoConfiguracion,
  listarModelosProductoConfiguracion,
  listarVariantesProductoPorModeloConfiguracion,
  listarVariantesProductoPorModeloPaginadasConfiguracion,
} from "../../supabase/configuracionCore.js";
import { leerPerfilUsuario } from "../../utils/perfilUsuario";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const crearFormularioModelo = () => ({
  id: "",
  codigoModelo: "",
  codigoCorto: "",
  nombreModelo: "",
  categoria: "",
  modeloCatalogo: "",
  telaNombre: "",
  estado: "ACTIVO",
});

const crearFormularioVariante = () => ({
  id: "",
  modeloId: "",
  color: "",
  talla: "",
  estado: "ACTIVO",
});

const formatearTallaVisual = (valor = "") =>
  String(valor || "").toUpperCase() === "STANDAR" ? "ST" : valor;

const normalizarTextoFormulario = (valor = "") =>
  String(valor || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const limpiarTokenCodigoFormulario = (valor = "") =>
  normalizarTextoFormulario(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const crearSegmentoCodigoFormulario = (valor = "", longitud = 3) => {
  const limpio = limpiarTokenCodigoFormulario(valor).replace(/\s+/g, "");
  return (limpio.slice(0, longitud) || "X").padEnd(longitud, "X");
};

const construirNombreModeloFormulario = ({
  categoria = "",
  modeloCatalogo = "",
  telaNombre = "",
}) =>
  [categoria, modeloCatalogo, telaNombre]
    .map((item) => normalizarTextoFormulario(item))
    .filter(Boolean)
    .join(" ");

const construirCodigoCortoModeloFormulario = ({
  categoria = "",
  modeloCatalogo = "",
  telaNombre = "",
  nombreModelo = "",
}) => {
  const partesNombre = limpiarTokenCodigoFormulario(nombreModelo).split(" ").filter(Boolean);
  const categoriaSeg = crearSegmentoCodigoFormulario(categoria || partesNombre[0] || "", 3);
  const modeloSeg = crearSegmentoCodigoFormulario(modeloCatalogo || partesNombre[1] || "", 3);
  const telaSeg = crearSegmentoCodigoFormulario(telaNombre || partesNombre[2] || "", 3);
  return `${categoriaSeg}${modeloSeg}${telaSeg}`;
};

const construirCodigoMaestroModeloFormulario = (modelos = [], codigoActual = "") => {
  if (codigoActual) return codigoActual;

  const maximo = modelos.reduce((acumulado, item) => {
    const match = String(item?.codigoModelo || "").match(/^MOD-(\d+)$/);
    if (!match) return acumulado;
    return Math.max(acumulado, Number(match[1] || 0));
  }, 0);

  return `MOD-${String(maximo + 1).padStart(4, "0")}`;
};

const sincronizarCamposModeloFormulario = (base = {}, modelos = []) => {
  const categoria = normalizarTextoFormulario(base?.categoria);
  const modeloCatalogo = normalizarTextoFormulario(base?.modeloCatalogo);
  const telaNombre = normalizarTextoFormulario(base?.telaNombre);
  const nombreManual = normalizarTextoFormulario(base?.nombreModelo);
  const nombreCalculado = construirNombreModeloFormulario({
    categoria,
    modeloCatalogo,
    telaNombre,
  });
  const nombreModelo = nombreCalculado || nombreManual;
  const codigoCorto =
    construirCodigoCortoModeloFormulario({
      categoria,
      modeloCatalogo,
      telaNombre,
      nombreModelo,
    }) || normalizarTextoFormulario(base?.codigoCorto);

  return {
    ...base,
    categoria,
    modeloCatalogo,
    telaNombre,
    nombreModelo,
    codigoCorto,
    codigoModelo: construirCodigoMaestroModeloFormulario(modelos, base?.codigoModelo || ""),
  };
};

const inferirCamposModeloDesdeNombre = (nombreModelo = "", catalogos = {}) => {
  const nombre = String(nombreModelo || "").trim().toUpperCase();
  const palabras = nombre.split(/\s+/).filter(Boolean);

  if (palabras.length === 0) {
    return {
      categoria: "",
      modeloCatalogo: "",
      telaNombre: "",
    };
  }

  const categoriasConocidas = (catalogos?.categorias || [])
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const telasConocidas = [
    ...(catalogos?.telasModelo || []),
    ...(catalogos?.tiposTela || []),
  ]
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const categoriaDetectada =
    categoriasConocidas.find((item) => nombre.startsWith(`${item} `) || nombre === item) ||
    palabras[0] ||
    "";

  let resto = nombre;
  if (categoriaDetectada && resto.startsWith(categoriaDetectada)) {
    resto = resto.slice(categoriaDetectada.length).trim();
  }

  let telaDetectada =
    telasConocidas.find((item) => resto.endsWith(` ${item}`) || resto === item) || "";

  if (!telaDetectada) {
    if (palabras.length >= 3) {
      telaDetectada = palabras.slice(2).join(" ");
    } else if (palabras.length >= 2) {
      telaDetectada = palabras[palabras.length - 1];
    }
  }

  let modeloCatalogo = resto;
  if (telaDetectada && modeloCatalogo.endsWith(telaDetectada)) {
    modeloCatalogo = modeloCatalogo
      .slice(0, modeloCatalogo.length - telaDetectada.length)
      .trim();
  }

  if (!modeloCatalogo) {
    modeloCatalogo = palabras[1] || "";
  }

  return {
    categoria: categoriaDetectada,
    modeloCatalogo: modeloCatalogo || "",
    telaNombre: telaDetectada || "",
  };
};

export function ConfiguracionCatalogoProductos() {
  const TAMANO_PAGINA_VARIANTES = leerFilasPorPaginaSistema();
  const { user } = UserAuth();
  const identidadVisual = resolverIdentidadVisualPorGrupo("Maestros");
  const perfilUsuario = useMemo(() => leerPerfilUsuario(user), [user]);
  const esAdministrador = (perfilUsuario?.rol || "").toUpperCase() === "ADMINISTRADOR";
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const catalogos = useMemo(leerCatalogosProduccion, []);
  const [modelos, setModelos] = useState([]);
  const [variantesModelo, setVariantesModelo] = useState([]);
  const [variantesResumenModelo, setVariantesResumenModelo] = useState([]);
  const [modeloSeleccionadoId, setModeloSeleccionadoId] = useState("");
  const [formularioModelo, setFormularioModelo] = useState(crearFormularioModelo());
  const [formularioVariante, setFormularioVariante] = useState(crearFormularioVariante());
  const [busqueda, setBusqueda] = useState("");
  const [busquedaModeloVariante, setBusquedaModeloVariante] = useState("");
  const [filtroColorVariante, setFiltroColorVariante] = useState("");
  const [filtroTallaVariante, setFiltroTallaVariante] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [paginaVariantes, setPaginaVariantes] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoVariantes, setCargandoVariantes] = useState(false);
  const [totalVariantesModelo, setTotalVariantesModelo] = useState(0);

  const cargarTodo = async () => {
    const listaModelos = await listarModelosProductoConfiguracion({
      incluirInactivos: verInactivos,
    });
    setModelos(listaModelos);
    return listaModelos;
  };

  const refrescarVariantesModelo = async ({
    modelo = null,
    pagina = paginaVariantes,
    color = filtroColorVariante,
    talla = filtroTallaVariante,
  } = {}) => {
    if (!modelo) {
      setVariantesModelo([]);
      setVariantesResumenModelo([]);
      setTotalVariantesModelo(0);
      return;
    }

    const [resumenCompleto, respuesta] = await Promise.all([
      listarVariantesProductoPorModeloConfiguracion({
        modeloId: modelo.id,
        codigoModelo: modelo.codigoModelo,
        nombreModelo: modelo.nombreModelo,
        incluirInactivos: verInactivos,
      }),
      listarVariantesProductoPorModeloPaginadasConfiguracion({
        modeloId: modelo.id,
        codigoModelo: modelo.codigoModelo,
        nombreModelo: modelo.nombreModelo,
        color,
        talla,
        incluirInactivos: verInactivos,
        pagina,
        tamanoPagina: TAMANO_PAGINA_VARIANTES,
      }),
    ]);

    setVariantesResumenModelo(resumenCompleto || []);
    setVariantesModelo(respuesta.registros || []);
    setTotalVariantesModelo(Number(respuesta.total || 0));
  };

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const listaModelos = await listarModelosProductoConfiguracion({
          incluirInactivos: verInactivos,
        });
        if (!activo) return;
        setModelos(listaModelos);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, [verInactivos]);

  const modelosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return modelos;
    return modelos.filter((item) =>
      [
        item.codigoModelo,
        item.nombreModelo,
        item.categoria,
        item.modeloCatalogo,
        item.telaNombre,
      ]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [busqueda, modelos]);

  const modeloSeleccionado = useMemo(
    () => modelos.find((item) => item.id === modeloSeleccionadoId) || null,
    [modelos, modeloSeleccionadoId],
  );
  const variantesDelModelo = useMemo(() => variantesModelo, [variantesModelo]);
  const diagnosticoDuplicadosVariantes = useMemo(() => {
    const mapaCodigoMaestro = new Map();
    const mapaCodigoCorto = new Map();

    (variantesResumenModelo || []).forEach((item) => {
      const codigoMaestro = String(item?.codigoVariante || "").trim().toUpperCase();
      const codigoCorto = String(item?.codigoCorto || "").trim().toUpperCase();

      if (codigoMaestro) {
        if (!mapaCodigoMaestro.has(codigoMaestro)) {
          mapaCodigoMaestro.set(codigoMaestro, []);
        }
        mapaCodigoMaestro.get(codigoMaestro).push(item);
      }

      if (codigoCorto) {
        if (!mapaCodigoCorto.has(codigoCorto)) {
          mapaCodigoCorto.set(codigoCorto, []);
        }
        mapaCodigoCorto.get(codigoCorto).push(item);
      }
    });

    return {
      duplicadosMaestro: Array.from(mapaCodigoMaestro.entries()).filter(
        ([, lista]) => lista.length > 1,
      ),
      duplicadosCortos: Array.from(mapaCodigoCorto.entries()).filter(
        ([, lista]) => lista.length > 1,
      ),
    };
  }, [variantesResumenModelo]);
  const coloresDelModelo = useMemo(
    () =>
      Array.from(
        new Set(variantesResumenModelo.map((item) => item.color).filter(Boolean)),
      ).sort(
        (a, b) => a.localeCompare(b),
      ),
    [variantesResumenModelo],
  );
  const tallasDelModelo = useMemo(
    () =>
      Array.from(
        new Set(variantesResumenModelo.map((item) => item.talla).filter(Boolean)),
      ),
    [variantesResumenModelo],
  );
  const totalPaginasVariantes = Math.max(
    1,
    Math.ceil(totalVariantesModelo / TAMANO_PAGINA_VARIANTES),
  );
  const filtrosActivosVariantes = Boolean(
    filtroColorVariante.trim() || filtroTallaVariante.trim(),
  );

  useEffect(() => {
    let activo = true;

    const cargarVariantes = async () => {
      if (!modeloSeleccionado) {
        if (!activo) return;
        setVariantesModelo([]);
        setVariantesResumenModelo([]);
        setTotalVariantesModelo(0);
        setPaginaVariantes(1);
        return;
      }

      try {
        setCargandoVariantes(true);
        const [resumenCompleto, respuesta] = await Promise.all([
          listarVariantesProductoPorModeloConfiguracion({
            modeloId: modeloSeleccionado.id,
            codigoModelo: modeloSeleccionado.codigoModelo,
            nombreModelo: modeloSeleccionado.nombreModelo,
            incluirInactivos: verInactivos,
          }),
          listarVariantesProductoPorModeloPaginadasConfiguracion({
            modeloId: modeloSeleccionado.id,
            codigoModelo: modeloSeleccionado.codigoModelo,
            nombreModelo: modeloSeleccionado.nombreModelo,
            color: filtroColorVariante,
            talla: filtroTallaVariante,
            incluirInactivos: verInactivos,
            pagina: paginaVariantes,
            tamanoPagina: TAMANO_PAGINA_VARIANTES,
          }),
        ]);
        if (!activo) return;
        setVariantesResumenModelo(resumenCompleto || []);
        setVariantesModelo(respuesta.registros || []);
        setTotalVariantesModelo(Number(respuesta.total || 0));
      } finally {
        if (activo) setCargandoVariantes(false);
      }
    };

    cargarVariantes();
    return () => {
      activo = false;
    };
  }, [
    filtroColorVariante,
    filtroTallaVariante,
    modeloSeleccionado,
    paginaVariantes,
    verInactivos,
  ]);

  useEffect(() => {
    if (paginaVariantes > totalPaginasVariantes) {
      setPaginaVariantes(totalPaginasVariantes);
    }
  }, [paginaVariantes, totalPaginasVariantes]);

  useEffect(() => {
    setModeloSeleccionadoId("");
    setVariantesModelo([]);
    setVariantesResumenModelo([]);
    setTotalVariantesModelo(0);
    setBusquedaModeloVariante("");
    setFiltroColorVariante("");
    setFiltroTallaVariante("");
    setPaginaVariantes(1);
    setFormularioVariante(crearFormularioVariante());
  }, [verInactivos]);

  useEffect(() => {
    if (!modeloSeleccionadoId) return;
    setPaginaVariantes(1);
  }, [filtroColorVariante, filtroTallaVariante, modeloSeleccionadoId]);

  const manejarCambioModelo = (campo, valor) => {
    const valorNormalizado =
      campo === "estado" ? valor.toUpperCase() : normalizarTextoFormulario(valor);

    setFormularioModelo((anterior) => {
      const siguiente = {
        ...anterior,
        [campo]: valorNormalizado,
      };

      if (["categoria", "modeloCatalogo", "telaNombre"].includes(campo)) {
        return sincronizarCamposModeloFormulario(siguiente, modelos);
      }

      if (campo === "nombreModelo") {
        return {
          ...siguiente,
          codigoCorto:
            construirCodigoCortoModeloFormulario({
              categoria: siguiente.categoria,
              modeloCatalogo: siguiente.modeloCatalogo,
              telaNombre: siguiente.telaNombre,
              nombreModelo: valorNormalizado,
            }) || siguiente.codigoCorto,
          codigoModelo: construirCodigoMaestroModeloFormulario(modelos, siguiente.codigoModelo),
        };
      }

      return siguiente;
    });
  };

  const completarCamposDesdeNombre = (modelo = null) => {
    const nombreBase = modelo?.nombreModelo || formularioModelo?.nombreModelo || "";
    if (!nombreBase) {
      return;
    }

    const inferidos = inferirCamposModeloDesdeNombre(nombreBase, catalogos);

    setFormularioModelo((anterior) =>
      sincronizarCamposModeloFormulario(
        {
          ...anterior,
          categoria: anterior.categoria || inferidos.categoria || "",
          modeloCatalogo: anterior.modeloCatalogo || inferidos.modeloCatalogo || "",
          telaNombre: anterior.telaNombre || inferidos.telaNombre || "",
          nombreModelo: nombreBase,
        },
        modelos,
      ),
    );
  };

  const manejarCambioVariante = (campo, valor) => {
    setFormularioVariante((anterior) => ({
      ...anterior,
      [campo]: campo === "modeloId" ? valor : valor.toUpperCase(),
    }));
  };

  const limpiarModelo = () =>
    setFormularioModelo(
      sincronizarCamposModeloFormulario(crearFormularioModelo(), modelos),
    );
  const limpiarVariante = () =>
    setFormularioVariante((anterior) => ({
      ...crearFormularioVariante(),
      modeloId: modeloSeleccionadoId || "",
    }));

  const guardarModelo = async () => {
    if (!formularioModelo.nombreModelo.trim()) {
      await mostrarAlertaSistema("Ingresa el nombre del modelo.");
      return;
    }
    try {
      setGuardando(true);
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: formularioModelo.id
          ? "Actualizando modelo del catalogo..."
          : "Guardando modelo del catalogo...",
        mensajeExito: formularioModelo.id
          ? "Modelo actualizado en el catalogo."
          : "Modelo guardado en el catalogo.",
        mensajeError: "No se pudo guardar el modelo del catalogo.",
        accion: async () => {
          const guardado = await guardarModeloProductoConfiguracion(formularioModelo);
          const listaModelosActualizada = await cargarTodo();
          const modeloActualizado =
            listaModelosActualizada.find((item) => item.id === guardado.id) || guardado;
          setModeloSeleccionadoId(modeloActualizado.id);
          setFormularioModelo(
            sincronizarCamposModeloFormulario(
              {
                id: modeloActualizado.id || "",
                codigoModelo: modeloActualizado.codigoModelo || "",
                codigoCorto: modeloActualizado.codigoCorto || "",
                nombreModelo: modeloActualizado.nombreModelo || "",
                categoria: modeloActualizado.categoria || "",
                modeloCatalogo: modeloActualizado.modeloCatalogo || "",
                telaNombre: modeloActualizado.telaNombre || "",
                estado: modeloActualizado.estado || "ACTIVO",
              },
              listaModelosActualizada,
            ),
          );
          setBusquedaModeloVariante(
            `${modeloActualizado.codigoModelo || "-"} | ${modeloActualizado.codigoCorto || "-"} | ${
              modeloActualizado.nombreModelo || ""
            }`,
          );
          setFormularioVariante((anterior) => ({
            ...anterior,
            modeloId: modeloActualizado.id,
          }));
          await refrescarVariantesModelo({
            modelo: modeloActualizado,
            pagina: 1,
            color: "",
            talla: "",
          });
          setPaginaVariantes(1);
        },
      });
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar el modelo: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const guardarVariante = async () => {
    if (!formularioVariante.modeloId) {
      await mostrarAlertaSistema("Primero selecciona un modelo.");
      return;
    }
    if (!formularioVariante.color.trim() || !formularioVariante.talla.trim()) {
      await mostrarAlertaSistema("Completa color y talla.");
      return;
    }
    try {
      setGuardando(true);
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Guardando variante del catalogo...",
        mensajeExito: "Variante guardada.",
        mensajeError: "No se pudo guardar la variante.",
        accion: async () => {
          await guardarVarianteProductoConfiguracion(formularioVariante);
          if (modeloSeleccionado) {
            const respuesta = await listarVariantesProductoPorModeloPaginadasConfiguracion({
              modeloId: modeloSeleccionado.id,
              codigoModelo: modeloSeleccionado.codigoModelo,
              nombreModelo: modeloSeleccionado.nombreModelo,
              color: filtroColorVariante,
              talla: filtroTallaVariante,
              incluirInactivos: verInactivos,
              pagina: 1,
              tamanoPagina: TAMANO_PAGINA_VARIANTES,
            });
            const resumenCompleto = await listarVariantesProductoPorModeloConfiguracion({
              modeloId: modeloSeleccionado.id,
              codigoModelo: modeloSeleccionado.codigoModelo,
              nombreModelo: modeloSeleccionado.nombreModelo,
              incluirInactivos: verInactivos,
            });
            setVariantesResumenModelo(resumenCompleto || []);
            setVariantesModelo(respuesta.registros || []);
            setTotalVariantesModelo(Number(respuesta.total || 0));
            setPaginaVariantes(1);
          }
          limpiarVariante();
        },
      });
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar la variante: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cargarModelo = (item) => {
    setFormularioModelo(
      sincronizarCamposModeloFormulario(
        {
          id: item.id || "",
          codigoModelo: item.codigoModelo || "",
          codigoCorto: item.codigoCorto || "",
          nombreModelo: item.nombreModelo || "",
          categoria: item.categoria || "",
          modeloCatalogo: item.modeloCatalogo || "",
          telaNombre: item.telaNombre || "",
          estado: item.estado || "ACTIVO",
        },
        modelos,
      ),
    );
    const camposFaltantes =
      !item.categoria || !item.modeloCatalogo || !item.telaNombre;
    setModeloSeleccionadoId(item.id || "");
    setBusquedaModeloVariante(
      `${item.codigoModelo || "-"} | ${item.codigoCorto || "-"} | ${item.nombreModelo || ""}`,
    );
    setFiltroColorVariante("");
    setFiltroTallaVariante("");
    setPaginaVariantes(1);
    setFormularioVariante((anterior) => ({
      ...anterior,
      modeloId: item.id || "",
    }));
    if (camposFaltantes) {
      setTimeout(() => completarCamposDesdeNombre(item), 0);
    }
  };

  const cargarVariante = (item) => {
    setFormularioVariante({
      id: item.id || "",
      modeloId: item.modeloId || "",
      color: item.color || "",
      talla: formatearTallaVisual(item.talla || ""),
      estado: item.estado || "ACTIVO",
    });
    setModeloSeleccionadoId(item.modeloId || "");
    const modelo = modelos.find((registro) => registro.id === item.modeloId);
    if (modelo) {
      setBusquedaModeloVariante(
        `${modelo.codigoModelo || "-"} | ${modelo.codigoCorto || "-"} | ${modelo.nombreModelo || ""}`,
      );
    }
    setFiltroColorVariante("");
    setFiltroTallaVariante("");
    setPaginaVariantes(1);
  };

  const seleccionarModeloDesdeBusqueda = (valor) => {
    setBusquedaModeloVariante(valor);
    const texto = valor.trim().toUpperCase();
    if (!texto) {
      setModeloSeleccionadoId("");
      setVariantesModelo([]);
      setVariantesResumenModelo([]);
      setTotalVariantesModelo(0);
      setPaginaVariantes(1);
      setFiltroColorVariante("");
      setFiltroTallaVariante("");
      setFormularioVariante((anterior) => ({
        ...anterior,
        modeloId: "",
      }));
      return;
    }

    const codigoBuscado = texto.split("|")[0]?.trim() || texto;
    const encontrado =
      modelos.find((item) => item.codigoModelo === codigoBuscado) ||
      modelos.find((item) => item.codigoCorto === codigoBuscado) ||
      modelos.find((item) => item.nombreModelo === texto) ||
      modelos.find((item) =>
        [item.codigoModelo, item.codigoCorto, item.nombreModelo]
          .join(" ")
          .toUpperCase()
          .includes(texto),
      );

    if (!encontrado) return;

    setModeloSeleccionadoId(encontrado.id || "");
    setFiltroColorVariante("");
    setFiltroTallaVariante("");
    setPaginaVariantes(1);
    setFormularioVariante((anterior) => ({
      ...anterior,
      modeloId: encontrado.id || "",
    }));
  };

  const inactivarModelo = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas inactivar ${item.nombreModelo}? Dejara de mostrarse en el catalogo activo.`,
      { titulo: "Inactivar modelo", confirmarTexto: "Inactivar" }
    );
    if (!confirmar) return;
    try {
      setGuardando(true);
      await inactivarModeloProductoConfiguracion(item.id);
      await cargarTodo();
      if (modeloSeleccionadoId === item.id) {
        setModeloSeleccionadoId("");
        setVariantesModelo([]);
        setVariantesResumenModelo([]);
        setTotalVariantesModelo(0);
        setPaginaVariantes(1);
        setFiltroColorVariante("");
        setFiltroTallaVariante("");
        limpiarVariante();
      }
      if (formularioModelo.id === item.id) limpiarModelo();
    } catch (error) {
      mostrarErrorSistema(`No se pudo inactivar el modelo: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarModelo = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Eliminar definitivamente ${item.nombreModelo}? Esta accion no se puede deshacer.`,
      { titulo: "Eliminar modelo", icono: "warning", confirmarTexto: "Eliminar" }
    );
    if (!confirmar) return;
    try {
      setGuardando(true);
      await eliminarModeloProductoConfiguracion(item.id);
      await cargarTodo();
      if (modeloSeleccionadoId === item.id) {
        setModeloSeleccionadoId("");
        setVariantesModelo([]);
        setVariantesResumenModelo([]);
        setTotalVariantesModelo(0);
        setPaginaVariantes(1);
        setFiltroColorVariante("");
        setFiltroTallaVariante("");
        limpiarVariante();
      }
      if (formularioModelo.id === item.id) limpiarModelo();
    } catch (error) {
      mostrarErrorSistema(`No se pudo eliminar el modelo: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const inactivarVariante = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas inactivar ${item.descripcionVariante}?`,
      { titulo: "Inactivar variante", confirmarTexto: "Inactivar" }
    );
    if (!confirmar) return;
    try {
      setGuardando(true);
      await inactivarVarianteProductoConfiguracion(item.id);
      if (modeloSeleccionado) {
        const [resumenCompleto, respuesta] = await Promise.all([
          listarVariantesProductoPorModeloConfiguracion({
            modeloId: modeloSeleccionado.id,
            codigoModelo: modeloSeleccionado.codigoModelo,
            nombreModelo: modeloSeleccionado.nombreModelo,
            incluirInactivos: verInactivos,
          }),
          listarVariantesProductoPorModeloPaginadasConfiguracion({
            modeloId: modeloSeleccionado.id,
            codigoModelo: modeloSeleccionado.codigoModelo,
            nombreModelo: modeloSeleccionado.nombreModelo,
            color: filtroColorVariante,
            talla: filtroTallaVariante,
            incluirInactivos: verInactivos,
            pagina: paginaVariantes,
            tamanoPagina: TAMANO_PAGINA_VARIANTES,
          }),
        ]);
        setVariantesResumenModelo(resumenCompleto || []);
        setVariantesModelo(respuesta.registros || []);
        setTotalVariantesModelo(Number(respuesta.total || 0));
      }
      if (formularioVariante.id === item.id) limpiarVariante();
    } catch (error) {
      mostrarErrorSistema(`No se pudo inactivar la variante: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarVariante = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Eliminar definitivamente ${item.descripcionVariante}? Esta accion no se puede deshacer.`,
      { titulo: "Eliminar variante", icono: "warning", confirmarTexto: "Eliminar" }
    );
    if (!confirmar) return;
    try {
      setGuardando(true);
      await eliminarVarianteProductoConfiguracion(item.id);
      if (modeloSeleccionado) {
        const [resumenCompleto, respuesta] = await Promise.all([
          listarVariantesProductoPorModeloConfiguracion({
            modeloId: modeloSeleccionado.id,
            codigoModelo: modeloSeleccionado.codigoModelo,
            nombreModelo: modeloSeleccionado.nombreModelo,
            incluirInactivos: verInactivos,
          }),
          listarVariantesProductoPorModeloPaginadasConfiguracion({
            modeloId: modeloSeleccionado.id,
            codigoModelo: modeloSeleccionado.codigoModelo,
            nombreModelo: modeloSeleccionado.nombreModelo,
            color: filtroColorVariante,
            talla: filtroTallaVariante,
            incluirInactivos: verInactivos,
            pagina: paginaVariantes,
            tamanoPagina: TAMANO_PAGINA_VARIANTES,
          }),
        ]);
        setVariantesResumenModelo(resumenCompleto || []);
        setVariantesModelo(respuesta.registros || []);
        setTotalVariantesModelo(Number(respuesta.total || 0));
      }
      if (formularioVariante.id === item.id) limpiarVariante();
    } catch (error) {
      mostrarErrorSistema(`No se pudo eliminar la variante: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const reactivarModelo = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas reactivar ${item.nombreModelo}? Volvera a mostrarse en el catalogo activo.`,
      { titulo: "Reactivar modelo", confirmarTexto: "Reactivar" }
    );
    if (!confirmar) return;
    try {
      setGuardando(true);
      await activarModeloProductoConfiguracion(item.id);
      await cargarTodo();
      if (modeloSeleccionadoId === item.id) {
        const actualizado = { ...item, estado: "ACTIVO" };
        setFormularioModelo((anterior) => ({ ...anterior, estado: "ACTIVO" }));
        setModeloSeleccionadoId(actualizado.id || "");
      }
    } catch (error) {
      mostrarErrorSistema(`No se pudo reactivar el modelo: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const reactivarVariante = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas reactivar ${item.descripcionVariante}?`,
      { titulo: "Reactivar variante", confirmarTexto: "Reactivar" }
    );
    if (!confirmar) return;
    try {
      setGuardando(true);
      await activarVarianteProductoConfiguracion(item.id);
      if (modeloSeleccionado) {
        const [resumenCompleto, respuesta] = await Promise.all([
          listarVariantesProductoPorModeloConfiguracion({
            modeloId: modeloSeleccionado.id,
            codigoModelo: modeloSeleccionado.codigoModelo,
            nombreModelo: modeloSeleccionado.nombreModelo,
            incluirInactivos: verInactivos,
          }),
          listarVariantesProductoPorModeloPaginadasConfiguracion({
            modeloId: modeloSeleccionado.id,
            codigoModelo: modeloSeleccionado.codigoModelo,
            nombreModelo: modeloSeleccionado.nombreModelo,
            color: filtroColorVariante,
            talla: filtroTallaVariante,
            incluirInactivos: verInactivos,
            pagina: paginaVariantes,
            tamanoPagina: TAMANO_PAGINA_VARIANTES,
          }),
        ]);
        setVariantesResumenModelo(resumenCompleto || []);
        setVariantesModelo(respuesta.registros || []);
        setTotalVariantesModelo(Number(respuesta.total || 0));
      }
      if (formularioVariante.id === item.id) {
        setFormularioVariante((anterior) => ({ ...anterior, estado: "ACTIVO" }));
      }
    } catch (error) {
      mostrarErrorSistema(`No se pudo reactivar la variante: ${error.message}`);
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
          <h1>Catalogo de productos</h1>
          <p>
            Aqui vive el maestro oficial de modelos, colores y tallas. Stock, ventas y
            pedidos deben consultar este catalogo para no repetir codigos.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Modelo base</h2>
              <p>
                Aqui puedes crear o corregir modelos. Si llenas categoria, modelo corto y
                tela para nombre, el nombre comercial y los codigos se completan solos.
              </p>
            </div>
          </div>

          <div className="acciones acciones_superiores">
            <label className="check_inactivos">
              <input
                type="checkbox"
                checked={verInactivos}
                onChange={(e) => setVerInactivos(e.target.checked)}
              />
              <span>Ver inactivos</span>
            </label>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Nombre comercial</label>
              <input
                value={formularioModelo.nombreModelo}
                onChange={(e) => manejarCambioModelo("nombreModelo", e.target.value)}
                placeholder="Se arma automatico desde categoria + modelo + tela"
              />
            </Campo>
            <Campo>
              <label>Categoria</label>
              <input
                list="catalogo-categorias-producto"
                value={formularioModelo.categoria}
                onChange={(e) => manejarCambioModelo("categoria", e.target.value)}
              />
              <datalist id="catalogo-categorias-producto">
                {(catalogos.categorias || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Modelo corto</label>
              <input
                list="catalogo-modelos-producto"
                value={formularioModelo.modeloCatalogo}
                onChange={(e) =>
                  manejarCambioModelo("modeloCatalogo", e.target.value)
                }
              />
              <datalist id="catalogo-modelos-producto">
                {(catalogos.modelos || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Tela para nombre</label>
              <input
                list="catalogo-telas-producto"
                value={formularioModelo.telaNombre}
                onChange={(e) => manejarCambioModelo("telaNombre", e.target.value)}
              />
              <datalist id="catalogo-telas-producto">
                {(catalogos.telasModelo || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Estado</label>
              <select
                value={formularioModelo.estado}
                onChange={(e) => manejarCambioModelo("estado", e.target.value)}
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </Campo>
            <Campo>
              <label>Codigo corto para salidas</label>
              <input
                value={formularioModelo.codigoCorto || ""}
                placeholder="Se genera automatico"
                readOnly
              />
            </Campo>
            <Campo>
              <label>Codigo maestro</label>
              <input
                value={formularioModelo.codigoModelo}
                placeholder="Se genera automatico"
                readOnly
              />
            </Campo>
          </div>

          <div className="acciones">
            <button type="button" className="btn btn_secundario" onClick={limpiarModelo}>
              Limpiar
            </button>
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() => completarCamposDesdeNombre()}
            >
              Completar desde nombre
            </button>
            <button type="button" className="btn btn_principal" onClick={guardarModelo} disabled={guardando}>
              {guardando
                ? formularioModelo.id
                  ? "Actualizando..."
                  : "Guardando..."
                : formularioModelo.id
                  ? "Actualizar modelo"
                  : "Guardar modelo"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Variantes del modelo</h2>
              <p>
                Selecciona un modelo y registra sus colores y tallas. Aqui es donde se
                corrige si aparece un color nuevo o una talla nueva.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo className="campo-completo">
              <label>Buscar modelo por codigo o nombre</label>
              <input
                type="text"
                list="catalogo-modelos-variantes"
                value={busquedaModeloVariante}
                onChange={(e) => seleccionarModeloDesdeBusqueda(e.target.value)}
                placeholder="Ejemplo: MOD-0098 o LEGCLAFRE o LEGGINS CLASICO FRENCH"
              />
              <datalist id="catalogo-modelos-variantes">
                {modelos.map((item) => (
                  <option
                    key={item.id}
                    value={`${item.codigoModelo || "-"} | ${item.codigoCorto || "-"} | ${item.nombreModelo || ""}`}
                  />
                ))}
              </datalist>
            </Campo>
            <Campo className="campo-completo">
              <label>Modelo seleccionado</label>
              <div className="resumen_modelo_seleccionado">
                <strong>
                  {modeloSeleccionado
                    ? `${modeloSeleccionado.codigoModelo} | ${modeloSeleccionado.codigoCorto || "-"}`
                    : "Sin modelo seleccionado"}
                </strong>
                <span>{modeloSeleccionado?.nombreModelo || "Busca un modelo para ver sus variantes."}</span>
                {modeloSeleccionado ? (
                  <span>{totalVariantesModelo} variantes registradas</span>
                ) : null}
              </div>
            </Campo>
            <Campo className="campo-completo">
              <label>Colores y tallas registradas</label>
              <div className="resumen_variantes_catalogo">
                <div className="resumen_variantes_catalogo__bloque">
                  <strong>Colores</strong>
                  <div className="chips_catalogo">
                    {coloresDelModelo.length === 0 ? (
                      <span className="chip_catalogo chip_catalogo_vacio">Sin colores cargados</span>
                    ) : (
                      coloresDelModelo.map((color) => (
                        <span key={color} className="chip_catalogo">{color}</span>
                      ))
                    )}
                  </div>
                </div>
                <div className="resumen_variantes_catalogo__bloque">
                  <strong>Tallas</strong>
                  <div className="chips_catalogo">
                    {tallasDelModelo.length === 0 ? (
                      <span className="chip_catalogo chip_catalogo_vacio">Sin tallas cargadas</span>
                    ) : (
                      tallasDelModelo.map((talla) => (
                        <span key={talla} className="chip_catalogo">
                          {formatearTallaVisual(talla)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="resumen_variantes_catalogo__bloque">
                  <strong>Diagnostico</strong>
                  <div className="chips_catalogo">
                    <span className="chip_catalogo">
                      Maestro repetidos: {diagnosticoDuplicadosVariantes.duplicadosMaestro.length}
                    </span>
                    <span className="chip_catalogo">
                      Cortos repetidos: {diagnosticoDuplicadosVariantes.duplicadosCortos.length}
                    </span>
                  </div>
                </div>
              </div>
            </Campo>
            <Campo>
              <label>Filtrar color</label>
              <input
                list="catalogo-colores-modelo"
                value={filtroColorVariante}
                onChange={(e) => setFiltroColorVariante(e.target.value.toUpperCase())}
                placeholder="Ejemplo: NEGRO"
              />
              <datalist id="catalogo-colores-modelo">
                {coloresDelModelo.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Filtrar talla</label>
              <input
                list="catalogo-tallas-modelo"
                value={formatearTallaVisual(filtroTallaVariante)}
                onChange={(e) => setFiltroTallaVariante(e.target.value.toUpperCase())}
                placeholder="Ejemplo: M"
              />
              <datalist id="catalogo-tallas-modelo">
                {tallasDelModelo.map((item) => (
                  <option key={item} value={formatearTallaVisual(item)} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Color</label>
              <input
                list="catalogo-colores-producto"
                value={formularioVariante.color}
                onChange={(e) => manejarCambioVariante("color", e.target.value)}
              />
              <datalist id="catalogo-colores-producto">
                {(catalogos.colores || []).map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Talla</label>
              <input
                list="catalogo-tallas-producto"
                value={formatearTallaVisual(formularioVariante.talla)}
                onChange={(e) => manejarCambioVariante("talla", e.target.value)}
              />
              <datalist id="catalogo-tallas-producto">
                {(catalogos.tallas || []).concat("ST").map((item) => (
                  <option key={item} value={formatearTallaVisual(item)} />
                ))}
              </datalist>
            </Campo>
            <Campo>
              <label>Estado</label>
              <select
                value={formularioVariante.estado}
                onChange={(e) => manejarCambioVariante("estado", e.target.value)}
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </Campo>
          </div>

          <div className="acciones">
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() => {
                setFiltroColorVariante("");
                setFiltroTallaVariante("");
              }}
            >
              Limpiar filtros
            </button>
            <button type="button" className="btn btn_secundario" onClick={limpiarVariante}>
              Limpiar
            </button>
            <button type="button" className="btn btn_principal" onClick={guardarVariante} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar variante"}
            </button>
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Codigo corto salida</th>
                  <th>Codigo maestro</th>
                  <th>Modelo</th>
                  <th>Color</th>
                  <th>Talla</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {cargandoVariantes ? (
                  <tr>
                    <td colSpan="7" className="sin_datos">
                      Cargando variantes del modelo...
                    </td>
                  </tr>
                ) : variantesDelModelo.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="sin_datos">
                      {modeloSeleccionadoId
                        ? "Este modelo todavia no tiene variantes cargadas."
                        : "Selecciona un modelo para ver sus variantes."}
                    </td>
                  </tr>
                ) : (
                  variantesDelModelo.map((item) => (
                    <tr
                      key={item.id}
                      className={
                        filtrosActivosVariantes
                          ? "fila_variante_destacada"
                          : ""
                      }
                    >
                      <td>{item.codigoCorto || "-"}</td>
                      <td>{item.codigoVariante}</td>
                      <td>{item.nombreModelo}</td>
                      <td>{item.color}</td>
                      <td>{formatearTallaVisual(item.talla)}</td>
                      <td>{item.estado}</td>
                      <td>
                        <button type="button" className="btn btn_secundario btn_inline" onClick={() => cargarVariante(item)}>
                          Cargar
                        </button>
                        {item.estado === "INACTIVO" ? (
                          <button type="button" className="btn btn_principal btn_inline" onClick={() => reactivarVariante(item)}>
                            Reactivar
                          </button>
                        ) : esAdministrador ? (
                          <button type="button" className="btn btn_secundario btn_inline" onClick={() => inactivarVariante(item)}>
                            Inactivar
                          </button>
                        ) : null}
                        {esAdministrador ? (
                          <button type="button" className="btn btn_peligro btn_inline" onClick={() => eliminarVariante(item)}>
                            Eliminar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="paginacion_variantes">
            <span>
              {totalVariantesModelo === 0
                ? "0 variantes"
                : `${(paginaVariantes - 1) * TAMANO_PAGINA_VARIANTES + 1}-${
                    Math.min(
                      paginaVariantes * TAMANO_PAGINA_VARIANTES,
                      totalVariantesModelo,
                    )
                  } de ${totalVariantesModelo} ${
                    filtrosActivosVariantes ? "coincidencias" : "variantes"
                  }`}
            </span>
            <div className="paginacion_variantes__acciones">
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() => setPaginaVariantes((valor) => Math.max(1, valor - 1))}
                disabled={paginaVariantes <= 1}
              >
                Anterior
              </button>
              <strong>
                Pagina {paginaVariantes} / {totalPaginasVariantes}
              </strong>
              <button
                type="button"
                className="btn btn_secundario"
                onClick={() =>
                  setPaginaVariantes((valor) => Math.min(totalPaginasVariantes, valor + 1))
                }
                disabled={paginaVariantes >= totalPaginasVariantes}
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Modelos registrados</h2>
              <p>
                El `codigo corto salida` es el que usaran para escribir rapido en salidas.
                El `codigo maestro` queda como referencia tecnica interna del sistema.
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
                  <th>Codigo corto salida</th>
                  <th>Codigo maestro</th>
                  <th>Nombre</th>
                  <th>Categoria</th>
                  <th>Modelo corto</th>
                  <th>Tela</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="9" className="sin_datos">Cargando catalogo...</td>
                  </tr>
                ) : modelosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="sin_datos">Todavia no hay modelos registrados.</td>
                  </tr>
                ) : (
                  modelosFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td>{item.codigoCorto || "-"}</td>
                      <td>{item.codigoModelo}</td>
                      <td>{item.nombreModelo}</td>
                      <td>{item.categoria || "-"}</td>
                      <td>{item.modeloCatalogo || "-"}</td>
                      <td>{item.telaNombre || "-"}</td>
                      <td>{item.origenCarga || "-"}</td>
                      <td>{item.estado}</td>
                      <td>
                        <button type="button" className="btn btn_secundario btn_inline" onClick={() => cargarModelo(item)}>
                          Cargar
                        </button>
                        {item.estado === "INACTIVO" ? (
                          <button type="button" className="btn btn_principal btn_inline" onClick={() => reactivarModelo(item)}>
                            Reactivar
                          </button>
                        ) : esAdministrador ? (
                          <button type="button" className="btn btn_secundario btn_inline" onClick={() => inactivarModelo(item)}>
                            Inactivar
                          </button>
                        ) : null}
                        {esAdministrador ? (
                          <button type="button" className="btn btn_peligro btn_inline" onClick={() => eliminarModelo(item)}>
                            Eliminar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="acciones">
            <Link to="/configurar" className="btn btn_secundario btn_enlace">
              Volver a Configuracion
            </Link>
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
      linear-gradient(135deg, var(--modulo-fondo, rgba(15, 118, 110, 0.12)) 0%, ${({ theme }) => theme.bgcards} 100%);
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
  }

  .contenido {
    display: grid;
    gap: 16px;
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

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .acciones_superiores {
    justify-content: flex-start;
    margin-top: 0;
    margin-bottom: 16px;
  }

  .check_inactivos {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
  }

  .check_inactivos input {
    width: auto;
  }

  .paginacion_variantes {
    margin-top: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .paginacion_variantes__acciones {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .resumen_modelo_seleccionado,
  .resumen_variantes_catalogo {
    display: grid;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
  }

  .resumen_modelo_seleccionado strong,
  .resumen_variantes_catalogo__bloque strong {
    color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    font-size: 14px;
  }

  .resumen_modelo_seleccionado span {
    color: ${({ theme }) => theme.text};
    font-size: 14px;
  }

  .resumen_variantes_catalogo__bloque {
    display: grid;
    gap: 8px;
  }

  .chips_catalogo {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip_catalogo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    font-size: 12px;
    font-weight: 700;
  }

  .chip_catalogo_vacio {
    opacity: 0.7;
  }

  input,
  select {
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
    margin-top: 16px;
    max-height: 420px;
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

  .fila_variante_destacada td {
    background: rgba(170, 23, 196, 0.08);
  }

  .btn {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
  }

  .btn_principal {
    background: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .btn_secundario {
    background: #5b5b60;
    color: #ffffff;
  }

  .btn_enlace {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn_peligro {
    background: #8f1d2c;
    color: #ffffff;
  }

  .btn_inline {
    margin-right: 8px;
    margin-bottom: 8px;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
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



