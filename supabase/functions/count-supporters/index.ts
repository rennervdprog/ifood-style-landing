import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;
    const client = createClient(url, key);
    const { data, error } = await client
      .from("store_plans")
      .select("store_id, plan_type, is_active");
    if (error) throw error;
    const supporters = (data ?? []).filter((r: any) => r.plan_type === "supporter" && r.is_active);
    return new Response(JSON.stringify({ count: supporters.length, all: data, supporters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ count: 0, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});