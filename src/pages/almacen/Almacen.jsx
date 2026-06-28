import { useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import {
  FiArchive,
  FiBox,
  FiCheckSquare,
  FiClipboard,
  FiCornerUpLeft,
  FiLayers,
  FiPackage,
  FiRepeat,
  FiShoppingBag,
  FiSliders,
  FiTag,
  FiTruck,
} from "react-icons/fi";
import { Header } from "../../index";
import { mobileStackBase, tabletLandscapeBase } from "../../styles/tabletLayout";
import { VERSION_SISTEMA } from "../../utils/versionSistema";
import { UserAuth } from "../../context/AuthContext";
import { leerPerfilUsuario } from "../../utils/perfilUsuario";
import { puedeAccederRuta } from "../../utils/permisosSistema";

const seccionesAlmacen = [
  {
    grupo: "Almacen de materia prima",
    resumen:
      "Telas, avios, despachos a produccion, devoluciones, reposiciones y ajustes del segundo piso.",
    tono: "materia",
    modulos: [
      {
        etapa: "01",
        titulo: "Ingreso de materia prima",
        descripcion:
          "Registra compras de tela por proveedor, documento, partida, kilos, metros y costo.",
        ruta: "/almacen/ingreso-materia-prima",
        icono: FiPackage,
      },
      {
        etapa: "02",
        titulo: "Stock de telas",
        descripcion:
          "Muestra el stock disponible de telas compradas con buscador por codigo, tela, partida o proveedor.",
        ruta: "/almacen/stock-telas",
        icono: FiLayers,
      },
      {
        etapa: "03",
        titulo: "Despacho a produccion",
        descripcion:
          "Alista telas segun orden de pedido para enviarlas a habilitado de materiales.",
        ruta: "/almacen/despacho-produccion",
        icono: FiTruck,
      },
      {
        etapa: "04",
        titulo: "Devoluciones de produccion",
        descripcion:
          "Recibe sobrantes, cambios o devoluciones desde habilitado y produccion.",
        ruta: "/almacen/devolucion-produccion",
        icono: FiCornerUpLeft,
      },
      {
        etapa: "05",
        titulo: "Ajustes de materia prima",
        descripcion:
          "Corrige stock por conteo, merma, diferencia fisica o regularizacion autorizada.",
        icono: FiSliders,
      },
      {
        etapa: "06",
        titulo: "Devolucion a proveedor",
        descripcion:
          "Registra la salida de una tela fallada hacia el proveedor sin tratarla como una compra nueva.",
        ruta: "/almacen/devolucion-proveedor",
        icono: FiRepeat,
      },
      {
        etapa: "07",
        titulo: "Reposicion de proveedor",
        descripcion:
          "Registra la tela que vuelve por cambio del proveedor y la repone al stock sin duplicar dinero.",
        ruta: "/almacen/reposicion-proveedor",
        icono: FiRepeat,
      },
      {
        etapa: "08",
        titulo: "Stock de avios",
        descripcion:
          "Controla elasticos, poliamidas, etiquetas y otros insumos pequenos.",
        ruta: "/almacen/stock-avios",
        icono: FiArchive,
      },
      {
        etapa: "09",
        titulo: "Avios a produccion",
        descripcion:
          "Alista avios que acompanaran la OP antes de enviarla al taller.",
        ruta: "/almacen/avios-produccion",
        icono: FiTag,
      },
      {
        etapa: "10",
        titulo: "Ajustes de avios",
        descripcion:
          "Corrige diferencias de avios por conteo, consumo o regularizacion.",
        ruta: "/almacen/ajustes-avios",
        icono: FiSliders,
      },
    ],
  },
  {
    grupo: "Almacen de producto terminado",
    resumen:
      "Prendas recibidas de taller, stock para tienda, remates y ajustes del producto ya confeccionado.",
    tono: "terminados",
    modulos: [
      {
        etapa: "01",
        titulo: "Control de tercerizacion",
        descripcion:
          "Recibe, cuenta, despacha y retorna cada servicio tercerizado con codigo hijo amarrado a la OP.",
        ruta: "/almacen/tercerizaciones",
        icono: FiLayers,
      },
      {
        etapa: "02",
        titulo: "Recepcion de taller",
        descripcion:
          "Recibe lo que devuelve el taller, valida calidad en almacen y deja listo el paso hacia producto terminado.",
        ruta: "/almacen/recepcion-taller",
        icono: FiTruck,
      },
      {
        etapa: "03",
        titulo: "Control de calidad",
        descripcion:
          "Clasifica cada OP recepcionada en apto, arreglo o remate y recien despues la ingresa al stock normal.",
        ruta: "/almacen/acondicionado-producto-terminado",
        icono: FiCheckSquare,
      },
      {
        etapa: "04",
        titulo: "Pedidos de tienda",
        descripcion:
          "Revisa las solicitudes que emiten las tiendas para que Almacen luego prepare su salida.",
        ruta: "/almacen/pedidos-tienda",
        icono: FiClipboard,
      },
      {
        etapa: "05",
        titulo: "Stock de productos",
        descripcion:
          "Consulta codigos cortos, nombre comercial, color, talla y stock final recibido desde taller.",
        ruta: "/almacen/productos-terminados",
        icono: FiBox,
      },
      {
        etapa: "06",
        titulo: "Venta directa desde almacen",
        descripcion:
          "Vende para TikTok, mostrador o pedidos rapidos sin cargar la pantalla del stock general.",
        ruta: "/almacen/venta-directa",
        icono: FiShoppingBag,
      },
      {
        etapa: "07",
        titulo: "Salida a tienda",
        descripcion:
          "Prepara despachos de prendas terminadas hacia tienda con codigo corto o futuro lector de barras.",
        ruta: "/almacen/salida-tienda",
        icono: FiTruck,
      },
      {
        etapa: "08",
        titulo: "Cambios de venta",
        descripcion:
          "Registra cambios de color, talla o modelo sin borrar la venta original y controlando diferencias de dinero.",
        ruta: "/almacen/cambios-venta",
        icono: FiRepeat,
      },
      {
        etapa: "09",
        titulo: "Remates",
        descripcion:
          "Separa prendas falladas o de segunda en un stock distinto al producto normal.",
        ruta: "/almacen/remates",
        icono: FiArchive,
      },
      {
        etapa: "10",
        titulo: "Ajustes de prendas",
        descripcion:
          "Registra diferencias por conteo, perdida, falla, remate o correccion autorizada.",
        ruta: "/almacen/ajustes-prendas",
        icono: FiSliders,
      },
      {
        etapa: "11",
        titulo: "Revendedoras",
        descripcion:
          "Separa stock para chicas que venden por redes, controla lo reportado y lo que regresa sin mezclarlo con tienda normal.",
        ruta: "/almacen/revendedoras",
        icono: FiShoppingBag,
      },
    ],
  },
];

const accesosRapidos = [
  { titulo: "Stock telas", ruta: "/almacen/stock-telas" },
  { titulo: "Stock avios", ruta: "/almacen/stock-avios" },
  { titulo: "Recepcion taller", ruta: "/almacen/recepcion-taller" },
  { titulo: "Control de calidad", ruta: "/almacen/acondicionado-producto-terminado" },
  { titulo: "Stock productos", ruta: "/almacen/productos-terminados" },
  { titulo: "Venta directa", ruta: "/almacen/venta-directa" },
  { titulo: "Despacho produccion", ruta: "/almacen/despacho-produccion" },
  { titulo: "Tercerizaciones", ruta: "/almacen/tercerizaciones" },
];

const panelesAlmacen = [
  {
    titulo: "Materia prima y avios",
    texto:
      "Aqui trabaja quien recibe tela, controla stock, despacha a produccion y maneja devoluciones o avios.",
  },
  {
    titulo: "Producto terminado",
    texto:
      "Aqui trabaja quien recibe del taller, controla tercerizaciones, prendas listas, remates y futuras salidas a tienda.",
  },
];

export function Almacen({ vistaInicial = "general" }) {
  const { user } = UserAuth();
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const perfil = leerPerfilUsuario(user);
  const seccionesVisibles = seccionesAlmacen.filter((seccion) => {
    if (vistaInicial === "materia-prima") {
      return seccion.tono === "materia";
    }

    if (vistaInicial === "producto-terminado") {
      return seccion.tono === "terminados";
    }

    return true;
  });
  const seccionesConPermisos = seccionesVisibles
    .map((seccion) => ({
      ...seccion,
      modulos: (seccion.modulos || []).filter((item) => !item.ruta || puedeAccederRuta(item.ruta, perfil)),
    }))
    .filter((seccion) => (seccion.modulos || []).length > 0);

  const panelesVisibles = panelesAlmacen.filter((panel) => {
    if (vistaInicial === "materia-prima") {
      return panel.titulo === "Materia prima y avios";
    }

    if (vistaInicial === "producto-terminado") {
      return panel.titulo === "Producto terminado";
    }

    return true;
  });
  const tituloVista =
    vistaInicial === "materia-prima"
      ? "Almacen de materia prima"
      : vistaInicial === "producto-terminado"
      ? "Almacen de producto terminado"
      : "Almacen";
  const descripcionVista =
    vistaInicial === "materia-prima"
      ? "Aqui trabajas telas, avios, despachos a produccion, devoluciones y ajustes del segundo piso."
      : vistaInicial === "producto-terminado"
      ? "Aqui trabajas prendas terminadas, control de calidad, tercerizaciones, remates y futuras salidas a tienda."
      : "Esta portada ahora separa mejor materia prima, producto terminado y control de talleres para que el personal encuentre rapido su zona.";
  const accesosRapidosVisibles = accesosRapidos.filter((item) => {
    if (vistaInicial === "materia-prima") {
      return [
        "/almacen/stock-telas",
        "/almacen/stock-avios",
        "/almacen/despacho-produccion",
      ].includes(item.ruta);
    }

    if (vistaInicial === "producto-terminado") {
      return [
        "/almacen/recepcion-taller",
        "/almacen/acondicionado-producto-terminado",
        "/almacen/productos-terminados",
        "/almacen/venta-directa",
        "/almacen/tercerizaciones",
      ].includes(item.ruta);
    }

    return true;
  }).filter((item) => puedeAccederRuta(item.ruta, perfil));

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
            <h1>{tituloVista}</h1>
            <p>{descripcionVista}</p>
            <small className="hero__subtexto">
              Portada organizada por zonas reales para que el personal encuentre rapido su tarea.
            </small>
          </div>

          <div className="hero__flujo">
            {accesosRapidosVisibles.map((item) => (
              <Link key={item.titulo} to={item.ruta}>
                {item.titulo}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <main className="contenido_principal">
        <section className="bloque bloque_paneles">
          <div className="bloque__cabecera">
            <h2>Zonas de trabajo</h2>
            <p>
              Primero se elige el tipo de almacen y luego el movimiento exacto.
              Asi se reduce la curva de aprendizaje en tablet.
            </p>
          </div>

          <div className="grid_paneles">
            {panelesVisibles.map((panel) => (
              <article className="panel_resumen" key={panel.titulo}>
                <h3>{panel.titulo}</h3>
                <p>{panel.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bloque">
          <div className="bloque__cabecera">
            <h2>Mapa de Almacen</h2>
            <p>
              Los modulos quedaron agrupados por area real de trabajo para que
              no se vea todo mezclado en una sola portada.
            </p>
          </div>

          <div className="grid_secciones">
            {seccionesConPermisos.map((seccion) => (
              <section className={`seccion_modulo seccion_${seccion.tono}`} key={seccion.grupo}>
                <div className="seccion_modulo__cabecera">
                  <span>{seccion.grupo}</span>
                  <p>{seccion.resumen}</p>
                </div>

                <div className="grid_accesos">
                  {seccion.modulos.map((item) => (
                    <article className="tarjeta_acceso" key={item.titulo}>
                      <div className="tarjeta_acceso__encabezado">
                        <span className="tarjeta_acceso__etapa">{item.etapa}</span>
                        <span className="tarjeta_acceso__icono">
                          <item.icono />
                        </span>
                      </div>
                      <div>
                        <h3>{item.titulo}</h3>
                        <p>{item.descripcion}</p>
                      </div>
                      {item.ruta ? (
                        <Link to={item.ruta} className="boton_acceso">
                          Abrir
                        </Link>
                      ) : (
                        <small>Proximo paso</small>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
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
    "contenido_principal" 1fr;

  .encabezado,
  .hero,
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

  .hero p,
  .bloque__cabecera p,
  .tarjeta_acceso p,
  .seccion_modulo__cabecera p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.7;
  }

  .hero__flujo {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .hero__flujo a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
    font-weight: 600;
    text-decoration: none;
    text-align: center;
    padding: 10px;
  }

  .contenido_principal {
    grid-area: contenido_principal;
    display: grid;
  }

  .bloque {
    border-radius: 20px;
    padding: 20px;
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .bloque_paneles {
    margin-bottom: 15px;
  }

  .bloque__cabecera {
    margin-bottom: 18px;
  }

  .bloque h2 {
    margin: 0 0 10px;
    font-size: 22px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .grid_secciones {
    display: grid;
    gap: 18px;
  }

  .grid_paneles {
    display: grid;
    gap: 12px;
  }

  .panel_resumen {
    display: grid;
    align-content: start;
    border-radius: 18px;
    padding: 16px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background:
      linear-gradient(180deg, ${({ theme }) => theme.bgcards} 0%, ${({ theme }) => theme.bgtotal} 100%);
    min-height: 150px;
  }

  .panel_resumen h3 {
    margin: 0 0 8px;
    font-size: 17px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .panel_resumen p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.6;
  }

  .seccion_modulo {
    border-radius: 20px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 14px;
    background:
      linear-gradient(135deg, rgba(117, 1, 152, 0.1), transparent 34%),
      ${({ theme }) => theme.bgtotal};
  }

  .seccion_modulo__cabecera {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }

  .seccion_modulo__cabecera span {
    width: fit-content;
    border-radius: 999px;
    padding: 7px 11px;
    background: ${({ theme }) => theme.bg5};
    color: #ffffff;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .grid_accesos {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .tarjeta_acceso {
    position: relative;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    gap: 10px;
    border-radius: 18px;
    padding: 14px;
    background: linear-gradient(
      180deg,
      ${({ theme }) => theme.bgcards} 0%,
      ${({ theme }) => theme.bgtotal} 100%
    );
    border: 1px solid ${({ theme }) => theme.bg4};
    min-height: 210px;
  }

  .tarjeta_acceso__encabezado {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .tarjeta_acceso__etapa {
    display: inline-flex;
    width: 38px;
    height: 38px;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
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
    border-radius: 11px;
    background-color: ${({ theme }) =>
      theme.bg === "#272727" ? "rgba(255,255,255,0.06)" : "rgba(117,1,152,0.08)"};
    color: ${({ theme }) => theme.bg5};
    font-size: 16px;
  }

  .tarjeta_acceso h3 {
    margin: 0 0 6px;
    font-size: 16px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .tarjeta_acceso p {
    margin: 0;
    font-size: 13px;
  }

  .tarjeta_acceso small {
    color: ${({ theme }) => theme.bg5};
    font-weight: 700;
  }

  .boton_acceso {
    width: fit-content;
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
  }

  @media (min-width: 768px) {
    .hero {
      padding: 30px;
    }

    .hero__contenido {
      grid-template-columns: 1.4fr 0.9fr;
      align-items: end;
    }

    .grid_secciones {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .grid_paneles {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .seccion_modulo {
      padding: 18px;
    }
  }

  @media (min-width: 1180px) {
    .grid_secciones {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .seccion_modulo:first-child,
    .seccion_modulo:nth-child(2) {
      min-height: 100%;
    }
  }

  ${tabletLandscapeBase}
  ${mobileStackBase}
`;
