# Runbook de resposta a incidentes — ItaSuper

**Data de criação:** 23/11/2026 (auditoria de 40 itens, itens 34 e 35)
**Última revisão:** 23/11/2026
**Responsável pelo documento:** Muse (revisão e aprovação: Renner)
**Escopo:** plataforma ItaSuper — painel web, aplicativo do cliente, aplicativo do entregador, edge functions e banco de dados no Supabase.

Este documento é o plano de resposta a incidentes. Ele é curto de propósito:
o ItaSuper é operado por uma pessoa só (Renner), com o Muse executando.
Não há plantão, nem equipe de segurança — o runbook existe para que, na
hora do incidente, ninguém precise improvisar.

> Regra de ouro: **na dúvida, proteja os dados primeiro e avise depois.**
> Contenha o dano, registre o que aconteceu e só então comunique.

---

## 1. Papéis — quem faz o quê

| Papel | Quem | O que faz |
|---|---|---|
| Decisor | Renner | Decide conter/desligar, aprova comunicados externos, fala com ANPD, fornecedores e lojistas quando for o caso. Nenhum comunicado externo sai sem a palavra dele. |
| Executor | Muse | Diagnostica, executa as ações técnicas (desligar função, revogar chave, abrir chamado), redige os comunicados e mantém a linha do tempo. |
| Titulares/lojistas afetados | — | Recebem o comunicado quando a notificação for devida (ver seção 6). |

Ninguém mais tem acesso de escrita em produção. Se o Renner estiver
indisponível, o Muse contém o dano pelo lado técnico (desligar o que
está vazando/quebrado, revogar a credencial exposta) e deixa a decisão
de comunicar registrada para ele aprovar assim que voltar.

---

## 2. Severidades

| Severidade | O que é | Exemplos | Prazo de primeira resposta |
|---|---|---|---|
| **P1 — crítica** | Dados pessoais expostos ou em risco real de exposição; plataforma fora do ar; pagamento cobrando errado | Vazamento de dados; banco acessível sem autenticação; site/app fora do ar para todos; cobrança duplicada em massa | Imediata — conter primeiro, documentar depois |
| **P2 — alta** | Função central falhando para parte dos usuários; risco de perda de dados | Pagamento falhando (Woovi/Asaas); WhatsApp fora do ar; motoboy sem receber pedido; backup em risco | No mesmo dia |
| **P3 — localizada** | Bug isolado, sem exposição de dados e sem parar a operação | Erro numa tela só; relatório com número errado; falha num único lojista | Na próxima janela de trabalho |

A severidade pode subir durante o incidente. Se um P2 mostrar exposição
de dados, vira P1 na hora — não espera a próxima revisão.

---

## 3. Primeiros passos (valem para qualquer incidente)

1. **Anote a hora** em que o problema foi percebido e por quem/por qual canal.
2. **Classifique a severidade** (seção 2). Se houver dúvida entre P1 e P2, trate como P1.
3. **Contenha antes de investigar a causa.** Desligar o que vaza, revogar
   a chave exposta e tirar o recurso do ar são ações de contenção — não
   precisam de diagnóstico completo.
4. **Não apague nada.** Logs, registros e mensagens são evidência.
   Preservar é mais importante do que limpar.
5. **Abra a linha do tempo** (seção 7) e registre cada ação com hora.
6. **Avise o Renner** com: o que aconteceu, quem está afetado, o que já
   foi contido e o que falta decidir.

---

## 4. Passos por cenário

### 4.1 Vazamento de dados (P1)

Sinais: dados pessoais visíveis para quem não deveria ver; acesso
anônimo a tabela protegida; chave/segredo exposta em repositório, log
ou mensagem; relato de titular dizendo que viu dado de outra pessoa.

1. **Conter (imediato):**
   - Se for acesso indevido via API/banco: revogar a credencial ou
     fechar a rota/função que permite o acesso. Se for uma edge
     function, desligar ou fechar a validação dela.
   - Se for segredo exposto (chave, token, senha): revogar e gerar
     um novo no painel do fornecedor; nunca reutilizar o valor exposto.
   - Se for dado visível na interface: tirar a tela/recurso do ar
     até corrigir.
2. **Medir o alcance:** quais dados, de quantos titulares, por quanto
   tempo, e se houve acesso real (não só possibilidade). Consultar os
   logs de acesso do período.
3. **Preservar evidência:** salvar os logs e registros relevantes
   antes de qualquer correção que os apague.
4. **Decidir a notificação** com o Renner usando o checklist da
   seção 6. A Política de Privacidade (§9) compromete-se a comunicar
   ANPD e titulares afetados em até **3 dias úteis**.
5. **Corrigir a causa** (ex.: policy de RLS, `verify_jwt`, revogação
   de acesso) e só então reativar o recurso.
6. **Registrar** a notificação feita (data, canal, quem recebeu)
   na seção 7.

### 4.2 Plataforma fora do ar (P1)

Sinais: site ou aplicativo não abre; erro em todas as telas; pedidos
não chegam.

1. Abrir as páginas de status: **Supabase** — https://status.supabase.com
   e **Vercel** — https://www.vercel-status.com. Se o fornecedor
   confirmar incidente, não há correção local: avisar lojistas pelo
   canal disponível e acompanhar a página de status.
2. Se os status estiverem normais: verificar o último deploy
   (Vercel → Deployments) e o painel do Supabase (Database → Health,
   Edge Functions → Logs). Se o último deploy coincidiu com a queda,
   reverter para o deployment anterior.
3. Verificar se o projeto Supabase está ativo: uma falha de cobrança
   pode deixar o projeto com desligamento pendente. Conferir
   **Supabase → Settings → Billing** e a página de faturas antes de
   qualquer outra hipótese.
4. Avisar os lojistas afetados pelo canal disponível (WhatsApp do
   suporte) com previsão honesta — sem prometer hora se não houver.
5. Quando voltar: confirmar um pedido completo de ponta a ponta
   (vitrine → checkout → painel do lojista) antes de dar como resolvido.

### 4.3 Falha de pagamento — Woovi / Asaas (P2, vira P1 se houver cobrança errada)

Sinais: Pix não confirma; cobrança duplicada; webhook rejeitado;
fatura paga sem baixar no painel.

1. **Nunca mexer em dinheiro sem conferir o extrato.** Antes de
   reemitir cobrança ou marcar fatura como paga, conferir o que o
   fornecedor registrou (painel Woovi/Asaas) e o que o banco registrou
   (`financial_transactions`).
2. Verificar o webhook: painel do Supabase → Edge Functions →
   `woovi-webhook` / `asaas-webhook` → Logs. Erro 401/403 indica
   segredo/assinatura; erro 500 indica falha no processamento.
3. Se houver cobrança duplicada ou indevida: **não estornar por conta
   própria sem a palavra do Renner.** Registrar os IDs das cobranças
   e aguardar a decisão dele sobre estorno.
4. Se o pagamento do cliente foi confirmado no fornecedor mas não
   baixou no ItaSuper: registrar o pedido e o comprovante e corrigir
   a baixa manualmente pelo fluxo já existente — nunca criar pedido
   ou pagamento novo por fora do fluxo.
5. Comunicar os lojistas/clientes afetados com o valor, o pedido e o
   prazo de resolução.

### 4.4 WhatsApp fora do ar (P2)

Sinais: mensagens de pedido não chegam; auto-reply parado; sessão
da Evolution API inválida (401).

1. Verificar a saúde da sessão no painel da Evolution API e no
   `evolution-keepalive` (a sentinela registra `health_alert_at`).
2. Se a sessão estiver invalidada (401): **não fazer logout.** O
   procedimento é re-parear com o QR no celular do número conectado
   (passo do Renner ou da Ana, conforme o número).
3. Enquanto estiver fora: os pedidos continuam pelo site e pelo
   aplicativo — avisar os lojistas de que o WhatsApp está fora e que
   o pedido pelo link continua funcionando.
4. **Nunca disparar testes para o número da Ana** (linha viva do
   Pastelão). Testes só para o número do Renner.
5. Só a próxima mensagem real registrada em `whatsapp_inbound_log`
   prova que voltou — teste sintético não prova.

### 4.5 Supabase fora do ar (P1)

Sinais: banco, autenticação ou edge functions indisponíveis; erro de
conexão em todas as telas.

1. Confirmar em https://status.supabase.com se é incidente do
   fornecedor. Se for, acompanhar por lá — não há correção local.
2. Se o status estiver normal: verificar **Settings → Billing**
   (fatura em atraso pode suspender o projeto) e **Database → Health**.
3. Não tentar restaurar backup por cima do banco vivo. Restore só em
   projeto de teste, com a palavra do Renner.
4. Comunicar lojistas: pedidos pelo site/app ficam indisponíveis
   enquanto durar; avisar quando voltar e confirmar um pedido de
   ponta a ponta.

---

## 5. Contatos e canais

| Para quê | Onde |
|---|---|
| Status do Supabase | https://status.supabase.com |
| Status da Vercel | https://www.vercel-status.com |
| Painel do Supabase (projeto ItaSuper) | Painel do Supabase → projeto `qkjhguziuchqsbxzruea` |
| Painel da Vercel (deploys) | Painel da Vercel → projeto ItaSuper |
| ANPD — comunicação de incidente e orientações | https://www.gov.br/anpd/pt-br |
| Canal do titular (privacidade, direitos, incidentes) | `Itasupersuporte@gmail.com` (conforme Política de Privacidade §8 e §9) |
| Suporte aos lojistas | WhatsApp pessoal do Renner (canal de suporte real) |

---

## 6. Notificação de incidentes (item 35)

A Política de Privacidade (§9) compromete-se a comunicar a ANPD e os
titulares afetados em até **3 dias úteis** quando houver incidente de
segurança com dados pessoais. Este é o procedimento operacional.

### 6.1 Checklist de decisão — quando notificar

Notificar **ANPD e titulares** quando houver, ao mesmo tempo:

- [ ] Incidente de segurança confirmado (não só suspeita) envolvendo
      dados pessoais; **e**
- [ ] Risco real aos titulares (ex.: dados sensíveis expostos, dados
      acessíveis por terceiros, possibilidade concreta de uso indevido).

Notificar **só a ANPD** (e avaliar o titular caso a caso) quando:

- [ ] O incidente é confirmado, mas o risco ao titular é baixo
      (ex.: exposição breve, sem acesso real comprovado, dados já
      contidos antes de qualquer acesso).

**Não notificar** quando:

- [ ] Não houve exposição de dado pessoal (ex.: queda de sistema sem
      acesso a dados, falha de pagamento sem vazamento); **ou**
- [ ] A suspeita foi descartada após investigação, com registro do
      motivo.

Na dúvida, notificar. O custo de notificar sem necessidade é menor que
o de deixar de notificar um incidente devido.

### 6.2 Template de comunicado à ANPD

> **Assunto:** Comunicação de incidente de segurança com dados pessoais
> — ItaSuper (Renner Vinicius Dias — MEI, CNPJ 66.155.289/0001-26)
>
> 1. **O que aconteceu:** [descrição factual do incidente, sem
>    adjetivos — o que foi acessado/exposto e como foi descoberto].
> 2. **Quando:** [data e hora do início e do fim, ou da descoberta].
> 3. **Dados envolvidos:** [categorias — ex.: nome, telefone, endereço
>    — sem listar dados de titulares no comunicado].
> 4. **Quantos titulares afetados:** [número estimado e como foi calculado].
> 5. **Risco avaliado:** [qual o risco concreto para os titulares].
> 6. **O que já foi feito:** [contenção, revogação, correção].
> 7. **O que ainda será feito:** [correção definitiva e prazo].
> 8. **Contato do controlador:** `Itasupersuporte@gmail.com`.

Enviar pelo canal oficial da ANPD (https://www.gov.br/anpd/pt-br) e
guardar o protocolo.

### 6.3 Template de comunicado ao titular

Linguagem simples, sem jargão. Enviar pelo canal que o titular já usa
(e-mail ou WhatsApp), nunca por canal novo pedindo dado.

> Olá, [nome].
>
> Identificamos um problema de segurança no ItaSuper que pode ter
> atingido os seus dados. O que aconteceu: [uma frase, em linguagem
> simples].
>
> Os dados envolvidos foram: [categorias, ex.: nome e telefone].
>
> O que já fizemos: [contenção e correção].
>
> O que você precisa fazer: [ação concreta, se houver — ex.: trocar a
> senha; se não houver ação, dizer isso claramente].
>
> Se tiver dúvidas, fale com a gente em `Itasupersuporte@gmail.com`.
>
> ItaSuper

### 6.4 Registro das notificações

| Data | Incidente | Notificado | Canal | Protocolo/comprovante |
|---|---|---|---|---|
| — | — | — | — | — |

*(Nenhuma notificação feita até 23/11/2026.)*

---

## 7. O que registrar durante e depois do incidente

Toda ocorrência P1 ou P2 gera um registro com:

1. **Linha do tempo:** hora da descoberta, de cada ação e da resolução.
2. **O que foi afetado:** sistemas, lojistas, pedidos, titulares.
3. **Causa raiz:** o que de fato causou (não a hipótese inicial).
4. **Ações tomadas:** contenção, correção, comunicação.
5. **Lições:** o que muda para não repetir (código, processo ou documento).

O registro fica neste arquivo (seção 8) ou num arquivo próprio em
`docs/` quando o incidente for grande. Não apagar o registro depois —
ele é a evidência de que o incidente foi tratado.

### Histórico de incidentes

| Data | Severidade | O que foi | Resolução |
|---|---|---|---|
| — | — | — | — |

*(Nenhum incidente registrado até 23/11/2026.)*

---

## 8. Política de logs — o que pode e o que nunca pode ir para log (item 32, parte 3)

Regra geral: **log serve para diagnosticar, não para guardar dado pessoal.**
Se um dado não ajuda a entender o erro, ele não entra no log.

### Pode ir para log

- Identificadores internos opacos (IDs de pedido, de loja, de transação).
- Códigos de erro, status HTTP, tempo de resposta, nome da função/rota.
- Prefixo de token (ex.: primeiros caracteres) quando necessário para
  correlacionar — nunca o token inteiro.
- Contagens e agregados (ex.: "3 tentativas falhas por IP em 10 min").

### Nunca pode ir para log

- **CPF, documento, CNH, placa** (nenhum documento de identificação).
- **Senha, PIN, hash de PIN, token de acesso, segredo ou chave** —
  nem inteiro, nem parcial além do prefixo para correlação.
- **Chave Pix, dados de cartão, dados bancários.**
- **E-mail e telefone** de titulares, salvo quando estritamente
  necessário ao diagnóstico — e, nesse caso, mascarado
  (ex.: `r***@exemplo.com`, `(22) 9****-**97`).
- **Conteúdo de mensagem** do titular ou do lojista.
- **Localização precisa** (latitude/longitude) do motoboy ou do cliente.

### Onde a regra já existe no código

- `src/lib/logger.ts` silencia logs de informação em produção.
- `supabase/functions/payment-router/index.ts` mascara CPF.
- `supabase/functions/register-push-device/index.ts` registra só o
  prefixo do token.
- **Pendente (item 32, partes 1 e 2):** `beforeSend` no Sentry
  (`src/lib/sentry.ts`) para redigir dados sensíveis antes do envio, e
  varredura dos `console.log` das edge functions para tirar
  identificadores. A política acima vale desde já, mesmo antes dessas
  duas correções.

---

## 9. Revisão trimestral de acessos administrativos (item 38)

O ItaSuper tem **5 administradores** em `user_roles`. A revisão é
trimestral e é feita pelo Renner, com o Muse preparando a lista.

### Checklist (repetir a cada trimestre)

- [ ] Listar os 5 administradores atuais (nome, e-mail, data da concessão).
- [ ] Confirmar, um por um, se a pessoa ainda precisa do acesso.
- [ ] Remover o acesso de quem não precisa mais (tabela `user_roles`).
- [ ] Confirmar que ninguém tem autoatribuição de papel (a proteção
      "Prevent self role assignment" deve continuar ativa).
- [ ] Registrar abaixo a data da revisão e quem confirmou.

### Histórico de revisões

| Data da revisão | Quem confirmou | Resultado |
|---|---|---|
| — | — | Primeira revisão pendente — fazer junto com a Fase 0 da auditoria. |

**Observação:** a lista nominal dos 5 administradores não está neste
documento — ela vive no banco (`user_roles`) e é conferida na hora da
revisão. Não copiar nomes e e-mails de administradores para
documentos do repositório.

---

## 10. Decisões registradas (para não reabrir o assunto)

### 10.1 Sem token CSRF — decisão do item 7, parte 3

O ItaSuper **não implementa token CSRF**. Motivo: a autenticação usa
**Bearer JWT** (token no cabeçalho `Authorization`), não cookie de
sessão. CSRF explora o envio automático de cookies pelo navegador —
sem cookie de sessão, não há sessão para falsificar. A segunda camada
contra injeção de conteúdo é a CSP (item 4, ao vivo desde 21/11).
Se um dia a autenticação passar a usar cookie, esta decisão deve ser
revisada.

### 10.2 Pentest formal adiado — decisão do item 36, parte 3

O **pentest formal (teste de invasão por empresa externa) foi avaliado
e adiado**. Motivo: é um serviço pago e o porte da operação (MEI, agente
de pequeno porte) não o exige. O que existe no lugar: auditoria técnica
pontual (14/08/2026), auditoria de 40 itens (21/11/2026) com repetição
prevista a cada 3 meses (próxima em fevereiro/2027) e o job de
`security-checks` no CI (item 36, parte 1). Reavaliar se o volume de
lojistas ou o tratamento de dados sensíveis mudar de patamar.

### 10.3 Auditoria externa / certificação adiada — item 40

Ver `docs/conformidade-lgpd.md`: auditoria externa e certificações
(ISO 27001, SOC 2) foram avaliadas e adiadas — custam caro e o porte
não exige. A autoavaliação documentada é o caminho adotado.

---

## 11. Simulado de mesa

*Feito em 23/11/2026, na criação deste runbook: leitura do documento do
início ao fim imaginando um vazamento de dados real (P1) e uma queda da
plataforma (P1).*

### Cenário 1 — vazamento de dados (P1)

Leitura do fluxo: descobrir → conter → medir alcance → preservar
evidência → decidir notificação → corrigir → registrar. O que faltou
e foi ajustado durante o simulado:

1. **Faltava dizer quem revoga o quê.** O passo "revogar a credencial"
   não dizia onde. Ajustado: a contenção agora cita o painel do
   fornecedor e o desligamento da edge function como ações concretas.
2. **Faltava o caso "segredo exposto em repositório".** O cenário
   original só cobria acesso indevido. Ajustado: incluído como sinal
   de vazamento, com a regra de nunca reutilizar o valor exposto.
3. **Faltava o prazo da notificação no passo a passo.** O prazo de
   3 dias úteis estava só na seção 6. Ajustado: citado também no
   passo 4 do cenário 4.1.
4. **Faltava dizer o que fazer se o Renner estiver indisponível.**
   Ajustado: seção 1 — o Muse contém pelo lado técnico e deixa a
   decisão de comunicar registrada para aprovação.

### Cenário 2 — plataforma fora do ar (P1)

1. **Faltava a checagem de cobrança do Supabase.** A queda pode ser
   suspensão por fatura em atraso — e o projeto já esteve com
   desligamento pendente por isso. Ajustado: passo 3 do cenário 4.2
   e 4.5 manda conferir Billing/faturas antes de outras hipóteses.
2. **Faltava o critério de "voltou".** Ajustado: confirmar um pedido
   completo de ponta a ponta antes de dar como resolvido, nos
   cenários 4.2 e 4.5.

### O que o simulado não conseguiu testar

- O tempo real de re-parear o QR do WhatsApp e de reverter um deploy
  na Vercel — só um incidente real (ou um ensaio com o Renner) mede isso.
- Os contatos da seção 5 foram conferidos como URLs (páginas de status
  oficiais), mas nenhum chamado foi aberto — não há como testar o
  atendimento da ANPD ou do fornecedor sem um incidente real.

### Próximo simulado

Repetir a leitura de mesa na próxima revisão trimestral (fevereiro/2027,
junto com a auditoria dos 40 itens), de preferência com o Renner
escolhendo o cenário na hora.
