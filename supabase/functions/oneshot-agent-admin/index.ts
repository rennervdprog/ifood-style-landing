import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
    const SVC  = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const url = new URL(req.url);
    const email = url.searchParams.get("email") ?? "e2e-admin@itasuper.test";
    const password = "AgentE2E!2026";

    const admin = createClient(URL_, SVC, { auth: { persistSession: false } });

    // Find or create user
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list.data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (!user) {
      const c = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      user = c.data.user!;
    } else {
      await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    }

    // Fetch current legal versions
    const { data: legal } = await admin.from("legal_documents").select("kind,version").eq("is_current", true);
    const t = legal?.find((r: any) => r.kind === "terms")?.version ?? "1.0.0";
    const p = legal?.find((r: any) => r.kind === "privacy")?.version ?? "1.0.0";

    // Upsert profile: set role admin (if column exists), accepted versions, delivery_pin
    await admin.from("profiles").update({
      terms_version_accepted: t,
      privacy_version_accepted: p,
      delivery_pin: "7391",
    }).eq("user_id", user!.id);

    // Record acceptance
    await admin.from("terms_acceptance").insert({
      user_id: user!.id,
      terms_version: t,
      privacy_version: p,
      user_agent: "agent-e2e",
      accepted_at: new Date().toISOString(),
    });

    // Grant admin role
    await admin.from("user_roles").upsert({ user_id: user!.id, role: "admin" }, { onConflict: "user_id,role" });

    // Sign in
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return new Response(JSON.stringify({ error: error?.message ?? "sign-in failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(data.session), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});