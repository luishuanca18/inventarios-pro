import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const generarPasswordTemporal = (longitud = 10) => {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const array = new Uint32Array(longitud);
  crypto.getRandomValues(array);
  return Array.from(array, (numero) => caracteres[numero % caracteres.length]).join("");
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
      .select("correo,estado,tipouser")
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
        JSON.stringify({ error: "No tienes permisos para restablecer contrasenas." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const correoObjetivo = String(body?.correo || "").trim().toLowerCase();
    if (!correoObjetivo) {
      return new Response(
        JSON.stringify({ error: "Debes indicar el correo del usuario." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: cuentaObjetivo, error: errorCuentaObjetivo } = await adminClient
      .from("usuarios")
      .select("correo,idauth,estado")
      .ilike("correo", correoObjetivo)
      .maybeSingle();

    if (errorCuentaObjetivo || !cuentaObjetivo?.idauth) {
      return new Response(
        JSON.stringify({ error: "No se encontro una cuenta valida para ese correo." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const passwordTemporal = generarPasswordTemporal(10);
    const { error: errorReset } = await adminClient.auth.admin.updateUserById(
      String(cuentaObjetivo.idauth),
      { password: passwordTemporal },
    );

    if (errorReset) {
      return new Response(
        JSON.stringify({ error: errorReset.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await adminClient
      .from("usuarios")
      .update({
        metadata: {
          passwordTemporalActiva: true,
          fechaRestablecimientoTemporal: new Date().toISOString(),
          restablecidoPor: (user.email || "").toLowerCase(),
        },
      })
      .ilike("correo", correoObjetivo);

    return new Response(
      JSON.stringify({
        ok: true,
        correo: correoObjetivo,
        passwordTemporal,
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
