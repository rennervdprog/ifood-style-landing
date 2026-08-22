# ItaSuper Web — Handoff de Continuidade para Manus

**Repositório:** `rennervdprog/ifood-style-landing`  
**Branch de referência:** `main`  
**Último commit no momento deste handoff:** `0edd87a1` — `feat(menu): streamline product registration`  
**Escopo deste repositório:** plataforma web ItaSuper, incluindo vitrine pública, checkout do cliente, painel do lojista e integrações Supabase.  
**Fora de escopo:** aplicativo Android de entregador; qualquer alteração nele deve ser tratada no chat e repositório próprios.

> Este documento é um estado operacional para retomada de trabalho por um novo agente. Leia-o antes de modificar pagamentos, reembolsos, disponibilidade de entregadores, produtos farmacêuticos, cadastro de lojistas ou fluxo de cardápio.

## Regras obrigatórias de trabalho

| Regra | Aplicação prática |
|---|---|
| Commits isolados | Cada funcionalidade deve ter seu próprio commit; nunca incluir relatórios temporários, scripts de auditoria, `dist`, logs ou payloads em JSON. |
| Publicação | Não criar commit ou `push` sem autorização explícita do usuário para publicar. |
| Supabase | Toda alteração no banco deve ser entregue por migration SQL versionada. Não aplicar SQL manual em produção. |
| Segurança | Nunca versionar chaves, senhas, Base64 de keystore, tokens, dados pessoais, contas de teste ou arquivos de ambiente. |
| Regulação | Interface de Farmácias não equivale a dispensação, validação de receita ou conformidade sanitária. Não prometer nem implementar esses processos sem especificação formal e revisão jurídica/sanitária. |
| App entregador | Não modificar nem publicar o app entregador neste repositório ou neste chat. |

## Arquitetura e referências principais

| Área | Referências principais |
|---|---|
| Cardápio do lojista | `src/components/MenuBuilder.tsx`, `src/components/menu/ProductSheet.tsx`, `src/components/menu/ProductCard.tsx`, `src/components/CategoryProductFields.tsx` |
| Carrinho e checkout | `src/contexts/CartContext.tsx`, `src/pages/CheckoutPage.tsx`, `src/components/ProductDetailModal.tsx` |
| Catálogo público | `src/pages/StorePage.tsx`, `src/components/menu/ProductCard.tsx` |
| Integração de pedidos | funções/RPCs Supabase chamadas pelo frontend; preservar o desenho de escrita restrita de pedidos |
| Migrations | `supabase/migrations/` |
| Testes | `./node_modules/.bin/vitest run` |
| Build web | `./node_modules/.bin/vite build` |

## Estado funcional já publicado

### Segurança de pedido e pagamento

O commit `bd38ba5c` corrigiu pontos críticos do fluxo web: a confirmação de pagamento deixou de depender de uma simulação PIX no cliente e escritas legítimas de pedidos foram centralizadas em RPCs restritas. A regra operacional continua sendo: **pedido PIX só segue para preparo depois de confirmação financeira canônica no servidor/webhook**.

Não reintroduzir confirmação de PIX exclusivamente pelo frontend. Ao alterar pedidos, descontos, pagamentos ou status, verificar autorização no servidor e manter a trilha de auditoria.

### Reembolso

O fluxo publicado permite solicitação de reembolso financeiro somente para **PIX Direto confirmado**, pedido concluído e dentro de **24 horas**. Cartão, dinheiro, PIX de maquininha/PDV e demais pagamentos físicos não devem gerar reembolso financeiro automático pela plataforma. Os limites foram refletidos no web e no app cliente Android.

### Disponibilidade de entregador

A regra de presença adotada é **13 minutos**. Loja sem entregador operacional não deve sumir da descoberta: deve permanecer visível com aviso de entrega indisponível e bloqueio de finalização do pedido. A disponibilidade precisa ser decidida de modo consistente no servidor, web e app cliente. Não reduzir ou contornar essa regra somente no frontend.

### Farmácias

O commit `44dd71a5` publicou a experiência e proteções de Farmácias no web.

O contrato em `products.metadata` usa os campos abaixo.

| Campo | Valores ou uso |
|---|---|
| `pharma_type` | `medicine`, `personal_care`, `baby`, `vitamin_supplement`, `convenience`, `other` |
| `sale_mode` | `platform_checkout`, `pharmacy_validation`, `not_available_app` |
| `requires_prescription` | Indica item sujeito a receita |
| `controlled` | Indica item controlado |
| `active_ingredient`, `dosage`, `pharma_form` | Dados objetivos do produto |
| `manufacturer`, `pack_quantity`, `is_generic` | Metadados complementares de apresentação |

O painel do lojista possui cadastro guiado desses dados. No catálogo, itens restritos continuam visíveis para consulta, mas não podem ser adicionados ao carrinho/checkout comum quando tiverem `requires_prescription`, `controlled` ou `sale_mode` diferente de `platform_checkout`.

A proteção tem camadas no modal, carrinho e checkout web, além da proteção de banco descrita abaixo. Não remover nenhuma camada sem uma substituição equivalente validada.

### Migrations de Farmácia aplicadas

As migrations abaixo estão versionadas e **já foram aplicadas em produção**.

| Migration | Finalidade |
|---|---|
| `20260822111500_protect_restricted_pharmacy_checkout.sql` | Normaliza metadados farmacêuticos existentes e cria trigger que bloqueia `order_items` restritos em pedidos comuns. |
| `20260822113000_revoke_pharmacy_trigger_function_execute.sql` | Revoga execução pública, de `anon`, `authenticated` e de `service_role` da função interna de trigger. |

Foi confirmado que a função de trigger não possui execução por esses papéis. Não reaplicar migrations já registradas e não apagar essa proteção.

### Limitação conhecida de atomicidade

O trigger no banco bloqueia o item farmacêutico restrito em `order_items`. Os clientes web e Android historicamente criam cabeçalho de pedido e itens em chamadas separadas. Um cliente manipulado pode, em tese, criar um cabeçalho de pedido e ter a inserção posterior do item bloqueada, gerando pedido órfão. Os fluxos normais agora bloqueiam antes disso no cliente e o item restrito não é vendido.

A melhoria correta para atomicidade integral seria uma RPC única de checkout, transacional, que crie pedido e itens em conjunto. Isso é um trabalho **P1 futuro** e deve ser planejado com muito cuidado, pois afeta pagamentos, PIX, descontos, PDV, estoque e demais fluxos. Não implementar uma RPC ampla sem diagnóstico e autorização específicos.

## Melhoria mais recente: cadastro de produtos do lojista

O commit `0edd87a1` implementou melhorias do painel Cardápio a partir de auditoria ponta a ponta com conta de teste.

| Melhoria | Comportamento atual |
|---|---|
| Validação de edição | Editar produto agora exige nome não vazio, preço positivo e, quando aplicável, preço por kg válido. A criação e a edição usam a mesma validação. |
| Primeiro produto | Cardápio vazio oferece **Adicionar primeiro produto** sem exigir criar seção antes. |
| Seção de destino | Na criação, o painel mostra seletor de seção, informa explicitamente onde o produto será salvo e permite **Sem seção — organizar depois**. |
| Categoria acessível | O rótulo de categoria está ligado semanticamente ao seletor para leitores de tela. |
| Cobertura | `src/components/menu/ProductFormExperience.test.tsx` protege a acessibilidade e o destino por seção. |

A auditoria anterior encontrou que formulários avançados de algumas categorias podem ficar extensos. Uma melhoria opcional futura é separar campos em **Essencial para publicar** e **Detalhes avançados**, mas isso deve ser desenhado por categoria e validado com lojistas antes de esconder campos úteis.

## Testes e qualidade

| Comando | Estado conhecido |
|---|---|
| `./node_modules/.bin/vitest run` | Aprovado na última alteração do Cardápio: 21 arquivos e 162 testes. |
| `./node_modules/.bin/vite build` | Aprovado na última alteração do Cardápio/Farmácias. |
| `./node_modules/.bin/tsc -b --pretty false` | Ainda falha por três erros preexistentes e não relacionados: incompatibilidade de versões Sentry em `src/lib/sentry.ts` e imports lazy de `TermosDeUso`/`PoliticaPrivacidade` sem export default em `src/routes/lazyPages.ts`. Não tratar junto com alterações funcionais sem autorização específica. |

Sempre rodar `git diff --check`, a suíte Vitest e o build antes de solicitar ou realizar publicação. Se `tsc -b` continuar falhando apenas pelos três problemas conhecidos, registrar isso de forma transparente no resultado.

## Histórico resumido de commits relevantes

| Commit | Assunto |
|---|---|
| `0edd87a1` | Cadastro de produtos: validação, primeiro produto, seção e acessibilidade. |
| `44dd71a5` | Catálogo de Farmácias e bloqueio de checkout comum. |
| `bd38ba5c` | Proteção de confirmação PIX e escritas de pedidos. |
| `824d9f15` | Reembolso somente PIX Direto até 24 horas. |
| `058b228b` | Reestruturação inicial do fluxo de reembolso. |

## Checklist para a próxima sessão

1. Confirmar o repositório e a branch ativa com `git status --short` e `git log --oneline -3`.
2. Ler este documento e qualquer instrução nova do usuário antes de alterar arquivos.
3. Preservar as regras de PIX, reembolso, disponibilidade de entregador, Farmácia e segurança de pedido acima.
4. Para mudanças de Supabase, criar migration versionada, revisar e só aplicar depois de autorização explícita.
5. Rodar testes e build adequados ao escopo.
6. Nunca publicar automaticamente: pedir autorização explícita antes de `commit`/`push`, exceto se o usuário já tiver autorizado de modo inequívoco a publicação daquela alteração específica.
7. Atualizar este handoff quando uma mudança estrutural, uma migration aplicada, uma decisão de negócio ou uma limitação importante for concluída.

## Dados que nunca devem ser registrados neste arquivo

Nunca registrar chave de assinatura Android, senha de keystore, alias secreto, Base64, tokens de Supabase, variáveis `.env`, documentos pessoais, números de telefone, credenciais de contas de teste ou conteúdo de Secrets do GitHub.
