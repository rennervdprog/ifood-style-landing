# E2E Sistema de Revenda

Suite server-side que exercita todas as RPCs do sistema de revenda contra o
Supabase EXTERNO usando service_role + JWTs de usuários de teste.

## Rodar

```
curl -sS -X POST -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  https://<projeto>.supabase.co/functions/v1/oneshot-e2e-reseller | jq
```

Ou via tool `supabase--curl_edge_functions` no Lovable:
`path=/oneshot-e2e-reseller, method=POST`.

## Suites cobertas (Bloco 1)

| # | Suite            | Cobertura |
|---|------------------|-----------|
| 1 | register         | reseller_register (happy, duplicate, anon, dashboard-pending) + admin_reseller_list |
| 2 | admin_flow       | admin_reseller_set_status (approve/block) + role grant + admin_reseller_update_config + auth guard |
| 3 | referral_link    | reseller_lookup_code + reseller_attach_signup (RPC only; UI Playwright TODO) |
| 7 | dashboard        | reseller_get_dashboard + RLS self-read |
| 8 | withdrawal       | reseller_request_withdrawal (sem saldo, com saldo, duplicate pending) + admin_reseller_withdrawal_process (reject / paid) + baixa de comissões |
| 10| admin_analytics  | admin_reseller_summary / _commissions / _withdrawals / _referrals |
| 12| RLS              | isolamento por reseller_id + bloqueio de update de commission_rate + anon read |

## Suites TODO (dependem de Fase 5/6)

- 4 bounty       — precisa `reseller-check-activations` cron
- 5 recurring    — precisa `reseller-monthly-recurring` cron
- 6 gmv_bonus    — precisa `reseller-gmv-bonus` cron
- 9 fraud        — precisa `reseller-fraud-check` cron
- 11 landing     — precisa `/seja-revendedor`
- Playwright UI (dashboard revendedor + aba Super Admin) — após estabilizar fluxo headless

## Contas provisionadas (idempotente, senha `E2eReseller!2026`)

- `e2e-reseller-1@itasuper.test` — approved, code `RENAN2026` (rate 0.30 após suite 2)
- `e2e-reseller-2@itasuper.test` — pending, code `RESELLER2`
- `e2e-reseller-3@itasuper.test` — blocked, code `RESELLER3`
- `e2e-reseller-admin@itasuper.test` — role admin