// Oneshot: lista os cron jobs do Supabase externo.
Deno.serve(async () => {
  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `select jobname, schedule, active from cron.job order by jobname;
              `,
    }),
  });
  return new Response(await r.text(), { headers: { "Content-Type": "application/json" } });
});
