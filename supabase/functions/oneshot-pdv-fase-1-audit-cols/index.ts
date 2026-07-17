// One-shot Fase 1 — trilha por operador PIN + categoria canônica de movimentações.
// Idempotente: pode rodar quantas vezes precisar.
// Aplica no Supabase EXTERNO via Management API.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, ok: r.ok, body: await r.text() };
}

const SQL = `
-- Trilha por operador PIN (Fase 1, item 3)
ALTER TABLE public.pdv_sessions
  ADD COLUMN IF NOT EXISTS opened_by_operator_id uuid;
ALTER TABLE public.pdv_movements
  ADD COLUMN IF NOT EXISTS operator_id uuid;
CREATE INDEX IF NOT EXISTS pdv_sessions_operator_idx
  ON public.pdv_sessions (opened_by_operator_id) WHERE opened_by_operator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pdv_movements_operator_idx
  ON public.pdv_movements (operator_id) WHERE operator_id IS NOT NULL;

-- Categoria canônica de movimentação (Fase 1, item 5)
ALTER TABLE public.pdv_movements
  ADD COLUMN IF NOT EXISTS reason_category text;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pdv_movements_reason_category_chk'
  ) THEN
    ALTER TABLE public.pdv_movements
      ADD CONSTRAINT pdv_movements_reason_category_chk
      CHECK (
        reason_category IS NULL OR reason_category IN (
          'troco_inicial','reforco_troco','deposito',
          'cofre','despesa','fornecedor','retirada_dono','outro'
        )
      ) NOT VALID;
  END IF;
END $$;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const r = await run(SQL);
    return new Response(JSON.stringify({ ok: r.ok, status: r.status, body: r.body }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});