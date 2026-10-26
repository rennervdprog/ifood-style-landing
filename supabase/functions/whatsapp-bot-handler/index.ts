// Bot de menu guiado do WhatsApp (sem IA).
// Invocado pelo evolution-webhook e pelo meta-webhook quando a loja tem
// `whatsapp_bot_config.enabled = true`.
// Máquina de estados baseada em texto numerado (compatível com qualquer versão do WhatsApp).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token"
};
const json = (b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...cors,
      "Content-Type": "application/json"
    }
  });
const BRL = (n)=>`R$ ${n.toFixed(2).replace(".", ",")}`;
const normalize = (t)=>t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const DEFAULT_TRIGGER_KEYWORDS = [
  "menu",
  "cardapio",
  "cardápio",
  "pedido",
  "pedir",
  "comprar",
  "oi",
  "ola",
  "olá",
  "bom dia",
  "boa tarde",
  "boa noite"
];
const CANONICAL_HOST = "https://itasuper.com.br";
const onlyDigits = (p)=>String(p || "").replace(/\D/g, "");
// ── INÍCIO inline de orderMapping.ts (Fase 1) ──
// Fonte da verdade: supabase/functions/whatsapp-bot-handler/orderMapping.ts
// (deploy externo só sobe index.ts — manter os dois idênticos; o teste
//  src/lib/__tests__/whatsappBotOrderMapping.test.ts trava divergência.)
type BotPaymentMethod = string;

const BOT_PAYMENT_TO_RPC: Record<string, string> = {
  pix: "pix_machine",
  cash: "dinheiro",
  card: "cartao",
  pix_direto: "pix_direto",
};

/** Vocabulário do bot -> vocabulário do site/RPC. Desconhecido passa direto. */
function mapPaymentMethodToRpc(botMethod: BotPaymentMethod): string {
  return BOT_PAYMENT_TO_RPC[botMethod] ?? botMethod;
}

interface BotCartAddon {
  id?: string | null;
  group_id?: string | null;
  groupId?: string | null;
  group_name?: string | null;
  groupName?: string | null;
  name: string;
  price: number;
}

interface BotCartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  addons?: BotCartAddon[] | null;
  observations?: string | null;
}

interface RpcOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  addons: Array<{
    id: string | null;
    groupId: string | null;
    groupName: string | null;
    name: string;
    price: number;
  }>;
  observations: string | null;
}

/**
 * Carrinho da sessão -> `p_items` no formato que a RPC valida.
 * Sem o `id` do adicional a RPC cai para busca por nome; com ele, resolve
 * pelo UUID dentro do grupo. `null` explícito = "não informado" (a RPC trata
 * como ausente e cai para o nome) — cobre sessões em andamento no deploy.
 */
function mapCartToRpcItems(cart: BotCartItem[]): RpcOrderItem[] {
  return (cart || []).map((i) => ({
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: i.unit_price,
    addons: (i.addons || []).map((a) => ({
      id: a.id ?? null,
      groupId: a.groupId ?? a.group_id ?? null,
      groupName: a.groupName ?? a.group_name ?? null,
      name: a.name,
      price: a.price,
    })),
    observations: i.observations || null,
  }));
}

/** Número curto do pedido: prefixo do UUID, igual ao painel (#2A27F312). */
function shortOrderCode(orderId: string): string {
  return `#${String(orderId || "").slice(0, 8).toUpperCase()}`;
}

/** Link de acompanhamento público do pedido (PIN = últimos 4 do telefone). */
function buildTrackingLink(orderId: string, phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return `https://www.itasuper.com.br/p/${orderId}?t=${digits.slice(-4)}`;
}

type RpcErrorKind =
  | "closed"
  | "below_minimum"
  | "price_changed"
  | "unavailable"
  | "unknown";

function classifyRpcError(message: string): RpcErrorKind {
  const m = String(message || "").toLowerCase();
  if (m.includes("loja fechada")) return "closed";
  if (m.includes("pedido mínimo")) return "below_minimum";
  if (m.includes("divergente") || m.includes("revise o carrinho")) return "price_changed";
  if (
    m.includes("indisponível") ||
    m.includes("indisponivel") ||
    m.includes("não foi encontrado") ||
    m.includes("não pertence") ||
    m.includes("produto do pedido inválido")
  ) {
    return "unavailable";
  }
  return "unknown";
}

/**
 * Exceção da RPC -> mensagem amigável no WhatsApp. A sessão é mantida em
 * todos os casos (o cliente não perde o pedido); preço divergente e item
 * indisponível pedem para cancelar e montar de novo — o carrinho com o
 * preço velho não passa na RPC de novo.
 */
function translateRpcError(message: string): { kind: RpcErrorKind; text: string } {
  const kind = classifyRpcError(message);
  switch (kind) {
    case "closed":
      return {
        kind,
        text: "🌙 A loja está fechada no momento — não consegui confirmar seu pedido.\n\nQuando abrir, é só mandar *MENU* que te atendo. 💚",
      };
    case "below_minimum": {
      const min = String(message || "").match(/R\$ ?[\d.,]+/);
      return {
        kind,
        text: `⚠️ O pedido mínimo desta loja é ${min ? min[0] : "maior que o subtotal"} — seu carrinho ficou abaixo dele.\n\nAdicione mais itens e tente de novo, ou responda *2* para cancelar. 🙂`,
      };
    }
    case "price_changed":
      return {
        kind,
        text: "⚠️ O preço de um item mudou enquanto você montava o pedido — não consegui confirmar com o valor antigo.\n\nResponda *2* para cancelar e montar o pedido de novo com os preços atualizados.",
      };
    case "unavailable":
      return {
        kind,
        text: "⚠️ Um item do seu pedido ficou indisponível — não consegui confirmar.\n\nResponda *2* para cancelar e montar o pedido de novo.",
      };
    default:
      return {
        kind,
        text: "❌ Não consegui confirmar seu pedido agora. Um atendente já vai te chamar — seu carrinho continua aqui. 🙂",
      };
  }
}

interface DeliveryQuoteSnapshot {
  policy_version: number;
  distance_km: number;
  distance_source: string;
  max_delivery_km: number | null;
  destination_precision: string;
  store_delivery_base: number;
  platform_fee_customer: number;
  platform_fee_store_absorbed: number;
  delivery_fee: number;
  vip_override_applied: unknown;
  split_mode: unknown;
  plan_type: unknown;
}

/**
 * Snapshot da cotação no formato que a RPC grava em `metadata.delivery_quote`
 * — o mesmo que a edge guest-checkout monta. A RPC não aceita o quote cheio.
 */
function buildDeliveryQuoteSnapshot(
  quote: any,
  deliveryFee: number,
  precisionFallback = "cep",
): DeliveryQuoteSnapshot | null {
  if (!quote) return null;
  return {
    policy_version: quote.policy_version || 1,
    distance_km: Number(quote.distance?.km || 0),
    distance_source: quote.distance?.source || "haversine",
    max_delivery_km: quote.distance?.max_km ?? null,
    destination_precision: quote.destination?.precision || precisionFallback,
    store_delivery_base: Number(quote.pricing?.store_delivery_base || 0),
    platform_fee_customer: Number(quote.pricing?.platform_fee_customer || 0),
    platform_fee_store_absorbed: Number(quote.pricing?.platform_fee_store_absorbed || 0),
    delivery_fee: deliveryFee,
    vip_override_applied: quote.pricing?.vip_override_applied ?? null,
    split_mode: quote.pricing?.split_mode ?? null,
    plan_type: quote.pricing?.plan_type ?? null,
  };
}

/**
 * Campos que o bot acrescenta ao `metadata` do pedido depois da RPC.
 * A RPC monta o metadata só a partir do delivery_quote (e vasilhames) — o
 * resto do que o painel/debug lê hoje volta aqui, por cima do que a RPC
 * gravou (o merge é feito no handler, sem apagar o delivery_quote).
 */
function buildBotMetadataPatch(
  context: {
    customer_name?: string | null;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    reference?: string | null;
  },
  phone: string,
): Record<string, unknown> {
  return {
    source: "whatsapp_bot",
    customer_phone: phone,
    customer_name: context.customer_name || null,
    address_street: context.street || null,
    address_number: context.number || null,
    address_neighborhood: context.neighborhood || null,
    address_reference: context.reference || null,
  };
}

/**
 * Envio best-effort: um envio que pode falhar (instância desconectada,
 * teto atingido) nunca pode abortar a transição do fluxo — a sessão já
 * foi (ou vai ser) gravada pelo passo seguinte. Devolve false quando o
 * envio falhou, sem lançar. Usado nos envios que antecedem uma transição
 * (saudações "Perfeito"/"Prazer", descrição do produto, aviso de mínimo).
 */
async function sendBestEffort(
  send: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (e) {
    console.error(
      "[bot] sendBestEffort failed (flow continues)",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}
// ── FIM inline de orderMapping.ts ──
// Verifica se a loja está aberta agora (horário Brasília) com base em opening_hours + force_closed + is_open.
const dayNamesBR = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado"
];
function getStoreOpenStatus(hours, forceClosed, isOpenManual) {
  if (forceClosed) return {
    isOpen: false,
    reason: "Fechado temporariamente"
  };
  if (!hours || hours.length === 0) {
    return isOpenManual ? {
      isOpen: true,
      reason: "Aberto"
    } : {
      isOpen: false,
      reason: "Fechado"
    };
  }
  const now = new Date();
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const brHour = Number(parts.find((p)=>p.type === "hour")?.value ?? 0);
  const brMinute = Number(parts.find((p)=>p.type === "minute")?.value ?? 0);
  const brDate = new Date(now.toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo"
  }));
  const currentDay = brDate.getDay();
  const currentMinutes = brHour * 60 + brMinute;
  const today = hours.find((h)=>h.day_of_week === currentDay);
  if (today && !today.is_closed_all_day) {
    const [oH, oM] = today.open_time.split(":").map(Number);
    const [cH, cM] = today.close_time.split(":").map(Number);
    const openMin = oH * 60 + oM;
    let closeMin = cH * 60 + cM;
    if (closeMin <= openMin) {
      if (currentMinutes >= openMin || currentMinutes < closeMin) return {
        isOpen: true,
        reason: `Aberto até ${today.close_time.slice(0, 5)}`
      };
    } else {
      if (currentMinutes >= openMin && currentMinutes < closeMin) return {
        isOpen: true,
        reason: `Aberto até ${today.close_time.slice(0, 5)}`
      };
    }
    if (currentMinutes < openMin) return {
      isOpen: false,
      reason: `Abre hoje às ${today.open_time.slice(0, 5)}`
    };
  }
  for(let off = 1; off <= 7; off++){
    const nd = (currentDay + off) % 7;
    const nh = hours.find((h)=>h.day_of_week === nd);
    if (nh && !nh.is_closed_all_day) {
      const label = off === 1 ? "Amanhã" : dayNamesBR[nd];
      return {
        isOpen: false,
        reason: `Abre ${label} às ${nh.open_time.slice(0, 5)}`
      };
    }
  }
  return {
    isOpen: false,
    reason: "Fechado"
  };
}
const sendText = async (storeId, phone, message)=>{
  const base = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  // Migração API oficial (B2): loja com whatsapp_mode='official' recebe pela
  // Meta (official-whatsapp-send, texto livre — conversa de bot vive na janela
  // de 24h aberta pelo cliente). Nas demais lojas, o caminho Evolution abaixo
  // é exatamente o de sempre.
  {
    const admin = createClient(base || "", key);
    const { data: wcfg } = await admin.from("store_whatsapp_config").select("whatsapp_mode").eq("store_id", storeId).maybeSingle();
    if ((wcfg as any)?.whatsapp_mode === "official") {
      const r = await fetch(`${base}/functions/v1/official-whatsapp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
          "x-internal-token": Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || ""
        },
        body: JSON.stringify({
          store_id: storeId,
          phone,
          text: message,
          kind: "bot"
        })
      });
      const out = await r.json().catch(()=>({}));
      if (!r.ok || (out as any)?.ok === false || (out as any)?.error) {
        console.error("[bot] sendText (official) failed", {
          status: r.status,
          out
        });
        throw new Error(`send_text_failed_${r.status}`);
      }
      return true;
    }
  }
  // Envio Evolution SEM `force`: o bot passa pelo dedupe por hash (1h) e
  // pelo teto diário como qualquer outro envio — `force: true` desligava
  // os dois e o bot podia disparar sem limite. No teto, o sender NÃO
  // enfileira mensagens do bot (resposta de bot entregue horas depois
  // estaria obsoleta); falha rápido com 429 e o webhook registra.
  const r = await fetch(`${base}/functions/v1/evolution-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      "x-internal-token": Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || ""
    },
    body: JSON.stringify({
      store_id: storeId,
      phone,
      message,
      kind: "bot"
    })
  });
  const out = await r.json().catch(()=>({}));
  if (!r.ok || out?.error) {
    console.error("[bot] sendText failed", {
      status: r.status,
      out
    });
    throw new Error(`send_text_failed_${r.status}`);
  }
  return true;
};
async function sendDeliveryFeeInfo(storeId, phone, storeFee, platformFee) {
  const total = Math.round((storeFee + platformFee) * 100) / 100;
  const lines = [
    `🛵 *Taxa de entrega: ${BRL(total)}*`,
    ``,
    `• Loja: ${BRL(storeFee)}`
  ];
  if (platformFee > 0) {
    lines.push(`• Plataforma: ${BRL(platformFee)} (mantém o app no ar)`);
  } else {
    lines.push(`• Plataforma: grátis 🎉`);
  }
  try {
    await sendText(storeId, phone, lines.join("\n"));
  } catch (e) {
    console.error("[bot] sendDeliveryFeeInfo", e);
  }
}
const setSession = async (admin, s)=>{
  const expires = new Date(Date.now() + 15 * 60_000).toISOString();
  await admin.from("whatsapp_bot_sessions").upsert({
    store_id: s.store_id,
    phone: s.phone,
    current_step: s.current_step,
    cart: s.cart,
    context: s.context,
    last_message_at: new Date().toISOString(),
    expires_at: expires
  }, {
    onConflict: "store_id,phone"
  });
};
// Cooldown pós-pedido: 2h de silêncio (só 1 aviso na 1ª mensagem).
// Evita rajada de respostas que aumenta risco de ban do chip.
const POST_ORDER_COOLDOWN_MS = 2 * 60 * 60_000;
const setPostOrderCooldown = async (admin, storeId, phone, orderCode)=>{
  const expires = new Date(Date.now() + POST_ORDER_COOLDOWN_MS).toISOString();
  await admin.from("whatsapp_bot_sessions").upsert({
    store_id: storeId,
    phone,
    current_step: "post_order_cooldown",
    cart: [],
    context: {
      order_code: orderCode,
      notified: false
    },
    last_message_at: new Date().toISOString(),
    expires_at: expires
  }, {
    onConflict: "store_id,phone"
  });
};
const clearSession = async (admin, storeId, phone)=>{
  await admin.from("whatsapp_bot_sessions").delete().eq("store_id", storeId).eq("phone", phone);
};
const loadSession = async (admin, storeId, phone)=>{
  const { data } = await admin.from("whatsapp_bot_sessions").select("*").eq("store_id", storeId).eq("phone", phone).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await clearSession(admin, storeId, phone);
    return null;
  }
  return data;
};
// Só exibição: nome todo em maiúsculas vira formato normal e nomes longos
// são cortados numa linha. O cadastro e o nome gravado no pedido não mudam.
const displayName = (name: string): string => {
  const raw = String(name || "").trim();
  if (!raw) return raw;
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, "");
  let out = raw;
  if (letters && letters === letters.toUpperCase()) {
    out = raw.toLowerCase().replace(/(^|[\s\-/])([a-zà-ÿ])/g, (_m, sep, ch) => sep + ch.toUpperCase());
  }
  return out.length > 40 ? out.slice(0, 39).trimEnd() + "…" : out;
};
const showCategories = async (admin, storeId, phone, session)=>{
  const { data: sections } = await admin.from("menu_sections").select("id, name").eq("store_id", storeId).order("sort_order");
  if (!sections || sections.length === 0) {
    await sendText(storeId, phone, "Desculpe, ainda não temos cardápio disponível. Um atendente já vai te responder.");
    await clearSession(admin, storeId, phone);
    return;
  }
  const lines = [
    "*📋 Escolha uma categoria:*",
    ""
  ];
  sections.slice(0, 20).forEach((s, i)=>lines.push(`*${i + 1}* — ${displayName(s.name)}`));
  lines.push("", "_Responda com o *número* da categoria._", "_Digite *CANCELAR* para sair._");
  session.current_step = "awaiting_category";
  session.context = {
    ...session.context,
    categories: sections.slice(0, 20).map((s)=>s.id)
  };
  await setSession(admin, session);
  await sendText(storeId, phone, lines.join("\n"));
};
const showProducts = async (admin, storeId, phone, session, categoryId)=>{
  const { data: products } = await admin.from("products").select("id, name, price, description").eq("store_id", storeId).eq("section_id", categoryId).eq("is_available", true).order("name").limit(20);
  if (!products || products.length === 0) {
    await sendBestEffort(() => sendText(storeId, phone, "Essa categoria está sem itens no momento. Escolha outra."));
    await showCategories(admin, storeId, phone, session);
    return;
  }
  const lines = [
    "*🍽️ Escolha um item:*",
    ""
  ];
  products.forEach((p, i)=>lines.push(`*${i + 1}* — ${displayName(p.name)} — ${BRL(Number(p.price))}`));
  lines.push("", "_Responda com o *número* do item._", "_Digite *0* para voltar às categorias._");
  session.current_step = "awaiting_product";
  session.context = {
    ...session.context,
    products: products.map((p)=>({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        description: (p.description || "").toString().trim() || null
      }))
  };
  await setSession(admin, session);
  await sendText(storeId, phone, lines.join("\n"));
};
const askMore = async (admin, storeId, phone, session)=>{
  const total = session.cart.reduce((s, i)=>s + i.unit_price * i.quantity, 0);
  const cartText = session.cart.map((i)=>{
    const ad = (i.addons || []).map((a)=>`   ↳ ${a.name}`).join("\n");
    const obs = i.observations ? `\n   📝 _${i.observations}_` : "";
    return `• ${i.quantity}x ${i.name} — ${BRL(i.unit_price * i.quantity)}${ad ? "\n" + ad : ""}${obs}`;
  }).join("\n");
  const msg = `✅ *Item adicionado!*\n\n*Seu carrinho:*\n${cartText}\n\n*Subtotal:* ${BRL(total)}\n\n*1* — Adicionar mais itens\n*2* — Finalizar pedido\n\n_Digite *CANCELAR* para desistir._`;
  session.current_step = "awaiting_more";
  await setSession(admin, session);
  await sendText(storeId, phone, msg);
};
const askObservation = async (admin, storeId, phone, session)=>{
  session.current_step = "awaiting_observation";
  await setSession(admin, session);
  await sendText(storeId, phone, "📝 *Alguma observação para este item?*\n\n_Ex.: sem cebola, ponto da carne, tirar o queijo..._\n\nDigite sua observação ou envie *0* para pular.");
};
// Busca grupos de adicionais (diretos e vinculados via product_addon_groups) + itens.
const fetchAddonGroupsFor = async (admin, storeId, productId)=>{
  const sel = "id,name,min_select,max_select,sort_order,price_replaces_base,addon_items(id,name,price,sort_order)";
  const [directRes, linkedRes] = await Promise.all([
    admin.from("addon_groups").select(sel).eq("product_id", productId).order("sort_order"),
    admin.from("product_addon_groups").select(`addon_group_id,addon_groups(${sel})`).eq("product_id", productId)
  ]);
  const direct = directRes.data || [];
  const linked = (linkedRes.data || []).map((r)=>r.addon_groups).filter(Boolean).filter((g)=>!direct.find((d)=>d.id === g.id));
  const groups = [
    ...direct,
    ...linked
  ].sort((a, b)=>(a.sort_order || 0) - (b.sort_order || 0)).map((g)=>({
      id: g.id,
      name: g.name,
      min: Number(g.min_select || 0),
      max: Number(g.max_select || 1),
      price_replaces_base: !!g.price_replaces_base,
      items: (g.addon_items || []).sort((a, b)=>(a.sort_order || 0) - (b.sort_order || 0)).map((it)=>({
          id: it.id,
          name: it.name,
          price: Number(it.price || 0)
        }))
    })).filter((g)=>g.items.length > 0);
  return groups;
};
const askAddonGroup = async (admin, storeId, phone, session)=>{
  const pp = session.context.pending_product;
  const g = pp.groups[pp.group_idx];
  const rule = g.min === 0 && g.max === 1 ? "opcional, escolha 1" : g.min === 1 && g.max === 1 ? "obrigatório, escolha 1" : g.min === 0 ? `opcional, até ${g.max}` : g.min === g.max ? `obrigatório, escolha ${g.min}` : `escolha de ${g.min} a ${g.max}`;
  const lines = [
    `*${g.name}* (${rule})`,
    ""
  ];
  g.items.forEach((it, i)=>{
    const priceStr = it.price > 0 ? ` (+${BRL(it.price)})` : "";
    lines.push(`*${i + 1}* — ${it.name}${priceStr}`);
  });
  if (g.max > 1) lines.push("", "_Envie os números separados por vírgula (ex: 1,3)._");
  else lines.push("", "_Responda com o *número* da opção._");
  if (g.min === 0) lines.push("_Ou envie *0* para pular._");
  session.current_step = "awaiting_addon";
  await setSession(admin, session);
  await sendText(storeId, phone, lines.join("\n"));
};
const finalizeProductWithAddons = async (admin, storeId, phone, session)=>{
  const pp = session.context.pending_product;
  const addons = pp.addons || [];
  // preço: se algum grupo com price_replaces_base tem seleção, o base vira o maior preço desse grupo;
  // demais adicionais somam normalmente.
  let base = Number(pp.base_price || 0);
  let extras = 0;
  const replacedGroups = new Set();
  for (const g of pp.groups){
    const picks = addons.filter((a)=>a.group_id === g.id);
    if (g.price_replaces_base && picks.length > 0) {
      base = Math.max(...picks.map((a)=>a.price));
      replacedGroups.add(g.id);
    }
  }
  for (const a of addons){
    if (!replacedGroups.has(a.group_id)) extras += a.price;
  }
  const unit_price = Math.round((base + extras) * 100) / 100;
  session.cart.push({
    product_id: pp.product_id,
    name: pp.name,
    unit_price,
    quantity: 1,
    addons: addons.map((a)=>({
        id: a.id,
        group_id: a.group_id,
        group_name: a.group_name,
        name: a.name,
        price: a.price
      }))
  });
  session.context.pending_product = null;
  await askObservation(admin, storeId, phone, session);
};
const askDeliveryType = async (admin, storeId, phone, session)=>{
  session.current_step = "awaiting_delivery_type";
  await setSession(admin, session);
  await sendText(storeId, phone, "*🛵 Como deseja receber?*\n\n*1* — Entrega (delivery)\n*2* — Retirada no balcão");
};
const addressSummary = (a)=>{
  const parts = [
    a.street,
    a.number,
    a.neighborhood ? `— ${a.neighborhood}` : ""
  ].filter(Boolean);
  const s = parts.join(" ").trim();
  return a.reference || a.reference_point ? `${s} (${a.reference || a.reference_point})` : s;
};
const maybeOfferSavedAddress = async (admin, storeId, phone, session)=>{
  const clientId = session.context.client_id;
  if (clientId) {
    const { data: addrs } = await admin.from("saved_addresses").select("id, street, number, neighborhood, reference_point, complement, cep, city, state, latitude, longitude").eq("user_id", clientId).order("is_default", {
      ascending: false
    }).order("created_at", {
      ascending: false
    }).limit(1);
    const last = addrs?.[0];
    if (last) {
      session.context.saved_address = last;
      session.current_step = "awaiting_address_choice";
      await setSession(admin, session);
      await sendText(storeId, phone, `*📍 Entregar no endereço de sempre?*\n\n${addressSummary(last)}\n\n*1* — Sim, entregar aí\n*2* — Usar outro endereço`);
      return true;
    }
  }
  await askStreet(admin, storeId, phone, session);
  return false;
};
const askStreet = async (admin, storeId, phone, session)=>{
  session.current_step = "awaiting_street";
  await setSession(admin, session);
  await sendText(storeId, phone, "*📍 Qual o nome da *rua*?*\n\n_Exemplo: Rua das Flores_");
};
const askNumber = async (admin, storeId, phone, session)=>{
  session.current_step = "awaiting_number";
  await setSession(admin, session);
  await sendText(storeId, phone, "*🔢 Qual o *número*?*\n\n_Se não tiver, responda *SN*._");
};
const askNeighborhood = async (admin, storeId, phone, session)=>{
  session.current_step = "awaiting_neighborhood";
  await setSession(admin, session);
  await sendText(storeId, phone, "*🏘️ Qual o *bairro*?*");
};
const askCep = async (admin, storeId, phone, session)=>{
  session.current_step = "awaiting_cep";
  await setSession(admin, session);
  await sendText(storeId, phone, "*📮 Qual o CEP do endereço de entrega?*\n\n_Envie 8 números, com ou sem hífen._");
};
const askReference = async (admin, storeId, phone, session)=>{
  session.current_step = "awaiting_reference";
  await setSession(admin, session);
  await sendText(storeId, phone, "*📌 Complemento / ponto de referência?*\n\n_Ex: apto 12, ao lado da praça._\n_Se não tiver, responda *-*._");
};
const askChange = async (admin, storeId, phone, session, total)=>{
  session.current_step = "awaiting_change";
  await setSession(admin, session);
  await sendText(storeId, phone, `*💵 Precisa de troco?*\n\nSeu total é ${BRL(total)}.\n\nResponda com o *valor em dinheiro* que vai entregar (ex: *50*), ou *NAO* se não precisar de troco.`);
};
const askPayment = async (admin, storeId, phone, session, methods, pixDiretoOn = false)=>{
  const opts = [];
  const map = {
    pix: pixDiretoOn ? "Pix direto (chave do lojista)" : "Pix (na entrega/retirada)",
    cash: "Dinheiro",
    card: "Cartão na entrega"
  };
  const available = methods.filter((m)=>map[m]);
  available.forEach((m, i)=>opts.push(`*${i + 1}* — ${map[m]}`));
  session.current_step = "awaiting_payment";
  session.context = {
    ...session.context,
    payment_options: available,
    pix_direto_on: pixDiretoOn
  };
  await setSession(admin, session);
  await sendText(storeId, phone, `*💰 Forma de pagamento:*\n\n${opts.join("\n")}`);
};
const showConfirmation = async (admin, storeId, phone, session, storeName, minimumOrderValue = 0)=>{
  const subtotal = session.cart.reduce((s, i)=>s + i.unit_price * i.quantity, 0);
  const deliveryFee = Number(session.context.delivery_fee || 0);
  const total = subtotal + deliveryFee;
  // Fase 1 (decisão c): pré-checagem do mínimo ANTES do "confirmar" — a RPC
  // continua sendo a trava final, mas o cliente não chega até ela para
  // descobrir. O mínimo é o subtotal (igual à RPC), sem a taxa.
  const minimum = Number(minimumOrderValue || 0);
  if (minimum > 0 && subtotal < minimum) {
    const missing = Math.round((minimum - subtotal) * 100) / 100;
    await sendBestEffort(() => sendText(storeId, phone, `⚠️ Falta *${BRL(missing)}* para o pedido mínimo desta loja (${BRL(minimum)}).\n\nAdicione mais itens ao carrinho para continuar. 🙂`));
    await askMore(admin, storeId, phone, session);
    return;
  }
  // Chave de idempotência gerada na confirmação e guardada na sessão:
  // o retry (confirmar duas vezes) reutiliza a mesma chave e a RPC devolve
  // o pedido existente em vez de criar outro.
  if (!session.context.idempotency_key) session.context.idempotency_key = crypto.randomUUID();
  const cartText = session.cart.map((i)=>{
    const ad = (i.addons || []).map((a)=>`   ↳ ${a.name}`).join("\n");
    return `• ${i.quantity}x ${i.name} — ${BRL(i.unit_price * i.quantity)}${ad ? "\n" + ad : ""}`;
  }).join("\n");
  const isDelivery = session.context.delivery_type === "delivery";
  const paymentLabel = {
    pix: "Pix",
    cash: "Dinheiro",
    card: "Cartão na entrega"
  }[session.context.payment_method] || session.context.payment_method;
  const addr = session.context;
  const fullAddress = isDelivery ? [
    addr.street,
    addr.number,
    addr.neighborhood ? `— ${addr.neighborhood}` : "",
    addr.reference ? `(${addr.reference})` : ""
  ].filter(Boolean).join(" ") : "Retirada no balcão";
  const changeLine = session.context.payment_method === "cash" && session.context.needs_change ? `Troco para: ${BRL(Number(session.context.change_for || 0))}` : "";
  const msg = [
    `*📝 Confirme seu pedido — ${storeName}*`,
    "",
    `*Cliente:* ${session.context.customer_name || "—"}`,
    "*Itens:*",
    cartText,
    "",
    `*Entrega:* ${isDelivery ? `Delivery — ${fullAddress}` : "Retirada no balcão"}`,
    `*Pagamento:* ${paymentLabel}`,
    changeLine,
    "",
    `Subtotal: ${BRL(subtotal)}`,
    isDelivery && deliveryFee > 0 ? `Taxa de entrega: ${BRL(deliveryFee)}` : "",
    `*Total: ${BRL(total)}*`,
    "",
    "*1* — CONFIRMAR pedido",
    "*2* — CANCELAR"
  ].filter(Boolean).join("\n");
  session.current_step = "awaiting_confirm";
  await setSession(admin, session);
  await sendText(storeId, phone, msg);
};
const quoteBotDelivery = async (storeId, session)=>{
  const address = session.context;
  const subtotal = session.cart.reduce((sum, item)=>sum + item.unit_price * item.quantity, 0);
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const response = await fetch(`${base}/functions/v1/quote-delivery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        store_id: storeId,
        fulfillment: "delivery",
        subtotal,
        address: {
          street: address.street,
          number: address.number,
          complement: address.reference || undefined,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          cep: address.cep
        }
      })
    });
    const quote = await response.json().catch(()=>null);
    return response.ok ? quote : {
      ok: false,
      reason: quote?.reason || "delivery_quote_failed"
    };
  } catch  {
    return {
      ok: false,
      reason: "delivery_quote_unavailable"
    };
  }
};
const pixKeyLabel = (t)=>({
    cpf: "CPF",
    cnpj: "CNPJ",
    email: "E-mail",
    phone: "Telefone",
    random: "Chave aleatória"
  })[t || ""] || "Chave";
// Fase 1: criação de pedido pela RPC `create_order_with_items` — o ÚNICO
// caminho de criação do bot. Os dois INSERTs diretos em orders/order_items
// saíram: a RPC valida loja ativa/visível, itens (existem, são da loja,
// disponíveis, preço > 0, preços do banco), loja aberta ou pré-pedido,
// pedido mínimo e teto de frete grátis — tudo numa transação, com
// idempotência pela chave da sessão (gerada na confirmação, reutilizada em
// retry). Os parâmetros espelham a edge guest-checkout.
const createOrderViaRpc = async (admin, storeId, phone, session, paymentMethodRpc)=>{
  const isDelivery = session.context.delivery_type === "delivery";
  const deliveryQuote = session.context.delivery_quote || null;
  const deliveryFee = isDelivery ? Number(session.context.delivery_fee || 0) : 0;
  const absorbed = isDelivery ? Number(deliveryQuote?.pricing?.platform_fee_store_absorbed || 0) : 0;
  const addr = session.context;
  const addressString = isDelivery ? [
    addr.street,
    addr.number,
    addr.reference ? `Ref: ${addr.reference}` : ""
  ].filter(Boolean).join(", ") : "Retirada no balcão";
  const quoteSnapshot = isDelivery ? buildDeliveryQuoteSnapshot(deliveryQuote, deliveryFee, addr.resolved_address?.precision) : null;
  if (!session.context.idempotency_key) session.context.idempotency_key = crypto.randomUUID();
  const { data: created, error } = await admin.rpc("create_order_with_items", {
    p_client_id: session.context.client_id,
    p_store_id: storeId,
    p_idempotency_key: session.context.idempotency_key,
    p_items: mapCartToRpcItems(session.cart),
    p_delivery_fee: deliveryFee,
    p_delivery_fee_absorbed: absorbed,
    p_payment_method: paymentMethodRpc,
    p_neighborhood: isDelivery ? session.context.resolved_address?.neighborhood || addr.neighborhood || "não informado" : "RETIRADA",
    p_address_details: isDelivery ? session.context.resolved_address?.normalized_address || addressString : addressString,
    p_delivery_cep: isDelivery ? session.context.resolved_address?.cep || session.context.cep || null : null,
    p_delivery_city: isDelivery ? session.context.resolved_address?.city || session.context.city || null : null,
    p_delivery_state: isDelivery ? session.context.resolved_address?.state || session.context.state || null : null,
    p_client_lat: isDelivery ? session.context.resolved_address?.lat ?? null : null,
    p_client_lng: isDelivery ? session.context.resolved_address?.lng ?? null : null,
    p_needs_change: !!session.context.needs_change,
    p_change_for: Number(session.context.change_for || 0),
    p_is_pickup: !isDelivery,
    p_is_preorder: false,
    p_is_guest: true,
    p_delivery_pin: session.context._delivery_pin || String(Math.floor(1000 + Math.random() * 9000)),
    p_order_source: "whatsapp_bot",
    p_delivery_quote: quoteSnapshot
  });
  return {
    created,
    error,
    quoteSnapshot
  };
};
// Depois da RPC: a RPC monta o metadata só a partir do delivery_quote —
// acrescentar o que o painel/debug lê hoje (merge com o que a RPC gravou,
// sem apagar o delivery_quote). O anon_session_id volta por compatibilidade
// com a busca de pedido em aberto (client_id desconhecido -> anon = telefone).
// `extra` cobre o pix_expires_at do Pix Direto (a RPC não grava).
const patchOrderAfterRpc = async (admin, orderId, phone, session, extra)=>{
  try {
    const { data: row } = await admin.from("orders").select("metadata").eq("id", orderId).maybeSingle();
    const metadata = {
      ...(row?.metadata || {}),
      ...buildBotMetadataPatch(session.context, phone)
    };
    const { error } = await admin.from("orders").update({
      metadata,
      anon_session_id: phone,
      ...(extra || {})
    }).eq("id", orderId);
    if (error) console.error("[bot] post-RPC order patch failed", error);
  } catch (e) {
    console.error("[bot] post-RPC order patch failed", e);
  }
};
const startPixDireto = async (admin, storeId, phone, session, store, storeName)=>{
  // Garante client vinculado + delivery_pin — OBRIGATÓRIO (P1-7): sem
  // client_id o pedido NÃO é criado; a sessão é mantida.
  const clientId = await ensureClient(admin, storeId, phone, session);
  if (!clientId) {
    console.error("[bot] startPixDireto aborted: ensureClient returned null", {
      store_id: storeId,
      phone
    });
    try {
      await sendText(storeId, phone, "❌ Não consegui identificar seu cadastro para gerar o Pix direto. Um atendente já vai te chamar — seu carrinho continua aqui. 🙂");
    } catch (e) {
      console.error("[bot] startPixDireto client-not-identified notify failed", e);
    }
    return {
      ok: false,
      reason: "client_not_identified"
    };
  }
  if (session.context.delivery_type === "delivery") await saveAddressIfNew(admin, session);
  const { created, error } = await createOrderViaRpc(admin, storeId, phone, session, "pix_direto");
  if (error || !created?.order_id) {
    const msg = error?.message || String(error || "order_create_failed");
    console.error("[bot] pix_direto create_order_with_items failed", error);
    const friendly = translateRpcError(msg);
    try {
      await sendText(storeId, phone, friendly.text);
    } catch (e) {
      console.error("[bot] startPixDireto rpc-error notify failed", e);
    }
    return {
      ok: false,
      reason: "rpc_error",
      kind: friendly.kind,
      detail: msg
    };
  }
  const orderId = created.order_id;
  const total = Number(created.total_price || 0);
  const pin = created.delivery_pin || session.context._delivery_pin;
  // A RPC não grava pix_expires_at: +20 min aqui, junto com o metadata.
  const pixExpiresAt = new Date(Date.now() + 20 * 60_000).toISOString();
  await patchOrderAfterRpc(admin, orderId, phone, session, {
    pix_expires_at: pixExpiresAt
  });
  const label = pixKeyLabel(store.pix_direto_key_type);
  const benef = store.pix_direto_beneficiary ? `\n*Favorecido:* ${store.pix_direto_beneficiary}` : "";
  const extra = store.pix_direto_instructions ? `\n\n${store.pix_direto_instructions}` : "";
  const num = shortOrderCode(orderId);
  const link = buildTrackingLink(orderId, phone);
  const msg = [
    `*💠 Pix direto — ${storeName}*`,
    "",
    `*Pedido:* ${num}`,
    `*Valor:* ${BRL(total)}`,
    `*${label}:* ${store.pix_direto_key}${benef}`,
    "",
    `*PIN de entrega:* ${pin}`,
    `*Acompanhe:* ${link}`,
    "",
    `⚠️ O pedido é confirmado *só depois* que o lojista validar o comprovante.`,
    `Você tem *20 minutos* para pagar e enviar o comprovante *aqui mesmo* (foto).${extra}`
  ].join("\n");
  session.context.pix_order_id = orderId;
  session.current_step = "awaiting_pix_proof";
  await setSession(admin, session);
  try {
    await sendText(storeId, phone, msg);
  } catch (e) {
    // O pedido já existe (idempotente): a falha é só do envio — logar e
    // seguir em vez de perder o pedido.
    console.error("[bot] pix_direto send failed (order kept)", e);
  }
  return {
    ok: true,
    order_id: orderId,
    order_number: created.order_number,
    status: created.status,
    total_price: total,
    delivery_pin: pin,
    is_new: created.is_new !== false
  };
};
const uploadPixProofFromBase64 = async (storeId, orderId, base64, mime)=>{
  const base = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ext = mime.includes("png") ? "png" : mime.includes("pdf") ? "pdf" : "jpg";
  const path = `${storeId}/${orderId}.${ext}`;
  const bytes = Uint8Array.from(atob(base64), (c)=>c.charCodeAt(0));
  const r = await fetch(`${base}/storage/v1/object/pix-proofs/${path}?upsert=true`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": mime,
      "x-upsert": "true"
    },
    body: bytes
  });
  if (!r.ok) {
    console.error("[bot] pix proof upload failed", r.status, await r.text().catch(()=>""));
    return null;
  }
  return path;
};
const ensureClient = async (admin, storeId, phone, session)=>{
  if (session.context.client_id) {
    // A saudação já resolve o client_id, e este retorno cedo pulava a
    // resolução do PIN — a RPC recebia um PIN aleatório em vez do PIN do
    // perfil (regressão da Fase 1: na v4 o PIN vinha do ensureClient).
    if (!session.context._delivery_pin) {
      const { data: prof } = await admin.from("profiles").select("delivery_pin").eq("user_id", session.context.client_id).maybeSingle();
      session.context._delivery_pin = prof?.delivery_pin || String(Math.floor(1000 + Math.random() * 9000));
    }
    return session.context.client_id;
  }
  const customerName = String(session.context.customer_name || "").trim();
  try {
    const digits = onlyDigits(phone);
    // Fase 3 (lado do bot): o site grava em `profiles.whatsapp_number` e o
    // bot procurava só em `profiles.phone` (P0-3) — buscar nos dois campos.
    const { data: prof } = await admin.from("profiles").select("user_id, delivery_pin").or(`phone.eq.${digits},whatsapp_number.eq.${digits}`).order("created_at", {
      ascending: false
    }).limit(1).maybeSingle();
    let clientId = prof?.user_id || null;
    let pin = prof?.delivery_pin || String(Math.floor(1000 + Math.random() * 9000));
    if (!clientId) {
      const { data: existing } = await admin.from("guest_customers").select("user_id").eq("phone", phone).maybeSingle();
      if (existing?.user_id) clientId = existing.user_id;
      if (!clientId) {
        const email = `guest+${phone}@guest.itasuper.app`;
        const password = crypto.randomUUID() + crypto.randomUUID();
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            guest: true,
            phone,
            name: customerName,
            source: "whatsapp_bot"
          }
        });
        clientId = created?.user?.id || null;
        if (!clientId && createErr) {
          // Fallback de e-mail duplicado (mesmo padrão da Fase 2): o usuário
          // sintético pode já existir (1ª tentativa falhou depois de criar)
          // — resolver pelo e-mail em vez de desistir. 163 usuários no
          // total: uma varredura paginada basta.
          console.warn("[bot] ensureClient createUser failed, trying email fallback", createErr?.message || createErr);
          try {
            const { data: listed } = await admin.auth.admin.listUsers({
              page: 1,
              perPage: 1000
            });
            const found = (listed?.users || []).find((u)=>u.email === email);
            if (found?.id) {
              console.warn("[bot] ensureClient email fallback healed", {
                phone
              });
              clientId = found.id;
            }
          } catch (listErr) {
            console.error("[bot] ensureClient email fallback failed", listErr);
          }
        }
      }
    }
    if (clientId) {
      // Erros dos upserts passam a ser LOGADOS (antes eram ignorados — é o
      // que explica o PIN nulo do P1-8 sem causa identificada). O pedido não
      // é bloqueado por isso: client_id existe e o PIN vive na sessão.
      const { error: profErr } = await admin.from("profiles").upsert({
        user_id: clientId,
        full_name: customerName || null,
        phone,
        whatsapp_number: digits,
        delivery_pin: pin
      }, {
        onConflict: "user_id"
      });
      if (profErr) console.error("[bot] ensureClient profiles upsert failed", profErr);
      const { error: guestErr } = await admin.from("guest_customers").upsert({
        phone,
        user_id: clientId,
        name: customerName || null,
        last_store_id: storeId,
        consent_at: new Date().toISOString()
      }, {
        onConflict: "phone"
      });
      if (guestErr) console.error("[bot] ensureClient guest_customers upsert failed", guestErr);
      session.context.client_id = clientId;
      session.context._delivery_pin = pin;
    }
    return clientId;
  } catch (e) {
    console.warn("[bot] ensureClient failed", e);
    return null;
  }
};
const saveAddressIfNew = async (admin, session)=>{
  const clientId = session.context.client_id;
  if (!clientId) return;
  const a = session.context;
  if (!a.street || !a.number || !a.neighborhood) return;
  try {
    const { data: existing } = await admin.from("saved_addresses").select("id").eq("user_id", clientId).eq("street", a.street).eq("number", a.number).eq("neighborhood", a.neighborhood).maybeSingle();
    if (existing) return;
    // Fase 1 (P2-9): salvar o endereço COMPLETO — rua/número/bairro/
    // referência + cep, city, state, lat/lng do endereço já resolvido na
    // sessão. Antes o salvo não tinha CEP e o bot perguntava o CEP em todo
    // pedido; com o CEP salvo, o endereço de sempre pula a pergunta.
    const resolved = a.resolved_address || {};
    await admin.from("saved_addresses").insert({
      user_id: clientId,
      street: a.street,
      number: a.number,
      neighborhood: a.neighborhood,
      reference_point: a.reference || null,
      cep: resolved.cep || a.cep || null,
      city: resolved.city || a.city || null,
      state: resolved.state || a.state || null,
      latitude: resolved.lat ?? null,
      longitude: resolved.lng ?? null,
      label: "WhatsApp",
      is_default: false
    });
  } catch (e) {
    console.warn("[bot] saveAddress failed", e);
  }
};
const createOrder = async (admin, storeId, phone, session, storeName)=>{
  const customerName = String(session.context.customer_name || "").trim();
  // ensureClient é OBRIGATÓRIO (P1-7): sem client_id o pedido NÃO é criado.
  // A sessão é mantida (carrinho não se perde) e o bot oferece um atendente.
  const clientId = await ensureClient(admin, storeId, phone, session);
  if (!clientId) {
    console.error("[bot] createOrder aborted: ensureClient returned null", {
      store_id: storeId,
      phone
    });
    try {
      await sendText(storeId, phone, "❌ Não consegui identificar seu cadastro para registrar o pedido. Um atendente já vai te chamar — seu carrinho continua aqui. 🙂");
    } catch (e) {
      console.error("[bot] createOrder client-not-identified notify failed", e);
    }
    return {
      ok: false,
      reason: "client_not_identified"
    };
  }
  if (session.context.delivery_type === "delivery") await saveAddressIfNew(admin, session);
  const paymentMethodRpc = mapPaymentMethodToRpc(session.context.payment_method);
  const { created, error } = await createOrderViaRpc(admin, storeId, phone, session, paymentMethodRpc);
  if (error || !created?.order_id) {
    const msg = error?.message || String(error || "order_create_failed");
    console.error("[bot] create_order_with_items failed", error);
    const friendly = translateRpcError(msg);
    try {
      await sendText(storeId, phone, friendly.text);
    } catch (e) {
      console.error("[bot] createOrder rpc-error notify failed", e);
    }
    // Sessão mantida (awaiting_confirm): o cliente não perde o pedido e pode
    // cancelar (2) ou tentar confirmar de novo (1) com a mesma chave de
    // idempotência — a RPC devolve o pedido existente em vez de duplicar.
    return {
      ok: false,
      reason: "rpc_error",
      kind: friendly.kind,
      detail: msg
    };
  }
  const orderId = created.order_id;
  const orderNumber = created.order_number;
  const status = created.status;
  // Totais da RPC (recalculados pelo catálogo) — não os da sessão.
  const total = Number(created.total_price || 0);
  const pin = created.delivery_pin || session.context._delivery_pin;
  await patchOrderAfterRpc(admin, orderId, phone, session);
  const num = shortOrderCode(orderId);
  const link = buildTrackingLink(orderId, phone);
  // Pré-pedido: a RPC aceita criar scheduled quando a loja aceita — a
  // confirmação informa que ficou agendado para a abertura.
  let scheduledNote = "";
  if (status === "scheduled") {
    const { data: sched } = await admin.from("orders").select("release_at").eq("id", orderId).maybeSingle();
    const when = sched?.release_at ? new Date(sched.release_at).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }) : null;
    scheduledNote = `\n\n🗓️ A loja está fechada agora — seu pedido ficou *agendado para a abertura*${when ? ` (${when})` : ""}.`;
  }
  const msg = `🎉 *Pedido ${num} confirmado!*\n\nA *${storeName}* recebeu seu pedido e vai começar a preparar em instantes.${scheduledNote}\n\n*Total:* ${BRL(total)}\n*PIN de entrega:* ${pin}\n*Acompanhe:* ${link}\n\nVocê será avisado quando o pedido for aceito. ✨`;
  try {
    await sendText(storeId, phone, msg);
  } catch (e) {
    // O pedido já existe (idempotente): a falha é só do envio — logar e
    // seguir para o cooldown em vez de perder o pedido ou duplicá-lo.
    console.error("[bot] order confirmation send failed (order kept)", e);
  }
  await setPostOrderCooldown(admin, storeId, phone, num);
  return {
    ok: true,
    order_id: orderId,
    order_number: orderNumber,
    status,
    total_price: total,
    delivery_pin: pin,
    is_new: created.is_new !== false
  };
};
const isCancel = (t)=>/^(cancelar|sair)$/i.test(normalize(t));
// Opt-out explícito ("PARAR"/"STOP"): NÃO é só "encerrar atendimento".
// Registra a blacklist (whatsapp_send_log kind=opt_out) para o cliente
// nunca mais receber envios automáticos — os webhooks checam essa lista
// antes de despachar o bot ou a saudação. "cancelar"/"sair" continuam
// sendo só "encerrar atendimento" (sem opt-out).
const isOptOutWord = (t)=>/^(parar|stop)[!.,\s]*$/i.test(normalize(t));
const registerOptOut = async (admin, storeId, phone)=>{
  await admin.from("whatsapp_send_log").insert({
    store_id: storeId,
    phone,
    message_hash: "optout",
    kind: "opt_out",
    sent_at: new Date().toISOString()
  });
};
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    headers: cors
  });
  try {
    // Segurança: só aceita chamada interna com token
    const token = req.headers.get("x-internal-token") || "";
    if (token !== Deno.env.get("EVOLUTION_WEBHOOK_TOKEN")) return json({
      error: "forbidden"
    }, 403);
    const body = await req.json();
    const { store_id, phone, text } = body;
    const image_base64 = body?.image_base64;
    const image_mime = body?.image_mime;
    if (!store_id || !phone || typeof text !== "string") return json({
      error: "invalid payload"
    }, 400);
    // Cópia de teste (`whatsapp-bot-handler-teste`): allowlist no topo — só
    // a loja de teste e só o número do Renner. Qualquer outro store_id ou
    // telefone é recusado com 403. A função original (`whatsapp-bot-handler`,
    // v4) fica intacta; o redeploy v4->v5 de produção só acontece na
    // publicação, com a palavra do Renner. O modo teste é detectado pela URL
    // de invocação, então o código é o mesmo nos dois deploys.
    const TEST_STORE_ID = "8197bdd8-f041-410d-acc0-af9ecb448f55";
    const TEST_PHONE_DIGITS = "5514991624997";
    const isTestFunction = new URL(req.url).pathname.endsWith("-teste");
    // Aceita o número de teste e os derivados dele (o T7 usa o mesmo número
    // com dígitos extras para o e-mail guest passar de 255 chars e o
    // createUser falhar). Qualquer outro número continua recusado.
    const phoneDigits = onlyDigits(phone);
    if (isTestFunction && (store_id !== TEST_STORE_ID || !phoneDigits.startsWith(TEST_PHONE_DIGITS))) {
      return json({
        handled: false,
        reason: "test_function_allowlist"
      }, 403);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL"), Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const { data: cfg } = await admin.from("whatsapp_bot_config").select("*").eq("store_id", store_id).maybeSingle();
    if (!cfg || !cfg.enabled) return json({
      handled: false,
      reason: "bot_disabled"
    });
    const { data: store, error: storeErr } = await admin.from("stores").select("name, slug, settings, delivery_mode, delivery_fee_type, own_delivery_fee, delivery_fee, delivery_fee_base, minimum_order_value, pix_direto_enabled, pix_direto_key, pix_direto_key_type, pix_direto_beneficiary, pix_direto_instructions, is_open, force_closed, preorder_enabled, preorder_minutes_before").eq("id", store_id).maybeSingle();
    if (storeErr) console.error("[bot] store select error", storeErr);
    const storeName = store?.name || "loja";
    const settings = store?.settings || {};
    const pixDiretoOn = Boolean(store?.pix_direto_enabled && store?.pix_direto_key);
    const accepts = {
      // Pix direto habilitado sempre permite oferecer "pix" no bot, mesmo se o pix online/máquina estiver off.
      pix: pixDiretoOn || settings.accept_pix_online !== false || settings.accept_pix_machine === true,
      cash: settings.accept_cash !== false,
      card: settings.accept_card !== false
    };
    const storeSlug = store?.slug || "";
    const storeUrl = storeSlug ? `${CANONICAL_HOST}/${storeSlug}` : CANONICAL_HOST;
    // Palavra de escape → encerra bot silenciosamente
    const norm = normalize(text);
    const escapeHit = (cfg.escape_keywords || []).some((k)=>norm.includes(normalize(k)));
    if (escapeHit) {
      await clearSession(admin, store_id, phone);
      await sendText(store_id, phone, "👋 Um atendente humano vai te responder em instantes. Aguarde só um momento.");
      return json({
        handled: true,
        action: "escape"
      });
    }
    // "PARAR" durante o bot = opt-out: registra a blacklist e encerra a
    // sessão. (Defesa em profundidade: os webhooks já interceptam "PARAR"
    // antes de despachar o bot; este trecho cobre invocação direta.)
    // Sem mensagem de despedida, de propósito: quem optou por não receber
    // mais mensagens não recebe nem a confirmação — é o mesmo padrão
    // silencioso dos webhooks (e a despedida seria barrada pela própria
    // blacklist no canal oficial).
    if (isOptOutWord(text)) {
      await registerOptOut(admin, store_id, phone);
      await clearSession(admin, store_id, phone);
      return json({
        handled: true,
        action: "opt_out"
      });
    }
    if (isCancel(text)) {
      await clearSession(admin, store_id, phone);
      await sendText(store_id, phone, "❌ Atendimento encerrado. Se quiser começar de novo, é só mandar *MENU*.");
      return json({
        handled: true,
        action: "cancel"
      });
    }
    let session = await loadSession(admin, store_id, phone);
    // Verifica horário de funcionamento (só bloqueia se não há pedido em andamento).
    if (!session) {
      const { data: hoursRows } = await admin.from("opening_hours").select("day_of_week, open_time, close_time, is_closed_all_day").eq("store_id", store_id);
      const status = getStoreOpenStatus(hoursRows || [], Boolean(store?.force_closed), store?.is_open !== false);
      if (!status.isOpen) {
        const triggerKeywords = Array.from(new Set([
          ...cfg.trigger_keywords || [],
          ...DEFAULT_TRIGGER_KEYWORDS
        ]));
        const triggeredClosed = triggerKeywords.some((k)=>norm.includes(normalize(k)));
        if (!triggeredClosed) return json({
          handled: false,
          reason: "closed_no_trigger"
        });
        await sendText(store_id, phone, `🌙 *${storeName}* está fechada no momento.\n\n${status.reason}.\n\nQuando abrirmos, é só mandar *MENU* que te atendo. 💚`);
        return json({
          handled: true,
          action: "store_closed",
          reason: status.reason
        });
      }
    }
    // Sem sessão: verifica gatilho
    if (!session) {
      const triggerKeywords = Array.from(new Set([
        ...cfg.trigger_keywords || [],
        ...DEFAULT_TRIGGER_KEYWORDS
      ]));
      const triggered = triggerKeywords.some((k)=>norm.includes(normalize(k)));
      if (!triggered) return json({
        handled: false,
        reason: "no_trigger"
      });
      // Reconhece cliente pelo telefone (Fase 3, lado do bot: buscar em
      // `phone` OU `whatsapp_number` — o site grava neste último).
      const digits = onlyDigits(phone);
      const { data: known } = await admin.from("profiles").select("user_id, full_name").or(`phone.eq.${digits},whatsapp_number.eq.${digits}`).order("created_at", {
        ascending: false
      }).limit(1).maybeSingle();
      const knownName = known?.full_name || null;
      const clientId = known?.user_id || null;
      // Verifica se este telefone tem pedido em aberto (não finalizado).
      // "recusado" NÃO é um valor do enum order_status (o valor é
      // pix_direto_recusado) — com ele na lista a query falhava (22P02) e,
      // como o erro era ignorado, o prompt de pedido em aberto NUNCA
      // aparecia. Exclui só os estados terminais.
      const digitsPhone = digits;
      // orders não tem coluna customer_phone; usa client_id (quando conhecido) ou anon_session_id (=phone)
      let openOrdersQuery = admin.from("orders").select("id, order_number, status, created_at").eq("store_id", store_id).not("status", "in", "(entregue,cancelado,finalizado,pix_direto_recusado)").order("created_at", {
        ascending: false
      }).limit(1);
      openOrdersQuery = clientId ? openOrdersQuery.or(`client_id.eq.${clientId},anon_session_id.eq.${digitsPhone}`) : openOrdersQuery.eq("anon_session_id", digitsPhone);
      const { data: openOrders, error: openOrdersError } = await openOrdersQuery;
      if (openOrdersError) console.error("[bot] open-order lookup failed", openOrdersError);
      const openOrder = (openOrders || [])[0];
      if (openOrder) {
        // Fase 1 (item 11): o número curto é SEMPRE o prefixo do UUID
        // (#2A27F312), igual ao painel — o nº sequencial (order_number) não
        // é o que o cliente vê no painel.
        const code = shortOrderCode(openOrder.id);
        const firstName = knownName ? String(knownName).split(" ")[0] : null;
        const hi = firstName ? `Olá, *${firstName}*! 👋` : "Olá! 👋";
        session = {
          store_id,
          phone,
          current_step: "awaiting_existing_order_choice",
          cart: [],
          context: {
            client_id: clientId,
            customer_name: knownName || undefined,
            store_url: storeUrl
          }
        };
        await setSession(admin, session);
        await sendText(store_id, phone, [
          hi,
          "",
          `Você já tem um pedido em aberto na *${storeName}*: *${code}* (status: _${openOrder.status}_).`,
          "",
          "Deseja fazer *outro pedido*?",
          "",
          "*1* — 🛒 Sim, fazer novo pedido",
          "*2* — 💬 Falar com atendente sobre o pedido atual",
          "*3* — ❌ Cancelar / sair"
        ].join("\n"));
        return json({
          handled: true,
          action: "existing_order_prompt"
        });
      }
      // Mensagem de boas-vindas configurada no painel (whatsapp_bot_config.
      // welcome_message): quando preenchida, ela ABRE o menu no lugar da
      // saudação fixa — "{loja}" vira o nome da loja. Sem ela, vale a
      // saudação padrão abaixo. (Antes desta mudança o campo era salvo no
      // painel e nunca lido: a saudação era fixa no código.)
      const customWelcome = String(cfg.welcome_message || "").trim();
      const greeting = customWelcome
        ? customWelcome.replaceAll("{loja}", storeName)
        : knownName ? `Olá, *${String(knownName).split(" ")[0]}*! 👋 Que bom te ver de novo na *${storeName}*.` : `Olá! 👋 Bem-vindo à *${storeName}*.`;
      const menu = [
        greeting,
        "",
        "Como posso te ajudar hoje?",
        "",
        "*1* — 🛒 Fazer pedido aqui pelo WhatsApp",
        "*2* — 📱 Ver cardápio completo no site",
        "*3* — 💬 Falar com um atendente"
      ].join("\n");
      session = {
        store_id,
        phone,
        current_step: "awaiting_main_menu",
        cart: [],
        context: {
          client_id: clientId,
          customer_name: knownName || undefined,
          store_url: storeUrl
        }
      };
      await setSession(admin, session);
      await sendText(store_id, phone, menu);
      return json({
        handled: true,
        action: "welcome"
      });
    }
    // Roteia por estado
    const num = parseInt(text.trim(), 10);
    switch(session.current_step){
      case "awaiting_existing_order_choice":
        {
          if (num === 1) {
            if (session.context.customer_name) {
              session.current_step = "awaiting_main_menu";
              await setSession(admin, session);
              await sendBestEffort(() => sendText(store_id, phone, `Perfeito, *${String(session.context.customer_name).split(" ")[0]}*! Bora escolher. 🛒`));
              await showCategories(admin, store_id, phone, session);
            } else {
              session.current_step = "awaiting_name";
              await setSession(admin, session);
              await sendText(store_id, phone, "*👤 Qual é o seu nome?*");
            }
            return json({
              handled: true,
              action: "new_order_from_existing"
            });
          }
          if (num === 2) {
            await clearSession(admin, store_id, phone);
            await sendText(store_id, phone, "👋 Um atendente humano vai te responder em instantes sobre seu pedido. Aguarde só um momento.");
            return json({
              handled: true,
              action: "escape_existing_order"
            });
          }
          if (num === 3) {
            await clearSession(admin, store_id, phone);
            await sendText(store_id, phone, "❌ Ok, encerrado. Quando quiser, é só mandar *MENU*.");
            return json({
              handled: true,
              action: "cancel_existing_order"
            });
          }
          await sendText(store_id, phone, "Responda com *1*, *2* ou *3*.");
          return json({
            handled: true,
            action: "invalid_existing_order_choice"
          });
        }
      case "awaiting_main_menu":
        {
          if (num === 2) {
            await sendText(store_id, phone, `📱 Aqui está nosso cardápio completo:\n\n${storeUrl}\n\nQualquer dúvida é só chamar! ✨`);
            await clearSession(admin, store_id, phone);
            return json({
              handled: true,
              action: "menu_link_sent"
            });
          }
          if (num === 3) {
            await clearSession(admin, store_id, phone);
            await sendText(store_id, phone, "👋 Um atendente humano vai te responder em instantes. Aguarde só um momento.");
            return json({
              handled: true,
              action: "escape_menu"
            });
          }
          if (num === 1) {
            if (session.context.customer_name) {
              await sendBestEffort(() => sendText(store_id, phone, `Perfeito, *${String(session.context.customer_name).split(" ")[0]}*! Bora escolher. 🛒`));
              await showCategories(admin, store_id, phone, session);
            } else {
              session.current_step = "awaiting_name";
              await setSession(admin, session);
              await sendText(store_id, phone, "*👤 Qual é o seu nome?*");
            }
            return json({
              handled: true,
              action: "chose_order"
            });
          }
          await sendText(store_id, phone, "Responda *1*, *2* ou *3* pra escolher.");
          return json({
            handled: true,
            action: "invalid_menu"
          });
        }
      case "awaiting_name":
        {
          const name = text.trim().slice(0, 80);
          if (name.length < 2) {
            await sendText(store_id, phone, "Nome muito curto. Envie seu nome completo (mínimo 2 letras).");
            return json({
              handled: true,
              action: "invalid_name"
            });
          }
          session.context.customer_name = name;
          await sendBestEffort(() => sendText(store_id, phone, `Prazer, *${name}*! 👋`));
          await showCategories(admin, store_id, phone, session);
          return json({
            handled: true,
            action: "name_saved"
          });
        }
      case "awaiting_category":
        {
          const cats = session.context.categories || [];
          if (!Number.isFinite(num) || num < 1 || num > cats.length) {
            await sendText(store_id, phone, "Não entendi. Responda com o *número* da categoria.");
            return json({
              handled: true,
              action: "invalid_category"
            });
          }
          await showProducts(admin, store_id, phone, session, cats[num - 1]);
          return json({
            handled: true,
            action: "show_products"
          });
        }
      case "awaiting_product":
        {
          if (num === 0) {
            await showCategories(admin, store_id, phone, session);
            return json({
              handled: true,
              action: "back_to_cats"
            });
          }
          const prods = session.context.products || [];
          if (!Number.isFinite(num) || num < 1 || num > prods.length) {
            await sendText(store_id, phone, "Não entendi. Responda com o *número* do item ou *0* para voltar.");
            return json({
              handled: true,
              action: "invalid_product"
            });
          }
          const p = prods[num - 1];
          // Se o produto tem descrição (ex.: "cardápio do dia" — arroz, feijão, mistura...),
          // mostra ao cliente antes de pedir os adicionais obrigatórios.
          if (p.description) {
            await sendBestEffort(() => sendText(store_id, phone, `🍱 *${p.name}*\n${p.description}`));
          }
          const groups = await fetchAddonGroupsFor(admin, store_id, p.id);
          if (groups.length === 0) {
            session.cart.push({
              product_id: p.id,
              name: p.name,
              unit_price: p.price,
              quantity: 1,
              addons: []
            });
            await askObservation(admin, store_id, phone, session);
            return json({
              handled: true,
              action: "added_item"
            });
          }
          session.context.pending_product = {
            product_id: p.id,
            name: p.name,
            base_price: p.price,
            quantity: 1,
            groups,
            group_idx: 0,
            addons: []
          };
          await askAddonGroup(admin, store_id, phone, session);
          return json({
            handled: true,
            action: "ask_addon"
          });
        }
      case "awaiting_addon":
        {
          const pp = session.context.pending_product;
          if (!pp) {
            await showCategories(admin, store_id, phone, session);
            return json({
              handled: true
            });
          }
          const g = pp.groups[pp.group_idx];
          const raw = text.trim();
          const skipped = raw === "0" && g.min === 0;
          let picks = [];
          if (!skipped) {
            picks = raw.split(/[,\s;]+/).map((s)=>parseInt(s, 10)).filter((n)=>Number.isFinite(n) && n >= 1 && n <= g.items.length);
            picks = Array.from(new Set(picks));
            if (g.max === 1 && picks.length > 1) picks = [
              picks[0]
            ];
            if (picks.length < g.min) {
              await sendText(store_id, phone, `Escolha pelo menos *${g.min}* opção(ões) de *${g.name}*.`);
              return json({
                handled: true,
                action: "addon_below_min"
              });
            }
            if (picks.length > g.max) {
              await sendText(store_id, phone, `Escolha no máximo *${g.max}* opção(ões) de *${g.name}*.`);
              return json({
                handled: true,
                action: "addon_above_max"
              });
            }
          }
          for (const i of picks){
            const it = g.items[i - 1];
            pp.addons.push({
              id: it.id,
              group_id: g.id,
              group_name: g.name,
              name: it.name,
              price: it.price
            });
          }
          pp.group_idx += 1;
          session.context.pending_product = pp;
          if (pp.group_idx < pp.groups.length) {
            await askAddonGroup(admin, store_id, phone, session);
            return json({
              handled: true,
              action: "next_addon"
            });
          }
          await finalizeProductWithAddons(admin, store_id, phone, session);
          return json({
            handled: true,
            action: "product_finalized"
          });
        }
      case "awaiting_observation":
        {
          const raw = (text || "").trim();
          if (raw && raw !== "0") {
            const last = session.cart[session.cart.length - 1];
            if (last) last.observations = raw.slice(0, 240);
          }
          await askMore(admin, store_id, phone, session);
          return json({
            handled: true,
            action: "observation_saved"
          });
        }
      case "awaiting_more":
        {
          if (num === 1) {
            await showCategories(admin, store_id, phone, session);
            return json({
              handled: true
            });
          }
          if (num === 2) {
            await askDeliveryType(admin, store_id, phone, session);
            return json({
              handled: true
            });
          }
          await sendText(store_id, phone, "Responda *1* para adicionar mais ou *2* para finalizar.");
          return json({
            handled: true,
            action: "invalid_more"
          });
        }
      case "awaiting_delivery_type":
        {
          if (num === 1) {
            session.context.delivery_type = "delivery";
            await maybeOfferSavedAddress(admin, store_id, phone, session);
          } else if (num === 2) {
            session.context.delivery_type = "retirada";
            const baseMethods = cfg.accepted_payment_methods || [
              "pix",
              "cash",
              "card"
            ];
            const withPix = pixDiretoOn && !baseMethods.includes("pix") ? [
              "pix",
              ...baseMethods
            ] : baseMethods;
            const methods = withPix.filter((m)=>{
              if (m === "pix") return accepts.pix;
              if (m === "cash") return accepts.cash;
              if (m === "card") return accepts.card;
              return true;
            });
            await askPayment(admin, store_id, phone, session, methods, pixDiretoOn);
          } else {
            await sendText(store_id, phone, "Responda *1* para Delivery ou *2* para Retirada.");
          }
          return json({
            handled: true
          });
        }
      case "awaiting_address_choice":
        {
          const saved = session.context.saved_address;
          if (num === 1 && saved) {
            session.context.street = saved.street;
            session.context.number = saved.number;
            session.context.neighborhood = saved.neighborhood;
            session.context.reference = saved.reference_point || saved.complement || "";
            // P2-9: o endereço salvo agora tem CEP — quando tem, pula a
            // pergunta do CEP e vai direto para a referência.
            if (saved.cep) {
              session.context.cep = saved.cep;
              session.context.city = saved.city || null;
              session.context.state = saved.state || null;
              await askReference(admin, store_id, phone, session);
              return json({
                handled: true,
                action: "saved_address_awaiting_reference"
              });
            }
            await askCep(admin, store_id, phone, session);
            return json({
              handled: true,
              action: "saved_address_awaiting_cep"
            });
          }
          if (num === 2) {
            await askStreet(admin, store_id, phone, session);
            return json({
              handled: true,
              action: "new_address"
            });
          }
          await sendText(store_id, phone, "Responda *1* para usar o endereço salvo ou *2* para informar outro.");
          return json({
            handled: true,
            action: "invalid_address_choice"
          });
        }
      case "awaiting_street":
        {
          const street = text.trim();
          if (street.length < 3) {
            await sendText(store_id, phone, "Nome de rua muito curto. Envie o nome completo.");
            return json({
              handled: true,
              action: "invalid_street"
            });
          }
          session.context.street = street;
          await askNumber(admin, store_id, phone, session);
          return json({
            handled: true
          });
        }
      case "awaiting_number":
        {
          session.context.number = text.trim().slice(0, 20) || "SN";
          await askNeighborhood(admin, store_id, phone, session);
          return json({
            handled: true
          });
        }
      case "awaiting_neighborhood":
        {
          const nb = text.trim();
          if (nb.length < 2) {
            await sendText(store_id, phone, "Bairro inválido. Envie o nome do bairro.");
            return json({
              handled: true
            });
          }
          session.context.neighborhood = nb;
          await askCep(admin, store_id, phone, session);
          return json({
            handled: true
          });
        }
      case "awaiting_cep":
        {
          const cep = text.replace(/\D/g, "");
          if (cep.length !== 8) {
            await sendText(store_id, phone, "CEP inválido. Envie os 8 números do CEP, por exemplo *01001-000*.");
            return json({
              handled: true,
              action: "invalid_cep"
            });
          }
          try {
            const via = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await via.json();
            if (data?.erro || !data.localidade || !data.uf) throw new Error("cep_not_found");
            session.context.cep = cep;
            session.context.city = String(data.localidade).trim();
            session.context.state = String(data.uf).trim().toUpperCase();
            await askReference(admin, store_id, phone, session);
          } catch  {
            await sendText(store_id, phone, "Não consegui validar esse CEP. Confira e envie novamente.");
          }
          return json({
            handled: true,
            action: "cep_received"
          });
        }
      case "awaiting_reference":
        {
          const ref = text.trim();
          session.context.reference = ref === "-" || ref === "" ? "" : ref.slice(0, 120);
          const quote = await quoteBotDelivery(store_id, session);
          if (!quote?.ok || !quote?.destination || !quote?.pricing) {
            if (quote?.reason === "no_driver_available") {
              await clearSession(admin, store_id, phone);
              await sendText(store_id, phone, "⚠️ A loja está sem entregador disponível no momento, então não consigo confirmar a entrega agora.\n\nTente novamente em alguns minutos — assim que um entregador estiver online, é só mandar *MENU* para finalizar o pedido por aqui. 🙂");
              return json({
                handled: true,
                action: "no_driver_available"
              });
            }
            const message = quote?.reason === "outside_delivery_area" ? "Esse endereço está fora da área de entrega da loja. Vou pedir o CEP novamente." : "Não consegui confirmar a entrega nesse endereço. Vou pedir o CEP novamente.";
            await sendBestEffort(() => sendText(store_id, phone, message));
            await askCep(admin, store_id, phone, session);
            return json({
              handled: true,
              action: "delivery_quote_failed"
            });
          }
          session.context.resolved_address = quote.destination;
          session.context.delivery_quote = quote;
          session.context.delivery_fee = Number(quote.pricing.delivery_fee || 0);
          await sendDeliveryFeeInfo(store_id, phone, Number(quote.pricing.store_delivery_base || 0), Number(quote.pricing.platform_fee_customer || 0));
          const baseMethods = cfg.accepted_payment_methods || [
            "pix",
            "cash",
            "card"
          ];
          const withPix = pixDiretoOn && !baseMethods.includes("pix") ? [
            "pix",
            ...baseMethods
          ] : baseMethods;
          const methods = withPix.filter((m)=>{
            if (m === "pix") return accepts.pix;
            if (m === "cash") return accepts.cash;
            if (m === "card") return accepts.card;
            return true;
          });
          await askPayment(admin, store_id, phone, session, methods, pixDiretoOn);
          return json({
            handled: true,
            action: "address_saved"
          });
        }
      case "awaiting_payment":
        {
          const opts = session.context.payment_options || [];
          if (!Number.isFinite(num) || num < 1 || num > opts.length) {
            await sendText(store_id, phone, "Responda com o *número* da forma de pagamento.");
            return json({
              handled: true,
              action: "invalid_payment"
            });
          }
          session.context.payment_method = opts[num - 1];
          // Pix + Pix Direto habilitado → fluxo com comprovante
          if (session.context.payment_method === "pix" && session.context.pix_direto_on && pixDiretoOn) {
            const pixResult = await startPixDireto(admin, store_id, phone, session, store, storeName);
            return json({
              handled: true,
              action: "pix_direto_started",
              result: pixResult
            });
          }
          // Se dinheiro → pergunta troco antes de confirmar
          if (session.context.payment_method === "cash") {
            const subtotal = session.cart.reduce((s, i)=>s + i.unit_price * i.quantity, 0);
            const total = subtotal + Number(session.context.delivery_fee || 0);
            await askChange(admin, store_id, phone, session, total);
            return json({
              handled: true,
              action: "ask_change"
            });
          }
          session.context.needs_change = false;
          session.context.change_for = 0;
          await showConfirmation(admin, store_id, phone, session, storeName, Number(store?.minimum_order_value || 0));
          return json({
            handled: true,
            action: "show_confirm"
          });
        }
      case "awaiting_change":
        {
          const raw = normalize(text);
          const subtotal = session.cart.reduce((s, i)=>s + i.unit_price * i.quantity, 0);
          const total = subtotal + Number(session.context.delivery_fee || 0);
          if (/^(nao|não|n|0)$/i.test(raw)) {
            session.context.needs_change = false;
            session.context.change_for = 0;
          } else {
            const value = parseFloat(raw.replace(",", ".").replace(/[^0-9.]/g, ""));
            if (!Number.isFinite(value) || value <= 0) {
              await sendText(store_id, phone, "Não entendi. Envie o *valor em dinheiro* (ex: 50) ou *NAO*.");
              return json({
                handled: true,
                action: "invalid_change"
              });
            }
            if (value < total) {
              await sendText(store_id, phone, `O valor precisa ser maior ou igual ao total (${BRL(total)}). Tente de novo ou envie *NAO*.`);
              return json({
                handled: true,
                action: "change_below_total"
              });
            }
            session.context.needs_change = true;
            session.context.change_for = Math.round(value * 100) / 100;
          }
          await showConfirmation(admin, store_id, phone, session, storeName, Number(store?.minimum_order_value || 0));
          return json({
            handled: true,
            action: "show_confirm"
          });
        }
      case "awaiting_confirm":
        {
          if (num === 1) {
            const orderResult = await createOrder(admin, store_id, phone, session, storeName);
            return json({
              handled: true,
              action: "order_created",
              result: orderResult
            });
          }
          if (num === 2) {
            await clearSession(admin, store_id, phone);
            await sendText(store_id, phone, "❌ Pedido cancelado. Se quiser começar de novo é só mandar *MENU*.");
            return json({
              handled: true,
              action: "cancelled"
            });
          }
          await sendText(store_id, phone, "Responda *1* para CONFIRMAR ou *2* para CANCELAR.");
          return json({
            handled: true,
            action: "invalid_confirm"
          });
        }
      case "awaiting_pix_proof":
        {
          const orderId = session.context.pix_order_id;
          if (!orderId) {
            await clearSession(admin, store_id, phone);
            return json({
              handled: true,
              action: "pix_proof_no_order"
            });
          }
          if (!image_base64) {
            await sendText(store_id, phone, "📸 Envie a *foto do comprovante* do Pix aqui pelo WhatsApp para eu registrar seu pedido.\n\nSe já pagou, faça um print e envie como imagem.");
            return json({
              handled: true,
              action: "pix_proof_awaiting_image"
            });
          }
          const path = await uploadPixProofFromBase64(store_id, orderId, image_base64, image_mime || "image/jpeg");
          if (!path) {
            await sendText(store_id, phone, "⚠️ Não consegui salvar o comprovante. Pode tentar enviar de novo?");
            return json({
              handled: true,
              action: "pix_proof_upload_failed"
            });
          }
          // A atualização precisa continuar válida no momento do commit, não apenas no início do upload.
          const { data: updatedOrder, error: upErr } = await admin.from("orders").update({
            pix_proof_url: path,
            pix_proof_uploaded_at: new Date().toISOString(),
            status: "comprovante_enviado"
          }).eq("id", orderId).eq("status", "aguardando_comprovante").eq("payment_method", "pix_direto").gt("pix_expires_at", new Date().toISOString()).select("id").maybeSingle();
          if (upErr || !updatedOrder) {
            await admin.storage.from("pix-proofs").remove([
              path
            ]);
            if (upErr) console.error("[bot] pix proof update failed", upErr);
            await sendText(store_id, phone, updatedOrder ? "⚠️ Ocorreu um erro ao registrar seu comprovante. Um atendente vai te ajudar." : "⏰ O prazo de 20 minutos para enviar o comprovante terminou. Faça um novo pedido se ainda desejar comprar.");
            await clearSession(admin, store_id, phone);
            return json({
              handled: true,
              action: updatedOrder ? "pix_proof_update_failed" : "pix_proof_expired"
            });
          }
          // O comprovante já foi gravado (update acima): se o envio falhar, o
          // pedido não volta para awaiting_pix_proof — logar e seguir para o
          // cooldown (mesma tolerância da confirmação do pedido, Fase 1).
          try {
            await sendText(store_id, phone, `✅ *Comprovante recebido!*\n\nO lojista vai validar e confirmar seu pedido em instantes. Você recebe uma mensagem assim que for aceito. ✨`);
          } catch (e) {
            console.error("[bot] pix proof ack send failed (proof kept)", e);
          }
          await setPostOrderCooldown(admin, store_id, phone, `#${String(orderId).slice(0, 8).toUpperCase()}`);
          return json({
            handled: true,
            action: "pix_proof_saved"
          });
        }
      case "post_order_cooldown":
        {
          // Silêncio pós-pedido: só avisa 1 vez, depois fica mudo até expirar.
          // Escape/cancelar já são tratados antes de chegar aqui.
          if (!session.context?.notified) {
            session.context = {
              ...session.context || {},
              notified: true
            };
            await setSession(admin, {
              ...session,
              current_step: "post_order_cooldown"
            });
            // Reafirma expires_at longo (setSession usa 15min por padrão).
            await admin.from("whatsapp_bot_sessions").update({
              expires_at: new Date(Date.now() + POST_ORDER_COOLDOWN_MS).toISOString()
            }).eq("store_id", store_id).eq("phone", phone);
            const code = session.context?.order_code || "seu pedido";
            await sendText(store_id, phone, `✅ Recebi! Seu pedido *${code}* já está com a loja.\n\nPra evitar bloqueio do WhatsApp, vou ficar em silêncio por aqui. Quando quiser *falar com atendente*, é só escrever *atendente*. Pra fazer *outro pedido*, mande *MENU* mais tarde. 💚`);
            return json({
              handled: true,
              action: "post_order_ack"
            });
          }
          return json({
            handled: true,
            action: "post_order_silent"
          });
        }
      default:
        await clearSession(admin, store_id, phone);
        return json({
          handled: false,
          reason: "unknown_step"
        });
    }
  } catch (e) {
    console.error("[whatsapp-bot-handler] error", e);
    return json({
      handled: false,
      error: String(e)
    }, 500);
  }
});
