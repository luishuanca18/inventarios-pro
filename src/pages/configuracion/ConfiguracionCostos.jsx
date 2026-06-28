import { Link } from "react-router-dom";
import styled from "styled-components";
import { useState } from "react";
import { FiDollarSign } from "react-icons/fi";
import { Header } from "../../index";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";
import { UserAuth } from "../../context/AuthContext";
import { leerPerfilUsuario } from "../../utils/perfilUsuario";
import { puedeAccederRuta } from "../../utils/permisosSistema";

const SUBMODULOS_COSTOS = [
  {
    titulo: "Pago por prenda a taller",
    descripcion:
      "Define cuanto se paga por modelo y, si hace falta, un costo especial por taller.",
    ruta: "/configurar/costos-taller",
  },
  {
    titulo: "Costos de terceros",
    descripcion:
      "Define cuanto cuesta cada proceso tercerizado y permite guardar una tarifa general o especial por taller.",
    ruta: "/configurar/costos-terceros",
  },
  {
    titulo: "Precio de venta por modelo",
    descripcion:
      "Mantiene el precio de venta de cada modelo para que Tiendas y Almacen jalen el valor correcto al vender.",
    ruta: "/configurar/precios-productos",
  },
  {
    titulo: "Sueldos del personal",
    descripcion:
      "Registra sueldos mensuales, moneda, fecha de inicio y observaciones del personal interno.",
    ruta: "/configurar/sueldos-personal",
  },
];

export function ConfiguracionCostos() {
  const { user } = UserAuth();
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Costos y Finanzas");
  const perfil = leerPerfilUsuario(user);
  const submodulosVisibles = SUBMODULOS_COSTOS.filter((item) =>
    puedeAccederRuta(item.ruta, perfil),
  );

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
        <div className="cabecera__contenido">
          <span className="cabecera__icono">
            <FiDollarSign />
          </span>
          <h1>Costos y Finanzas</h1>
          <p>
            Aqui se organiza todo lo que tiene relacion con pagos internos,
            costos por modelo, precios de venta y sueldos del personal, sin
            duplicar configuraciones en otros submodulos.
          </p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Submodulos de costos y finanzas</h2>
              <p>
                Cada bloque mantiene una parte distinta del costo para que luego
                Produccion, Talleres, Almacen y Ventas jalen de la misma base.
              </p>
            </div>
          </div>

          <div className="grid_submodulos">
            {submodulosVisibles.map((item, indice) => (
              <article key={item.titulo} className="tarjeta_submodulo">
                <span className="tarjeta_submodulo__numero">
                  {String(indice + 1).padStart(2, "0")}
                </span>
                <h3>{item.titulo}</h3>
                <p>{item.descripcion}</p>
                <Link to={item.ruta} className="boton_acceso">
                  Abrir submodulo
                </Link>
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
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .cabecera {
    background:
      linear-gradient(135deg, var(--modulo-fondo, rgba(22, 101, 52, 0.12)) 0%, ${({ theme }) => theme.bgcards} 100%);
  }

  .cabecera__contenido {
    display: grid;
    gap: 8px;
  }

  .cabecera__icono {
    display: inline-flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--modulo-fondo, ${({ theme }) => theme.bg});
    color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
  }

  .cabecera h1,
  .tarjeta h2,
  .tarjeta_submodulo h3 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .tarjeta_submodulo p {
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

  .grid_submodulos {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .tarjeta_submodulo {
    display: grid;
    gap: 10px;
    border-radius: 16px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 16px;
    background:
      linear-gradient(180deg, ${({ theme }) => theme.bg} 0%, ${({ theme }) => theme.bgcards} 100%);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
    max-width: 360px;
    width: 100%;
    min-height: 210px;
  }

  .tarjeta_submodulo__numero {
    display: inline-flex;
    width: 42px;
    height: 42px;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background-color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
    font-weight: 700;
  }

  .boton_acceso {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 6px;
    padding: 10px 14px;
    border-radius: 10px;
    background-color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
    text-decoration: none;
    font-weight: 700;
    width: fit-content;
  }
`;
