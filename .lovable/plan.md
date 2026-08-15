# Contrato único de endereço e localização — auditoria e plano

## 1. Auditoria (sem alterações)

**Fluxos que criam `orders`**

| Origem | Tipo | Coordenadas hoje |
|---|---|---|
| `src/pages/CheckoutPage.tsx` | delivery / retirada (cliente web e app) | insere com `client_lat/lng` possivelmente nulos e faz `UPDATE` assíncrono depois (linhas ~634-707 e ~788-797) |
| `supabase/functions/guest-checkout` | delivery convidado | herda o mesmo contrato do checkout |
| `src/pages/pdv/state/usePdvCheckout.ts`, `PdvPage.tsx`, `PdvDeliveryManualDialog.tsx` | presencial / delivery digitado no balcão | endereço textual, sem geocodificação |
| `supabase/functions/whatsapp-bot-handler` | delivery via bot | endereço textual |
| `AdminDashboardV2.tsx` | ajustes manuais | não define destino |
| funções e2e / pix / webhooks | testes e status | não definem destino |

**Achado principal:** só o checkout tenta geocodificar, e o faz depois do `INSERT`. O pedido pode ficar "pronto para entrega" sem destino (caso do pedido nº 31). PDV e bot criam entregas sem coordenada alguma.

**Colunas:** `address_details`, `neighborhood`, `delivery_city`, `client_lat`, `client_lng` já existem em `orders`. **Faltam `delivery_cep` e `delivery_state`.**

**Consumidores:** `StoreDriverView.tsx`, `PedidosPage.tsx`, `LiveTrackingMap.tsx`, `DriverRideHistory.tsx`, rastreio público — todos já leem `client_lat/lng` de `orders`; falta padronizar o fallback e o rótulo de distância.

## 2. Resolução central de endereço (proposta, não aplicada)

Edge Function `resolve-delivery-address` (verify_jwt em código, sem service_role no browser, sem expor chave de geocodificação):

- entrada: `{ street, number, complement, neighborhood, city, state, cep }`
- saída: `{ ok, normalized_address, cep, city, state, lat, lng, precision, reason }`
- ordem: CEP (ViaCEP) → geocodificação estruturada → fallback texto livre; `ok:false` explícito quando a precisão for insuficiente.

Migration proposta (também só após autorização):

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_cep text,
  ADD COLUMN IF NOT EXISTS delivery_state text;
```
Sem mudança de RLS e sem novo acesso público a `orders`.

## 3. Correção do checkout (fase autorizada)

1. Montar endereço estruturado a partir de GPS confirmado **ou** do endereço salvo escolhido — nunca sobrepor a escolha do cliente com o GPS atual.
2. Para `DELIVERY`, exigir rua, número, bairro e cidade antes de prosseguir.
3. Chamar `resolve-delivery-address` **antes** do `INSERT`.
4. Inserir o pedido já com snapshot completo (texto + CEP/cidade/UF + lat/lng).
5. Em falha: bloquear a criação, mostrar mensagem clara e abrir o pin/formulário manual já existente.
6. Remover o `UPDATE` assíncrono de coordenadas como caminho principal.
7. Retirada/presencial seguem sem geocodificação.

Pagamento, cupom, carteira, fidelidade, agendamento e notificações ficam intocados.

## 4. Consumidores web

`StoreDriverView.tsx`, `PedidosPage.tsx` e rastreio público passam a usar exclusivamente as coordenadas do pedido; sem recalcular pelo perfil do cliente. Distância exibida rotulada como estimativa em linha reta, exceto onde já há OSRM.

## Riscos e testes

- Pedidos antigos sem coordenada: manter leitura tolerante (exibir "sem localização") em vez de quebrar telas.
- PDV/bot continuam criando entregas sem coordenada até uma fase posterior (proposta como Fase 5).
- Testes: entrega por endereço salvo, entrega digitada, falha de geocodificação, retirada, alteração de perfil após compra, e fluxo lojista → entregador.

## Autorização

Nada será aplicado — nem migration, nem função, nem commit — antes da sua aprovação fase a fase.
