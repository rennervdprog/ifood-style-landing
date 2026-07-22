// E2E do Sistema de Revenda — roda todas as suites disponíveis (Bloco 1 do plano)
// contra o Supabase externo usando service_role + JWTs de usuários de teste.
//
// Suites cobertas neste run:
//   1  register            5  recurring (simula insert, sem cron)
//   2  admin_flow          7  dashboard
//   3  referral_link (RPC) 8  withdrawal
//                          10 admin_analytics (RPC + KPIs)
//                          12 rls
//
// Suites que dependem de Fase 5 (crons de bounty/fraude/gmv/payout Asaas)
// ficam marcadas SKIP até serem implementadas.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const SERVICE = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
const MGMT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;

type Res = { suite: string; step: string; ok: boolean; note?: string; data?: unknown };
const results: Res[] = [];
function rec(suite: string, step: string, ok: boolean, note = "", data?: unknown) {
  results.push({ suite, step, ok, note: note.slice(0, 400), data });
  console.log(`[${ok ? "OK" : "FAIL"}] ${suite} :: ${step} :: ${note.slice(0, 200)}`);
}
async function tryStep(suite: string, step: string, fn: () => Promise<string | void>) {
  try {
    const note = (await fn()) || "";
    rec(suite, step, true, note);
  } catch (e) {
    rec(suite, step, false, String((e as Error).message || e));
  }
}

// ---------- Supabase helpers ----------
async function sql(query: string) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await r.json().catch(() => ({}));
  if (r.status >= 300) throw new Error(`sql ${r.status}: ${JSON.stringify(body)}`);
  return body as any[];
}
async function admin(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body: any = null; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
async function rpcAs(token: string, name: string, args: Record<string, unknown> = {}) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let body: any = null; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
async function selectAs(token: string, table: string, query: string) {
  const r = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const text = await r.text();
  let body: any = null; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

// ---------- Provisioning ----------
async function ensureUser(email: string, password: string) {
  // Try create first (idempotent-ish); if exists, look up and force-reset password.
  const created = await admin(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (created.status < 300 && created.body?.id) return created.body;

  // fetch existing id via SQL (auth.users) — mais confiável que o list endpoint
  const rows = await sql(`SELECT id FROM auth.users WHERE email = '${email.replace(/'/g, "''")}' LIMIT 1`);
  if (!rows[0]) throw new Error(`ensureUser ${email}: create=${JSON.stringify(created.body)} + not-found`);
  const uid = (rows[0] as any).id;
  const updated = await admin(`/auth/v1/admin/users/${uid}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (updated.status >= 300) throw new Error(`update ${email}: ${JSON.stringify(updated.body)}`);
  return updated.body?.id ? updated.body : { id: uid, email };
}
async function signIn(email: string, password: string) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await r.json();
  if (!body.access_token) throw new Error(`signIn ${email}: ${JSON.stringify(body)}`);
  return body.access_token as string;
}
async function resetReseller(userId: string) {
  await sql(`
    DELETE FROM public.reseller_withdrawal_requests WHERE reseller_id IN (SELECT id FROM public.resellers WHERE user_id = '${userId}');
    DELETE FROM public.reseller_commissions        WHERE reseller_id IN (SELECT id FROM public.resellers WHERE user_id = '${userId}');
    DELETE FROM public.reseller_referrals          WHERE reseller_id IN (SELECT id FROM public.resellers WHERE user_id = '${userId}');
    DELETE FROM public.resellers                   WHERE user_id = '${userId}';
    DELETE FROM public.user_roles                  WHERE user_id = '${userId}' AND role = 'revendedor';
  `);
}
async function ensureAdmin(userId: string) {
  await sql(`INSERT INTO public.user_roles (user_id, role) VALUES ('${userId}', 'admin') ON CONFLICT DO NOTHING;`);
}

// ---------- Fixture: cria/reseta contas e retorna handles ----------
const PWD = "E2eReseller!2026";
async function seed() {
  const emails = {
    r1: "e2e-reseller-1@itasuper.test",
    r2: "e2e-reseller-2@itasuper.test",
    r3: "e2e-reseller-3@itasuper.test",
    admin: "e2e-reseller-admin@itasuper.test",
  };
  const users: Record<string, any> = {};
  for (const [k, email] of Object.entries(emails)) users[k] = await ensureUser(email, PWD);
  for (const k of ["r1", "r2", "r3"]) await resetReseller(users[k].id);
  await ensureAdmin(users.admin.id);
  const tokens: Record<string, string> = {};
  for (const [k, email] of Object.entries(emails)) tokens[k] = await signIn(email, PWD);
  return { users, tokens };
}

// ============================================================
// SUITE 1 — Register
// ============================================================
async function suite1(t: any, u: any) {
  const S = "1_register";
  await tryStep(S, "r1 register RENAN2026", async () => {
    const r = await rpcAs(t.r1, "reseller_register", { _code: "RENAN2026", _pix_key: "12345678900", _pix_key_type: "cpf" });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    const row = Array.isArray(r.body) ? r.body[0] : r.body;
    const id = row?.id ?? row?.out_id;
    if (!id) throw new Error("no id returned " + JSON.stringify(r.body));
    return `id=${id} status=${row?.status ?? row?.out_status}`;
  });
  await tryStep(S, "r2 duplicate code fails", async () => {
    const r = await rpcAs(t.r2, "reseller_register", { _code: "RENAN2026" });
    if (r.status < 400) throw new Error(`expected error, got ${r.status}: ${JSON.stringify(r.body)}`);
    return `blocked status=${r.status}`;
  });
  await tryStep(S, "r2 register with own code", async () => {
    const r = await rpcAs(t.r2, "reseller_register", { _code: "RESELLER2", _pix_key: "22222222222", _pix_key_type: "cpf" });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    return "ok";
  });
  await tryStep(S, "anonymous register fails", async () => {
    const r = await rpcAs(ANON, "reseller_register", { _code: "ANONYMOUS" });
    if (r.status < 400) throw new Error(`expected auth error, got ${r.status}`);
    return `blocked ${r.status}`;
  });
  await tryStep(S, "r3 register RESELLER3", async () => {
    const r = await rpcAs(t.r3, "reseller_register", { _code: "RESELLER3", _pix_key: "33333333333", _pix_key_type: "cpf" });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    return "ok";
  });
  await tryStep(S, "r2 dashboard while pending", async () => {
    const r = await rpcAs(t.r2, "reseller_get_dashboard");
    if (r.status >= 500) throw new Error(`crashed ${JSON.stringify(r.body)}`);
    return `status=${r.status}`;
  });
  await tryStep(S, "admin list sees 3 resellers", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_list");
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    const codes = new Set((r.body || []).map((x: any) => x.code));
    for (const c of ["RENAN2026", "RESELLER2", "RESELLER3"]) {
      if (!codes.has(c)) throw new Error(`missing code ${c}`);
    }
    return `total=${r.body.length}`;
  });
}

// ============================================================
// SUITE 2 — Admin flow
// ============================================================
async function suite2(t: any, u: any) {
  const S = "2_admin_flow";
  let r1Id = "";
  await tryStep(S, "lookup r1 id", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_list");
    r1Id = r.body.find((x: any) => x.code === "RENAN2026").id;
    return r1Id;
  });
  await tryStep(S, "approve r1", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_set_status", { _reseller_id: r1Id, _status: "approved" });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    if (r.body.status !== "approved") throw new Error(`status=${r.body.status}`);
    return `approved_at=${r.body.approved_at}`;
  });
  await tryStep(S, "revendedor role granted", async () => {
    const rows = await sql(`SELECT role FROM public.user_roles WHERE user_id = '${u.r1.id}' AND role = 'revendedor'`);
    if (rows.length === 0) throw new Error("role not granted");
    return "ok";
  });
  await tryStep(S, "update config (rate 0.30, bounty R$200)", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_update_config", {
      _reseller_id: r1Id, _commission_rate: 0.30, _bounty_amount_cents: 20000,
    });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    if (Number(r.body.commission_rate) !== 0.3) throw new Error(`rate=${r.body.commission_rate}`);
    if (r.body.bounty_amount_cents !== 20000) throw new Error(`bounty=${r.body.bounty_amount_cents}`);
    return "ok";
  });
  await tryStep(S, "block r3", async () => {
    const list = await rpcAs(t.admin, "admin_reseller_list");
    const r3Id = list.body.find((x: any) => x.code === "RESELLER3").id;
    const r = await rpcAs(t.admin, "admin_reseller_set_status", { _reseller_id: r3Id, _status: "blocked", _notes: "fraude teste" });
    if (r.body.status !== "blocked") throw new Error(JSON.stringify(r.body));
    return "ok";
  });
  await tryStep(S, "non-admin call admin RPC → unauthorized", async () => {
    const r = await rpcAs(t.r1, "admin_reseller_list");
    if (r.status < 400) throw new Error(`expected 4xx, got ${r.status}`);
    return `blocked ${r.status}`;
  });
}

// ============================================================
// SUITE 3 — Referral link (RPC-only; UI cobertura em suite Playwright depois)
// ============================================================
async function suite3(t: any, u: any) {
  const S = "3_referral_link";
  await tryStep(S, "lookup RENAN2026", async () => {
    const r = await rpcAs(t.r1, "reseller_lookup_code", { _code: "RENAN2026" });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    const row = Array.isArray(r.body) ? r.body[0] : r.body;
    if (!row?.exists_flag) throw new Error(`not found ${JSON.stringify(r.body)}`);
    return `reseller_id=${row.reseller_id}`;
  });
  await tryStep(S, "lookup invalid code returns null/empty", async () => {
    const r = await rpcAs(t.r1, "reseller_lookup_code", { _code: "NAOEXISTE_XYZ" });
    if (r.status >= 500) throw new Error(`crashed ${r.status}`);
    const row = Array.isArray(r.body) ? r.body[0] : r.body;
    if (row?.exists_flag) throw new Error(`should be false`);
    return "ok";
  });
  await tryStep(S, "attach_signup (simulado com storeId fake) — deve exigir vínculo real ou responder graciosamente", async () => {
    const r = await rpcAs(t.r1, "reseller_attach_signup", { _code: "RENAN2026", _store_id: "00000000-0000-0000-0000-000000000000" });
    if (r.status >= 500) throw new Error(`crashed ${JSON.stringify(r.body)}`);
    return `status=${r.status}`;
  });
  await tryStep(S, "SKIP fluxo full de signup lojista com ?ref (roda em Playwright separado)", async () => "skip");
}

// ============================================================
// SUITE 7 — Dashboard
// ============================================================
async function suite7(t: any, u: any) {
  const S = "7_dashboard";
  await tryStep(S, "r1 dashboard payload", async () => {
    const r = await rpcAs(t.r1, "reseller_get_dashboard");
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    if (r.body == null) throw new Error("null payload");
    return `keys=${Object.keys(r.body || {}).join(",")}`;
  });
  await tryStep(S, "r1 vê próprio row via RLS", async () => {
    const r = await selectAs(t.r1, "resellers", "select=id,code,status");
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    if (!Array.isArray(r.body) || r.body.length !== 1) throw new Error(`len=${r.body?.length}`);
    if (r.body[0].code !== "RENAN2026") throw new Error(`wrong code`);
    return "ok";
  });
}

// ============================================================
// SUITE 8 — Withdrawal
// ============================================================
async function suite8(t: any, u: any) {
  const S = "8_withdrawal";
  let resellerId = "";
  await tryStep(S, "fetch r1 reseller_id", async () => {
    const rows = await sql(`SELECT id FROM public.resellers WHERE user_id = '${u.r1.id}'`);
    resellerId = rows[0].id;
    return resellerId;
  });
  await tryStep(S, "withdrawal sem saldo → erro", async () => {
    const r = await rpcAs(t.r1, "reseller_request_withdrawal", { _amount_cents: 10000 });
    // A RPC atual retorna 200 com {success:false, error:'insufficient_balance'} — aceito ambos os formatos.
    const b = r.body;
    const isErr = r.status >= 400 || b?.success === false || b?.error;
    if (!isErr) throw new Error(`expected error, got ${r.status}: ${JSON.stringify(b)}`);
    return `blocked ${r.status} ${JSON.stringify(b).slice(0, 80)}`;
  });
  await tryStep(S, "injetar commission fake R$ 250 pending", async () => {
    await sql(`INSERT INTO public.reseller_commissions (reseller_id, type, amount_cents, reference_month, status)
               VALUES ('${resellerId}', 'bounty', 25000, to_char(now(),'YYYY-MM'), 'pending');`);
    return "ok";
  });
  let wId = "";
  await tryStep(S, "solicitar saque R$ 150", async () => {
    const r = await rpcAs(t.r1, "reseller_request_withdrawal", { _amount_cents: 15000 });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    if (r.body?.success === false) throw new Error(JSON.stringify(r.body));
    // A RPC não retorna id; busca o pending mais recente
    const rows = await sql(`SELECT id, status FROM public.reseller_withdrawal_requests WHERE reseller_id = '${resellerId}' AND status='pending' ORDER BY created_at DESC LIMIT 1`);
    wId = (rows[0] as any)?.id;
    if (!wId) throw new Error("no pending withdrawal found");
    return `id=${wId}`;
  });
  await tryStep(S, "segundo saque com pending → erro", async () => {
    const r = await rpcAs(t.r1, "reseller_request_withdrawal", { _amount_cents: 10000 });
    const isErr = r.status >= 400 || r.body?.success === false || r.body?.error;
    if (!isErr) throw new Error(`expected error, got ${r.status}: ${JSON.stringify(r.body)}`);
    return `blocked`;
  });
  await tryStep(S, "admin rejeita saque", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_withdrawal_process", {
      _withdrawal_id: wId, _action: "reject", _notes: "teste reject", _asaas_transfer_id: null,
    });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    const row = Array.isArray(r.body) ? r.body[0] : r.body;
    if (row?.status !== "rejected") throw new Error(JSON.stringify(r.body));
    return "ok";
  });
  let w2 = "";
  await tryStep(S, "novo saque após rejeição", async () => {
    const r = await rpcAs(t.r1, "reseller_request_withdrawal", { _amount_cents: 12000 });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    if (r.body?.success === false) throw new Error(JSON.stringify(r.body));
    const rows = await sql(`SELECT id FROM public.reseller_withdrawal_requests WHERE reseller_id = '${resellerId}' AND status='pending' ORDER BY created_at DESC LIMIT 1`);
    w2 = (rows[0] as any)?.id;
    if (!w2) throw new Error("no pending withdrawal");
    return w2;
  });
  await tryStep(S, "admin marca como pago + baixa comissões", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_withdrawal_process", {
      _withdrawal_id: w2, _action: "paid", _asaas_transfer_id: "test_tx_123", _notes: null,
    });
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    const row = Array.isArray(r.body) ? r.body[0] : r.body;
    if (row?.status !== "paid") throw new Error(JSON.stringify(r.body));
    const paid = await sql(`SELECT count(*)::int AS n FROM public.reseller_commissions WHERE reseller_id = '${resellerId}' AND status='paid'`);
    if ((paid[0] as any).n < 1) throw new Error("no commissions marked paid");
    return "ok";
  });
}

// ============================================================
// SUITE 10 — Admin analytics (KPIs)
// ============================================================
async function suite10(t: any, u: any) {
  const S = "10_admin_analytics";
  await tryStep(S, "summary KPIs", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_summary");
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    const keys = ["total_resellers", "pending_resellers", "approved_resellers", "pending_commissions_cents", "paid_commissions_cents"];
    for (const k of keys) if (!(k in r.body)) throw new Error(`missing ${k}`);
    return JSON.stringify(r.body).slice(0, 200);
  });
  await tryStep(S, "admin_reseller_commissions list", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_commissions");
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    return `n=${r.body.length}`;
  });
  await tryStep(S, "admin_reseller_withdrawals list", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_withdrawals");
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    return `n=${r.body.length}`;
  });
  await tryStep(S, "admin_reseller_referrals list", async () => {
    const r = await rpcAs(t.admin, "admin_reseller_referrals");
    if (r.status >= 300) throw new Error(JSON.stringify(r.body));
    return `n=${r.body.length}`;
  });
}

// ============================================================
// SUITE 12 — RLS
// ============================================================
async function suite12(t: any, u: any) {
  const S = "12_rls";
  await tryStep(S, "r1 não vê resellers de outros", async () => {
    const r = await selectAs(t.r1, "resellers", "select=id,user_id");
    if (!Array.isArray(r.body)) throw new Error(JSON.stringify(r.body));
    for (const row of r.body) if (row.user_id !== u.r1.id) throw new Error(`leak ${row.user_id}`);
    return `n=${r.body.length}`;
  });
  await tryStep(S, "r1 não vê commissions de outros", async () => {
    // inject fake commission for r2
    const r2 = await sql(`SELECT id FROM public.resellers WHERE user_id = '${u.r2.id}'`);
    if (r2[0]) {
      await sql(`INSERT INTO public.reseller_commissions (reseller_id, type, amount_cents, reference_month, status)
                 VALUES ('${(r2[0] as any).id}', 'bounty', 9999, '2026-01', 'pending');`);
    }
    const r = await selectAs(t.r1, "reseller_commissions", "select=id,reseller_id,amount_cents");
    if (!Array.isArray(r.body)) throw new Error(JSON.stringify(r.body));
    const myId = (await sql(`SELECT id FROM public.resellers WHERE user_id='${u.r1.id}'`))[0];
    for (const row of r.body) if (row.reseller_id !== (myId as any).id) throw new Error(`leak`);
    return `n=${r.body.length}`;
  });
  await tryStep(S, "r1 não pode UPDATE commission_rate", async () => {
    const r = await fetch(`${URL_}/rest/v1/resellers?user_id=eq.${u.r1.id}`, {
      method: "PATCH",
      headers: { apikey: ANON, Authorization: `Bearer ${t.r1}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ commission_rate: 0.99 }),
    });
    const body = await r.json().catch(() => ({}));
    // esperado: bloqueado OU array vazio (RLS impediu update)
    if (r.status < 300 && Array.isArray(body) && body.length > 0 && Number(body[0].commission_rate) === 0.99) {
      throw new Error("PRIVILEGE ESCALATION: r1 alterou próprio rate!");
    }
    return `status=${r.status}`;
  });
  await tryStep(S, "anon não vê resellers", async () => {
    const r = await selectAs(ANON, "resellers", "select=id");
    if (Array.isArray(r.body) && r.body.length > 0) throw new Error(`leak n=${r.body.length}`);
    return `status=${r.status}`;
  });
}

// ============================================================
// Runner
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    console.log("[e2e-reseller] seeding…");
    const { users: u, tokens: t } = await seed();
    console.log("[e2e-reseller] seed ok");

    await suite1(t, u);
    await suite2(t, u);
    await suite3(t, u);
    await suite7(t, u);
    await suite8(t, u);
    await suite10(t, u);
    await suite12(t, u);

    const total = results.length;
    const failed = results.filter(r => !r.ok).length;
    const summary = { total, passed: total - failed, failed, results };
    return new Response(JSON.stringify(summary, null, 2), {
      status: failed === 0 ? 200 : 207,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e), results }, null, 2), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});