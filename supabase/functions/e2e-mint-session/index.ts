import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-e2e-token",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * E2E-only: mints a Supabase session for a fixed test user.
 * Protected by a shared secret (E2E_SETUP_TOKEN). Never expose to prod clients.
 * Requires secrets on the EXTERNAL project:
 *   - EXTERNAL_SUPABASE_URL (or SUPABASE_URL when deployed on external itself)
 *   - EXTERNAL_SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 *   - EXTERNAL_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)
 *   - E2E_SETUP_TOKEN
 *   - E2E_TEST_EMAIL, E2E_TEST_PASSWORD
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const provided = req.headers.get("x-e2e-token") ?? "";
    const expected = Deno.env.get("E2E_SETUP_TOKEN") ?? "";
    if (!expected || provided !== expected) return json({ error: "unauthorized" }, 401);

    const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const email = Deno.env.get("E2E_TEST_EMAIL") ?? "";
    const password = Deno.env.get("E2E_TEST_PASSWORD") ?? "";
    if (!URL_ || !ANON || !email || !password) return json({ error: "backend not configured" }, 500);

    const client = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: error?.message ?? "sign-in failed" }, 400);

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: data.session.user,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "error" }, 500);
  }
});