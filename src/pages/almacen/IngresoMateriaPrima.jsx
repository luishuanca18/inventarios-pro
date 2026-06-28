import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Header } from "../../index";
import { leerCatalogosProduccion } from "../../utils/catalogosProduccion";
import { mostrarNotificacionCarga } from "../../utils/notificaciones";
import {
  calcularSiguienteCorrelativoSistemaConfiguracion,
  registrarUsoCorrelativoSistemaConfiguracion,
} from "../../supabase/configuracionCore.js";
import {
  mobileStackBase,
  tabletLandscapeBase,
  tabletLandscapeTableCompact,
} from "../../styles/tabletLayout";

// Historial local de ingresos para sugerir codigos de unidad sin repetirlos.
const CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA =
  "cynara_historial_ingresos_materia_prima";
const filaInicial = {
  id: 1,
  codigoUnidad: "",
  tipoTela: "",
  tipoTelaManual: "",
  unidadCompra: "",
  colorBase: "",
  acabadoDiseno: "",
  partida: "",
  ancho: "",
  kilos: "",
  metros: "",
  precioUnitario: "",
};

const avioInicial = {
  id: 1,
  tipoAvio: "",
  tipoAvioManual: "",
  descripcion: "",
  anchoAvioCm: "",
  metrosRollo: "",
  colorBase: "",
  acabadoDiseno: "",
  cantidad: "",
  unidad: "",
  precioUnitario: "",
};

const UNIDADES_AVIO = [
  "Unidad",
  "Metros",
  "Paquete",
  "Caja",
  "Docena",
  "Bolsa",
  "Par",
  "Rollo",
];

const UNIDADES_TELA = ["Kg", "Metros"];

const formatearCatalogoMayusculas = (texto) => normalizarTexto(texto);

const construirOpcionesTela = (catalogosProduccion) => {
  const mapaOpciones = new Map();

  [...(catalogosProduccion?.tiposTela || [])]
    .filter(Boolean)
    .forEach((tipoTela) => {
      mapaOpciones.set(
        obtenerClaveTela(tipoTela),
        formatearCatalogoMayusculas(tipoTela)
      );
    });

  const opcionesSinOtro = [...mapaOpciones.values()];

  return [...opcionesSinOtro, "Otro"];
};

const construirOpcionesAvio = (catalogosProduccion) => {
  const mapaOpciones = new Map();

  [...(catalogosProduccion?.avios || [])]
    .filter(Boolean)
    .forEach((tipoAvio) => {
      mapaOpciones.set(
        normalizarTexto(tipoAvio),
        formatearCatalogoMayusculas(tipoAvio)
      );
    });

  const opcionesSinOtro = [...mapaOpciones.values()];

  return [...opcionesSinOtro, "Otro"];
};

const obtenerFechaActual = () => {
  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaActual.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
};

const generarCodigoCompra = (fechaCompra, correlativo = 1, prefijo = "CMP") => {
  const fechaBase = fechaCompra || obtenerFechaActual();
  const [anio, mes, dia] = fechaBase.split("-");
  const anioCorto = anio.slice(-2);

  return `${prefijo}${dia}${mes}${anioCorto}-${String(correlativo).padStart(2, "0")}`;
};

// Lee los ingresos anteriores para seguir el correlativo por tipo de tela.
const leerHistorialIngresos = () => {
  const contenido = localStorage.getItem(CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA);

  if (!contenido) {
    return [];
  }

  try {
    const historial = JSON.parse(contenido);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
};

const normalizarTexto = (texto) =>
  (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

// Evita duplicados de nombres muy parecidos en el catalogo.
const obtenerClaveTela = (texto) => normalizarTexto(texto).replace(/Z/g, "S");

// Crea una abreviatura corta a partir del tipo de tela o color base.
const abreviarDescripcion = (texto) => {
  const textoNormalizado = normalizarTexto(texto);

  if (!textoNormalizado) {
    return "";
  }

  const palabras = textoNormalizado.split(/\s+/).filter(Boolean);

  if (palabras.length >= 2) {
    return `${palabras[0][0]}${palabras[1][0]}`;
  }

  return palabras[0].slice(0, 2);
};

// Para colores compuestos usa 2 letras de cada palabra: "Azul marino" -> "AZMA".
const abreviarColor = (texto) => {
  const textoNormalizado = normalizarTexto(texto);

  if (!textoNormalizado) {
    return "";
  }

  const palabras = textoNormalizado.split(/\s+/).filter(Boolean);

  if (palabras.length >= 2) {
    return `${palabras[0].slice(0, 2)}${palabras[1].slice(0, 2)}`;
  }

  return palabras[0].slice(0, 2);
};

// El correlativo crece por tipo de tela dentro del mismo año.
const obtenerCorrelativoTela = ({
  tipoTela,
  fechaCompra,
  historialIngresos,
  filasActuales,
  idFilaActual,
}) => {
  const claveTipoTela = obtenerClaveTela(tipoTela);
  const anioActual = (fechaCompra || obtenerFechaActual()).slice(0, 4);

  if (!claveTipoTela) {
    return 1;
  }

  const correlativosHistorial = historialIngresos.flatMap((ingreso) => {
    const anioIngreso = (ingreso?.cabeceraCompra?.fechaCompra || "").slice(0, 4);

    if (anioIngreso !== anioActual) {
      return [];
    }

    return (ingreso?.filasCompra || [])
      .filter((fila) => {
        const tipoTelaFila =
          fila.tipoTela === "Otro" ? fila.tipoTelaManual || "" : fila.tipoTela || "";

        return obtenerClaveTela(tipoTelaFila) === claveTipoTela;
      })
      .map((fila) => fila.codigoUnidad || "")
      .map((codigoUnidad) => {
        const coincidencia = codigoUnidad.match(/(\d+)$/);
        return coincidencia ? Number(coincidencia[1]) : 0;
      });
  });

  const correlativosActuales = filasActuales
    .filter((fila) => fila.id !== idFilaActual)
    .filter((fila) => {
      const tipoTelaFila =
        fila.tipoTela === "Otro" ? fila.tipoTelaManual || "" : fila.tipoTela || "";

      return obtenerClaveTela(tipoTelaFila) === claveTipoTela;
    })
    .map((fila) => fila.codigoUnidad || "")
    .map((codigoUnidad) => {
      const coincidencia = codigoUnidad.match(/(\d+)$/);
      return coincidencia ? Number(coincidencia[1]) : 0;
    });

  const correlativos = [...correlativosHistorial, ...correlativosActuales].filter(
    (correlativo) => Number.isFinite(correlativo)
  );

  if (correlativos.length === 0) {
    return 1;
  }

  return Math.max(...correlativos) + 1;
};

// Sugiere un codigo unidad como FTNE01, editable por el usuario.
const generarCodigoUnidad = ({
  tipoTela,
  colorBase,
  fechaCompra,
  historialIngresos,
  filasActuales,
  idFilaActual,
}) => {
  const abreviaturaTela = abreviarDescripcion(tipoTela);
  const abreviaturaColor = abreviarColor(colorBase);

  if (!abreviaturaTela) {
    return "";
  }

  const correlativo = obtenerCorrelativoTela({
    tipoTela,
    fechaCompra,
    historialIngresos,
    filasActuales,
    idFilaActual,
  });

  return `${abreviaturaTela}${abreviaturaColor}${String(correlativo).padStart(2, "0")}`;
};

const crearCabeceraInicial = () => {
  const fechaActual = obtenerFechaActual();

  return {
    codigoInterno: generarCodigoCompra(fechaActual),
    empresa: "Cynara",
    fechaCompra: fechaActual,
    fechaRecepcion: fechaActual,
    proveedor: "",
    tipoDocumento: "Factura",
    numeroDocumento: "",
    moneda: "Soles",
    observacionesGenerales: "",
  };
};

const crearFilasIniciales = () => [
  {
    ...filaInicial,
    codigoUnidad: "CHNE01",
    tipoTela: "Chaliz",
    tipoTelaManual: "",
    unidadCompra: "Kg",
    colorBase: "Negro",
    acabadoDiseno: "",
    partida: "P001",
    ancho: "1.50",
    kilos: "25.50",
    metros: "58.00",
    precioUnitario: "14.80",
  },
];

const crearAviosIniciales = () => [
  {
    ...avioInicial,
    tipoAvio: "Elastico",
    tipoAvioManual: "",
    descripcion: "Elastico pretina",
    anchoAvioCm: "3",
    metrosRollo: "50",
    colorBase: "Negro",
    acabadoDiseno: "",
    cantidad: "2",
    unidad: "Rollo",
    precioUnitario: "42.50",
  },
];

const calcularTotalFila = (fila) => {
  const kilos = Number(fila.kilos || 0);
  const precioUnitario = Number(fila.precioUnitario || 0);

  return kilos * precioUnitario;
};

const calcularTotalAvio = (avio) => {
  const cantidad = Number(avio.cantidad || 0);
  const precioUnitario = Number(avio.precioUnitario || 0);

  return cantidad * precioUnitario;
};

const formatearMoneda = (valor) => {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
};

export function IngresoMateriaPrima() {
  const catalogosProduccion = leerCatalogosProduccion();
  const historialIngresos = leerHistorialIngresos();
  const [opcionesTela] = useState(() => construirOpcionesTela(catalogosProduccion));
  const [opcionesAvio] = useState(() => construirOpcionesAvio(catalogosProduccion));
  const [estadoMenuUsuario, setEstadoMenuUsuario] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState("telas");
  const [configIngresoMp, setConfigIngresoMp] = useState(null);
  const [cabeceraCompra, setCabeceraCompra] = useState(crearCabeceraInicial);
  const [filasCompra, setFilasCompra] = useState(crearFilasIniciales);
  const [filasAvios, setFilasAvios] = useState(crearAviosIniciales);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      try {
        const resultado = await calcularSiguienteCorrelativoSistemaConfiguracion({
          clave: "INGRESO_MATERIA_PRIMA",
          fecha: obtenerFechaActual(),
          codigos: historialIngresos.map((item) => ({
            codigo: item?.cabeceraCompra?.codigoInterno || "",
            fecha: item?.cabeceraCompra?.fechaCompra || "",
          })),
        });
        if (!activo) return;
        setConfigIngresoMp(resultado?.configuracion || null);
        setCabeceraCompra((anterior) => ({
          ...anterior,
          codigoInterno:
            anterior.codigoInterno ||
            generarCodigoCompra(
              anterior.fechaCompra,
              resultado?.correlativo || 1,
              resultado?.configuracion?.prefijo || "CMP",
            ),
        }));
      } catch (error) {
        console.error("No se pudo cargar el correlativo de ingresos:", error.message);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  // Cambios simples de la cabecera de compra.
  const manejarCambioCabecera = (evento) => {
    const { name, value } = evento.target;

    setCabeceraCompra((anterior) => ({
      ...anterior,
      codigoInterno:
        name === "fechaCompra" ? generarCodigoCompra(value, 1, configIngresoMp?.prefijo || "CMP") : anterior.codigoInterno,
      [name]: value,
    }));
  };

  // Si cambia tipo de tela o color base, se vuelve a sugerir el codigo unidad.
  const manejarCambioFila = (idFila, campo, valor) => {
    setFilasCompra((anterior) =>
      anterior.map((fila) =>
        fila.id === idFila
          ? (() => {
              const filaActualizada = {
                ...fila,
                [campo]: valor,
              };

              if (campo === "codigoUnidad") {
                return filaActualizada;
              }

              if (campo === "tipoTela" || campo === "colorBase") {
                const tipoTelaBase =
                  campo === "tipoTela"
                    ? valor === "Otro"
                      ? filaActualizada.tipoTelaManual
                      : valor
                    : filaActualizada.tipoTela === "Otro"
                      ? filaActualizada.tipoTelaManual
                      : filaActualizada.tipoTela;

                return {
                  ...filaActualizada,
                  codigoUnidad: generarCodigoUnidad({
                    tipoTela: tipoTelaBase,
                    colorBase:
                      campo === "colorBase" ? valor : filaActualizada.colorBase,
                    fechaCompra: cabeceraCompra.fechaCompra,
                    historialIngresos,
                    filasActuales: anterior,
                    idFilaActual: idFila,
                  }),
                };
              }

              if (campo === "tipoTelaManual") {
                return {
                  ...filaActualizada,
                  codigoUnidad: generarCodigoUnidad({
                    tipoTela: valor,
                    colorBase: filaActualizada.colorBase,
                    fechaCompra: cabeceraCompra.fechaCompra,
                    historialIngresos,
                    filasActuales: anterior,
                    idFilaActual: idFila,
                  }),
                };
              }

              return filaActualizada;
            })()
          : fila
      )
    );
  };

  // Agrega otra fila para registrar otra tela o partida de la misma compra.
  const agregarFila = () => {
    setFilasCompra((anterior) => {
      const nuevaFila = {
        ...filaInicial,
        id: Date.now(),
      };

      return [...anterior, nuevaFila];
    });
  };

  const eliminarFila = (idFila) => {
    if (filasCompra.length === 1) {
      setFilasCompra((anterior) =>
        anterior.map((fila) =>
          fila.id === idFila ? { ...filaInicial, id: fila.id } : fila
        )
      );
      return;
    }

    setFilasCompra((anterior) => anterior.filter((fila) => fila.id !== idFila));
  };

  const manejarCambioAvio = (idFila, campo, valor) => {
    setFilasAvios((anterior) =>
      anterior.map((avio) =>
        avio.id === idFila
          ? {
              ...avio,
              [campo]: valor,
            }
          : avio
      )
    );
  };

  const agregarAvio = () => {
    setFilasAvios((anterior) => [
      ...anterior,
      {
        ...avioInicial,
        id: Date.now(),
      },
    ]);
  };

  const eliminarAvio = (idFila) => {
    if (filasAvios.length === 1) {
      setFilasAvios((anterior) =>
        anterior.map((avio) =>
          avio.id === idFila ? { ...avioInicial, id: avio.id } : avio
        )
      );
      return;
    }

    setFilasAvios((anterior) => anterior.filter((avio) => avio.id !== idFila));
  };

  const totalKilos = filasCompra.reduce(
    (total, fila) => total + Number(fila.kilos || 0),
    0
  );
  const totalMetros = filasCompra.reduce(
    (total, fila) => total + Number(fila.metros || 0),
    0
  );
  const totalCompra = filasCompra.reduce(
    (total, fila) => total + calcularTotalFila(fila),
    0
  );
  const totalAvios = filasAvios.reduce(
    (total, avio) => total + calcularTotalAvio(avio),
    0
  );

  // Guarda el ingreso en historial local para futuras sugerencias.
  const manejarGuardar = async () => {
    const correlativoCompra = (
      await calcularSiguienteCorrelativoSistemaConfiguracion({
        clave: "INGRESO_MATERIA_PRIMA",
        fecha: cabeceraCompra.fechaCompra,
        codigos: historialIngresos.map((item) => ({
          codigo: item?.cabeceraCompra?.codigoInterno || "",
          fecha: item?.cabeceraCompra?.fechaCompra || "",
        })),
        codigoExcluir: cabeceraCompra.codigoInterno,
      })
    ).correlativo;

    const ingresoCompleto = {
      cabeceraCompra: {
        ...cabeceraCompra,
        codigoInterno:
          cabeceraCompra.codigoInterno && cabeceraCompra.codigoInterno.includes("-")
            ? cabeceraCompra.codigoInterno
            : generarCodigoCompra(
                cabeceraCompra.fechaCompra,
                correlativoCompra,
                configIngresoMp?.prefijo || "CMP",
              ),
      },
      filasCompra,
      filasAvios,
    };
    const historialActualizado = [
      ingresoCompleto,
      ...historialIngresos,
    ];

    localStorage.setItem(
      CLAVE_HISTORIAL_INGRESOS_MATERIA_PRIMA,
      JSON.stringify(historialActualizado)
    );
    await registrarUsoCorrelativoSistemaConfiguracion({
      clave: "INGRESO_MATERIA_PRIMA",
      fecha: ingresoCompleto.cabeceraCompra.fechaCompra,
      correlativo: correlativoCompra,
    });
    console.log("Cabecera ingreso materia prima:", cabeceraCompra);
    console.log("Detalle ingreso materia prima:", filasCompra);
    mostrarNotificacionCarga("Ingreso de materia prima listo para revisar. Aun no se guarda en base de datos.");
  };

  return (
    <ContenedorPagina>
      <header className="encabezado">
        <Header
          stateConfig={{
            state: estadoMenuUsuario,
            setState: () => setEstadoMenuUsuario(!estadoMenuUsuario),
          }}
        />
      </header>

      <section className="cabecera">
        <div>
          <h1>Ingreso de materia prima</h1>
          <p>
            Aqui se registra la compra o ingreso de telas para que luego queden
            disponibles en almacen y puedan pasar a Produccion.
          </p>
        </div>

        <div className="cabecera__estado">
          <span>Total ingreso</span>
          <strong>{formatearMoneda(totalCompra + totalAvios)}</strong>
        </div>
      </section>

      <div className="fila_superior">
        <Link to="/almacen/materia-prima" className="boton_volver">
          Volver a Almacen
        </Link>
      </div>

      <main className="contenido">
        <section className="tarjeta">
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestanaActiva === "telas" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaActiva("telas")}
            >
              Telas
            </button>
            <button
              type="button"
              className={`pestana ${pestanaActiva === "avios" ? "pestana_activa" : ""}`}
              onClick={() => setPestanaActiva("avios")}
            >
              Avíos
            </button>
          </div>
        </section>

        <section className="tarjeta">
          <h2>Cabecera de compra</h2>

          <div className="grid grid-2">
            <Campo>
              <label>Codigo interno</label>
              <input type="text" value={cabeceraCompra.codigoInterno} readOnly />
            </Campo>

            <Campo className="campo_requerido">
              <label>Empresa</label>
              <input
                type="text"
                list="catalogo-empresas-ingreso"
                name="empresa"
                value={cabeceraCompra.empresa}
                onChange={manejarCambioCabecera}
              />
              <datalist id="catalogo-empresas-ingreso">
                {catalogosProduccion.empresas.map((empresa) => (
                  <option key={empresa} value={empresa} />
                ))}
              </datalist>
            </Campo>

            <Campo className="campo_requerido">
              <label>Fecha de compra</label>
              <input
                type="date"
                name="fechaCompra"
                value={cabeceraCompra.fechaCompra}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Fecha de recepcion</label>
              <input
                type="date"
                name="fechaRecepcion"
                value={cabeceraCompra.fechaRecepcion}
                onChange={manejarCambioCabecera}
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Proveedor</label>
              <input
                type="text"
                list="catalogo-proveedores-ingreso"
                name="proveedor"
                value={cabeceraCompra.proveedor}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
              <datalist id="catalogo-proveedores-ingreso">
                {catalogosProduccion.proveedores.map((proveedor) => (
                  <option key={proveedor} value={proveedor} />
                ))}
              </datalist>
            </Campo>

            <Campo className="campo_requerido">
              <label>Tipo de documento</label>
              <select
                name="tipoDocumento"
                value={cabeceraCompra.tipoDocumento}
                onChange={manejarCambioCabecera}
              >
                <option value="Factura">Factura</option>
                <option value="Boleta">Boleta</option>
                <option value="Nota de venta">Nota de venta</option>
              </select>
            </Campo>

            <Campo className="campo_requerido">
              <label>Numero de documento</label>
              <input
                type="text"
                name="numeroDocumento"
                value={cabeceraCompra.numeroDocumento}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
            </Campo>

            <Campo className="campo_requerido">
              <label>Moneda</label>
              <select
                name="moneda"
                value={cabeceraCompra.moneda}
                onChange={manejarCambioCabecera}
              >
                {catalogosProduccion.monedas.map((moneda) => (
                  <option key={moneda} value={moneda}>
                    {moneda}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo className="campo-completo">
              <label>Observaciones generales</label>
              <textarea
                name="observacionesGenerales"
                value={cabeceraCompra.observacionesGenerales}
                onChange={manejarCambioCabecera}
                placeholder=""
              />
            </Campo>
          </div>
        </section>

        {pestanaActiva === "telas" ? (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Detalle de telas ingresadas</h2>
                <p>
                  Una misma compra puede tener varias telas, colores base,
                  acabados o partidas diferentes del mismo proveedor.
                </p>
              </div>

              <button type="button" className="btn btn_principal" onClick={agregarFila}>
                Agregar fila
              </button>
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Codigo unidad</th>
                    <th>Tipo de tela</th>
                    <th>Unidad compra</th>
                    <th>Metros rollo</th>
                    <th>Color base</th>
                    <th>Acabado / diseño</th>
                    <th>Partida</th>
                    <th>Ancho</th>
                    <th>Kilos</th>
                    <th>Metros</th>
                    <th>Costo unit.</th>
                    <th>Total</th>
                    <th>Accion</th>
                  </tr>
                </thead>

                <tbody>
                  {filasCompra.map((fila) => (
                    <tr key={fila.id}>
                      <td>
                        <input
                          type="text"
                          value={fila.codigoUnidad}
                          onChange={(evento) =>
                            manejarCambioFila(
                              fila.id,
                              "codigoUnidad",
                              evento.target.value.toUpperCase()
                            )
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <select
                          value={fila.tipoTela}
                          onChange={(evento) =>
                            manejarCambioFila(fila.id, "tipoTela", evento.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {opcionesTela.map((tipoTela) => (
                            <option key={tipoTela} value={tipoTela}>
                              {tipoTela}
                            </option>
                          ))}
                        </select>

                        {fila.tipoTela === "Otro" ? (
                            <input
                              type="text"
                              value={fila.tipoTelaManual}
                              onChange={(evento) =>
                                manejarCambioFila(
                                  fila.id,
                                  "tipoTelaManual",
                                  evento.target.value.toUpperCase()
                                )
                              }
                              placeholder=""
                          />
                        ) : null}
                      </td>
                      <td>
                        <select
                          value={fila.unidadCompra}
                          onChange={(evento) =>
                            manejarCambioFila(
                              fila.id,
                              "unidadCompra",
                              evento.target.value
                            )
                          }
                        >
                          <option value="">Seleccionar</option>
                          {UNIDADES_TELA.map((unidadTela) => (
                            <option key={unidadTela} value={unidadTela}>
                              {unidadTela}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={fila.colorBase}
                          onChange={(evento) =>
                            manejarCambioFila(fila.id, "colorBase", evento.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {catalogosProduccion.colores.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={fila.acabadoDiseno}
                          onChange={(evento) =>
                            manejarCambioFila(
                              fila.id,
                              "acabadoDiseno",
                              evento.target.value
                            )
                          }
                        >
                          <option value="">Seleccionar</option>
                          {catalogosProduccion.acabados.map((acabado) => (
                            <option key={acabado} value={acabado}>
                              {acabado}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={fila.partida}
                          onChange={(evento) =>
                            manejarCambioFila(fila.id, "partida", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={fila.ancho}
                          onChange={(evento) =>
                            manejarCambioFila(fila.id, "ancho", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={fila.kilos}
                          onChange={(evento) =>
                            manejarCambioFila(fila.id, "kilos", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={fila.metros}
                          onChange={(evento) =>
                            manejarCambioFila(fila.id, "metros", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={fila.precioUnitario}
                          onChange={(evento) =>
                            manejarCambioFila(
                              fila.id,
                              "precioUnitario",
                              evento.target.value
                            )
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formatearMoneda(calcularTotalFila(fila))}
                          readOnly
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn_secundario btn_tabla"
                          onClick={() => eliminarFila(fila.id)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="tarjeta">
            <div className="tarjeta__encabezado">
              <div>
                <h2>Detalle de avíos ingresados</h2>
                <p>
                  Aqui puedes registrar elasticos, poliamidas, etiquetas y otros
                  avíos de la misma compra usando la misma cabecera general.
                </p>
              </div>

              <button type="button" className="btn btn_principal" onClick={agregarAvio}>
                Agregar avío
              </button>
            </div>

            <div className="tabla_contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Tipo de avío</th>
                    <th>Descripcion</th>
                    <th>Ancho (cm)</th>
                    <th>Color base</th>
                    <th>Acabado / diseño</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Costo unit.</th>
                    <th>Total</th>
                    <th>Accion</th>
                  </tr>
                </thead>

                <tbody>
                  {filasAvios.map((avio) => (
                    <tr key={avio.id}>
                      <td>
                        <div className="celda_compuesta">
                          <select
                            value={avio.tipoAvio}
                            onChange={(evento) =>
                              manejarCambioAvio(avio.id, "tipoAvio", evento.target.value)
                            }
                          >
                            <option value="">Seleccionar</option>
                            {opcionesAvio.map((tipoAvio) => (
                              <option key={tipoAvio} value={tipoAvio}>
                                {tipoAvio}
                              </option>
                            ))}
                          </select>

                          {avio.tipoAvio === "Otro" ? (
                            <input
                              type="text"
                              value={avio.tipoAvioManual}
                              onChange={(evento) =>
                                manejarCambioAvio(
                                  avio.id,
                                  "tipoAvioManual",
                                  evento.target.value.toUpperCase()
                                )
                              }
                              placeholder=""
                            />
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={avio.descripcion}
                          onChange={(evento) =>
                            manejarCambioAvio(avio.id, "descripcion", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={avio.anchoAvioCm}
                          onChange={(evento) =>
                            manejarCambioAvio(avio.id, "anchoAvioCm", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={avio.metrosRollo}
                          onChange={(evento) =>
                            manejarCambioAvio(avio.id, "metrosRollo", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <select
                          value={avio.colorBase}
                          onChange={(evento) =>
                            manejarCambioAvio(avio.id, "colorBase", evento.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {catalogosProduccion.colores.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={avio.acabadoDiseno}
                          onChange={(evento) =>
                            manejarCambioAvio(
                              avio.id,
                              "acabadoDiseno",
                              evento.target.value
                            )
                          }
                        >
                          <option value="">Seleccionar</option>
                          {catalogosProduccion.acabados.map((acabado) => (
                            <option key={acabado} value={acabado}>
                              {acabado}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={avio.cantidad}
                          onChange={(evento) =>
                            manejarCambioAvio(avio.id, "cantidad", evento.target.value)
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <select
                          value={avio.unidad}
                          onChange={(evento) =>
                            manejarCambioAvio(avio.id, "unidad", evento.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {UNIDADES_AVIO.map((unidad) => (
                            <option key={unidad} value={unidad}>
                              {unidad}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={avio.precioUnitario}
                          onChange={(evento) =>
                            manejarCambioAvio(
                              avio.id,
                              "precioUnitario",
                              evento.target.value
                            )
                          }
                          placeholder=""
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formatearMoneda(calcularTotalAvio(avio))}
                          readOnly
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn_secundario btn_tabla"
                          onClick={() => eliminarAvio(avio.id)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="tarjeta resumen">
          <h2>Resumen rapido</h2>
          <div className="resumen__grid">
            <div>
              <span>Filas registradas</span>
              <strong>{pestanaActiva === "telas" ? filasCompra.length : filasAvios.length}</strong>
            </div>

            <div>
              <span>Total telas</span>
              <strong>{totalKilos.toFixed(2)}</strong>
            </div>

            <div>
              <span>Total avíos</span>
              <strong>{formatearMoneda(totalAvios)}</strong>
            </div>

            <div>
              <span>Proveedor</span>
              <strong>{cabeceraCompra.proveedor || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="acciones">
          <button type="button" className="btn btn_secundario">
            Cancelar
          </button>
          <button type="button" className="btn btn_secundario">
            Guardar borrador
          </button>
          <button type="button" className="btn btn_principal" onClick={manejarGuardar}>
            Confirmar ingreso
          </button>
        </section>
      </main>
    </ContenedorPagina>
  );
}

const ContenedorPagina = styled.div`
  /* Contenedor principal del ingreso de materia prima. */
  min-height: 100vh;
  width: 100%;
  background-color: ${({ theme }) => theme.bgtotal};
  color: ${({ theme }) => theme.text};
  display: grid;
  grid-template-rows: 90px auto auto 1fr;
  gap: 16px;
  padding: 15px;

  .encabezado {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: ${({ theme }) => theme.bgcards};
    border-radius: 16px;
    padding-right: 10px;
  }

  .cabecera,
  .tarjeta {
    background-color: ${({ theme }) => theme.bgcards};
    border-radius: 16px;
    padding: 20px;
  }

  .cabecera {
    display: grid;
    gap: 14px;
  }

  .cabecera h1,
  .tarjeta h2 {
    margin: 0 0 8px;
  }

  .cabecera p,
  .tarjeta p,
  .resumen span {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
  }

  .cabecera__estado {
    width: fit-content;
    padding: 14px 18px;
    border-radius: 14px;
    background-color: ${({ theme }) => theme.bgtotal};
  }

  .cabecera__estado span {
    display: block;
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 6px;
  }

  .cabecera__estado strong {
    font-size: 26px;
    color: ${({ theme }) => theme.bg5};
  }

  .fila_superior {
    display: flex;
    justify-content: flex-start;
  }

  .boton_volver {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 10px;
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
    text-decoration: none;
    font-weight: 600;
  }

  .contenido {
    display: grid;
    gap: 16px;
  }

  .grid {
    display: grid;
    gap: 14px;
  }

  .grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .campo-completo {
    grid-column: 1 / -1;
  }
  .campo_requerido label::after {
    content: " *";
    color: ${({ theme }) => theme.bg5};
    font-weight: 700;
  }

  .tarjeta__encabezado {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .pestanas {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px;
    border-radius: 16px;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#f6f1fa" : "rgba(255,255,255,0.04)"};
    border: 1px solid ${({ theme }) => theme.bg4};
  }

  .pestana {
    border: 1px solid transparent;
    background-color: transparent;
    color: ${({ theme }) => theme.colorSubtitle};
    border-radius: 12px;
    padding: 12px 18px;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .pestana:hover {
    color: ${({ theme }) => theme.text};
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.18)" : "rgba(255,255,255,0.08)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.03)"};
  }

  .pestana_activa {
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 8px 18px rgba(117, 1, 152, 0.22);
    transform: translateY(-1px);
  }

  .tabla_contenedor {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1180px;
  }

  th,
  td {
    padding: 10px;
    border-bottom: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d6dee8" : theme.bg4)};
    text-align: left;
    vertical-align: top;
  }

  th {
    font-size: 13px;
    color: ${({ theme }) => theme.colorSubtitle};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#f7f9fc" : "transparent"};
  }

  td input,
  td select {
    width: 100%;
    min-width: 90px;
    min-height: 42px;
    border: 1px solid
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(117, 1, 152, 0.28)"
          : "rgba(230, 205, 238, 0.25)"};
    border-radius: 12px;
    padding: 10px 12px;
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)"
        ? "rgba(117, 1, 152, 0.05)"
        : "rgba(117, 1, 152, 0.12)"};
    color: ${({ theme }) => theme.text};
    -webkit-text-fill-color: ${({ theme }) => theme.text};
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
    appearance: none;
  }

  td input:focus,
  td select:focus {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(117, 1, 152, 0.14)"
          : "rgba(117, 1, 152, 0.2)"};
  }

  td input[readonly] {
    background-color: ${({ theme }) => theme.bg};
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4};
  }

  td:nth-child(9) input,
  td:nth-child(10) input,
  td:nth-child(8) select,
  td:nth-child(8) input {
    min-width: 88px;
    max-width: 110px;
    text-align: right;
  }

  .resumen__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .resumen__grid span {
    display: block;
    font-size: 13px;
    margin-bottom: 6px;
  }

  .resumen__grid strong {
    font-size: 18px;
  }

  .acciones {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .btn {
    border: none;
    border-radius: 10px;
    padding: 12px 18px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn_principal {
    background-color: ${({ theme }) => theme.bg5};
    color: #ffffff;
  }

  .btn_secundario {
    background-color: ${({ theme }) => theme.bg4};
    color: ${({ theme }) => theme.text};
  }

  .btn_tabla {
    width: 100%;
    padding: 10px 12px;
  }

  @media (max-width: 860px) {
    .grid-2,
    .resumen__grid {
      grid-template-columns: 1fr;
    }

    .tarjeta__encabezado,
    .acciones {
      flex-direction: column;
    }
  }

  ${tabletLandscapeBase}
  ${tabletLandscapeTableCompact}
  ${mobileStackBase}
`;

const Campo = styled.div`
  /* Aqui se da estilo a textbox, textarea y select del formulario. */
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input,
  textarea,
  select {
    border: 1px solid
      ${({ theme }) => (theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4)};
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    background-color: ${({ theme }) => theme.bg};
    color: ${({ theme }) => theme.text};
    outline: none;
    appearance: none;
  }

  input:focus,
  textarea:focus,
  select:focus {
    border-color: ${({ theme }) => theme.bg5};
    box-shadow: 0 0 0 3px
      ${({ theme }) =>
        theme.bg === "rgb(255,255,255)"
          ? "rgba(117, 1, 152, 0.14)"
          : "rgba(117, 1, 152, 0.2)"};
  }

  textarea {
    min-height: 90px;
    resize: vertical;
  }

  &.campo_requerido input,
  &.campo_requerido textarea,
  &.campo_requerido select {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.35)" : "rgba(230, 205, 238, 0.38)"};
    background-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "rgba(117, 1, 152, 0.05)" : "rgba(117, 1, 152, 0.14)"};
  }

  &.campo_requerido input[readonly],
  &.campo_requerido textarea[readonly],
  &.campo_requerido select[readonly] {
    border-color: ${({ theme }) =>
      theme.bg === "rgb(255,255,255)" ? "#d2dae6" : theme.bg4};
    background-color: ${({ theme }) => theme.bg};
  }
`;
