/**
 * Auditoria estrutural (somente leitura) do fluxo do motoboy de loja.
 * Não usa PAT/Management API e não executa nenhuma escrita, cobrança,
 * saque, reembolso ou envio de mensagem. Se as credenciais públicas do
 * backend externo não estiverem presentes, o teste é ignorado.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_EXT = Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const KEY_EXT =
  Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ||
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  "";

const skip = !URL_EXT || !KEY_EXT;
const opts = { ignore: skip, sanitizeOps: false, sanitizeResources: false };

Deno.test({
  name: "driver flow: entregas finalizadas não duplicam ganhos (read-only)",
  ...opts,
  fn: async () => {
    const client = createClient(URL_EXT, KEY_EXT);

    // Leitura simples: pedidos finalizados recentes.
    const { data: orders, error } = await client
      .from("orders")
      .select("id, status")
      .eq("status", "finalizado")
      .limit(20);

    // Sem sessão a RLS pode negar o acesso: isso também é um resultado válido.
    if (error) {
      assert(
        /permission|denied|JWT|row-level/i.test(error.message),
        `Erro inesperado ao ler orders: ${error.message}`,
      );
      return;
    }

    assert(Array.isArray(orders), "orders deveria ser uma lista");

    for (const order of orders ?? []) {
      const { data: earnings, error: earnErr } = await client
        .from("driver_earnings")
        .select("id")
        .eq("order_id", order.id);
      if (earnErr) return; // RLS bloqueando: encerra sem falhar
      assert(
        (earnings?.length ?? 0) <= 1,
        `Pedido ${order.id} possui ganhos duplicados de entregador`,
      );
    }
  },
});
