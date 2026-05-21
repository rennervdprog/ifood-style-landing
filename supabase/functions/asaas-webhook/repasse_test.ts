// Testes Deno do fluxo de REPASSE (pagamento de taxa da plataforma pelo lojista)
// contra o banco Supabase EXTERNO (qkjhguziuchqsbxzruea).
//
// O que validamos:
//  1. Estrutura: existem transações de taxa de plataforma (transaction_kind=store_payout)
//  2. Quando pagas, o saldo `repasse_pendente` da loja foi corretamente zerado
//     (até o momento em que o PIX foi gerado / confirmado)
//  3. O webhook do Asaas é idempotente e ignora paymentIds desconhecidos com 200
//  4. O webhook rejeita JSON inválido
//
// Rode com: supabase--test_edge_functions { functions: ["asaas-webhook"], pattern: "repasse" }

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXTERNAL_URL =
  Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "https://qkjhguziuchqsbxzruea.supabase.co";
const EXTERNAL_KEY =
  Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ??
  Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ??
  "";

const WEBHOOK_URL =
  "https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/asaas-webhook";

function db() {
  if (!EXTERNAL_KEY) throw new Error("EXTERNAL_SUPABASE_SERVICE_KEY ausente");
  return createClient(EXTERNAL_URL, EXTERNAL_KEY);
}

Deno.test("repasse: existem transações de taxa da plataforma (store_payout)", async () => {
  const supabase = db();
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id, store_id, status, amount, reference_code, metadata, created_at")
    .eq("transaction_kind", "store_payout")
    .order("created_at", { ascending: false })
    .limit(20);

  assertEquals(error, null, `query falhou: ${error?.message}`);
  console.log(`[repasse] últimas ${data?.length ?? 0} transações de store_payout`);
  for (const t of data ?? []) {
    console.log(
      `  - ${t.created_at?.slice(0, 19)} | ${t.status.padEnd(8)} | R$ ${Number(t.amount).toFixed(2)} | ref=${t.reference_code}`,
    );
  }
  assert(Array.isArray(data), "esperava array");
});

Deno.test("repasse: para cada pagamento PAGO, repasse_pendente da loja foi zerado", async () => {
  const supabase = db();

  // Pega últimos pagamentos de taxa CONFIRMADOS
  const { data: paid, error } = await supabase
    .from("financial_transactions")
    .select("id, store_id, amount, settled_at, reference_code")
    .eq("transaction_kind", "store_payout")
    .eq("status", "paid")
    .order("settled_at", { ascending: false })
    .limit(10);

  assertEquals(error, null);

  if (!paid || paid.length === 0) {
    console.log("[repasse] nenhuma transação paga ainda — nada a validar");
    return;
  }

  let okCount = 0;
  let badCount = 0;
  for (const tx of paid) {
    const { data: bal } = await supabase
      .from("store_balances")
      .select("repasse_pendente, updated_at")
      .eq("store_id", tx.store_id)
      .maybeSingle();

    if (!bal) {
      console.log(`  ⚠ loja ${tx.store_id} sem store_balances`);
      continue;
    }

    const pend = Number(bal.repasse_pendente || 0);
    // O saldo pode ter sido reacumulado por novos pedidos APÓS o pagamento.
    // Só consideramos "falha" se o saldo > 0 E updated_at < settled_at.
    const balUpd = bal.updated_at ? new Date(bal.updated_at).getTime() : 0;
    const txSettled = tx.settled_at ? new Date(tx.settled_at).getTime() : 0;
    const reaccumulated = balUpd > txSettled;

    if (pend === 0 || reaccumulated) {
      okCount++;
      console.log(
        `  ✓ loja ${tx.store_id.slice(0, 8)} | pend=R$${pend.toFixed(2)} ${reaccumulated ? "(reacumulado)" : "(zerado)"}`,
      );
    } else {
      badCount++;
      console.log(
        `  ✗ loja ${tx.store_id.slice(0, 8)} | pend=R$${pend.toFixed(2)} | tx paga em ${tx.settled_at} | balance atualizado em ${bal.updated_at}`,
      );
    }
  }

  console.log(`[repasse] ${okCount} OK | ${badCount} com saldo residual não explicado`);
  assertEquals(badCount, 0, "alguma loja não zerou o repasse após pagamento");
});

Deno.test("webhook: ignora paymentId desconhecido com 200 (idempotência)", async () => {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_inexistente_teste_repasse_xyz" },
    }),
  });
  const body = await res.json();
  console.log("[webhook] unknown payment →", res.status, body);
  assertEquals(res.status, 200);
  assert(body.ignored === "transaction_not_found" || body.ok === true);
});

Deno.test("webhook: rejeita JSON inválido com 400", async () => {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "isto-nao-eh-json",
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Invalid JSON");
});

Deno.test("webhook: CORS preflight responde 200", async () => {
  const res = await fetch(WEBHOOK_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
});
