import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const URL = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1/calculate-delivery-distance`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("OPTIONS retorna CORS", async () => {
  const r = await fetch(URL, { method: "OPTIONS" });
  await r.text();
  assert(r.headers.get("access-control-allow-origin")?.includes("*") ?? false);
});

Deno.test("POST com body inválido retorna 400", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await r.json();
  assertEquals(r.status, 400);
  assertEquals(body.error, "invalid body");
});

Deno.test("POST com coords GPS calcula distância", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      store: { lat: -23.1067, lng: -48.6131 },
      customer: { lat: -23.1100, lng: -48.6200 },
    }),
  });
  const body = await r.json();
  assertEquals(r.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.accuracy, "gps");
  assert(typeof body.distanceKm === "number" && body.distanceKm >= 0);
});

Deno.test("POST sem coords resolvíveis retorna coords_unavailable", async () => {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      store: {},
      customer: {},
    }),
  });
  const body = await r.json();
  assertEquals(r.status, 200);
  assertEquals(body.ok, false);
  assertEquals(body.reason, "coords_unavailable");
});