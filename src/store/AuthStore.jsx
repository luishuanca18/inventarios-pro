import { create } from "zustand";
import { supabase } from "../index.js";

export const useAuthStore = create((set, get) => ({
  signInWithEmail: async (p) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: p.correo,
      password: p.pass,
    });

    if(error){
        return null;
    }
    
     return data.user;
  },

  signout: async ()=>{
  const {error} = await 
  supabase.auth.signOut()

  if (error)

    throw new error("A ocurrido un error durante el cierre de sesion" +error)
  }
 
}));
