import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Desativa SMS, ligação e WhatsApp em TODAS as notificações de TODOS os
// customers do Asaas (mantém apenas e-mail, que é gratuito).
// Execução única / sob demanda. Requer ASAAS_API_KEY.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const baseUrl = apiKey.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  let offset = 0;
  const limit = 100;
  let customersProcessed = 0;
  let notificationsDisabled = 0;
  const errors: string[] = [];
  let sampleNotification: unknown = null;

  try {
    while (true) {
      const listRes = await fetch(`${baseUrl}/customers?limit=${limit}&offset=${offset}`, {
        headers: { "access_token": apiKey },
      });
      const listData = await listRes.json();
      if (!listRes.ok) {
        errors.push(`Erro listando customers offset=${offset}: ${JSON.stringify(listData)}`);
        break;
      }
      const customers = listData.data || [];
      if (customers.length === 0) break;

      for (const c of customers) {
        customersProcessed++;
        try {
          const notifRes = await fetch(`${baseUrl}/customers/${c.id}/notifications`, {
            headers: { "access_token": apiKey },
          });
          const notifData = await notifRes.json();
          if (!notifRes.ok) {
            errors.push(`customer ${c.id}: ${JSON.stringify(notifData)}`);
            continue;
          }
          for (const n of (notifData.data || [])) {
            if (!sampleNotification) sampleNotification = n;
            if (!n.smsEnabledForProvider && !n.phoneCallEnabledForProvider && !n.whatsappEnabledForProvider) continue;
            const upd = await fetch(`${baseUrl}/notifications/${n.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", "access_token": apiKey },
              body: JSON.stringify({
                enabled: n.enabled,
                emailEnabledForProvider: n.emailEnabledForProvider,
                smsEnabledForProvider: false,
                phoneCallEnabledForProvider: false,
                whatsappEnabledForProvider: false,
                emailEnabledForCustomer: n.emailEnabledForCustomer,
                smsEnabledForCustomer: false,
                phoneCallEnabledForCustomer: false,
                whatsappEnabledForCustomer: false,
              }),
            });
            if (upd.ok) notificationsDisabled++;
            else errors.push(`notif ${n.id}: ${await upd.text()}`);
          }
        } catch (e) {
          errors.push(`customer ${c.id}: ${String(e)}`);
        }
      }

      if (customers.length < limit) break;
      offset += limit;
    }
  } catch (e) {
    errors.push(String(e));
  }

  return new Response(JSON.stringify({
    ok: true,
    customersProcessed,
    notificationsDisabled,
    errors: errors.slice(0, 50),
    errorCount: errors.length,
    sampleNotification,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});