// Fase 6D Opção A2 — verifica o código E converte o cadastro guest em
// conta de verdade numa só chamada: updateUserById troca o e-mail sintético
// pelo e-mail real (mesmo user_id — histórico, endereços e fidelidade
// preservados) e grava os dados novos em profiles + endereço + aceite de
// termos, as mesmas escritas do cadastro normal (AuthPage.tsx). Anônima,
// service_role, autocontida (sem _shared). Desenho do OTP igual ao de
// send-whatsapp-otp / verify-whatsapp-otp (hash SHA-256 de
// `code + guest_user_id`, 10 min, máx. 5 tentativas). Nenhuma migration
// nova — a tabela whatsapp_otp já existe.
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

const MAX_ATTEMPTS = 5;
// Versões vigentes em src/lib/legalVersions.ts na data desta edge; o front
// envia as versões atuais no corpo e estas só valem como fallback.
const FALLBACK_TERMS_VERSION = "6.8";
const FALLBACK_PRIVACY_VERSION = "6.7";

interface ClaimAddress {
  cep?: unknown;
  street?: unknown;
  number?: unknown;
  complement?: unknown;
  neighborhood?: unknown;
  reference_point?: unknown;
}

interface ClaimVerifyOtpPayload {
  phone?: unknown;
  guest_user_id?: unknown;
  code?: unknown;
  email?: unknown;
  password?: unknown;
  full_name?: unknown;
  address?: ClaimAddress | null;
  delivery_pin?: unknown;
  terms_version?: unknown;
  privacy_version?: unknown;
  user_agent?: unknown;
}

interface GuestRow {
  user_id: string;
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

interface OtpRow {
  id: string;
  whatsapp: string;
  code_hash: string;
  attempts: number | null;
}

function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : raw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let p: ClaimVerifyOtpPayload;
  try {
    p = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const phone = normalizePhoneBR(p?.phone);
  const guestUserId = String(p?.guest_user_id || "").trim();
  const code = String(p?.code || "").replace(/\D/g, "");
  const email = String(p?.email || "").trim().toLowerCase();
  const password = String(p?.password || "");
  const fullName = String(p?.full_name || "").trim();
  const deliveryPin = String(p?.delivery_pin || "").replace(/\D/g, "");
  const addr = (p?.address ?? {}) as ClaimAddress;
  const cep = String(addr?.cep || "").trim();
  const street = String(addr?.street || "").trim();
  const number = String(addr?.number || "").trim();
  const neighborhood = String(addr?.neighborhood || "").trim();
  const complement = String(addr?.complement || "").trim();
  const referencePoint = String(addr?.reference_point || "").trim();

  if (!phone) return json({ error: "invalid_phone" }, 400);
  if (!guestUserId) return json({ error: "missing_guest_user_id" }, 400);
  if (code.length !== 6) return json({ error: "invalid_code" }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "invalid_email" }, 400);
  if (password.length < 8) return json({ error: "invalid_password" }, 400);
  if (fullName.length < 2) return json({ error: "invalid_full_name" }, 400);
  if (deliveryPin.length !== 4) return json({ error: "invalid_delivery_pin" }, 400);
  if (!cep || !street || !number || !neighborhood) {
    return json({ error: "invalid_address" }, 400);
  }

  // Cópia de teste (`claim-verify-otp-teste`): allowlist no topo — só o
  // telefone de teste. O modo teste é detectado pela URL de invocação,
  // então o código é o mesmo nos dois deploys.
  const isTestFunction = new URL(req.url).pathname.endsWith("-teste");
  if (isTestFunction && phone !== "5514988885555") {
    return json({ error: "forbidden", reason: "test_function_allowlist" }, 403);
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
        Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
        Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Telefone de conta de verdade: 409 sem converter nada.
    if (await hasRealAccount(sb, phone)) {
      return json({ error: "already_registered" }, 409);
    }

    // Anti-abuso: o guest_user_id tem que ser o guest DESTE telefone.
    const { data: guest } = await sb
      .from("guest_customers")
      .select("user_id")
      .eq("phone", phone)
      .eq("user_id", guestUserId)
      .maybeSingle();
    if (!(guest as GuestRow | null)?.user_id) {
      return json({ error: "guest_not_found" }, 400);
    }

    // (a) Linha de OTP mais recente não verificada e não expirada do guest.
    const { data: otp } = await sb
      .from("whatsapp_otp")
      .select("id, whatsapp, code_hash, attempts")
      .eq("user_id", guestUserId)
      .is("verified_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = otp as OtpRow | null;
    if (!row || row.whatsapp !== phone) {
      return json({ error: "code_expired_or_not_found" }, 400);
    }
    if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
      return json({ error: "too_many_attempts" }, 429);
    }
    const codeHash = await sha256Hex(code + guestUserId);
    if (row.code_hash !== codeHash) {
      const attempts = (row.attempts ?? 0) + 1;
      await sb.from("whatsapp_otp").update({ attempts }).eq("id", row.id);
      return json({
        error: "invalid_code",
        attempts_remaining: Math.max(0, MAX_ATTEMPTS - attempts),
      }, 400);
    }

    // (b) Código certo — marca verificado antes de converter.
    await sb.from("whatsapp_otp").update({ verified_at: new Date().toISOString() }).eq("id", row.id);

    // (c) Conversão: mesmo user_id, e-mail e senha novos. A troca de
    // e-mail via updateUserById retorna 200 e o login com o e-mail novo
    // funciona (verificado pelo coordenador antes desta implementação).
    const { error: updateErr } = await sb.auth.admin.updateUserById(guestUserId, {
      email,
      password,
      email_confirm: true,
    });
    if (updateErr) {
      const msg = (updateErr.message || "").toLowerCase();
      console.error("[claim-verify-otp] updateUserById falhou", updateErr);
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
        return json({ error: "email_in_use" }, 409);
      }
      return json({ error: "conversion_failed" }, 500);
    }

    const now = new Date().toISOString();
    const { error: profileErr } = await sb.from("profiles").upsert({
      user_id: guestUserId,
      email,
      full_name: fullName,
      phone,
      whatsapp_number: phone,
      delivery_pin: deliveryPin,
      terms_accepted_at: now,
    }, { onConflict: "user_id" });
    if (profileErr) {
      console.error("[claim-verify-otp] profiles upsert falhou", profileErr);
      return json({ error: "conversion_failed" }, 500);
    }

    // Mesmo endereço do cadastro normal (AuthPage.tsx): rótulo "Casa",
    // padrão. Desmarca o padrão anterior do guest, se houver (o pedido
    // guest pode já ter gravado um endereço).
    await sb.from("saved_addresses").update({ is_default: false }).eq("user_id", guestUserId);
    const { error: addrErr } = await sb.from("saved_addresses").insert({
      user_id: guestUserId,
      label: "Casa",
      cep: formatCep(cep),
      street,
      number,
      complement: complement || null,
      neighborhood,
      reference_point: referencePoint || null,
      is_default: true,
    });
    if (addrErr) {
      console.error("[claim-verify-otp] saved_addresses insert falhou", addrErr);
      return json({ error: "conversion_failed" }, 500);
    }

    // Mesmo aceite de termos do cadastro normal (AuthPage.tsx).
    const { error: termsErr } = await sb.from("terms_acceptance").insert({
      user_id: guestUserId,
      terms_version: String(p?.terms_version || FALLBACK_TERMS_VERSION),
      privacy_version: String(p?.privacy_version || FALLBACK_PRIVACY_VERSION),
      user_agent: String(p?.user_agent || "") || null,
    });
    if (termsErr) {
      console.error("[claim-verify-otp] terms_acceptance insert falhou", termsErr);
      return json({ error: "conversion_failed" }, 500);
    }

    return json({ ok: true, user_id: guestUserId });
  } catch (e) {
    console.error("[claim-verify-otp] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
