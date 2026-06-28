import { buscarUsuarioSistema } from "./seguridadUsuarios";

const CLAVE_PERFILES_USUARIO = "cynara_perfiles_usuario";

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

const guardarLista = (clave, lista) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

const crearPerfilBase = (user = {}) => {
  const correo = user?.email || "";
  const alias = correo.split("@")[0] || "Usuario";
  const nombreMetadata =
    user?.user_metadata?.nombre ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "";
  const nombreVisible =
    nombreMetadata ||
    alias
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letra) => letra.toUpperCase());

  const esCuentaPrueba = correo.toLowerCase().includes("prueba");

  return {
    correo,
    nombreVisible,
    rol: esCuentaPrueba ? "Administrador" : "Usuario",
    area: esCuentaPrueba ? "Administracion" : "Produccion",
    sede: "Principal",
    telefono: "",
    modulos: esCuentaPrueba
      ? ["Produccion", "Materia prima", "Prod. terminados", "Talleres", "Reportes", "Configuracion"]
      : ["Produccion"],
  };
};

export const leerPerfilUsuario = (user = {}) => {
  const correo = user?.email || "";
  const perfiles = leerListaGuardada(CLAVE_PERFILES_USUARIO);
  const guardado = perfiles.find((item) => item?.correo === correo);
  const cuentaSistema = buscarUsuarioSistema(correo);
  const base = crearPerfilBase(user);

  return {
    ...base,
    ...(guardado || {}),
    ...(cuentaSistema
      ? {
          correo: cuentaSistema.correo || correo,
          nombreVisible:
            cuentaSistema.nombreCompleto || guardado?.nombreVisible || base.nombreVisible,
          rol: cuentaSistema.rol || guardado?.rol || base.rol,
          area: cuentaSistema.area || guardado?.area || base.area,
          modulos: cuentaSistema.modulos || guardado?.modulos || base.modulos,
          submodulos: cuentaSistema.submodulos || guardado?.submodulos || {},
          tallerAsignado: cuentaSistema.tallerAsignado || guardado?.tallerAsignado || "",
          tallerId: cuentaSistema.tallerId || guardado?.tallerId || "",
          tallerCodigo: cuentaSistema.tallerCodigo || guardado?.tallerCodigo || "",
        }
      : {}),
  };
};

export const guardarPerfilUsuario = (perfil = {}) => {
  const correo = perfil?.correo || "";
  if (!correo) return null;

  const perfiles = leerListaGuardada(CLAVE_PERFILES_USUARIO);
  const actualizado = [
    perfil,
    ...perfiles.filter((item) => item?.correo !== correo),
  ];

  guardarLista(CLAVE_PERFILES_USUARIO, actualizado);
  return perfil;
};
