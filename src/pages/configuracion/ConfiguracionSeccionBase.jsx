import { Link } from "react-router-dom";
import styled from "styled-components";
import { useState } from "react";
import { Header } from "../../index";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";
import {
  mobileStackBase,
  tabletLandscapeBase,
} from "../../styles/tabletLayout";

export function ConfiguracionSeccionBase({
  titulo,
  descripcion,
  ejemplos = [],
  grupoVisual = "Operacion",
}) {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo(grupoVisual);

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
          <h2>Base del submodulo</h2>
          <p>
            Esta area ya esta separada para que despues carguemos sus catalogos
            sin mezclar contenidos de otras areas.
          </p>

          <div className="lista_ejemplos">
            {ejemplos.map((item) => (
              <div key={item} className="item_ejemplo">
                {item}
              </div>
            ))}
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
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .lista_ejemplos {
    display: grid;
    gap: 10px;
    margin-top: 18px;
  }

  .item_ejemplo {
    border-radius: 12px;
    padding: 12px 14px;
    background-color: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.bg4};
    font-weight: 600;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
  }

  .btn {
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_enlace {
    box-shadow: inset 0 0 0 1px var(--modulo-acento, transparent);
  }

  .btn_enlace {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  ${tabletLandscapeBase}
  ${mobileStackBase}
`;
