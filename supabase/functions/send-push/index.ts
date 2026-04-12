import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google OAuth2 JWT for FCM v1 API
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedToken = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedToken}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// Send via OneSignal REST API using external_user_id (PRIMARY method)
async function sendOneSignalByExternalId(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, string> | undefined,
  appId: string,
  restApiKey: string
): Promise<{ sent: number; failed: number; debug: string }> {
  if (userIds.length === 0) return { sent: 0, failed: 0, debug: "no_user_ids" };

  console.log("[OneSignal] Sending via external_id:", JSON.stringify({ app_id: appId, user_ids: userIds, title }));

  const strategies = [
    {
      name: "aliases_v2",
      payload: {
        app_id: appId,
        include_aliases: { external_id: userIds },
        target_channel: "push",
        headings: { en: title },
        contents: { en: body || " " },
        data: data || {},
      },
    },
    {
      name: "external_user_ids_legacy",
      payload: {
        app_id: appId,
        include_external_user_ids: userIds,
        channel_for_external_user_ids: "push",
        headings: { en: title },
        contents: { en: body || " " },
        data: data || {},
      },
    },
  ];

  for (const strategy of strategies) {
    try {
      console.log(`[OneSignal] Trying strategy: ${strategy.name}`);
      const res = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${restApiKey}`,
        },
        body: JSON.stringify(strategy.payload),
      });

      const responseText = await res.text();
      console.log(`[OneSignal] ${strategy.name} status=${res.status}, body=${responseText}`);

      let result: any;
      try { result = JSON.parse(responseText); } catch {
        console.log(`[OneSignal] ${strategy.name} parse error, trying next...`);
        continue;
      }

      if (res.ok && !result.errors?.length && (result.recipients || 0) > 0) {
        const recipients = result.recipients || 0;
        console.log(`[OneSignal] ✅ ${strategy.name} sent to ${recipients} recipients`);
        return { sent: recipients, failed: 0, debug: `${strategy.name}: recipients=${recipients}, id=${result.id}` };
      } else {
        console.log(`[OneSignal] ${strategy.name} failed: ${responseText.slice(0, 200)}, trying next...`);
      }
    } catch (e) {
      console.log(`[OneSignal] ${strategy.name} exception: ${e}, trying next...`);
    }
  }

  console.error("[OneSignal] ❌ All strategies failed");
  return { sent: 0, failed: userIds.length, debug: "all_strategies_failed" };
}

// Send via OneSignal REST API using player_ids (fallback)
async function sendOneSignalByPlayerIds(
  playerIds: string[],
  title: string,
  body: string,
  data: Record<string, string> | undefined,
  appId: string,
  restApiKey: string
): Promise<{ sent: number; failed: number }> {
  if (playerIds.length === 0) return { sent: 0, failed: 0 };

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: body || " " },
        data: data || {},
      }),
    });

    const result = await res.json();
    if (res.ok && !result.errors) {
      return { sent: result.recipients || playerIds.length, failed: 0 };
    } else {
      console.error("[OneSignal] player_ids error:", JSON.stringify(result));
      return { sent: 0, failed: playerIds.length };
    }
  } catch (e) {
    console.error("[OneSignal] player_ids request error:", e);
    return { sent: 0, failed: playerIds.length };
  }
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon);
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      console.error("[send-push] Auth failed:", authError?.message || "no user");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerUserId = user.id;
    console.log(`[send-push] Authenticated user: ${callerUserId}`);

    const body = await req.json();
    const { user_ids, title, body: msgBody, data } = body;

    if (!user_ids || !Array.isArray(user_ids) || !title) {
      return new Response(JSON.stringify({ error: "user_ids (array) and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── ROLE CHECK: Only admin, store owners, or drivers can send push ──
    const { data: isAdmin } = await supabaseAdmin.rpc("is_platform_admin", { _user_id: callerUserId });

    if (!isAdmin) {
      // Check if caller is a store owner or driver
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("user_id", callerUserId)
        .maybeSingle();

      const callerRole = callerProfile?.role;

      if (callerRole !== "lojista" && callerRole !== "motoboy") {
        return new Response(JSON.stringify({ error: "Sem permissão para enviar notificações." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate that target user_ids are related to caller's orders
      const requestedUserIds = [...new Set((user_ids as string[]).filter(Boolean))];
      let allowedUserIds: Set<string>;

      if (callerRole === "lojista") {
        // Store owner can only notify clients/drivers from their store orders
        const { data: storeOrders } = await supabaseAdmin
          .from("orders")
          .select("client_id, driver_id")
          .in("store_id", (
            await supabaseAdmin.from("stores").select("id").eq("owner_id", callerUserId)
          ).data?.map((s: any) => s.id) || []);

        allowedUserIds = new Set<string>();
        for (const o of storeOrders || []) {
          if (o.client_id) allowedUserIds.add(o.client_id);
          if (o.driver_id) allowedUserIds.add(o.driver_id);
        }
      } else {
        // Driver can only notify clients/store owners from their assigned orders
        const { data: driverOrders } = await supabaseAdmin
          .from("orders")
          .select("client_id, store_id")
          .eq("driver_id", callerUserId);

        allowedUserIds = new Set<string>();
        for (const o of driverOrders || []) {
          if (o.client_id) allowedUserIds.add(o.client_id);
        }
        // Also get store owners
        if (driverOrders?.length) {
          const storeIds = [...new Set(driverOrders.map((o: any) => o.store_id).filter(Boolean))];
          const { data: stores } = await supabaseAdmin
            .from("stores")
            .select("owner_id")
            .in("id", storeIds);
          for (const s of stores || []) {
            if (s.owner_id) allowedUserIds.add(s.owner_id);
          }
        }
      }

      // Filter to only allowed targets
      const filteredUserIds = requestedUserIds.filter((id) => allowedUserIds.has(id));
      if (filteredUserIds.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum destinatário autorizado." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Replace user_ids with filtered list
      body.user_ids = filteredUserIds;
    }

    const requestedUserIds = [...new Set((body.user_ids as string[]).filter(Boolean))];

    const { data: osPlayers } = await supabaseAdmin
      .from("onesignal_players")
      .select("user_id, player_id")
      .in("user_id", requestedUserIds);

    const oneSignalUserIds = [...new Set((osPlayers || []).map((player: any) => player.user_id).filter(Boolean))];
    const oneSignalUserSet = new Set(oneSignalUserIds);

    // ── Firebase Web Push (send to ALL users with FCM tokens, including Capacitor native) ──
    let fcmSent = 0;
    let fcmFailed = 0;
    const staleTokens: string[] = [];

    const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    // Send FCM to ALL target users (don't skip users with OneSignal — they may also have Capacitor FCM tokens)
    const fcmTargetUserIds = requestedUserIds;

    const { data: fcmTokens } = fcmTargetUserIds.length > 0
      ? await supabaseAdmin
          .from("fcm_tokens")
          .select("token, user_id")
          .in("user_id", fcmTargetUserIds)
      : { data: [] as Array<{ token: string; user_id: string }> };

    if (fcmTokens && fcmTokens.length > 0 && serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      const accessToken = await getAccessToken(serviceAccount);
      const projectId = serviceAccount.project_id;

      for (const { token: fcmToken } of fcmTokens) {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token: fcmToken,
                  notification: { title, body: msgBody || "" },
                  webpush: {
                    notification: {
                      icon: "/icon-192x192.png",
                      badge: "/icon-192x192.png",
                      vibrate: [200, 100, 200],
                    },
                    fcm_options: { link: data?.link || "/" },
                  },
                  data: data || {},
                },
              }),
            }
          );

          const result = await res.json();
          if (res.ok) {
            fcmSent++;
          } else {
            fcmFailed++;
            if (result?.error?.code === 404 || result?.error?.code === 400) {
              staleTokens.push(fcmToken);
            }
            console.error("[FCM] send error:", JSON.stringify(result));
          }
        } catch (e) {
          fcmFailed++;
          console.error("[FCM] request error:", e);
        }
      }

      if (staleTokens.length > 0) {
        await supabaseAdmin.from("fcm_tokens").delete().in("token", staleTokens);
      }
    }

    // ── OneSignal Native Push ──
    let osSent = 0;
    let osFailed = 0;
    let osDebug = "not_configured";

    console.log(`[OneSignal] Config: appId=${onesignalAppId ? "SET" : "MISSING"}, apiKey=${onesignalApiKey ? "SET" : "MISSING"}`);

    if (onesignalAppId && onesignalApiKey && oneSignalUserIds.length > 0) {
      if (osPlayers && osPlayers.length > 0) {
        const playerIds = [...new Set(osPlayers.map((p: any) => p.player_id).filter(Boolean))];
        console.log(`[OneSignal] Sending only via player_ids for ${playerIds.length} target(s)`);
        const pidResult = await sendOneSignalByPlayerIds(
          playerIds, title, msgBody || "", data, onesignalAppId, onesignalApiKey
        );
        osSent = pidResult.sent;
        osFailed = pidResult.failed;
        osDebug = `player_ids_only: sent=${pidResult.sent}`;
      } else {
        console.log("[OneSignal] No player_ids in DB; skipping native push send");
        osDebug = "no_player_ids_in_db";
      }
    } else if (onesignalAppId && onesignalApiKey) {
      osDebug = "no_native_targets";
    }

    const response = {
      fcm: { sent: fcmSent, failed: fcmFailed, stale_cleaned: staleTokens.length },
      onesignal: { sent: osSent, failed: osFailed, debug: osDebug },
      total_sent: fcmSent + osSent,
    };

    console.log("[send-push] Final response:", JSON.stringify(response));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-push] error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
