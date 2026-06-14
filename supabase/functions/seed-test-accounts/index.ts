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

// Gera CPF/CNPJ válidos (com dígitos verificadores) e aleatórios,
// evitando conflito de "CNPJ já em uso" em subcontas Asaas.
function calcDV(nums: number[], weights: number[]): number {
  const sum = nums.reduce((a, n, i) => a + n * weights[i], 0);
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}
function genCPF(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const d1 = calcDV(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDV([...base, d1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join("");
}
function genCNPJ(): string {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1]);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  const d1 = calcDV(base, w1);
  const d2 = calcDV([...base, d1], w2);
  return [...base, d1, d2].join("");
}

const SEEDS = {
  lojistas: [
    { email: "sandbox+lojista1@itasuper.test", name: "Sandbox Burger", cnpj: "11222333000181", cat: "lanches",
      products: [
        { name: "Sandbox Burger Clássico", price: 25.9, description: "Pão, blend 150g, queijo, alface, tomate" },
        { name: "Sandbox Cheese Bacon", price: 32.5, description: "Blend 180g, cheddar, bacon crocante" },
        { name: "Sandbox Batata Frita", price: 14.0, description: "Porção 300g" },
      ] },
    { email: "sandbox+lojista2@itasuper.test", name: "Sandbox Pizza",  cnpj: "11444777000161", cat: "pizzas",
      products: [
        { name: "Pizza Sandbox Calabresa", price: 49.9, description: "Mussarela, calabresa, cebola" },
        { name: "Pizza Sandbox Margherita", price: 45.0, description: "Mussarela, tomate, manjericão" },
        { name: "Refrigerante 2L", price: 12.0, description: "Coca-Cola 2L gelada" },
      ] },
    { email: "sandbox+lojista3@itasuper.test", name: "Sandbox Sushi",  cnpj: "19131243000197", cat: "japonesa",
      products: [
        { name: "Combo Sandbox 20pç", price: 79.9, description: "Sushi e sashimi variados" },
        { name: "Temaki Salmão", price: 28.0, description: "Salmão fresco e cream cheese" },
        { name: "Hot Roll 8pç", price: 32.0, description: "Empanado, recheio de salmão" },
      ] },
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

const Body = z.object({ action: z.enum(["seed", "cleanup", "status", "provision-asaas", "panel"]) });

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

    // Provisiona subconta Asaas (sandbox) para todas as lojas de teste sem wallet
    if (parsed.data.action === "provision-asaas") {
      const { data: stores } = await admin
        .from("stores")
        .select("id, name, owner_id, asaas_wallet_id, address_street, address_number, address_neighborhood, address_cep, address_city, address_state")
        .eq("is_test", true);
      const results: any[] = [];
      for (const s of stores ?? []) {
        if (s.asaas_wallet_id) {
          results.push({ store_id: s.id, name: s.name, skipped: "já tem wallet" });
          continue;
        }
        // descobre email/cnpj/etc do profile
        const { data: prof } = await admin
          .from("profiles")
          .select("email, document, phone, whatsapp_number, pix_key, pix_type")
          .eq("user_id", s.owner_id!)
          .maybeSingle();
        if (!prof?.email) {
          results.push({ store_id: s.id, name: s.name, error: "profile sem email" });
          continue;
        }
        const cpfCnpj = (prof.document || "").replace(/\D/g, "");
        const isCnpj = cpfCnpj.length === 14;
        const payload = {
          store_id: s.id,
          name: s.name,
          email: prof.email,
          cpfCnpj,
          personType: isCnpj ? "JURIDICA" : "FISICA",
          companyType: isCnpj ? "MEI" : "",
          birthDate: isCnpj ? "" : "1990-01-01",
          incomeValue: 5000,
          phone: (prof.phone || prof.whatsapp_number || "1499990000").replace(/\D/g, "").slice(-11),
          mobilePhone: (prof.whatsapp_number || prof.phone || "14999990000").replace(/\D/g, "").slice(-11),
          address: s.address_street || "Rua Sandbox",
          addressNumber: s.address_number || "100",
          province: s.address_neighborhood || "Centro",
          postalCode: (s.address_cep || "18250000").replace(/\D/g, ""),
          city: s.address_city || "Itatinga",
          state: s.address_state || "SP",
          pixAddressKey: prof.pix_key || cpfCnpj,
          pixAddressKeyType: (((prof.pix_type as string) || (isCnpj ? "CNPJ" : "CPF"))).toUpperCase(),
        };
        try {
          const externalFnBase = (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!;
          const r = await fetch(`${externalFnBase}/functions/v1/create-asaas-subaccount`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: auth,
              apikey: (Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!,
            },
            body: JSON.stringify(payload),
          });
          const body = await r.json().catch(() => ({}));
          results.push({
            store_id: s.id,
            name: s.name,
            status: r.status,
            ok: r.ok,
            ...(r.ok ? { body } : { error: body?.error || `HTTP ${r.status}`, body }),
          });
        } catch (e) {
          results.push({ store_id: s.id, name: s.name, error: String((e as Error).message || e) });
        }
      }
      return json({ ok: true, results });
    }

    // Resumo financeiro de cada loja de teste com subconta
    if (parsed.data.action === "panel") {
      const { data: stores } = await admin
        .from("stores")
        .select("id, name, asaas_wallet_id, asaas_subaccount_api_key")
        .eq("is_test", true)
        .not("asaas_wallet_id", "is", null);
      const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
      const isSandbox = !ASAAS_API_KEY?.startsWith("$aact_prod_");
      const baseUrl = isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
      const results: any[] = [];
      for (const s of stores ?? []) {
        const subKey = (s as any).asaas_subaccount_api_key;
        if (!subKey) { results.push({ store_id: s.id, name: s.name, error: "sem subaccount api key" }); continue; }
        try {
          const r = await fetch(`${baseUrl}/finance/balance`, { headers: { access_token: subKey } });
          const body = await r.json().catch(() => ({}));
          results.push({ store_id: s.id, name: s.name, status: r.status, balance: Number(body?.balance ?? 0), totalBalance: Number(body?.totalBalance ?? 0) });
        } catch (e) {
          results.push({ store_id: s.id, name: s.name, error: String((e as Error).message || e) });
        }
      }
      return json({ ok: true, results });
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

    // Randomiza CPF/CNPJ a cada seed para evitar colisão no Asaas PROD global.
    const lojistas = SEEDS.lojistas.map((s) => ({ ...s, cnpj: genCNPJ() }));
    const motoboys = SEEDS.motoboys.map((m) => ({ ...m, cpf: genCPF() }));
    const clientes = SEEDS.clientes.map((c) => ({ ...c, cpf: genCPF() }));

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
    for (const s of lojistas) {
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
        pix_type: "cnpj",
        pix_key: s.cnpj,
        selected_plan: "starter",
      });
      if (!user) continue;
      // Completa profile (trigger só preenche full_name/role)
      await admin
        .from("profiles")
        .update({
          document: s.cnpj,
          phone: "14999990000",
          whatsapp_number: "14999990000",
          pix_type: "cnpj",
          pix_key: s.cnpj,
          street: "Rua Sandbox",
          number: "100",
          neighborhood: "Centro",
          city: "Itatinga",
          cep: "18250000",
        })
        .eq("user_id", user.id);
      // Cria/atualiza store do lojista (não existia)
      const { data: existing } = await admin
        .from("stores").select("id").eq("owner_id", user.id).maybeSingle();
      if (!existing) {
        await admin.from("stores").insert({
          name: s.name,
          owner_id: user.id,
          category: s.cat,
          status: "ativo",
          is_test: true,
          app_enabled: true,
          is_open: true,
          delivery_mode: "own",
          own_delivery_fee: 5,
          settings: {},
          commission_rate: 0.1,
          categories: [s.cat],
          address_street: "Rua Sandbox",
          address_number: "100",
          address_neighborhood: "Centro",
          address_city: "Itatinga",
          address_state: "SP",
          address_cep: "18250000",
        });
      } else {
        await admin.from("stores").update({
          is_test: true, status: "ativo", app_enabled: true,
          address_street: "Rua Sandbox", address_number: "100",
          address_neighborhood: "Centro", address_city: "Itatinga",
          address_state: "SP", address_cep: "18250000",
        }).eq("owner_id", user.id);
      }

      // Seed horários 24/7 + produtos (idempotente)
      const { data: storeRow } = await admin
        .from("stores").select("id").eq("owner_id", user.id).maybeSingle();
      if (storeRow?.id) {
        // Horários 24/7: delete + insert (mais robusto que upsert sem unique garantido)
        const delH = await admin.from("opening_hours").delete().eq("store_id", storeRow.id);
        if (delH.error) console.error("del hours", s.email, delH.error);
        const hours = Array.from({ length: 7 }).map((_, day) => ({
          store_id: storeRow.id, day_of_week: day,
          open_time: "00:00:00", close_time: "23:59:00", is_closed_all_day: false,
        }));
        const insH = await admin.from("opening_hours").insert(hours);
        if (insH.error) console.error("ins hours", s.email, insH.error);

        // Garante uma seção "Cardápio" (idempotente, sempre)
        let { data: sec } = await admin
          .from("menu_sections").select("id").eq("store_id", storeRow.id).limit(1).maybeSingle();
        if (!sec) {
          const ins = await admin.from("menu_sections")
            .insert({ store_id: storeRow.id, name: "Cardápio", sort_order: 0 })
            .select("id").maybeSingle();
          if (ins.error) console.error("ins section", s.email, ins.error);
          sec = ins.data;
        }
        const { count, error: cErr } = await admin
          .from("products").select("id", { count: "exact", head: true }).eq("store_id", storeRow.id);
        if (cErr) console.error("count products", s.email, cErr);
        if (!count) {
          const insP = await admin.from("products").insert(
            (s.products || []).map((p) => ({
              store_id: storeRow.id, name: p.name, price: p.price,
              description: p.description, is_available: true,
              section_id: sec?.id ?? null,
            })),
          );
          if (insP.error) console.error("ins products", s.email, insP.error);
        } else if (sec?.id) {
          // Backfill section_id em produtos que ficaram órfãos
          const upd = await admin.from("products")
            .update({ section_id: sec.id })
            .eq("store_id", storeRow.id).is("section_id", null);
          if (upd.error) console.error("backfill section_id", s.email, upd.error);
        }
      }
      created.push({ kind: "lojista", email: s.email, user_id: user.id });
    }

    // Motoboys
    for (const m of motoboys) {
      const user = await createUser(m.email, {
        full_name: m.name,
        role: "motoboy",
        document: m.cpf,
        vehicle: "moto",
      });
      if (!user) continue;
      await admin
        .from("profiles")
        .update({
          document: m.cpf,
          phone: "14999990000",
          whatsapp_number: "14999990000",
          pix_type: "cpf",
          pix_key: m.cpf,
        })
        .eq("user_id", user.id);
      // Garante linha em drivers
      await admin
        .from("drivers")
        .upsert(
          { user_id: user.id, name: m.name, is_active: true, is_online: false },
          { onConflict: "user_id" },
        );
      // Vincula motoboy a TODAS lojas sandbox (status accepted, fim_do_dia)
      const { data: sandboxStores } = await admin
        .from("stores").select("id").eq("is_test", true);
      for (const ss of sandboxStores ?? []) {
        const { data: existsLink } = await admin
          .from("store_drivers").select("id")
          .eq("store_id", ss.id).eq("driver_user_id", user.id).maybeSingle();
        if (!existsLink) {
          const lk = await admin.from("store_drivers").insert({
            store_id: ss.id, driver_user_id: user.id,
            status: "accepted", payment_mode: "fim_do_dia",
          });
          if (lk.error) console.error("link driver", m.email, ss.id, lk.error);
        }
      }
      created.push({ kind: "motoboy", email: m.email, user_id: user.id });
    }

    // Clientes
    for (const c of clientes) {
      const user = await createUser(c.email, {
        full_name: c.name,
        role: "cliente",
        document: c.cpf,
      });
      if (!user) continue;
      await admin
        .from("profiles")
        .update({
          document: c.cpf,
          phone: "14999990000",
          whatsapp_number: "14999990000",
        })
        .eq("user_id", user.id);
      created.push({ kind: "cliente", email: c.email, user_id: user.id });
    }

    return json({ ok: true, password: PASSWORD, domain: TEST_EMAIL_DOMAIN, created });
  } catch (err) {
    console.error("seed-test-accounts error:", err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});