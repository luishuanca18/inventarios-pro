import { obtenerNombresTalleres } from "./fichasTalleres";

export const CLAVE_CATALOGOS_PRODUCCION = "cynara_catalogos_produccion";

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const CATALOGOS_PRODUCCION_POR_DEFECTO = {
  empresas: ["CYNARA"],
  sedes: ["SEDE PRINCIPAL"],
  monedas: ["SOLES", "DOLARES"],
  datosFiscales: ["REGIMEN GENERAL"],
  seriesDocumentos: ["F001", "B001"],
  impuestos: ["IGV 18%"],
  proveedores: ["TEXTILES ANDINOS", "IMPORTADORA SANTA FE"],
  rucProveedor: ["20123456789", "20456789123"],
  contactosProveedor: ["MARIO PEREZ"],
  direccionesProveedor: ["LIMA"],
  clientes: ["TIENDA CENTRO", "TIENDA SAN JUAN"],
  documentosCliente: ["45879632", "20111222333"],
  contactosCliente: ["ROSA"],
  direccionesCliente: ["JIRON CENTRAL 123"],
  usuarios: ["ADMIN", "PRUEBA"],
  rolesUsuario: ["ADMINISTRADOR", "GERENCIA", "RECURSOS HUMANOS", "ENCARGADO PRODUCCION", "ALMACEN", "TALLER"],
  modulosSistema: [
    "PRODUCCION",
    "ALMACEN",
    "TALLERES",
    "TIENDAS",
    "CONTABILIDAD",
    "RECURSOS HUMANOS",
    "REPORTES",
    "CONFIGURACION",
  ],
  permisos: ["VER", "CREAR", "EDITAR", "ELIMINAR"],
  personal: ["ROSA", "LUIS"],
  areasPersonal: ["PRODUCCION", "ALMACEN", "CALIDAD", "ADMINISTRACION"],
  cargosPersonal: ["ENCARGADO", "OPERARIO", "JEFE", "ASISTENTE"],
  responsables: ["ROSA", "LUIS"],
  accesosModulo: ["PRODUCCION", "ALMACEN"],
  categorias: ["PANTALON", "CHAVO", "LEGGINS", "SHORT"],
  modelos: ["CLASICO", "SARA", "JULIA"],
  modelosDerivados: [
    "SHORT CLASICO FRENCH",
    "SHORT CLASICO FULL",
    "SHORT CLASICO CHALIS",
  ],
  telasModelo: ["FRENCH", "FULL", "CHALIS", "DENIM", "CARGO"],
  colores: ["NEGRO", "BLANCO", "AZUL", "BEIGE", "ROJO"],
  tallas: ["S", "M", "L", "XL", "XXL"],
  tiposTela: [
    "CHALIZ",
    "FRENCH TERRY",
    "FRENCH TERRY RIGIDO",
    "FULL LICRA",
    "DENIM",
    "PERCHADO",
    "PIEL DE DURAZNO",
    "CHOMPERO",
  ],
  modelosNombreTaller: [],
  acabados: ["LISO", "ANIMAL PRINT", "LINEAS DORADAS"],
  avios: ["ELASTICO", "POLIAMIDA", "CIERRE", "ETIQUETA"],
  detallesConfeccion: [
    "PINZAS",
    "OJAL",
    "BOLSILLOS",
    "VENAS",
    "FRANJA",
    "AUMENTA FRANJA",
    "PASADORES",
    "MULTIAGUJA",
  ],
  tiposHijoOp: ["MISMO_MODELO", "OTRO_MODELO"],
  origenesHijoOp: ["RETAZO", "SOBRANTE", "TELA_NORMAL"],
  unidadesMedida: ["UNIDAD", "KG", "METROS", "ROLLO"],
  tiposMovimiento: ["INGRESO", "SALIDA", "AJUSTE"],
  ubicaciones: ["RACK A1", "RACK B1"],
  almacenes: ["ALMACEN PRINCIPAL"],
  motivosAjuste: ["MERMA", "REGULARIZACION"],
  lotesBase: ["P001", "P002"],
  correlativosPedido: ["PED"],
  correlativosOp: ["OP"],
  correlativosIngreso: ["CMP"],
  correlativosSalida: ["SAL"],
  correlativosRecepcion: ["REC"],
  correlativosTienda: ["TIE", "VTI"],
  correlativosCambioVenta: ["CVT"],
  correlativosTercerizacion: ["TER"],
  correlativosDevolucion: ["DEV"],
  formatosCodigo: ["DDMMAA-01"],
  temaDefecto: ["OSCURO"],
  idioma: ["ESPANOL"],
  reglasValidacion: ["CAMPOS OBLIGATORIOS"],
  diasEntrega: ["1", "2", "3"],
  estadosSistema: ["PENDIENTE", "APROBADO", "EN TALLER"],
  mensajesBase: ["NO HAY STOCK DISPONIBLE"],
  monedasOperacion: ["SOLES", "DOLARES"],
  igvGlobal: ["18"],
  decimalesSistema: ["2"],
  politicasStock: ["NO PERMITIR STOCK NEGATIVO", "ALERTA STOCK BAJO", "ALERTA STOCK MEDIO BAJO"],
  tallasEspeciales: ["ST", "XL", "XXL"],
  canalesComerciales: ["MOSTRADOR", "TIKTOK", "TIENDA", "TALLER", "REVENDEDORA"],
  motivosGlobales: ["SOBRANTE", "FALLA", "CAMBIO DE COLOR", "CAMBIO DE TELA", "ERROR DE ENVIO", "AJUSTE"],
  reglasSeguridad: ["LOGIN POR CORREO", "LOGIN POR NOMBRE VISIBLE", "RESET TEMPORAL"],
  configuracionesGenerales: ["USA CODIGO AUTOMATICO"],
};

const normalizarLista = (lista = []) =>
  Array.from(
    new Set(
      lista
        .map((item) => normalizarTexto(item))
        .filter(Boolean)
    )
  );

const mezclarNombresTalleres = (lista = []) =>
  normalizarLista([...lista, ...obtenerNombresTalleres()]);

export const leerCatalogosProduccion = () => {
  const contenido = localStorage.getItem(CLAVE_CATALOGOS_PRODUCCION);

  if (!contenido) {
    return {
      ...CATALOGOS_PRODUCCION_POR_DEFECTO,
      modelosNombreTaller: mezclarNombresTalleres(
        CATALOGOS_PRODUCCION_POR_DEFECTO.modelosNombreTaller
      ),
    };
  }

  try {
    const guardado = JSON.parse(contenido);

    return {
      empresas: normalizarLista(
        guardado?.empresas || CATALOGOS_PRODUCCION_POR_DEFECTO.empresas
      ),
      sedes: normalizarLista(
        guardado?.sedes || CATALOGOS_PRODUCCION_POR_DEFECTO.sedes
      ),
      monedas: normalizarLista(
        guardado?.monedas || CATALOGOS_PRODUCCION_POR_DEFECTO.monedas
      ),
      datosFiscales: normalizarLista(
        guardado?.datosFiscales || CATALOGOS_PRODUCCION_POR_DEFECTO.datosFiscales
      ),
      seriesDocumentos: normalizarLista(
        guardado?.seriesDocumentos ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.seriesDocumentos
      ),
      impuestos: normalizarLista(
        guardado?.impuestos || CATALOGOS_PRODUCCION_POR_DEFECTO.impuestos
      ),
      proveedores: normalizarLista(
        guardado?.proveedores || CATALOGOS_PRODUCCION_POR_DEFECTO.proveedores
      ),
      rucProveedor: normalizarLista(
        guardado?.rucProveedor || CATALOGOS_PRODUCCION_POR_DEFECTO.rucProveedor
      ),
      contactosProveedor: normalizarLista(
        guardado?.contactosProveedor ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.contactosProveedor
      ),
      direccionesProveedor: normalizarLista(
        guardado?.direccionesProveedor ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.direccionesProveedor
      ),
      clientes: normalizarLista(
        guardado?.clientes || CATALOGOS_PRODUCCION_POR_DEFECTO.clientes
      ),
      documentosCliente: normalizarLista(
        guardado?.documentosCliente ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.documentosCliente
      ),
      contactosCliente: normalizarLista(
        guardado?.contactosCliente ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.contactosCliente
      ),
      direccionesCliente: normalizarLista(
        guardado?.direccionesCliente ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.direccionesCliente
      ),
      usuarios: normalizarLista(
        guardado?.usuarios || CATALOGOS_PRODUCCION_POR_DEFECTO.usuarios
      ),
      rolesUsuario: normalizarLista(
        guardado?.rolesUsuario || CATALOGOS_PRODUCCION_POR_DEFECTO.rolesUsuario
      ),
      modulosSistema: normalizarLista(
        guardado?.modulosSistema ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.modulosSistema
      ),
      permisos: normalizarLista(
        guardado?.permisos || CATALOGOS_PRODUCCION_POR_DEFECTO.permisos
      ),
      personal: normalizarLista(
        guardado?.personal || CATALOGOS_PRODUCCION_POR_DEFECTO.personal
      ),
      areasPersonal: normalizarLista(
        guardado?.areasPersonal ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.areasPersonal
      ),
      cargosPersonal: normalizarLista(
        guardado?.cargosPersonal ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.cargosPersonal
      ),
      responsables: normalizarLista(
        guardado?.responsables || CATALOGOS_PRODUCCION_POR_DEFECTO.responsables
      ),
      accesosModulo: normalizarLista(
        guardado?.accesosModulo ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.accesosModulo
      ),
      categorias: normalizarLista(
        guardado?.categorias || CATALOGOS_PRODUCCION_POR_DEFECTO.categorias
      ),
      modelos: normalizarLista(
        guardado?.modelos || CATALOGOS_PRODUCCION_POR_DEFECTO.modelos
      ),
      modelosDerivados: normalizarLista(
        guardado?.modelosDerivados ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.modelosDerivados
      ),
      telasModelo: normalizarLista(
        guardado?.telasModelo || CATALOGOS_PRODUCCION_POR_DEFECTO.telasModelo
      ),
      colores: normalizarLista(
        guardado?.colores || CATALOGOS_PRODUCCION_POR_DEFECTO.colores
      ),
      tallas: normalizarLista(
        guardado?.tallas || CATALOGOS_PRODUCCION_POR_DEFECTO.tallas
      ),
      tiposTela: normalizarLista(
        guardado?.tiposTela || CATALOGOS_PRODUCCION_POR_DEFECTO.tiposTela
      ),
      modelosNombreTaller: mezclarNombresTalleres(
        guardado?.modelosNombreTaller ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.modelosNombreTaller
      ),
      acabados: normalizarLista(
        guardado?.acabados || CATALOGOS_PRODUCCION_POR_DEFECTO.acabados
      ),
      avios: normalizarLista(guardado?.avios || CATALOGOS_PRODUCCION_POR_DEFECTO.avios),
      detallesConfeccion: normalizarLista(
        guardado?.detallesConfeccion ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.detallesConfeccion
      ),
      tiposHijoOp: normalizarLista(
        guardado?.tiposHijoOp || CATALOGOS_PRODUCCION_POR_DEFECTO.tiposHijoOp
      ),
      origenesHijoOp: normalizarLista(
        guardado?.origenesHijoOp || CATALOGOS_PRODUCCION_POR_DEFECTO.origenesHijoOp
      ),
      unidadesMedida: normalizarLista(
        guardado?.unidadesMedida ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.unidadesMedida
      ),
      tiposMovimiento: normalizarLista(
        guardado?.tiposMovimiento ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.tiposMovimiento
      ),
      ubicaciones: normalizarLista(
        guardado?.ubicaciones || CATALOGOS_PRODUCCION_POR_DEFECTO.ubicaciones
      ),
      almacenes: normalizarLista(
        guardado?.almacenes || CATALOGOS_PRODUCCION_POR_DEFECTO.almacenes
      ),
      motivosAjuste: normalizarLista(
        guardado?.motivosAjuste ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.motivosAjuste
      ),
      lotesBase: normalizarLista(
        guardado?.lotesBase || CATALOGOS_PRODUCCION_POR_DEFECTO.lotesBase
      ),
      correlativosPedido: normalizarLista(
        guardado?.correlativosPedido ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosPedido
      ),
      correlativosOp: normalizarLista(
        guardado?.correlativosOp || CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosOp
      ),
      correlativosIngreso: normalizarLista(
        guardado?.correlativosIngreso ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosIngreso
      ),
      correlativosSalida: normalizarLista(
        guardado?.correlativosSalida ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosSalida
      ),
      correlativosRecepcion: normalizarLista(
        guardado?.correlativosRecepcion ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosRecepcion
      ),
      correlativosTienda: normalizarLista(
        guardado?.correlativosTienda ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosTienda
      ),
      correlativosCambioVenta: normalizarLista(
        guardado?.correlativosCambioVenta ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosCambioVenta
      ),
      correlativosTercerizacion: normalizarLista(
        guardado?.correlativosTercerizacion ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosTercerizacion
      ),
      correlativosDevolucion: normalizarLista(
        guardado?.correlativosDevolucion ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.correlativosDevolucion
      ),
      formatosCodigo: normalizarLista(
        guardado?.formatosCodigo ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.formatosCodigo
      ),
      temaDefecto: normalizarLista(
        guardado?.temaDefecto || CATALOGOS_PRODUCCION_POR_DEFECTO.temaDefecto
      ),
      idioma: normalizarLista(
        guardado?.idioma || CATALOGOS_PRODUCCION_POR_DEFECTO.idioma
      ),
      reglasValidacion: normalizarLista(
        guardado?.reglasValidacion ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.reglasValidacion
      ),
      diasEntrega: normalizarLista(
        guardado?.diasEntrega || CATALOGOS_PRODUCCION_POR_DEFECTO.diasEntrega
      ),
      estadosSistema: normalizarLista(
        guardado?.estadosSistema ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.estadosSistema
      ),
      mensajesBase: normalizarLista(
        guardado?.mensajesBase ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.mensajesBase
      ),
      monedasOperacion: normalizarLista(
        guardado?.monedasOperacion ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.monedasOperacion
      ),
      igvGlobal: normalizarLista(
        guardado?.igvGlobal || CATALOGOS_PRODUCCION_POR_DEFECTO.igvGlobal
      ),
      decimalesSistema: normalizarLista(
        guardado?.decimalesSistema ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.decimalesSistema
      ),
      politicasStock: normalizarLista(
        guardado?.politicasStock ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.politicasStock
      ),
      tallasEspeciales: normalizarLista(
        guardado?.tallasEspeciales ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.tallasEspeciales
      ),
      canalesComerciales: normalizarLista(
        guardado?.canalesComerciales ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.canalesComerciales
      ),
      motivosGlobales: normalizarLista(
        guardado?.motivosGlobales ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.motivosGlobales
      ),
      reglasSeguridad: normalizarLista(
        guardado?.reglasSeguridad ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.reglasSeguridad
      ),
      configuracionesGenerales: normalizarLista(
        guardado?.configuracionesGenerales ||
          CATALOGOS_PRODUCCION_POR_DEFECTO.configuracionesGenerales
      ),
    };
  } catch {
    return CATALOGOS_PRODUCCION_POR_DEFECTO;
  }
};

export const guardarCatalogosProduccion = (catalogos) => {
  const catalogosNormalizados = {
    empresas: normalizarLista(catalogos?.empresas),
    sedes: normalizarLista(catalogos?.sedes),
    monedas: normalizarLista(catalogos?.monedas),
    datosFiscales: normalizarLista(catalogos?.datosFiscales),
    seriesDocumentos: normalizarLista(catalogos?.seriesDocumentos),
    impuestos: normalizarLista(catalogos?.impuestos),
    proveedores: normalizarLista(catalogos?.proveedores),
    rucProveedor: normalizarLista(catalogos?.rucProveedor),
    contactosProveedor: normalizarLista(catalogos?.contactosProveedor),
    direccionesProveedor: normalizarLista(catalogos?.direccionesProveedor),
    clientes: normalizarLista(catalogos?.clientes),
    documentosCliente: normalizarLista(catalogos?.documentosCliente),
    contactosCliente: normalizarLista(catalogos?.contactosCliente),
    direccionesCliente: normalizarLista(catalogos?.direccionesCliente),
    usuarios: normalizarLista(catalogos?.usuarios),
    rolesUsuario: normalizarLista(catalogos?.rolesUsuario),
    modulosSistema: normalizarLista(catalogos?.modulosSistema),
    permisos: normalizarLista(catalogos?.permisos),
    personal: normalizarLista(catalogos?.personal),
    areasPersonal: normalizarLista(catalogos?.areasPersonal),
    cargosPersonal: normalizarLista(catalogos?.cargosPersonal),
    responsables: normalizarLista(catalogos?.responsables),
    accesosModulo: normalizarLista(catalogos?.accesosModulo),
    categorias: normalizarLista(catalogos?.categorias),
    modelos: normalizarLista(catalogos?.modelos),
    modelosDerivados: normalizarLista(catalogos?.modelosDerivados),
    telasModelo: normalizarLista(catalogos?.telasModelo),
    colores: normalizarLista(catalogos?.colores),
    tallas: normalizarLista(catalogos?.tallas),
    tiposTela: normalizarLista(catalogos?.tiposTela),
    modelosNombreTaller: normalizarLista(catalogos?.modelosNombreTaller),
    acabados: normalizarLista(catalogos?.acabados),
    avios: normalizarLista(catalogos?.avios),
    detallesConfeccion: normalizarLista(catalogos?.detallesConfeccion),
    tiposHijoOp: normalizarLista(catalogos?.tiposHijoOp),
    origenesHijoOp: normalizarLista(catalogos?.origenesHijoOp),
    unidadesMedida: normalizarLista(catalogos?.unidadesMedida),
    tiposMovimiento: normalizarLista(catalogos?.tiposMovimiento),
    ubicaciones: normalizarLista(catalogos?.ubicaciones),
    almacenes: normalizarLista(catalogos?.almacenes),
    motivosAjuste: normalizarLista(catalogos?.motivosAjuste),
    lotesBase: normalizarLista(catalogos?.lotesBase),
    correlativosPedido: normalizarLista(catalogos?.correlativosPedido),
    correlativosOp: normalizarLista(catalogos?.correlativosOp),
    correlativosIngreso: normalizarLista(catalogos?.correlativosIngreso),
    correlativosSalida: normalizarLista(catalogos?.correlativosSalida),
    correlativosRecepcion: normalizarLista(catalogos?.correlativosRecepcion),
    correlativosTienda: normalizarLista(catalogos?.correlativosTienda),
    correlativosCambioVenta: normalizarLista(catalogos?.correlativosCambioVenta),
    correlativosTercerizacion: normalizarLista(catalogos?.correlativosTercerizacion),
    correlativosDevolucion: normalizarLista(catalogos?.correlativosDevolucion),
    formatosCodigo: normalizarLista(catalogos?.formatosCodigo),
    temaDefecto: normalizarLista(catalogos?.temaDefecto),
    idioma: normalizarLista(catalogos?.idioma),
    reglasValidacion: normalizarLista(catalogos?.reglasValidacion),
    diasEntrega: normalizarLista(catalogos?.diasEntrega),
    estadosSistema: normalizarLista(catalogos?.estadosSistema),
    mensajesBase: normalizarLista(catalogos?.mensajesBase),
    monedasOperacion: normalizarLista(catalogos?.monedasOperacion),
    igvGlobal: normalizarLista(catalogos?.igvGlobal),
    decimalesSistema: normalizarLista(catalogos?.decimalesSistema),
    politicasStock: normalizarLista(catalogos?.politicasStock),
    tallasEspeciales: normalizarLista(catalogos?.tallasEspeciales),
    canalesComerciales: normalizarLista(catalogos?.canalesComerciales),
    motivosGlobales: normalizarLista(catalogos?.motivosGlobales),
    reglasSeguridad: normalizarLista(catalogos?.reglasSeguridad),
    configuracionesGenerales: normalizarLista(catalogos?.configuracionesGenerales),
  };

  localStorage.setItem(
    CLAVE_CATALOGOS_PRODUCCION,
    JSON.stringify(catalogosNormalizados)
  );

  return catalogosNormalizados;
};

const obtenerListaCatalogoSegura = (lista = [], listaPorDefecto = []) => {
  const normalizada = normalizarLista(lista);
  if (normalizada.length > 0) {
    return normalizada;
  }
  return normalizarLista(listaPorDefecto);
};

export const obtenerCanalesComercialesGlobales = (catalogos = null) =>
  obtenerListaCatalogoSegura(
    catalogos?.canalesComerciales,
    CATALOGOS_PRODUCCION_POR_DEFECTO.canalesComerciales
  );

export const obtenerMotivosGlobalesSistema = (catalogos = null) =>
  obtenerListaCatalogoSegura(
    catalogos?.motivosGlobales,
    CATALOGOS_PRODUCCION_POR_DEFECTO.motivosGlobales
  );

export const obtenerDecimalesSistemaConfigurados = (catalogos = null) => {
  const lista = obtenerListaCatalogoSegura(
    catalogos?.decimalesSistema,
    CATALOGOS_PRODUCCION_POR_DEFECTO.decimalesSistema
  );
  const numero = Number(lista[0] || 2);
  if (!Number.isFinite(numero)) {
    return 2;
  }

  return Math.min(Math.max(Math.round(numero), 0), 4);
};

// Este helper arma el nombre final del modelo para evitar errores de escritura manual.
// Si luego quieres otro orden, toca solo esta funcion.
export const construirNombreModelo = ({
  categoria = "",
  telaModelo = "",
  modelo = "",
}) =>
  [normalizarTexto(categoria), normalizarTexto(modelo), normalizarTexto(telaModelo)]
    .filter(Boolean)
    .join(" ");

export const normalizarTextoCatalogo = normalizarTexto;
