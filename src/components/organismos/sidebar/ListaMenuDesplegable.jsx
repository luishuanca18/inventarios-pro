import styled from "styled-components";
import { Icono, v } from "../../../index";

export function ListaMenuDesplegable({ data, top, funcion, resumen }) {
  return (
    <Container top={top}>
      {resumen ? (
        <ResumenUsuario>
          <strong>{resumen.nombreVisible || "Usuario"}</strong>
          <span>{resumen.rol || "-"}</span>
          <small>{resumen.area || "-"}</small>
        </ResumenUsuario>
      ) : null}
      {data.map((item, index) => {
        return (
          <ItemsDesplegable key={index} onClick={() => funcion(item)}>
            <Icono>{item.icono}</Icono>
            <span>{item.text}</span>
          </ItemsDesplegable>
        );
      })}
    </Container>
  );
}
const Container = styled.div`
  padding: 10px;
  display: flex;
  flex-direction: column;
  position: absolute;
  background-color: ${({ theme }) => theme.bg3};
  border-radius: 22px;
  top: ${(props) => props.top};
  box-shadow: ${() => v.boxshadowGray};
  z-index: 1;
`;
const ResumenUsuario = styled.div`
  display: grid;
  gap: 4px;
  padding: 10px 12px 14px;
  margin-bottom: 8px;
  border-bottom: 1px solid ${({ theme }) => theme.bg4};

  strong {
    font-size: 14px;
  }

  span,
  small {
    color: ${({ theme }) => theme.colorSubtitle};
  }
`;
const ItemsDesplegable = styled.div`
  cursor: pointer;
  padding: 8px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  &:hover {
    background-color: ${({ theme }) => theme.bg4};
  }
  svg {
    font-size: 28px;
    display: block;
  }
`;
