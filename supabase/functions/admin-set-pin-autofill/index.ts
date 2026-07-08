import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, baggage, sentry-trace, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const EXTERNAL_URL =
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("EXTERNAL_URL")!;
    const EXTERNAL_SERVICE_KEY =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ??
      Deno.env.get("EXTERNAL_KEY") ??
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;

    if (!EXTERNAL_URL || !EXTERNAL_SERVICE_KEY) {
      return json({ error: "Backend não configurado" }, 500);
    }

    const service = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    // Admin check
    const { data: adminRole } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Apenas administradores." }, 403);

    const body = await req.json().catch(() => ({}));
    const store_id = String(body?.store_id || "");
    const enabled = Boolean(body?.enabled);
    if (!store_id) return json({ error: "store_id obrigatório" }, 400);

    const { data, error } = await service
      .from("stores")
      .update({ driver_pin_autofill: enabled })
      .eq("id", store_id)
      .select("id, driver_pin_autofill")
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Loja não encontrada" }, 404);

    return json({ ok: true, driver_pin_autofill: data.driver_pin_autofill });
  } catch (e: any) {
    return json({ error: e?.message || "Erro" }, 500);
  }
});