import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
};

// Este endpoint escreve no banco EXTERNO (qkjhguziuchqsbxzruea).
function externalClient() {
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");
  if (!url || !key) throw new Error("EXTERNAL_SUPABASE_* não configurados.");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Cliente pra validar o JWT enviado pelo usuário (mesma URL do banco externo).
function authClient() {
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const anon = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Não autenticado." }, 401);

    const { data: userRes } = await authClient().auth.getUser(jwt);
    const user = userRes?.user;
    if (!user) return json({ error: "Sessão inválida." }, 401);

    const body = await req.json().catch(() => ({}));
    const store_id = String(body?.store_id || "");
    const addon_code = String(body?.addon_code || "");
    const action = String(body?.action || "");
    if (!store_id || !addon_code || !["activate", "cancel", "reactivate", "admin_set"].includes(action)) {
      return json({ error: "Parâmetros inválidos." }, 400);
    }
    if (addon_code !== "pdv") return json({ error: "Add-on não suportado." }, 400);

    const admin = externalClient();

    // Autorização: dono da loja OU super admin.
    const [{ data: store }, { data: role }] = await Promise.all([
      admin.from("stores").select("id, owner_id, legacy_pdv").eq("id", store_id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
    ]);
    const isAdmin = !!role;
    if (!store) return json({ error: "Loja não encontrada." }, 404);
    if (!isAdmin && store.owner_id !== user.id) return json({ error: "Sem permissão." }, 403);
    if (store.legacy_pdv && !isAdmin && action !== "admin_set") {
      return json({ error: "Loja legada — PDV já está incluso." }, 400);
    }

    const logAction = async (payload: Record<string, unknown>) => {
      try {
        await admin.from("admin_logs").insert({
          actor_id: user.id,
          action: `store_addon.${action}`,
          target_type: "store_addon",
          target_id: store_id,
          payload: { addon_code, ...payload },
        });
      } catch (e) {
        console.warn("admin_logs insert failed:", (e as Error).message);
      }
    };

    // Super Admin: força estado/override de preço (VIP: 0 = grátis).
    if (action === "admin_set") {
      if (!isAdmin) return json({ error: "Apenas admin." }, 403);
      const enabled = body?.enabled === true;
      const priceOverride = body?.price_override === null || body?.price_override === undefined
        ? null
        : Number(body.price_override);
      // Detecta cancelamento imediato dentro de ciclo já pago para gerar crédito proporcional.
      const { data: prevAddon } = await admin.from("store_addons")
        .select("enabled, price_override, first_charge_done, activated_at")
        .eq("store_id", store_id).eq("addon_code", addon_code).maybeSingle();
      const wasEnabled = !!prevAddon?.enabled;
      const keepActivatedAt = wasEnabled && enabled ? prevAddon?.activated_at : new Date().toISOString();
      const keepFirstCharge = wasEnabled && enabled ? !!prevAddon?.first_charge_done : false;
      const { error } = await admin.from("store_addons").upsert({
        store_id, addon_code,
        enabled,
        price_override: priceOverride,
        activated_at: keepActivatedAt,
        first_charge_done: keepFirstCharge,
        cancels_at: null,
        created_by: user.id,
      }, { onConflict: "store_id,addon_code" });
      if (error) throw error;
      // Se admin desativou imediatamente e ciclo já estava pago, credita dias não usados.
      if (wasEnabled && !enabled && prevAddon?.first_charge_done) {
        const price = Number(prevAddon?.price_override ?? 0) || 49; // fallback PDV
        const credit = computeUnusedCredit(price, new Date());
        if (credit > 0) {
          await admin.rpc("increment_billing_credit_cents", {
            _store_id: store_id, _delta: credit,
          }).catch(async () => {
            const { data: sp } = await admin.from("store_plans").select("billing_credit_cents").eq("store_id", store_id).maybeSingle();
            const cur = Number((sp as any)?.billing_credit_cents ?? 0);
            await admin.from("store_plans").update({ billing_credit_cents: cur + credit }).eq("store_id", store_id);
          });
        }
      }
      await logAction({ enabled, price_override: priceOverride });
      return json({ ok: true, action, enabled, price_override: priceOverride });
    }

    if (action === "activate") {
      const { error } = await admin.from("store_addons").upsert({
        store_id, addon_code,
        enabled: true,
        activated_at: new Date().toISOString(),
        first_charge_done: false,
        cancels_at: null,
        created_by: user.id,
      }, { onConflict: "store_id,addon_code" });
      if (error) throw error;
      await logAction({});
      return json({ ok: true, action });
    }

    if (action === "reactivate") {
      // Remove cancelamento agendado — mantém enabled=true e ciclo atual.
      const { data: cur } = await admin.from("store_addons")
        .select("enabled, cancels_at").eq("store_id", store_id).eq("addon_code", addon_code).maybeSingle();
      if (!cur?.enabled) return json({ error: "Add-on não está ativo." }, 400);
      if (!cur?.cancels_at) return json({ ok: true, action, note: "sem cancelamento pendente" });
      const { error } = await admin.from("store_addons")
        .update({ cancels_at: null })
        .eq("store_id", store_id).eq("addon_code", addon_code);
      if (error) throw error;
      await logAction({});
      return json({ ok: true, action });
    }

    // cancel: mantém enabled=true até o fim do mês, marca cancels_at
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1);
    endOfMonth.setHours(0, 0, 0, 0);
    const { error } = await admin.from("store_addons")
      .update({ cancels_at: endOfMonth.toISOString() })
      .eq("store_id", store_id).eq("addon_code", addon_code);
    if (error) throw error;
    await logAction({ cancels_at: endOfMonth.toISOString() });
    return json({ ok: true, action, cancels_at: endOfMonth.toISOString() });
  } catch (e) {
    console.error("manage-store-addon error:", e);
    return json({ error: (e as Error).message || "Erro interno." }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Retorna crédito em centavos correspondente aos dias restantes do mês civil.
function computeUnusedCredit(priceReais: number, now: Date): number {
  const y = now.getFullYear(), m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const day = now.getDate();
  const unused = Math.max(0, daysInMonth - day); // dias que restariam a partir de amanhã
  if (unused <= 0) return 0;
  return Math.floor(priceReais * 100 * (unused / daysInMonth));
}