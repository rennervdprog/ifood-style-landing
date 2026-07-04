# Plano de correção — Supabase externo (qkjhguziuchqsbxzruea)

Execução 100% via edge function `ext-sql-runner` (já existe, protegida por `x-admin-secret`). Cada fase é um SQL idempotente aplicado por Management API, com verificação depois via `supabase--linter` externo (ou re-audit).

Ordem estudada para minimizar risco: começa por correções que não afetam runtime (search_path, buckets), depois RLS/policies, depois views SECURITY DEFINER (mudança de comportamento), e por último a otimização de performance (a maior, mas totalmente reversível).

---

## Fase 1 — Segurança de baixo risco (rápido, sem risco de quebrar app)

**1.1 Fixar `search_path` nas 7 funções sem search_path**
- Levantar a lista exata via linter (`function_search_path_mutable`).
- Para cada uma: `ALTER FUNCTION public.<fn>(<args>) SET search_path = public, pg_temp;`

**1.2 Mover extensão `unaccent` para schema `extensions`**
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
```
Verificar se algum código chama `unaccent(...)` sem schema — ajustar para `extensions.unaccent(...)` OU adicionar `extensions` ao `search_path` global.

**1.3 Ativar proteção de senhas vazadas (HIBP)**
- Via Management API: `PATCH /v1/projects/{ref}/config/auth` com `password_hibp_enabled: true` (ou setting equivalente do Auth).

**1.4 Buckets públicos — desabilitar listagem**
Para `avatars`, `products`, `store-banners`, `store-logos`: manter `public = true` (leitura por URL continua ok) e revisar a policy de `storage.objects` que permite `SELECT` (listagem) por anon. Substituir por policy que só permite leitura direta por path conhecido (i.e., remover a policy de listagem anon; a leitura via CDN pública não depende dela).

---

## Fase 2 — RLS ausente (3 tabelas)

Sem policies com RLS ligada → tabela invisível para clientes. Decidir por tabela:

- **`_sync_test`** → tabela de teste. Ação: `DROP TABLE public._sync_test` (se realmente não usada) OU manter bloqueada.
- **`asaas_subaccounts_registry`** → só backend/edge functions. Manter RLS on, sem policy (service_role já bypassa RLS). Sem ação necessária além de documentar.
- **`whatsapp_send_log`** → idem, só backend. Manter RLS on sem policy.

Entregável: comentário `COMMENT ON TABLE ... IS 'Backend-only, acessada apenas via service_role';` nas duas últimas.

---

## Fase 3 — Views `SECURITY DEFINER`

`stores_public` e `stores_driver_view` executam com privilégios do dono, ignorando RLS de `stores`.

Ação:
```sql
ALTER VIEW public.stores_public SET (security_invoker = true);
ALTER VIEW public.stores_driver_view SET (security_invoker = true);
```
Depois validar que as policies de `stores` permitem os acessos que essas views precisam (anon lê loja pública, driver lê lojas atribuídas). Se algo quebrar, adicionar policy correspondente em `stores` em vez de reverter para DEFINER.

Teste após deploy: abrir home do cliente (lista lojas) e painel do entregador.

---

## Fase 4 — Performance (493 achados)

**4.1 `auth_rls_initplan` (249 policies)**
Trocar `auth.uid()` por `(select auth.uid())` em cada policy — força o Postgres a avaliar uma vez por query em vez de por linha. Ganho enorme em `orders`, `order_items`, `products`, `profiles`.

Estratégia: gerar script que lê `pg_policies`, para cada policy com `auth.uid()` no `qual`/`with_check` faz `ALTER POLICY ... USING ((select auth.uid()) = ...)`. Aplicar por tabela, começando pelas maiores.

**4.2 Policies duplicadas (173)**
Consolidar policies múltiplas da mesma ação/role em uma única. Levantar via linter (`multiple_permissive_policies`) e unificar com `OR` entre as condições. Um `DROP POLICY` + `CREATE POLICY` por grupo.

**4.3 FKs sem índice (31)**
Para cada FK reportada:
```sql
CREATE INDEX IF NOT EXISTS idx_<tabela>_<coluna> ON public.<tabela>(<coluna>);
```
(Sem `CONCURRENTLY` para caber em migration; se preferir zero-lock, roda avulso via ext-sql-runner.)

**4.4 Índices não usados (34) + duplicados (6)**
- Duplicados: dropar o redundante (`DROP INDEX ...`).
- Não usados: revisar caso a caso — alguns podem ser recentes (pouca amostra). Dropar apenas os com >30 dias e `idx_scan = 0`.

---

## Execução e verificação

Cada fase = 1 chamada a `ext-sql-runner` (`action: run_sql`). Depois de cada fase:
1. Re-rodar linter externo (mesma rota do audit anterior).
2. Sanity check no app: home cliente, painel loja, painel entregador, checkout.
3. Reportar delta (quantos findings caíram).

Reversibilidade: fase 1–3 têm rollback trivial. Fase 4.1/4.2 mantém snapshot das definições antigas em comentário antes do ALTER.

## Detalhes técnicos

- Todas as mudanças rodam contra ref `qkjhguziuchqsbxzruea` via `EXTERNAL_SUPABASE_ACCESS_TOKEN` (secret já configurado).
- Nenhuma migration do Lovable Cloud é criada — o projeto interno segue intocado.
- Nenhuma mudança de código do app é esperada, exceto se `unaccent` for chamada sem schema (grep em `supabase/functions` e `src/`).
- Sem bump de versão do app (é infra).
