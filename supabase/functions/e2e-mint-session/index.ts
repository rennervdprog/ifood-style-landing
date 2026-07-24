import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-e2e-token",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function findUserByEmail(url: string, serviceKey: string, email: string) {
  const direct = await fetch(`${url}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email)}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (direct.ok) {
    const body = await direct.json().catch(() => null);
    const users = Array.isArray(body?.users) ? body.users : Array.isArray(body) ? body : [];
    const found = users.find((u: any) => u?.email?.toLowerCase?.() === email.toLowerCase());
    if (found?.id) return found;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`list users failed: ${error.message}`);
    const found = data?.users?.find((u: any) => u?.email?.toLowerCase?.() === email.toLowerCase());
    if (found?.id) return found;
    if (!data?.users || data.users.length < 1000) break;
  }
  return null;
}

async function ensureE2eUser(url: string, serviceKey: string, email: string, password: string) {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const existing = await findUserByEmail(url, serviceKey, email);

  if (existing?.id) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata ?? {}), e2e: true },
    } as any);
    if (error) throw new Error(`reset test user failed: ${error.message}`);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "E2E Admin", e2e: true },
  });
  if (error) throw new Error(`create test user failed: ${error.message}`);
  if (!data?.user?.id) throw new Error("create test user returned no id");
  return data.user.id;
}

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
    const SERVICE =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ??
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "";
    const email = Deno.env.get("E2E_TEST_EMAIL") ?? "";
    const password = Deno.env.get("E2E_TEST_PASSWORD") ?? "";
    if (!URL_ || !ANON || !email || !password) return json({ error: "backend not configured" }, 500);

    const signIn = () => createClient(URL_, ANON, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password });
    let { data, error } = await signIn();

    // Self-heal: se as credenciais são inválidas e temos service key,
    // cria/atualiza o usuário e tenta novamente.
    if (error || !data?.session) {
      if (!SERVICE) return json({ error: "service key not configured for self-heal" }, 500);
      await ensureE2eUser(URL_, SERVICE, email, password);
      ({ data, error } = await signIn());
    }

    if (error || !data?.session) return json({ error: error?.message ?? "sign-in failed" }, 400);

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