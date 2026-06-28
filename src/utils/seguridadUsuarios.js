import { guardarCatalogosProduccion, leerCatalogosProduccion } from "./catalogosProduccion";

export const CLAVE_PERSONAL_SISTEMA = "cynara_personal_sistema";
export const CLAVE_USUARIOS_SISTEMA = "cynara_usuarios_sistema";
export const CLAVE_ASIGNACIONES_TALLER = "cynara_asignaciones_taller";

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const normalizarCorreo = (valor = "") => valor.toString().trim().toLowerCase();

const leerLista = (clave) => {
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

export const ACCESOS_SISTEMA = [
  {
    modulo: "PRODUCCION",
    submodulos: [
      "PEDIDOS REGISTRADOS",
      "DETALLE DE OP",
      "CORTES",
      "HABILITADO DE OP PARA TALLER",
      "SALIDAS A TALLER",
      "RECEPCIONES",
      "TERCERIZACIONES",
      "RESUMEN DE PAGOS",
    ],
  },
  {
    modulo: "ALMACEN MATERIA PRIMA",
    submodulos: [
      "INGRESO MATERIA PRIMA",
      "STOCK TELAS",
      "STOCK AVIOS",
      "DESPACHO A PRODUCCION",
      "DEVOLUCION DE PRODUCCION",
      "DEVOLUCION A PROVEEDOR",
      "REPOSICION DE PROVEEDOR",
      "AJUSTES AVIOS",
    ],
  },
  {
    modulo: "ALMACEN PRODUCTO TERMINADO",
    submodulos: [
      "RECEPCION DE TALLER",
      "ACONDICIONADO",
    "STOCK DE PRODUCTOS",
      "REMATES",
      "PEDIDOS Y SALIDA A TIENDA",
      "AJUSTES DE PRENDAS",
    ],
  },
  {
    modulo: "TALLERES",
    submodulos: ["OP DISPONIBLES", "MI PRODUCCION", "HISTORIAL", "PAGOS"],
  },
  {
    modulo: "TIENDAS",
    submodulos: ["PEDIDOS A ALMACEN"],
  },
  {
    modulo: "CONTABILIDAD",
    submodulos: [],
  },
  {
    modulo: "RECURSOS HUMANOS",
    submodulos: [],
  },
  {
    modulo: "REPORTES",
    submodulos: [
      "REPORTE DE OP",
      "REPORTE DE PAGOS",
      "STOCK DE TELAS",
      "PRODUCTO TERMINADO",
      "REMATES",
      "PEDIDOS DE TIENDA",
    ],
  },
  {
    modulo: "CONFIGURACION",
    submodulos: [
      "EMPRESA",
      "CLIENTES Y PROVEEDORES",
      "PRODUCCION",
      "FICHAS DE TALLERES",
      "ELASTICOS POR MODELO",
      "FICHAS VISUALES",
      "ALMACEN",
      "CATALOGOS DE PERSONAL",
      "PERSONAL Y SEGURIDAD",
      "DOCUMENTOS",
      "PARAMETROS",
    ],
  },
];

export const crearFichaPersonalVacia = () => ({
  nombreCompleto: "",
  telefono: "",
  area: "",
  cargo: "",
  sede: "PRINCIPAL",
  estado: "ACTIVO",
  observacion: "",
});

export const crearUsuarioSistemaVacio = () => ({
  correo: "",
  nombreCompleto: "",
  passwordTemporal: "",
  rol: "PRODUCCION",
  area: "PRODUCCION",
  estado: "ACTIVO",
  modulos: [],
  submodulos: {},
  tallerAsignado: "",
  tallerId: "",
  tallerCodigo: "",
  observacion: "",
});

export const obtenerAccesoSugeridoPorRol = (rol = "") => {
  const rolNormalizado = normalizarTexto(rol);
  const accesoTotal = ACCESOS_SISTEMA.reduce(
    (acumulado, item) => {
      acumulado.modulos.push(item.modulo);
      acumulado.submodulos[item.modulo] = [...item.submodulos];
      return acumulado;
    },
    { modulos: [], submodulos: {} }
  );

  const crearAcceso = (modulos = []) => ({
    modulos,
    submodulos: modulos.reduce((acumulado, modulo) => {
      const encontrado = ACCESOS_SISTEMA.find((item) => item.modulo === modulo);
      acumulado[modulo] = encontrado ? [...encontrado.submodulos] : [];
      return acumulado;
    }, {}),
  });

  switch (rolNormalizado) {
    case "ADMINISTRADOR":
      return accesoTotal;
    case "PRODUCCION":
      return crearAcceso(["PRODUCCION", "TALLERES", "REPORTES"]);
    case "ALMACEN MATERIA PRIMA":
      return crearAcceso(["ALMACEN MATERIA PRIMA", "REPORTES"]);
    case "ALMACEN PRODUCTO TERMINADO":
      return crearAcceso(["ALMACEN PRODUCTO TERMINADO", "REPORTES"]);
    case "TALLER":
      return crearAcceso(["TALLERES"]);
    case "TIENDA":
      return crearAcceso(["TIENDAS"]);
    case "GERENCIA":
      return {
        modulos: ["REPORTES", "PRODUCCION", "CONTABILIDAD", "CONFIGURACION"],
        submodulos: {
          REPORTES: [...(ACCESOS_SISTEMA.find((item) => item.modulo === "REPORTES")?.submodulos || [])],
          PRODUCCION: [...(ACCESOS_SISTEMA.find((item) => item.modulo === "PRODUCCION")?.submodulos || [])],
          CONTABILIDAD: [],
          CONFIGURACION: ["CATALOGOS DE PERSONAL", "PERSONAL Y SEGURIDAD"],
        },
      };
    case "RECURSOS HUMANOS":
      return {
        modulos: ["CONFIGURACION"],
        submodulos: {
          CONFIGURACION: ["CATALOGOS DE PERSONAL", "PERSONAL Y SEGURIDAD"],
        },
      };
    case "CONTABILIDAD":
      return crearAcceso(["CONTABILIDAD", "REPORTES", "PRODUCCION"]);
    default:
      return crearAcceso(["PRODUCCION"]);
  }
};

const normalizarPersonal = (item = {}) => ({
  nombreCompleto: normalizarTexto(item?.nombreCompleto),
  telefono: (item?.telefono || "").toString().trim(),
  area: normalizarTexto(item?.area),
  cargo: normalizarTexto(item?.cargo),
  sede: normalizarTexto(item?.sede) || "PRINCIPAL",
  estado: normalizarTexto(item?.estado) || "ACTIVO",
  observacion: normalizarTexto(item?.observacion),
  creadoEn: item?.creadoEn || "",
  actualizadoEn: item?.actualizadoEn || "",
});

const normalizarUsuario = (item = {}) => ({
  correo: normalizarCorreo(item?.correo),
  nombreCompleto: normalizarTexto(item?.nombreCompleto),
  rol: normalizarTexto(item?.rol) || "PRODUCCION",
  area: normalizarTexto(item?.area) || "PRODUCCION",
  estado: normalizarTexto(item?.estado) || "ACTIVO",
  modulos: Array.from(new Set((item?.modulos || []).map(normalizarTexto).filter(Boolean))),
  submodulos: Object.fromEntries(
    Object.entries(item?.submodulos || {}).map(([modulo, lista]) => [
      normalizarTexto(modulo),
      Array.from(new Set((Array.isArray(lista) ? lista : []).map(normalizarTexto).filter(Boolean))),
    ])
  ),
  tallerAsignado: normalizarTexto(item?.tallerAsignado),
  tallerId: (item?.tallerId || "").toString().trim(),
  tallerCodigo: normalizarTexto(item?.tallerCodigo),
  observacion: normalizarTexto(item?.observacion),
  creadoEn: item?.creadoEn || "",
  actualizadoEn: item?.actualizadoEn || "",
});

export const leerPersonalSistema = () =>
  leerLista(CLAVE_PERSONAL_SISTEMA)
    .map(normalizarPersonal)
    .sort((a, b) => (a.nombreCompleto || "").localeCompare(b.nombreCompleto || ""));

export const leerUsuariosSistema = () =>
  leerLista(CLAVE_USUARIOS_SISTEMA)
    .map(normalizarUsuario)
    .sort((a, b) => (a.correo || "").localeCompare(b.correo || ""));

export const sobrescribirUsuariosSistema = (lista = []) => {
  const siguiente = (Array.isArray(lista) ? lista : [])
    .map(normalizarUsuario)
    .sort((a, b) => (a.correo || "").localeCompare(b.correo || ""));

  guardarLista(CLAVE_USUARIOS_SISTEMA, siguiente);
  actualizarAsignacionesTaller(siguiente);
  sincronizarCatalogosPersonalSeguridad();
  return siguiente;
};

export const buscarUsuarioSistema = (correo = "") => {
  const correoNormalizado = normalizarCorreo(correo);
  return leerUsuariosSistema().find((item) => item.correo === correoNormalizado) || null;
};

export const guardarPersonalSistema = (personal = {}) => {
  const nombreCompleto = normalizarTexto(personal?.nombreCompleto);
  if (!nombreCompleto) throw new Error("El nombre del personal es obligatorio.");

  const actual = leerPersonalSistema().filter((item) => item.nombreCompleto !== nombreCompleto);
  const existente = leerPersonalSistema().find((item) => item.nombreCompleto === nombreCompleto);
  const ahora = new Date().toISOString();
  const registro = {
    ...normalizarPersonal(personal),
    nombreCompleto,
    creadoEn: existente?.creadoEn || ahora,
    actualizadoEn: ahora,
  };

  guardarLista(
    CLAVE_PERSONAL_SISTEMA,
    [...actual, registro].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
  );
  sincronizarCatalogosPersonalSeguridad();
  return registro;
};

export const eliminarPersonalSistema = (nombreCompleto = "") => {
  const nombreNormalizado = normalizarTexto(nombreCompleto);
  guardarLista(
    CLAVE_PERSONAL_SISTEMA,
    leerPersonalSistema().filter((item) => item.nombreCompleto !== nombreNormalizado)
  );
  sincronizarCatalogosPersonalSeguridad();
};

const actualizarAsignacionesTaller = (usuarios = []) => {
  const data = usuarios.reduce((acumulado, item) => {
    if (item.rol === "TALLER" && item.tallerAsignado) {
      acumulado[item.correo] = item.tallerAsignado;
    }
    return acumulado;
  }, {});

  localStorage.setItem(CLAVE_ASIGNACIONES_TALLER, JSON.stringify(data));
  return data;
};

export const guardarUsuarioSistema = (usuario = {}) => {
  const correo = normalizarCorreo(usuario?.correo);
  if (!correo) throw new Error("El correo del usuario es obligatorio.");

  const usuariosActuales = leerUsuariosSistema();
  const existente = usuariosActuales.find((item) => item.correo === correo);
  const ahora = new Date().toISOString();
  const sugerido = obtenerAccesoSugeridoPorRol(usuario?.rol);
  const modulos = (usuario?.modulos || []).length ? usuario.modulos : sugerido.modulos;
  const submodulos = Object.keys(usuario?.submodulos || {}).length
    ? usuario.submodulos
    : sugerido.submodulos;

  const registro = {
    ...normalizarUsuario({
      ...usuario,
      correo,
      modulos,
      submodulos,
    }),
    creadoEn: existente?.creadoEn || ahora,
    actualizadoEn: ahora,
  };

  const siguiente = [
    ...usuariosActuales.filter((item) => item.correo !== correo),
    registro,
  ].sort((a, b) => a.correo.localeCompare(b.correo));

  guardarLista(CLAVE_USUARIOS_SISTEMA, siguiente);
  actualizarAsignacionesTaller(siguiente);
  sincronizarCatalogosPersonalSeguridad();
  return registro;
};

export const eliminarUsuarioSistema = (correo = "") => {
  const correoNormalizado = normalizarCorreo(correo);
  const siguiente = leerUsuariosSistema().filter((item) => item.correo !== correoNormalizado);
  guardarLista(CLAVE_USUARIOS_SISTEMA, siguiente);
  actualizarAsignacionesTaller(siguiente);
  sincronizarCatalogosPersonalSeguridad();
};

export const sincronizarCatalogosPersonalSeguridad = () => {
  const catalogos = leerCatalogosProduccion();
  const personal = leerPersonalSistema();
  const usuarios = leerUsuariosSistema();

  guardarCatalogosProduccion({
    ...catalogos,
    personal: Array.from(new Set([...(catalogos.personal || []), ...personal.map((item) => item.nombreCompleto)])),
    areasPersonal: Array.from(new Set([...(catalogos.areasPersonal || []), ...personal.map((item) => item.area)])),
    cargosPersonal: Array.from(new Set([...(catalogos.cargosPersonal || []), ...personal.map((item) => item.cargo)])),
    responsables: Array.from(new Set([...(catalogos.responsables || []), ...personal.map((item) => item.nombreCompleto)])),
    usuarios: Array.from(new Set([...(catalogos.usuarios || []), ...usuarios.map((item) => item.correo.toUpperCase())])),
    rolesUsuario: Array.from(new Set([...(catalogos.rolesUsuario || []), ...usuarios.map((item) => item.rol)])),
    accesosModulo: Array.from(new Set([...(catalogos.accesosModulo || []), ...usuarios.flatMap((item) => item.modulos || [])])),
    modulosSistema: Array.from(new Set([...(catalogos.modulosSistema || []), ...ACCESOS_SISTEMA.map((item) => item.modulo)])),
  });
};
