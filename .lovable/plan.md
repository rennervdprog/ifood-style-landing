# Plano de correção — PDV (only + add-on)

Escopo desta rodada: só as 3 correções mais impactantes já mapeadas no relatório. Melhorias de UX/recursos "PDV profissional" ficam pra próxima passada.

Backend = **Supabase EXTERNO** (via edge function oneshot com `EXTERNAL_SUPABASE_SERVICE_KEY` / `exec_sql`), não Lovable Cloud.

---

## 1. Gating real do PDV (bloquear acesso quando `enabled=false`)

Hoje `useStorePdvAccess` retorna `enabled` corretamente, mas as rotas `/admin/pdv` e `/admin/pdv/cardapio` **não checam** — qualquer loja abre o PDV mesmo sem addon/legacy/pdv_only.

**Correção (frontend):**
- Em `PdvPage.tsx` e `PdvCardapioPage.tsx`: usar `useStorePdvAccess(storeId)`; se `!enabled && !isLoading` → redirect pra `/admin?tab=plano` com toast "Ative o módulo PDV pra usar o caixa".
- Guardar também no menu lateral do admin (esconder item PDV quando `!enabled`).

Sem mudança de schema.

---

## 6. Limpar add-on residual ao trocar de plano

Quando super admin muda `pdv_only` → `essencial`/`autonomia` no `AdminStoreManager`, sobra `store_addons(addon_code='pdv', price_override=0)` → loja continua com PDV grátis eternamente.

**Correção (backend externo):** oneshot edge function que cria trigger:

```sql
CREATE OR REPLACE FUNCTION public.tg_cleanup_pdv_addon_on_plan_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.plan_type = 'pdv_only' AND NEW.plan_type <> 'pdv_only' THEN
    DELETE FROM public.store_addons
     WHERE store_id = NEW.id
       AND addon_code = 'pdv'
       AND price_override = 0;   -- só o brinde do pdv_only; add-on pago real preservado
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER stores_cleanup_pdv_addon
AFTER UPDATE OF plan_type ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.tg_cleanup_pdv_addon_on_plan_change();
```

Backfill: `DELETE FROM store_addons WHERE addon_code='pdv' AND price_override=0 AND store_id IN (SELECT id FROM stores WHERE plan_type <> 'pdv_only');`

---

## 7. Exibir "Somente PDV" na `PlanosPage` pública

`pdv_only` não está em `PLANS_ORDER` → invisível na página pública de planos.

**Correção (frontend):**
- `src/lib/plansInfo.ts`: adicionar `pdv_only` ao `PLANS_ORDER` (posição final, após `autonomia`).
- Conferir que o card já tem copy/preço corretos (R$ 69/mês, sem delivery, sem WhatsApp).

---

## Versão
Bump para **v1.15.50 (build 1010)** em `src/lib/appVersion.ts`, `src/pages/PerfilPage.tsx` e `android/app/build.gradle`.

## Segurança
Após aplicar, revisar rapidamente: trigger é `SECURITY INVOKER` (ok, roda no update do admin), sem RLS nova necessária.

## Fora deste plano (próxima rodada — "PDV profissional")
Atalhos de teclado completos, leitor de código de barras, sangria/suprimento com histórico rico, fechamento com conferência cega, relatório Z, integração fiscal (NFC-e), múltiplos caixas por loja, comandas/mesas, TTL no outbox, modo offline mais robusto.
