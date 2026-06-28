import { Routes, Route } from "react-router-dom";
import {
  Home,
  MiPerfil,
  Login,
  ActualizarPassword,
  ProtectedRoute,
  UserAuth,
  Produccion,
  HabilitadoTaller,
  PedidosRegistrados,
  Cortes,
  SalidasTaller,
  Recepciones,
  ResumenPagos,
  Tercerizaciones,
  Talleres,
  DetalleOp,
  DetallePedido,
  Almacen,
  DevolucionProduccion,
  DespachoProduccion,
  IngresoMateriaPrima,
  MateriaPrima,
  AviosProduccion,
  StockAvios,
  ProductosTerminados,
  CambiosVenta,
  Revendedoras,
  AcondicionadoProductoTerminado,
  Remates,
  AjustesPrendas,
  SalidaTienda,
  DevolucionProveedor,
  ReposicionProveedor,
  Tiendas,
  Contabilidad,
  RecursosHumanos,
  Configuracion,
  Reportes,
  ConfiguracionProduccion,
  ConfiguracionCostos,
  ConfiguracionCostosTaller,
  ConfiguracionCostosTerceros,
  ConfiguracionTalleres,
  ConfiguracionModelosVisuales,
  ConfiguracionElasticosModelo,
  ConfiguracionCatalogoProductos,
  ConfiguracionPreciosProductos,
  ConfiguracionSueldosPersonal,
  ConfiguracionEmpresa,
  ConfiguracionClientesProveedores,
  ConfiguracionAlmacen,
  ConfiguracionCatalogosPersonal,
  ConfiguracionPersonalSeguridad,
  ConfiguracionDocumentos,
  ConfiguracionVentasImpresion,
  ConfiguracionParametros,
} from "../index";

export function MyRoutes() {
  const { user, loading } = UserAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/actualizar-password" element={<ActualizarPassword />} />
     
      <Route element={<ProtectedRoute user={user} loading={loading} redirectTo="/login" />}>
        <Route path="/" element={<Home />} />
        <Route path="/mi-perfil" element={<MiPerfil />} />

        <Route path="/produccion" element={<Produccion />} />
        <Route path="/produccion/habilitado-taller" element={<HabilitadoTaller />} />
        <Route path="/produccion/pedidos-registrados" element={<PedidosRegistrados />} />
        <Route path="/produccion/detalle-pedido" element={<DetallePedido />} />
        <Route path="/produccion/detalle-op" element={<DetalleOp />} />
        <Route path="/produccion/cortes" element ={<Cortes />} /> 
        <Route path="/produccion/salidas-taller" element={<SalidasTaller />} />
        <Route path="/produccion/recepciones" element={<Recepciones />} />
        <Route path="/produccion/resumen-pagos" element={<ResumenPagos />} />
        <Route path="/produccion/tercerizaciones" element={<Tercerizaciones />} />
        <Route path="/talleres" element={<Talleres />} />
        <Route path="/talleres/disponibles" element={<Talleres vistaInicial="disponibles" />} />
        <Route path="/talleres/mi-produccion" element={<Talleres vistaInicial="produccion" />} />
        <Route path="/talleres/historial" element={<Talleres vistaInicial="historial" />} />
        <Route path="/talleres/pagos" element={<Talleres vistaInicial="pagos" />} />
        <Route path="/tiendas" element={<Tiendas />} />
        <Route path="/contabilidad" element={<Contabilidad />} />
        <Route path="/recursos-humanos" element={<RecursosHumanos />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/almacen" element={<Almacen />} />
        <Route path="/almacen/materia-prima" element={<Almacen vistaInicial="materia-prima" />} />
        <Route path="/almacen/producto-terminado" element={<Almacen vistaInicial="producto-terminado" />} />
        <Route path="/almacen/talleres-terceros" element={<Almacen vistaInicial="producto-terminado" />} />
        <Route path="/almacen/ingreso-materia-prima" element={<IngresoMateriaPrima />} />
        <Route path="/almacen/stock-telas" element={<MateriaPrima />} />
        <Route path="/almacen/avios-produccion" element={<AviosProduccion />} />
        <Route path="/almacen/stock-avios" element={<StockAvios />} />
        <Route path="/almacen/ajustes-avios" element={<StockAvios modo="ajustes" />} />
        <Route
          path="/almacen/acondicionado-producto-terminado"
          element={<AcondicionadoProductoTerminado />}
        />
        <Route path="/almacen/remates" element={<Remates />} />
        <Route path="/almacen/ajustes-prendas" element={<AjustesPrendas />} />
        <Route path="/almacen/devolucion-proveedor" element={<DevolucionProveedor />} />
        <Route path="/almacen/reposicion-proveedor" element={<ReposicionProveedor />} />
        <Route path="/almacen/productos-terminados" element={<ProductosTerminados />} />
        <Route path="/almacen/pedidos-tienda" element={<SalidaTienda />} />
        <Route path="/almacen/venta-directa" element={<ProductosTerminados vistaInicial="venta" />} />
        <Route path="/almacen/cambios-venta" element={<CambiosVenta />} />
        <Route path="/almacen/revendedoras" element={<Revendedoras />} />
        <Route path="/almacen/salida-tienda" element={<SalidaTienda />} />
        <Route path="/almacen/despacho-produccion" element={<DespachoProduccion />} />
        <Route path="/almacen/devolucion-produccion" element={<DevolucionProduccion />} />
        <Route path="/almacen/recepcion-taller" element={<Recepciones moduloOrigen="almacen" />} />
        <Route path="/almacen/tercerizaciones" element={<Tercerizaciones moduloOrigen="almacen" />} />
        <Route path="/configurar" element={<Configuracion />} />
        <Route path="/configurar/empresa" element={<ConfiguracionEmpresa />} />
        <Route
          path="/configurar/clientes-proveedores"
          element={<ConfiguracionClientesProveedores />}
        />
        <Route path="/configurar/costos" element={<ConfiguracionCostos />} />
        <Route path="/configurar/costos-taller" element={<ConfiguracionCostosTaller />} />
        <Route path="/configurar/costos-terceros" element={<ConfiguracionCostosTerceros />} />
        <Route path="/configurar/produccion" element={<ConfiguracionProduccion />} />
        <Route path="/configurar/talleres" element={<ConfiguracionTalleres />} />
        <Route path="/configurar/modelos-visuales" element={<ConfiguracionModelosVisuales />} />
        <Route path="/configurar/elasticos-modelo" element={<ConfiguracionElasticosModelo />} />
        <Route path="/configurar/catalogo-productos" element={<ConfiguracionCatalogoProductos />} />
        <Route path="/configurar/precios-productos" element={<ConfiguracionPreciosProductos />} />
        <Route path="/configurar/sueldos-personal" element={<ConfiguracionSueldosPersonal />} />
        <Route path="/configurar/almacen" element={<ConfiguracionAlmacen />} />
        <Route path="/configurar/catalogos-personal" element={<ConfiguracionCatalogosPersonal />} />
        <Route
          path="/configurar/personal-seguridad"
          element={<ConfiguracionPersonalSeguridad />}
        />
        <Route path="/configurar/documentos" element={<ConfiguracionDocumentos />} />
        <Route path="/configurar/ventas-impresion" element={<ConfiguracionVentasImpresion />} />
        <Route path="/configurar/parametros" element={<ConfiguracionParametros />} />
          
      </Route>
    </Routes>
  );
}
