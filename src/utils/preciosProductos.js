export const CLAVE_PRECIOS_PRODUCTOS = "cynara_precios_productos";

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

const guardarLista = (clave, lista = []) => {
  localStorage.setItem(clave, JSON.stringify(lista));
};

export const normalizarTextoPrecio = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const crearFormularioPrecioProducto = () => ({
  id: "",
  modelo: "",
  precioBase: "",
  precioXL: "",
  precioXXL: "",
  observacion: "",
});

export const normalizarRegistroPrecioProducto = (item = {}) => ({
  id: item?.id || "",
  modelo: normalizarTextoPrecio(item?.modelo || ""),
  precioBase: Number(item?.precioBase || 0),
  precioXL: Number(item?.precioXL || 0),
  precioXXL: Number(item?.precioXXL || 0),
  observacion: item?.observacion || "",
  fechaActualizacion: item?.fechaActualizacion || "",
});

export const leerListaPreciosProductos = () =>
  leerListaGuardada(CLAVE_PRECIOS_PRODUCTOS).map(normalizarRegistroPrecioProducto);

export const guardarListaPreciosProductos = (lista = []) => {
  const normalizada = (lista || []).map(normalizarRegistroPrecioProducto);
  guardarLista(CLAVE_PRECIOS_PRODUCTOS, normalizada);
  return normalizada;
};

export const obtenerTarifarioPorModelo = (modelo = "", lista = []) => {
  const modeloNormalizado = normalizarTextoPrecio(modelo);
  return (
    (Array.isArray(lista) ? lista : []).find(
      (item) => normalizarTextoPrecio(item?.modelo) === modeloNormalizado,
    ) || null
  );
};

export const obtenerPrecioVentaProducto = ({
  modelo = "",
  talla = "",
  lista = [],
}) => {
  const tarifario = obtenerTarifarioPorModelo(modelo, lista);
  if (!tarifario) return 0;

  const tallaNormalizada = normalizarTextoPrecio(talla);
  if (tallaNormalizada === "XXL") {
    return Number(
      tarifario?.precioXXL || tarifario?.precioXL || tarifario?.precioBase || 0,
    );
  }
  if (tallaNormalizada === "XL") {
    return Number(tarifario?.precioXL || tarifario?.precioBase || 0);
  }
  return Number(tarifario?.precioBase || 0);
};

export const formatearResumenTarifario = (modelo = "", lista = []) => {
  const tarifario = obtenerTarifarioPorModelo(modelo, lista);
  if (!tarifario) return "Sin precio";

  const base = Number(tarifario?.precioBase || 0);
  const xl = Number(tarifario?.precioXL || 0);
  const xxl = Number(tarifario?.precioXXL || 0);

  const formatear = (valor) =>
    `S/ ${Number(valor || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return `Base ${formatear(base)} | XL ${formatear(xl || base)} | XXL ${formatear(
    xxl || xl || base,
  )}`;
};
