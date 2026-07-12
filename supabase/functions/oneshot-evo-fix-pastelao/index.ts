import { createClient } from "npm:@supabase/supabase-js@2.49.4";
Deno.serve(async () => {
  const base = Deno.env.get("EVOLUTION_API_URL")!.replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY")!;
  const admin = createClient(
    Deno.env.get("EXTERNAL_SUPABASE_URL")!,
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!,
  );
  const instance = "store-b97f3a1a";
  const r = await fetch(`${base}/instance/fetchInstances?instanceName=${instance}`, { headers: { apikey: key }});
  const arr: any = await r.json();
  const inst = Array.isArray(arr) ? arr[0] : arr;
  const owner = inst?.ownerJid;
  const phone = owner?.split("@")[0];
  const createdAt = inst?.createdAt || inst?.updatedAt;
  let webhookInfo: any = null;
  try {
    const wr = await fetch(`${base}/webhook/find/${instance}`, { headers: { apikey: key }});
    webhookInfo = await wr.json();
  } catch (e) { webhookInfo = String(e); }
  const patch = {
    phone_number: phone,
    status: "connected",
    connected_at: createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    qr_code: null,
  };
  const { error } = await admin.from("store_whatsapp_config").update(patch).eq("evolution_instance_name", instance);
  return new Response(JSON.stringify({ ownerJid: owner, phone, createdAt, patch, error, webhookInfo }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
