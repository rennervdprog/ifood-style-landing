import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const BodySchema = z.object({
  store_id: z.string().uuid().optional(),
  force: z.boolean().optional(),
}).partial();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, baggage, sentry-trace, x-supabase-api-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 🔁 EXTERNAL DB: this project keeps stores/plans/financial_transactions
  // in the external Supabase project (qkjhguziuchqsbxzruea), NOT Lovable Cloud.
  const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
    || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
    || Deno.env.get("SERVICE_ROLE_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: accept service keys for scheduled jobs, or a real external admin JWT
  // for the admin panel. Do NOT accept anon keys as admin credentials.
  const authHeader = req.headers.get("Authorization");
  const apikeyHeader = req.headers.get("apikey") || "";
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const externalAnon = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const token = authHeader?.replace("Bearer ", "") || apikeyHeader;

  // SECURITY: only accept service-role keys or an explicit CRON_SECRET for scheduled jobs.
  // NEVER accept anon keys — they are publicly known and would be a privilege escalation.
  let isAdminCaller =
    !!token &&
    (token === serviceKey ||
      token === EXTERNAL_KEY ||
      (cronSecret !== "" && token === cronSecret));

  // Bypass adicional para E2E/tooling interno
  const e2eSecret = Deno.env.get("E2E_ADMIN_SECRET") || "";
  const e2eHdr = req.headers.get("x-e2e-secret") || "";
  if (!isAdminCaller && e2eSecret && e2eHdr === e2eSecret) {
    isAdminCaller = true;
  }

  if (!isAdminCaller && token) {
    // Try as a user JWT against the external project.
    // Use the service key here — getUser() validates the passed token
    // regardless of the key used to construct the client, and the anon
    // key may not be exposed as a secret on the external runtime.
    try {
      const authKey = externalAnon || EXTERNAL_KEY;
      const userClient = createClient(EXTERNAL_URL, authKey);
      const { data: u, error: uErr } = await userClient.auth.getUser(token);
      if (uErr) console.warn("[monthly-billing] getUser err", uErr.message);
      if (u?.user) {
        const adminClient = createClient(EXTERNAL_URL, EXTERNAL_KEY);
        const { data: isPlatformAdmin, error: rpcError } = await adminClient
          .rpc("is_platform_admin", { _user_id: u.user.id });

        if (!rpcError) {
          isAdminCaller = !!isPlatformAdmin;
        } else {
          const { data: role } = await adminClient
            .from("user_roles")
            .select("role")
            .eq("user_id", u.user.id)
            .eq("role", "admin")
            .maybeSingle();
          isAdminCaller = !!role;
        }
      }
    } catch (authError) {
      console.warn("[monthly-billing] admin auth failed", authError);
    }
  }

  if (!isAdminCaller) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return json({ error: "ASAAS_API_KEY not configured" }, 500);
    }

    const asaasBaseUrl = ASAAS_API_KEY.startsWith("$aact_prod_")
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    // Optional manual trigger by admin: { store_id, force }
    let manualStoreId: string | null = null;
    let force = false;
    if (req.method === "POST") {
      try {
        const raw = await req.json();
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return json({ error: parsed.error.flatten().fieldErrors }, 400);
        }
        manualStoreId = parsed.data.store_id ?? null;
        force = !!parsed.data.force;
      } catch (_) {
        // no body
      }
    }

    // Get all active plans that are due for billing:
    // - monthly_fee > 0 (planos com mensalidade)
    // - OU pdv_commission_pending > 0 (comissão PDV acumulada em qualquer plano)
    // - OU commission_only com comissao acumulada em store_balances
    // Nota: commission_only tem monthly_fee=0 mas pode ter comissão pendente
    const now = new Date();

    // Pré-carrega add-ons ativos p/ incluir também lojas com plano grátis
    // porém com add-on pago contratado.
    const { data: preAddons } = await supabase
      .from("store_addons")
      .select("store_id, enabled, cancels_at, price_override, addon_code")
      .eq("enabled", true);
    const activeAddonStoreIds = Array.from(new Set(
      (preAddons || [])
        .filter((a: any) => !a.cancels_at || new Date(a.cancels_at) > now)
        .map((a: any) => a.store_id),
    ));

    // Buscar planos com mensalidade, comissão PDV pendente ou add-on ativo.
    const orClauses = ["monthly_fee.gt.0", "pdv_commission_pending.gt.0"];
    if (activeAddonStoreIds.length) {
      orClauses.push(`store_id.in.(${activeAddonStoreIds.join(",")})`);
    }
    let query = supabase
      .from("store_plans")
      .select("*, stores!inner(id, name, owner_id, asaas_account_id, status)")
      .or(orClauses.join(","))
      .eq("is_active", true);

    if (manualStoreId) {
      query = query.eq("store_id", manualStoreId);
    }
    if (!force) {
      // Cooldown: skip plans we already tried to bill in the last 20h
      // (avoids generating duplicate PIX charges if cron fires twice or webhook is delayed)
      const cooldown = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
      query = query
        .or(`trial_ends_at.is.null,trial_ends_at.lte.${now.toISOString()}`)
        .or(`next_billing_date.is.null,next_billing_date.lte.${now.toISOString()}`)
        .or(`last_billing_attempt_at.is.null,last_billing_attempt_at.lte.${cooldown}`);
    }

    const { data: duePlans, error: plansError } = await query;

    if (plansError) {
      console.error("Error fetching plans:", plansError);
      return json({ error: "Failed to fetch plans" }, 500);
    }

    if (!duePlans || duePlans.length === 0) {
      return json({ message: "No plans due for billing", billed: 0 });
    }

    let billed = 0;
    let failed = 0;
    const results: any[] = [];

    // Load plan templates to detect VIP (personalized) conditions per store
    const { data: templates } = await supabase
      .from("plan_templates")
      .select("plan_type, monthly_fee, commission_rate, pix_fee, delivery_split, pdv_fixed");
    const templateByType = new Map<string, any>();
    (templates || []).forEach((t: any) => templateByType.set(t.plan_type, t));

    // Add-on catálogo + assinaturas ativas (não legado) para somar na fatura.
    const { data: addonCatalog } = await supabase
      .from("plan_addons")
      .select("code, name, monthly_price");
    const addonPriceByCode = new Map<string, { name: string; price: number }>();
    (addonCatalog || []).forEach((a: any) =>
      addonPriceByCode.set(a.code, { name: a.name, price: Number(a.monthly_price) }),
    );
    const { data: allStoreAddons } = await supabase
      .from("store_addons")
      .select("store_id, addon_code, enabled, price_override, cancels_at, first_charge_done, activated_at");
    const addonsByStore = new Map<string, any[]>();
    (allStoreAddons || []).forEach((sa: any) => {
      if (!sa.enabled) return;
      if (sa.cancels_at && new Date(sa.cancels_at) <= now) return;
      const arr = addonsByStore.get(sa.store_id) || [];
      arr.push(sa);
      addonsByStore.set(sa.store_id, arr);
    });

    // Helper de proração: valor proporcional aos dias restantes do mês civil (inclui hoje).
    const prorate = (priceReais: number, ref: Date) => {
      const y = ref.getFullYear(), m = ref.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const remaining = Math.max(1, daysInMonth - ref.getDate() + 1);
      return Math.round(priceReais * (remaining / daysInMonth) * 100) / 100;
    };

    for (const plan of duePlans) {
      const store = (plan as any).stores;
      if (!store || store.status !== "ativo") continue;

      try {
        // Atomic lock: only one concurrent run may bill this plan.
        // Conditional update succeeds only if last_billing_attempt_at is
        // unchanged from what we read (null or older than the 20h cooldown).
        const prevAttempt = (plan as any).last_billing_attempt_at ?? null;
        const cooldownIso = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
        let lockQ = supabase
          .from("store_plans")
          .update({ last_billing_attempt_at: now.toISOString() })
          .eq("id", plan.id);
        lockQ = prevAttempt === null
          ? lockQ.is("last_billing_attempt_at", null)
          : lockQ.eq("last_billing_attempt_at", prevAttempt);
        const { data: lockRows, error: lockErr } = await lockQ.select("id");
        if (lockErr) {
          console.error(`[monthly-billing] lock error for ${store.name}:`, lockErr);
          continue;
        }
        if (!lockRows || lockRows.length === 0) {
          // Another concurrent invocation already grabbed this plan; also
          // covers the case where cooldown was bumped between read and write.
          if (!force) continue;
          // force=true bypasses the lock (manual admin trigger)
        }

        // Generate reference
        const { data: refData } = await supabase.rpc("generate_financial_reference", {
          _prefix: "MENS",
        });
        const referenceCode = refData || `#MENS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

        const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days to pay
        const dueDateStr = dueDate.toISOString().split("T")[0];

        // "supporter" é o plan_type real do plano Apoiadores
        // (legado: alguns registros antigos salvaram como "fixed" com monthly_fee=130)
        const isSupporter = plan.plan_type === "supporter" ||
          (plan.plan_type === "fixed" && Number(plan.monthly_fee) === 130);
        const planLabel = isSupporter
          ? "Plano Apoiadores"
          : plan.plan_type === "fixed"
            ? "Plano Essencial"
            : plan.plan_type === "hybrid"
              ? "Plano Crescimento"
              : plan.plan_type === "autonomy"
                ? "Plano Autonomia"
                : plan.plan_type === "pdv_only"
                  ? "Plano Somente PDV"
                  : "Plano Comissão";

        // Incluir comissão PDV acumulada no período
        const pdvPending = Number((plan as any).pdv_commission_pending || 0);
        const pdvLine = pdvPending > 0 ? ` + Comissão PDV R$${pdvPending.toFixed(2)}` : "";

        // Add-ons ativos (ex.: PDV R$49) — só se loja NÃO for legada.
        const storeAddons = addonsByStore.get(store.id) || [];
        let addonsTotal = 0;
        const addonLines: string[] = [];
        const addonsBilledFirst: string[] = []; // rastreia quais serão marcados como cobrados
        for (const sa of storeAddons) {
          const cat = addonPriceByCode.get(sa.addon_code);
          if (!cat) continue;
          const price = sa.price_override !== null && sa.price_override !== undefined
            ? Number(sa.price_override) : cat.price;
          if (price <= 0) continue; // VIP grátis
          if (!sa.first_charge_done) {
            const prorated = prorate(price, now);
            addonsTotal += prorated;
            addonLines.push(`${cat.name} R$${prorated.toFixed(2)} (proporcional)`);
            addonsBilledFirst.push(sa.addon_code);
          } else {
            addonsTotal += price;
            addonLines.push(`${cat.name} R$${price.toFixed(2)}`);
          }
        }

        // Proração da mensalidade do próprio plano pdv_only na 1ª cobrança.
        let planMonthly = Number(plan.monthly_fee);
        let pdvOnlyFirst = false;
        if (plan.plan_type === "pdv_only" && !(plan as any).pdv_only_first_charge_done && planMonthly > 0) {
          planMonthly = prorate(planMonthly, now);
          pdvOnlyFirst = true;
        }
        let totalAmount = planMonthly + pdvPending + addonsTotal;

        // Aplica crédito acumulado (cancelamentos anteriores), com piso em 0.
        const creditCents = Number((plan as any).billing_credit_cents || 0);
        let creditApplied = 0;
        if (creditCents > 0 && totalAmount > 0) {
          const creditReais = creditCents / 100;
          creditApplied = Math.min(creditReais, totalAmount);
          totalAmount = Math.max(0, Math.round((totalAmount - creditApplied) * 100) / 100);
        }

        // Detect VIP: any store_plans value diverges from plan_templates default
        const tpl = templateByType.get(plan.plan_type);
        const isVip = !!tpl && (
          Number(tpl.monthly_fee ?? 0) !== Number(plan.monthly_fee ?? 0) ||
          Number(tpl.commission_rate ?? 0) !== Number(plan.commission_rate ?? 0) ||
          Number(tpl.pix_fee ?? 0) !== Number(plan.pix_operational_fee_override ?? tpl.pix_fee ?? 0) ||
          Number(tpl.delivery_split ?? 0) !== Number(plan.platform_delivery_split_override ?? tpl.delivery_split ?? 0) ||
          Number(tpl.pdv_fixed ?? 0) !== Number(plan.pdv_fixed_fee_per_sale ?? tpl.pdv_fixed ?? 0)
        );
        const vipTag = isVip ? " (condição VIP)" : "";
        const addonsDesc = addonLines.length ? ` + ${addonLines.join(" + ")}` : "";
        const proratedTag = pdvOnlyFirst ? " (proporcional 1º mês)" : "";
        const creditTag = creditApplied > 0 ? ` (- crédito R$${creditApplied.toFixed(2)})` : "";
        const description = `${planLabel}${vipTag}${proratedTag}${pdvLine}${addonsDesc}${creditTag} - ${store.name} - ${referenceCode}`;

        // Se totalAmount == 0 (crédito zerou tudo), pula cobrança Asaas mas registra e consome crédito.
        if (totalAmount <= 0) {
          await supabase.from("financial_transactions").insert({
            store_id: store.id,
            transaction_kind: "commission_charge",
            reference_code: referenceCode,
            amount: 0,
            status: "paid",
            provider: "credit",
            metadata: {
              plan_type: plan.plan_type,
              plan_label: planLabel,
              store_name: store.name,
              billing_period: now.toISOString(),
              credit_applied: creditApplied,
              addons_billed_first: addonsBilledFirst,
              note: "Cobrança zerada por crédito acumulado.",
            },
          });
          const remainingCents = Math.max(0, creditCents - Math.round(creditApplied * 100));
          const patch: Record<string, unknown> = { billing_credit_cents: remainingCents };
          if (pdvOnlyFirst) patch.pdv_only_first_charge_done = true;
          await supabase.from("store_plans").update(patch).eq("id", plan.id);
          if (addonsBilledFirst.length) {
            await supabase.from("store_addons").update({ first_charge_done: true })
              .eq("store_id", store.id).in("addon_code", addonsBilledFirst);
          }
          billed++;
          results.push({ store: store.name, reference: referenceCode, status: "credit_covered" });
          continue;
        }

        // Resolve Asaas customer for this store
        let customerId: string | null = store.asaas_account_id || null;

        if (!customerId) {
          // Look up store owner profile to create/find a customer
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("full_name, email, document")
            .eq("user_id", store.owner_id)
            .maybeSingle();

          let cleanCpf = String(ownerProfile?.document || "").replace(/\D/g, "");
          const isSandbox = !ASAAS_API_KEY.startsWith("$aact_prod_");
          if (isSandbox && cleanCpf.length < 11) cleanCpf = "52998224725";

          // PRODUCTION requires a valid CPF/CNPJ — fail early with a clear message
          if (!isSandbox && cleanCpf.length < 11) {
            console.error(`[monthly-billing] Store ${store.name} owner has no CPF/CNPJ — cannot bill`);
            failed++;
            results.push({
              store: store.name,
              error: "CPF/CNPJ do dono da loja não cadastrado. Peça ao lojista para preencher o documento no perfil.",
              owner_id: store.owner_id,
            });
            continue;
          }

          if (cleanCpf.length >= 11) {
            const searchRes = await fetch(`${asaasBaseUrl}/customers?cpfCnpj=${cleanCpf}`, {
              headers: { "access_token": ASAAS_API_KEY },
            });
            if (searchRes.ok) {
              const sd = await searchRes.json();
              if (sd.data?.length > 0) customerId = sd.data[0].id;
            }
          }

          if (!customerId) {
            const customerEmail = ownerProfile?.email || `lojista-${(store.owner_id || "").substring(0, 8)}@itasuper.com`;
            const cBody: Record<string, unknown> = {
              name: ownerProfile?.full_name || store.name || "Lojista",
              email: customerEmail,
            };
            if (cleanCpf.length >= 11) cBody.cpfCnpj = cleanCpf;

            const createRes = await fetch(`${asaasBaseUrl}/customers`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
              body: JSON.stringify(cBody),
            });
            const cData = await createRes.json();
            if (!createRes.ok) {
              console.error(`Asaas customer create failed for ${store.name}:`, JSON.stringify(cData));
              failed++;
              results.push({ store: store.name, error: cData });
              continue;
            }
            customerId = cData.id;
          }
        }

        // Create Asaas charge
        const chargeBody: any = {
          customer: customerId,
          billingType: "PIX",
      notificationDisabled: true,
          value: totalAmount,  // mensalidade + comissão PDV acumulada
          dueDate: dueDateStr,
          description: description.substring(0, 256),
          externalReference: referenceCode,
        };

        const chargeResponse = await fetch(`${asaasBaseUrl}/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY,
          },
          body: JSON.stringify(chargeBody),
        });

        const chargeData = await chargeResponse.json();

        if (!chargeResponse.ok) {
          console.error(`Asaas charge failed for ${store.name}:`, JSON.stringify(chargeData));
          failed++;
          results.push({ store: store.name, error: chargeData });
          continue;
        }

        // Get PIX QR code
        let pixQrCode = null;
        let pixQrCodeBase64 = null;
        let pixCopyPaste = null;

        if (chargeData.id) {
          const pixResponse = await fetch(`${asaasBaseUrl}/payments/${chargeData.id}/pixQrCode`, {
            headers: { "access_token": ASAAS_API_KEY },
          });
          if (pixResponse.ok) {
            const pixData = await pixResponse.json();
            pixQrCode = pixData.payload || null;
            pixQrCodeBase64 = pixData.encodedImage || null;
            pixCopyPaste = pixData.payload || null;
          }
        }

        // Save financial transaction
        await supabase.from("financial_transactions").insert({
          store_id: store.id,
          transaction_kind: "commission_charge",
          reference_code: referenceCode,
          amount: totalAmount,  // mensalidade + comissão PDV
          status: "pending",
          provider: "asaas",
          mercado_pago_payment_id: chargeData.id || null,
          pix_qr_code: pixQrCode,
          pix_qr_code_base64: pixQrCodeBase64,
          pix_copy_paste: pixCopyPaste,
          metadata: {
            plan_type: plan.plan_type,
            plan_label: planLabel,
            store_name: store.name,
            billing_period: now.toISOString(),
            pdv_pending_billed: pdvPending, // webhook usa para zerar APÓS pagamento
            credit_applied: creditApplied,
            addons_billed_first: addonsBilledFirst,
            pdv_only_first_charge: pdvOnlyFirst,
          },
        });

        // NÃO zera pdv_commission_pending aqui — se o lojista não pagar o PIX,
        // o valor seria perdido. Zeramento é feito pelo asaas-webhook ao confirmar
        // o pagamento (via RPC decrement_pdv_commission_pending), subtraindo apenas
        // o valor faturado e preservando comissão acumulada no período de espera.

        // Marca first_charge_done já na emissão do PIX (proteção anti-duplo-proração).
        // Se o lojista não pagar, cobrança segue como "pending" e a próxima tentativa
        // usará valor cheio — comportamento aceitável e conservador para a plataforma.
        if (addonsBilledFirst.length) {
          await supabase.from("store_addons").update({ first_charge_done: true })
            .eq("store_id", store.id).in("addon_code", addonsBilledFirst);
        }
        const planPatch: Record<string, unknown> = {};
        if (pdvOnlyFirst) planPatch.pdv_only_first_charge_done = true;
        if (creditApplied > 0) {
          const remainingCents = Math.max(0, creditCents - Math.round(creditApplied * 100));
          planPatch.billing_credit_cents = remainingCents;
        }
        if (Object.keys(planPatch).length) {
          await supabase.from("store_plans").update(planPatch).eq("id", plan.id);
        }

        billed++;
        results.push({ store: store.name, reference: referenceCode, status: "billed" });
        console.log(`Monthly billing created for ${store.name}: ${referenceCode}`);
      } catch (err) {
        console.error(`Error billing ${store.name}:`, err);
        failed++;
        results.push({ store: store.name, error: String(err) });
      }
    }

    return json({ billed, failed, results });
  } catch (err) {
    console.error("Monthly billing error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
