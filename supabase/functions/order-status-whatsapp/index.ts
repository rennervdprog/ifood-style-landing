// order-status-whatsapp (v2 — modelo sem bot guiado, decisão 2026-10-22)
// Dispara WhatsApp SOMENTE em "pedido aceito" (preparando) e "saiu para entrega"
// (saiu_entrega), qualquer que seja a origem da mudança de status (painel, PDV,
// app do entregador, admin). Acionada por trigger no banco via pg_net.
// Mensagens espelham src/lib/orderNotifications.ts (painel web): "preparando"
// usa o formato rico forçado (sem template customizado, igual ao painel);
// "saiu_entrega" aceita o template customizado da loja.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token, x-cron-secret",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  maquininha_credito: "Cartão Crédito (maquininha)",
  maquininha_debito: "Cartão Débito (maquininha)",
  maquininha_pix: "PIX (maquininha)",
};

const TARGET: Record<string, { flag: string }> = {
  preparando: { flag: "notify_order_accepted" },
  saiu_entrega: { flag: "notify_order_out_delivery" },
  cancelado: { flag: "notify_order_cancelled" },
};

// Espelha buildRichItemsBlock do painel ("Anota AI").
function buildRichItemsBlock(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  const lines: string[] = [];
  for (const item of items) {
    const qty = Number(item.quantity || 1);
    const name = item.products?.name || item.name || "Item";
    lines.push(`➡ \`\`\`${qty}x ${name}\`\`\``);
    let addons: any = item.addons;
    if (typeof addons === "string") { try { addons = JSON.parse(addons); } catch { addons = []; } }
    if (Array.isArray(addons) && addons.length > 0) {
      const groups = new Map<string, any[]>();
      for (const a of addons) {
        const g = (a?.groupName as string) || "Adicional";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(a);
      }
      for (const [group, arr] of groups) {
        lines.push(`      _${group}_`);
        for (const a of arr) {
          const aqty = Number(a.quantity || 1);
          const aname = String(a.name || "").trim();
          if (aname) lines.push(`          \`\`\`${aqty}x ${aname}\`\`\``);
        }
      }
    }
    if (item.observations && String(item.observations).trim()) {
      lines.push(`      _Obs: ${String(item.observations).trim()}_`);
    }
  }
  return lines.join("\n");
}

// Espelha buildEtaWindow do painel (30-45 min, America/Sao_Paulo).
function buildEtaWindow(): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" });
  const a = new Date(Date.now() + 30 * 60000);
  const b = new Date(Date.now() + 45 * 60000);
  return `entre ${fmt.format(a)} e ${fmt.format(b)}`;
}

function buildAcceptedMessage(p: {
  clientName: string; num: string; itemsBlock: string; paymentLabel: string;
  isDelivery: boolean; deliveryFee: number; addressDetails: string; neighborhood: string;
  total: number; pin: string;
}): string {
  const feeTxt = p.isDelivery && p.deliveryFee > 0 ? ` (taxa de: *${fmtBRL(p.deliveryFee)}*)` : "";
  const enderecoLinha = p.isDelivery
    ? `🏠 ${[p.addressDetails, p.neighborhood].filter(Boolean).join(", ")}`
    : `🏃 Retirada no balcão`;
  const etaLinha = p.isDelivery ? `\n(Previsão de Entrega: ${buildEtaWindow()})` : "";
  const pinLinha = p.pin ? `\n\n🔑 *PIN de Segurança: ${p.pin}*` : "";
  return (
    `${p.clientName || "Cliente"}, o pedido Nº *${p.num}* está em produção.\n\n` +
    `Pedido *nº ${p.num}*\n\n` +
    `*Itens:*\n${p.itemsBlock}\n\n` +
    (p.paymentLabel ? `📱 *${p.paymentLabel}*\n\n` : "") +
    (p.isDelivery
      ? `🛵 *Delivery*${feeTxt}\n${enderecoLinha}${etaLinha}\n\n`
      : `${enderecoLinha}\n\n`) +
    `Total: *${fmtBRL(p.total)}*\n\n` +
    `Obrigado pela preferência, se precisar de algo é só chamar! 😉` +
    pinLinha
  );
}

function buildOutMessage(p: { storeName: string; shortId: string; address: string; pin: string }): string {
  return `🛵 *${p.storeName}* informa: Seu pedido #${p.shortId} saiu para entrega! 🚀\n` +
    (p.address ? `Endereço: ${p.address}` : "") +
    (p.pin ? `\n\n🔑 *PIN de Segurança: ${p.pin}*` : "");
}

function applyTemplate(tpl: string, data: Record<string, string>): string {
  return tpl.replace(/\{(storeName|clientName|orderId|total|pin|address|items|payment|deliveryFee|deliveryType|eta|neighborhood)\}/g,
    (_, k) => data[k] ?? `{${k}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const okToken = !!internalToken && req.headers.get("x-internal-token") === internalToken;
    const okCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
    const okService = !!serviceKey && (req.headers.get("Authorization") || "") === `Bearer ${serviceKey}`;
    if (!okToken && !okCron && !okService) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const orderId = String((body as any)?.order_id || "");
    if (!orderId) return json({ error: "order_id_required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

    const { data: order } = await admin.from("orders")
      .select("id, status, store_id, client_id, metadata, delivery_pin, address_details, neighborhood, total_price, payment_method, delivery_fee, order_number")
      .eq("id", orderId).maybeSingle();
    if (!order) return json({ skipped: "order_not_found" });
    const target = TARGET[String(order.status)];
    if (!target) return json({ skipped: "status_not_target", status: order.status });

    const { data: store } = await admin.from("stores").select("name").eq("id", order.store_id).maybeSingle();
    const { data: cfg } = await admin.from("store_whatsapp_config")
      .select("status, message_templates, notify_order_accepted, notify_order_out_delivery, notify_order_cancelled, whatsapp_mode")
      .eq("store_id", order.store_id).maybeSingle();
    if (!cfg) return json({ skipped: "whatsapp_not_configured" });
    if ((cfg as any).whatsapp_mode !== "official" && cfg.status !== "connected") return json({ skipped: "whatsapp_not_connected", status: cfg.status });
    if ((cfg as any)[target.flag] === false) return json({ skipped: "notify_disabled", flag: target.flag });

    const meta = (order.metadata || {}) as Record<string, any>;
    let phone = String(meta.customer_phone || "").replace(/\D/g, "");
    let clientName = String(meta.customer_name || "");
    if (order.client_id && (!phone || !clientName)) {
      const { data: guest } = await admin.from("guest_customers").select("phone, name").eq("user_id", order.client_id).maybeSingle();
      if (!phone && guest?.phone) phone = String(guest.phone).replace(/\D/g, "");
      if (!clientName && guest?.name) clientName = String(guest.name);
    }
    if (order.client_id && !phone) {
      const { data: prof } = await admin.from("profiles").select("phone").eq("id", order.client_id).maybeSingle();
      if (prof?.phone) phone = String(prof.phone).replace(/\D/g, "");
    }
    if (!phone) return json({ skipped: "no_customer_phone" });
    if (!clientName) clientName = "Cliente";

    const shortId = String(order.id).slice(0, 8).toUpperCase();
    const storeName = store?.name || "Loja";
    const pin = order.delivery_pin ? String(order.delivery_pin) : "";
    const address = String(order.address_details || "");
    const status = String(order.status);

    let message: string;
    if (status === "preparando") {
      // Formato rico forçado — igual ao painel (sem template customizado).
      const { data: items } = await admin.from("order_items")
        .select("quantity, addons, observations, products(name)").eq("order_id", order.id);
      const deliveryFee = Number(order.delivery_fee || 0);
      const isDelivery = deliveryFee > 0 || !!order.address_details;
      const method = String(order.payment_method || "");
      message = buildAcceptedMessage({
        clientName,
        num: order.order_number ? String(order.order_number) : shortId,
        itemsBlock: buildRichItemsBlock(items || []),
        paymentLabel: PAYMENT_LABELS[method] || (method ? method.toUpperCase() : ""),
        isDelivery,
        deliveryFee,
        addressDetails: address,
        neighborhood: String(order.neighborhood || ""),
        total: Number(order.total_price || 0),
        pin,
      });
    } else if (status === "cancelado") {
      // cancelado — espelha o painel (orderNotifications), incl. variante pix_direto.
      const customTpl = (cfg as any).message_templates?.["cancelado"];
      const firstName = clientName.split(" ")[0];
      const num = order.order_number ? String(order.order_number) : shortId;
      if (typeof customTpl === "string" && customTpl.trim().length > 0) {
        message = applyTemplate(customTpl, {
          storeName, clientName, orderId: num,
          total: fmtBRL(Number(order.total_price || 0)),
          pin, address, items: "",
          payment: String(order.payment_method || "").toUpperCase(),
          deliveryFee: order.delivery_fee ? fmtBRL(Number(order.delivery_fee)) : "",
          deliveryType: "Delivery", eta: "", neighborhood: String(order.neighborhood || ""),
        });
      } else if (String(order.payment_method || "") === "pix_direto") {
        message = `🚫 *Pedido #${num} cancelado*\n\nOlá ${firstName}! Seu pedido na *${storeName}* foi cancelado.\n\n💰 *Reembolso Pix:* como você escolheu pagar via Pix direto para a loja, o reembolso é feito pela própria loja — caso já tenha feito a transferência, entre em contato para receber o valor de volta.\n\nQualquer dúvida, fale com a loja.`;
      } else {
        message = `🚫 *Pedido #${num} cancelado*\n\nOlá ${firstName}! Seu pedido na *${storeName}* foi cancelado.\n\nSe foi pagamento presencial no ato da entrega, nenhum valor foi cobrado. Qualquer dúvida, fale com a loja.`;
      }
    } else {
      // saiu_entrega — template customizado da loja tem precedência (igual ao painel).
      const customTpl = (cfg as any).message_templates?.[status];
      if (typeof customTpl === "string" && customTpl.trim().length > 0) {
        let itemsBlock = "";
        if (customTpl.includes("{items}")) {
          const { data: items } = await admin.from("order_items")
            .select("quantity, addons, observations, products(name)").eq("order_id", order.id);
          itemsBlock = buildRichItemsBlock(items || []);
        }
        message = applyTemplate(customTpl, {
          storeName, clientName, orderId: order.order_number ? String(order.order_number) : shortId,
          total: fmtBRL(Number(order.total_price || 0)),
          pin, address, items: itemsBlock,
          payment: String(order.payment_method || "").toUpperCase(),
          deliveryFee: order.delivery_fee ? fmtBRL(Number(order.delivery_fee)) : "",
          deliveryType: "Delivery", eta: "", neighborhood: String(order.neighborhood || ""),
        });
      } else {
        message = buildOutMessage({ storeName, shortId, address, pin });
      }
    }

    const base = Deno.env.get("SUPABASE_URL");
    // Canal oficial (Meta): a loja migra por whatsapp_mode; os textos viram
    // modelos aprovados (template_accepted/out/cancelled da config oficial).
    if ((cfg as any).whatsapp_mode === "official") {
      const { data: ocfg } = await admin.from("store_whatsapp_official_config")
        .select("template_accepted, template_out, template_cancelled")
        .eq("store_id", order.store_id).maybeSingle();
      const tplName = status === "preparando" ? ocfg?.template_accepted : status === "saiu_entrega" ? ocfg?.template_out : ocfg?.template_cancelled;
      if (!tplName) return json({ ok: false, error: "official_template_missing", status });
      const num = order.order_number ? String(order.order_number) : shortId;
      const firstName = clientName.split(" ")[0];
      const etaTxt = (() => {
        const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
        return `entre ${fmt(new Date(Date.now() + 30 * 60000))} e ${fmt(new Date(Date.now() + 45 * 60000))}`;
      })();
      const params = status === "preparando"
        ? [firstName, num, storeName, fmtBRL(Number(order.total_price || 0)), etaTxt]
        : status === "saiu_entrega"
          // A Graph rejeita parâmetro vazio: sem PIN, vai o placeholder do
          // roteiro de migração ("não se aplica") — só no canal oficial.
          ? [num, storeName, pin || "não se aplica"]
          : [num, storeName, String(order.payment_method || "") === "pix_direto" ? "Se você já pagou via Pix, o reembolso será processado pela loja." : "Nenhum valor foi cobrado."];
      const r2 = await fetch(`${base}/functions/v1/official-whatsapp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ["apikey"]: serviceKey,
          ["Authorization"]: `Bearer ${serviceKey}`,
          "x-internal-token": internalToken,
        },
        body: JSON.stringify({ store_id: order.store_id, phone, template_name: tplName, params, kind: "order_status" }),
      });
      const out2 = await r2.json().catch(() => ({}));
      return json({ ok: r2.ok && (out2 as any)?.ok !== false, channel: "official", status, send_result: out2 });
    }
    const r = await fetch(`${base}/functions/v1/evolution-send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "x-internal-token": internalToken,
      },
      body: JSON.stringify({ store_id: order.store_id, phone, message, kind: "order_status" }),
    });
    const out = await r.json().catch(() => ({}));
    return json({ ok: r.ok, status, send_result: out });
  } catch (e) {
    // Nunca devolve erro pro chamador (trigger): registra e responde 200.
    return json({ error: String((e as Error)?.message || e) }, 200);
  }
});
