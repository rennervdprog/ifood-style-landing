import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://itasuper.com.br",
  "https://www.itasuper.com.br",
  "https://itasuper.lovable.app",
  "https://id-preview--e8d28ade-d633-4d74-be21-61c8dbe24765.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers });
  try {
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;
    const client = createClient(url, key);
    const { count, error } = await client
      .from("store_plans")
      .select("*", { count: "exact", head: true })
      .eq("plan_type", "supporter")
      .eq("is_active", true);
    if (error) throw error;
    return new Response(JSON.stringify({ count: count ?? 0 }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ count: 0, error: String(e) }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});