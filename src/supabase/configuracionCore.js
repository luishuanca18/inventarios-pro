import { supabase } from "./supabase.config.jsx";
import {
  guardarFichaTaller,
  leerFichasTalleres,
  normalizarFichaTallerLocal,
} from "../utils/fichasTalleres.js";
import {
  guardarListaPreciosProductos,
  leerListaPreciosProductos,
  normalizarRegistroPrecioProducto,
  normalizarTextoPrecio,
} from "../utils/preciosProductos.js";
import {
  crearFormularioCostoTaller,
  guardarCostosTallerModelo,
  leerCostosTallerModelo,
  normalizarRegistroCostoTaller,
  normalizarTextoCosto,
} from "../utils/costosTaller.js";
import {
  crearFormularioCostoTercero,
  guardarCostosTerceros,
  leerCostosTerceros,
  normalizarRegistroCostoTercero,
  normalizarTextoCostoTercero,
} from "../utils/costosTerceros.js";
import {
  crearFormularioSueldoPersonal,
  guardarSueldosPersonal,
  leerSueldosPersonal,
  normalizarRegistroSueldoPersonal,
} from "../utils/sueldosPersonal.js";
import {
  guardarListaModelosVisuales,
  guardarListaModelosVisualesColor,
  leerModelosVisualesColor,
  leerModelosVisuales,
  normalizarFichaVisual,
} from "../utils/modelosVisuales.js";
import {
  guardarFichasElasticosModelo,
  leerFichasElasticosModelo,
  normalizarFichaElastico,
} from "../utils/elasticosModelo.js";
import {
  crearConfiguracionVentasImpresionBase,
  guardarConfiguracionVentasImpresion,
  leerConfiguracionVentasImpresion,
} from "../utils/configuracionVentasImpresion.js";
import { sobrescribirUsuariosSistema } from "../utils/seguridadUsuarios.js";
import {
  guardarCatalogosProduccion,
  leerCatalogosProduccion,
} from "../utils/catalogosProduccion.js";

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

const crearSegmentoColorOperativo = (color = "", limite = 6) => {
  const palabras = limpiarTokenCodigo(color).split(" ").filter(Boolean);

  if (palabras.length === 0) {
    return "COLOR";
  }

  if (palabras.length === 1) {
    return palabras[0].slice(0, limite);
  }

  return palabras
    .map((palabra) => palabra.slice(0, 3))
    .join("")
    .slice(0, limite);
};

const crearCodigoCortoModeloConfiguracion = ({
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

const crearCodigoCortoVarianteConfiguracion = ({
  codigoCortoModelo = "",
  color = "",
  talla = "",
}) =>
  normalizarCodigoCorto(
    `${codigoCortoModelo}${crearSegmentoColorOperativo(color, 6)}${limpiarTokenCodigo(talla).replace(/\s+/g, "").slice(0, 2) || "S"}`,
    40,
  );

const resolverCodigoCortoVarianteUnico = ({
  codigoBase = "",
  variantesExistentes = [],
  varianteIdActual = "",
}) => {
  const base = normalizarCodigoCorto(codigoBase, 38);
  const usados = new Set(
    (Array.isArray(variantesExistentes) ? variantesExistentes : [])
      .filter((item) => item?.id !== varianteIdActual)
      .map((item) => normalizarCodigoCorto(item?.codigoCorto || item?.codigo_corto || "", 40))
      .filter(Boolean),
  );

  if (!base || !usados.has(base)) {
    return base;
  }

  for (let correlativo = 1; correlativo <= 99; correlativo += 1) {
    const sufijo = String(correlativo).padStart(2, "0");
    const candidato = `${base}${sufijo}`.slice(0, 40);
    if (!usados.has(candidato)) {
      return candidato;
    }
  }

  return `${base}99`.slice(0, 40);
};

const listarTodoPaginado = async (crearConsulta, tamanoPagina = 1000) => {
  const acumulado = [];
  let desde = 0;

  while (true) {
    const hasta = desde + tamanoPagina - 1;
    const { data, error } = await crearConsulta().range(desde, hasta);

    if (error) {
      throw new Error(error.message);
    }

    const bloque = Array.isArray(data) ? data : [];
    acumulado.push(...bloque);

    if (bloque.length < tamanoPagina) {
      break;
    }

    desde += tamanoPagina;
  }

  return acumulado;
};

const mapearTallerDesdeSupabase = (item = {}) =>
  normalizarFichaTallerLocal({
    id: item?.id || "",
    codigoTaller: item?.codigo_taller || "",
    nombreTaller: item?.nombre || "",
    responsable: item?.responsable || "",
    telefonoPrincipal: item?.telefono_1 || "",
    telefonoSecundario: item?.telefono_2 || "",
    direccion: item?.direccion || "",
    referencia: item?.referencia || "",
    especialidad: item?.especialidad || "",
    tiposMaquinas: Array.isArray(item?.tipos_maquina)
      ? item.tipos_maquina.join(", ")
      : item?.tipos_maquina || "",
    capacidadDiaria: item?.capacidad_diaria ?? "",
    tiempoRespuesta:
      item?.tiempo_respuesta_dias !== null &&
      item?.tiempo_respuesta_dias !== undefined
        ? String(item.tiempo_respuesta_dias)
        : "",
    estado: item?.estado || "EN PRUEBA",
    correoUsuario: item?.usuario_correo || item?.metadata?.correoUsuario || "",
    nombreUsuario: item?.usuario_nombre || item?.metadata?.nombreUsuario || "",
    accesoEstado: item?.acceso_estado || item?.metadata?.accesoEstado || "SIN_CUENTA",
    observacion: item?.observacion || "",
    creadoEn: item?.fecharegistro || "",
    actualizadoEn: item?.fechaactualizacion || "",
  });

const crearCodigoTallerSiguiente = (lista = []) => {
  const maximo = lista.reduce((mayor, item) => {
    const texto = (item?.codigoTaller || item?.codigo_taller || "").toString().trim().toUpperCase();
    const coincidencia = texto.match(/^TAL-(\d+)$/);
    const numero = coincidencia ? Number(coincidencia[1]) : 0;
    return Number.isFinite(numero) && numero > mayor ? numero : mayor;
  }, 0);

  return `TAL-${String(maximo + 1).padStart(4, "0")}`;
};

const mapearTallerASupabase = (ficha = {}) => ({
  codigo_taller: normalizarTexto(ficha?.codigoTaller) || null,
  nombre: normalizarTexto(ficha?.nombreTaller),
  responsable: normalizarTexto(ficha?.responsable),
  telefono_1: (ficha?.telefonoPrincipal || "").toString().trim(),
  telefono_2: (ficha?.telefonoSecundario || "").toString().trim(),
  direccion: normalizarTexto(ficha?.direccion),
  referencia: normalizarTexto(ficha?.referencia),
  especialidad: normalizarTexto(ficha?.especialidad),
  tipos_maquina: normalizarTexto(ficha?.tiposMaquinas)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  capacidad_diaria: Number(ficha?.capacidadDiaria || 0),
  tiempo_respuesta_dias: Number(ficha?.tiempoRespuesta || 0),
  estado: normalizarTexto(ficha?.estado) || "EN PRUEBA",
  usuario_correo: (ficha?.correoUsuario || "").toString().trim().toLowerCase(),
  usuario_nombre: normalizarTexto(ficha?.nombreUsuario),
  acceso_estado: normalizarTexto(ficha?.accesoEstado) || "SIN_CUENTA",
  observacion: normalizarTexto(ficha?.observacion),
  metadata: {
    correoUsuario: (ficha?.correoUsuario || "").toString().trim().toLowerCase(),
    nombreUsuario: normalizarTexto(ficha?.nombreUsuario),
    accesoEstado: normalizarTexto(ficha?.accesoEstado) || "SIN_CUENTA",
  },
});

const mapearPrecioDesdeSupabase = (item = {}) =>
  normalizarRegistroPrecioProducto({
    id: item?.id || "",
    modelo: item?.modelo || "",
    precioBase: Number(item?.precio_base || 0),
    precioXL: Number(item?.precio_xl || 0),
    precioXXL: Number(item?.precio_xxl || 0),
    observacion: item?.observacion || "",
    fechaActualizacion:
      item?.fechaactualizacion?.slice?.(0, 10) ||
      item?.fecharegistro?.slice?.(0, 10) ||
      "",
  });

const mapearPrecioASupabase = (item = {}) => ({
  modelo: normalizarTextoPrecio(item?.modelo),
  precio_base: Number(item?.precioBase || 0),
  precio_xl: Number(item?.precioXL || 0),
  precio_xxl: Number(item?.precioXXL || 0),
  observacion: item?.observacion || "",
});

const mapearCostoTallerDesdeSupabase = (item = {}) =>
  normalizarRegistroCostoTaller({
    id: item?.id || "",
    modelo: item?.modelo || "",
    codigoModelo: item?.codigo_modelo || "",
    nombreTaller: item?.nombre_taller || "",
    costoUnitario: Number(item?.costo_unitario || 0),
    moneda: item?.moneda || "PEN",
    observacion: item?.observacion || "",
    estado: item?.estado || "ACTIVO",
    fechaActualizacion:
      item?.fechaactualizacion?.slice?.(0, 10) ||
      item?.fecharegistro?.slice?.(0, 10) ||
      "",
  });

const mapearCostoTallerASupabase = (item = {}) => ({
  modelo: normalizarTextoCosto(item?.modelo || ""),
  codigo_modelo: normalizarTextoCosto(item?.codigoModelo || item?.modelo || ""),
  nombre_taller: normalizarTextoCosto(item?.nombreTaller || ""),
  costo_unitario: Number(item?.costoUnitario || 0),
  moneda: normalizarTextoCosto(item?.moneda || "PEN") || "PEN",
  observacion: item?.observacion || "",
  estado: normalizarTextoCosto(item?.estado || "ACTIVO") || "ACTIVO",
});

const mapearCostoTerceroDesdeSupabase = (item = {}) =>
  normalizarRegistroCostoTercero({
    id: item?.id || "",
    proceso: item?.proceso || "MULTIAGUJA",
    cantidadAgujas: item?.cantidad_agujas ?? "",
    nombreTaller: item?.nombre_taller || "",
    costoUnitario: Number(item?.costo_unitario || 0),
    moneda: item?.moneda || "PEN",
    observacion: item?.observacion || "",
    estado: item?.estado || "ACTIVO",
    fechaActualizacion:
      item?.fechaactualizacion?.slice?.(0, 10) ||
      item?.fecharegistro?.slice?.(0, 10) ||
      "",
  });

const mapearCostoTerceroASupabase = (item = {}) => ({
  proceso: normalizarTextoCostoTercero(item?.proceso || "MULTIAGUJA") || "MULTIAGUJA",
  cantidad_agujas:
    item?.cantidadAgujas === "" || item?.cantidadAgujas === undefined || item?.cantidadAgujas === null
      ? null
      : Number(item?.cantidadAgujas || 0),
  nombre_taller: normalizarTextoCostoTercero(item?.nombreTaller || ""),
  costo_unitario: Number(item?.costoUnitario || 0),
  moneda: normalizarTextoCostoTercero(item?.moneda || "PEN") || "PEN",
  observacion: item?.observacion || "",
  estado: normalizarTextoCostoTercero(item?.estado || "ACTIVO") || "ACTIVO",
});

const mapearSueldoPersonalDesdeSupabase = (item = {}) =>
  normalizarRegistroSueldoPersonal({
    id: item?.id || "",
    clave: item?.clave || "",
    correo: item?.correo || "",
    nombrePersonal: item?.nombre_personal || "",
    cargo: item?.cargo || "",
    area: item?.area || "",
    sueldoMensual: Number(item?.sueldo_mensual || 0),
    moneda: item?.moneda || "PEN",
    fechaInicio: item?.fecha_inicio || "",
    estado: item?.estado || "ACTIVO",
    observacion: item?.observacion || "",
    fechaActualizacion:
      item?.fechaactualizacion?.slice?.(0, 10) ||
      item?.fecharegistro?.slice?.(0, 10) ||
      "",
  });

const mapearSueldoPersonalASupabase = (item = {}) => {
  const normalizado = normalizarRegistroSueldoPersonal(item);
  return {
    clave: normalizado.clave,
    correo: normalizado.correo,
    nombre_personal: normalizado.nombrePersonal,
    cargo: normalizado.cargo,
    area: normalizado.area,
    sueldo_mensual: Number(normalizado.sueldoMensual || 0),
    moneda: normalizado.moneda || "PEN",
    fecha_inicio: normalizado.fechaInicio || null,
    estado: normalizado.estado || "ACTIVO",
    observacion: normalizado.observacion || "",
  };
};

const normalizarSubmodulosUsuario = (valor = {}) => {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};

  return Object.fromEntries(
    Object.entries(valor).map(([modulo, lista]) => [
      normalizarTexto(modulo),
      Array.from(
        new Set((Array.isArray(lista) ? lista : []).map(normalizarTexto).filter(Boolean)),
      ),
    ]),
  );
};

const crearNombreVisibleDesdeCorreo = (correo = "") => {
  const localPart = (correo || "").toString().trim().toLowerCase().split("@")[0] || "";
  const base = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return "";

  return normalizarTexto(base.replace(/\b\w/g, (letra) => letra.toUpperCase()));
};

const mapearUsuarioSistemaDesdeSupabase = (item = {}) => ({
  idauth: item?.idauth ? String(item.idauth) : "",
  correo: (item?.correo || "").toString().trim().toLowerCase(),
  nombreCompleto: normalizarTexto(item?.nombre || item?.nombres || ""),
  rol: normalizarTexto(item?.tipouser || "PRODUCCION"),
  area: normalizarTexto(item?.area || "PRODUCCION"),
  sede: normalizarTexto(item?.sede || "PRINCIPAL"),
  estado: normalizarTexto(item?.estado || "ACTIVO"),
  modulos: Array.from(
    new Set((Array.isArray(item?.modulos) ? item.modulos : []).map(normalizarTexto).filter(Boolean)),
  ),
  submodulos: normalizarSubmodulosUsuario(item?.submodulos || {}),
  tallerAsignado: normalizarTexto(
    item?.metadata?.tallerAsignado || item?.tallerAsignado || item?.taller_asignado || "",
  ),
  tallerId:
    (item?.metadata?.tallerId || item?.taller_id || item?.tallerId || "")
      .toString()
      .trim(),
  tallerCodigo: normalizarTexto(
    item?.metadata?.tallerCodigo || item?.taller_codigo || item?.tallerCodigo || "",
  ),
  accesoSistemaCreado:
    item?.metadata?.accesoSistemaCreado === true ||
    String(item?.idauth || "").trim().length > 0,
  observacion: normalizarTexto(item?.metadata?.observacion || item?.observacion || ""),
  creadoEn: item?.fecharegistro || "",
  actualizadoEn: item?.fechaactualizacion || "",
});

const mapearUsuarioSistemaASupabase = (item = {}, existente = null) => {
  const correo = (item?.correo || existente?.correo || "").toString().trim().toLowerCase();
  const nombreCompleto = normalizarTexto(item?.nombreCompleto || existente?.nombreCompleto || "");
  const rol = normalizarTexto(item?.rol || existente?.rol || "PRODUCCION");
  const area = normalizarTexto(item?.area || existente?.area || "PRODUCCION");
  const sede = normalizarTexto(item?.sede || existente?.sede || "PRINCIPAL");
  const estado = normalizarTexto(item?.estado || existente?.estado || "ACTIVO");
  const modulos = Array.from(
    new Set((item?.modulos || existente?.modulos || []).map(normalizarTexto).filter(Boolean)),
  );
  const submodulos = normalizarSubmodulosUsuario(item?.submodulos || existente?.submodulos || {});
  const tallerAsignado = normalizarTexto(item?.tallerAsignado || existente?.tallerAsignado || "");
  const tallerId = (item?.tallerId || existente?.tallerId || "").toString().trim();
  const tallerCodigo = normalizarTexto(item?.tallerCodigo || existente?.tallerCodigo || "");
  const accesoSistemaCreado =
    item?.metadata?.accesoSistemaCreado === true ||
    existente?.metadata?.accesoSistemaCreado === true ||
    String(existente?.idauth || item?.idauth || "").trim().length > 0;
  const observacion = normalizarTexto(item?.observacion || existente?.observacion || "");

  return {
    idauth: existente?.idauth ? String(existente.idauth) : item?.idauth ? String(item.idauth) : "",
    nombre: nombreCompleto,
    nombres: nombreCompleto || "GENERICO",
    correo,
    telefono: item?.telefono ?? existente?.telefono ?? "-",
    area,
    sede,
    estado,
    tipouser: rol,
    modulos,
    submodulos,
    metadata: {
      ...(existente?.metadata || {}),
      ...(item?.metadata || {}),
      tallerAsignado,
      tallerId,
      tallerCodigo,
      accesoSistemaCreado,
      observacion,
    },
    fecharegistro:
      existente?.fecharegistro ||
      item?.fecharegistro ||
      new Date().toISOString().slice(0, 10),
    nro_doc: existente?.nro_doc || item?.nro_doc || "-",
    direccion: existente?.direccion || item?.direccion || "-",
    tipodoc: existente?.tipodoc || item?.tipodoc || "-",
  };
};

const sincronizarTallerDesdeCuentaUsuario = async (registro = {}) => {
  const rol = normalizarTexto(registro?.rol || registro?.tipouser || "");
  if (rol !== "TALLER") return;

  const metadata = registro?.metadata || {};
  const tallerId = (metadata?.tallerId || registro?.taller_id || registro?.tallerId || "").toString().trim();
  const tallerCodigo = normalizarTexto(
    metadata?.tallerCodigo || registro?.taller_codigo || registro?.tallerCodigo || "",
  );
  const tallerAsignado = normalizarTexto(
    metadata?.tallerAsignado || registro?.taller_asignado || registro?.tallerAsignado || "",
  );
  const correo = (registro?.correo || "").toString().trim().toLowerCase();
  const nombreUsuario = normalizarTexto(registro?.nombre || registro?.nombres || "");
  const accesoSistemaCreado =
    metadata?.accesoSistemaCreado === true || String(registro?.idauth || "").trim().length > 0;
  const estadoUsuario = normalizarTexto(registro?.estado || "ACTIVO");
  const accesoEstado = accesoSistemaCreado
    ? estadoUsuario === "BLOQUEADO"
      ? "BLOQUEADO"
      : "ACTIVO"
    : "SIN_CUENTA";

  let consulta = supabase.from("talleres").update({
    usuario_correo: correo,
    usuario_nombre: nombreUsuario,
    acceso_estado: accesoEstado,
    metadata: {
      correoUsuario: correo,
      nombreUsuario,
      accesoEstado,
    },
  });

  if (tallerId) {
    consulta = consulta.eq("id", tallerId);
  } else if (tallerCodigo) {
    consulta = consulta.eq("codigo_taller", tallerCodigo);
  } else if (tallerAsignado) {
    consulta = consulta.eq("nombre", tallerAsignado);
  } else {
    return;
  }

  const { error } = await consulta;
  if (error) {
    throw new Error(error.message);
  }
};

const limpiarAccesoTallerDesdeCuentaUsuario = async (registro = {}) => {
  const rol = normalizarTexto(registro?.rol || registro?.tipouser || "");
  if (rol !== "TALLER") return;

  const metadata = registro?.metadata || {};
  const tallerId = (metadata?.tallerId || registro?.taller_id || registro?.tallerId || "").toString().trim();
  const tallerCodigo = normalizarTexto(
    metadata?.tallerCodigo || registro?.taller_codigo || registro?.tallerCodigo || "",
  );
  const tallerAsignado = normalizarTexto(
    metadata?.tallerAsignado || registro?.taller_asignado || registro?.tallerAsignado || "",
  );

  let consulta = supabase.from("talleres").update({
    usuario_correo: "",
    usuario_nombre: "",
    acceso_estado: "SIN_CUENTA",
    metadata: {
      correoUsuario: "",
      nombreUsuario: "",
      accesoEstado: "SIN_CUENTA",
    },
  });

  if (tallerId) {
    consulta = consulta.eq("id", tallerId);
  } else if (tallerCodigo) {
    consulta = consulta.eq("codigo_taller", tallerCodigo);
  } else if (tallerAsignado) {
    consulta = consulta.eq("nombre", tallerAsignado);
  } else {
    return;
  }

  const { error } = await consulta;
  if (error) {
    throw new Error(error.message);
  }
};

const normalizarTallaProducto = (valor = "") => {
  const talla = normalizarTexto(valor);
  if (!talla || talla === "0") return "";
  if (talla === "ST") return "STANDAR";
  return talla;
};

const normalizarColorProducto = (valor = "") => {
  const color = normalizarTexto(valor);
  return color || "SIN COLOR";
};

const inferirPartesModeloDesdeNombre = (nombreModelo = "") => {
  const nombre = normalizarTexto(nombreModelo);
  const palabras = nombre.split(" ").filter(Boolean);

  if (palabras.length === 0) {
    return {
      categoria: "",
      modeloCatalogo: "",
      telaNombre: "",
    };
  }

  if (palabras.length === 1) {
    return {
      categoria: palabras[0],
      modeloCatalogo: "",
      telaNombre: "",
    };
  }

  if (palabras.length === 2) {
    return {
      categoria: palabras[0],
      modeloCatalogo: palabras[1],
      telaNombre: "",
    };
  }

  return {
    categoria: palabras[0],
    modeloCatalogo: palabras[1],
    telaNombre: palabras.slice(2).join(" "),
  };
};

const mapearModeloProductoDesdeSupabase = (item = {}) => {
  const nombreModelo = item?.nombre_modelo || "";
  const inferido = inferirPartesModeloDesdeNombre(nombreModelo);

  return {
    id: item?.id || "",
    codigoModelo: item?.codigo_modelo || "",
    codigoCorto: item?.codigo_corto || "",
    nombreModelo,
    nombreNormalizado: item?.nombre_normalizado || "",
    categoria: item?.categoria || inferido.categoria || "",
    modeloCatalogo: item?.modelo_catalogo || inferido.modeloCatalogo || "",
    telaNombre: item?.tela_nombre || inferido.telaNombre || "",
    origenCarga: item?.origen_carga || "",
    estado: item?.estado || "ACTIVO",
    metadata: item?.metadata || {},
    fechaActualizacion:
      item?.fechaactualizacion?.slice?.(0, 10) ||
      item?.fecharegistro?.slice?.(0, 10) ||
      "",
  };
};

const mapearVarianteProductoDesdeSupabase = (item = {}) => ({
  id: item?.id || "",
  modeloId: item?.modelo_id || "",
  codigoModelo: item?.codigo_modelo || "",
  codigoVariante: item?.codigo_variante || "",
  codigoCorto: item?.codigo_corto || "",
  nombreModelo: item?.nombre_modelo || "",
  color: item?.color || "",
  colorNormalizado: item?.color_normalizado || "",
  talla: item?.talla || "",
  tallaNormalizada: item?.talla_normalizada || "",
  descripcionVariante: item?.descripcion_variante || "",
  origenCarga: item?.origen_carga || "",
  estado: item?.estado || "ACTIVO",
  metadata: item?.metadata || {},
  fechaActualizacion:
    item?.fechaactualizacion?.slice?.(0, 10) ||
    item?.fecharegistro?.slice?.(0, 10) ||
    "",
});

const recalcularCodigosCortosVariantes = (filas = [], modelos = []) => {
  const modelosPorId = new Map(
    (Array.isArray(modelos) ? modelos : []).map((item) => [item.id, item]),
  );
  const modelosPorCodigo = new Map(
    (Array.isArray(modelos) ? modelos : []).map((item) => [item.codigoModelo, item]),
  );
  const filasOrdenadas = [...(Array.isArray(filas) ? filas : [])].sort((a, b) =>
    [
      a?.codigo_modelo || "",
      a?.nombre_modelo || "",
      a?.color || "",
      a?.talla || "",
      a?.id || "",
    ]
      .join("|")
      .localeCompare(
        [
          b?.codigo_modelo || "",
          b?.nombre_modelo || "",
          b?.color || "",
          b?.talla || "",
          b?.id || "",
        ].join("|"),
      ),
  );
  const resultado = [];

  filasOrdenadas.forEach((item) => {
    const modelo =
      modelosPorId.get(item?.modelo_id) || modelosPorCodigo.get(item?.codigo_modelo) || null;
    const codigoBase = crearCodigoCortoVarianteConfiguracion({
      codigoCortoModelo: modelo?.codigoCorto || "",
      color: item?.color || "",
      talla: item?.talla || "",
    });

    resultado.push({
      ...item,
      codigo_corto: resolverCodigoCortoVarianteUnico({
        codigoBase,
        variantesExistentes: resultado.map((fila) => ({
          id: fila.id,
          codigoCorto: fila.codigo_corto,
        })),
        varianteIdActual: item?.id || "",
      }),
    });
  });

  return resultado;
};

const construirNombreNormalizadoProducto = (nombreModelo = "") =>
  normalizarTexto(nombreModelo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const crearCodigoModeloSiguiente = (lista = []) => {
  const maximo = lista.reduce((mayor, item) => {
    const texto = (item?.codigoModelo || item?.codigo_modelo || "").toString().trim().toUpperCase();
    const coincidencia = texto.match(/^MOD-(\d+)$/);
    const numero = coincidencia ? Number(coincidencia[1]) : 0;
    return Number.isFinite(numero) && numero > mayor ? numero : mayor;
  }, 0);

  return `MOD-${String(maximo + 1).padStart(4, "0")}`;
};

const crearCodigoVarianteSiguiente = (lista = []) => {
  const maximo = (Array.isArray(lista) ? lista : []).reduce((mayor, item) => {
    const texto = (item?.codigoVariante || item?.codigo_variante || "").toString().trim().toUpperCase();
    const coincidencia = texto.match(/^VAR-(\d+)$/);
    const numero = coincidencia ? Number(coincidencia[1]) : 0;
    return Number.isFinite(numero) && numero > mayor ? numero : mayor;
  }, 0);

  return `VAR-${String(maximo + 1).padStart(6, "0")}`;
};

const crearCodigoVarianteRapido = (indice = 0) =>
  `VAR-${Date.now()}${String(indice + 1).padStart(2, "0")}`;

const resolverCodigoVarianteUnico = ({
  codigoBase = "",
  variantesExistentes = [],
  varianteIdActual = "",
}) => {
  const base = (codigoBase || "").toString().trim().toUpperCase();
  const usados = new Set(
    (Array.isArray(variantesExistentes) ? variantesExistentes : [])
      .filter((item) => item?.id !== varianteIdActual)
      .map((item) => (item?.codigoVariante || item?.codigo_variante || "").toString().trim().toUpperCase())
      .filter(Boolean),
  );

  if (!base || !usados.has(base)) {
    return base;
  }

  const coincidencia = base.match(/^VAR-(\d+)$/);
  const numeroBase = coincidencia ? Number(coincidencia[1]) : null;

  if (Number.isFinite(numeroBase)) {
    let correlativo = numeroBase + 1;
    while (correlativo <= 999999) {
      const candidato = `VAR-${String(correlativo).padStart(6, "0")}`;
      if (!usados.has(candidato)) {
        return candidato;
      }
      correlativo += 1;
    }
  }

  let sufijo = 1;
  while (sufijo <= 999) {
    const candidato = `${base}-${String(sufijo).padStart(3, "0")}`.slice(0, 40);
    if (!usados.has(candidato)) {
      return candidato;
    }
    sufijo += 1;
  }

  return `${base}-${Date.now()}`.slice(0, 40);
};

const CORRELATIVOS_SISTEMA_POR_DEFECTO = [
  {
    clave: "PEDIDO_PRODUCCION",
    nombre: "Pedidos de produccion",
    prefijo: "PED",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "OP_PRODUCCION",
    nombre: "Ordenes de produccion",
    prefijo: "OP",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "INGRESO_MATERIA_PRIMA",
    nombre: "Ingresos de materia prima",
    prefijo: "CMP",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "SALIDA_TALLER",
    nombre: "Salidas a taller",
    prefijo: "SAL",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "RECEPCION_TALLER",
    nombre: "Recepciones de taller",
    prefijo: "REC",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "SALIDA_TIENDA",
    nombre: "Salidas a tienda",
    prefijo: "TIE",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "VENTA_TIENDA",
    nombre: "Ventas de tienda",
    prefijo: "VTI",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "CAMBIO_VENTA",
    nombre: "Cambios de venta",
    prefijo: "CVT",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "TERCERIZACION",
    nombre: "Tercerizaciones",
    prefijo: "TER",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
  {
    clave: "DEVOLUCION_PRODUCCION",
    nombre: "Devoluciones de produccion",
    prefijo: "DEV",
    formato: "DDMMAA-01",
    alcance: "ANUAL",
  },
];

const mapearCorrelativoSistemaDesdeSupabase = (item = {}) => ({
  id: item?.id || "",
  clave: item?.clave || "",
  nombre: item?.nombre || "",
  prefijo: item?.prefijo || "",
  formato: item?.formato || "DDMMAA-01",
  alcance: item?.alcance || "ANUAL",
  anioActual: Number(item?.anio_actual || new Date().getFullYear()),
  ultimoCorrelativo: Number(item?.ultimo_correlativo || 0),
  siguienteForzado: Number(item?.siguiente_forzado || 0),
  activo: item?.activo !== false,
  metadata: item?.metadata || {},
});

const mapearCorrelativoSistemaASupabase = (item = {}) => ({
  id: item?.id || undefined,
  clave: normalizarTexto(item?.clave || ""),
  nombre: item?.nombre || "",
  prefijo: normalizarTexto(item?.prefijo || ""),
  formato: item?.formato || "DDMMAA-01",
  alcance: normalizarTexto(item?.alcance || "ANUAL"),
  anio_actual: Math.max(2020, Number(item?.anioActual || new Date().getFullYear())),
  ultimo_correlativo: Math.max(0, Number(item?.ultimoCorrelativo || 0)),
  siguiente_forzado: Math.max(0, Number(item?.siguienteForzado || 0)),
  activo: item?.activo !== false,
  metadata: item?.metadata || {},
});

const obtenerAnioCorrelativoDesdeFecha = (fecha = "") => {
  const [anio] = (fecha || new Date().toISOString().slice(0, 10)).split("-");
  const numero = Number(anio);
  return Number.isFinite(numero) ? numero : new Date().getFullYear();
};

const extraerCorrelativoDesdeCodigo = (codigo = "") => {
  const partes = (codigo || "").split("-");
  if (partes.length < 2) return 0;
  const numero = Number(partes[1]);
  return Number.isFinite(numero) ? numero : 0;
};

const leerListaLocalCorrelativos = (clave = "") => {
  if (typeof window === "undefined" || !window?.localStorage || !clave) {
    return [];
  }

  try {
    const contenido = window.localStorage.getItem(clave);
    if (!contenido) return [];
    const data = JSON.parse(contenido);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const obtenerMaximoCorrelativoDesdeItems = (items = [], obtenerCodigo, obtenerFecha, anio) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      codigo: obtenerCodigo(item),
      fecha: obtenerFecha(item),
    }))
    .filter((item) => obtenerAnioCorrelativoDesdeFecha(item.fecha) === anio)
    .map((item) => extraerCorrelativoDesdeCodigo(item.codigo))
    .filter((numero) => Number.isFinite(numero) && numero > 0)
    .reduce((mayor, numero) => Math.max(mayor, numero), 0);

const obtenerMaximoCorrelativoRegistradoPorClave = async (clave = "", anio = new Date().getFullYear()) => {
  const claveNormalizada = normalizarTexto(clave);

  if (claveNormalizada === "PEDIDO_PRODUCCION") {
    const { data, error } = await supabase
      .from("pedidos_produccion")
      .select("codigo_pedido,fecha_solicitud");

    if (error) throw new Error(error.message);

    return obtenerMaximoCorrelativoDesdeItems(
      data || [],
      (item) => item?.codigo_pedido || "",
      (item) => item?.fecha_solicitud || "",
      anio,
    );
  }

  if (claveNormalizada === "OP_PRODUCCION") {
    const { data, error } = await supabase
      .from("cortes_produccion")
      .select("codigo_op,fecha_corte");

    if (error) throw new Error(error.message);

    return obtenerMaximoCorrelativoDesdeItems(
      data || [],
      (item) => item?.codigo_op || "",
      (item) => item?.fecha_corte || "",
      anio,
    );
  }

  if (claveNormalizada === "INGRESO_MATERIA_PRIMA") {
    const lista = leerListaLocalCorrelativos("cynara_historial_ingresos_materia_prima");
    return obtenerMaximoCorrelativoDesdeItems(
      lista,
      (item) => item?.cabeceraCompra?.codigoInterno || "",
      (item) => item?.cabeceraCompra?.fechaCompra || "",
      anio,
    );
  }

  if (claveNormalizada === "SALIDA_TALLER") {
    const lista = leerListaLocalCorrelativos("cynara_salidas_taller").filter(
      (item) => item?.tipoRegistro === "envio_taller",
    );
    return obtenerMaximoCorrelativoDesdeItems(
      lista,
      (item) => item?.codigoSalida || item?.id || "",
      (item) => item?.fechaEnvio || "",
      anio,
    );
  }

  if (claveNormalizada === "RECEPCION_TALLER") {
    const lista = leerListaLocalCorrelativos("cynara_recepciones_taller");
    return obtenerMaximoCorrelativoDesdeItems(
      lista,
      (item) => item?.cabeceraRecepcion?.idRecepcion || item?.id || "",
      (item) => item?.cabeceraRecepcion?.fechaRecepcion || "",
      anio,
    );
  }

  if (claveNormalizada === "SALIDA_TIENDA") {
    const lista = leerListaLocalCorrelativos("cynara_pedidos_tienda");
    return obtenerMaximoCorrelativoDesdeItems(
      lista,
      (item) => item?.id || "",
      (item) => item?.fechaSolicitud || "",
      anio,
    );
  }

  if (claveNormalizada === "VENTA_TIENDA") {
    const lista = leerListaLocalCorrelativos("cynara_ventas_tienda");
    return obtenerMaximoCorrelativoDesdeItems(
      lista,
      (item) => item?.id || "",
      (item) => item?.fecha || "",
      anio,
    );
  }

  if (claveNormalizada === "CAMBIO_VENTA") {
    const lista = leerListaLocalCorrelativos("cynara_cambios_venta_pt");
    return obtenerMaximoCorrelativoDesdeItems(
      lista,
      (item) => item?.id || "",
      (item) => item?.fechaCambio || item?.fecha || "",
      anio,
    );
  }

  if (claveNormalizada === "TERCERIZACION") {
    const lista = leerListaLocalCorrelativos("cynara_tercerizaciones_op");
    return obtenerMaximoCorrelativoDesdeItems(
      lista,
      (item) => item?.codigoTercerizacion || "",
      (item) => item?.fechaSolicitud || "",
      anio,
    );
  }

  if (claveNormalizada === "DEVOLUCION_PRODUCCION") {
    const lista = leerListaLocalCorrelativos("cynara_solicitudes_materiales");
    return obtenerMaximoCorrelativoDesdeItems(
      lista,
      (item) => item?.codigoSolicitud || item?.id || "",
      (item) => item?.fechaSolicitud || item?.fecha || "",
      anio,
    );
  }

  return 0;
};

const sincronizarVariantesModeloConfiguracion = async (modeloGuardado = null) => {
  if (!modeloGuardado?.id) return;

  const { data: variantesRelacionadas, error: errorVariantesRelacionadas } = await supabase
    .from("modelos_producto_variantes")
    .select("id,color,talla,color_normalizado,talla_normalizada")
    .eq("modelo_id", modeloGuardado.id);

  if (errorVariantesRelacionadas) {
    throw new Error(errorVariantesRelacionadas.message);
  }

  if (!Array.isArray(variantesRelacionadas) || variantesRelacionadas.length === 0) {
    return;
  }

  const actualizacionesVariantes = variantesRelacionadas.map((variante) =>
    supabase
      .from("modelos_producto_variantes")
      .update({
        codigo_modelo: modeloGuardado.codigoModelo,
        codigo_corto: crearCodigoCortoVarianteConfiguracion({
          codigoCortoModelo: modeloGuardado.codigoCorto,
          color: variante?.color_normalizado || variante?.color || "",
          talla: variante?.talla_normalizada || variante?.talla || "",
        }),
        nombre_modelo: modeloGuardado.nombreModelo,
        descripcion_variante: `${modeloGuardado.nombreModelo} | ${
          variante?.color_normalizado || variante?.color || ""
        } | ${variante?.talla_normalizada || variante?.talla || ""}`,
      })
      .eq("id", variante.id),
  );

  const respuestas = await Promise.all(actualizacionesVariantes);
  const respuestaConError = respuestas.find((respuesta) => respuesta?.error);
  if (respuestaConError?.error) {
    throw new Error(respuestaConError.error.message);
  }
};

const fusionarModeloDuplicadoConfiguracion = async ({
  modeloOrigenId = "",
  modeloDestino = null,
} = {}) => {
  if (!modeloOrigenId || !modeloDestino?.id || modeloOrigenId === modeloDestino.id) {
    return;
  }

  const { data: variantesOrigen, error: errorVariantesOrigen } = await supabase
    .from("modelos_producto_variantes")
    .select("id,color,color_normalizado,talla,talla_normalizada,estado,metadata")
    .eq("modelo_id", modeloOrigenId);

  if (errorVariantesOrigen) {
    throw new Error(errorVariantesOrigen.message);
  }

  const { data: variantesDestino, error: errorVariantesDestino } = await supabase
    .from("modelos_producto_variantes")
    .select("id,color,color_normalizado,talla,talla_normalizada,estado,metadata")
    .eq("modelo_id", modeloDestino.id);

  if (errorVariantesDestino) {
    throw new Error(errorVariantesDestino.message);
  }

  const destinoPorCombinacion = new Map(
    (variantesDestino || []).map((item) => [
      `${item?.color_normalizado || item?.color || ""}__${item?.talla_normalizada || item?.talla || ""}`,
      item,
    ]),
  );

  for (const varianteOrigen of variantesOrigen || []) {
    const clave = `${varianteOrigen?.color_normalizado || varianteOrigen?.color || ""}__${
      varianteOrigen?.talla_normalizada || varianteOrigen?.talla || ""
    }`;
    const varianteDestino = destinoPorCombinacion.get(clave);

    if (varianteDestino) {
      const { error: errorActualizarDestino } = await supabase
        .from("modelos_producto_variantes")
        .update({
          estado:
            varianteDestino?.estado === "ACTIVO" || varianteOrigen?.estado === "ACTIVO"
              ? "ACTIVO"
              : "INACTIVO",
          metadata: {
            ...(varianteDestino?.metadata || {}),
            ...(varianteOrigen?.metadata || {}),
          },
        })
        .eq("id", varianteDestino.id);

      if (errorActualizarDestino) {
        throw new Error(errorActualizarDestino.message);
      }

      const { error: errorEliminarOrigen } = await supabase
        .from("modelos_producto_variantes")
        .delete()
        .eq("id", varianteOrigen.id);

      if (errorEliminarOrigen) {
        throw new Error(errorEliminarOrigen.message);
      }
      continue;
    }

    const { error: errorMoverVariante } = await supabase
      .from("modelos_producto_variantes")
      .update({
        modelo_id: modeloDestino.id,
      })
      .eq("id", varianteOrigen.id);

    if (errorMoverVariante) {
      throw new Error(errorMoverVariante.message);
    }
  }

  const { error: errorEliminarModeloOrigen } = await supabase
    .from("modelos_producto")
    .delete()
    .eq("id", modeloOrigenId);

  if (errorEliminarModeloOrigen) {
    throw new Error(errorEliminarModeloOrigen.message);
  }
};

export const listarTalleresConfiguracion = async () => {
  const { data, error } = await supabase
    .from("talleres")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error cargando talleres desde Supabase:", error.message);
    return leerFichasTalleres();
  }

  const fichas = (data || []).map(mapearTallerDesdeSupabase);
  localStorage.setItem("cynara_fichas_talleres", JSON.stringify(fichas));
  const catalogosActuales = leerCatalogosProduccion();
  guardarCatalogosProduccion({
    ...catalogosActuales,
    modelosNombreTaller: fichas.map((item) => item.nombreTaller).filter(Boolean),
  });
  return fichas;
};

export const guardarTallerConfiguracion = async (ficha = {}) => {
  const talleresActuales = await listarTalleresConfiguracion();
  const existente = (Array.isArray(talleresActuales) ? talleresActuales : []).find(
    (item) =>
      (ficha?.id && item?.id === ficha.id) ||
      normalizarTexto(item?.nombreTaller) === normalizarTexto(ficha?.nombreTaller),
  );
  const payload = mapearTallerASupabase({
    ...ficha,
    codigoTaller:
      ficha?.codigoTaller || existente?.codigoTaller || crearCodigoTallerSiguiente(talleresActuales),
  });

  const consulta = existente?.id
    ? supabase.from("talleres").update(payload).eq("id", existente.id).select().maybeSingle()
    : supabase.from("talleres").insert(payload).select().maybeSingle();

  const { data, error } = await consulta;

  if (error) {
    throw new Error(error.message);
  }

  const normalizada = mapearTallerDesdeSupabase(data || payload);
  if (normalizada?.correoUsuario) {
    const nombreVisibleAcceso =
      normalizada.nombreUsuario || normalizada.responsable || normalizada.nombreTaller;
    await guardarUsuarioSistemaConfiguracion({
      correo: normalizada.correoUsuario,
      nombreCompleto: nombreVisibleAcceso,
      rol: "TALLER",
      area: "TALLERES",
      estado:
        normalizada.accesoEstado === "ACTIVO" || normalizada.accesoEstado === "BLOQUEADO"
          ? normalizada.accesoEstado
          : "ACTIVO",
      tallerAsignado: normalizada.nombreTaller,
      tallerId: normalizada.id || "",
      tallerCodigo: normalizada.codigoTaller || "",
      observacion: normalizada.observacion || "",
      metadata: {
        tallerAsignado: normalizada.nombreTaller,
        tallerId: normalizada.id || "",
        tallerCodigo: normalizada.codigoTaller || "",
        accesoSistemaCreado:
          normalizada.accesoEstado === "ACTIVO" || normalizada.accesoEstado === "BLOQUEADO",
      },
    });
  }
  guardarFichaTaller(normalizada);
  return normalizada;
};

export const eliminarTallerConfiguracion = async (nombreTaller = "") => {
  const nombre = normalizarTexto(nombreTaller);
  const { error } = await supabase.from("talleres").delete().eq("nombre", nombre);

  if (error) {
    throw new Error(error.message);
  }

  const restantes = leerFichasTalleres().filter(
    (item) => item.nombreTaller !== nombre,
  );
  localStorage.setItem("cynara_fichas_talleres", JSON.stringify(restantes));
  return restantes;
};

export const listarPreciosProductosConfiguracion = async () => {
  const { data, error } = await supabase
    .from("precios_productos")
    .select("*")
    .order("modelo", { ascending: true });

  if (error) {
    console.error("Error cargando precios desde Supabase:", error.message);
    return leerListaPreciosProductos();
  }

  const lista = (data || []).map(mapearPrecioDesdeSupabase);
  guardarListaPreciosProductos(lista);
  return lista;
};

export const guardarPrecioProductoConfiguracion = async (registro = {}) => {
  const payload = mapearPrecioASupabase(registro);
  const { data, error } = await supabase
    .from("precios_productos")
    .upsert(payload, { onConflict: "modelo" })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const normalizado = mapearPrecioDesdeSupabase(data || payload);
  const actualizada = [
    normalizado,
    ...leerListaPreciosProductos().filter(
      (item) =>
        normalizarTextoPrecio(item?.modelo) !==
        normalizarTextoPrecio(normalizado.modelo),
    ),
  ].sort((a, b) => (a?.modelo || "").localeCompare(b?.modelo || ""));

  guardarListaPreciosProductos(actualizada);
  return normalizado;
};

export const eliminarPrecioProductoConfiguracion = async (modelo = "") => {
  const modeloNormalizado = normalizarTextoPrecio(modelo);
  const { error } = await supabase
    .from("precios_productos")
    .delete()
    .eq("modelo", modeloNormalizado);

  if (error) {
    throw new Error(error.message);
  }

  const actualizada = leerListaPreciosProductos().filter(
    (item) => normalizarTextoPrecio(item?.modelo) !== modeloNormalizado,
  );
  guardarListaPreciosProductos(actualizada);
  return actualizada;
};

export const listarCostosTallerConfiguracion = async () => {
  const { data, error } = await supabase
    .from("costos_taller_modelo")
    .select("*")
    .order("modelo", { ascending: true })
    .order("nombre_taller", { ascending: true });

  if (error) {
    console.error("Error cargando costos de taller desde Supabase:", error.message);
    return leerCostosTallerModelo();
  }

  const lista = (data || []).map(mapearCostoTallerDesdeSupabase);
  guardarCostosTallerModelo(lista);
  return lista;
};

export const guardarCostoTallerConfiguracion = async (registro = {}) => {
  const normalizado = normalizarRegistroCostoTaller({
    ...crearFormularioCostoTaller(),
    ...registro,
  });

  const payload = mapearCostoTallerASupabase(normalizado);
  const { data, error } = await supabase
    .from("costos_taller_modelo")
    .upsert(payload, { onConflict: "codigo_modelo,nombre_taller" })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const actualizado = mapearCostoTallerDesdeSupabase(data || payload);
  const lista = [
    actualizado,
    ...leerCostosTallerModelo().filter(
      (item) =>
        !(
          normalizarTextoCosto(item?.codigoModelo) ===
            normalizarTextoCosto(actualizado?.codigoModelo) &&
          normalizarTextoCosto(item?.nombreTaller) ===
            normalizarTextoCosto(actualizado?.nombreTaller)
        )
    ),
  ].sort((a, b) =>
    `${a?.modelo || ""} ${a?.nombreTaller || ""}`.localeCompare(
      `${b?.modelo || ""} ${b?.nombreTaller || ""}`
    )
  );

  guardarCostosTallerModelo(lista);
  return actualizado;
};

export const eliminarCostoTallerConfiguracion = async ({
  codigoModelo = "",
  nombreTaller = "",
} = {}) => {
  const { error } = await supabase
    .from("costos_taller_modelo")
    .delete()
    .eq("codigo_modelo", normalizarTextoCosto(codigoModelo))
    .eq("nombre_taller", normalizarTextoCosto(nombreTaller));

  if (error) {
    throw new Error(error.message);
  }

  const lista = leerCostosTallerModelo().filter(
    (item) =>
      !(
        normalizarTextoCosto(item?.codigoModelo) === normalizarTextoCosto(codigoModelo) &&
        normalizarTextoCosto(item?.nombreTaller) === normalizarTextoCosto(nombreTaller)
      )
  );
  guardarCostosTallerModelo(lista);
  return lista;
};

export const listarCostosTercerosConfiguracion = async () => {
  const { data, error } = await supabase
    .from("costos_terceros")
    .select("*")
    .order("proceso", { ascending: true })
    .order("nombre_taller", { ascending: true });

  if (error) {
    console.error("Error cargando costos de terceros desde Supabase:", error.message);
    return leerCostosTerceros();
  }

  const lista = (data || []).map(mapearCostoTerceroDesdeSupabase);
  guardarCostosTerceros(lista);
  return lista;
};

export const guardarCostoTerceroConfiguracion = async (registro = {}) => {
  const normalizado = normalizarRegistroCostoTercero({
    ...crearFormularioCostoTercero(),
    ...registro,
  });

  const payload = mapearCostoTerceroASupabase(normalizado);
  const { data, error } = await supabase
    .from("costos_terceros")
    .upsert(payload, { onConflict: "proceso,cantidad_agujas,nombre_taller" })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const actualizado = mapearCostoTerceroDesdeSupabase(data || payload);
  const lista = [
    actualizado,
    ...leerCostosTerceros().filter(
      (item) =>
        !(
          normalizarTextoCostoTercero(item?.proceso) ===
            normalizarTextoCostoTercero(actualizado?.proceso) &&
          String(item?.cantidadAgujas || "") === String(actualizado?.cantidadAgujas || "") &&
          normalizarTextoCostoTercero(item?.nombreTaller) ===
            normalizarTextoCostoTercero(actualizado?.nombreTaller)
        )
    ),
  ].sort((a, b) =>
    `${a?.proceso || ""} ${a?.nombreTaller || ""}`.localeCompare(
      `${b?.proceso || ""} ${b?.nombreTaller || ""}`
    )
  );

  guardarCostosTerceros(lista);
  return actualizado;
};

export const eliminarCostoTerceroConfiguracion = async ({
  proceso = "",
  cantidadAgujas = "",
  nombreTaller = "",
} = {}) => {
  let query = supabase
    .from("costos_terceros")
    .delete()
    .eq("proceso", normalizarTextoCostoTercero(proceso))
    .eq("nombre_taller", normalizarTextoCostoTercero(nombreTaller));

  query =
    cantidadAgujas === "" || cantidadAgujas === undefined || cantidadAgujas === null
      ? query.is("cantidad_agujas", null)
      : query.eq("cantidad_agujas", Number(cantidadAgujas || 0));

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const lista = leerCostosTerceros().filter(
    (item) =>
      !(
        normalizarTextoCostoTercero(item?.proceso) === normalizarTextoCostoTercero(proceso) &&
        String(item?.cantidadAgujas || "") === String(cantidadAgujas || "") &&
        normalizarTextoCostoTercero(item?.nombreTaller) ===
          normalizarTextoCostoTercero(nombreTaller)
      )
  );
  guardarCostosTerceros(lista);
  return lista;
};

export const listarSueldosPersonalConfiguracion = async () => {
  const { data, error } = await supabase
    .from("sueldos_personal")
    .select("*")
    .order("nombre_personal", { ascending: true });

  if (error) {
    console.error("Error cargando sueldos desde Supabase:", error.message);
    return leerSueldosPersonal();
  }

  const lista = (data || []).map(mapearSueldoPersonalDesdeSupabase);
  guardarSueldosPersonal(lista);
  return lista;
};

export const guardarSueldoPersonalConfiguracion = async (registro = {}) => {
  const normalizado = normalizarRegistroSueldoPersonal({
    ...crearFormularioSueldoPersonal(),
    ...registro,
  });
  const payload = mapearSueldoPersonalASupabase(normalizado);

  const { data, error } = await supabase
    .from("sueldos_personal")
    .upsert(payload, { onConflict: "clave" })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const actualizado = mapearSueldoPersonalDesdeSupabase(data || payload);
  const lista = [
    actualizado,
    ...leerSueldosPersonal().filter(
      (item) => normalizarTexto(item?.clave) !== normalizarTexto(actualizado?.clave)
    ),
  ].sort((a, b) => (a?.nombrePersonal || "").localeCompare(b?.nombrePersonal || ""));

  guardarSueldosPersonal(lista);
  return actualizado;
};

export const eliminarSueldoPersonalConfiguracion = async (clave = "") => {
  const claveNormalizada = normalizarTexto(clave);
  const { error } = await supabase
    .from("sueldos_personal")
    .delete()
    .eq("clave", claveNormalizada);

  if (error) {
    throw new Error(error.message);
  }

  const lista = leerSueldosPersonal().filter(
    (item) => normalizarTexto(item?.clave) !== claveNormalizada
  );
  guardarSueldosPersonal(lista);
  return lista;
};

export const listarUsuariosSistemaConfiguracion = async () => {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("correo", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const mapaPorCorreo = new Map();
  (data || []).forEach((item) => {
    const normalizado = mapearUsuarioSistemaDesdeSupabase(item);
    const correo = (normalizado?.correo || "").toString().trim().toLowerCase();
    if (!correo) return;
    mapaPorCorreo.set(correo, normalizado);
  });

  const lista = Array.from(mapaPorCorreo.values()).sort((a, b) =>
    (a?.correo || "").localeCompare(b?.correo || "")
  );
  sobrescribirUsuariosSistema(lista);
  return lista;
};

const buscarCuentaSistemaPorCorreoExacto = async (correo = "") => {
  const correoNormalizado = (correo || "").toString().trim().toLowerCase();
  if (!correoNormalizado) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .ilike("correo", correoNormalizado)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const lista = Array.isArray(data) ? data : [];
  return (
    lista.find(
      (item) => (item?.correo || "").toString().trim().toLowerCase() === correoNormalizado,
    ) || null
  );
};

export const guardarUsuarioSistemaConfiguracion = async (registro = {}) => {
  const correo = (registro?.correo || "").toString().trim().toLowerCase();
  if (!correo) {
    throw new Error("El correo del usuario es obligatorio.");
  }

  const nombreVisible = normalizarTexto(registro?.nombreCompleto || "");
  if (!nombreVisible) {
    throw new Error("El nombre visible del usuario es obligatorio.");
  }

  const rolRegistro = normalizarTexto(registro?.rol || registro?.tipouser || "");
  const tallerIdRegistro = (registro?.tallerId || registro?.metadata?.tallerId || "").toString().trim();
  const tallerCodigoRegistro = normalizarTexto(
    registro?.tallerCodigo || registro?.metadata?.tallerCodigo || "",
  );
  const tallerAsignadoRegistro = normalizarTexto(
    registro?.tallerAsignado || registro?.metadata?.tallerAsignado || "",
  );

  const { data: existentesPorCorreo, error: errorExistente } = await supabase
    .from("usuarios")
    .select("*")
    .ilike("correo", correo)
    .limit(10);

  if (errorExistente) {
    throw new Error(errorExistente.message);
  }

  let existente =
    (Array.isArray(existentesPorCorreo) ? existentesPorCorreo : []).find(
      (item) => (item?.correo || "").toString().trim().toLowerCase() === correo,
    ) || null;

  if (!existente && rolRegistro === "TALLER" && (tallerIdRegistro || tallerCodigoRegistro || tallerAsignadoRegistro)) {
    const { data: usuariosTaller, error: errorUsuariosTaller } = await supabase
      .from("usuarios")
      .select("*")
      .eq("tipouser", "TALLER");

    if (errorUsuariosTaller) {
      throw new Error(errorUsuariosTaller.message);
    }

    existente =
      (Array.isArray(usuariosTaller) ? usuariosTaller : []).find((item) => {
        const metadata = item?.metadata || {};
        const tallerIdItem = (metadata?.tallerId || item?.taller_id || item?.tallerId || "").toString().trim();
        const tallerCodigoItem = normalizarTexto(
          metadata?.tallerCodigo || item?.taller_codigo || item?.tallerCodigo || "",
        );
        const tallerAsignadoItem = normalizarTexto(
          metadata?.tallerAsignado || item?.taller_asignado || item?.tallerAsignado || "",
        );

        return (
          (tallerIdRegistro && tallerIdItem === tallerIdRegistro) ||
          (tallerCodigoRegistro && tallerCodigoItem === tallerCodigoRegistro) ||
          (tallerAsignadoRegistro && tallerAsignadoItem === tallerAsignadoRegistro)
        );
      }) || null;
  }

  const { data: usuariosConNombre, error: errorUsuariosConNombre } = await supabase
    .from("usuarios")
    .select("correo,estado,nombre,nombres")
    .or(`nombre.ilike.${nombreVisible},nombres.ilike.${nombreVisible}`);

  if (errorUsuariosConNombre) {
    throw new Error(errorUsuariosConNombre.message);
  }

  const nombreEnUso = (Array.isArray(usuariosConNombre) ? usuariosConNombre : []).find((item) => {
    const correoItem = (item?.correo || "").toString().trim().toLowerCase();
    const nombreItem = normalizarTexto(item?.nombre || item?.nombres || "");
    const estadoItem = normalizarTexto(item?.estado || "ACTIVO");
    const correoExistente = (existente?.correo || "").toString().trim().toLowerCase();
    return (
      correoItem !== correo &&
      correoItem !== correoExistente &&
      nombreItem === nombreVisible &&
      estadoItem === "ACTIVO"
    );
  });

  if (nombreEnUso) {
    throw new Error(
      `Ese nombre visible ya esta siendo usado por ${nombreEnUso.correo}. Prueba con otro nombre o usa el correo para diferenciarlo.`,
    );
  }

  const payload = mapearUsuarioSistemaASupabase(registro, existente);

  const consulta = existente
    ? supabase
        .from("usuarios")
        .update(payload)
        .ilike("correo", (existente?.correo || correo).toString().trim().toLowerCase())
        .select("*")
        .maybeSingle()
    : supabase.from("usuarios").insert(payload).select("*").maybeSingle();

  const { data, error } = await consulta;

  if (error) {
    throw new Error(error.message);
  }

  await sincronizarTallerDesdeCuentaUsuario(data || payload);
  await listarUsuariosSistemaConfiguracion();
  return mapearUsuarioSistemaDesdeSupabase(data || payload);
};

export const crearAccesoTemporalUsuarioConfiguracion = async (registro = {}) => {
  const correo = (registro?.correo || "").toString().trim().toLowerCase();
  const passwordTemporal = (registro?.passwordTemporal || "").toString().trim();
  const nombreVisible = normalizarTexto(registro?.nombreCompleto || "");

  if (!correo) {
    throw new Error("El correo del usuario es obligatorio.");
  }

  if (!nombreVisible) {
    throw new Error("El nombre visible del usuario es obligatorio.");
  }

  if (passwordTemporal.length < 6) {
    throw new Error("La contrasena temporal debe tener al menos 6 caracteres.");
  }

  const { data, error } = await supabase.functions.invoke("create-internal-user-access", {
    body: {
      correo,
      passwordTemporal,
      nombreVisible,
      rol: registro?.rol || "PRODUCCION",
      area: registro?.area || "PRODUCCION",
      estado: registro?.estado || "ACTIVO",
      modulos: Array.isArray(registro?.modulos) ? registro.modulos : [],
      submodulos: registro?.submodulos || {},
      tallerAsignado: registro?.tallerAsignado || "",
      tallerId: registro?.tallerId || "",
      tallerCodigo: registro?.tallerCodigo || "",
      observacion: registro?.observacion || "",
    },
  });

  if (error) {
    throw new Error(error.message || "No se pudo crear el acceso del usuario.");
  }

  await guardarUsuarioSistemaConfiguracion({
    ...registro,
    metadata: {
      ...(registro?.metadata || {}),
      accesoSistemaCreado: true,
    },
  });

  await listarUsuariosSistemaConfiguracion();
  return data;
};

export const bloquearUsuarioSistemaConfiguracion = async (correo = "") => {
  const correoNormalizado = correo.toString().trim().toLowerCase();
  if (!correoNormalizado) throw new Error("No se encontro el usuario a bloquear.");

  const { error } = await supabase
    .from("usuarios")
    .update({ estado: "BLOQUEADO" })
    .ilike("correo", correoNormalizado);

  if (error) throw new Error(error.message);
  const cuenta = await buscarCuentaSistemaPorCorreoExacto(correoNormalizado);
  await sincronizarTallerDesdeCuentaUsuario(cuenta || { correo: correoNormalizado, estado: "BLOQUEADO" });
  return listarUsuariosSistemaConfiguracion();
};

export const activarUsuarioSistemaConfiguracion = async (correo = "") => {
  const correoNormalizado = correo.toString().trim().toLowerCase();
  if (!correoNormalizado) throw new Error("No se encontro el usuario a reactivar.");

  const { error } = await supabase
    .from("usuarios")
    .update({ estado: "ACTIVO" })
    .ilike("correo", correoNormalizado);

  if (error) throw new Error(error.message);
  const cuenta = await buscarCuentaSistemaPorCorreoExacto(correoNormalizado);
  await sincronizarTallerDesdeCuentaUsuario(cuenta || { correo: correoNormalizado, estado: "ACTIVO" });
  return listarUsuariosSistemaConfiguracion();
};

export const eliminarUsuarioSistemaConfiguracion = async (correo = "") => {
  const correoNormalizado = correo.toString().trim().toLowerCase();
  if (!correoNormalizado) throw new Error("No se encontro el usuario a borrar.");

  const existente = await buscarCuentaSistemaPorCorreoExacto(correoNormalizado);
  const { error } = await supabase.from("usuarios").delete().ilike("correo", correoNormalizado);
  if (error) throw new Error(error.message);

  await limpiarAccesoTallerDesdeCuentaUsuario(existente || { correo: correoNormalizado });

  return listarUsuariosSistemaConfiguracion();
};

export const restablecerPasswordTemporalUsuarioConfiguracion = async (correo = "") => {
  const correoNormalizado = correo.toString().trim().toLowerCase();
  if (!correoNormalizado) {
    throw new Error("No se encontro el correo a restablecer.");
  }

  const { data, error } = await supabase.functions.invoke("reset-temporary-password", {
    body: { correo: correoNormalizado },
  });

  if (error) {
    throw new Error(error.message || "No se pudo restablecer la contrasena temporal.");
  }

  if (!data?.ok || !data?.passwordTemporal) {
    throw new Error(data?.error || "La funcion no devolvio una contrasena temporal valida.");
  }

  return data;
};

export const invitarAccesoTallerConfiguracion = async (ficha = {}, redirectTo = "") => {
  const tallerGuardado = await guardarTallerConfiguracion({
    ...ficha,
    accesoEstado: "INVITADO",
  });

  const correo = (tallerGuardado?.correoUsuario || "").toString().trim().toLowerCase();
  if (!correo) {
    throw new Error("Primero registra el correo del taller.");
  }

  const nombreVisible =
    tallerGuardado?.nombreUsuario || tallerGuardado?.responsable || tallerGuardado?.nombreTaller;

  const { data, error } = await supabase.functions.invoke("invite-workshop-access", {
    body: {
      correo,
      nombreVisible,
      nombreTaller: tallerGuardado?.nombreTaller || "",
      tallerId: tallerGuardado?.id || "",
      tallerCodigo: tallerGuardado?.codigoTaller || "",
      redirectTo,
    },
  });

  if (error) {
    throw new Error(error.message || "No se pudo enviar la invitacion del taller.");
  }

  if (!data?.ok) {
    throw new Error(data?.error || "No se pudo completar la invitacion del taller.");
  }

  await listarTalleresConfiguracion();
  await listarUsuariosSistemaConfiguracion();
  return data;
};

export const normalizarNombresUsuariosConfiguracion = async () => {
  const { data, error } = await supabase.from("usuarios").select("*").order("correo", { ascending: true });
  if (error) throw new Error(error.message);

  const candidatos = (Array.isArray(data) ? data : []).filter((item) => {
    const nombre = normalizarTexto(item?.nombre || "");
    const nombres = normalizarTexto(item?.nombres || "");
    return !nombre || !nombres || nombre === "GENERICO" || nombres === "GENERICO";
  });

  for (const item of candidatos) {
    const nombreVisible = crearNombreVisibleDesdeCorreo(item?.correo || "");
    if (!nombreVisible) continue;

    const { error: errorActualizar } = await supabase
      .from("usuarios")
      .update({
        nombre: nombreVisible,
        nombres: nombreVisible,
      })
      .ilike("correo", item?.correo || "");

    if (errorActualizar) {
      throw new Error(errorActualizar.message);
    }
  }

  return listarUsuariosSistemaConfiguracion();
};

const mapearModeloVisualDesdeSupabase = (item = {}) =>
  normalizarFichaVisual({
    id: item?.id || "",
    categoriaModelo: item?.categoria || "",
    modeloCatalogo: item?.modelo || "",
    telaModelo: item?.tela_nombre || "",
    modeloBase: item?.modelo_completo || "",
    descripcionVisual: item?.descripcion_visual || "",
    fotoFrente: item?.foto_frontal || "",
    fotoEspalda: item?.foto_espalda || "",
    fotoCostado: item?.foto_costado || "",
    fotoDetalle: item?.foto_detalle || "",
    fechaActualizacion:
      item?.fechaactualizacion?.slice?.(0, 10) ||
      item?.fecharegistro?.slice?.(0, 10) ||
      "",
  });

const mapearModeloVisualASupabase = (ficha = {}) => ({
  categoria: normalizarTexto(ficha?.categoriaModelo),
  modelo: normalizarTexto(ficha?.modeloCatalogo),
  tela_nombre: normalizarTexto(ficha?.telaModelo),
  modelo_completo: normalizarTexto(ficha?.modeloBase),
  foto_frontal: ficha?.fotoFrente || ficha?.fotoModelo || "",
  foto_espalda: ficha?.fotoEspalda || "",
  foto_costado: ficha?.fotoCostado || "",
  foto_detalle: ficha?.fotoDetalle || "",
  descripcion_visual: ficha?.descripcionVisual || "",
});

const mapearModeloVisualColorDesdeSupabase = (item = {}) => ({
  id: item?.id || "",
  modeloBase: item?.modelo_completo || "",
  colorBase: item?.color_base || "",
  fotoColor: item?.foto_color || "",
  descripcionColor: item?.descripcion_color || "",
  fechaActualizacion:
    item?.fechaactualizacion?.slice?.(0, 10) ||
    item?.fecharegistro?.slice?.(0, 10) ||
    "",
});

const mapearModeloVisualColorASupabase = (ficha = {}) => ({
  modelo_completo: normalizarTexto(ficha?.modeloBase),
  color_base: normalizarTexto(ficha?.colorBase),
  foto_color: ficha?.fotoColor || "",
  descripcion_color: ficha?.descripcionColor || "",
});

export const listarModelosVisualesConfiguracion = async () => {
  const { data, error } = await supabase
    .from("modelos_visuales")
    .select("*")
    .order("modelo_completo", { ascending: true });

  if (error) {
    console.error("Error cargando modelos visuales:", error.message);
    return leerModelosVisuales();
  }

  const lista = (data || []).map(mapearModeloVisualDesdeSupabase);
  guardarListaModelosVisuales(lista);
  return lista;
};

export const guardarModeloVisualConfiguracion = async (ficha = {}) => {
  const payload = mapearModeloVisualASupabase(ficha);
  const { data, error } = await supabase
    .from("modelos_visuales")
    .upsert(payload, { onConflict: "modelo_completo" })
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);

  const normalizada = mapearModeloVisualDesdeSupabase(data || payload);
  const actualizada = [
    normalizada,
    ...leerModelosVisuales().filter((item) => item?.modeloBase !== normalizada.modeloBase),
  ].sort((a, b) => (a?.modeloBase || "").localeCompare(b?.modeloBase || ""));
  guardarListaModelosVisuales(actualizada);
  return normalizada;
};

export const eliminarModeloVisualConfiguracion = async (modeloBase = "") => {
  const clave = normalizarTexto(modeloBase);
  const { error } = await supabase
    .from("modelos_visuales")
    .delete()
    .eq("modelo_completo", clave);
  if (error) throw new Error(error.message);

  const actualizada = leerModelosVisuales().filter((item) => item?.modeloBase !== clave);
  guardarListaModelosVisuales(actualizada);
  return actualizada;
};

export const listarModelosVisualesColorConfiguracion = async () => {
  const { data, error } = await supabase
    .from("modelos_visuales_color")
    .select("*")
    .order("modelo_completo", { ascending: true })
    .order("color_base", { ascending: true });

  if (error) {
    console.error("Error cargando modelos visuales por color:", error.message);
    return leerModelosVisualesColor();
  }

  const lista = (data || []).map(mapearModeloVisualColorDesdeSupabase);
  guardarListaModelosVisualesColor(lista);
  return lista;
};

export const guardarModeloVisualColorConfiguracion = async (ficha = {}) => {
  const payload = mapearModeloVisualColorASupabase(ficha);
  const { data, error } = await supabase
    .from("modelos_visuales_color")
    .upsert(payload, { onConflict: "modelo_completo,color_base" })
    .select()
    .maybeSingle();

  if (error) {
    const normalizadaLocal = mapearModeloVisualColorDesdeSupabase(payload);
    const actualizadaLocal = [
      normalizadaLocal,
      ...leerModelosVisualesColor().filter(
        (item) =>
          !(
            normalizarTexto(item?.modeloBase) === normalizarTexto(normalizadaLocal.modeloBase) &&
            normalizarTexto(item?.colorBase) === normalizarTexto(normalizadaLocal.colorBase)
          )
      ),
    ].sort((a, b) =>
      `${a?.modeloBase || ""} ${a?.colorBase || ""}`.localeCompare(
        `${b?.modeloBase || ""} ${b?.colorBase || ""}`,
      ),
    );
    guardarListaModelosVisualesColor(actualizadaLocal);
    return normalizadaLocal;
  }

  const normalizada = mapearModeloVisualColorDesdeSupabase(data || payload);
  const actualizada = [
    normalizada,
    ...leerModelosVisualesColor().filter(
      (item) =>
        !(
          normalizarTexto(item?.modeloBase) === normalizarTexto(normalizada.modeloBase) &&
          normalizarTexto(item?.colorBase) === normalizarTexto(normalizada.colorBase)
        )
    ),
  ].sort((a, b) =>
    `${a?.modeloBase || ""} ${a?.colorBase || ""}`.localeCompare(
      `${b?.modeloBase || ""} ${b?.colorBase || ""}`,
    ),
  );
  guardarListaModelosVisualesColor(actualizada);
  return normalizada;
};

export const eliminarModeloVisualColorConfiguracion = async ({
  modeloBase = "",
  colorBase = "",
} = {}) => {
  const { error } = await supabase
    .from("modelos_visuales_color")
    .delete()
    .eq("modelo_completo", normalizarTexto(modeloBase))
    .eq("color_base", normalizarTexto(colorBase));

  const actualizada = leerModelosVisualesColor().filter(
    (item) =>
      !(
        normalizarTexto(item?.modeloBase) === normalizarTexto(modeloBase) &&
        normalizarTexto(item?.colorBase) === normalizarTexto(colorBase)
      ),
  );
  guardarListaModelosVisualesColor(actualizada);
  if (error) {
    return actualizada;
  }
  return actualizada;
};

const mapearElasticoDesdeSupabase = (item = {}) =>
  normalizarFichaElastico({
    id: item?.id || "",
    claveFicha:
      [item?.categoria, item?.modelo, item?.tela_nombre]
        .map((valor) => normalizarTexto(valor))
        .filter(Boolean)
        .join("__") || "",
    categoria: item?.categoria || "",
    modelo: item?.modelo || "",
    telaModelo: item?.tela_nombre || "",
    nombreModelo: item?.modelo_completo || "",
    anchoElasticoCm: Number(item?.ancho_cm || 0),
    costoMetro: Number(item?.costo_por_metro || 0),
    largosPorTalla: {
      S: Number(item?.largo_s_cm || 0),
      M: Number(item?.largo_m_cm || 0),
      L: Number(item?.largo_l_cm || 0),
      XL: Number(item?.largo_xl_cm || 0),
      XXL: Number(item?.largo_xxl_cm || 0),
    },
    observacion: item?.observacion || "",
    fechaActualizacion:
      item?.fechaactualizacion?.slice?.(0, 10) ||
      item?.fecharegistro?.slice?.(0, 10) ||
      "",
  });

const mapearElasticoASupabase = (ficha = {}) => ({
  categoria: normalizarTexto(ficha?.categoria),
  modelo: normalizarTexto(ficha?.modelo),
  tela_nombre: normalizarTexto(ficha?.telaModelo),
  modelo_completo: normalizarTexto(ficha?.nombreModelo),
  ancho_cm: Number(ficha?.anchoElasticoCm || 0),
  costo_por_metro: Number(ficha?.costoMetro || 0),
  largo_s_cm: Number(ficha?.largosPorTalla?.S || 0),
  largo_m_cm: Number(ficha?.largosPorTalla?.M || 0),
  largo_l_cm: Number(ficha?.largosPorTalla?.L || 0),
  largo_xl_cm: Number(ficha?.largosPorTalla?.XL || 0),
  largo_xxl_cm: Number(ficha?.largosPorTalla?.XXL || 0),
  observacion: ficha?.observacion || "",
});

export const listarElasticosModeloConfiguracion = async () => {
  const { data, error } = await supabase
    .from("elasticos_modelo")
    .select("*")
    .order("modelo_completo", { ascending: true });

  if (error) {
    console.error("Error cargando elasticos:", error.message);
    return leerFichasElasticosModelo();
  }

  const lista = (data || []).map(mapearElasticoDesdeSupabase);
  guardarFichasElasticosModelo(lista);
  return lista;
};

export const guardarElasticoModeloConfiguracion = async (ficha = {}) => {
  const payload = mapearElasticoASupabase(ficha);
  const { data, error } = await supabase
    .from("elasticos_modelo")
    .upsert(payload, { onConflict: "modelo_completo" })
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);

  const normalizada = mapearElasticoDesdeSupabase(data || payload);
  const actualizada = [
    normalizada,
    ...leerFichasElasticosModelo().filter((item) => item?.nombreModelo !== normalizada.nombreModelo),
  ].sort((a, b) => (a?.nombreModelo || "").localeCompare(b?.nombreModelo || ""));
  guardarFichasElasticosModelo(actualizada);
  return normalizada;
};

export const eliminarElasticoModeloConfiguracion = async (nombreModelo = "") => {
  const clave = normalizarTexto(nombreModelo);
  const { error } = await supabase
    .from("elasticos_modelo")
    .delete()
    .eq("modelo_completo", clave);
  if (error) throw new Error(error.message);

  const actualizada = leerFichasElasticosModelo().filter(
    (item) => item?.nombreModelo !== clave,
  );
  guardarFichasElasticosModelo(actualizada);
  return actualizada;
};

export const leerConfiguracionEmpresaSupabase = async () => {
  const { data, error } = await supabase
    .from("configuracion_empresa")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    nombreComercial: data?.nombre_comercial || "CORPORACION CYNARA",
    razonSocial: data?.razon_social || "",
    ruc: data?.ruc || "",
    direccion: data?.direccion || "",
    telefono: data?.telefono || "",
    whatsapp: data?.whatsapp || "",
    correo: data?.correo || "",
    logoUrl: data?.logo_url || "",
    observacion: data?.observacion || "",
    stockMinimoAlerta: Number(data?.stock_minimo_alerta || 5),
    stockMedioAlerta: Number(data?.stock_medio_alerta || 10),
    stockOptimoAlerta: Number(data?.stock_optimo_alerta || 15),
    anioCorrelativoPedido: Number(
      data?.anio_correlativo_pedido || new Date().getFullYear(),
    ),
    ultimoCorrelativoPedido: Number(data?.ultimo_correlativo_pedido || 0),
    siguienteCorrelativoPedidoForzado: Number(
      data?.siguiente_correlativo_pedido_forzado || 0,
    ),
    id: data?.id || "",
  };
};

export const listarCorrelativosSistemaConfiguracion = async () => {
  const { data, error } = await supabase
    .from("correlativos_sistema")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const listaMapeada = (data || []).map(mapearCorrelativoSistemaDesdeSupabase);
  const mapaExistente = new Map(listaMapeada.map((item) => [item.clave, item]));

  return CORRELATIVOS_SISTEMA_POR_DEFECTO.map((base) => ({
    ...base,
    anioActual: new Date().getFullYear(),
    ultimoCorrelativo: 0,
    siguienteForzado: 0,
    activo: true,
    metadata: {},
    ...(mapaExistente.get(base.clave) || {}),
  }));
};

export const leerCorrelativoSistemaConfiguracion = async (clave = "") => {
  const claveNormalizada = normalizarTexto(clave);
  if (!claveNormalizada) {
    throw new Error("No se encontro la clave del correlativo.");
  }

  const lista = await listarCorrelativosSistemaConfiguracion();
  const registro =
    lista.find((item) => item.clave === claveNormalizada) || {
      clave: claveNormalizada,
      nombre: claveNormalizada,
      prefijo: "",
      formato: "DDMMAA-01",
      alcance: "ANUAL",
      anioActual: new Date().getFullYear(),
      ultimoCorrelativo: 0,
      siguienteForzado: 0,
      activo: true,
      metadata: {},
    };

  const anio = Number(registro?.anioActual || new Date().getFullYear());
  try {
    const maximoRegistrado = await obtenerMaximoCorrelativoRegistradoPorClave(
      claveNormalizada,
      anio,
    );
    return {
      ...registro,
      ultimoCorrelativo: Math.max(
        Number(registro?.ultimoCorrelativo || 0),
        Number(maximoRegistrado || 0),
      ),
    };
  } catch {
    return registro;
  }
};

export const guardarCorrelativoSistemaConfiguracion = async (registro = {}) => {
  const payload = mapearCorrelativoSistemaASupabase(registro);
  const { data, error } = await supabase
    .from("correlativos_sistema")
    .upsert(payload, { onConflict: "clave" })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return mapearCorrelativoSistemaDesdeSupabase(data || payload);
};

export const sincronizarCorrelativoSistemaConfiguracion = async (clave = "") => {
  const configuracion = await leerCorrelativoSistemaConfiguracion(clave);
  const anio = Number(configuracion?.anioActual || new Date().getFullYear());
  const maximoRegistrado = await obtenerMaximoCorrelativoRegistradoPorClave(
    configuracion?.clave || clave,
    anio,
  );

  if (Number(maximoRegistrado || 0) <= Number(configuracion?.ultimoCorrelativo || 0)) {
    return configuracion;
  }

  return guardarCorrelativoSistemaConfiguracion({
    ...configuracion,
    ultimoCorrelativo: Number(maximoRegistrado || 0),
  });
};

export const sincronizarTodosLosCorrelativosSistemaConfiguracion = async () => {
  const lista = await listarCorrelativosSistemaConfiguracion();
  const sincronizados = await Promise.all(
    lista.map(async (registro) => {
      try {
        return await sincronizarCorrelativoSistemaConfiguracion(registro.clave);
      } catch {
        return registro;
      }
    }),
  );

  return sincronizados;
};

export const calcularSiguienteCorrelativoSistemaConfiguracion = async ({
  clave = "",
  fecha = "",
  codigos = [],
  codigoExcluir = "",
} = {}) => {
  const correlativo = await leerCorrelativoSistemaConfiguracion(clave);
  const anio = obtenerAnioCorrelativoDesdeFecha(fecha);
  const correlativosHistorial = (Array.isArray(codigos) ? codigos : [])
    .filter((item) => item && item !== codigoExcluir)
    .map((item) =>
      typeof item === "string"
        ? { codigo: item, fecha }
        : { codigo: item?.codigo || item?.codigoInterno || item?.id || "", fecha: item?.fecha || item?.fechaSolicitud || item?.fechaCompra || item?.fechaEnvio || item?.fechaRecepcion || fecha },
    )
    .filter((item) => obtenerAnioCorrelativoDesdeFecha(item.fecha) === anio)
    .map((item) => extraerCorrelativoDesdeCodigo(item.codigo))
    .filter((numero) => Number.isFinite(numero) && numero > 0);

  const mayorHistorial =
    correlativosHistorial.length > 0 ? Math.max(...correlativosHistorial) : 0;
  const mayorConfigurado =
    Number(correlativo?.anioActual || 0) === anio
      ? Number(correlativo?.ultimoCorrelativo || 0)
      : 0;
  const forzado =
    Number(correlativo?.anioActual || 0) === anio
      ? Number(correlativo?.siguienteForzado || 0)
      : 0;

  return {
    correlativo: forzado > 0 ? forzado : Math.max(mayorHistorial, mayorConfigurado) + 1,
    configuracion: correlativo,
  };
};

export const registrarUsoCorrelativoSistemaConfiguracion = async ({
  clave = "",
  fecha = "",
  correlativo = 0,
} = {}) => {
  const configuracion = await leerCorrelativoSistemaConfiguracion(clave);
  const anio = obtenerAnioCorrelativoDesdeFecha(fecha);
  const numero = Math.max(0, Number(correlativo || 0));

  return guardarCorrelativoSistemaConfiguracion({
    ...configuracion,
    anioActual: anio,
    ultimoCorrelativo:
      anio === Number(configuracion?.anioActual || 0)
        ? Math.max(Number(configuracion?.ultimoCorrelativo || 0), numero)
        : numero,
    siguienteForzado:
      Number(configuracion?.siguienteForzado || 0) === numero
        ? 0
        : Number(configuracion?.siguienteForzado || 0),
  });
};

export const guardarConfiguracionEmpresaSupabase = async (configuracion = {}) => {
  const payload = {
    id: configuracion?.id || undefined,
    nombre_comercial: configuracion?.nombreComercial || "CORPORACION CYNARA",
    razon_social: configuracion?.razonSocial || "",
    ruc: configuracion?.ruc || "",
    direccion: configuracion?.direccion || "",
    telefono: configuracion?.telefono || "",
    whatsapp: configuracion?.whatsapp || "",
    correo: configuracion?.correo || "",
    logo_url: configuracion?.logoUrl || "",
    observacion: configuracion?.observacion || "",
    stock_minimo_alerta: Math.max(1, Number(configuracion?.stockMinimoAlerta || 5)),
    stock_medio_alerta: Math.max(
      Math.max(1, Number(configuracion?.stockMinimoAlerta || 5)),
      Number(configuracion?.stockMedioAlerta || 10)
    ),
    stock_optimo_alerta: Math.max(
      Math.max(
        Math.max(1, Number(configuracion?.stockMinimoAlerta || 5)),
        Number(configuracion?.stockMedioAlerta || 10)
      ),
      Number(configuracion?.stockOptimoAlerta || 15)
    ),
    anio_correlativo_pedido: Math.max(
      2020,
      Number(configuracion?.anioCorrelativoPedido || new Date().getFullYear()),
    ),
    ultimo_correlativo_pedido: Math.max(
      0,
      Number(configuracion?.ultimoCorrelativoPedido || 0),
    ),
    siguiente_correlativo_pedido_forzado: Math.max(
      0,
      Number(configuracion?.siguienteCorrelativoPedidoForzado || 0),
    ),
  };
  const { data, error } = await supabase
    .from("configuracion_empresa")
    .upsert(payload)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    nombreComercial: data?.nombre_comercial || payload.nombre_comercial,
    razonSocial: data?.razon_social || payload.razon_social,
    ruc: data?.ruc || payload.ruc,
    direccion: data?.direccion || payload.direccion,
    telefono: data?.telefono || payload.telefono,
    whatsapp: data?.whatsapp || payload.whatsapp,
    correo: data?.correo || payload.correo,
    logoUrl: data?.logo_url || payload.logo_url,
    observacion: data?.observacion || payload.observacion,
    stockMinimoAlerta: Number(data?.stock_minimo_alerta || payload.stock_minimo_alerta || 5),
    stockMedioAlerta: Number(data?.stock_medio_alerta || payload.stock_medio_alerta || 10),
    stockOptimoAlerta: Number(data?.stock_optimo_alerta || payload.stock_optimo_alerta || 15),
    anioCorrelativoPedido: Number(
      data?.anio_correlativo_pedido || payload.anio_correlativo_pedido || new Date().getFullYear(),
    ),
    ultimoCorrelativoPedido: Number(
      data?.ultimo_correlativo_pedido || payload.ultimo_correlativo_pedido || 0,
    ),
    siguienteCorrelativoPedidoForzado: Number(
      data?.siguiente_correlativo_pedido_forzado ||
        payload.siguiente_correlativo_pedido_forzado ||
        0,
    ),
    id: data?.id || payload.id || "",
  };
};

const mapearVentasImpresionDesdeSupabase = (item = {}) => ({
  ...crearConfiguracionVentasImpresionBase(),
  id: item?.id || "",
  tipoComprobanteDefecto: item?.tipo_comprobante_defecto || "NOTA DE VENTA",
  serieNotaVenta: item?.serie_nota || "NV01",
  serieBoleta: item?.serie_boleta || "B001",
  serieFactura: item?.serie_factura || "F001",
  serieNotaCambio: item?.serie_nota_cambio || "NC01",
  correlativoInicial: Number(item?.correlativo_inicial || 1),
  igvPorcentaje: Number(item?.igv || 18),
  preciosIncluyenIgv: Boolean(item?.incluye_igv),
  anchoPapel: String(item?.ancho_ticket_mm || 58),
  nombreImpresora: item?.nombre_impresora || "",
  modoImpresion: item?.modo_impresion || "VISTA",
  mostrarCliente: Boolean(item?.pedir_cliente),
  mostrarDocumentoCliente: Boolean(item?.pedir_documento),
  mostrarTelefonoCliente: Boolean(item?.pedir_celular),
  mostrarCodigoCorto: Boolean(
    item?.mostrar_codigo_corto ?? crearConfiguracionVentasImpresionBase().mostrarCodigoCorto,
  ),
  mostrarColor: Boolean(item?.mostrar_color),
  mostrarTalla: Boolean(item?.mostrar_talla),
  mostrarPrecioUnitario: Boolean(item?.mostrar_precio_unitario),
  mostrarSubtotal: Boolean(item?.mostrar_subtotal_linea),
  mostrarIgv: Boolean(item?.mostrar_igv ?? true),
  mostrarTotal: Boolean(item?.mostrar_total ?? true),
  mensajePie1: item?.mensaje_pie_1 || "",
  mensajePie2: item?.mensaje_pie_2 || "",
});

const mapearVentasImpresionASupabase = (configuracion = {}) => ({
  id: configuracion?.id || undefined,
  tipo_comprobante_defecto: configuracion?.tipoComprobanteDefecto || "NOTA DE VENTA",
  serie_nota: configuracion?.serieNotaVenta || "NV01",
  serie_boleta: configuracion?.serieBoleta || "B001",
  serie_factura: configuracion?.serieFactura || "F001",
  serie_nota_cambio: configuracion?.serieNotaCambio || "NC01",
  correlativo_inicial: Number(configuracion?.correlativoInicial || 1),
  igv: Number(configuracion?.igvPorcentaje || 18),
  incluye_igv: Boolean(configuracion?.preciosIncluyenIgv),
  ancho_ticket_mm: Number(configuracion?.anchoPapel || 58),
  nombre_impresora: configuracion?.nombreImpresora || "",
  modo_impresion: configuracion?.modoImpresion || "VISTA",
  pedir_cliente: Boolean(configuracion?.mostrarCliente),
  pedir_documento: Boolean(configuracion?.mostrarDocumentoCliente),
  pedir_celular: Boolean(configuracion?.mostrarTelefonoCliente),
  mostrar_codigo_corto: Boolean(configuracion?.mostrarCodigoCorto),
  mostrar_color: Boolean(configuracion?.mostrarColor),
  mostrar_talla: Boolean(configuracion?.mostrarTalla),
  mostrar_precio_unitario: Boolean(configuracion?.mostrarPrecioUnitario),
  mostrar_subtotal_linea: Boolean(configuracion?.mostrarSubtotal),
  mostrar_igv: Boolean(configuracion?.mostrarIgv),
  mostrar_total: Boolean(configuracion?.mostrarTotal),
  mensaje_pie_1: configuracion?.mensajePie1 || "",
  mensaje_pie_2: configuracion?.mensajePie2 || "",
});

export const leerConfiguracionVentasImpresionSupabase = async () => {
  const [respuestaVentas, respuestaEmpresa] = await Promise.all([
    supabase
      .from("configuracion_ventas_impresion")
      .select("*")
      .limit(1)
      .maybeSingle(),
    supabase.from("configuracion_empresa").select("*").limit(1).maybeSingle(),
  ]);

  if (respuestaVentas.error) {
    console.error("Error cargando ventas e impresion:", respuestaVentas.error.message);
    return leerConfiguracionVentasImpresion();
  }

  const configuracionEmpresa = respuestaEmpresa.data || {};
  const configuracion = {
    ...mapearVentasImpresionDesdeSupabase(respuestaVentas.data || {}),
    nombreComercial:
      configuracionEmpresa?.nombre_comercial ||
      crearConfiguracionVentasImpresionBase().nombreComercial,
    razonSocial: configuracionEmpresa?.razon_social || "",
    ruc: configuracionEmpresa?.ruc || "",
    direccion: configuracionEmpresa?.direccion || "",
    telefono: configuracionEmpresa?.telefono || "",
    whatsapp: configuracionEmpresa?.whatsapp || "",
    logoUrl: configuracionEmpresa?.logo_url || "",
  };
  guardarConfiguracionVentasImpresion(configuracion);
  return configuracion;
};

export const guardarConfiguracionVentasImpresionSupabase = async (configuracion = {}) => {
  const payload = mapearVentasImpresionASupabase(configuracion);
  const { data, error } = await supabase
    .from("configuracion_ventas_impresion")
    .upsert(payload)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);

  const localActual = leerConfiguracionVentasImpresion();
  const normalizada = {
    ...localActual,
    ...mapearVentasImpresionDesdeSupabase(data || payload),
    nombreComercial: configuracion?.nombreComercial || localActual?.nombreComercial || "",
    razonSocial: configuracion?.razonSocial || localActual?.razonSocial || "",
    ruc: configuracion?.ruc || localActual?.ruc || "",
    direccion: configuracion?.direccion || localActual?.direccion || "",
    telefono: configuracion?.telefono || localActual?.telefono || "",
    whatsapp: configuracion?.whatsapp || localActual?.whatsapp || "",
    logoUrl: configuracion?.logoUrl || localActual?.logoUrl || "",
  };
  guardarConfiguracionVentasImpresion(normalizada);
  return normalizada;
};

const mapearTerceroDesdeSupabase = (item = {}) => ({
  id: item?.id || "",
  tipo: normalizarTexto(item?.tipo || "CLIENTE"),
  documento: item?.documento || "",
  nombre: item?.nombre || "",
  telefono: item?.telefono || "",
  correo: item?.correo || "",
  direccion: item?.direccion || "",
  contacto: item?.contacto || "",
  observacion: item?.observacion || "",
  estado: item?.estado || "ACTIVO",
});

export const listarClientesProveedoresConfiguracion = async () => {
  const { data, error } = await supabase
    .from("clientes_proveedores")
    .select("*")
    .order("tipo", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(mapearTerceroDesdeSupabase);
};

export const guardarClienteProveedorConfiguracion = async (registro = {}) => {
  const payload = {
    id: registro?.id || undefined,
    tipo: normalizarTexto(registro?.tipo || "CLIENTE"),
    documento: registro?.documento || "",
    nombre: normalizarTexto(registro?.nombre || ""),
    telefono: registro?.telefono || "",
    correo: registro?.correo || "",
    direccion: normalizarTexto(registro?.direccion || ""),
    contacto: normalizarTexto(registro?.contacto || ""),
    observacion: registro?.observacion || "",
    estado: normalizarTexto(registro?.estado || "ACTIVO"),
  };
  const { data, error } = await supabase
    .from("clientes_proveedores")
    .upsert(payload)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapearTerceroDesdeSupabase(data || payload);
};

export const eliminarClienteProveedorConfiguracion = async (id = "") => {
  const { error } = await supabase.from("clientes_proveedores").delete().eq("id", id);
  if (error) throw new Error(error.message);
};

export const listarModelosProductoConfiguracion = async ({
  incluirInactivos = false,
} = {}) => {
  const data = await listarTodoPaginado(() => {
    let consulta = supabase
      .from("modelos_producto")
      .select("*")
      .order("nombre_modelo", { ascending: true });
    if (!incluirInactivos) {
      consulta = consulta.eq("estado", "ACTIVO");
    }
    return consulta;
  });

  return data.map(mapearModeloProductoDesdeSupabase);
};

export const listarVariantesProductoConfiguracion = async ({
  incluirInactivos = false,
} = {}) => {
  const data = await listarTodoPaginado(() => {
    let consulta = supabase
      .from("modelos_producto_variantes")
      .select("*")
      .order("nombre_modelo", { ascending: true })
      .order("color", { ascending: true })
      .order("talla", { ascending: true });
    if (!incluirInactivos) {
      consulta = consulta.eq("estado", "ACTIVO");
    }
    return consulta;
  });

  return data.map(mapearVarianteProductoDesdeSupabase);
};

export const listarVariantesProductoPorModeloConfiguracion = async ({
  modeloId = "",
  codigoModelo = "",
  nombreModelo = "",
  incluirInactivos = false,
} = {}) => {
  const consultas = [];

  const aplicarEstado = (consultaBase) =>
    incluirInactivos ? consultaBase : consultaBase.eq("estado", "ACTIVO");

  if (modeloId) {
    consultas.push(() =>
      aplicarEstado(
        supabase
          .from("modelos_producto_variantes")
          .select("*")
          .eq("modelo_id", modeloId)
          .order("color", { ascending: true })
          .order("talla", { ascending: true }),
      ),
    );
  }

  if (codigoModelo) {
    consultas.push(() =>
      aplicarEstado(
        supabase
          .from("modelos_producto_variantes")
          .select("*")
          .eq("codigo_modelo", codigoModelo)
          .order("color", { ascending: true })
          .order("talla", { ascending: true }),
      ),
    );
  }

  if (nombreModelo) {
    consultas.push(() =>
      aplicarEstado(
        supabase
          .from("modelos_producto_variantes")
          .select("*")
          .eq("nombre_modelo", nombreModelo)
          .order("color", { ascending: true })
          .order("talla", { ascending: true }),
      ),
    );
  }

  for (const crearConsulta of consultas) {
    const data = await listarTodoPaginado(crearConsulta);
    if (data.length > 0) {
      return data.map(mapearVarianteProductoDesdeSupabase);
    }
  }

  return [];
};

export const listarVariantesProductoPorModeloPaginadasConfiguracion = async ({
  modeloId = "",
  codigoModelo = "",
  nombreModelo = "",
  color = "",
  talla = "",
  incluirInactivos = false,
  pagina = 1,
  tamanoPagina = 10,
} = {}) => {
  const desde = Math.max(0, (Number(pagina || 1) - 1) * Number(tamanoPagina || 10));
  const hasta = desde + Number(tamanoPagina || 10) - 1;
  const consultas = [];
  const colorNormalizado = normalizarColorProducto(color || "");
  const tallaNormalizada = normalizarTallaProducto(talla || "");

  const aplicarFiltrosVariante = (consultaBase) => {
    let consulta = consultaBase;
    if (!incluirInactivos) {
      consulta = consulta.eq("estado", "ACTIVO");
    }
    if (normalizarTexto(color || "")) {
      consulta = consulta.eq("color_normalizado", colorNormalizado);
    }
    if (normalizarTexto(talla || "")) {
      consulta = consulta.eq("talla_normalizada", tallaNormalizada);
    }
    return consulta;
  };

  if (modeloId) {
    consultas.push(() =>
      aplicarFiltrosVariante(
        supabase
          .from("modelos_producto_variantes")
          .select("*", { count: "exact" })
          .eq("modelo_id", modeloId)
          .order("color", { ascending: true })
          .order("talla", { ascending: true })
          .range(desde, hasta),
      ),
    );
  }

  if (codigoModelo) {
    consultas.push(() =>
      aplicarFiltrosVariante(
        supabase
          .from("modelos_producto_variantes")
          .select("*", { count: "exact" })
          .eq("codigo_modelo", codigoModelo)
          .order("color", { ascending: true })
          .order("talla", { ascending: true })
          .range(desde, hasta),
      ),
    );
  }

  if (nombreModelo) {
    consultas.push(() =>
      aplicarFiltrosVariante(
        supabase
          .from("modelos_producto_variantes")
          .select("*", { count: "exact" })
          .eq("nombre_modelo", nombreModelo)
          .order("color", { ascending: true })
          .order("talla", { ascending: true })
          .range(desde, hasta),
      ),
    );
  }

  for (const crearConsulta of consultas) {
    const { data, error, count } = await crearConsulta();
    if (error) {
      throw new Error(error.message);
    }

    const lista = Array.isArray(data) ? data.map(mapearVarianteProductoDesdeSupabase) : [];
    if (lista.length > 0 || Number(count || 0) > 0) {
      return {
        total: Number(count || 0),
        registros: lista,
      };
    }
  }

  return {
    total: 0,
    registros: [],
  };
};

export const guardarModeloProductoConfiguracion = async (registro = {}) => {
  const nombreModelo = normalizarTexto(registro?.nombreModelo);
  if (!nombreModelo) {
    throw new Error("El nombre del modelo es obligatorio.");
  }

  const partesInferidas = inferirPartesModeloDesdeNombre(nombreModelo);

  const modelosActuales = await listarModelosProductoConfiguracion();
  const modeloActual = modelosActuales.find((item) => item.id === registro?.id);
  const duplicadoPorNombre = modelosActuales.find(
    (item) =>
      item.id !== registro?.id &&
      item.nombreNormalizado === construirNombreNormalizadoProducto(nombreModelo),
  );
  const idObjetivo = duplicadoPorNombre?.id || registro?.id || undefined;
  const modeloObjetivo = modelosActuales.find((item) => item.id === idObjetivo);

  const payload = {
    id: idObjetivo,
    codigo_modelo:
      modeloObjetivo?.codigoModelo ||
      modeloActual?.codigoModelo ||
      registro?.codigoModelo ||
      crearCodigoModeloSiguiente(modelosActuales),
    codigo_corto:
      normalizarCodigoCorto(registro?.codigoCorto || "", 30) ||
      modeloObjetivo?.codigoCorto ||
      modeloActual?.codigoCorto ||
      crearCodigoCortoModeloConfiguracion({
        categoria: registro?.categoria,
        modeloCatalogo: registro?.modeloCatalogo,
        telaNombre: registro?.telaNombre,
        nombreModelo,
      }),
    nombre_modelo: nombreModelo,
    nombre_normalizado: construirNombreNormalizadoProducto(nombreModelo),
    categoria: normalizarTexto(registro?.categoria) || partesInferidas.categoria || "",
    modelo_catalogo:
      normalizarTexto(registro?.modeloCatalogo) || partesInferidas.modeloCatalogo || "",
    tela_nombre: normalizarTexto(registro?.telaNombre) || partesInferidas.telaNombre || "",
    origen_carga:
      registro?.origenCarga ||
      modeloObjetivo?.origenCarga ||
      modeloActual?.origenCarga ||
      "MANUAL",
    estado: normalizarTexto(registro?.estado || "ACTIVO"),
    metadata: {
      ...(modeloObjetivo?.metadata || {}),
      ...(modeloActual?.metadata || {}),
      ...(registro?.metadata || {}),
    },
  };

  const consulta = idObjetivo
    ? supabase
        .from("modelos_producto")
        .update(payload)
        .eq("id", idObjetivo)
        .select("*")
        .maybeSingle()
    : supabase
        .from("modelos_producto")
        .upsert(payload, { onConflict: "nombre_normalizado" })
        .select("*")
        .maybeSingle();

  const { data, error } = await consulta;

  if (error) throw new Error(error.message);
  const modeloGuardado = mapearModeloProductoDesdeSupabase(data || payload);

  if (registro?.id && duplicadoPorNombre && duplicadoPorNombre.id !== registro.id) {
    await fusionarModeloDuplicadoConfiguracion({
      modeloOrigenId: registro.id,
      modeloDestino: modeloGuardado,
    });
  }

  await sincronizarVariantesModeloConfiguracion(modeloGuardado);
  return modeloGuardado;
};

export const eliminarModeloProductoConfiguracion = async (modeloId = "") => {
  const { error } = await supabase.from("modelos_producto").delete().eq("id", modeloId);
  if (error) throw new Error(error.message);
};

export const inactivarModeloProductoConfiguracion = async (modeloId = "") => {
  if (!modeloId) throw new Error("No se encontro el modelo a inactivar.");

  const { error: errorVariantes } = await supabase
    .from("modelos_producto_variantes")
    .update({ estado: "INACTIVO" })
    .eq("modelo_id", modeloId);

  if (errorVariantes) throw new Error(errorVariantes.message);

  const { error } = await supabase
    .from("modelos_producto")
    .update({ estado: "INACTIVO" })
    .eq("id", modeloId);
  if (error) throw new Error(error.message);
};

export const activarModeloProductoConfiguracion = async (modeloId = "") => {
  if (!modeloId) throw new Error("No se encontro el modelo a reactivar.");

  const { error: errorVariantes } = await supabase
    .from("modelos_producto_variantes")
    .update({ estado: "ACTIVO" })
    .eq("modelo_id", modeloId);

  if (errorVariantes) throw new Error(errorVariantes.message);

  const { error } = await supabase
    .from("modelos_producto")
    .update({ estado: "ACTIVO" })
    .eq("id", modeloId);
  if (error) throw new Error(error.message);
};

export const guardarVarianteProductoConfiguracion = async (registro = {}) => {
  const modeloId = registro?.modeloId || "";
  if (!modeloId) {
    throw new Error("Selecciona un modelo para la variante.");
  }

  const color = normalizarColorProducto(registro?.color);
  const talla = normalizarTallaProducto(registro?.talla);
  if (!talla) {
    throw new Error("La talla es obligatoria.");
  }

  const variantesActuales = await listarVariantesProductoConfiguracion();
  const existente = variantesActuales.find(
    (item) =>
      item.id === registro?.id ||
      (item.modeloId === modeloId &&
        item.colorNormalizado === color &&
        item.tallaNormalizada === talla),
  );

  const modelos = await listarModelosProductoConfiguracion();
  const modelo = modelos.find((item) => item.id === modeloId);
  if (!modelo) {
    throw new Error("No se encontro el modelo base.");
  }

  const payload = {
    id: existente?.id || registro?.id || undefined,
    modelo_id: modeloId,
    codigo_modelo: modelo.codigoModelo,
    codigo_variante: "",
    codigo_corto: "",
    nombre_modelo: modelo.nombreModelo,
    color,
    color_normalizado: color,
    talla,
    talla_normalizada: talla,
    descripcion_variante: `${modelo.nombreModelo} | ${color} | ${talla}`,
    origen_carga: registro?.origenCarga || existente?.origenCarga || "MANUAL",
    estado: normalizarTexto(registro?.estado || "ACTIVO"),
    metadata: {
      ...(existente?.metadata || {}),
      ...(registro?.metadata || {}),
    },
  };

  payload.codigo_variante = resolverCodigoVarianteUnico({
    codigoBase:
      existente?.codigoVariante ||
      registro?.codigoVariante ||
      crearCodigoVarianteSiguiente(variantesActuales),
    variantesExistentes: variantesActuales,
    varianteIdActual: payload.id || "",
  });

  payload.codigo_corto = resolverCodigoCortoVarianteUnico({
    codigoBase:
      normalizarCodigoCorto(registro?.codigoCorto || "", 40) ||
      crearCodigoCortoVarianteConfiguracion({
        codigoCortoModelo: modelo.codigoCorto,
        color,
        talla,
      }),
    variantesExistentes: variantesActuales,
    varianteIdActual: payload.id || "",
  });

  const { data, error } = await supabase
    .from("modelos_producto_variantes")
    .upsert(payload, {
      onConflict: "modelo_id,color_normalizado,talla_normalizada",
    })
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapearVarianteProductoDesdeSupabase(data || payload);
};

export const eliminarVarianteProductoConfiguracion = async (varianteId = "") => {
  const { error } = await supabase
    .from("modelos_producto_variantes")
    .delete()
    .eq("id", varianteId);
  if (error) throw new Error(error.message);
};

export const inactivarVarianteProductoConfiguracion = async (varianteId = "") => {
  if (!varianteId) throw new Error("No se encontro la variante a inactivar.");
  const { error } = await supabase
    .from("modelos_producto_variantes")
    .update({ estado: "INACTIVO" })
    .eq("id", varianteId);
  if (error) throw new Error(error.message);
};

export const activarVarianteProductoConfiguracion = async (varianteId = "") => {
  if (!varianteId) throw new Error("No se encontro la variante a reactivar.");
  const { error } = await supabase
    .from("modelos_producto_variantes")
    .update({ estado: "ACTIVO" })
    .eq("id", varianteId);
  if (error) throw new Error(error.message);
};

export const registrarModeloYVariantesDesdePedido = async ({
  modeloId = "",
  codigoModelo = "",
  nombreModelo = "",
  categoria = "",
  modeloCatalogo = "",
  telaNombre = "",
  colores = [],
  tallas = [],
  metadata = {},
} = {}) => {
  const nombreNormalizado = construirNombreNormalizadoProducto(nombreModelo);
  const modelosActuales = await listarModelosProductoConfiguracion({ incluirInactivos: true });

  const modeloExistente =
    modelosActuales.find((item) => item.id && item.id === modeloId) ||
    modelosActuales.find(
      (item) =>
        codigoModelo &&
        (item?.codigoModelo || "").toString().trim().toUpperCase() ===
          codigoModelo.toString().trim().toUpperCase(),
    ) ||
    modelosActuales.find((item) => item.nombreNormalizado === nombreNormalizado) ||
    null;

  const modelo = modeloExistente
    ? await guardarModeloProductoConfiguracion({
        id: modeloExistente.id,
        codigoModelo: modeloExistente.codigoModelo,
        codigoCorto: modeloExistente.codigoCorto,
        nombreModelo,
        categoria,
        modeloCatalogo,
        telaNombre,
        estado: modeloExistente.estado || "ACTIVO",
        metadata: {
          ...(modeloExistente.metadata || {}),
          ...metadata,
        },
      })
    : await guardarModeloProductoConfiguracion({
        nombreModelo,
        categoria,
        modeloCatalogo,
        telaNombre,
        metadata,
      });

  const coloresUnicos = Array.from(
    new Set(colores.map((item) => normalizarColorProducto(item)).filter(Boolean)),
  );
  const tallasUnicas = Array.from(
    new Set(tallas.map((item) => normalizarTallaProducto(item)).filter(Boolean)),
  );

  const variantesModeloActuales = await listarVariantesProductoPorModeloConfiguracion({
    modeloId: modelo.id,
    incluirInactivos: true,
  });
  const variantesExistentes = new Map(
    variantesModeloActuales.map((item) => [
      `${item.colorNormalizado}__${item.tallaNormalizada}`,
      item,
    ]),
  );

  const payloadVariantes = [];
  let indiceCreacion = 0;

  for (const color of coloresUnicos) {
    for (const talla of tallasUnicas) {
      const clave = `${color}__${talla}`;
      const existente = variantesExistentes.get(clave);

      if (existente) {
        continue;
      }

      const codigoBaseVariante = crearCodigoCortoVarianteConfiguracion({
        codigoCortoModelo: modelo.codigoCorto,
        color,
        talla,
      });

      payloadVariantes.push({
        modelo_id: modelo.id,
        codigo_modelo: modelo.codigoModelo,
        codigo_variante: resolverCodigoVarianteUnico({
          codigoBase: crearCodigoVarianteRapido(indiceCreacion),
          variantesExistentes: [
            ...variantesModeloActuales,
            ...payloadVariantes.map((item) => ({
              id: item.codigo_variante,
              codigoVariante: item.codigo_variante,
            })),
          ],
          varianteIdActual: "",
        }),
        codigo_corto: resolverCodigoCortoVarianteUnico({
          codigoBase: codigoBaseVariante,
          variantesExistentes: [
            ...variantesModeloActuales,
            ...payloadVariantes.map((item) => ({
              id: item.codigo_variante,
              codigoCorto: item.codigo_corto,
            })),
          ],
          varianteIdActual: "",
        }),
        nombre_modelo: modelo.nombreModelo,
        color,
        color_normalizado: color,
        talla,
        talla_normalizada: talla,
        descripcion_variante: `${modelo.nombreModelo} | ${color} | ${talla}`,
        origen_carga: "PEDIDO_PRODUCCION",
        estado: "ACTIVO",
        metadata: {
          origen: "PEDIDO_PRODUCCION",
          ...metadata,
        },
      });

      indiceCreacion += 1;
    }
  }

  if (payloadVariantes.length > 0) {
    const { error } = await supabase
      .from("modelos_producto_variantes")
      .upsert(payloadVariantes, {
        onConflict: "modelo_id,color_normalizado,talla_normalizada",
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  return modelo;
};
