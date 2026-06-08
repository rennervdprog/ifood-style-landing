/**
 * deploy-to-external
 *
 * Pega o código de uma edge function do projeto Lovable e faz upload
 * (deploy) no projeto Supabase EXTERNO via Management API.
 *
 * Body: { functions: string[], verify_jwt?: boolean }
 * Header opcional: x-deploy-secret (compara com DEPLOY_TO_EXTERNAL_SECRET)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-deploy-secret",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");
const PROJECT_REF =
  Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

// Lê o código-fonte da função a partir do filesystem do edge runtime.
// As funções deployadas no Lovable Cloud trazem seu próprio bundle, mas
// não os arquivos das outras funções. Por isso, este endpoint aceita
// receber o `code` direto no body também (modo passthrough).
async function readLocalFunction(slug: string): Promise<string | null> {
  const candidates = [
    `/home/deno/functions/${slug}/index.ts`,
    `./${slug}/index.ts`,
    `../${slug}/index.ts`,
  ];
  for (const p of candidates) {
    try {
      return await Deno.readTextFile(p);
    } catch {
      // try next
    }
  }
  return null;
}

async function deployOne(
  slug: string,
  code: string,
  verifyJwt: boolean,
): Promise<Record<string, unknown>> {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(slug)}`;
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify({ name: slug, entrypoint_path: "index.ts", verify_jwt: verifyJwt })], {
      type: "application/json",
    }),
  );
  form.append("file", new File([code], "index.ts", { type: "application/typescript" }));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
    body: form,
  });

  const body = await res.text();
  let parsed: unknown = body;
  try {
    parsed = JSON.parse(body);
  } catch {
    /* keep text */
  }

  return {
    slug,
    method: "POST multipart deploy",
    status: res.status,
    ok: res.ok,
    response: parsed,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!TOKEN) return json({ error: "EXTERNAL_SUPABASE_ACCESS_TOKEN not configured" }, 500);

  const expectedSecret = Deno.env.get("DEPLOY_TO_EXTERNAL_SECRET");
  if (expectedSecret) {
    const got = req.headers.get("x-deploy-secret") || "";
    if (got !== expectedSecret) return json({ error: "Forbidden" }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const verifyJwt = body?.verify_jwt === true; // padrão false (público)

  // Modo 1: passthrough — caller envia { slug, code }
  if (typeof body?.slug === "string" && typeof body?.code === "string") {
    const r = await deployOne(body.slug, body.code, verifyJwt);
    return json(r, r.ok ? 200 : 500);
  }

  // Modo 2: lista de slugs — tenta ler do filesystem local
  const slugs: string[] = Array.isArray(body?.functions) ? body.functions : [];
  if (slugs.length === 0) {
    return json({ error: "Provide { functions: [...] } or { slug, code }" }, 400);
  }

  const results: Record<string, unknown>[] = [];
  for (const slug of slugs) {
    const code = await readLocalFunction(slug);
    if (!code) {
      results.push({ slug, error: "source_not_found_in_runtime" });
      continue;
    }
    try {
      results.push(await deployOne(slug, code, verifyJwt));
    } catch (e) {
      results.push({ slug, error: String(e) });
    }
  }

  return json({ project_ref: PROJECT_REF, results });
});