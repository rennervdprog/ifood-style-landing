# Plano: Experiência dedicada do Revendedor

Hoje, quando um usuário revendedor abre `/cliente`, `/pedidos` ou `/perfil`, ele vê a mesma UI de um cliente comum (comprar em lojas, pedidos de comida, perfil de consumidor). Isso não reflete a conta dele.

## Objetivo
Se o usuário logado é revendedor (linha em `resellers` com `user_id = auth.uid()`), essas 3 abas devem mostrar conteúdo do universo dele — não do universo cliente.

## Detecção do papel
- Criar hook `useIsReseller()` que consulta `resellers` por `user_id`, com cache via React Query (`staleTime` 5 min).
- Reaproveitar em `ClientHome`, `PedidosPage` e `PerfilPage` sem quebrar clientes normais.

## O que cada aba passa a mostrar

### 1. `/cliente` (Home)
Em vez de listagem de lojas/carrinho, renderiza um **ResellerHome** enxuto:
- Saldo a receber / próximo pagamento
- Lojas ativas indicadas (contagem + últimas 3)
- Link de indicação com botão "Copiar" e "Compartilhar WhatsApp"
- CTA grande "Abrir painel do revendedor" → `/revendedor`
- Bloco "Como funciona sua comissão" resumido

### 2. `/pedidos`
Vira **"Minhas indicações / conversões"**:
- Lista das lojas cadastradas via link do revendedor
- Status: Pendente bounty · Bounty pago · Recorrente ativa · Cancelada
- Data de cadastro, plano atual da loja, MRR gerado
- Filtro por status + busca por nome da loja

### 3. `/perfil`
Vira **Perfil de Revendedor**:
- Dados da conta (nome, email, telefone)
- Chave PIX para recebimento (editável)
- Histórico de repasses (últimos 6 meses) com status
- Link de indicação + QR code
- Sair da conta
- Remover blocos irrelevantes do cliente (endereços salvos, cupons de compra, fidelidade)

## BottomNav
`BottomNav` passa a exibir, para revendedor:
- Home (ResellerHome)
- Indicações (ex-Pedidos)
- Perfil
Ícones/labels ajustados (`Users`, `LinkIcon`, `User`).

## Arquivos afetados
- **Novo** `src/hooks/useIsReseller.ts`
- **Novo** `src/pages/revendedor/ResellerHome.tsx`
- **Novo** `src/pages/revendedor/ResellerIndicacoes.tsx`
- **Novo** `src/pages/revendedor/ResellerPerfil.tsx`
- `src/pages/ClientHome.tsx` — se revendedor, renderiza ResellerHome
- `src/pages/PedidosPage.tsx` — se revendedor, renderiza ResellerIndicacoes
- `src/pages/PerfilPage.tsx` — se revendedor, renderiza ResellerPerfil
- `src/components/BottomNav.tsx` — labels/rotas quando `isReseller`
- `src/components/AppHeader.tsx` — esconder "Entregar em" para revendedor

## Regras
- Admins e lojistas seguem inalterados (guards atuais têm prioridade).
- Se usuário for revendedor **e** cliente ao mesmo tempo, priorizar visão de revendedor nessas 3 rotas (ele já tem `/lojas` público para comprar).
- Sem migração de schema — só leitura de `resellers`, `reseller_referrals`, `reseller_commissions`, `reseller_payouts` (tabelas já existentes).
- Incrementar versão para **v1.25.14** ao implementar.

## Segurança
Revalidar que policies de `resellers` / `reseller_*` permitem apenas `SELECT` pelo próprio `user_id`. Nenhuma nova rota pública.
