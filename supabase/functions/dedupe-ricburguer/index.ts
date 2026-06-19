// One-off: remove produtos duplicados da loja `ricburguer` no Supabase EXTERNO.
// Critério: mesma (store_id, section_id, name). Mantém o mais antigo (created_at).
// Limpa também as referências em product_addon_groups e order_items se houver FK.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;

async function runSql(query: string) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  let d: unknown = t;
  try { d = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(`SQL ${r.status}: ${t}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const dryRun = new URL(req.url).searchParams.get("dry") === "1";

    // 1) Localiza a loja
    const stores = await runSql(`SELECT id FROM public.stores WHERE slug='ricburguer' LIMIT 1`) as Array<{id:string}>;
    if (!stores?.length) return json({ error: "loja ricburguer não encontrada" }, 404);
    const storeId = stores[0].id;

    // 2) Identifica duplicados: mesmo (section_id, lower(name)), mantém o mais antigo
    const dupRows = await runSql(`
      WITH ranked AS (
        SELECT id, name, section_id, created_at,
               ROW_NUMBER() OVER (
                 PARTITION BY section_id, lower(btrim(name))
                 ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM public.products
        WHERE store_id = '${storeId}'
      )
      SELECT id, name, section_id FROM ranked WHERE rn > 1
    `) as Array<{id:string; name:string; section_id:string}>;

    if (!dupRows.length) return json({ ok: true, duplicates: 0, deleted: 0, message: "nenhum duplicado" });

    if (dryRun) return json({ ok: true, duplicates: dupRows.length, sample: dupRows.slice(0, 20), dryRun: true });

    const ids = dupRows.map(r => `'${r.id}'`).join(",");

    // 3) Limpa vínculos e remove os duplicados
    await runSql(`DELETE FROM public.product_addon_groups WHERE product_id IN (${ids})`);
    // addon_groups que pertencem a um produto duplicado (não-compartilhados)
    await runSql(`
      DELETE FROM public.addon_items
       WHERE group_id IN (SELECT id FROM public.addon_groups WHERE product_id IN (${ids}))
    `);
    await runSql(`DELETE FROM public.addon_groups WHERE product_id IN (${ids})`);
    const deleted = await runSql(`DELETE FROM public.products WHERE id IN (${ids}) RETURNING id`) as Array<{id:string}>;

    return json({ ok: true, duplicates: dupRows.length, deleted: deleted.length, sample: dupRows.slice(0, 20) });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});