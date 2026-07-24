## Objetivo
Transformar o painel do revendedor (`/revendedor`, `/cliente`, `/pedidos`, `/perfil` quando logado como revendedor) em uma experiência premium — nível SaaS moderno, não "sistema antigo".

## Diagnóstico do que está simples hoje
- Cards genéricos shadcn sem hierarquia visual (tudo com o mesmo peso).
- Sem "hero" de ganhos — número principal se perde no meio de KPIs iguais.
- Link de indicação escondido em um card comum, sem destaque de CTA.
- Lista de indicações plana, sem status visual forte nem progresso do bônus (X/20 pedidos).
- Sem gráfico de evolução mensal / MRR acumulado.
- Sem ilustração/identidade — parece dashboard interno, não produto.
- Tipografia uniforme, sem contrastes fortes de tamanho/peso.

## Escopo da refatoração
1. **Hero "Ganhos" (topo)** — número gigante do disponível, delta do mês, botão "Sacar" destacado, mini-sparkline dos últimos 6 meses.
2. **Card do Link de Indicação premium** — bloco com gradiente sutil, QR-code ao lado, botões copiar/WhatsApp/Instagram, badge do código.
3. **KPI row redesenhada** — 4 métricas com ícones coloridos, deltas vs mês anterior, micro-animação ao carregar.
4. **Funil de indicações visual** — Cadastradas → Ativas → Gerando MRR, em formato de barra segmentada.
5. **Lista de lojas indicadas com progresso do bônus** — barra "12/20 pedidos p/ desbloquear R$ 150", status colorido, cidade + plano, mini-avatar.
6. **Gráfico MRR mensal** (Recharts) — linha/área dos últimos 6 meses.
7. **Timeline de últimas comissões** — feed vertical com ícones (bônus vs MRR).
8. **Estado vazio ilustrado** — quando 0 indicações, ilustração + CTA claro.
9. **Header fixo com identidade** — avatar, código do revendedor, status como pill colorida, ThemeToggle.
10. **Mobile-first refinado** — bottom-sheet para saque/PIX, cards com scroll horizontal onde couber.

## Design tokens
- Definir tokens semânticos novos em `index.css`: `--reseller-gradient`, `--reseller-surface`, `--reseller-glow`, `--success-soft`, `--warning-soft`.
- Paleta, tipografia e densidade serão escolhidas na próxima etapa (3 perguntas visuais).

## Arquivos afetados
- `src/pages/ResellerDashboard.tsx` — reescrita completa.
- `src/pages/revendedor/ResellerHome.tsx` — nova UI premium (visão mobile do `/cliente`).
- `src/pages/revendedor/ResellerIndicacoes.tsx` — nova UI da lista com progresso.
- `src/pages/revendedor/ResellerPerfil.tsx` — refino visual + bottom-sheet PIX.
- `src/index.css` — novos tokens.
- Novo componente: `src/pages/revendedor/components/` (HeroBalance, ReferralLinkCard, KPICard, FunnelBar, MrrChart, CommissionTimeline, StoreProgressRow, EmptyState).
- `src/lib/appVersion.ts` + `android/app/build.gradle` → **v1.25.15**.

## Fluxo
```text
1. Você escolhe paleta + tipografia + layout (3 perguntas visuais)
2. Eu gero 3 direções renderizadas do painel
3. Você escolhe uma
4. Eu implemento fiel ao protótipo escolhido
```

## Fora do escopo
- Regras de negócio (comissão, saque, bônus) — permanecem intactas.
- RPCs e schema do Supabase — não mudam.
- Fluxo de autenticação do revendedor.