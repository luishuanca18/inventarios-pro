import styled, { ThemeProvider, createGlobalStyle } from "styled-components";
import {
  AuthContextProvider,
  Dark,
  Light,
  Login,
  MyRoutes,
  Sidebar,
} from "./index";
import { createContext, useEffect, useState } from "react";
import { Device } from "./styles/breackpoints";
import { MenuHambur } from "./index";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useLocation } from "react-router-dom";
import { resolverIdentidadVisualPorRuta } from "./utils/identidadVisual";

export const ThemeContext = createContext(null);
const CLAVE_TEMA = "tema-cynara";

const EstilosGlobales = createGlobalStyle`
  /* Quita las flechas de los inputs numericos en todo el sistema. */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  /* Mantiene legibles los textos de selects y sugerencias del navegador. */
  input,
  textarea {
    color: inherit;
    -webkit-text-fill-color: currentColor;
  }

  select {
    color-scheme: light;
    color: inherit;
  }

  select,
  option,
  optgroup {
    background-color: #ffffff;
    color: #111111;
  }

  input::placeholder,
  textarea::placeholder {
    color: #a9adb5;
    opacity: 1;
  }

  /* Unifica el icono del calendario para todos los inputs date del sistema. */
  input[type="date"]::-webkit-calendar-picker-indicator {
    cursor: pointer;
    filter: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "none" : "invert(1) brightness(1.15)"};
    opacity: 1;
  }

  input[type="date"]::-moz-calendar-picker-indicator {
    filter: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "none" : "invert(1) brightness(1.15)"};
    opacity: 1;
  }

  .modulo-tematizado .cabecera,
  .modulo-tematizado .tarjeta,
  .modulo-tematizado .tarjeta_interna,
  .modulo-tematizado .tarjeta_vacia,
  .modulo-tematizado .resumen_card,
  .modulo-tematizado .tarjeta_acceso,
  .modulo-tematizado .tarjeta_pedido,
  .modulo-tematizado .tarjeta_stock,
  .modulo-tematizado .permiso_card,
  .modulo-tematizado .historial_card,
  .modulo-tematizado .bloque_correlativo,
  .modulo-tematizado .ficha_card {
    position: relative;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--modulo-acento, #4f46e5) 18%, transparent);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--modulo-fondo, rgba(79, 70, 229, 0.14)) 52%, transparent),
        transparent 45%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, ${({ theme }) => theme.bgcards} 92%, #ffffff 8%),
        ${({ theme }) => theme.bgcards}
      );
  }

  .modulo-tematizado .cabecera::before,
  .modulo-tematizado .tarjeta::before,
  .modulo-tematizado .tarjeta_interna::before,
  .modulo-tematizado .tarjeta_vacia::before,
  .modulo-tematizado .resumen_card::before,
  .modulo-tematizado .tarjeta_acceso::before,
  .modulo-tematizado .tarjeta_pedido::before,
  .modulo-tematizado .tarjeta_stock::before,
  .modulo-tematizado .permiso_card::before,
  .modulo-tematizado .historial_card::before,
  .modulo-tematizado .bloque_correlativo::before,
  .modulo-tematizado .ficha_card::before {
    content: "";
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(
      90deg,
      var(--modulo-acento, #4f46e5),
      color-mix(in srgb, var(--modulo-acento, #4f46e5) 42%, #ffffff 58%)
    );
    opacity: 0.92;
    pointer-events: none;
  }

  .modulo-tematizado .cabecera {
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--modulo-fondo, rgba(79, 70, 229, 0.14)) 82%, transparent),
        transparent 68%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, ${({ theme }) => theme.bgcards} 90%, #ffffff 10%),
        ${({ theme }) => theme.bgcards}
      );
  }

  .modulo-tematizado .cabecera__estado,
  .modulo-tematizado .version_actual {
    border: 1px solid color-mix(in srgb, var(--modulo-acento, #4f46e5) 18%, transparent);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--modulo-fondo, rgba(79, 70, 229, 0.14)) 92%, transparent),
        transparent 80%
      ),
      ${({ theme }) => theme.bgtotal};
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
  }

  .modulo-tematizado .cabecera__estado strong,
  .modulo-tematizado .version_actual strong,
  .modulo-tematizado .resumen_card strong,
  .modulo-tematizado .monto_destacado {
    color: var(--modulo-acento, #4f46e5);
  }

  .modulo-tematizado .tarjeta__encabezado h2,
  .modulo-tematizado .tarjeta h2,
  .modulo-tematizado .cabecera h1 {
    color: ${({ theme }) => theme.text};
  }

  .modulo-tematizado .pestana_activa,
  .modulo-tematizado .pestana:hover {
    border-color: color-mix(in srgb, var(--modulo-acento, #4f46e5) 35%, transparent);
    background-color: color-mix(
      in srgb,
      var(--modulo-fondo, rgba(79, 70, 229, 0.14)) 96%,
      transparent
    );
    color: var(--modulo-acento, #4f46e5);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  }

  .modulo-tematizado .btn_principal {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--modulo-acento, #4f46e5) 92%, #ffffff 8%),
      color-mix(in srgb, var(--modulo-acento, #4f46e5) 76%, #111827 24%)
    );
    color: #ffffff;
    border: 1px solid color-mix(in srgb, var(--modulo-acento, #4f46e5) 82%, #000000 18%);
    box-shadow: 0 16px 28px color-mix(in srgb, var(--modulo-acento, #4f46e5) 22%, transparent);
  }

  .modulo-tematizado .btn_principal:hover {
    filter: brightness(1.04);
    transform: translateY(-1px);
  }

  .modulo-tematizado .btn_enlace,
  .modulo-tematizado .btn_tabla {
    box-shadow: 0 12px 22px color-mix(in srgb, var(--modulo-acento, #4f46e5) 18%, transparent);
  }

  .modulo-tematizado .tarjeta_acceso__icono,
  .modulo-tematizado .tarjeta_acceso__etapa,
  .modulo-tematizado .tarjeta_resumen_color_activa,
  .modulo-tematizado .tarjeta_pedido_activa {
    background-color: color-mix(
      in srgb,
      var(--modulo-fondo, rgba(79, 70, 229, 0.14)) 95%,
      transparent
    );
    color: var(--modulo-acento, #4f46e5);
    border-color: color-mix(in srgb, var(--modulo-acento, #4f46e5) 24%, transparent);
  }

  .modulo-tematizado .tarjeta:hover,
  .modulo-tematizado .tarjeta_interna:hover,
  .modulo-tematizado .tarjeta_acceso:hover,
  .modulo-tematizado .tarjeta_pedido:hover,
  .modulo-tematizado .tarjeta_stock:hover,
  .modulo-tematizado .ficha_card:hover,
  .modulo-tematizado .bloque_correlativo:hover {
    box-shadow: 0 22px 46px rgba(15, 23, 42, 0.12);
  }

  @media (min-width: 900px) and (max-width: 1366px) and (orientation: landscape) {
    .modulo-tematizado {
      font-size: 14px;
    }

    .modulo-tematizado .cabecera,
    .modulo-tematizado .tarjeta,
    .modulo-tematizado .tarjeta_interna,
    .modulo-tematizado .tarjeta_vacia,
    .modulo-tematizado .resumen_card,
    .modulo-tematizado .tarjeta_acceso,
    .modulo-tematizado .tarjeta_pedido,
    .modulo-tematizado .tarjeta_stock,
    .modulo-tematizado .permiso_card,
    .modulo-tematizado .historial_card,
    .modulo-tematizado .bloque_correlativo,
    .modulo-tematizado .ficha_card,
    .modulo-tematizado .version_actual {
      padding: 14px !important;
      border-radius: 14px;
    }

    .modulo-tematizado .cabecera h1,
    .modulo-tematizado .hero h1 {
      font-size: clamp(24px, 2.6vw, 30px);
      line-height: 1.08;
    }

    .modulo-tematizado .tarjeta h2,
    .modulo-tematizado .tarjeta__encabezado h2,
    .modulo-tematizado .cabecera h2 {
      font-size: clamp(17px, 1.7vw, 21px);
      line-height: 1.15;
    }

    .modulo-tematizado .cabecera__estado,
    .modulo-tematizado .version_actual {
      padding: 10px 12px !important;
      border-radius: 12px;
    }

    .modulo-tematizado .cabecera__estado span,
    .modulo-tematizado .version_actual span,
    .modulo-tematizado .tarjeta p,
    .modulo-tematizado .tarjeta small,
    .modulo-tematizado .cabecera p,
    .modulo-tematizado .cabecera small {
      font-size: 12px;
      line-height: 1.35;
    }

    .modulo-tematizado .cabecera__estado strong,
    .modulo-tematizado .version_actual strong,
    .modulo-tematizado .resumen_card strong {
      font-size: 19px;
    }

    .modulo-tematizado .fila_superior,
    .modulo-tematizado .tarjeta__encabezado,
    .modulo-tematizado .acciones,
    .modulo-tematizado .acciones_tabla,
    .modulo-tematizado .navegacion_superior,
    .modulo-tematizado .paginacion,
    .modulo-tematizado .pestanas,
    .modulo-tematizado .resumen__grid {
      gap: 10px !important;
    }

    .modulo-tematizado .pestanas {
      padding: 7px !important;
      border-radius: 14px;
    }

    .modulo-tematizado .pestana,
    .modulo-tematizado .tab,
    .modulo-tematizado .submodulo_link,
    .modulo-tematizado .btn,
    .modulo-tematizado .btn_enlace,
    .modulo-tematizado .btn_tabla,
    .modulo-tematizado .btn_principal,
    .modulo-tematizado .boton_volver {
      min-height: 38px;
      padding: 8px 12px !important;
      font-size: 12px !important;
      border-radius: 12px;
    }

    .modulo-tematizado input,
    .modulo-tematizado select,
    .modulo-tematizado textarea {
      min-height: 38px;
      padding: 9px 11px !important;
      font-size: 13px !important;
      border-radius: 12px;
    }

    .modulo-tematizado textarea {
      min-height: 92px;
    }

    .modulo-tematizado th,
    .modulo-tematizado td {
      padding: 8px 9px !important;
      font-size: 12px !important;
      line-height: 1.25;
    }

    .modulo-tematizado th {
      font-size: 11px !important;
      letter-spacing: 0.02em;
    }

    .modulo-tematizado .tabla_contenedor,
    .modulo-tematizado .tabla_listview {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
  }

  @media (max-width: 1024px) {
    .modulo-produccion .cabecera,
    .modulo-produccion .tarjeta,
    .modulo-produccion .tarjeta_interna,
    .modulo-produccion .resumen_card,
    .modulo-almacen .cabecera,
    .modulo-almacen .tarjeta,
    .modulo-almacen .tarjeta_interna,
    .modulo-almacen .resumen_card {
      padding: 16px !important;
      border-radius: 16px;
    }

    .modulo-produccion .tarjeta__encabezado,
    .modulo-almacen .tarjeta__encabezado,
    .modulo-produccion .cabecera__estado,
    .modulo-almacen .cabecera__estado {
      gap: 10px;
    }

    .modulo-produccion table,
    .modulo-almacen table {
      font-size: 13px;
    }

    .modulo-produccion th,
    .modulo-produccion td,
    .modulo-almacen th,
    .modulo-almacen td {
      padding: 9px 10px !important;
    }

    .modulo-produccion .btn,
    .modulo-almacen .btn {
      min-height: 38px;
      padding: 8px 12px;
    }

    .modulo-produccion input,
    .modulo-produccion select,
    .modulo-produccion textarea,
    .modulo-almacen input,
    .modulo-almacen select,
    .modulo-almacen textarea {
      min-height: 40px;
    }
  }

  @media (max-width: 640px) {
    .modulo-produccion .cabecera,
    .modulo-produccion .tarjeta,
    .modulo-produccion .tarjeta_interna,
    .modulo-produccion .resumen_card,
    .modulo-almacen .cabecera,
    .modulo-almacen .tarjeta,
    .modulo-almacen .tarjeta_interna,
    .modulo-almacen .resumen_card {
      padding: 14px !important;
      border-radius: 14px;
    }

    .modulo-produccion table,
    .modulo-almacen table {
      font-size: 12px;
    }

    .modulo-produccion th,
    .modulo-produccion td,
    .modulo-almacen th,
    .modulo-almacen td {
      padding: 8px 8px !important;
    }

    .modulo-produccion .cabecera__estado strong,
    .modulo-almacen .cabecera__estado strong {
      font-size: 22px;
    }
  }
`;

function App() {
  const [themeuse, setTheme] = useState(() => {
    const temaGuardado = localStorage.getItem(CLAVE_TEMA);
    return temaGuardado === "light" ? "light" : "dark";
  });
  const theme = themeuse === "light" ? "light" : "dark";
  const themeStyle = theme === "light" ? Light : Dark;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const identidadVisualActual = resolverIdentidadVisualPorRuta(pathname);

  useEffect(() => {
    localStorage.setItem(CLAVE_TEMA, theme);
  }, [theme]);

  return (
    <div>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <ThemeProvider theme={themeStyle}>
          <EstilosGlobales />
          <AuthContextProvider>
            {pathname == "/login" ? (
              <Login />
            ) : (
              <Container className={sidebarOpen ? "active" : ""}>
                <section className="ContentSidebar">
                  <Sidebar
                    state={sidebarOpen}
                    setState={() => setSidebarOpen(!sidebarOpen)}
                  />{" "}
                </section>
                <section className="ContentMenuambur">
                  {" "}
                  <MenuHambur />{" "}
                </section>
                <section className="ContentRoutes">
                  <div
                    className={`modulo-tematizado modulo-${identidadVisualActual.clave}`}
                    style={{
                      "--modulo-acento": identidadVisualActual.acento,
                      "--modulo-fondo": identidadVisualActual.fondo,
                    }}
                  >
                    <MyRoutes />
                  </div>
                </section>
              </Container>
            )}

            <ReactQueryDevtools initialIsOpen={false} />
          </AuthContextProvider>
        </ThemeProvider>
      </ThemeContext.Provider>
    </div>
  );
}

const Container = styled.main`
  display: grid;
  grid-template-columns: 1fr;
  background-color: ${({ theme }) => theme.bgtotal};
  .ContentSidebar {
    display: none;
  }
  .ContentMenuambur {
    display: block;
    position: absolute;
    left: 20px;
  }
  .ContentRoutes {
    min-width: 0;
    width: 100%;
  }
  @media ${Device.tablet} {
    grid-template-columns: 65px 1fr;
    &.active {
      grid-template-columns: 220px 1fr;
    }
    .ContentSidebar {
      display: initial;
    }
    .ContentMenuambur {
      display: none;
    }
    .ContentRoutes {
      grid-column: 1;
      width: 100%;
      @media ${Device.tablet} {
        grid-column: 2;
      }
    }
  }
  @media (min-width: 768px) and (max-width: 1366px) {
    grid-template-columns: 56px minmax(0, 1fr);

    &.active {
      grid-template-columns: 180px minmax(0, 1fr);
    }
  }
`;

export default App;
