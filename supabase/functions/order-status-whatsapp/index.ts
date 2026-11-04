import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token, x-cron-secret"
};
const json = (body, status = 200)=>new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
const fmtBRL = (v)=>new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(v || 0));
const PAYMENT_LABELS = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  card: "Cartão",
  cash: "Dinheiro",
  pix_direto: "Pix direto",
  maquininha_credito: "Cartão Crédito (maquininha)",
  maquininha_debito: "Cartão Débito (maquininha)",
  maquininha_pix: "PIX (maquininha)"
};
// Só exibição: nome todo em maiúsculas vira formato normal e nomes longos
// são cortados numa linha. O cadastro e o nome gravado no pedido não mudam.
const displayName = (name)=>{
  const raw = String(name || "").trim();
  if (!raw) return raw;
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, "");
  let out = raw;
  if (letters && letters === letters.toUpperCase()) {
    out = raw.toLowerCase().replace(/(^|[\s\-/])([a-zà-ÿ])/g, (_m, sep, ch)=>sep + ch.toUpperCase());
  }
  return out.length > 40 ? out.slice(0, 39).trimEnd() + "…" : out;
};
const TARGET = {
  preparando: {
    flag: "notify_order_accepted"
  },
  saiu_entrega: {
    flag: "notify_order_out_delivery"
  },
  cancelado: {
    flag: "notify_order_cancelled"
  }
};
// Convite de avaliação no Google (conclusão do pedido): só é enviado
// quando a loja configurou settings.google_review_url — sem o link, o
// comportamento histórico se mantém (entregue/finalizado não notificam).
// Espelha isValidGoogleReviewUrl do painel (src/lib/googleReview.ts).
function isGoogleReviewUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "g.page" || host === "maps.app.goo.gl" || host.endsWith("google.com") || host.endsWith("google.com.br");
  } catch  {
    return false;
  }
}
// Espelha buildRichItemsBlock do painel ("Anota AI").
function buildRichItemsBlock(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const lines = [];
  for (const item of items){
    const qty = Number(item.quantity || 1);
    const name = displayName(item.products?.name || item.name || "Item");
    lines.push(`➡ \`\`\`${qty}x ${name}\`\`\``);
    let addons = item.addons;
    if (typeof addons === "string") {
      try {
        addons = JSON.parse(addons);
      } catch  {
        addons = [];
      }
    }
    if (Array.isArray(addons) && addons.length > 0) {
      const groups = new Map();
      for (const a of addons){
        const g = displayName(a?.groupName || "Adicional");
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(a);
      }
      for (const [group, arr] of groups){
        lines.push(`      _${group}_`);
        for (const a of arr){
          const aqty = Number(a.quantity || 1);
          const aname = displayName(String(a.name || "").trim());
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
function buildEtaWindow() {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo"
  });
  const a = new Date(Date.now() + 30 * 60000);
  const b = new Date(Date.now() + 45 * 60000);
  return `entre ${fmt.format(a)} e ${fmt.format(b)}`;
}
function buildAcceptedMessage(p) {
  const feeTxt = p.isDelivery && p.deliveryFee > 0 ? ` (taxa de: *${fmtBRL(p.deliveryFee)}*)` : "";
  // Não repete o bairro quando ele já está dentro do endereço.
  const nb = (p.neighborhood || "").trim();
  const addr = (p.addressDetails || "").trim();
  const enderecoPartes = [
    addr
  ];
  if (nb && !addr.toLowerCase().includes(nb.toLowerCase())) enderecoPartes.push(nb);
  const enderecoLinha = p.isDelivery ? `🏠 ${enderecoPartes.filter(Boolean).join(", ")}` : `🏃 Retirada no balcão`;
  const etaLinha = p.isDelivery ? `\n(Previsão de Entrega: ${buildEtaWindow()})` : "";
  const pinLinha = p.pin ? `\n\n🔑 *PIN de Segurança: ${p.pin}*` : "";
  return `${p.clientName || "Cliente"}, o pedido *#${p.num}* está em produção.\n\n` + `*Itens:*\n${p.itemsBlock}\n\n` + (p.paymentLabel ? `📱 *${p.paymentLabel}*\n\n` : "") + (p.isDelivery ? `🛵 *Delivery*${feeTxt}\n${enderecoLinha}${etaLinha}\n\n` : `${enderecoLinha}\n\n`) + `Total: *${fmtBRL(p.total)}*\n\n` + `Obrigado pela preferência, se precisar de algo é só chamar! 😉` + pinLinha;
}
function buildOutMessage(p) {
  return `🛵 *${p.storeName}* informa: Seu pedido #${p.shortId} saiu para entrega! 🚀\n` + (p.address ? `Endereço: ${p.address}` : "") + (p.pin ? `\n\n🔑 *PIN de Segurança: ${p.pin}*` : "");
}
function applyTemplate(tpl, data) {
  return tpl.replace(/\{(storeName|clientName|orderId|total|pin|address|items|payment|deliveryFee|deliveryType|eta|neighborhood)\}/g, (_, k)=>data[k] ?? `{${k}}`);
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const okToken = !!internalToken && req.headers.get("x-internal-token") === internalToken;
    const okCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
    const okService = !!serviceKey && (req.headers.get("Authorization") || "") === `Bearer ${serviceKey}`;
    if (!okToken && !okCron && !okService) return json({
      error: "unauthorized"
    }, 401);
    const body = await req.json().catch(()=>null);
    const orderId = String(body?.order_id || "");
    if (!orderId) return json({
      error: "order_id_required"
    }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL"), serviceKey, {
      auth: {
        persistSession: false
      }
    });
    const { data: order } = await admin.from("orders").select("id, status, store_id, client_id, metadata, delivery_pin, address_details, neighborhood, total_price, payment_method, delivery_fee, order_number").eq("id", orderId).maybeSingle();
    if (!order) return json({
      skipped: "order_not_found"
    });
    const isReviewInvite = order.status === "entregue" || order.status === "finalizado";
    const target = TARGET[String(order.status)];
    if (!target && !isReviewInvite) return json({
      skipped: "status_not_target",
      status: order.status
    });
    const { data: store } = await admin.from("stores").select("name, settings").eq("id", order.store_id).maybeSingle();
    const { data: cfg } = await admin.from("store_whatsapp_config").select("status, message_templates, notify_order_accepted, notify_order_out_delivery, notify_order_cancelled, whatsapp_mode").eq("store_id", order.store_id).maybeSingle();
    if (!cfg) return json({
      skipped: "whatsapp_not_configured"
    });
    if (cfg.whatsapp_mode !== "official" && cfg.status !== "connected") return json({
      skipped: "whatsapp_not_connected",
      status: cfg.status
    });
    if (target && cfg[target.flag] === false) return json({
      skipped: "notify_disabled",
      flag: target.flag
    });
    const meta = order.metadata || {};
    let phone = String(meta.customer_phone || "").replace(/\D/g, "");
    let clientName = String(meta.customer_name || "");
    // Pedido manual (PDV / tela de Pedidos): o telefone e o nome do cliente
    // ficam em metadata.manual_customer — sem esta leitura, o cliente do
    // pedido manual nunca recebia as atualizações de status.
    if (!phone && meta.manual_customer?.phone) phone = String(meta.manual_customer.phone).replace(/\D/g, "");
    if (!clientName && meta.manual_customer?.name) clientName = String(meta.manual_customer.name);
    if (order.client_id && (!phone || !clientName)) {
      const { data: guest } = await admin.from("guest_customers").select("phone, name").eq("user_id", order.client_id).maybeSingle();
      if (!phone && guest?.phone) phone = String(guest.phone).replace(/\D/g, "");
      if (!clientName && guest?.name) clientName = String(guest.name);
    }
    if (order.client_id && !phone) {
      const { data: prof } = await admin.from("profiles").select("phone, whatsapp_number").eq("user_id", order.client_id).maybeSingle();
      if (prof?.phone || prof?.whatsapp_number) phone = String(prof.phone || prof.whatsapp_number).replace(/\D/g, "");
    }
    if (!phone) return json({
      skipped: "no_customer_phone"
    });
    if (!clientName) clientName = "Cliente";
    const shortId = String(order.id).slice(0, 8).toUpperCase();
    const storeName = store?.name || "Loja";
    if (isReviewInvite) {
      const reviewUrl = typeof store?.settings?.google_review_url === "string" ? store.settings.google_review_url.trim() : "";
      if (!isGoogleReviewUrl(reviewUrl)) return json({
        skipped: "review_link_not_configured"
      });
      // No canal oficial (Meta) os textos são modelos aprovados — o
      // convite livre só sai pelo canal Evolution nesta versão.
      if (cfg.whatsapp_mode === "official") return json({
        skipped: "review_invite_official_unsupported"
      });
      const firstName = clientName.split(" ")[0];
      const message = `✅ *Pedido #${shortId} concluído!*\n\nObrigado pela preferência, ${firstName}! 🙏\n\nSe puder, conte como foi sua experiência avaliando a *${storeName}* no Google — leva menos de 1 minuto:\n${reviewUrl}`;
      const base = Deno.env.get("SUPABASE_URL");
      const r = await fetch(`${base}/functions/v1/evolution-send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ["apikey"]: serviceKey,
          ["Authorization"]: `Bearer ${serviceKey}`,
          "x-internal-token": internalToken
        },
        body: JSON.stringify({
          store_id: order.store_id,
          phone,
          message,
          kind: "order_status"
        })
      });
      const out = await r.json().catch(()=>({}));
      return json({
        ok: r.ok,
        status: order.status,
        review_invite: true,
        send_result: out
      });
    }
    const pin = order.delivery_pin ? String(order.delivery_pin) : "";
    const address = String(order.address_details || "");
    const status = String(order.status);
    let message;
    if (status === "preparando") {
      // Formato rico forçado — igual ao painel (sem template customizado).
      const { data: items } = await admin.from("order_items").select("quantity, addons, observations, products(name)").eq("order_id", order.id);
      const deliveryFee = Number(order.delivery_fee || 0);
      const isDelivery = deliveryFee > 0 || !!order.address_details;
      const method = String(order.payment_method || "");
      message = buildAcceptedMessage({
        clientName,
        num: shortId,
        itemsBlock: buildRichItemsBlock(items || []),
        paymentLabel: PAYMENT_LABELS[method] || (method ? method.toUpperCase() : ""),
        isDelivery,
        deliveryFee,
        addressDetails: address,
        neighborhood: String(order.neighborhood || ""),
        total: Number(order.total_price || 0),
        pin
      });
    } else if (status === "cancelado") {
      // cancelado — espelha o painel (orderNotifications), incl. variante pix_direto.
      const customTpl = cfg.message_templates?.["cancelado"];
      const firstName = clientName.split(" ")[0];
      const num = shortId;
      if (typeof customTpl === "string" && customTpl.trim().length > 0) {
        message = applyTemplate(customTpl, {
          storeName,
          clientName,
          orderId: num,
          total: fmtBRL(Number(order.total_price || 0)),
          pin,
          address,
          items: "",
          payment: String(order.payment_method || "").toUpperCase(),
          deliveryFee: order.delivery_fee ? fmtBRL(Number(order.delivery_fee)) : "",
          deliveryType: "Delivery",
          eta: "",
          neighborhood: String(order.neighborhood || "")
        });
      } else if (String(order.payment_method || "") === "pix_direto") {
        message = `🚫 *Pedido #${num} cancelado*\n\nOlá ${firstName}! Seu pedido na *${storeName}* foi cancelado.\n\n💰 *Reembolso Pix:* como você escolheu pagar via Pix direto para a loja, o reembolso é feito pela própria loja — caso já tenha feito a transferência, entre em contato para receber o valor de volta.\n\nQualquer dúvida, fale com a loja.`;
      } else {
        message = `🚫 *Pedido #${num} cancelado*\n\nOlá ${firstName}! Seu pedido na *${storeName}* foi cancelado.\n\nSe foi pagamento presencial no ato da entrega, nenhum valor foi cobrado. Qualquer dúvida, fale com a loja.`;
      }
    } else {
      // saiu_entrega — template customizado da loja tem precedência (igual ao painel).
      const customTpl = cfg.message_templates?.[status];
      if (typeof customTpl === "string" && customTpl.trim().length > 0) {
        let itemsBlock = "";
        if (customTpl.includes("{items}")) {
          const { data: items } = await admin.from("order_items").select("quantity, addons, observations, products(name)").eq("order_id", order.id);
          itemsBlock = buildRichItemsBlock(items || []);
        }
        message = applyTemplate(customTpl, {
          storeName,
          clientName,
          orderId: shortId,
          total: fmtBRL(Number(order.total_price || 0)),
          pin,
          address,
          items: itemsBlock,
          payment: String(order.payment_method || "").toUpperCase(),
          deliveryFee: order.delivery_fee ? fmtBRL(Number(order.delivery_fee)) : "",
          deliveryType: "Delivery",
          eta: "",
          neighborhood: String(order.neighborhood || "")
        });
      } else {
        message = buildOutMessage({
          storeName,
          shortId,
          address,
          pin
        });
      }
    }
    const base = Deno.env.get("SUPABASE_URL");
    // Canal oficial (Meta): a loja migra por whatsapp_mode; os textos viram
    // modelos aprovados (template_accepted/out/cancelled da config oficial).
    if (cfg.whatsapp_mode === "official") {
      const { data: ocfg } = await admin.from("store_whatsapp_official_config").select("template_accepted, template_out, template_cancelled").eq("store_id", order.store_id).maybeSingle();
      const tplName = status === "preparando" ? ocfg?.template_accepted : status === "saiu_entrega" ? ocfg?.template_out : ocfg?.template_cancelled;
      if (!tplName) return json({
        ok: false,
        error: "official_template_missing",
        status
      });
      const num = shortId;
      const firstName = clientName.split(" ")[0];
      const etaTxt = (()=>{
        const fmt = (d)=>new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }).format(d);
        return `entre ${fmt(new Date(Date.now() + 30 * 60000))} e ${fmt(new Date(Date.now() + 45 * 60000))}`;
      })();
      const params = status === "preparando" ? [
        firstName,
        num,
        storeName,
        fmtBRL(Number(order.total_price || 0)),
        etaTxt
      ] : status === "saiu_entrega" ? [
        num,
        storeName,
        pin || "não se aplica"
      ] : [
        num,
        storeName,
        String(order.payment_method || "") === "pix_direto" ? "Se você já pagou via Pix, o reembolso será processado pela loja." : "Nenhum valor foi cobrado."
      ];
      const r2 = await fetch(`${base}/functions/v1/official-whatsapp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ["apikey"]: serviceKey,
          ["Authorization"]: `Bearer ${serviceKey}`,
          "x-internal-token": internalToken
        },
        body: JSON.stringify({
          store_id: order.store_id,
          phone,
          template_name: tplName,
          params,
          kind: "order_status"
        })
      });
      const out2 = await r2.json().catch(()=>({}));
      return json({
        ok: r2.ok && out2?.ok !== false,
        channel: "official",
        status,
        send_result: out2
      });
    }
    const r = await fetch(`${base}/functions/v1/evolution-send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "x-internal-token": internalToken
      },
      body: JSON.stringify({
        store_id: order.store_id,
        phone,
        message,
        kind: "order_status"
      })
    });
    const out = await r.json().catch(()=>({}));
    return json({
      ok: r.ok,
      status,
      send_result: out
    });
  } catch (e) {
    // Nunca devolve erro pro chamador (trigger): registra e responde 200.
    return json({
      error: String(e?.message || e)
    }, 200);
  }
});
