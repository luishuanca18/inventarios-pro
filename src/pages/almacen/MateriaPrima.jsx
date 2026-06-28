import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { leerCatalogosProduccion } from "../../utils/catalogosProduccion";
import {
  ejecutarAccionConFeedbackSistema,
  mostrarAlertaSistema,
  mostrarNotificacionCarga,
} from "../../utils/notificaciones";
import {

  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";
import { leerFilasPorPaginaSistema } from "../../utils/paginacionSistema";

const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_DEVOLUCIONES_PRODUCCION = "cynara_devoluciones_produccion";
const CLAVE_AJUSTES_MATERIA_PRIMA = "cynara_ajustes_materia_prima";
const CLAVE_AJUSTES_AVIOS = "cynara_ajustes_avios";
const CLAVE_DEVOLUCIONES_PROVEEDOR_MP = "cynara_devoluciones_proveedor_mp";
const CLAVE_REPOSICIONES_PROVEEDOR_MP = "cynara_reposiciones_proveedor_mp";
const FILAS_POR_PAGINA = leerFilasPorPaginaSistema();

const ACCESOS_MATERIA_PRIMA = [
  {
    titulo: "Ingreso de materia prima",
    descripcion:
      "Registra compras nuevas de telas y avios con proveedor, documento y cantidades.",
    ruta: "/almacen/ingreso-materia-prima",
  },
  {
    titulo: "Despacho a produccion",
    descripcion:
      "Entrega telas y avios al flujo productivo segun lo pedido desde produccion.",
    ruta: "/almacen/despacho-produccion",
  },
  {
    titulo: "Devoluciones de produccion",
    descripcion:
      "Recibe sobrantes, cambios o retornos desde habilitado y produccion.",
    ruta: "/almacen/devolucion-produccion",
  },
  {
    titulo: "Devolucion a proveedor",
    descripcion:
      "Controla salidas de tela fallada o cambiada sin tratarla como compra nueva.",
    ruta: "/almacen/devolucion-proveedor",
  },
  {
    titulo: "Reposicion de proveedor",
    descripcion:
      "Registra lo que repone el proveedor para devolverlo correctamente al stock.",
    ruta: "/almacen/reposicion-proveedor",
  },
];

const obtenerHistorialIngresos = () => {
  const contenido = localStorage.getItem(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const obtenerHistorialPedidos = () => {
  const contenido = localStorage.getItem(CLAVE_HISTORIAL_PEDIDOS);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const obtenerDevolucionesProduccion = () => {
  const contenido = localStorage.getItem(CLAVE_DEVOLUCIONES_PRODUCCION);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const obtenerAjustesMateriaPrima = () => {
  const contenido = localStorage.getItem(CLAVE_AJUSTES_MATERIA_PRIMA);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const obtenerAjustesAvios = () => {
  const contenido = localStorage.getItem(CLAVE_AJUSTES_AVIOS);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const obtenerDevolucionesProveedor = () => {
  const contenido = localStorage.getItem(CLAVE_DEVOLUCIONES_PROVEEDOR_MP);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const obtenerReposicionesProveedor = () => {
  const contenido = localStorage.getItem(CLAVE_REPOSICIONES_PROVEEDOR_MP);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const obtenerCodigosDespachados = (historialPedidos = []) =>
  new Set(
    historialPedidos.flatMap((pedido) => {
      if (!pedido?.despachoMateriaPrima) {
        return [];
      }

      return (pedido?.filasPedido || [])
        .map((fila) => fila?.codigoUnidad || "")
        .filter(Boolean);
    })
  );

const obtenerCodigosDevueltosAceptados = (devoluciones = []) =>
  new Set(
    devoluciones
      .filter((registro) => registro?.estado === "aceptada")
      .map((registro) => registro?.codigoUnidad || "")
      .filter(Boolean)
  );

const formatearNumero = (valor) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor || 0));

const telasBaseEjemplo = [
  {
    proveedor: "Textiles Andinos",
    tipoDocumento: "Factura",
    tipoTela: "Chaliz",
    colorBase: "Negro",
    acabadoDiseno: "",
    codigoBase: "CHNE",
    partidaBase: "P",
    ancho: 1.5,
    kilos: 20,
    metros: 58,
  },
  {
    proveedor: "Importadora Santa Fe",
    tipoDocumento: "Boleta",
    tipoTela: "French Terry",
    colorBase: "Negro",
    acabadoDiseno: "Lineas doradas",
    codigoBase: "FTNE",
    partidaBase: "FT",
    ancho: 1.6,
    kilos: 20,
    metros: 50,
  },
  {
    proveedor: "Corporacion Textil Sur",
    tipoDocumento: "Factura",
    tipoTela: "Full Licra",
    colorBase: "Azul Marino",
    acabadoDiseno: "",
    codigoBase: "FLAZMA",
    partidaBase: "FL",
    ancho: 1.55,
    kilos: 16,
    metros: 44,
  },
  {
    proveedor: "Textiles Premium",
    tipoDocumento: "Factura",
    tipoTela: "Denim",
    colorBase: "Azul",
    acabadoDiseno: "Animal print",
    codigoBase: "DENAZ",
    partidaBase: "DN",
    ancho: 1.45,
    kilos: 28,
    metros: 33,
  },
  {
    proveedor: "Avance Textil",
    tipoDocumento: "Factura",
    tipoTela: "Perchado",
    colorBase: "Rojo",
    acabadoDiseno: "",
    codigoBase: "PERO",
    partidaBase: "PE",
    ancho: 1.58,
    kilos: 24,
    metros: 52,
  },
  {
    proveedor: "Casa del Tejido",
    tipoDocumento: "Boleta",
    tipoTela: "Perchado",
    colorBase: "Amarillo",
    acabadoDiseno: "",
    codigoBase: "PEAM",
    partidaBase: "PE",
    ancho: 1.58,
    kilos: 18,
    metros: 41,
  },
  {
    proveedor: "Tejidos del Norte",
    tipoDocumento: "Factura",
    tipoTela: "French Terry",
    colorBase: "Blanco",
    acabadoDiseno: "",
    codigoBase: "FTBL",
    partidaBase: "FT",
    ancho: 1.62,
    kilos: 22,
    metros: 54,
  },
  {
    proveedor: "Moda Textil SAC",
    tipoDocumento: "Nota de venta",
    tipoTela: "Piel de durazno",
    colorBase: "Beige",
    acabadoDiseno: "",
    codigoBase: "PDBE",
    partidaBase: "PD",
    ancho: 1.48,
    kilos: 14,
    metros: 39,
  },
  {
    proveedor: "Sur Textiles",
    tipoDocumento: "Factura",
    tipoTela: "Chompero",
    colorBase: "Gris",
    acabadoDiseno: "",
    codigoBase: "CHGR",
    partidaBase: "CH",
    ancho: 1.64,
    kilos: 26,
    metros: 46,
  },
  {
    proveedor: "Representaciones Lima",
    tipoDocumento: "Boleta",
    tipoTela: "Full Licra",
    colorBase: "Azul Militar",
    acabadoDiseno: "",
    codigoBase: "FLAZMI",
    partidaBase: "FL",
    ancho: 1.54,
    kilos: 15,
    metros: 43,
  },
];

const stockTelasEjemplo = Array.from({ length: 30 }, (_, indice) => {
  const base = telasBaseEjemplo[indice % telasBaseEjemplo.length];
  const numero = indice + 1;
  const dia = String(10 - (indice % 10)).padStart(2, "0");
  const correlativo = String(numero).padStart(2, "0");

  return {
    id: `demo-tela-${numero}`,
    codigoIngreso: `CMP${dia}0426-${correlativo}`,
    fechaCompra: `2026-04-${dia}`,
    proveedor: base.proveedor,
    tipoDocumento: base.tipoDocumento,
    numeroDocumento: `${base.tipoDocumento === "Factura" ? "F" : base.tipoDocumento === "Boleta" ? "B" : "NV"}${String(1000 + numero).padStart(4, "0")}-${String(4500 + numero).padStart(4, "0")}`,
    codigoUnidad: `${base.codigoBase}${correlativo}`,
    tipoTela: base.tipoTela,
    colorBase: base.colorBase,
    acabadoDiseno: base.acabadoDiseno,
    partida: `${base.partidaBase}${String(100 + numero).padStart(3, "0")}`,
    ancho: base.ancho,
    kilos: base.kilos + (indice % 4),
    metros: base.metros + (indice % 6),
  };
});

const stockAviosEjemplo = [
  {
    id: "demo-avio-1",
    codigoIngreso: "CMP100426-01",
    fechaCompra: "2026-04-10",
    proveedor: "Avios del Peru",
    tipoDocumento: "Factura",
    numeroDocumento: "F001-9001",
    tipoAvio: "Elastico",
    descripcion: "Elastico pretina",
    colorBase: "Negro",
    acabadoDiseno: "",
    cantidad: 10,
    unidad: "Paquete",
    precioUnitario: 85,
    total: 850,
  },
  {
    id: "demo-avio-2",
    codigoIngreso: "CMP090426-02",
    fechaCompra: "2026-04-09",
    proveedor: "Servicios Textiles",
    tipoDocumento: "Boleta",
    numeroDocumento: "B002-1103",
    tipoAvio: "Etiqueta",
    descripcion: "Etiqueta interna Cynara",
    colorBase: "Blanco",
    acabadoDiseno: "",
    cantidad: 12,
    unidad: "Docena",
    precioUnitario: 24,
    total: 288,
  },
  {
    id: "demo-avio-3",
    codigoIngreso: "CMP070426-04",
    fechaCompra: "2026-04-07",
    proveedor: "Cierres y Mas",
    tipoDocumento: "Nota de venta",
    numeroDocumento: "NV-4450",
    tipoAvio: "Cierre",
    descripcion: "Cierre metalico corto",
    colorBase: "Dorado",
    acabadoDiseno: "",
    cantidad: 40,
    unidad: "Unidad",
    precioUnitario: 2.5,
    total: 100,
  },
];

const construirStockTelas = () => {
  const historialIngresos = obtenerHistorialIngresos();
  const historialPedidos = obtenerHistorialPedidos();
  const devolucionesProduccion = obtenerDevolucionesProduccion();
  const devolucionesProveedor = obtenerDevolucionesProveedor();
  const reposicionesProveedor = obtenerReposicionesProveedor();
  const ajustesMateriaPrima = obtenerAjustesMateriaPrima();
  const codigosDespachados = obtenerCodigosDespachados(historialPedidos);
  const codigosDevueltosAceptados =
    obtenerCodigosDevueltosAceptados(devolucionesProduccion);
  const codigosEnviadosProveedor = new Set(
    devolucionesProveedor
      .filter((registro) => registro?.estado === "enviado")
      .map((registro) => registro?.codigoUnidad || "")
      .filter(Boolean)
  );
  const mapaAjustes = new Map(
    ajustesMateriaPrima.map((ajuste) => [ajuste?.codigoUnidad || ajuste?.id, ajuste])
  );

  if (historialIngresos.length === 0) {
    const stockBaseEjemplo = stockTelasEjemplo.map((fila) => ({
      ...fila,
      kilos: Number(
        mapaAjustes.get(fila.codigoUnidad)?.kilos ??
          (codigosDespachados.has(fila.codigoUnidad) &&
          !codigosDevueltosAceptados.has(fila.codigoUnidad)
            ? 0
            : fila.kilos)
      ),
      metros: Number(
        mapaAjustes.get(fila.codigoUnidad)?.metros ??
          (codigosDespachados.has(fila.codigoUnidad) &&
          !codigosDevueltosAceptados.has(fila.codigoUnidad)
            ? 0
            : fila.metros)
      ),
      motivoAjuste: mapaAjustes.get(fila.codigoUnidad)?.motivoAjuste || "",
      observacionAjuste: mapaAjustes.get(fila.codigoUnidad)?.observacionAjuste || "",
    })).filter((fila) => !codigosEnviadosProveedor.has(fila.codigoUnidad));

    const stockReposiciones = reposicionesProveedor.map((registro, indice) => ({
      id: `${registro?.id || "rep"}-${indice}`,
      codigoIngreso: `REP-${String(indice + 1).padStart(3, "0")}`,
      fechaCompra: registro?.fechaReposicion || "-",
      proveedor: registro?.proveedor || registro?.proveedorOriginal || "-",
      tipoDocumento: "Reposicion",
      numeroDocumento: registro?.idDevolucion || "-",
      codigoUnidad: registro?.codigoUnidad || "-",
      tipoTela: registro?.tipoTela || "-",
      colorBase: registro?.colorBase || "-",
      acabadoDiseno: registro?.acabadoDiseno || "-",
      partida: registro?.partida || "-",
      ancho: Number(registro?.ancho || 0),
      kilos: Number(registro?.kilos || 0),
      metros: Number(registro?.metros || 0),
      motivoAjuste: "Reposicion proveedor",
      observacionAjuste: registro?.observacion || "",
    }));

    return [...stockBaseEjemplo, ...stockReposiciones];
  }

  const stockIngresos = historialIngresos.flatMap((ingreso, indiceIngreso) => {
    const cabeceraCompra = ingreso?.cabeceraCompra || {};
    const filasCompra = ingreso?.filasCompra || [];

    return filasCompra.map((fila, indiceFila) => ({
      id: `${cabeceraCompra.codigoInterno || "ingreso"}-tela-${fila.id || indiceFila}-${indiceIngreso}`,
      codigoIngreso: cabeceraCompra.codigoInterno || "-",
      fechaCompra: cabeceraCompra.fechaCompra || "-",
      proveedor: cabeceraCompra.proveedor || "-",
      tipoDocumento: cabeceraCompra.tipoDocumento || "-",
      numeroDocumento: cabeceraCompra.numeroDocumento || "-",
      codigoUnidad: fila.codigoUnidad || "-",
      tipoTela:
        fila.tipoTela === "Otro" ? fila.tipoTelaManual || "Otro" : fila.tipoTela || "-",
      colorBase: fila.colorBase || "-",
      acabadoDiseno: fila.acabadoDiseno || "-",
      partida: fila.partida || "-",
      ancho: Number(fila.ancho || 0),
      kilos: Number(
        mapaAjustes.get(fila.codigoUnidad)?.kilos ??
          (codigosDespachados.has(fila.codigoUnidad) &&
          !codigosDevueltosAceptados.has(fila.codigoUnidad)
            ? 0
            : Number(fila.kilos || 0))
      ),
      metros: Number(
        mapaAjustes.get(fila.codigoUnidad)?.metros ??
          (codigosDespachados.has(fila.codigoUnidad) &&
          !codigosDevueltosAceptados.has(fila.codigoUnidad)
            ? 0
            : Number(fila.metros || 0))
      ),
      motivoAjuste: mapaAjustes.get(fila.codigoUnidad)?.motivoAjuste || "",
      observacionAjuste: mapaAjustes.get(fila.codigoUnidad)?.observacionAjuste || "",
    }));
  }).filter((fila) => !codigosEnviadosProveedor.has(fila.codigoUnidad));

  const stockReposiciones = reposicionesProveedor.map((registro, indice) => ({
    id: `${registro?.id || "rep"}-${indice}`,
    codigoIngreso: `REP-${String(indice + 1).padStart(3, "0")}`,
    fechaCompra: registro?.fechaReposicion || "-",
    proveedor: registro?.proveedor || registro?.proveedorOriginal || "-",
    tipoDocumento: "Reposicion",
    numeroDocumento: registro?.idDevolucion || "-",
    codigoUnidad: registro?.codigoUnidad || "-",
    tipoTela: registro?.tipoTela || "-",
    colorBase: registro?.colorBase || "-",
    acabadoDiseno: registro?.acabadoDiseno || "-",
    partida: registro?.partida || "-",
    ancho: Number(registro?.ancho || 0),
    kilos: Number(registro?.kilos || 0),
    metros: Number(registro?.metros || 0),
    motivoAjuste: "Reposicion proveedor",
    observacionAjuste: registro?.observacion || "",
  }));

  return [...stockIngresos, ...stockReposiciones];
};

const construirStockAvios = () => {
  const historialIngresos = obtenerHistorialIngresos();
  const ajustesAvios = obtenerAjustesAvios();
  const mapaAjustes = new Map(
    ajustesAvios.map((ajuste) => [ajuste?.idAvio || ajuste?.id, ajuste])
  );

  if (historialIngresos.length === 0) {
    return stockAviosEjemplo.map((avio) => {
      const ajuste = mapaAjustes.get(avio.id);
      const cantidad = Number(ajuste?.cantidad ?? avio.cantidad ?? 0);
      const precioUnitario = Number(avio.precioUnitario || 0);

      return {
        ...avio,
        cantidad,
        precioUnitario,
        total: cantidad * precioUnitario,
        motivoAjuste: ajuste?.motivoAjuste || "",
        observacionAjuste: ajuste?.observacionAjuste || "",
      };
    });
  }

  return historialIngresos.flatMap((ingreso, indiceIngreso) => {
    const cabeceraCompra = ingreso?.cabeceraCompra || {};
    const filasAvios = ingreso?.filasAvios || [];

    return filasAvios.map((avio, indiceAvio) => {
      const idAvio = `${cabeceraCompra.codigoInterno || "ingreso"}-avio-${avio.id || indiceAvio}-${indiceIngreso}`;
      const ajuste = mapaAjustes.get(idAvio);
      const cantidad = Number(ajuste?.cantidad ?? avio.cantidad ?? 0);
      const precioUnitario = Number(avio.precioUnitario || 0);

      return {
        id: idAvio,
        codigoIngreso: cabeceraCompra.codigoInterno || "-",
        fechaCompra: cabeceraCompra.fechaCompra || "-",
        proveedor: cabeceraCompra.proveedor || "-",
        tipoDocumento: cabeceraCompra.tipoDocumento || "-",
        numeroDocumento: cabeceraCompra.numeroDocumento || "-",
        tipoAvio:
          avio.tipoAvio === "Otro" ? avio.tipoAvioManual || "Otro" : avio.tipoAvio || "-",
        descripcion: avio.descripcion || "-",
        colorBase: avio.colorBase || "-",
        acabadoDiseno: avio.acabadoDiseno || "-",
        cantidad,
        unidad: avio.unidad || "-",
        precioUnitario,
        total: cantidad * precioUnitario,
        motivoAjuste: ajuste?.motivoAjuste || "",
        observacionAjuste: ajuste?.observacionAjuste || "",
      };
    });
  });
};

export function MateriaPrima({ vistaInicial = "telas" }) {
  const catalogosProduccion = useMemo(leerCatalogosProduccion, []);
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState(
    vistaInicial === "avios" ? "avios" : "telas"
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipoTela, setFiltroTipoTela] = useState("");
  const [filtroColorTela, setFiltroColorTela] = useState("");
  const [filtroTipoAvio, setFiltroTipoAvio] = useState("");
  const [filtroColorAvio, setFiltroColorAvio] = useState("");
  const [paginaTelas, setPaginaTelas] = useState(1);
  const [paginaAvios, setPaginaAvios] = useState(1);
  const [stockTelas, setStockTelas] = useState(construirStockTelas);
  const [stockAvios, setStockAvios] = useState(construirStockAvios);
  const [ajusteTelaActual, setAjusteTelaActual] = useState(null);
  const [ajusteAvioActual, setAjusteAvioActual] = useState(null);
  const [formularioAjuste, setFormularioAjuste] = useState({
    kilos: "",
    metros: "",
    motivoAjuste: "",
    observacionAjuste: "",
  });
  const [formularioAjusteAvio, setFormularioAjusteAvio] = useState({
    cantidad: "",
    motivoAjuste: "",
    observacionAjuste: "",
  });

  const telasFiltradas = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();
    const tipoTelaSeleccionada = filtroTipoTela.trim().toLowerCase();
    const colorSeleccionado = filtroColorTela.trim().toLowerCase();

    return stockTelas.filter((fila) => {
      const coincideTipo =
        !tipoTelaSeleccionada ||
        (fila.tipoTela || "").toLowerCase() === tipoTelaSeleccionada;
      const coincideColor =
        !colorSeleccionado ||
        (fila.colorBase || "").toLowerCase() === colorSeleccionado;
      const coincideTexto =
        !textoBusqueda ||
        [
          fila.codigoIngreso,
          fila.codigoUnidad,
          fila.tipoTela,
          fila.colorBase,
          fila.acabadoDiseno,
          fila.partida,
          fila.proveedor,
          fila.numeroDocumento,
        ]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);

      return coincideTipo && coincideColor && coincideTexto;
    });
  }, [busqueda, filtroTipoTela, filtroColorTela, stockTelas]);

  const aviosFiltrados = useMemo(() => {
    const textoBusqueda = busqueda.trim().toLowerCase();
    const tipoAvioSeleccionado = filtroTipoAvio.trim().toLowerCase();
    const colorAvioSeleccionado = filtroColorAvio.trim().toLowerCase();

    return stockAvios.filter((avio) => {
      const coincideTipo =
        !tipoAvioSeleccionado ||
        (avio.tipoAvio || "").toLowerCase() === tipoAvioSeleccionado;
      const coincideColor =
        !colorAvioSeleccionado ||
        (avio.colorBase || "").toLowerCase() === colorAvioSeleccionado;
      const coincideTexto =
        !textoBusqueda ||
        [
          avio.codigoIngreso,
          avio.tipoAvio,
          avio.descripcion,
          avio.colorBase,
          avio.acabadoDiseno,
          avio.proveedor,
          avio.numeroDocumento,
          avio.unidad,
        ]
          .join(" ")
          .toLowerCase()
          .includes(textoBusqueda);

      return coincideTipo && coincideColor && coincideTexto;
    });
  }, [busqueda, filtroColorAvio, filtroTipoAvio, stockAvios]);

  const totalPaginasTelas = Math.max(
    1,
    Math.ceil(telasFiltradas.length / FILAS_POR_PAGINA)
  );
  const totalPaginasAvios = Math.max(
    1,
    Math.ceil(aviosFiltrados.length / FILAS_POR_PAGINA)
  );

  const telasPaginadas = useMemo(() => {
    const inicio = (paginaTelas - 1) * FILAS_POR_PAGINA;
    return telasFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [paginaTelas, telasFiltradas]);

  const aviosPaginados = useMemo(() => {
    const inicio = (paginaAvios - 1) * FILAS_POR_PAGINA;
    return aviosFiltrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [paginaAvios, aviosFiltrados]);

  const totalKilos = telasFiltradas.reduce((total, fila) => total + fila.kilos, 0);
  const totalMetros = telasFiltradas.reduce((total, fila) => total + fila.metros, 0);
  const totalAvios = aviosFiltrados.reduce((total, avio) => total + avio.total, 0);
  const totalCantidadAvios = aviosFiltrados.reduce(
    (total, avio) => total + Number(avio.cantidad || 0),
    0
  );

  const abrirAjusteTela = (fila) => {
    setAjusteTelaActual(fila);
    setFormularioAjuste({
      kilos: String(fila?.kilos ?? ""),
      metros: String(fila?.metros ?? ""),
      motivoAjuste: fila?.motivoAjuste || "",
      observacionAjuste: fila?.observacionAjuste || "",
    });
  };

  const manejarCambioAjuste = (evento) => {
    const { name, value } = evento.target;
    setFormularioAjuste((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const guardarAjusteTela = async () => {
    if (!ajusteTelaActual?.codigoUnidad) {
      await mostrarAlertaSistema("Selecciona primero una tela para ajustar.");
      return;
    }

    if (!formularioAjuste.motivoAjuste.trim()) {
      await mostrarAlertaSistema("Selecciona un motivo de ajuste.");
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando ajuste de materia prima...",
      mensajeExito: "Ajuste de materia prima guardado.",
      mensajeError: "No se pudo guardar el ajuste de materia prima.",
      accion: async () => {
        const kilos = Number(formularioAjuste.kilos || 0);
        const metros = Number(formularioAjuste.metros || 0);

        const ajustesActuales = obtenerAjustesMateriaPrima();
        const nuevoAjuste = {
          id: ajusteTelaActual.id,
          codigoUnidad: ajusteTelaActual.codigoUnidad,
          kilos,
          metros,
          motivoAjuste: formularioAjuste.motivoAjuste,
          observacionAjuste: formularioAjuste.observacionAjuste,
          fechaAjuste: new Date().toISOString(),
        };

        const ajustesActualizados = [
          nuevoAjuste,
          ...ajustesActuales.filter(
            (item) => item?.codigoUnidad !== ajusteTelaActual.codigoUnidad
          ),
        ];

        localStorage.setItem(
          CLAVE_AJUSTES_MATERIA_PRIMA,
          JSON.stringify(ajustesActualizados)
        );

        setStockTelas((anterior) =>
          anterior.map((fila) =>
            fila.codigoUnidad === ajusteTelaActual.codigoUnidad
              ? {
                  ...fila,
                  kilos,
                  metros,
                  motivoAjuste: formularioAjuste.motivoAjuste,
                  observacionAjuste: formularioAjuste.observacionAjuste,
                }
              : fila
          )
        );

        setAjusteTelaActual(null);
        setFormularioAjuste({
          kilos: "",
          metros: "",
          motivoAjuste: "",
          observacionAjuste: "",
        });
      },
    });
  };

  const abrirAjusteAvio = (avio) => {
    setAjusteAvioActual(avio);
    setFormularioAjusteAvio({
      cantidad: String(avio?.cantidad ?? ""),
      motivoAjuste: avio?.motivoAjuste || "",
      observacionAjuste: avio?.observacionAjuste || "",
    });
  };

  const manejarCambioAjusteAvio = (evento) => {
    const { name, value } = evento.target;
    setFormularioAjusteAvio((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const guardarAjusteAvio = async () => {
    if (!ajusteAvioActual?.id) {
      await mostrarAlertaSistema("Selecciona primero un avio para ajustar.");
      return;
    }

    if (!formularioAjusteAvio.motivoAjuste.trim()) {
      await mostrarAlertaSistema("Selecciona un motivo de ajuste.");
      return;
    }

    await ejecutarAccionConFeedbackSistema({
      mensajeProceso: "Guardando ajuste de avios...",
      mensajeExito: "Ajuste de avios guardado.",
      mensajeError: "No se pudo guardar el ajuste de avios.",
      accion: async () => {
        const cantidad = Number(formularioAjusteAvio.cantidad || 0);
        const ajustesActuales = obtenerAjustesAvios();
        const nuevoAjuste = {
          id: ajusteAvioActual.id,
          idAvio: ajusteAvioActual.id,
          cantidad,
          motivoAjuste: formularioAjusteAvio.motivoAjuste,
          observacionAjuste: formularioAjusteAvio.observacionAjuste,
          fechaAjuste: new Date().toISOString(),
        };

        const ajustesActualizados = [
          nuevoAjuste,
          ...ajustesActuales.filter((item) => item?.idAvio !== ajusteAvioActual.id),
        ];

        localStorage.setItem(CLAVE_AJUSTES_AVIOS, JSON.stringify(ajustesActualizados));

        setStockAvios((anterior) =>
          anterior.map((avio) =>
            avio.id === ajusteAvioActual.id
              ? {
                  ...avio,
                  cantidad,
                  total: cantidad * Number(avio.precioUnitario || 0),
                  motivoAjuste: formularioAjusteAvio.motivoAjuste,
                  observacionAjuste: formularioAjusteAvio.observacionAjuste,
                }
              : avio
          )
        );

        setAjusteAvioActual(null);
        setFormularioAjusteAvio({
          cantidad: "",
          motivoAjuste: "",
          observacionAjuste: "",
        });
      },
    });
  };

  const esVistaAvios = vistaInicial === "avios";
  const tituloPantalla = esVistaAvios ? "Stock de avios" : "Stock de telas";
  const descripcionPantalla = esVistaAvios
    ? "Aqui revisas el stock general de avios con buscador, filtros y ajuste de cantidades."
    : "Aqui revisas el stock general de telas, sus filtros y ajustes fisicos del almacen.";

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
          <h1>Stock de telas y avÃ­os</h1>
          <p>
            Aqui puedes revisar el stock general del almacen. Cambia de pestaÃ±a
            para ver telas o avÃ­os y usa el buscador para encontrar registros rapido.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Filas visibles</span>
          <strong>{pestanaActiva === "telas" ? telasFiltradas.length : aviosFiltrados.length}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/almacen/materia-prima" className="boton_volver">
          Volver a Almacen
        </Link>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaActiva === "telas" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("telas");
                setPaginaTelas(1);
              }}
            >
              Telas
            </button>
            <button
              type="button"
              className={`pestana ${pestanaActiva === "avios" ? "pestana_activa" : ""}`}
              onClick={() => {
                setPestanaActiva("avios");
                setPaginaAvios(1);
              }}
            >
              AvÃ­os
            </button>
          </div>

        </section>

        <section className="tarjeta accesos_relacionados">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Flujos relacionados</h2>
              <p>
                Aqui dejamos a la mano los pasos que completan el trabajo de
                materia prima para que no tengas que volver a la portada de
                Almacen a cada rato.
              </p>
            </div>
          </div>

          <div className="accesos_relacionados__grid">
            {ACCESOS_MATERIA_PRIMA.map((item) => (
              <article key={item.ruta} className="acceso_relacionado">
                <span>{item.titulo}</span>
                <strong>{item.descripcion}</strong>
                <Link to={item.ruta} className="btn_ajuste">
                  Abrir modulo
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta__encabezado">
            <div>
              <h2>Buscador de stock</h2>
              <p>
                El buscador cambia segun la pestaÃ±a para que encuentres mas rapido
                telas o avÃ­os.
              </p>
            </div>
          </div>

          <div className="buscador">
            <input
              type="text"
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPaginaTelas(1);
                setPaginaAvios(1);
              }}
              placeholder={
                pestanaActiva === "telas"
                  ? "Buscar por codigo, tela, color base, acabado, partida o proveedor"
                  : "Buscar por codigo, tipo de avÃ­o, descripcion, color o proveedor"
              }
            />
            {pestanaActiva === "telas" ? (
              <>
                <input
                  type="text"
                  list="filtro-stock-tipo-tela"
                  value={filtroTipoTela}
                  onChange={(evento) => {
                    setFiltroTipoTela(evento.target.value);
                    setPaginaTelas(1);
                  }}
                  placeholder="Filtrar por tipo de tela"
                />
                <datalist id="filtro-stock-tipo-tela">
                  {catalogosProduccion.tiposTela.map((tipoTela) => (
                    <option key={tipoTela} value={tipoTela} />
                  ))}
                </datalist>

                <input
                  type="text"
                  list="filtro-stock-color-tela"
                  value={filtroColorTela}
                  onChange={(evento) => {
                    setFiltroColorTela(evento.target.value);
                    setPaginaTelas(1);
                  }}
                  placeholder="Filtrar por color base"
                />
                <datalist id="filtro-stock-color-tela">
                  {catalogosProduccion.colores.map((color) => (
                    <option key={color} value={color} />
                  ))}
                </datalist>
              </>
            ) : null}
          </div>

          {aviosFiltrados.length > FILAS_POR_PAGINA ? (
            <div className="paginacion">
              <button
                type="button"
                className="pestana"
                onClick={() => setPaginaAvios((anterior) => Math.max(1, anterior - 1))}
                disabled={paginaAvios === 1}
              >
                Anterior
              </button>

              <span>
                Pagina {paginaAvios} de {totalPaginasAvios}
              </span>

              <button
                type="button"
                className="pestana"
                onClick={() =>
                  setPaginaAvios((anterior) => Math.min(totalPaginasAvios, anterior + 1))
                }
                disabled={paginaAvios === totalPaginasAvios}
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </section>

        {pestanaActiva === "telas" ? (
          <section className="tarjeta">
            <h2>Stock general de telas</h2>

            {ajusteTelaActual ? (
              <div className="panel_ajuste">
                <strong>Ajustar: {ajusteTelaActual.codigoUnidad}</strong>
                <div className="panel_ajuste__grid">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    name="kilos"
                    value={formularioAjuste.kilos}
                    onChange={manejarCambioAjuste}
                    placeholder="Kilos"
                  />
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    name="metros"
                    value={formularioAjuste.metros}
                    onChange={manejarCambioAjuste}
                    placeholder="Metros"
                  />
                  <select
                    name="motivoAjuste"
                    value={formularioAjuste.motivoAjuste}
                    onChange={manejarCambioAjuste}
                  >
                    <option value="">Motivo ajuste</option>
                    {(catalogosProduccion.motivosAjuste || []).map((motivo) => (
                      <option key={motivo} value={motivo}>
                        {motivo}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="observacionAjuste"
                    value={formularioAjuste.observacionAjuste}
                    onChange={manejarCambioAjuste}
                    placeholder="Observacion"
                  />
                </div>
                <div className="panel_ajuste__acciones">
                  <button
                    type="button"
                    className="pestana"
                    onClick={() => setAjusteTelaActual(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn_ajuste"
                    onClick={guardarAjusteTela}
                  >
                    Guardar ajuste
                  </button>
                </div>
              </div>
            ) : null}

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo ingreso</th>
                    <th>Codigo unidad</th>
                    <th>Fecha compra</th>
                    <th>Proveedor</th>
                    <th>Tipo tela</th>
                    <th>Color base</th>
                    <th>Acabado / diseÃ±o</th>
                    <th>Partida</th>
                    <th>Ancho</th>
                    <th>Kilos</th>
                    <th>Metros</th>
                    <th>Ajuste</th>
                  </tr>
                </thead>

                <tbody>
                  {telasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="fila_vacia">
                        TodavÃ­a no hay stock de telas para mostrar con ese filtro.
                      </td>
                    </tr>
                  ) : (
                    telasPaginadas.map((fila) => (
                      <tr key={fila.id}>
                        <td>{fila.codigoIngreso}</td>
                        <td>{fila.codigoUnidad}</td>
                        <td>{fila.fechaCompra}</td>
                        <td>{fila.proveedor}</td>
                        <td>{fila.tipoTela}</td>
                        <td>{fila.colorBase}</td>
                        <td>{fila.acabadoDiseno}</td>
                        <td>{fila.partida}</td>
                        <td>{fila.ancho ? formatearNumero(fila.ancho) : "-"}</td>
                        <td>{fila.kilos ? formatearNumero(fila.kilos) : "-"}</td>
                        <td>{fila.metros ? formatearNumero(fila.metros) : "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn_ajuste btn_ajuste_tabla"
                            onClick={() => abrirAjusteTela(fila)}
                          >
                            Ajustar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {telasFiltradas.length > FILAS_POR_PAGINA ? (
              <div className="paginacion">
                <button
                  type="button"
                  className="pestana"
                  onClick={() => setPaginaTelas((anterior) => Math.max(1, anterior - 1))}
                  disabled={paginaTelas === 1}
                >
                  Anterior
                </button>

                <span>
                  Pagina {paginaTelas} de {totalPaginasTelas}
                </span>

                <button
                  type="button"
                  className="pestana"
                  onClick={() =>
                    setPaginaTelas((anterior) => Math.min(totalPaginasTelas, anterior + 1))
                  }
                  disabled={paginaTelas === totalPaginasTelas}
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="tarjeta">
            <h2>Stock general de avÃ­os</h2>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo ingreso</th>
                    <th>Fecha compra</th>
                    <th>Proveedor</th>
                    <th>Tipo avÃ­o</th>
                    <th>Descripcion</th>
                    <th>Color base</th>
                    <th>Acabado / diseÃ±o</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {aviosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="fila_vacia">
                        TodavÃ­a no hay stock de avÃ­os para mostrar con ese filtro.
                      </td>
                    </tr>
                  ) : (
                    aviosPaginados.map((avio) => (
                      <tr key={avio.id}>
                        <td>{avio.codigoIngreso}</td>
                        <td>{avio.fechaCompra}</td>
                        <td>{avio.proveedor}</td>
                        <td>{avio.tipoAvio}</td>
                        <td>{avio.descripcion}</td>
                        <td>{avio.colorBase}</td>
                        <td>{avio.acabadoDiseno}</td>
                        <td>{formatearNumero(avio.cantidad)}</td>
                        <td>{avio.unidad}</td>
                        <td>{formatearNumero(avio.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Filas visibles</span>
              <strong>{pestanaActiva === "telas" ? telasFiltradas.length : aviosFiltrados.length}</strong>
            </div>

            <div>
              <span>{pestanaActiva === "telas" ? "Total kilos" : "Total avÃ­os"}</span>
              <strong>
                {pestanaActiva === "telas"
                  ? formatearNumero(totalKilos)
                  : formatearNumero(totalAvios)}
              </strong>
            </div>

            <div>
              <span>{pestanaActiva === "telas" ? "Total metros" : "Registros avÃ­os"}</span>
              <strong>
                {pestanaActiva === "telas"
                  ? formatearNumero(totalMetros)
                  : aviosFiltrados.length}
              </strong>
            </div>

            <div>
              <span>{pestanaActiva === "telas" ? "Registros telas" : "Registros totales"}</span>
              <strong>{pestanaActiva === "telas" ? stockTelas.length : stockAvios.length}</strong>
            </div>
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

  .cabecera {
    display: grid;
    gap: 14px;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .resumen span {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .cabecera__estado {
    width: fit-content;
    padding: 14px 18px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bgtotal};
  }

  .cabecera__estado span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .cabecera__estado strong {
    font-size: 26px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior {
    display: flex;
    justify-content: flex-start;
  }

  .boton_volver {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 10px;
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
    text-decoration: none;
    font-weight: 600;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .pestanas {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px;
    border-radius: 16px;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#f6f1fa" : "rgba(255,255,255,0.04)"};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .pestana {
    border: 1px solid transparent;
    background-color: transparent;
    color: ${({ theme }) => theme.colorSubtitle};
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .pestana:hover {
    color: ${({ theme }) => theme.text};
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.18)" : "rgba(255,255,255,0.08)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.03)"};
  }

  .pestana_activa {
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 8px 18px rgba(117, 1, 152, 0.22);
    transform: translateY(-1px);
  }

  .tarjeta__encabezado {
    margin-bottom: 18px;
  }

  .panel_ajuste {
    display: grid;
    gap: 12px;
    margin: 14px 0 18px;
    padding: 14px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bgtotal};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .panel_ajuste strong {
    font-size: 14px;
  }

  .panel_ajuste__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .panel_ajuste__grid input,
  .panel_ajuste__grid select {
    width: 100%;
    border: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .panel_ajuste__acciones {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
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
    background: ${({ theme }) => theme.bgtotal};
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

  .acceso_relacionado .btn_ajuste {
    width: fit-content;
  }

  .btn_ajuste {
    border: none;
    border-radius: 10px;
    padding: 10px 14px;
    font-weight: 700;
    cursor: pointer;
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .btn_ajuste_tabla {
    width: 100%;
    padding: 9px 12px;
  }

  .buscador {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) repeat(2, minmax(180px, 220px));
    gap: 12px;
  }

  .buscador input,
  .buscador select {
    width: 100%;
    border: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
  }

  .buscador select {
    background-color: #f3f4f6;
    color: #111827;
  }

  .buscador input:focus,
  .buscador select:focus {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(117, 1, 152, 0.14)"
          : "rgba(117, 1, 152, 0.2)"};
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  .paginacion {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    flex-wrap: wrap;
  }

  .paginacion span {
    font-size: 14px;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1120px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d6dee8" : theme.bg4)};
    text-align: left;
    vertical-align: top;
  }

  th {
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#f7f9fc" : "transparent"};
  }

  .fila_vacia {
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    padding: 20px;
  }

  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .resumen__grid span {
    display: block;
    font-size: 13px;
    margin-bottom: 6px;
  }

  .resumen__grid strong {
    font-size: 18px;
  }

  @media (max-width: 860px) {
    .buscador {
      grid-template-columns: 1fr;
    }

    .panel_ajuste__grid {
      grid-template-columns: 1fr;
    }

    .panel_ajuste__acciones {
      justify-content: stretch;
    }

    .btn_ajuste,
    .pestana {
      width: 100%;
    }

    .resumen__grid {
      grid-template-columns: 1fr;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;




