import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiter to prevent bot loops (per phone number)
const recentReplies = new Map<string, number>();
const REPLY_COOLDOWN_MS = 60_000; // 1 reply per phone per minute

const sanitize = (s: string) => String(s ?? "").replace(/[\r\n\t]+/g, " ").slice(0, 500);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Validate webhook token via query param ?token=<ZAPI_WEBHOOK_SECRET>
    const expectedToken = Deno.env.get("ZAPI_WEBHOOK_SECRET") || Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    if (!expectedToken) {
      console.error("[zapi-webhook] ZAPI_WEBHOOK_SECRET não configurado — rejeitando");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Aceita token via header (preferido) OU query string (compat com configs existentes)
    const receivedToken =
      req.headers.get("x-webhook-token") ||
      req.headers.get("x-internal-token") ||
      url.searchParams.get("token") ||
      "";
    if (receivedToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Identify which store this webhook is for via query param ?store=<uuid>
    const storeId = url.searchParams.get("store");
    if (!storeId) {
      return new Response(JSON.stringify({ error: "missing store param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));

    // Z-API "on-message-received" payload shape (varies; we read defensively)
    // Common fields: phone, fromMe, isGroup, text: { message }
    const fromMe = payload?.fromMe === true;
    const isGroup = payload?.isGroup === true;
    const phone = String(payload?.phone || payload?.from || "").replace(/\D/g, "");
    const incomingText = sanitize(
      payload?.text?.message || payload?.message || payload?.body || ""
    );

    // Ignore our own outbound messages, group chats, and empty payloads
    if (fromMe || isGroup || !phone) {
      return new Response(JSON.stringify({ ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maskedPhone = phone ? `${phone.slice(0,4)}****${phone.slice(-2)}` : "";
    console.log("zapi-webhook in:", { storeId, phone: maskedPhone, preview: incomingText.slice(0, 80) });

    // Rate-limit replies per phone (avoid bot-vs-bot loop)
    const key = `${storeId}:${phone}`;
    const last = recentReplies.get(key) || 0;
    if (Date.now() - last < REPLY_COOLDOWN_MS) {
      return new Response(JSON.stringify({ rate_limited: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load store + secrets
    const [{ data: store }, { data: secrets }] = await Promise.all([
      admin.from("stores").select("id, name, slug").eq("id", storeId).maybeSingle(),
      admin
        .from("store_secrets")
        .select("zapi_enabled, zapi_instance_id, zapi_token, zapi_client_token")
        .eq("store_id", storeId)
        .maybeSingle(),
    ]);

    if (!store) {
      return new Response(JSON.stringify({ error: "store not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      !secrets?.zapi_enabled ||
      !secrets.zapi_instance_id ||
      !secrets.zapi_token ||
      !secrets.zapi_client_token
    ) {
      return new Response(JSON.stringify({ error: "Z-API not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build reply with link to the store
    const baseUrl = "https://itasuper.com.br";
    const link = store.slug ? `${baseUrl}/loja/${store.slug}` : `${baseUrl}/loja/${store.id}`;
    const reply =
      `Olá! 👋 Aqui é o atendimento automático de *${store.name}*.\n\n` +
      `Faça seu pedido pelo nosso app — cardápio, preços e acompanhamento em tempo real:\n` +
      `👉 ${link}\n\n` +
      `Após confirmar o pedido, você receberá atualizações por aqui automaticamente. 🛵`;

    // Format phone with BR country code if missing
    let toPhone = phone;
    if (toPhone.length <= 11) toPhone = "55" + toPhone;

    const zapiUrl = `https://api.z-api.io/instances/${secrets.zapi_instance_id}/token/${secrets.zapi_token}/send-text`;
    const zapiResp = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": secrets.zapi_client_token,
      },
      body: JSON.stringify({ phone: toPhone, message: reply }),
    });

    if (zapiResp.ok) {
      recentReplies.set(key, Date.now());
      // Cleanup old entries occasionally
      if (recentReplies.size > 1000) {
        const cutoff = Date.now() - REPLY_COOLDOWN_MS * 5;
        for (const [k, v] of recentReplies.entries()) {
          if (v < cutoff) recentReplies.delete(k);
        }
      }
    } else {
      const errBody = await zapiResp.text();
      console.error("Z-API reply failed:", zapiResp.status, errBody.slice(0, 200));
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("zapi-webhook error:", err);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
