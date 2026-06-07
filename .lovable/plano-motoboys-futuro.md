# Plano futuro — Motoboys (loja + plataforma)

Status: **arquivado**, não executar agora. Quando quiser começar, pedir "executar Parte 1 do plano motoboys".

## Parte 1 — Persistir motoboys da loja
Todo motoboy vinculado por lojista fica salvo no Supabase externo (qkjhguziuchqsbxzruea).

Falta implementar:
- Snapshot completo no `store_drivers` / `drivers`: `cpf`, `cnh`, `vehicle_type`, `vehicle_plate`, `pix_key`, `pix_type`, `birth_date`, `address`, `photo_url`.
- Trigger automático ao vincular motoboy à loja.
- Tabela `store_driver_history` (vínculos/desvínculos).
- View `driver_lifetime_stats` (entregas, ganhos, lojas).
- Auditoria em `admin_logs`.
- Conformidade LGPD (consentimento + exclusão).

## Parte 2 — Ativar motoboy de plataforma
Hoje não existe. Fases:

- **A:** reativar `/cadastro-entregador`, fila round-robin.
- **B:** subconta Asaas por motoboy, split automático (ex: 80% lojista / 20% plataforma).
- **C:** switch "modo plataforma" no `DriverDashboard`, geolocalização contínua, push de oferta (60s pra aceitar).
- **D:** documentos, avaliação, suspensão automática.

### Fluxo extra nas telas (mínimo, ~90% reaproveitado)
- **Aba Pedidos (lojista):** botão extra "Chamar plataforma" ao lado de "Meu motoboy" (auto-fallback opcional). Badge no card: 🛵 Plataforma / 🏠 Próprio. Botão "Cancelar chamado plataforma".
- **App Entregador:** switch Loja/Plataforma já existe — ativar lado Plataforma: tela "aguardando pedido" + popup de oferta (valor, distância, mapa). Tela de ganhos separada: "Da loja" (acerto com lojista) vs "Plataforma" (saque Asaas).

### Pagamento ao motoboy de plataforma
- **Pedido pago online:** Asaas faz split automático na hora. Sem dinheiro envolvido.
- **Pedido "pagar na entrega":** desabilitar opção **dinheiro** quando for motoboy de plataforma. Aceitar só:
  - Pagamento online antecipado, ou
  - **Pix na entrega via QR Code gerado no app** (Asaas cria cobrança instantânea, valor cai já com split → lojista recebe a parte dele automático, motoboy fica com a taxa).
- Motivo: motoboy de plataforma não tem maquininha do lojista e não pode ficar devendo dinheiro pra loja (risco de calote).

### Decisões pendentes
- Comissão da plataforma: 15%, 20% ou fixo R$ 2?
- Lojista escolhe entre próprio E plataforma no mesmo pedido, ou plataforma só como fallback?
- Cidade-piloto?

## Próximo passo
Nenhuma alteração de código agora. Quando quiser começar pela Parte 1, pedir explicitamente.