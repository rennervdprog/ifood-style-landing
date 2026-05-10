import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * 🔒 Gera senha aleatória forte para cada usuário migrado.
 * Cada conta recebe uma senha única que precisa ser resetada via "Esqueci minha senha".
 * Isso evita que qualquer pessoa que veja o código consiga logar nas contas migradas.
 */
function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  let password = "";
  const randomValues = new Uint8Array(24);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 24; i++) {
    password += chars[randomValues[i] % chars.length];
  }
  return password;
}

const TABLES: { table: string; conflictKey: string | null }[] = [
  { table: "profiles", conflictKey: "user_id" },
  { table: "user_roles", conflictKey: null },
  { table: "drivers", conflictKey: "user_id" },
  { table: "stores", conflictKey: "id" },
  { table: "store_plans", conflictKey: "store_id" },
  { table: "opening_hours", conflictKey: null },
  { table: "menu_sections", conflictKey: "id" },
  { table: "products", conflictKey: "id" },
  { table: "addon_groups", conflictKey: "id" },
  { table: "addon_items", conflictKey: "id" },
  { table: "product_addon_groups", conflictKey: null },
  { table: "store_drivers", conflictKey: null },
  { table: "promo_banners", conflictKey: "id" },
  { table: "coupons", conflictKey: "id" },
  { table: "user_addresses", conflictKey: "id" },
  { table: "orders", conflictKey: "id" },
  { table: "order_items", conflictKey: "id" },
  { table: "order_ratings", conflictKey: "id" },
  { table: "order_messages", conflictKey: "id" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cloudUrl = Deno.env.get("SUPABASE_URL")!;
    const cloudKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;

    if (!cloudUrl || !cloudKey || !extUrl || !extKey) {
      return new Response(
        JSON.stringify({ error: "Missing env vars (cloud or external)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cloud = createClient(cloudUrl, cloudKey, { auth: { persistSession: false } });
    const ext = createClient(extUrl, extKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = !!body?.dryRun;
    const onlyAuth: boolean = !!body?.onlyAuth;
    const onlyTables: string[] | null = Array.isArray(body?.tables) ? body.tables : null;

    const report: Record<string, any> = {
      dryRun,
      auth: { migrated: 0, skipped_existing: 0, errors: [] as string[] },
      tables: {} as Record<string, { copied: number; skipped: number; errors: string[] }>,
    };

    // 1) Migrate auth users
    console.log("[migrate] Listing cloud auth users...");
    const cloudUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await cloud.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`listUsers cloud: ${error.message}`);
      if (!data?.users?.length) break;
      cloudUsers.push(...data.users);
      if (data.users.length < 1000) break;
      page++;
    }
    console.log(`[migrate] Cloud has ${cloudUsers.length} auth users`);

    // Map existing emails on external -> userId
    const existingEmailToId = new Map<string, string>();
    let extPage = 1;
    while (true) {
      const { data, error } = await ext.auth.admin.listUsers({ page: extPage, perPage: 1000 });
      if (error) throw new Error(`listUsers external: ${error.message}`);
      if (!data?.users?.length) break;
      for (const u of data.users) {
        if (u.email) existingEmailToId.set(u.email.toLowerCase(), u.id);
      }
      if (data.users.length < 1000) break;
      extPage++;
    }
    console.log(`[migrate] External already has ${existingEmailToId.size} users`);

    const userIdMap = new Map<string, string>();

    for (const u of cloudUsers) {
      const email = u.email?.toLowerCase();
      if (!email) continue;

      const existingId = existingEmailToId.get(email);
      if (existingId) {
        userIdMap.set(u.id, existingId);
        report.auth.skipped_existing++;
        continue;
      }

      if (dryRun) {
        report.auth.migrated++;
        continue;
      }

      try {
        // 🔒 Cada usuário recebe senha única e aleatória
        // Eles precisarão usar "Esqueci minha senha" para acessar pela primeira vez
        const securePassword = generateSecurePassword();
        const { data: created, error } = await ext.auth.admin.createUser({
          email,
          password: securePassword,
          email_confirm: true,
          user_metadata: {
            ...(u.user_metadata || {}),
            migrated_from_cloud: true,
            original_user_id: u.id,
            requires_password_reset: true,
          },
        });
        if (error) throw error;
        if (created?.user) {
          userIdMap.set(u.id, created.user.id);
          report.auth.migrated++;
        }
      } catch (e: any) {
        report.auth.errors.push(`${email}: ${e.message}`);
      }
    }

    if (onlyAuth) {
      return new Response(JSON.stringify(report), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Copy tables
    const remap = (row: any) => {
      const out = { ...row };
      for (const k of Object.keys(out)) {
        const v = out[k];
        if (typeof v === "string" && userIdMap.has(v)) {
          out[k] = userIdMap.get(v);
        }
      }
      return out;
    };

    for (const t of TABLES) {
      if (onlyTables && !onlyTables.includes(t.table)) continue;
      const tReport = { copied: 0, skipped: 0, errors: [] as string[] };
      report.tables[t.table] = tReport;

      let from = 0;
      const PAGE = 1000;
      const allRows: any[] = [];
      while (true) {
        const { data, error } = await cloud
          .from(t.table)
          .select("*")
          .range(from, from + PAGE - 1);
        if (error) {
          tReport.errors.push(`fetch: ${error.message}`);
          break;
        }
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      console.log(`[migrate] ${t.table}: fetched ${allRows.length} rows`);

      if (dryRun) {
        tReport.copied = allRows.length;
        continue;
      }

      const rowsRemapped = allRows.map((r) => {
        const x = remap(r);
        if (t.table === "profiles") {
          x.migrated_from_cloud = true;
          x.migration_temp_password = true;
        }
        return x;
      });

      const CHUNK = 200;
      for (let i = 0; i < rowsRemapped.length; i += CHUNK) {
        const chunk = rowsRemapped.slice(i, i + CHUNK);
        const { error } = await ext.from(t.table).upsert(chunk, {
          onConflict: t.conflictKey || undefined,
          ignoreDuplicates: true,
        });
        if (error) {
          for (const row of chunk) {
            const { error: e2 } = await ext.from(t.table).upsert([row], {
              onConflict: t.conflictKey || undefined,
              ignoreDuplicates: true,
            });
            if (e2) {
              tReport.errors.push(`row ${row.id || JSON.stringify(row).slice(0, 80)}: ${e2.message}`);
              tReport.skipped++;
            } else {
              tReport.copied++;
            }
          }
        } else {
          tReport.copied += chunk.length;
        }
      }
    }

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[migrate] fatal:", e);
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
