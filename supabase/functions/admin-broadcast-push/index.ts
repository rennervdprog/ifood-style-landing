import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Admin role check ──
    const { data: isAdmin } = await supabaseAdmin.rpc("is_platform_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem enviar broadcasts." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Input validation ──
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.body === "string" ? body.body.trim() : "";
    const link = typeof body.link === "string" ? body.link.trim() : "/";
    const audience = body.audience === "all" || body.audience === "clients" || body.audience === "partners"
      ? body.audience
      : "clients";

    if (!title || title.length > 120) {
      return new Response(JSON.stringify({ error: "Título obrigatório (máx 120 caracteres)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > 500) {
      return new Response(JSON.stringify({ error: "Mensagem máx 500 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.length > 500 || (!link.startsWith("/") && !link.startsWith("https://"))) {
      return new Response(JSON.stringify({ error: "Link inválido (use /caminho ou https://...)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build target user list based on audience ──
    let userIds: string[] = [];
    if (audience === "clients") {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("role", "cliente");
      userIds = (profs || []).map((p: any) => p.user_id).filter(Boolean);
    } else if (audience === "partners") {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, role")
        .in("role", ["lojista", "motoboy"]);
      userIds = (profs || []).map((p: any) => p.user_id).filter(Boolean);
    } else {
      // all
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id");
      userIds = (profs || []).map((p: any) => p.user_id).filter(Boolean);
    }

    userIds = [...new Set(userIds)];
    console.log(`[admin-broadcast-push] audience=${audience}, target users=${userIds.length}`);

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, total: 0, note: "Nenhum destinatário encontrado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Forward to send-push in batches (avoid huge payload) ──
    const BATCH = 400;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < userIds.length; i += BATCH) {
      const slice = userIds.slice(i, i + BATCH);
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            user_ids: slice,
            title,
            body: message,
            data: { link, broadcast: "1" },
          }),
        });
        const json = await res.json().catch(() => ({}));
        totalSent += Number(json.sent || json.fcm_sent || 0);
        totalFailed += Number(json.failed || json.fcm_failed || 0);
        console.log(`[admin-broadcast-push] batch ${i / BATCH + 1}: ${JSON.stringify(json).slice(0, 200)}`);
      } catch (e) {
        console.error(`[admin-broadcast-push] batch ${i / BATCH + 1} error:`, e);
        totalFailed += slice.length;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_targets: userIds.length,
        sent: totalSent,
        failed: totalFailed,
        audience,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[admin-broadcast-push] error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
