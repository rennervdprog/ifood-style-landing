const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const projectRef = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF");
    const accessToken = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");

    if (!externalUrl || !serviceKey || !projectRef || !accessToken) {
      return json({ error: "Configuração do backend externo ausente" }, 500);
    }

    const createBucket = await fetch(`${externalUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "store-assets",
        name: "store-assets",
        public: true,
        file_size_limit: 5 * 1024 * 1024,
        allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
      }),
    });

    const bucketText = await createBucket.text();
    const bucketAlreadyExists = /already exists|Duplicate|violates unique/i.test(bucketText);
    if (!createBucket.ok && !bucketAlreadyExists) {
      return json({ error: "Falha ao criar bucket", status: createBucket.status, response: bucketText }, 500);
    }

    const policySql = `
drop policy if exists "Anyone can view store assets" on storage.objects;
drop policy if exists "Anyone can view store assets by path" on storage.objects;
drop policy if exists "Users can upload store assets" on storage.objects;
drop policy if exists "Users can update own store assets" on storage.objects;
drop policy if exists "Users can delete own store assets" on storage.objects;

create policy "Anyone can view store assets by path"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'store-assets' and name is not null and name <> '');

create policy "Users can upload store assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'store-assets' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can update own store assets"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'store-assets' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'store-assets' and split_part(name, '/', 1) = auth.uid()::text);

create policy "Users can delete own store assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'store-assets' and split_part(name, '/', 1) = auth.uid()::text);
`;

    const policies = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: policySql }),
    });
    const policiesText = await policies.text();
    if (!policies.ok) {
      return json({ error: "Falha ao configurar permissões", status: policies.status, response: policiesText }, 500);
    }

    const pngBytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lxK3yQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const testPath = `setup/store-assets-${Date.now()}.png`;
    const testUpload = await fetch(`${externalUrl}/storage/v1/object/store-assets/${testPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "image/png",
        "x-upsert": "true",
      },
      body: pngBytes,
    });

    return json({
      success: createBucket.ok || bucketAlreadyExists,
      bucket: { status: createBucket.status, response: bucketText },
      policies: { status: policies.status, response: policiesText },
      upload_test: { status: testUpload.status, response: await testUpload.text() },
      public_url: `${externalUrl}/storage/v1/object/public/store-assets/${testPath}`,
    });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});