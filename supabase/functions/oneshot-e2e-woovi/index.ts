// E2E: seletor de gateway (super admin) + fluxo Woovi (mensalidade e repasse semanal).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const EXT_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
const APP_ID = Deno.env.get("WOOVI_APP_ID") || "";

type Step = { name: string; pass: boolean; info?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(EXT_URL, EXT_KEY);
  const steps: Step[] = [];
  const add = (name: string, pass: boolean, info?: unknown) => steps.push({ name, pass, info });

  const readGw = async () => {
    const { data } = await db.from("admin_settings").select("value").eq("key", "payment_gateway").maybeSingle();
    return String((data?.value as any)?.provider || "ASAAS").toUpperCase();
  };
  const setGw = async (p: string) => {
    const { error } = await db.from("admin_settings").upsert({ key: "payment_gateway", value: { provider: p } }, { onConflict: "key" });
    return error?.message || null;
  };

  const original = await readGw();
  add("1. Ler gateway atual", true, original);

  for (const gw of ["ASAAS", "WOOVI", "ABACATEPAY", "WOOVI"]) {
    const err = await setGw(gw);
    const now = await readGw();
    add(`2. Trocar para ${gw}`, !err && now === gw, { err, persisted: now });
  }

  // 3. Funções externas contêm branch Woovi
  for (const fn of ["subscribe-plan-payment", "store-platform-fee-pix", "payment-router", "woovi-webhook"]) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/${fn}/body`, { headers: { Authorization: `Bearer ${PAT}` } });
    const body = r.ok ? await r.text() : "";
    add(`3. ${fn} deployada com Woovi`, r.ok && (fn === "woovi-webhook" ? body.length > 100 : /woovi/i.test(body)), { status: r.status, len: body.length });
  }

  // 4. Credencial Woovi válida + criação de cobrança (mensalidade e repasse semanal)
  const created: any[] = [];
  for (const c of [
    { kind: "mensalidade", value: 8900, comment: "E2E Mensalidade Plano Essencial" },
    { kind: "repasse_semanal", value: 17800, comment: "E2E Repasse semanal plataforma" },
  ]) {
    const corr = `E2E-${c.kind}-${crypto.randomUUID().slice(0, 8)}`;
    const r = await fetch("https://api.woovi.com/api/v1/charge", {
      method: "POST",
      headers: { Authorization: APP_ID, "Content-Type": "application/json" },
      body: JSON.stringify({ correlationID: corr, value: c.value, comment: c.comment }),
    });
    const j = await r.json().catch(() => ({}));
    const brCode = j?.charge?.brCode || j?.brCode;
    add(`4. Woovi cria cobrança ${c.kind} (R$ ${(c.value / 100).toFixed(2)})`, r.ok && !!brCode, {
      status: r.status, corr, id: j?.charge?.identifier, brCode: brCode ? String(brCode).slice(0, 40) + "..." : j?.error,
    });
    if (brCode) created.push({ corr, id: j?.charge?.identifier, value: c.value, kind: c.kind });
  }

  // 5. Webhook confirma pagamento (mensalidade + repasse) — idempotência incluída
  const { data: store } = await db.from("stores").select("id, name").ilike("name", "%Ric%").limit(1).maybeSingle();
  const secret = Deno.env.get("WOOVI_WEBHOOK_SECRET") || "";
  for (const c of created) {
    const prefix = c.kind === "mensalidade" ? "#MENS-" : "#REP-";
    const ref = `${prefix}${c.corr}`;
    const ins = await db.from("financial_transactions").insert({
      store_id: store?.id,
      transaction_kind: "commission_charge",
      amount: c.value / 100,
      reference_code: ref,
      status: "pending",
      provider: "woovi",
      mercado_pago_payment_id: c.id,
      metadata: { type: c.kind === "mensalidade" ? "plan_subscription" : "platform_fee", e2e: true },
    }).select("id").maybeSingle();
    if (ins.error) { add(`5. tx ${c.kind} criada`, false, ins.error.message); continue; }

    const hookUrl = `${EXT_URL}/functions/v1/woovi-webhook${secret ? `?webhookSecret=${secret}` : ""}`;
    const payload = { event: "OPENPIX:CHARGE_COMPLETED", charge: { correlationID: ref, identifier: c.id, status: "COMPLETED", value: c.value } };
    const h1 = await fetch(hookUrl, { method: "POST", headers: { "Content-Type": "application/json", apikey: EXT_KEY, Authorization: `Bearer ${EXT_KEY}` }, body: JSON.stringify(payload) });
    const b1 = await h1.text();
    const { data: after } = await db.from("financial_transactions").select("status").eq("id", ins.data!.id).maybeSingle();
    add(`5. Webhook confirma ${c.kind}`, h1.ok && after?.status === "paid", { status: h1.status, body: b1.slice(0, 200), tx_status: after?.status });

    const h2 = await fetch(hookUrl, { method: "POST", headers: { "Content-Type": "application/json", apikey: EXT_KEY, Authorization: `Bearer ${EXT_KEY}` }, body: JSON.stringify(payload) });
    const b2 = await h2.text();
    add(`6. Idempotência webhook ${c.kind}`, h2.ok && /idempotent/.test(b2), { body: b2.slice(0, 160) });

    await db.from("financial_transactions").delete().eq("id", ins.data!.id);
  }

  // 7. Restaura gateway escolhido pelo usuário
  await setGw(original === "WOOVI" ? "WOOVI" : original);
  add("7. Gateway restaurado", (await readGw()) === original, original);

  const passed = steps.filter((s) => s.pass).length;
  return new Response(JSON.stringify({ passed, total: steps.length, steps }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
