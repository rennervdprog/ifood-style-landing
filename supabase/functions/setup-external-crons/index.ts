import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const accessToken = Deno.env.get('EXTERNAL_SUPABASE_ACCESS_TOKEN')!
    const ref = Deno.env.get('EXTERNAL_SUPABASE_PROJECT_REF')!
    const serviceKey =
      Deno.env.get('EXTERNAL_SERVICE_ROLE_KEY') ??
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY')!
    const anonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!
    const cronSecret = Deno.env.get('EXTERNAL_CRON_SECRET')!
    const base = `https://${ref}.supabase.co`

    const sql = `
      create extension if not exists pg_cron;
      create extension if not exists pg_net;

      do $$ begin
        if exists (select 1 from cron.job where jobname = 'weekly-platform-report') then
          perform cron.unschedule('weekly-platform-report');
        end if;
        if exists (select 1 from cron.job where jobname = 'auto-withdraw-asaas-daily') then
          perform cron.unschedule('auto-withdraw-asaas-daily');
        end if;
        if exists (select 1 from cron.job where jobname = 'auto-charge-physical-fees-monday') then
          perform cron.unschedule('auto-charge-physical-fees-monday');
        end if;
        if exists (select 1 from cron.job where jobname = 'evolution-keepalive-3min') then
          perform cron.unschedule('evolution-keepalive-3min');
        end if;
        if exists (select 1 from cron.job where jobname = 'billing-reminders-daily') then
          perform cron.unschedule('billing-reminders-daily');
        end if;
      end $$;

      select cron.schedule(
        'weekly-platform-report',
        '0 9 * * 1',
        $cron$
          select net.http_post(
            url := '${base}/functions/v1/weekly-platform-report',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'apikey','${anonKey}',
              'Authorization','Bearer ${cronSecret}'
            ),
            body := '{}'::jsonb
          );
        $cron$
      );

      select cron.schedule(
        'auto-withdraw-asaas-daily',
        '0 19 * * *',
        $cron$
          select net.http_post(
            url := '${base}/functions/v1/auto-withdraw-subaccounts',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'apikey','${anonKey}',
              'Authorization','Bearer ${cronSecret}'
            ),
            body := '{}'::jsonb
          );
        $cron$
      );

      -- Cobrança automática de taxas físicas (delivery/PDV) toda segunda 09:30 BRT (12:30 UTC)
      select cron.schedule(
        'auto-charge-physical-fees-monday',
        '30 12 * * 1',
        $cron$
          select net.http_post(
            url := '${base}/functions/v1/auto-charge-physical-fees',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'apikey','${anonKey}',
              'Authorization','Bearer ${cronSecret}'
            ),
            body := '{}'::jsonb
          );
        $cron$
      );

      -- Mantém sessões Evolution/WhatsApp vivas no backend externo: a cada 3 min
      -- valida conexão e repara webhook vazio/desconfigurado de qualquer instância.
      select cron.schedule(
        'evolution-keepalive-3min',
        '*/3 * * * *',
        $cron$
          select net.http_post(
            url := '${base}/functions/v1/evolution-keepalive',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'apikey','${anonKey}',
              'Authorization','Bearer ${anonKey}'
            ),
            body := '{}'::jsonb
          );
        $cron$
      );

      -- Lembretes de mensalidade (D-3, D-1, D+1, D+3) — 11:00 UTC (08:00 BRT).
      select cron.schedule(
        'billing-reminders-daily',
        '0 11 * * *',
        $cron$
          select net.http_post(
            url := '${base}/functions/v1/billing-reminders',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'apikey','${anonKey}',
              'Authorization','Bearer ${cronSecret}'
            ),
            body := '{}'::jsonb
          );
        $cron$
      );
    `

    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    })
    const text = await r.text()
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, status: r.status, body: text }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const verify = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `select jobname, schedule from cron.job where jobname in ('weekly-platform-report','auto-withdraw-asaas-daily','auto-charge-physical-fees-monday','evolution-keepalive-3min','billing-reminders-daily') order by jobname;`,
      }),
    })
    const jobs = await verify.json()

    return new Response(JSON.stringify({ ok: true, jobs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})