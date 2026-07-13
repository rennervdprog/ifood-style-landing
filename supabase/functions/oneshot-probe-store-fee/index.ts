import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async () => {
  const admin = createClient(Deno.env.get("EXTERNAL_SUPABASE_URL")!, Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!);
  const { data: s } = await admin.from("stores").select("id,name,delivery_mode,delivery_fee_type,own_delivery_fee,delivery_fee,delivery_fee_base,fee_per_km,min_delivery_fee").ilike("name","%pastel%carioca%").maybeSingle();
  const { data: nf } = s ? await admin.from("neighborhood_fees").select("*").eq("store_id", s.id) : { data: null } as any;
  return new Response(JSON.stringify({ store: s, neighborhood_fees: nf }, null, 2), { headers: { "Content-Type": "application/json" }});
});
