const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const ADMIN_ROLES = ["ADMINISTRADOR", "ADMIN", "GERENCIA"];

const RUTAS_SISTEMA = [
  { path: "/", libre: true },
  { path: "/mi-perfil", libre: true },
  { path: "/produccion", modulo: "PRODUCCION" },
  { path: "/produccion/habilitado-taller", modulo: "PRODUCCION", submodulo: "HABILITADO DE OP PARA TALLER" },
  { path: "/produccion/pedidos-registrados", modulo: "PRODUCCION", submodulo: "PEDIDOS REGISTRADOS" },
  { path: "/produccion/detalle-pedido", modulo: "PRODUCCION", submodulo: "PEDIDOS REGISTRADOS" },
  { path: "/produccion/detalle-op", modulo: "PRODUCCION", submodulo: "DETALLE DE OP" },
  { path: "/produccion/cortes", modulo: "PRODUCCION", submodulo: "CORTES" },
  { path: "/produccion/salidas-taller", modulo: "PRODUCCION", submodulo: "SALIDAS A TALLER" },
  { path: "/produccion/recepciones", modulo: "PRODUCCION", submodulo: "RECEPCIONES" },
  { path: "/produccion/resumen-pagos", modulo: "PRODUCCION", submodulo: "RESUMEN DE PAGOS" },
  { path: "/produccion/tercerizaciones", modulo: "PRODUCCION", submodulo: "TERCERIZACIONES" },
  { path: "/talleres", modulo: "TALLERES" },
  { path: "/talleres/disponibles", modulo: "TALLERES", submodulo: "OP DISPONIBLES" },
  { path: "/talleres/mi-produccion", modulo: "TALLERES", submodulo: "MI PRODUCCION" },
  { path: "/talleres/historial", modulo: "TALLERES", submodulo: "HISTORIAL" },
  { path: "/talleres/pagos", modulo: "TALLERES", submodulo: "PAGOS" },
  { path: "/tiendas", modulo: "TIENDAS" },
  { path: "/contabilidad", modulo: "CONTABILIDAD" },
  { path: "/recursos-humanos", modulo: "RECURSOS HUMANOS" },
  { path: "/reportes", modulo: "REPORTES" },
  { path: "/almacen", modulo: "ALMACEN PRODUCTO TERMINADO" },
  { path: "/almacen/materia-prima", modulo: "ALMACEN MATERIA PRIMA" },
  { path: "/almacen/producto-terminado", modulo: "ALMACEN PRODUCTO TERMINADO" },
  { path: "/almacen/talleres-terceros", modulo: "ALMACEN PRODUCTO TERMINADO" },
  { path: "/almacen/ingreso-materia-prima", modulo: "ALMACEN MATERIA PRIMA", submodulo: "INGRESO MATERIA PRIMA" },
  { path: "/almacen/stock-telas", modulo: "ALMACEN MATERIA PRIMA", submodulo: "STOCK TELAS" },
  { path: "/almacen/avios-produccion", modulo: "ALMACEN MATERIA PRIMA", submodulo: "STOCK AVIOS" },
  { path: "/almacen/stock-avios", modulo: "ALMACEN MATERIA PRIMA", submodulo: "STOCK AVIOS" },
  { path: "/almacen/ajustes-avios", modulo: "ALMACEN MATERIA PRIMA", submodulo: "AJUSTES AVIOS" },
  { path: "/almacen/acondicionado-producto-terminado", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "ACONDICIONADO" },
  { path: "/almacen/remates", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "REMATES" },
  { path: "/almacen/ajustes-prendas", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "AJUSTES DE PRENDAS" },
  { path: "/almacen/devolucion-proveedor", modulo: "ALMACEN MATERIA PRIMA", submodulo: "DEVOLUCION A PROVEEDOR" },
  { path: "/almacen/reposicion-proveedor", modulo: "ALMACEN MATERIA PRIMA", submodulo: "REPOSICION DE PROVEEDOR" },
  { path: "/almacen/productos-terminados", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "STOCK DE PRODUCTOS" },
  { path: "/almacen/pedidos-tienda", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "PEDIDOS Y SALIDA A TIENDA" },
  { path: "/almacen/venta-directa", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "STOCK DE PRODUCTOS" },
  { path: "/almacen/cambios-venta", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "STOCK DE PRODUCTOS" },
  { path: "/almacen/revendedoras", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "STOCK DE PRODUCTOS" },
  { path: "/almacen/salida-tienda", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "PEDIDOS Y SALIDA A TIENDA" },
  { path: "/almacen/despacho-produccion", modulo: "ALMACEN MATERIA PRIMA", submodulo: "DESPACHO A PRODUCCION" },
  { path: "/almacen/devolucion-produccion", modulo: "ALMACEN MATERIA PRIMA", submodulo: "DEVOLUCION DE PRODUCCION" },
  { path: "/almacen/recepcion-taller", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "RECEPCION DE TALLER" },
  { path: "/almacen/tercerizaciones", modulo: "ALMACEN PRODUCTO TERMINADO", submodulo: "RECEPCION DE TALLER" },
  { path: "/configurar", modulo: "CONFIGURACION" },
  { path: "/configurar/empresa", modulo: "CONFIGURACION", submodulo: "EMPRESA" },
  { path: "/configurar/clientes-proveedores", modulo: "CONFIGURACION", submodulo: "CLIENTES Y PROVEEDORES" },
  { path: "/configurar/costos", modulo: "CONFIGURACION", submodulo: "PARAMETROS" },
  { path: "/configurar/costos-taller", modulo: "CONFIGURACION", submodulo: "PARAMETROS" },
  { path: "/configurar/costos-terceros", modulo: "CONFIGURACION", submodulo: "PARAMETROS" },
  { path: "/configurar/produccion", modulo: "CONFIGURACION", submodulo: "PRODUCCION" },
  { path: "/configurar/talleres", modulo: "CONFIGURACION", submodulo: "FICHAS DE TALLERES" },
  { path: "/configurar/modelos-visuales", modulo: "CONFIGURACION", submodulo: "FICHAS VISUALES" },
  { path: "/configurar/elasticos-modelo", modulo: "CONFIGURACION", submodulo: "ELASTICOS POR MODELO" },
  { path: "/configurar/catalogo-productos", modulo: "CONFIGURACION", submodulo: "PRODUCCION" },
  { path: "/configurar/precios-productos", modulo: "CONFIGURACION", submodulo: "PARAMETROS" },
  { path: "/configurar/sueldos-personal", modulo: "CONFIGURACION", submodulo: "PERSONAL Y SEGURIDAD" },
  { path: "/configurar/almacen", modulo: "CONFIGURACION", submodulo: "ALMACEN" },
  { path: "/configurar/catalogos-personal", modulo: "CONFIGURACION", submodulo: "CATALOGOS DE PERSONAL" },
  { path: "/configurar/personal-seguridad", modulo: "CONFIGURACION", submodulo: "PERSONAL Y SEGURIDAD" },
  { path: "/configurar/documentos", modulo: "CONFIGURACION", submodulo: "DOCUMENTOS" },
  { path: "/configurar/ventas-impresion", modulo: "CONFIGURACION", submodulo: "PARAMETROS" },
  { path: "/configurar/parametros", modulo: "CONFIGURACION", submodulo: "PARAMETROS" },
];

export const tieneRolAdministrador = (perfil = {}) =>
  ADMIN_ROLES.includes(normalizarTexto(perfil?.rol || ""));

export const usuarioTieneModulo = (perfil = {}, modulo = "") => {
  if (tieneRolAdministrador(perfil)) return true;
  const moduloNormalizado = normalizarTexto(modulo);
  const modulos = Array.isArray(perfil?.modulos) ? perfil.modulos.map(normalizarTexto) : [];
  return modulos.includes(moduloNormalizado);
};

export const usuarioTieneSubmodulo = (perfil = {}, modulo = "", submodulo = "") => {
  if (tieneRolAdministrador(perfil)) return true;
  const moduloNormalizado = normalizarTexto(modulo);
  const submoduloNormalizado = normalizarTexto(submodulo);

  if (!usuarioTieneModulo(perfil, moduloNormalizado)) return false;
  if (!submoduloNormalizado) return true;

  const lista = Array.isArray(perfil?.submodulos?.[moduloNormalizado])
    ? perfil.submodulos[moduloNormalizado].map(normalizarTexto)
    : [];
  return lista.includes(submoduloNormalizado);
};

export const resolverAccesoRuta = (pathname = "") =>
  RUTAS_SISTEMA.find((item) => item.path === pathname) || null;

export const puedeAccederRuta = (pathname = "", perfil = {}) => {
  const acceso = resolverAccesoRuta(pathname);
  if (!acceso) return true;
  if (acceso.libre) return true;
  if (acceso.submodulo) {
    return usuarioTieneSubmodulo(perfil, acceso.modulo, acceso.submodulo);
  }
  return usuarioTieneModulo(perfil, acceso.modulo);
};
