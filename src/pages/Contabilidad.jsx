import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../index";
import { VERSION_SISTEMA } from "../utils/versionSistema";
import { resolverIdentidadVisualPorRuta } from "../utils/identidadVisual";

const CAMPOS_BASE = [
  "Fecha / OP / modelo / color",
  "Proveedor y tipo de tela",
  "Tipo de comprobante",
  "Precio de tela con IGV",
  "Consumo real por prenda (kg o mts)",
  "Merma real valorizada",
  "Total de unidades",
  "Costo de taller",
  "Costo de multiaguja",
  "Costo de lavanderia",
  "Costo de elastico",
  "Poliamida / ribbon",
];

const CAMPOS_AUTOMATICOS = [
  "Costo de tela sin IGV",
  "Costo unitario de tela por prenda",
  "Costo total variable por prenda",
  "Costo total de fabricacion",
  "Impacto de la merma",
  "Impacto de factura / sin factura",
  "Costo total por OP",
];

const SUGERENCIAS_MEJORA = [
  "Guardar merma real por color y por OP, no solo el total general.",
  "Separar datos manuales de columnas calculadas para que no se mezclen.",
  "Definir si el comprobante afecta credito fiscal con un SI / NO, no solo con texto libre.",
  "Tener costos de servicios en una tabla aparte para no repetirlos fila por fila.",
  "Agregar luego gastos fijos unitarios cuando cierres la parte operativa.",
];

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const formatearSoles = (valor) =>
  `S/ ${convertirNumero(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const crearFormularioBase = () => ({
  precioTelaConIgv: 30,
  comprobante: "FACTURA",
  consumoRealPrenda: 0.48,
  mermaValorizadaOp: 0,
  totalUnidades: 32,
  costoElasticoPrenda: 0.14,
  costoPoliamidaPrenda: 0.02,
  costoTallerPrenda: 1.7,
  costoMultiagujaPrenda: 0.4,
  costoLavanderiaPrenda: 0,
  costoPloteoPrenda: 0.13,
  costoModPrenda: 0,
  gastoFijoUnitario: 1.9,
  utilidadPorcentaje: 0.3,
});

export function Contabilidad() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [formulario, setFormulario] = useState(crearFormularioBase);
  const identidadModulo = resolverIdentidadVisualPorRuta("/contabilidad");

  const manejarCambio = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({
      ...anterior,
      [name]: name === "comprobante" ? value : value,
    }));
  };

  const calculo = useMemo(() => {
    const precioTelaConIgv = convertirNumero(formulario.precioTelaConIgv);
    const consumoRealPrenda = convertirNumero(formulario.consumoRealPrenda);
    const totalUnidades = Math.max(convertirNumero(formulario.totalUnidades), 1);
    const mermaValorizadaOp = convertirNumero(formulario.mermaValorizadaOp);
    const costoElasticoPrenda = convertirNumero(formulario.costoElasticoPrenda);
    const costoPoliamidaPrenda = convertirNumero(formulario.costoPoliamidaPrenda);
    const costoTallerPrenda = convertirNumero(formulario.costoTallerPrenda);
    const costoMultiaguajaPrenda = convertirNumero(formulario.costoMultiagujaPrenda);
    const costoLavanderiaPrenda = convertirNumero(formulario.costoLavanderiaPrenda);
    const costoPloteoPrenda = convertirNumero(formulario.costoPloteoPrenda);
    const costoModPrenda = convertirNumero(formulario.costoModPrenda);
    const gastoFijoUnitario = convertirNumero(formulario.gastoFijoUnitario);
    const utilidadPorcentaje = convertirNumero(formulario.utilidadPorcentaje);

    const tieneFactura = formulario.comprobante === "FACTURA";
    const costoTelaBase = tieneFactura ? precioTelaConIgv / 1.18 : precioTelaConIgv;
    const igvCompraNoRecuperable = tieneFactura ? 0 : precioTelaConIgv - precioTelaConIgv / 1.18;
    const costoTelaPrenda = costoTelaBase * consumoRealPrenda;
    const mermaPorPrenda = mermaValorizadaOp / totalUnidades;
    const costoMaterialesPrenda =
      costoTelaPrenda + mermaPorPrenda + costoElasticoPrenda + costoPoliamidaPrenda;
    const costoFabricacionPrenda =
      costoMaterialesPrenda +
      costoTallerPrenda +
      costoMultiaguajaPrenda +
      costoLavanderiaPrenda +
      costoPloteoPrenda +
      costoModPrenda;
    const costoTotalPrenda = costoFabricacionPrenda + gastoFijoUnitario;
    const costoTotalOp = costoTotalPrenda * totalUnidades;
    const valorVentaSugerido = costoTotalPrenda * (1 + utilidadPorcentaje);

    return {
      tieneFactura,
      costoTelaBase,
      igvCompraNoRecuperable,
      costoTelaPrenda,
      mermaPorPrenda,
      costoMaterialesPrenda,
      costoFabricacionPrenda,
      costoTotalPrenda,
      costoTotalOp,
      valorVentaSugerido,
    };
  }, [formulario]);

  return (
    <ContenedorPagina
      style={{
        "--modulo-acento": identidadModulo.acento,
        "--modulo-fondo": identidadModulo.fondo,
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
          <h1>Contabilidad</h1>
          <p>
            Te dejé una base para probar costo de produccion y ver rapido que cambia
            si sube la tela, la merma o el tipo de comprobante.
          </p>
          <small className="version_actual">{VERSION_SISTEMA} | Contabilidad</small>
        </div>
      </section>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Simulador base de costo de produccion</h2>
              <p>
                Esto es para prueba y validacion. Luego lo conectamos a OP reales,
                costos de taller y datos del Excel para que salga automatico.
              </p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Precio tela con IGV</label>
              <input type="number" step="0.01" name="precioTelaConIgv" value={formulario.precioTelaConIgv} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Tipo de comprobante</label>
              <select name="comprobante" value={formulario.comprobante} onChange={manejarCambio}>
                <option value="FACTURA">FACTURA</option>
                <option value="SIN FACTURA">SIN FACTURA</option>
              </select>
            </Campo>
            <Campo>
              <label>Consumo real por prenda (kg o mts)</label>
              <input type="number" step="0.0001" name="consumoRealPrenda" value={formulario.consumoRealPrenda} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Merma valorizada de la OP</label>
              <input type="number" step="0.01" name="mermaValorizadaOp" value={formulario.mermaValorizadaOp} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Total unidades OP</label>
              <input type="number" step="1" name="totalUnidades" value={formulario.totalUnidades} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Elastico por prenda</label>
              <input type="number" step="0.01" name="costoElasticoPrenda" value={formulario.costoElasticoPrenda} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Poliamida / ribbon por prenda</label>
              <input type="number" step="0.01" name="costoPoliamidaPrenda" value={formulario.costoPoliamidaPrenda} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Taller por prenda</label>
              <input type="number" step="0.01" name="costoTallerPrenda" value={formulario.costoTallerPrenda} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Multiaguja por prenda</label>
              <input type="number" step="0.01" name="costoMultiagujaPrenda" value={formulario.costoMultiagujaPrenda} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Lavanderia por prenda</label>
              <input type="number" step="0.01" name="costoLavanderiaPrenda" value={formulario.costoLavanderiaPrenda} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Ploteo por prenda</label>
              <input type="number" step="0.01" name="costoPloteoPrenda" value={formulario.costoPloteoPrenda} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>MOD corte y tiz ado por prenda</label>
              <input type="number" step="0.01" name="costoModPrenda" value={formulario.costoModPrenda} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>Gasto fijo unitario</label>
              <input type="number" step="0.01" name="gastoFijoUnitario" value={formulario.gastoFijoUnitario} onChange={manejarCambio} />
            </Campo>
            <Campo>
              <label>% utilidad</label>
              <input type="number" step="0.01" name="utilidadPorcentaje" value={formulario.utilidadPorcentaje} onChange={manejarCambio} />
            </Campo>
          </div>
        </section>

        <section className="grid_resultados">
          <article className="tarjeta resumen_card">
            <span>Costo tela sin IGV</span>
            <strong>{formatearSoles(calculo.costoTelaBase)}</strong>
          </article>
          <article className="tarjeta resumen_card">
            <span>Costo tela por prenda</span>
            <strong>{formatearSoles(calculo.costoTelaPrenda)}</strong>
          </article>
          <article className="tarjeta resumen_card">
            <span>Merma por prenda</span>
            <strong>{formatearSoles(calculo.mermaPorPrenda)}</strong>
          </article>
          <article className="tarjeta resumen_card">
            <span>Costo materiales por prenda</span>
            <strong>{formatearSoles(calculo.costoMaterialesPrenda)}</strong>
          </article>
          <article className="tarjeta resumen_card">
            <span>Costo total por prenda</span>
            <strong>{formatearSoles(calculo.costoTotalPrenda)}</strong>
          </article>
          <article className="tarjeta resumen_card">
            <span>Costo total de la OP</span>
            <strong>{formatearSoles(calculo.costoTotalOp)}</strong>
          </article>
          <article className="tarjeta resumen_card">
            <span>IGV no recuperable</span>
            <strong>{formatearSoles(calculo.igvCompraNoRecuperable)}</strong>
          </article>
          <article className="tarjeta resumen_card">
            <span>Valor venta sugerido</span>
            <strong>{formatearSoles(calculo.valorVentaSugerido)}</strong>
          </article>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Estructura recomendada para el sistema</h2>
              <p>
                Esto ya separa lo que conviene escribir manualmente de lo que el
                sistema debe calcular solo.
              </p>
            </div>
          </div>

          <div className="grid_listas">
            <article className="bloque_card">
              <strong>Campos base a registrar</strong>
              <div className="lista_resumen">
                {CAMPOS_BASE.map((item) => (
                  <div key={item} className="item_resumen">
                    {item}
                  </div>
                ))}
              </div>
            </article>
            <article className="bloque_card">
              <strong>Campos automaticos</strong>
              <div className="lista_resumen">
                {CAMPOS_AUTOMATICOS.map((item) => (
                  <div key={item} className="item_resumen">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Cosas que conviene cambiar de tu cuadro actual</h2>
              <p>
                Esto te va a ayudar a que luego el sistema sea mas estable que el Excel
                y no se rompa por referencias ocultas.
              </p>
            </div>
          </div>

          <div className="lista_resumen">
            {SUGERENCIAS_MEJORA.map((item) => (
              <div key={item} className="item_resumen">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="acciones">
          <Link to="/" className="btn btn_secundario btn_enlace">
            Volver al inicio
          </Link>
          <Link to="/reportes" className="btn btn_principal btn_enlace">
            Ir a reportes
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

  .version_actual {
    display: inline-block;
    margin-top: 10px;
    color: var(--modulo-acento, ${({ theme }) => theme.bg5});
    font-size: 13px;
    font-weight: 700;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .tarjeta__encabezado {
    margin-bottom: 18px;
  }

  .grid_formulario {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 12px;
  }

  .grid_resultados,
  .grid_listas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .resumen_card {
    display: grid;
    gap: 8px;
    border: 1px solid ${({ theme }) => theme.bg4};
    min-height: 112px;
    align-content: start;
  }

  .resumen_card span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .resumen_card strong {
    font-size: 26px;
    color: var(--modulo-acento, ${({ theme }) => theme.bg5});
  }

  .bloque_card {
    display: grid;
    gap: 12px;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 16px;
    background-color: ${({ theme }) => theme.bg};
  }

  .lista_resumen {
    display: grid;
    gap: 10px;
  }

  .item_resumen {
    border-radius: 12px;
    padding: 12px 14px;
    background-color: ${({ theme }) => theme.bg};
    border: 1px solid ${({ theme }) => theme.bg4};
    font-weight: 600;
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

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_enlace {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }
`;

const Campo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input,
  select {
    border: 1px solid ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }
`;
