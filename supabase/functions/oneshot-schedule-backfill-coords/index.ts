import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Agenda backfill-coords semanal (segunda 04:00 UTC / 01:00 BRT). Idempotente.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const accessToken = Deno.env.get('EXTERNAL_SUPABASE_ACCESS_TOKEN')!
    const ref = Deno.env.get('EXTERNAL_SUPABASE_PROJECT_REF')!
    const anonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!
    const cronSecret = Deno.env.get('EXTERNAL_CRON_SECRET') ?? anonKey
    const base = `https://${ref}.supabase.co`

    const sql = `
      create extension if not exists pg_cron;
      create extension if not exists pg_net;

      do $$ begin
        if exists (select 1 from cron.job where jobname = 'backfill-coords-weekly') then
          perform cron.unschedule('backfill-coords-weekly');
        end if;
      end $$;

      select cron.schedule(
        'backfill-coords-weekly',
        '0 4 * * 1',
        $cron$
          select net.http_post(
            url := '${base}/functions/v1/backfill-coords?limit=100&target=both',
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
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const text = await r.text()
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, status: r.status, body: text }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const verify = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `select jobname, schedule from cron.job where jobname='backfill-coords-weekly';`,
      }),
    })
    const jobs = await verify.json()

    return new Response(JSON.stringify({ ok: true, jobs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})