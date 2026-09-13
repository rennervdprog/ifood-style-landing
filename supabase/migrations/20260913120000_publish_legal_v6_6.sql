-- Publicação autorizada dos documentos legais finais v6.6.
-- Preserva todas as versões anteriores e ativa o reaceite por versão.
-- Não executa pedidos, pagamentos, cobranças ou transferências.
--
-- v6.6 alinha os documentos ao modelo real: o ItaSuper é o software que conecta
-- lojista e motoboy, não remunera entregador e não conhece o valor da corrida.
-- Também explicita que a taxa de R$ 0,99 por entrega pode variar no futuro,
-- sempre com aviso prévio de 30 dias, sem retroatividade e com saída sem multa
-- (CDC, art. 51, X, e art. 54, §4º), e descreve o rastreamento em segundo plano
-- do motoboy com a especificidade exigida pela LGPD.

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
    '6.6',
    660,
    '2026-09-13T00:00:00-03:00'::timestamptz,
    $terms_v66$# Termos de Uso do ItaSuper

**Versão 6.6 — vigente a partir de 13 de setembro de 2026**

## 1. Quem somos e alcance destes Termos

O **ItaSuper** é uma plataforma digital de intermediação tecnológica operada por **Renner Vinicius Dias (MEI)**, inscrito no CNPJ sob o nº **66.155.289/0001-26**, com endereço físico na **Rua São Francisco, 635, Itatinga/SP**. Estes Termos regulam o uso do site, aplicações web, aplicativos móveis e demais interfaces ItaSuper por Clientes, Lojistas, motoboys cadastrados e demais pessoas cadastradas.

O ItaSuper disponibiliza infraestrutura tecnológica para apresentação de lojas e cardápios, realização e acompanhamento de pedidos, comunicação relacionada ao pedido, recursos de pagamento disponibilizados por parceiros, coordenação operacional da entrega entre Lojista e motoboy, ferramentas de gestão para lojistas e, quando contratado ou habilitado, recursos como PDV, cupons, fidelidade, relatórios e suporte. Cada produto, oferta, loja, preço, prazo, área de entrega e forma de pagamento depende da configuração e da disponibilidade informadas no fluxo aplicável.

Ao criar uma conta, fazer um pedido, utilizar painel de loja, aceitar uma entrega ou continuar a utilizar a Plataforma após ser informado sobre uma versão vigente destes Termos, o Usuário confirma que leu e concorda com este documento. Estes Termos não afastam direitos assegurados por lei, especialmente os aplicáveis às relações de consumo.

## 2. Definições essenciais

Para estes Termos, **Cliente** é a pessoa que busca ou compra produtos e serviços por meio da Plataforma. **Lojista** é a pessoa física ou jurídica responsável pela loja, cardápio, oferta, preparo, atendimento do pedido e contratação da entrega. **Motoboy** é o profissional autônomo de moto-frete que se cadastra na Plataforma por conta própria e que, quando vinculado a uma loja, é escolhido, contratado e remunerado pelo Lojista. **Pedido** é a solicitação de compra enviada pelo Cliente e sujeita à confirmação pela loja. **Plataforma** é o conjunto de interfaces e serviços tecnológicos ItaSuper.

O **Fornecedor** do produto é o Lojista identificado na tela da loja e no pedido. O **Processador de Pagamento** é a instituição ou empresa indicada no respectivo fluxo de pagamento, responsável pelos serviços financeiros que lhe compõem. **Dados Pessoais** têm o significado previsto na legislação brasileira de proteção de dados.

## 3. Cadastro, idade, acesso e segurança

O Usuário deve fornecer informações verdadeiras, completas e atualizadas e manter sigilo sobre senha, códigos de acesso e dispositivos autorizados. O Usuário deve comunicar pelo suporte qualquer suspeita de uso indevido da conta. O ItaSuper pode adotar controles de segurança, inclusive encerramento de sessões e verificação de dispositivo, para proteger contas e prevenir fraude.

A Plataforma não é destinada a menores de 16 anos. Pessoas entre 16 e 18 anos somente devem utilizá-la como Clientes com assistência e responsabilidade de pais ou responsáveis, conforme a legislação aplicável. O cadastro e a atuação como Lojista ou Motoboy exigem capacidade civil compatível com as obrigações assumidas e, quando aplicável, documentos e autorizações legalmente exigidos.

O Usuário não pode criar conta em nome de terceiro sem autorização, compartilhar credenciais, inserir informação fraudulenta, tentar burlar controles de segurança, explorar falhas, coletar dados de modo automatizado sem autorização ou usar a Plataforma para finalidade ilícita.

## 4. Papel do ItaSuper, dos Lojistas e dos Motoboys

O ItaSuper atua como provedor de tecnologia e ambiente de intermediação digital. Salvo quando houver informação expressa em sentido diverso no fluxo específico, o ItaSuper não fabrica, armazena, prepara, embala ou vende os produtos anunciados pelos Lojistas.

O Lojista é responsável pela legalidade de sua atividade, disponibilidade, preço, descrição, composição, alergênicos quando exigíveis, qualidade, higiene, validade, preparo, emissão de documentos fiscais quando aplicável, atendimento e solução de problemas relativos aos produtos que oferece. O Lojista deve manter dados cadastrais, horários, área de atendimento, cardápio, estoque e restrições atualizados.

O ItaSuper **não possui entregadores próprios, não contrata motoboys, não remunera motoboys e não intermedeia o pagamento da corrida**. O que a Plataforma oferece a Lojistas e motoboys é **software de coordenação**: cadastro, busca na base da cidade entre profissionais que autorizaram exibição de contato, convite e vínculo entre loja e motoboy, atribuição de pedidos, atualização de status e registro operacional das entregas. O que cada entrega vale, quando e como é pago é **negociado e executado diretamente entre Lojista e motoboy, fora da Plataforma**, sem participação, ciência ou garantia do ItaSuper. A regra está detalhada na cláusula 10.

## 5. Oferta, pedidos, preços e disponibilidade

Antes da confirmação, o Cliente deve conferir a loja, os itens, complementos, quantidade, endereço, forma de pagamento, valor dos produtos, descontos, taxa de entrega, outras despesas apresentadas e valor total. O valor exibido no checkout é a referência da contratação daquele Pedido, salvo erro material evidente ou correção informada antes da confirmação.

A disponibilidade de produtos, horários, área de entrega, prazo estimado, mínimo de pedido e formas de pagamento é definida pela loja e pode variar. O envio do Pedido pelo Cliente representa uma solicitação de compra; a aceitação, preparação e atendimento dependem da confirmação da loja e das condições informadas na Plataforma.

O ItaSuper disponibiliza recursos para que o Cliente identifique e corrija dados antes de finalizar o Pedido e registra a confirmação do recebimento da solicitação. O histórico do Pedido pode ser acessado pelos meios disponibilizados na conta, preservadas as regras de retenção e privacidade.

## 6. Planos comerciais, taxas, mensalidades e cobranças de Lojistas

As formas de pagamento do Pedido exibidas no checkout dependem da configuração da loja e do Pedido e podem incluir **Pix Direto com comprovante, cartão e dinheiro**. Nas configurações padrão da Plataforma, **PIX online ItaSuper e PIX na maquininha não são oferecidos ao Cliente no checkout**; lojas com configuração legada podem exibir modalidade adicional, sempre identificada na tela de pagamento antes da confirmação. No Pix Direto, a transferência é feita para a chave informada pelo Lojista, fora da liquidação do ItaSuper; Cliente e Lojista devem conferir chave, valor, favorecido, comprovante e confirmação efetiva. Separadamente, na relação ItaSuper–Lojista, o PIX é utilizado para mensalidades e para cobranças de repasses acumulados. O ItaSuper não solicita nem armazena dados completos de cartão de pagamento quando o processamento é realizado diretamente pelo parceiro habilitado.

### 6.1. Valores e regras dos planos comerciais vigentes

A tabela abaixo explicita os valores e regras comerciais cadastrados como planos públicos ativos em **13 de setembro de 2026**. Os valores são expressos em reais (R$). Para lojas com proposta, contrato ou condição comercial individual, prevalecerá a condição específica que tiver sido formalmente acordada e apresentada ao Lojista.

| Plano ou módulo | Valor mensal | Regra de ativação e componentes previstos |
|---|---:|---|
| **Essencial** | **R$ 89,90/mês** | Único plano com delivery aberto a novos cadastros. Período de análise de **60 dias** em janela móvel e gratuidade até o gatilho acumulado de **R$ 5.000,00** em pedidos. Após o gatilho e o aviso prévio de 30 dias, incide a mensalidade de R$ 89,90, sem retorno automático à gratuidade; **0% de comissão por pedido online**; taxa da plataforma de **R$ 0,99 por entrega**, conforme a cláusula 6.3; e **R$ 1,99 por pedido recebido via PIX online**, cobrado apenas quando essa modalidade for efetivamente utilizada pela loja. |
| **Somente PDV** | **R$ 69,00/mês** | Aberto a novos cadastros. Frente de caixa para operação física e balcão, sem comissão por venda, sem taxa de plataforma por entrega e sem taxa de PIX. Não inclui vitrine pública, cardápio online ou serviços de delivery. |
| **PDV Add-on** | **R$ 49,00/mês** | Módulo adicional de PDV integrado ao plano Essencial quando habilitado. O valor é somado à cobrança mensal enquanto o módulo estiver ativo. |
| **Autonomia** | **R$ 199,90/mês** | **Plano legado**, não oferecido a novos cadastros. Mantido para lojas que já o contrataram, com gratuidade até R$ 2.500,00 em vendas, R$ 1,99 por pedido via PIX online e isenção da taxa de R$ 0,99 por entrega. Prevalecem a contratação e as regras formalmente apresentadas ao Lojista. |
| **Planos legados e condição individual** | Conforme contratado | Planos por comissão, híbridos, de apoiador e condições contratuais específicas permanecem válidos para as lojas que os contrataram e não são oferecidos a novos cadastros. Valores, comissões e prazos são os do instrumento correspondente. |

### 6.2. Alterações de preços, planos e regras comerciais

O ItaSuper poderá atualizar mensalidades, percentuais de comissão, taxas operacionais, limites de faturamento gratuito, valores de módulos ou regras dos planos. Qualquer alteração comercial será comunicada ao Lojista com antecedência mínima de **30 dias corridos** da entrada em vigor, por meio de aviso no painel, e-mail, WhatsApp ou notificação, informando claramente o **valor atual**, o **novo valor**, a **data de vigência** e a **forma de cancelamento ou migração**.

A alteração de preços ou taxas **não terá efeito retroativo** sobre ciclos de faturamento já quitados, pedidos já confirmados ou cobranças já vencidas sob a regra anterior, salvo correção de erro material evidente, prevenção a fraude ou imposição legal. Períodos de teste, campanhas promocionais ou gratuidade obedecerão às regras específicas divulgadas em sua oferta, cujo término não gera direito a reembolso ou cobrança retroativa.

Caso o Lojista não concorde com a alteração comunicada, poderá solicitar o cancelamento da assinatura ou a migração para outro plano compatível **antes da data de vigência da mudança, sem incidência de multa de rescisão**, ressalvada a quitação de valores devidos por serviços já prestados e pedidos já entregues. A ausência de manifestação até a data de vigência, mantido o uso da Plataforma, será entendida como concordância com a nova condição, sem prejuízo do direito de cancelar depois.

### 6.3. Taxa ItaSuper por entrega de R$ 0,99 e sua variação futura

A taxa da plataforma por entrega é de **R$ 0,99** na data desta versão. Ela remunera o uso da infraestrutura de coordenação da entrega e **não é remuneração do motoboy** — ver cláusula 10.

**Esta taxa pode ser alterada no futuro.** O ItaSuper poderá reajustar ou modificar o valor de R$ 0,99 em razão de custos operacionais, tributos, custos de infraestrutura, variação de indexadores ou reposicionamento comercial. Toda alteração observará, cumulativamente:

1. **aviso prévio de no mínimo 30 dias corridos** antes da vigência, no painel do Lojista e por pelo menos um canal direto (e-mail, WhatsApp ou notificação), informando valor atual, novo valor e data de início;
2. **ausência de efeito retroativo** — pedidos já confirmados, ciclos já fechados e cobranças já geradas permanecem sob o valor vigente à época;
3. **direito de saída sem multa** — o Lojista que não concordar pode cancelar ou migrar de plano antes da vigência, sem multa de rescisão;
4. **preservação do preço exibido ao Cliente** — nenhum reajuste altera o valor total já apresentado ao Cliente no checkout de um Pedido confirmado.

Como a taxa é acrescida à taxa de entrega conforme a configuração de rateio escolhida pela loja, a forma de rateio vigente é sempre informada no painel do Lojista e pode ser uma destas: **integralmente somada ao valor pago pelo Cliente**, **dividida em partes iguais entre Cliente e Lojista** ou **integralmente absorvida pelo Lojista**, hipótese em que nada é somado ao valor do Cliente. Qualquer que seja o rateio, o **valor total exibido ao Cliente no checkout é o que vincula aquele Pedido**, nos termos dos arts. 30 e 35 do Código de Defesa do Consumidor. O Cliente nunca é cobrado, depois da confirmação, por diferença decorrente de mudança de taxa.

### 6.4. Acúmulo e cobrança dos valores devidos pelo Lojista

O Lojista deve conferir os lançamentos exibidos no painel e comunicar eventuais divergências pelo suporte antes do vencimento. A taxa ItaSuper por entrega acumula-se no painel quando o pedido é recebido diretamente pelo Lojista em dinheiro ou PIX direto. A cobrança do valor acumulado é gerada via **PIX toda segunda-feira** quando o ciclo atingir **R$ 150,00**. O saldo pode gerar bloqueio operacional a partir de **R$ 500,00**, e uma cobrança não regularizada por mais de **30 dias** pode resultar em suspensão, conforme avisos e procedimentos do painel. Em caso de inadimplência, o ItaSuper poderá enviar avisos, restringir funcionalidades não essenciais ou suspender o acesso conforme a gravidade, o contrato comercial e a legislação, assegurando canal de atendimento para regularização e preservando o tratamento adequado de pedidos em andamento quando aplicável.

## 7. Cancelamentos, reembolsos e direito do consumidor

O Cliente deve solicitar cancelamento pelo fluxo disponível no Pedido ou pelo suporte. A possibilidade de cancelamento antes da confirmação ou durante o preparo pode depender do estágio operacional do Pedido; a Plataforma apresentará as opções disponíveis e registrará a solicitação.

Nas contratações à distância, o consumidor possui os direitos previstos na legislação aplicável, inclusive o direito de arrependimento nas hipóteses legais. O ItaSuper não utiliza estes Termos para afastar direitos por produto inadequado, vício, divergência da oferta, não entrega ou falha de serviço. A natureza do produto, o estágio de preparo, as condições da oferta e a legislação serão considerados no atendimento de cada solicitação.

Quando houver pagamento online elegível a estorno, o ItaSuper e/ou o Lojista encaminharão a solicitação ao parceiro de pagamento aplicável. O prazo efetivo de devolução pode depender do meio utilizado, da instituição financeira, do estágio da transação e das regras legais. Em pagamentos feitos diretamente ao Lojista, a solução financeira poderá exigir atuação do próprio Lojista, sem prejuízo da mediação e do atendimento disponibilizados pelo ItaSuper.

## 8. Obrigações do Cliente

O Cliente deve informar endereço e contato corretos, estar disponível para receber o Pedido, observar as condições exibidas no checkout, tratar Lojistas e motoboys com respeito e não realizar pedidos fraudulentos ou abusivos. Quando o Pedido utilizar código de confirmação, o Cliente deve compartilhar o código apenas no momento adequado de recebimento e nunca com terceiros que não estejam envolvidos na entrega.

## 9. Obrigações do Lojista

O Lojista deve possuir autorização para operar o estabelecimento e comercializar os itens ofertados, observar normas sanitárias, de defesa do consumidor, fiscais e de proteção de dados que lhe sejam aplicáveis, e manter seus dados e informações comerciais atualizados. Produtos de farmácia, medicamentos ou produtos que exijam receita, validação profissional, idade mínima ou outro controle permanecem **bloqueados no checkout comum do ItaSuper** até que exista fluxo específico validado. O Lojista responde pelo conteúdo do cardápio, imagens, marcas e materiais que publicar, garantindo que possui os direitos necessários para utilizá-los.

O Lojista autoriza o ItaSuper a exibir seu nome comercial, marca, cardápio, fotos, preços, horários e informações necessárias para divulgar e executar seus pedidos enquanto a relação estiver ativa. Após o encerramento, o ItaSuper poderá manter informações estritamente necessárias para concluir pedidos pendentes, cumprir obrigações legais, resguardar direitos e remover conteúdos de caches, backups e índices dentro de seus ciclos técnicos aplicáveis.

Recursos de PDV, relatórios, cupons, fidelidade e comunicação são ferramentas de apoio. O Lojista continua responsável pela escrituração, obrigações fiscais, emissão de documentos e decisões comerciais que lhe cabem.

## 10. Não vinculação: o motoboy, o Lojista e o ItaSuper

**Esta cláusula limita e delimita direitos e responsabilidades e deve ser lida com atenção.**

### 10.1. O que o ItaSuper oferece

O ItaSuper oferece a Lojistas e motoboys **exclusivamente software de coordenação operacional**. Pela Plataforma é possível: o motoboy criar sua conta por iniciativa própria; o motoboy autorizar, se quiser, que seu contato apareça para lojas da sua cidade; o Lojista pesquisar essa base e enviar convite; o motoboy aceitar ou recusar o convite; o Lojista atribuir pedidos ao motoboy vinculado; ambos acompanharem o status da entrega; e ambos registrarem, para controle próprio, quais entregas já foram acertadas entre si.

### 10.2. O que o ItaSuper não faz

O ItaSuper **não**: contrata motoboy; emprega motoboy; define preço de corrida; calcula, retém, intermedeia, transfere, garante ou tem ciência do valor pago pela entrega; mantém carteira, saldo ou conta de motoboy; paga motoboy por qualquer meio; exige exclusividade; impõe jornada, escala, turno, rota obrigatória ou meta; aplica sanção disciplinar; verifica CNH, CRLV, registro de moto-frete, curso especializado, seguro, colete ou equipamento; nem fiscaliza o cumprimento da Lei nº 12.009/2009 e do Código de Trânsito Brasileiro pelo profissional.

**O ItaSuper não sabe quanto vale uma entrega.** Esse valor não trafega, não é calculado e não é armazenado pela Plataforma. Telas de acerto entre Lojista e motoboy exibem apenas contagem de entregas e o registro de que o acerto foi feito, sem qualquer valor.

### 10.3. Quem responde pelo quê

O motoboy é **profissional autônomo de moto-frete**, responsável por sua habilitação, veículo, documentação, autorização para transporte remunerado de mercadorias, equipamentos de segurança, tributos e contribuições próprias. O Lojista é quem escolhe, contrata, orienta, dirige e remunera o motoboy que utiliza, e responde pelas obrigações decorrentes dessa relação conforme a legislação aplicável e os fatos concretos.

A existência de funcionalidade tecnológica de vínculo entre loja e motoboy, atribuição de pedido, comunicação, acompanhamento de status ou localização **não cria, não presume e não substitui** relação de emprego, de representação, de prestação de serviço ou de mandato entre o ItaSuper e o motoboy, nem entre o ItaSuper e o Lojista. A qualificação jurídica de qualquer relação será a que decorrer dos fatos e da lei.

### 10.4. Adesão e desligamento

O motoboy adere à Plataforma por vontade própria, pode recusar qualquer convite ou pedido, pode ficar offline quando quiser, pode atender quantas lojas quiser, dentro ou fora do ItaSuper, e pode encerrar sua conta a qualquer momento pelos meios disponibilizados, sem multa, carência ou penalidade. O Lojista pode desvincular um motoboy a qualquer tempo. Nenhuma das duas partes deve ao ItaSuper valor decorrente do desligamento.

### 10.5. Uso dos dados do Cliente pelo motoboy

O motoboy deve utilizar os dados do Cliente **somente** para executar a entrega em curso e proteger o Pedido, sendo vedado armazenar, copiar, divulgar, comercializar ou usar esses dados para qualquer outra finalidade.

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

Cada parte responde pelos danos que causar na extensão definida pela legislação aplicável. O ItaSuper não assume responsabilidade por fatos atribuíveis exclusivamente ao Lojista, Cliente, motoboy, instituição de pagamento, operadora de telecomunicações ou outro terceiro, como informação incorreta, indisponibilidade externa, falha de conexão, qualidade de produto, ato de entrega do motoboy contratado pelo Lojista, acerto financeiro entre Lojista e motoboy ou descumprimento de obrigação do Lojista. Esta disposição não exclui responsabilidades que não possam ser excluídas por lei nem limita direitos de consumidores.

## 16. Suspensão, encerramento e alterações

O ItaSuper pode suspender ou encerrar contas em caso de fraude, violação destes Termos, risco de segurança, exigência legal ou prejuízo a terceiros, buscando comunicar a medida e oferecer canal de suporte quando isso não comprometer a segurança, a investigação de fraude ou obrigação legal. O Usuário pode solicitar exclusão da conta pelos meios disponibilizados, sujeito à conclusão de pedidos ativos e à retenção/anonimização necessária prevista na Política de Privacidade e na legislação.

Mudanças relevantes nestes Termos serão comunicadas por meio razoável, como aviso na Plataforma, e-mail ou notificação, antes de sua vigência quando a lei ou a natureza da mudança exigir. A versão atual e as versões anteriores relevantes poderão ser consultadas na Plataforma. Caso o Usuário não concorde com mudança que afete materialmente sua relação, poderá deixar de utilizar o serviço e solicitar encerramento, sem prejuízo de obrigações já constituídas.

## 17. Lei aplicável e foro

Aplica-se a legislação brasileira. Para relações de consumo, será respeitado o foro do domicílio do consumidor e as normas protetivas aplicáveis. Para relações empresariais, eventual foro contratual observará a legislação e a validade da relação concreta.

## 18. Atendimento

Dúvidas, solicitações, reclamações e pedidos de informação podem ser encaminhados pelo suporte disponível na Plataforma ou pelo WhatsApp **+55 22 99279-6291**. Para assuntos de privacidade, o canal é **Itasupersuporte@gmail.com**.

---

**Controlador/Operador da Plataforma:** 66.155.289 Renner Vinicius Dias (MEI) — CNPJ 66.155.289/0001-26.
**Última atualização:** 13 de setembro de 2026. **Vigência:** a partir de 13 de setembro de 2026, sujeita aos direitos legais aplicáveis e às condições específicas formalmente contratadas por Lojistas legados.

---

### Referências legais consultadas

- Constituição Federal, arts. 5º, X, XXXII e XXXV, e 170, V: https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm
- Lei nº 8.078/1990 — Código de Defesa do Consumidor, em especial arts. 30, 31, 35, 46, 47, 51 e 54: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Lei nº 12.009/2009 — exercício das atividades de moto-frete e motoboy: https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12009.htm
- Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Decreto nº 7.962/2013 — contratação no comércio eletrônico: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm
$terms_v66$,
    'Termos de Uso v6.6: o ItaSuper passa a se descrever como software de coordenação entre lojista e motoboy, com cláusula própria de não vinculação; a taxa de R$ 0,99 por entrega ganha regra expressa de alteração futura com aviso prévio de 30 dias, sem retroatividade e com saída sem multa; a tabela comercial inclui a taxa de R$ 1,99 por pedido via PIX online e marca Autonomia como legado.',
    true
  )
  RETURNING id
), new_privacy AS (
  INSERT INTO public.legal_documents (
    kind, version, version_num, effective_date, content_md, summary, is_current
  ) VALUES (
    'privacy',
    '6.6',
    660,
    '2026-09-13T00:00:00-03:00'::timestamptz,
    $privacy_v66$# Política de Privacidade do ItaSuper

**Versão 6.6 — vigente a partir de 13 de setembro de 2026**

## 1. Quem controla os dados e como falar conosco

Esta Política explica como o **ItaSuper** trata dados pessoais ao disponibilizar seu site, aplicações web, aplicativos móveis e serviços relacionados. O controlador das operações de tratamento descritas nesta Política é **Renner Vinicius Dias (MEI)**, CNPJ **66.155.289/0001-26**, com endereço físico na **Rua São Francisco, 635, Itatinga/SP**, doravante denominado **ItaSuper**. **Renner Vinicius Dias é o responsável pelo canal de privacidade**, atendido pelo e-mail **Itasupersuporte@gmail.com** e pelo WhatsApp **+55 22 99279-6291**.

O ItaSuper é um **agente de tratamento de pequeno porte** nos termos da Resolução CD/ANPD nº 2, de 27 de janeiro de 2022, que enquadra nessa categoria o microempreendedor individual. Por essa condição, o ItaSuper **não está obrigado a indicar um encarregado**, mas, conforme o art. 11 da mesma Resolução, **disponibiliza um canal de comunicação com o titular**, que é justamente o e-mail e o WhatsApp indicados acima. Esse enquadramento é revisto sempre que houver mudança de porte, de faturamento ou de natureza do tratamento; caso o ItaSuper passe a realizar tratamento de alto risco na forma do art. 4º da Resolução, o regime simplificado deixa de ser aplicado.

Para dúvidas, solicitações ou exercício de direitos previstos na Lei Geral de Proteção de Dados Pessoais — LGPD, o titular pode escrever para **Itasupersuporte@gmail.com** ou falar com o responsável pelo canal, **Renner Vinicius Dias**, pelo WhatsApp **+55 22 99279-6291**. O contato deve informar, quando possível, o nome, e-mail/telefone vinculado à conta, pedido realizado e a solicitação desejada. Poderemos pedir informação adicional razoável para confirmar a identidade e proteger os dados contra acesso indevido.

## 2. A quem esta Política se aplica e papéis no tratamento

Esta Política se aplica a Clientes, Lojistas, motoboys cadastrados na Plataforma, visitantes e demais pessoas que utilizem ou interajam com a Plataforma. O ItaSuper é controlador quando decide as finalidades e os meios do tratamento necessários para operar a Plataforma, como cadastro, autenticação, segurança, suporte, notificações, prevenção a fraude e administração de funcionalidades próprias.

O Lojista normalmente decide finalidades relevantes do tratamento de dados de seus consumidores para preparar, entregar, atender e eventualmente divulgar seus próprios produtos. Conforme a atividade concreta, o Lojista poderá atuar como controlador independente ou compartilhar decisões com o ItaSuper em relação a uma operação específica. O papel de cada parte depende das finalidades e dos meios efetivamente definidos; esta Política não substitui a avaliação do caso concreto nem obrigações legais próprias do Lojista.

Quanto ao **motoboy**, o ItaSuper é controlador dos dados da conta que o próprio profissional cria na Plataforma (cadastro, autenticação, status operacional e localização enquanto ele está online). O **Lojista** é quem decide contratar, orientar e remunerar o motoboy, e é controlador dos dados dessa relação de trabalho ou de prestação de serviço, que ocorre fora da Plataforma. O ItaSuper **não trata dados de pagamento, valor de corrida, contrato, habilitação, veículo ou documentação do motoboy** — ver a cláusula "Não vinculação" dos Termos de Uso.

## 3. Quais dados podemos tratar

| Categoria | Exemplos de dados | Contexto de uso |
|---|---|---|
| Cadastro e contato | Nome, e-mail, telefone, senha protegida pelo serviço de autenticação, cidade e informações de perfil. | Criar conta, autenticar, prestar suporte e proteger o acesso. |
| Pedido e atendimento | Loja, itens, complementos, valores, endereço de entrega, contato, método de pagamento, status, código de confirmação e histórico do Pedido. | Enviar o Pedido à loja, organizar o atendimento e entrega, dar suporte e resolver disputas. |
| Localização do Cliente | Endereço informado e, quando o Usuário permitir no aparelho, localização aproximada ou coordenadas. | Preencher endereço, calcular cobertura/rota quando habilitado e apoiar entrega. A permissão de localização pode ser alterada nas configurações do dispositivo. |
| Localização do motoboy em segundo plano | Latitude, longitude, precisão, velocidade, direção e, quando houver, o pedido em andamento. | Mostrar à loja e ao Cliente onde está a entrega. O funcionamento detalhado, inclusive quando o rastreamento liga e desliga, está descrito na cláusula 3.1. |
| Dispositivo e segurança | IP, navegador, sistema operacional, identificadores técnicos, registros de sessão, token de notificação e eventos de segurança. | Autenticação, prevenção a fraude, suporte técnico, estabilidade e notificações. |
| Lojistas | CPF/CNPJ, dados do estabelecimento, dados para recebimento e cobrança, cardápio, marca, imagens, planos, valores comerciais, informações de suporte e configurações comerciais. | Operar a loja, cumprir obrigações comerciais, gerar cobranças, relatórios e integrar pagamentos. |
| Motoboys cadastrados | Nome, contato, cidade, foto de perfil quando enviada, status online/offline, vínculo com lojas, pedidos atribuídos e contagem de entregas concluídas. | Permitir que o motoboy use o aplicativo, que a loja o convide e lhe atribua pedidos, e que ambos acompanhem o status. **O ItaSuper não trata valor de corrida, saldo, dados bancários, chave PIX de recebimento de corrida, CNH, CRLV ou contrato do motoboy.** |
| Comunicação e suporte | Chamados, mensagens, registros de atendimento, confirmação de envio de notificações e comunicações por canais habilitados. | Responder solicitações, registrar atendimento, prevenir abuso e aperfeiçoar o serviço. |
| Conteúdo enviado a IA | Conversas ou textos que o administrador/lojista voluntariamente inserir no recurso Sales Coach. | Gerar sugestão de comunicação comercial. Não insira dados sensíveis, dados financeiros, senhas, documentos ou dados de terceiros sem autorização e base legal adequada. |

### 3.1. Localização do motoboy em segundo plano — como funciona de verdade

**Esta cláusula descreve tratamento de dados de geolocalização e deve ser lida com atenção.**

Quando o motoboy usa o aplicativo em um aparelho Android e concede a permissão de localização, o ItaSuper mantém um **serviço em primeiro plano (Foreground Service)** que coleta a posição do aparelho. O Android exige e o ItaSuper mantém uma **notificação permanente e visível** na barra de status enquanto esse serviço está ativo, com o texto "Entrega em andamento — ItaSuper está rastreando sua localização para entregas". Enquanto essa notificação estiver na tela, a coleta está ligada; quando ela desaparece, a coleta parou.

**O rastreamento fica ativo enquanto o motoboy estiver com o status "online" no aplicativo, mesmo que não haja entrega em andamento naquele momento**, e também enquanto houver pedido ativo atribuído a ele. Esse é o comportamento real do aplicativo e ele é descrito aqui de forma expressa para que o profissional saiba exatamente o que está sendo coletado e quando.

Os dados coletados são latitude, longitude, precisão, velocidade, direção e o identificador do pedido em andamento, quando existir. A coleta respeita um filtro de distância de aproximadamente **8 metros** e o envio ao servidor é adaptativo conforme o deslocamento: cerca de **3 segundos** em movimento rápido, **8 segundos** em movimento lento e **20 segundos** quando praticamente parado.

O ItaSuper **não mantém histórico de trajeto**. O servidor guarda **uma única posição por motoboy**, que é sobrescrita a cada novo envio. Não há rota gravada, não há linha do tempo de deslocamento e não é possível reconstruir por onde o profissional passou.

**Quando o motoboy fica offline, o serviço é encerrado e a posição é apagada do servidor.** O motoboy controla a coleta por três meios: ficar offline no aplicativo, revogar a permissão de localização nas configurações do Android ou desinstalar o aplicativo. A posição é compartilhada com a loja vinculada e, quando o recurso estiver habilitado no Pedido, com o Cliente que aguarda aquela entrega — em ambos os casos, apenas para acompanhar a entrega em curso.

A base legal é a execução do contrato e dos procedimentos correlatos com o motoboy e com a loja, para viabilizar a coordenação da entrega, somada à permissão de sistema concedida no próprio aparelho, revogável a qualquer tempo.

### 3.2. Diretório de motoboys por cidade — exibição de contato mediante autorização

O motoboy pode, **por escolha própria**, autorizar que seu contato seja exibido às lojas da sua cidade. Somente com essa autorização ativa o profissional aparece na busca que o Lojista faz na base da cidade. A autorização pode ser retirada a qualquer momento nas configurações do aplicativo, e o profissional deixa de ser listado. Sem essa autorização, o motoboy continua podendo usar o aplicativo normalmente com as lojas às quais já esteja vinculado — apenas não é exibido na busca.

No checkout do Cliente, os métodos atualmente previstos são **Pix Direto com comprovante, cartão e dinheiro**. Nas configurações padrão da Plataforma, o Cliente não utiliza PIX online ItaSuper nem PIX na maquininha pelo checkout; lojas com configuração legada podem exibir modalidade adicional, sempre identificada na tela de pagamento. No Pix Direto, o comprovante e os dados de conferência podem ser enviados à loja; a transferência ocorre fora da liquidação do ItaSuper. PIX online é reservado à relação financeira entre Lojista e ItaSuper, como mensalidades e cobranças acumuladas. O ItaSuper não solicita o número completo do cartão quando o pagamento online é coletado diretamente pelo parceiro de pagamento. Se o Usuário fornecer informação opcional em campos livres, poderá tratar-se de dado pessoal adicional; por isso, pedimos que evite compartilhar dados sensíveis ou dados de terceiros sem necessidade.

## 4. Por que tratamos dados e qual é a base legal

Tratamos dados pessoais quando necessário para executar o contrato ou procedimentos preliminares solicitados pelo Usuário, como criar conta, processar Pedido, coordenar a entrega entre o Lojista e o motoboy por ele escolhido, disponibilizar suporte e administrar serviços contratados pelo Lojista. Também podemos tratar dados para cumprir obrigações legais e regulatórias, especialmente registros necessários a obrigações fiscais, financeiras, prevenção a fraude e atendimento de requisições de autoridades competentes.

Quando o tratamento for necessário para segurança, prevenção a fraude, integridade da Plataforma, suporte técnico, auditoria e melhoria de serviços, poderemos utilizar o legítimo interesse, após avaliação de necessidade, proporcionalidade e impacto nos direitos do titular. Quando a legislação exigir consentimento, inclusive para determinada permissão do dispositivo ou comunicação opcional, apresentaremos a solicitação aplicável; o consentimento pode ser revogado pelos meios informados, sem afetar tratamentos já realizados com base válida.

Mensagens transacionais relacionadas a Pedido, segurança ou execução de serviço podem ser enviadas pelo canal habilitado, quando necessárias à operação. Comunicações promocionais devem observar a base legal aplicável e oferecer opção de recusa. O Lojista é responsável pelas campanhas e mensagens de marketing que definir para seus clientes.

## 5. Com quem os dados podem ser compartilhados

Compartilhamos apenas os dados necessários para a finalidade correspondente, observando controles e obrigações aplicáveis.

| Destinatário ou categoria | Finalidade do compartilhamento |
|---|---|
| Lojista responsável pelo Pedido | Receber e atender o Pedido, preparar produtos, organizar a entrega com o motoboy que ele escolheu, contato operacional e suporte ao consumidor. |
| Motoboy vinculado à loja | Dados mínimos para retirar e entregar o Pedido, como identificação, endereço, contato operacional e status. O compartilhamento é limitado ao necessário para a entrega em curso; o motoboy é escolhido, contratado e remunerado pelo Lojista, fora do ItaSuper. |
| Processadores de pagamento e instituições financeiras indicados no fluxo | Criar cobranças, processar pagamentos, administrar subcontas, conciliar transações, repasses, estornos ou obrigações de segurança. Conforme o fluxo habilitado, podem incluir **Asaas, Woovi, Mercado Pago e AbacatePay**, ou outro fornecedor apresentado ao Usuário na própria tela de pagamento. O Pix Direto do Cliente ocorre fora da liquidação do ItaSuper. |
| Hospedagem, banco de dados, autenticação e arquivos | Provedores técnicos como Supabase e Vercel, necessários para armazenar e disponibilizar a Plataforma. |
| Notificações e diagnóstico | Provedores como Firebase/Google, OneSignal e Sentry, quando habilitados, para enviar notificações, medir estabilidade e diagnosticar falhas técnicas. |
| Geocodificação e mapas | Serviços de mapas/geocodificação, como OpenStreetMap/Nominatim, quando necessários para converter endereço em coordenadas ou calcular cobertura. |
| Mensageria | Integrações de WhatsApp e seus provedores técnicos, quando o Usuário ou Lojista habilitar a funcionalidade de comunicação. |
| Recurso Sales Coach | O conteúdo voluntariamente inserido pelo Usuário é enviado ao gateway de IA Lovable, configurado para utilizar modelo Google Gemini, exclusivamente para retornar a sugestão solicitada. |
| Autoridades, consultores ou defesa de direitos | Quando exigido por lei, ordem válida, prevenção/investigação de fraude ou necessário para exercício regular de direitos. |

O ItaSuper não vende dados pessoais. Não autorizamos o uso de dados pelos fornecedores para finalidade incompatível com o serviço prestado, ressalvadas hipóteses em que o próprio fornecedor atue como controlador sob sua política e obrigação legal, como pode ocorrer com instituições de pagamento.

## 6. Cookies, armazenamento local e notificações

A Plataforma pode utilizar cookies, armazenamento local do navegador, armazenamento seguro do aplicativo e tecnologias semelhantes para manter sessão, lembrar preferências, preservar itens do carrinho, registrar versão de documento legal aceita, melhorar estabilidade e reduzir fraude. O Usuário pode apagar ou bloquear parte desses recursos no navegador ou dispositivo; isso pode impedir o funcionamento de recursos como autenticação, carrinho e preferências.

As notificações push dependem de permissão no sistema operacional e podem ser desativadas nas configurações do dispositivo ou do aplicativo. A desativação não impede o acesso à conta, mas o Usuário pode deixar de receber avisos de Pedido, segurança ou alterações importantes pelo canal de push. A notificação permanente do serviço de localização do motoboy, descrita na cláusula 3.1, é exigida pelo sistema operacional enquanto a coleta estiver ativa e não pode ser ocultada sem encerrar o rastreamento.

## 7. Retenção, exclusão e anonimização

Mantemos dados pelo período necessário para as finalidades descritas nesta Política, para cumprir obrigações legais, fiscais, contábeis e regulatórias, prevenir fraude, resolver disputas, exercer direitos e manter a segurança dos sistemas. O prazo concreto pode variar conforme a categoria de dado, o tipo de conta, o Pedido e a obrigação aplicável.

A **localização do motoboy** segue a regra própria da cláusula 3.1: existe apenas a última posição conhecida, sobrescrita a cada envio e apagada quando o profissional fica offline. Não há retenção de histórico de trajeto.

Quando uma conta é excluída, o fluxo atual verifica pedidos ativos, registra uma cópia restrita de auditoria em arquivo de contas arquivadas, remove endereços salvos e identificadores de notificação, anonimiza o perfil ativo e tenta encerrar as credenciais de autenticação. Registros relacionados a pedidos, transações, aceite de documentos, prevenção a fraude, obrigações legais ou defesa de direitos podem ser preservados pelo prazo necessário. Backups podem reter cópias temporárias até serem substituídos nos ciclos técnicos de segurança. O arquivo de auditoria deve ter acesso restrito e seguir matriz interna de retenção e eliminação.

A exclusão pode ser temporariamente impedida enquanto houver Pedido ativo ou obrigação operacional pendente. Isso não impede o titular de solicitar informação sobre o tratamento ou de exercer outros direitos previstos em lei.

## 8. Direitos do titular

Nos termos da LGPD, o titular pode solicitar confirmação da existência de tratamento, acesso, correção, informação sobre compartilhamentos, anonimização, bloqueio ou eliminação quando aplicável, portabilidade, eliminação de dados tratados com consentimento, revogação de consentimento e oposição a determinados tratamentos. O titular também pode solicitar revisão de decisão tomada unicamente de forma automatizada que produza efeitos relevantes sobre seus interesses.

A confirmação e o acesso simplificado serão fornecidos imediatamente quando possível. A declaração completa observará o prazo legal de até **15 dias**. Como agente de tratamento de pequeno porte, o ItaSuper pode se valer dos prazos ampliados previstos no art. 14 da Resolução CD/ANPD nº 2/2022; quando isso ocorrer, o titular será informado da prorrogação e do motivo. Algumas solicitações podem ser limitadas por direitos de terceiros, sigilo comercial, segurança, prevenção a fraude, obrigação legal ou necessidade de preservar registros para exercício regular de direitos; nessa hipótese, explicaremos a razão de modo apropriado.

O titular pode contatar o ItaSuper por **Itasupersuporte@gmail.com**, pelo suporte ou pela funcionalidade disponível no perfil. Caso entenda que não houve tratamento adequado, pode apresentar reclamação à Autoridade Nacional de Proteção de Dados — ANPD.

## 9. Segurança e comunicação de incidentes

Adotamos medidas técnicas e organizacionais razoáveis e compatíveis com a natureza da operação para proteger dados pessoais contra acesso não autorizado, perda, alteração, divulgação ou destruição indevida. Essas medidas incluem controles de autenticação e acesso, políticas de acesso por linha de registro no banco de dados, segregação de permissões, registros de segurança, uso de conexões protegidas e limitação de exposição de dados por perfil de acesso. Como agente de tratamento de pequeno porte, o ItaSuper mantém política de segurança simplificada nos termos dos arts. 12 e 13 da Resolução CD/ANPD nº 2/2022.

Nenhum ambiente digital é inteiramente livre de risco. O Usuário também deve manter sua senha em sigilo, usar dispositivo protegido, verificar comunicações e não compartilhar códigos de acesso.

Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, o ItaSuper comunicará a **ANPD e os titulares afetados** no prazo previsto no art. 6º da Resolução CD/ANPD nº 15, de 24 de abril de 2024, de **3 dias úteis** contados do conhecimento do incidente, prazo que, por sua condição de agente de pequeno porte, pode ser contado em dobro na forma do art. 14, II, da Resolução CD/ANPD nº 2/2022. As informações complementares que não estiverem disponíveis na comunicação inicial serão apresentadas em até **20 dias úteis** contados da comunicação preliminar, conforme o art. 9º da Resolução nº 15/2024. A comunicação preliminar, por si só, não exaure o dever previsto no art. 48 da LGPD. A comunicação aos titulares descreverá, em linguagem clara, a natureza dos dados afetados, os riscos envolvidos, as medidas adotadas e as recomendações de proteção.

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

**Última atualização:** 13 de setembro de 2026. **Vigência:** a partir de 13 de setembro de 2026, observadas as bases legais e os direitos previstos na legislação aplicável.

---

### Referências legais consultadas

- Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Resolução CD/ANPD nº 2, de 27 de janeiro de 2022 — agentes de tratamento de pequeno porte: https://www.in.gov.br/web/dou/-/resolucao-cd/anpd-n-2-de-27-de-janeiro-de-2022-376562019
- Resolução CD/ANPD nº 15, de 24 de abril de 2024 — comunicação de incidente de segurança: https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis
- ANPD — Direito dos Titulares: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares
- ANPD — Transferência Internacional de Dados: https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados
$privacy_v66$,
    'Política de Privacidade v6.6: descreve com especificidade o rastreamento do motoboy em segundo plano (serviço em primeiro plano com notificação permanente, ativo enquanto o profissional está online, uma única posição sobrescrita e apagada ao ficar offline), inclui Mercado Pago e AbacatePay entre os processadores de pagamento, adota os prazos da Resolução CD/ANPD nº 15/2024 para incidentes e registra o enquadramento como agente de tratamento de pequeno porte.',
    true
  )
  RETURNING id
)
INSERT INTO public.legal_document_changes
  (document_id, section, change_type, summary, legal_basis, display_order)
SELECT changes.document_id, changes.section, changes.change_type, changes.summary, changes.legal_basis, changes.display_order
FROM (
  SELECT new_terms.id, 'Não vinculação entre ItaSuper, motoboy e Lojista'::text,
    'added'::text,
    'Criada cláusula própria delimitando que o ItaSuper oferece apenas software de coordenação: não contrata, não emprega, não remunera, não define preço de corrida e não conhece o valor da entrega, que é combinado e pago diretamente entre Lojista e motoboy. Registrados também a adesão voluntária, a liberdade de recusar pedidos e o desligamento sem multa.'::text,
    'CLT, art. 3º; Lei nº 12.009/2009; CDC, art. 54, §4º'::text, 10
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Taxa de R$ 0,99 por entrega e sua variação futura', 'added',
    'Explicitado que a taxa de R$ 0,99 pode ser alterada no futuro, condicionando qualquer reajuste a aviso prévio de no mínimo 30 dias corridos, ausência de efeito retroativo, direito de cancelar ou migrar de plano sem multa e preservação do valor total já exibido ao Cliente no checkout de pedido confirmado.'::text,
    'CDC, arts. 30, 35, 46, 51, X, e 54, §4º'::text, 20
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Rateio da taxa de entrega', 'added',
    'Descritas as três formas de rateio da taxa de plataforma efetivamente disponíveis no painel — integralmente somada ao Cliente, dividida em partes iguais ou absorvida pelo Lojista — e reafirmado que o valor total exibido no checkout vincula o Pedido.'::text,
    'CDC, arts. 6º, III, 30, 31 e 35'::text, 30
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Tabela comercial dos planos', 'modified',
    'Acrescentada a taxa de R$ 1,99 por pedido recebido via PIX online, cobrada apenas quando a modalidade for utilizada; Autonomia passa a constar expressamente como plano legado fechado a novos cadastros; mantidos Essencial a R$ 89,90, Somente PDV a R$ 69,00 e add-on de PDV a R$ 49,00.'::text,
    'CDC, arts. 6º, III, 31 e 46; Decreto nº 7.962/2013'::text, 40
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Formas de pagamento do Cliente', 'modified',
    'Ajustada a redação sobre PIX online e PIX na maquininha: são desativados na configuração padrão, mas lojas com configuração legada podem exibir modalidade adicional, sempre identificada na tela de pagamento antes da confirmação.'::text,
    'CDC, arts. 6º, III, 31 e 37'::text, 50
  FROM new_terms
  UNION ALL
  SELECT new_terms.id, 'Definições e papéis', 'modified',
    'Motoboy passa a ser definido como profissional autônomo de moto-frete que se cadastra por conta própria, e o papel do ItaSuper é redescrito como coordenação operacional, sem intermediação de pagamento de corrida.'::text,
    'Lei nº 12.009/2009; CTB, art. 139-A'::text, 60
  FROM new_terms
  UNION ALL
  SELECT new_privacy.id, 'Localização do motoboy em segundo plano', 'added',
    'Descrito com especificidade o rastreamento: serviço em primeiro plano com notificação permanente, ativo enquanto o motoboy está online mesmo sem entrega em andamento, filtro de 8 metros, envio adaptativo de 3 a 20 segundos, armazenamento de uma única posição sobrescrita a cada envio, ausência de histórico de trajeto e exclusão da posição ao ficar offline.'::text,
    'LGPD, arts. 6º, I, IV e VI, 9º e 18'::text, 10
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Processadores de pagamento', 'modified',
    'Incluídos Mercado Pago e AbacatePay entre os processadores que podem receber dados conforme o fluxo habilitado, ao lado de Asaas e Woovi.'::text,
    'LGPD, arts. 6º, VI, e 9º, II'::text, 20
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Comunicação de incidentes de segurança', 'added',
    'Fixados os prazos da regulamentação: comunicação à ANPD e aos titulares em 3 dias úteis, contados em dobro por se tratar de agente de pequeno porte, e informações complementares em até 20 dias úteis da comunicação preliminar.'::text,
    'LGPD, art. 48; Res. CD/ANPD nº 15/2024, arts. 6º e 9º; Res. CD/ANPD nº 2/2022, art. 14, II'::text, 30
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Agente de tratamento de pequeno porte', 'added',
    'Registrado o enquadramento como agente de pequeno porte na condição de MEI, a dispensa de indicar encarregado e a manutenção de canal de comunicação com o titular, com ressalva de revisão do enquadramento em caso de tratamento de alto risco.'::text,
    'Res. CD/ANPD nº 2/2022, arts. 2º, 3º, 4º, 11, 12, 13 e 14'::text, 40
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Papéis no tratamento e dados do motoboy', 'modified',
    'Separado o que o ItaSuper controla — conta, status e localização do motoboy — do que é decidido pelo Lojista, e registrado que a Plataforma não trata valor de corrida, saldo, dados bancários, CNH, CRLV nem contrato do profissional.'::text,
    'LGPD, arts. 5º, VI e VII, 6º e 37'::text, 50
  FROM new_privacy
  UNION ALL
  SELECT new_privacy.id, 'Diretório de motoboys por cidade', 'added',
    'Descrito que a exibição do contato do motoboy às lojas da cidade depende de autorização própria do profissional, revogável a qualquer tempo sem perda do acesso ao aplicativo.'::text,
    'LGPD, arts. 6º, 8º, §5º, e 18, IX'::text, 60
  FROM new_privacy
) AS changes(document_id, section, change_type, summary, legal_basis, display_order);

COMMIT;
