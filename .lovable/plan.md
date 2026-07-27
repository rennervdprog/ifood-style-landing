# Plano — Deixar GPS/Endereço 100%

Objetivo: fechar os gaps restantes das Fases 1–4 e garantir consistência total entre card, busca, checkout, admin e tracking, tanto na web quanto no Capacitor.

---

## 1. Backfill de coordenadas (crítico)

Hoje `stores.latitude/longitude` e `saved_addresses.latitude/longitude` existem, mas lojas e endereços antigos ainda estão sem coord — a Fase 1 cai em Haversine × 1.3 para eles.

- Edge oneshot `backfill-coords` percorre `stores` e `saved_addresses` onde `latitude IS NULL` com CEP/rua preenchidos.
- Chama `geocode-address` (Nominatim, respeitando 1 req/s) e grava lat/lng + `pin_confirmed=false`.
- Log de resultado (quantos ok, quantos falharam) para o super admin.
- Roda 1x manual + agendada semanal (via `pg_cron` chamando a edge) para novas entradas sem trigger.

## 2. Trigger de geocode server-side

- Trigger `AFTER INSERT/UPDATE` em `stores` e `saved_addresses`: se coords nulas e CEP presente, marca `needs_geocode=true`.
- Worker (edge cron a cada 5 min) processa a fila em lote respeitando rate limit do Nominatim.
- Evita depender do front sempre passar coords.

## 3. Fluxo do PinPicker completo

- Cadastro de endereço do cliente (`SavedAddressPicker` novo endereço): abrir `AddressPinPicker` como passo obrigatório após CEP+número, gravando `pin_confirmed=true`.
- Cadastro/edição de loja (admin `SettingsTab`): mesma coisa, pino obrigatório na criação.
- Checkout: se endereço selecionado tem `pin_confirmed=false`, mostrar banner "Confirme o ponto exato" com botão que abre o PinPicker inline.
- Corrige o WARN do E2E anterior (botão de novo endereço não estava disparando o picker).

## 4. Divergência GPS × CEP visível

A edge `calculate-delivery-distance` já retorna `warning: gps_cep_diverge_Xkm`.

- Exibir banner amarelo no checkout quando `warning` presente: "Sua localização atual está a X km do CEP salvo — confirme o endereço de entrega".
- Ação do banner: abrir PinPicker ou trocar endereço.

## 5. Cache client-side e performance

- `useBatchStoreDistances`: cachear resultado em `sessionStorage` por `(customerCoords arredondado 4 casas, storeIds hash)` — evita re-chamar a edge a cada troca de aba.
- TTL 30 min. Invalida ao trocar de endereço.
- Debounce de 300ms ao rolar/filtrar na busca para não disparar múltiplos batches.

## 6. Consistência de leitura

Auditar e forçar todos os pontos a usarem `resolveDistance`/`useBatchStoreDistances`:

- `ClientHome.tsx`, `ClientBuscaPage.tsx`, `CityStoresPage.tsx`, `StoreCard.tsx`, `DiscoverGrid.tsx`, `CartPage.tsx`, tracking do pedido, admin de pedidos.
- Remover qualquer `haversineMeters` remanescente fora da edge (fica só como fallback interno).
- `formatDistanceKm` em 100% dos lugares (unidade única, 1 casa decimal).

## 7. Capacitor: permissão e precisão

- Ao abrir o app pela 1ª vez, se GPS negado, mostrar tela explicando por que precisa (já existe onboarding — só reforçar copy).
- `readGps` com `enableHighAccuracy: true` e timeout 8s (hoje varia).
- Se accuracy > 100m, sugerir usar o PinPicker automaticamente.
- Fallback: se GPS off/negado, usar CEP do endereço padrão salvo sem pedir de novo.

## 8. E2E completo do fluxo

Novo `scripts/e2e/gps_full.py`:
1. Login cliente → home mostra distância real (não Haversine).
2. Novo endereço → PinPicker abre → confirma → salvo com `pin_confirmed=true`.
3. Busca → cards mostram mesma distância do checkout (delta < 0,1 km).
4. Checkout → frete = km × preço/km da loja (auditar match).
5. Banner de divergência GPS×CEP dispara quando forçado.

Rodar no CI (`.github/workflows`).

## 9. Observabilidade

- Adicionar métricas na edge: contador de `osrm`, `osrm_cache`, `haversine_fallback`, `nominatim_fail`.
- Painel no super admin (`DebugLojaTab` ou nova aba): últimas 100 chamadas, % de fallback, lojas sem coord.
- Alerta se `haversine_fallback > 20%` no dia (indica OSRM caindo ou lojas sem coord).

## 10. Segurança e limpeza

- RLS: `saved_addresses.latitude/longitude` — confirmar que só o dono lê/escreve (herdado, mas validar).
- Rate limit por IP na `batch-store-distances` (hoje sem limite — evitar scraping de coords das lojas).
- Remover `console.log` de coordenadas em produção.
- Rodar `security--run_security_scan` ao final.

---

## Ordem de execução

1. Backfill (item 1) — resolve 80% dos casos de Haversine hoje.
2. Trigger + PinPicker obrigatório (2 e 3) — impede novos casos.
3. Banner divergência + cache (4 e 5) — UX.
4. Consistência de leitura (6) — auditoria final.
5. Capacitor + E2E + observabilidade + segurança (7–10).

## Fora de escopo
- Não troca de provider (Nominatim/OSRM ficam).
- Não muda cálculo de taxa (`describeStoreFee` intacto).
- Não mexe em tracking do entregador.

## Versão
Ao concluir tudo: bump `1.27.0` (marco: GPS/endereço 100%).
