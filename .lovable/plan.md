# Sistema de Revenda — Fechamento final (v1.25.4 → v1.26.0)

Status: v1.25.3 no ar. Fases 1–5 completas + Fase 6 parcial (landing, ebook, scripts, botões manuais de cron).

---

## O que falta (agrupado por patch)

### v1.25.4 — Refinos Super Admin + Anti-fraude avançado
- **Cohort 3/6/12 meses** por revendedor (quantas lojas indicadas seguem ativas).
- **CAC efetivo**: `SUM(commissions.paid) / SUM(MRR gerado)` com alerta se CAC > 6× LTV.
- **Ranking por MRR trazido** (não só nº de lojas) com sparkline 6 meses.
- **Anti-fraude v2**: cruzar `stores.owner` CPF/CNPJ/user_id/device_id contra o próprio `resellers.user_id` via `signup_attempts`. Bloqueia referral + alerta.
- Nova RPC `admin_reseller_stats_v2()` (SECURITY DEFINER, admin-only) devolvendo cohort, CAC, ranking.

### v1.25.5 — Relatório mensal exportável
- Botão "Exportar CSV do mês" na `RevendedoresTab` do Super Admin.
- CSV: revendedor, PIX, valor total pendente, quebra bounty/recorrente, período.
- Marca tudo como `processing` ao exportar; botão "confirmar pagamento em lote" vira `paid`.

### v1.25.6 — Materiais visuais no dashboard
- Aba **Materiais** em `/revendedor`: 3 artes Andrômeda (stories/feed 1080×1920 e 1080×1080) via `imagegen--generate_image`.
- Placeholder de vídeo-tutorial (embed YouTube quando gravado).

### v1.26.0 — E2E Playwright ponta-a-ponta (bloco 2)
Novo script `scripts/e2e/reseller/full_ui_flow.py`:
1. Revendedor se cadastra em `/seja-revendedor` (form).
2. Admin aprova no Super Admin → aba Revendedores.
3. Lojista abre `/cadastro?ref=CODIGO` → cria loja `pdv_only` fake.
4. Injeta 20 pedidos entregues via `oneshot-e2e-reseller` (modo `seed_orders`).
5. Dispara `admin_reseller_run_bounty_cron(false)` → valida bounty criado.
6. Revendedor abre `/revendedor` → vê saldo → solicita saque R$ 150.
7. Admin marca como pago → comissões viram `paid`.
8. Assert visual em cada etapa (screenshots em `/tmp/browser/reseller/`).

Além disso, rodar novamente os E2E existentes que ainda não passaram no bloco 2:
- `scripts/e2e/reseller/` — suíte completa de RPCs (35/35 verde já).
- Playwright do fluxo público `/seja-revendedor` (SEO + formulário + JSON-LD).
- Playwright do landing `/cadastro?ref=` gravando `sessionStorage` corretamente.

---

## Ordem de execução

1. v1.25.4 (patch de código + migration para `admin_reseller_stats_v2` e anti-fraude v2).
2. v1.25.5 (patch UI + edge function `oneshot-reseller-csv-export`).
3. v1.25.6 (patch UI + gerar 3 artes).
4. v1.26.0 (script Playwright + rodar todos e reportar).

Cada patch bumpa `src/lib/appVersion.ts` + `android/app/build.gradle` (versionName + versionCode +1).

---

## Detalhes técnicos

- Todas as novas RPCs: `SECURITY DEFINER`, `search_path=public`, `REVOKE ALL FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated` (checa `has_role(auth.uid(),'admin')`).
- Cron de anti-fraude v2: estende `reseller_process_fraud_checks` existente com JOIN em `signup_attempts` por `cpf_cnpj_hash`, `device_id`, `user_id`.
- Export CSV: edge function que roda com service-role, aceita `?month=YYYY-MM`, devolve `text/csv`.
- Playwright: viewport 1280×1800, sessão Supabase injetada via `LOVABLE_BROWSER_SUPABASE_*`, screenshots por etapa.
- Registro dos runs em `reseller_cron_runs` (já existe) para auditoria.

---

## Aprovações que preciso

1. Confirmo **desligado** o GMV bonus 0,3% (5.3) — só implemento se pedir depois.
2. Export CSV em vez de PIX Asaas automático — ok? (você já disse que prefere manual).
3. Sigo do v1.25.4 até v1.26.0 sem parar entre patches, reportando no final?
