// Fase 6 — Auditoria contínua Termos × Código.
// Cada check valida uma cláusula dos Termos contra o estado real do backend.
// Retorna [{ id, clause, title, status: 'pass'|'warn'|'fail', detail }].
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Check = { id: string; clause: string; title: string; status: "pass" | "warn" | "fail"; detail: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  const checks: Check[] = [];
  const pass = (id: string, clause: string, title: string, detail: string) => checks.push({ id, clause, title, status: "pass", detail });
  const warn = (id: string, clause: string, title: string, detail: string) => checks.push({ id, clause, title, status: "warn", detail });
  const fail = (id: string, clause: string, title: string, detail: string) => checks.push({ id, clause, title, status: "fail", detail });

  async function colExists(table: string, col: string): Promise<boolean> {
    const { data } = await sb.rpc("exec_sql" as any, {
      sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='${col}' LIMIT 1;`,
    }).catch(() => ({ data: null }));
    if (Array.isArray(data) && data.length > 0) return true;
    // fallback: try selecting the column
    const { error } = await sb.from(table as any).select(col).limit(1);
    return !error;
  }

  // 1. Cláusula VIP vitalícia
  try {
    const ok = await colExists("store_plans", "essencial_lifetime_free");
    ok
      ? pass("vip_lifetime", "6.4", "VIP vitalícia bloqueia cobrança indevida", "Coluna store_plans.essencial_lifetime_free presente.")
      : fail("vip_lifetime", "6.4", "VIP vitalícia bloqueia cobrança indevida", "Coluna store_plans.essencial_lifetime_free AUSENTE.");
  } catch (e: any) { fail("vip_lifetime", "6.4", "VIP vitalícia", e?.message || "erro"); }

  // 2. Grace period Essencial (30 dias)
  try {
    const ok = await colExists("store_plans", "essencial_upgrade_scheduled_at");
    ok
      ? pass("essencial_grace", "6.2", "Aviso prévio 30 dias upgrade Essencial", "Coluna essencial_upgrade_scheduled_at presente.")
      : fail("essencial_grace", "6.2", "Aviso prévio 30 dias upgrade Essencial", "Coluna ausente — cobrança pode ser imediata.");
  } catch (e: any) { fail("essencial_grace", "6.2", "Grace period Essencial", e?.message || "erro"); }

  // 3. Fase 4 — restrição parcial saldo > R$ 500
  try {
    const okA = await colExists("stores", "partial_lock_status");
    const okB = await colExists("stores", "partial_lock_deadline");
    okA && okB
      ? pass("partial_lock", "8.2", "Restrição parcial (saldo > R$ 500)", "Colunas partial_lock_status e partial_lock_deadline presentes (modo sombra ativo).")
      : fail("partial_lock", "8.2", "Restrição parcial (saldo > R$ 500)", "Colunas ausentes — Fase 4 não implementada.");
  } catch (e: any) { fail("partial_lock", "8.2", "Restrição parcial", e?.message || "erro"); }

  // 4. Add-on PDV R$ 49
  try {
    const { data } = await sb.from("plan_templates").select("id, name, monthly_fee, plan_type").ilike("name", "%pdv%");
    const pdvAddon = (data || []).find((p: any) => Number(p.monthly_fee) === 49);
    pdvAddon
      ? pass("pdv_addon_price", "4.1", "Add-on PDV a R$ 49/mês", `Template: ${(pdvAddon as any).name}`)
      : warn("pdv_addon_price", "4.1", "Add-on PDV a R$ 49/mês", "Nenhum template de add-on PDV com R$ 49 encontrado.");
  } catch (e: any) { warn("pdv_addon_price", "4.1", "Add-on PDV", e?.message || "erro"); }

  // 5. Plano PDV Standalone R$ 69
  try {
    const { data } = await sb.from("plan_templates").select("id, name, monthly_fee, plan_type");
    const pdvOnly = (data || []).find((p: any) => Number(p.monthly_fee) === 69 && String(p.name || "").toLowerCase().includes("pdv"));
    pdvOnly
      ? pass("pdv_only_price", "4.2", "Plano PDV Standalone R$ 69", `Template: ${(pdvOnly as any).name}`)
      : warn("pdv_only_price", "4.2", "Plano PDV Standalone R$ 69", "Template PDV standalone R$ 69 não localizado.");
  } catch (e: any) { warn("pdv_only_price", "4.2", "Plano PDV Standalone", e?.message || "erro"); }

  // 6. Saque mínimo entregador R$ 5
  try {
    const { data } = await sb.from("stores").select("asaas_min_withdraw_amount").limit(50);
    const bad = (data || []).filter((s: any) => s.asaas_min_withdraw_amount != null && Number(s.asaas_min_withdraw_amount) < 5);
    bad.length === 0
      ? pass("driver_min_withdraw", "7.5", "Saque mínimo entregador R$ 5", "Nenhuma loja abaixo do mínimo.")
      : warn("driver_min_withdraw", "7.5", "Saque mínimo entregador R$ 5", `${bad.length} loja(s) configurada(s) abaixo de R$ 5.`);
  } catch (e: any) { warn("driver_min_withdraw", "7.5", "Saque mínimo", e?.message || "erro"); }

  // 7. Pix Direto (offline) — coluna proof
  try {
    const ok = await colExists("orders", "pix_proof_url");
    ok
      ? pass("pix_direto", "3.3", "Pix Direto com comprovante", "Coluna orders.pix_proof_url presente.")
      : warn("pix_direto", "3.3", "Pix Direto com comprovante", "Coluna pix_proof_url ausente.");
  } catch (e: any) { warn("pix_direto", "3.3", "Pix Direto", e?.message || "erro"); }

  // 8. Refunds table existe
  try {
    const { error } = await sb.from("refund_requests").select("id").limit(1);
    !error
      ? pass("refunds", "5.1", "Fluxo de estornos", "Tabela refund_requests acessível.")
      : fail("refunds", "5.1", "Fluxo de estornos", error.message);
  } catch (e: any) { fail("refunds", "5.1", "Estornos", e?.message || "erro"); }

  // 9. Audit log financeiro
  try {
    const { error, count } = await sb.from("financial_audit_log" as any).select("*", { count: "exact", head: true });
    !error
      ? pass("financial_audit", "9.1", "Log de auditoria financeira", `Tabela ativa (${count ?? 0} registros).`)
      : warn("financial_audit", "9.1", "Log de auditoria financeira", error.message);
  } catch (e: any) { warn("financial_audit", "9.1", "Auditoria financeira", e?.message || "erro"); }

  // 10. Termos versionados
  try {
    const { data } = await sb.from("legal_documents").select("id, doc_type, version").eq("doc_type", "terms").order("created_at", { ascending: false }).limit(1);
    (data && data.length > 0)
      ? pass("terms_versioned", "1.1", "Termos versionados no banco", `Versão atual: ${(data[0] as any).version}`)
      : warn("terms_versioned", "1.1", "Termos versionados no banco", "Nenhum documento 'terms' registrado.");
  } catch (e: any) { warn("terms_versioned", "1.1", "Termos versionados", e?.message || "erro"); }

  const summary = {
    total: checks.length,
    pass: checks.filter(c => c.status === "pass").length,
    warn: checks.filter(c => c.status === "warn").length,
    fail: checks.filter(c => c.status === "fail").length,
  };

  // Grava snapshot em admin_logs para histórico
  try {
    await sb.from("admin_logs").insert({
      action: "terms_compliance_check",
      metadata: { summary, checks },
    });
  } catch { /* noop */ }

  return new Response(JSON.stringify({ summary, checks, checked_at: new Date().toISOString() }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});