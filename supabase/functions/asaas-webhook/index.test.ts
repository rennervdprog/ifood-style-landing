import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1/asaas-webhook`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("OPTIONS retorna CORS", async () => {
  const r = await fetch(URL, { method: "OPTIONS" });
  await r.text();
  assertEquals(r.headers.get("access-control-allow-origin"), "*");
});

Deno.test("POST sem JWT é rejeitado pelo gateway (401)", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  await r.text();
  // webhook é público no Asaas mas o gateway exige JWT sem config explícito
  assertEquals(r.status, 401);
});