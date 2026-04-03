import { supabase } from "../index";
import{ Swal } from "sweetalert2";

export const InsertarUsuarios = async (p) => {
  const { data, error } = await supabase
    .from("usuarios")
    .insert(p)
    .select()
    .maybeSingle();

  if (error) {
    Swal.fire({
      icon: "error",
      title: "¡Error!",
      text: "¡Algo salió mal!"+ error.message,
      
    });
  }
  if (data) return data; 
   
};
