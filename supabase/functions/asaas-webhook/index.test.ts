import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1/asaas-webhook`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("OPTIONS retorna CORS", async () => {
  const r = await fetch(URL, { method: "OPTIONS" });
  await r.text();
  assertEquals(r.headers.get("access-control-allow-origin"), "*");
});

Deno.test("POST com JSON inválido retorna 400", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: "not-json",
  });
  const body = await r.json();
  assertEquals(r.status, 400);
  assertEquals(body.error, "Invalid JSON");
});

Deno.test("POST sem event/payment é ignorado com ok:true", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await r.json();
  assertEquals(r.status, 200);
  assertEquals(body.ok, true);
});