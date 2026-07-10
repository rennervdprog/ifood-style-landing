import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_ = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1/pix-direto-cron`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("pix-direto-cron responds ok", async () => {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const j = await r.json();
  assertEquals(r.status, 200);
  assertEquals(j.ok, true);
});