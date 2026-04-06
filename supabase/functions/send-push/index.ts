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

// Send via OneSignal REST API
async function sendOneSignalPush(
  playerIds: string[],
  title: string,
  body: string,
  data: Record<string, string> | undefined,
  appId: string,
  restApiKey: string
): Promise<{ sent: number; failed: number }> {
  if (playerIds.length === 0) return { sent: 0, failed: 0 };

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: body || "" },
        data: data || {},
      }),
    });

    const result = await res.json();
    if (res.ok && !result.errors) {
      return { sent: result.recipients || playerIds.length, failed: 0 };
    } else {
      console.error("OneSignal error:", JSON.stringify(result));
      return { sent: 0, failed: playerIds.length };
    }
  } catch (e) {
    console.error("OneSignal request error:", e);
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
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_ids, title, body: msgBody, data } = body;

    if (!user_ids || !Array.isArray(user_ids) || !title) {
      return new Response(JSON.stringify({ error: "user_ids (array) and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Firebase Web Push ──
    let fcmSent = 0;
    let fcmFailed = 0;
    const staleTokens: string[] = [];

    const { data: fcmTokens } = await supabaseAdmin
      .from("fcm_tokens")
      .select("token, user_id")
      .in("user_id", user_ids);

    const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");

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
            console.error("FCM send error:", JSON.stringify(result));
          }
        } catch (e) {
          fcmFailed++;
          console.error("FCM request error:", e);
        }
      }

      if (staleTokens.length > 0) {
        await supabaseAdmin.from("fcm_tokens").delete().in("token", staleTokens);
      }
    }

    // ── OneSignal Native Push ──
    let osSent = 0;
    let osFailed = 0;

    const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (onesignalAppId && onesignalApiKey) {
      const { data: osPlayers } = await supabaseAdmin
        .from("onesignal_players")
        .select("player_id")
        .in("user_id", user_ids);

      if (osPlayers && osPlayers.length > 0) {
        const playerIds = osPlayers.map((p: any) => p.player_id);
        const osResult = await sendOneSignalPush(
          playerIds,
          title,
          msgBody || "",
          data,
          onesignalAppId,
          onesignalApiKey
        );
        osSent = osResult.sent;
        osFailed = osResult.failed;
      }
    }

    return new Response(
      JSON.stringify({
        fcm: { sent: fcmSent, failed: fcmFailed, stale_cleaned: staleTokens.length },
        onesignal: { sent: osSent, failed: osFailed },
        total_sent: fcmSent + osSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-push error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
