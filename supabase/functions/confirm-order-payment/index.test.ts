import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1/confirm-order-payment`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("OPTIONS retorna CORS headers", async () => {
  const r = await fetch(URL, { method: "OPTIONS" });
  await r.text();
  assertEquals(r.headers.get("access-control-allow-origin"), "*");
});

Deno.test("sem Authorization retorna 401", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("Authorization inválido retorna 401", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: "Bearer invalid.jwt.token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await r.json();
  assertEquals(r.status, 401);
  assertEquals(body.error, "Unauthorized");
});
