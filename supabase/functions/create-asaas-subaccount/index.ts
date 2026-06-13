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

const onlyDigits = (value: unknown) => String(value ?? "").replace(/[^0-9]/g, "");

const BodySchema = z.object({
  store_id: z.string().uuid(),
  name: z.string().min(3).max(120),
  email: z.string().email(),
  cpfCnpj: z.string().transform(onlyDigits).refine((v) => v.length === 11 || v.length === 14, "CPF/CNPJ deve conter 11 ou 14 números"),
  birthDate: z.string().optional().or(z.literal("")), // yyyy-mm-dd, required for CPF
  personType: z.enum(["FISICA", "JURIDICA"]).optional(),
  companyType: z.enum(["MEI", "INDIVIDUAL", "LIMITED", "ASSOCIATION"]).optional().or(z.literal("")),
  incomeValue: z.number().positive(),
  phone: z.string().transform(onlyDigits).refine((v) => v.length >= 10 && v.length <= 11, "Telefone deve conter 10 ou 11 números"),
  mobilePhone: z.string().optional().transform((v) => onlyDigits(v)),
  address: z.string().min(3).max(120),
  addressNumber: z.string().min(1).max(20),
  complement: z.string().max(120).optional(),
  province: z.string().min(2).max(120), // bairro
  postalCode: z.string().transform(onlyDigits).refine((v) => v.length === 8, "CEP deve conter 8 números"),
  city: z.string().max(120).optional().or(z.literal("")),
  state: z.string().max(2).optional().or(z.literal("")),
  site: z.string().max(255).optional().or(z.literal("")),
  // PIX key for withdrawals (any bank)
  pixAddressKey: z.string().min(1).max(120),
  pixAddressKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    // Banco de produção (lojas/usuários) vive no Supabase EXTERNO.
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const EXTERNAL_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const EXTERNAL_SERVICE = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
      || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(EXTERNAL_URL, EXTERNAL_SERVICE);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;

    // Verify the user owns the store
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, owner_id, asaas_wallet_id")
      .eq("id", body.store_id)
      .maybeSingle();
    if (storeErr || !store) return json({ error: "Loja não encontrada" }, 404);
    if (store.owner_id !== userId) return json({ error: "Sem permissão" }, 403);
    if (store.asaas_wallet_id) {
      return json({ error: "Esta loja já possui subconta Asaas configurada." }, 400);
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) return json({ error: "Chave Asaas não configurada." }, 500);

    // Padrão oficial: produção começa com "$aact_prod_", sandbox apenas "$aact_".
    // (todas as chaves Asaas começam com "$aact_", então testar só "$aact_" trataria
    // chaves de produção como sandbox.)
    const isSandbox = !ASAAS_API_KEY.startsWith("$aact_prod_");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    const cpfCnpj = body.cpfCnpj;
    const phone = body.phone;
    const postalCode = body.postalCode;
    const inferredPersonType = cpfCnpj.length === 11 ? "FISICA" : "JURIDICA";

    if ((inferredPersonType === "FISICA" && !body.birthDate) || (inferredPersonType === "JURIDICA" && !body.companyType)) {
      return json({ error: inferredPersonType === "FISICA" ? "Data de nascimento é obrigatória para CPF." : "Tipo da empresa é obrigatório para CNPJ." }, 400);
    }

    // Build payload for Asaas /accounts (create subaccount)
    const subaccountPayload: Record<string, unknown> = {
      name: body.name,
      email: body.email,
      cpfCnpj,
      phone,
      mobilePhone: body.mobilePhone || body.phone,
      address: body.address,
      addressNumber: body.addressNumber,
      complement: body.complement || undefined,
      province: body.province,
      postalCode,
      incomeValue: body.incomeValue,
    };
    if (body.city) subaccountPayload.city = body.city;
    if (body.state) subaccountPayload.state = body.state;
    if (body.site) subaccountPayload.site = body.site;
    if (cpfCnpj.length === 11 && body.birthDate) subaccountPayload.birthDate = body.birthDate;
    if (cpfCnpj.length === 14 && body.companyType) subaccountPayload.companyType = body.companyType;

    const accRes = await fetch(`${baseUrl}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      body: JSON.stringify(subaccountPayload),
    });
    const accData = await accRes.json();
    if (!accRes.ok) {
      console.error("Asaas /accounts error:", JSON.stringify(accData));
      const msg =
        accData?.errors?.[0]?.description || "Falha ao criar subconta no Asaas.";
      return json({ error: msg, asaas: accData }, 400);
    }

    const walletId: string | undefined = accData.walletId;
    const apiKey: string | undefined = accData.apiKey;
    if (!walletId || !apiKey) {
      return json({ error: "Resposta inesperada do Asaas (sem walletId/apiKey).", asaas: accData }, 500);
    }

    // Optional: register PIX key on subaccount so lojista can withdraw to own bank
    try {
      await fetch(`${baseUrl}/pix/addressKeys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: apiKey },
        body: JSON.stringify({
          type: body.pixAddressKeyType,
          // Asaas auto-detects key value for some types; for EVP it generates a random one
          ...(body.pixAddressKeyType !== "EVP" ? { key: body.pixAddressKeyType === "CPF" || body.pixAddressKeyType === "CNPJ" ? onlyDigits(body.pixAddressKey) : body.pixAddressKey } : {}),
        }),
      });
    } catch (e) {
      console.warn("PIX key registration soft-failed:", e);
    }

    // Persist on store (use admin client to bypass RLS for asaas_subaccount_api_key column)
    const { error: updErr } = await adminClient
      .from("stores")
      .update({
        asaas_wallet_id: walletId,
        asaas_subaccount_api_key: apiKey,
        asaas_account_id: accData.id || null,
        asaas_pix_key: body.pixAddressKey,
        asaas_pix_key_type: body.pixAddressKeyType,
        asaas_auto_withdraw_enabled: true,
      })
      .eq("id", body.store_id);

    if (updErr) {
      console.error("Failed to persist subaccount:", updErr);
      return json({ error: "Subconta criada mas houve erro ao salvar. Contate o suporte.", walletId }, 500);
    }

    return json({
      success: true,
      walletId,
      accountId: accData.id,
      message: "Subconta Asaas criada! O split agora será automático em todas as suas vendas PIX.",
    });
  } catch (err) {
    console.error("create-asaas-subaccount error:", err);
    return json({ error: "Erro interno." }, 500);
  }
});
