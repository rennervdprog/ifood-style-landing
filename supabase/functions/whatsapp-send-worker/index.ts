// whatsapp-send-worker
// Drena a fila whatsapp_send_queue: tenta enviar o que ficou preso (teto diário,
// falha transitória da Evolution), com backoff e validade. Chamado por pg_cron (1 min).
// O envio passa pelo evolution-send-message com x-queue-worker: 1 — ele NÃO
// reenfileira; quem reagenda é este worker.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const BACKOFF_MIN = [1, 5, 15, 45, 120];

Deno.serve(async (req) => {
  try {
    const internalToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ok = (!!internalToken && req.headers.get("x-internal-token") === internalToken) ||
      (!!cronSecret && (req.headers.get("x-cron-secret") === cronSecret || (req.headers.get("Authorization") || "") === `Bearer ${cronSecret}`)) ||
      (!!serviceKey && (req.headers.get("Authorization") || "") === `Bearer ${serviceKey}`);
    if (!ok) return json({ error: "unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
    const nowIso = new Date().toISOString();

    await admin.from("whatsapp_send_queue").update({ status: "expired" })
      .eq("status", "pending").lt("expires_at", nowIso);

    const { data: rows } = await admin.from("whatsapp_send_queue")
      .select("id, store_id, phone, message, kind, attempts")
      .eq("status", "pending").lte("next_attempt_at", nowIso).gt("expires_at", nowIso)
      .order("priority", { ascending: true }).order("created_at", { ascending: true })
      .limit(20);

    let sent = 0, rescheduled = 0, failed = 0, skippedOfficial = 0;
    const base = Deno.env.get("SUPABASE_URL");
    // Migração API oficial: esta fila é só do canal Evolution (texto puro).
    // Item de loja com whatsapp_mode='official' é encerrado SEM tentativa —
    // os envios daquela loja acontecem pelo canal oficial, fora desta fila.
    const officialStores = new Set<string>();
    {
      const storeIds = [...new Set((rows || []).map((r: any) => r.store_id))];
      if (storeIds.length > 0) {
        const { data: cfgs } = await admin.from("store_whatsapp_config")
          .select("store_id, whatsapp_mode").in("store_id", storeIds);
        for (const c of cfgs || []) if ((c as any).whatsapp_mode === "official") officialStores.add((c as any).store_id);
      }
    }
    for (const row of rows || []) {
      if (officialStores.has(row.store_id)) {
        await admin.from("whatsapp_send_queue").update({ status: "failed", last_error: "store_on_official_mode" }).eq("id", row.id);
        skippedOfficial++;
        continue;
      }
      let okSend = false, errTxt = "";
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 50_000);
        const r = await fetch(`${base}/functions/v1/evolution-send-message`, {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "x-internal-token": internalToken,
            "x-queue-worker": "1",
          },
          body: JSON.stringify({ store_id: row.store_id, phone: row.phone, message: row.message, kind: row.kind }),
        });
        clearTimeout(timer);
        const out = await r.json().catch(() => ({}));
        okSend = r.ok && (out as any)?.success !== false && !(out as any)?.error;
        if (!okSend) errTxt = JSON.stringify(out).slice(0, 300);
      } catch (e) {
        errTxt = String((e as Error)?.message || e).slice(0, 300);
      }
      if (okSend) {
        await admin.from("whatsapp_send_queue").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
        sent++;
      } else {
        const attempts = Number(row.attempts || 0) + 1;
        if (attempts >= 5) {
          await admin.from("whatsapp_send_queue").update({ status: "failed", attempts, last_error: errTxt }).eq("id", row.id);
          failed++;
        } else {
          const next = new Date(Date.now() + (BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60000)).toISOString();
          await admin.from("whatsapp_send_queue").update({ attempts, next_attempt_at: next, last_error: errTxt }).eq("id", row.id);
          rescheduled++;
        }
      }
    }
    return json({ ok: true, processed: (rows || []).length, sent, rescheduled, failed, skipped_official: skippedOfficial });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 200);
  }
});
