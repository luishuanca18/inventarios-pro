import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HomeTemplate, UserAuth } from "../index";
import { leerPerfilUsuario } from "../utils/perfilUsuario";

export function Home() {
  const navigate = useNavigate();
  const { user } = UserAuth();
  const perfil = leerPerfilUsuario(user);

  useEffect(() => {
    if ((perfil?.rol || "").toUpperCase() === "TALLER") {
      navigate("/talleres", { replace: true });
    }
  }, [navigate, perfil?.rol]);

  if ((perfil?.rol || "").toUpperCase() === "TALLER") {
    return null;
  }

  return (<HomeTemplate />);
}


