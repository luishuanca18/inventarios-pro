import {
  construirNombreModelo,
  leerCatalogosProduccion,
} from "./catalogosProduccion";

export const CLAVE_FICHAS_ELASTICOS_MODELO = "cynara_fichas_elasticos_modelo";
export const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
export const LARGO_ROLLO_ELASTICO_METROS = 50;

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const normalizarFichaElastico = (item = {}) => ({
  id: item?.id || "",
  claveFicha: item?.claveFicha || "",
  categoria: normalizarTexto(item?.categoria),
  modelo: normalizarTexto(item?.modelo),
  telaModelo: normalizarTexto(item?.telaModelo),
  nombreModelo: normalizarTexto(item?.nombreModelo),
  anchoElasticoCm: Number(item?.anchoElasticoCm || 0),
  costoMetro: Number(item?.costoMetro || 0),
  largosPorTalla: item?.largosPorTalla || {},
  observacion: item?.observacion || "",
  fechaActualizacion: item?.fechaActualizacion || "",
});

export const leerFichasElasticosModelo = () => {
  const contenido = localStorage.getItem(CLAVE_FICHAS_ELASTICOS_MODELO);

  if (!contenido) {
    return [];
  }

  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista.map(normalizarFichaElastico) : [];
  } catch {
    return [];
  }
};

export const guardarFichasElasticosModelo = (lista = []) => {
  const normalizada = (lista || []).map(normalizarFichaElastico);
  localStorage.setItem(CLAVE_FICHAS_ELASTICOS_MODELO, JSON.stringify(normalizada));
  return normalizada;
};

export const construirClaveFichaElastico = ({
  categoria = "",
  modelo = "",
  telaModelo = "",
}) =>
  [categoria, modelo, telaModelo]
    .map(normalizarTexto)
    .filter(Boolean)
    .join("__");

export const construirNombreFichaElastico = ({
  categoria = "",
  modelo = "",
  telaModelo = "",
}) =>
  construirNombreModelo({
    categoria: normalizarTexto(categoria),
    modelo: normalizarTexto(modelo),
    telaModelo: normalizarTexto(telaModelo),
  });

export const obtenerTallasFichaElastico = () => {
  const catalogos = leerCatalogosProduccion();
  return (catalogos?.tallas || []).length
    ? catalogos.tallas
    : ["S", "M", "L", "XL", "XXL"];
};

export const calcularCostoPrendaDesdeLargo = ({
  largoCm = 0,
  costoMetro = 0,
}) => {
  const largo = Number(largoCm);
  const costo = Number(costoMetro);

  if (!Number.isFinite(largo) || !Number.isFinite(costo) || largo <= 0 || costo <= 0) {
    return 0;
  }

  return (largo / 100) * costo;
};

export const obtenerReferenciaElasticoPorAncho = (anchoElasticoCm = 0) => {
  const anchoBuscado = Number(anchoElasticoCm || 0);

  if (!Number.isFinite(anchoBuscado) || anchoBuscado <= 0) {
    return {
      costoMetro: 0,
      metrosRollo: LARGO_ROLLO_ELASTICO_METROS,
      precioUnitario: 0,
      unidad: "",
      fechaCompra: "",
    };
  }

  const contenido = localStorage.getItem(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);
  let historial = [];

  if (contenido) {
    try {
      const data = JSON.parse(contenido);
      historial = Array.isArray(data) ? data : [];
    } catch {
      historial = [];
    }
  }

  const ingresosElastico = historial.flatMap((ingreso, indiceIngreso) => {
    const cabeceraCompra = ingreso?.cabeceraCompra || {};
    const fechaCompra = cabeceraCompra?.fechaCompra || "";
    const filasAvios = ingreso?.filasAvios || [];

    return filasAvios
      .map((avio, indiceAvio) => ({
        id: `${cabeceraCompra.codigoInterno || "ingreso"}-${avio.id || indiceAvio}-${indiceIngreso}`,
        fechaCompra,
        tipoAvio:
          avio?.tipoAvio === "Otro"
            ? avio?.tipoAvioManual || "Otro"
            : avio?.tipoAvio || "",
        anchoAvioCm: Number(avio?.anchoAvioCm || 0),
        metrosRollo: Number(avio?.metrosRollo || LARGO_ROLLO_ELASTICO_METROS),
        cantidad: Number(avio?.cantidad || 0),
        unidad: normalizarTexto(avio?.unidad || ""),
        precioUnitario: Number(avio?.precioUnitario || 0),
      }))
      .filter(
        (avio) =>
          normalizarTexto(avio.tipoAvio) === "ELASTICO" &&
          Number(avio.anchoAvioCm) === anchoBuscado &&
          Number(avio.precioUnitario) > 0,
      );
  });

  if (ingresosElastico.length === 0) {
    return {
      costoMetro: 0,
      metrosRollo: LARGO_ROLLO_ELASTICO_METROS,
      precioUnitario: 0,
      unidad: "",
      fechaCompra: "",
    };
  }

  const ultimoIngreso = ingresosElastico.sort((a, b) =>
    (b.fechaCompra || "").localeCompare(a.fechaCompra || ""),
  )[0];
  const metrosRollo = Number(
    ultimoIngreso.metrosRollo || LARGO_ROLLO_ELASTICO_METROS,
  );

  let costoMetro = 0;

  if (ultimoIngreso.unidad === "ROLLO" && metrosRollo > 0) {
    costoMetro = ultimoIngreso.precioUnitario / metrosRollo;
  } else if (ultimoIngreso.unidad === "METROS") {
    costoMetro = ultimoIngreso.precioUnitario;
  } else if (ultimoIngreso.cantidad > 0) {
    costoMetro = ultimoIngreso.precioUnitario / metrosRollo;
  }

  return {
    costoMetro,
    metrosRollo,
    precioUnitario: Number(ultimoIngreso.precioUnitario || 0),
    unidad: ultimoIngreso.unidad || "",
    fechaCompra: ultimoIngreso.fechaCompra || "",
  };
};

export const obtenerCostoMetroElasticoPorAncho = (anchoElasticoCm = 0) =>
  obtenerReferenciaElasticoPorAncho(anchoElasticoCm).costoMetro;
