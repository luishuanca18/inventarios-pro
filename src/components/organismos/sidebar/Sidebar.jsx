import styled from "styled-components";
import {
  
  LinksArray,
  SecondarylinksArray,
  SidebarCard,
  ToggleTema,
} from "../../../index";
import {v} from "../../../styles/variables"
import { NavLink } from "react-router-dom";
import { resolverIdentidadVisualPorRuta } from "../../../utils/identidadVisual";
import { UserAuth } from "../../../context/AuthContext";
import { leerPerfilUsuario } from "../../../utils/perfilUsuario";
import { puedeAccederRuta } from "../../../utils/permisosSistema";

export function Sidebar({ state, setState }) {
  const { user } = UserAuth();
  const perfil = leerPerfilUsuario(user);
  const esCuentaTaller = (perfil?.rol || "").toUpperCase() === "TALLER";
  const linksVisibles = LinksArray.filter(
    ({ to }) => (!esCuentaTaller || to !== "/") && puedeAccederRuta(to, perfil)
  );
  const secundariosVisibles = SecondarylinksArray.filter(({ to }) => puedeAccederRuta(to, perfil));

  return (
    <Main $isopen={state.toString()}>
      <span className="Sidebarbutton" onClick={() => setState(!state)}>
        {<v.iconoflechaderecha />}
      </span>
      <Container $isopen={state.toString()} className={state ? "active" : ""}>
        <div className="Logocontent">
          <div className="imgcontent">
            <img src={v.logo} />
          </div>
          <h2>  CYNARA MODA URBANA</h2>
        </div>
        {linksVisibles.map(({ icon, label, to }) => {
          const identidad = resolverIdentidadVisualPorRuta(to);
          return (
          <div
            className={state ? "LinkContainer active" : "LinkContainer"}
            key={label}
            style={{
              "--modulo-acento": identidad.acento,
              "--modulo-fondo": identidad.fondo,
            }}
          >
            <NavLink
              to={to}
              className={({ isActive }) => `Links${isActive ? ` active` : ``}`}
            >
              <div className="Linkicon">{icon}</div>
              <span className={state ? "label_ver" : "label_oculto"}>
                {label}
              </span>
              
            </NavLink>
          </div>
        )})}
        <Divider />
        {secundariosVisibles.map(({ icon, label, to }) => {
          const identidad = resolverIdentidadVisualPorRuta(to);
          return (
          <div
            className={state ? "LinkContainer active" : "LinkContainer"}
            key={label}
            style={{
              "--modulo-acento": identidad.acento,
              "--modulo-fondo": identidad.fondo,
            }}
          >
            <NavLink
              to={to}
              className={({ isActive }) => `Links${isActive ? ` active` : ``}`}
            >
              <div className="Linkicon">{icon}</div>
              <span className={state ? "label_ver" : "label_oculto"}>
                {label}
              </span>
             
            </NavLink>
          </div>
        )})}
        <ToggleTema/>
        <Divider />
        {state && <SidebarCard />}
      </Container>
    </Main>
  );
}
const Container = styled.div`
  color: ${(props) => props.theme.text};
  background: ${(props) => props.theme.bg};
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  padding-top: 20px;
  padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  z-index: 1;
  height: 100dvh;
  max-height: 100dvh;
  width: 65px;
  transition: 0.1s ease-in-out;
  overflow-y: scroll;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  &::-webkit-scrollbar {
    width: 6px;
    border-radius: 10px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${(props)=>props.theme.colorScroll};
    border-radius: 10px;
  }

  &.active {
    width: 220px;
  }
  .Logocontent {
    display: flex;
    justify-content: center;
    align-items: center;
    padding-bottom: 60px;
    .imgcontent {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 30px;
      cursor: pointer;
      transition: 0.3s ease;
      transform: ${({ $isopen }) => ($isopen==="true" ? `scale(0.7)` : `scale(1.5)`)}
        rotate(${({ theme }) => theme.logorotate});
      img {
        width: 100%;
        animation: flotar 1.7s ease-in-out infinite alternate;
      }
    }
    h2 {
      display: ${({ $isopen }) => ($isopen==="true" ? `block` : `none`)};
    }
    @keyframes flotar {
      0% {
        transform: translate(0, 0px);
      }
      50% {
        transform: translate(0, 4px);
      }
      100% {
        transform: translate(0, -0px);
      }
    }
  }
  .LinkContainer {
    margin: 5px 0;
    transition: all 0.3s ease-in-out;
    padding: 0 5%;
    position: relative;
    &:hover {
      background: var(--modulo-fondo, ${(props) => props.theme.bgAlpha});
    }
    .Links {
      display: flex;
      align-items: center;
      text-decoration: none;
      padding: calc(${() => v.smSpacing} - 2px) 0;
      color: ${(props) => props.theme.text};
      height: 60px;
      .Linkicon {
        padding: ${() => v.smSpacing} ${() => v.mdSpacing};
        display: flex;
        svg {
          font-size: 25px;
        }
      }
      .label_ver {
        transition: 0.3s ease-in-out;
        opacity: 1;
      }
      .label_oculto {
        opacity: 0;
      }
      &.active {
        color: var(--modulo-acento, ${(props) => props.theme.bg5});
        font-weight:600;
        background: var(--modulo-fondo, transparent);
        border-radius: 14px;
        &::before {
          content: "";
          position: absolute;
          height: 100%;
          background: var(--modulo-acento, ${(props) => props.theme.bg5});
          width: 4px;
          border-radius: 10px;
          left: 0;
        }
      }
    }
    &.active {
      padding: 0;
    }
  }

  @media (min-width: 768px) and (max-width: 1366px) {
    width: 56px;
    padding-top: 14px;
    padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));

    &.active {
      width: 180px;
    }

    .Logocontent {
      padding-bottom: 32px;

      .imgcontent {
        width: 24px;
      }

      h2 {
        font-size: 15px;
        line-height: 1.2;
      }
    }

    .LinkContainer {
      margin: 2px 0;

      .Links {
        height: 52px;

        .Linkicon {
          padding: 10px 14px;

          svg {
            font-size: 22px;
          }
        }
      }
    }
  }

  @media (max-width: 767px) {
    width: 58px;
    padding-top: 12px;
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));

    &.active {
      width: 212px;
    }

    .Logocontent {
      padding-bottom: 22px;

      .imgcontent {
        width: 22px;
      }

      h2 {
        font-size: 13px;
        line-height: 1.15;
      }
    }

    .LinkContainer {
      margin: 1px 0;

      .Links {
        height: 50px;

        .Linkicon {
          padding: 10px 14px;

          svg {
            font-size: 20px;
          }
        }
      }
    }
  }
`;
const Main = styled.div`
  .Sidebarbutton {
    position: fixed;
    top: 70px;
    left: 42px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${(props) => props.theme.bgtgderecha};
    box-shadow: 0 0 4px ${(props) => props.theme.bg3},
      0 0 7px ${(props) => props.theme.bg};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 2;
    transform: ${({ $isopen }) =>
      $isopen==="true" ? `translateX(162px) rotate(3.142rad)` : `initial`};
    color: ${(props) => props.theme.text};
  }

  @media (min-width: 768px) and (max-width: 1366px) {
    .Sidebarbutton {
      top: 66px;
      left: 34px;
      width: 28px;
      height: 28px;
      transform: ${({ $isopen }) =>
        $isopen === "true" ? `translateX(132px) rotate(3.142rad)` : `initial`};
    }
  }

  @media (max-width: 767px) {
    .Sidebarbutton {
      top: 64px;
      left: 34px;
      width: 28px;
      height: 28px;
      transform: ${({ $isopen }) =>
        $isopen === "true" ? `translateX(154px) rotate(3.142rad)` : `initial`};
    }
  }
`;
const Divider = styled.div`
  height: 1px;
  width: 100%;
  background: ${(props) => props.theme.bg4};
  margin: ${() => v.lgSpacing} 0;
`;
