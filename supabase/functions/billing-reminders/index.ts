// Cron diário: envia lembretes de cobrança via WhatsApp da plataforma.
// Mensalidade (#MENS-*/#ASSIN-*): D-3, D-1 (aviso), D+1 (atraso), D+3 (pós-bloqueio).
// Repasse (#REP-*, desde a Fase 4): D-3, D-1, D+1 e D+23 (faltam 7 dias
// para a cobrança completar 30 dias e pausar as vendas).
// Roda contra Supabase EXTERNO. Só dispara para cobranças pending.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const money = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

const templates: Record<string, (ctx: { name: string; amount: number; pixCode?: string; storeName?: string }) => string> = {
  d_minus_3: (c) => `Olá, ${c.storeName || c.name}! 👋\n\nSua mensalidade ItaSuper vence em *3 dias* — ${money(c.amount)}.\n\nPague pelo PIX Copia e Cola no painel da loja ou peça o QR pelo suporte.`,
  d_minus_1: (c) => `⏰ ${c.storeName || c.name}, sua mensalidade ItaSuper vence *AMANHÃ* — ${money(c.amount)}.\n\nAcesse o painel para pagar via PIX.`,
  d_plus_1: (c) => `⚠️ ${c.storeName || c.name}, sua mensalidade ItaSuper de ${money(c.amount)} está em atraso.\n\nEm 2 dias sua loja será suspensa. Regularize o PIX no painel.`,
  d_plus_3: (c) => `🚫 ${c.storeName || c.name}, sua loja foi *suspensa* por falta de pagamento (${money(c.amount)}).\n\nPague o PIX no painel para reativar imediatamente.`,
  rep_d_minus_3: (c) => `Olá, ${c.storeName || c.name}! 👋\n\nSeu repasse ItaSuper de ${money(c.amount)} vence em *3 dias*.\n\nQuite pelo PIX na aba Repasse do painel para manter tudo em dia.`,
  rep_d_minus_1: (c) => `⏰ ${c.storeName || c.name}, seu repasse ItaSuper de ${money(c.amount)} vence *AMANHÃ*.\n\nGere o PIX na aba Repasse do painel e quite em poucos segundos.`,
  rep_d_plus_1: (c) => `⚠️ ${c.storeName || c.name}, seu repasse ItaSuper de ${money(c.amount)} está em atraso.\n\nSe completar 30 dias sem pagar, suas vendas pausam até a quitação. Regularize na aba Repasse do painel.`,
  rep_d_plus_23: (c) => `🚨 ${c.storeName || c.name}, faltam *7 dias* para o repasse de ${money(c.amount)} completar 30 dias em aberto.\n\nSe isso acontecer, suas vendas pausam até o pagamento. Quite o PIX na aba Repasse do painel.`,
};

const daysDiff = (dueIso: string) => {
  const due = new Date(dueIso); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86400000); // 0 = vence hoje, -3 = daqui a 3 dias
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const EXT_KEY =
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
    Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization")?.replace("Bearer ", "") || req.headers.get("apikey") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || Deno.env.get("EXTERNAL_CRON_SECRET") || "";
  const ok = !!auth && (auth === EXT_KEY || (cronSecret && auth === cronSecret));
  if (!ok) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(EXT_URL, EXT_KEY);
  const FUNCTIONS_BASE = `${EXT_URL}/functions/v1`;

  const { data: pending, error } = await sb
    .from("financial_transactions")
    .select("id, store_id, amount, reference_code, created_at, status, metadata, stores!inner(id, name, owner_id)")
    .eq("status", "pending")
    .or("reference_code.like.#MENS-%,reference_code.like.#ASSIN-%,reference_code.like.#REP-%");
  if (error) return json({ error: error.message }, 500);

  const kindByDiff = (family: "mensalidade" | "repasse", d: number): string | null => {
    if (family === "repasse") {
      if (d === -3) return "rep_d_minus_3";
      if (d === -1) return "rep_d_minus_1";
      if (d === 1) return "rep_d_plus_1";
      if (d === 23) return "rep_d_plus_23";
      return null;
    }
    if (d === -3) return "d_minus_3";
    if (d === -1) return "d_minus_1";
    if (d === 1) return "d_plus_1";
    if (d === 3) return "d_plus_3";
    return null;
  };

  const sent: any[] = [];
  const skipped: any[] = [];
  const ownerIds = Array.from(new Set((pending || []).map((t: any) => t.stores?.owner_id).filter(Boolean)));
  const profilesById: Record<string, any> = {};
  if (ownerIds.length) {
    const { data: profs } = await sb.from("profiles").select("id, whatsapp, full_name").in("id", ownerIds);
    for (const p of profs || []) profilesById[(p as any).id] = p;
  }
  for (const tx of pending || []) {
    const store: any = (tx as any).stores;
    const owner: any = profilesById[store?.owner_id];
    const phone: string = String(owner?.whatsapp || "").replace(/\D/g, "");
    if (!phone || !tx.created_at) { skipped.push({ id: tx.id, reason: "no_phone_or_created" }); continue; }
    const isRepasse = String(tx.reference_code || "").startsWith("#REP-");
    // Mensalidade: vencimento = created_at + 3 dias (regra do auto-deactivate).
    // Repasse: vencimento gravado no metadata (due_date); sem ele, created_at + 7 dias.
    const dueRaw = isRepasse ? (tx as any).metadata?.due_date : null;
    const due = dueRaw
      ? new Date(dueRaw)
      : new Date(new Date(tx.created_at).getTime() + (isRepasse ? 7 : 3) * 86400000);
    const diff = daysDiff(due.toISOString());
    const kind = kindByDiff(isRepasse ? "repasse" : "mensalidade", diff);
    if (!kind) { skipped.push({ id: tx.id, diff, reason: "no_reminder_today" }); continue; }
    const message = templates[kind]({
      name: owner?.full_name || "lojista",
      storeName: store?.name,
      amount: Number(tx.amount || 0),
    });
    const r = await fetch(`${FUNCTIONS_BASE}/platform-whatsapp-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${EXT_KEY}` },
      body: JSON.stringify({
        phone, message,
        kind: `billing_${kind}`,
        category: isRepasse ? "repasse" : "mensalidade",
        store_id: tx.store_id,
        store_name: store?.name,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) sent.push({ id: tx.id, store: store?.name, kind, ...data });
    else skipped.push({ id: tx.id, store: store?.name, kind, error: data });
  }

  return json({ checked: pending?.length || 0, sent_count: sent.length, sent, skipped });
});