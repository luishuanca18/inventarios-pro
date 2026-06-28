import { create } from "zustand";
import { supabase } from "../supabase/supabase.config.jsx";
import { traducirMensajeAuth } from "../utils/authMensajes";

const normalizarAccesoTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");

const obtenerCandidatosAcceso = (item = {}) => {
  const correo = (item?.correo || "").toString().trim().toLowerCase();
  const localPart = correo.split("@")[0] || "";
  const localPartNormalizado = normalizarAccesoTexto(localPart);
  const segmentosCorreo = localPart
    .split(/[._-]+/)
    .map((segmento) => normalizarAccesoTexto(segmento))
    .filter(Boolean);

  const candidatos = new Set([
    normalizarAccesoTexto(item?.nombre || ""),
    normalizarAccesoTexto(item?.nombres || ""),
    localPartNormalizado,
    ...segmentosCorreo,
  ]);

  if (segmentosCorreo.length >= 2) {
    candidatos.add(segmentosCorreo.slice(0, 2).join(""));
  }

  return Array.from(candidatos).filter(Boolean);
};

const buscarCuentaSistemaPorCorreo = async (correo = "") => {
  const correoNormalizado = (correo || "").toString().trim().toLowerCase();
  if (!correoNormalizado) return null;

  const { data, error } = await supabase
    .from("usuarios")
    .select("correo,nombre,nombres,estado,idauth,metadata")
    .ilike("correo", correoNormalizado)
    .limit(1);

  if (error) {
    throw error;
  }

  const lista = Array.isArray(data) ? data : [];
  return (
    lista.find(
      (item) => (item?.correo || "").toString().trim().toLowerCase() === correoNormalizado,
    ) || null
  );
};

export const useAuthStore = create(() => ({
  signInWithEmail: async (p) => {
    const acceso = (p.correo || "").toString().trim();
    let correoLogin = acceso.toLowerCase();
    let cuentaSistema = null;

    if (acceso && !acceso.includes("@")) {
      const nombreBuscado = normalizarAccesoTexto(acceso);
      const { data: cuentasPorNombre, error: errorNombre } = await supabase
        .from("usuarios")
        .select("correo,nombre,nombres,estado,idauth,metadata")
        .limit(500);

      if (errorNombre) {
        return {
          ok: false,
          message: errorNombre.message,
        };
      }

      const coincidencias = (Array.isArray(cuentasPorNombre) ? cuentasPorNombre : []).filter(
        (item) => obtenerCandidatosAcceso(item).includes(nombreBuscado),
      );

      if (coincidencias.length === 0) {
        return {
          ok: false,
          message: "No se encontro una cuenta con ese nombre visible.",
        };
      }

      if (coincidencias.length > 1) {
        return {
          ok: false,
          message: "Hay mas de una cuenta con ese nombre. Ingresa con correo.",
        };
      }

      cuentaSistema = coincidencias[0] || null;
      correoLogin = (cuentaSistema?.correo || "").toString().trim().toLowerCase();
    } else {
      try {
        cuentaSistema = await buscarCuentaSistemaPorCorreo(correoLogin);
      } catch (error) {
        return {
          ok: false,
          message: error.message,
        };
      }
    }

    if (!cuentaSistema) {
      return {
        ok: false,
        message: "Esta cuenta no esta registrada dentro del sistema.",
      };
    }

    if ((cuentaSistema?.estado || "").toUpperCase() === "BLOQUEADO") {
      return {
        ok: false,
        message: "Esta cuenta esta bloqueada. Solicita activacion al administrador.",
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correoLogin,
      password: p.pass,
    });

    if (error) {
      const accesoCreado =
        cuentaSistema?.metadata?.accesoSistemaCreado === true ||
        String(cuentaSistema?.idauth || "").trim().length > 0;

      if (
        !accesoCreado &&
        String(error.message || "").toLowerCase().includes("invalid login credentials")
      ) {
        return {
          ok: false,
          message:
            "La cuenta ya fue guardada en el sistema, pero todavia no tiene acceso creado. En Personal y seguridad usa 'Crear acceso temporal'.",
        };
      }

      return {
        ok: false,
        message: traducirMensajeAuth(error.message),
      };
    }

    return {
      ok: true,
      user: data.user,
    };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      throw new Error(
        "A ocurrido un error durante el cierre de sesion: " + error.message,
      );
    }
  },
}));
