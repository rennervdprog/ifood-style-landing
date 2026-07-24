import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

/**
 * E2E COMPLETO do sistema de link do revendedor.
 * Cenários testados (todos com loja fake, cleanup no final):
 *   1) Atribuição via ?ref=CODE (mesma RPC do CadastroLojista).
 *   2) First-touch lock (loja não muda de dono).
 *   3) Bounty cron (dry-run).
 *   4) RECORRENTE — enquanto loja está ativa e paga plano, revendedor recebe % todo mês.
 *   5) CANCELAMENTO — quando loja é cancelada/suspensa, comissão do próximo mês NÃO é gerada.
 *   6) Idempotência — rodar o cron 2x no mesmo mês não paga em dobro.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const SVC  = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(URL_, SVC, { auth: { persistSession: false } });
  const report: any = { link_oficial: "https://itasuper.com.br/cadastro-lojista?ref=CODIGO", steps: [] };
  const log = (k: string, v: any) => report.steps.push({ [k]: v });
  let storeId: string | null = null;
  let resellerId: string | null = null;
  const refMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    // ---------- Setup ----------
    const { data: rs } = await db.from("resellers").select("id,code,status,commission_rate,bounty_amount_cents").eq("status","approved").limit(1);
    if (!rs?.length) throw new Error("nenhum reseller aprovado");
    const reseller = rs[0]; resellerId = reseller.id;
    log("reseller", reseller);

    const suffix = Math.random().toString(36).slice(2,8);
    const { data: store, error: eStore } = await db.from("stores").insert({
      name: `E2E Ref ${suffix}`, slug: `e2e-ref-${suffix}`,
      status: "ativo", is_test: true, address_city: "Itatinga",
    }).select("id,slug,status").single();
    if (eStore) throw new Error("insert store: " + eStore.message);
    storeId = store.id;
    log("store_created", store);

    // ---------- 1) Atribuição via link ----------
    const { error: eAttach } = await db.rpc("reseller_attach_signup", { _store_id: storeId, _code: reseller.code });
    if (eAttach) throw new Error("attach: " + eAttach.message);
    const { data: sAfter } = await db.from("stores").select("referred_by_reseller_id,reseller_locked_at").eq("id", storeId).single();
    const { data: refRow } = await db.from("reseller_referrals").select("*").eq("store_id", storeId).maybeSingle();
    const attachOk = sAfter?.referred_by_reseller_id === reseller.id && refRow?.status === "pending";
    log("1_atribuicao_link", { ok: attachOk, store: sAfter, referral: refRow });

    // ---------- 2) First-touch lock (tenta reatribuir com código fake) ----------
    try { await db.rpc("reseller_attach_signup", { _store_id: storeId, _code: "FAKE_INEXISTENTE" }); } catch {}
    const { data: sLock } = await db.from("stores").select("referred_by_reseller_id").eq("id", storeId).single();
    log("2_first_touch_lock", { ok: sLock?.referred_by_reseller_id === reseller.id });

    // ---------- 3) Bounty cron (dry-run) ----------
    const { data: bounty, error: eB } = await db.rpc("reseller_process_bounties", { _dry_run: true });
    log("3_bounty_cron_dry_run", { ok: !eB, result: bounty });

    // ---------- Preparar cenário para RECORRENTE ----------
    // Ativar a referral manualmente (simulando que o bounty já promoveu)
    await db.from("reseller_referrals").update({ status: "active", activated_at: new Date().toISOString() }).eq("store_id", storeId);

    // Criar/garantir store_plans com plano pago vigente neste mês
    const now = new Date().toISOString();
    const { error: eSP } = await db.from("store_plans").upsert({
      store_id: storeId,
      plan_type: "essencial",
      monthly_fee: 89.90,
      is_active: true,
      last_billed_at: now,
      next_billing_at: new Date(Date.now() + 30*86400000).toISOString(),
    }, { onConflict: "store_id" });
    if (eSP) log("store_plans_upsert_error", eSP.message);

    // ---------- 4) RECORRENTE — loja ativa deve gerar comissão mensal ----------
    const { data: dryRec } = await db.rpc("reseller_process_recurring", { _ref_month: refMonth, _dry_run: true });
    log("4a_recurring_dry_run", dryRec);

    const { data: runRec } = await db.rpc("reseller_process_recurring", { _ref_month: refMonth, _dry_run: false });
    log("4b_recurring_run", runRec);

    const { data: comm } = await db.from("reseller_commissions")
      .select("type,amount_cents,status,reference_month,metadata")
      .eq("store_id", storeId).eq("type","recurring");
    const expectedCents = Math.round((reseller.commission_rate ?? 0.2) * 89.90 * 100);
    const recurringOk = comm?.length === 1 && comm[0].amount_cents === expectedCents;
    log("4c_verificacao_recorrente", {
      ok: recurringOk,
      esperado_centavos: expectedCents,
      recebido: comm,
      calc: `${reseller.commission_rate} * R$89,90 = R$${(expectedCents/100).toFixed(2)}`,
    });

    // ---------- 6) Idempotência: rodar de novo NÃO deve duplicar ----------
    const { data: runRec2 } = await db.rpc("reseller_process_recurring", { _ref_month: refMonth, _dry_run: false });
    const { data: comm2 } = await db.from("reseller_commissions").select("id").eq("store_id", storeId).eq("type","recurring").eq("reference_month", refMonth);
    log("6_idempotencia", { second_run: runRec2, total_rows: comm2?.length, ok: comm2?.length === 1 });

    // ---------- 5) CANCELAMENTO — loja cancelada NÃO deve gerar mais comissão ----------
    // Simular MÊS SEGUINTE cancelando a loja e rodando o cron do próximo mês
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextRef = nextMonth.toISOString().slice(0, 7);

    // Atualizar plano para "faturado no mês seguinte" (simulando cobrança normal)
    const nextStart = new Date(nextRef + "-05T12:00:00Z").toISOString();
    await db.from("store_plans").update({ last_billed_at: nextStart, is_active: true }).eq("store_id", storeId);

    // (a) Loja AINDA ativa: deve haver candidato
    const { data: dryNextActive } = await db.rpc("reseller_process_recurring", { _ref_month: nextRef, _dry_run: true });
    log("5a_mes_seguinte_loja_ativa", { candidatos: (dryNextActive as any)?.candidates?.length ?? 0, expected: 1 });

    // (b) CANCELAR loja e rodar de novo: 0 candidatos
    await db.from("stores").update({ status: "cancelled" }).eq("id", storeId);
    const { data: dryNextCancel } = await db.rpc("reseller_process_recurring", { _ref_month: nextRef, _dry_run: true });
    const cancelOk = ((dryNextCancel as any)?.candidates?.length ?? -1) === 0;
    log("5b_mes_seguinte_loja_cancelada", { ok: cancelOk, candidatos: (dryNextCancel as any)?.candidates?.length, resultado: dryNextCancel });

    // (c) Também testa is_active=false do plano (churn do plano)
    await db.from("stores").update({ status: "ativo" }).eq("id", storeId);
    await db.from("store_plans").update({ is_active: false }).eq("store_id", storeId);
    const { data: dryPlanOff } = await db.rpc("reseller_process_recurring", { _ref_month: nextRef, _dry_run: true });
    log("5c_plano_desativado", { ok: ((dryPlanOff as any)?.candidates?.length ?? -1) === 0, resultado: dryPlanOff });

    // ---------- Sumário ----------
    report.summary = {
      link_oficial: `https://itasuper.com.br/cadastro-lojista?ref=${reseller.code}`,
      "1_atribuicao_por_link": attachOk,
      "2_first_touch_lock": sLock?.referred_by_reseller_id === reseller.id,
      "3_bounty_cron_ativo": !eB,
      "4_recorrente_paga_enquanto_ativa": recurringOk,
      "5_cancelamento_para_comissao": cancelOk,
      "6_idempotencia_sem_duplicar": comm2?.length === 1,
    };
    report.ok = Object.values(report.summary).every(v => v === true || typeof v === "string");
  } catch (e: any) {
    report.ok = false;
    report.error = e?.message ?? String(e);
  } finally {
    // Cleanup total
    if (storeId) {
      await db.from("reseller_commissions").delete().eq("store_id", storeId);
      await db.from("reseller_referrals").delete().eq("store_id", storeId);
      await db.from("store_plans").delete().eq("store_id", storeId);
      await db.from("stores").delete().eq("id", storeId);
    }
  }
  return new Response(JSON.stringify(report, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});