import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { FaClipboardList, FaTruckLoading, FaCut, FaPeopleCarry, FaSearch, FaShareSquare, FaWallet, FaBoxes } from "react-icons/fa";
import { MdAssignmentTurnedIn } from "react-icons/md";
import { Header } from "../../index";
import { leerHabilitadoTaller } from "../../utils/habilitadoTaller";
import { VERSION_SISTEMA } from "../../utils/versionSistema";
import { UserAuth } from "../../context/AuthContext";
import { leerPerfilUsuario } from "../../utils/perfilUsuario";
import { puedeAccederRuta } from "../../utils/permisosSistema";

const accesosProduccion = [
  {
    etapa: "01",
    titulo: "Crear orden de pedido",
    descripcion:
      "Aqui nace la necesidad de producir y se puede editar modelo, color, tallas base y cantidad solicitada.",
    estado: "Primer paso",
    ruta: "/produccion/detalle-pedido",
    icono: FaClipboardList,
  },
  {
    etapa: "02",
    titulo: "Pedidos registrados",
    descripcion:
      "Consulta rapido todos los pedidos creados y revisa que telas, colores y observaciones lleva cada uno.",
    estado: "Consulta",
    ruta: "/produccion/pedidos-registrados",
    icono: FaSearch,
  },
  {
    etapa: "03",
    titulo: "Habilitado de materiales",
    descripcion:
      "Aqui Produccion habilita las telas y materiales que despacho almacen, revisa colores, mide anchos y valida si algo debe devolverse.",
    estado: "Pendiente",
    ruta: "/produccion/detalle-op",
    icono: FaTruckLoading,
  },
  {
    etapa: "04",
    titulo: "Ordenes de produccion",
    descripcion:
      "Registra el resultado real por color y talla una vez que produccion dobla tela, traza y corta.",
    estado: "Pendiente",
    ruta: "/produccion/cortes",
    icono: FaCut,
  },
  {
    etapa: "05",
    titulo: "Habilitado de OP para taller",
    descripcion:
      "Controla si cada OP ya tiene elastico y poliamidas listas, y deja observaciones si hace falta algun otro avio especial.",
    estado: "Pendiente",
    ruta: "/produccion/habilitado-taller",
    icono: FaBoxes,
  },
  {
    etapa: "06",
    titulo: "Salidas a taller",
    descripcion:
      "Controla que cantidades se entregan, a que taller y con que fecha compromiso.",
    estado: "Pendiente",
    ruta: "/produccion/salidas-taller",
    icono: FaPeopleCarry,
  },
  {
    etapa: "07",
    titulo: "Recepciones",
    descripcion:
      "Recibe devoluciones parciales o totales y prepara el control de fallas y correcciones.",
    estado: "Pendiente",
    ruta: "/produccion/recepciones",
    icono: MdAssignmentTurnedIn,
  },
  {
    etapa: "08",
    titulo: "Resumen de pagos",
    descripcion:
      "Reune todas las OP aprobadas para pago, muestra el total a solicitar y permite marcarlas pagadas en lote.",
    estado: "Pendiente",
    ruta: "/produccion/resumen-pagos",
    icono: FaWallet,
  },
  {
    etapa: "09",
    titulo: "Envios a terceros",
    descripcion:
      "Crea el documento hijo de tercerizacion amarrado a la OP principal y separa el pago del taller tercero.",
    estado: "Pendiente",
    ruta: "/produccion/tercerizaciones",
    icono: FaShareSquare,
  },
];

const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_HISTORIAL_CORTES = "cynara_historial_cortes";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";

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

export function Produccion() {
  const { user } = UserAuth();
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const perfil = leerPerfilUsuario(user);
  const accesosProduccionVisibles = accesosProduccion.filter((item) =>
    puedeAccederRuta(item.ruta, perfil),
  );
  const resumenOperativo = useMemo(() => {
    const pedidos = leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
    const detallePedidos = leerListaGuardada(CLAVE_HISTORIAL_OP);
    const cortes = leerListaGuardada(CLAVE_HISTORIAL_CORTES);
    const salidas = leerListaGuardada(CLAVE_SALIDAS_TALLER);
    const recepciones = leerListaGuardada(CLAVE_RECEPCIONES_TALLER);
    const habilitados = leerHabilitadoTaller();
    const pagosPendientes = recepciones.filter(
      (item) =>
        item?.cabeceraRecepcion?.tipoRecepcion === "final" &&
        item?.cabeceraRecepcion?.aprobadoPago &&
        Number(item?.cabeceraRecepcion?.totalPagarTaller || 0) >
          Number(item?.cabeceraRecepcion?.montoPagadoAcumulado || 0)
    );
    const recepcionesObservadas = recepciones.filter(
      (item) => Array.isArray(item?.cabeceraRecepcion?.incidenciasRecepcion) &&
        item.cabeceraRecepcion.incidenciasRecepcion.length > 0
    );
    const pedidosActivos = pedidos.filter((item) => !item?.cancelado);
    const detallePedidosActivos = detallePedidos.filter((item) => !item?.cancelado);
    const ordenesPendientesHabilitado = detallePedidosActivos.filter(
      (item) => item?.estado !== "aprobado" && item?.estado !== "enviado_produccion"
    );
    const opsConfirmadas = cortes.filter(
      (item) => item?.estado === "confirmado" && !item?.cancelado
    );
    const listosTaller = opsConfirmadas.filter((corte) => {
      const codigoOp =
        corte?.cabeceraCorte?.codigoCorte || corte?.cabeceraCorte?.opOrigen || "";
      return habilitados.some(
        (item) => item?.codigoOp === codigoOp && item?.listoEnviar
      );
    }).length;

    return {
      pedidosPendientes: pedidosActivos.length,
      detallePendiente: detallePedidosActivos.length,
      habilitadoPendiente: ordenesPendientesHabilitado.length,
      cortesPendientes: cortes.filter((item) => item?.estado === "borrador").length,
      listosTaller,
      enTaller: salidas.filter((item) => item?.enviadoTaller && !item?.recepcionFinalizada).length,
      recepcionesPendientes: salidas.filter((item) => item?.enviadoTaller).length - recepciones.length,
      pagosPendientes: pagosPendientes.length,
      recepcionesObservadas: recepcionesObservadas.length,
    };
  }, []);
  const alertasDashboard = useMemo(() => {
    const alertas = [];

    if (resumenOperativo.pagosPendientes > 0) {
      alertas.push({
        tono: "warning",
        titulo: "Pagos por cerrar",
        detalle: `${resumenOperativo.pagosPendientes} registros aprobados siguen pendientes de pago.`,
        ruta: "/produccion/resumen-pagos",
        accion: "Ir a pagos",
      });
    }

    if (resumenOperativo.listosTaller > 0) {
      alertas.push({
        tono: "primary",
        titulo: "OP listas para salida",
        detalle: `${resumenOperativo.listosTaller} ordenes ya estan listas para enviar al taller.`,
        ruta: "/produccion/salidas-taller",
        accion: "Revisar salidas",
      });
    }

    if (resumenOperativo.recepcionesObservadas > 0) {
      alertas.push({
        tono: "danger",
        titulo: "Recepciones observadas",
        detalle: `${resumenOperativo.recepcionesObservadas} recepciones tienen incidencias por revisar.`,
        ruta: "/produccion/recepciones",
        accion: "Ver recepciones",
      });
    }

    if (resumenOperativo.habilitadoPendiente > 0) {
      alertas.push({
        tono: "neutral",
        titulo: "Materiales por habilitar",
        detalle: `${resumenOperativo.habilitadoPendiente} pedidos aun no terminan de prepararse.`,
        ruta: "/produccion/detalle-op",
        accion: "Ir a habilitado",
      });
    }

    return alertas.slice(0, 4);
  }, [resumenOperativo]);
  const totalActivosDashboard =
    resumenOperativo.habilitadoPendiente +
    resumenOperativo.cortesPendientes +
    resumenOperativo.listosTaller +
    resumenOperativo.enTaller +
    Math.max(0, resumenOperativo.recepcionesPendientes);
  const porcentajeFlujo = (valor) =>
    totalActivosDashboard > 0
      ? Math.max(8, Math.min(100, Math.round((valor / totalActivosDashboard) * 100)))
      : 0;
  const tableroFlujo = [
    {
      titulo: "Pedidos de produccion",
      valor: resumenOperativo.habilitadoPendiente,
      ruta: "/produccion/detalle-op",
    },
    {
      titulo: "Corte",
      valor: resumenOperativo.cortesPendientes,
      ruta: "/produccion/cortes",
    },
    {
      titulo: "Salida",
      valor: resumenOperativo.listosTaller,
      ruta: "/produccion/salidas-taller",
    },
    {
      titulo: "En taller",
      valor: resumenOperativo.enTaller,
      ruta: "/produccion/recepciones",
    },
  ];

  // Boton temporal para reiniciar pruebas locales sin abrir la consola.
  const limpiarPruebasLocales = () => {
    [
      "cynara_detalle_pedido_actual",
      "cynara_historial_pedidos",
      "cynara_detalle_op_actual",
      "cynara_historial_op",
      "cynara_detalle_corte_actual",
      "cynara_historial_cortes",
      "cynara_salidas_taller",
      "cynara_cabecera_salida_taller",
      "cynara_recepciones_taller",
      "cynara_devoluciones_produccion",
      "cynara_tercerizaciones_op",
      "cynara_historial_pagos",
      "cynara_solicitudes_habilitado",
      "cynara_solicitudes_procesos_externos",
      "cynara_ajustes_recepcion_produccion",
      "cynara_productos_terminados",
      "cynara_movimientos_productos_terminados",
      "cynara_historial_ingresos_materia_prima",
      "cynara_habilitado_taller",
    ].forEach((clave) => localStorage.removeItem(clave));

    alert("Pruebas locales limpiadas correctamente.");
    window.location.reload();
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

      <section className="hero">
        <div className="hero__etiqueta">{VERSION_SISTEMA}</div>
        <div className="hero__contenido">
          <div>
            <h1>Produccion</h1>
            <p>
              Entrada inicial del modulo para continuar el flujo textil sin
              saltar pasos ni romper la base actual del sistema.
            </p>
            <small className="hero__subtexto">
              Flujo principal listo para seguirlo por etapas y probarlo en tablet.
            </small>
          </div>
        </div>
      </section>

      <section className="resumen">
        <article className="resumen__principal">
          <h2>Panel operativo</h2>
          <p>
            Desde aqui Produccion retoma rapido lo urgente del dia y entra directo al punto
            exacto del flujo sin perder tiempo.
          </p>
        </article>

        <article className="resumen__estado">
          <span className="estado__titulo">Prioridad del dia</span>
          <strong>{resumenOperativo.pagosPendientes} pagos y {resumenOperativo.listosTaller} salidas por mover</strong>
          <p>Lo mas sensible hoy esta en pagos, recepciones observadas y ordenes listas para enviar.</p>
        </article>
      </section>

      <main className="contenido_principal">
        <section className="bloque">
          <div className="dashboard_operativo">
            <article className="panel_dashboard">
              <div className="panel_dashboard__cabecera">
                <div>
                  <span className="panel_dashboard__etiqueta">Tablero del dia</span>
                  <h3>Prioridades de produccion</h3>
                </div>
                <strong>{totalActivosDashboard}</strong>
              </div>
              <div className="lista_alertas">
                {alertasDashboard.length > 0 ? (
                  alertasDashboard.map((alerta) => (
                    <Link
                      key={alerta.titulo}
                      to={alerta.ruta}
                      className={`alerta_dashboard alerta_${alerta.tono}`}
                    >
                      <div>
                        <strong>{alerta.titulo}</strong>
                        <p>{alerta.detalle}</p>
                      </div>
                      <span>{alerta.accion}</span>
                    </Link>
                  ))
                ) : (
                  <div className="alerta_dashboard alerta_ok">
                    <div>
                      <strong>Sin urgencias abiertas</strong>
                      <p>El flujo principal esta al dia en este navegador de pruebas.</p>
                    </div>
                  </div>
                )}
              </div>
            </article>

            <article className="panel_dashboard">
              <div className="panel_dashboard__cabecera">
                <div>
                  <span className="panel_dashboard__etiqueta">Flujo visual</span>
                  <h3>Carga por etapa</h3>
                </div>
              </div>
              <div className="flujo_dashboard">
                {tableroFlujo.map((item) => (
                  <Link key={item.titulo} to={item.ruta} className="flujo_item">
                    <div className="flujo_item__cabecera">
                      <span>{item.titulo}</span>
                      <strong>{item.valor}</strong>
                    </div>
                    <div className="barra_flujo">
                      <span style={{ width: `${porcentajeFlujo(item.valor)}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </article>
          </div>

          <div className="grid_accesos">
            {accesosProduccionVisibles.map((item) => (
              <article className="tarjeta_acceso" key={item.titulo}>
                <div className="tarjeta_acceso__encabezado">
                  <span className="tarjeta_acceso__etapa">{item.etapa}</span>
                  <span className="tarjeta_acceso__icono">
                    <item.icono />
                  </span>
                </div>
                <h3>{item.titulo}</h3>
                <p>{item.descripcion}</p>
                {item.ruta ? (
                  <Link to={item.ruta} className="boton_acceso">
                    Abrir modulo
                  </Link>
                ) : (
                  <small>{item.estado}</small>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="bloque bloque_secundario">
          <article className="panel">
            <h2>Control rapido</h2>
            <div className="panel_resumen">
              <div>
                <span>Ordenes de pedido</span>
                <strong>{resumenOperativo.pedidosPendientes}</strong>
              </div>
              <div>
                <span>Detalle de pedido</span>
                <strong>{resumenOperativo.detallePendiente}</strong>
              </div>
              <div>
                <span>Listas para taller</span>
                <strong>{resumenOperativo.listosTaller}</strong>
              </div>
              <div>
                <span>Recepciones pendientes</span>
                <strong>{Math.max(0, resumenOperativo.recepcionesPendientes)}</strong>
              </div>
              <div>
                <span>Recepciones observadas</span>
                <strong>{resumenOperativo.recepcionesObservadas}</strong>
              </div>
              <div>
                <span>Pagos pendientes</span>
                <strong>{resumenOperativo.pagosPendientes}</strong>
              </div>
            </div>
          </article>

          <article className="panel panel_destacado">
            <span className="panel_destacado__etiqueta">Apoyo de pruebas</span>
            <h2>Reiniciar pruebas locales</h2>
            <p>
              Si quieres volver a probar el flujo desde cero en este navegador, puedes borrar
              los datos locales temporales sin tocar el proyecto ni la estructura real.
            </p>

            <button
              type="button"
              className="boton_pruebas"
              onClick={limpiarPruebasLocales}
            >
              Limpiar pruebas locales
            </button>
          </article>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
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
    "encabezado" 90px
    "hero" auto
    "resumen" auto
    "contenido_principal" 1fr;

  .encabezado,
  .hero,
  .resumen,
  .contenido_principal {
    border-radius: 20px;
    box-shadow: ${({ theme }) =>
      theme.bg === "#272727"
        ? "0 10px 30px rgba(0,0,0,0.24)"
        : "0 10px 30px rgba(15,23,42,0.08)"};
  }

  .encabezado {
    grid-area: encabezado;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: ${({ theme }) => theme.bgcards};
    padding-right: 10px;
  }

  .hero {
    grid-area: hero;
    overflow: hidden;
    padding: 24px;
    background:
      linear-gradient(135deg, ${({ theme }) => theme.bgcards} 0%, ${({ theme }) => theme.bg2} 100%);
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .hero__etiqueta {
    width: fit-content;
    padding: 8px 12px;
    border-radius: 999px;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }

  .hero__contenido {
    display: grid;
    gap: 18px;
  }

  .hero__subtexto {
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

  .hero p {
    margin: 0;
    max-width: 720px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 15px;
    line-height: 1.7;
  }

  .resumen {
    grid-area: resumen;
    display: grid;
    gap: 15px;
  }

  .resumen__principal,
  .resumen__estado,
  .bloque,
  .panel {
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .resumen__principal,
  .resumen__estado {
    padding: 20px;
  }

  .resumen__principal h2,
  .bloque h2,
  .panel h2 {
    margin: 0 0 10px;
    font-size: 22px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .resumen__principal p,
  .resumen__estado p,
  .bloque__cabecera p,
  .tarjeta_acceso p,
  .panel p,
  .panel li {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.6;
  }

  .resumen__estado {
    border-left: 5px solid ${({ theme }) => theme.bg5};
  }

  .estado__titulo,
  .panel_destacado__etiqueta {
    display: inline-block;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.bg5};
  }

  .resumen__estado strong {
    display: block;
    margin-bottom: 8px;
    font-size: 18px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .contenido_principal {
    grid-area: contenido_principal;
    display: grid;
    gap: 15px;
  }

  .bloque,
  .panel {
    border-radius: 20px;
    padding: 20px;
  }

  .bloque__cabecera {
    margin-bottom: 18px;
  }

  .indicadores_clave {
    display: grid;
    gap: 14px;
    margin-bottom: 18px;
  }

  .indicador_clave,
  .atajo_panel {
    border-radius: 16px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) =>
      theme.bg === "#272727" ? "rgba(255,255,255,0.03)" : "#f8f3fb"};
    padding: 16px;
    min-height: 150px;
    display: grid;
    align-content: start;
  }

  .indicador_clave span,
  .atajo_panel span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .indicador_clave strong,
  .atajo_panel strong {
    display: block;
    font-size: 28px;
    line-height: 1;
    margin-bottom: 8px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .indicador_clave small,
  .atajo_panel small {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  .indicador_urgente {
    border-left: 4px solid ${({ theme }) => theme.bg5};
  }

  .indicador_pago {
    border-left: 4px solid #f59e0b;
  }

  .acciones_rapidas {
    display: grid;
    gap: 14px;
    margin-bottom: 18px;
  }

  .dashboard_operativo {
    display: grid;
    gap: 14px;
    margin-bottom: 18px;
  }

  .atajo_panel {
    text-decoration: none;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .atajo_panel:hover {
    transform: translateY(-1px);
    border-color: ${({ theme }) => theme.bg5};
  }

  .panel_dashboard {
    border-radius: 18px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: linear-gradient(
      180deg,
      ${({ theme }) => theme.bgcards} 0%,
      ${({ theme }) => theme.bgtotal} 100%
    );
    padding: 18px;
  }

  .panel_dashboard__cabecera {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 14px;
  }

  .panel_dashboard__cabecera h3 {
    margin: 4px 0 0;
    font-size: 20px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .panel_dashboard__cabecera > strong {
    min-width: 54px;
    height: 54px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
    font-size: 22px;
  }

  .panel_dashboard__etiqueta {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.bg5};
  }

  .lista_alertas,
  .flujo_dashboard {
    display: grid;
    gap: 12px;
  }

  .alerta_dashboard,
  .flujo_item {
    display: grid;
    gap: 8px;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background-color: ${({ theme }) =>
      theme.bg === "#272727" ? "rgba(255,255,255,0.03)" : "#f8f3fb"};
    padding: 14px;
    text-decoration: none;
    color: ${({ theme }) => theme.text};
  }

  .alerta_dashboard strong,
  .flujo_item strong {
    color: ${({ theme }) => theme.colortitlecard};
  }

  .alerta_dashboard p {
    margin: 4px 0 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  .alerta_dashboard span {
    color: ${({ theme }) => theme.bg5};
    font-size: 13px;
    font-weight: 700;
  }

  .alerta_primary {
    border-left: 4px solid ${({ theme }) => theme.bg5};
  }

  .alerta_warning {
    border-left: 4px solid #f59e0b;
  }

  .alerta_danger {
    border-left: 4px solid #ef4444;
  }

  .alerta_neutral,
  .alerta_ok {
    border-left: 4px solid ${({ theme }) => theme.bg4};
  }

  .flujo_item__cabecera {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .flujo_item__cabecera span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .barra_flujo {
    width: 100%;
    height: 10px;
    border-radius: 999px;
    background-color: ${({ theme }) => theme.bg4};
    overflow: hidden;
  }

  .barra_flujo span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, ${({ theme }) => theme.bg5} 0%, #f59e0b 100%);
  }

  .grid_accesos {
    display: grid;
    gap: 15px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 280px));
    justify-content: center;
  }

  .tarjeta_acceso {
    position: relative;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    border-radius: 18px;
    padding: 16px;
    background: linear-gradient(
      180deg,
      ${({ theme }) => theme.bgcards} 0%,
      ${({ theme }) => theme.bgtotal} 100%
    );
    border: 1px solid ${({ theme }) => theme.bg4};
    min-height: 198px;
    max-width: 280px;
    width: 100%;
  }

  .tarjeta_acceso__encabezado {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .tarjeta_acceso__etapa {
    display: inline-flex;
    width: 38px;
    height: 38px;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    font-weight: 700;
    font-size: 12px;
  }

  .tarjeta_acceso__icono {
    display: inline-flex;
    width: 38px;
    height: 38px;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background-color: ${({ theme }) =>
      theme.bg === "#272727" ? "rgba(255,255,255,0.06)" : "rgba(117,1,152,0.08)"};
    color: ${({ theme }) => theme.bg5};
    font-size: 16px;
  }

  .tarjeta_acceso h3 {
    margin: 0 0 8px;
    font-size: 17px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .tarjeta_acceso p {
    margin: 0 0 12px;
    font-size: 13px;
  }

  .tarjeta_acceso small {
    color: ${({ theme }) => theme.bg5};
    font-weight: 700;
  }

  .boton_acceso {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    text-decoration: none;
    font-weight: 700;
    transition: transform 0.2s ease, opacity 0.2s ease;
    width: fit-content;
  }

  .boton_acceso:hover {
    transform: translateY(-1px);
    opacity: 0.92;
  }

  .boton_pruebas {
    margin-top: 14px;
    border: none;
    border-radius: 12px;
    padding: 12px 16px;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    font-weight: 700;
    cursor: pointer;
  }

  .bloque_secundario {
    display: grid;
    gap: 15px;
  }

  .panel ul {
    margin: 0;
    padding-left: 18px;
  }

  .panel_resumen {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .panel_resumen div {
    padding: 14px;
    border-radius: 14px;
    background-color: ${({ theme }) =>
      theme.bg === "#272727" ? "rgba(255,255,255,0.03)" : "#f8f3fb"};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .panel_resumen span {
    display: block;
    margin-bottom: 6px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .panel_resumen strong {
    font-size: 24px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .panel_destacado {
    background:
      linear-gradient(135deg, rgba(117, 1, 152, 0.12), transparent),
      ${({ theme }) => theme.bgcards};
  }

  @media (min-width: 768px) {
    .hero {
      padding: 30px;
    }

    .hero__contenido,
    .resumen,
    .bloque_secundario {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .grid_accesos {
      grid-template-columns: repeat(2, minmax(240px, 280px));
      justify-content: start;
    }

    .indicadores_clave,
    .acciones_rapidas,
    .dashboard_operativo {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 1100px) {
    .contenido_principal {
      grid-template-columns: 1.45fr 0.95fr;
      align-items: start;
    }

    .hero__contenido {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .indicadores_clave,
    .acciones_rapidas,
    .dashboard_operativo {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .dashboard_operativo {
      grid-template-columns: 1.15fr 0.85fr;
    }
  }

  @media (max-width: 560px) {
    .grid_accesos {
      grid-template-columns: 1fr;
    }

    .tarjeta_acceso {
      max-width: none;
      min-height: 186px;
    }
  }

  @media (max-width: 767px) {
    .panel_resumen {
      grid-template-columns: 1fr;
    }
  }
`;
