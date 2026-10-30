// Fase 6D Opção A2 — envia o código de 6 dígitos no WhatsApp para o número
// do guest, pela instância da LOJA do último pedido dele (via
// evolution-send-message, kind "bot"). Anônima, service_role, autocontida
// (sem _shared). Reaproveita o desenho das edges send-whatsapp-otp /
// verify-whatsapp-otp (hash SHA-256 de `code + guest_user_id` em
// whatsapp_otp, válido por 10 min, máx. 5 tentativas, máx. 3 envios/hora,
// 60 s entre reenvios) — mas NUNCA usa a instância da plataforma
// (`itasuper-platform` está disconnected desde 31/07/2026 e devolve 409):
// se a loja não tiver WhatsApp conectado, devolve
// `store_whatsapp_unavailable` + fallback "tracking" para o front oferecer
// a Opção A. Nenhuma migration nova — a tabela whatsapp_otp já existe.
// Deployado no Supabase EXTERNO (usa SUPABASE_URL/SERVICE_ROLE_KEY locais).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*", "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function normalizePhoneBR(input: unknown): string | null {
  const d = String(input || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length === 12 || d.length === 13) return d;
  return null;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 3;
const RESEND_GAP_MS = 60 * 1000;

interface ClaimSendOtpPayload {
  phone?: unknown;
  guest_user_id?: unknown;
}

interface GuestRow {
  user_id: string;
  last_store_id: string | null;
}

interface ProfileRow {
  user_id: string;
  email: string | null;
}

// E-mail sintético do cadastro fantasma (guest-checkout e bot): o perfil
// do guest também nasce com role='cliente' (default da tabela) e o
// telefone — SÓ o e-mail do auth user distingue a conta de verdade.
const GUEST_EMAIL_RE = /^guest\+\d+@guest\.itasuper\.app$/;

/**
 * Há conta de verdade com este telefone? Percorre TODOS os perfis
 * cliente com o número (pode haver guest E real com o mesmo telefone —
 * os 2 pares duplicados conhecidos) e só conta como real quem NÃO tem
 * o e-mail sintético de guest.
 */
async function hasRealAccount(
  sb: ReturnType<typeof createClient>,
  phone: string,
): Promise<boolean> {
  const { data: rows } = await sb
    .from("profiles")
    .select("user_id, email")
    .eq("role", "cliente")
    .or(`phone.eq.${phone},whatsapp_number.eq.${phone}`)
    .limit(10);
  for (const row of ((rows as ProfileRow[] | null) ?? [])) {
    let email = row.email;
    if (!email || GUEST_EMAIL_RE.test(email)) {
      const { data: authUser } = await sb.auth.admin.getUserById(row.user_id);
      email = (authUser?.user?.email as string | undefined) ?? email;
    }
    if (email && !GUEST_EMAIL_RE.test(email)) return true;
  }
  return false;
}

interface OrderRow {
  store_id: string;
}

interface OtpRow {
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let p: ClaimSendOtpPayload;
  try {
    p = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const phone = normalizePhoneBR(p?.phone);
  const guestUserId = String(p?.guest_user_id || "").trim();
  if (!phone) return json({ error: "invalid_phone" }, 400);
  if (!guestUserId) return json({ error: "missing_guest_user_id" }, 400);

  // Cópia de teste (`claim-send-otp-teste`): allowlist no topo — só o
  // telefone de teste. O modo teste é detectado pela URL de invocação,
  // então o código é o mesmo nos dois deploys.
  const isTestFunction = new URL(req.url).pathname.endsWith("-teste");
  if (isTestFunction && phone !== "5514988885555") {
    return json({ error: "forbidden", reason: "test_function_allowlist" }, 403);
  }

  try {
    const baseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;
    const sb = createClient(baseUrl, serviceKey, { auth: { persistSession: false } });

    // (a) Anti-abuso: o guest_user_id tem que ser o guest DESTE telefone.
    const { data: guest } = await sb
      .from("guest_customers")
      .select("user_id, last_store_id")
      .eq("phone", phone)
      .eq("user_id", guestUserId)
      .maybeSingle();
    const g = guest as GuestRow | null;
    if (!g?.user_id) return json({ error: "guest_not_found" }, 400);

    // Telefone de conta de verdade nunca recebe código de reivindicação.
    if (await hasRealAccount(sb, phone)) {
      return json({ error: "already_registered" }, 409);
    }

    // (b) Rate limits por telefone (só contam envios que de fato saíram —
    // a linha só é gravada depois do envio OK, abaixo).
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("whatsapp_otp")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp", phone)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
      return json({ error: "rate_limited", retry_after_seconds: 3600 }, 429);
    }
    const { data: lastOtp } = await sb
      .from("whatsapp_otp")
      .select("created_at")
      .eq("whatsapp", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastCreated = (lastOtp as OtpRow | null)?.created_at;
    if (lastCreated) {
      const gapMs = Date.now() - new Date(lastCreated).getTime();
      if (gapMs < RESEND_GAP_MS) {
        return json({
          error: "resend_too_soon",
          retry_after_seconds: Math.ceil((RESEND_GAP_MS - gapMs) / 1000),
        }, 429);
      }
    }

    // (c) Loja do último pedido do guest; sem pedidos, a última loja
    // conhecida do guest (guest_customers.last_store_id, gravada a cada
    // pedido guest). Sem loja, não há por onde enviar o código.
    let storeId: string | null = null;
    const { data: lastOrder } = await sb
      .from("orders")
      .select("store_id")
      .eq("client_id", guestUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    storeId = (lastOrder as OrderRow | null)?.store_id ?? g.last_store_id;
    if (!storeId) {
      return json({ error: "store_whatsapp_unavailable", fallback: "tracking" });
    }

    // (d) Envia o código pela instância da loja. O `isAuthorizedForStore`
    // da evolution-send-message aceita o service_role como Bearer; kind
    // "bot" é rápido e não enfileira. Qualquer falha de envio (loja
    // desconectada, sem instância, teto diário) vira o fallback da Opção A
    // — nunca tenta a instância da plataforma.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const message =
      `ItaSuper: seu código para criar sua conta é *${code}*. Válido por 10 minutos. Não compartilhe.`;
    let sendOk = false;
    try {
      const send = await fetch(`${baseUrl}/functions/v1/evolution-send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ store_id: storeId, phone, message, kind: "bot" }),
      });
      const sendBody = await send.json().catch(() => null) as
        | { success?: boolean; error?: unknown }
        | null;
      sendOk = send.ok && (sendBody as { success?: boolean } | null)?.success === true;
      if (!sendOk) {
        console.warn("[claim-send-otp] evolution-send-message falhou", {
          store_id: storeId,
          status: send.status,
          error: (sendBody as { error?: unknown } | null)?.error ?? null,
        });
      }
    } catch (e) {
      console.warn("[claim-send-otp] evolution-send-message erro de rede", e);
      sendOk = false;
    }
    if (!sendOk) {
      return json({ error: "store_whatsapp_unavailable", fallback: "tracking" });
    }

    // (e) Só grava a linha depois do envio OK — envio falho não consome
    // o limite de 3/hora nem deixa um código válido que nunca chegou.
    const codeHash = await sha256Hex(code + guestUserId);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    const { error: insertErr } = await sb.from("whatsapp_otp").insert({
      user_id: guestUserId,
      whatsapp: phone,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    });
    if (insertErr) {
      console.error("[claim-send-otp] insert whatsapp_otp falhou", insertErr);
      return json({ error: "internal_error" }, 500);
    }

    return json({ ok: true, expires_at: expiresAt, resend_after_seconds: 60 });
  } catch (e) {
    console.error("[claim-send-otp] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
