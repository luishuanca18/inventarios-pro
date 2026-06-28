import { leerPerfilUsuario } from "./perfilUsuario";

const normalizarTextoVisible = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ");

export const obtenerNombreResponsableActivo = (user = null) => {
  if (!user) {
    return "";
  }

  const perfil = leerPerfilUsuario(user);
  const nombrePerfil =
    perfil?.nombreVisible ||
    perfil?.nombreCompleto ||
    user?.user_metadata?.nombre ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "";

  const nombreNormalizado = normalizarTextoVisible(nombrePerfil);
  if (nombreNormalizado) {
    return nombreNormalizado;
  }

  const correo = (user?.email || "").toString().trim();
  const alias = correo.split("@")[0] || "";

  return normalizarTextoVisible(
    alias
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letra) => letra.toUpperCase())
  );
};
