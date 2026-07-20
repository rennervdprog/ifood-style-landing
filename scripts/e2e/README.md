# E2E — Delivery & PDV

Infra reutilizável para testes end-to-end autenticados contra o Supabase externo.

## Requisitos
- Dev server rodando em `http://localhost:8080`
- Secret `E2E_SETUP_TOKEN` disponível localmente na variável `E2E_SETUP_TOKEN`
- Python + Playwright (Chromium já instalado no sandbox)

## Renovar sessão (tokens expiram ~1h)
```bash
E2E_SETUP_TOKEN=xxx bash scripts/e2e/mint.sh
# grava em /tmp/browser/session.json
```

## Rodar E2E delivery
```bash
python scripts/e2e/delivery_full.py
# screenshots em /tmp/browser/delivery/shots/
```

## Rodar E2E PDV
```bash
python scripts/e2e/pdv_full.py
```

Usuário fixo: `e2e-admin@itasuper.test` — vinculado à loja `dudalanchesteste`.
Storage key Supabase: `sb-qkjhguziuchqsbxzruea-auth-token`.