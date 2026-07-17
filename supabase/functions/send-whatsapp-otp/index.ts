// Envia OTP de 6 dígitos via WhatsApp da plataforma. Grava hash em whatsapp_otp.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const EXT_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
    const EXT_SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(EXT_URL, EXT_ANON, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userRes } = await userClient.auth.getUser(jwt);
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const whatsapp = String(body?.whatsapp || "").replace(/\D/g, "");
    if (whatsapp.length < 10 || whatsapp.length > 13) return json({ error: "whatsapp inválido" }, 400);

    const svc = createClient(EXT_URL, EXT_SVC);

    // Rate-limit: máx 3 OTP por hora por usuário
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await svc.from("whatsapp_otp").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", since);
    if ((count ?? 0) >= 3) return json({ error: "rate_limited" }, 429);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256Hex(code + userId);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await svc.from("whatsapp_otp").insert({
      user_id: userId, whatsapp, code_hash: codeHash, expires_at: expiresAt,
    });

    // Envia via plataforma
    const send = await fetch(`${EXT_URL}/functions/v1/platform-whatsapp-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EXT_ANON, Authorization: `Bearer ${EXT_SVC}` },
      body: JSON.stringify({
        phone: whatsapp,
        message: `ItaSuper: seu código de verificação é *${code}*. Válido por 10 minutos. Não compartilhe.`,
        kind: "otp",
        category: "verificacao",
        force: true,
      }),
    });
    if (!send.ok) return json({ error: "send_failed", detail: await send.text() }, 502);

    return json({ ok: true, expires_at: expiresAt });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});