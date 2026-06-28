import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import {
  confirmarAccionSistema,
  mostrarAlertaSistema,
  mostrarErrorSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {
  eliminarClienteProveedorConfiguracion,
  guardarClienteProveedorConfiguracion,
  listarClientesProveedoresConfiguracion,
} from "../../supabase/configuracionCore.js";

const crearFormularioBase = () => ({
  id: "",
  tipo: "CLIENTE",
  documento: "",
  nombre: "",
  telefono: "",
  correo: "",
  direccion: "",
  contacto: "",
  observacion: "",
  estado: "ACTIVO",
});

export function ConfiguracionClientesProveedores() {
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [formulario, setFormulario] = useState(crearFormularioBase);
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargarRegistros = async () => {
    const lista = await listarClientesProveedoresConfiguracion();
    setRegistros(lista);
    return lista;
  };

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const lista = await listarClientesProveedoresConfiguracion();
        if (activo) setRegistros(lista);
      } catch (error) {
        mostrarErrorSistema(`No se pudo cargar clientes y proveedores: ${error.message}`);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  const listaFiltrada = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return registros.filter((item) => {
      const pasaTipo = filtroTipo === "TODOS" || item?.tipo === filtroTipo;
      const pasaTexto =
        !texto ||
        [
          item?.tipo,
          item?.nombre,
          item?.documento,
          item?.telefono,
          item?.correo,
          item?.contacto,
          item?.direccion,
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto);
      return pasaTipo && pasaTexto;
    });
  }, [busqueda, filtroTipo, registros]);

  const actualizarCampo = (clave, valor) => {
    setFormulario((anterior) => ({ ...anterior, [clave]: valor }));
  };

  const limpiarFormulario = () => {
    setFormulario(crearFormularioBase());
  };

  const guardar = async () => {
    if (!formulario.nombre.trim()) {
      mostrarAlertaSistema("Escribe el nombre del cliente o proveedor.");
      return;
    }

    try {
      setGuardando(true);
      await guardarClienteProveedorConfiguracion({
        ...formulario,
        nombre: formulario.nombre.toUpperCase(),
        direccion: formulario.direccion.toUpperCase(),
        contacto: formulario.contacto.toUpperCase(),
        observacion: formulario.observacion.toUpperCase(),
      });
      await cargarRegistros();
      limpiarFormulario();
      mostrarNotificacionCarga("Registro guardado correctamente.");
    } catch (error) {
      mostrarErrorSistema(`No se pudo guardar el registro: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cargar = (item) => {
    setFormulario({
      id: item?.id || "",
      tipo: item?.tipo || "CLIENTE",
      documento: item?.documento || "",
      nombre: item?.nombre || "",
      telefono: item?.telefono || "",
      correo: item?.correo || "",
      direccion: item?.direccion || "",
      contacto: item?.contacto || "",
      observacion: item?.observacion || "",
      estado: item?.estado || "ACTIVO",
    });
  };

  const eliminar = async (item) => {
    const confirmar = await confirmarAccionSistema(
      `Seguro que deseas quitar a ${item?.nombre || "este registro"}?`,
      { titulo: "Quitar registro", confirmarTexto: "Quitar" }
    );
    if (!confirmar) {
      return;
    }

    try {
      setGuardando(true);
      await eliminarClienteProveedorConfiguracion(item?.id);
      await cargarRegistros();
      if (formulario.id === item?.id) limpiarFormulario();
    } catch (error) {
      mostrarErrorSistema(`No se pudo quitar el registro: ${error.message}`);
    } finally {
      setGuardando(false);
    }
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
          <h1>Clientes y proveedores</h1>
          <p>
            Aqui administramos los terceros que luego alimentan ventas, compras,
            pedidos y comprobantes.
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
              <h2>Ficha del tercero</h2>
              <p>Desde aqui registras clientes o proveedores sin duplicar catalogos sueltos.</p>
            </div>
          </div>

          <div className="grid_formulario">
            <Campo>
              <label>Tipo</label>
              <select value={formulario.tipo} onChange={(e) => actualizarCampo("tipo", e.target.value)}>
                <option value="CLIENTE">Cliente</option>
                <option value="PROVEEDOR">Proveedor</option>
              </select>
            </Campo>
            <Campo><label>Documento</label><input value={formulario.documento} onChange={(e) => actualizarCampo("documento", e.target.value)} /></Campo>
            <Campo><label>Nombre</label><input value={formulario.nombre} onChange={(e) => actualizarCampo("nombre", e.target.value.toUpperCase())} /></Campo>
            <Campo><label>Telefono</label><input value={formulario.telefono} onChange={(e) => actualizarCampo("telefono", e.target.value)} /></Campo>
            <Campo><label>Correo</label><input value={formulario.correo} onChange={(e) => actualizarCampo("correo", e.target.value)} /></Campo>
            <Campo><label>Contacto</label><input value={formulario.contacto} onChange={(e) => actualizarCampo("contacto", e.target.value.toUpperCase())} /></Campo>
            <Campo className="campo-completo"><label>Direccion</label><input value={formulario.direccion} onChange={(e) => actualizarCampo("direccion", e.target.value.toUpperCase())} /></Campo>
            <Campo><label>Estado</label><select value={formulario.estado} onChange={(e) => actualizarCampo("estado", e.target.value)}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Campo>
            <Campo className="campo-completo"><label>Observacion</label><textarea value={formulario.observacion} onChange={(e) => actualizarCampo("observacion", e.target.value.toUpperCase())} /></Campo>
          </div>

          <div className="acciones">
            <button type="button" className="btn btn_secundario" onClick={limpiarFormulario}>
              Limpiar
            </button>
            <button type="button" className="btn btn_principal" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar registro"}
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Lista registrada</h2>
              <p>Busca rapido por nombre, documento o contacto y vuelve a cargar la ficha.</p>
            </div>
          </div>

          <div className="filtros">
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="TODOS">Todos</option>
              <option value="CLIENTE">Clientes</option>
              <option value="PROVEEDOR">Proveedores</option>
            </select>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, documento, telefono o contacto"
            />
          </div>

          <div className="lista">
            {cargando ? (
              <div className="estado_vacio">Cargando terceros...</div>
            ) : listaFiltrada.length === 0 ? (
              <div className="estado_vacio">Todavia no hay clientes o proveedores registrados.</div>
            ) : (
              listaFiltrada.map((item) => (
                <article key={item.id} className="card_item">
                  <div className="card_item__cabecera">
                    <div>
                      <strong>{item.nombre}</strong>
                      <span>{item.tipo} | {item.documento || "SIN DOCUMENTO"}</span>
                    </div>
                    <span className={`estado estado_${String(item.estado || "").toLowerCase()}`}>
                      {item.estado}
                    </span>
                  </div>
                  <div className="detalles">
                    <span>Telefono: {item.telefono || "-"}</span>
                    <span>Correo: {item.correo || "-"}</span>
                    <span>Contacto: {item.contacto || "-"}</span>
                    <span>Direccion: {item.direccion || "-"}</span>
                  </div>
                  {item.observacion ? <p className="observacion">{item.observacion}</p> : null}
                  <div className="acciones">
                    <button type="button" className="btn btn_secundario" onClick={() => cargar(item)}>
                      Cargar
                    </button>
                    <button type="button" className="btn btn_secundario" onClick={() => eliminar(item)}>
                      Quitar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
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
  .estado_vacio,
  .observacion,
  .detalles span,
  .card_item__cabecera span {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.6;
  }

  .fila_superior {
    display: flex;
    justify-content: flex-start;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .grid_formulario,
  .filtros {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .campo-completo {
    grid-column: 1 / -1;
  }

  .lista {
    display: grid;
    gap: 14px;
  }

  .card_item {
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    padding: 16px;
    display: grid;
    gap: 12px;
  }

  .card_item__cabecera {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .card_item__cabecera strong {
    display: block;
  }

  .detalles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px 12px;
  }

  .estado {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 700;
  }

  .estado_activo {
    background: rgba(26, 179, 123, 0.15);
    color: #1ab37b;
  }

  .estado_inactivo {
    background: rgba(255, 137, 61, 0.15);
    color: #ff893d;
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
  select,
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
    min-height: 92px;
    resize: vertical;
  }
`;
