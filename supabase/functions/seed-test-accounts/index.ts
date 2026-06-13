// Seed/Cleanup contas fake (lojistas, motoboys, clientes) no Supabase EXTERNO
// Marca stores com is_test=true e usa emails sandbox+<role><n>@itasuper.test
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TEST_EMAIL_DOMAIN = "itasuper.test";
const PASSWORD = "Sandbox#2026!";

const SEEDS = {
  lojistas: [
    { email: "sandbox+lojista1@itasuper.test", name: "Sandbox Burger", cnpj: "11222333000181", cat: "lanches" },
    { email: "sandbox+lojista2@itasuper.test", name: "Sandbox Pizza",  cnpj: "11444777000161", cat: "pizzas" },
    { email: "sandbox+lojista3@itasuper.test", name: "Sandbox Sushi",  cnpj: "19131243000197", cat: "japonesa" },
  ],
  motoboys: [
    { email: "sandbox+moto1@itasuper.test", name: "Sandbox Motoboy 1", cpf: "11144477735" },
    { email: "sandbox+moto2@itasuper.test", name: "Sandbox Motoboy 2", cpf: "52998224725" },
  ],
  clientes: [
    { email: "sandbox+cliente1@itasuper.test", name: "Sandbox Cliente 1", cpf: "03571712036" },
    { email: "sandbox+cliente2@itasuper.test", name: "Sandbox Cliente 2", cpf: "11122233396" },
  ],
};

const Body = z.object({ action: z.enum(["seed", "cleanup", "status"]) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, svc);

    const { data: u } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    // Verifica role admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Apenas admin pode rodar seed sandbox." }, 403);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Body inválido" }, 400);

    if (parsed.data.action === "status") {
      const { data: stores } = await admin
        .from("stores")
        .select("id, name, owner_id, status, is_test, asaas_wallet_id")
        .eq("is_test", true);
      return json({ ok: true, stores: stores ?? [] });
    }

    if (parsed.data.action === "cleanup") {
      const allEmails = [
        ...SEEDS.lojistas.map((s) => s.email),
        ...SEEDS.motoboys.map((s) => s.email),
        ...SEEDS.clientes.map((s) => s.email),
      ];
      const removed: string[] = [];
      for (const email of allEmails) {
        // Procura user pelo email
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list?.users?.find((x) => x.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          await admin.from("stores").delete().eq("owner_id", found.id);
          await admin.from("drivers").delete().eq("user_id", found.id);
          await admin.from("user_roles").delete().eq("user_id", found.id);
          await admin.from("profiles").delete().eq("user_id", found.id);
          await admin.auth.admin.deleteUser(found.id);
          removed.push(email);
        }
      }
      return json({ ok: true, removed });
    }

    // seed
    const created: any[] = [];

    const createUser = async (email: string, metadata: Record<string, unknown>) => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error && !`${error.message}`.toLowerCase().includes("already")) throw error;
      if (data?.user) return data.user;
      // já existia → busca
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      return list?.users?.find((x) => x.email?.toLowerCase() === email.toLowerCase()) ?? null;
    };

    // Lojistas
    for (const s of SEEDS.lojistas) {
      const user = await createUser(s.email, {
        full_name: s.name,
        role: "lojista",
        document: s.cnpj,
        store_name: s.name,
        store_category: s.cat,
        city: "Itatinga",
        cep: "18250000",
        street: "Rua Sandbox",
        address_number: "100",
        neighborhood: "Centro",
        whatsapp: "14999990000",
        phone: "14999990000",
        pix_type: "CNPJ",
        pix_key: s.cnpj,
        selected_plan: "starter",
      });
      if (!user) continue;
      // Marca loja como teste
      await admin
        .from("stores")
        .update({ is_test: true, status: "ativo", app_enabled: true })
        .eq("owner_id", user.id);
      created.push({ kind: "lojista", email: s.email, user_id: user.id });
    }

    // Motoboys
    for (const m of SEEDS.motoboys) {
      const user = await createUser(m.email, {
        full_name: m.name,
        role: "entregador",
        document: m.cpf,
      });
      if (!user) continue;
      // Garante linha em drivers
      await admin
        .from("drivers")
        .upsert(
          { user_id: user.id, name: m.name, is_active: true, is_online: false },
          { onConflict: "user_id" },
        );
      created.push({ kind: "motoboy", email: m.email, user_id: user.id });
    }

    // Clientes
    for (const c of SEEDS.clientes) {
      const user = await createUser(c.email, {
        full_name: c.name,
        role: "cliente",
        document: c.cpf,
      });
      if (!user) continue;
      created.push({ kind: "cliente", email: c.email, user_id: user.id });
    }

    return json({ ok: true, password: PASSWORD, domain: TEST_EMAIL_DOMAIN, created });
  } catch (err) {
    console.error("seed-test-accounts error:", err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});