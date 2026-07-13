import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const onlyDigits = (value: unknown) => String(value ?? "").replace(/[^0-9]/g, "");

const CreateSchema = z.object({
  mode: z.literal("create").optional(),
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

const LinkSchema = z.object({
  mode: z.literal("link-existing"),
  store_id: z.string().uuid(),
  registry_id: z.string().uuid().optional(),
  wallet_id: z.string().min(5).optional(),
});

const ListSchema = z.object({
  mode: z.literal("list-orphans"),
  store_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID().slice(0, 8);
  const trace: Array<{ t: string; step: string; data?: unknown }> = [];
  const log = (step: string, data?: unknown) => {
    const entry = { t: new Date().toISOString(), step, data };
    trace.push(entry);
    console.log(`[asaas-sub ${traceId}] ${step}`, data !== undefined ? JSON.stringify(data) : "");
  };

  try {
    log("request_received", { method: req.method });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    // Banco de produção (lojas/usuários) vive no Supabase EXTERNO.
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const EXTERNAL_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const EXTERNAL_SERVICE = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
      || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    log("env_resolved", {
      external_url: EXTERNAL_URL?.slice(0, 40) + "…",
      has_anon: !!EXTERNAL_ANON,
      has_service: !!EXTERNAL_SERVICE,
      using_external: !!Deno.env.get("EXTERNAL_SUPABASE_URL"),
    });

    const supabase = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(EXTERNAL_URL, EXTERNAL_SERVICE);
    // Registry de subcontas vive no MESMO banco externo (única fonte de verdade).
    const cloudClient = adminClient;

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    log("user_authenticated", { userId });

    // Admin pode operar em qualquer loja (necessário para fluxo sandbox via seed-test-accounts).
    const { data: adminRole } = await adminClient
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!adminRole;
    log("admin_check", { isAdmin });

    const rawBody = await req.json();
    const mode = (rawBody?.mode as string) || "create";
    log("body_parsed", { mode, store_id: rawBody?.store_id, has_cpf: !!rawBody?.cpfCnpj });

    // helper: persist em cascata na loja externa
    async function persistToStore(storeId: string, walletId: string, apiKey: string | null, accountId: string | null, pix?: { key: string; type: string } | null) {
      const fullPayload: Record<string, unknown> = {
        asaas_wallet_id: walletId,
        asaas_subaccount_api_key: apiKey,
        asaas_account_id: accountId,
      };
      if (pix) {
        fullPayload.asaas_pix_key = pix.key;
        fullPayload.asaas_pix_key_type = pix.type;
        fullPayload.asaas_auto_withdraw_enabled = true;
      }
      const attempts: Array<{ label: string; payload: Record<string, unknown> }> = [
        { label: "full", payload: fullPayload },
        { label: "no_pix_fields", payload: { asaas_wallet_id: walletId, asaas_subaccount_api_key: apiKey, asaas_account_id: accountId } },
        { label: "wallet_and_key", payload: { asaas_wallet_id: walletId, asaas_subaccount_api_key: apiKey } },
        { label: "wallet_only", payload: { asaas_wallet_id: walletId } },
      ];
      let savedAs: string | null = null;
      let lastErr: any = null;
      for (const attempt of attempts) {
        const { error } = await adminClient.from("stores").update(attempt.payload).eq("id", storeId);
        if (!error) { savedAs = attempt.label; log("persist_ok", { attempt: attempt.label }); break; }
        lastErr = error;
        log("persist_attempt_failed", { attempt: attempt.label, message: error.message, code: error.code, details: error.details, hint: error.hint });
      }
      return { savedAs, lastErr };
    }

    // === MODE: list-orphans (recovery UI) ===
    if (mode === "list-orphans") {
      const parsed = ListSchema.safeParse(rawBody);
      if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
      const { data: storeRow } = await supabase
        .from("stores").select("id, owner_id").eq("id", parsed.data.store_id).maybeSingle();
      if (!storeRow || (storeRow.owner_id !== userId && !isAdmin)) return json({ error: "Sem permissão" }, 403);
      const { data, error } = await cloudClient
        .from("asaas_subaccounts_registry")
        .select("id, wallet_id, account_id, status, cpf_cnpj, email, created_at, last_error")
        .or(`store_id.eq.${parsed.data.store_id},external_store_id.eq.${parsed.data.store_id}`)
        .neq("status", "linked")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, orphans: data || [] });
    }

    // === MODE: link-existing (recupera subconta órfã) ===
    if (mode === "link-existing") {
      const parsed = LinkSchema.safeParse(rawBody);
      if (!parsed.success) return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
      const { data: storeRow } = await supabase
        .from("stores").select("id, owner_id, asaas_wallet_id").eq("id", parsed.data.store_id).maybeSingle();
      if (!storeRow) return json({ error: "Loja não encontrada" }, 404);
      if (storeRow.owner_id !== userId && !isAdmin) return json({ error: "Sem permissão" }, 403);
      if (storeRow.asaas_wallet_id) return json({ error: "Loja já vinculada a uma subconta." }, 400);

      let regQuery = cloudClient.from("asaas_subaccounts_registry").select("*");
      if (parsed.data.registry_id) regQuery = regQuery.eq("id", parsed.data.registry_id);
      else if (parsed.data.wallet_id) regQuery = regQuery.eq("wallet_id", parsed.data.wallet_id);
      else return json({ error: "Informe registry_id ou wallet_id." }, 400);
      const { data: reg } = await regQuery.maybeSingle();
      const fallbackReg = !reg && parsed.data.wallet_id
        ? { id: null, wallet_id: parsed.data.wallet_id, api_key: null, account_id: null }
        : null;
      const sourceReg = reg || fallbackReg;
      if (!sourceReg) return json({ error: "Registro de subconta não encontrado." }, 404);

      const { savedAs, lastErr } = await persistToStore(
        parsed.data.store_id, sourceReg.wallet_id, sourceReg.api_key, sourceReg.account_id, null,
      );
      if (!savedAs) {
        if (sourceReg.id) {
          await cloudClient.from("asaas_subaccounts_registry").update({
            last_error: { message: lastErr?.message, code: lastErr?.code, details: lastErr?.details, hint: lastErr?.hint, when: "link-existing" },
          }).eq("id", sourceReg.id);
        }
        return json({ error: "Falha ao vincular a subconta à loja.", debug: lastErr }, 500);
      }
      if (sourceReg.id) {
        await cloudClient.from("asaas_subaccounts_registry").update({
          status: "linked", store_id: parsed.data.store_id, external_store_id: parsed.data.store_id, linked_at: new Date().toISOString(), last_error: null,
        }).eq("id", sourceReg.id);
      }
      return json({ success: true, walletId: sourceReg.wallet_id, savedAs, recovered: true });
    }

    // === MODE: create (padrão) ===
    const parsed = CreateSchema.safeParse(rawBody);
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
    if (store.owner_id !== userId && !isAdmin) return json({ error: "Sem permissão" }, 403);
    if (store.asaas_wallet_id) {
      return json({ error: "Esta loja já possui subconta Asaas configurada." }, 400);
    }

    // PRÉ-VALIDAÇÃO: testar gravação na loja externa ANTES de chamar o Asaas.
    // Se o banco externo não aceitar nem um update no-op, não consumimos CPF.
    {
      const { error: preErr } = await adminClient
        .from("stores")
        .update({ asaas_wallet_id: null })
        .eq("id", body.store_id)
        .is("asaas_wallet_id", null);
      if (preErr) {
        log("pre_validate_failed", { message: preErr.message, code: preErr.code, details: preErr.details, hint: preErr.hint });
        return json({
          error: "Banco externo recusou gravação na loja. Nenhuma subconta foi criada.",
          debug: { stage: "pre_validate", message: preErr.message, code: preErr.code, details: preErr.details, hint: preErr.hint },
          traceId, trace,
        }, 500);
      }
      log("pre_validate_ok");
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
    log("asaas_env", { isSandbox, baseUrl });

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

    log("asaas_lookup_existing", { cpfCnpj_len: cpfCnpj.length });
    const existingRes = await fetch(`${baseUrl}/accounts?cpfCnpj=${encodeURIComponent(cpfCnpj)}`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    if (existingRes.ok) {
      const existingData = await existingRes.json();
      const existingAccount = existingData?.data?.[0];
      log("asaas_lookup_result", { found: !!existingAccount, walletId: existingAccount?.walletId });
      if (existingAccount?.walletId) {
        const { savedAs, lastErr } = await persistToStore(
          body.store_id,
          existingAccount.walletId,
          existingAccount.apiKey || null,
          existingAccount.id || null,
          { key: body.pixAddressKey, type: body.pixAddressKeyType },
        );
        if (!savedAs) {
          return json({
            error: "Subconta encontrada no Asaas, mas o salvamento na loja falhou.",
            walletId: existingAccount.walletId,
            recoverable: true,
            debug: { stage: "persist_existing", message: lastErr?.message, code: lastErr?.code, details: lastErr?.details, hint: lastErr?.hint },
            traceId, trace,
          }, 500);
        }
        const { error: regUpErr } = await cloudClient.from("asaas_subaccounts_registry").upsert({
          store_id: body.store_id,
          external_store_id: body.store_id,
          wallet_id: existingAccount.walletId,
          account_id: existingAccount.id || null,
          api_key: existingAccount.apiKey || null,
          cpf_cnpj: cpfCnpj,
          email: existingAccount.email || body.email,
          status: "linked",
          raw_response: existingAccount,
          linked_at: new Date().toISOString(),
          last_error: null,
        }, { onConflict: "wallet_id" });
        if (regUpErr) log("registry_upsert_existing_failed", { message: regUpErr.message, code: regUpErr.code });
        else log("registry_upsert_existing_ok");
        return json({
          success: true,
          walletId: existingAccount.walletId,
          accountId: existingAccount.id,
          savedAs,
          recovered: true,
          message: "Subconta Asaas existente vinculada à loja.",
          traceId, trace,
        });
      }
    }

    const accRes = await fetch(`${baseUrl}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      body: JSON.stringify(subaccountPayload),
    });
    const accData = await accRes.json();
    log("asaas_create_response", { status: accRes.status, ok: accRes.ok, walletId: accData?.walletId, id: accData?.id, errors: accData?.errors });
    if (!accRes.ok) {
      const msg =
        accData?.errors?.[0]?.description || "Falha ao criar subconta no Asaas.";
      return json({ error: msg, asaas: accData, traceId, trace }, 400);
    }

    const walletId: string | undefined = accData.walletId;
    const apiKey: string | undefined = accData.apiKey;
    if (!walletId || !apiKey) {
      return json({ error: "Resposta inesperada do Asaas (sem walletId/apiKey).", asaas: accData }, 500);
    }

    // REGISTRO IMEDIATO no banco externo: nunca perdemos a subconta criada.
    let registryId: string | null = null;
    try {
      const { data: regIns, error: regErr } = await cloudClient
        .from("asaas_subaccounts_registry")
        .upsert({
          store_id: body.store_id,
          external_store_id: body.store_id,
          wallet_id: walletId,
          account_id: accData.id || null,
          api_key: apiKey,
          cpf_cnpj: cpfCnpj,
          email: body.email,
          status: "created",
          raw_response: accData,
        }, { onConflict: "wallet_id" })
        .select("id").maybeSingle();
      if (regErr) log("registry_insert_failed", { message: regErr.message, code: regErr.code, details: regErr.details, hint: regErr.hint });
      else log("registry_insert_ok", { registryId: regIns?.id });
      registryId = regIns?.id ?? null;
    } catch (e) {
      log("registry_insert_exception", { error: String(e) });
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

    const { savedAs, lastErr } = await persistToStore(
      body.store_id, walletId, apiKey, accData.id || null,
      { key: body.pixAddressKey, type: body.pixAddressKeyType },
    );

    if (!savedAs) {
      log("persist_all_failed", { message: lastErr?.message, code: lastErr?.code, details: lastErr?.details, hint: lastErr?.hint });
      if (registryId) {
        await cloudClient.from("asaas_subaccounts_registry").update({
          status: "failed",
          last_error: { message: lastErr?.message, code: lastErr?.code, details: lastErr?.details, hint: lastErr?.hint, when: "create" },
        }).eq("id", registryId);
      }
      return json({
        error: "Subconta criada mas o salvamento na loja falhou. Use 'Recuperar subconta' para vincular sem perder o CPF.",
        walletId,
        registryId,
        recoverable: true,
        debug: { stage: "persist", message: lastErr?.message, code: lastErr?.code, details: lastErr?.details, hint: lastErr?.hint },
        traceId, trace,
      }, 500);
    }

    if (registryId) {
      await cloudClient.from("asaas_subaccounts_registry").update({
        status: "linked", linked_at: new Date().toISOString(), last_error: null,
      }).eq("id", registryId);
    }

    return json({
      success: true,
      walletId,
      accountId: accData.id,
      savedAs,
      message: "Subconta Asaas criada! O split agora será automático em todas as suas vendas PIX.",
      traceId, trace,
    });
  } catch (err) {
    log("unhandled_exception", { error: String(err), stack: (err as Error)?.stack });
    return json({ error: "Erro interno.", traceId, trace }, 500);
  }
});
