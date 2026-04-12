import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.24.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const bodySchema = z.object({
  device_info: z.string().max(200).optional(),
  fcm_token: z.string().min(20).max(512).optional(),
  player_id: z.string().min(8).max(255).optional(),
}).refine((value) => Boolean(value.fcm_token || value.player_id), {
  message: "fcm_token or player_id is required",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { fcm_token, player_id, device_info } = parsed.data;

    if (fcm_token) {
      await supabaseAdmin
        .from("fcm_tokens")
        .delete()
        .eq("token", fcm_token)
        .neq("user_id", user.id);

      if (device_info) {
        await supabaseAdmin
          .from("fcm_tokens")
          .delete()
          .eq("device_info", device_info)
          .neq("user_id", user.id);

        await supabaseAdmin
          .from("fcm_tokens")
          .delete()
          .eq("user_id", user.id)
          .eq("device_info", device_info)
          .neq("token", fcm_token);
      }

      const { error } = await supabaseAdmin
        .from("fcm_tokens")
        .upsert(
          {
            user_id: user.id,
            token: fcm_token,
            device_info: device_info ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,token" },
        );

      if (error) {
        console.error("[register-push-device] fcm upsert error:", error);
        throw error;
      }
    }

    if (player_id) {
      await supabaseAdmin
        .from("onesignal_players")
        .delete()
        .eq("player_id", player_id)
        .neq("user_id", user.id);

      if (device_info) {
        await supabaseAdmin
          .from("onesignal_players")
          .delete()
          .eq("device_info", device_info)
          .neq("user_id", user.id);

        await supabaseAdmin
          .from("onesignal_players")
          .delete()
          .eq("user_id", user.id)
          .eq("device_info", device_info)
          .neq("player_id", player_id);
      }

      const { error } = await supabaseAdmin
        .from("onesignal_players")
        .upsert(
          {
            user_id: user.id,
            player_id,
            device_info: device_info ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,player_id" },
        );

      if (error) {
        console.error("[register-push-device] onesignal upsert error:", error);
        throw error;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      claimed: {
        fcm: Boolean(fcm_token),
        onesignal: Boolean(player_id),
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[register-push-device] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
