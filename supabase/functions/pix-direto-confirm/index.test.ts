import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL_ = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1/pix-direto-confirm`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("pix-direto-confirm rejects missing auth", async () => {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ order_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const j = await r.json();
  assertEquals(r.status, 401);
  assertEquals(j.error, "unauthorized");
});

Deno.test("pix-direto-confirm rejects invalid order_id", async () => {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ order_id: "not-a-uuid" }),
  });
  const j = await r.json();
  assertEquals(r.status, 400);
  assertEquals(j.error, "invalid_order_id");
});