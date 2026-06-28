import { FiBookOpen, FiDollarSign, FiSettings, FiShield, FiHome, FiPackage, FiClipboard, FiBarChart2, FiUsers } from "react-icons/fi";

export const IDENTIDADES_VISUALES = {
  inicio: {
    clave: "inicio",
    titulo: "Inicio",
    icono: FiHome,
    acento: "#2563eb",
    fondo: "rgba(37, 99, 235, 0.14)",
  },
  produccion: {
    clave: "produccion",
    titulo: "Produccion",
    icono: FiClipboard,
    acento: "#b45309",
    fondo: "rgba(180, 83, 9, 0.14)",
  },
  talleres: {
    clave: "talleres",
    titulo: "Talleres",
    icono: FiUsers,
    acento: "#0f766e",
    fondo: "rgba(15, 118, 110, 0.14)",
  },
  almacen: {
    clave: "almacen",
    titulo: "Almacen",
    icono: FiPackage,
    acento: "#7c3aed",
    fondo: "rgba(124, 58, 237, 0.14)",
  },
  tiendas: {
    clave: "tiendas",
    titulo: "Tiendas",
    icono: FiPackage,
    acento: "#dc2626",
    fondo: "rgba(220, 38, 38, 0.14)",
  },
  contabilidad: {
    clave: "contabilidad",
    titulo: "Contabilidad",
    icono: FiDollarSign,
    acento: "#166534",
    fondo: "rgba(22, 101, 52, 0.14)",
  },
  rrhh: {
    clave: "rrhh",
    titulo: "Recursos Humanos",
    icono: FiUsers,
    acento: "#9333ea",
    fondo: "rgba(147, 51, 234, 0.14)",
  },
  reportes: {
    clave: "reportes",
    titulo: "Reportes",
    icono: FiBarChart2,
    acento: "#0f766e",
    fondo: "rgba(15, 118, 110, 0.14)",
  },
  configuracion: {
    clave: "configuracion",
    titulo: "Configuracion",
    icono: FiSettings,
    acento: "#0f766e",
    fondo: "rgba(15, 118, 110, 0.12)",
  },
  maestros: {
    clave: "maestros",
    titulo: "Maestros",
    icono: FiBookOpen,
    acento: "#0f766e",
    fondo: "rgba(15, 118, 110, 0.12)",
  },
  operacion: {
    clave: "operacion",
    titulo: "Operacion",
    icono: FiSettings,
    acento: "#b45309",
    fondo: "rgba(180, 83, 9, 0.12)",
  },
  "costos-finanzas": {
    clave: "costos-finanzas",
    titulo: "Costos y Finanzas",
    icono: FiDollarSign,
    acento: "#166534",
    fondo: "rgba(22, 101, 52, 0.12)",
  },
  seguridad: {
    clave: "seguridad",
    titulo: "Seguridad",
    icono: FiShield,
    acento: "#7c3aed",
    fondo: "rgba(124, 58, 237, 0.12)",
  },
};

export const resolverIdentidadVisualPorRuta = (ruta = "") => {
  const path = String(ruta || "").toLowerCase();

  if (path === "/") return IDENTIDADES_VISUALES.inicio;
  if (path.startsWith("/produccion")) return IDENTIDADES_VISUALES.produccion;
  if (path.startsWith("/talleres")) return IDENTIDADES_VISUALES.talleres;
  if (path.startsWith("/tiendas")) return IDENTIDADES_VISUALES.tiendas;
  if (path.startsWith("/contabilidad")) return IDENTIDADES_VISUALES.contabilidad;
  if (path.startsWith("/recursos-humanos")) return IDENTIDADES_VISUALES.rrhh;
  if (path.startsWith("/reportes")) return IDENTIDADES_VISUALES.reportes;
  if (path.startsWith("/almacen")) return IDENTIDADES_VISUALES.almacen;
  if (path.startsWith("/configurar/costos")) return IDENTIDADES_VISUALES["costos-finanzas"];
  if (path.startsWith("/configurar/personal-seguridad")) return IDENTIDADES_VISUALES.seguridad;
  if (
    path.startsWith("/configurar/empresa") ||
    path.startsWith("/configurar/clientes-proveedores") ||
    path.startsWith("/configurar/catalogo-productos") ||
    path.startsWith("/configurar/modelos-visuales") ||
    path.startsWith("/configurar/talleres")
  ) {
    return IDENTIDADES_VISUALES.maestros;
  }
  if (path.startsWith("/configurar")) return IDENTIDADES_VISUALES.configuracion;

  return IDENTIDADES_VISUALES.operacion;
};

export const resolverIdentidadVisualPorGrupo = (grupo = "") => {
  const clave = String(grupo || "").toLowerCase();
  if (clave.includes("maestro")) return IDENTIDADES_VISUALES.maestros;
  if (clave.includes("seguridad")) return IDENTIDADES_VISUALES.seguridad;
  if (clave.includes("costo")) return IDENTIDADES_VISUALES["costos-finanzas"];
  if (clave.includes("finanza")) return IDENTIDADES_VISUALES["costos-finanzas"];
  return IDENTIDADES_VISUALES.operacion;
};
