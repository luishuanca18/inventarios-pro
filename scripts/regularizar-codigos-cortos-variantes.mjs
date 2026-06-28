import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const workspace = process.cwd();
const envPath = path.join(workspace, ".env");

const leerVariablesEntorno = () => {
  const contenido = fs.readFileSync(envPath, "utf8");
  const variables = {};

  contenido.split(/\r?\n/).forEach((linea) => {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) {
      return;
    }

    const separador = limpia.indexOf("=");
    if (separador <= 0) {
      return;
    }

    const clave = limpia.slice(0, separador).trim();
    const valor = limpia.slice(separador + 1).trim().replace(/^['"]|['"]$/g, "");
    variables[clave] = valor;
  });

  return variables;
};

const env = leerVariablesEntorno();
const supabaseUrl = env.VITE_SUPABASE_URL || env.VITE_APP_SUPABASE_URL;
const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY || env.VITE_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan las credenciales de Supabase en .env");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const normalizarCodigoCorto = (valor = "", limite = 40) =>
  normalizarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, limite);

const limpiarTokenCodigo = (valor = "") =>
  normalizarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const crearSegmentoCodigo = (valor = "", longitud = 3) => {
  const limpio = limpiarTokenCodigo(valor).replace(/\s+/g, "");
  return (limpio.slice(0, longitud) || "X").padEnd(longitud, "X");
};

const crearHashCodigoCorto = (texto = "", longitud = 3) => {
  const base = limpiarTokenCodigo(texto).replace(/\s+/g, "") || "X";
  let hash = 0;

  for (let indice = 0; indice < base.length; indice += 1) {
    hash = (hash * 31 + base.charCodeAt(indice)) % 1679616;
  }

  return hash
    .toString(36)
    .toUpperCase()
    .padStart(longitud, "0")
    .slice(-longitud);
};

const crearCodigoCortoVariante = ({
  codigoCortoModelo = "",
  color = "",
  talla = "",
}) =>
  `${normalizarCodigoCorto(codigoCortoModelo, 30)}${crearSegmentoCodigo(
    color,
    3,
  )}${crearSegmentoCodigo(talla, 2)}${crearHashCodigoCorto(
    `${color}|${talla}`,
    3,
  )}`.slice(0, 40);

const listarTodo = async (tabla, columnas = "*") => {
  const acumulado = [];
  let desde = 0;
  const tamano = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .range(desde, desde + tamano - 1);

    if (error) {
      throw new Error(`${tabla}: ${error.message}`);
    }

    const filas = Array.isArray(data) ? data : [];
    acumulado.push(...filas);

    if (filas.length < tamano) {
      break;
    }

    desde += tamano;
  }

  return acumulado;
};

const actualizarEnLotes = async (tabla, filas = []) => {
  const tamano = 200;

  for (let inicio = 0; inicio < filas.length; inicio += tamano) {
    const bloque = filas.slice(inicio, inicio + tamano);
    const { error } = await supabase.from(tabla).upsert(bloque, {
      onConflict: "id",
    });

    if (error) {
      throw new Error(`${tabla}: ${error.message}`);
    }
  }
};

const modelos = await listarTodo(
  "modelos_producto",
  "id,codigo_modelo,codigo_corto,nombre_modelo",
);
const variantes = await listarTodo(
  "modelos_producto_variantes",
  "id,modelo_id,codigo_variante,codigo_corto,color,talla,metadata",
);
const productos = await listarTodo(
  "productos_terminados_stock",
  "clave_producto,codigo_producto,codigo_corto,payload",
);

const modelosPorId = new Map(modelos.map((item) => [item.id, item]));
const variantesActualizadas = [];
const mapaCodigoPorVariante = new Map();

for (const variante of variantes) {
  const modelo = modelosPorId.get(variante.modelo_id);
  if (!modelo) {
    continue;
  }

  const codigoNuevo = crearCodigoCortoVariante({
    codigoCortoModelo: modelo.codigo_corto || "",
    color: variante.color || "",
    talla: variante.talla || "",
  });

  mapaCodigoPorVariante.set(variante.codigo_variante, codigoNuevo);
  mapaCodigoPorVariante.set(variante.id, codigoNuevo);

  if ((variante.codigo_corto || "") !== codigoNuevo) {
    variantesActualizadas.push({
      id: variante.id,
      codigo_corto: codigoNuevo,
      metadata: {
        ...(variante.metadata || {}),
        regularizado_codigo_corto: true,
      },
    });
  }
}

const productosActualizados = [];

for (const producto of productos) {
  const payload = producto.payload && typeof producto.payload === "object"
    ? { ...producto.payload }
    : {};
  const claveVariante =
    payload.codigoVariante ||
    payload.varianteId ||
    producto.codigo_producto ||
    "";
  const codigoNuevo = mapaCodigoPorVariante.get(claveVariante);

  if (!codigoNuevo) {
    continue;
  }

  const codigoActual = producto.codigo_corto || payload.codigoCorto || "";
  if (codigoActual === codigoNuevo) {
    continue;
  }

  payload.codigoCorto = codigoNuevo;
  productosActualizados.push({
    clave_producto: producto.clave_producto,
    codigo_corto: codigoNuevo,
    payload,
  });
}

if (variantesActualizadas.length > 0) {
  await actualizarEnLotes("modelos_producto_variantes", variantesActualizadas);
}

if (productosActualizados.length > 0) {
  const tamano = 200;
  for (let inicio = 0; inicio < productosActualizados.length; inicio += tamano) {
    const bloque = productosActualizados.slice(inicio, inicio + tamano);
    const { error } = await supabase
      .from("productos_terminados_stock")
      .upsert(bloque, { onConflict: "clave_producto" });

    if (error) {
      throw new Error(`productos_terminados_stock: ${error.message}`);
    }
  }
}

console.log(
  JSON.stringify(
    {
      variantesRevisadas: variantes.length,
      variantesActualizadas: variantesActualizadas.length,
      productosTerminadosActualizados: productosActualizados.length,
    },
    null,
    2,
  ),
);
