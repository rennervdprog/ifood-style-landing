// Confere código OTP. Se OK, marca profiles.whatsapp_verified_at = now().
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
    const code = String(body?.code || "").replace(/\D/g, "");
    if (code.length !== 6) return json({ error: "código inválido" }, 400);

    const svc = createClient(EXT_URL, EXT_SVC);
    const codeHash = await sha256Hex(code + userId);

    const { data: otp } = await svc.from("whatsapp_otp")
      .select("*").eq("user_id", userId).is("verified_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (!otp) return json({ error: "código expirado ou inexistente" }, 400);
    if ((otp.attempts ?? 0) >= 5) return json({ error: "excesso de tentativas" }, 429);

    if (otp.code_hash !== codeHash) {
      await svc.from("whatsapp_otp").update({ attempts: (otp.attempts ?? 0) + 1 }).eq("id", otp.id);
      return json({ error: "código incorreto" }, 400);
    }

    await svc.from("whatsapp_otp").update({ verified_at: new Date().toISOString() }).eq("id", otp.id);
    await svc.from("profiles").upsert({
      user_id: userId, whatsapp_verified_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});