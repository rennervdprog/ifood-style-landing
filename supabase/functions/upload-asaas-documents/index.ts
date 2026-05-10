import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getBaseUrl(apiKey: string) {
  const isSandbox = !apiKey?.startsWith("$aact_prod_");
  return isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const contentType = req.headers.get("content-type") || "";

    const loadStore = async (storeId: string) => {
      const { data: store } = await supabase
        .from("stores")
        .select("id, owner_id, asaas_subaccount_api_key")
        .eq("id", storeId)
        .maybeSingle();
      if (!store) return { error: json({ error: "Loja não encontrada" }, 404) };
      if ((store as any).owner_id !== userId) return { error: json({ error: "Sem permissão" }, 403) };
      const apiKey = (store as any).asaas_subaccount_api_key as string | null;
      if (!apiKey) return { error: json({ error: "Subconta sem API key. Recrie a subconta." }, 400) };
      return { store, apiKey };
    };

    // ── List required documents (JSON) ────────────────────────────────
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { store_id, action } = body as { store_id: string; action?: string };
      if (!store_id) return json({ error: "store_id is required" }, 400);

      const loaded = await loadStore(store_id);
      if ("error" in loaded) return loaded.error;
      const { apiKey } = loaded;
      const baseUrl = getBaseUrl(apiKey);

      if (!action || action === "list") {
        const res = await fetch(`${baseUrl}/myAccount/documents`, {
          headers: { access_token: apiKey, "User-Agent": "ItaSuper/1.0" },
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("Asaas list documents error:", data);
          return json({ error: "Erro ao listar documentos", details: data }, 400);
        }
        return json({ success: true, documents: data });
      }

      return json({ error: "Ação inválida" }, 400);
    }

    // ── Upload single document (multipart) ────────────────────────────
    const formData = await req.formData();
    const storeId = formData.get("store_id") as string | null;
    const documentId = formData.get("document_id") as string | null;
    const documentType = formData.get("document_type") as string | null;
    const file = formData.get("file") as File | null;

    if (!storeId || !documentId || !file) {
      return json({ error: "store_id, document_id e file são obrigatórios" }, 400);
    }

    const loaded = await loadStore(storeId);
    if ("error" in loaded) return loaded.error;
    const { apiKey } = loaded;
    const baseUrl = getBaseUrl(apiKey);

    const upstreamForm = new FormData();
    upstreamForm.append("documentFile", file, file.name);
    if (documentType) upstreamForm.append("type", documentType);

    const res = await fetch(`${baseUrl}/myAccount/documents/${documentId}`, {
      method: "POST",
      headers: { access_token: apiKey, "User-Agent": "ItaSuper/1.0" },
      body: upstreamForm,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Asaas upload error:", data);
      return json({ error: "Falha ao enviar documento", details: data }, 400);
    }

    return json({ success: true, document: data });
  } catch (err) {
    console.error("upload-asaas-documents error:", err);
    return json({ error: String((err as any)?.message || err) }, 500);
  }
});