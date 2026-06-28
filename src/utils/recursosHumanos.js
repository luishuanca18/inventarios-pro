export const CLAVE_TRABAJADORES_RRHH = "cynara_trabajadores_rrhh";
export const CLAVE_JORNALES_RRHH = "cynara_jornales_rrhh";

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

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const convertirNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

export const crearTrabajadorVacio = () => ({
  nombreCompleto: "",
  documento: "",
  telefono: "",
  cargo: "",
  area: "PRODUCCION",
  pagoDiario: "0",
  pagoHoraExtra: "0",
  estado: "ACTIVO",
  observacion: "",
});

export const crearJornalVacio = () => ({
  trabajadorId: "",
  fecha: new Date().toISOString().slice(0, 10),
  jornadas: "1",
  horasExtra: "0",
  adelanto: "0",
  observacion: "",
});

export const leerTrabajadoresRrhh = () =>
  leerLista(CLAVE_TRABAJADORES_RRHH)
    .map((item) => ({
      ...item,
      id: item?.id || normalizarTexto(item?.nombreCompleto),
      nombreCompleto: normalizarTexto(item?.nombreCompleto),
      documento: (item?.documento || "").toString().trim(),
      telefono: (item?.telefono || "").toString().trim(),
      cargo: normalizarTexto(item?.cargo),
      area: normalizarTexto(item?.area),
      pagoDiario: convertirNumero(item?.pagoDiario),
      pagoHoraExtra: convertirNumero(item?.pagoHoraExtra),
      estado: normalizarTexto(item?.estado) || "ACTIVO",
      observacion: normalizarTexto(item?.observacion),
      creadoEn: item?.creadoEn || "",
      actualizadoEn: item?.actualizadoEn || "",
    }))
    .sort((a, b) => (a.nombreCompleto || "").localeCompare(b.nombreCompleto || ""));

export const guardarTrabajadorRrhh = (trabajador = {}) => {
  const nombreCompleto = normalizarTexto(trabajador?.nombreCompleto);
  if (!nombreCompleto) throw new Error("El nombre del trabajador es obligatorio.");

  const id = trabajador?.id || nombreCompleto;
  const actual = leerTrabajadoresRrhh();
  const existente = actual.find((item) => item.id === id);
  const ahora = new Date().toISOString();

  const registro = {
    id,
    nombreCompleto,
    documento: (trabajador?.documento || "").toString().trim(),
    telefono: (trabajador?.telefono || "").toString().trim(),
    cargo: normalizarTexto(trabajador?.cargo),
    area: normalizarTexto(trabajador?.area) || "PRODUCCION",
    pagoDiario: convertirNumero(trabajador?.pagoDiario),
    pagoHoraExtra: convertirNumero(trabajador?.pagoHoraExtra),
    estado: normalizarTexto(trabajador?.estado) || "ACTIVO",
    observacion: normalizarTexto(trabajador?.observacion),
    creadoEn: existente?.creadoEn || ahora,
    actualizadoEn: ahora,
  };

  guardarLista(
    CLAVE_TRABAJADORES_RRHH,
    [...actual.filter((item) => item.id !== id), registro]
  );

  return registro;
};

export const eliminarTrabajadorRrhh = (trabajadorId = "") => {
  guardarLista(
    CLAVE_TRABAJADORES_RRHH,
    leerTrabajadoresRrhh().filter((item) => item.id !== trabajadorId)
  );
};

export const leerJornalesRrhh = () =>
  leerLista(CLAVE_JORNALES_RRHH)
    .map((item) => ({
      ...item,
      id: item?.id || `${item?.trabajadorId || ""}|${item?.fecha || ""}`,
      trabajadorId: item?.trabajadorId || "",
      fecha: item?.fecha || "",
      jornadas: convertirNumero(item?.jornadas),
      horasExtra: convertirNumero(item?.horasExtra),
      adelanto: convertirNumero(item?.adelanto),
      observacion: normalizarTexto(item?.observacion),
      creadoEn: item?.creadoEn || "",
      actualizadoEn: item?.actualizadoEn || "",
    }))
    .sort((a, b) => `${b.fecha || ""}`.localeCompare(`${a.fecha || ""}`));

export const guardarJornalRrhh = (jornal = {}) => {
  if (!jornal?.trabajadorId || !jornal?.fecha) {
    throw new Error("El trabajador y la fecha son obligatorios.");
  }

  const actual = leerJornalesRrhh();
  const id = jornal?.id || `${jornal.trabajadorId}|${jornal.fecha}`;
  const existente = actual.find((item) => item.id === id);
  const ahora = new Date().toISOString();

  const registro = {
    id,
    trabajadorId: jornal.trabajadorId,
    fecha: jornal.fecha,
    jornadas: convertirNumero(jornal?.jornadas),
    horasExtra: convertirNumero(jornal?.horasExtra),
    adelanto: convertirNumero(jornal?.adelanto),
    observacion: normalizarTexto(jornal?.observacion),
    creadoEn: existente?.creadoEn || ahora,
    actualizadoEn: ahora,
  };

  guardarLista(
    CLAVE_JORNALES_RRHH,
    [...actual.filter((item) => item.id !== id), registro]
  );

  return registro;
};

export const eliminarJornalRrhh = (jornalId = "") => {
  guardarLista(
    CLAVE_JORNALES_RRHH,
    leerJornalesRrhh().filter((item) => item.id !== jornalId)
  );
};

export const obtenerRangoQuincena = (anio, mes, quincena) => {
  const mesNumero = Math.max(1, Math.min(12, Number(mes || 1)));
  const anioNumero = Number(anio || new Date().getFullYear());
  const ultimoDia = new Date(anioNumero, mesNumero, 0).getDate();

  if (quincena === "2") {
    return {
      desde: `${anioNumero}-${String(mesNumero).padStart(2, "0")}-16`,
      hasta: `${anioNumero}-${String(mesNumero).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`,
    };
  }

  return {
    desde: `${anioNumero}-${String(mesNumero).padStart(2, "0")}-01`,
    hasta: `${anioNumero}-${String(mesNumero).padStart(2, "0")}-15`,
  };
};

export const resumirQuincenaRrhh = ({
  trabajadores = [],
  jornales = [],
  anio,
  mes,
  quincena = "1",
}) => {
  const { desde, hasta } = obtenerRangoQuincena(anio, mes, quincena);
  const mapaTrabajadores = new Map(trabajadores.map((item) => [item.id, item]));

  const resumen = new Map();

  jornales
    .filter((item) => item.fecha >= desde && item.fecha <= hasta)
    .forEach((item) => {
      const trabajador = mapaTrabajadores.get(item.trabajadorId);
      if (!trabajador) return;

      const actual = resumen.get(item.trabajadorId) || {
        trabajadorId: item.trabajadorId,
        nombreCompleto: trabajador.nombreCompleto,
        cargo: trabajador.cargo,
        area: trabajador.area,
        pagoDiario: convertirNumero(trabajador.pagoDiario),
        pagoHoraExtra: convertirNumero(trabajador.pagoHoraExtra),
        jornadas: 0,
        horasExtra: 0,
        adelantos: 0,
        subtotal: 0,
        totalPagar: 0,
      };

      actual.jornadas += convertirNumero(item.jornadas);
      actual.horasExtra += convertirNumero(item.horasExtra);
      actual.adelantos += convertirNumero(item.adelanto);
      actual.subtotal =
        actual.jornadas * actual.pagoDiario + actual.horasExtra * actual.pagoHoraExtra;
      actual.totalPagar = actual.subtotal - actual.adelantos;

      resumen.set(item.trabajadorId, actual);
    });

  return {
    desde,
    hasta,
    detalle: Array.from(resumen.values()).sort((a, b) =>
      `${a.nombreCompleto || ""}`.localeCompare(`${b.nombreCompleto || ""}`)
    ),
    totalGeneral: Array.from(resumen.values()).reduce(
      (total, item) => total + convertirNumero(item.totalPagar),
      0
    ),
  };
};
