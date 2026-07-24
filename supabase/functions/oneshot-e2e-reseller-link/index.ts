import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

/**
 * E2E do sistema de link do revendedor.
 * Fluxo:
 *  1) Escolhe um reseller aprovado (por code na query ?code=XXX, senão o mais recente).
 *  2) Cria uma loja fake (referred_by_reseller_id = NULL).
 *  3) Chama reseller_attach_signup(store_id, code)  — igual ao CadastroLojista.
 *  4) Verifica stores.referred_by_reseller_id + reseller_referrals(status=pending).
 *  5) Tenta re-atribuir com OUTRO code (esperado: NÃO sobrescrever — first-touch lock).
 *  6) Executa reseller_process_bounties(_dry_run=true) para validar o cron.
 *  7) Limpa a loja fake criada.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const SVC  = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(URL_, SVC, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const wantCode = (url.searchParams.get("code") || "").toUpperCase();
  const report: any = { steps: [] };
  const log = (k: string, v: any) => report.steps.push({ [k]: v });

  try {
    // 1) Pega reseller aprovado
    let q = db.from("resellers").select("id,code,status,bounty_amount_cents").eq("status","approved").limit(1);
    if (wantCode) q = db.from("resellers").select("id,code,status,bounty_amount_cents").eq("code", wantCode).limit(1);
    const { data: rs, error: e1 } = await q;
    if (e1) throw new Error("select reseller: " + e1.message);
    if (!rs?.length) throw new Error("nenhum reseller aprovado encontrado");
    const reseller = rs[0];
    log("reseller", reseller);

    // Segundo reseller para testar first-touch lock
    const { data: rs2 } = await db.from("resellers").select("id,code").eq("status","approved").neq("id", reseller.id).limit(1);
    const otherCode = rs2?.[0]?.code ?? null;
    log("other_reseller_for_lock_test", rs2?.[0] ?? null);

    // 2) Cria loja fake
    const suffix = Math.random().toString(36).slice(2,8);
    const slug = `e2e-ref-${suffix}`;
    const { data: store, error: e2 } = await db.from("stores").insert({
      name: `E2E Ref ${suffix}`,
      slug,
      status: "ativo",
      is_test: true,
      address_city: "Itatinga",
    }).select("id,slug,referred_by_reseller_id,reseller_locked_at").single();
    if (e2) throw new Error("insert store: " + e2.message);
    log("store_created", store);

    // 3) Chama a MESMA RPC que o CadastroLojista chama
    const { error: e3 } = await db.rpc("reseller_attach_signup", { _store_id: store.id, _code: reseller.code });
    if (e3) throw new Error("reseller_attach_signup: " + e3.message);
    log("attach_called", { code: reseller.code, store_id: store.id });

    // 4) Verifica atribuição
    const { data: sAfter } = await db.from("stores").select("id,referred_by_reseller_id,reseller_locked_at").eq("id", store.id).single();
    const { data: refRow } = await db.from("reseller_referrals").select("*").eq("store_id", store.id).maybeSingle();
    const attached = sAfter?.referred_by_reseller_id === reseller.id && !!sAfter?.reseller_locked_at && refRow?.status === "pending";
    log("after_attach", { store: sAfter, referral: refRow, ok: attached });
    if (!attached) throw new Error("atribuição falhou");

    // 5) First-touch lock: tentar reatribuir com outro código
    let lockOk: any = "sem-segundo-reseller";
    if (otherCode) {
      await db.rpc("reseller_attach_signup", { _store_id: store.id, _code: otherCode });
      const { data: sAfter2 } = await db.from("stores").select("referred_by_reseller_id").eq("id", store.id).single();
      lockOk = sAfter2?.referred_by_reseller_id === reseller.id;
    }
    log("first_touch_lock_ok", lockOk);

    // 6) Bounty cron dry-run
    const { data: bounty, error: e6 } = await db.rpc("reseller_process_bounties", { _dry_run: true });
    log("bounty_cron_dry_run", { error: e6?.message ?? null, result: bounty });

    // 7) Cleanup
    await db.from("reseller_referrals").delete().eq("store_id", store.id);
    await db.from("stores").delete().eq("id", store.id);
    log("cleanup", "ok");

    report.ok = true;
    report.summary = {
      link_format: `${url.origin.replace(/\/functions.*/, "")}/cadastro-lojista?ref=${reseller.code}`,
      attribution_worked: attached,
      first_touch_lock_worked: lockOk,
      bounty_cron_callable: !e6,
    };
  } catch (e: any) {
    report.ok = false;
    report.error = e?.message ?? String(e);
  }
  return new Response(JSON.stringify(report, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});