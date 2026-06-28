export const CLAVE_STOCK_REVENDEDORAS = "cynara_stock_revendedoras";
export const CLAVE_MOVIMIENTOS_REVENDEDORAS = "cynara_movimientos_revendedoras";
export const CLAVE_VENTAS_REVENDEDORAS = "cynara_ventas_revendedoras";

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

export const leerStockRevendedoras = () => leerListaGuardada(CLAVE_STOCK_REVENDEDORAS);
export const leerMovimientosRevendedoras = () =>
  leerListaGuardada(CLAVE_MOVIMIENTOS_REVENDEDORAS);
export const leerVentasRevendedoras = () => leerListaGuardada(CLAVE_VENTAS_REVENDEDORAS);

export const registrarSalidaRevendedora = ({
  salidaId = "",
  fecha = "",
  revendedora = "",
  observacion = "",
  detalle = [],
}) => {
  if (!salidaId || !revendedora) return [];

  const stockActual = leerStockRevendedoras();
  const movimientosActuales = leerMovimientosRevendedoras();
  const mapaStock = new Map(stockActual.map((item) => [item?.id, item]));

  const nuevosMovimientos = (Array.isArray(detalle) ? detalle : [])
    .map((item, indice) => {
      const cantidad = Number(item?.cantidad || item?.cantidadAtendida || 0);
      if (cantidad <= 0) return null;

      const stockId = `${revendedora}|${item?.claveProducto || item?.id}`;
      const actual = mapaStock.get(stockId) || {
        id: stockId,
        revendedora,
        claveProducto: item?.claveProducto || item?.id,
        codigoCorto: item?.codigoCorto || "",
        codigoProducto: item?.codigoProducto || "",
        modelo: item?.modelo || "",
        colorBase: item?.colorBase || "",
        talla: item?.talla || "",
        stockActual: 0,
      };

      mapaStock.set(stockId, {
        ...actual,
        stockActual: Number(actual?.stockActual || 0) + cantidad,
        ultimaFechaSalida: fecha,
      });

      return {
        id: `${salidaId}-${stockId}-${indice + 1}`,
        salidaId,
        fecha,
        revendedora,
        observacion,
        stockId,
        claveProducto: actual.claveProducto,
        codigoCorto: actual.codigoCorto,
        codigoProducto: actual.codigoProducto,
        modelo: actual.modelo,
        colorBase: actual.colorBase,
        talla: actual.talla,
        cantidad,
        tipoMovimiento: "SALIDA_REVENDEDORA",
      };
    })
    .filter(Boolean);

  guardarLista(
    CLAVE_STOCK_REVENDEDORAS,
    Array.from(mapaStock.values()).sort((a, b) =>
      `${a.revendedora}${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
        `${b.revendedora}${b.modelo}${b.colorBase}${b.talla}`
      )
    )
  );
  guardarLista(CLAVE_MOVIMIENTOS_REVENDEDORAS, [
    ...nuevosMovimientos,
    ...movimientosActuales,
  ]);

  return nuevosMovimientos;
};

export const registrarVentaRevendedora = ({
  ventaId = "",
  fecha = "",
  revendedora = "",
  observacion = "",
  detalle = [],
}) => {
  if (!ventaId || !revendedora) return [];

  const stockActual = leerStockRevendedoras();
  const movimientosActuales = leerMovimientosRevendedoras();
  const ventasActuales = leerVentasRevendedoras();
  const mapaStock = new Map(stockActual.map((item) => [item?.id, item]));

  const nuevosMovimientos = (Array.isArray(detalle) ? detalle : [])
    .map((item, indice) => {
      const cantidad = Number(item?.cantidad || 0);
      if (cantidad <= 0) return null;
      const stockId = item?.stockId || `${revendedora}|${item?.claveProducto || item?.id}`;
      const actual = mapaStock.get(stockId);
      if (!actual) return null;

      mapaStock.set(stockId, {
        ...actual,
        stockActual: Math.max(0, Number(actual?.stockActual || 0) - cantidad),
        ultimaFechaVenta: fecha,
      });

      return {
        id: `${ventaId}-${stockId}-${indice + 1}`,
        ventaId,
        fecha,
        revendedora,
        observacion,
        stockId,
        claveProducto: actual.claveProducto,
        codigoCorto: actual.codigoCorto,
        codigoProducto: actual.codigoProducto,
        modelo: actual.modelo,
        colorBase: actual.colorBase,
        talla: actual.talla,
        cantidad,
        tipoMovimiento: "VENTA_REVENDEDORA",
      };
    })
    .filter(Boolean);

  const ventaRegistro = {
    id: ventaId,
    fecha,
    revendedora,
    observacion,
    detalle,
    totalPrendas: (Array.isArray(detalle) ? detalle : []).reduce(
      (total, item) => total + Number(item?.cantidad || 0),
      0
    ),
  };

  guardarLista(
    CLAVE_STOCK_REVENDEDORAS,
    Array.from(mapaStock.values()).sort((a, b) =>
      `${a.revendedora}${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
        `${b.revendedora}${b.modelo}${b.colorBase}${b.talla}`
      )
    )
  );
  guardarLista(CLAVE_MOVIMIENTOS_REVENDEDORAS, [
    ...nuevosMovimientos,
    ...movimientosActuales,
  ]);
  guardarLista(CLAVE_VENTAS_REVENDEDORAS, [
    ventaRegistro,
    ...ventasActuales.filter((item) => item?.id !== ventaId),
  ]);

  return nuevosMovimientos;
};

export const registrarDevolucionRevendedora = ({
  devolucionId = "",
  fecha = "",
  revendedora = "",
  observacion = "",
  detalle = [],
}) => {
  if (!devolucionId || !revendedora) return [];

  const stockActual = leerStockRevendedoras();
  const movimientosActuales = leerMovimientosRevendedoras();
  const mapaStock = new Map(stockActual.map((item) => [item?.id, item]));

  const nuevosMovimientos = (Array.isArray(detalle) ? detalle : [])
    .map((item, indice) => {
      const cantidad = Number(item?.cantidad || 0);
      if (cantidad <= 0) return null;
      const stockId = item?.stockId || `${revendedora}|${item?.claveProducto || item?.id}`;
      const actual = mapaStock.get(stockId);
      if (!actual) return null;

      mapaStock.set(stockId, {
        ...actual,
        stockActual: Math.max(0, Number(actual?.stockActual || 0) - cantidad),
        ultimaFechaDevolucion: fecha,
      });

      return {
        id: `${devolucionId}-${stockId}-${indice + 1}`,
        devolucionId,
        fecha,
        revendedora,
        observacion,
        stockId,
        claveProducto: actual.claveProducto,
        codigoCorto: actual.codigoCorto,
        codigoProducto: actual.codigoProducto,
        modelo: actual.modelo,
        colorBase: actual.colorBase,
        talla: actual.talla,
        cantidad,
        tipoMovimiento: "DEVOLUCION_REVENDEDORA",
      };
    })
    .filter(Boolean);

  guardarLista(
    CLAVE_STOCK_REVENDEDORAS,
    Array.from(mapaStock.values()).sort((a, b) =>
      `${a.revendedora}${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
        `${b.revendedora}${b.modelo}${b.colorBase}${b.talla}`
      )
    )
  );
  guardarLista(CLAVE_MOVIMIENTOS_REVENDEDORAS, [
    ...nuevosMovimientos,
    ...movimientosActuales,
  ]);

  return nuevosMovimientos;
};
