import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header, UserAuth } from "../../index";
import {
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  crearEstadoHabilitadoTaller,
  guardarHabilitadoTaller,
  leerHabilitadoTaller,
  obtenerEstadoVisualHabilitado,
  obtenerFaltantesHabilitado,
} from "../../utils/habilitadoTaller";
import { obtenerNombreResponsableActivo } from "../../utils/responsableActivo";
import {
  calcularCostoPrendaDesdeLargo,
  leerFichasElasticosModelo,
  obtenerReferenciaElasticoPorAncho,
  obtenerTallasFichaElastico,
} from "../../utils/elasticosModelo";
import {

  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_CABECERA_SALIDA_TALLER = "cynara_cabecera_salida_taller";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();
const TALLAS_BASE = ["S", "M", "L", "XL", "XXL"];

const leerListaGuardada = (clave) => {
  const contenido = localStorage.getItem(clave);

  if (!contenido) {
    return [];
  }

  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

const leerDatoGuardado = (clave) => {
  const contenido = localStorage.getItem(clave);

  if (!contenido) {
    return null;
  }

  try {
    return JSON.parse(contenido);
  } catch {
    return null;
  }
};

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const calcularTotalesPorTalla = (filas = []) =>
  TALLAS_BASE.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: filas.reduce(
        (total, fila) => total + Number(fila?.salidas?.[talla] || 0),
        0
      ),
    }),
    {}
  );

const crearTotalesPorTallaVacio = () =>
  TALLAS_BASE.reduce(
    (acumulado, talla) => ({
      ...acumulado,
      [talla]: 0,
    }),
    {}
  );

const crearSalidasDerivadoInicial = () => ({
  S: "",
  M: "",
  L: "",
  XL: "",
  XXL: "",
});

const normalizarClaveDerivado = (valor = "") =>
  valor
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const agruparProductosDerivados = (productosDerivados = []) => {
  const mapa = new Map();

  productosDerivados.forEach((derivado, indice) => {
    const claveAgrupacion = [
      normalizarClaveDerivado(derivado?.modeloBase || ""),
      normalizarClaveDerivado(derivado?.tipoTela || ""),
    ]
      .filter(Boolean)
      .join("__") || `DERIVADO_${indice + 1}`;

    const actual = mapa.get(claveAgrupacion) || {
      id: claveAgrupacion,
      modeloBase: derivado?.modeloBase || "",
      tipoTela: derivado?.tipoTela || "",
      colorBase: derivado?.colorBase || "",
      coloresBase: [],
      salidas: crearSalidasDerivadoInicial(),
    };

    if (derivado?.colorBase) {
      actual.coloresBase = Array.from(
        new Set([...(actual.coloresBase || []), derivado.colorBase])
      );
    }

    const salidasActuales = {
      ...crearSalidasDerivadoInicial(),
      ...(derivado?.salidas || {}),
      ...(derivado?.cantidad ? { S: derivado.cantidad } : {}),
    };

    TALLAS_BASE.forEach((talla) => {
      actual.salidas[talla] = String(
        Number(actual.salidas?.[talla] || 0) + Number(salidasActuales?.[talla] || 0)
      );
    });

    actual.colorBase =
      actual.coloresBase.length <= 1
        ? actual.coloresBase[0] || actual.colorBase || ""
        : "VARIOS";

    mapa.set(claveAgrupacion, actual);
  });

  return Array.from(mapa.values());
};

const construirOpsHabilitado = () => {
  const cortes = leerListaGuardada(CLAVE_HISTORIAL_CORTES).filter(
    (corte) => corte?.estado === "confirmado" && !corte?.cancelado
  );
  const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER);
  const habilitadoGuardado = leerHabilitadoTaller();
  const guardadoPorId = new Map(
    habilitadoGuardado.map((item) => [item?.id || item?.codigoOp || "", item])
  );

  return cortes
    .flatMap((corte) => {
      const cabecera = corte?.cabeceraCorte || {};
      const codigoOp = cabecera?.codigoCorte || cabecera?.opOrigen || "";

      if (!codigoOp) {
        return [];
      }

      const salidasOp = salidas.filter(
        (item) => item?.tipoRegistro === "envio_taller" && item?.codigoOp === codigoOp
      );
      const productosDerivados = agruparProductosDerivados(
        Array.isArray(cabecera?.productosDerivados) ? cabecera.productosDerivados : []
      );
      const itemPrincipalId = `${codigoOp}-principal`;
      const baseGuardada =
        guardadoPorId.get(itemPrincipalId) ||
        guardadoPorId.get(codigoOp) ||
        salidas.find((item) => item?.id === itemPrincipalId || item?.codigoOp === codigoOp) ||
        {};
      const talleres = Array.from(
        new Set(
          salidasOp
            .map((item) => item?.nombreTaller || "")
            .filter(Boolean)
        )
      );
      const fechaUltimaSalida = salidasOp
        .map((item) => item?.fechaEnvio || "")
        .sort((a, b) => b.localeCompare(a))[0] || "";

      const items = [
        crearEstadoHabilitadoTaller({
          ...baseGuardada,
          id: itemPrincipalId,
          codigoOp,
          pedidoOrigen: cabecera?.pedidoOrigen || "",
          modeloBase: cabecera?.modeloBase || "",
          tipoSalida: "PRINCIPAL",
          productoDerivado: false,
          fechaCorte: cabecera?.fechaCorte || "",
          totalesPorTalla: calcularTotalesPorTalla(corte?.filasCorte || []),
          productosDerivados,
          talleres,
          enviadoTaller: salidasOp.some(
            (item) =>
              item?.id === itemPrincipalId ||
              (!item?.tipoSalida && item?.codigoOp === codigoOp)
          ),
          fechaUltimaSalida,
        }),
      ];

      productosDerivados.forEach((derivado, indice) => {
        const itemId = `${codigoOp}-derivado-${derivado.id || indice + 1}`;
        const guardadoDerivado =
          guardadoPorId.get(itemId) ||
          salidas.find((item) => item?.id === itemId) ||
          {};
        const salidasDerivado = {
          ...crearSalidasDerivadoInicial(),
          ...(derivado?.salidas || {}),
          ...(derivado?.cantidad ? { S: derivado.cantidad } : {}),
        };

        items.push(
          crearEstadoHabilitadoTaller({
            ...guardadoDerivado,
            id: itemId,
            codigoOp,
            pedidoOrigen: cabecera?.pedidoOrigen || "",
            modeloBase: derivado?.modeloBase || "-",
            tipoSalida: "DERIVADO",
            productoDerivado: true,
            tipoTela: derivado?.tipoTela || "",
            colorBase: derivado?.colorBase || "",
            fechaCorte: cabecera?.fechaCorte || "",
            totalesPorTalla: TALLAS_BASE.reduce(
              (acumulado, talla) => ({
                ...acumulado,
                [talla]: Number(salidasDerivado?.[talla] || 0),
              }),
              crearTotalesPorTallaVacio()
            ),
            productosDerivados: [derivado],
            talleres,
            enviadoTaller: salidasOp.some((item) => item?.id === itemId),
            fechaUltimaSalida,
          })
        );
      });

      return items;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const porFecha = (b.fechaCorte || "").localeCompare(a.fechaCorte || "");
      if (porFecha !== 0) return porFecha;
      return (a.tipoSalida || "").localeCompare(b.tipoSalida || "");
    });
};

const crearFormularioVacio = () => ({
  id: "",
  codigoOp: "",
  pedidoOrigen: "",
  modeloBase: "",
  tipoSalida: "PRINCIPAL",
  productoDerivado: false,
  tipoTela: "",
  colorBase: "",
  fechaCorte: "",
  fechaUltimaSalida: "",
  talleres: [],
  enviadoTaller: false,
  totalesPorTalla: {},
  productosDerivados: [],
  elastico: false,
  poliamidas: false,
  fechaActualizacion: obtenerFechaActual(),
  responsable: "",
  observacion: "",
});

export function HabilitadoTaller() {
  const { user } = UserAuth();
  const responsableActivo = useMemo(
    () => obtenerNombreResponsableActivo(user),
    [user]
  );
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [opsHabilitado, setOpsHabilitado] = useState(construirOpsHabilitado);
  const [formulario, setFormulario] = useState(crearFormularioVacio);
  const fichasElasticos = useMemo(() => leerFichasElasticosModelo(), []);
  const tallasElasticos = useMemo(obtenerTallasFichaElastico, []);

  const opsFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();

    return opsHabilitado.filter((item) => {
      const faltantes = obtenerFaltantesHabilitado(item);
      const coincidePestana =
        pestanaActiva === "pendientes" ? !item?.listoEnviar : true;
      const coincideTexto =
        !textoBusqueda ||
        [
          item?.tipoSalida,
          item?.codigoOp,
          item?.pedidoOrigen,
          item?.modeloBase,
          item?.tipoTela,
          item?.colorBase,
          item?.fechaUltimaSalida,
          ...(item?.talleres || []),
          ...faltantes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);

      return coincidePestana && coincideTexto;
    });
  }, [busqueda, opsHabilitado, pestanaActiva]);

  const totalPaginas = Math.max(1, Math.ceil(opsFiltradas.length / FILAS_POR_PAGINA));
  const opsPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return opsFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [opsFiltradas, paginaActual]);

  const resumenPendientes = opsHabilitado.filter((item) => !item?.listoEnviar).length;
  const resumenCompletas = opsHabilitado.filter((item) => item?.listoEnviar).length;
  const resumenEnviadasConFaltantes = opsHabilitado.filter(
    (item) => item?.enviadoTaller && !item?.listoEnviar
  ).length;
  const fichaElasticoSeleccionada = useMemo(
    () =>
      fichasElasticos.find(
        (ficha) =>
          normalizarTexto(ficha?.nombreModelo) ===
          normalizarTexto(formulario?.modeloBase)
      ) || null,
    [fichasElasticos, formulario?.modeloBase]
  );
  const resumenElastico = useMemo(() => {
    if (!formulario?.codigoOp || !fichaElasticoSeleccionada) {
      return null;
    }

    const referenciaElastico = obtenerReferenciaElasticoPorAncho(
      fichaElasticoSeleccionada?.anchoElasticoCm
    );
    const metrosRollo = Number(referenciaElastico?.metrosRollo || 0);
    const detallePorTalla = tallasElasticos.map((talla) => {
      const cantidad = Number(formulario?.totalesPorTalla?.[talla] || 0);
      const largoCm = Number(fichaElasticoSeleccionada?.largosPorTalla?.[talla] || 0);
      const metrosNecesarios = cantidad > 0 && largoCm > 0 ? (cantidad * largoCm) / 100 : 0;

      return {
        talla,
        cantidad,
        largoCm,
        metrosNecesarios,
        costoPrenda: calcularCostoPrendaDesdeLargo({
          largoCm,
          costoMetro: referenciaElastico?.costoMetro || 0,
        }),
      };
    });

    const totalMetrosNecesarios = detallePorTalla.reduce(
      (total, item) => total + item.metrosNecesarios,
      0
    );
    const rollosSugeridos =
      metrosRollo > 0 ? Math.ceil(totalMetrosNecesarios / metrosRollo) : 0;
    const sobranteEstimado =
      rollosSugeridos > 0 && metrosRollo > 0
        ? rollosSugeridos * metrosRollo - totalMetrosNecesarios
        : 0;

    return {
      detallePorTalla,
      metrosRollo,
      totalMetrosNecesarios,
      rollosSugeridos,
      sobranteEstimado,
      costoMetro: Number(referenciaElastico?.costoMetro || 0),
    };
  }, [fichaElasticoSeleccionada, formulario, tallasElasticos]);

  useEffect(() => {
    if (!responsableActivo) return;

    setFormulario((anterior) =>
      anterior?.responsable?.trim()
        ? anterior
        : {
            ...anterior,
            responsable: responsableActivo,
          }
    );
  }, [responsableActivo]);
  const productosDerivadosResumen = useMemo(
    () =>
      (Array.isArray(formulario?.productosDerivados) ? formulario.productosDerivados : [])
        .map((item) => {
          const salidas = item?.salidas || {};
          const total = TALLAS_BASE.reduce(
            (acumulado, talla) => acumulado + Number(salidas?.[talla] || 0),
            0
          );

          return {
            ...item,
            total,
          };
        })
        .filter((item) => item.total > 0),
    [formulario?.productosDerivados]
  );

  const cargarRegistro = (item) => {
    setFormulario({
      ...crearFormularioVacio(),
      ...item,
      responsable: item?.responsable || responsableActivo || "",
      fechaActualizacion: item?.fechaActualizacion || obtenerFechaActual(),
      talleres: Array.isArray(item?.talleres) ? item.talleres : [],
    });
    mostrarNotificacionCarga("Habilitado cargado correctamente");
  };

  const manejarCambio = (evento) => {
    const { name, value, type, checked } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const guardarCambios = async () => {
    if (!formulario.codigoOp) {
      await mostrarAlertaSistema("Carga primero una OP para trabajar su habilitado.");
      return;
    }

    if (!formulario.responsable.trim()) {
      await mostrarAlertaSistema("Escribe quien deja listo este habilitado.");
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando habilitado para taller...",
      mensajeExito: "Habilitado de la OP actualizado correctamente.",
      mensajeError: "No se pudo guardar el habilitado para taller.",
      accion: async () => {
        const registroActualizado = crearEstadoHabilitadoTaller({
          ...formulario,
          fechaActualizacion: formulario.fechaActualizacion || obtenerFechaActual(),
        });

        const listaActualizada = [
          registroActualizado,
          ...opsHabilitado.filter((item) => item.id !== registroActualizado.id),
        ];

        setOpsHabilitado(listaActualizada);
        guardarHabilitadoTaller(listaActualizada);

        const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER).map((item) =>
          item?.id === registroActualizado.id ||
          (!registroActualizado.productoDerivado &&
            item?.codigoOp === registroActualizado.codigoOp &&
            (!item?.tipoSalida || item?.tipoSalida === "PRINCIPAL"))
            ? {
                ...item,
                elastico: registroActualizado.elastico,
                poliamidas: registroActualizado.poliamidas,
                avios: registroActualizado.avios,
                listoEnviar: registroActualizado.listoEnviar,
                fechaActualizacionHabilitado: registroActualizado.fechaActualizacion,
                responsableHabilitado: registroActualizado.responsable,
                observacionHabilitado: registroActualizado.observacion,
              }
            : item
        );

        localStorage.setItem(CLAVE_SALIDAS_TALLER, JSON.stringify(salidas));

        const cabeceraActual = leerDatoGuardado(CLAVE_CABECERA_SALIDA_TALLER);
        if (cabeceraActual?.codigoOp === registroActualizado.codigoOp) {
          localStorage.setItem(
            CLAVE_CABECERA_SALIDA_TALLER,
            JSON.stringify({
              ...cabeceraActual,
              elastico: registroActualizado.elastico,
              poliamidas: registroActualizado.poliamidas,
              avios: registroActualizado.avios,
              listoEnviar: registroActualizado.listoEnviar,
            })
          );
        }
      },
    });
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
          <h1>Habilitado de OP para taller</h1>
          <p>
            Aqui Produccion controla si cada OP ya tiene listo su elastico,
            poliamidas y deja la observacion abierta por si algun otro avio
            especial se debe anotar antes o despues de salir al taller.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Alertas activas</span>
          <strong>{resumenEnviadasConFaltantes}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/produccion" className="boton_volver">
          Volver a Produccion
        </Link>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaActiva === "pendientes" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("pendientes");
                setPaginaActual(1);
              }}
            >
              Por habilitar
            </button>
            <button
              type="button"
              className={`pestana ${pestanaActiva === "historial" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("historial");
                setPaginaActual(1);
              }}
            >
              Historial general
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Lista de OP</h2>
              <p>Busca por OP, pedido, modelo o taller.</p>
            </div>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por OP, pedido, modelo o taller"
            />
          </div>

          <div className="tabla_contenedor">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>OP</th>
                  <th>Pedido</th>
                  <th>Modelo</th>
                  <th>Estado</th>
                  <th>Faltantes</th>
                  <th>Ultima salida</th>
                  <th>Taller</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {opsPaginadas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="fila_vacia">
                      Todavia no hay OP para mostrar en esta bandeja.
                    </td>
                  </tr>
                ) : (
                  opsPaginadas.map((item) => {
                    const faltantes = obtenerFaltantesHabilitado(item);
                    const estadoVisual = obtenerEstadoVisualHabilitado(item);

                    return (
                      <tr key={item.id || item.codigoOp}>
                        <td>{item.productoDerivado ? "Derivado" : "Principal"}</td>
                        <td>{item.codigoOp || "-"}</td>
                        <td>{item.pedidoOrigen || "-"}</td>
                        <td>
                          {item.modeloBase || "-"}
                          {item.productoDerivado && (item.tipoTela || item.colorBase) ? (
                            <small className="texto_secundario_bloque">
                              {item.tipoTela || "-"} | {item.colorBase || "-"}
                            </small>
                          ) : null}
                        </td>
                        <td>
                          <span className={`chip_estado ${estadoVisual.clase}`}>
                            {estadoVisual.texto}
                          </span>
                        </td>
                        <td>
                          {faltantes.length > 0 ? (
                            <span className="texto_alerta">{faltantes.join(" | ")}</span>
                          ) : (
                            <span className="texto_ok">Sin faltantes</span>
                          )}
                        </td>
                        <td>{item.fechaUltimaSalida || "-"}</td>
                        <td>{(item.talleres || []).join(", ") || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn_ajuste btn_ajuste_tabla"
                            onClick={() => cargarRegistro(item)}
                          >
                            Cargar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {opsFiltradas.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="pestana"
                onClick={() => setPaginaActual((anterior) => Math.max(1, anterior - 1))}
                disabled={paginaActual === 1}
              >
                Anterior
              </button>
              <span>
                Pagina {paginaActual} de {totalPaginas}
              </span>
              <button
                type="button"
                className="pestana"
                onClick={() =>
                  setPaginaActual((anterior) => Math.min(totalPaginas, anterior + 1))
                }
                disabled={paginaActual === totalPaginas}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Detalle del habilitado</h2>
              <p>
                Aqui marcas que materiales complementarios ya estan listos para
                esta OP y dejas trazabilidad de quien lo preparo.
              </p>
            </div>
          </div>

          <div className="grid-2">
            <Campo>
              <label>Orden de produccion</label>
              <input type="text" value={formulario.codigoOp} readOnly />
            </Campo>
            <Campo>
              <label>Orden de pedido</label>
              <input type="text" value={formulario.pedidoOrigen} readOnly />
            </Campo>
            <Campo className="campo-completo">
              <label>Modelo</label>
              <input type="text" value={formulario.modeloBase} readOnly />
            </Campo>
            <Campo>
              <label>Tipo de salida</label>
              <input
                type="text"
                value={formulario.productoDerivado ? "DERIVADO" : "PRINCIPAL"}
                readOnly
              />
            </Campo>
            <Campo>
              <label>Tipo de tela</label>
              <input type="text" value={formulario.tipoTela || "-"} readOnly />
            </Campo>
            <Campo>
              <label>Color base</label>
              <input type="text" value={formulario.colorBase || "-"} readOnly />
            </Campo>
            <Campo>
              <label>Fecha corte</label>
              <input type="text" value={formulario.fechaCorte} readOnly />
            </Campo>
            <Campo>
              <label>Ultima salida al taller</label>
              <input type="text" value={formulario.fechaUltimaSalida || "Todavia no sale"} readOnly />
            </Campo>
            <Campo>
              <label>Fecha de actualizacion</label>
              <input
                type="date"
                name="fechaActualizacion"
                value={formulario.fechaActualizacion}
                onChange={manejarCambio}
              />
            </Campo>
            <Campo>
              <label>Responsable</label>
              <input
                type="text"
                name="responsable"
                value={formulario.responsable}
                onChange={manejarCambio}
                placeholder="Quien deja listo el habilitado"
              />
            </Campo>
            <Campo className="campo-completo">
              <label>Estado del habilitado</label>
              <div className="grupo_checks">
                <CheckTalla>
                  <input
                    type="checkbox"
                    name="elastico"
                    checked={Boolean(formulario.elastico)}
                    onChange={manejarCambio}
                  />
                  <span>Elastico listo</span>
                </CheckTalla>
                <CheckTalla>
                  <input
                    type="checkbox"
                    name="poliamidas"
                    checked={Boolean(formulario.poliamidas)}
                    onChange={manejarCambio}
                  />
                  <span>Poliamidas listas</span>
                </CheckTalla>
              </div>
            </Campo>
            <Campo className="campo-completo">
              <label>Observacion</label>
              <textarea
                name="observacion"
                value={formulario.observacion}
                onChange={manejarCambio}
                placeholder="Escribe si falta algun otro avio especial, si sale con observacion o cualquier detalle extra"
              />
            </Campo>
          </div>

          <div className="acciones">
            <button type="button" className="btn_ajuste" onClick={guardarCambios}>
              Guardar habilitado
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Consulta de elastico de esta OP</h2>
              <p>
                Al cargar una OP aqui mismo ves el ancho, largo por talla y cuantos
                rollos conviene separar para que no falte material.
              </p>
            </div>
          </div>

          {!formulario.codigoOp ? (
            <div className="item_vacio">
              Carga una OP desde la lista para revisar su elastico.
            </div>
          ) : !fichaElasticoSeleccionada ? (
            <div className="item_alerta">
              No hay una ficha de elastico registrada para el modelo{" "}
              <strong>{formulario.modeloBase || "-"}</strong>.
            </div>
          ) : resumenElastico ? (
            <div className="resumen_op">
              <div className="resumen_op__top">
                <div>
                  <h3>{formulario.codigoOp}</h3>
                  <p>{fichaElasticoSeleccionada.nombreModelo}</p>
                </div>
                <span className="chip_ancho">
                  Elastico {Number(fichaElasticoSeleccionada.anchoElasticoCm || 0).toFixed(2)} cm
                </span>
              </div>

              <div className="resumen_metricas">
                <div className="resumen_metrica">
                  <span>Metros por rollo</span>
                  <strong>{Number(resumenElastico.metrosRollo || 0).toFixed(2)} m</strong>
                </div>
                <div className="resumen_metrica">
                  <span>Total a cortar</span>
                  <strong>{Number(resumenElastico.totalMetrosNecesarios || 0).toFixed(2)} m</strong>
                </div>
                <div className="resumen_metrica resaltada">
                  <span>Rollos sugeridos</span>
                  <strong>{resumenElastico.rollosSugeridos}</strong>
                </div>
                <div className="resumen_metrica">
                  <span>Sobrante estimado</span>
                  <strong>{Number(resumenElastico.sobranteEstimado || 0).toFixed(2)} m</strong>
                </div>
              </div>

              <div className="mensaje_rollos">
                Con esos rollos no te va a faltar elastico para esta OP. El ultimo
                rollo puede quedar parcial segun el sobrante estimado.
              </div>

              <div className="grid_tallas_op">
                {resumenElastico.detallePorTalla.map((item) => (
                  <div key={`${formulario.codigoOp}-${item.talla}`} className="chip_talla">
                    <strong>{item.talla}</strong>
                    <span>{item.cantidad} prendas</span>
                    <span>{Number(item.largoCm || 0).toFixed(2)} cm por prenda</span>
                    <small>{Number(item.metrosNecesarios || 0).toFixed(2)} m totales</small>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Productos derivados del trazo</h2>
              <p>
                Aqui se revisa lo que tambien salio de esta OP como producto derivado
                antes de enviarlo al taller.
              </p>
            </div>
          </div>

          {!formulario.codigoOp ? (
            <div className="item_vacio">
              Carga una OP desde la lista para revisar sus derivados.
            </div>
          ) : productosDerivadosResumen.length === 0 ? (
            <div className="item_vacio">
              Esta OP todavia no tiene derivados registrados.
            </div>
          ) : (
            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Modelo derivado</th>
                    <th>Tipo de tela</th>
                    <th>Color base</th>
                    <th>S</th>
                    <th>M</th>
                    <th>L</th>
                    <th>XL</th>
                    <th>XXL</th>
                    <th>Total derivado</th>
                  </tr>
                </thead>
                <tbody>
                  {productosDerivadosResumen.map((item) => (
                    <tr key={item.id}>
                      <td>{item.modeloBase || "-"}</td>
                      <td>{item.tipoTela || "-"}</td>
                      <td>{item.colorBase || "-"}</td>
                      <td>{Number(item?.salidas?.S || 0)}</td>
                      <td>{Number(item?.salidas?.M || 0)}</td>
                      <td>{Number(item?.salidas?.L || 0)}</td>
                      <td>{Number(item?.salidas?.XL || 0)}</td>
                      <td>{Number(item?.salidas?.XXL || 0)}</td>
                      <td>
                        <strong>{item.total}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Pendientes</span>
              <strong>{resumenPendientes}</strong>
            </div>
            <div>
              <span>Completas</span>
              <strong>{resumenCompletas}</strong>
            </div>
            <div>
              <span>Enviadas con alerta</span>
              <strong>{resumenEnviadasConFaltantes}</strong>
            </div>
            <div>
              <span>Total OP</span>
              <strong>{opsHabilitado.length}</strong>
            </div>
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

  .cabecera {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
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

  .texto_secundario_bloque {
    display: block;
    margin-top: 4px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
    line-height: 1.4;
  }

  .cabecera__estado {
    min-width: 170px;
    padding: 14px 16px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .cabecera__estado span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .cabecera__estado strong {
    font-size: 30px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior,
  .acciones,
  .paginacion,
  .tarjeta__encabezado {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .grid-2,
  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .campo-completo {
    grid-column: 1 / -1;
  }

  .pestanas,
  .grupo_checks {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .boton_volver,
  .pestana {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 600;
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .pestana_activa,
  .btn_ajuste {
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .btn_ajuste {
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn_ajuste_tabla {
    width: 100%;
    padding: 9px 12px;
  }

  .buscador input,
  input,
  textarea {
    width: 100%;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 12px;
    padding: 12px 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  textarea {
    min-height: 90px;
    resize: vertical;
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 980px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
    text-align: left;
  }

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .chip_estado {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 96px;
    padding: 6px 10px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 12px;
  }

  .chip_estado_pendiente {
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.18)"};
    color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#b45309" : "#fde68a"};
  }

  .chip_estado_listo {
    background-color: rgba(117, 1, 152, 0.2);
    color: #ffffff;
    border: 1px solid rgba(117, 1, 152, 0.35);
  }

  .chip_estado_parcial {
    background-color: rgba(59, 130, 246, 0.14);
    color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#1d4ed8" : "#bfdbfe"};
    border: 1px solid rgba(59, 130, 246, 0.28);
  }

  .chip_estado_alerta {
    background-color: rgba(239, 68, 68, 0.14);
    color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#b91c1c" : "#fecaca"};
    border: 1px solid rgba(239, 68, 68, 0.28);
  }

  .item_vacio,
  .item_alerta,
  .mensaje_rollos {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .item_alerta {
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 165, 0, 0.35);
    background-color: rgba(255, 165, 0, 0.08);
    color: ${({ theme }) => theme.text};
  }

  .resumen_op {
    display: grid;
    gap: 14px;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bg};
  }

  .resumen_op__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .resumen_op__top h3 {
    margin: 0 0 6px;
  }

  .resumen_op__top p {
    margin: 0;
  }

  .chip_ancho {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 88px;
    padding: 8px 12px;
    border-radius: 999px;
    background-color: rgba(117, 1, 152, 0.18);
    color: #ffffff;
    border: 1px solid rgba(117, 1, 152, 0.32);
    font-weight: 700;
  }

  .resumen_metricas {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .resumen_metrica {
    display: grid;
    gap: 4px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgcards};
  }

  .resumen_metrica span {
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .resumen_metrica strong {
    font-size: 20px;
  }

  .resumen_metrica.resaltada {
    border-color: rgba(117, 1, 152, 0.34);
    background-color: rgba(117, 1, 152, 0.12);
  }

  .grid_tallas_op {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }

  .chip_talla {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) => theme.bgcards};
  }

  .chip_talla span,
  .chip_talla small {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .texto_alerta {
    color: ${({ theme }) => theme.text};
    font-weight: 700;
  }

  .texto_ok {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}

  @media (max-width: 860px) {
    .resumen_metricas,
    .grid_tallas_op {
      grid-template-columns: 1fr;
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

const CheckTalla = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background-color: ${({ theme }) => theme.bg};
  border: 1px solid ${({ theme }) => theme.bg4};
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    accent-color: ${({ theme }) => theme.bg5};
  }

  span {
    font-size: 14px;
    font-weight: 600;
  }
`;




