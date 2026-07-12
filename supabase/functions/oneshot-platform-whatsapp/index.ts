// Oneshot: cria schema para WhatsApp da plataforma + grace period Essencial.
// - platform_whatsapp_config (config única)
// - platform_whatsapp_log (dedupe de envios)
// - platform_whatsapp_send_log (log estilo whatsapp_send_log, para anti-ban)
// - store_plans.essencial_upgrade_scheduled_at
// - admin_settings.support_whatsapp (row default se não existir)
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;

  async function runSql(query: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const t = await r.text();
    let d: unknown = t; try { d = JSON.parse(t); } catch {}
    return { status: r.status, ok: r.ok, data: d };
  }

  const sql = `
    -- platform_whatsapp_config: config única (singleton via id fixo)
    create table if not exists public.platform_whatsapp_config (
      id uuid primary key default gen_random_uuid(),
      instance_name text not null default 'itasuper-platform',
      phone_number text,
      status text default 'disconnected',
      connected_at timestamptz,
      support_display_name text default 'Suporte ItaSuper',
      support_link_message text default 'Olá! Preciso de ajuda com minha loja.',
      avisos_ativos boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    grant select on public.platform_whatsapp_config to authenticated;
    grant all on public.platform_whatsapp_config to service_role;
    alter table public.platform_whatsapp_config enable row level security;
    do $$ begin
      if not exists (select 1 from pg_policies where tablename='platform_whatsapp_config' and policyname='pwc_select_all_auth') then
        create policy pwc_select_all_auth on public.platform_whatsapp_config for select to authenticated using (true);
      end if;
      if not exists (select 1 from pg_policies where tablename='platform_whatsapp_config' and policyname='pwc_admin_write') then
        create policy pwc_admin_write on public.platform_whatsapp_config for all to authenticated
          using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
      end if;
    end $$;
    insert into public.platform_whatsapp_config (instance_name)
    select 'itasuper-platform'
    where not exists (select 1 from public.platform_whatsapp_config);

    -- platform_whatsapp_log: dedupe de envios (phone, kind, store_id, day)
    create table if not exists public.platform_whatsapp_log (
      id uuid primary key default gen_random_uuid(),
      phone text not null,
      kind text not null,
      store_id uuid,
      sent_day date not null default (now() at time zone 'America/Sao_Paulo')::date,
      message text,
      status text default 'sent',
      error text,
      created_at timestamptz not null default now()
    );
    create unique index if not exists pwl_dedupe_idx
      on public.platform_whatsapp_log (phone, kind, coalesce(store_id::text,''), sent_day);
    grant select on public.platform_whatsapp_log to authenticated;
    grant all on public.platform_whatsapp_log to service_role;
    alter table public.platform_whatsapp_log enable row level security;
    do $$ begin
      if not exists (select 1 from pg_policies where tablename='platform_whatsapp_log' and policyname='pwl_admin_read') then
        create policy pwl_admin_read on public.platform_whatsapp_log for select to authenticated
          using (public.has_role(auth.uid(),'admin'));
      end if;
    end $$;

    -- store_plans: agenda de upgrade Essencial (grace period)
    alter table public.store_plans
      add column if not exists essencial_upgrade_scheduled_at timestamptz;

    -- admin_settings.support_whatsapp default (não sobrescreve se já existe)
    insert into public.admin_settings (key, value)
    select 'support_whatsapp', '{"number":"","link":""}'::jsonb
    where not exists (select 1 from public.admin_settings where key='support_whatsapp');

    -- platform_whatsapp_send_log: espelha whatsapp_send_log (sem store_id).
    -- Usado pela função platform-whatsapp-send para dedupe/throttle/limite diário.
    create table if not exists public.platform_whatsapp_send_log (
      id uuid primary key default gen_random_uuid(),
      phone text not null,
      kind text not null default 'generic',
      message_hash text,
      status text default 'sent',
      error text,
      sent_at timestamptz not null default now(),
      sent_bucket_min bigint generated always as ((extract(epoch from sent_at)/60)::bigint) stored
    );
    create unique index if not exists pwsl_dedupe_bucket_idx
      on public.platform_whatsapp_send_log (phone, kind, sent_bucket_min);
    create index if not exists pwsl_sent_at_idx
      on public.platform_whatsapp_send_log (sent_at desc);
    create index if not exists pwsl_phone_sent_idx
      on public.platform_whatsapp_send_log (phone, sent_at desc);
    grant select on public.platform_whatsapp_send_log to authenticated;
    grant all on public.platform_whatsapp_send_log to service_role;
    alter table public.platform_whatsapp_send_log enable row level security;
    do $$ begin
      if not exists (select 1 from pg_policies where tablename='platform_whatsapp_send_log' and policyname='pwsl_admin_read') then
        create policy pwsl_admin_read on public.platform_whatsapp_send_log for select to authenticated
          using (public.has_role(auth.uid(),'admin'));
      end if;
    end $$;
  `;
  try {
    return json(await runSql(sql));
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});