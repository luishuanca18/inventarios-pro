import { Link } from "react-router-dom";
import styled from "styled-components";
import { useState } from "react";
import { FiBookOpen, FiDollarSign, FiSettings, FiShield } from "react-icons/fi";
import { Header } from "../index";
import { HISTORIAL_VERSIONES, VERSION_SISTEMA } from "../utils/versionSistema";
import { UserAuth } from "../context/AuthContext";
import { leerPerfilUsuario } from "../utils/perfilUsuario";
import { puedeAccederRuta } from "../utils/permisosSistema";

const SUBMODULOS_CONFIGURACION = [
  {
    grupo: "Maestros",
    titulo: "Empresa",
    descripcion:
      "Empresas, sedes, monedas, datos fiscales, series de documentos e impuestos.",
    ruta: "/configurar/empresa",
    estado: "Base lista",
  },
  {
    grupo: "Maestros",
    titulo: "Clientes y proveedores",
    descripcion:
      "Clientes, RUC o DNI, proveedores, RUC, contactos y direcciones.",
    ruta: "/configurar/clientes-proveedores",
    estado: "Base lista",
  },
  {
    grupo: "Costos y Finanzas",
    titulo: "Costos y Finanzas",
    descripcion:
      "Pago por prenda a taller, precios de venta, sueldos del personal y otros costos del sistema.",
    ruta: "/configurar/costos",
    estado: "Activo",
  },
  {
    grupo: "Operacion",
    titulo: "Produccion",
    descripcion:
      "Catalogos operativos de Produccion: tipos de tela, colores, tallas, acabados y detalles de confeccion.",
    ruta: "/configurar/produccion",
    estado: "Activo",
  },
  {
    grupo: "Operacion",
    titulo: "Elasticos por modelo",
    descripcion:
      "Ficha tecnica del elastico por modelo, con ancho, largo por talla y base para calculo operativo.",
    ruta: "/configurar/elasticos-modelo",
    estado: "Activo",
  },
  {
    grupo: "Maestros",
    titulo: "Catalogo de productos",
    descripcion:
      "Maestro oficial de modelos, colores y tallas para que pedidos, stock y ventas trabajen con el mismo codigo.",
    ruta: "/configurar/catalogo-productos",
    estado: "Activo",
  },
  {
    grupo: "Maestros",
    titulo: "Fichas visuales de modelos",
    descripcion:
      "Fotos y notas visuales de cada modelo para que Produccion y Talleres lo reconozcan rapido.",
    ruta: "/configurar/modelos-visuales",
    estado: "Activo",
  },
  {
    grupo: "Maestros",
    titulo: "Fichas de talleres",
    descripcion:
      "Registro maestro de talleres, datos de contacto, capacidad, especialidad y acceso al sistema.",
    ruta: "/configurar/talleres",
    estado: "Activo",
  },
  {
    grupo: "Operacion",
    titulo: "Almacen",
    descripcion:
      "Unidades de medida, movimientos, ubicaciones, almacenes y motivos de ajuste.",
    ruta: "/configurar/almacen",
    estado: "Base lista",
  },
  {
    grupo: "Seguridad",
    titulo: "Catalogos de personal",
    descripcion:
      "Areas, cargos, roles y responsables para que luego aparezcan ordenados en fichas y cuentas del sistema.",
    ruta: "/configurar/catalogos-personal",
    estado: "Base lista",
  },
  {
    grupo: "Seguridad",
    titulo: "Personal y seguridad",
    descripcion:
      "Usuarios, roles, permisos, areas, responsables y accesos por modulo.",
    ruta: "/configurar/personal-seguridad",
    estado: "Base lista",
  },
  {
    grupo: "Operacion",
    titulo: "Documentos y numeracion",
    descripcion:
      "Correlativos de pedido, OP, ingresos, salidas y formatos de codigo.",
    ruta: "/configurar/documentos",
    estado: "Base lista",
  },
  {
    grupo: "Operacion",
    titulo: "Ventas e impresion",
    descripcion:
      "Formato de comprobantes, ticketera, impresion y reglas operativas para la venta.",
    ruta: "/configurar/ventas-impresion",
    estado: "Activo",
  },
  {
    grupo: "Operacion",
    titulo: "Reglas globales",
    descripcion:
      "Moneda, IGV, decimales, politicas de stock, canales, motivos y reglas generales del sistema.",
    ruta: "/configurar/parametros",
    estado: "Activo",
  },
];

const ORDEN_GRUPOS = ["Maestros", "Operacion", "Costos y Finanzas", "Seguridad"];

const DESCRIPCIONES_GRUPO = {
  Maestros:
    "Aqui viven las bases oficiales del sistema: catalogos, talleres, productos, empresa y terceros.",
  Operacion:
    "Aqui ajustas lo que mueve el trabajo diario: produccion, almacen, documentos, ventas y reglas generales.",
  "Costos y Finanzas":
    "Aqui se concentran pagos, precios, sueldos y referencias economicas del sistema.",
  Seguridad:
    "Aqui controlas usuarios, permisos, accesos y responsables.",
};

const ESTILOS_GRUPO = {
  Maestros: {
    icono: FiBookOpen,
    acento: "#0f766e",
    fondo: "rgba(15, 118, 110, 0.12)",
  },
  Operacion: {
    icono: FiSettings,
    acento: "#b45309",
    fondo: "rgba(180, 83, 9, 0.12)",
  },
  "Costos y Finanzas": {
    icono: FiDollarSign,
    acento: "#166534",
    fondo: "rgba(22, 101, 52, 0.12)",
  },
  Seguridad: {
    icono: FiShield,
    acento: "#7c3aed",
    fondo: "rgba(124, 58, 237, 0.12)",
  },
};

export function Configuracion() {
  const { user } = UserAuth();
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const perfil = leerPerfilUsuario(user);
  const gruposConfiguracion = ORDEN_GRUPOS.map((grupo) => ({
    grupo,
    descripcion: DESCRIPCIONES_GRUPO[grupo] || "",
    estilo: ESTILOS_GRUPO[grupo] || ESTILOS_GRUPO.Operacion,
    items: SUBMODULOS_CONFIGURACION.filter(
      (item) => item.grupo === grupo && puedeAccederRuta(item.ruta, perfil),
    ),
  })).filter((grupo) => grupo.items.length > 0);

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
          <h1>Configuracion</h1>
          <p>
            Aqui se organiza todo lo que alimenta al sistema para evitar errores
            ortograficos y mantener cada modulo conectado con sus catalogos.
          </p>
          <small className="version_actual">Version actual: {VERSION_SISTEMA}</small>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Submodulos de configuracion</h2>
              <p>
                Cada area se administra por separado para que sea mas facil encontrar
                que modificar sin mezclar catálogos distintos.
              </p>
            </div>
          </div>

          <div className="bloques_configuracion">
            {gruposConfiguracion.map((bloque) => (
              <section
                key={bloque.grupo}
                className="bloque_configuracion"
                style={{
                  "--grupo-acento": bloque.estilo.acento,
                  "--grupo-fondo": bloque.estilo.fondo,
                }}
              >
                <div className="bloque_configuracion__cabecera">
                  <div className="bloque_configuracion__titulo">
                    <span className="bloque_configuracion__icono">
                      <bloque.estilo.icono />
                    </span>
                    <div>
                      <h3>{bloque.grupo}</h3>
                      <p>{bloque.descripcion}</p>
                    </div>
                  </div>
                </div>

                <div className="grid_submodulos">
                  {bloque.items.map((item, indice) => (
                    <article key={item.titulo} className="tarjeta_submodulo">
                      <span className="tarjeta_submodulo__numero">
                        {String(indice + 1).padStart(2, "0")}
                      </span>
                      <h4>{item.titulo}</h4>
                      <p>{item.descripcion}</p>
                      <small>{item.estado}</small>
                      <Link to={item.ruta} className="boton_acceso">
                        Abrir submodulo
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Historial de versiones</h2>
              <p>
                Aqui puedes llevar control de lo que se va corrigiendo o agregando
                para que el sistema crezca con orden.
              </p>
            </div>
          </div>

          <div className="grid_versiones">
            {HISTORIAL_VERSIONES.map((item) => (
              <article key={item.version} className="tarjeta_version">
                <div className="tarjeta_version__cabecera">
                  <strong>{item.version}</strong>
                  <span>{item.fecha}</span>
                </div>
                <h3>{item.titulo}</h3>
                <p>{item.detalle}</p>
              </article>
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
  .tarjeta_submodulo h4,
  .bloque_configuracion__cabecera h3 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .tarjeta_submodulo p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .version_actual {
    display: inline-block;
    margin-top: 10px;
    color: ${({ theme }) => theme.bg5};
    font-weight: 700;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .tarjeta__encabezado {
    margin-bottom: 18px;
  }

  .grid_submodulos {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
    align-items: start;
    justify-items: center;
  }

  .bloques_configuracion {
    display: grid;
    gap: 20px;
  }

  .bloque_configuracion {
    display: grid;
    gap: 14px;
  }

  .bloque_configuracion__cabecera {
    padding: 14px 16px;
    border-radius: 14px;
    background:
      linear-gradient(135deg, ${({ theme }) => theme.bg} 0%, ${({ theme }) => theme.bgcards} 100%);
    border: 1px solid var(--grupo-acento, ${({ theme }) => theme.bg4});
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  }

  .bloque_configuracion__titulo {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .bloque_configuracion__icono {
    display: inline-flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--grupo-fondo, ${({ theme }) => theme.bg});
    color: var(--grupo-acento, ${({ theme }) => theme.bg5});
    flex-shrink: 0;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .bloque_configuracion__icono svg {
    font-size: 20px;
  }

  .bloque_configuracion__cabecera h3 {
    color: var(--grupo-acento, ${({ theme }) => theme.text});
  }

  .bloque_configuracion__cabecera p {
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .grid_versiones {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }

  .tarjeta_submodulo {
    display: grid;
    gap: 10px;
    border-radius: 16px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 18px;
    background:
      linear-gradient(180deg, ${({ theme }) => theme.bg} 0%, ${({ theme }) => theme.bgcards} 100%);
    max-width: 360px;
    width: 100%;
    min-height: 220px;
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.08);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }

  .tarjeta_submodulo:hover {
    transform: translateY(-3px);
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.12);
  }

  .tarjeta_version {
    display: grid;
    gap: 10px;
    border-radius: 16px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 18px;
    background-color: ${({ theme }) => theme.bg};
  }

  .tarjeta_version__cabecera {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .tarjeta_version__cabecera strong {
    color: ${({ theme }) => theme.bg5};
    font-size: 16px;
  }

  .tarjeta_version__cabecera span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;
    font-weight: 600;
  }

  .tarjeta_submodulo__numero {
    display: inline-flex;
    width: 42px;
    height: 42px;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background-color: var(--grupo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
    font-weight: 700;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.16);
  }

  .tarjeta_submodulo small {
    color: var(--grupo-acento, ${({ theme }) => theme.bg5});
    font-weight: 700;
    margin-top: auto;
  }

  .boton_acceso {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 6px;
    padding: 10px 14px;
    border-radius: 10px;
    background-color: var(--grupo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
    text-decoration: none;
    font-weight: 700;
    width: fit-content;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.14);
  }
`;
