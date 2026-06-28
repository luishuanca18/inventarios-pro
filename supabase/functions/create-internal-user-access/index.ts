import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const normalizarTexto = (valor = "") =>
  valor
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const normalizarCorreo = (valor = "") => valor.toString().trim().toLowerCase();

const buscarUsuarioAuthPorCorreo = async (adminClient: ReturnType<typeof createClient>, correo = "") => {
  for (let pagina = 1; pagina <= 10; pagina += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: pagina,
      perPage: 1000,
    });

    if (error) {
      throw new Error(error.message);
    }

    const usuarios = data?.users || [];
    const encontrado = usuarios.find(
      (item) => normalizarCorreo(item?.email || "") === normalizarCorreo(correo),
    );

    if (encontrado) {
      return encontrado;
    }

    if (usuarios.length < 1000) {
      break;
    }
  }

  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Falta autorizacion." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: errorAuth,
    } = await client.auth.getUser();

    if (errorAuth || !user) {
      return new Response(
        JSON.stringify({ error: "No se pudo validar la sesion actual." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: cuentaSolicitante, error: errorSolicitante } = await adminClient
      .from("usuarios")
      .select("correo,tipouser")
      .ilike("correo", user.email ?? "")
      .maybeSingle();

    if (errorSolicitante || !cuentaSolicitante) {
      return new Response(
        JSON.stringify({ error: "No se encontro la cuenta del solicitante." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rolSolicitante = String(cuentaSolicitante?.tipouser || "").toUpperCase();
    if (!["ADMINISTRADOR", "GERENCIA", "ADMIN"].includes(rolSolicitante)) {
      return new Response(
        JSON.stringify({ error: "No tienes permisos para crear accesos internos." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const correo = normalizarCorreo(body?.correo || "");
    const passwordTemporal = String(body?.passwordTemporal || "").trim();
    const nombreVisible = normalizarTexto(body?.nombreVisible || "");
    const rol = normalizarTexto(body?.rol || "PRODUCCION");
    const area = normalizarTexto(body?.area || "PRODUCCION");
    const estado = normalizarTexto(body?.estado || "ACTIVO");
    const tallerAsignado = normalizarTexto(body?.tallerAsignado || "");
    const tallerId = String(body?.tallerId || "").trim();
    const tallerCodigo = normalizarTexto(body?.tallerCodigo || "");
    const observacion = normalizarTexto(body?.observacion || "");
    const modulos = Array.isArray(body?.modulos) ? body.modulos : [];
    const submodulos = body?.submodulos && typeof body.submodulos === "object" ? body.submodulos : {};

    if (!correo || !nombreVisible || passwordTemporal.length < 6) {
      return new Response(
        JSON.stringify({ error: "Debes indicar correo, nombre visible y una contrasena temporal valida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: usuarioSistemaExistente, error: errorUsuarioSistema } = await adminClient
      .from("usuarios")
      .select("*")
      .ilike("correo", correo)
      .maybeSingle();

    if (errorUsuarioSistema) {
      return new Response(
        JSON.stringify({ error: errorUsuarioSistema.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let idauth = String(usuarioSistemaExistente?.idauth || "").trim();
    let modo = "actualizado";

    if (idauth) {
      const { error: errorActualizar } = await adminClient.auth.admin.updateUserById(idauth, {
        password: passwordTemporal,
        email: correo,
        email_confirm: true,
        user_metadata: {
          nombre: nombreVisible,
          rol,
        },
      });

      if (errorActualizar) {
        return new Response(
          JSON.stringify({ error: errorActualizar.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      const authExistente = await buscarUsuarioAuthPorCorreo(adminClient, correo);

      if (authExistente?.id) {
        idauth = String(authExistente.id);
        const { error: errorActualizar } = await adminClient.auth.admin.updateUserById(idauth, {
          password: passwordTemporal,
          email: correo,
          email_confirm: true,
          user_metadata: {
            nombre: nombreVisible,
            rol,
          },
        });

        if (errorActualizar) {
          return new Response(
            JSON.stringify({ error: errorActualizar.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        modo = "vinculado";
      } else {
        const { data: creado, error: errorCreacion } = await adminClient.auth.admin.createUser({
          email: correo,
          password: passwordTemporal,
          email_confirm: true,
          user_metadata: {
            nombre: nombreVisible,
            rol,
          },
        });

        if (errorCreacion || !creado?.user?.id) {
          return new Response(
            JSON.stringify({ error: errorCreacion?.message || "No se pudo crear el acceso." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        idauth = String(creado.user.id);
        modo = "creado";
      }
    }

    const metadata = {
      ...(usuarioSistemaExistente?.metadata || {}),
      observacion,
      passwordTemporalActiva: true,
      fechaRestablecimientoTemporal: new Date().toISOString(),
      restablecidoPor: normalizarCorreo(user.email || ""),
      accesoCreadoPor: normalizarCorreo(user.email || ""),
      accesoCreadoEn: new Date().toISOString(),
      tallerAsignado,
      tallerId,
      tallerCodigo,
    };

    const payloadUsuario = {
      idauth,
      nombre: nombreVisible,
      nombres: nombreVisible,
      correo,
      area,
      sede: usuarioSistemaExistente?.sede || "PRINCIPAL",
      estado,
      tipouser: rol,
      modulos,
      submodulos,
      metadata,
      telefono: usuarioSistemaExistente?.telefono || "-",
      nro_doc: usuarioSistemaExistente?.nro_doc || "-",
      direccion: usuarioSistemaExistente?.direccion || "-",
      tipodoc: usuarioSistemaExistente?.tipodoc || "-",
      fecharegistro:
        usuarioSistemaExistente?.fecharegistro || new Date().toISOString().slice(0, 10),
    };

    const consultaUsuario = usuarioSistemaExistente
      ? adminClient.from("usuarios").update(payloadUsuario).ilike("correo", correo)
      : adminClient.from("usuarios").insert(payloadUsuario);

    const { error: errorGuardarUsuario } = await consultaUsuario;
    if (errorGuardarUsuario) {
      return new Response(
        JSON.stringify({ error: errorGuardarUsuario.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        correo,
        idauth,
        modo,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error inesperado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
