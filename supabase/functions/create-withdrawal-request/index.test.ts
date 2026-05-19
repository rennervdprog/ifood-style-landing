import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1/create-withdrawal-request`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("OPTIONS retorna CORS", async () => {
  const r = await fetch(URL, { method: "OPTIONS" });
  await r.text();
  assertEquals(r.headers.get("access-control-allow-origin"), "*");
});

Deno.test("sem auth bloqueia a chamada", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 10 }),
  });
  await r.text();
  assert(r.status === 401 || r.status === 403, `esperado 401/403, recebido ${r.status}`);
});
