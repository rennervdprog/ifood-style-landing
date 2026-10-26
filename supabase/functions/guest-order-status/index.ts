// Consulta pública do status do pedido guest.
// GET ?order_id=<uuid>&last4=<últimos 4 do telefone>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*", "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (b: unknown, s = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", ...extraHeaders } });

const makePin = () => String(Math.floor(1000 + Math.random() * 9000));

// Fase 5 — rate limit no rastreio público (P1-3, decisão (d) do plano):
// mais de 10 tentativas erradas em 10 min para o mesmo pedido → 429;
// mais de 30 tentativas erradas em 10 min para o mesmo IP → 429.
// O últimos-4 CORRETO sempre passa: a trava é só contra adivinhação, então
// a checagem do limite só roda quando o últimos-4 está errado (o critério
// de aceite do plano é "últimos-4 corretos continuam funcionando").
// Os contadores vivem em guest_tracking_attempts (migration 20261026060000);
// a própria função apaga registros com mais de 1 dia. As decisões puras
// (limites e janela) estão espelhadas em src/lib/trackingRateLimit.ts, com
// testes em Vitest — a edge é autocontida e não importa o lib (o deploy
// não sobe subdiretórios).
const TEST_STORE_ID = "8197bdd8-f041-410d-acc0-af9ecb448f55";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_WRONG_PER_ORDER = 10;
const MAX_WRONG_PER_IP = 30;
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

const clientIp = (req: Request): string | null => {
  const raw = req.headers.get("x-forwarded-for") || "";
  const first = raw.split(",")[0]?.trim() || "";
  return first ? first.slice(0, 45) : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = new URL(req.url);
    const orderId = (url.searchParams.get("order_id") || "").trim();
    const last4 = (url.searchParams.get("last4") || "").replace(/\D/g, "");
    if (!orderId || last4.length !== 4) return json({ error: "invalid_params" }, 400);

    const sb = createClient(
      (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
      (
        Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
        Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      )!,
      { auth: { persistSession: false } },
    );

    // Limpeza (best-effort, nunca trava a consulta): apaga registros com
    // mais de 1 dia.
    try {
      await sb.from("guest_tracking_attempts")
        .delete()
        .lt("attempted_at", new Date(Date.now() - ATTEMPT_RETENTION_MS).toISOString());
    } catch (e) {
      console.error("[guest-order-status] cleanup error:", e);
    }

    const { data: order } = await sb.from("orders")
      .select("id, client_id, status, total_price, subtotal, delivery_fee, payment_method, address_details, neighborhood, created_at, store_id, is_guest, delivery_pin, pix_expires_at, pix_proof_url, pix_refused_reason, pix_proof_uploaded_at")
      .eq("id", orderId).maybeSingle();
    if (!order || !(order as any).is_guest) return json({ error: "not_found" }, 404);

    // Cópia de teste (`guest-order-status-teste`): allowlist no topo — só
    // pedidos da loja de teste. Qualquer outro pedido é recusado com 403.
    // O modo teste é detectado pela URL de invocação, então o código é o
    // mesmo nos dois deploys.
    const isTestFunction = new URL(req.url).pathname.endsWith("-teste");
    if (isTestFunction && (order as any).store_id !== TEST_STORE_ID) {
      return json({ error: "test_function_allowlist" }, 403);
    }

    const [{ data: guest }, { data: profile }] = await Promise.all([
      sb.from("guest_customers")
        .select("phone, name").eq("user_id", (order as any).client_id).maybeSingle(),
      sb.from("profiles")
        .select("phone, full_name, delivery_pin").eq("user_id", (order as any).client_id).maybeSingle(),
    ]);
    const customerPhone = String((guest as any)?.phone || (profile as any)?.phone || "");
    const customerName = (guest as any)?.name || (profile as any)?.full_name || null;
    const ip = clientIp(req);

    const recordAttempt = async (ok: boolean) => {
      try {
        await sb.from("guest_tracking_attempts").insert({ order_id: orderId, ok, ip } as any);
      } catch (e) {
        // Nunca trava a consulta por causa da auditoria.
        console.error("[guest-order-status] record attempt error:", e);
      }
    };

    const wrongInWindow = async (column: "order_id" | "ip", value: string): Promise<number> => {
      try {
        const { count, error } = await sb.from("guest_tracking_attempts")
          .select("id", { count: "exact", head: true })
          .eq(column, value)
          .eq("ok", false)
          .gt("attempted_at", new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString());
        if (error) {
          console.error("[guest-order-status] rate limit count error:", error);
          return 0;
        }
        return count ?? 0;
      } catch (e) {
        console.error("[guest-order-status] rate limit count error:", e);
        return 0;
      }
    };

    if (!customerPhone || customerPhone.slice(-4) !== last4) {
      // Últimos-4 errado: checa o limite ANTES de registrar. Com 10
      // erradas já registradas, esta é a 11ª e volta 429 (critério de
      // aceite do plano). O 429 não registra nada — o contador só anda
      // com tentativa errada de verdade.
      if ((await wrongInWindow("order_id", orderId)) >= MAX_WRONG_PER_ORDER) {
        return json({ error: "rate_limited" }, 429, { "Retry-After": "600" });
      }
      if (ip && (await wrongInWindow("ip", ip)) >= MAX_WRONG_PER_IP) {
        return json({ error: "rate_limited" }, 429, { "Retry-After": "600" });
      }
      await recordAttempt(false);
      return json({ error: "not_found" }, 404);
    }

    // Fix do rastreio: o select antigo pedia `whatsapp_number` em `stores`,
    // coluna que NÃO existe — o PostgREST devolvia 400 (42703), o select
    // inteiro falhava e `store` voltava null (a página mostrava "Loja" como
    // nome e a seção Pix vazia). O número de WhatsApp da loja vive em
    // `store_whatsapp_config.phone_number` (o número conectado como WhatsApp
    // da loja); sem WhatsApp conectado, `whatsapp_number` é null e o front
    // só esconde o botão "Falar com a loja" (nome e Pix continuam vindo).
    // Espelho testado em src/lib/trackingStore.ts.
    const [{ data: storeRow }, { data: items }, { data: wcfg }] = await Promise.all([
      sb.from("stores")
        .select("name, slug, pix_direto_enabled, pix_direto_key, pix_direto_key_type, pix_direto_beneficiary, pix_direto_instructions").eq("id", (order as any).store_id).maybeSingle(),
      sb.from("order_items")
        .select("quantity, unit_price, products(name)").eq("order_id", orderId),
      sb.from("store_whatsapp_config")
        .select("phone_number").eq("store_id", (order as any).store_id).maybeSingle(),
    ]);
    const store = storeRow
      ? { ...storeRow, whatsapp_number: (wcfg as any)?.phone_number ?? null }
      : null;

    let deliveryPin = (order as any)?.delivery_pin || (profile as any)?.delivery_pin || null;
    if (!deliveryPin) {
      deliveryPin = makePin();
      const [{ error: orderPinErr }, { error: profilePinErr }] = await Promise.all([
        sb.from("orders").update({ delivery_pin: deliveryPin } as any).eq("id", orderId),
        sb.from("profiles").upsert(
          {
            user_id: (order as any).client_id,
            full_name: customerName,
            phone: customerPhone,
            delivery_pin: deliveryPin,
          } as any,
          { onConflict: "user_id" },
        ),
      ]);
      if (orderPinErr && profilePinErr) {
        console.error("[guest-order-status] pin persist error:", { orderPinErr, profilePinErr });
        deliveryPin = null;
      }
    }

    await recordAttempt(true);

    return json({
      order,
      store,
      items,
      customer_name: customerName,
      delivery_pin: deliveryPin,
    });
  } catch (e) {
    console.error("[guest-order-status] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
