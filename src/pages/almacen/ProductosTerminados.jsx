import { useEffect } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { VisorFotosModelo } from "../../components/moleculas/VisorFotosModelo";
import {
  leerLotesProductosTerminados,
  leerMovimientosProductosTerminados,
  leerProductosTerminados,
  repararIdentidadCatalogoProductosTerminados,
  reconstruirStockProductosTerminadosDesdeLotes,
  registrarSalidaProductosTerminados,
} from "../../utils/productosTerminados";
import { leerConfiguracionVentasImpresion } from "../../utils/configuracionVentasImpresion";
import {
  leerListaPreciosProductos,
  obtenerPrecioVentaProducto,
} from "../../utils/preciosProductos";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import {
  leerCatalogosProduccion,
  obtenerCanalesComercialesGlobales,
} from "../../utils/catalogosProduccion";
import {
  cerrarProcesoSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
  mostrarProcesoSistema,
} from "../../utils/notificaciones";
import {
  sincronizarTallerStockDesdeLocalASupabase,
  sincronizarTallerStockDesdeSupabase,
} from "../../supabase/flujoTallerStockCore";
import {
  listarModelosProductoConfiguracion,
  listarVariantesProductoConfiguracion,
  leerConfiguracionEmpresaSupabase,
} from "../../supabase/configuracionCore";
import {

  calcularAlertaStock,
  formatearTallaVisualStock,
  mezclarCatalogoConStock,
  normalizarUmbralesStock,
} from "../../utils/stockProductosCatalogo";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();
const CLAVE_VENTAS_ALMACEN_PT = "cynara_ventas_almacen_pt";

const formatearFecha = (fecha = "") => fecha || "-";
const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};
const formatearMonto = (valor) =>
  `S/ ${convertirNumero(valor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizarTextoBusqueda = (valor = "") =>
  valor.toString().trim().toLowerCase();

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

const guardarLista = (clave, lista = []) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

const obtenerFechaActual = () => {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const crearVentaDirectaId = () => {
  const fecha = new Date();
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yy = String(fecha.getFullYear()).slice(-2);
  const correlativo = String(Date.now()).slice(-3);
  return `VALM${dd}${mm}${yy}-${correlativo}`;
};

const formatearCanalVisual = (valor = "") =>
  valor
    .toString()
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");

const crearFormularioVentaDirecta = (canalPorDefecto = "TIKTOK") => ({
  id: "",
  fecha: obtenerFechaActual(),
  canal: canalPorDefecto,
  cliente: "",
  documentoCliente: "",
  observacion: "",
  detalle: [],
});

const ACCESOS_PRODUCTO_TERMINADO = [
  {
    titulo: "Control de calidad",
    descripcion:
      "Clasifica apto, arreglo y remate antes de dejar lista la prenda en stock normal.",
    ruta: "/almacen/acondicionado-producto-terminado",
  },
  {
    titulo: "Control de tercerizacion",
    descripcion:
      "Recibe, cuenta, despacha y retorna los servicios externos ligados al producto terminado.",
    ruta: "/almacen/tercerizaciones",
  },
  {
    titulo: "Remates",
    descripcion:
      "Separa segundas y fallas sin mezclarlas con el stock sano disponible para venta.",
    ruta: "/almacen/remates",
  },
  {
    titulo: "Ajustes de prendas",
    descripcion:
      "Corrige diferencias de inventario, perdidas o regularizaciones autorizadas.",
    ruta: "/almacen/ajustes-prendas",
  },
];

export function ProductosTerminados({ vistaInicial = "stock" }) {
  const catalogosGlobales = useMemo(() => leerCatalogosProduccion(), []);
  const canalesComerciales = useMemo(
    () => obtenerCanalesComercialesGlobales(catalogosGlobales),
    [catalogosGlobales]
  );
  const canalVentaPorDefecto = canalesComerciales[0] || "TIKTOK";
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [pestanaActiva, setPestanaActiva] = useState(
    vistaInicial === "venta" ? "venta" : "rapida"
  );
  const [versionDatos, setVersionDatos] = useState(0);
  const [filtroModelo, setFiltroModelo] = useState("");
  const [filtroColor, setFiltroColor] = useState("");
  const [filtroTalla, setFiltroTalla] = useState("");
  const [formularioVenta, setFormularioVenta] = useState(() =>
    crearFormularioVentaDirecta(canalVentaPorDefecto)
  );
  const [catalogoModelos, setCatalogoModelos] = useState([]);
  const [catalogoVariantes, setCatalogoVariantes] = useState([]);
  const [cargandoStockInicial, setCargandoStockInicial] = useState(vistaInicial !== "venta");
  const [cargandoCatalogoInicial, setCargandoCatalogoInicial] = useState(vistaInicial !== "venta");
  const [nivelesStock, setNivelesStock] = useState(
    normalizarUmbralesStock({ stockBajo: 5, stockMedio: 10, stockOptimo: 15 })
  );
  const configuracionVenta = useMemo(() => leerConfiguracionVentasImpresion(), []);
  const listaPrecios = useMemo(() => leerListaPreciosProductos(), [versionDatos]);

  useEffect(() => {
    setFormularioVenta((anterior) => {
      if (
        anterior?.canal &&
        canalesComerciales.some((canal) => canal === anterior.canal)
      ) {
        return anterior;
      }

      return {
        ...anterior,
        canal: canalVentaPorDefecto,
      };
    });
  }, [canalVentaPorDefecto, canalesComerciales]);

  useEffect(() => {
    const sincronizar = async () => {
      try {
        if (vistaInicial !== "venta") {
          setCargandoStockInicial(true);
        }
        await sincronizarTallerStockDesdeSupabase();
        if (vistaInicial !== "venta") {
          const stockActual = leerProductosTerminados();
          const lotesActuales = leerLotesProductosTerminados();
          if (stockActual.length === 0 && lotesActuales.length > 0) {
            reconstruirStockProductosTerminadosDesdeLotes();
          }
          await repararIdentidadCatalogoProductosTerminados();
          await sincronizarTallerStockDesdeLocalASupabase();
        }
        setVersionDatos((anterior) => anterior + 1);
      } catch (error) {
        console.error("No se pudo sincronizar stock de productos:", error);
      } finally {
        if (vistaInicial !== "venta") {
          setCargandoStockInicial(false);
        }
      }
    };

    sincronizar();
  }, [vistaInicial]);

  useEffect(() => {
    if (vistaInicial === "venta") {
      setCargandoCatalogoInicial(false);
      return undefined;
    }

    const cargarCatalogo = async () => {
      try {
        setCargandoCatalogoInicial(true);
        const [modelos, variantes] = await Promise.all([
          listarModelosProductoConfiguracion(),
          listarVariantesProductoConfiguracion(),
        ]);
        const configuracionEmpresa = await leerConfiguracionEmpresaSupabase();

        setCatalogoModelos(Array.isArray(modelos) ? modelos : []);
        setCatalogoVariantes(Array.isArray(variantes) ? variantes : []);
        setNivelesStock(
          normalizarUmbralesStock({
            stockBajo: configuracionEmpresa?.stockMinimoAlerta,
            stockMedio: configuracionEmpresa?.stockMedioAlerta,
            stockOptimo: configuracionEmpresa?.stockOptimoAlerta,
          })
        );
      } catch (error) {
        console.error("No se pudo cargar el catalogo maestro de productos:", error);
        setCatalogoModelos([]);
        setCatalogoVariantes([]);
        setNivelesStock(
          normalizarUmbralesStock({ stockBajo: 5, stockMedio: 10, stockOptimo: 15 })
        );
      } finally {
        setCargandoCatalogoInicial(false);
      }
    };

    cargarCatalogo();
    return undefined;
  }, [vistaInicial]);

  const productosTerminados = useMemo(() => leerProductosTerminados(), [versionDatos]);
  const movimientos = useMemo(() => leerMovimientosProductosTerminados(), [versionDatos]);
  const lotes = useMemo(() => leerLotesProductosTerminados(), [versionDatos]);
  const ventasDirectas = useMemo(
    () =>
      leerListaGuardada(CLAVE_VENTAS_ALMACEN_PT).sort((a, b) =>
        String(b?.fecha || "").localeCompare(String(a?.fecha || ""))
      ),
    [versionDatos]
  );
  const productosCatalogoOperativo = useMemo(() => {
    if (vistaInicial === "venta") {
      return productosTerminados;
    }
    return mezclarCatalogoConStock({
      productosTerminados,
      catalogoModelos,
      catalogoVariantes,
    });
  }, [catalogoModelos, catalogoVariantes, productosTerminados, vistaInicial]);
  const modelosDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          productosCatalogoOperativo.map((item) => item?.modelo || "").filter(Boolean)
        )
      ).sort(),
    [productosCatalogoOperativo]
  );
  const coloresDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          productosCatalogoOperativo
            .map((item) => item?.colorBase || "")
            .filter(Boolean)
        )
      ).sort(),
    [productosCatalogoOperativo]
  );
  const tallasDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          productosCatalogoOperativo.map((item) => item?.talla || "").filter(Boolean)
        )
      ).sort(),
    [productosCatalogoOperativo]
  );

  const productosFiltrados = useMemo(() => {
    const texto = normalizarTextoBusqueda(busqueda);
    const modelo = normalizarTextoBusqueda(filtroModelo);
    const color = normalizarTextoBusqueda(filtroColor);
    const talla = normalizarTextoBusqueda(filtroTalla);

    return productosCatalogoOperativo.filter((item) =>
      (!modelo || (item?.modelo || "").toLowerCase() === modelo) &&
      (!color || (item?.colorBase || "").toLowerCase() === color) &&
      (!talla || (item?.talla || "").toLowerCase() === talla) &&
      (!texto ||
        [
        item?.codigoCorto,
        item?.codigoProducto,
        item?.codigoBarraTexto,
        item?.modelo,
        item?.categoriaModelo,
        item?.modeloCatalogo,
        item?.telaModelo,
        item?.colorBase,
        item?.talla,
        item?.tipoTela,
      ]
        .join(" ")
        .toLowerCase()
          .includes(texto))
    );
  }, [busqueda, filtroColor, filtroModelo, filtroTalla, productosCatalogoOperativo]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(productosFiltrados.length / FILAS_POR_PAGINA)
  );
  const paginaVisible = Math.min(paginaActual, totalPaginas);
  const bloqueandoCatalogoOperativo =
    vistaInicial !== "venta" && (cargandoStockInicial || cargandoCatalogoInicial);

  useEffect(() => {
    if (vistaInicial === "venta") {
      return undefined;
    }

    if (bloqueandoCatalogoOperativo) {
      mostrarProcesoSistema("Cargando stock y catalogo operativo...");
    } else {
      cerrarProcesoSistema();
    }

    return () => {
      cerrarProcesoSistema();
    };
  }, [bloqueandoCatalogoOperativo, vistaInicial]);

  const productosPaginados = useMemo(() => {
    const inicio = (paginaVisible - 1) * FILAS_POR_PAGINA;
    return productosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [paginaVisible, productosFiltrados]);

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  const totalStock = useMemo(
    () =>
      productosTerminados.reduce(
        (total, item) => total + Number(item?.stockActual || 0),
        0
      ),
    [productosTerminados]
  );
  const totalCatalogoOperativo = productosCatalogoOperativo.length;
  const totalProductosConStock = useMemo(
    () =>
      productosCatalogoOperativo.filter(
        (item) => Number(item?.stockActual || 0) > 0
      ).length,
    [productosCatalogoOperativo]
  );
  const totalProductosBajoAlerta = useMemo(
    () =>
      productosCatalogoOperativo.filter((item) => {
        const alerta = calcularAlertaStock(item?.stockActual || 0, nivelesStock);
        return alerta.esAlerta;
      }).length,
    [nivelesStock, productosCatalogoOperativo]
  );

  const ultimoMovimiento = movimientos[0] || null;
  const trazabilidadPorOp = useMemo(() => {
    const mapa = new Map();

    lotes.forEach((item) => {
      const codigoOp = item?.codigoOp || "SIN OP";
      const actual = mapa.get(codigoOp) || {
        codigoOp,
        fechaIngreso: item?.fechaIngreso || item?.ultimaFechaIngreso || "",
        totalIngresado: 0,
        totalSalido: 0,
        saldo: 0,
        productos: new Set(),
      };

      actual.totalIngresado += Number(item?.cantidadIngresadaTotal || 0);
      actual.totalSalido += Number(item?.cantidadSalidaTotal || 0);
      actual.saldo += Number(item?.stockActualLote || 0);
      if (item?.modelo) {
        actual.productos.add(item.modelo);
      }
      if (!actual.fechaIngreso && (item?.fechaIngreso || item?.ultimaFechaIngreso)) {
        actual.fechaIngreso = item?.fechaIngreso || item?.ultimaFechaIngreso || "";
      }

      mapa.set(codigoOp, actual);
    });

    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        productos: Array.from(item.productos),
        estado:
          Number(item.saldo || 0) <= 0 && Number(item.totalIngresado || 0) > 0
            ? "AGOTADA"
            : "CON SALDO",
      }))
      .sort((a, b) => `${b.fechaIngreso || ""}`.localeCompare(`${a.fechaIngreso || ""}`));
  }, [lotes]);

  const ventasDirectasFiltradas = useMemo(() => {
    const texto = normalizarTextoBusqueda(busqueda);

    return ventasDirectas.filter((item) =>
      !texto ||
      [item?.id, item?.fecha, item?.canal, item?.cliente, item?.observacion]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    );
  }, [busqueda, ventasDirectas]);

  const agregarProductoVenta = (producto) => {
    setFormularioVenta((anterior) => {
      if ((anterior.detalle || []).some((item) => item.claveProducto === producto.claveProducto)) {
        return anterior;
      }

      return {
        ...anterior,
        detalle: [
          ...(anterior.detalle || []),
          {
            claveProducto: producto.claveProducto,
            codigoCorto: producto.codigoCorto || "",
            codigoProducto: producto.codigoProducto || "",
            modelo: producto.modelo || "",
            colorBase: producto.colorBase || "",
            talla: producto.talla || "",
            stockActual: Number(producto.stockActual || 0),
            cantidadAtendida: "1",
            precioUnitario: String(
              obtenerPrecioVentaProducto({
                modelo: producto.modelo,
                talla: producto.talla,
                lista: listaPrecios,
              }) || ""
            ),
          },
        ],
      };
    });
  };

  const actualizarCantidadVenta = (claveProducto, valor) => {
    setFormularioVenta((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).map((item) =>
        item.claveProducto !== claveProducto
          ? item
          : { ...item, cantidadAtendida: valor }
      ),
    }));
  };

  const actualizarPrecioVenta = (claveProducto, valor) => {
    setFormularioVenta((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).map((item) =>
        item.claveProducto !== claveProducto
          ? item
          : { ...item, precioUnitario: valor }
      ),
    }));
  };

  const quitarProductoVenta = (claveProducto) => {
    setFormularioVenta((anterior) => ({
      ...anterior,
      detalle: (anterior.detalle || []).filter((item) => item.claveProducto !== claveProducto),
    }));
  };

  const resumenVentaDirecta = useMemo(() => {
    const porcentajeIgv = convertirNumero(configuracionVenta?.igvPorcentaje || 18);
    const factorIgv = 1 + porcentajeIgv / 100;

    const subtotal = (formularioVenta.detalle || []).reduce((total, item) => {
      const bruto =
        convertirNumero(item?.cantidadAtendida) * convertirNumero(item?.precioUnitario);
      const base = configuracionVenta?.preciosIncluyenIgv ? bruto / factorIgv : bruto;
      return total + base;
    }, 0);

    const igv = (formularioVenta.detalle || []).reduce((total, item) => {
      const bruto =
        convertirNumero(item?.cantidadAtendida) * convertirNumero(item?.precioUnitario);
      const base = configuracionVenta?.preciosIncluyenIgv ? bruto / factorIgv : bruto;
      const impuesto = configuracionVenta?.preciosIncluyenIgv
        ? bruto - base
        : base * (porcentajeIgv / 100);
      return total + impuesto;
    }, 0);

    return {
      subtotal,
      igv,
      total: subtotal + igv,
    };
  }, [configuracionVenta, formularioVenta.detalle]);

  const guardarVentaDirecta = async () => {
    if ((formularioVenta.detalle || []).length === 0) {
      mostrarAlertaSistema("Agrega al menos una prenda a la venta directa.");
      return;
    }

    const detalleNormalizado = (formularioVenta.detalle || []).map((item) => ({
      ...item,
      cantidadAtendida: Number(item?.cantidadAtendida || 0),
      precioUnitario: Number(item?.precioUnitario || 0),
    }));

    if (detalleNormalizado.some((item) => item.cantidadAtendida <= 0)) {
      mostrarAlertaSistema("Todas las cantidades deben ser mayores a cero.");
      return;
    }

    if (detalleNormalizado.some((item) => item.precioUnitario <= 0)) {
      mostrarAlertaSistema("Completa el precio unitario de todas las prendas.");
      return;
    }

    if (
      detalleNormalizado.some(
        (item) => Number(item.cantidadAtendida || 0) > Number(item.stockActual || 0)
      )
    ) {
      mostrarAlertaSistema("No puedes vender mas de lo que hay en stock.");
      return;
    }

    const ventaId = formularioVenta.id || crearVentaDirectaId();

    registrarSalidaProductosTerminados({
      salidaId: `VALM-${ventaId}`,
      pedidoId: ventaId,
      fecha: formularioVenta.fecha,
      tienda: `VENTA ${formularioVenta.canal || "DIRECTA"}`,
      observacion: [formularioVenta.canal, formularioVenta.cliente, formularioVenta.observacion]
        .filter(Boolean)
        .join(" | "),
      detalleSalida: detalleNormalizado,
    });

    const historialActual = leerListaGuardada(CLAVE_VENTAS_ALMACEN_PT);
    const ventaRegistro = {
      id: ventaId,
      fecha: formularioVenta.fecha,
      canal: formularioVenta.canal,
      cliente: formularioVenta.cliente,
      documentoCliente: formularioVenta.documentoCliente,
      observacion: formularioVenta.observacion,
      tipoComprobante: configuracionVenta?.tipoComprobanteDefecto || "NOTA DE VENTA",
      serieComprobante: configuracionVenta?.serieNotaVenta || "NV001",
      detalle: detalleNormalizado,
      totalPrendas: detalleNormalizado.reduce(
        (total, item) => total + Number(item?.cantidadAtendida || 0),
        0
      ),
      subtotalVenta: resumenVentaDirecta.subtotal,
      igvVenta: resumenVentaDirecta.igv,
      totalVenta: resumenVentaDirecta.total,
    };

    guardarLista(CLAVE_VENTAS_ALMACEN_PT, [
      ventaRegistro,
      ...historialActual.filter((item) => item?.id !== ventaId),
    ]);

    await sincronizarTallerStockDesdeLocalASupabase();
    await sincronizarTallerStockDesdeSupabase();
    setFormularioVenta(crearFormularioVentaDirecta(canalVentaPorDefecto));
    setVersionDatos((anterior) => anterior + 1);
    mostrarNotificacionCarga("Venta directa de Almacen registrada.");
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
          <h1>{vistaInicial === "venta" ? "Venta directa desde almacen" : "Stock de productos"}</h1>
          <p>
            {vistaInicial === "venta"
              ? "Aqui Almacen vende directo para TikTok, mostrador o pedidos rapidos sin mezclar esa tarea con la pantalla de stock general."
              : "Aqui Almacen revisa el stock final recibido desde taller, sus codigos operativos y sus precios referenciales para venta."}
          </p>
        </div>

        <div className="cabecera__estado">
          <span>{vistaInicial === "venta" ? "Productos activos" : "Catalogo operativo"}</span>
          <strong>
            {vistaInicial === "venta" ? productosTerminados.length : totalCatalogoOperativo}
          </strong>
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
              <span>{vistaInicial === "venta" ? "Total de productos" : "Total catalogado"}</span>
              <strong>
                {vistaInicial === "venta" ? productosTerminados.length : totalCatalogoOperativo}
              </strong>
            </div>
            <div>
              <span>Stock total recibido</span>
              <strong>{totalStock}</strong>
            </div>
            <div>
              <span>{vistaInicial === "venta" ? "Ultimo movimiento" : "Con stock real"}</span>
              <strong>
                {vistaInicial === "venta"
                  ? ultimoMovimiento?.codigoSalida || "-"
                  : totalProductosConStock}
              </strong>
            </div>
            <div>
              <span>{vistaInicial === "venta" ? "Fecha ultimo ingreso" : "Alertas activas"}</span>
              <strong>
                {vistaInicial === "venta"
                  ? formatearFecha(ultimoMovimiento?.fecha)
                  : `${totalProductosBajoAlerta} items`}
              </strong>
            </div>
          </div>
        </section>

        <section className="tarjeta ayuda_visual">
          <div className="ayuda_visual__grid">
            <div className="ayuda_visual__item">
              <span>Nombre comercial</span>
              <strong>Lo que reconoce rapido la empresa</strong>
              <small>
                Ejemplo: PANTALON CLASICO FRENCH RIGIDO
              </small>
            </div>
            <div className="ayuda_visual__item">
              <span>Variante tecnica</span>
              <strong>La diferencia interna del sistema</strong>
              <small>
                Ejemplo: FRENCH TERRY RIGIDO
              </small>
            </div>
            <div className="ayuda_visual__item">
              <span>Codigo corto</span>
              <strong>Para escribir rapido o escanear</strong>
              <small>
                Se usa en almacen, despacho y futuro lector de barras
              </small>
            </div>
          </div>
        </section>

        {vistaInicial === "venta" ? null : (
          <section className="tarjeta accesos_relacionados">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Flujos relacionados</h2>
                <p>
                  Aqui dejamos a la mano los pasos que completan el trabajo de
                  producto terminado, incluyendo la tercerizacion de Almacen.
                </p>
              </div>
            </div>

            <div className="accesos_relacionados__grid">
              {ACCESOS_PRODUCTO_TERMINADO.map((item) => (
                <article key={item.ruta} className="acceso_relacionado">
                  <span>{item.titulo}</span>
                  <strong>{item.descripcion}</strong>
                  <Link to={item.ruta} className="btn btn_secundario btn_enlace">
                    Abrir modulo
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>{vistaInicial === "venta" ? "Venta directa" : "Catalogo operativo"}</h2>
              <p>
                {vistaInicial === "venta"
                  ? "Aqui trabajas solo la venta directa. El stock general queda aparte para consulta."
                  : "Usa la vista rapida para trabajo diario y la vista tecnica solo cuando necesites revisar codigos internos."}
              </p>
            </div>
          </div>

          {vistaInicial === "venta" ? null : (
            <div className="pestanas">
              <>
                <button
                  type="button"
                  className={`pestana ${pestanaActiva === "rapida" ? "pestana_activa" : ""}`}
                  onClick={() => setPestanaActiva("rapida")}
                >
                  Stock
                </button>
                <button
                  type="button"
                  className={`pestana ${pestanaActiva === "tecnica" ? "pestana_activa" : ""}`}
                  onClick={() => setPestanaActiva("tecnica")}
                >
                  Vista tecnica
                </button>
                <button
                  type="button"
                  className={`pestana ${pestanaActiva === "op" ? "pestana_activa" : ""}`}
                  onClick={() => setPestanaActiva("op")}
                >
                  Trazabilidad por OP
                </button>
              </>
            </div>
          )}

          <div className="filtros">
            <input
              type="text"
              value={busqueda}
              disabled={bloqueandoCatalogoOperativo}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder=""
            />
            <input
              type="text"
              list="catalogo-stock-modelos"
              value={filtroModelo}
              disabled={bloqueandoCatalogoOperativo}
              onChange={(evento) => {
                setFiltroModelo(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Todos los modelos"
            />
            <datalist id="catalogo-stock-modelos">
              {modelosDisponibles.map((modelo) => (
                <option key={modelo} value={modelo} />
              ))}
            </datalist>
            <input
              type="text"
              list="catalogo-stock-colores"
              value={filtroColor}
              disabled={bloqueandoCatalogoOperativo}
              onChange={(evento) => {
                setFiltroColor(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Todos los colores"
            />
            <datalist id="catalogo-stock-colores">
              {coloresDisponibles.map((color) => (
                <option key={color} value={color} />
              ))}
            </datalist>
            <input
              type="text"
              list="catalogo-stock-tallas"
              value={filtroTalla}
              disabled={bloqueandoCatalogoOperativo}
              onChange={(evento) => {
                setFiltroTalla(evento.target.value);
                setPaginaActual(1);
              }}
              placeholder="Todas las tallas"
            />
            <datalist id="catalogo-stock-tallas">
              {tallasDisponibles.map((talla) => (
                <option key={talla} value={talla} />
              ))}
            </datalist>
            <button
              type="button"
              className="btn btn_secundario"
              disabled={bloqueandoCatalogoOperativo}
              onClick={() => {
                setBusqueda("");
                setFiltroModelo("");
                setFiltroColor("");
                setFiltroTalla("");
                setPaginaActual(1);
              }}
            >
              Limpiar filtros
            </button>
          </div>

          {vistaInicial !== "venta" && pestanaActiva === "rapida" ? (
            <div
              className="tabla_contenedor tabla_rapida"
              key={`catalogo-rapida-${paginaVisible}-${productosFiltrados.length}`}
            >
              <table>
                <thead>
                  <tr>
                    <th>Codigo corto</th>
                    <th>Modelo</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Stock</th>
                    <th>Alerta</th>
                    <th>Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {productosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="sin_datos">
                          Todavia no hay productos registrados.
                        </td>
                    </tr>
                  ) : (
                    productosPaginados.map((item) => {
                      const alertaStock = calcularAlertaStock(
                        item?.stockActual || 0,
                        nivelesStock
                      );
                      return (
                      <tr key={item.claveProducto || item.id}>
                        <td>
                          <strong className="codigo_corto">
                            {item.codigoCorto || "-"}
                          </strong>
                        </td>
                        <td>{item.modelo || "-"}</td>
                        <td>{item.colorBase || "-"}</td>
                        <td>{formatearTallaVisualStock(item.talla || "-")}</td>
                        <td>
                          <strong
                            className={`stock_destacado ${
                              Number(item.stockActual || 0) <= 0 ? "stock_cero" : ""
                            }`}
                          >
                            {Number(item.stockActual || 0)}
                          </strong>
                        </td>
                        <td>
                          <span className={`chip_alerta chip_alerta_${alertaStock.color}`}>
                            {alertaStock.etiqueta}
                          </span>
                        </td>
                        <td>
                          <VisorFotosModelo
                            modeloBase={item.modelo || ""}
                            colorBase={item.colorBase || ""}
                            etiquetaBoton="Ver foto"
                            titulo="Referencia visual del producto"
                            descripcionSinImagen="Este producto no tiene foto especifica por color ni ficha general del modelo."
                          />
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : vistaInicial !== "venta" && pestanaActiva === "tecnica" ? (
            <div
              className="tabla_contenedor"
              key={`catalogo-tecnica-${paginaVisible}-${productosFiltrados.length}`}
            >
              <table>
                <thead>
                  <tr>
                    <th>Codigo corto</th>
                    <th>Codigo maestro</th>
                    <th>Nombre comercial</th>
                    <th>Categoria</th>
                    <th>Modelo</th>
                    <th>Tela nombre</th>
                    <th>Variante tecnica</th>
                    <th>Color</th>
                    <th>Talla</th>
                    <th>Stock</th>
                    <th>Ultima OP</th>
                    <th>Texto barra</th>
                    <th>Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {productosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan="13" className="sin_datos">
                          Todavia no hay productos registrados.
                        </td>
                    </tr>
                  ) : (
                    productosPaginados.map((item) => (
                      <tr key={item.claveProducto || item.id}>
                        <td>
                          <strong className="codigo_corto">
                            {item.codigoCorto || "-"}
                          </strong>
                        </td>
                        <td>{item.codigoProducto || "-"}</td>
                        <td>{item.modelo || "-"}</td>
                        <td>{item.categoriaModelo || "-"}</td>
                        <td>{item.modeloCatalogo || "-"}</td>
                        <td>{item.telaModelo || "-"}</td>
                        <td>{item.tipoTela || "-"}</td>
                        <td>{item.colorBase || "-"}</td>
                        <td>{formatearTallaVisualStock(item.talla || "-")}</td>
                        <td>{Number(item.stockActual || 0)}</td>
                        <td>{item.ultimaOp || "-"}</td>
                        <td>{item.codigoBarraTexto || "-"}</td>
                        <td>
                          <VisorFotosModelo
                            modeloBase={item.modelo || ""}
                            colorBase={item.colorBase || ""}
                            etiquetaBoton="Ver foto"
                            titulo="Referencia visual del producto"
                            descripcionSinImagen="Este producto no tiene foto especifica por color ni ficha general del modelo."
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : vistaInicial !== "venta" && pestanaActiva === "op" ? (
            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo OP</th>
                    <th>Fecha ingreso</th>
                    <th>Modelos relacionados</th>
                    <th>Total ingresado</th>
                    <th>Total salido</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {trazabilidadPorOp.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="sin_datos">
                        Todavia no hay trazabilidad por OP disponible.
                      </td>
                    </tr>
                  ) : (
                    trazabilidadPorOp.map((item) => (
                      <tr key={item.codigoOp}>
                        <td>
                          <strong className="codigo_corto">{item.codigoOp || "-"}</strong>
                        </td>
                        <td>{formatearFecha(item.fechaIngreso)}</td>
                        <td>{item.productos.join(", ") || "-"}</td>
                        <td>{Number(item.totalIngresado || 0)}</td>
                        <td>{Number(item.totalSalido || 0)}</td>
                        <td>
                          <strong className={Number(item.saldo || 0) <= 0 ? "estado_agotado" : "stock_destacado"}>
                            {Number(item.saldo || 0)}
                          </strong>
                        </td>
                        <td>
                          <span className={item.estado === "AGOTADA" ? "chip_estado chip_estado_agotado" : "chip_estado chip_estado_saldo"}>
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : vistaInicial === "venta" ? (
            <>
              <div className="tarjeta_venta">
                <div className="tarjeta__encabezado">
                  <div>
                    <h2>Venta directa desde Almacen</h2>
                    <p>
                      Aqui puedes vender usando los canales comerciales configurados, sin pasar por Tienda.
                    </p>
                  </div>
                </div>

                <div className="filtros filtros_venta">
                  <input
                    type="text"
                    value={formularioVenta.id || "Nueva"}
                    readOnly
                  />
                  <input
                    type="date"
                    value={formularioVenta.fecha}
                    onChange={(evento) =>
                      setFormularioVenta((anterior) => ({
                        ...anterior,
                        fecha: evento.target.value,
                      }))
                    }
                  />
                  <select
                    value={formularioVenta.canal}
                    onChange={(evento) =>
                      setFormularioVenta((anterior) => ({
                        ...anterior,
                        canal: evento.target.value,
                      }))
                    }
                  >
                    {canalesComerciales.map((canal) => (
                      <option key={canal} value={canal}>
                        {formatearCanalVisual(canal)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={formularioVenta.cliente}
                    onChange={(evento) =>
                      setFormularioVenta((anterior) => ({
                        ...anterior,
                        cliente: evento.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Cliente o referencia"
                  />
                </div>

                <div className="filtros filtros_venta">
                  <input
                    type="text"
                    value={formularioVenta.documentoCliente}
                    onChange={(evento) =>
                      setFormularioVenta((anterior) => ({
                        ...anterior,
                        documentoCliente: evento.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Documento cliente"
                  />
                  <input
                    type="text"
                    value={configuracionVenta?.tipoComprobanteDefecto || "NOTA DE VENTA"}
                    readOnly
                  />
                  <input
                    type="text"
                    value={configuracionVenta?.serieNotaVenta || "NV001"}
                    readOnly
                  />
                  <input
                    type="text"
                    value={configuracionVenta?.preciosIncluyenIgv ? "Precios con IGV" : "Precios sin IGV"}
                    readOnly
                  />
                </div>

                <div className="filtros filtros_venta_observacion">
                  <input
                    type="text"
                    value={formularioVenta.observacion}
                    onChange={(evento) =>
                      setFormularioVenta((anterior) => ({
                        ...anterior,
                        observacion: evento.target.value,
                      }))
                    }
                    placeholder="Observacion de venta directa"
                  />
                </div>

                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Codigo corto</th>
                        <th>Modelo</th>
                        <th>Color</th>
                        <th>Talla</th>
                        <th>Stock</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosPaginados.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="sin_datos">
                            No hay prendas disponibles con ese filtro.
                          </td>
                        </tr>
                      ) : (
                        productosPaginados.map((item) => (
                          <tr key={`venta-${item.claveProducto || item.id}`}>
                            <td>{item.codigoCorto || "-"}</td>
                            <td>{item.modelo || "-"}</td>
                            <td>{item.colorBase || "-"}</td>
                            <td>{formatearTallaVisualStock(item.talla || "-")}</td>
                            <td>{Number(item.stockActual || 0)}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn_secundario"
                                onClick={() => agregarProductoVenta(item)}
                              >
                                Agregar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="tabla_contenedor">
                  <table>
                    <thead>
                      <tr>
                        <th>Codigo corto</th>
                        <th>Modelo</th>
                        <th>Color</th>
                        <th>Talla</th>
                        <th>Stock</th>
                        <th>Vende</th>
                        <th>P. unitario</th>
                        <th>Subtotal</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formularioVenta.detalle || []).length === 0 ? (
                        <tr>
                          <td colSpan="9" className="sin_datos">
                            Todavia no agregaste prendas a la venta.
                          </td>
                        </tr>
                      ) : (
                        formularioVenta.detalle.map((item) => (
                          <tr key={`detalle-${item.claveProducto}`}>
                            <td>{item.codigoCorto || "-"}</td>
                            <td>{item.modelo || "-"}</td>
                            <td>{item.colorBase || "-"}</td>
                            <td>{formatearTallaVisualStock(item.talla || "-")}</td>
                            <td>{Number(item.stockActual || 0)}</td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                max={Number(item.stockActual || 0)}
                                value={item.cantidadAtendida}
                                onChange={(evento) =>
                                  actualizarCantidadVenta(item.claveProducto, evento.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.precioUnitario || ""}
                                onChange={(evento) =>
                                  actualizarPrecioVenta(item.claveProducto, evento.target.value)
                                }
                              />
                            </td>
                            <td>
                              {formatearMonto(
                                convertirNumero(item.cantidadAtendida) *
                                  convertirNumero(item.precioUnitario)
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn_secundario"
                                onClick={() => quitarProductoVenta(item.claveProducto)}
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                  </tbody>
                </table>
                </div>

                <div className="resumen_venta_boleta">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatearMonto(resumenVentaDirecta.subtotal)}</strong>
                  </div>
                  <div>
                    <span>IGV</span>
                    <strong>{formatearMonto(resumenVentaDirecta.igv)}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{formatearMonto(resumenVentaDirecta.total)}</strong>
                  </div>
                </div>

                <div className="paginacion">
                  <button type="button" className="btn btn_principal" onClick={guardarVentaDirecta}>
                    Registrar venta directa
                  </button>
                </div>
              </div>

              <div className="tabla_contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Venta</th>
                      <th>Fecha</th>
                      <th>Canal</th>
                      <th>Cliente</th>
                      <th>Total prendas</th>
                      <th>Subtotal</th>
                      <th>IGV</th>
                      <th>Total</th>
                      <th>Observacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasDirectasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="sin_datos">
                          Todavia no hay ventas directas registradas.
                        </td>
                      </tr>
                    ) : (
                      ventasDirectasFiltradas.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.fecha || "-"}</td>
                          <td>{item.canal || "-"}</td>
                          <td>{item.cliente || "-"}</td>
                          <td>{Number(item.totalPrendas || 0)}</td>
                          <td>{formatearMonto(item.subtotalVenta)}</td>
                          <td>{formatearMonto(item.igvVenta)}</td>
                          <td>{formatearMonto(item.totalVenta)}</td>
                          <td>{item.observacion || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="paginacion">
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() => setPaginaActual((valor) => Math.max(1, valor - 1))}
              disabled={bloqueandoCatalogoOperativo || paginaVisible === 1}
            >
              Anterior
            </button>
            <span>
              Pagina {paginaVisible} de {totalPaginas}
            </span>
            <button
              type="button"
              className="btn btn_secundario"
              onClick={() =>
                setPaginaActual((valor) => Math.min(totalPaginas, valor + 1))
              }
              disabled={bloqueandoCatalogoOperativo || paginaVisible === totalPaginas}
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

  .ayuda_visual__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .ayuda_visual__item {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg2};
  }

  .ayuda_visual__item span {
    display: block;
    font-size: 12px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .ayuda_visual__item strong {
    display: block;
    color: ${({ theme }) => theme.text};
    margin-bottom: 6px;
  }

  .ayuda_visual__item small {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.5;
  }

  .accesos_relacionados__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
  }

  .acceso_relacionado {
    display: grid;
    gap: 10px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
  }

  .acceso_relacionado span {
    font-size: 12px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colorSubtitle};
    font-weight: 700;
  }

  .acceso_relacionado strong {
    color: ${({ theme }) => theme.text};
    line-height: 1.5;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .acceso_relacionado .btn {
    width: fit-content;
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

  .filtros input {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg2};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
  }

  .filtros {
    display: grid;
    grid-template-columns: minmax(220px, 1.5fr) repeat(3, minmax(150px, 1fr)) auto;
    gap: 10px;
    align-items: center;
  }

  .filtros select {
    width: 100%;
    border-radius: 14px;
    border: 1px solid ${({ theme }) => theme.bg4};
    background: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    padding: 12px 14px;
    outline: none;
    font-weight: 700;
  }

  .filtros_venta {
    grid-template-columns: repeat(4, minmax(150px, 1fr));
    margin-bottom: 12px;
  }

  .texto_cargando_catalogo {
    margin: 10px 0 0;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
    font-weight: 600;
  }

  .filtros_venta_observacion {
    grid-template-columns: 1fr;
    margin-bottom: 12px;
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

  .tabla_contenedor {
    margin-top: 16px;
    overflow: auto;
  }

  .tabla_rapida table {
    min-width: 760px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1100px;
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

  .codigo_corto {
    color: ${({ theme }) => theme.bg5};
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

  .stock_cero {
    background: rgba(245, 158, 11, 0.16);
    color: #ffd78a;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .chip_alerta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 104px;
    padding: 7px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .chip_alerta_rojo {
    background: rgba(239, 68, 68, 0.18);
    color: #ffb0b0;
    border-color: rgba(239, 68, 68, 0.32);
  }

  .chip_alerta_amarillo {
    background: rgba(245, 158, 11, 0.16);
    color: #ffd78a;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .chip_alerta_verde {
    background: rgba(16, 185, 129, 0.18);
    color: #b0f0da;
    border-color: rgba(16, 185, 129, 0.32);
  }

  .estado_agotado {
    display: inline-flex;
    min-width: 52px;
    justify-content: center;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.18);
    color: #ffffff;
    border: 1px solid rgba(16, 185, 129, 0.32);
  }

  .chip_estado {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 12px;
  }

  .chip_estado_agotado {
    background: rgba(16, 185, 129, 0.18);
    color: #a7f3d0;
    border: 1px solid rgba(16, 185, 129, 0.32);
  }

  .chip_estado_saldo {
    background: rgba(245, 158, 11, 0.18);
    color: #fde68a;
    border: 1px solid rgba(245, 158, 11, 0.32);
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

  .tarjeta_venta {
    display: grid;
    gap: 14px;
    margin-bottom: 16px;
  }

  .resumen_venta_boleta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .resumen_venta_boleta div {
    border: 1px solid ${({ theme }) => theme.bg4};
    border-radius: 16px;
    padding: 14px;
    background: ${({ theme }) => theme.bg2};
  }

  .resumen_venta_boleta span {
    display: block;
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-transform: uppercase;
  }

  .resumen_venta_boleta strong {
    display: block;
    margin-top: 6px;
    font-size: 20px;
    color: ${({ theme }) => theme.text};
  }

  @media (max-width: 900px) {
    .cabecera {
      flex-direction: column;
    }

    .cabecera__estado {
      width: 100%;
    }

    .ayuda_visual__grid,
    .resumen__grid,
    .resumen_venta_boleta {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .ayuda_visual__item,
    .resumen__grid div,
    .resumen_venta_boleta div {
      padding: 12px;
      border-radius: 14px;
    }

    .chip_alerta,
    .chip_estado,
    .stock_destacado,
    .estado_agotado {
      min-width: 88px;
      padding: 6px 9px;
      font-size: 11px;
    }

    th,
    td {
      padding: 10px 8px;
      font-size: 13px;
    }

    .paginacion {
      flex-direction: column;
      align-items: stretch;
    }

    .filtros {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .ayuda_visual__grid,
    .resumen__grid,
    .resumen_venta_boleta {
      grid-template-columns: 1fr;
    }

    .ayuda_visual__item,
    .resumen__grid div,
    .resumen_venta_boleta div {
      padding: 10px;
      border-radius: 12px;
    }

    .filtros input,
    .filtros select {
      padding: 10px 12px;
      border-radius: 12px;
    }

    th,
    td {
      padding: 8px 7px;
      font-size: 12px;
    }

    .chip_alerta,
    .chip_estado,
    .stock_destacado,
    .estado_agotado {
      min-width: 78px;
      padding: 6px 8px;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;




