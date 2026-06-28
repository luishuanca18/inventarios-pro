import { useMemo, useState } from "react";
import styled from "styled-components";
import {
  buscarFotoModeloColor,
  buscarModeloVisual,
  obtenerVistasModeloVisual,
} from "../../utils/modelosVisuales";

export function VisorFotosModelo({
  modeloBase = "",
  colorBase = "",
  etiquetaBoton = "Ver fotos",
  titulo = "Fotos del modelo",
  descripcionSinImagen = "Este modelo no tiene imagenes registradas.",
}) {
  const [abierto, setAbierto] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [vistaActiva, setVistaActiva] = useState("frente");

  const fichaVisual = useMemo(
    () =>
      buscarModeloVisual({
        modeloBase,
      }),
    [modeloBase]
  );

  const fotoColor = useMemo(
    () =>
      buscarFotoModeloColor({
        modeloBase,
        colorBase,
      }),
    [colorBase, modeloBase]
  );

  const vistas = useMemo(
    () => {
      const vistasGenerales = obtenerVistasModeloVisual(fichaVisual || {}).filter((item) => item.url);
      if (fotoColor?.fotoColor) {
        return [
          {
            clave: "color",
            titulo: colorBase ? `Color ${colorBase}` : "Color real",
            url: fotoColor.fotoColor,
          },
          ...vistasGenerales,
        ];
      }
      return vistasGenerales;
    },
    [colorBase, fichaVisual, fotoColor]
  );
  const vistaPrincipal =
    vistas.find((item) => item.clave === vistaActiva) || vistas[0] || null;

  return (
    <>
      <button
        type="button"
        className="btn btn_secundario"
        onClick={() => {
          setZoom(1);
          setVistaActiva("frente");
          setAbierto(true);
        }}
      >
        {etiquetaBoton}
      </button>

      {abierto ? (
        <Overlay
          role="dialog"
          aria-modal="true"
          onClick={() => setAbierto(false)}
        >
          <Modal onClick={(evento) => evento.stopPropagation()}>
            <div className="modal_encabezado">
              <div>
                <h3>{titulo}</h3>
                <p>{modeloBase || "-"}</p>
                {fotoColor?.fotoColor && colorBase ? <p>Color: {colorBase}</p> : null}
              </div>

              <div className="modal_acciones">
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => setZoom((valor) => Math.max(0.6, valor - 0.2))}
                >
                  -
                </button>
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => setZoom(1)}
                >
                  100%
                </button>
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => setZoom((valor) => Math.min(2.4, valor + 0.2))}
                >
                  +
                </button>
                <button
                  type="button"
                  className="btn btn_secundario"
                  onClick={() => setAbierto(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>

            {vistas.length === 0 ? (
              <div className="sin_imagenes">{descripcionSinImagen}</div>
            ) : (
              <div className="visor">
                <div className="visor_principal">
                  <div className="visor_principal__marco">
                    {vistaPrincipal ? (
                      <img
                        src={vistaPrincipal.url}
                        alt={`${modeloBase || "Modelo"} ${vistaPrincipal.titulo}`}
                        style={{ transform: `scale(${zoom})` }}
                      />
                    ) : null}
                  </div>
                  <span>{vistaPrincipal?.titulo || "Vista"}</span>
                </div>

                <div className="miniaturas">
                  {vistas.map((vista) => (
                    <button
                      key={`${modeloBase}-${vista.clave}`}
                      type="button"
                      className={`miniatura ${vistaPrincipal?.clave === vista.clave ? "miniatura_activa" : ""}`}
                      onClick={() => {
                        setVistaActiva(vista.clave);
                        setZoom(1);
                      }}
                    >
                      <img
                        src={vista.url}
                        alt={`${modeloBase || "Modelo"} ${vista.titulo}`}
                      />
                      <span>{vista.titulo}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Modal>
        </Overlay>
      ) : null}
    </>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(8, 11, 18, 0.76);
  display: grid;
  place-items: center;
  padding: 20px;
`;

const Modal = styled.div`
  width: min(980px, 100%);
  max-height: 88vh;
  overflow: auto;
  border-radius: 18px;
  border: 1px solid ${({ theme }) =>
    theme.bg === "rgb(255,255,255)"
      ? "rgba(117, 1, 152, 0.16)"
      : "rgba(255,255,255,0.08)"};
  background: ${({ theme }) => theme.bg2};
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.38);
  padding: 18px;

  .modal_encabezado {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 18px;
  }

  .modal_acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
  }

  h3 {
    margin: 0;
    color: ${({ theme }) => theme.text};
  }

  p {
    margin: 6px 0 0;
    color: ${({ theme }) => theme.textSoft || theme.text};
  }

  .sin_imagenes {
    padding: 18px;
    border-radius: 14px;
    border: 1px dashed ${({ theme }) =>
      theme.bg === "rgb(255,255,255)"
        ? "rgba(117, 1, 152, 0.18)"
        : "rgba(255,255,255,0.12)"};
    color: ${({ theme }) => theme.textSoft || theme.text};
    text-align: center;
  }

  .visor {
    display: grid;
    gap: 16px;
  }

  .visor_principal {
    display: grid;
    gap: 10px;
  }

  .visor_principal > span {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    text-align: center;
  }

  .visor_principal__marco {
    width: 100%;
    height: min(58vh, 520px);
    display: grid;
    place-items: start center;
    overflow: auto;
    border-radius: 16px;
    border: 1px solid ${({ theme }) =>
      theme.bg === "rgb(255,255,255)"
        ? "rgba(117, 1, 152, 0.12)"
        : "rgba(255,255,255,0.06)"};
    background: rgba(255, 255, 255, 0.04);
    padding: 12px;
  }

  .visor_principal__marco img {
    width: 100%;
    height: auto;
    object-fit: contain;
    transform-origin: top center;
    transition: transform 0.18s ease;
  }

  .miniaturas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .miniatura {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
    border: 1px solid ${({ theme }) =>
      theme.bg === "rgb(255,255,255)"
        ? "rgba(117, 1, 152, 0.12)"
        : "rgba(255,255,255,0.06)"};
    background: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)"
        ? "rgba(117, 1, 152, 0.03)"
        : "rgba(255,255,255,0.02)"};
    cursor: pointer;
    text-align: left;
  }

  .miniatura_activa {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)"
        ? "rgba(117, 1, 152, 0.42)"
        : "rgba(255,255,255,0.22)"};
    box-shadow: 0 0 0 1px
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(117, 1, 152, 0.18)"
          : "rgba(255,255,255,0.12)"};
  }

  .miniatura img {
    width: 100%;
    height: 140px;
    object-fit: contain;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
  }

  .miniatura span {
    font-weight: 700;
    color: ${({ theme }) => theme.text};
    text-align: center;
  }
`;
