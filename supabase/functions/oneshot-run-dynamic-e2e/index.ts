// oneshot: invokes e2e-dynamic-upgrade-flow for both plans using env secret.
Deno.serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secret = Deno.env.get("E2E_ADMIN_SECRET") || "";
  const results: any[] = [];
  for (const plan_type of ["fixed", "autonomy"] as const) {
    const r = await fetch(`${url}/functions/v1/e2e-dynamic-upgrade-flow`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-e2e-secret": secret },
      body: JSON.stringify({ plan_type }),
    });
    results.push({ plan_type, status: r.status, body: await r.json().catch(() => ({})) });
  }
  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});