export const CLAVE_STOCK_TIENDAS = "cynara_stock_tiendas";
export const CLAVE_MOVIMIENTOS_TIENDA = "cynara_movimientos_tienda";
export const CLAVE_VENTAS_TIENDA = "cynara_ventas_tienda";

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

const guardarLista = (clave, lista = []) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

export const leerStockTiendas = () => leerListaGuardada(CLAVE_STOCK_TIENDAS);
export const leerMovimientosTienda = () => leerListaGuardada(CLAVE_MOVIMIENTOS_TIENDA);
export const leerVentasTienda = () => leerListaGuardada(CLAVE_VENTAS_TIENDA);

const ordenarStockTiendaFifo = (items = []) =>
  [...items].sort((a, b) => {
    const fechaA = a?.ultimaFechaIngreso || "";
    const fechaB = b?.ultimaFechaIngreso || "";
    if (fechaA !== fechaB) return `${fechaA}`.localeCompare(`${fechaB}`);
    return `${a?.stockId || a?.id || ""}`.localeCompare(`${b?.stockId || b?.id || ""}`);
  });

export const registrarIngresoTienda = ({
  salidaId = "",
  pedidoId = "",
  tienda = "",
  fecha = "",
  observacion = "",
  detalle = [],
}) => {
  if (!salidaId || !tienda) {
    return [];
  }

  const stockActual = leerStockTiendas();
  const movimientosActuales = leerMovimientosTienda();
  const mapaStock = new Map(stockActual.map((item) => [item?.id, item]));
  const movimientosPrevios = movimientosActuales.filter(
    (movimiento) => movimiento?.salidaId === salidaId && movimiento?.tipoMovimiento === "INGRESO_TIENDA"
  );

  movimientosPrevios.forEach((movimiento) => {
    const actual = mapaStock.get(movimiento?.stockId);
    if (!actual) return;

    mapaStock.set(movimiento.stockId, {
      ...actual,
      stockActual: Math.max(
        0,
        Number(actual?.stockActual || 0) - Number(movimiento?.cantidad || 0)
      ),
    });
  });

  const nuevosMovimientos = (Array.isArray(detalle) ? detalle : [])
    .map((item, indice) => {
      const cantidad = Number(item?.cantidadAtendida || 0);
      if (cantidad <= 0) return null;

      const stockId = `${tienda}|${item?.claveProducto || item?.id}`;
      const actual = mapaStock.get(stockId) || {
        id: stockId,
        tienda,
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
        ultimaFechaIngreso: fecha,
        ultimaSalidaAlmacen: salidaId,
      });

      return {
        id: `${salidaId}-${stockId}-${indice + 1}`,
        salidaId,
        pedidoId,
        tienda,
        fecha,
        observacion,
        stockId,
        claveProducto: actual.claveProducto,
        codigoCorto: actual.codigoCorto,
        codigoProducto: actual.codigoProducto,
        modelo: actual.modelo,
        colorBase: actual.colorBase,
        talla: actual.talla,
        cantidad,
        tipoMovimiento: "INGRESO_TIENDA",
      };
    })
    .filter(Boolean);

  const stockActualizado = Array.from(mapaStock.values()).sort((a, b) =>
    `${a.tienda}${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.tienda}${b.modelo}${b.colorBase}${b.talla}`
    )
  );

  const movimientosActualizados = [
    ...nuevosMovimientos,
    ...movimientosActuales.filter(
      (movimiento) =>
        !(movimiento?.salidaId === salidaId && movimiento?.tipoMovimiento === "INGRESO_TIENDA")
    ),
  ];

  guardarLista(CLAVE_STOCK_TIENDAS, stockActualizado);
  guardarLista(CLAVE_MOVIMIENTOS_TIENDA, movimientosActualizados);

  return nuevosMovimientos;
};

export const registrarVentaTienda = ({
  ventaId = "",
  tienda = "",
  fecha = "",
  observacion = "",
  cliente = "",
  detalleVenta = [],
}) => {
  if (!ventaId || !tienda) {
    return [];
  }

  const stockActual = leerStockTiendas();
  const movimientosActuales = leerMovimientosTienda();
  const ventasActuales = leerVentasTienda();
  const mapaStock = new Map(stockActual.map((item) => [item?.id, item]));
  const movimientosPrevios = movimientosActuales.filter(
    (movimiento) => movimiento?.ventaId === ventaId && movimiento?.tipoMovimiento === "VENTA_TIENDA"
  );

  movimientosPrevios.forEach((movimiento) => {
    const actual = mapaStock.get(movimiento?.stockId);
    if (!actual) return;

    mapaStock.set(movimiento.stockId, {
      ...actual,
      stockActual: Number(actual?.stockActual || 0) + Number(movimiento?.cantidad || 0),
    });
  });

  const nuevosMovimientos = (Array.isArray(detalleVenta) ? detalleVenta : [])
    .map((item, indice) => {
      const cantidad = Number(item?.cantidadVendida || 0);
      if (cantidad <= 0) return null;

      const stockId = `${tienda}|${item?.claveProducto || item?.id}`;
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
        tienda,
        fecha,
        cliente,
        observacion,
        stockId,
        claveProducto: actual.claveProducto,
        codigoCorto: actual.codigoCorto,
        codigoProducto: actual.codigoProducto,
        modelo: actual.modelo,
        colorBase: actual.colorBase,
        talla: actual.talla,
        cantidad,
        tipoMovimiento: "VENTA_TIENDA",
      };
    })
    .filter(Boolean);

  const stockActualizado = Array.from(mapaStock.values()).sort((a, b) =>
    `${a.tienda}${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.tienda}${b.modelo}${b.colorBase}${b.talla}`
    )
  );

  const movimientosActualizados = [
    ...nuevosMovimientos,
    ...movimientosActuales.filter(
      (movimiento) =>
        !(movimiento?.ventaId === ventaId && movimiento?.tipoMovimiento === "VENTA_TIENDA")
    ),
  ];

  const ventaRegistro = {
    id: ventaId,
    tienda,
    fecha,
    cliente,
    observacion,
    detalleVenta: (Array.isArray(detalleVenta) ? detalleVenta : []).map((item) => ({
      ...item,
      cantidadVendida: Number(item?.cantidadVendida || 0),
    })),
    totalPrendas: (Array.isArray(detalleVenta) ? detalleVenta : []).reduce(
      (total, item) => total + Number(item?.cantidadVendida || 0),
      0
    ),
  };

  const ventasActualizadas = [
    ventaRegistro,
    ...ventasActuales.filter((item) => item?.id !== ventaId),
  ];

  guardarLista(CLAVE_STOCK_TIENDAS, stockActualizado);
  guardarLista(CLAVE_MOVIMIENTOS_TIENDA, movimientosActualizados);
  guardarLista(CLAVE_VENTAS_TIENDA, ventasActualizadas);

  return nuevosMovimientos;
};

export const resumirStockTiendaPorModelo = (tienda = "") => {
  const tiendaNormalizada = (tienda || "").toString().trim().toUpperCase();
  const stock = leerStockTiendas().filter(
    (item) => !tiendaNormalizada || (item?.tienda || "").toUpperCase() === tiendaNormalizada
  );
  const mapa = new Map();

  stock.forEach((item) => {
    const clave = `${item?.tienda || ""}|${item?.modelo || ""}`;
    const actual = mapa.get(clave) || {
      id: clave,
      tienda: item?.tienda || "",
      modelo: item?.modelo || "",
      stockTotal: 0,
      colores: new Set(),
      tallas: new Set(),
    };

    actual.stockTotal += Number(item?.stockActual || 0);
    if (item?.colorBase) actual.colores.add(item.colorBase);
    if (item?.talla) actual.tallas.add(item.talla);
    mapa.set(clave, actual);
  });

  return Array.from(mapa.values())
    .map((item) => ({
      ...item,
      colores: Array.from(item.colores),
      tallas: Array.from(item.tallas),
    }))
    .sort((a, b) => `${a.tienda}${a.modelo}`.localeCompare(`${b.tienda}${b.modelo}`));
};

export const registrarVentaTiendaRapida = ({
  ventaId = "",
  tienda = "",
  fecha = "",
  observacion = "",
  cliente = "",
  detalleVenta = [],
}) => {
  if (!ventaId || !tienda) {
    return [];
  }

  const tiendaNormalizada = (tienda || "").toString().trim().toUpperCase();
  const stockActual = leerStockTiendas();
  const movimientosActuales = leerMovimientosTienda();
  const ventasActuales = leerVentasTienda();
  const mapaStock = new Map(stockActual.map((item) => [item?.id, item]));
  const movimientosPrevios = movimientosActuales.filter(
    (movimiento) => movimiento?.ventaId === ventaId && movimiento?.tipoMovimiento === "VENTA_TIENDA_RAPIDA"
  );

  movimientosPrevios.forEach((movimiento) => {
    const actual = mapaStock.get(movimiento?.stockId);
    if (!actual) return;

    mapaStock.set(movimiento.stockId, {
      ...actual,
      stockActual: Number(actual?.stockActual || 0) + Number(movimiento?.cantidad || 0),
    });
  });

  const detalleNormalizado = (Array.isArray(detalleVenta) ? detalleVenta : []).map((item) => ({
    modelo: (item?.modelo || "").toString().trim().toUpperCase(),
    cantidadVendida: Number(item?.cantidadVendida || 0),
  }));

  const nuevosMovimientos = [];
  const detalleAsignado = [];

  detalleNormalizado.forEach((item, indiceModelo) => {
    if (!item.modelo || item.cantidadVendida <= 0) return;

    const candidatos = ordenarStockTiendaFifo(
      Array.from(mapaStock.values()).filter(
        (stockItem) =>
          (stockItem?.tienda || "").toUpperCase() === tiendaNormalizada &&
          (stockItem?.modelo || "").toUpperCase() === item.modelo &&
          Number(stockItem?.stockActual || 0) > 0
      )
    );

    let saldoPendiente = item.cantidadVendida;

    candidatos.forEach((stockItem) => {
      if (saldoPendiente <= 0) return;

      const disponible = Number(stockItem?.stockActual || 0);
      if (disponible <= 0) return;

      const cantidad = Math.min(disponible, saldoPendiente);
      saldoPendiente -= cantidad;

      mapaStock.set(stockItem.id, {
        ...stockItem,
        stockActual: disponible - cantidad,
        ultimaFechaVenta: fecha,
      });

      const movimiento = {
        id: `${ventaId}-${stockItem.id}-${indiceModelo + 1}-${nuevosMovimientos.length + 1}`,
        ventaId,
        tienda: tiendaNormalizada,
        fecha,
        cliente,
        observacion,
        stockId: stockItem.id,
        claveProducto: stockItem.claveProducto,
        codigoCorto: stockItem.codigoCorto,
        codigoProducto: stockItem.codigoProducto,
        modelo: stockItem.modelo,
        colorBase: stockItem.colorBase,
        talla: stockItem.talla,
        cantidad,
        tipoMovimiento: "VENTA_TIENDA_RAPIDA",
      };

      nuevosMovimientos.push(movimiento);
      detalleAsignado.push({
        modeloGeneral: item.modelo,
        stockId: stockItem.id,
        colorBase: stockItem.colorBase,
        talla: stockItem.talla,
        cantidad,
      });
    });

    if (saldoPendiente > 0) {
      detalleAsignado.push({
        modeloGeneral: item.modelo,
        stockId: "",
        colorBase: "SIN STOCK",
        talla: "-",
        cantidad: saldoPendiente,
      });
    }
  });

  const stockActualizado = Array.from(mapaStock.values()).sort((a, b) =>
    `${a.tienda}${a.modelo}${a.colorBase}${a.talla}`.localeCompare(
      `${b.tienda}${b.modelo}${b.colorBase}${b.talla}`
    )
  );

  const movimientosActualizados = [
    ...nuevosMovimientos,
    ...movimientosActuales.filter(
      (movimiento) =>
        !(movimiento?.ventaId === ventaId && movimiento?.tipoMovimiento === "VENTA_TIENDA_RAPIDA")
    ),
  ];

  const ventaRegistro = {
    id: ventaId,
    tienda: tiendaNormalizada,
    fecha,
    cliente,
    observacion,
    tipoVenta: "RAPIDA",
    detalleVenta: detalleNormalizado,
    detalleAsignado,
    totalPrendas: detalleNormalizado.reduce(
      (total, detalle) => total + Number(detalle?.cantidadVendida || 0),
      0
    ),
  };

  const ventasActualizadas = [
    ventaRegistro,
    ...ventasActuales.filter((item) => item?.id !== ventaId),
  ];

  guardarLista(CLAVE_STOCK_TIENDAS, stockActualizado);
  guardarLista(CLAVE_MOVIMIENTOS_TIENDA, movimientosActualizados);
  guardarLista(CLAVE_VENTAS_TIENDA, ventasActualizadas);

  return nuevosMovimientos;
};
