import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error(
    "Uso: node scripts/generar_modelos_seed.mjs <excel.xlsx> <salida.sql>",
  );
  process.exit(1);
}

const workbook = XLSX.readFile(inputPath);
const esFormatoMejorado = workbook.SheetNames.includes("modelos 3 letras");

const normalizarVisual = (valor) =>
  String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const normalizarClave = (valor) =>
  normalizarVisual(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizarTalla = (valor) => {
  const talla = normalizarVisual(valor);
  if (!talla || talla === "0") return null;
  if (talla === "ST") return "STANDAR";
  return talla;
};

const escaparSql = (valor) => String(valor ?? "").replace(/'/g, "''");
const textoSql = (valor) => `'${escaparSql(valor)}'`;
const jsonSql = (valor) => `${textoSql(JSON.stringify(valor))}::jsonb`;

const limpiarTokenCodigo = (valor = "") =>
  normalizarVisual(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const crearSegmentoCodigo = (valor = "", longitud = 3) => {
  const limpio = limpiarTokenCodigo(valor).replace(/\s+/g, "");
  return (limpio.slice(0, longitud) || "X").padEnd(longitud, "X");
};

const crearCodigoCortoModelo = ({
  categoria = "",
  modeloCatalogo = "",
  telaNombre = "",
  nombreModelo = "",
}) => {
  const partesNombre = limpiarTokenCodigo(nombreModelo).split(" ").filter(Boolean);
  const categoriaSeg = crearSegmentoCodigo(categoria || partesNombre[0] || "", 3);
  const modeloSeg = crearSegmentoCodigo(modeloCatalogo || partesNombre[1] || "", 3);
  const telaSeg = crearSegmentoCodigo(telaNombre || partesNombre[2] || "", 3);
  return `${categoriaSeg}${modeloSeg}${telaSeg}`;
};

const crearCodigoCortoVariante = ({
  codigoCortoModelo = "",
  color = "",
  talla = "",
}) => `${codigoCortoModelo}${crearSegmentoCodigo(color, 3)}${crearSegmentoCodigo(talla, 2)}`;

const ordenTallas = {
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
  XXXL: 7,
  STANDAR: 8,
};

const compararTallas = (a, b) => {
  const ordenA = ordenTallas[a] ?? 999;
  const ordenB = ordenTallas[b] ?? 999;
  if (ordenA !== ordenB) return ordenA - ordenB;
  return a.localeCompare(b, "es");
};

const filas = [];

if (esFormatoMejorado) {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    for (const row of rows) {
      filas.push({
        origenHoja: sheetName,
        categoria: normalizarVisual(row.Categoria),
        modeloCatalogo: normalizarVisual(row.Modelo),
        telaNombre: normalizarVisual(row.Tela),
        nombreModelo: normalizarVisual(
          row["Nombre completo"] || row["Nombre completo original"],
        ),
        color: normalizarVisual(row.Color),
        talla: row.Talla,
      });
    }
  }
} else {
  const sheetName = workbook.SheetNames.includes("Productos")
    ? "Productos"
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  for (const row of rows) {
    filas.push({
      origenHoja: sheetName,
      categoria: "",
      modeloCatalogo: "",
      telaNombre: "",
      nombreModelo: normalizarVisual(row.Nombre),
      color: normalizarVisual(row.color),
      talla: row.Talla,
    });
  }
}

const modelosMap = new Map();
const variantesMap = new Map();

let filasOmitidasTallaCero = 0;
let filasOmitidasIncompletas = 0;
let filasOmitidasColorVacio = 0;

for (const fila of filas) {
  const nombreModelo = fila.nombreModelo;
  const nombreNormalizado = normalizarClave(fila.nombreModelo);
  const colorVisualBase = normalizarVisual(fila.color);
  const colorVisual = colorVisualBase || "SIN COLOR";
  const colorNormalizado = normalizarClave(colorVisual);
  const tallaVisual = normalizarTalla(fila.talla);

  if (!nombreModelo || !nombreNormalizado || !tallaVisual) {
    if (String(fila.talla ?? "").trim() === "0") {
      filasOmitidasTallaCero += 1;
    } else {
      filasOmitidasIncompletas += 1;
    }
    continue;
  }

  if (esFormatoMejorado && !colorVisualBase) {
    filasOmitidasColorVacio += 1;
    continue;
  }

  if (!modelosMap.has(nombreNormalizado)) {
    modelosMap.set(nombreNormalizado, {
      nombreModelo,
      nombreNormalizado,
      categoria: fila.categoria,
      modeloCatalogo: fila.modeloCatalogo,
      telaNombre: fila.telaNombre,
      origenHoja: fila.origenHoja,
      registrosOrigen: 0,
      variantes: new Set(),
    });
  }

  const modelo = modelosMap.get(nombreNormalizado);
  modelo.registrosOrigen += 1;
  if (!modelo.categoria && fila.categoria) modelo.categoria = fila.categoria;
  if (!modelo.modeloCatalogo && fila.modeloCatalogo) {
    modelo.modeloCatalogo = fila.modeloCatalogo;
  }
  if (!modelo.telaNombre && fila.telaNombre) modelo.telaNombre = fila.telaNombre;

  const claveVariante = [
    nombreNormalizado,
    colorNormalizado,
    normalizarClave(tallaVisual),
  ].join("||");

  modelo.variantes.add(claveVariante);

  if (!variantesMap.has(claveVariante)) {
    variantesMap.set(claveVariante, {
      nombreModelo,
      nombreNormalizado,
      categoria: fila.categoria,
      modeloCatalogo: fila.modeloCatalogo,
      telaNombre: fila.telaNombre,
      origenHoja: fila.origenHoja,
      color: colorVisual,
      colorNormalizado,
      talla: tallaVisual,
      tallaNormalizada: normalizarClave(tallaVisual),
      registrosOrigen: 0,
    });
  }

  variantesMap.get(claveVariante).registrosOrigen += 1;
}

const modelos = [...modelosMap.values()]
  .map((modelo) => ({
    ...modelo,
    totalVariantes: modelo.variantes.size,
  }))
  .sort((a, b) => a.nombreModelo.localeCompare(b.nombreModelo, "es"));

const codigoPorModelo = new Map();
const codigoCortoPorModelo = new Map();
for (const [index, modelo] of modelos.entries()) {
  const codigoModelo = `MOD-${String(index + 1).padStart(4, "0")}`;
  const codigoCortoModelo = crearCodigoCortoModelo({
    categoria: modelo.categoria,
    modeloCatalogo: modelo.modeloCatalogo,
    telaNombre: modelo.telaNombre,
    nombreModelo: modelo.nombreModelo,
  });
  codigoPorModelo.set(modelo.nombreNormalizado, codigoModelo);
  codigoCortoPorModelo.set(modelo.nombreNormalizado, codigoCortoModelo);
}

const variantes = [...variantesMap.values()].sort((a, b) => {
  const modeloComp = a.nombreModelo.localeCompare(b.nombreModelo, "es");
  if (modeloComp !== 0) return modeloComp;
  const colorComp = a.color.localeCompare(b.color, "es");
  if (colorComp !== 0) return colorComp;
  return compararTallas(a.talla, b.talla);
});

const bloques = [];
bloques.push(`-- Auto-generado desde ${path.basename(inputPath)}`);
bloques.push(`-- Hojas origen: ${workbook.SheetNames.join(", ")}`);
bloques.push(`-- Filas leidas: ${filas.length}`);
bloques.push(`-- Modelos unicos: ${modelos.length}`);
bloques.push(`-- Variantes unicas: ${variantes.length}`);
bloques.push(`-- Filas omitidas por talla 0: ${filasOmitidasTallaCero}`);
bloques.push(
  `-- Filas omitidas por datos incompletos: ${filasOmitidasIncompletas}`,
);
bloques.push(`-- Filas omitidas por color vacio: ${filasOmitidasColorVacio}`);
bloques.push("");
bloques.push("begin;");
bloques.push("");
bloques.push("delete from public.modelos_producto_variantes;");
bloques.push("delete from public.modelos_producto;");
bloques.push("");

const filasModelos = modelos.map((modelo) => {
  const metadata = {
    origen: path.basename(inputPath),
    hoja_origen: modelo.origenHoja,
    registros_origen: modelo.registrosOrigen,
    variantes_unicas: modelo.totalVariantes,
  };

  return `  (${textoSql(
    codigoPorModelo.get(modelo.nombreNormalizado),
  )}, ${textoSql(
    codigoCortoPorModelo.get(modelo.nombreNormalizado),
  )}, ${textoSql(modelo.nombreModelo)}, ${textoSql(
    modelo.nombreNormalizado,
  )}, ${textoSql(modelo.categoria)}, ${textoSql(
    modelo.modeloCatalogo,
  )}, ${textoSql(modelo.telaNombre)}, ${textoSql(
    modelo.origenHoja,
  )}, 'ACTIVO', ${jsonSql(metadata)})`;
});

bloques.push(
  "with fuente (codigo_modelo, codigo_corto, nombre_modelo, nombre_normalizado, categoria, modelo_catalogo, tela_nombre, origen_carga, estado, metadata) as (",
);
bloques.push("values");
bloques.push(filasModelos.join(",\n"));
bloques.push(")");
bloques.push(
  "insert into public.modelos_producto (codigo_modelo, codigo_corto, nombre_modelo, nombre_normalizado, categoria, modelo_catalogo, tela_nombre, origen_carga, estado, metadata)",
);
bloques.push(
  "select codigo_modelo, codigo_corto, nombre_modelo, nombre_normalizado, categoria, modelo_catalogo, tela_nombre, origen_carga, estado, metadata from fuente",
);
bloques.push("on conflict (nombre_normalizado) do update");
bloques.push("set codigo_modelo = excluded.codigo_modelo,");
bloques.push("    codigo_corto = excluded.codigo_corto,");
bloques.push("    nombre_modelo = excluded.nombre_modelo,");
bloques.push("    categoria = excluded.categoria,");
bloques.push("    modelo_catalogo = excluded.modelo_catalogo,");
bloques.push("    tela_nombre = excluded.tela_nombre,");
bloques.push("    origen_carga = excluded.origen_carga,");
bloques.push("    estado = excluded.estado,");
bloques.push("    metadata = excluded.metadata;");
bloques.push("");

const filasVariantes = variantes.map((variante, index) => {
  const metadata = {
    origen: path.basename(inputPath),
    hoja_origen: variante.origenHoja,
    registros_origen: variante.registrosOrigen,
  };

  const codigoCortoModelo = codigoCortoPorModelo.get(variante.nombreNormalizado);

  return `  (${textoSql(
    `VAR-${String(index + 1).padStart(6, "0")}`,
  )}, ${textoSql(
    crearCodigoCortoVariante({
      codigoCortoModelo,
      color: variante.color,
      talla: variante.talla,
    }),
  )}, ${textoSql(variante.nombreNormalizado)}, ${textoSql(
    variante.color,
  )}, ${textoSql(variante.colorNormalizado)}, ${textoSql(
    variante.talla,
  )}, ${textoSql(variante.tallaNormalizada)}, ${textoSql(
    `${variante.nombreModelo} | ${variante.color} | ${variante.talla}`,
  )}, ${textoSql(variante.origenHoja)}, 'ACTIVO', ${jsonSql(metadata)})`;
});

bloques.push(
  "with fuente (codigo_variante, codigo_corto, nombre_normalizado, color, color_normalizado, talla, talla_normalizada, descripcion_variante, origen_carga, estado, metadata) as (",
);
bloques.push("values");
bloques.push(filasVariantes.join(",\n"));
bloques.push(")");
bloques.push(
  "insert into public.modelos_producto_variantes (modelo_id, codigo_modelo, codigo_variante, codigo_corto, nombre_modelo, color, color_normalizado, talla, talla_normalizada, descripcion_variante, origen_carga, estado, metadata)",
);
bloques.push("select");
bloques.push("  m.id,");
bloques.push("  m.codigo_modelo,");
bloques.push("  f.codigo_variante,");
bloques.push("  f.codigo_corto,");
bloques.push("  m.nombre_modelo,");
bloques.push("  f.color,");
bloques.push("  f.color_normalizado,");
bloques.push("  f.talla,");
bloques.push("  f.talla_normalizada,");
bloques.push("  f.descripcion_variante,");
bloques.push("  f.origen_carga,");
bloques.push("  f.estado,");
bloques.push("  f.metadata");
bloques.push("from fuente f");
bloques.push(
  "join public.modelos_producto m on m.nombre_normalizado = f.nombre_normalizado",
);
bloques.push(
  "on conflict (modelo_id, color_normalizado, talla_normalizada) do update",
);
bloques.push("set codigo_modelo = excluded.codigo_modelo,");
bloques.push("    codigo_variante = excluded.codigo_variante,");
bloques.push("    codigo_corto = excluded.codigo_corto,");
bloques.push("    nombre_modelo = excluded.nombre_modelo,");
bloques.push("    color = excluded.color,");
bloques.push("    talla = excluded.talla,");
bloques.push("    descripcion_variante = excluded.descripcion_variante,");
bloques.push("    origen_carga = excluded.origen_carga,");
bloques.push("    estado = excluded.estado,");
bloques.push("    metadata = excluded.metadata;");
bloques.push("");
bloques.push(
  "insert into public.historial_versiones (version, fecha, titulo, detalle)",
);
bloques.push("values (");
bloques.push(
  "  'Cynara v1.0.2', current_date, 'Recarga maestra de catalogo', 'Se reemplazo la carga inicial del catalogo por modelos mejorado.xlsx con codigo unico, codigo corto y variantes limpias.'",
);
bloques.push(");");
bloques.push("");
bloques.push("commit;");
bloques.push("");

fs.writeFileSync(outputPath, bloques.join("\n"), "utf8");

console.log(
  JSON.stringify(
    {
      archivo_salida: outputPath,
      hojas: workbook.SheetNames,
      filas_leidas: filas.length,
      modelos_unicos: modelos.length,
      variantes_unicas: variantes.length,
      filas_omitidas_talla_0: filasOmitidasTallaCero,
      filas_omitidas_color_vacio: filasOmitidasColorVacio,
      filas_omitidas_incompletas: filasOmitidasIncompletas,
    },
    null,
    2,
  ),
);
