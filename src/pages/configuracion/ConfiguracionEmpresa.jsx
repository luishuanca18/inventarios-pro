import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { resolverIdentidadVisualPorGrupo } from "../../utils/identidadVisual";
import {
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import { sincronizarFlujoProduccionDesdeSupabase } from "../../supabase/flujoProduccionCore.js";
import {
  guardarConfiguracionEmpresaSupabase,
  leerConfiguracionEmpresaSupabase,
} from "../../supabase/configuracionCore.js";

const crearFormularioBase = () => ({
  id: "",
  nombreComercial: "CORPORACION CYNARA",
  razonSocial: "",
  ruc: "",
  direccion: "",
  telefono: "",
  whatsapp: "",
  correo: "",
  logoUrl: "",
  observacion: "",
  stockMinimoAlerta: 5,
  stockMedioAlerta: 10,
  stockOptimoAlerta: 15,
  anioCorrelativoPedido: new Date().getFullYear(),
  ultimoCorrelativoPedido: 0,
  siguienteCorrelativoPedidoForzado: 0,
});

const obtenerAnioDesdeFecha = (fecha = "") => {
  const [anio] = (fecha || "").split("-");
  const numero = Number(anio);
  return Number.isFinite(numero) ? numero : 0;
};

const extraerCorrelativoCodigoPedido = (codigoPedido = "") => {
  const partesCodigo = (codigoPedido || "").split("-");
  if (partesCodigo.length < 2) return 0;
  const numero = Number(partesCodigo[1]);
  return Number.isFinite(numero) ? numero : 0;
};

const buscarConflictoCorrelativoPedido = ({
  pedidos = [],
  anio = 0,
  correlativo = 0,
} = {}) =>
  pedidos.find((pedido) => {
    const fecha = pedido?.datosCabecera?.fechaSolicitud || "";
    const codigo = pedido?.datosCabecera?.codigoInterno || "";
    return (
      obtenerAnioDesdeFecha(fecha) === Number(anio || 0) &&
      extraerCorrelativoCodigoPedido(codigo) === Number(correlativo || 0)
    );
  }) || null;

const obtenerMaximoCorrelativoAnual = (pedidos = [], anio = 0) =>
  pedidos
    .filter(
      (pedido) =>
        obtenerAnioDesdeFecha(pedido?.datosCabecera?.fechaSolicitud || "") ===
        Number(anio || 0),
    )
    .map((pedido) =>
      extraerCorrelativoCodigoPedido(pedido?.datosCabecera?.codigoInterno || ""),
    )
    .filter((numero) => Number.isFinite(numero))
    .reduce((mayor, numero) => (numero > mayor ? numero : mayor), 0);

export function ConfiguracionEmpresa() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const identidadVisual = resolverIdentidadVisualPorGrupo("Maestros");
  const [formulario, setFormulario] = useState(crearFormularioBase);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const data = await leerConfiguracionEmpresaSupabase();
        if (activo) {
          setFormulario({
            ...crearFormularioBase(),
            ...data,
          });
        }
      } catch (error) {
        mostrarErrorSistema(`No se pudo cargar la configuracion de empresa: ${error.message}`);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  const actualizarCampo = (clave, valor) => {
    setFormulario((anterior) => ({ ...anterior, [clave]: valor }));
  };

  const guardar = async () => {
    if (!formulario.nombreComercial.trim()) {
      await mostrarAlertaSistema("Escribe al menos el nombre comercial de la empresa.");
      return;
    }

    setGuardando(true);
    try {
      await ejecutarAccionConFeedbackSistema({
        mensajeProceso: "Guardando configuracion de empresa...",
        mensajeExito: "Configuracion de empresa guardada.",
        mensajeError: "No se pudo guardar la configuracion de empresa.",
        accion: async () => {
          const anioCorrelativo = Math.max(
            2020,
            Number(formulario.anioCorrelativoPedido || new Date().getFullYear()),
          );
          const ultimoCorrelativo = Math.max(
            0,
            Number(formulario.ultimoCorrelativoPedido || 0),
          );
          const siguienteForzado = Math.max(
            0,
            Number(formulario.siguienteCorrelativoPedidoForzado || 0),
          );
          const dataFlujo = await sincronizarFlujoProduccionDesdeSupabase();
          const pedidos = dataFlujo?.pedidos || [];
          const maximoHistorial = obtenerMaximoCorrelativoAnual(pedidos, anioCorrelativo);

          if (siguienteForzado > 0) {
            const conflicto = buscarConflictoCorrelativoPedido({
              pedidos,
              anio: anioCorrelativo,
              correlativo: siguienteForzado,
            });

            if (conflicto) {
              await mostrarAlertaSistema(
                `Ese correlativo ya existe en el historial: ${conflicto?.datosCabecera?.codigoInterno || "-"} (${conflicto?.datosCabecera?.modeloBase || "-"})`,
              );
              return;
            }
          }

          const guardada = await guardarConfiguracionEmpresaSupabase({
            ...formulario,
            nombreComercial: formulario.nombreComercial.toUpperCase(),
            razonSocial: formulario.razonSocial.toUpperCase(),
            direccion: formulario.direccion.toUpperCase(),
            observacion: formulario.observacion.toUpperCase(),
            anioCorrelativoPedido: anioCorrelativo,
            ultimoCorrelativoPedido: Math.max(ultimoCorrelativo, maximoHistorial),
            siguienteCorrelativoPedidoForzado: siguienteForzado,
          });
          setFormulario((anterior) => ({
            ...anterior,
            ...guardada,
          }));
        },
      });
    } catch (error) {
      console.error("No se pudo guardar la configuracion de empresa:", error.message);
    } finally {
      setGuardando(false);
    }
  };

  const restaurar = () => {
    setFormulario(crearFormularioBase());
  };

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
          <h1>Configuracion de empresa</h1>
          <p>
            Aqui dejamos centralizados los datos base del negocio para reportes,
            documentos internos y futuras integraciones.
          </p>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/configurar" className="boton_volver">
          Volver a Configuracion
        </Link>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Datos generales</h2>
              <p>
                Estos datos describen a la empresa y luego los podremos reutilizar en
                comprobantes, ticket y reportes.
              </p>
            </div>
          </div>

          {cargando ? (
            <div className="estado_vacio">Cargando configuracion de empresa...</div>
          ) : (
            <div className="grid_formulario">
              <Campo>
                <label>Nombre comercial</label>
                <input
                  value={formulario.nombreComercial}
                  onChange={(e) => actualizarCampo("nombreComercial", e.target.value.toUpperCase())}
                />
              </Campo>
              <Campo>
                <label>Razon social</label>
                <input
                  value={formulario.razonSocial}
                  onChange={(e) => actualizarCampo("razonSocial", e.target.value.toUpperCase())}
                />
              </Campo>
              <Campo>
                <label>RUC</label>
                <input value={formulario.ruc} onChange={(e) => actualizarCampo("ruc", e.target.value)} />
              </Campo>
              <Campo>
                <label>Telefono</label>
                <input
                  value={formulario.telefono}
                  onChange={(e) => actualizarCampo("telefono", e.target.value)}
                />
              </Campo>
              <Campo>
                <label>WhatsApp</label>
                <input
                  value={formulario.whatsapp}
                  onChange={(e) => actualizarCampo("whatsapp", e.target.value)}
                />
              </Campo>
              <Campo>
                <label>Correo</label>
                <input
                  value={formulario.correo}
                  onChange={(e) => actualizarCampo("correo", e.target.value)}
                />
              </Campo>
              <Campo>
                <label>Stock bajo</label>
                <input
                  type="number"
                  min="1"
                  value={formulario.stockMinimoAlerta}
                  onChange={(e) =>
                    actualizarCampo("stockMinimoAlerta", e.target.value)
                  }
                />
                <small>
                  Hasta este numero se marcara como bajo.
                </small>
              </Campo>
              <Campo>
                <label>Stock medio bajo</label>
                <input
                  type="number"
                  min="1"
                  value={formulario.stockMedioAlerta}
                  onChange={(e) =>
                    actualizarCampo("stockMedioAlerta", e.target.value)
                  }
                />
                <small>
                  Hasta este numero se marcara como medio bajo.
                </small>
              </Campo>
              <Campo>
                <label>Stock optimo</label>
                <input
                  type="number"
                  min="1"
                  value={formulario.stockOptimoAlerta}
                  onChange={(e) =>
                    actualizarCampo("stockOptimoAlerta", e.target.value)
                  }
                />
                <small>
                  Hasta este numero se marcara como optimo. Por encima quedara como sobre optimo.
                </small>
              </Campo>
              <Campo className="campo-completo">
                <label>Escala visual</label>
                <small>
                  Rojo: sin stock o bajo. Amarillo: medio bajo. Verde: optimo o sobre optimo.
                </small>
              </Campo>
              <Campo>
                <label>Anio correlativo pedidos</label>
                <input
                  type="number"
                  min="2020"
                  value={formulario.anioCorrelativoPedido}
                  onChange={(e) =>
                    actualizarCampo("anioCorrelativoPedido", e.target.value)
                  }
                />
                <small>
                  El pedido usara correlativo anual y reiniciara en 01 cada nuevo anio.
                </small>
              </Campo>
              <Campo>
                <label>Ultimo correlativo pedido</label>
                <input
                  type="number"
                  min="0"
                  value={formulario.ultimoCorrelativoPedido}
                  onChange={(e) =>
                    actualizarCampo("ultimoCorrelativoPedido", e.target.value)
                  }
                />
                <small>
                  Sirve para ver en que numero va el anio y adelantar la base si hace falta.
                </small>
              </Campo>
              <Campo>
                <label>Forzar siguiente correlativo</label>
                <input
                  type="number"
                  min="0"
                  value={formulario.siguienteCorrelativoPedidoForzado}
                  onChange={(e) =>
                    actualizarCampo("siguienteCorrelativoPedidoForzado", e.target.value)
                  }
                />
                <small>
                  Si escribes 0, se apaga. Si pones un numero existente, el sistema lo frenara.
                </small>
              </Campo>
              <Campo className="campo-completo">
                <label>Direccion</label>
                <input
                  value={formulario.direccion}
                  onChange={(e) => actualizarCampo("direccion", e.target.value.toUpperCase())}
                />
              </Campo>
              <Campo className="campo-completo">
                <label>Logo URL</label>
                <input
                  value={formulario.logoUrl}
                  onChange={(e) => actualizarCampo("logoUrl", e.target.value)}
                />
              </Campo>
              <Campo className="campo-completo">
                <label>Observacion</label>
                <textarea
                  value={formulario.observacion}
                  onChange={(e) => actualizarCampo("observacion", e.target.value.toUpperCase())}
                />
              </Campo>
            </div>
          )}
        </section>

        <div className="acciones">
          <button type="button" className="btn btn_secundario" onClick={restaurar}>
            Restaurar base
          </button>
          <button type="button" className="btn btn_principal" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar configuracion"}
          </button>
        </div>
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
  grid-template-rows: 90px auto auto 1fr;
  gap: 16px;
  padding: 15px;

  .encabezado,
  .cabecera,
  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border-radius: 16px;
    padding: 20px;
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .cabecera {
    background:
      linear-gradient(135deg, var(--modulo-fondo, rgba(15, 118, 110, 0.12)) 0%, ${({ theme }) => theme.bgcards} 100%);
  }

  .encabezado {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 10px;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .estado_vacio {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.6;
  }

  small {
    margin-top: 6px;
    display: block;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.4;
  }

  .fila_superior {
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

  .btn_principal {
    background: var(--modulo-acento, ${({ theme }) => theme.bg5});
    color: #ffffff;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .grid_formulario {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .campo-completo {
    grid-column: 1 / -1;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-wrap: wrap;
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
  textarea {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  textarea {
    min-height: 96px;
    resize: vertical;
  }
`;
