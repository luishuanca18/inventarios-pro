const normalizarMensaje = (mensaje = "") =>
  mensaje
    .toString()
    .trim()
    .toLowerCase();

export const traducirMensajeAuth = (mensaje = "") => {
  const texto = normalizarMensaje(mensaje);

  if (!texto) {
    return "Ocurrio un problema de autenticacion.";
  }

  if (texto.includes("new password should be different from the old password")) {
    return "La nueva contrasena debe ser diferente a la anterior.";
  }

  if (texto.includes("invalid login credentials")) {
    return "Correo, nombre visible o contrasena incorrectos.";
  }

  if (texto.includes("email not confirmed")) {
    return "Tu correo todavia no ha sido confirmado.";
  }

  if (texto.includes("for security purposes, you can only request this after")) {
    return "Espera un momento antes de volver a solicitar la recuperacion de contrasena.";
  }

  if (texto.includes("password should be at least")) {
    return "La contrasena debe cumplir el minimo de caracteres requerido.";
  }

  if (texto.includes("same password")) {
    return "La nueva contrasena no puede ser igual a la anterior.";
  }

  if (texto.includes("user already registered")) {
    return "Ese correo ya esta registrado en el sistema.";
  }

  if (texto.includes("unable to validate email address")) {
    return "El correo ingresado no es valido.";
  }

  if (texto.includes("session not found")) {
    return "La sesion ya no esta disponible. Vuelve a iniciar sesion.";
  }

  if (texto.includes("jwt expired")) {
    return "La sesion vencio. Vuelve a iniciar sesion.";
  }

  if (texto.includes("network")) {
    return "Hay un problema de conexion. Intenta nuevamente.";
  }

  return mensaje;
};
