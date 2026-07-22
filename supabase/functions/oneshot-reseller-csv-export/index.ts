import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const EXT_SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
const EXT_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "no_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Verify admin
    const asUser = createClient(EXT_URL, EXT_ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes } = await asUser.auth.getUser(token);
    if (!userRes?.user) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const svc = createClient(EXT_URL, EXT_SVC);
    const { data: isAdmin } = await svc.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "not_admin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = new URL(req.url);
    const month = url.searchParams.get("month"); // YYYY-MM (opcional)
    const onlyPending = (url.searchParams.get("status") ?? "pending") === "pending";

    let q = svc.from("commissions" as any).select("id, reseller_id, kind, amount_cents, status, reference_month, created_at, resellers:reseller_id(code, email, pix_key, pix_key_type)");
    if (onlyPending) q = q.eq("status", "pending");
    if (month) q = q.eq("reference_month", `${month}-01`);
    const { data: rows, error } = await q.order("reseller_id");
    if (error) throw error;

    // Aggregate por revendedor
    const agg = new Map<string, { code: string; email: string; pix: string; pix_type: string; bounty: number; recurring: number; other: number; total: number; count: number }>();
    for (const r of (rows ?? []) as any[]) {
      const rs = r.resellers ?? {};
      const key = r.reseller_id;
      const cur = agg.get(key) ?? { code: rs.code ?? "", email: rs.email ?? "", pix: rs.pix_key ?? "", pix_type: rs.pix_key_type ?? "", bounty: 0, recurring: 0, other: 0, total: 0, count: 0 };
      const amt = Number(r.amount_cents) || 0;
      if (r.kind === "bounty") cur.bounty += amt;
      else if (r.kind === "recurring") cur.recurring += amt;
      else cur.other += amt;
      cur.total += amt;
      cur.count += 1;
      agg.set(key, cur);
    }

    const header = ["reseller_id","code","email","pix_key_type","pix_key","commissions_count","bounty_brl","recurring_brl","other_brl","total_brl"];
    const lines = [header.join(";")];
    for (const [id, v] of agg.entries()) {
      lines.push([id, v.code, v.email, v.pix_type, v.pix, v.count, (v.bounty/100).toFixed(2), (v.recurring/100).toFixed(2), (v.other/100).toFixed(2), (v.total/100).toFixed(2)].map(csvEscape).join(";"));
    }
    const csv = "\uFEFF" + lines.join("\n"); // BOM p/ Excel
    const filename = `revendedores_${month ?? "todos"}_${onlyPending ? "pendentes" : "all"}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Reseller-Count": String(agg.size),
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
