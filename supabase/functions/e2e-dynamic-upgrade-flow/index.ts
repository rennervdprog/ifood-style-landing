// e2e-dynamic-upgrade-flow — testa o ciclo completo Essencial/Autonomia:
//   0) escolhe uma loja sandbox (por store_id no body, ou por match de nome)
//   1) backup do estado atual (plan_type, monthly_fee, status, upgrade fields)
//   2) força plano no modo grátis (monthly_fee=0, sem VIP, ativo, upgrade fields nulos)
//   3) injeta N pedidos fake "entregue" totalizando GMV > threshold nos últimos 60d
//   4) chama check-essencial-upgrade → espera essencial_upgrade_scheduled_at populado
//   5) backdate scheduled_at + marca response='accepted' → chama de novo → espera monthly_fee = fee do plan_templates
//   6) cleanup: apaga pedidos fake e restaura estado original
//
// Auth: x-e2e-secret == E2E_ADMIN_SECRET OU Bearer == service-role.
// Body: { store_id?: string, plan_type?: "fixed"|"autonomy" }  (default: fixed)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-e2e-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MARKER = "e2e-dynamic-upgrade-flow";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const steps: Array<Record<string, unknown>> = [];
  const step = (name: string, ok: boolean, info?: unknown, error?: string) => {
    steps.push({ step: name, ok, info, error });
    console.log(`[${MARKER}] ${name} ok=${ok}`, info ?? "", error ?? "");
  };

  const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const SVC =
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const NATIVE_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || SVC;
  const e2eSecret = Deno.env.get("E2E_ADMIN_SECRET") || "";

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const hdr = req.headers.get("x-e2e-secret") || "";
  const authorized = (e2eSecret && hdr === e2eSecret) || token === SVC || token === NATIVE_SVC;
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(EXTERNAL_URL, SVC);
  const body = await req.json().catch(() => ({} as any));
  const wantedPlan: "fixed" | "autonomy" = body?.plan_type === "autonomy" ? "autonomy" : "fixed";

  // 0) Descobre thresholds/fees reais no plan_templates
  const { data: tpl } = await admin
    .from("plan_templates")
    .select("plan_key, monthly_fee, revenue_threshold")
    .eq("plan_key", wantedPlan)
    .maybeSingle();
  const expectedFee = Number((tpl as any)?.monthly_fee) || (wantedPlan === "autonomy" ? 199.9 : 89.9);
  const threshold = Number((tpl as any)?.revenue_threshold) || (wantedPlan === "autonomy" ? 2500 : 5000);
  step("read_plan_template", true, { plan: wantedPlan, expectedFee, threshold });

  // 1) Escolhe loja: body.store_id, ou primeira loja "teste"/"sandbox"
  let storeId: string | undefined = body?.store_id;
  if (!storeId) {
    const { data: cand } = await admin
      .from("stores")
      .select("id, name")
      .or("name.ilike.%teste%,name.ilike.%sandbox%,name.ilike.%fake%")
      .limit(1)
      .maybeSingle();
    storeId = (cand as any)?.id;
  }
  if (!storeId) return json({ error: "Nenhuma loja sandbox encontrada (passe store_id no body).", steps }, 400);

  const { data: storeRow } = await admin.from("stores").select("id, name, status").eq("id", storeId).maybeSingle();
  const { data: planRow } = await admin
    .from("store_plans")
    .select("id, plan_type, monthly_fee, is_active, essencial_upgrade_scheduled_at, essencial_upgrade_notified_at, essencial_upgrade_response, essencial_upgrade_response_at, essencial_lifetime_free, autonomy_lifetime_free, pix_operational_fee_override, platform_delivery_split_override, commission_rate")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle();
  if (!storeRow || !planRow) return json({ error: "Loja ou plano ativo não encontrado.", steps }, 400);
  step("pick_store", true, { store_id: storeId, name: (storeRow as any).name, plan_id: (planRow as any).id });

  const backup = { store: storeRow, plan: planRow };
  const planId = (planRow as any).id;

  try {
    // 2) Reset do estado: modo grátis, ativo, sem VIP, sem upgrade agendado
    await admin
      .from("store_plans")
      .update({
        plan_type: wantedPlan,
        monthly_fee: 0,
        is_active: true,
        essencial_upgrade_scheduled_at: null,
        essencial_upgrade_notified_at: null,
        essencial_upgrade_response: null,
        essencial_upgrade_response_at: null,
        essencial_lifetime_free: false,
        autonomy_lifetime_free: false,
        pix_operational_fee_override: null,
        platform_delivery_split_override: wantedPlan === "autonomy" ? 0 : null,
        commission_rate: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);
    await admin.from("stores").update({ status: "ativo", updated_at: new Date().toISOString() }).eq("id", storeId);
    step("reset_plan_free", true);

    // 3) Injeta pedidos fake acima do threshold (últimos 30d)
    const gmvTarget = threshold + 500;
    const perOrder = Math.max(100, Math.ceil(gmvTarget / 6));
    const nOrders = Math.ceil(gmvTarget / perOrder);
    const now = new Date();
    const rows = Array.from({ length: nOrders }).map((_, i) => ({
      store_id: storeId,
      status: "entregue",
      total_price: perOrder,
      subtotal: perOrder,
      delivery_fee: 0,
      payment_method: "pix",
      metadata: { e2e_marker: MARKER },
      created_at: new Date(now.getTime() - (i + 1) * 24 * 3600_000).toISOString(),
    }));
    const { error: insErr, data: inserted } = await admin.from("orders").insert(rows as any).select("id");
    if (insErr) throw new Error(`insert orders: ${insErr.message}`);
    const injectedIds = (inserted || []).map((o: any) => o.id);
    step("inject_orders", true, { count: injectedIds.length, gmv: perOrder * nOrders });

    // 4) Chama check-essencial-upgrade → deve agendar
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const call = async () => {
      const r = await fetch(`${projectUrl}/functions/v1/check-essencial-upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${NATIVE_SVC}` },
      });
      return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
    };

    const r1 = await call();
    step("check_run_1", r1.ok, r1.body, r1.ok ? undefined : `HTTP ${r1.status}`);

    const { data: after1 } = await admin
      .from("store_plans")
      .select("monthly_fee, essencial_upgrade_scheduled_at, essencial_upgrade_notified_at, essencial_upgrade_response")
      .eq("id", planId)
      .maybeSingle();
    const scheduled = (after1 as any)?.essencial_upgrade_scheduled_at;
    step("assert_scheduled", !!scheduled && Number((after1 as any)?.monthly_fee) === 0, after1,
      scheduled ? undefined : "essencial_upgrade_scheduled_at deveria estar populado");
    if (!scheduled) throw new Error("upgrade não foi agendado após 1ª execução");

    // 5) Simula grace period vencido + aceite do lojista
    const past = new Date(Date.now() - 24 * 3600_000).toISOString();
    await admin
      .from("store_plans")
      .update({
        essencial_upgrade_scheduled_at: past,
        essencial_upgrade_response: "accepted",
        essencial_upgrade_response_at: new Date().toISOString(),
      })
      .eq("id", planId);
    step("backdate_and_accept", true);

    const r2 = await call();
    step("check_run_2", r2.ok, r2.body, r2.ok ? undefined : `HTTP ${r2.status}`);

    const { data: after2 } = await admin
      .from("store_plans")
      .select("monthly_fee, essencial_upgrade_response")
      .eq("id", planId)
      .maybeSingle();
    const newFee = Number((after2 as any)?.monthly_fee);
    step("assert_fee_applied", newFee === expectedFee, after2,
      newFee === expectedFee ? undefined : `monthly_fee=${newFee} != esperado ${expectedFee}`);
    if (newFee !== expectedFee) throw new Error(`fee esperada ${expectedFee}, obtida ${newFee}`);

    return json({
      ok: true,
      plan: wantedPlan,
      store_id: storeId,
      applied_fee: newFee,
      expected_fee: expectedFee,
      threshold,
      steps,
    });
  } catch (e: any) {
    step("flow_error", false, undefined, e?.message);
    return json({ ok: false, error: e?.message || String(e), steps }, 500);
  } finally {
    // 6) Cleanup: sempre roda, mesmo em erro
    try {
      await admin
        .from("orders")
        .delete()
        .eq("store_id", storeId)
        .contains("metadata", { e2e_marker: MARKER });
    } catch (_) { /* noop */ }
    try {
      const b = backup.plan as any;
      await admin
        .from("store_plans")
        .update({
          plan_type: b.plan_type,
          monthly_fee: b.monthly_fee,
          is_active: b.is_active,
          essencial_upgrade_scheduled_at: b.essencial_upgrade_scheduled_at,
          essencial_upgrade_notified_at: b.essencial_upgrade_notified_at,
          essencial_upgrade_response: b.essencial_upgrade_response,
          essencial_upgrade_response_at: b.essencial_upgrade_response_at,
          essencial_lifetime_free: b.essencial_lifetime_free,
          autonomy_lifetime_free: b.autonomy_lifetime_free,
          pix_operational_fee_override: b.pix_operational_fee_override,
          platform_delivery_split_override: b.platform_delivery_split_override,
          commission_rate: b.commission_rate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);
      await admin
        .from("stores")
        .update({ status: (backup.store as any).status, updated_at: new Date().toISOString() })
        .eq("id", storeId);
    } catch (_) { /* noop */ }
  }
});