import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Asaas Transfer ───────────────────────────────────────────────────
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
    const supabaseUrl = (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!;
    const serviceKey = (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const cronSecret = Deno.env.get("CRON_SECRET") || "";

    // Auth: CRON_SECRET (scheduler) or platform admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isCron = cronSecret.length > 0 && token === cronSecret;

    if (!isCron) {
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "Unauthorized" }, 401);
      }

      const authClient = createClient(supabaseUrl, (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!);
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        return json({ error: "Unauthorized" }, 401);
      }

      const adminCheck = createClient(supabaseUrl, serviceKey);
      const { data: isAdmin } = await adminCheck.rpc("is_platform_admin", { _user_id: user.id });
      if (!isAdmin) {
        return json({ error: "Apenas administradores podem executar esta função." }, 403);
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check payout schedule (day of week)
    const { data: scheduleData } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "payout_schedule")
      .single();

    const schedule = scheduleData?.value as { day_of_week: number; enabled: boolean } | null;

    if (!schedule || !schedule.enabled) {
      return json({ message: "Agendamento de repasse automático desativado. Nada a processar." });
    }

    // Check if today is the configured payout day (0=Sunday ... 6=Saturday)
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const brasiliaDate = new Date(now.getTime() + brasiliaOffset * 60 * 1000);
    const todayDow = brasiliaDate.getUTCDay();

    if (todayDow !== schedule.day_of_week) {
      return json({ message: `Hoje não é o dia de repasse. Configurado: ${schedule.day_of_week}, Hoje: ${todayDow}` });
    }

    // Check payout modes from admin_settings
    const { data: settingsData } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "payout_modes")
      .single();

    if (!settingsData) {
      return json({ message: "Nenhuma configuração de repasse encontrada. Nada a processar." });
    }

    const modes = settingsData.value as Record<string, string>;
    const results: any[] = [];

    // ── AUTO DRIVER PAYOUTS ──────────────────────────────────────────
    if (modes.driver_payout === "auto") {
      const { data: balances } = await supabase
        .from("driver_balances")
        .select("*")
        .gt("pending_amount", 0);

      for (const balance of balances || []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, pix_key, pix_type")
          .eq("user_id", balance.driver_user_id)
          .single();

        if (!profile?.pix_key) {
          results.push({ type: "driver", id: balance.driver_user_id, status: "skipped", reason: "Sem chave PIX" });
          continue;
        }

        const amount = Number(balance.pending_amount);
        if (amount < 1) {
          results.push({ type: "driver", id: balance.driver_user_id, status: "skipped", reason: "Valor muito baixo" });
          continue;
        }

        const { data: existingWithdrawal } = await supabase
          .from("withdrawal_requests")
          .select("id")
          .eq("driver_user_id", balance.driver_user_id)
          .eq("status", "processando")
          .limit(1);

        if (existingWithdrawal && existingWithdrawal.length > 0) {
          results.push({ type: "driver", id: balance.driver_user_id, status: "skipped", reason: "Já em processamento" });
          continue;
        }

        const transfer = await createAsaasTransfer({
          amount,
          pixKey: profile.pix_key,
          pixType: profile.pix_type || "cpf",
          description: `Repasse auto motoboy ${profile.full_name}`,
        });

        if (transfer.ok) {
          await supabase
            .from("driver_balances")
            .update({
              pending_amount: 0,
              paid_amount: Number(balance.paid_amount) + amount,
              updated_at: new Date().toISOString(),
            })
            .eq("driver_user_id", balance.driver_user_id);

          await supabase
            .from("driver_earnings")
            .update({ status: "pago" })
            .eq("driver_user_id", balance.driver_user_id)
            .eq("status", "pendente");

          await supabase.from("payout_history").insert({
            admin_user_id: "00000000-0000-0000-0000-000000000000",
            entity_type: "driver",
            entity_id: balance.driver_user_id,
            entity_name: profile.full_name || "Motoboy",
            amount,
            payout_type: "auto_asaas",
            notes: `Transfer ID: ${transfer.data.transfer_id}`,
          });

          await supabase
            .from("withdrawal_requests")
            .update({ status: "pago", processed_at: new Date().toISOString(), admin_notes: "Pago automaticamente via Asaas" })
            .eq("driver_user_id", balance.driver_user_id)
            .eq("status", "solicitado");

          results.push({ type: "driver", id: balance.driver_user_id, name: profile.full_name, status: "paid", amount });
        } else {
          results.push({ type: "driver", id: balance.driver_user_id, status: "error", error: transfer.data.message });
        }
      }
    }

    // ── AUTO STORE PAYOUTS ───────────────────────────────────────────
    if (modes.store_payout === "auto") {
      const { data: storeBalances } = await supabase
        .from("store_balances")
        .select("*, stores:store_id(name, owner_id, is_test)")
        .gt("repasse_pendente", 0);

      for (const sb of storeBalances || []) {
        const store = (sb as any).stores;
        if (!store?.owner_id) continue;
        if (store?.is_test) {
          results.push({ type: "store", id: sb.store_id, status: "skipped", reason: "Loja de teste" });
          continue;
        }

        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("full_name, pix_key, pix_type, whatsapp")
          .eq("user_id", store.owner_id)
          .single();

        if (!ownerProfile?.pix_key) {
          results.push({ type: "store", id: sb.store_id, status: "skipped", reason: "Sem chave PIX do lojista" });
          continue;
        }

        const amount = Number(sb.repasse_pendente);
        if (amount < 1) {
          results.push({ type: "store", id: sb.store_id, status: "skipped", reason: "Valor muito baixo" });
          continue;
        }

        const transfer = await createAsaasTransfer({
          amount,
          pixKey: ownerProfile.pix_key,
          pixType: ownerProfile.pix_type || "cpf",
          description: `Repasse auto loja ${store.name}`,
        });

        if (transfer.ok) {
          // Débito atômico — evita zerar saldo novo acumulado entre leitura e update,
          // e evita race com admin-payout-store.
          const { error: debitErr } = await supabase.rpc("debit_store_repasse", {
            _store_id: sb.store_id,
            _amount: amount,
          });
          if (debitErr) {
            console.error("[auto-payout-cron] debit_store_repasse failed:", debitErr);
            results.push({ type: "store", id: sb.store_id, status: "paid_balance_warning", amount, warning: debitErr.message });
            continue;
          }

          await supabase.from("payout_history").insert({
            admin_user_id: "00000000-0000-0000-0000-000000000000",
            entity_type: "store",
            entity_id: sb.store_id,
            entity_name: store.name || "Loja",
            amount,
            payout_type: "auto_asaas",
            notes: `Transfer ID: ${transfer.data.transfer_id}`,
          });

          // Notifica lojista via WhatsApp plataforma (best-effort)
          try {
            const phone = String(ownerProfile?.whatsapp || "").replace(/\D/g, "");
            if (phone) {
              const first = String(ownerProfile?.full_name || "").split(" ")[0] || "Olá";
              const pixKind = String(ownerProfile.pix_type || "cpf").toUpperCase();
              const masked = ownerProfile.pix_key ? `${String(ownerProfile.pix_key).slice(0,3)}***${String(ownerProfile.pix_key).slice(-2)}` : "";
              const msg = `💸 *Repasse semanal enviado — ItaSuper*\n\nOlá ${first}! Seu repasse desta semana foi enviado:\n\n• Loja: *${store.name}*\n• Valor: *R$ ${amount.toFixed(2).replace(".", ",")}*\n• PIX: ${pixKind} ${masked}\n\nCai na sua conta em minutos. 💚`;
              await fetch(`${supabaseUrl}/functions/v1/platform-whatsapp-send`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
                body: JSON.stringify({
                  phone, message: msg, kind: "repasse_weekly",
                  category: "repasse", store_id: sb.store_id, store_name: store.name,
                }),
              }).catch(() => undefined);
            }
          } catch (e) { console.error("[auto-payout-cron] wa notify failed", e); }

          results.push({ type: "store", id: sb.store_id, name: store.name, status: "paid", amount });
        } else {
          results.push({ type: "store", id: sb.store_id, status: "error", error: transfer.data.message });
        }
      }
    }

    console.log("Auto-payout cron completed:", JSON.stringify(results));
    return json({ message: "Cron executado com sucesso", results, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Auto-payout cron error:", err);
    return json({ error: "Erro no cron de pagamento automático" }, 500);
  }
});
