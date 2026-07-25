# Plano de UI/UX — /perfil

## Problemas atuais
- Header laranja ocupa muito espaço e o avatar do "Chat" flutuante sobrepõe o título "MEUS DADOS".
- Lista longa e monótona: "Acesso Rápido", "Meus Dados", "Ações" empilhadas sem prioridade visual.
- Status (OK / Pendente / Obrigatório) misturados sem agrupamento — cliente PDV vê seções irrelevantes (Endereço, PIX cliente).
- Sem indicador de progresso do cadastro / próximos passos.
- Versão e botão "Sair" perdidos no fim, sem destaque.
- Tokens semânticos ok, mas hierarquia tipográfica fraca (tudo `text-sm font-semibold`).

## Nova estrutura

```text
┌───────────────────────────────────────┐
│  Header compacto (h-32, gradient)     │
│  ← Avatar 64  Nome     [badge role]   │
│               email · telefone        │
├───────────────────────────────────────┤
│  Card "Complete seu cadastro"         │
│  ▓▓▓▓▓░░░ 3 de 5 · Continuar →        │  (só aparece se progresso < 100%)
├───────────────────────────────────────┤
│  Atalhos (grid 2x2, cards com ícone) │
│  [Pedidos] [Painel Loja]              │
│  [Endereço][Suporte]                  │
├───────────────────────────────────────┤
│  Seção "Conta"   (agrupada)           │
│   • Dados pessoais       ✓            │
│   • Endereço             ! Pendente   │
│   • Dados PIX            ! Obrigatório│
├───────────────────────────────────────┤
│  Seção "Preferências"                 │
│   • Tema (toggle inline)              │
│   • Notificações                      │
│   • Verificar atualização             │
├───────────────────────────────────────┤
│  Seção "Ajuda & Legal"                │
│   • Central de ajuda                  │
│   • Termos · Privacidade              │
├───────────────────────────────────────┤
│  Sair da conta  (btn ghost destaque)  │
│  ItaSuper v1.25.46                    │
└───────────────────────────────────────┘
```

## Mudanças por elemento

### 1. Header
- Reduzir altura (h-48 → h-32), remover blobs decorativos pesados.
- Gradient sutil `from-primary to-primary/80`, texto branco.
- Avatar 64px com iniciais + borda branca; nome em `text-lg font-black`, email em `text-xs opacity-80`.
- Badge do papel (Lojista / Cliente / Entregador / Revendedor) como pill translúcida.
- `ThemeToggle` movido para dentro da seção Preferências (não flutua no header).

### 2. Card de progresso de cadastro (novo)
- Só renderiza quando faltam itens obrigatórios.
- Barra de progresso + CTA "Continuar cadastro" que rola até primeiro pendente.
- Usa cor primária para reforçar ação.

### 3. Atalhos (grid, não lista)
- Grid `grid-cols-2 gap-3` de cards altos 96px com ícone grande + label.
- Cards contextuais por papel:
  - Cliente: Pedidos, Endereço, Favoritos, Suporte.
  - Lojista: Pedidos, Painel Loja, Financeiro, Suporte.
  - Entregador: Corridas, Ganhos, Documentos, Suporte.
  - Revendedor: Indicações, Saques, Materiais, Suporte.

### 4. Seções agrupadas
- Cada seção com título `text-[11px] uppercase tracking-wider text-muted-foreground` fora do card.
- `MenuRow` mantém, mas:
  - Adiciona divisórias sutis (`divide-y divide-border/50`) dentro do card.
  - Status vira `StatusBadge` alinhado à direita antes do chevron.
- Ocultar seções irrelevantes por papel (ex: PDV-only não mostra "Endereço de Entrega" nem "Dados PIX cliente").

### 5. Preferências
- Tema com toggle inline (Sol/Lua) na própria row, sem navegar.
- "Verificar atualização" com estado (última verificação, versão).

### 6. Sair e versão
- Botão `Sair da conta` em ghost com ícone, largura total, cor destructive.
- Versão em `text-[10px] text-muted-foreground/60 text-center` logo abaixo.

## Detalhes técnicos
- Arquivo: `src/pages/PerfilPage.tsx` (refator visual, sem alterar RPCs/queries).
- Extrair sub-componentes: `ProfileHeader`, `CompletionCard`, `QuickActionsGrid`, `SectionGroup`.
- Tokens: usar `hsl(var(--primary))` para gradient; `--muted`, `--border`, `--destructive` já definidos.
- Responsivo: max-w-md centralizado; grid 2x2 vira 4x1 em ≥sm.
- Reaproveitar `SignOutConfirm`, `ThemeToggle`, `MenuRow`, `StatusBadge`.
- Nenhuma mudança de lógica de negócio, apenas apresentação.
- Bump de versão + versionCode ao final.

## Fora do escopo
- Novas telas ou fluxos (edição de dados continua nos modais atuais).
- Alterações no BottomNav.
- Mudanças no back-end / RPCs.
