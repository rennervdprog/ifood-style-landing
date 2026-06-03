import { createClient } from "npm:@supabase/supabase-js@2";

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

/**
 * Cron-driven edge function: runs daily and, for every store with
 * auto-withdraw enabled, transfers the available balance from the Asaas
 * subaccount to the lojista's PIX key.
 *
 * Triggered by pg_cron (no JWT required, but we accept a CRON_SECRET).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Optional shared-secret check so this isn't trivially callable.
    const expected = Deno.env.get("CRON_SECRET");
    if (expected) {
      const got =
        req.headers.get("x-cron-secret") ||
        new URL(req.url).searchParams.get("secret");
      if (got !== expected) return json({ error: "Forbidden" }, 403);
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) return json({ error: "ASAAS_API_KEY missing" }, 500);

    const isSandbox = !ASAAS_API_KEY.startsWith("$aact_");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: stores, error: storesErr } = await admin
      .from("stores")
      .select(
        "id, name, asaas_subaccount_api_key, asaas_pix_key, asaas_pix_key_type, asaas_min_withdraw_amount"
      )
      .eq("asaas_auto_withdraw_enabled", true)
      .not("asaas_subaccount_api_key", "is", null)
      .not("asaas_pix_key", "is", null);

    if (storesErr) {
      console.error("Failed to load stores:", storesErr);
      return json({ error: "DB error" }, 500);
    }

    const results: Array<Record<string, unknown>> = [];

    for (const store of stores ?? []) {
      const subKey = store.asaas_subaccount_api_key as string;
      const pixKey = store.asaas_pix_key as string;
      const pixType = (store.asaas_pix_key_type as string) || "EVP";
      const minAmount = Number(store.asaas_min_withdraw_amount ?? 5);

      try {
        // 1. Check available balance on the subaccount
        const balRes = await fetch(`${baseUrl}/finance/balance`, {
          headers: { access_token: subKey },
        });
        const balData = await balRes.json();
        if (!balRes.ok) {
          console.warn(`Balance error store=${store.id}`, balData);
          results.push({ store_id: store.id, skipped: "balance_error" });
          continue;
        }
        const balance = Number(balData.balance ?? 0);
        if (balance < minAmount) {
          results.push({ store_id: store.id, skipped: "below_min", balance });
          continue;
        }

        // 2. Trigger PIX transfer to the lojista's own key
        const transferPayload: Record<string, unknown> = {
          value: balance,
          pixAddressKey: pixKey,
          pixAddressKeyType: pixType,
          operationType: "PIX",
        };

        const tRes = await fetch(`${baseUrl}/transfers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: subKey,
          },
          body: JSON.stringify(transferPayload),
        });
        const tData = await tRes.json();
        if (!tRes.ok) {
          console.warn(`Transfer error store=${store.id}`, tData);
          results.push({ store_id: store.id, error: tData });
          continue;
        }

        await admin
          .from("stores")
          .update({ asaas_last_withdraw_at: new Date().toISOString() })
          .eq("id", store.id);

        results.push({
          store_id: store.id,
          ok: true,
          value: balance,
          transferId: tData.id,
        });
      } catch (e) {
        console.error(`Loop error store=${store.id}`, e);
        results.push({ store_id: store.id, error: String(e) });
      }
    }

    return json({ success: true, processed: results.length, results });
  } catch (err) {
    console.error("auto-withdraw-subaccounts error:", err);
    return json({ error: "Internal error" }, 500);
  }
});