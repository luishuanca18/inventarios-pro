import { styled } from "styled-components";
import { Header } from "../../index";
import { useState } from "react";

export function PlantillaBase() {   //aqui es la plantilla de la pagina de inicio, se puede modificar a gusto, es solo un ejemplo de como usar el  grid para organizar los componentes

  const [state, setState] = useState(false);


  return (
    <Container>
      <header className="header">
        <Header 
            stateConfig={{state: state,setState:()=> setState(!state)}}                    
        />
      </header>
      <section className="area1"></section>
      <section className="area2"></section>

      <section className="main"></section>
    </Container>
  );
}
const Container = styled.div`
  height: 100vh;
  width: 100%;
  background-color: ${(theme) => theme.bgtotal};
  color: ${({ theme }) => theme.text};
  display: grid;
  padding: 15px;
  grid-template:
    "header" 100px
    "area1" 100px
    "area2" 100px
    "main" auto;

  .header {
    grid-area: header;
    background-color: rgb(180, 12, 152);
    display: flex;
    align-items: center;
  }
  .area1 {
    grid-area: area1;
    background-color: rgb(75, 34, 68);
    display: flex;
    align-items: center;
  }
  .area2 {
    grid-area: area2;
    background-color: rgb(34, 151, 197);
    display: flex;
    align-items: center;
  }
  .main {
    grid-area: main;
    background-color: rgb(59, 197, 158);
  }
`;
