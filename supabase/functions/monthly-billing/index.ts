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

  // Auth: require service role key or anon key via Authorization header
  const authHeader = req.headers.get("Authorization");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = authHeader?.replace("Bearer ", "");
  if (!token || (token !== anonKey && token !== serviceKey)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return json({ error: "ASAAS_API_KEY not configured" }, 500);
    }

    const asaasBaseUrl = ASAAS_API_KEY.startsWith("$aact_")
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    // Get all active plans with monthly_fee > 0 that are due for billing
    const now = new Date();
    const { data: duePlans, error: plansError } = await supabase
      .from("store_plans")
      .select("*, stores!inner(id, name, owner_id, asaas_account_id, status)")
      .gt("monthly_fee", 0)
      .eq("is_active", true)
      .or(`next_billing_date.is.null,next_billing_date.lte.${now.toISOString()}`);

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

        const planLabel = plan.plan_type === "fixed" ? "Plano Fixo" : "Plano Híbrido";
        const description = `${planLabel} - ${store.name} - ${referenceCode}`;

        // Create Asaas charge
        const chargeBody: any = {
          billingType: "PIX",
          value: Number(plan.monthly_fee),
          dueDate: dueDateStr,
          description: description.substring(0, 256),
          externalReference: referenceCode,
        };

        // If store has Asaas sub-account, charge the sub-account customer
        if (store.asaas_account_id) {
          chargeBody.customer = store.asaas_account_id;
        }

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

        // Update plan billing dates
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        await supabase
          .from("store_plans")
          .update({
            last_billed_at: now.toISOString(),
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
