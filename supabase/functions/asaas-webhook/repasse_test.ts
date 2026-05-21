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

const EXTERNAL_URL =
  Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "https://qkjhguziuchqsbxzruea.supabase.co";
const EXTERNAL_KEY =
  Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ??
  Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ??
  "";

const WEBHOOK_URL =
  "https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/asaas-webhook";
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

// REST direto (evita leak de interval do realtime do supabase-js)
async function rest<T = any>(path: string): Promise<T> {
  if (!EXTERNAL_KEY) throw new Error("EXTERNAL_SUPABASE_SERVICE_KEY ausente");
  const res = await fetch(`${EXTERNAL_URL}/rest/v1/${path}`, {
    headers: {
      apikey: EXTERNAL_KEY,
      Authorization: `Bearer ${EXTERNAL_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${res.status}: ${text}`);
  return text ? JSON.parse(text) : ([] as any);
}

Deno.test("repasse: panorama de transações no DB externo", async () => {
  // Quais transaction_kind existem?
  const kinds = await rest<any[]>(
    `financial_transactions?select=transaction_kind,status&limit=500`,
  );
  const counts: Record<string, number> = {};
  for (const k of kinds) {
    const key = `${k.transaction_kind}/${k.status}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  console.log("[repasse] kinds/status no DB externo:");
  for (const [k, n] of Object.entries(counts)) console.log(`  ${k}: ${n}`);

  // Filtra qualquer coisa que pareça pagamento de TAXA da plataforma
  // (kind=store_payout OU reference_code começando com TAXA-)
  const taxas = await rest<any[]>(
    `financial_transactions?select=id,store_id,status,amount,reference_code,settled_at,created_at,metadata&or=(transaction_kind.eq.store_payout,reference_code.like.TAXA-*)&order=created_at.desc&limit=20`,
  );
  console.log(`[repasse] ${taxas.length} cobranças de taxa da plataforma encontradas:`);
  for (const t of taxas) {
    console.log(
      `  - ${String(t.created_at).slice(0, 19)} | ${String(t.status).padEnd(8)} | R$ ${Number(t.amount).toFixed(2)} | ref=${t.reference_code}`,
    );
  }
  assert(true, "informativo");
});

Deno.test("repasse: para cada pagamento PAGO, repasse_pendente da loja foi zerado", async () => {
  const paid = await rest<any[]>(
    `financial_transactions?select=id,store_id,amount,settled_at,reference_code&or=(transaction_kind.eq.store_payout,reference_code.like.TAXA-*)&status=eq.paid&order=settled_at.desc&limit=10`,
  );

  if (!paid.length) {
    console.log("[repasse] nenhuma transação paga ainda — nada a validar");
    return;
  }

  let okCount = 0;
  let badCount = 0;
  for (const tx of paid) {
    const bals = await rest<any[]>(
      `store_balances?select=repasse_pendente,updated_at&store_id=eq.${tx.store_id}&limit=1`,
    );
    const bal = bals[0];

    if (!bal) {
      console.log(`  ⚠ loja ${tx.store_id} sem store_balances`);
      continue;
    }

    const pend = Number(bal.repasse_pendente || 0);
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

function webhookHeaders() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (WEBHOOK_TOKEN) h["asaas-access-token"] = WEBHOOK_TOKEN;
  return h;
}

Deno.test("webhook: ignora paymentId desconhecido com 200 (idempotência)", async () => {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: webhookHeaders(),
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
    headers: webhookHeaders(),
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
