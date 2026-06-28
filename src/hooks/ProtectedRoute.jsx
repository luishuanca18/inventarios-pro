import { Navigate, Outlet, useLocation } from "react-router-dom";
import { leerPerfilUsuario } from "../utils/perfilUsuario";
import { puedeAccederRuta } from "../utils/permisosSistema";

export const ProtectedRoute = ({ user, loading = false, redirectTo, children }) => {
  const location = useLocation();
  if (loading) return null;
  if (user == null) return <Navigate replace to={redirectTo} />;
  const perfil = leerPerfilUsuario(user);
  if (!puedeAccederRuta(location.pathname, perfil)) {
    return <Navigate replace to="/" />;
  }

  return children ? children : <Outlet />;
};
