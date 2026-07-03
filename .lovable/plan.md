# Fase 3 — Resiliência offline do PDV

Objetivo: uma venda de PDV nunca se perde por queda de internet, timeout ou erro transiente, e nunca é duplicada quando reenviada.

Estratégia: fila local no navegador + idempotência garantida no banco. Zero mudança visível para o operador em rede boa. Rollout com backup e feature flag para reverter em 1 clique.

---

## Escopo (5 entregas)

### 1. Idempotência no banco (Supabase externo)
- Nova coluna `orders.client_uuid uuid` + índice único parcial `WHERE order_source = 'pdv' AND client_uuid IS NOT NULL`.
- RPC `pdv_finalize_sale` passa a aceitar `client_uuid` no payload. Se já existir um `orders` com esse `client_uuid`, a RPC retorna o `order_id` existente sem inserir nada (idempotente).
- Sem `client_uuid`, comportamento atual é preservado (compat).

### 2. Timeout + AbortController no checkout
- `usePdvCheckout` chama a RPC com `AbortController` de 3s.
- Timeout ou erro de rede não mostra erro ao operador: cai direto no passo 3 (enfileira).

### 3. Fila local `pdv_outbox` em `localStorage`
- Chave: `pdv_outbox_v1` (array de `{ client_uuid, payload, created_at, attempts }`).
- Escopo por loja (`pdv_outbox_v1:<store_id>`) para não misturar entre lojas.
- Limite defensivo: 200 entradas — se estourar, avisa e bloqueia novas vendas offline (evita corromper `localStorage`).
- Cupom térmico é impresso mesmo enfileirado (operador entrega o produto normalmente).

### 4. Badge "Sincronizar (N)" no `PdvTopbar`
- Contador da fila. Clique dispara flush manual (chama RPC uma por uma, remove da fila em caso de sucesso).
- Flush automático: no `mount`, em `window.addEventListener('online', ...)`, e a cada 30s enquanto houver itens.
- Toast de erro só depois de 3 tentativas falhas seguidas por item.

### 5. Feature flag + backup
- Flag no client: `localStorage.pdv_offline_queue_enabled` (default `true`, mas checável). Se `false`, comportamento antigo (erro na tela).
- Backup: migration inicia com `CREATE TABLE public.pdv_outbox_backup` (id, client_uuid, payload jsonb, store_id, created_at) — se algo der errado na RPC idempotente, um trigger `BEFORE INSERT` em `orders` salva cópia do payload para recuperação manual.
- Script de rollback pronto: `scripts/pdv-fase3-rollback.sql` (drop da coluna, drop do índice, revert da RPC para a versão da fase 1).

---

## Detalhes técnicos

### SQL (aplico no Supabase externo)

```sql
BEGIN;

-- 5.1 Backup: cópia de segurança de todo payload que passa pela RPC
CREATE TABLE IF NOT EXISTS public.pdv_outbox_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid uuid,
  store_id uuid,
  session_id uuid,
  payload jsonb NOT NULL,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pdv_outbox_backup TO authenticated;
GRANT ALL ON public.pdv_outbox_backup TO service_role;
ALTER TABLE public.pdv_outbox_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdv_outbox_backup owner" ON public.pdv_outbox_backup
  FOR SELECT TO authenticated USING (true);

-- 1. Idempotência: client_uuid em orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_uuid uuid;
CREATE UNIQUE INDEX IF NOT EXISTS orders_pdv_client_uuid_uniq
  ON public.orders (client_uuid)
  WHERE order_source = 'pdv' AND client_uuid IS NOT NULL;

-- 2. RPC v2: idempotente + salva backup
CREATE OR REPLACE FUNCTION public.pdv_finalize_sale(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_uuid uuid := NULLIF(_payload->>'client_uuid','')::uuid;
  v_existing_order uuid;
  v_order_id uuid;
  -- ... demais variáveis iguais à v1
BEGIN
  -- Idempotência: se client_uuid já foi processado, retorna o mesmo order_id
  IF v_client_uuid IS NOT NULL THEN
    SELECT id INTO v_existing_order FROM orders
     WHERE client_uuid = v_client_uuid AND order_source = 'pdv' LIMIT 1;
    IF v_existing_order IS NOT NULL THEN
      RETURN jsonb_build_object('order_id', v_existing_order, 'idempotent', true);
    END IF;
  END IF;

  -- Backup do payload (best-effort)
  BEGIN
    INSERT INTO pdv_outbox_backup (client_uuid, store_id, session_id, payload)
    VALUES (v_client_uuid, (_payload->>'store_id')::uuid,
            (_payload->>'session_id')::uuid, _payload);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- ... mesma lógica da v1 (insert orders/items/movements),
  -- mas passando client_uuid = v_client_uuid no INSERT de orders
  RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', false);
END; $$;
COMMIT;
```

### Client — arquivos novos/alterados

- `src/pages/pdv/state/pdvOutbox.ts` (novo): API pura da fila — `enqueue()`, `list()`, `remove()`, `flush(rpcCall)`.
- `src/pages/pdv/state/usePdvOutbox.ts` (novo): hook React que expõe `count`, `flushing`, `flushNow()`, e escuta `online`.
- `src/pages/pdv/state/usePdvCheckout.ts`: gera `client_uuid = crypto.randomUUID()`, tenta RPC com timeout de 3s, on-fail enfileira e retorna sucesso.
- `src/pages/pdv/components/PdvTopbar.tsx`: badge "Sincronizar (N)" quando `count > 0`.

### Testes Deno

Rodam via `supabase--test_edge_functions` (permissões `--allow-net --allow-env`). Estrutura escolhida para não exigir criação de edge function nova: os testes vivem em `supabase/functions/_shared/pdv_finalize_sale_test.ts` e batem direto na RPC do Supabase externo via `EXTERNAL_SUPABASE_URL` + `EXTERNAL_SERVICE_ROLE_KEY`.

Casos cobertos:

```
supabase/functions/_shared/pdv_finalize_sale_test.ts
  ✓ RPC retorna order_id em venda válida
  ✓ Reenviar mesmo client_uuid retorna { idempotent: true } e o MESMO order_id
  ✓ client_uuid null continua funcionando (backward-compat, cria order novo)
  ✓ Sessão fechada rejeita com erro claro
  ✓ Amount <= 0 é bloqueado pelo CHECK de pdv_movements
  ✓ Backup em pdv_outbox_backup foi gravado
```

Cleanup: cada teste usa um `session_id` de fixture criada no `beforeAll` e deleta no `afterAll` (orders/items/movements/backup).

---

## Rollout / rollback

1. Aplico SQL no Supabase externo (com backup ativo desde o insert 1).
2. Rodo testes Deno — se qualquer um falhar, executo `scripts/pdv-fase3-rollback.sql` e paro.
3. Deploy do client com feature flag `pdv_offline_queue_enabled=true`.
4. Se aparecer bug em produção: usuário abre DevTools e roda `localStorage.setItem('pdv_offline_queue_enabled','false')` → volta ao comportamento da Fase 2 sem redeploy.

## Fora de escopo (não entra nesta fase)

- Sincronização entre múltiplos terminais na mesma loja (fila é local por navegador).
- UI para inspecionar/editar o `pdv_outbox_backup` (só existe como rede de segurança).
- Reimpressão de cupom da fila (o cupom já foi impresso no momento da venda).

## Versão

Bump para `1.11.0` (feature) + `versionCode 754`.
