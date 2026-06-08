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

    const token = authHeader.replace("Bearer ", "").trim();

    // Internal calls (DB triggers, cron) use the service-role key directly — bypass user check.
    const isServiceRole = token === supabaseServiceKey;
    let callerUserId = "service_role";

    if (!isServiceRole) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnon);
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      if (authError || !user) {
        console.error("[send-push] Auth failed:", authError?.message || "no user");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = user.id;
    }
    console.log(`[send-push] Authenticated: ${isServiceRole ? "service_role" : callerUserId}`);

    const body = await req.json();
    const { user_ids, title, body: msgBody, data } = body;

    if (!user_ids || !Array.isArray(user_ids) || !title) {
      console.error("[send-push] ❌ Validation failed: user_ids or title missing", { user_ids, title });
      return new Response(JSON.stringify({ error: "user_ids (array) and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── ROLE CHECK: Only admin, store owners, or drivers can send push ──
    // Service-role internal calls bypass the role check.
    const { data: isAdmin } = isServiceRole
      ? { data: true }
      : await supabaseAdmin.rpc("is_platform_admin", { _user_id: callerUserId });

    if (!isAdmin) {
      // Check if caller is a store owner or driver
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("user_id", callerUserId)
        .maybeSingle();

      const callerRole = callerProfile?.role;

       // Check if they are a store owner or driver regardless of their profile.role
       const { data: ownedStores } = await supabaseAdmin
         .from("stores")
         .select("id")
         .eq("owner_id", callerUserId);
       
       const isStoreOwner = (ownedStores || []).length > 0;

       const { data: driverInfo } = await supabaseAdmin
         .from("drivers")
         .select("id")
         .eq("user_id", callerUserId)
         .maybeSingle();

       const isDriver = !!driverInfo;

       // Priority roles: lojista (store owner) or motoboy (driver)
       const effectiveRole = isStoreOwner || callerRole === "lojista" ? "lojista" : (isDriver || callerRole === "motoboy" ? "motoboy" : callerRole);

       if (effectiveRole !== "lojista" && effectiveRole !== "motoboy") {
         console.warn(`[send-push] Denied: user ${callerUserId} has role ${callerRole}, isStoreOwner=${isStoreOwner}, isDriver=${isDriver}`);
         return new Response(JSON.stringify({ error: "Sem permissão para enviar notificações." }), {
           status: 403,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
       console.log(`[send-push] Effective role for ${callerUserId}: ${effectiveRole}`);

      // Validate that target user_ids are related to caller's orders
      const requestedUserIds = [...new Set((user_ids as string[]).filter(Boolean))];
      let allowedUserIds: Set<string>;

       if (effectiveRole === "lojista") {
         const ownedStoreIds = (ownedStores || []).map((s: any) => s.id).filter(Boolean);

        const { data: storeOrders } = ownedStoreIds.length > 0
          ? await supabaseAdmin
              .from("orders")
              .select("client_id, driver_id")
              .in("store_id", ownedStoreIds)
          : { data: [] as Array<{ client_id: string | null; driver_id: string | null }> };

        const { data: linkedDrivers } = ownedStoreIds.length > 0
          ? await supabaseAdmin
              .from("store_drivers")
              .select("driver_user_id")
              .in("store_id", ownedStoreIds)
          : { data: [] as Array<{ driver_user_id: string | null }> };

        allowedUserIds = new Set<string>();
        for (const o of storeOrders || []) {
          if (o.client_id) allowedUserIds.add(o.client_id);
          if (o.driver_id) allowedUserIds.add(o.driver_id);
        }
        for (const d of linkedDrivers || []) {
          if (d.driver_user_id) allowedUserIds.add(d.driver_user_id);
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
      .select("user_id, player_id, device_info")
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
          .select("token, user_id, device_info, updated_at")
          .in("user_id", fcmTargetUserIds)
      : { data: [] as Array<{ token: string; user_id: string }> };

    if (Deno.env.get("DEBUG_PUSH") === "true") {
      console.log(`[send-push] 🔍 DEBUG: FCM tokens count=${(fcmTokens || []).length} for ${fcmTargetUserIds.length} target user(s)`);
    }

    const latestFcmTokens = Object.values(
      (fcmTokens || []).reduce((acc, row: any) => {
        const key = row.device_info || `token:${row.token}`;
        const current = acc[key];
        if (!current || new Date(row.updated_at || 0).getTime() >= new Date(current.updated_at || 0).getTime()) {
          acc[key] = row;
        }
        return acc;
      }, {} as Record<string, any>)
    ) as Array<{ token: string; user_id: string; device_info?: string | null; updated_at?: string | null }>;

    if (Deno.env.get("DEBUG_PUSH") === "true") {
      console.log(`[send-push] 🔍 DEBUG: After dedup, FCM tokens selected=${latestFcmTokens.length}`);
    }

    if (latestFcmTokens.length > 0 && serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      // Accept both itasuper and itafood to avoid mismatch errors during transition
      const validProjectIds = ["itasuper-c71a1", "itafood-c71a1"];
      if (!validProjectIds.includes(serviceAccount.project_id)) {
        console.warn(`[send-push] ⚠️ PROJECT ID MISMATCH: Secret has ${serviceAccount.project_id} which is not in allowed list ${JSON.stringify(validProjectIds)}`);
      }

      const accessToken = await getAccessToken(serviceAccount);
      const projectId = serviceAccount.project_id;

      // FCM data must be Record<string, string>
      const stringifiedData: Record<string, string> = {};
      if (data && typeof data === "object") {
        for (const [k, v] of Object.entries(data)) {
          if (v === null || v === undefined) continue;
          stringifiedData[k] = typeof v === "string" ? v : String(v);
        }
      }
      // Ensure link is always present so tap handler knows where to go
      if (!stringifiedData.link) stringifiedData.link = "/";

      for (const { token: fcmToken } of latestFcmTokens) {
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
                      vibrate: [200, 100, 200, 100, 200, 100, 200],
                      tag: stringifiedData.order_id ? `order-${stringifiedData.order_id}` : undefined,
                      renotify: true,
                      requireInteraction: true,
                    },
                    fcm_options: { link: stringifiedData.link || "/" },
                  },
                  android: {
                    priority: "high",
                    notification: {
                      icon: "ic_notification",
                      sound: "order_bell",
                      channel_id: "itasuper_orders",
                      // NOTE: Removed click_action "FCM_PLUGIN_ACTIVITY" — that was
                      // a Cordova FCM plugin constant. Capacitor uses the default
                      // launcher activity, and the tap is captured by the
                      // pushNotificationActionPerformed listener.
                      default_vibrate_timings: false,
                      vibrate_timings: ["0s", "0.3s", "0.2s", "0.3s", "0.2s", "0.3s", "0.2s", "0.3s"],
                      default_sound: true,
                      notification_priority: "PRIORITY_MAX",
                      visibility: "PUBLIC",
                    },
                  },
                  apns: {
                    payload: {
                      aps: {
                        sound: {
                          critical: 1,
                          name: "order_bell.caf",
                          volume: 1.0,
                        },
                        "interruption-level": "time-sensitive",
                        badge: 1,
                      },
                    },
                    headers: {
                      "apns-priority": "10",
                    },
                  },
                  // CRITICAL: data must be flat Record<string,string> for Capacitor
                  // pushNotificationActionPerformed listener to receive it correctly
                  data: stringifiedData,
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
        const latestPlayers = Object.values(
          osPlayers.reduce((acc: Record<string, any>, row: any) => {
            const key = row.device_info || `player:${row.player_id}`;
            if (!acc[key]) acc[key] = row;
            return acc;
          }, {})
        );
        const playerIds = [...new Set(latestPlayers.map((p: any) => p.player_id).filter(Boolean))];
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
