import Swal from "sweetalert2";

const CONFIG_BASE = {
  backdrop: "rgba(15, 23, 42, 0.52)",
  background: "#18181b",
  color: "#ffffff",
  confirmButtonColor: "#750198",
  customClass: {
    popup: "cynara-alerta-popup",
    confirmButton: "cynara-alerta-boton",
  },
};

const asegurarEstilosNotificaciones = () => {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById("cynara-alertas-estilos")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "cynara-alertas-estilos";
  style.textContent = `
    .cynara-alerta-popup {
      border-radius: 20px !important;
      border: 1px solid rgba(168, 85, 247, 0.28) !important;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35) !important;
      padding: 22px 20px 18px !important;
      width: min(92vw, 420px) !important;
    }
    .cynara-alerta-boton {
      border-radius: 12px !important;
      font-weight: 700 !important;
      padding: 10px 18px !important;
      box-shadow: none !important;
    }
    .cynara-alerta-popup .swal2-title {
      font-size: 1.2rem !important;
      line-height: 1.25 !important;
    }
    .cynara-alerta-popup .swal2-html-container {
      font-size: 0.98rem !important;
      line-height: 1.45 !important;
      margin-top: 8px !important;
    }
  `;
  document.head.appendChild(style);
};

const abrirAlerta = (configuracion = {}) => {
  asegurarEstilosNotificaciones();
  return Swal.fire({
    ...CONFIG_BASE,
    ...configuracion,
  });
};

export const mostrarNotificacionCarga = (
  mensaje = "Informacion cargada correctamente."
) =>
  abrirAlerta({
    title: "Listo",
    text: mensaje,
    icon: "success",
    showConfirmButton: false,
    timer: 1600,
    timerProgressBar: true,
    allowEscapeKey: true,
    allowOutsideClick: true,
  });

export const mostrarProcesoSistema = (
  mensaje = "Procesando informacion..."
) =>
  abrirAlerta({
    title: "Procesando",
    text: mensaje,
    icon: "info",
    showConfirmButton: false,
    allowEscapeKey: false,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

export const cerrarProcesoSistema = () => {
  Swal.close();
};

export const ejecutarAccionConFeedbackSistema = async ({
  mensajeProceso = "Procesando informacion...",
  mensajeExito = "Accion completada correctamente.",
  mensajeError = "No se pudo completar la accion.",
  accion,
}) => {
  mostrarProcesoSistema(mensajeProceso);

  try {
    const resultado = await accion();
    cerrarProcesoSistema();
    await mostrarNotificacionCarga(mensajeExito);
    return resultado;
  } catch (error) {
    cerrarProcesoSistema();
    await mostrarErrorSistema(error?.message || mensajeError);
    throw error;
  }
};

export const mostrarAlertaSistema = (
  mensaje,
  {
    titulo = "Falta completar informacion",
    icono = "warning",
    confirmarTexto = "Entendido",
  } = {}
) =>
  abrirAlerta({
    title: titulo,
    text: mensaje,
    icon: icono,
    confirmButtonText: confirmarTexto,
  });

export const mostrarErrorSistema = (
  mensaje,
  titulo = "No se pudo completar la accion"
) =>
  abrirAlerta({
    title: titulo,
    text: mensaje,
    icon: "error",
    confirmButtonText: "Revisar",
  });

export const confirmarAccionSistema = async (
  mensaje,
  {
    titulo = "Confirmar accion",
    icono = "question",
    confirmarTexto = "Continuar",
    cancelarTexto = "Cancelar",
  } = {}
) => {
  const respuesta = await abrirAlerta({
    title: titulo,
    text: mensaje,
    icon: icono,
    showCancelButton: true,
    confirmButtonText: confirmarTexto,
    cancelButtonText: cancelarTexto,
    reverseButtons: true,
    focusCancel: true,
  });

  return Boolean(respuesta.isConfirmed);
};
