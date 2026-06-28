import { ConfiguracionCatalogosModulo } from "./ConfiguracionCatalogosModulo";

const SECCIONES_PERSONAL = [
  { clave: "areasPersonal", titulo: "Areas" },
  { clave: "cargosPersonal", titulo: "Cargos" },
  { clave: "rolesUsuario", titulo: "Roles" },
  { clave: "responsables", titulo: "Responsables" },
];

export function ConfiguracionCatalogosPersonal() {
  return (
    <ConfiguracionCatalogosModulo
      titulo="Catalogos de personal"
      descripcion="Aqui puedes mantener las areas, cargos, roles y responsables que luego se usan en las fichas de personal y en las cuentas del sistema."
      grupoVisual="Seguridad"
      secciones={SECCIONES_PERSONAL}
      textoGuardar="Catalogos de personal guardados correctamente."
      textoRestaurar="Catalogos de personal restaurados a sus valores base."
    />
  );
}
