import { leerFichasTalleres } from "./fichasTalleres";
import { leerListaPreciosProductos, normalizarTextoPrecio } from "./preciosProductos";
import { leerProductosTerminados } from "./productosTerminados";
import {
  normalizarTextoStock,
  obtenerStockMateriaPrimaDisponible,
} from "./stockMateriaPrima";

const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_HISTORIAL_OP = "cynara_historial_op";
const CLAVE_SALIDAS_TALLER = "cynara_salidas_taller";
const CLAVE_RECEPCIONES_TALLER = "cynara_recepciones_taller";

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

const normalizarTextoAsistente = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const INTENCIONES_ASISTENTE_BASE = [
  {
    codigo: "CONSULTAR_STOCK_PRODUCTO",
    titulo: "Consultar stock de producto terminado",
    ejemplos: [
      "muestra stock de leggins clasico french",
      "cuanto hay de leggins clasico french",
      "stock del chavo clasico french",
    ],
  },
  {
    codigo: "CONSULTAR_STOCK_TELA",
    titulo: "Consultar stock de materia prima",
    ejemplos: [
      "muestra stock de french terry negro",
      "cuantos rollos de french terry hay",
      "que sobrantes hay de chaliz",
    ],
  },
  {
    codigo: "CONSULTAR_PEDIDOS_PENDIENTES",
    titulo: "Consultar pedidos pendientes",
    ejemplos: [
      "que pedidos estan pendientes",
      "muestra pedidos por hacer",
    ],
  },
  {
    codigo: "CONSULTAR_TALLERES",
    titulo: "Consultar talleres",
    ejemplos: [
      "muestra talleres activos",
      "que talleres tengo registrados",
    ],
  },
  {
    codigo: "CONSULTAR_PRECIOS_MODELO",
    titulo: "Consultar precios por modelo",
    ejemplos: [
      "precio de leggins clasico french",
      "cuanto se vende el leggins clasico french",
    ],
  },
];

export const detectarIntencionAsistente = (texto = "") => {
  const consulta = normalizarTextoAsistente(texto);

  if (!consulta) {
    return { codigo: "SIN_INTENCION", confianza: 0 };
  }

  if (
    (consulta.includes("STOCK") || consulta.includes("CUANTO HAY")) &&
    !consulta.includes("TELA") &&
    !consulta.includes("ROLLO")
  ) {
    return { codigo: "CONSULTAR_STOCK_PRODUCTO", confianza: 0.8 };
  }

  if (
    consulta.includes("TELA") ||
    consulta.includes("ROLLO") ||
    consulta.includes("SOBRANTE")
  ) {
    return { codigo: "CONSULTAR_STOCK_TELA", confianza: 0.8 };
  }

  if (consulta.includes("PEDIDO") && (consulta.includes("PENDIENTE") || consulta.includes("POR HACER"))) {
    return { codigo: "CONSULTAR_PEDIDOS_PENDIENTES", confianza: 0.75 };
  }

  if (consulta.includes("TALLER")) {
    return { codigo: "CONSULTAR_TALLERES", confianza: 0.7 };
  }

  if (consulta.includes("PRECIO") || consulta.includes("VENDE")) {
    return { codigo: "CONSULTAR_PRECIOS_MODELO", confianza: 0.7 };
  }

  return { codigo: "SIN_INTENCION", confianza: 0.2 };
};

export const obtenerContextoLecturaAsistente = () => ({
  pedidos: leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS),
  ops: leerListaGuardada(CLAVE_HISTORIAL_OP),
  salidasTaller: leerListaGuardada(CLAVE_SALIDAS_TALLER),
  recepcionesTaller: leerListaGuardada(CLAVE_RECEPCIONES_TALLER),
  stockProductos: leerProductosTerminados(),
  stockTelas: obtenerStockMateriaPrimaDisponible(),
  talleres: leerFichasTalleres(),
  precios: leerListaPreciosProductos(),
});

export const consultarStockProductoPorModelo = (modelo = "", lista = leerProductosTerminados()) => {
  const modeloNormalizado = normalizarTextoAsistente(modelo);
  const registros = (Array.isArray(lista) ? lista : []).filter(
    (item) => normalizarTextoAsistente(item?.modelo) === modeloNormalizado
  );

  const resumenPorColor = registros.reduce((acumulado, item) => {
    const color = normalizarTextoAsistente(item?.colorBase || "SIN COLOR");
    return {
      ...acumulado,
      [color]: Number(acumulado[color] || 0) + Number(item?.stockActual || 0),
    };
  }, {});

  return {
    modelo: modeloNormalizado,
    total: registros.reduce((total, item) => total + Number(item?.stockActual || 0), 0),
    registros,
    resumenPorColor,
  };
};

export const consultarStockTela = ({
  tipoTela = "",
  color = "",
  lista = obtenerStockMateriaPrimaDisponible(),
} = {}) => {
  const tipoTelaNormalizado = normalizarTextoStock(tipoTela);
  const colorNormalizado = normalizarTextoStock(color);

  const registros = (Array.isArray(lista) ? lista : []).filter((item) => {
    const coincideTela = !tipoTelaNormalizado || normalizarTextoStock(item?.tipoTela) === tipoTelaNormalizado;
    const coincideColor = !colorNormalizado || normalizarTextoStock(item?.colorBase) === colorNormalizado;
    return coincideTela && coincideColor;
  });

  const resumenPorColor = registros.reduce((acumulado, item) => {
    const claveColor = normalizarTextoStock(item?.colorBase || "SIN COLOR");
    const actual = acumulado[claveColor] || { rollos: 0, sobrantes: [] };
    const esSobrante = normalizarTextoStock(item?.origenStock) === "SOBRANTE";

    return {
      ...acumulado,
      [claveColor]: {
        rollos: esSobrante ? actual.rollos : actual.rollos + 1,
        sobrantes: esSobrante
          ? [...actual.sobrantes, Number(item?.kilos || 0)]
          : actual.sobrantes,
      },
    };
  }, {});

  return {
    tipoTela: tipoTelaNormalizado,
    color: colorNormalizado,
    totalRegistros: registros.length,
    registros,
    resumenPorColor,
  };
};

export const consultarPedidosPendientes = (lista = leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS)) =>
  (Array.isArray(lista) ? lista : []).filter(
    (pedido) => !pedido?.cancelado && !pedido?.eliminado
  );

export const consultarTalleresActivos = (lista = leerFichasTalleres()) =>
  (Array.isArray(lista) ? lista : []).filter((item) => item?.estado === "ACTIVO");

export const consultarPrecioModelo = (modelo = "", lista = leerListaPreciosProductos()) => {
  const modeloNormalizado = normalizarTextoPrecio(modelo);
  return (
    (Array.isArray(lista) ? lista : []).find(
      (item) => normalizarTextoPrecio(item?.modelo) === modeloNormalizado
    ) || null
  );
};

export const crearCatalogoAsistenteSistema = () => ({
  intenciones: INTENCIONES_ASISTENTE_BASE,
  descripcion:
    "Base de lectura segura para un futuro asistente interno. Solo consulta y resume datos; no modifica informacion.",
});
