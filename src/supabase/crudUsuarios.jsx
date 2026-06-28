import Swal from "sweetalert2";
import { supabase } from "./supabase.config.jsx";

export const GuardarUsuarioSistema = async (p) => {
  const payload = {
    ...p,
    idauth: p.idauth ? String(p.idauth) : "",
    nombre: p.nombre ?? p.nombres ?? "",
    nombres: p.nombres ?? p.nombre ?? "generico",
    nro_doc: p.nro_doc ?? "-",
    direccion: p.direccion ?? "-",
    tipodoc: p.tipodoc ?? "-",
    correo: p.correo ?? "-",
    telefono: p.telefono ?? "-",
    estado: p.estado ?? "ACTIVO",
    tipouser: p.tipouser ?? "admin",
    fecharegistro: p.fecharegistro
      ? new Date(p.fecharegistro).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await supabase
    .from("usuarios")
    .upsert(payload, { onConflict: "idauth" })
    .select()
    .maybeSingle();

  if (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Algo salio mal: " + error.message,
    });

    return null;
  }

  return data ?? null;
};

export const InsertarUsuarios = GuardarUsuarioSistema;
