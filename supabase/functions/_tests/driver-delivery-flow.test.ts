/**
 * Auditoria do fluxo do motoboy de loja no backend externo.
 * Roda tudo dentro de transação com rollback: não altera dados reais.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "";
const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN") || "";
const skip = !REF || !PAT;
const opts = { ignore: skip, sanitizeOps: false, sanitizeResources: false };

async function runSql(query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* noop */ }
  return { ok: res.ok, status: res.status, data };
}

Deno.test({ name: "driver flow: Silvio aceita e finaliza Pastelão sem duplicar", ...opts, fn: async () => {
  const orderId = crypto.randomUUID();
  const sql = `
    BEGIN;
    SET LOCAL request.jwt.claim.sub = '894b5898-9665-49bc-b67f-9fa495351f5c';

    INSERT INTO public.orders (
      id, client_id, store_id, status, subtotal, delivery_fee, total_price,
      payment_method, neighborhood, address_details, assigned_driver_id, delivery_pin
    ) VALUES (
      '${orderId}'::uuid,
      'a5248d00-2cbe-432a-8bb0-d6f60e734e7b'::uuid,
      'b97f3a1a-d558-41e5-b8a2-ebd65b5381b4'::uuid,
      'pronto_para_entrega', 7, 3, 10, 'dinheiro', 'Centro', 'Teste rollback',
      '894b5898-9665-49bc-b67f-9fa495351f5c'::uuid, '0605'
    );

    SELECT public.driver_accept_order('${orderId}'::uuid);
    SELECT public.driver_finish_delivery('${orderId}'::uuid, '0605');

    SELECT
      o.status,
      o.driver_id::text,
      (SELECT count(*)::int FROM public.driver_earnings de WHERE de.order_id = o.id) AS driver_earnings_count,
      (SELECT count(*)::int FROM public.store_driver_earnings sde WHERE sde.order_id = o.id) AS store_driver_earnings_count
    FROM public.orders o
    WHERE o.id = '${orderId}'::uuid;

    ROLLBACK;
  `;

  const result = await runSql(sql);
  assert(result.ok, JSON.stringify(result.data));
  const rows = result.data as Array<Record<string, unknown>>;
  const row = rows.at(-1)!;
  assertEquals(row.status, "finalizado");
  assertEquals(row.driver_id, "894b5898-9665-49bc-b67f-9fa495351f5c");
  assertEquals(row.driver_earnings_count, 1);
  assertEquals(row.store_driver_earnings_count, 1);
}});
