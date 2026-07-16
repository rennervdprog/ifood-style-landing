// Provisiona (ou reaproveita) uma conta de teste PDV-only no Supabase EXTERNO
// para permitir testes end-to-end do fluxo de PDV. Retorna email/senha.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL = "sandbox+pdv1@itasuper.test";
const PASSWORD = "Sandbox#2026!";
const STORE_NAME = "Sandbox PDV Test";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    // 1) garante o usuário auth
    let userId: string | null = null;
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list.data?.users?.find((u) => (u.email || "").toLowerCase() === EMAIL);
    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
    } else {
      const created = await admin.auth.admin.createUser({
        email: EMAIL, password: PASSWORD, email_confirm: true,
        user_metadata: { full_name: "Sandbox PDV", role: "lojista" },
      });
      if (created.error) throw created.error;
      userId = created.data.user!.id;
    }

    // 2) garante profile
    await admin.from("profiles").upsert(
      { user_id: userId, full_name: "Sandbox PDV", email: EMAIL },
      { onConflict: "user_id" },
    );

    // 3) garante loja PDV-only do usuário
    const { data: store0 } = await admin.from("stores")
      .select("id, name, plan_type, status")
      .eq("owner_id", userId).maybeSingle();
    let storeId = store0?.id as string | undefined;
    if (!storeId) {
      const slug = "sandbox-pdv-" + Math.random().toString(36).slice(2, 6);
      const { data: st, error: se } = await admin.from("stores").insert({
        name: STORE_NAME, category: "lanches", owner_id: userId,
        status: "ativo", slug, plan_type: "pdv_only", is_visible: false,
        is_test: true,
      }).select("id").single();
      if (se) throw se;
      storeId = st.id;
      await admin.from("menu_sections").insert({ store_id: storeId, name: "Balcão", sort_order: 0 });
      // horários abertos
      const hours = Array.from({ length: 7 }, (_, d) => ({
        store_id: storeId, day_of_week: d, is_closed_all_day: false,
        open_time: "00:00", close_time: "23:59",
      }));
      await admin.from("opening_hours").insert(hours);
    } else {
      await admin.from("stores").update({ plan_type: "pdv_only", status: "ativo" }).eq("id", storeId);
    }

    // 4) garante store_plans pdv_only ativo
    await admin.from("store_plans").upsert(
      { store_id: storeId, plan_type: "pdv_only", monthly_fee: 69, commission_rate: 0, is_active: true, pdv_enabled: true },
      { onConflict: "store_id" },
    );

    // 5) garante add-on pdv habilitado (redundância defensiva)
    await admin.from("store_addons").upsert(
      { store_id: storeId, addon_code: "pdv", enabled: true, price_override: 0, activated_at: new Date().toISOString(), cancels_at: null },
      { onConflict: "store_id,addon_code" },
    );

    // 6) alguns produtos de teste
    const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId);
    if (!count) {
      const { data: sec } = await admin.from("menu_sections").select("id").eq("store_id", storeId).limit(1).maybeSingle();
      const sid = sec?.id;
      await admin.from("products").insert([
        { store_id: storeId, section_id: sid, name: "X-Burguer", price: 22.9, description: "Pão, blend, queijo", is_available: true },
        { store_id: storeId, section_id: sid, name: "Refrigerante Lata", price: 6, description: "350ml gelado", is_available: true },
        { store_id: storeId, section_id: sid, name: "Batata Frita", price: 14, description: "Porção 300g", is_available: true },
      ]);
    }

    return new Response(JSON.stringify({
      ok: true,
      credentials: { email: EMAIL, password: PASSWORD },
      store_id: storeId,
      login_url: (Deno.env.get("PUBLIC_APP_URL") || "") + "/auth",
    }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});