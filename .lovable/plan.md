# Plano — Investigar por que /cliente não mostra lojas

Sintoma: na home do cliente aparece "LOJAS EM ARARUAMA — 0 lojas / Nenhuma loja disponível em Araruama", enquanto "SUAS LOJAS" (Águia Pizzaria) aparece normalmente vindo do histórico de pedidos.

Isso indica que a lista principal (`suggestedStores`) está vindo vazia da edge function `public-store-catalog`, mesmo com lojas existindo na cidade. O plano abaixo isola em que camada a lista some.

## Passos de diagnóstico

1. **Confirmar o que o cliente pede**
   - Em `ClientHomeContent.tsx` a query `available-stores` chama `supabase.functions.invoke("public-store-catalog", { body: { city: effectiveCity, limit: 50, fallback_to_all: false, include_test: ... } })`.
   - `effectiveCity` = `userLocation.city` ou `profile.city`. Verificar o valor exato enviado ("Araruama", "araruama", com acento etc.).

2. **Testar a edge function diretamente**
   - Chamar `public-store-catalog` com `{ city: "Araruama", limit: 50, fallback_to_all: false }` e comparar com `{ fallback_to_all: true }` e sem `city`.
   - Se sem `city` retorna lojas e com `city: "Araruama"` retorna 0 → problema é o filtro de cidade (normalização/acento/coluna errada).

3. **Inspecionar o código da função**
   - Ler `supabase/functions/public-store-catalog/index.ts`: como filtra `city` (igualdade exata? `ilike`? qual coluna: `stores.city` vs `store_addresses.city`?), se filtra por `is_active`, `is_approved`, `plan_status`, etc.
   - Checar se recentemente algum campo (ex.: `is_visible`, `onboarding_status`) passou a ser exigido e derrubou as lojas.

4. **Conferir os dados no banco**
   - `select id, name, city, is_active, is_open from stores where city ilike '%arar%'` para ver quantas lojas existem e como a cidade está escrita.
   - Se a função lê de outra tabela/coluna (ex.: `store_addresses.city`, `service_cities`), consultar essa também.

5. **Checar logs da edge function**
   - `supabase--edge_function_logs` de `public-store-catalog` durante uma chamada real do app para ver `city` recebida, quantidade retornada e eventuais erros.

6. **Validar RLS / GRANTs**
   - Rodar `supabase--linter` e conferir se `stores` (e tabelas relacionadas) têm policy de SELECT pública e GRANT para `anon` — regressão comum após migrações recentes.

7. **Fechar o diagnóstico**
   - Com base nos passos 2–6, apontar a causa (uma das três hipóteses mais prováveis):
     a. Filtro de cidade case/acento-sensível na função.
     b. Novo filtro (is_active/plan_status/visibilidade) excluindo todas as lojas de Araruama.
     c. RLS/GRANT bloqueando SELECT anônimo em `stores`.
   - Só então propor o fix pontual (sem alterar UI).

## Observações
- Nada será alterado nesta etapa — é só auditoria. Depois do diagnóstico eu volto com o ajuste mínimo.
- Não mexer no fluxo de GPS já corrigido na v1.11.16.
