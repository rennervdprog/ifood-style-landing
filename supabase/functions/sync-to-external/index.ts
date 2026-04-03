import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function syncTable(
  internalClient: ReturnType<typeof createClient>,
  externalClient: ReturnType<typeof createClient>,
  table: string,
  conflict: string = "id",
  filter?: (q: any) => any
) {
  let query = internalClient.from(table).select("*");
  if (filter) query = filter(query);
  const { data, error: fetchErr } = await query;
  if (fetchErr) return { count: 0, error: fetchErr.message };
  if (!data?.length) return { count: 0 };
  const { error: upsertErr } = await externalClient
    .from(table)
    .upsert(data, { onConflict: conflict });
  return { count: data.length, error: upsertErr?.message };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const internalUrl = Deno.env.get("SUPABASE_URL")!;
    const internalServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalClient = createClient(internalUrl, internalServiceKey);

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");

    if (!externalUrl || !externalKey) {
      return jsonRes({ error: "External Supabase credentials not configured" }, 500);
    }

    const externalClient = createClient(externalUrl, externalKey);

    // Auth: accept service_role key (DB triggers) or admin JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("sync-to-external: No Authorization header");
      return jsonRes({ error: "Missing authorization" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    // Compare first 20 chars for debug (safe partial log)
    console.log("sync-to-external auth debug:", {
      tokenPrefix: token.substring(0, 20),
      serviceKeyPrefix: serviceRoleKey.substring(0, 20),
      internalKeyPrefix: internalServiceKey.substring(0, 20),
      match: token === serviceRoleKey || token === internalServiceKey,
    });

    const isServiceRole = token === internalServiceKey || token === serviceRoleKey;

    if (!isServiceRole) {
      // Try to validate as a user JWT (admin access)
      try {
        const authClient = createClient(internalUrl, serviceRoleKey || internalServiceKey);
        const { data: { user }, error: authError } = await authClient.auth.getUser(token);

        if (authError || !user) {
          console.log("sync-to-external: JWT validation failed", authError?.message);
          return jsonRes({ error: "Unauthorized" }, 401);
        }

        // Check admin via RPC
        const { data: isAdmin } = await internalClient.rpc("is_platform_admin", { _user_id: user.id });
        if (!isAdmin) return jsonRes({ error: "Admin only" }, 403);
      } catch (e) {
        console.log("sync-to-external: Auth exception", e);
        return jsonRes({ error: "Unauthorized" }, 401);
      }
    }

    const body = await req.json();
    const { action, data: payload } = body;

    // ── test_connection ──
    if (action === "test_connection") {
      try {
        const { error: testError } = await externalClient.from("stores").select("id").limit(1);
        const connected = !testError || testError.code === "42P01";
        return jsonRes({
          success: connected,
          message: connected ? "Conexão com banco externo ativa!" : `Erro: ${testError?.message}`,
          external_url: externalUrl.replace(/\/\/(.{4}).*@/, "//$1***@"),
        });
      } catch (e) {
        return jsonRes({ success: false, message: `Falha na conexão: ${e.message}` });
      }
    }

    // ── sync_record (generic single-record upsert from triggers) ──
    if (action === "sync_record") {
      const { table, record, conflict_column } = payload || {};
      if (!table || !record) return jsonRes({ error: "Missing table or record" }, 400);

      // Enrich profiles with email from auth.users
      if (table === "profiles" && record.user_id && !record.email) {
        try {
          const { data: authData } = await internalClient.auth.admin.getUserById(record.user_id);
          if (authData?.user?.email) record.email = authData.user.email;
        } catch (_) { /* skip */ }
      }

      const { error } = await externalClient
        .from(table)
        .upsert(record, { onConflict: conflict_column || "id" });
      if (error) {
        console.error(`Sync ${table} error:`, error);
        return jsonRes({ error: `Sync ${table} failed: ${error.message}` }, 500);
      }
      return jsonRes({ success: true, synced: table, id: record.id });
    }

    // ── sync_order (single order + items) ──
    if (action === "sync_order") {
      if (!payload?.order) return jsonRes({ error: "Missing order data" }, 400);

      const { error: upsertError } = await externalClient
        .from("orders")
        .upsert(payload.order, { onConflict: "id" });

      if (upsertError) {
        console.error("Sync order error:", upsertError);
        return jsonRes({ error: `Sync failed: ${upsertError.message}` }, 500);
      }

      if (payload.order_items?.length) {
        const { error: itemsError } = await externalClient
          .from("order_items")
          .upsert(payload.order_items, { onConflict: "id" });
        if (itemsError) console.error("Sync order_items error:", itemsError);
      }

      return jsonRes({ success: true, synced: "order", id: payload.order.id });
    }

    // ── sync_profile ──
    if (action === "sync_profile") {
      if (!payload?.profile) return jsonRes({ error: "Missing profile data" }, 400);

      // If email not in profile data, fetch from auth.users
      let email = payload.profile.email;
      if (!email && payload.profile.user_id) {
        const { data: authData } = await internalClient.auth.admin.getUserById(payload.profile.user_id);
        email = authData?.user?.email || null;
      }

      const profileData = {
        id: payload.profile.id,
        user_id: payload.profile.user_id,
        full_name: payload.profile.full_name,
        role: payload.profile.role,
        is_approved: payload.profile.is_approved ?? false,
        document: payload.profile.document,
        phone: payload.profile.phone,
        vehicle: payload.profile.vehicle,
        whatsapp_number: payload.profile.whatsapp_number,
        created_at: payload.profile.created_at,
        email: email,
      };

      try {
        const { error: upsertError } = await externalClient
          .from("profiles")
          .upsert(profileData, { onConflict: "user_id", ignoreDuplicates: false });
        if (upsertError) {
          if (upsertError.code === "23503") {
            await externalClient.from("profiles").upsert(profileData, { onConflict: "id", ignoreDuplicates: false });
          } else {
            console.error("Sync profile error:", upsertError);
          }
        }
      } catch (e) {
        console.error("Sync profile exception:", e.message);
      }

      return jsonRes({ success: true, synced: "profile", id: profileData.id });
    }

    // ── sync_all (bulk sync of ALL operational tables) ──
    if (action === "sync_stores" || action === "sync_all") {
      const results: Record<string, { count: number; error?: string }> = {};

      // Core tables
      results.stores = await syncTable(internalClient, externalClient, "stores");
      results.products = await syncTable(internalClient, externalClient, "products");
      results.menu_sections = await syncTable(internalClient, externalClient, "menu_sections");
      results.neighborhood_fees = await syncTable(internalClient, externalClient, "neighborhood_fees");
      // Profiles: enrich with email from auth.users
      {
        let query = internalClient.from("profiles").select("*").in("role", ["lojista", "motoboy"]);
        const { data: profilesData, error: profilesErr } = await query;
        if (profilesErr) {
          results.profiles = { count: 0, error: profilesErr.message };
        } else if (!profilesData?.length) {
          results.profiles = { count: 0 };
        } else {
          // Enrich with emails from auth
          for (const p of profilesData) {
            if (!p.email && p.user_id) {
              try {
                const { data: authData } = await internalClient.auth.admin.getUserById(p.user_id);
                if (authData?.user?.email) p.email = authData.user.email;
              } catch (_) { /* skip */ }
            }
          }
          const { error: upsertErr } = await externalClient
            .from("profiles")
            .upsert(profilesData, { onConflict: "id" });
          results.profiles = { count: profilesData.length, error: upsertErr?.message };
        }
      }
      results.addon_groups = await syncTable(internalClient, externalClient, "addon_groups");
      results.addon_items = await syncTable(internalClient, externalClient, "addon_items");
      results.product_addon_groups = await syncTable(internalClient, externalClient, "product_addon_groups");
      results.opening_hours = await syncTable(internalClient, externalClient, "opening_hours");

      // Operational tables
      results.orders = await syncTable(internalClient, externalClient, "orders");
      results.order_items = await syncTable(internalClient, externalClient, "order_items");
      results.order_messages = await syncTable(internalClient, externalClient, "order_messages");
      results.drivers = await syncTable(internalClient, externalClient, "drivers");
      results.driver_balances = await syncTable(internalClient, externalClient, "driver_balances");
      results.driver_earnings = await syncTable(internalClient, externalClient, "driver_earnings");
      results.financial_transactions = await syncTable(internalClient, externalClient, "financial_transactions");
      results.store_balances = await syncTable(internalClient, externalClient, "store_balances");
      results.coupons = await syncTable(internalClient, externalClient, "coupons");

      const hasErrors = Object.values(results).some((r) => r.error);

      return jsonRes({ success: !hasErrors, results });
    }

    return jsonRes({ error: "Unknown action. Use: test_connection, sync_record, sync_order, sync_profile, sync_all" }, 400);
  } catch (err) {
    console.error("sync-to-external error:", err);
    return jsonRes({ error: err.message || "Internal error" }, 500);
  }
});
