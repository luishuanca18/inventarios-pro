import { useEffect, useState } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { Header } from "../../index";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";
import {
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  CATALOGOS_PRODUCCION_POR_DEFECTO,
  guardarCatalogosProduccion,
  leerCatalogosProduccion,
  normalizarTextoCatalogo,
} from "../../utils/catalogosProduccion";
import {
  mobileStackBase,
  tabletLandscapeBase,
} from "../../styles/tabletLayout";

export function ConfiguracionCatalogosModulo({
  titulo,
  descripcion,
  secciones = [],
  tarjetasExtra = [],
  grupoVisual = "Operacion",
  textoGuardar = "Catalogos guardados correctamente.",
  textoRestaurar = "Catalogos restaurados a sus valores base.",
  resolverCatalogosIniciales = null,
  panelSuperior = null,
}) {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo(grupoVisual);
  const [catalogos, setCatalogos] = useState(leerCatalogosProduccion);
  const [entradas, setEntradas] = useState(
    Object.fromEntries(secciones.map((item) => [item.clave, ""]))
  );
  const [cargandoCatalogos, setCargandoCatalogos] = useState(Boolean(resolverCatalogosIniciales));

  useEffect(() => {
    let activo = true;

    const cargarCatalogos = async () => {
      if (!resolverCatalogosIniciales) {
        setCargandoCatalogos(false);
        return;
      }

      try {
        const resultado = await resolverCatalogosIniciales();
        if (!activo || !resultado) return;
        setCatalogos(resultado);
      } finally {
        if (activo) setCargandoCatalogos(false);
      }
    };

    cargarCatalogos();
    return () => {
      activo = false;
    };
  }, [resolverCatalogosIniciales]);

  const manejarCambioEntrada = (clave, valor) => {
    setEntradas((anterior) => ({
      ...anterior,
      [clave]: valor.toUpperCase(),
    }));
  };

  const agregarItemCatalogo = (clave) => {
    const valor = normalizarTextoCatalogo(entradas[clave]);
    if (!valor) return;

    setCatalogos((anterior) => ({
      ...anterior,
      [clave]: Array.from(new Set([...(anterior[clave] || []), valor])),
    }));

    setEntradas((anterior) => ({
      ...anterior,
      [clave]: "",
    }));
  };

  const eliminarItemCatalogo = (clave, item) => {
    setCatalogos((anterior) => ({
      ...anterior,
      [clave]: (anterior[clave] || []).filter((valor) => valor !== item),
    }));
  };

  const guardarCambios = () => {
    const catalogosGuardados = guardarCatalogosProduccion(catalogos);
    setCatalogos(catalogosGuardados);
    mostrarNotificacionCarga(textoGuardar);
  };

  const restaurarCatalogos = () => {
    const catalogosGuardados = guardarCatalogosProduccion(
      CATALOGOS_PRODUCCION_POR_DEFECTO
    );
    setCatalogos(catalogosGuardados);
    setEntradas(Object.fromEntries(secciones.map((item) => [item.clave, ""])));
    mostrarNotificacionCarga(textoRestaurar);
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
          <h1>{titulo}</h1>
          <p>{descripcion}</p>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Catalogos del submodulo</h2>
              <p>
                Todo lo que agregues aqui queda listo para alimentar sus modulos
                correspondientes y evitar errores ortograficos.
              </p>
            </div>
          </div>

          {panelSuperior}

          <div className="grid_catalogos">
            {tarjetasExtra.map((tarjeta) => (
              <article
                key={tarjeta.clave}
                className="bloque_catalogo bloque_catalogo--extra"
              >
                {tarjeta.contenido}
              </article>
            ))}

            {secciones.map((seccion) => (
              <article key={seccion.clave} className="bloque_catalogo">
                <h3>{seccion.titulo}</h3>
                <div className="fila_nueva">
                  <input
                    type="text"
                    value={entradas[seccion.clave]}
                    onChange={(evento) =>
                      manejarCambioEntrada(seccion.clave, evento.target.value)
                    }
                    placeholder=""
                  />
                  <button
                    type="button"
                    className="btn btn_principal"
                    onClick={() => agregarItemCatalogo(seccion.clave)}
                  >
                    Agregar
                  </button>
                </div>

                <div className="lista_items">
                  {cargandoCatalogos ? (
                    <div className="item_vacio">Cargando catalogo...</div>
                  ) : (catalogos[seccion.clave] || []).length ? (
                    catalogos[seccion.clave].map((item) => (
                      <div key={`${seccion.clave}-${item}`} className="item_catalogo">
                        <span>{item}</span>
                        <button
                          type="button"
                          className="btn_quitar"
                          onClick={() => eliminarItemCatalogo(seccion.clave, item)}
                        >
                          Quitar
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="item_vacio">Sin datos todavia.</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="acciones">
          <Link to="/configurar" className="btn btn_secundario btn_enlace">
            Volver a Configuracion
          </Link>
          <button type="button" className="btn btn_secundario" onClick={restaurarCatalogos}>
            Restaurar base
          </button>
          <button type="button" className="btn btn_principal" onClick={guardarCambios}>
            Guardar catalogos
          </button>
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
  .bloque_catalogo h3 {
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

  .grid_catalogos {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }

  .bloque_catalogo {
    display: grid;
    grid-template-rows: auto auto 1fr;
    align-content: start;
    align-self: start;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 16px;
    background-color: ${({ theme }) => theme.bg};
  }

  .bloque_catalogo--extra {
    grid-template-rows: auto;
    max-height: 720px;
    overflow-y: auto;
    padding-right: 12px;
    scrollbar-width: thin;
    scrollbar-color: ${({ theme }) => theme.bg5} ${({ theme }) => theme.bg};
  }

  .bloque_catalogo--extra::-webkit-scrollbar {
    width: 8px;
  }

  .bloque_catalogo--extra::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.bg};
    border-radius: 999px;
  }

  .bloque_catalogo--extra::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.bg5};
    border-radius: 999px;
  }

  .bloque_catalogo h3 {
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .fila_nueva {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 110px;
    align-items: center;
    gap: 10px;
    margin: 14px 0;
  }

  .fila_nueva input {
    border: 1px solid ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bgcards};
    color: ${({ theme }) => theme.text};
    outline: none;
    min-height: 44px;
    box-sizing: border-box;
  }

  .lista_items {
    display: grid;
    gap: 10px;
    max-height: 280px;
    overflow-y: auto;
  }

  .item_catalogo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-radius: 10px;
    padding: 10px 12px;
    background-color: ${({ theme }) => theme.bgtotal};
  }

  .item_catalogo span {
    font-size: 14px;
    font-weight: 600;
  }

  .item_vacio {
    padding: 12px;
    border-radius: 10px;
    border: 1px dashed ${({ theme }) => theme.bg4};
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
    background-color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .fila_nueva .btn_principal {
    width: 110px;
    min-height: 44px;
    align-self: center;
    justify-self: end;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .btn_secundario,
  .btn_quitar {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_quitar {
    border: none;
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
    font-size: 13px;
  }

  .btn_enlace {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  @media (max-width: 860px) {
    .fila_nueva {
      grid-template-columns: 1fr;
    }

    .acciones {
      flex-direction: column;
    }

    .fila_nueva .btn_principal {
      width: 100%;
      justify-self: stretch;
    }
  }

  ${tabletLandscapeBase}
  ${mobileStackBase}
`;
