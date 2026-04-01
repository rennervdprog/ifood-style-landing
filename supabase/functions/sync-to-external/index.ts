import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Internal Supabase client (for auth)
    const internalUrl = Deno.env.get("SUPABASE_URL")!;
    const internalServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalClient = createClient(internalUrl, internalServiceKey);

    // External Supabase client
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");

    if (!externalUrl || !externalKey) {
      return new Response(
        JSON.stringify({ error: "External Supabase credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalClient = createClient(externalUrl, externalKey);

    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      internalUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.email !== "vinivias13@gmail.com") {
      return new Response(
        JSON.stringify({ error: "Admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, data: payload } = body;

    // ACTION: test_connection
    if (action === "test_connection") {
      try {
        // Try a simple query on the external DB
        const { error: testError } = await externalClient
          .from("_sync_test")
          .select("*")
          .limit(1);
        
        // Even if table doesn't exist, connection works if we get a specific error
        const connected = !testError || testError.code === "42P01" || testError.message?.includes("does not exist");
        
        return new Response(
          JSON.stringify({ 
            success: connected, 
            message: connected ? "Conexão com banco externo ativa!" : `Erro: ${testError?.message}`,
            external_url: externalUrl.replace(/\/\/(.{4}).*@/, '//$1***@') // mask credentials
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, message: `Falha na conexão: ${e.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ACTION: sync_order (single order upsert)
    if (action === "sync_order") {
      if (!payload?.order) {
        return new Response(
          JSON.stringify({ error: "Missing order data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: upsertError } = await externalClient
        .from("orders")
        .upsert(payload.order, { onConflict: "id" });

      if (upsertError) {
        console.error("Sync order error:", upsertError);
        return new Response(
          JSON.stringify({ error: `Sync failed: ${upsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Also sync order items if provided
      if (payload.order_items?.length) {
        const { error: itemsError } = await externalClient
          .from("order_items")
          .upsert(payload.order_items, { onConflict: "id" });
        if (itemsError) console.error("Sync order_items error:", itemsError);
      }

      return new Response(
        JSON.stringify({ success: true, synced: "order", id: payload.order.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: sync_stores (bulk stores + products)
    if (action === "sync_stores") {
      const results: Record<string, { count: number; error?: string }> = {};

      // Fetch stores from internal DB
      const { data: storesData, error: storesErr } = await internalClient
        .from("stores")
        .select("*");

      if (storesErr) {
        results.stores = { count: 0, error: storesErr.message };
      } else if (storesData?.length) {
        const { error: upsertErr } = await externalClient
          .from("stores")
          .upsert(storesData, { onConflict: "id" });
        results.stores = { count: storesData.length, error: upsertErr?.message };
      } else {
        results.stores = { count: 0 };
      }

      // Fetch products
      const { data: productsData, error: productsErr } = await internalClient
        .from("products")
        .select("*");

      if (productsErr) {
        results.products = { count: 0, error: productsErr.message };
      } else if (productsData?.length) {
        const { error: upsertErr } = await externalClient
          .from("products")
          .upsert(productsData, { onConflict: "id" });
        results.products = { count: productsData.length, error: upsertErr?.message };
      } else {
        results.products = { count: 0 };
      }

      // Fetch profiles (lojistas)
      const { data: profilesData, error: profilesErr } = await internalClient
        .from("profiles")
        .select("*")
        .in("role", ["lojista", "motoboy"]);

      if (profilesErr) {
        results.profiles = { count: 0, error: profilesErr.message };
      } else if (profilesData?.length) {
        const { error: upsertErr } = await externalClient
          .from("profiles")
          .upsert(profilesData, { onConflict: "id" });
        results.profiles = { count: profilesData.length, error: upsertErr?.message };
      } else {
        results.profiles = { count: 0 };
      }

      // Menu sections
      const { data: sectionsData } = await internalClient.from("menu_sections").select("*");
      if (sectionsData?.length) {
        const { error: upsertErr } = await externalClient
          .from("menu_sections")
          .upsert(sectionsData, { onConflict: "id" });
        results.menu_sections = { count: sectionsData.length, error: upsertErr?.message };
      }

      const hasErrors = Object.values(results).some(r => r.error);

      return new Response(
        JSON.stringify({ success: !hasErrors, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: test_connection, sync_order, sync_stores" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-to-external error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
