// Cron: (1) expira pedidos aguardando_comprovante > 20 min,
// (2) limpa comprovantes de pedidos recusados > 7 dias.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1) Expirar aguardando_comprovante
  const { data: expired, error: expErr } = await admin.rpc("expire_pending_pix_orders");
  if (expErr) return json({ error: expErr.message }, 500);

  // 2) Buscar comprovantes recusados antigos
  const { data: rows, error: cleanErr } = await admin.rpc("cleanup_refused_pix_proofs");
  if (cleanErr) return json({ error: cleanErr.message }, 500);

  let removed = 0;
  const paths: string[] = (rows ?? []).map((r: any) => r.proof_path).filter(Boolean);
  if (paths.length) {
    const { data: rm } = await admin.storage.from("pix-proofs").remove(paths);
    removed = rm?.length ?? 0;
    const ids = (rows ?? []).map((r: any) => r.order_id).filter(Boolean);
    if (ids.length) {
      await admin.from("orders").update({ pix_proof_url: null }).in("id", ids);
    }
  }

  return json({ ok: true, expired, cleaned: removed });
});