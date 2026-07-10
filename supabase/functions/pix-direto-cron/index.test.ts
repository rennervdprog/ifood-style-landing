import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// A função só existe funcionalmente no Supabase EXTERNO (RPCs pix estão lá).
const BASE = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL")!;
const KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const URL_ = `${BASE}/functions/v1/pix-direto-cron`;
const skip = !Deno.env.get("EXTERNAL_SUPABASE_URL");

Deno.test({ name: "pix-direto-cron responds ok", ignore: skip, fn: async () => {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const j = await r.json();
  assertEquals(r.status, 200);
  assertEquals(j.ok, true);
}});