import { ConfiguracionCatalogosModulo } from "./ConfiguracionCatalogosModulo";

const SECCIONES_ALMACEN = [
  { clave: "unidadesMedida", titulo: "Unidades de medida" },
  { clave: "tiposMovimiento", titulo: "Tipos de movimiento" },
  { clave: "ubicaciones", titulo: "Ubicaciones" },
  { clave: "almacenes", titulo: "Almacenes" },
  { clave: "motivosAjuste", titulo: "Motivos de ajuste" },
  { clave: "lotesBase", titulo: "Lotes / partidas base" },
];

export function ConfiguracionAlmacen() {
  return (
    <ConfiguracionCatalogosModulo
      titulo="Configuracion de Almacen"
      descripcion="Aqui se administran las bases que luego usara almacen para ingresos, salidas y ajustes."
      secciones={SECCIONES_ALMACEN}
      textoGuardar="Catalogos de almacen guardados correctamente."
      textoRestaurar="Catalogos de almacen restaurados a sus valores base."
    />
  );
}
