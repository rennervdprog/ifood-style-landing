// Cron diário: promove Essencial R$0 → R$180/mês quando GMV últimos 60 dias >= R$5.000.
// Roda contra Supabase EXTERNO (mesmo padrão de monthly-billing).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const THRESHOLD_BRL = 5000;
const WINDOW_DAYS = 60;
const UPGRADE_FEE = 180;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const EXTERNAL_KEY =
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
    Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
    Deno.env.get("SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: service key ou CRON_SECRET
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "") ||
    req.headers.get("apikey") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const svc = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ok =
    !!auth && (auth === svc || auth === EXTERNAL_KEY || (cronSecret && auth === cronSecret));
  if (!ok) return json({ error: "Unauthorized" }, 401);

  try {
    const sb = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    // Essencial grátis (fixed, monthly_fee=0, ativo)
    const { data: plans, error: pErr } = await sb
      .from("store_plans")
      .select("id, store_id, monthly_fee, plan_type, is_active, essencial_upgrade_scheduled_at, essencial_lifetime_free, pix_operational_fee_override, platform_delivery_split_override, commission_rate, stores!inner(name, status, owner_id, profiles!stores_owner_id_fkey(whatsapp))")
      .eq("plan_type", "fixed")
      .eq("is_active", true)
      .eq("monthly_fee", 0);
    if (pErr) return json({ error: pErr.message }, 500);

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const upgraded: any[] = [];
    const skipped: any[] = [];

    const GRACE_DAYS = 30;
    const FUNCTIONS_BASE = `${EXTERNAL_URL}/functions/v1`;
    const notify = async (phone: string | undefined, msg: string, kind: string, store_id: string) => {
      if (!phone) return;
      await fetch(`${FUNCTIONS_BASE}/platform-whatsapp-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${EXTERNAL_KEY}` },
        body: JSON.stringify({ phone, message: msg, kind, store_id }),
      }).catch(() => {});
    };

    const planSel = await sb
      .from("store_plans")
      .select("id, essencial_upgrade_response, essencial_upgrade_response_at, essencial_upgrade_notified_at")
      .in("id", (plans || []).map((x: any) => x.id));
    const extra: Record<string, any> = {};
    for (const r of (planSel.data || [])) extra[(r as any).id] = r;

    for (const p of plans || []) {
      const ex = extra[(p as any).id] || {};
      const response = ex.essencial_upgrade_response as string | null;
      const store = (p as any).stores;
      if (!store || store.status !== "ativo") continue;
      // VIP vitalício: nunca subir mensalidade nem agendar upgrade.
      if ((p as any).essencial_lifetime_free === true) {
        skipped.push({ store: store.name, reason: "lifetime_free_vip" });
        continue;
      }
      // Qualquer override VIP (PIX, entrega, comissão custom) também isenta do upgrade automático.
      if (
        (p as any).pix_operational_fee_override != null ||
        (p as any).platform_delivery_split_override != null ||
        Number((p as any).commission_rate || 0) !== 0
      ) {
        skipped.push({ store: store.name, reason: "vip_override" });
        continue;
      }
      const ownerPhone: string | undefined = store?.profiles?.whatsapp;

      const { data: orders, error: oErr } = await sb
        .from("orders")
        .select("total_price")
        .eq("store_id", p.store_id)
        .in("status", ["entregue", "finalizado"])
        .gte("created_at", since);
      if (oErr) {
        skipped.push({ store: store.name, error: oErr.message });
        continue;
      }
      const gmv = (orders || []).reduce((s: number, o: any) => s + Number(o.total_price || 0), 0);

      if (gmv >= THRESHOLD_BRL) {
        const nowMs = Date.now();
        const scheduled = (p as any).essencial_upgrade_scheduled_at
          ? new Date((p as any).essencial_upgrade_scheduled_at).getTime()
          : null;

        if (response === "refused") {
          skipped.push({ store: store.name, gmv, reason: "user_refused_upgrade" });
          continue;
        }

        if (!scheduled) {
          // 1ª vez que bateu R$5k: agenda upgrade daqui a GRACE_DAYS
          const scheduleAt = new Date(nowMs + GRACE_DAYS * 86400_000);
          await sb.from("store_plans")
            .update({ essencial_upgrade_scheduled_at: scheduleAt.toISOString(), essencial_upgrade_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", p.id);
          const label = scheduleAt.toLocaleDateString("pt-BR");
          await notify(ownerPhone,
            `🎉 Parabéns, ${store.name}!\n\nSua loja passou de R$ 5.000 em vendas nos últimos ${WINDOW_DAYS} dias. Conforme os Termos de Uso, o upgrade para o plano Essencial pago (R$ ${UPGRADE_FEE},00/mês) está agendado para *${label}* (30 dias de aviso prévio).\n\nAcesse o painel para *Aceitar* ou *Recusar* o upgrade. Nenhuma cobrança será feita sem o seu consentimento expresso.`,
            "essencial_upgrade_scheduled", p.store_id);
          skipped.push({ store: store.name, gmv, scheduled_for: scheduleAt.toISOString() });
        } else if (nowMs >= scheduled && response === "accepted") {
          // Grace period vencido → aplica upgrade
          const { error: uErr } = await sb
            .from("store_plans")
            .update({ monthly_fee: UPGRADE_FEE, updated_at: new Date().toISOString() })
            .eq("id", p.id);
          if (uErr) {
            skipped.push({ store: store.name, gmv, error: uErr.message });
          } else {
            upgraded.push({ store: store.name, gmv, new_fee: UPGRADE_FEE });
            await sb.from("admin_logs").insert({
              action: "essencial_auto_upgrade",
              metadata: { store_id: p.store_id, gmv, window_days: WINDOW_DAYS, new_fee: UPGRADE_FEE },
            }).then(() => {}, () => {});
            await notify(ownerPhone,
              `📢 ${store.name}, o período de preparação terminou e sua mensalidade ItaSuper foi atualizada para *R$ ${UPGRADE_FEE},00/mês*.\n\nA próxima cobrança PIX será gerada em breve. Obrigado por crescer com a gente!`,
              "essencial_upgrade_applied", p.store_id);
          }
        } else if (nowMs >= scheduled) {
          // Prazo venceu mas sem consentimento expresso → NÃO aplica; mantém pendente.
          skipped.push({ store: store.name, gmv, reason: "awaiting_user_consent" });
        } else {
          skipped.push({ store: store.name, gmv, scheduled_for: new Date(scheduled).toISOString(), reason: "in_grace_period" });
        }
      } else {
        skipped.push({ store: store.name, gmv, reason: "below_threshold" });
      }
    }

    return json({
      checked: (plans || []).length,
      upgraded_count: upgraded.length,
      upgraded,
      skipped,
      threshold: THRESHOLD_BRL,
      window_days: WINDOW_DAYS,
    });
  } catch (e: any) {
    console.error("[check-essencial-upgrade]", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});