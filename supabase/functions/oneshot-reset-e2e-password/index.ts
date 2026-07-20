import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const email = Deno.env.get("E2E_TEST_EMAIL") || "e2e-admin@itasuper.test";
  const newPass = "Boutique#2026";
  const admin = createClient(URL_, SVC);
  const { data: list, error: le } = await admin.auth.admin.listUsers();
  if (le) return new Response(JSON.stringify({ error: le.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  const u = list.users.find((x) => x.email === email);
  if (!u) return new Response(JSON.stringify({ error: "user not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
  const { error } = await admin.auth.admin.updateUserById(u.id, { password: newPass });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ ok: true, email, password: newPass }), { headers: { ...cors, "Content-Type": "application/json" } });
});