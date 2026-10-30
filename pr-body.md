## Fase 1 — Navegação (super-admin-teste)

Só na cópia `/super-admin-teste`. O original não foi tocado.

**O que entra:**
- **Links diretos (`?aba=` e `?secao=`):** a URL sempre reflete a tela atual. Atualizar a página volta no mesmo lugar; dá para compartilhar/favoritar uma tela (ex.: `/super-admin-teste?aba=financeiro&secao=saques`). Abas antigas (`?aba=saques`, `?aba=cidades`...) continuam funcionando — mapeiam para a tela consolidada. Novo `src/lib/superAdminDeepLink.ts` (parse + build, com 7 testes).
- **⌘K com lojas e ações:** além das abas, a busca agora acha lojas por nome (abre a lista de Lojas) e ações rápidas — Novo cupom, Pedidos atrasados, Enviar notificação, Gerar cobrança de plano, Copiar relatório.
- **"Pedidos atrasados" (tela nova):** item no menu Início, com o número de atrasados. O card "Atraso" da Visão Geral agora é clicável e abre a lista: loja, pedido, status, valor e há quanto tempo está parado (mais parado primeiro). Usa os pedidos já carregados do dashboard (período do filtro Hoje/Ontem/7 dias).
- **Saques direto no celular:** o botão "Saques" da barra inferior abre o Financeiro direto na seção Saques, sem passar pelo redirecionamento de aba legada.

**Limite honesto:** escolher uma loja no ⌘K abre a lista de Lojas — ainda não pula direto para a loja dentro da lista (o campo de busca da lista é interno do componente; pular direto é follow-up da Fase 3, Lojas).

**Verificação:**
- `tsc -p tsconfig.app.json`: 0 erros
- Vitest: 329/329 (+7 novos de deep link)
- Diff: só `SuperAdminDashboardV2Teste.tsx` (+139/−18) + lib nova + teste novo. Original intacto.

**Não é publicação.** Merge main → production pede a palavra do Renner à parte.
