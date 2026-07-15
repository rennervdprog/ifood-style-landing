import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";

const TermosDeUso = () => {
  const navigate = useNavigate();
  const dataAtualizacao = "15 de julho de 2026";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Termos de Uso — ItaSuper</title>
        <meta name="description" content="Termos de uso do ItaSuper: regras para clientes, lojistas e entregadores na plataforma de delivery e cardápio digital." />
        <link rel="canonical" href="https://itasuper.com.br/termos-de-uso" />
        <meta property="og:title" content="Termos de Uso — ItaSuper" />
        <meta property="og:description" content="Termos de uso da plataforma ItaSuper para clientes, lojistas e entregadores." />
        <meta property="og:url" content="https://itasuper.com.br/termos-de-uso" />
      </Helmet>
      <div className="sticky top-0 bg-card border-b border-border z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Termos de Uso</h1>
        <span className="text-xs text-muted-foreground ml-auto">Atualizado em {dataAtualizacao} · v5.1</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 text-sm text-muted-foreground">

        <section className="space-y-2 rounded-xl border border-border bg-card/60 p-4">
          <p className="text-xs font-bold text-foreground">Identificação do Controlador</p>
          <p className="text-xs">
            <strong className="text-foreground">Razão social:</strong> 66.155.289 Renner Vinicius Dias (MEI)<br />
            <strong className="text-foreground">CNPJ:</strong> 66.155.289/0001-26<br />
            <strong className="text-foreground">Endereço:</strong> Rua São Francisco, nº 635, Itatinga/SP, Brasil<br />
            <strong className="text-foreground">Encarregado de Dados (DPO — Art. 41 LGPD):</strong> Renner Vinicius Dias · <a href="mailto:vinivias13@gmail.com" className="text-primary underline">vinivias13@gmail.com</a>
          </p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 pt-1 border-t border-border/60 mt-2">
            ⚠️ Documento técnico sujeito a revisão jurídica por advogado registrado na OAB antes da consolidação final.
          </p>
        </section>

        <section className="space-y-3">
          <p>A plataforma <strong className="text-foreground">ItaSuper</strong> é um serviço de intermediação digital que conecta consumidores, lojistas e entregadores para pedidos com entrega ou retirada. Inclui também o módulo <strong className="text-foreground">PDV (Ponto de Venda)</strong>, que permite ao lojista registrar vendas presenciais no próprio estabelecimento.</p>
          <p>Ao utilizar o ItaSuper, o Usuário declara que leu, compreendeu e concorda com estes Termos. Estes Termos regulam a relação entre o ItaSuper e os Usuários, nos termos do CDC (Lei nº 8.078/1990), Marco Civil da Internet (Lei nº 12.965/2014), Código Civil (Lei nº 10.406/2002) e LGPD (Lei nº 13.709/2018).</p>
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-card/60 p-4">
          <h2 className="text-base font-bold text-foreground">Módulos Opcionais (Add-ons)</h2>
          <p className="text-xs">Além do plano base, o Lojista pode contratar módulos adicionais com cobrança mensal separada, somada à fatura Asaas do plano:</p>
          <ul className="list-disc pl-4 space-y-1 text-xs">
            <li><strong className="text-foreground">PDV — Ponto de Venda:</strong> R$ 49,00/mês para lojas cadastradas após a implantação desta cláusula. Lojas cadastradas anteriormente mantêm a regra vigente na data do cadastro (cobrança por venda) enquanto o cadastro permanecer ativo.</li>
            <li><strong className="text-foreground">Plano Somente PDV:</strong> R$ 69,00/mês. Modalidade destinada ao Lojista que deseja utilizar apenas o caixa presencial, <strong className="text-foreground">sem vitrine pública, sem cardápio digital e sem serviço de delivery</strong>. Não há comissão por pedido nesta modalidade. O Lojista pode migrar a qualquer momento para os planos de delivery (Comissão, Essencial ou Autonomia); ao migrar, o módulo PDV passa a seguir a regra de add-on (R$ 49,00/mês adicional).</li>
          </ul>
          <p className="text-xs"><strong className="text-foreground">Ativação no meio do mês:</strong> cobrança proporcional aos dias restantes até a próxima fatura.</p>
          <p className="text-xs"><strong className="text-foreground">Cancelamento:</strong> gera crédito proporcional aos dias não utilizados, abatido na próxima fatura. O módulo continua ativo até o fim do ciclo já pago.</p>
          <p className="text-xs"><strong className="text-foreground">Reajuste:</strong> preços podem ser reajustados anualmente, com aviso prévio de 30 dias.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">1. Definições</h2>
          <ul className="list-disc pl-4 space-y-2">
            <li><strong className="text-foreground">Plataforma:</strong> Aplicativo web e nativo ItaSuper e todos os serviços relacionados.</li>
            <li><strong className="text-foreground">Usuário:</strong> Qualquer pessoa que utilize a Plataforma (Cliente, Lojista, Entregador, Administrador).</li>
            <li><strong className="text-foreground">Cliente:</strong> Consumidor final, pessoa física, que adquire produtos pelo aplicativo (relação regida pelo CDC).</li>
            <li><strong className="text-foreground">Lojista/Entregador:</strong> Profissional ou empresa que utiliza a Plataforma para fins comerciais (relação empresarial/B2B).</li>
            <li><strong className="text-foreground">Subtotal:</strong> Valor dos produtos antes de descontos, taxas e frete.</li>
            <li><strong className="text-foreground">Repasse:</strong> Valor líquido transferido ao Lojista após dedução de taxas, comissões e tributos aplicáveis.</li>
            <li><strong className="text-foreground">Saldo Pendente:</strong> Soma acumulada de taxas da plataforma devidas pelo Lojista referentes a pedidos pagos por métodos físicos.</li>
            <li><strong className="text-foreground">PDV (Ponto de Venda):</strong> Módulo para vendas presenciais com caixa registradora digital, gestão de turno, desconto, troco e histórico.</li>
            <li><strong className="text-foreground">Gateway de Pagamento:</strong> Empresa de processamento financeiro (<strong className="text-foreground">Asaas Gestão Financeira Instituição de Pagamentos S.A.</strong>, CNPJ 19.540.550/0001-21, autorizada a funcionar pelo Banco Central do Brasil).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">2. Acesso e Cadastro</h2>
          <p>2.1. O cadastro é gratuito para Clientes e Entregadores. Lojistas devem escolher um plano de assinatura.</p>
          <p>2.2. O cadastro é permitido a maiores de 18 anos. Adolescentes entre 16 e 18 anos podem utilizar a Plataforma <strong className="text-foreground">apenas como Clientes</strong>, mediante assistência dos responsáveis legais, nos termos do Art. 4º do Código Civil. O cadastro como <strong className="text-foreground">Lojista</strong> ou <strong className="text-foreground">Entregador</strong> exige maioridade civil (18 anos), em razão das obrigações fiscais, regulatórias (Asaas/Banco Central) e da exigência de CNH no caso do entregador. Menores de 16 anos não podem cadastrar-se.</p>
          <p>2.3. Cada Usuário pode manter apenas uma conta ativa. Contas duplicadas poderão ser unificadas ou desativadas mediante <strong className="text-foreground">notificação prévia por e-mail/WhatsApp, com prazo de 5 dias úteis para manifestação</strong> do titular, em respeito ao contraditório e à boa-fé objetiva (Art. 422 do CC e Art. 7º, X do Marco Civil).</p>
          <p>2.4. O Usuário é responsável pela confidencialidade de suas credenciais. Acessos não autorizados devem ser comunicados imediatamente.</p>
          <p>2.5. O ItaSuper implementa controle de sessão única: ao fazer login em novo dispositivo, sessões anteriores são encerradas automaticamente. IP e identificadores de dispositivo são tratados com base no legítimo interesse de segurança (Art. 7º, IX da LGPD).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">3. Obrigações do Lojista</h2>
          <p>3.1. O Lojista deve ser o titular legal do estabelecimento e responsabilizar-se pela veracidade das informações.</p>
          <p>3.2. É obrigatório manter atualizados: nome, CNPJ/CPF, endereço, horários, cardápio e preços.</p>
          <p>3.3. O Lojista é exclusivamente responsável pela qualidade, higiene, prazo de validade e conformidade legal dos produtos.</p>
          <p>3.4. <strong className="text-foreground">Subconta Asaas:</strong> Dados falsos ou divergentes no cadastro do gateway configuram fraude (Art. 171 do Código Penal) e acarretam suspensão imediata.</p>
          <p>3.5. <strong className="text-foreground">Módulo PDV:</strong> O Lojista é responsável pela conformidade fiscal das vendas presenciais perante autoridades tributárias. A comissão PDV é cobrada na fatura mensal conforme o plano vigente.</p>
          <p>3.6. O Lojista pode solicitar exclusão de conta e dados pelo painel da loja, conforme Art. 18 da LGPD.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">4. Serviços da Plataforma</h2>
          <p>4.1. O ItaSuper é intermediador digital. Não fabrica, estoca, embala ou entrega produtos diretamente.</p>
          <p>4.2. Serviços incluem: cardápio digital, pagamentos PIX Online/PIX Maquininha/cartão/dinheiro, gestão de entregas com motoboy próprio, cupons, fidelidade, notificações, relatórios, extrato financeiro, <strong className="text-foreground">módulo PDV completo</strong>, sistema de suporte via tickets, Sales Coach (ferramenta de recomendação assistida por IA para lojistas, com direito à revisão humana — vide cláusula 14.3) e <strong className="text-foreground">integração de WhatsApp automático (Evolution API)</strong> para envio de mensagens transacionais aos clientes da loja.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">4-A. Canal de Suporte e Ouvidoria</h2>
          <div className="space-y-2 text-muted-foreground">
            <p>4-A.1. O ItaSuper disponibiliza sistema de suporte via tickets digitais, acessível a Clientes, Lojistas e Entregadores pelo painel da Plataforma.</p>
            <p>4-A.2. Cada ticket é registrado com identificação do usuário, data, hora, categoria e histórico completo de mensagens, com rastreabilidade do agente responsável.</p>
            <p>4-A.3. Prazo de primeira resposta: até 2 dias úteis. Tickets urgentes (bloqueio de conta, falha financeira) têm atendimento prioritário em até 24 horas.</p>
            <p>4-A.4. <strong className="text-foreground">Ouvidoria:</strong> Em caso de descumprimento do SLA ou insatisfação com o atendimento, o Usuário pode acionar a Ouvidoria pelo WhatsApp (22) 99279-6291, com retorno em até 5 dias úteis. Persistindo o impasse, o consumidor pode recorrer ao Procon ou ao consumidor.gov.br.</p>
            <p>4-A.5. O conteúdo das conversas constitui dado pessoal e está sujeito à Política de Privacidade e à LGPD.</p>
          </div>

          <h2 className="text-base font-bold text-foreground">4-B. WhatsApp Automático (Evolution API)</h2>
          <div className="space-y-2 text-muted-foreground">
            <p>4-B.1. O Lojista pode, opcionalmente, conectar um número de WhatsApp próprio à Plataforma via Evolution API, lendo o QR Code no painel da loja. A conexão é individual por loja e pode ser desconectada a qualquer momento.</p>
            <p>4-B.2. Uma vez conectado, o ItaSuper envia automaticamente, em nome da loja, mensagens <strong className="text-foreground">transacionais</strong> ao cliente referentes ao ciclo do pedido (confirmação, em preparo, pronto, saiu para entrega, entregue, cancelado), bem como respostas automáticas configuradas pelo Lojista (ex.: saudação, cardápio). Mensagens de natureza <strong className="text-foreground">promocional/marketing</strong> exigem consentimento específico do destinatário e são de responsabilidade exclusiva do Lojista.</p>
            <p>4-B.3. O Lojista é o <strong className="text-foreground">único responsável</strong> pelo número conectado, pelo conteúdo dos templates personalizados e pelo cumprimento dos Termos de Serviço do WhatsApp/Meta, incluindo regras anti-spam e obtenção de consentimento dos destinatários. O ItaSuper aplica limites diários progressivos, deduplicação e intervalo mínimo entre envios para reduzir risco de banimento, mas <strong className="text-foreground">não garante</strong> a continuidade do número junto ao WhatsApp.</p>
            <p>4-B.4. O Cliente, ao marcar a opção <em>"Quero receber atualizações do pedido por WhatsApp"</em> no cadastro/checkout, autoriza expressamente o recebimento das mensagens transacionais da loja em que realizou o pedido, com base na execução do contrato e no consentimento (Art. 7º, V e I da LGPD). O cliente pode revogar o consentimento a qualquer momento respondendo <strong className="text-foreground">"PARAR"</strong> à loja, desabilitando no perfil ou via suporte, sem qualquer ônus.</p>
            <p>4-B.5. O ItaSuper não se responsabiliza por suspensão, banimento ou indisponibilidade do número de WhatsApp do Lojista, nem por falhas, latência ou indisponibilidade da Evolution API e da infraestrutura do WhatsApp/Meta.</p>
          </div>

          <h2 className="text-base font-bold text-foreground">5. Planos e Assinatura</h2>
          <ul className="list-disc pl-4 space-y-2">
            <li><strong className="text-foreground">Essencial (R$ 0/mês na janela inicial):</strong> 0% comissão sobre pedidos delivery. Taxa PIX Online: R$ 1,99/transação (descontada do repasse). Taxa de entrega: R$ 0,99/pedido (paga pelo cliente). PDV: R$ 1,00/venda presencial. <strong className="text-foreground">Plano dinâmico:</strong> a gratuidade da mensalidade é uma <strong className="text-foreground">janela inicial de adesão limitada a R$ 5.000 em vendas nos últimos 60 dias</strong>. Ao ultrapassar esse volume, a mensalidade de R$ 180/mês passa a ser devida, com 30 dias de aviso prévio e aceite expresso (vide 5.2). Uma vez atingido o limite, a loja <strong className="text-foreground">não retorna</strong> ao status gratuito, mesmo que o faturamento futuro caia abaixo de R$ 5.000.</li>
            <li><strong className="text-foreground">Autonomia (R$ 0/mês na janela inicial):</strong> 0% comissão sobre pedidos delivery. Sem taxa de R$ 0,99 da plataforma na entrega — o cliente paga exatamente a taxa que o Lojista define. Taxa PIX Online: R$ 1,99/transação. PDV: R$ 1,00/venda presencial. <strong className="text-foreground">Plano dinâmico:</strong> a gratuidade da mensalidade é uma <strong className="text-foreground">janela inicial de adesão limitada a R$ 2.500 em vendas nos últimos 60 dias</strong>. Ao ultrapassar esse volume, a mensalidade de R$ 239,90/mês passa a ser devida, com 30 dias de aviso prévio e aceite expresso (vide 5.2). Uma vez atingido o limite, a loja <strong className="text-foreground">não retorna</strong> ao status gratuito.</li>
            <li><strong className="text-foreground">Apoiador (R$ 75/mês — limitado a 10 vagas):</strong> mensalidade fixa para os primeiros 10 lojistas que aderirem, sem reajuste por inflação ou política comercial. 0% comissão. Taxas: R$ 1,99 PIX Online, R$ 0,99/entrega (paga pelo cliente), R$ 1,00/venda PDV. Reajustes só podem ocorrer em caso de (i) alteração de carga tributária que incida diretamente sobre o serviço, ou (ii) descumprimento contratual pelo Lojista. As vagas são garantidas enquanto a loja mantiver o plano ativo e adimplente.</li>
            <li><strong className="text-foreground">Comissão (R$ 0/mês + comissão por pedido):</strong> plano sem mensalidade, disponibilizado exclusivamente por acordo comercial individual com o ItaSuper (parcerias VIP e migrações negociadas). Comissão de até 6% sobre o subtotal de cada pedido delivery, definida no ato do cadastro/migração. Taxas operacionais (PIX Online R$ 1,99, entrega R$ 0,99 paga pelo cliente, PDV R$ 1,00/venda) seguem as mesmas regras dos demais planos. Alterações de comissão exigem 30 dias de aviso prévio.</li>
            <li><strong className="text-foreground">Crescimento / Híbrido (mensalidade + comissão reduzida):</strong> plano híbrido oferecido caso a caso pelo ItaSuper (mensalidade a partir de R$ 50/mês + comissão de até 2,5% por pedido), destinado a lojas em transição entre Comissão e Essencial. Valores são fixados na contratação e só podem ser alterados com 30 dias de aviso prévio e direito de rescisão sem multa.</li>
          </ul>
          <p>5.2. <strong className="text-foreground">Planos Dinâmicos (Essencial e Autonomia) — regra de ativação da mensalidade:</strong> O faturamento é apurado automaticamente em janela móvel de 60 dias. Ao ultrapassar R$ 5.000 (Essencial) ou R$ 2.500 (Autonomia), a mensalidade cheia (R$ 180 ou R$ 239,90) passa a ser devida com 30 dias de aviso prévio no painel e no WhatsApp. Dentro desse prazo o Lojista deve responder no painel:</p>
          <ul className="list-disc pl-4 space-y-1 text-xs">
            <li><strong className="text-foreground">Aceitar:</strong> a mensalidade é ativada e a primeira cobrança é gerada no vencimento acordado. A loja segue operando normalmente.</li>
            <li><strong className="text-foreground">Recusar (ou não responder até o vencimento):</strong> a loja é <strong className="text-foreground">imediatamente suspensa (status inativo)</strong> — vitrine pública, cardápio digital, PDV e recebimento de novos pedidos ficam bloqueados — e permanece suspensa até que o Lojista aceite a mensalidade pelo painel. Alternativamente, o Lojista pode, sem multa, migrar para outro plano compatível (ex.: Comissão) ou solicitar o encerramento da conta pelo painel/atendimento.</li>
          </ul>
          <p>5.2.1. Uma vez atingido o limite do plano dinâmico, <strong className="text-foreground">não há retorno ao status gratuito</strong> — a mensalidade permanece devida a partir da ativação, ainda que o faturamento futuro fique abaixo do limite, até que o Lojista migre de plano ou encerre a conta. Lojas cadastradas antes de 20/05/2025 mantêm os valores anteriores.</p>
          <p>5.3. <strong className="text-foreground">Comissão PDV:</strong> Incide sobre o subtotal das vendas presenciais. Acumulada ao longo do mês e incluída na fatura mensal junto à mensalidade.</p>
          <p>5.4. Os planos Essencial, Autonomia (ambos grátis inicial) e Somente PDV podem ser utilizados imediatamente.</p>
          <p>5.5. Alterações gerais de valor serão comunicadas com 30 dias de antecedência, facultado ao Lojista rescindir sem multa antes da vigência. Inadimplência superior a 30 dias pode resultar em desativação automática de delivery e PDV, observado o procedimento de notificação previsto em 8.2.</p>
          <p>5.6. <strong className="text-foreground">Sem fidelidade e sem multa de rescisão:</strong> O Lojista pode cancelar a assinatura ou migrar de plano a qualquer momento pelo painel da loja, sem fidelidade mínima, sem multa contratual e sem taxa de cancelamento. A cobrança é mensal e pré-paga; ao cancelar, o acesso permanece ativo até o fim do ciclo já pago e não há reembolso proporcional, salvo nos casos previstos no CDC. Saldos pendentes de taxas físicas (cláusula 8.2) e comissão PDV do mês corrente permanecem devidos.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">6. Obrigações do Cliente</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Fornecer endereço correto e completo.</li>
            <li>Estar disponível para receber o pedido.</li>
            <li>Pagar conforme método escolhido no checkout.</li>
            <li>Confirmar recebimento com código PIN.</li>
            <li>Tratar lojistas e entregadores com respeito.</li>
            <li>Não realizar pedidos fraudulentos.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">7. Entregador Autônomo</h2>
          <p>7.1. O Entregador é profissional autônomo independente. Não há vínculo empregatício com o ItaSuper.</p>
          <p>7.2. O Entregador deve manter CNH regularizada, zelar pelos produtos, coletar o PIN de coleta e entregá-lo ao cliente para confirmação.</p>
          <p>7.3. <strong className="text-foreground">Motoboy próprio de loja:</strong> a modalidade "Motoboy de Loja" destina-se exclusivamente a entregadores contratados, gerenciados e remunerados pelo Lojista. O ItaSuper atua apenas como <strong className="text-foreground">ferramenta tecnológica</strong> de roteirização e comunicação, não contrata, não remunera, não fiscaliza nem responde por esses entregadores. Qualquer vínculo (trabalhista, civil, tributário, previdenciário ou de qualquer outra natureza) é de responsabilidade exclusiva do Lojista contratante. O acesso do motoboy ao painel só é liberado após vínculo expresso criado e aceito pelo Lojista; sem vínculo ativo, o app não opera.</p>
          <p>7.4. O Lojista é o único responsável por exigir, verificar e arquivar a documentação (CNH, habilitação, seguro, regularidade da moto, etc.) de seus motoboys próprios, isentando integralmente o ItaSuper de qualquer responsabilidade decorrente de acidentes, infrações, danos a terceiros ou inadimplemento contratual envolvendo o motoboy de loja.</p>
          <p>7.5. <strong className="text-foreground">Saques do Entregador:</strong> os ganhos do Entregador ficam disponíveis em sua carteira dentro do app e podem ser sacados via PIX, respeitadas as seguintes regras operacionais: (i) <strong className="text-foreground">valor mínimo por saque de R$ 5,00</strong>; (ii) <strong className="text-foreground">1 (um) saque por semana</strong> por padrão, contado a partir do último saque aprovado; (iii) <strong className="text-foreground">prazo de processamento em até 1 (um) dia útil (D+1)</strong> após a solicitação, condicionado à confirmação de compensação pelo Asaas; (iv) o PIX é enviado para a chave PIX cadastrada pelo próprio Entregador, sendo de sua responsabilidade a exatidão dos dados. Alterações nessas regras (mínimo, periodicidade ou prazo) serão comunicadas ao Entregador com <strong className="text-foreground">antecedência mínima de 30 (trinta) dias</strong> por push, e-mail e/ou WhatsApp, podendo o Entregador encerrar seu cadastro sem custo caso não concorde.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">8. Pagamentos e Repasses</h2>
          <p className="rounded-xl border border-border/50 bg-muted/30 p-3 text-[11px] leading-relaxed">
            <strong className="text-foreground block mb-1">Prestação de Serviços Financeiros</strong>
            Os serviços financeiros e de pagamentos disponibilizados por meio da presente plataforma, incluindo abertura e manutenção de conta de pagamento, processamento de transações, emissão de boletos, transferências, pagamentos e demais movimentações de valores, são prestados pelo{" "}
            <strong className="text-foreground">ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A.</strong> (CNPJ 19.540.550/0001-21), instituição de pagamento autorizada a funcionar pelo Banco Central do Brasil.
            {" "}A ItaSuper atua exclusivamente como integradora tecnológica e distribuidora da experiência do produto, não sendo instituição financeira ou de pagamento, nem realizando intermediação financeira em nome próprio.
            {" "}O lojista declara ciência de que o relacionamento financeiro/de pagamentos e a responsabilidade regulatória pelos serviços acima descritos são do{" "}
            <strong className="text-foreground">ASAAS GESTÃO FINANCEIRA S.A.</strong>, nos termos da regulamentação vigente.
          </p>

          <p>8.1. <strong className="text-foreground">PIX Online:</strong> processado pelo Asaas com split automático entre plataforma e lojista. Disponível apenas para lojistas com conta Asaas configurada no painel.</p>
          <p>8.2. <strong className="text-foreground">Métodos físicos (Dinheiro, Cartão na entrega e PIX Maquininha):</strong> o cliente paga diretamente ao lojista ou ao entregador. A taxa da plataforma (R$ 0,99 por entrega nos planos Essencial e Apoiador; zero no plano Autonomia) é acumulada como Saldo Pendente. Quando o Saldo Pendente atingir <strong className="text-foreground">R$ 30,00</strong>, a plataforma gera uma cobrança PIX (QR Code/copia-cola) com vencimento na <strong className="text-foreground">segunda-feira</strong> seguinte, enviada ao Lojista por e-mail/WhatsApp/painel. O débito automático recorrente só ocorrerá caso o Lojista ative expressamente o Pix Automático (Res. BCB nº 103/2024). Saldo superior a <strong className="text-foreground">R$ 500,00</strong> gera notificação com prazo de <strong className="text-foreground">5 dias úteis</strong> para regularização; persistindo a inadimplência, o acesso ao painel é restrito às funções de regularização financeira e atendimento aos pedidos em andamento, preservando o consumidor final. Inadimplência superior a 30 dias implica suspensão completa da loja, após nova notificação.</p>
          <p>8.3. <strong className="text-foreground">PIX Maquininha:</strong> modalidade em que o cliente paga via PIX pelo leitor do lojista na entrega, sem integração com Asaas. Tratado como pagamento físico para fins de cobrança de repasse.</p>
          <p>8.4. Vendas PDV: plataforma não intermedia valores presenciais — apenas cobra comissão PDV na fatura mensal.</p>
          <p>8.5. Cancelamentos com PIX Online: reembolso automático via Asaas em até 7 dias úteis, creditado como saldo na carteira da plataforma. Pedidos pagos em dinheiro, cartão ou PIX Maquininha não são elegíveis para reembolso automático — a resolução é entre cliente e lojista, sem prejuízo do direito do consumidor previsto no CDC.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">9. Taxas Detalhadas</h2>
          <p>9.1. Comissão delivery incide apenas sobre o <strong className="text-foreground">subtotal dos produtos</strong> (excluindo entrega, desconto e taxa PIX).</p>
          <p>9.2. Comissão PDV: nos planos Essencial, Autonomia e Apoiador aplica-se taxa fixa de <strong className="text-foreground">R$ 1,00 por venda PDV</strong>, incluída na fatura mensal. O plano Somente PDV não tem comissão por venda.</p>
          <p>9.3. Taxa PIX (R$ 1,99): cobrada por transação PIX Online em todos os planos com delivery, descontada automaticamente do valor repassado ao lojista.</p>
          <p>9.4. Taxa de entrega (R$ 0,99): somada à taxa base definida pelo lojista, paga pelo cliente no checkout. Aplica-se aos planos Essencial e Apoiador em todos os métodos de pagamento. No plano Autonomia essa taxa da plataforma é zero. <em>Pedidos e saldos anteriores a 13/07/2026 permanecem em R$ 2,00 até quitação.</em></p>
          <p>9.5. O lojista pode configurar quais métodos de pagamento aceita através do painel de configurações da loja. A ativação do PIX Online requer conta Asaas configurada. PIX Maquininha, Cartão e Dinheiro estão disponíveis por padrão.</p>
          <p>9.6. Todas as taxas são consultáveis no painel financeiro da loja.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">10. Cancelamentos e Reembolsos</h2>
          <p>10.1. Cancelamentos pelo Cliente antes da confirmação do Lojista: sem ônus.</p>
          <p>10.2. <strong className="text-foreground">Direito de arrependimento (Art. 49 do CDC):</strong> nas compras à distância, o consumidor tem 7 dias para se arrepender, <strong className="text-foreground">exceto</strong> quando se tratar de alimentos preparados, refeições perecíveis e produtos personalizados, cuja exceção decorre da natureza do bem (perecibilidade e produção sob encomenda). Para produtos não perecíveis adquiridos pelo aplicativo, o direito de arrependimento é integralmente assegurado.</p>
          <p>10.3. Após confirmação do pedido perecível: o cancelamento depende de negociação entre as partes; o ItaSuper pode mediar quando solicitado.</p>
          <p>10.4. Vendas PDV finalizadas no caixa: reembolso é responsabilidade do Lojista conforme CDC.</p>
          <p>10.5. O ItaSuper reserva-se o direito de cancelar pedidos suspeitos de fraude.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">10-A. Prevenção a Fraudes e Bloqueio Automático</h2>
          <div className="space-y-2 text-muted-foreground">
            <p>10-A.1. O ItaSuper utiliza sistemas automatizados de detecção de fraudes. Pedidos com endereço em cidade divergente da área de cobertura da loja ou a distância superior ao raio máximo podem ser bloqueados automaticamente.</p>
            <p>10-A.2. Tentativas de fraude são registradas e podem resultar em suspensão, bloqueio permanente e comunicação às autoridades (Art. 171 do Código Penal).</p>
            <p>10-A.3. Em respeito ao Art. 20 da LGPD, o Usuário que considerar um bloqueio indevido tem direito à <strong className="text-foreground">revisão humana</strong>, mediante solicitação pelo sistema de suporte. A análise será concluída em até <strong className="text-foreground">48 horas úteis</strong>, com resposta fundamentada e canal de recurso à Ouvidoria.</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">11. Condutas Proibidas</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Usar a Plataforma para fins ilegais ou fraudulentos.</li>
            <li>Criar contas falsas ou usar dados de terceiros.</li>
            <li>Realizar engenharia reversa ou extração automatizada de dados.</li>
            <li>Manipular avaliações ou cupons de forma fraudulenta.</li>
            <li>Comercializar produtos ilegais, falsificados ou proibidos.</li>
            <li>Registrar vendas PDV fictícias para manipular relatórios.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">12. Propriedade Intelectual</h2>
          <p>12.1. Todo o conteúdo da Plataforma (marca, layout, código, design) é propriedade do ItaSuper, protegido pela Lei nº 9.279/1996 e Lei nº 9.610/1998.</p>
          <p>12.2. Lojistas concedem ao ItaSuper licença <strong className="text-foreground">não exclusiva, gratuita e territorialmente limitada ao Brasil</strong>, de uso de suas marcas, logotipos e imagens de produtos, exclusivamente para divulgação na Plataforma, com vigência durante a relação contratual e por até <strong className="text-foreground">30 dias após o encerramento</strong>, prazo restrito à remoção dos materiais em cache, índices de busca e backups operacionais, bem como à finalização de entregas e relatórios pendentes. Após esse prazo, o ItaSuper compromete-se a remover ativamente os materiais identificáveis.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">13. Limitação de Responsabilidade</h2>
          <p>13.1. O ItaSuper não se responsabiliza por: qualidade dos produtos, atrasos por força maior, dados incorretos fornecidos pelos Usuários, falhas de terceiros (Supabase, Asaas, Firebase, Evolution API, WhatsApp/Meta), uso indevido de credenciais, ou conformidade fiscal das vendas PDV. <strong className="text-foreground">Esta exclusão não se aplica</strong> a violações de dados pessoais e a falhas de segurança da informação imputáveis ao ItaSuper, hipóteses regidas pela LGPD e demais normas aplicáveis.</p>
          <p>13.2. Nas relações empresariais (Lojistas e Entregadores PJ), a responsabilidade máxima do ItaSuper limita-se ao valor pago à Plataforma nos últimos 30 dias.</p>
          <p>13.3. <strong className="text-foreground">A limitação prevista em 13.2 não se aplica</strong> às relações de consumo regidas pelo CDC, aos casos de dolo, culpa grave, violação de dados pessoais ou descumprimento de obrigação legal, hipóteses em que a responsabilidade observará integralmente a legislação aplicável.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">14. Privacidade, LGPD e Decisões Automatizadas</h2>
          <p>14.1. O tratamento de dados é regido pela Política de Privacidade disponível na Plataforma, em conformidade com a LGPD (Lei nº 13.709/2018).</p>
          <p>14.2. Para exercer direitos LGPD, utilize o painel da Plataforma ou contate o Encarregado pelo Tratamento de Dados (DPO) por e-mail <strong className="text-foreground">dpo@itasuper.app</strong> ou WhatsApp (22) 99279-6291.</p>
          <p>14.3. <strong className="text-foreground">Decisões automatizadas (Art. 20 LGPD):</strong> recomendações do Sales Coach (IA) e bloqueios antifraude podem ser revistos por humano mediante solicitação ao suporte, com resposta em até 48 horas úteis. Em caso de não atendimento, o titular pode reclamar à <strong className="text-foreground">Autoridade Nacional de Proteção de Dados (ANPD)</strong> em www.gov.br/anpd.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">15. Foro e Legislação</h2>
          <p>15.1. <strong className="text-foreground">Consumidores:</strong> nas relações regidas pelo CDC, o foro competente é o do domicílio do consumidor (Art. 101, I do CDC).</p>
          <p>15.2. <strong className="text-foreground">Relações empresariais (Lojistas e Entregadores PJ):</strong> elege-se o foro da comarca de <strong className="text-foreground">Itatinga/SP</strong>, com renúncia a qualquer outro, respeitada a possibilidade de declínio em caso de hipossuficiência (CPC, Art. 63, §3º).</p>
          <p>15.3. Aplica-se o direito brasileiro: CDC (Lei nº 8.078/1990), Código Civil (Lei nº 10.406/2002), Marco Civil (Lei nº 12.965/2014), LGPD (Lei nº 13.709/2018) e Decreto nº 7.962/2013.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">16. Alterações dos Termos</h2>
          <p>16.1. Alterações serão comunicadas com antecedência mínima de <strong className="text-foreground">30 dias</strong> via e-mail ou notificação na Plataforma.</p>
          <p>16.2. O uso continuado após as alterações implica aceitação dos novos Termos. O Usuário que discordar poderá rescindir sem ônus antes da entrada em vigor.</p>
        </section>

        <section className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground text-center">
            ItaSuper — Plataforma de Intermediação Digital<br />
            66.155.289 Renner Vinicius Dias · CNPJ 66.155.289/0001-26 · Itatinga/SP · Brasil<br />
            Versão 5.0 · Última atualização: {dataAtualizacao} · Dúvidas: WhatsApp (22) 99279-6291<br />
            <span className="text-amber-600 dark:text-amber-400">Sujeito a revisão jurídica final pela OAB.</span>
          </p>
        </section>

      </div>
    </div>
  );
};

export default TermosDeUso;
