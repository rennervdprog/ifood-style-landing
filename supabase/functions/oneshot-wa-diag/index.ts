import { createClient } from "npm:@supabase/supabase-js@2.49.4";
Deno.serve(async () => {
  const admin = createClient(Deno.env.get("EXTERNAL_SUPABASE_URL")!, Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!);
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "";
  const out: any = {};

  // 1) Sync números reais para todas as instâncias
  const { data: stores } = await admin.from("store_whatsapp_config").select("id, evolution_instance_name, phone_number, status").not("evolution_instance_name", "is", null);
  for (const s of stores || []) {
    const r = await fetch(`${base}/instance/fetchInstances?instanceName=${s.evolution_instance_name}`, { headers: { apikey: key } });
    const arr: any = await r.json().catch(()=>[]);
    const inst = Array.isArray(arr) ? arr[0] : arr;
    const owner = inst?.ownerJid;
    const state = inst?.connectionStatus;
    if (owner && typeof owner === "string") {
      const phone = owner.split("@")[0];
      const patch: any = { phone_number: phone, updated_at: new Date().toISOString() };
      if (state === "open") patch.status = "connected";
      if (String(s.phone_number || "").replace(/\D/g,"") !== phone) patch.connected_at = new Date().toISOString();
      await admin.from("store_whatsapp_config").update(patch).eq("id", s.id);
      out[s.evolution_instance_name] = { was: s.phone_number, now: phone, state };
    }
  }

  // 2) Webhook config check
  const inst = "store-b97f3a1a";
  const w = await fetch(`${base}/webhook/find/${inst}`, { headers: { apikey: key } });
  out.webhook_store = { status: w.status, body: await w.json().catch(()=>null) };
  const w2 = await fetch(`${base}/webhook/find/itasuper-platform`, { headers: { apikey: key } });
  out.webhook_platform = { status: w2.status, body: await w2.json().catch(()=>null) };

  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
});
