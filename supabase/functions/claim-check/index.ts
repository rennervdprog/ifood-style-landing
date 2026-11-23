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
const json = (b: unknown, s = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", ...extraHeaders } });

// Rate limit (item 8, auditoria 40 itens) — mesmo padrão de
// guest-order-status (contador em guest_tracking_attempts + 429), sem
// inventar padrão novo: janela de 10 min, `{ error: "rate_limited" }` com
// header `Retry-After: 600`, limpeza best-effort de registros com mais de
// 1 dia. A diferença é o que conta: aqui não há "tentativa errada" —
// todo lookup conta (a edge é um oráculo de enumeração de telefone), então
// contam TODAS as chamadas, 10 por telefone e 30 por IP em 10 min. Um
// uso legítimo (reivindicar a própria conta) faz 1 ou 2 chamadas; a
// trava só para enumeração automatizada. A chave da tabela é uuid, então
// o telefone vira um uuid determinístico (SHA-256, primeiros 128 bits).
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_PHONE = 10;
const MAX_ATTEMPTS_PER_IP = 30;
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

const clientIp = (req: Request): string | null => {
  const raw = req.headers.get("x-forwarded-for") || "";
  const first = raw.split(",")[0]?.trim() || "";
  return first ? first.slice(0, 45) : null;
};

const phoneKeyUuid = async (phone: string): Promise<string> => {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`claim-check:${phone}`),
  );
  const hex = [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

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

    // Rate limit (mesmo padrão de guest-order-status): checa o limite
    // ANTES de qualquer lookup que revele se o telefone tem conta, e
    // registra a tentativa. O 429 não registra nada. Se a contagem ou o
    // registro falhar, a função segue sem travar (fail-open, igual ao
    // padrão — a checagem nunca pode quebrar o fluxo legítimo).
    const ip = clientIp(req);
    const phoneKey = await phoneKeyUuid(phone);
    try {
      await sb.from("guest_tracking_attempts")
        .delete()
        .lt("attempted_at", new Date(Date.now() - ATTEMPT_RETENTION_MS).toISOString());
    } catch (e) {
      console.error("[claim-check] cleanup error:", e);
    }
    const attemptsInWindow = async (column: "order_id" | "ip", value: string): Promise<number> => {
      try {
        const { count, error } = await sb.from("guest_tracking_attempts")
          .select("id", { count: "exact", head: true })
          .eq(column, value)
          .gt("attempted_at", new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString());
        if (error) {
          console.error("[claim-check] rate limit count error:", error);
          return 0;
        }
        return count ?? 0;
      } catch (e) {
        console.error("[claim-check] rate limit count error:", e);
        return 0;
      }
    };
    if ((await attemptsInWindow("order_id", phoneKey)) >= MAX_ATTEMPTS_PER_PHONE) {
      return json({ error: "rate_limited" }, 429, { "Retry-After": "600" });
    }
    if (ip && (await attemptsInWindow("ip", ip)) >= MAX_ATTEMPTS_PER_IP) {
      return json({ error: "rate_limited" }, 429, { "Retry-After": "600" });
    }
    try {
      await sb.from("guest_tracking_attempts").insert({ order_id: phoneKey, ok: true, ip } as any);
    } catch (e) {
      console.error("[claim-check] record attempt error:", e);
    }

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
