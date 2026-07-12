// Oneshot: expande platform_whatsapp_send_log para suportar histórico rico
// (category, store_id, store_name, preview) e cria RPCs de listagem/estatística.
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
    const t = await r.text(); let d: unknown = t; try { d = JSON.parse(t); } catch {}
    return { status: r.status, ok: r.ok, data: d };
  }

  const sql = `
    alter table public.platform_whatsapp_send_log
      add column if not exists category text,
      add column if not exists store_id uuid,
      add column if not exists store_name text,
      add column if not exists preview text;

    -- Backfill category a partir do kind existente
    update public.platform_whatsapp_send_log
       set category = case
         when kind like 'billing_%' then 'mensalidade'
         when kind like 'repasse_%' or kind = 'weekly_payout' then 'repasse'
         when kind = 'essencial_upgrade' or kind like 'essencial_%' then 'essencial'
         when kind = 'welcome' then 'boas-vindas'
         when kind = 'test' then 'teste'
         when kind = 'manual' then 'manual'
         else 'outros'
       end
     where category is null;

    create index if not exists idx_pwsl_category_sent_at
      on public.platform_whatsapp_send_log (category, sent_at desc);
    create index if not exists idx_pwsl_store_sent_at
      on public.platform_whatsapp_send_log (store_id, sent_at desc);

    -- RPC de listagem com filtros
    create or replace function public.list_platform_wa_log(
      p_category text default null,
      p_status text default null,
      p_store_id uuid default null,
      p_from timestamptz default null,
      p_to timestamptz default null,
      p_limit int default 50,
      p_offset int default 0
    ) returns table (
      id uuid,
      sent_at timestamptz,
      phone text,
      kind text,
      category text,
      status text,
      store_id uuid,
      store_name text,
      preview text,
      error text,
      total_count bigint
    )
    language sql
    security definer
    set search_path = public
    as $$
      with base as (
        select l.*
          from public.platform_whatsapp_send_log l
         where (p_category is null or l.category = p_category)
           and (p_status  is null or l.status  = p_status)
           and (p_store_id is null or l.store_id = p_store_id)
           and (p_from is null or l.sent_at >= p_from)
           and (p_to   is null or l.sent_at <= p_to)
      ), counted as (select count(*)::bigint as total_count from base)
      select b.id, b.sent_at, b.phone, b.kind, b.category, b.status,
             b.store_id, b.store_name, b.preview, b.error,
             (select total_count from counted) as total_count
        from base b
       order by b.sent_at desc
       limit greatest(1, least(coalesce(p_limit,50), 200))
      offset greatest(0, coalesce(p_offset,0));
    $$;

    revoke all on function public.list_platform_wa_log(text,text,uuid,timestamptz,timestamptz,int,int) from public;
    grant execute on function public.list_platform_wa_log(text,text,uuid,timestamptz,timestamptz,int,int) to authenticated, service_role;

    -- RPC de estatísticas resumidas
    create or replace function public.platform_wa_stats()
    returns jsonb
    language sql
    security definer
    set search_path = public
    as $$
      select jsonb_build_object(
        'today',    (select count(*) from public.platform_whatsapp_send_log where sent_at >= date_trunc('day', now()) and status='sent'),
        'week',     (select count(*) from public.platform_whatsapp_send_log where sent_at >= now() - interval '7 days' and status='sent'),
        'month',    (select count(*) from public.platform_whatsapp_send_log where sent_at >= now() - interval '30 days' and status='sent'),
        'errors_7d',(select count(*) from public.platform_whatsapp_send_log where sent_at >= now() - interval '7 days' and status='error'),
        'by_category_30d', (
          select coalesce(jsonb_object_agg(category, c),'{}'::jsonb) from (
            select coalesce(category,'outros') as category, count(*) as c
              from public.platform_whatsapp_send_log
             where sent_at >= now() - interval '30 days' and status='sent'
             group by 1
          ) t
        )
      );
    $$;
    revoke all on function public.platform_wa_stats() from public;
    grant execute on function public.platform_wa_stats() to authenticated, service_role;
  `;

  const r = await runSql(sql);
  return json(r, r.ok ? 200 : 500);
});