## Objetivo
Deixar a `/perfil` profissional, sem "opções decorativas". Cada item leva a uma rota/função real que já existe no ItaSuper.

## Nova estrutura (mobile-first)

### 1. Hero (mantém)
Avatar + nome + e-mail + badge do papel (Cliente/Lojista/Entregador/Admin) + contador de pedidos.

### 2. Acesso Rápido (contextual por papel)
Só aparece o que faz sentido para o usuário:
- **Cliente:** Meus Pedidos (`/pedidos`), Lojas (`/lojas`), Programa de Fidelidade (mostra selos por loja)
- **Lojista:** Painel da Loja (`/admin`), Financeiro, PDV (`/pdv`), KDS (`/kds`)
- **Entregador:** Painel do Entregador (`/entregador`), Ganhos (se autônomo)
- **Moderador:** Painel do Moderador (`/moderador`)
- **Admin:** Painel Administrativo (`/super-admin`)

### 3. Meus Dados (colapsável — já existe)
- Dados Pessoais (nome + CPF/CNPJ)
- Endereço de Entrega (com CEP + taxa estimada)
- Dados PIX (só lojista/motoboy)
- **Novo:** WhatsApp verificado (badge OK/Pendente)
- **Novo:** PIN de Entrega (mostra 4 dígitos mascarados + botão Alterar) — usa `delivery_pin` já existente

### 4. Preferências
- Tema Claro/Escuro (usa `ThemeToggle` já existente)
- Notificações Push (ativar/testar — chama `register-push-device`)
- Idioma/Região (informativo por enquanto — só PT-BR)

### 5. Ajuda & Suporte
- Central de Ajuda / FAQ (link para `/blog` categoria ajuda)
- Falar no WhatsApp (abre `wa.me` do suporte)
- Ver Tutorial Novamente (já existe)
- Reportar Problema (abre WhatsApp com contexto do usuário)

### 6. Sobre o ItaSuper
- Baixar Aplicativo (`/download` — só se web)
- Instalar PWA (já existe — só se elegível)
- Compartilhar o app (Web Share API com deep link)
- Blog / Novidades (`/blog`)
- Seja um Parceiro (`/cadastro-lojista` — só clientes)
- Planos (`/planos` — só lojistas)

### 7. Legal
- Termos de Uso
- Política de Privacidade
- Versão do app + botão "Verificar atualizações" (native)

### 8. Conta (perigo)
- Sair
- Excluir Conta (fluxo LGPD já existente)

## Regras de exibição
- Nada de item "coming soon". Se a rota não existe → não renderiza.
- Cada seção com header pequeno em uppercase (padrão atual).
- Badges de status (OK/Pendente) para Dados Pessoais, Endereço, PIX, PIN, WhatsApp.
- Contador dinâmico em Meus Pedidos (últimos 30 dias).

## Detalhes técnicos
- Arquivo: `src/pages/PerfilPage.tsx` (refactor incremental — mantém queries existentes).
- Adicionar novas queries: `useUserRole`, contagem de pedidos ativos, status do PIN.
- Novo componente `PinEditModal` reaproveitando `ClientPinChecker`.
- Botão "Notificações push" chama `pushRegistration.ts` já existente.
- Botão "Compartilhar app" usa `navigator.share` com fallback copiar link.
- Zero alteração de schema — tudo já está no Supabase externo.
- Bump de versão + `versionCode` no `build.gradle` ao concluir.

## Fora do escopo
- Alterar CartContext, AuthContext ou roteamento.
- Criar novas Edge Functions ou tabelas.
- Redesign do Hero (mantido igual).
