import { Routes, Route } from "react-router-dom";
import { Home, Login, ProtectedRoute, useAuth } from "../index";

export function MyRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
     
      <Route element={<ProtectedRoute user={user} redirectTo="/login" />}>
        <Route path="/" element={<Home />} />
      </Route>
    </Routes>
  );
}
