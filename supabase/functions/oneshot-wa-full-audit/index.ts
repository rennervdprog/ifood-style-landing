const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

async function extSQL(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function evo(path: string) {
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "";
  const r = await fetch(`${base}${path}`, { headers: { apikey: key } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: any = {};

  out.env = {
    EXTERNAL_SUPABASE_URL: !!Deno.env.get("EXTERNAL_SUPABASE_URL"),
    EXTERNAL_SUPABASE_SERVICE_KEY: !!Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY"),
    EXTERNAL_SUPABASE_PROJECT_REF: Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || null,
    EVOLUTION_API_URL: Deno.env.get("EVOLUTION_API_URL") || null,
    EVOLUTION_GLOBAL_API_KEY: !!Deno.env.get("EVOLUTION_GLOBAL_API_KEY"),
    EVOLUTION_WEBHOOK_TOKEN: !!Deno.env.get("EVOLUTION_WEBHOOK_TOKEN"),
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") || null,
  };

  // Configs no banco EXTERNO
  out.store_configs = await extSQL(`
    SELECT store_id, evolution_instance_name, status, phone_number, connected_at, auto_reply_enabled, updated_at
    FROM public.store_whatsapp_config ORDER BY updated_at DESC;
  `);
  out.platform_configs = await extSQL(`
    SELECT id, instance_name, status, phone_number, connected_at, updated_at
    FROM public.platform_whatsapp_config ORDER BY updated_at DESC;
  `);

  // Índices anti-rajada
  out.indexes = await extSQL(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='whatsapp_send_log'
    ORDER BY indexname;
  `);
  out.dedupe_column = await extSQL(`
    SELECT column_name, generation_expression FROM information_schema.columns
    WHERE table_schema='public' AND table_name='whatsapp_send_log' AND column_name='sent_bucket_min';
  `);

  // Últimos envios (para ver duplicações)
  out.recent_sends = await extSQL(`
    SELECT store_id, phone, kind, message_hash, sent_at
    FROM public.whatsapp_send_log
    WHERE sent_at > now() - interval '2 hours'
    ORDER BY sent_at DESC LIMIT 40;
  `);

  // Evolution: lista instâncias e webhook de cada uma relevante
  const inst = await evo(`/instance/fetchInstances`);
  out.instances = (inst.body || []).map((i: any) => ({
    name: i?.name || i?.instance?.instanceName,
    state: i?.connectionStatus || i?.instance?.state,
    ownerJid: i?.ownerJid || i?.instance?.owner,
    integration: i?.integration || i?.instance?.integration,
  }));

  for (const name of ["store-b97f3a1a", "itasuper-platform"]) {
    out[`webhook_${name}`] = await evo(`/webhook/find/${name}`);
    out[`state_${name}`] = await evo(`/instance/connectionState/${name}`);
  }

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
