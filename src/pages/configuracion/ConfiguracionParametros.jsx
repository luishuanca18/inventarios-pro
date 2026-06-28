import { useState } from "react";
import styled from "styled-components";
import { ConfiguracionCatalogosModulo } from "./ConfiguracionCatalogosModulo";
import {
  guardarFilasPorPaginaSistema,
  leerFilasPorPaginaSistema,
  OPCIONES_FILAS_POR_PAGINA,
} from "../../utils/paginacionSistema";
import {
  ETIQUETAS_CALIDAD_POR_DEFECTO,
  guardarEtiquetasCalidadSistema,
  leerEtiquetasCalidadSistema,
  restaurarEtiquetasCalidadSistema,
} from "../../utils/configuracionEstadosCalidad";
import {
  CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO,
  guardarConfiguracionSeguimientoOp,
  leerConfiguracionSeguimientoOp,
  restaurarConfiguracionSeguimientoOp,
} from "../../utils/configuracionSeguimientoOp";
import { mostrarNotificacionCarga } from "../../utils/notificaciones";

const SECCIONES_PARAMETROS = [
  { clave: "monedasOperacion", titulo: "Monedas de operacion" },
  { clave: "igvGlobal", titulo: "IGV general" },
  { clave: "decimalesSistema", titulo: "Decimales del sistema" },
  { clave: "politicasStock", titulo: "Politicas de stock" },
  { clave: "tallasEspeciales", titulo: "Tallas especiales" },
  { clave: "estadosSistema", titulo: "Estados globales" },
  { clave: "canalesComerciales", titulo: "Canales comerciales" },
  { clave: "motivosGlobales", titulo: "Motivos globales" },
  { clave: "reglasSeguridad", titulo: "Reglas de seguridad" },
  { clave: "configuracionesGenerales", titulo: "Configuraciones generales" },
];

function PanelPaginacionGlobal() {
  const [filasPorPagina, setFilasPorPagina] = useState(() =>
    leerFilasPorPaginaSistema()
  );

  const manejarCambioFilas = (valor) => {
    const siguienteValor = guardarFilasPorPaginaSistema(Number(valor));
    setFilasPorPagina(siguienteValor);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        window.location.reload();
      }, 150);
    }
  };

  return (
    <PanelPaginacion>
      <div>
        <h3>Paginacion global del sistema</h3>
      </div>

      <div className="panel_paginacion__acciones">
        <label>
          Filas por pagina
          <select
            value={filasPorPagina}
            onChange={(evento) => manejarCambioFilas(evento.target.value)}
          >
            {OPCIONES_FILAS_POR_PAGINA.map((opcion) => (
              <option key={`filas-${opcion}`} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        </label>
      </div>
    </PanelPaginacion>
  );
}

function PanelEstadosCalidad() {
  const [etiquetas, setEtiquetas] = useState(() => leerEtiquetasCalidadSistema());

  const actualizarEtiqueta = (clave, valor) => {
    setEtiquetas((anterior) => ({
      ...anterior,
      [clave]: valor,
    }));
  };

  const guardarCambios = () => {
    const guardadas = guardarEtiquetasCalidadSistema(etiquetas);
    setEtiquetas(guardadas);
    mostrarNotificacionCarga("Estados de calidad guardados correctamente.");
  };

  const restaurarBase = () => {
    const base = restaurarEtiquetasCalidadSistema();
    setEtiquetas(base);
    mostrarNotificacionCarga("Estados de calidad restaurados a su base.");
  };

  return (
    <PanelEstados>
      <div>
        <h3>Estados de control de calidad</h3>
        <p>
          Aqui puedes cambiar los nombres que ves en calidad sin tocar codigo.
        </p>
      </div>

      <div className="panel_estados__contenido">
        <div className="panel_estados__grid">
          {Object.entries(ETIQUETAS_CALIDAD_POR_DEFECTO).map(([clave, valorBase]) => (
            <label key={clave}>
              <span>{valorBase}</span>
              <input
                type="text"
                value={etiquetas[clave] || ""}
                onChange={(evento) => actualizarEtiqueta(clave, evento.target.value)}
                placeholder=""
              />
            </label>
          ))}
        </div>
      </div>

      <div className="panel_estados__acciones">
        <button type="button" className="btn_secundario" onClick={restaurarBase}>
          Restaurar base
        </button>
        <button type="button" className="btn_guardar" onClick={guardarCambios}>
          Guardar estados
        </button>
      </div>
    </PanelEstados>
  );
}

function PanelSeguimientoOp() {
  const [configuracion, setConfiguracion] = useState(() =>
    leerConfiguracionSeguimientoOp()
  );

  const actualizarEstado = (clave, valor) => {
    setConfiguracion((anterior) => ({
      ...anterior,
      estados: {
        ...anterior.estados,
        [clave]: valor,
      },
    }));
  };

  const actualizarAlerta = (clave, valor) => {
    setConfiguracion((anterior) => ({
      ...anterior,
      alertas: {
        ...anterior.alertas,
        [clave]: valueOrEmpty(valor),
      },
    }));
  };

  const guardarCambios = () => {
    const guardada = guardarConfiguracionSeguimientoOp(configuracion);
    setConfiguracion(guardada);
    mostrarNotificacionCarga("Seguimiento de OP guardado correctamente.");
  };

  const restaurarBase = () => {
    const base = restaurarConfiguracionSeguimientoOp();
    setConfiguracion(base);
    mostrarNotificacionCarga("Seguimiento de OP restaurado a su base.");
  };

  return (
    <PanelEstados>
      <div>
        <h3>Seguimiento de OP</h3>
        <p>
          Aqui puedes cambiar nombres de estados y los dias limite para alertas del seguimiento.
        </p>
      </div>

      <div className="panel_estados__contenido">
        <div className="panel_estados__subtitulo">Estados visibles</div>
        <div className="panel_estados__grid">
          {Object.entries(CONFIGURACION_SEGUIMIENTO_OP_POR_DEFECTO.estados).map(
            ([clave, valorBase]) => (
              <label key={clave}>
                <span>{valorBase}</span>
                <input
                  type="text"
                  value={configuracion.estados?.[clave] || ""}
                  onChange={(evento) => actualizarEstado(clave, evento.target.value)}
                  placeholder=""
                />
              </label>
            )
          )}
        </div>

        <div className="panel_estados__subtitulo">Dias de alerta</div>
        <div className="panel_estados__grid">
          <label>
            <span>En taller</span>
            <input
              type="number"
              min="1"
              value={configuracion.alertas?.diasTaller ?? ""}
              onChange={(evento) => actualizarAlerta("diasTaller", evento.target.value)}
              placeholder=""
            />
          </label>
          <label>
            <span>En tercero</span>
            <input
              type="number"
              min="1"
              value={configuracion.alertas?.diasTercero ?? ""}
              onChange={(evento) => actualizarAlerta("diasTercero", evento.target.value)}
              placeholder=""
            />
          </label>
          <label>
            <span>En calidad</span>
            <input
              type="number"
              min="1"
              value={configuracion.alertas?.diasCalidad ?? ""}
              onChange={(evento) => actualizarAlerta("diasCalidad", evento.target.value)}
              placeholder=""
            />
          </label>
          <label>
            <span>General</span>
            <input
              type="number"
              min="1"
              value={configuracion.alertas?.diasGeneral ?? ""}
              onChange={(evento) => actualizarAlerta("diasGeneral", evento.target.value)}
              placeholder=""
            />
          </label>
        </div>
      </div>

      <div className="panel_estados__acciones">
        <button type="button" className="btn_secundario" onClick={restaurarBase}>
          Restaurar base
        </button>
        <button type="button" className="btn_guardar" onClick={guardarCambios}>
          Guardar seguimiento
        </button>
      </div>
    </PanelEstados>
  );
}

const valueOrEmpty = (valor = "") => String(valor ?? "");

export function ConfiguracionParametros() {
  return (
    <ConfiguracionCatalogosModulo
      titulo="Reglas globales"
      descripcion="Aqui se centralizan reglas que pueden afectar a varios modulos al mismo tiempo, como moneda, IGV, stock, canales, motivos, seguridad y paginacion general."
      grupoVisual="Costos y Finanzas"
      secciones={SECCIONES_PARAMETROS}
      tarjetasExtra={[
        {
          clave: "paginacionGlobal",
          contenido: <PanelPaginacionGlobal />,
        },
        {
          clave: "estadosCalidad",
          contenido: <PanelEstadosCalidad />,
        },
        {
          clave: "seguimientoOp",
          contenido: <PanelSeguimientoOp />,
        },
      ]}
      textoGuardar="Reglas globales guardadas correctamente."
      textoRestaurar="Reglas globales restauradas a sus valores base."
    />
  );
}

const PanelPaginacion = styled.div`
  display: grid;
  gap: 14px;

  h3 {
    margin: 0 0 8px;
  }

  .panel_paginacion__acciones {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: end;
  }

  label {
    display: grid;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
  }

  select {
    min-height: 44px;
    min-width: 160px;
    border-radius: 10px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 0 12px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .btn_guardar {
    min-height: 44px;
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
  }
`;

const PanelEstados = styled.div`
  display: grid;
  gap: 14px;
  min-height: 0;
  height: 520px;

  h3 {
    margin: 0 0 8px;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .panel_estados__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .panel_estados__contenido {
    min-height: 0;
    overflow-y: auto;
    padding-right: 8px;
    display: grid;
    gap: 14px;
    scrollbar-width: thin;
    scrollbar-color: ${({ theme }) => theme.bg5} ${({ theme }) => theme.bg};
  }

  .panel_estados__contenido::-webkit-scrollbar {
    width: 8px;
  }

  .panel_estados__contenido::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.bg};
    border-radius: 999px;
  }

  .panel_estados__contenido::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.bg5};
    border-radius: 999px;
  }

  .panel_estados__subtitulo {
    font-size: 12px;
    font-weight: 800;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  label {
    display: grid;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: ${({ theme }) => theme.text};
  }

  span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;
    text-transform: uppercase;
  }

  input {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid ${({ theme }) => theme.bg4};
    padding: 0 12px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .panel_estados__acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 4px;
    border-top: 1px solid ${({ theme }) => theme.bg4};
  }

  .btn_secundario,
  .btn_guardar {
    min-height: 44px;
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
  }

  .btn_secundario {
    background: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_guardar {
    background-color: ${({ theme }) => theme.bg5};
    color: #fff;
  }
`;
