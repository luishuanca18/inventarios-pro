import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {

  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_REMATES_PT = "cynara_remates_producto_terminado";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();
const TALLAS = ["S", "M", "L", "XL", "XXL"];

const leerListaGuardada = (clave) => {
  const contenido = localStorage.getItem(clave);
  if (!contenido) return [];
  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

const normalizarTextoBusqueda = (valor = "") =>
  valor.toString().trim().toLowerCase();

const normalizarNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const leerRemates = () => leerListaGuardada(CLAVE_REMATES_PT);

const construirStockRemates = (registros = []) => {
  const mapa = new Map();

  (Array.isArray(registros) ? registros : []).forEach((registro) => {
    const detalleRemate = Array.isArray(registro?.detalleRemate) ? registro.detalleRemate : [];

    detalleRemate.forEach((fila) => {
      const colorBase = fila?.colorBase || "";

      TALLAS.forEach((talla) => {
        const cantidad = normalizarNumero(fila?.cantidades?.[talla]);
        if (cantidad <= 0) return;

        const clave = [
          registro?.modelo || "",
          colorBase,
          talla,
        ].join("|");

        const actual = mapa.get(clave) || {
          id: clave,
          codigoOp: registro?.codigoOp || "",
          codigoSalida: registro?.codigoSalida || "",
          modelo: registro?.modelo || "",
          colorBase,
          talla,
          stockActual: 0,
          fechaRecepcion: registro?.fechaRecepcion || "",
        };

        actual.stockActual += cantidad;
        mapa.set(clave, actual);
      });
    });
  });

  return Array.from(mapa.values()).sort((a, b) =>
    `${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.modelo}${b.colorBase}${b.talla}`
    )
  );
};

export function Remates() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [pestanaActiva, setPestanaActiva] = useState("stock");

  const registrosRemate = useMemo(leerRemates, []);
  const stockRemates = useMemo(
    () => construirStockRemates(registrosRemate),
    [registrosRemate]
  );

  const stockFiltrado = useMemo(() => {
    const texto = normalizarTextoBusqueda(busqueda);
    return stockRemates.filter((item) =>
      !texto ||
      [item?.codigoOp, item?.codigoSalida, item?.modelo, item?.colorBase, item?.talla]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, stockRemates]);

  const historialFiltrado = useMemo(() => {
    const texto = normalizarTextoBusqueda(busqueda);
    return registrosRemate.filter((item) =>
      !texto ||
      [item?.codigoOp, item?.codigoSalida, item?.modelo, item?.fechaRecepcion]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, registrosRemate]);

  const listaActual = pestanaActiva === "stock" ? stockFiltrado : historialFiltrado;
  const totalPaginas = Math.max(1, Math.ceil(listaActual.length / FILAS_POR_PAGINA));
  const listaPaginada = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return listaActual.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [listaActual, paginaActual]);

  const totalPrendasRemate = useMemo(
    () => stockRemates.reduce((total, item) => total + Number(item?.stockActual || 0), 0),
    [stockRemates]
  );

  const totalOpConRemate = registrosRemate.filter((item) => Number(item?.totalRemate || 0) > 0).length;

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
          <h1>Stock de remates</h1>
          <p>
            Aqui Almacen controla las prendas derivadas a remate desde acondicionado,
            separadas del stock normal de producto terminado.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Prendas en remate</span>
          <strong>{totalPrendasRemate}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/almacen/producto-terminado" className="boton_volver">
          Volver a Almacen
        </Link>
      </div>

      <main className="contenido_principal">
        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>OP con remate</span>
              <strong>{totalOpConRemate}</strong>
            </div>
            <div>
              <span>Registros de stock</span>
              <strong>{stockRemates.length}</strong>
            </div>
            <div>
              <span>Total prendas remate</span>
              <strong>{totalPrendasRemate}</strong>
            </div>
            <div>
              <span>Ultima recepcion</span>
              <strong>{registrosRemate[0]?.fechaRecepcion || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>{pestanaActiva === "stock" ? "Stock operativo de remates" : "Historial de remates por OP"}</h2>
              <p>
                {pestanaActiva === "stock"
                  ? "Busca por OP, modelo, color o talla para revisar el stock separado."
                  : "Aqui ves de que OP salio cada remate y cuanta cantidad fue derivada."}
              </p>
            </div>
          </div>

          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaActiva === "stock" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("stock");
                setPaginaActual(1);
              }}
            >
              Stock remate
            </button>
            <button
              type="button"
              className={`pestana ${pestanaActiva === "historial" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("historial");
                setPaginaActual(1);
              }}
            >
              Historial
            </button>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder=""
            />
          </div>

          <div className="tabla_contenedor">
            {pestanaActiva === "stock" ? (
              <table>
                <thead>
                  <tr>
                    <th>OP</th>
                    <th>Modelo</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Stock remate</th>
                    <th>Fecha recepcion</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPaginada.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="sin_datos">
                        Todavia no hay prendas enviadas a remate.
                      </td>
                    </tr>
                  ) : (
                    listaPaginada.map((item) => (
                      <tr key={item.id}>
                        <td>{item.codigoOp || "-"}</td>
                        <td>{item.modelo || "-"}</td>
                        <td>{item.colorBase || "-"}</td>
                        <td>{item.talla || "-"}</td>
                        <td>
                          <strong className="stock_destacado">
                            {Number(item.stockActual || 0)}
                          </strong>
                        </td>
                        <td>{item.fechaRecepcion || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>OP</th>
                    <th>Salida</th>
                    <th>Modelo</th>
                    <th>Fecha recepcion</th>
                    <th>Total remate</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {listaPaginada.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="sin_datos">
                        Todavia no hay historial de remates.
                      </td>
                    </tr>
                  ) : (
                    listaPaginada.map((item) => (
                      <tr key={item.recepcionId || item.codigoOp}>
                        <td>{item.codigoOp || "-"}</td>
                        <td>{item.codigoSalida || "-"}</td>
                        <td>{item.modelo || "-"}</td>
                        <td>{item.fechaRecepcion || "-"}</td>
                        <td>{Number(item.totalRemate || 0)}</td>
                        <td>
                          {(Array.isArray(item?.detalleRemate) ? item.detalleRemate : [])
                            .map((fila) => {
                              const detalle = TALLAS.filter(
                                (talla) => normalizarNumero(fila?.cantidades?.[talla]) > 0
                              )
                                .map((talla) => `${talla}:${fila?.cantidades?.[talla]}`)
                                .join(" | ");
                              return `${fila?.colorBase || "-"} ${detalle}`.trim();
                            })
                            .join(" / ") || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="paginacion">
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() => setPaginaActual((valor) => Math.max(1, valor - 1))}
              disabled={paginaActual === 1}
            >
              Anterior
            </button>
            <span>
              Pagina {paginaActual} de {totalPaginas}
            </span>
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() => setPaginaActual((valor) => Math.min(totalPaginas, valor + 1))}
              disabled={paginaActual === totalPaginas}
            >
              Siguiente
            </button>
          </div>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
  min-height: 100vh;
  width: 100%;
  background: ${({ theme }) => theme.bgtotal};
  color: ${({ theme }) => theme.text};
  display: grid;
  grid-template:
    "encabezado" 90px
    "cabecera" auto
    "fila_superior" auto
    "contenido_principal" 1fr;
  gap: 15px;
  padding: 15px;

  .encabezado,
  .cabecera,
  .fila_superior,
  .contenido_principal {
    border-radius: 20px;
  }

  .encabezado {
    grid-area: encabezado;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: ${({ theme }) => theme.bgcards};
    padding-right: 10px;
  }

  .cabecera {
    grid-area: cabecera;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 24px;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
    color: ${({ theme }) => theme.colortitlecard};
  }

  .cabecera p,
  .tarjeta__encabezado p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.6;
  }

  .cabecera__estado {
    min-width: 180px;
    padding: 16px 18px;
    border-radius: 16px;
    background: rgba(117, 1, 152, 0.12);
    border: 1px solid rgba(117, 1, 152, 0.24);
  }

  .cabecera__estado span {
    display: block;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  .cabecera__estado strong {
    display: block;
    margin-top: 8px;
    font-size: 28px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior {
    grid-area: fila_superior;
    display: flex;
    justify-content: flex-start;
  }

  .boton_volver,
  .btn {
    border: none;
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .boton_volver,
  .btn_secundario {
    background: #5b5b60;
    color: #ffffff;
  }

  .contenido_principal {
    grid-area: contenido_principal;
    display: grid;
    gap: 16px;
  }

  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 20px;
    padding: 20px;
  }

  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .resumen__grid div {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg2};
  }

  .resumen__grid span {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
  }

  .resumen__grid strong {
    display: block;
    margin-top: 6px;
    color: ${({ theme }) => theme.text};
    font-size: 20px;
  }

  .tarjeta__encabezado {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 14px;
  }

  .pestanas {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 16px 0 14px;
    padding: 8px;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    background: ${({ theme }) => theme.bg2};
  }

  .pestana {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 12px;
    padding: 10px 16px;
    background: transparent;
    color: ${({ theme }) => theme.text};
    font-weight: 800;
    cursor: pointer;
  }

  .pestana_activa {
    background: ${({ theme }) => theme.bg5};
    border-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    box-shadow: 0 10px 22px rgba(117, 1, 152, 0.28);
  }

  .buscador {
    margin-bottom: 16px;
  }

  .buscador input {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  .tabla_contenedor {
    margin-top: 16px;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 920px;
  }

  th,
  td {
    padding: 12px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.bg4};
    text-align: left;
    vertical-align: top;
  }

  th {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }

  td {
    color: #ffffff;
    font-size: 14px;
  }

  .stock_destacado {
    display: inline-flex;
    min-width: 52px;
    justify-content: center;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(117, 1, 152, 0.18);
    color: #ffffff;
    border: 1px solid rgba(117, 1, 152, 0.32);
  }

  .sin_datos {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .paginacion {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  @media (max-width: 900px) {
    .cabecera {
      flex-direction: column;
    }

    .cabecera__estado {
      width: 100%;
    }

    .paginacion {
      flex-direction: column;
      align-items: stretch;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;




