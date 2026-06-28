import { ConfiguracionCatalogosModulo } from "./ConfiguracionCatalogosModulo";
import {
  guardarCatalogosProduccion,
  leerCatalogosProduccion,
  normalizarTextoCatalogo,
} from "../../utils/catalogosProduccion";
import {
  listarModelosProductoConfiguracion,
  listarVariantesProductoConfiguracion,
} from "../../supabase/configuracionCore.js";

const SECCIONES_PRODUCCION = [
  { clave: "tiposTela", titulo: "Variantes tecnicas / tipos de tela" },
  { clave: "colores", titulo: "Colores" },
  { clave: "tallas", titulo: "Tallas" },
  { clave: "acabados", titulo: "Acabados / diseno" },
  { clave: "detallesConfeccion", titulo: "Detalles de confeccion" },
  { clave: "tiposHijoOp", titulo: "Tipos de hijo OP" },
  { clave: "origenesHijoOp", titulo: "Origenes de hijo OP" },
];

const unirCatalogos = (...listas) =>
  Array.from(
    new Set(
      listas
        .flat()
        .map((item) => normalizarTextoCatalogo(item))
        .filter(Boolean),
    ),
  );

const resolverCatalogosProduccionIniciales = async () => {
  const catalogosLocales = leerCatalogosProduccion();
  const [modelos, variantes] = await Promise.all([
    listarModelosProductoConfiguracion({ incluirInactivos: true }),
    listarVariantesProductoConfiguracion({ incluirInactivos: true }),
  ]);

  const catalogosEnriquecidos = {
    ...catalogosLocales,
    tiposTela: unirCatalogos(
      catalogosLocales.tiposTela || [],
      (modelos || []).map((item) => item?.telaNombre),
    ),
    colores: unirCatalogos(
      catalogosLocales.colores || [],
      (variantes || []).map((item) => item?.color),
    ),
  };

  return guardarCatalogosProduccion(catalogosEnriquecidos);
};

export function ConfiguracionProduccion() {
  return (
    <ConfiguracionCatalogosModulo
      titulo="Configuracion de Produccion"
      descripcion="Aqui se mantienen solo los catalogos operativos de Produccion. Los modelos base, sus codigos y sus telas para nombre ahora se administran desde Catalogo de productos."
      grupoVisual="Operacion"
      secciones={SECCIONES_PRODUCCION}
      textoGuardar="Catalogos de produccion guardados correctamente."
      textoRestaurar="Catalogos de produccion restaurados a sus valores base."
      resolverCatalogosIniciales={resolverCatalogosProduccionIniciales}
    />
  );
}
