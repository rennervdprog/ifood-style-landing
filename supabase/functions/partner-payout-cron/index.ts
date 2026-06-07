import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function createAsaasTransfer(params: {
  amount: number;
  pixKey: string;
  pixType: string;
  description: string;
}): Promise<{ ok: boolean; data: any; status: number }> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) return { ok: false, data: { message: "ASAAS_API_KEY não configurado." }, status: 500 };

  const baseUrl = apiKey.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  const pixTypeMap: Record<string, string> = {
    cpf: "CPF", cnpj: "CNPJ", email: "EMAIL", phone: "PHONE", random: "EVP",
  };

  try {
    const res = await fetch(`${baseUrl}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": apiKey },
      body: JSON.stringify({
        value: params.amount,
        operationType: "PIX",
        pixAddressKey: params.pixKey,
        pixAddressKeyType: pixTypeMap[params.pixType] || "CPF",
        description: params.description.substring(0, 140),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data?.errors?.[0]?.description || data?.message || `Erro Asaas: ${res.status}`;
      return { ok: false, data: { message: errorMsg }, status: res.status };
    }
    return { ok: true, data: { transfer_id: data.id, status: data.status, value: data.value }, status: 200 };
  } catch (err) {
    console.error("Asaas transfer exception:", err);
    return { ok: false, data: { message: "Erro interno na transferência." }, status: 500 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: only service_role (cron) or platform admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === serviceKey;

    if (!isServiceRole) {
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "Unauthorized" }, 401);
      }
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) return json({ error: "Unauthorized" }, 401);

      const adminCheck = createClient(supabaseUrl, serviceKey);
      const { data: isAdmin } = await adminCheck.rpc("is_platform_admin", { _user_id: user.id });
      if (!isAdmin) return json({ error: "Apenas administradores." }, 403);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if today is day 5 or 20
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const brasiliaDate = new Date(now.getTime() + brasiliaOffset * 60 * 1000);
    const today = brasiliaDate.getUTCDate();

    // Allow manual trigger via body
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const forceRun = body.force === true;

    if (!forceRun && today !== 5 && today !== 20) {
      return json({ message: `Hoje é dia ${today}. Repasses são nos dias 5 e 20.` });
    }

    // Get partners
    const { data: partners, error: pErr } = await supabase
      .from("platform_partners")
      .select("*")
      .eq("is_active", true);

    if (pErr || !partners?.length) {
      return json({ message: "Nenhum sócio ativo cadastrado." });
    }

    // Calculate platform revenue since last payout
    // Get all store_balances commissions as revenue proxy
    const { data: balances } = await supabase
      .from("store_balances")
      .select("comissao_pendente, repasse_pendente");

    const totalRevenue = (balances || []).reduce(
      (s, b) => s + Number(b.comissao_pendente || 0) + Number(b.repasse_pendente || 0), 0
    );

    if (totalRevenue < 1) {
      return json({ message: "Receita pendente insuficiente para repasse.", revenue: totalRevenue });
    }

    const periodEnd = brasiliaDate.toISOString().split("T")[0];
    const periodStart = today === 20
      ? `${brasiliaDate.getUTCFullYear()}-${String(brasiliaDate.getUTCMonth() + 1).padStart(2, "0")}-05`
      : brasiliaDate.getUTCMonth() === 0
        ? `${brasiliaDate.getUTCFullYear() - 1}-12-20`
        : `${brasiliaDate.getUTCFullYear()}-${String(brasiliaDate.getUTCMonth()).padStart(2, "0")}-20`;

    const results: any[] = [];

    for (const partner of partners) {
      const grossAmount = Number((totalRevenue * (partner.profit_percent / 100)).toFixed(2));
      const emergencyDeduction = Number((grossAmount * (partner.emergency_fund_percent / 100)).toFixed(2));
      const netAmount = Number((grossAmount - emergencyDeduction).toFixed(2));

      // Record emergency fund deposit
      if (emergencyDeduction > 0) {
        await supabase.from("emergency_fund").insert({
          amount: emergencyDeduction,
          transaction_type: "deposit",
          source: "partner_payout",
          description: `Fundo emergência - ${partner.name} (${partner.emergency_fund_percent}% de ${formatMoney(grossAmount)})`,
          partner_id: partner.id,
        });
      }

      // Create payout record
      const { data: payout } = await supabase.from("partner_payouts").insert({
        partner_id: partner.id,
        gross_amount: grossAmount,
        emergency_deduction: emergencyDeduction,
        net_amount: netAmount,
        period_start: periodStart,
        period_end: periodEnd,
        status: "pending",
      }).select().single();

      // If owner, money stays in Asaas account - just mark as paid
      if (partner.is_owner) {
        if (payout) {
          await supabase.from("partner_payouts")
            .update({ status: "paid", notes: "Valor retido na conta Asaas do proprietário." })
            .eq("id", payout.id);
        }
        results.push({ partner: partner.name, gross: grossAmount, emergency: emergencyDeduction, net: netAmount, status: "retained" });
        continue;
      }

      // For non-owner partners with auto_transfer and PIX configured
      if (partner.auto_transfer && partner.pix_key && netAmount >= 1) {
        const transfer = await createAsaasTransfer({
          amount: netAmount,
          pixKey: partner.pix_key,
          pixType: partner.pix_type || "cpf",
          description: `Repasse sócio ${partner.name} - ${periodStart} a ${periodEnd}`,
        });

        if (transfer.ok && payout) {
          await supabase.from("partner_payouts")
            .update({ status: "paid", transfer_id: transfer.data.transfer_id, notes: `Transfer ID: ${transfer.data.transfer_id}` })
            .eq("id", payout.id);
          results.push({ partner: partner.name, gross: grossAmount, emergency: emergencyDeduction, net: netAmount, status: "paid", transfer_id: transfer.data.transfer_id });
        } else {
          if (payout) {
            await supabase.from("partner_payouts")
              .update({ status: "failed", notes: transfer.data.message })
              .eq("id", payout.id);
          }
          results.push({ partner: partner.name, status: "failed", error: transfer.data.message });
        }
      } else {
        // Manual payout or missing PIX
        results.push({ partner: partner.name, gross: grossAmount, emergency: emergencyDeduction, net: netAmount, status: "pending_manual" });
      }
    }

    console.log("Partner payout cron completed:", JSON.stringify(results));
    return json({ message: "Repasse de sócios executado.", results, revenue: totalRevenue, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Partner payout cron error:", err);
    return json({ error: "Erro no cron de repasse de sócios." }, 500);
  }
});

function formatMoney(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}
