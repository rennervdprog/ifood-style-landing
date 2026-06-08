import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const BodySchema = z.object({
  store_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  pix_key: z.string().min(1).max(256),
  pix_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Only admin can do payouts
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: adminRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return json({ error: "Apenas o administrador pode realizar repasses." }, 403);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { store_id, amount, pix_key, pix_type } = parsed.data;

    // Verify store exists
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return json({ error: "Loja não encontrada" }, 404);
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return json({ error: "Chave de pagamento não configurada." }, 500);
    }

    const isSandbox = !ASAAS_API_KEY.startsWith("$aact_prod_");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    const { data: refData } = await serviceClient.rpc("generate_financial_reference", { _prefix: "REP" });
    const referenceCode = refData || `#REP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const desc = `Repasse ItaSuper - ${store.name} - ${referenceCode}`;

    // Map pix_type to Asaas format
    const pixTypeMap: Record<string, string> = {
      cpf: "CPF", cnpj: "CNPJ", email: "EMAIL", phone: "PHONE", random: "EVP",
    };

    // Create Asaas Transfer (direct PIX transfer to store owner)
    const transferBody = {
      value: Number(amount.toFixed(2)),
      operationType: "PIX",
      pixAddressKey: pix_key,
      pixAddressKeyType: pixTypeMap[pix_type] || "CPF",
      description: desc.substring(0, 140),
    };

    const maskedPix = pix_key ? `${String(pix_key).slice(0,3)}***${String(pix_key).slice(-2)}` : "";
    console.log(`[Asaas] Creating transfer: R$${amount.toFixed(2)} to ${maskedPix} (${pix_type})`);

    const transferRes = await fetch(`${baseUrl}/transfers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify(transferBody),
    });

    const transferData = await transferRes.json();

    // Save transaction
    const txRecord: Record<string, unknown> = {
      store_id,
      transaction_kind: "store_payout",
      reference_code: referenceCode,
      amount: Number(amount.toFixed(2)),
      status: transferRes.ok ? "approved" : "failed",
      provider: "asaas",
      metadata: {
        store_name: store.name,
        pix_key,
        pix_type,
        description: desc,
        transfer_type: "asaas_transfer",
      },
    };

    if (transferRes.ok) {
      txRecord.mercado_pago_payment_id = String(transferData.id || "");
      txRecord.settled_at = new Date().toISOString();
    }

    await serviceClient.from("financial_transactions").insert(txRecord);

    if (!transferRes.ok) {
      console.error("Asaas Transfer Error:", JSON.stringify(transferData));
      const errorMsg = transferData?.errors?.[0]?.description || transferData?.message || "Erro na transferência";
      return json({
        reference_code: referenceCode,
        status: "manual_required",
        message: `Não foi possível realizar a transferência automática: ${errorMsg}. Realize manualmente R$ ${amount.toFixed(2)} para a chave PIX: ${pix_key} (${pix_type})`,
        pix_key,
        pix_type,
        amount: Number(amount.toFixed(2)),
      });
    }

    // Log to payout_history
    await serviceClient.from("payout_history").insert({
      entity_type: "store",
      entity_id: store_id,
      entity_name: store.name,
      amount: Number(amount.toFixed(2)),
      payout_type: "auto_asaas",
      notes: `Transferência automática Asaas: ${referenceCode} | PIX: ${pix_key} (${pix_type})`,
      admin_user_id: userData.user.id,
    });

    // Deduct ONLY repasse_pendente by the actual amount paid.
    // Never touch comissao_pendente/pending_commission here — those represent
    // money the store still owes the platform and are settled by a different flow.
    const { data: curBal } = await serviceClient
      .from("store_balances")
      .select("repasse_pendente")
      .eq("store_id", store_id)
      .maybeSingle();
    const curRepasse = Number(curBal?.repasse_pendente || 0);
    const newRepasse = Math.max(0, curRepasse - Number(amount.toFixed(2)));
    await serviceClient
      .from("store_balances")
      .update({ repasse_pendente: newRepasse, updated_at: new Date().toISOString() })
      .eq("store_id", store_id);

    return json({
      success: true,
      reference_code: referenceCode,
      transfer_id: transferData.id,
      status: "approved",
      amount: Number(amount.toFixed(2)),
      pix_key,
      pix_type,
      provider: "asaas",
      message: `Transferência de R$ ${amount.toFixed(2)} enviada para ${store.name} via Asaas!`,
    });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
