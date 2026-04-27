// One-shot maintenance: sanitize all profiles.pix_key in EXTERNAL Supabase
// to the format Asaas expects. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function sanitize(key: string, type: string): string {
  const raw = (key || "").trim();
  if (!raw) return raw;
  switch ((type || "").toLowerCase()) {
    case "cpf":
    case "cnpj":
      return raw.replace(/\D/g, "");
    case "phone": {
      const digits = raw.replace(/\D/g, "");
      if (digits.length === 11) return `+55${digits}`;
      if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
      if (raw.startsWith("+")) return raw;
      return `+${digits}`;
    }
    case "email":
      return raw.toLowerCase();
    default:
      return raw;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Authorize: require admin via Lovable Cloud (internal) JWT
    const authHeader = req.headers.get("Authorization") || "";
    const internal = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await internal.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await adminClient.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;
    if (!externalUrl || !externalKey) return json({ error: "External not configured" }, 500);

    const ext = createClient(externalUrl, externalKey);
    const { data: rows, error } = await ext.from("profiles").select("user_id, full_name, pix_key, pix_type").not("pix_key", "is", null).not("pix_type", "is", null);
    if (error) return json({ error: error.message }, 500);

    const results: any[] = [];
    for (const r of rows || []) {
      const cleaned = sanitize(r.pix_key as string, r.pix_type as string);
      if (cleaned !== r.pix_key) {
        const { error: upErr } = await ext.from("profiles").update({ pix_key: cleaned }).eq("user_id", r.user_id);
        results.push({ user_id: r.user_id, name: r.full_name, type: r.pix_type, before: r.pix_key, after: cleaned, ok: !upErr, error: upErr?.message });
      }
    }
    return json({ scanned: rows?.length || 0, updated: results.length, details: results });
  } catch (e: any) {
    return json({ error: e?.message || "Erro" }, 500);
  }
});
