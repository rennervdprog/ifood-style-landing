import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  amount: z.number().positive().max(100000),
  pix_key: z.string().min(1).max(255),
  pix_type: z.string().min(1).max(50),
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
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

    const userId = userData.user.id;
    const { amount, pix_key, pix_type } = parsed.data;

    // SECURITY: Verify the user is actually a driver before allowing withdrawal
    const serviceClientAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isDriver } = await serviceClientAuth.rpc("is_driver", { _user_id: userId });
    if (!isDriver) {
      return new Response(JSON.stringify({ error: "Apenas entregadores ativos podem solicitar saque." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for existing pending request
    const { data: existingPending, error: existingError } = await supabase
      .from("withdrawal_requests")
      .select("id, amount, transaction_code")
      .eq("driver_user_id", userId)
      .eq("status", "solicitado")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return new Response(JSON.stringify({ error: "Erro ao verificar solicitação ativa." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingPending) {
      return new Response(JSON.stringify({
        error: "Você já tem uma solicitação ativa. Aguarde o pagamento do ID anterior.",
        active_request: existingPending,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // WEEKLY LIMIT: Check if driver already had a paid withdrawal this week
    // Get withdrawal limit settings from admin_settings via service client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: limitSettings } = await serviceClient
      .from("admin_settings")
      .select("value")
      .eq("key", "withdrawal_limits")
      .single();

    // Default: 1 withdrawal per week, minimum R$5
    const limits = (limitSettings?.value as any) || {
      max_per_week: 1,
      min_amount: 5,
    };

    const maxPerWeek = Number(limits.max_per_week) || 1;
    const minAmount = Number(limits.min_amount) || 5;

    // Check minimum amount
    if (amount < minAmount) {
      return new Response(JSON.stringify({
        error: `Valor mínimo para saque é R$ ${minAmount.toFixed(2)}.`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: valida que o valor solicitado não excede o saldo disponível.
    const { data: balanceRow, error: balErr } = await serviceClient
      .from("driver_balances")
      .select("pending_amount")
      .eq("driver_user_id", userId)
      .maybeSingle();
    if (balErr) {
      console.error("[create-withdrawal-request] balance read error:", balErr);
      return new Response(JSON.stringify({ error: "Erro ao verificar saldo." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const available = Number(balanceRow?.pending_amount || 0);
    if (amount > available + 0.001) {
      return new Response(JSON.stringify({
        error: `Valor solicitado (R$ ${amount.toFixed(2)}) é maior que o saldo disponível (R$ ${available.toFixed(2)}).`,
        available_amount: available,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count withdrawals (paid or pending) in the current week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const { count: weeklyCount, error: countError } = await serviceClient
      .from("withdrawal_requests")
      .select("id", { count: "exact", head: true })
      .eq("driver_user_id", userId)
      .in("status", ["solicitado", "pago"])
      .gte("created_at", weekStart.toISOString());

    if (countError) {
      console.error("Count error:", countError);
    }

    if ((weeklyCount || 0) >= maxPerWeek) {
      const nextMonday = new Date(weekStart);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const nextDate = nextMonday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return new Response(JSON.stringify({
        error: `Limite de ${maxPerWeek} saque(s) por semana atingido. Próxima solicitação disponível em ${nextDate}.`,
        limit_reached: true,
        next_available: nextMonday.toISOString(),
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("withdrawal_requests")
      .insert({
        driver_user_id: userId,
        amount,
        pix_key,
        pix_type,
      })
      .select("id, amount, status, created_at, transaction_code")
      .single();

    if (insertError) {
      const message = insertError.message?.includes("ux_withdrawal_requests_one_active_per_driver")
        ? "Você já tem uma solicitação ativa. Aguarde o pagamento do ID anterior."
        : "Erro ao criar solicitação de saque.";

      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ request: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-withdrawal-request error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
