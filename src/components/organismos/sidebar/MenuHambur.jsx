import { styled } from "styled-components";
import {
  LinksArray,
  SecondarylinksArray,
  SidebarCard,
  ToggleTema,
} from "../../../index";
import { NavLink } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { v } from "../../../styles/variables";
import { useEffect, useState } from "react";
import { resolverIdentidadVisualPorRuta } from "../../../utils/identidadVisual";
import { UserAuth } from "../../../context/AuthContext";
import { leerPerfilUsuario } from "../../../utils/perfilUsuario";
import { puedeAccederRuta } from "../../../utils/permisosSistema";

export function MenuHambur() {
  const [click, setClick] = useState(false);
  const { pathname } = useLocation();
  const { user } = UserAuth();
  const perfil = leerPerfilUsuario(user);
  const esCuentaTaller = (perfil?.rol || "").toUpperCase() === "TALLER";
  const linksVisibles = LinksArray.filter(
    ({ to }) => (!esCuentaTaller || to !== "/") && puedeAccederRuta(to, perfil)
  );
  const secundariosVisibles = SecondarylinksArray.filter(({ to }) => puedeAccederRuta(to, perfil));

  useEffect(() => {
    setClick(false);
  }, [pathname]);

  return (
    <Container>
      <NavBar>
        <section>
          <HamburgerMenu onClick={() => setClick((estadoAnterior) => !estadoAnterior)}>
            <label
              className={click ? "toggle active" : "toggle"}
            >
              <div className="bars" id="bar1"></div>
              <div className="bars" id="bar2"></div>
              <div className="bars" id="bar3"></div>
            </label>
          </HamburgerMenu>
        </section>
        <Menu $click={click.toString()}>
          {linksVisibles.map(({ icon, label, to }) => {
            const identidad = resolverIdentidadVisualPorRuta(to);
            return (
            <div
              onClick={() => setClick(false)}
              className="LinkContainer"
              key={label}
              style={{
                "--modulo-acento": identidad.acento,
                "--modulo-fondo": identidad.fondo,
              }}
            >
              <NavLink to={to} className="Links">
                <div className="Linkicon">{icon}</div>
                <span>{label}</span>
              </NavLink>
            </div>
          )})}
          <Divider />
          {secundariosVisibles.map(({ icon, label, to }) => {
            const identidad = resolverIdentidadVisualPorRuta(to);
            return (
            <div
              className="LinkContainer"
              key={label}
              onClick={() => setClick(false)}
              style={{
                "--modulo-acento": identidad.acento,
                "--modulo-fondo": identidad.fondo,
              }}
            >
              <NavLink to={to} className="Links">
                <div className="Linkicon">{icon}</div>
                <span>{label}</span>
              </NavLink>
            </div>
          )})}
          <ToggleTema />
          <Divider />
        </Menu>
      </NavBar>
    </Container>
  );
}

const Container = styled.div`
  background-color: ${(props) => props.theme.body};
`;

const NavBar = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100dvh;
`;
const HamburgerMenu = styled.span`
  position: fixed;
  top: 2rem;
  z-index: 100;

  #checkbox {
    display: none;
  }

  .toggle {
    position: relative;
    width: 40px;
    height: 30px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition-duration: 0.5s;
    &.active {
      transition-duration: 0.5s;
      transform: rotate(180deg);

      .bars {

        position: absolute;
        transition-duration: 0.5s;
      }

      #bar2 {
        transform: scaleX(0);
        transition-duration: 0.5s;
      }
      #bar1 {
        width: 100%;
        transform: rotate(45deg);
        transition-duration: 0.5s;
      }

      #bar3 {
        width: 100%;
        transform: rotate(-45deg);
        transition-duration: 0.5s;
      }
    }
  }

  .bars {
    width: 100%;
    height: 4px;
    background-color: ${(props)=> props.theme.text};
    border-radius: 4px;
  }

  #bar2 {
    transition-duration: 0.8s;
  }

  #bar1,
  #bar3 {
    width: 70%;
  }
`;
const Menu = styled.div`
  display: flex;
  align-items: stretch;
  list-style: none;
  z-index: 10;
  flex-direction: column;
  position: fixed;
  justify-content: flex-start;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  padding-top: calc(84px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));
  background-color: ${(props) => `rgba(${props.theme.bodyRgba},0.85)`};
  backdrop-filter: blur(3px);
  transform: ${(props) =>
    props.$click == "true" ? "translate3d(0, 0, 0)" : "translate3d(-100%, 0, 0)"};
  opacity: ${(props) => (props.$click == "true" ? "1" : "0")};
  visibility: ${(props) => (props.$click == "true" ? "visible" : "hidden")};
  pointer-events: ${(props) => (props.$click == "true" ? "auto" : "none")};
  transition: transform 0.28s ease, opacity 0.22s ease, visibility 0.22s ease;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${(props)=>props.theme.colorScroll};
    border-radius: 10px;
  }
    .LinkContainer{
      &:hover{
        background: var(--modulo-fondo, ${(props)=>props.theme.bgAlpha});

      }

      .Links{
        width:100%;
        display: flex;
        align-items:center;
        text-decoration:none;
        color: ${(props)=> props.theme.text};
        min-height: 64px;
        padding-right: 18px;
        position: relative;

        &.active {
          color: var(--modulo-acento, ${(props)=> props.theme.bg5});
          background: var(--modulo-fondo, transparent);
        }

        &.active::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          border-radius: 10px;
          background: var(--modulo-acento, ${(props)=> props.theme.bg5});
        }
        .Linkicon{
          padding: ${v.smSpacing} ${v.mdSpacing};
          display:flex;
          svg{
            font-size:25px;
          }


        }

        span {
          line-height: 1.2;
        }

      }
    }


`;
const Divider = styled.div`
  height: 1px;
  width: 100%;
  background: ${(props) => props.theme.bg4};
  margin: ${() => v.lgSpacing} 0;
`;
