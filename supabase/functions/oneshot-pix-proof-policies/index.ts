const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sql = `
-- Allow authenticated client (order owner) to upload/update their own PIX proof
DROP POLICY IF EXISTS "pix_proofs_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "pix_proofs_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "pix_proofs_owner_select" ON storage.objects;

CREATE POLICY "pix_proofs_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pix-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(split_part(name, '/', 2), '.', 1)
      AND o.client_id = auth.uid()
      AND o.payment_method = 'pix_direto'
      AND o.status IN ('aguardando_comprovante','comprovante_enviado','pix_direto_recusado')
  )
);

CREATE POLICY "pix_proofs_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'pix-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(split_part(name, '/', 2), '.', 1)
      AND o.client_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'pix-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(split_part(name, '/', 2), '.', 1)
      AND o.client_id = auth.uid()
  )
);

CREATE POLICY "pix_proofs_owner_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pix-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(split_part(name, '/', 2), '.', 1)
      AND (o.client_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = o.store_id AND s.owner_id = auth.uid()))
  )
);
`;
  const out = await q(sql);
  const check = await q(`SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'pix_proofs%';`);
  return new Response(JSON.stringify({ out, check }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});