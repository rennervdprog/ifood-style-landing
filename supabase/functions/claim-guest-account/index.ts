// Fase 6D Opção A — "Reivindicar minha conta" na página de acompanhamento.
// POST {order_id, last4, email, password}
// A prova de posse é o próprio link de rastreio + os últimos 4 dígitos
// (o que o cliente já tem — a mesma prova que hoje já libera o rastreio
// e o PIN, então não abre nada novo).
//
// Fluxo: verifica pedido + últimos 4 (mesmo padrão da guest-order-status)
// → resolve o cliente do pedido → o usuário PRECISA ser guest (e-mail
// guest+<telefone>@guest.itasuper.app); conta de verdade → 409
// already_has_account → converte via Admin API (updateUserById com troca
// de e-mail + senha, email_confirm: true) e grava o e-mail em profiles.
// Mesmo user_id = histórico, endereços e fidelidade preservados.
//
// Deployado no Supabase EXTERNO. Autocontida (sem _shared): o deploy não
// sobe subdiretórios. As validações de e-mail/senha são espelhadas em
// src/lib/claimValidation.ts, com testes em Vitest.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*", "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TEST_STORE_ID = "8197bdd8-f041-410d-acc0-af9ecb448f55";
const MIN_PASSWORD_LENGTH = 6;

// Espelho de src/lib/claimValidation.ts — manter os dois iguais.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email: string): boolean => EMAIL_RE.test(email);
const isValidPassword = (password: string): boolean => password.length >= MIN_PASSWORD_LENGTH;
const isGuestEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const m = /^guest\+(\d+)@guest\.itasuper\.app$/i.exec(email.trim());
  return m !== null;
};

interface ClaimPayload {
  order_id: unknown;
  last4: unknown;
  email: unknown;
  password: unknown;
}

interface OrderRow {
  id: string;
  client_id: string;
  is_guest: boolean;
  store_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as ClaimPayload;
    const orderId = String(body?.order_id || "").trim();
    const last4 = String(body?.last4 || "").replace(/\D/g, "");
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!orderId || last4.length !== 4) return json({ error: "invalid_params" }, 400);
    if (!isValidEmail(email)) return json({ error: "invalid_email" }, 400);
    if (!isValidPassword(password)) return json({ error: "weak_password" }, 400);

    const sb = createClient(
      (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
      (
        Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
        Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      )!,
      { auth: { persistSession: false } },
    );

    // (a) Pedido + últimos 4 — mesmo padrão da guest-order-status.
    const { data: order } = await sb.from("orders")
      .select("id, client_id, is_guest, store_id")
      .eq("id", orderId).maybeSingle();
    if (!order || !(order as OrderRow).is_guest) return json({ error: "not_found" }, 404);

    // Cópia de teste (`claim-guest-account-teste`): allowlist no topo — só
    // pedidos da loja de teste. Qualquer outro pedido é recusado com 403.
    // O modo teste é detectado pela URL de invocação, então o código é o
    // mesmo nos dois deploys.
    const isTestFunction = new URL(req.url).pathname.endsWith("-teste");
    if (isTestFunction && (order as OrderRow).store_id !== TEST_STORE_ID) {
      return json({ error: "test_function_allowlist" }, 403);
    }

    const [{ data: guest }, { data: profile }] = await Promise.all([
      sb.from("guest_customers")
        .select("phone").eq("user_id", (order as OrderRow).client_id).maybeSingle(),
      sb.from("profiles")
        .select("phone").eq("user_id", (order as OrderRow).client_id).maybeSingle(),
    ]);
    const customerPhone = String((guest as { phone?: string | null })?.phone || (profile as { phone?: string | null })?.phone || "");
    if (!customerPhone || customerPhone.slice(-4) !== last4) {
      return json({ error: "not_found" }, 404);
    }

    // (b) O usuário PRECISA ser guest. Conta de verdade → 409.
    const { data: authUser, error: getUserErr } = await sb.auth.admin.getUserById((order as OrderRow).client_id);
    if (getUserErr || !authUser?.user) {
      console.error("[claim-guest-account] getUserById error:", getUserErr);
      return json({ error: "internal_error" }, 500);
    }
    if (!isGuestEmail(authUser.user.email)) {
      return json({ error: "already_has_account" }, 409);
    }

    // (c) Converter via Admin API: troca o e-mail sintético pelo e-mail
    // real + a senha escolhida. email_confirm: true para não travar o
    // login atrás de confirmação. Mesmo user_id — histórico, endereços e
    // fidelidade ficam intactos. Verificado ao vivo antes desta fase
    // (test_update_email.py): updateUserById com troca de e-mail retorna
    // 200, o login com o e-mail novo funciona e o antigo falha.
    const { error: updateErr } = await sb.auth.admin.updateUserById(
      (order as OrderRow).client_id,
      { email, password, email_confirm: true },
    );
    if (updateErr) {
      const msg = String((updateErr as { message?: string }).message || updateErr);
      console.error("[claim-guest-account] updateUserById error:", msg);
      // E-mail já usado por outra conta → 409 (o front pede outro e-mail).
      if (/already (exists|registered|in use)|duplicate|taken/i.test(msg)) {
        return json({ error: "email_in_use" }, 409);
      }
      return json({ error: "internal_error" }, 500);
    }

    // Gravar o e-mail em profiles (espelho; o login usa o auth.user).
    // Best-effort: a conversão já aconteceu no auth — se o espelho
    // falhar, o cliente ainda entra com o e-mail novo; o erro fica no log.
    const { error: profileErr } = await sb.from("profiles").upsert(
      { user_id: (order as OrderRow).client_id, email } as never,
      { onConflict: "user_id" },
    );
    if (profileErr) {
      console.error("[claim-guest-account] profiles email mirror error:", profileErr);
    }

    // (d)
    return json({ ok: true });
  } catch (e) {
    console.error("[claim-guest-account] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
