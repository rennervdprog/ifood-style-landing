# Checklist de Fumaça — ItaSuper

Roteiro manual de ~15 min para validar fluxos críticos das 3 personas
(Cliente, Lojista, Entregador) antes de cada release.

Pré-requisitos:
- 1 loja ativa (ex.: `/pizzaria-lagoinha`) com 1 produto, frete configurado.
- 1 entregador cadastrado com app aberto.
- 1 conta de cliente com endereço salvo.

---

## 1. Cliente — pedir e acompanhar
- [ ] Abre a URL pública da loja → catálogo carrega < 3s, sem CLS.
- [ ] Adiciona produto ao carrinho (com addons se houver).
- [ ] Vai ao checkout, escolhe endereço salvo → badge de precisão aparece (GPS / Endereço / CEP).
- [ ] Taxa de entrega é calculada e bate com o configurado pela loja.
- [ ] Paga via Pix → QR code é gerado.
- [ ] Após confirmação, `/cliente` mostra o pedido com status "Recebido".
- [ ] Status muda em tempo real conforme lojista/entregador atualiza.

## 2. Lojista — receber, despachar e PDV
- [ ] Notificação sonora dispara ao chegar pedido novo.
- [ ] Impressão térmica abre com layout correto (itens, addons, total, endereço, troco).
- [ ] Altera status para "Em produção" → "Pronto" → "Saiu para entrega".
- [ ] Despacha para entregador online disponível.
- [ ] Abre PDV → cria venda balcão com desconto + split de pagamento + impressão.
- [ ] Loja só fica aberta se houver entregador online (regra ativa).

## 3. Entregador — aceitar, rota e finalizar
- [ ] Fica online → aparece na lista de disponíveis do lojista.
- [ ] Recebe pedido → aceita.
- [ ] Mapa mostra rota real (OSRM, linha seguindo ruas), não linha reta.
- [ ] Botão "Abrir no Waze/Maps" funciona com multi-paradas (cap 10).
- [ ] Ao chegar < 120m do destino, app avisa chegada (geofence).
- [ ] Marca como entregue → status do cliente vira "Entregue".

---

## 4. Smoke automatizado
Roda `vitest run` localmente — esperado: **todos verdes**.
- `src/lib/__tests__/*` (utils, format, navUrls, thermalPrint)
- `src/lib/location/__tests__/*` (cache, cep, distance)
- `src/pages/pdv/state/__tests__/*` (usePdvCart)

## 5. Sinais a observar no console
- Sem `[Auth]` em loop.
- Sem 401/403 nas Network requests.
- Sem erros de geocode ou OSRM repetidos (fallback ativa, mas logar).