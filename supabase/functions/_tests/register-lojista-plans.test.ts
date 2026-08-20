/**
 * Testes Deno do cadastro de lojista (register_as_lojista).
 *
 * Valida, para CADA plano oferecido no cadastro, que o store_plans
 * criado bate com a especificação de negócio:
 *
 *   fixed (Essencial): R$0/mês na entrada, sem comissão por pedido
 *   pdv_only         : R$69/mês, operação de balcão sem delivery
 *
 * Autonomia é legado: não pode ser selecionado por uma nova loja.
 *
 * Roda contra o Supabase EXTERNO. Requer:
 *   EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_KEY, EXTERNAL_SUPABASE_ANON_KEY
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || "";
const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || "";
const skip = !URL_ || !SVC || !ANON;
const opts = { ignore: skip, sanitizeOps: false, sanitizeResources: false };

const admin = skip ? null : createClient(URL_, SVC, { auth: { persistSession: false } });

interface PlanSpec {
  selected: string;
  planType: string;
  monthlyFee: number;
  commissionRate: number;
  pixOperationalFee: number; // R$ por pedido PIX
  platformDeliveryExtra?: number; // Taxa da plataforma em entrega própria, quando aplicável
  pdvCommissionRate: number; // % PDV
}

const SPECS: PlanSpec[] = [
  {
    selected: "fixed",
    planType: "fixed",
    monthlyFee: 0,
    commissionRate: 0,
    pixOperationalFee: 1.99,
    platformDeliveryExtra: 0.99,
    pdvCommissionRate: 2,
  },
  {
    selected: "pdv_only",
    planType: "pdv_only",
    monthlyFee: 69,
    commissionRate: 0,
    pixOperationalFee: 1.99,
    pdvCommissionRate: 0,
  },
];

async function createUserAndClient(email: string, password: string) {
  const { data, error } = await admin!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user!.id;

  const sb = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await sb.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { userId, sb };
}

async function cleanup(userId: string) {
  await admin!.from("stores").delete().eq("owner_id", userId);
  await admin!.from("profiles").delete().eq("user_id", userId);
  await admin!.auth.admin.deleteUser(userId);
}

Deno.test("register_as_lojista rejeita Autonomia em novos cadastros", opts, async () => {
  const tag = `test_autonomy_retired_${Date.now()}`;
  const { userId, sb } = await createUserAndClient(`${tag}@itasuper-test.local`, "TestPass!234");

  try {
    const { data: storeId, error } = await sb.rpc("register_as_lojista", {
      _full_name: "Loja Teste Autonomia",
      _document: "00000000000",
      _store_name: `${tag}_loja`,
      _store_category: "lanches" as any,
      _avatar_url: null,
      _whatsapp: "11999999999",
      _selected_plan: "autonomy",
    });

    assertEquals(storeId, null, "não deve criar loja no plano descontinuado");
    assert(error, "cadastro Autonomia deve ser rejeitado");
    assert(error.message.includes("Plano indisponível para novos cadastros"), error.message);
  } finally {
    await cleanup(userId);
  }
});

for (const spec of SPECS) {
  Deno.test(`register_as_lojista → ${spec.selected}`, opts, async () => {
    const tag = `test_${spec.selected}_${Date.now()}`;
    const email = `${tag}@itasuper-test.local`;
    const password = "TestPass!234";
    const { userId, sb } = await createUserAndClient(email, password);

    try {
      const { data: storeId, error } = await sb.rpc("register_as_lojista", {
        _full_name: "Loja Teste " + spec.selected,
        _document: "00000000000",
        _store_name: tag + "_loja",
        _store_category: "lanches" as any,
        _avatar_url: null,
        _whatsapp: "11999999999",
        _selected_plan: spec.selected,
      });
      if (error) throw error;
      assert(storeId, "store_id retornado");

      const { data: plan, error: e2 } = await admin!
        .from("store_plans")
        .select(
          "plan_type, monthly_fee, commission_rate, pix_operational_fee_override, platform_delivery_split_override, pdv_enabled, pdv_commission_rate"
        )
        .eq("store_id", storeId as string)
        .single();
      if (e2) throw e2;

      assertEquals(plan.plan_type, spec.planType, "plan_type");
      assertEquals(Number(plan.monthly_fee), spec.monthlyFee, "monthly_fee");
      assertEquals(Number(plan.commission_rate), spec.commissionRate, "commission_rate");

      // PDV precisa estar habilitado em todos os planos
      assertEquals(plan.pdv_enabled, true, "pdv_enabled");

      // Comissão PDV (%): só o plano commission tem
      assertEquals(
        Number(plan.pdv_commission_rate ?? 0),
        spec.pdvCommissionRate,
        `pdv_commission_rate (esperado ${spec.pdvCommissionRate}%)`
      );

      // Split da plataforma na entrega própria, quando o plano possui delivery.
      if (spec.platformDeliveryExtra !== undefined) {
        const splitOverride = plan.platform_delivery_split_override;
        const effectiveExtra = splitOverride == null ? 0.99 : Number(splitOverride);
        assertEquals(effectiveExtra, spec.platformDeliveryExtra, "platform_delivery_split_override efetivo");
      }
    } finally {
      await cleanup(userId);
    }
  });
}