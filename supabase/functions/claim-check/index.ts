// Fase 6D Opção A2 — "Reivindicar no cadastro": procura o telefone antes de
// criar a conta. Devolve `guest` (tem cadastro fantasma), `real` (já tem
// conta de verdade) ou `new` (número novo). Anônima, service_role,
// autocontida (sem _shared), mesmo padrão de `guest-lookup`.
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

interface ClaimCheckPayload {
  phone?: unknown;
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

interface GuestRow {
  user_id: string;
  last_store_id: string | null;
}

interface StoreRow {
  name: string | null;
}

interface OrderRow {
  id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let p: ClaimCheckPayload;
  try {
    p = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const phone = normalizePhoneBR(p?.phone);
  if (!phone) return json({ error: "invalid_phone" }, 400);

  // Cópia de teste (`claim-check-teste`): allowlist no topo — só os
  // telefones de teste. A função original (`claim-check`) fica intacta até
  // a publicação, com a palavra do Renner. O modo teste é detectado pela
  // URL de invocação, então o código é o mesmo nos dois deploys.
  const isTestFunction = new URL(req.url).pathname.endsWith("-teste");
  const TEST_PHONES = new Set([
    "5514988885555", // guest de teste (brickado 05/07/2026)
    "5514991624997", // Renner — conta de verdade (só LEITURA)
    "5514999990003", // número novo (não existe em lugar nenhum)
  ]);
  if (isTestFunction && !TEST_PHONES.has(phone)) {
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

    // 1) Conta de verdade? Busca nos DOIS campos (Fase 3: o site grava
    // phone E whatsapp_number; o bot busca nos dois). Se existir guest E
    // conta real com o mesmo número, o bloqueio vale até a mesclagem
    // manual da Fase 3 — a conta real ganha.
    if (await hasRealAccount(sb, phone)) {
      return json({ status: "real" });
    }

    // 2) Cadastro guest (fantasma)?
    const { data: guest } = await sb
      .from("guest_customers")
      .select("user_id, last_store_id")
      .eq("phone", phone)
      .maybeSingle();
    const g = guest as GuestRow | null;
    if (!g?.user_id) return json({ status: "new" });

    let lastStoreName: string | null = null;
    if (g.last_store_id) {
      const { data: store } = await sb
        .from("stores")
        .select("name")
        .eq("id", g.last_store_id)
        .maybeSingle();
      lastStoreName = (store as StoreRow | null)?.name ?? null;
    }

    // Último pedido do guest — o front usa para o fallback da Opção A
    // (link direto para a página de acompanhamento) quando o código não
    // pode ser enviado no WhatsApp da loja.
    const { data: lastOrder } = await sb
      .from("orders")
      .select("id")
      .eq("client_id", g.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return json({
      status: "guest",
      guest_user_id: g.user_id,
      last_store_id: g.last_store_id,
      last_store_name: lastStoreName,
      last_order_id: (lastOrder as OrderRow | null)?.id ?? null,
    });
  } catch (e) {
    console.error("[claim-check] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
