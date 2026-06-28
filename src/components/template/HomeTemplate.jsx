import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { styled } from "styled-components";
import { Header } from "../../index";
import {
  mobileStackBase,
  tabletLandscapeBase,
} from "../../styles/tabletLayout";
import { HISTORIAL_VERSIONES, VERSION_SISTEMA } from "../../utils/versionSistema";
import {
  leerConfiguracionEmpresaSupabase,
  listarModelosProductoConfiguracion,
  listarVariantesProductoConfiguracion,
} from "../../supabase/configuracionCore";
import {
  calcularAlertaStock,
  formatearTallaVisualStock,
  mezclarCatalogoConStock,
  normalizarUmbralesStock,
} from "../../utils/stockProductosCatalogo";
import { resolverIdentidadVisualPorRuta } from "../../utils/identidadVisual";
import {
  consultarPedidosPendientes,
  consultarPrecioModelo,
  consultarStockProductoPorModelo,
  consultarStockTela,
  consultarTalleresActivos,
  crearCatalogoAsistenteSistema,
  detectarIntencionAsistente,
} from "../../utils/asistenteSistema";

const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_HISTORIAL_PAGOS = "cynara_historial_pagos";
const CLAVE_PEDIDOS_TIENDA = "cynara_pedidos_tienda";

const leerListaGuardada = (clave) => {
  const contenido = localStorage.getItem(clave);
  if (!contenido) return [];

  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

const leerProductosTerminados = () => {
  const contenido = localStorage.getItem("cynara_productos_terminados");
  if (!contenido) return [];

  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

const construirDashboard = () => {
  const pedidos = leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
  const ops = leerListaGuardada(CLAVE_HISTORIAL_OP);
  const cortes = leerListaGuardada(CLAVE_HISTORIAL_CORTES);
  const pagos = leerListaGuardada(CLAVE_HISTORIAL_PAGOS);
  const pedidosTienda = leerListaGuardada(CLAVE_PEDIDOS_TIENDA);
  const productosTerminados = leerProductosTerminados();

  return {
    pedidosActivos: pedidos.filter((item) => !item?.cancelado).length,
    opDisponibles: ops.filter((item) => item?.estado === "confirmado" && !item?.cancelado)
      .length,
    opGeneradas: cortes.filter((item) => item?.estado === "confirmado" && !item?.cancelado)
      .length,
    pagosRealizados: pagos.length,
    pedidosTiendaPendientes: pedidosTienda.filter((item) => item?.estado !== "COMPLETO")
      .length,
    stockTotalTerminado: productosTerminados.reduce(
      (total, item) => total + Number(item?.stockActual || 0),
      0
    ),
  };
};

const construirTopModelosPedidos = () => {
  const pedidosTienda = leerListaGuardada(CLAVE_PEDIDOS_TIENDA);
  const mapa = new Map();

  pedidosTienda.forEach((pedido) => {
    (pedido?.detalle || []).forEach((item) => {
      const modelo = item?.modelo || "MODELO SIN NOMBRE";
      const actual = mapa.get(modelo) || {
        modelo,
        cantidad: 0,
        pedidos: 0,
      };

      actual.cantidad += Number(item?.cantidadSolicitada || 0);
      actual.pedidos += 1;
      mapa.set(modelo, actual);
    });
  });

  return Array.from(mapa.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);
};

const accesosPrincipales = [
  {
    titulo: "Produccion",
    descripcion: "Pedidos, OP, cortes, talleres y pagos.",
    ruta: "/produccion",
  },
  {
    titulo: "Materia prima",
    descripcion: "Telas, avios, despachos, devoluciones y proveedor.",
    ruta: "/almacen/materia-prima",
  },
  {
    titulo: "Prod. terminado",
    descripcion: "Recepcion, acondicionado, stock, remates y tienda.",
    ruta: "/almacen/producto-terminado",
  },
  {
    titulo: "Reportes",
    descripcion: "Consulta y exporta reportes a Excel o PDF.",
    ruta: "/reportes",
  },
];

const alertasOperativas = (dashboard) => [
  {
    titulo: "Pedidos de tienda por atender",
    valor: dashboard.pedidosTiendaPendientes,
    texto:
      dashboard.pedidosTiendaPendientes > 0
        ? "Hay tiendas esperando despacho desde almacen."
        : "No hay pedidos de tienda pendientes por ahora.",
    ruta: "/almacen/pedidos-tienda",
  },
  {
    titulo: "OP listas para trabajar",
    valor: dashboard.opDisponibles,
    texto:
      dashboard.opDisponibles > 0
        ? "Produccion ya tiene OP confirmadas para seguir el flujo."
        : "Todavia no hay OP listas en este momento.",
    ruta: "/produccion/cortes",
  },
];

export function HomeTemplate() {
  const [state, setState] = useState(false);
  const [consultaAsistente, setConsultaAsistente] = useState("");
  const [respuestaAsistente, setRespuestaAsistente] = useState(
    "Hola, consultame que quieres saber del sistema."
  );
  const [nivelesStock, setNivelesStock] = useState(
    normalizarUmbralesStock({ stockBajo: 5, stockMedio: 10, stockOptimo: 15 })
  );
  const [alertasStock, setAlertasStock] = useState([]);
  const dashboard = useMemo(construirDashboard, []);
  const topModelosPedidos = useMemo(construirTopModelosPedidos, []);
  const alertas = useMemo(() => alertasOperativas(dashboard), [dashboard]);
  const catalogoAsistente = useMemo(crearCatalogoAsistenteSistema, []);
  const ejemplosAsistente = useMemo(
    () =>
      catalogoAsistente.intenciones.flatMap((item) => item.ejemplos).slice(0, 4),
    [catalogoAsistente]
  );

  useEffect(() => {
    let activo = true;

    const cargarAlertasStock = async () => {
      try {
        const [configuracionEmpresa, catalogoModelos, catalogoVariantes] = await Promise.all([
          leerConfiguracionEmpresaSupabase(),
          listarModelosProductoConfiguracion(),
          listarVariantesProductoConfiguracion(),
        ]);

        const umbral = normalizarUmbralesStock({
          stockBajo: configuracionEmpresa?.stockMinimoAlerta,
          stockMedio: configuracionEmpresa?.stockMedioAlerta,
          stockOptimo: configuracionEmpresa?.stockOptimoAlerta,
        });
        const productosCatalogo = mezclarCatalogoConStock({
          productosTerminados: leerProductosTerminados(),
          catalogoModelos,
          catalogoVariantes,
        });

        const listaAlertas = productosCatalogo
          .map((item) => ({
            ...item,
            alertaStock: calcularAlertaStock(item?.stockActual || 0, umbral),
          }))
          .filter((item) => item.alertaStock?.esAlerta)
          .sort((a, b) => Number(a?.stockActual || 0) - Number(b?.stockActual || 0))
          .slice(0, 6);

        if (!activo) return;
        setNivelesStock(umbral);
        setAlertasStock(listaAlertas);
      } catch (error) {
        console.error("No se pudieron cargar las alertas de stock:", error);
        if (activo) {
          setNivelesStock(
            normalizarUmbralesStock({ stockBajo: 5, stockMedio: 10, stockOptimo: 15 })
          );
          setAlertasStock([]);
        }
      }
    };

    cargarAlertasStock();
    return () => {
      activo = false;
    };
  }, []);

  const extraerTextoDespuesDeClave = (texto = "") => {
    const mayus = texto.toUpperCase();
    const indiceDe = mayus.indexOf(" DE ");
    if (indiceDe >= 0) {
      return texto.slice(indiceDe + 4).trim();
    }

    const indiceDel = mayus.indexOf(" DEL ");
    if (indiceDel >= 0) {
      return texto.slice(indiceDel + 5).trim();
    }

    return texto.trim();
  };

  const resolverConsultaAsistente = (texto = "") => {
    const consulta = texto.trim();
    if (!consulta) {
      return "Escribe una consulta como: muestra stock de leggins clasico french.";
    }

    const intencion = detectarIntencionAsistente(consulta);
    const textoReferencia = extraerTextoDespuesDeClave(consulta);

    if (intencion.codigo === "CONSULTAR_STOCK_PRODUCTO") {
      const resultado = consultarStockProductoPorModelo(textoReferencia);
      if (!resultado.registros.length) {
        return `No encontre stock registrado para ${textoReferencia.toUpperCase()}.`;
      }

      const resumen = Object.entries(resultado.resumenPorColor)
        .map(([color, total]) => `${color}: ${total}`)
        .join(" | ");
      return `Stock de ${resultado.modelo}: ${resultado.total} unidades. ${resumen}`;
    }

    if (intencion.codigo === "CONSULTAR_STOCK_TELA") {
      const resultado = consultarStockTela({ tipoTela: textoReferencia });
      if (!resultado.registros.length) {
        return `No encontre stock de tela para ${textoReferencia.toUpperCase()}.`;
      }

      const resumen = Object.entries(resultado.resumenPorColor)
        .map(([color, data]) => {
          const sobrantes =
            data.sobrantes.length > 0
              ? ` | sobrantes: ${data.sobrantes.map((item) => `${item} kg`).join(", ")}`
              : "";
          return `${color}: ${data.rollos} rollos${sobrantes}`;
        })
        .join(" | ");
      return `Stock de ${resultado.tipoTela || textoReferencia.toUpperCase()}: ${resumen}`;
    }

    if (intencion.codigo === "CONSULTAR_PEDIDOS_PENDIENTES") {
      const pedidos = consultarPedidosPendientes();
      return pedidos.length > 0
        ? `Hay ${pedidos.length} pedidos activos o pendientes en el sistema.`
        : "No hay pedidos pendientes por ahora.";
    }

    if (intencion.codigo === "CONSULTAR_TALLERES") {
      const talleres = consultarTalleresActivos();
      return talleres.length > 0
        ? `Talleres activos: ${talleres
            .slice(0, 6)
            .map((item) => item.nombreTaller)
            .join(", ")}`
        : "No hay talleres activos registrados por ahora.";
    }

    if (intencion.codigo === "CONSULTAR_PRECIOS_MODELO") {
      const precio = consultarPrecioModelo(textoReferencia);
      if (!precio) {
        return `No encontre precio registrado para ${textoReferencia.toUpperCase()}.`;
      }

      return `Precio de ${precio.modelo}: base S/ ${Number(
        precio.precioBase || 0
      ).toFixed(2)}, XL S/ ${Number(precio.precioXL || 0).toFixed(2)}, XXL S/ ${Number(
        precio.precioXXL || 0
      ).toFixed(2)}.`;
    }

    return "Todavia no entiendo esa consulta. Prueba con stock, pedidos, talleres o precios.";
  };

  const manejarConsultaAsistente = (evento) => {
    evento.preventDefault();
    setRespuestaAsistente(resolverConsultaAsistente(consultaAsistente));
  };

  return (
    <Container>
      <header className="header">
        <Header stateConfig={{ state, setState: () => setState(!state) }} />
      </header>

      <section className="hero">
        <div className="hero__badge">{VERSION_SISTEMA}</div>
        <div className="hero__contenido">
          <div>
            <h1>Panel general del sistema</h1>
            <p>
              Aqui arrancas rapido el trabajo del dia y ves el pulso general de
              Produccion, Almacen, Tiendas y Reportes sin entrar modulo por modulo.
            </p>
            <small className="hero__subversion">
              Ultima salida: {HISTORIAL_VERSIONES[0]?.fecha || "-"} |{" "}
              {HISTORIAL_VERSIONES[0]?.titulo || ""}
            </small>
          </div>

          <div className="hero__asistente">
            <div className="robot_tarjeta">
              <div className="robot_animado" aria-hidden="true">
                <div className="robot_cabeza">
                  <span className="robot_ojo" />
                  <span className="robot_ojo" />
                </div>
                <div className="robot_cuerpo">
                  <span className="robot_boton" />
                  <span className="robot_boton" />
                  <span className="robot_boton" />
                </div>
              </div>

              <div className="robot_texto">
                <span className="robot_etiqueta">Asistente Cynara</span>
                <h3>Hola, consultame que quieres saber</h3>
                <p>
                  Puedes preguntarme por stock, pedidos, talleres o precios. Luego
                  esta misma base se conectara al asistente completo y por voz.
                </p>
              </div>
            </div>

            <form className="asistente_formulario" onSubmit={manejarConsultaAsistente}>
              <input
                type="text"
                value={consultaAsistente}
                onChange={(e) => setConsultaAsistente(e.target.value)}
                placeholder="Ejemplo: muestra stock de leggins clasico french"
              />
              <button type="submit">Consultar</button>
            </form>

            <div className="asistente_ejemplos">
              {ejemplosAsistente.map((ejemplo) => (
                <button
                  key={ejemplo}
                  type="button"
                  onClick={() => {
                    setConsultaAsistente(ejemplo);
                    setRespuestaAsistente(resolverConsultaAsistente(ejemplo));
                  }}
                >
                  {ejemplo}
                </button>
              ))}
            </div>

            <div className="asistente_respuesta">
              <strong>Respuesta rapida</strong>
              <p>{respuestaAsistente}</p>
            </div>
          </div>

          <div className="hero__acciones">
            <Link to="/produccion">Ir a Produccion</Link>
            <Link to="/reportes">Ver reportes</Link>
          </div>
        </div>
      </section>

      <section className="metricas">
        <article className="metrica">
          <span>Pedidos activos</span>
          <strong>{dashboard.pedidosActivos}</strong>
        </article>
        <article className="metrica">
          <span>OP disponibles</span>
          <strong>{dashboard.opDisponibles}</strong>
        </article>
        <article className="metrica">
          <span>OP generadas</span>
          <strong>{dashboard.opGeneradas}</strong>
        </article>
        <article className="metrica">
          <span>Pagos registrados</span>
          <strong>{dashboard.pagosRealizados}</strong>
        </article>
        <article className="metrica">
          <span>Stock terminado</span>
          <strong>{dashboard.stockTotalTerminado}</strong>
        </article>
        <article className="metrica">
          <span>Pedidos tienda</span>
          <strong>{dashboard.pedidosTiendaPendientes}</strong>
        </article>
        <article className="metrica">
          <span>Alertas stock</span>
          <strong>{alertasStock.length}</strong>
        </article>
      </section>

      <main className="main">
        <section className="bloque">
          <div className="bloque__cabecera">
            <h2>Accesos principales</h2>
            <p>Entradas directas a las zonas que mas se usan durante el dia.</p>
          </div>

          <div className="grid_accesos">
            {accesosPrincipales.map((item) => {
              const identidad = resolverIdentidadVisualPorRuta(item.ruta);
              const IconoModulo = identidad.icono;
              return (
              <article
                className="tarjeta_acceso"
                key={item.titulo}
                style={{
                  "--modulo-acento": identidad.acento,
                  "--modulo-fondo": identidad.fondo,
                }}
              >
                <span className="tarjeta_acceso__icono">
                  <IconoModulo />
                </span>
                <div>
                  <h3>{item.titulo}</h3>
                  <p>{item.descripcion}</p>
                </div>
                <Link to={item.ruta}>Abrir modulo</Link>
              </article>
            )})}
          </div>
        </section>

        <section className="bloque bloque_alertas">
          <div className="bloque__cabecera">
            <h2>Alertas operativas</h2>
            <p>Lo urgente que conviene revisar antes de empezar a mover stock.</p>
          </div>

          <div className="grid_alertas">
            {alertas.map((item) => (
              <article className="alerta" key={item.titulo}>
                <span>{item.titulo}</span>
                <strong>{item.valor}</strong>
                <p>{item.texto}</p>
                <Link to={item.ruta}>Revisar</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="bloque bloque_stock_bajo">
          <div className="bloque__cabecera">
            <h2>Modelos con stock bajo</h2>
            <p>
              Bajo hasta {nivelesStock.bajo}, medio bajo hasta {nivelesStock.medio} y optimo hasta {nivelesStock.optimo}.
            </p>
          </div>

          <div className="grid_stock_bajo">
            {alertasStock.length === 0 ? (
              <article className="top_vacio">
                <strong>No hay alertas de stock por ahora</strong>
                <p>
                  Cuando una variante entre en bajo o medio bajo, aparecera aqui.
                </p>
              </article>
            ) : (
              alertasStock.map((item) => (
                <article className="stock_bajo_item" key={item.claveProducto || item.id}>
                  <div className="stock_bajo_item__cabecera">
                    <strong>{item.codigoCorto || item.codigoProducto || "-"}</strong>
                    <span className={`chip_alerta chip_alerta_${item.alertaStock?.color || "amarillo"}`}>
                      {item.alertaStock?.etiqueta || "Bajo"}
                    </span>
                  </div>
                  <p>{item.modelo || "-"}</p>
                  <small>
                    {item.colorBase || "-"} | {formatearTallaVisualStock(item.talla || "-")}
                  </small>
                  <b>{Number(item.stockActual || 0)} unidades</b>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="bloque bloque_top">
          <div className="bloque__cabecera">
            <h2>Top modelos mas pedidos</h2>
            <p>
              Por ahora este bloque usa los pedidos emitidos por tienda. Luego lo
              podemos reemplazar por ventas reales.
            </p>
          </div>

          <div className="grid_top">
            {topModelosPedidos.length === 0 ? (
              <article className="top_vacio">
                <strong>Todavia no hay pedidos de tienda suficientes</strong>
                <p>
                  Cuando Tienda empiece a pedir prendas, aqui veras que modelos se
                  mueven mas.
                </p>
              </article>
            ) : (
              topModelosPedidos.map((item, indice) => (
                <article className="top_item" key={item.modelo}>
                  <span className="top_item__posicion">
                    {String(indice + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{item.modelo}</strong>
                    <p>{item.cantidad} prendas pedidas</p>
                    <small>{item.pedidos} lineas de pedido acumuladas</small>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </Container>
  );
}

const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(circle at top left, rgba(117, 1, 152, 0.16), transparent 28%),
    linear-gradient(180deg, ${({ theme }) => theme.bgtotal} 0%, ${({ theme }) => theme.bg2} 100%);
  color: ${({ theme }) => theme.text};
  display: grid;
  padding: 15px;
  gap: 15px;
  grid-template:
    "header" 90px
    "hero" auto
    "metricas" auto
    "main" 1fr;

  .header,
  .hero,
  .metricas,
  .main {
    border-radius: 20px;
  }

  .header {
    grid-area: header;
    background-color: ${({ theme }) => theme.bgcards};
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 10px;
  }

  .hero,
  .bloque,
  .metrica {
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .hero {
    grid-area: hero;
    padding: 24px;
    background:
      linear-gradient(135deg, rgba(117, 1, 152, 0.18), transparent 40%),
      ${({ theme }) => theme.bgcards};
  }

  .hero__badge {
    width: fit-content;
    padding: 8px 12px;
    border-radius: 999px;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .hero__contenido {
    display: grid;
    gap: 18px;
  }

  .hero__asistente {
    display: grid;
    gap: 14px;
    padding: 18px;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background:
      radial-gradient(circle at top right, rgba(34, 197, 94, 0.16), transparent 30%),
      linear-gradient(135deg, rgba(15, 23, 42, 0.28), rgba(255, 255, 255, 0.03));
    backdrop-filter: blur(8px);
  }

  .robot_tarjeta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 16px;
    align-items: center;
  }

  .robot_animado {
    width: 88px;
    display: grid;
    justify-items: center;
    gap: 8px;
    animation: robotFlotar 2.8s ease-in-out infinite;
    transform-origin: center;
  }

  .robot_cabeza {
    width: 74px;
    height: 52px;
    border-radius: 18px;
    background: linear-gradient(180deg, #f8fafc 0%, #dbeafe 100%);
    border: 3px solid rgba(15, 23, 42, 0.16);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    position: relative;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
  }

  .robot_cabeza::before {
    content: "";
    position: absolute;
    top: -10px;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #34d399;
    box-shadow: 0 0 0 5px rgba(52, 211, 153, 0.12);
  }

  .robot_ojo {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #0f172a;
    animation: robotParpadeo 4s ease-in-out infinite;
  }

  .robot_cuerpo {
    width: 58px;
    min-height: 58px;
    border-radius: 18px;
    background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%);
    border: 3px solid rgba(15, 23, 42, 0.12);
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 6px;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
    position: relative;
  }

  .robot_cuerpo::before,
  .robot_cuerpo::after {
    content: "";
    position: absolute;
    top: 18px;
    width: 16px;
    height: 3px;
    border-radius: 999px;
    background: rgba(191, 219, 254, 0.9);
    border: 1px solid rgba(15, 23, 42, 0.12);
  }

  .robot_cuerpo::before {
    left: -14px;
    transform: rotate(20deg);
  }

  .robot_cuerpo::after {
    right: -14px;
    transform: rotate(-20deg);
  }

  .robot_boton {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #0f766e;
  }

  .robot_texto h3 {
    margin: 6px 0 8px;
    font-size: clamp(22px, 3vw, 28px);
    color: ${({ theme }) => theme.colortitlecard};
  }

  .robot_etiqueta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(52, 211, 153, 0.14);
    color: #b6f5d3;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .robot_etiqueta::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #34d399;
  }

  .asistente_formulario {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
  }

  .asistente_formulario input {
    min-height: 48px;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: rgba(255, 255, 255, 0.04);
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  .asistente_formulario input::placeholder {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .asistente_formulario button,
  .asistente_ejemplos button {
    border: none;
    cursor: pointer;
    font-weight: 700;
  }

  .asistente_formulario button {
    min-height: 48px;
    padding: 0 16px;
    border-radius: 14px;
    background: linear-gradient(135deg, #10b981, #0f766e);
    color: #ffffff;
    box-shadow: 0 12px 24px rgba(16, 185, 129, 0.22);
  }

  .asistente_ejemplos {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .asistente_ejemplos button {
    min-height: 38px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    color: ${({ theme }) => theme.text};
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .asistente_respuesta {
    display: grid;
    gap: 6px;
    padding: 14px 16px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.24);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .asistente_respuesta strong {
    color: #b6f5d3;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .asistente_respuesta p {
    margin: 0;
  }

  .hero__subversion {
    display: inline-block;
    margin-top: 10px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
    font-weight: 600;
  }

  .hero h1 {
    margin: 0 0 10px;
    font-size: clamp(30px, 4vw, 42px);
    line-height: 1.05;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .hero p,
  .bloque__cabecera p,
  .tarjeta_acceso p,
  .alerta p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.7;
  }

  .hero__acciones {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .hero__acciones a,
  .tarjeta_acceso a,
  .alerta a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    border-radius: 12px;
    padding: 10px 14px;
    text-decoration: none;
    font-weight: 700;
  }

  .hero__acciones a:first-child,
  .tarjeta_acceso a,
  .alerta a {
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .hero__acciones a:last-child {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .metricas {
    grid-area: metricas;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 12px;
    background: transparent;
  }

  .metrica {
    border-radius: 18px;
    padding: 16px;
  }

  .metrica span {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .metrica strong {
    font-size: 26px;
    color: ${({ theme }) => theme.bg5};
  }

  .main {
    grid-area: main;
    display: grid;
    grid-template-columns: 1.15fr 0.85fr 0.9fr;
    gap: 15px;
  }

  .bloque {
    border-radius: 20px;
    padding: 20px;
  }

  .bloque__cabecera {
    margin-bottom: 18px;
  }

  .bloque h2 {
    margin: 0 0 8px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .grid_accesos,
  .grid_alertas,
  .grid_top,
  .grid_stock_bajo {
    display: grid;
    gap: 12px;
  }

  .grid_accesos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tarjeta_acceso,
  .alerta,
  .top_item,
  .top_vacio,
  .stock_bajo_item {
    display: grid;
    gap: 12px;
    padding: 16px;
    border-radius: 18px;
    background:
      linear-gradient(180deg, ${({ theme }) => theme.bgcards} 0%, ${({ theme }) => theme.bgtotal} 100%);
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .tarjeta_acceso {
    position: relative;
    border-color: var(--modulo-acento, ${({ theme }) => theme.bg4});
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
  }

  .tarjeta_acceso__icono {
    display: inline-flex;
    width: 42px;
    height: 42px;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--modulo-fondo, ${({ theme }) => theme.bg2});
    color: var(--modulo-acento, ${({ theme }) => theme.bg5});
  }

  .tarjeta_acceso__icono svg {
    font-size: 20px;
  }

  .tarjeta_acceso h3 {
    margin: 0 0 6px;
    color: var(--modulo-acento, ${({ theme }) => theme.colortitlecard});
  }

  .alerta span {
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
  }

  .alerta strong {
    font-size: 30px;
    color: ${({ theme }) => theme.bg5};
  }

  .stock_bajo_item {
    background:
      radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 38%),
      linear-gradient(180deg, ${({ theme }) => theme.bgcards} 0%, ${({ theme }) => theme.bgtotal} 100%);
  }

  .stock_bajo_item__cabecera {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .stock_bajo_item p,
  .stock_bajo_item small,
  .stock_bajo_item b {
    display: block;
    margin: 0;
  }

  .stock_bajo_item small {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .chip_alerta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 96px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .chip_alerta_rojo {
    background: rgba(239, 68, 68, 0.18);
    color: #ffb0b0;
    border-color: rgba(239, 68, 68, 0.32);
  }

  .chip_alerta_amarillo {
    background: rgba(245, 158, 11, 0.16);
    color: #ffd78a;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .chip_alerta_verde {
    background: rgba(16, 185, 129, 0.18);
    color: #b0f0da;
    border-color: rgba(16, 185, 129, 0.32);
  }

  .top_item {
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 14px;
  }

  .top_item__posicion {
    display: inline-flex;
    width: 38px;
    height: 38px;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    font-weight: 800;
    font-size: 12px;
  }

  .top_item strong,
  .top_vacio strong {
    color: ${({ theme }) => theme.colortitlecard};
  }

  .top_item p,
  .top_vacio p {
    margin: 6px 0 0;
  }

  .top_item small {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  @media (max-width: 1180px) {
    .metricas {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .main {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 860px) {
    .hero__acciones,
    .grid_accesos,
    .metricas {
      grid-template-columns: 1fr;
    }

    .robot_tarjeta,
    .asistente_formulario {
      grid-template-columns: 1fr;
    }

    .robot_animado {
      width: 100%;
    }

    .hero__acciones a,
    .tarjeta_acceso a,
    .alerta a {
      width: 100%;
    }
  }

  @keyframes robotFlotar {
    0%,
    100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-8px);
    }
  }

  @keyframes robotParpadeo {
    0%,
    44%,
    48%,
    100% {
      transform: scaleY(1);
    }
    46% {
      transform: scaleY(0.15);
    }
  }

  ${tabletLandscapeBase}
  ${mobileStackBase}
`;
