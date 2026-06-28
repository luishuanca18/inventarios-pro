import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase/supabase.config.jsx";
import { leerUsuariosSistema, sobrescribirUsuariosSistema } from "../utils/seguridadUsuarios";
import { guardarPerfilUsuario } from "../utils/perfilUsuario";

const AuthContext = createContext();
let cacheValidacionSesion = {
  correo: "",
  estado: "",
  expiraEn: 0,
};

const obtenerCuentaSistemaPorCorreo = async (correo = "") => {
  const correoNormalizado = correo.toString().trim().toLowerCase();
  if (!correoNormalizado) {
    return null;
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("correo,estado")
    .ilike("correo", correoNormalizado)
    .limit(1);

  if (error) {
    throw error;
  }

  const lista = Array.isArray(data) ? data : [];
  return lista.find(
    (item) => (item?.correo || "").toString().trim().toLowerCase() === correoNormalizado,
  ) || null;
};

const normalizarTextoPerfil = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const normalizarSubmodulosPerfil = (submodulos = {}) =>
  Object.fromEntries(
    Object.entries(submodulos || {}).map(([modulo, lista]) => [
      normalizarTextoPerfil(modulo),
      Array.from(
        new Set((Array.isArray(lista) ? lista : []).map(normalizarTextoPerfil).filter(Boolean)),
      ),
    ]),
  );

const mapearUsuarioSupabaseAPerfilLocal = (item = {}) => ({
  idauth: item?.idauth ? String(item.idauth) : "",
  correo: (item?.correo || "").toString().trim().toLowerCase(),
  nombreCompleto: normalizarTextoPerfil(item?.nombre || item?.nombres || ""),
  rol: normalizarTextoPerfil(item?.tipouser || "PRODUCCION"),
  area: normalizarTextoPerfil(item?.area || "PRODUCCION"),
  sede: normalizarTextoPerfil(item?.sede || "PRINCIPAL"),
  estado: normalizarTextoPerfil(item?.estado || "ACTIVO"),
  modulos: Array.from(
    new Set((Array.isArray(item?.modulos) ? item.modulos : []).map(normalizarTextoPerfil).filter(Boolean)),
  ),
  submodulos: normalizarSubmodulosPerfil(item?.submodulos || {}),
  tallerAsignado: normalizarTextoPerfil(
    item?.metadata?.tallerAsignado || item?.tallerAsignado || item?.taller_asignado || "",
  ),
  tallerId:
    (item?.metadata?.tallerId || item?.taller_id || item?.tallerId || "")
      .toString()
      .trim(),
  tallerCodigo: normalizarTextoPerfil(
    item?.metadata?.tallerCodigo || item?.taller_codigo || item?.tallerCodigo || "",
  ),
  observacion: normalizarTextoPerfil(item?.metadata?.observacion || item?.observacion || ""),
  creadoEn: item?.fecharegistro || "",
  actualizadoEn: item?.fechaactualizacion || "",
});

const sincronizarCuentaSistemaEnLocal = async (correo = "", user = {}) => {
  const correoNormalizado = (correo || "").toString().trim().toLowerCase();
  if (!correoNormalizado) {
    return null;
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .ilike("correo", correoNormalizado)
    .limit(10);

  if (error) {
    throw error;
  }

  const lista = Array.isArray(data) ? data : [];
  const cuenta = lista.find(
    (item) => (item?.correo || "").toString().trim().toLowerCase() === correoNormalizado,
  );

  if (!cuenta) {
    return null;
  }

  const perfilLocal = mapearUsuarioSupabaseAPerfilLocal(cuenta);
  const usuariosLocales = leerUsuariosSistema().filter(
    (item) => item?.correo !== correoNormalizado,
  );
  sobrescribirUsuariosSistema([...usuariosLocales, perfilLocal]);
  guardarPerfilUsuario({
    correo: perfilLocal.correo,
    nombreVisible: perfilLocal.nombreCompleto || user?.user_metadata?.nombre || "",
    rol: perfilLocal.rol,
    area: perfilLocal.area,
    sede: perfilLocal.sede,
    modulos: perfilLocal.modulos,
    submodulos: perfilLocal.submodulos,
    tallerAsignado: perfilLocal.tallerAsignado,
    tallerId: perfilLocal.tallerId,
    tallerCodigo: perfilLocal.tallerCodigo,
  });

  return perfilLocal;
};

const validarSesionContraSistema = async (session) => {
  if (session?.user == null) {
    return null;
  }

  const correo = (session?.user?.email || "").toString().trim().toLowerCase();
  const ahora = Date.now();
  if (
    cacheValidacionSesion.correo === correo &&
    cacheValidacionSesion.estado === "ACTIVO" &&
    cacheValidacionSesion.expiraEn > ahora
  ) {
    return session.user;
  }

  const cuentaSistema = await obtenerCuentaSistemaPorCorreo(correo);

  if (!cuentaSistema || (cuentaSistema?.estado || "").toUpperCase() === "BLOQUEADO") {
    cacheValidacionSesion = {
      correo,
      estado: "BLOQUEADO",
      expiraEn: ahora + 5000,
    };
    await supabase.auth.signOut();
    return null;
  }

  await sincronizarCuentaSistemaEnLocal(correo, session?.user || {});

  cacheValidacionSesion = {
    correo,
    estado: "ACTIVO",
    expiraEn: ahora + 30000,
  };
  return session.user;
};

export const AuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;

    const inicializarSesion = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        const session = data?.session || null;
        if (activo) {
          setUser(session?.user || null);
          setLoading(false);
        }

        const usuarioValidado = await validarSesionContraSistema(session);
        if (activo) {
          setUser(usuarioValidado);
        }
      } catch (error) {
        console.error("No se pudo inicializar la sesion:", error);
        if (activo) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    inicializarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activo) {
        return;
      }

      setUser(session?.user || null);
      setLoading(false);

      if (!session?.user) {
        cacheValidacionSesion = {
          correo: "",
          estado: "",
          expiraEn: 0,
        };
      }

      Promise.resolve(validarSesionContraSistema(session))
        .then((usuarioValidado) => {
          if (activo) {
            setUser(usuarioValidado);
          }
        })
        .catch((error) => {
          console.error("No se pudo validar la sesion:", error);
          if (activo) {
            setUser(null);
          }
        });
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
  );
};

export const UserAuth = () => useContext(AuthContext);
