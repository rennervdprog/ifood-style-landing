import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? Deno.env.get("E2E_TEST_EMAIL")!;
  const password = url.searchParams.get("password") ?? Deno.env.get("E2E_TEST_PASSWORD")!;
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) return new Response(JSON.stringify({ error: error?.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  return new Response(JSON.stringify(data.session), { headers: { ...cors, "Content-Type": "application/json" } });
});