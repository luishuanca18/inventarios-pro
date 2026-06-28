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
        JSON.stringify({ error: "No tienes permisos para invitar talleres." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const correo = String(body?.correo || "").trim().toLowerCase();
    const nombreVisible = normalizarTexto(body?.nombreVisible || "");
    const nombreTaller = normalizarTexto(body?.nombreTaller || "");
    const tallerId = String(body?.tallerId || "").trim();
    const tallerCodigo = normalizarTexto(body?.tallerCodigo || "");
    const redirectTo = String(body?.redirectTo || "").trim();

    if (!correo || !nombreVisible || !nombreTaller || !tallerId) {
      return new Response(
        JSON.stringify({ error: "Faltan datos para invitar al taller." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: usuarioExistente, error: errorUsuarioExistente } = await adminClient
      .from("usuarios")
      .select("*")
      .ilike("correo", correo)
      .maybeSingle();

    if (errorUsuarioExistente) {
      return new Response(
        JSON.stringify({ error: errorUsuarioExistente.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let idauth = String(usuarioExistente?.idauth || "").trim();
    let modo = "invite";

    if (idauth) {
      const { error: errorRecovery } = await adminClient.auth.resetPasswordForEmail(correo, {
        redirectTo,
      });

      if (errorRecovery) {
        return new Response(
          JSON.stringify({ error: errorRecovery.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      modo = "recovery";
    } else {
      const { data: invitacion, error: errorInvite } = await adminClient.auth.admin.inviteUserByEmail(
        correo,
        {
          redirectTo,
          data: {
            nombre: nombreVisible,
            rol: "TALLER",
            taller_id: tallerId,
            taller_codigo: tallerCodigo,
            taller_asignado: nombreTaller,
          },
        },
      );

      if (errorInvite) {
        return new Response(
          JSON.stringify({ error: errorInvite.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      idauth = String(invitacion?.user?.id || "").trim();
    }

    const metadataUsuario = {
      ...(usuarioExistente?.metadata || {}),
      tallerAsignado: nombreTaller,
      tallerId,
      tallerCodigo,
      accesoInvitado: true,
      fechaInvitacion: new Date().toISOString(),
      invitadoPor: String(user.email || "").toLowerCase(),
    };

    const payloadUsuario = {
      idauth,
      nombre: nombreVisible,
      nombres: nombreVisible,
      correo,
      area: "TALLERES",
      sede: usuarioExistente?.sede || "PRINCIPAL",
      estado: "ACTIVO",
      tipouser: "TALLER",
      modulos: ["TALLERES"],
      submodulos: {
        TALLERES: ["OP DISPONIBLES", "MI PRODUCCION", "HISTORIAL", "PAGOS"],
      },
      metadata: metadataUsuario,
      telefono: usuarioExistente?.telefono || "-",
      nro_doc: usuarioExistente?.nro_doc || "-",
      direccion: usuarioExistente?.direccion || "-",
      tipodoc: usuarioExistente?.tipodoc || "-",
      fecharegistro:
        usuarioExistente?.fecharegistro || new Date().toISOString().slice(0, 10),
    };

    const consultaUsuario = usuarioExistente
      ? adminClient.from("usuarios").update(payloadUsuario).ilike("correo", correo)
      : adminClient.from("usuarios").insert(payloadUsuario);

    const { error: errorGuardarUsuario } = await consultaUsuario;
    if (errorGuardarUsuario) {
      return new Response(
        JSON.stringify({ error: errorGuardarUsuario.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: errorActualizarTaller } = await adminClient
      .from("talleres")
      .update({
        usuario_correo: correo,
        usuario_nombre: nombreVisible,
        acceso_estado: "INVITADO",
        metadata: {
          correoUsuario: correo,
          nombreUsuario: nombreVisible,
          accesoEstado: "INVITADO",
          tallerId,
          tallerCodigo,
          fechaInvitacion: new Date().toISOString(),
        },
      })
      .eq("id", tallerId);

    if (errorActualizarTaller) {
      return new Response(
        JSON.stringify({ error: errorActualizarTaller.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        correo,
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
