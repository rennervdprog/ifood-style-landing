// Agente de impressão ItaSuper — canal seguro do programa Windows da loja.
//
// Autocontida (sem _shared), service role. Ações (POST JSON):
//   { action: "pair", code, printer_name?, app_version? }
//       Troca o código de pareamento (6 dígitos, gerado no painel, 30 min,
//       uso único) por um token de agente. Só o hash SHA-256 do token fica
//       gravado (print_agents.token_hash).
//   { action: "poll", printer_name?, app_version? }  [Bearer <agent_token>]
//       Devolve os pedidos imprimíveis da loja JÁ reivindicados
//       (printed_at gravado de forma atômica — a mesma trava do painel:
//       quem reivindica, imprime; o outro desiste). Respeita o modo de
//       impressão da loja (settings.print_mode_delivery):
//         auto      -> status pendente + preparando
//         on_accept -> só preparando (depois do aceite, manual ou automático)
//         manual    -> nenhum (o agente não imprime)
//       Janela: últimas 6h, sem printed_at, fora pedidos de PDV, até 5.
//   { action: "release", order_id }  [Bearer <agent_token>]
//       A impressão local falhou depois da reivindicação: libera o
//       printed_at para a próxima tentativa (painel ou agente).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

interface AgentBody {
  action?: unknown;
  code?: unknown;
  order_id?: unknown;
  printer_name?: unknown;
  app_version?: unknown;
}

interface AgentRow {
  id: string;
  store_id: string;
  token_hash: string | null;
  revoked_at: string | null;
}

interface StoreRow {
  id: string;
  name: string;
  cnpj_cpf: string | null;
  settings: Record<string, unknown> | null;
}

const asStr = (v: unknown): string => (typeof v === "string" ? v : "");

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function paymentLabel(method: string): string {
  const m = method.toLowerCase();
  if (m.includes("pix")) return "Pix";
  if (m.includes("dinheiro") || m.includes("cash")) return "Dinheiro";
  if (m.includes("credito") || m.includes("crédito")) return "Cartão de crédito";
  if (m.includes("debito") || m.includes("débito")) return "Cartão de débito";
  if (m.includes("cartao") || m.includes("cartão") || m.includes("card")) return "Cartão";
  return method ? method.charAt(0).toUpperCase() + method.slice(1) : "—";
}

function addressText(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const d = details as Record<string, unknown>;
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = d[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return "";
  };
  const street = pick("street", "rua", "address", "logradouro");
  const number = pick("number", "numero", "número");
  const complement = pick("complement", "complemento");
  const parts = [street && number ? `${street}, ${number}` : street, complement].filter(Boolean);
  return parts.join(" - ");
}

// A observação geral do pedido não tem coluna própria em orders: o checkout
// a guarda dentro de metadata/address_details, conforme a origem do pedido.
function generalNote(...sources: unknown[]): string | null {
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    const d = src as Record<string, unknown>;
    for (const k of ["notes", "observations", "observation", "obs"]) {
      const v = d[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

const fmtSP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body: AgentBody;
  try {
    body = (await req.json()) as AgentBody;
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  const action = asStr(body.action);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ── Pareamento ──────────────────────────────────────────────────────────
  if (action === "pair") {
    const code = asStr(body.code).replace(/\D/g, "");
    if (code.length !== 6) return json({ error: "Código inválido." }, 400);

    const { data: rows, error } = await sb
      .from("print_agents")
      .select("id, store_id, token_hash, revoked_at, pairing_expires_at")
      .eq("pairing_code", code)
      .is("token_hash", null)
      .is("revoked_at", null)
      .gt("pairing_expires_at", new Date().toISOString())
      .limit(1);
    if (error) return json({ error: "Erro ao validar o código." }, 500);
    const row = rows?.[0];
    if (!row) return json({ error: "Código inválido ou expirado." }, 400);

    const token = newToken();
    const tokenHash = await sha256Hex(token);
    const { error: upErr } = await sb
      .from("print_agents")
      .update({
        token_hash: tokenHash,
        pairing_code: null,
        pairing_expires_at: null,
        printer_name: asStr(body.printer_name) || null,
        app_version: asStr(body.app_version) || null,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .is("token_hash", null);
    if (upErr) return json({ error: "Erro ao concluir o pareamento." }, 500);

    const { data: store } = await sb.from("stores").select("name").eq("id", row.store_id).maybeSingle();
    return json({ agent_token: token, store_id: row.store_id, store_name: store?.name ?? "Loja" });
  }

  // ── Autenticação do agente (poll / release) ─────────────────────────────
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ error: "Não autorizado." }, 401);
  const tokenHash = await sha256Hex(token);
  const { data: agentRows } = await sb
    .from("print_agents")
    .select("id, store_id, token_hash, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .limit(1);
  const agent = (agentRows?.[0] ?? null) as AgentRow | null;
  if (!agent) return json({ error: "Não autorizado." }, 401);

  if (action === "release") {
    const orderId = asStr(body.order_id);
    if (!orderId) return json({ error: "order_id obrigatório." }, 400);
    await sb
      .from("orders")
      .update({ printed_at: null })
      .eq("id", orderId)
      .eq("store_id", agent.store_id)
      .not("printed_at", "is", null);
    return json({ ok: true });
  }

  if (action !== "poll") return json({ error: "Ação desconhecida." }, 400);

  // ── Poll: presença + pedidos imprimíveis reivindicados ─────────────────
  await sb
    .from("print_agents")
    .update({
      last_seen_at: new Date().toISOString(),
      printer_name: asStr(body.printer_name) || undefined,
      app_version: asStr(body.app_version) || undefined,
    })
    .eq("id", agent.id);

  const { data: storeData } = await sb
    .from("stores")
    .select("id, name, cnpj_cpf, settings")
    .eq("id", agent.store_id)
    .maybeSingle();
  const store = storeData as StoreRow | null;
  if (!store) return json({ jobs: [] });

  const settings = store.settings ?? {};
  const modeRaw = settings["print_mode_delivery"];
  const mode = typeof modeRaw === "string"
    ? modeRaw
    : settings["auto_print_delivery"] === false
    ? "on_accept"
    : "auto";
  const statuses = mode === "auto"
    ? ["pendente", "preparando"]
    : mode === "on_accept"
    ? ["preparando"]
    : [];
  if (statuses.length === 0) return json({ jobs: [] });

  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: candidates } = await sb
    .from("orders")
    .select("id")
    .eq("store_id", store.id)
    .in("status", statuses)
    .is("printed_at", null)
    .or("order_source.is.null,order_source.neq.pdv")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(5);

  const jobs: unknown[] = [];
  for (const cand of candidates ?? []) {
    // Reivindicação atômica: só quem grava o printed_at imprime.
    const { data: claimed } = await sb
      .from("orders")
      .update({ printed_at: new Date().toISOString() })
      .eq("id", cand.id)
      .is("printed_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: order } = await sb
      .from("orders")
      .select(
        "id, client_id, status, subtotal, delivery_fee, total_price, payment_method, neighborhood, address_details, created_at, delivery_pin, change_for, loyalty_discount, wallet_discount, metadata, pix_confirmed_at, asaas_payment_id, order_items(quantity, unit_price, observations, addons, products(name))",
      )
      .eq("id", cand.id)
      .maybeSingle();
    if (!order) continue;

    let clientName = "Cliente";
    let clientPhone = "";
    if (order.client_id) {
      const { data: profile } = await sb
        .from("profiles")
        .select("full_name, phone, whatsapp_number")
        .eq("user_id", order.client_id)
        .maybeSingle();
      if (profile) {
        clientName = profile.full_name || clientName;
        clientPhone = profile.whatsapp_number || profile.phone || "";
      }
    }

    const items = ((order.order_items ?? []) as Record<string, unknown>[]).map((it) => {
      const prod = it["products"] as { name?: string } | null;
      const addonsRaw = Array.isArray(it["addons"]) ? (it["addons"] as Record<string, unknown>[]) : [];
      const qty = Number(it["quantity"] ?? 1);
      const unit = Number(it["unit_price"] ?? 0);
      return {
        qty,
        name: prod?.name ?? "Item",
        unit_price: unit,
        total: qty * unit,
        addons: addonsRaw.map((a) => ({ name: String(a["name"] ?? ""), price: Number(a["price"] ?? 0) })),
        observations: typeof it["observations"] === "string" ? it["observations"] : null,
      };
    });

    const method = String(order.payment_method ?? "");
    const discount = Number(order.loyalty_discount ?? 0) + Number(order.wallet_discount ?? 0);
    const addrText = addressText(order.address_details);
    jobs.push({
      order_id: order.id,
      short_code: `#${String(order.id).slice(0, 8).toUpperCase()}`,
      created_at_label: fmtSP.format(new Date(order.created_at)),
      store: {
        name: store.name,
        phone: typeof settings["phone"] === "string"
          ? (settings["phone"] as string)
          : typeof settings["whatsapp"] === "string"
          ? (settings["whatsapp"] as string)
          : null,
        document: store.cnpj_cpf,
      },
      client: { name: clientName, phone: clientPhone },
      delivery: {
        // Convenção da plataforma: retirada grava neighborhood = 'RETIRADA'.
        type: addrText && order.neighborhood !== "RETIRADA" ? "delivery" : "retirada",
        address_text: addrText,
        neighborhood: order.neighborhood ?? "",
        pin: order.delivery_pin ?? "",
      },
      items,
      amounts: {
        subtotal: Number(order.subtotal ?? 0),
        delivery_fee: Number(order.delivery_fee ?? 0),
        discount,
        total: Number(order.total_price ?? 0),
      },
      payment: {
        method_label: paymentLabel(method),
        // change_for é o valor com que o cliente paga (ex.: nota de R$ 50);
        // 0 ou menor que o total não é troco — não vai pro cupom.
        change_for: order.change_for != null && Number(order.change_for) > Number(order.total_price ?? 0)
          ? Number(order.change_for)
          : null,
        paid_online: Boolean(order.pix_confirmed_at) || Boolean(order.asaas_payment_id) ||
          method.toLowerCase().includes("online"),
      },
      observations: generalNote(order.metadata, order.address_details),
      copies: settings["print_copies"] === 1 ? 1 : 2,
      paper_width: settings["print_paper_width"] === 58 ? 58 : 80,
    });
  }

  return json({ jobs });
});
