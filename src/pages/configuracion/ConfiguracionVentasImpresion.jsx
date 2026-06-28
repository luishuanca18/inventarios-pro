import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  crearConfiguracionVentasImpresionBase,
  guardarConfiguracionVentasImpresion,
} from "../../utils/configuracionVentasImpresion";
import {
  guardarConfiguracionEmpresaSupabase,
  guardarConfiguracionVentasImpresionSupabase,
  leerConfiguracionEmpresaSupabase,
  leerConfiguracionVentasImpresionSupabase,
} from "../../supabase/configuracionCore.js";

const crearFormularioCompleto = () => ({
  ...crearConfiguracionVentasImpresionBase(),
  idEmpresa: "",
  idVentas: "",
  correo: "",
  observacion: "",
});

export function ConfiguracionVentasImpresion() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [formulario, setFormulario] = useState(crearFormularioCompleto);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const [ventas, empresa] = await Promise.all([
          leerConfiguracionVentasImpresionSupabase(),
          leerConfiguracionEmpresaSupabase(),
        ]);
        if (!activo) return;
        setFormulario({
          ...crearFormularioCompleto(),
          ...ventas,
          ...empresa,
          idEmpresa: empresa?.id || "",
          idVentas: ventas?.id || "",
        });
      } catch (error) {
        mostrarErrorSistema(`No se pudo cargar ventas e impresion: ${error.message}`);
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
    try {
      setGuardando(true);
      const empresaGuardada = await guardarConfiguracionEmpresaSupabase({
        id: formulario.idEmpresa || undefined,
        nombreComercial: formulario.nombreComercial,
        razonSocial: formulario.razonSocial,
        ruc: formulario.ruc,
        direccion: formulario.direccion,
        telefono: formulario.telefono,
        whatsapp: formulario.whatsapp,
        correo: formulario.correo,
        logoUrl: formulario.logoUrl,
        observacion: formulario.observacion,
      });
      const ventasGuardadas = await guardarConfiguracionVentasImpresionSupabase({
        ...formulario,
        id: formulario.idVentas || undefined,
        igvPorcentaje: Number(formulario?.igvPorcentaje || 0),
        correlativoInicial: Number(formulario?.correlativoInicial || 1),
      });

      const final = {
        ...crearFormularioCompleto(),
        ...ventasGuardadas,
        ...empresaGuardada,
        idEmpresa: empresaGuardada?.id || "",
        idVentas: ventasGuardadas?.id || "",
      };
      setFormulario(final);
      guardarConfiguracionVentasImpresion(final);
      mostrarNotificacionCarga("Configuracion de ventas e impresion guardada.");
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar ventas e impresion: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const restaurar = () => {
    const base = crearFormularioCompleto();
    setFormulario(base);
    guardarConfiguracionVentasImpresion(base);
    mostrarNotificacionCarga("Configuracion restaurada en pantalla. Si deseas persistirla, guarda de nuevo.");
  };

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
          <h1>Ventas e impresion</h1>
          <p>
            Aqui definimos tanto la parte comercial del ticket como los datos del
            negocio que se imprimen en la nota o boleta interna.
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
              <h2>Datos del negocio</h2>
              <p>Esto saldra en el encabezado de la nota y se comparte con la configuracion general.</p>
            </div>
          </div>

          {cargando ? (
            <div className="estado_vacio">Cargando configuracion de ventas...</div>
          ) : (
            <div className="grid_formulario">
              <Campo><label>Nombre comercial</label><input value={formulario.nombreComercial} onChange={(e) => actualizarCampo("nombreComercial", e.target.value.toUpperCase())} /></Campo>
              <Campo><label>Razon social</label><input value={formulario.razonSocial} onChange={(e) => actualizarCampo("razonSocial", e.target.value.toUpperCase())} /></Campo>
              <Campo><label>RUC</label><input value={formulario.ruc} onChange={(e) => actualizarCampo("ruc", e.target.value)} /></Campo>
              <Campo><label>Telefono</label><input value={formulario.telefono} onChange={(e) => actualizarCampo("telefono", e.target.value)} /></Campo>
              <Campo><label>WhatsApp</label><input value={formulario.whatsapp} onChange={(e) => actualizarCampo("whatsapp", e.target.value)} /></Campo>
              <Campo><label>Correo</label><input value={formulario.correo} onChange={(e) => actualizarCampo("correo", e.target.value)} /></Campo>
              <Campo className="campo-completo"><label>Direccion</label><input value={formulario.direccion} onChange={(e) => actualizarCampo("direccion", e.target.value.toUpperCase())} /></Campo>
              <Campo className="campo-completo"><label>Logo URL</label><input value={formulario.logoUrl} onChange={(e) => actualizarCampo("logoUrl", e.target.value)} /></Campo>
              <Campo className="campo-completo"><label>Observacion</label><input value={formulario.observacion} onChange={(e) => actualizarCampo("observacion", e.target.value.toUpperCase())} /></Campo>
            </div>
          )}
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Comprobante e impresion</h2>
              <p>Aqui defines el tipo, las series, el ancho de papel y la forma de impresion.</p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Tipo comprobante</label>
              <select value={formulario.tipoComprobanteDefecto} onChange={(e) => actualizarCampo("tipoComprobanteDefecto", e.target.value)}>
                <option value="NOTA DE VENTA">Nota de venta</option>
                <option value="BOLETA">Boleta</option>
                <option value="FACTURA">Factura</option>
              </select>
            </Campo>
            <Campo><label>Serie nota venta</label><input value={formulario.serieNotaVenta} onChange={(e) => actualizarCampo("serieNotaVenta", e.target.value.toUpperCase())} /></Campo>
            <Campo><label>Serie boleta</label><input value={formulario.serieBoleta} onChange={(e) => actualizarCampo("serieBoleta", e.target.value.toUpperCase())} /></Campo>
            <Campo><label>Serie factura</label><input value={formulario.serieFactura} onChange={(e) => actualizarCampo("serieFactura", e.target.value.toUpperCase())} /></Campo>
            <Campo><label>Serie nota cambio</label><input value={formulario.serieNotaCambio} onChange={(e) => actualizarCampo("serieNotaCambio", e.target.value.toUpperCase())} /></Campo>
            <Campo><label>Correlativo inicial</label><input type="number" min="1" value={formulario.correlativoInicial} onChange={(e) => actualizarCampo("correlativoInicial", e.target.value)} /></Campo>
            <Campo><label>IGV %</label><input type="number" min="0" step="0.01" value={formulario.igvPorcentaje} onChange={(e) => actualizarCampo("igvPorcentaje", e.target.value)} /></Campo>
            <Campo>
              <label>Precios</label>
              <select value={String(formulario.preciosIncluyenIgv)} onChange={(e) => actualizarCampo("preciosIncluyenIgv", e.target.value === "true")}>
                <option value="true">Incluyen IGV</option>
                <option value="false">Sin IGV</option>
              </select>
            </Campo>
            <Campo>
              <label>Ancho ticket</label>
              <select value={formulario.anchoPapel} onChange={(e) => actualizarCampo("anchoPapel", e.target.value)}>
                <option value="58">58 mm</option>
                <option value="80">80 mm</option>
              </select>
            </Campo>
            <Campo><label>Nombre impresora</label><input value={formulario.nombreImpresora} onChange={(e) => actualizarCampo("nombreImpresora", e.target.value)} /></Campo>
            <Campo>
              <label>Modo impresion</label>
              <select value={formulario.modoImpresion} onChange={(e) => actualizarCampo("modoImpresion", e.target.value)}>
                <option value="VISTA">Vista para imprimir</option>
                <option value="DIRECTA">Directa</option>
              </select>
            </Campo>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Campos visibles de la nota</h2>
              <p>Aqui eliges lo que vera el cliente en el detalle y el resumen.</p>
            </div>
          </div>

          <div className="grid_checks">
            {[
              ["mostrarCliente", "Mostrar cliente"],
              ["mostrarDocumentoCliente", "Mostrar documento cliente"],
              ["mostrarTelefonoCliente", "Mostrar telefono cliente"],
              ["mostrarCodigoCorto", "Mostrar codigo corto"],
              ["mostrarColor", "Mostrar color"],
              ["mostrarTalla", "Mostrar talla"],
              ["mostrarPrecioUnitario", "Mostrar precio unitario"],
              ["mostrarSubtotal", "Mostrar subtotal"],
              ["mostrarIgv", "Mostrar IGV"],
              ["mostrarTotal", "Mostrar total"],
            ].map(([clave, titulo]) => (
              <label key={clave} className="check_item">
                <input
                  type="checkbox"
                  checked={Boolean(formulario[clave])}
                  onChange={(e) => actualizarCampo(clave, e.target.checked)}
                />
                <span>{titulo}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Mensajes finales</h2>
              <p>Esto saldra al final del ticket o nota interna.</p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo><label>Mensaje 1</label><input value={formulario.mensajePie1} onChange={(e) => actualizarCampo("mensajePie1", e.target.value)} /></Campo>
            <Campo><label>Mensaje 2</label><input value={formulario.mensajePie2} onChange={(e) => actualizarCampo("mensajePie2", e.target.value)} /></Campo>
          </div>
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

  .contenido {
    display: grid;
    gap: 16px;
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
    background: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .tarjeta__encabezado {
    margin-bottom: 14px;
  }

  .grid_formulario {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .campo-completo {
    grid-column: 1 / -1;
  }

  .grid_checks {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .check_item {
    display: flex;
    gap: 10px;
    align-items: center;
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 14px;
    padding: 12px 14px;
    background: ${({ theme }) => theme.bg2};
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
  select {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }
`;
