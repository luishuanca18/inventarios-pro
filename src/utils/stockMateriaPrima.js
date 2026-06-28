const CLAVE_DEVOLUCIONES_PRODUCCION = "cynara_devoluciones_produccion";
const CLAVE_HISTORIAL_PEDIDOS = "cynara_historial_pedidos";
const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";

const stockTelasEjemplo = [
  {
    id: "demo-1",
    codigoUnidad: "FTNE01",
    tipoTela: "FRENCH TERRY",
    colorBase: "NEGRO",
    acabadoDiseno: "LINEAS DORADAS",
    partida: "FT101",
    ancho: 1.6,
    kilos: 20,
  },
  {
    id: "demo-2",
    codigoUnidad: "FTBL02",
    tipoTela: "FRENCH TERRY",
    colorBase: "BLANCO",
    acabadoDiseno: "",
    partida: "FT102",
    ancho: 1.62,
    kilos: 18,
  },
  {
    id: "demo-3",
    codigoUnidad: "FLAZ03",
    tipoTela: "FULL LICRA",
    colorBase: "AZUL MARINO",
    acabadoDiseno: "",
    partida: "FL103",
    ancho: 1.55,
    kilos: 16,
  },
  {
    id: "demo-4",
    codigoUnidad: "CHNE04",
    tipoTela: "CHALIZ",
    colorBase: "NEGRO",
    acabadoDiseno: "",
    partida: "CH104",
    ancho: 1.5,
    kilos: 14,
  },
];

const leerListaGuardada = (clave) => {
  const contenido = localStorage.getItem(clave);

  if (!contenido) {
    return [];
  }

  try {
    const lista = JSON.parse(contenido);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
};

export const normalizarTextoStock = (valor = "") =>
  valor
    .toString()
    .trim()
    .toUpperCase();

export const obtenerStockMateriaPrimaDisponible = () => {
  const ingresos = leerListaGuardada(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);
  const pedidos = leerListaGuardada(CLAVE_HISTORIAL_PEDIDOS);
  const devoluciones = leerListaGuardada(CLAVE_DEVOLUCIONES_PRODUCCION);
  const devolucionesAceptadasPorCodigo = new Map(
    devoluciones
      .filter((registro) => registro?.estado === "aceptada" && registro?.codigoUnidad)
      .map((registro) => [registro.codigoUnidad, registro])
  );

  const codigosDespachados = new Set(
    pedidos.flatMap((pedido) => {
      if (!pedido?.despachoMateriaPrima) {
        return [];
      }

      return (pedido?.filasPedido || [])
        .map((fila) => fila?.codigoUnidad || "")
        .filter(Boolean);
    })
  );

  const codigosDevueltos = new Set(
    devoluciones
      .filter((registro) => registro?.estado === "aceptada")
      .map((registro) => registro?.codigoUnidad || "")
      .filter(Boolean)
  );

  const stockBase =
    ingresos.length === 0
      ? stockTelasEjemplo
      : ingresos.flatMap((ingreso, indiceIngreso) => {
          const cabeceraCompra = ingreso?.cabeceraCompra || {};
          const filasCompra = ingreso?.filasCompra || [];

          return filasCompra.map((fila, indiceFila) => ({
            id: `${cabeceraCompra.codigoInterno || "ingreso"}-${
              fila.id || indiceFila
            }-${indiceIngreso}`,
            codigoUnidad: fila.codigoUnidad || "",
            tipoTela:
              fila.tipoTela === "Otro"
                ? fila.tipoTelaManual || "Otro"
                : fila.tipoTela || "",
            colorBase: fila.colorBase || "",
            acabadoDiseno: fila.acabadoDiseno || "",
            partida: fila.partida || "",
            ancho: Number(fila.ancho || 0),
            kilos: Number(
              devolucionesAceptadasPorCodigo.get(fila.codigoUnidad || "")?.pesoDevuelto ||
                devolucionesAceptadasPorCodigo.get(fila.codigoUnidad || "")?.pesoTela ||
                fila.kilos ||
                0
            ),
            origenStock: devolucionesAceptadasPorCodigo.has(fila.codigoUnidad || "")
              ? "SOBRANTE"
              : "ROLLO",
          }));
        });

  return stockBase.filter((fila) => {
    const estaDespachada = codigosDespachados.has(fila.codigoUnidad);
    const fueDevuelta = codigosDevueltos.has(fila.codigoUnidad);
    return !estaDespachada || fueDevuelta;
  });
};

export const obtenerColoresDisponiblesPorTipoTela = (tipoTela = "") => {
  const tipoTelaNormalizado = normalizarTextoStock(tipoTela);
  if (!tipoTelaNormalizado) {
    return [];
  }

  return Array.from(
    new Set(
      obtenerStockMateriaPrimaDisponible()
        .filter(
          (fila) =>
            normalizarTextoStock(fila?.tipoTela) === tipoTelaNormalizado &&
            Number(fila?.kilos || 0) > 0
        )
        .map((fila) => normalizarTextoStock(fila?.colorBase))
        .filter(Boolean)
    )
  ).sort((colorA, colorB) => colorA.localeCompare(colorB));
};
