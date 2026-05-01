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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 🔁 EXTERNAL DB: this project keeps stores/plans/financial_transactions
  // in the external Supabase project (qkjhguziuchqsbxzruea), NOT Lovable Cloud.
  const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;

  // Auth: accept service keys for scheduled jobs, or a real external admin JWT
  // for the admin panel. Do NOT accept anon keys as admin credentials.
  const authHeader = req.headers.get("Authorization");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const externalAnon = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || anonKey;
  const token = authHeader?.replace("Bearer ", "") || "";

  let isAdminCaller = !!token && (token === serviceKey || token === EXTERNAL_KEY);

  if (!isAdminCaller && token) {
    // Try as a user JWT against the external project
    try {
      const userClient = createClient(EXTERNAL_URL, externalAnon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: u } = await userClient.auth.getUser(token);
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

    const asaasBaseUrl = ASAAS_API_KEY.startsWith("$aact_")
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    // Optional manual trigger by admin: { store_id, force }
    let manualStoreId: string | null = null;
    let force = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        manualStoreId = body?.store_id ?? null;
        force = !!body?.force;
      } catch (_) {
        // no body
      }
    }

    // Get all active plans with monthly_fee > 0 that are due for billing and not in trial
    const now = new Date();
    let query = supabase
      .from("store_plans")
      .select("*, stores!inner(id, name, owner_id, asaas_account_id, status)")
      .gt("monthly_fee", 0)
      .eq("is_active", true);

    if (manualStoreId) {
      query = query.eq("store_id", manualStoreId);
    }
    if (!force) {
      query = query
        .or(`trial_ends_at.is.null,trial_ends_at.lte.${now.toISOString()}`)
        .or(`next_billing_date.is.null,next_billing_date.lte.${now.toISOString()}`);
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

    for (const plan of duePlans) {
      const store = (plan as any).stores;
      if (!store || store.status !== "ativo") continue;

      try {
        // Generate reference
        const { data: refData } = await supabase.rpc("generate_financial_reference", {
          _prefix: "MENS",
        });
        const referenceCode = refData || `#MENS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

        const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days to pay
        const dueDateStr = dueDate.toISOString().split("T")[0];

        const isSupporter = plan.plan_type === "fixed" && Number(plan.monthly_fee) === 130;
        const planLabel = isSupporter
          ? "Plano Apoiadores"
          : plan.plan_type === "fixed"
            ? "Plano Essencial"
            : "Plano Crescimento";
        const description = `${planLabel} - ${store.name} - ${referenceCode}`;

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
          const isSandbox = !ASAAS_API_KEY.startsWith("$aact_");
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
          value: Number(plan.monthly_fee),
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
          amount: Number(plan.monthly_fee),
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
          },
        });

        // DON'T update last_billed_at here — only set it when payment is confirmed via webhook
        // Just advance next_billing_date so we don't re-bill the same period
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        await supabase
          .from("store_plans")
          .update({
            next_billing_date: nextMonth.toISOString(),
          })
          .eq("id", plan.id);

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
