import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  store_id: z.string().uuid(),
  phone: z.string().min(10).max(15),
  message: z.string().min(1).max(2000),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // This function is for internal server-to-server use only (DB triggers).
    // Authenticate by requiring the SERVICE_ROLE_KEY in the Authorization header.
    const auth = req.headers.get("Authorization") || "";
    const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (auth !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { store_id, phone, message } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: secrets } = await admin
      .from("store_secrets")
      .select("zapi_enabled, zapi_instance_id, zapi_token, zapi_client_token")
      .eq("store_id", store_id)
      .maybeSingle();

    if (
      !secrets?.zapi_enabled ||
      !secrets.zapi_instance_id ||
      !secrets.zapi_token ||
      !secrets.zapi_client_token
    ) {
      return new Response(JSON.stringify({ skipped: "zapi not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let toPhone = phone.replace(/\D/g, "");
    if (toPhone.length <= 11) toPhone = "55" + toPhone;

    const url = `https://api.z-api.io/instances/${secrets.zapi_instance_id}/token/${secrets.zapi_token}/send-text`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": secrets.zapi_client_token,
      },
      body: JSON.stringify({ phone: toPhone, message }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("zapi-send-internal Z-API error:", resp.status, txt.slice(0, 200));
      return new Response(JSON.stringify({ error: "zapi failed", status: resp.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("zapi-send-internal error:", err);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
