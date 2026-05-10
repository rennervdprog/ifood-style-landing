import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const onlyDigits = (v: unknown) => String(v ?? "").replace(/[^0-9]/g, "");

const ActionSchema = z.object({
  store_id: z.string().uuid(),
   action: z.enum(["summary", "update-pix", "withdraw-now", "update-withdraw-config"]),
  // update-pix payload
  pixAddressKey: z.string().optional(),
  pixAddressKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]).optional(),
   // update-withdraw-config payload
   autoWithdrawEnabled: z.boolean().optional(),
   minWithdrawAmount: z.number().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const parsed = ActionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;

    // Ownership check using user-scoped client (RLS enforces it too)
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select(
        "id, owner_id, asaas_subaccount_api_key, asaas_pix_key, asaas_pix_key_type, asaas_auto_withdraw_enabled, asaas_min_withdraw_amount, asaas_last_withdraw_at"
      )
      .eq("id", body.store_id)
      .maybeSingle();
    if (storeErr || !store) return json({ error: "Loja não encontrada" }, 404);
    if (store.owner_id !== userId) return json({ error: "Sem permissão" }, 403);

    const subKey = store.asaas_subaccount_api_key as string | null;
    if (!subKey) {
      return json({ error: "Subconta Asaas ainda não configurada para esta loja." }, 400);
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    const isSandbox = !ASAAS_API_KEY?.startsWith("$aact_");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    // ---------- ACTION: summary ----------
    if (body.action === "summary") {
      const [balRes, paymentsRes, transfersRes] = await Promise.all([
        fetch(`${baseUrl}/finance/balance`, { headers: { access_token: subKey } }),
        fetch(`${baseUrl}/payments?limit=10&status=RECEIVED`, {
          headers: { access_token: subKey },
        }),
        fetch(`${baseUrl}/transfers?limit=10`, {
          headers: { access_token: subKey },
        }),
      ]);

      const [balData, paymentsData, transfersData] = await Promise.all([
        balRes.json().catch(() => ({})),
        paymentsRes.json().catch(() => ({})),
        transfersRes.json().catch(() => ({})),
      ]);

      return json({
         success: true,
         balance: Number(balData?.balance ?? 0),
         totalBalance: Number(balData?.totalBalance ?? 0),
         payments: Array.isArray(paymentsData?.data) ? paymentsData.data : [],
        transfers: Array.isArray(transfersData?.data) ? transfersData.data : [],
        config: {
          pixAddressKey: store.asaas_pix_key,
          pixAddressKeyType: store.asaas_pix_key_type,
          autoWithdrawEnabled: store.asaas_auto_withdraw_enabled,
          minWithdrawAmount: Number(store.asaas_min_withdraw_amount ?? 5),
          lastWithdrawAt: store.asaas_last_withdraw_at,
        },
      });
    }

    // ---------- ACTION: update-pix ----------
    if (body.action === "update-pix") {
      if (!body.pixAddressKey || !body.pixAddressKeyType) {
        return json({ error: "Informe a chave PIX e o tipo." }, 400);
      }
      const newKey = body.pixAddressKey;
      const newType = body.pixAddressKeyType;

      // Try to register the new key on Asaas (best-effort; lojista may have done it manually)
      try {
        await fetch(`${baseUrl}/pix/addressKeys`, {
          method: "POST",
          headers: { "Content-Type": "application/json", access_token: subKey },
          body: JSON.stringify({
            type: newType,
            ...(newType !== "EVP"
              ? {
                  key:
                    newType === "CPF" || newType === "CNPJ"
                      ? onlyDigits(newKey)
                      : newKey,
                }
              : {}),
          }),
        });
      } catch (e) {
        console.warn("PIX key registration soft-failed:", e);
      }

      const { error: updErr } = await admin
        .from("stores")
        .update({
          asaas_pix_key: newKey,
          asaas_pix_key_type: newType,
        })
        .eq("id", body.store_id);

      if (updErr) {
        console.error("DB update error:", updErr);
        return json({ error: "Erro ao salvar chave PIX." }, 500);
      }

      return json({ success: true, message: "Chave PIX atualizada!" });
    }

    // ---------- ACTION: withdraw-now ----------
    if (body.action === "withdraw-now") {
      const pixKey = store.asaas_pix_key as string | null;
      const pixType = (store.asaas_pix_key_type as string | null) || "EVP";
      if (!pixKey) {
        return json({ error: "Cadastre uma chave PIX antes de sacar." }, 400);
      }

      const balRes = await fetch(`${baseUrl}/finance/balance`, {
        headers: { access_token: subKey },
      });
      const balData = await balRes.json();
      const balance = Number(balData?.balance ?? 0);
      if (balance <= 0) {
        return json({ error: "Sem saldo disponível para saque." }, 400);
      }

      const tRes = await fetch(`${baseUrl}/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: subKey },
        body: JSON.stringify({
          value: balance,
          pixAddressKey: pixKey,
          pixAddressKeyType: pixType,
          operationType: "PIX",
        }),
      });
      const tData = await tRes.json();
      if (!tRes.ok) {
        const msg = tData?.errors?.[0]?.description || "Falha ao realizar saque.";
        return json({ error: msg, asaas: tData }, 400);
      }

      await admin
        .from("stores")
        .update({ asaas_last_withdraw_at: new Date().toISOString() })
        .eq("id", body.store_id);

      return json({
        success: true,
        message: `PIX de R$ ${balance.toFixed(2)} enviado para sua chave!`,
        transferId: tData.id,
        value: balance,
      });
    }

    // ---------- ACTION: update-withdraw-config ----------
    if (body.action === "update-withdraw-config") {
      const { error: updErr } = await admin
        .from("stores")
        .update({
          asaas_auto_withdraw_enabled: body.autoWithdrawEnabled,
          asaas_min_withdraw_amount: body.minWithdrawAmount,
        })
        .eq("id", body.store_id);

      if (updErr) {
        console.error("DB update error:", updErr);
        return json({ error: "Erro ao salvar configurações de saque." }, 500);
      }

      return json({ success: true, message: "Configurações de saque atualizadas!" });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (err) {
    console.error("asaas-financial-panel error:", err);
    return json({ error: "Erro interno." }, 500);
  }
});