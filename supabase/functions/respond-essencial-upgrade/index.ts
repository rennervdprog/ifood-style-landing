import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const BodySchema = z.object({
  response: z.enum(["accepted", "refused"]),
  store_id: z.string().uuid(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    if (!externalUrl || !serviceKey || !anonKey) return json({ error: "Backend não configurado." }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sessão expirada. Faça login novamente." }, 401);

    const auth = createClient(externalUrl, anonKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await auth.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Sessão inválida. Faça login novamente." }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors }, 400);

    const admin = createClient(externalUrl, serviceKey, { auth: { persistSession: false } });
    const { response, store_id } = parsed.data;

    const [{ data: store, error: storeError }, { data: roles, error: roleError }] = await Promise.all([
      admin.from("stores").select("id, owner_id, status").eq("id", store_id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    if (storeError) return json({ error: storeError.message }, 500);
    if (roleError) return json({ error: roleError.message }, 500);
    if (!store) return json({ error: "Loja não encontrada." }, 404);

    const isAdmin = (roles || []).some((r: any) => ["admin", "super_admin"].includes(String(r.role)));
    if (store.owner_id !== user.id && !isAdmin) return json({ error: "Sem permissão para responder por esta loja." }, 403);

    const { data: plan, error: planError } = await admin
      .from("store_plans")
      .select("id, plan_type, is_active")
      .eq("store_id", store_id)
      .eq("is_active", true)
      .maybeSingle();
    if (planError) return json({ error: planError.message }, 500);
    if (!plan) return json({ error: "Plano ativo não encontrado." }, 404);

    const now = new Date().toISOString();
    if (response === "accepted") {
      const monthlyFee = plan.plan_type === "autonomy" ? 239.9 : 180;
      const { error: updatePlanError } = await admin
        .from("store_plans")
        .update({
          essencial_upgrade_response: "accepted",
          essencial_upgrade_response_at: now,
          monthly_fee: monthlyFee,
          updated_at: now,
        })
        .eq("id", plan.id);
      if (updatePlanError) return json({ error: updatePlanError.message }, 500);

      const { error: updateStoreError } = await admin
        .from("stores")
        .update({ status: "ativo", updated_at: now })
        .eq("id", store_id)
        .eq("status", "inativo");
      if (updateStoreError) return json({ error: updateStoreError.message }, 500);

      await admin.from("admin_logs").insert({
        action: "essencial_upgrade_accepted",
        metadata: { store_id, plan_type: plan.plan_type, new_fee: monthlyFee, user_id: user.id, via_admin: isAdmin && store.owner_id !== user.id },
      }).then(() => {}, () => {});

      return json({ ok: true, response: "accepted", new_monthly_fee: monthlyFee });
    }

    const { error: refusePlanError } = await admin
      .from("store_plans")
      .update({ essencial_upgrade_response: "refused", essencial_upgrade_response_at: now, updated_at: now })
      .eq("id", plan.id);
    if (refusePlanError) return json({ error: refusePlanError.message }, 500);

    const { error: suspendError } = await admin
      .from("stores")
      .update({ status: "inativo", updated_at: now })
      .eq("id", store_id);
    if (suspendError) return json({ error: suspendError.message }, 500);

    await admin.from("admin_logs").insert({
      action: "store_suspended_upgrade_refused",
      metadata: { store_id, plan_type: plan.plan_type, user_id: user.id, via_admin: isAdmin && store.owner_id !== user.id },
    }).then(() => {}, () => {});

    return json({ ok: true, response: "refused", store_suspended: true });
  } catch (e: any) {
    console.error("[respond-essencial-upgrade]", e);
    return json({ error: e?.message || "Erro interno." }, 500);
  }
});