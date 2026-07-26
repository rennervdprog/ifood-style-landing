const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type AppMode = "cliente" | "parceiro";

function detectMode(payload: Record<string, unknown>): AppMode {
  const appId = String(payload.app_id || payload.appId || payload.appID || "").toLowerCase();
  const channel = String(payload.defaultChannel || payload.channel || "").toLowerCase();
  if (appId.includes("parceiro") || appId.includes("partner") || channel.includes("parceiro")) {
    return "parceiro";
  }
  return "cliente";
}

function currentVersion(payload: Record<string, unknown>): string {
  return String(
    payload.version_name ||
      payload.versionName ||
      payload.currentVersion ||
      payload.version ||
      "",
  );
}

function compareVersions(a: string, b: string): number {
  const parse = (value: string) => value.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

async function readManifest(baseUrl: string, mode: AppMode) {
  const manifestPath = `manifest-${mode}.json`;
  const url = `${baseUrl}/storage/v1/object/public/app-releases/${manifestPath}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  });

  if (!res.ok) {
    throw new Error(`Manifest ${manifestPath} indisponível (${res.status})`);
  }

  const manifest = await res.json();
  if (!manifest?.version || !manifest?.url) {
    throw new Error(`Manifest ${manifestPath} inválido`);
  }

  return manifest;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const baseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || "https://qkjhguziuchqsbxzruea.supabase.co";
    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "missing_storage_base", message: "OTA storage não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch {
        payload = {};
      }
    } else {
      const url = new URL(req.url);
      payload = Object.fromEntries(url.searchParams.entries());
    }

    const mode = detectMode(payload);
    const manifest = await readManifest(baseUrl, mode);
    const installed = currentVersion(payload);

    if (installed && compareVersions(installed, manifest.version) >= 0) {
      return new Response(
        JSON.stringify({
          kind: "up_to_date",
          error: "no_new_version_available",
          message: "No new version available",
          version: manifest.version,
          statusCode: 200,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        },
      );
    }

    return new Response(JSON.stringify({ ...manifest, statusCode: 200 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        kind: "failed",
        error: "ota_manifest_error",
        message: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  }
});