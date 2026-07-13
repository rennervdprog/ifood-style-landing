import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async () => {
  const admin = createClient(Deno.env.get("EXTERNAL_SUPABASE_URL")!, Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!);
  const { data: list } = await admin.from("stores").select("*").ilike("name","%pastel%").limit(5);
  const s: any = list?.[0];
  const { data: nf } = s ? await admin.from("neighborhood_fees").select("*").eq("store_id", s.id) : { data: null } as any;
  return new Response(JSON.stringify({ store: s, neighborhood_fees: nf, count: list?.length }, null, 2), { headers: { "Content-Type": "application/json" }});
});
