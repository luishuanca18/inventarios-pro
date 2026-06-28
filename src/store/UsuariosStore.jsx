import { create } from "zustand";
import { GuardarUsuarioSistema } from "../supabase/crudUsuarios.jsx";
import { supabase } from "../supabase/supabase.config.jsx";

export const useUsuariosStore = create(() => ({
  insertarUsuarioAdmin: async (p) => {
    const { data, error } = await supabase.auth.signUp({
      email: p.correo,
      password: p.pass,
    });

    console.log("data del registro del user auth", data);

    if (error) {
      return {
        ok: false,
        message: error.message,
      };
    }

    if (!data?.user?.id) {
      return {
        ok: false,
        message: "No se pudo crear la cuenta en autenticacion.",
      };
    }

    const datauser = await GuardarUsuarioSistema({
      idauth: data.user.id,
      correo: p.correo,
      nombre: p.nombre ?? "",
      telefono: p.telefono ?? "",
      area: p.area ?? "",
      sede: p.sede ?? "",
      fecharegistro: new Date().toISOString(),
      tipouser: p.tipouser ?? "admin",
      estado: "ACTIVO",
      modulos: p.modulos ?? [],
      submodulos: p.submodulos ?? [],
    });

    if (!datauser) {
      return {
        ok: false,
        message:
          "La cuenta se creo, pero no se pudo guardar en la tabla usuarios.",
      };
    }

    return {
      ok: true,
      data: datauser,
      session: data.session ?? null,
      requiereConfirmacionCorreo: !data.session,
    };
  },
}));
