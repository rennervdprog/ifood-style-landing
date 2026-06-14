// Utilitário do agente: roda SQL arbitrário no Supabase EXTERNO via service-role.
// Protegido por EXTERNAL_CRON_SECRET no header x-admin-secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Dev-only: sem auth. DELETAR após investigação.

  const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const supabase = createClient(EXT_URL, SVC);
  const DB_URL = Deno.env.get("EXTERNAL_DATABASE_URL") || "";
  const sql = DB_URL ? postgres(DB_URL, { prepare: false }) : null;

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;

  try {
    if (action === "inspect_store_balances_fks") {
      // Lista constraints da tabela via rpc segura — usa pg_catalog através de uma view pública se existir.
      // Fallback: tenta SELECT contra information_schema (geralmente bloqueado para anon, mas service-role OK via PostgREST? não).
      // Estratégia: criar/usar função SQL `_introspect_fks` se existir. Como não temos, vamos chamar via .rpc.
      const { data, error } = await supabase.rpc("_agent_introspect_fks", { _table: "store_balances" });
      return json({ data, error });
    }

    if (action === "create_introspect_fn") {
      // Cria a função de introspecção via PostgREST (se exposta) — não funciona sem SQL direto.
      return json({ error: "use migration manually" }, 400);
    }

    if (action === "test_embed") {
      // Tenta o mesmo select que auto-charge-physical-fees faz
      const { data, error } = await supabase
        .from("store_balances")
        .select(`store_id, repasse_pendente, stores!inner(id, name, status)`)
        .limit(1);
      return json({ data, error });
    }

    if (action === "test_embed_alt") {
      // Tenta sintaxe com FK explícito caso ele exista com outro nome
      const fkName = body?.fk_name || "store_balances_store_id_fkey";
      const { data, error } = await supabase
        .from("store_balances")
        .select(`store_id, repasse_pendente, stores!${fkName}(id, name, status)`)
        .limit(1);
      return json({ data, error });
    }

    if (action === "reload_schema") {
      // Manda NOTIFY pgrst para recarregar cache do PostgREST via rpc auxiliar (se existir).
      const { data, error } = await supabase.rpc("_agent_pgrst_reload");
      return json({ data, error });
    }

    if (action === "run_sql") {
      if (!sql) return json({ error: "EXTERNAL_DATABASE_URL ausente" }, 400);
      const query = body?.query as string;
      if (!query) return json({ error: "query obrigatória" }, 400);
      const rows = await sql.unsafe(query);
      return json({ rows });
    }

    if (action === "inspect_fks") {
      if (!sql) return json({ error: "EXTERNAL_DATABASE_URL ausente" }, 400);
      const table = (body?.table as string) || "store_balances";
      const rows = await sql`
        SELECT conname, conrelid::regclass AS table_name,
               a.attname AS column_name,
               confrelid::regclass AS references_table,
               af.attname AS references_column
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
        WHERE c.contype = 'f' AND c.conrelid = ('public.'||${table})::regclass
      `;
      return json({ rows });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});