import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

// This function is DEPRECATED — all webhooks now come from Asaas via asaas-webhook.
// Kept for backward compatibility to handle any remaining Mercado Pago notifications.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.warn("[DEPRECATED] mercadopago-webhook called — all payments now use Asaas");
    
    // Just acknowledge the webhook to prevent retries
    return json({ received: true, deprecated: true, message: "Mercado Pago webhook deprecated. Use Asaas." });
  } catch (err) {
    console.error("Webhook error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
