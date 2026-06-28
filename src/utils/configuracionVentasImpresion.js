export const CLAVE_CONFIGURACION_VENTAS_IMPRESION =
  "cynara_configuracion_ventas_impresion";

export const crearConfiguracionVentasImpresionBase = () => ({
  nombreComercial: "CORPORACION CYNARA",
  razonSocial: "",
  ruc: "",
  direccion: "",
  telefono: "",
  whatsapp: "",
  logoUrl: "",
  tipoComprobanteDefecto: "NOTA DE VENTA",
  serieNotaVenta: "NV001",
  serieNotaCambio: "NCI001",
  correlativoInicial: 1,
  anchoPapel: "80",
  nombreImpresora: "",
  modoImpresion: "VISTA",
  igvPorcentaje: 18,
  preciosIncluyenIgv: true,
  mostrarCliente: true,
  mostrarDocumentoCliente: false,
  mostrarTelefonoCliente: false,
  mostrarColor: true,
  mostrarTalla: true,
  mostrarCodigoCorto: true,
  mostrarPrecioUnitario: true,
  mostrarSubtotal: true,
  mostrarIgv: true,
  mostrarTotal: true,
  mensajePie1: "Gracias por su compra",
  mensajePie2: "No se aceptan cambios sin ticket",
});

export const leerConfiguracionVentasImpresion = () => {
  const contenido = localStorage.getItem(CLAVE_CONFIGURACION_VENTAS_IMPRESION);
  const base = crearConfiguracionVentasImpresionBase();
  if (!contenido) return base;

  try {
    const data = JSON.parse(contenido);
    return {
      ...base,
      ...(data && typeof data === "object" ? data : {}),
    };
  } catch {
    return base;
  }
};

export const guardarConfiguracionVentasImpresion = (configuracion = {}) => {
  const base = crearConfiguracionVentasImpresionBase();
  const data = {
    ...base,
    ...(configuracion && typeof configuracion === "object" ? configuracion : {}),
  };
  localStorage.setItem(CLAVE_CONFIGURACION_VENTAS_IMPRESION, JSON.stringify(data));
  return data;
};
