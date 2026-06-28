// Auditoria de desempenho via Vercel API. Usa VERCEL_API_TOKEN.
// Actions: list_projects | project_info | deployments | logs | analytics
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TOKEN = Deno.env.get("VERCEL_API_TOKEN");

async function v(path: string, teamId?: string) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const t = await r.text();
  let d: unknown = t;
  try { d = JSON.parse(t); } catch {}
  return { status: r.status, ok: r.ok, data: d };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!TOKEN) return json({ error: "VERCEL_API_TOKEN not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const action = body?.action || "list_projects";
  const teamId = body?.teamId;

  if (action === "teams") return json(await v("/v2/teams"));
  if (action === "user") return json(await v("/v2/user"));
  if (action === "list_projects") return json(await v("/v9/projects?limit=20", teamId));
  if (action === "project_info") return json(await v(`/v9/projects/${body.projectId}`, teamId));
  if (action === "deployments") return json(await v(`/v6/deployments?projectId=${body.projectId}&limit=10`, teamId));
  if (action === "logs") return json(await v(`/v2/deployments/${body.deploymentId}/events`, teamId));
  if (action === "domains") return json(await v(`/v9/projects/${body.projectId}/domains`, teamId));

  return json({ error: "unknown action" }, 400);
});