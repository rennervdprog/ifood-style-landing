// Piloto Itatinga — busca perfil guest por telefone.
// Deployado no Supabase EXTERNO. Autocontido (sem _shared).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://itasuper.com.br",
  "https://www.itasuper.com.br",
  "https://itasuper.lovable.app",
  "https://id-preview--e8d28ade-d633-4d74-be21-61c8dbe24765.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function normalizePhoneBR(input: unknown): string | null {
  const d = String(input || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length === 12 || d.length === 13) return d;
  return null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = cors(origin);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...headers, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhoneBR(body?.phone);
    const storeId = String(body?.store_id || "").trim();
    if (!phone) return json({ error: "invalid_phone" }, 400);
    if (!storeId) return json({ error: "missing_store_id" }, 400);

    // Cópia de teste (`guest-lookup-teste`): allowlist no topo — só a loja
    // de teste e só os telefones de teste. Mesmo padrão da guest-checkout:
    // o modo teste é detectado pela URL de invocação, então o código é o
    // mesmo nos dois deploys e a produção não muda.
    const TEST_STORE_ID = "8197bdd8-f041-410d-acc0-af9ecb448f55";
    const TEST_PHONES = new Set([
      "5514991624997", // Renner
      "5514988885555", // brickado 05/07/2026
      "5514988886666", // brickado 05/07/2026
      "5514988887777", // brickado 05/07/2026
    ]);
    const isTestFunction = new URL(req.url).pathname.endsWith("-teste");
    if (isTestFunction && (storeId !== TEST_STORE_ID || !TEST_PHONES.has(phone))) {
      return json({ error: "forbidden", reason: "test_function_allowlist" }, 403);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: store } = await sb
      .from("stores")
      .select("id, guest_checkout_enabled, address_city")
      .eq("id", storeId)
      .maybeSingle();
    if (!store || !(store as any).guest_checkout_enabled) {
      return json({ error: "guest_not_enabled" }, 403);
    }

    const { data: guest } = await sb
      .from("guest_customers")
      .select("user_id, name, city_slug")
      .eq("phone", phone)
      .maybeSingle();
    if (!guest) return json({ found: false });

    const sameCity =
      (guest as any).city_slug &&
      String((guest as any).city_slug).toLowerCase() ===
        String((store as any).address_city || "").toLowerCase();
    if (!sameCity) return json({ found: true, name: (guest as any).name || null });

    // Fase 6B (P2-6): todos os endereços do guest — o padrão primeiro,
    // depois os mais recentes. `lastAddress` continua, para compatibilidade
    // com o front atual (GuestCheckoutPage usa só ele).
    const { data: addresses } = await sb
      .from("saved_addresses")
      .select("id, label, cep, street, number, complement, neighborhood, reference_point, is_default")
      .eq("user_id", (guest as any).user_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    const all = (addresses || []) as Array<Record<string, unknown>>;
    return json({ found: true, name: (guest as any).name || null, addresses: all, lastAddress: all[0] || null });
  } catch (e) {
    console.error("[guest-lookup] error:", e);
    return json({ error: "internal_error" }, 500);
  }
});