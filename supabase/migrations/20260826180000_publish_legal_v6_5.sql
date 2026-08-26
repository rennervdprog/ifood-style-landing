-- Publicação autorizada dos documentos legais finais v6.5.
-- Preserva todas as versões anteriores e ativa o reaceite por versão.
-- Não executa pedidos, pagamentos, cobranças ou transferências.

BEGIN;

UPDATE public.legal_documents
SET is_current = false
WHERE is_current = true
  AND kind IN ('terms', 'privacy');

WITH new_terms AS (
  INSERT INTO public.legal_documents (
    kind, version, version_num, effective_date, content_md, summary, is_current
  ) VALUES (
    'terms',
    '6.5',
    650,
    '2026-08-26T00:00:00-03:00'::timestamptz,
    $terms_v65$# Termos de Uso do ItaSuper

**Versão 6.5 — vigente a partir de 26 de agosto de 2026**

## 1. Quem somos e alcance destes Termos

O **ItaSuper** é uma plataforma digital de intermediação tecnológica operada por **Renner Vinicius Dias (MEI)**, inscrito no CNPJ sob o nº **66.155.289/0001-26**, com endereço físico na **Rua São Francisco, 635, Itatinga/SP**. Estes Termos regulam o uso do site, aplicações web, aplicativos móveis e demais interfaces ItaSuper por Clientes, Lojistas, motoboys indicados por Lojistas e demais pessoas cadastradas.

O ItaSuper disponibiliza infraestrutura tecnológica para apresentação de lojas e cardápios, realização e acompanhamento de pedidos, comunicação relacionada ao pedido, recursos de pagamento disponibilizados por parceiros, integração e apoio operacional à entrega, ferramentas de gestão para lojistas e, quando contratado ou habilitado, recursos como PDV, cupons, fidelidade, relatórios e suporte. Cada produto, oferta, loja, preço, prazo, área de entrega e forma de pagamento depende da configuração e da disponibilidade informadas no fluxo aplicável.

Ao criar uma conta, fazer um pedido, utilizar painel de loja, aceitar uma entrega ou continuar a utilizar a Plataforma após ser informado sobre uma versão vigente destes Termos, o Usuário confirma que leu e concorda com este documento. Estes Termos não afastam direitos assegurados por lei, especialmente os aplicáveis às relações de consumo.

## 2. Definições essenciais

Para estes Termos, **Cliente** é a pessoa que busca ou compra produtos e serviços por meio da Plataforma. **Lojista** é a pessoa física ou jurídica responsável pela loja, cardápio, oferta, preparo, atendimento do pedido e contratação da entrega. **Motoboy** é a pessoa escolhida e contratada pelo Lojista para realizar a entrega. **Pedido** é a solicitação de compra enviada pelo Cliente e sujeita à confirmação pela loja. **Plataforma** é o conjunto de interfaces e serviços tecnológicos ItaSuper.

O **Fornecedor** do produto é o Lojista identificado na tela da loja e no pedido. O **Processador de Pagamento** é a instituição ou empresa indicada no respectivo fluxo de pagamento, responsável pelos serviços financeiros que lhe compõem. **Dados Pessoais** têm o significado previsto na legislação brasileira de proteção de dados.

## 3. Cadastro, idade, acesso e segurança

O Usuário deve fornecer informações verdadeiras, completas e atualizadas e manter sigilo sobre senha, códigos de acesso e dispositivos autorizados. O Usuário deve comunicar pelo suporte qualquer suspeita de uso indevido da conta. O ItaSuper pode adotar controles de segurança, inclusive encerramento de sessões e verificação de dispositivo, para proteger contas e prevenir fraude.

A Plataforma não é destinada a menores de 16 anos. Pessoas entre 16 e 18 anos somente devem utilizá-la como Clientes com assistência e responsabilidade de pais ou responsáveis, conforme a legislação aplicável. O cadastro e a atuação como Lojista ou Entregador exigem capacidade civil compatível com as obrigações assumidas e, quando aplicável, documentos e autorizações legalmente exigidos.

O Usuário não pode criar conta em nome de terceiro sem autorização, compartilhar credenciais, inserir informação fraudulenta, tentar burlar controles de segurança, explorar falhas, coletar dados de modo automatizado sem autorização ou usar a Plataforma para finalidade ilícita.

## 4. Papel do ItaSuper, dos Lojistas e dos Entregadores

O ItaSuper atua como provedor de tecnologia e ambiente de intermediação digital. Salvo quando houver informação expressa em sentido diverso no fluxo específico, o ItaSuper não fabrica, armazena, prepara, embala ou vende os produtos anunciados pelos Lojistas.

O Lojista é responsável pela legalidade de sua atividade, disponibilidade, preço, descrição, composição, alergênicos quando exigíveis, qualidade, higiene, validade, preparo, emissão de documentos fiscais quando aplicável, atendimento e solução de problemas relativos aos produtos que oferece. O Lojista deve manter dados cadastrais, horários, área de atendimento, cardápio, estoque e restrições atualizados.

O ItaSuper **não possui entregadores próprios**. Cada Lojista escolhe, contrata, orienta e paga seu próprio motoboy fora da Plataforma. O aplicativo de entregador é apenas um meio opcional de integração, comunicação e apoio operacional. Contratação, forma de pagamento, CNH, veículo, documentos, seguros, encargos e demais condições do motoboy são definidos fora da aplicação e permanecem sob responsabilidade do Lojista e do motoboy, conforme os fatos e a legislação aplicável. A existência de funcionalidade tecnológica de roteirização, comunicação ou acompanhamento não substitui essas responsabilidades.

## 5. Oferta, pedidos, preços e disponibilidade

Antes da confirmação, o Cliente deve conferir a loja, os itens, complementos, quantidade, endereço, forma de pagamento, valor dos produtos, descontos, taxa de entrega, outras despesas apresentadas e valor total. O valor exibido no checkout é a referência da contratação daquele Pedido, salvo erro material evidente ou correção informada antes da confirmação.

A disponibilidade de produtos, horários, área de entrega, prazo estimado, mínimo de pedido e formas de pagamento é definida pela loja e pode variar. O envio do Pedido pelo Cliente representa uma solicitação de compra; a aceitação, preparação e atendimento dependem da confirmação da loja e das condições informadas na Plataforma.

O ItaSuper disponibiliza recursos para que o Cliente identifique e corrija dados antes de finalizar o Pedido e registra a confirmação do recebimento da solicitação. O histórico do Pedido pode ser acessado pelos meios disponibilizados na conta, preservadas as regras de retenção e privacidade.

## 6. Planos comerciais, taxas, mensalidades e cobranças de Lojistas

As formas de pagamento do Pedido exibidas no checkout dependem da configuração da loja e do Pedido e podem incluir **Pix Direto com comprovante, cartão e dinheiro**. O Cliente **não utiliza PIX online ItaSuper nem PIX na maquininha pelo checkout**. No Pix Direto, a transferência é feita para a chave informada pelo Lojista, fora da liquidação do ItaSuper; Cliente e Lojista devem conferir chave, valor, favorecido, comprovante e confirmação efetiva. Separadamente, na relação ItaSuper–Lojista, o PIX é utilizado para mensalidades e para cobranças de repasses acumulados. O ItaSuper não solicita nem armazena dados completos de cartão de pagamento quando o processamento é realizado diretamente pelo parceiro habilitado.

### 6.1. Valores e regras dos planos comerciais vigentes

A tabela abaixo explicita os valores e regras comerciais cadastrados como planos públicos ativos em **26 de agosto de 2026**. Os valores são expressos em reais (R$). Para lojas com proposta, contrato ou condição comercial individual, prevalecerá a condição específica que tiver sido formalmente acordada e apresentada ao Lojista.

| Plano ou módulo | Valor mensal | Regra de ativação e componentes previstos |
|---|---:|---|
| **Essencial** | **R$ 89,90/mês** | Para novos cadastros, período de análise de **60 dias** e gratuidade até o gatilho acumulado de **R$ 5.000,00**, conforme a oferta apresentada. Após o gatilho e o aviso aplicável, incide a mensalidade de R$ 89,90, sem retorno automático à gratuidade após a ativação; **0% de comissão por pedido online**; taxa da plataforma de **R$ 0,99 acrescentada à taxa de entrega**; e PDV conforme a configuração comercial vigente. |
| **Autonomia** | **R$ 199,90/mês** | Plano legado ou condição individual, não apresentado como opção de novo cadastro nesta revisão. Se aplicável a determinada loja, prevalecem a contratação e as regras formalmente apresentadas ao Lojista. |
| **Somente PDV** | **R$ 69,00/mês** | Sistema PDV para operação física e balcão, sem comissão por venda e sem taxa de plataforma por entrega. Não inclui vitrine pública, cardápio online ou serviços de delivery. |
| **PDV Add-on** | **R$ 49,00/mês** | Módulo adicional de PDV integrado ao plano Essencial quando habilitado. Lojas legadas ou com condição histórica/individual podem ter regra própria exibida no painel. O valor é adicionado à cobrança mensal enquanto o módulo estiver ativo. |
| **Plano individual** | Conforme proposta | Condições contratuais ou empresariais específicas acordadas com o estabelecimento, com valores, comissões e prazos definidos no instrumento correspondente. |

### 6.2. Alterações de preços, planos e regras comerciais

O ItaSuper poderá atualizar mensalidades, percentuais de comissão, taxas operacionais, limites de faturamento gratuito, valores de módulos ou regras dos planos. Qualquer alteração comercial será comunicada ao Lojista com antecedência mínima de **30 dias corridos** da entrada em vigor, por meio de aviso no painel, e-mail, WhatsApp ou notificação, informando claramente o **valor atual**, o **novo valor**, a **data de vigência** e a **forma de cancelamento ou migração**.

A alteração de preços ou taxas **não terá efeito retroativo** sobre ciclos de faturamento já quitados, pedidos já confirmados ou cobranças já vencidas sob a regra anterior, salvo correção de erro material evidente, prevenção a fraude ou imposição legal. Períodos de teste, campanhas promocionais ou gratuidade obedecerão às regras específicas divulgadas em sua oferta, cujo término não gera direito a reembolso ou cobrança retroativa.

Caso o Lojista não concorde com a alteração comunicada, poderá solicitar o cancelamento da assinatura ou a migração para outro plano compatível antes da data de vigência da mudança, sem incidência de multa de rescisão, ressalvada a quitação de valores devidos por serviços já prestados e pedidos já entregues.

O Lojista deve conferir os lançamentos exibidos no painel e comunicar eventuais divergências pelo suporte antes do vencimento. A taxa ItaSuper de **R$ 0,99**, acrescentada à taxa de entrega definida pelo Lojista e paga pelo Cliente, acumula-se no painel quando o pedido é recebido diretamente pelo Lojista em dinheiro ou PIX direto. A cobrança do valor acumulado é gerada via **PIX toda segunda-feira** quando o ciclo atingir **R$ 150,00**. O saldo pode gerar bloqueio operacional a partir de **R$ 500,00**, e uma cobrança não regularizada por mais de **30 dias** pode resultar em suspensão, conforme avisos e procedimentos do painel. Em caso de inadimplência, o ItaSuper poderá enviar avisos, restringir funcionalidades não essenciais ou suspender o acesso conforme a gravidade, o contrato comercial e a legislação, assegurando canal de atendimento para regularização e preservando o tratamento adequado de pedidos em andamento quando aplicável.

## 7. Cancelamentos, reembolsos e direito do consumidor

O Cliente deve solicitar cancelamento pelo fluxo disponível no Pedido ou pelo suporte. A possibilidade de cancelamento antes da confirmação ou durante o preparo pode depender do estágio operacional do Pedido; a Plataforma apresentará as opções disponíveis e registrará a solicitação.

Nas contratações à distância, o consumidor possui os direitos previstos na legislação aplicável, inclusive o direito de arrependimento nas hipóteses legais. O ItaSuper não utiliza estes Termos para afastar direitos por produto inadequado, vício, divergência da oferta, não entrega ou falha de serviço. A natureza do produto, o estágio de preparo, as condições da oferta e a legislação serão considerados no atendimento de cada solicitação.

Quando houver pagamento online elegível a estorno, o ItaSuper e/ou o Lojista encaminharão a solicitação ao parceiro de pagamento aplicável. O prazo efetivo de devolução pode depender do meio utilizado, da instituição financeira, do estágio da transação e das regras legais. Em pagamentos feitos diretamente ao Lojista, a solução financeira poderá exigir atuação do próprio Lojista, sem prejuízo da mediação e do atendimento disponibilizados pelo ItaSuper.

## 8. Obrigações do Cliente

O Cliente deve informar endereço e contato corretos, estar disponível para receber o Pedido, observar as condições exibidas no checkout, tratar Lojistas e Entregadores com respeito e não realizar pedidos fraudulentos ou abusivos. Quando o Pedido utilizar código de confirmação, o Cliente deve compartilhar o código apenas no momento adequado de recebimento e nunca com terceiros que não estejam envolvidos na entrega.

## 9. Obrigações do Lojista

O Lojista deve possuir autorização para operar o estabelecimento e comercializar os itens ofertados, observar normas sanitárias, de defesa do consumidor, fiscais e de proteção de dados que lhe sejam aplicáveis, e manter seus dados e informações comerciais atualizados. Produtos de farmácia, medicamentos ou produtos que exijam receita, validação profissional, idade mínima ou outro controle permanecem **bloqueados no checkout comum do ItaSuper** até que exista fluxo específico validado. O Lojista responde pelo conteúdo do cardápio, imagens, marcas e materiais que publicar, garantindo que possui os direitos necessários para utilizá-los.

O Lojista autoriza o ItaSuper a exibir seu nome comercial, marca, cardápio, fotos, preços, horários e informações necessárias para divulgar e executar seus pedidos enquanto a relação estiver ativa. Após o encerramento, o ItaSuper poderá manter informações estritamente necessárias para concluir pedidos pendentes, cumprir obrigações legais, resguardar direitos e remover conteúdos de caches, backups e índices dentro de seus ciclos técnicos aplicáveis.

Recursos de PDV, relatórios, cupons, fidelidade e comunicação são ferramentas de apoio. O Lojista continua responsável pela escrituração, obrigações fiscais, emissão de documentos e decisões comerciais que lhe cabem.

## 10. Motoboy contratado pelo Lojista e aplicativo de integração

O motoboy é escolhido, contratado, orientado e remunerado exclusivamente pelo Lojista, fora da Plataforma. O ItaSuper não possui entregadores próprios, não contrata, não remunera e não administra a relação entre Lojista e motoboy. O aplicativo de entregador é apenas uma ferramenta opcional para facilitar a integração, a comunicação e a atualização do status operacional.

A contratação, a forma de pagamento, a CNH, o veículo, os documentos, os seguros, os encargos e as demais condições do motoboy são definidos fora da aplicação e permanecem sob responsabilidade do Lojista e do motoboy, conforme a legislação aplicável. O motoboy deve utilizar os dados do Cliente somente para executar a entrega e proteger o Pedido. O ItaSuper não valida nem administra CNH, documentos, contrato, veículo ou pagamento do motoboy.

## 11. Comunicações, WhatsApp e notificações

O ItaSuper pode enviar comunicações transacionais relacionadas a cadastro, segurança, Pedido, pagamento, entrega, suporte e mudanças relevantes na Plataforma por e-mail, notificações do dispositivo, WhatsApp ou outros canais habilitados. O Usuário pode gerenciar permissões de notificação nas configurações do aplicativo ou do dispositivo; a desativação de comunicações não impede mensagens estritamente necessárias para segurança, execução do Pedido ou cumprimento de obrigação legal, quando admitidas pela legislação.

O Lojista que conectar seu próprio canal de WhatsApp é responsável pelo número, pelos modelos, pelo conteúdo e pelas comunicações que determinar. Mensagens de marketing exigem base legal e escolha apropriada do destinatário. O ItaSuper pode limitar, interromper ou bloquear integrações que apresentem risco de fraude, spam, abuso, violação de direitos ou descumprimento das regras do provedor de mensagens.

## 12. Recursos de inteligência artificial e decisões automatizadas

Alguns recursos podem utilizar inteligência artificial para gerar sugestões operacionais ou comerciais, como o Sales Coach. Essas sugestões são auxiliares e não substituem a avaliação humana, profissional, jurídica, contábil ou comercial do Usuário. Quem inserir conteúdo nesses recursos deve ter autorização para compartilhar os dados fornecidos e não deve inserir dados sensíveis, confidenciais ou de terceiros sem base legal adequada.

O ItaSuper pode utilizar mecanismos automatizados de prevenção a fraude e segurança. O Usuário pode solicitar informação e revisão humana de decisão que produza efeitos relevantes sobre seus interesses, pelos canais indicados na Política de Privacidade, observadas as limitações de segurança e prevenção a fraude previstas em lei.

## 13. Privacidade e dados pessoais

O tratamento de Dados Pessoais é descrito na **Política de Privacidade do ItaSuper**, que integra estes Termos. O Usuário pode exercer seus direitos e enviar dúvidas sobre dados pessoais para **Itasupersuporte@gmail.com** ou pelos canais de suporte indicados na Plataforma.

## 14. Propriedade intelectual e conteúdo

A marca ItaSuper, interfaces, software, textos, elementos visuais e demais ativos próprios são protegidos pela legislação aplicável. O Usuário recebe uma licença limitada, revogável, não exclusiva e intransferível para utilizar a Plataforma conforme estes Termos. É proibida a cópia, engenharia reversa, exploração comercial não autorizada ou remoção de avisos de propriedade intelectual, exceto quando a legislação permitir expressamente.

## 15. Limites de responsabilidade

Cada parte responde pelos danos que causar na extensão definida pela legislação aplicável. O ItaSuper não assume responsabilidade por fatos atribuíveis exclusivamente ao Lojista, Cliente, Entregador, instituição de pagamento, operadora de telecomunicações ou outro terceiro, como informação incorreta, indisponibilidade externa, falha de conexão, qualidade de produto, ato de entrega do motoboy contratado pelo Lojista ou descumprimento de obrigação do Lojista. Esta disposição não exclui responsabilidades que não possam ser excluídas por lei nem limita direitos de consumidores.

## 16. Suspensão, encerramento e alterações

O ItaSuper pode suspender ou encerrar contas em caso de fraude, violação destes Termos, risco de segurança, exigência legal ou prejuízo a terceiros, buscando comunicar a medida e oferecer canal de suporte quando isso não comprometer a segurança, a investigação de fraude ou obrigação legal. O Usuário pode solicitar exclusão da conta pelos meios disponibilizados, sujeito à conclusão de pedidos ativos e à retenção/anonimização necessária prevista na Política de Privacidade e na legislação.

Mudanças relevantes nestes Termos serão comunicadas por meio razoável, como aviso na Plataforma, e-mail ou notificação, antes de sua vigência quando a lei ou a natureza da mudança exigir. A versão atual e as versões anteriores relevantes poderão ser consultadas na Plataforma. Caso o Usuário não concorde com mudança que afete materialmente sua relação, poderá deixar de utilizar o serviço e solicitar encerramento, sem prejuízo de obrigações já constituídas.

## 17. Lei aplicável e foro

Aplica-se a legislação brasileira. Para relações de consumo, será respeitado o foro do domicílio do consumidor e as normas protetivas aplicáveis. Para relações empresariais, eventual foro contratual observará a legislação e a validade da relação concreta.

## 18. Atendimento

Dúvidas, solicitações, reclamações e pedidos de informação podem ser encaminhados pelo suporte disponível na Plataforma ou pelo WhatsApp **+55 22 99279-6291**. Para assuntos de privacidade, o canal é **Itasupersuporte@gmail.com**.

---

**Controlador/Operador da Plataforma:** 66.155.289 Renner Vinicius Dias (MEI) — CNPJ 66.155.289/0001-26.
**Última atualização:** 26 de agosto de 2026. **Vigência:** a partir de 26 de agosto de 2026, sujeita aos direitos legais aplicáveis e às condições específicas formalmente contratadas por Lojistas legados.
$terms_v65$,
    'Termos finais v6.5: intermediação tecnológica, Lojista responsável por produto e entrega, Essencial em janela móvel de 60 dias sem retorno automático, Somente PDV, taxa de R$ 0,99, repasse R$ 150/R$ 500/30 dias e Pix Direto do Cliente.',
    true
  )
  RETURNING id
), new_privacy AS (
  INSERT INTO public.legal_documents (
    kind, version, version_num, effective_date, content_md, summary, is_current
  ) VALUES (
    'privacy',
    '6.5',
    650,
    '2026-08-26T00:00:00-03:00'::timestamptz,
    $privacy_v65$# Política de Privacidade do ItaSuper

**Versão 6.5 — vigente a partir de 26 de agosto de 2026**

## 1. Quem controla os dados e como falar conosco

Esta Política explica como o **ItaSuper** trata dados pessoais ao disponibilizar seu site, aplicações web, aplicativos móveis e serviços relacionados. O controlador das operações de tratamento descritas nesta Política é **Renner Vinicius Dias (MEI)**, CNPJ **66.155.289/0001-26**, com endereço físico na **Rua São Francisco, 635, Itatinga/SP**, doravante denominado **ItaSuper**. **Renner Vinicius Dias é o responsável pelo canal de privacidade**, atendido pelo e-mail **Itasupersuporte@gmail.com** e pelo WhatsApp **+55 22 99279-6291**.

Para dúvidas, solicitações ou exercício de direitos previstos na Lei Geral de Proteção de Dados Pessoais — LGPD, o titular pode escrever para **Itasupersuporte@gmail.com** ou falar com o responsável pelo canal, **Renner Vinicius Dias**, pelo WhatsApp **+55 22 99279-6291**. O contato deve informar, quando possível, o nome, e-mail/telefone vinculado à conta, pedido realizado e a solicitação desejada. Poderemos pedir informação adicional razoável para confirmar a identidade e proteger os dados contra acesso indevido.

## 2. A quem esta Política se aplica e papéis no tratamento

Esta Política se aplica a Clientes, Lojistas, motoboys indicados ou contratados por Lojistas, visitantes e demais pessoas que utilizem ou interajam com a Plataforma. O ItaSuper é controlador quando decide as finalidades e os meios do tratamento necessários para operar a Plataforma, como cadastro, autenticação, segurança, suporte, notificações, prevenção a fraude e administração de funcionalidades próprias.

O Lojista normalmente decide finalidades relevantes do tratamento de dados de seus consumidores para preparar, entregar, atender e eventualmente divulgar seus próprios produtos. Conforme a atividade concreta, o Lojista poderá atuar como controlador independente ou compartilhar decisões com o ItaSuper em relação a uma operação específica. O papel de cada parte depende das finalidades e dos meios efetivamente definidos; esta Política não substitui a avaliação do caso concreto nem obrigações legais próprias do Lojista.

## 3. Quais dados podemos tratar

| Categoria | Exemplos de dados | Contexto de uso |
|---|---|---|
| Cadastro e contato | Nome, e-mail, telefone, senha protegida pelo serviço de autenticação, cidade e informações de perfil. | Criar conta, autenticar, prestar suporte e proteger o acesso. |
| Pedido e atendimento | Loja, itens, complementos, valores, endereço de entrega, contato, método de pagamento, status, código de confirmação e histórico do Pedido. | Enviar o Pedido à loja, organizar o atendimento e entrega, dar suporte e resolver disputas. |
| Localização | Endereço informado e, quando o Usuário permitir no aparelho, localização aproximada ou coordenadas. | Preencher endereço, calcular cobertura/rota quando habilitado e apoiar entrega. A permissão de localização pode ser alterada nas configurações do dispositivo. |
| Dispositivo e segurança | IP, navegador, sistema operacional, identificadores técnicos, registros de sessão, token de notificação e eventos de segurança. | Autenticação, prevenção a fraude, suporte técnico, estabilidade e notificações. |
| Lojistas | CPF/CNPJ, dados do estabelecimento, dados para recebimento e cobrança, cardápio, marca, imagens, planos, valores comerciais, informações de suporte e configurações comerciais. | Operar a loja, cumprir obrigações comerciais, gerar cobranças, relatórios e integrar pagamentos. |
| Motoboys indicados ou contratados pelo Lojista | Dados mínimos de identificação e contato, dados de entrega, endereço e status operacional, quando o Lojista utilizar o aplicativo de integração. | Facilitar retirada, entrega, comunicação e atualização do Pedido. O ItaSuper não contrata, remunera, verifica CNH ou administra documentos, veículo ou contrato do motoboy. |
| Comunicação e suporte | Chamados, mensagens, registros de atendimento, confirmação de envio de notificações e comunicações por canais habilitados. | Responder solicitações, registrar atendimento, prevenir abuso e aperfeiçoar o serviço. |
| Conteúdo enviado a IA | Conversas ou textos que o administrador/lojista voluntariamente inserir no recurso Sales Coach. | Gerar sugestão de comunicação comercial. Não insira dados sensíveis, dados financeiros, senhas, documentos ou dados de terceiros sem autorização e base legal adequada. |

No checkout do Cliente, os métodos atualmente previstos são **Pix Direto com comprovante, cartão e dinheiro**. O Cliente não utiliza PIX online ItaSuper nem PIX na maquininha pelo checkout. No Pix Direto, o comprovante e os dados de conferência podem ser enviados à loja; a transferência ocorre fora da liquidação do ItaSuper. PIX online é reservado à relação financeira entre Lojista e ItaSuper, como mensalidades e repasses. O ItaSuper não solicita o número completo do cartão quando o pagamento online é coletado diretamente pelo parceiro de pagamento. Se o Usuário fornecer informação opcional em campos livres, poderá tratar-se de dado pessoal adicional; por isso, pedimos que evite compartilhar dados sensíveis ou dados de terceiros sem necessidade.

## 4. Por que tratamos dados e qual é a base legal

Tratamos dados pessoais quando necessário para executar o contrato ou procedimentos preliminares solicitados pelo Usuário, como criar conta, processar Pedido, organizar entrega pelo Lojista ou pelo motoboy por ele indicado, disponibilizar suporte e administrar serviços contratados pelo Lojista. Também podemos tratar dados para cumprir obrigações legais e regulatórias, especialmente registros necessários a obrigações fiscais, financeiras, prevenção a fraude e atendimento de requisições de autoridades competentes.

Quando o tratamento for necessário para segurança, prevenção a fraude, integridade da Plataforma, suporte técnico, auditoria e melhoria de serviços, poderemos utilizar o legítimo interesse, após avaliação de necessidade, proporcionalidade e impacto nos direitos do titular. Quando a legislação exigir consentimento, inclusive para determinada permissão do dispositivo ou comunicação opcional, apresentaremos a solicitação aplicável; o consentimento pode ser revogado pelos meios informados, sem afetar tratamentos já realizados com base válida.

Mensagens transacionais relacionadas a Pedido, segurança ou execução de serviço podem ser enviadas pelo canal habilitado, quando necessárias à operação. Comunicações promocionais devem observar a base legal aplicável e oferecer opção de recusa. O Lojista é responsável pelas campanhas e mensagens de marketing que definir para seus clientes.

## 5. Com quem os dados podem ser compartilhados

Compartilhamos apenas os dados necessários para a finalidade correspondente, observando controles e obrigações aplicáveis.

| Destinatário ou categoria | Finalidade do compartilhamento |
|---|---|
| Lojista responsável pelo Pedido | Receber e atender o Pedido, preparar produtos, organizar a entrega com seu próprio motoboy, contato operacional e suporte ao consumidor. |
| Motoboy indicado pelo Lojista, quando o aplicativo de integração for utilizado | Dados mínimos para retirar e entregar o Pedido, como identificação, endereço, contato operacional e status. O compartilhamento é limitado ao necessário para a entrega; o motoboy é contratado e gerido pelo Lojista, fora do ItaSuper. |
| Processadores de pagamento e instituições financeiras indicados no fluxo | Criar cobranças, processar pagamentos, administrar subcontas, conciliar transações, repasses, estornos ou obrigações de segurança. Podem incluir, conforme o fluxo habilitado, parceiros observados na configuração, como Woovi, Asaas ou outro fornecedor apresentado ao Usuário. O Pix Direto do Cliente ocorre fora da liquidação do ItaSuper. |
| Hospedagem, banco de dados, autenticação e arquivos | Provedores técnicos como Supabase e Vercel, necessários para armazenar e disponibilizar a Plataforma. |
| Notificações e diagnóstico | Provedores como Firebase/Google, OneSignal e Sentry, quando habilitados, para enviar notificações, medir estabilidade e diagnosticar falhas técnicas. |
| Geocodificação e mapas | Serviços de mapas/geocodificação, como OpenStreetMap/Nominatim, quando necessários para converter endereço em coordenadas ou calcular cobertura. |
| Mensageria | Integrações de WhatsApp e seus provedores técnicos, quando o Usuário ou Lojista habilitar a funcionalidade de comunicação. |
| Recurso Sales Coach | O conteúdo voluntariamente inserido pelo Usuário é enviado ao gateway de IA Lovable, configurado para utilizar modelo Google Gemini, exclusivamente para retornar a sugestão solicitada. |
| Autoridades, consultores ou defesa de direitos | Quando exigido por lei, ordem válida, prevenção/investigação de fraude ou necessário para exercício regular de direitos. |

O ItaSuper não vende dados pessoais. Não autorizamos o uso de dados pelos fornecedores para finalidade incompatível com o serviço prestado, ressalvadas hipóteses em que o próprio fornecedor atue como controlador sob sua política e obrigação legal, como pode ocorrer com instituições de pagamento.

## 6. Cookies, armazenamento local e notificações

A Plataforma pode utilizar cookies, armazenamento local do navegador, armazenamento seguro do aplicativo e tecnologias semelhantes para manter sessão, lembrar preferências, preservar itens do carrinho, registrar versão de documento legal aceita, melhorar estabilidade e reduzir fraude. O Usuário pode apagar ou bloquear parte desses recursos no navegador ou dispositivo; isso pode impedir o funcionamento de recursos como autenticação, carrinho e preferências.

As notificações push dependem de permissão no sistema operacional e podem ser desativadas nas configurações do dispositivo ou do aplicativo. A desativação não impede o acesso à conta, mas o Usuário pode deixar de receber avisos de Pedido, segurança ou alterações importantes pelo canal de push.

## 7. Retenção, exclusão e anonimização

Mantemos dados pelo período necessário para as finalidades descritas nesta Política, para cumprir obrigações legais, fiscais, contábeis e regulatórias, prevenir fraude, resolver disputas, exercer direitos e manter a segurança dos sistemas. O prazo concreto pode variar conforme a categoria de dado, o tipo de conta, o Pedido e a obrigação aplicável.

Quando uma conta é excluída, o fluxo atual verifica pedidos ativos, registra uma cópia restrita de auditoria em arquivo de contas arquivadas, remove endereços salvos e identificadores de notificação, anonimiza o perfil ativo e tenta encerrar as credenciais de autenticação. Registros relacionados a pedidos, transações, aceite de documentos, prevenção a fraude, obrigações legais ou defesa de direitos podem ser preservados pelo prazo necessário. Backups podem reter cópias temporárias até serem substituídos nos ciclos técnicos de segurança. O arquivo de auditoria deve ter acesso restrito e seguir matriz interna de retenção e eliminação.

A exclusão pode ser temporariamente impedida enquanto houver Pedido ativo ou obrigação operacional pendente. Isso não impede o titular de solicitar informação sobre o tratamento ou de exercer outros direitos previstos em lei.

## 8. Direitos do titular

Nos termos da LGPD, o titular pode solicitar confirmação da existência de tratamento, acesso, correção, informação sobre compartilhamentos, anonimização, bloqueio ou eliminação quando aplicável, portabilidade, eliminação de dados tratados com consentimento, revogação de consentimento e oposição a determinados tratamentos. O titular também pode solicitar revisão de decisão tomada unicamente de forma automatizada que produza efeitos relevantes sobre seus interesses.

A confirmação e o acesso simplificado serão fornecidos imediatamente quando possível. Quando aplicável, a declaração completa observará o prazo legal de até 15 dias. Algumas solicitações podem ser limitadas por direitos de terceiros, sigilo comercial, segurança, prevenção a fraude, obrigação legal ou necessidade de preservar registros para exercício regular de direitos; nessa hipótese, explicaremos a razão de modo apropriado.

O titular pode contatar o ItaSuper por **Itasupersuporte@gmail.com**, pelo suporte ou pela funcionalidade disponível no perfil. Caso entenda que não houve tratamento adequado, pode apresentar reclamação à Autoridade Nacional de Proteção de Dados — ANPD.

## 9. Segurança

Adotamos medidas técnicas e organizacionais razoáveis e compatíveis com a natureza da operação para proteger dados pessoais contra acesso não autorizado, perda, alteração, divulgação ou destruição indevida. Essas medidas incluem controles de autenticação e acesso, segregação de permissões, registros de segurança, uso de conexões protegidas quando suportadas e limitação de exposição de dados por perfil de acesso.

Nenhum ambiente digital é inteiramente livre de risco. O Usuário também deve manter sua senha em sigilo, usar dispositivo protegido, verificar comunicações e não compartilhar códigos de acesso. Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, adotaremos as medidas de contenção e comunicação exigidas pela LGPD e pela regulamentação aplicável da ANPD.

## 10. Transferência internacional de dados

Alguns fornecedores tecnológicos podem processar ou armazenar dados fora do Brasil. Quando houver transferência internacional de dados pessoais, o ItaSuper buscará utilizar mecanismo admitido pela LGPD e pelas normas da ANPD, como decisão de adequação, cláusulas-padrão ou outra salvaguarda aplicável ao caso. O titular pode solicitar informações gerais sobre as categorias de destinatários e o tratamento envolvido pelo canal de privacidade.

## 11. Crianças e adolescentes

A Plataforma não é destinada a menores de 16 anos. Adolescentes entre 16 e 18 anos devem utilizar a Plataforma com assistência e responsabilidade de pais ou responsáveis, conforme a legislação aplicável. Caso tomemos conhecimento de tratamento inadequado de dados de criança ou adolescente, adotaremos as providências cabíveis, inclusive restrição de conta e análise de eliminação ou anonimização quando aplicável.

## 12. Atualizações desta Política

Podemos atualizar esta Política para refletir mudanças legais, tecnológicas, de segurança ou de serviços. Quando a alteração for relevante, comunicaremos por meio razoável, como aviso na Plataforma, e-mail, notificação ou pedido de novo aceite, quando aplicável. A versão vigente e o histórico relevante de alterações ficam disponíveis na Plataforma.

## 13. Contato

**Responsável pelo canal de privacidade:** Renner Vinicius Dias
**Assuntos de privacidade e proteção de dados:** Itasupersuporte@gmail.com · WhatsApp **+55 22 99279-6291**
**Suporte geral:** canais disponíveis na Plataforma
**Controlador:** Renner Vinicius Dias (MEI) — CNPJ 66.155.289/0001-26 — Rua São Francisco, 635, Itatinga/SP.

**Última atualização:** 26 de agosto de 2026. **Vigência:** a partir de 26 de agosto de 2026, observadas as bases legais e os direitos previstos na legislação aplicável.

---

### Referências legais consultadas

- Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- ANPD — Direito dos Titulares: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares
- ANPD — Transferência Internacional de Dados: https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados
- ANPD — Comunicação de Incidente de Segurança: https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis
$privacy_v65$,
    'Política final v6.5: canal de privacidade de Renner, minimização de dados de motoboy, Pix Direto do Cliente, retenção operacional e fornecedores observados.',
    true
  )
  RETURNING id
)
INSERT INTO public.legal_document_changes
  (document_id, section, change_type, summary, legal_basis, display_order)
SELECT changes.document_id, changes.section, changes.change_type, changes.summary, changes.legal_basis, changes.display_order
FROM (
  SELECT new_terms.id, 'Papel do ItaSuper e do Lojista'::text,
    'modified'::text,
    'Consolidada a atuação do ItaSuper como plataforma de intermediação tecnológica e a responsabilidade do Lojista por produto, qualidade, preparo, atendimento, contratação do motoboy e entrega.'::text,
    'CDC; legislação civil e consumerista aplicável'::text, 10
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Pagamentos do Cliente e Pix Direto', 'modified',
    'Esclarecido que o Cliente utiliza Pix Direto por comprovante, cartão ou dinheiro; PIX online e PIX na maquininha não são oferecidos no checkout do Cliente.'::text,
    'CDC, arts. 6º e 31; Decreto nº 7.962/2013'::text, 20
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Planos públicos e gatilho do Essencial', 'modified',
    'Consolidados Essencial e Somente PDV para novas adesões, Essencial gratuito até R$ 5.000 acumulados em janela móvel de 60 dias e mensalidade de R$ 89,90 sem retorno automático à gratuidade.'::text,
    'CDC, arts. 6º e 30; Decreto nº 7.962/2013'::text, 30
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Repasse ItaSuper–Lojista', 'modified',
    'Consolidados taxa de plataforma de R$ 0,99, cobrança PIX às segundas-feiras a partir de R$ 150, bloqueio a partir de R$ 500 e suspensão por cobrança pendente há mais de 30 dias.'::text,
    'CDC; contrato comercial aplicável'::text, 40
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Farmácia e produtos sujeitos a controle', 'added',
    'Registrado o bloqueio preventivo de produtos sujeitos a receita, validação profissional, idade mínima ou controle especial até existir fluxo específico validado.'::text,
    'CDC; legislação sanitária aplicável'::text, 50
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'PDV e condições legadas', 'modified',
    'Mantidos Somente PDV a R$ 69,00 e add-on PDV a R$ 49,00 quando aplicável, preservando condições históricas de lojas legadas fora da oferta pública de novos cadastros.'::text,
    'CDC; contrato comercial aplicável'::text, 60
  FROM new_terms
  UNION ALL
  SELECT new_privacy.id, 'Responsável e canal de privacidade', 'modified',
    'Identificados Renner Vinicius Dias como responsável pelo canal, o e-mail Itasupersuporte@gmail.com, o WhatsApp +55 22 99279-6291 e o endereço do controlador.'::text,
    'LGPD, arts. 6º, 9º e 41'::text, 10
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Dados de motoboy e entrega', 'modified',
    'Limitado o tratamento aos dados necessários à integração e entrega, deixando claro que o motoboy é contratado e gerido pelo Lojista fora do ItaSuper.'::text,
    'LGPD, arts. 6º e 7º'::text, 20
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Pagamentos e Pix Direto', 'modified',
    'Separado o Pix Direto do Cliente, realizado fora da liquidação do ItaSuper, do PIX usado entre Lojista e ItaSuper para mensalidades e repasses.'::text,
    'LGPD, arts. 6º e 7º; CDC'::text, 30
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Retenção, exclusão e anonimização', 'modified',
    'Alinhada a Política ao fluxo de exclusão que remove endereços e tokens, anonimiza o perfil e preserva registros necessários com acesso restrito.'::text,
    'LGPD, arts. 6º, 15, 16 e 18'::text, 40
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Fornecedores e transferências', 'modified',
    'Atualizadas as categorias de fornecedores observadas, finalidades de compartilhamento e ressalva de que transferências internacionais dependem de mecanismo válido.'::text,
    'LGPD, arts. 6º, 33 e seguintes'::text, 50
  FROM new_privacy
) AS changes(document_id, section, change_type, summary, legal_basis, display_order);

COMMIT;
