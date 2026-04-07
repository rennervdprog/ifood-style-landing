import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

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

const CreateSubaccountSchema = z.object({
  store_id: z.string().uuid(),
});

function getAsaasBaseUrl(apiKey: string): string {
  return apiKey.startsWith("$aact_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth check
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

    const userId = userData.user.id;

    // Service client for privileged operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only admin can create subaccounts
    const { data: isAdmin } = await serviceClient.rpc("is_platform_admin", { _user_id: userId });
    if (!isAdmin) {
      return json({ error: "Apenas o administrador pode criar subcontas." }, 403);
    }

    const body = await req.json();
    const parsed = CreateSubaccountSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { store_id } = parsed.data;

    // Get store + owner info
    const { data: store, error: storeError } = await serviceClient
      .from("stores")
      .select("id, name, owner_id, asaas_account_id, asaas_wallet_id, address_city")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return json({ error: "Loja não encontrada" }, 404);
    }

    // Already has subaccount?
    if (store.asaas_account_id && store.asaas_wallet_id) {
      return json({
        message: "Loja já possui subconta Asaas",
        asaas_account_id: store.asaas_account_id,
        asaas_wallet_id: store.asaas_wallet_id,
      });
    }

    // Get owner profile for CPF/CNPJ, email, and birth date
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name, document, email, phone, whatsapp_number")
      .eq("user_id", store.owner_id)
      .single();

    if (!profile?.document) {
      return json({ error: "Lojista não possui documento (CPF/CNPJ) cadastrado." }, 400);
    }

    // Get birth_date from auth user metadata
    const { data: ownerAuth } = await serviceClient.auth.admin.getUserById(store.owner_id);
    const birthDate = ownerAuth?.user?.user_metadata?.birth_date || "1990-01-01";

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      return json({ error: "ASAAS_API_KEY não configurado." }, 500);
    }

    const baseUrl = getAsaasBaseUrl(apiKey);
    const cleanDoc = profile.document.replace(/\D/g, "");
    const isCnpj = cleanDoc.length === 14;

    // Step 1: Create Asaas subaccount
    const phone = (profile.whatsapp_number || profile.phone || "").replace(/\D/g, "");
    const subaccountBody: Record<string, unknown> = {
      name: profile.full_name || store.name,
      email: profile.email || `lojista-${store_id.substring(0, 8)}@itasuper.app`,
      cpfCnpj: cleanDoc,
      companyType: isCnpj ? "LIMITED" : "MEI",
      mobilePhone: phone || undefined,
      address: store.address_city || "Itatinga",
      province: "SP",
      postalCode: "18690000",
    };

    // Asaas requires birthDate for CPF (individual) accounts
    if (!isCnpj) {
      subaccountBody.birthDate = birthDate;
    }

    console.log("Creating Asaas subaccount for store:", store.name);
    const createRes = await fetch(`${baseUrl}/accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
      },
      body: JSON.stringify(subaccountBody),
    });

    const createData = await createRes.json();

    if (!createRes.ok) {
      console.error("Asaas subaccount error:", createRes.status, JSON.stringify(createData));
      const errorMsg = createData?.errors?.[0]?.description || createData?.message || `Erro Asaas: ${createRes.status}`;
      return json({ error: `Erro ao criar subconta: ${errorMsg}` }, createRes.status);
    }

    const accountId = createData.id;
    const walletId = createData.walletId;

    console.log("Asaas subaccount created:", accountId, "wallet:", walletId);

    // Step 2: Configure automatic daily transfer (saque automático)
    try {
      const transferRes = await fetch(`${baseUrl}/transfers/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": apiKey,
          "as_account": accountId,
        },
        body: JSON.stringify({
          transferEnabled: true,
          scheduleInterval: "DAILY",
          scheduleOffset: 0,
        }),
      });

      if (transferRes.ok) {
        console.log("Auto-transfer configured for:", store.name);
      } else {
        const transferErr = await transferRes.json();
        console.warn("Auto-transfer config warning:", JSON.stringify(transferErr));
        // Non-blocking — subaccount is still created
      }
    } catch (transferError) {
      console.warn("Auto-transfer setup failed (non-blocking):", transferError);
    }

    // Step 3: Save to store
    await serviceClient
      .from("stores")
      .update({
        asaas_account_id: accountId,
        asaas_wallet_id: walletId,
      })
      .eq("id", store_id);

    return json({
      success: true,
      asaas_account_id: accountId,
      asaas_wallet_id: walletId,
      store_name: store.name,
      message: `Subconta Asaas criada para ${store.name} com saque automático diário`,
    });
  } catch (err) {
    console.error("Subaccount error:", err);
    return json({ error: "Erro interno ao criar subconta." }, 500);
  }
});
