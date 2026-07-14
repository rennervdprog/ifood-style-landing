// Bot de menu guiado do WhatsApp (sem IA).
// Invocado pelo evolution-webhook quando a loja tem `whatsapp_bot_config.enabled = true`.
// Máquina de estados baseada em texto numerado (compatível com qualquer versão do WhatsApp).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const BRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const normalize = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

type Step =
  | "welcome" | "awaiting_main_menu"
  | "awaiting_name" | "awaiting_category" | "awaiting_product"
  | "awaiting_more" | "awaiting_delivery_type"
  | "awaiting_address_choice"
  | "awaiting_street" | "awaiting_number" | "awaiting_neighborhood" | "awaiting_reference"
  | "awaiting_payment" | "awaiting_change" | "awaiting_confirm"
  | "awaiting_pix_proof";

const CANONICAL_HOST = "https://itasuper.com.br";
const onlyDigits = (p: string) => String(p || "").replace(/\D/g, "");

type CartItem = { product_id: string; name: string; unit_price: number; quantity: number };

interface Session {
  id?: string;
  store_id: string;
  phone: string;
  current_step: Step;
  cart: CartItem[];
  context: Record<string, any>;
}

const sendText = async (storeId: string, phone: string, message: string) => {
  const base = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
    Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const r = await fetch(`${base}/functions/v1/evolution-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      "x-internal-token": Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "",
    },
    body: JSON.stringify({ store_id: storeId, phone, message, kind: "bot", force: true }),
  });
  return r.ok;
};

const setSession = async (admin: any, s: Session) => {
  const expires = new Date(Date.now() + 15 * 60_000).toISOString();
  await admin.from("whatsapp_bot_sessions").upsert(
    {
      store_id: s.store_id, phone: s.phone,
      current_step: s.current_step, cart: s.cart, context: s.context,
      last_message_at: new Date().toISOString(), expires_at: expires,
    },
    { onConflict: "store_id,phone" },
  );
};

const clearSession = async (admin: any, storeId: string, phone: string) => {
  await admin.from("whatsapp_bot_sessions").delete().eq("store_id", storeId).eq("phone", phone);
};

const loadSession = async (admin: any, storeId: string, phone: string): Promise<Session | null> => {
  const { data } = await admin.from("whatsapp_bot_sessions")
    .select("*").eq("store_id", storeId).eq("phone", phone).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await clearSession(admin, storeId, phone);
    return null;
  }
  return data as Session;
};

const showCategories = async (admin: any, storeId: string, phone: string, session: Session) => {
  const { data: sections } = await admin.from("menu_sections")
    .select("id, name").eq("store_id", storeId).order("sort_order");
  if (!sections || sections.length === 0) {
    await sendText(storeId, phone, "Desculpe, ainda não temos cardápio disponível. Um atendente já vai te responder.");
    await clearSession(admin, storeId, phone);
    return;
  }
  const lines = ["*📋 Escolha uma categoria:*", ""];
  sections.slice(0, 20).forEach((s: any, i: number) => lines.push(`*${i + 1}* — ${s.name}`));
  lines.push("", "_Responda com o *número* da categoria._", "_Digite *CANCELAR* para sair._");
  session.current_step = "awaiting_category";
  session.context = { ...session.context, categories: sections.slice(0, 20).map((s: any) => s.id) };
  await setSession(admin, session);
  await sendText(storeId, phone, lines.join("\n"));
};

const showProducts = async (admin: any, storeId: string, phone: string, session: Session, categoryId: string) => {
  const { data: products } = await admin.from("products")
    .select("id, name, price, description")
    .eq("store_id", storeId).eq("section_id", categoryId).eq("is_available", true)
    .order("name").limit(20);
  if (!products || products.length === 0) {
    await sendText(storeId, phone, "Essa categoria está sem itens no momento. Escolha outra.");
    await showCategories(admin, storeId, phone, session);
    return;
  }
  const lines = ["*🍽️ Escolha um item:*", ""];
  products.forEach((p: any, i: number) =>
    lines.push(`*${i + 1}* — ${p.name} — ${BRL(Number(p.price))}`),
  );
  lines.push("", "_Responda com o *número* do item._", "_Digite *0* para voltar às categorias._");
  session.current_step = "awaiting_product";
  session.context = { ...session.context, products: products.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price) })) };
  await setSession(admin, session);
  await sendText(storeId, phone, lines.join("\n"));
};

const askMore = async (admin: any, storeId: string, phone: string, session: Session) => {
  const total = session.cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const cartText = session.cart.map(i => `• ${i.quantity}x ${i.name} — ${BRL(i.unit_price * i.quantity)}`).join("\n");
  const msg = `✅ *Item adicionado!*\n\n*Seu carrinho:*\n${cartText}\n\n*Subtotal:* ${BRL(total)}\n\n*1* — Adicionar mais itens\n*2* — Finalizar pedido\n\n_Digite *CANCELAR* para desistir._`;
  session.current_step = "awaiting_more";
  await setSession(admin, session);
  await sendText(storeId, phone, msg);
};

const askDeliveryType = async (admin: any, storeId: string, phone: string, session: Session) => {
  session.current_step = "awaiting_delivery_type";
  await setSession(admin, session);
  await sendText(storeId, phone,
    "*🛵 Como deseja receber?*\n\n*1* — Entrega (delivery)\n*2* — Retirada no balcão");
};

const addressSummary = (a: any) => {
  const parts = [a.street, a.number, a.neighborhood ? `— ${a.neighborhood}` : ""].filter(Boolean);
  const s = parts.join(" ").trim();
  return a.reference || a.reference_point ? `${s} (${a.reference || a.reference_point})` : s;
};

const maybeOfferSavedAddress = async (admin: any, storeId: string, phone: string, session: Session) => {
  const clientId = session.context.client_id;
  if (clientId) {
    const { data: addrs } = await admin
      .from("saved_addresses")
      .select("id, street, number, neighborhood, reference_point, complement")
      .eq("user_id", clientId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    const last = addrs?.[0];
    if (last) {
      session.context.saved_address = last;
      session.current_step = "awaiting_address_choice";
      await setSession(admin, session);
      await sendText(storeId, phone,
        `*📍 Entregar no endereço de sempre?*\n\n${addressSummary(last)}\n\n*1* — Sim, entregar aí\n*2* — Usar outro endereço`);
      return true;
    }
  }
  await askStreet(admin, storeId, phone, session);
  return false;
};

const askStreet = async (admin: any, storeId: string, phone: string, session: Session) => {
  session.current_step = "awaiting_street";
  await setSession(admin, session);
  await sendText(storeId, phone, "*📍 Qual o nome da *rua*?*\n\n_Exemplo: Rua das Flores_");
};
const askNumber = async (admin: any, storeId: string, phone: string, session: Session) => {
  session.current_step = "awaiting_number";
  await setSession(admin, session);
  await sendText(storeId, phone, "*🔢 Qual o *número*?*\n\n_Se não tiver, responda *SN*._");
};
const askNeighborhood = async (admin: any, storeId: string, phone: string, session: Session) => {
  session.current_step = "awaiting_neighborhood";
  await setSession(admin, session);
  await sendText(storeId, phone, "*🏘️ Qual o *bairro*?*");
};
const askReference = async (admin: any, storeId: string, phone: string, session: Session) => {
  session.current_step = "awaiting_reference";
  await setSession(admin, session);
  await sendText(storeId, phone, "*📌 Complemento / ponto de referência?*\n\n_Ex: apto 12, ao lado da praça._\n_Se não tiver, responda *-*._");
};
const askChange = async (admin: any, storeId: string, phone: string, session: Session, total: number) => {
  session.current_step = "awaiting_change";
  await setSession(admin, session);
  await sendText(storeId, phone,
    `*💵 Precisa de troco?*\n\nSeu total é ${BRL(total)}.\n\nResponda com o *valor em dinheiro* que vai entregar (ex: *50*), ou *NAO* se não precisar de troco.`);
};

const askPayment = async (admin: any, storeId: string, phone: string, session: Session, methods: string[], pixDiretoOn = false) => {
  const opts: string[] = [];
  const map: Record<string, string> = {
    pix: pixDiretoOn ? "Pix direto (chave do lojista)" : "Pix (na entrega/retirada)",
    cash: "Dinheiro",
    card: "Cartão na entrega",
  };
  const available = methods.filter(m => map[m]);
  available.forEach((m, i) => opts.push(`*${i + 1}* — ${map[m]}`));
  session.current_step = "awaiting_payment";
  session.context = { ...session.context, payment_options: available, pix_direto_on: pixDiretoOn };
  await setSession(admin, session);
  await sendText(storeId, phone, `*💰 Forma de pagamento:*\n\n${opts.join("\n")}`);
};

const showConfirmation = async (admin: any, storeId: string, phone: string, session: Session, storeName: string) => {
  const subtotal = session.cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const deliveryFee = Number(session.context.delivery_fee || 0);
  const total = subtotal + deliveryFee;
  const cartText = session.cart.map(i => `• ${i.quantity}x ${i.name} — ${BRL(i.unit_price * i.quantity)}`).join("\n");
  const isDelivery = session.context.delivery_type === "delivery";
  const paymentLabel = ({ pix: "Pix", cash: "Dinheiro", card: "Cartão na entrega" } as any)[session.context.payment_method] || session.context.payment_method;
  const addr = session.context;
  const fullAddress = isDelivery
    ? [addr.street, addr.number, addr.neighborhood ? `— ${addr.neighborhood}` : "", addr.reference ? `(${addr.reference})` : ""]
        .filter(Boolean).join(" ")
    : "Retirada no balcão";
  const changeLine = session.context.payment_method === "cash" && session.context.needs_change
    ? `Troco para: ${BRL(Number(session.context.change_for || 0))}` : "";
  const msg = [
    `*📝 Confirme seu pedido — ${storeName}*`, "",
    `*Cliente:* ${session.context.customer_name || "—"}`,
    "*Itens:*", cartText, "",
    `*Entrega:* ${isDelivery ? `Delivery — ${fullAddress}` : "Retirada no balcão"}`,
    `*Pagamento:* ${paymentLabel}`,
    changeLine,
    "",
    `Subtotal: ${BRL(subtotal)}`,
    isDelivery && deliveryFee > 0 ? `Taxa de entrega: ${BRL(deliveryFee)}` : "",
    `*Total: ${BRL(total)}*`,
    "",
    "*1* — CONFIRMAR pedido",
    "*2* — CANCELAR",
  ].filter(Boolean).join("\n");
  session.current_step = "awaiting_confirm";
  await setSession(admin, session);
  await sendText(storeId, phone, msg);
};

const pixKeyLabel = (t?: string | null) =>
  ({ cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", random: "Chave aleatória" } as any)[t || ""] || "Chave";

const startPixDireto = async (admin: any, storeId: string, phone: string, session: Session, store: any, storeName: string) => {
  const subtotal = session.cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const deliveryFee = Number(session.context.delivery_fee || 0);
  const total = subtotal + deliveryFee;
  const isDelivery = session.context.delivery_type === "delivery";
  const addr = session.context;
  const addressString = isDelivery
    ? [addr.street, addr.number, addr.reference ? `Ref: ${addr.reference}` : ""].filter(Boolean).join(", ")
    : "Retirada no balcão";

  // Garante client vinculado + delivery_pin
  const clientId = await ensureClient(admin, storeId, phone, session);
  const pin = (session.context as any)._delivery_pin || String(Math.floor(1000 + Math.random() * 9000));

  const { data: order, error } = await admin.from("orders").insert({
    store_id: storeId,
    client_id: clientId,
    status: "aguardando_comprovante",
    subtotal,
    delivery_fee: deliveryFee,
    total_price: total,
    payment_method: "pix_direto",
    neighborhood: isDelivery ? (addr.neighborhood || "não informado") : "RETIRADA",
    address_details: addressString,
    needs_change: false,
    change_for: 0,
    is_guest: true,
    order_source: "whatsapp_bot",
    delivery_pin: pin,
    pix_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    anon_session_id: phone,
    metadata: {
      source: "whatsapp_bot",
      customer_phone: phone,
      customer_name: session.context.customer_name,
      address_street: addr.street || null,
      address_number: addr.number || null,
      address_neighborhood: addr.neighborhood || null,
      address_reference: addr.reference || null,
    },
  }).select("id").single();
  if (error || !order) {
    console.error("[bot] pix_direto order insert failed", error);
    await sendText(storeId, phone, "❌ Erro ao gerar Pix direto. Um atendente já vai te chamar.");
    await clearSession(admin, storeId, phone);
    return;
  }
  const items = session.cart.map(i => ({
    order_id: order.id, product_id: i.product_id,
    quantity: i.quantity, unit_price: i.unit_price, addons: [],
  }));
  await admin.from("order_items").insert(items);

  const label = pixKeyLabel(store.pix_direto_key_type);
  const benef = store.pix_direto_beneficiary ? `\n*Favorecido:* ${store.pix_direto_beneficiary}` : "";
  const extra = store.pix_direto_instructions ? `\n\n${store.pix_direto_instructions}` : "";
  const msg = [
    `*💠 Pix direto — ${storeName}*`, "",
    `*Valor:* ${BRL(total)}`,
    `*${label}:* ${store.pix_direto_key}${benef}`,
    "",
    `⚠️ O pedido é confirmado *só depois* que o lojista validar o comprovante.`,
    `Você tem *20 minutos* para pagar e enviar o comprovante *aqui mesmo* (foto).${extra}`,
  ].join("\n");

  session.context.pix_order_id = order.id;
  session.current_step = "awaiting_pix_proof";
  await setSession(admin, session);
  await sendText(storeId, phone, msg);
};

const uploadPixProofFromBase64 = async (
  storeId: string, orderId: string, base64: string, mime: string
): Promise<string | null> => {
  const base = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;
  const ext = mime.includes("png") ? "png" : mime.includes("pdf") ? "pdf" : "jpg";
  const path = `${storeId}/${orderId}.${ext}`;
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const r = await fetch(`${base}/storage/v1/object/pix-proofs/${path}?upsert=true`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": mime, "x-upsert": "true" },
    body: bytes,
  });
  if (!r.ok) {
    console.error("[bot] pix proof upload failed", r.status, await r.text().catch(() => ""));
    return null;
  }
  return path;
};

const ensureClient = async (admin: any, storeId: string, phone: string, session: Session): Promise<string | null> => {
  if (session.context.client_id) return session.context.client_id;
  const customerName = String(session.context.customer_name || "").trim();
  try {
    const { data: prof } = await admin.from("profiles")
      .select("user_id, delivery_pin").eq("phone", phone).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    let clientId: string | null = (prof as any)?.user_id || null;
    let pin = (prof as any)?.delivery_pin || String(Math.floor(1000 + Math.random() * 9000));
    if (!clientId) {
      const { data: existing } = await admin.from("guest_customers")
        .select("user_id").eq("phone", phone).maybeSingle();
      if (existing?.user_id) clientId = existing.user_id;
      if (!clientId) {
        const email = `guest+${phone}@guest.itasuper.app`;
        const password = crypto.randomUUID() + crypto.randomUUID();
        const { data: created } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { guest: true, phone, name: customerName, source: "whatsapp_bot" },
        });
        clientId = created?.user?.id || null;
      }
    }
    if (clientId) {
      await admin.from("profiles").upsert(
        { user_id: clientId, full_name: customerName || null, phone, delivery_pin: pin } as any,
        { onConflict: "user_id" },
      );
      await admin.from("guest_customers").upsert(
        { phone, user_id: clientId, name: customerName || null, last_store_id: storeId, consent_at: new Date().toISOString() } as any,
        { onConflict: "phone" },
      );
      session.context.client_id = clientId;
      (session.context as any)._delivery_pin = pin;
    }
    return clientId;
  } catch (e) {
    console.warn("[bot] ensureClient failed", e);
    return null;
  }
};

const saveAddressIfNew = async (admin: any, session: Session) => {
  const clientId = session.context.client_id;
  if (!clientId) return;
  const a = session.context;
  if (!a.street || !a.number || !a.neighborhood) return;
  try {
    const { data: existing } = await admin.from("saved_addresses")
      .select("id").eq("user_id", clientId)
      .eq("street", a.street).eq("number", a.number).eq("neighborhood", a.neighborhood)
      .maybeSingle();
    if (existing) return;
    await admin.from("saved_addresses").insert({
      user_id: clientId, street: a.street, number: a.number, neighborhood: a.neighborhood,
      reference_point: a.reference || null, label: "WhatsApp", is_default: false,
    });
  } catch (e) {
    console.warn("[bot] saveAddress failed", e);
  }
};

const createOrder = async (admin: any, storeId: string, phone: string, session: Session, storeName: string) => {
  const subtotal = session.cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const deliveryFee = Number(session.context.delivery_fee || 0);
  const total = subtotal + deliveryFee;
  const isDelivery = session.context.delivery_type === "delivery";
  const customerName = String(session.context.customer_name || "").trim();
  const addr = session.context;
  const addressString = isDelivery
    ? [addr.street, addr.number, addr.reference ? `Ref: ${addr.reference}` : ""].filter(Boolean).join(", ")
    : "Retirada no balcão";

  const clientId = await ensureClient(admin, storeId, phone, session);
  if (isDelivery) await saveAddressIfNew(admin, session);

  const { data: order, error } = await admin.from("orders").insert({
    store_id: storeId,
    client_id: clientId,
    status: "pendente",
    subtotal,
    delivery_fee: deliveryFee,
    total_price: total,
    payment_method: session.context.payment_method,
    neighborhood: isDelivery ? (session.context.neighborhood || "não informado") : "RETIRADA",
    address_details: addressString,
    needs_change: !!session.context.needs_change,
    change_for: Number(session.context.change_for || 0),
    is_guest: true,
    order_source: "whatsapp_bot",
    delivery_pin: (session.context as any)._delivery_pin || String(Math.floor(1000 + Math.random() * 9000)),
    metadata: {
      source: "whatsapp_bot",
      customer_phone: phone,
      customer_name: customerName,
      address_street: addr.street || null,
      address_number: addr.number || null,
      address_neighborhood: addr.neighborhood || null,
      address_reference: addr.reference || null,
    },
  }).select("id, order_number").single();
  if (error || !order) {
    console.error("[bot] order insert failed", error);
    await sendText(storeId, phone, "❌ Erro ao registrar seu pedido. Um atendente já vai te chamar.");
    await clearSession(admin, storeId, phone);
    return;
  }
  const items = session.cart.map(i => ({
    order_id: order.id, product_id: i.product_id,
    quantity: i.quantity, unit_price: i.unit_price, addons: [],
  }));
  await admin.from("order_items").insert(items);
  const num = `#${order.id.slice(0, 8).toUpperCase()}`;
  await sendText(storeId, phone,
    `🎉 *Pedido ${num} confirmado!*\n\nA *${storeName}* recebeu seu pedido e vai começar a preparar em instantes.\n\nVocê será avisado quando o pedido for aceito. ✨`);
  await clearSession(admin, storeId, phone);
};

const isCancel = (t: string) => /^(cancelar|sair|parar)$/i.test(normalize(t));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Segurança: só aceita chamada interna com token
    const token = req.headers.get("x-internal-token") || "";
    if (token !== Deno.env.get("EVOLUTION_WEBHOOK_TOKEN")) return json({ error: "forbidden" }, 403);

    const { store_id, phone, text } = await req.json();
    if (!store_id || !phone || typeof text !== "string") return json({ error: "invalid payload" }, 400);

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL")!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY"))!,
    );

    const { data: cfg } = await admin.from("whatsapp_bot_config")
      .select("*").eq("store_id", store_id).maybeSingle();
    if (!cfg || !cfg.enabled) return json({ handled: false, reason: "bot_disabled" });

    const { data: store, error: storeErr } = await admin.from("stores")
      .select("name, settings, delivery_mode, delivery_fee_type, own_delivery_fee, delivery_fee, delivery_fee_base, minimum_order_value")
      .eq("id", store_id).maybeSingle();
    if (storeErr) console.error("[bot] store select error", storeErr);
    const storeName = store?.name || "loja";
    const settings = (store?.settings || {}) as Record<string, any>;
    const accepts = {
      pix: settings.accept_pix_online !== false || settings.accept_pix_machine === true,
      cash: settings.accept_cash !== false,
      card: settings.accept_card !== false,
    };

    // Palavra de escape → encerra bot silenciosamente
    const norm = normalize(text);
    const escapeHit = (cfg.escape_keywords || []).some((k: string) => norm.includes(normalize(k)));
    if (escapeHit) {
      await clearSession(admin, store_id, phone);
      await sendText(store_id, phone, "👋 Um atendente humano vai te responder em instantes. Aguarde só um momento.");
      return json({ handled: true, action: "escape" });
    }

    if (isCancel(text)) {
      await clearSession(admin, store_id, phone);
      await sendText(store_id, phone, "❌ Atendimento encerrado. Se quiser começar de novo, é só mandar *MENU*.");
      return json({ handled: true, action: "cancel" });
    }

    let session = await loadSession(admin, store_id, phone);

    // Sem sessão: verifica gatilho
    if (!session) {
      const triggered = (cfg.trigger_keywords || []).some((k: string) => norm.includes(normalize(k)));
      if (!triggered) return json({ handled: false, reason: "no_trigger" });
      const welcome = cfg.welcome_message
        ? String(cfg.welcome_message).replace(/\{loja\}/g, storeName)
        : `Olá! 👋 Aqui é o atendimento automático da *${storeName}*.\n\nPosso te ajudar a fazer seu pedido pelo WhatsApp mesmo. Vamos lá?`;
      await sendText(store_id, phone, welcome);
      // Antes de mostrar o cardápio, pede o nome do cliente
      session = { store_id, phone, current_step: "awaiting_name", cart: [], context: {} };
      await setSession(admin, session);
      await sendText(store_id, phone, "*👤 Qual é o seu *nome*?*");
      return json({ handled: true, action: "welcome" });
    }

    // Roteia por estado
    const num = parseInt(text.trim(), 10);
    switch (session.current_step) {
      case "awaiting_name": {
        const name = text.trim().slice(0, 80);
        if (name.length < 2) {
          await sendText(store_id, phone, "Nome muito curto. Envie seu nome completo (mínimo 2 letras).");
          return json({ handled: true, action: "invalid_name" });
        }
        session.context.customer_name = name;
        await sendText(store_id, phone, `Prazer, *${name}*! 👋`);
        await showCategories(admin, store_id, phone, session);
        return json({ handled: true, action: "name_saved" });
      }
      case "awaiting_category": {
        const cats: string[] = session.context.categories || [];
        if (!Number.isFinite(num) || num < 1 || num > cats.length) {
          await sendText(store_id, phone, "Não entendi. Responda com o *número* da categoria.");
          return json({ handled: true, action: "invalid_category" });
        }
        await showProducts(admin, store_id, phone, session, cats[num - 1]);
        return json({ handled: true, action: "show_products" });
      }
      case "awaiting_product": {
        if (num === 0) { await showCategories(admin, store_id, phone, session); return json({ handled: true, action: "back_to_cats" }); }
        const prods: any[] = session.context.products || [];
        if (!Number.isFinite(num) || num < 1 || num > prods.length) {
          await sendText(store_id, phone, "Não entendi. Responda com o *número* do item ou *0* para voltar.");
          return json({ handled: true, action: "invalid_product" });
        }
        const p = prods[num - 1];
        session.cart.push({ product_id: p.id, name: p.name, unit_price: p.price, quantity: 1 });
        await askMore(admin, store_id, phone, session);
        return json({ handled: true, action: "added_item" });
      }
      case "awaiting_more": {
        if (num === 1) { await showCategories(admin, store_id, phone, session); return json({ handled: true }); }
        if (num === 2) { await askDeliveryType(admin, store_id, phone, session); return json({ handled: true }); }
        await sendText(store_id, phone, "Responda *1* para adicionar mais ou *2* para finalizar.");
        return json({ handled: true, action: "invalid_more" });
      }
      case "awaiting_delivery_type": {
        if (num === 1) {
          session.context.delivery_type = "delivery";
          await askStreet(admin, store_id, phone, session);
        } else if (num === 2) {
          session.context.delivery_type = "retirada";
          const methods = (cfg.accepted_payment_methods || ["pix", "cash", "card"]).filter((m: string) => {
            if (m === "pix") return accepts.pix;
            if (m === "cash") return accepts.cash;
            if (m === "card") return accepts.card;
            return true;
          });
          await askPayment(admin, store_id, phone, session, methods);
        } else {
          await sendText(store_id, phone, "Responda *1* para Delivery ou *2* para Retirada.");
        }
        return json({ handled: true });
      }
      case "awaiting_street": {
        const street = text.trim();
        if (street.length < 3) {
          await sendText(store_id, phone, "Nome de rua muito curto. Envie o nome completo.");
          return json({ handled: true, action: "invalid_street" });
        }
        session.context.street = street;
        await askNumber(admin, store_id, phone, session);
        return json({ handled: true });
      }
      case "awaiting_number": {
        session.context.number = text.trim().slice(0, 20) || "SN";
        await askNeighborhood(admin, store_id, phone, session);
        return json({ handled: true });
      }
      case "awaiting_neighborhood": {
        const nb = text.trim();
        if (nb.length < 2) {
          await sendText(store_id, phone, "Bairro inválido. Envie o nome do bairro.");
          return json({ handled: true });
        }
        session.context.neighborhood = nb;
        await askReference(admin, store_id, phone, session);
        return json({ handled: true });
      }
      case "awaiting_reference": {
        const ref = text.trim();
        session.context.reference = (ref === "-" || ref === "") ? "" : ref.slice(0, 120);
        // Cálculo simples da taxa: usa a taxa fixa da loja (own_delivery_fee) + taxa da plataforma (R$ 0,99).
        // Não usamos cálculo por km porque o bot não tem GPS/CEP validado.
        const PLATFORM_FEE = 0.99;
        const flat =
          Number(store?.own_delivery_fee || 0) ||
          Number(store?.delivery_fee || 0) ||
          Number(store?.delivery_fee_base || 0);
        session.context.delivery_fee = Math.round((flat + PLATFORM_FEE) * 100) / 100;
        const methods = (cfg.accepted_payment_methods || ["pix", "cash", "card"]).filter((m: string) => {
          if (m === "pix") return accepts.pix;
          if (m === "cash") return accepts.cash;
          if (m === "card") return accepts.card;
          return true;
        });
        await askPayment(admin, store_id, phone, session, methods);
        return json({ handled: true, action: "address_saved" });
      }
      case "awaiting_payment": {
        const opts: string[] = session.context.payment_options || [];
        if (!Number.isFinite(num) || num < 1 || num > opts.length) {
          await sendText(store_id, phone, "Responda com o *número* da forma de pagamento.");
          return json({ handled: true, action: "invalid_payment" });
        }
        session.context.payment_method = opts[num - 1];
        // Se dinheiro → pergunta troco antes de confirmar
        if (session.context.payment_method === "cash") {
          const subtotal = session.cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
          const total = subtotal + Number(session.context.delivery_fee || 0);
          await askChange(admin, store_id, phone, session, total);
          return json({ handled: true, action: "ask_change" });
        }
        session.context.needs_change = false;
        session.context.change_for = 0;
        await showConfirmation(admin, store_id, phone, session, storeName);
        return json({ handled: true, action: "show_confirm" });
      }
      case "awaiting_change": {
        const raw = normalize(text);
        const subtotal = session.cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const total = subtotal + Number(session.context.delivery_fee || 0);
        if (/^(nao|não|n|0)$/i.test(raw)) {
          session.context.needs_change = false;
          session.context.change_for = 0;
        } else {
          const value = parseFloat(raw.replace(",", ".").replace(/[^0-9.]/g, ""));
          if (!Number.isFinite(value) || value <= 0) {
            await sendText(store_id, phone, "Não entendi. Envie o *valor em dinheiro* (ex: 50) ou *NAO*.");
            return json({ handled: true, action: "invalid_change" });
          }
          if (value < total) {
            await sendText(store_id, phone, `O valor precisa ser maior ou igual ao total (${BRL(total)}). Tente de novo ou envie *NAO*.`);
            return json({ handled: true, action: "change_below_total" });
          }
          session.context.needs_change = true;
          session.context.change_for = Math.round(value * 100) / 100;
        }
        await showConfirmation(admin, store_id, phone, session, storeName);
        return json({ handled: true, action: "show_confirm" });
      }
      case "awaiting_confirm": {
        if (num === 1) {
          await createOrder(admin, store_id, phone, session, storeName);
          return json({ handled: true, action: "order_created" });
        }
        if (num === 2) {
          await clearSession(admin, store_id, phone);
          await sendText(store_id, phone, "❌ Pedido cancelado. Se quiser começar de novo é só mandar *MENU*.");
          return json({ handled: true, action: "cancelled" });
        }
        await sendText(store_id, phone, "Responda *1* para CONFIRMAR ou *2* para CANCELAR.");
        return json({ handled: true, action: "invalid_confirm" });
      }
      default:
        await clearSession(admin, store_id, phone);
        return json({ handled: false, reason: "unknown_step" });
    }
  } catch (e) {
    console.error("[whatsapp-bot-handler] error", e);
    return json({ handled: false, error: String(e) }, 500);
  }
});