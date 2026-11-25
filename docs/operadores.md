# Operadores — quem trata dados pessoais pelo ItaSuper (item 20)

**Data de criação:** 23/11/2026 (auditoria de 40 itens, item 20)
**Última atualização:** 23/11/2026
**Status geral: ⏳ ESQUELETO — os DPAs ainda faltam.**

> **LEIA PRIMEIRO:** este arquivo é um esqueleto. Ele lista os
> operadores nomeados no §5 da Política de Privacidade (v6.8) e o que
> cada um trata, mas **nenhum DPA (acordo de tratamento de dados),
> contrato ou termo de subprocessador foi localizado, baixado ou
> guardado até hoje.** A busca no repositório por `DPA`,
> `subprocessador` e `acordo de tratamento` retornou zero ocorrências
> (auditoria, item 20). Completar esta tabela é um **passo do Renner**:
> baixar/conferir os termos de tratamento de cada fornecedor no painel
> ou no e-mail do fornecedor e preencher as colunas de DPA/termos,
> link e data. Enquanto a tabela estiver com status "pendente", o item
> 20 continua NÃO VERIFICADO e os itens B4/C13 de
> `docs/conformidade-lgpd.md` continuam pendentes.

## Tabela de operadores

| Operador | O que trata | DPA / termos | Link | Data | Status |
|---|---|---|---|---|---|
| Supabase (hospedagem, banco de dados, autenticação, arquivos, edge functions) | Dados de contas, lojas, pedidos, endereços, mensagens e arquivos; autenticação (GoTrue) | — | — | — | ⏳ pendente — passo do Renner (DPA disponível no painel/contrato Pro) |
| Vercel (hospedagem do site/painel) | Dados de navegação e logs de acesso ao site e ao painel | — | — | — | ⏳ pendente — passo do Renner |
| Asaas (pagamentos) | Dados de cobrança, subcontas, transações, repasses e estornos | — | — | — | ⏳ pendente — passo do Renner |
| Woovi (pagamentos — Pix) | Dados de cobrança Pix, transações e conciliação | — | — | — | ⏳ pendente — passo do Renner |
| Mercado Pago (pagamentos, conforme o fluxo habilitado) | Dados de cobrança e transação quando o fluxo estiver habilitado | — | — | — | ⏳ pendente — passo do Renner |
| AbacatePay (pagamentos, conforme o fluxo habilitado) | Dados de cobrança e transação quando o fluxo estiver habilitado | — | — | — | ⏳ pendente — passo do Renner |
| Firebase / Google (notificações, analytics, mapas) | Tokens de push, eventos de uso do aplicativo (só com consentimento de analytics), dados de mapas | — | — | — | ⏳ pendente — passo do Renner |
| OneSignal (notificações) | Tokens e identificadores para envio de push, quando habilitado | — | — | — | ⏳ pendente — passo do Renner |
| Sentry (diagnóstico de erros) | Relatos de erro do aplicativo e do site, com redação de dados sensíveis a implementar (item 32) | — | — | — | ⏳ pendente — passo do Renner |
| OpenStreetMap / Nominatim (geocodificação e mapas) | Endereços enviados para conversão em coordenadas e cálculo de cobertura | — | — | — | ⏳ pendente — passo do Renner (serviço público; verificar os termos de uso) |
| WhatsApp / Evolution API (mensageria) | Mensagens transacionais e de suporte, quando a funcionalidade estiver habilitada (instância própria) | — | — | — | ⏳ pendente — passo do Renner (termos da instância própria) |
| Lovable / Google Gemini (Sales Coach — IA) | Conteúdo inserido voluntariamente pelo usuário no Sales Coach, exclusivamente para retornar a sugestão solicitada | — | — | — | ⏳ pendente — passo do Renner |

**Fonte da lista:** Política de Privacidade v6.8, §5 (destinatários) e
§10 (transferência internacional — Supabase, Vercel, Google/Firebase e
Lovable/Gemini, EUA, com cláusulas contratuais padrão).

## Se algum fornecedor não tiver DPA

Registrar a lacuna nesta tabela (coluna Status) e decidir se o
fornecedor é mantido. Não apagar a linha — a lacuna documentada vale
mais que o silêncio.

## Nota — criptografia em repouso (item 3)

O repouso dos dados é a **criptografia gerenciada do Supabase**
(criptografia do disco/banco feita pela plataforma; não há
criptografia em nível de coluna no código hoje). Isso fecha o item 3
para o porte atual. A criptografia em nível de coluna com `pgcrypto`
para `profiles.document` e `profiles.pix_key` é opcional, de esforço
grande e com risco de migração — só com a palavra do Renner.

## Nota — backups (item 31)

Backup e PITR do Supabase Pro só se confirmam no painel
(Database → Backups). **Não confirmado até 23/11/2026** — é passo do
Renner no painel. Anotar aqui a data da confirmação e do teste de
restore quando forem feitos (o restore é feito num projeto de teste,
nunca por cima do banco vivo).
