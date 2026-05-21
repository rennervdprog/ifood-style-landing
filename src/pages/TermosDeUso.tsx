import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermosDeUso = () => {
  const navigate = useNavigate();
  const dataAtualizacao = "20 de maio de 2025";

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-card border-b border-border z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Termos de Uso</h1>
        <span className="text-xs text-muted-foreground ml-auto">Atualizado em {dataAtualizacao}</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 text-sm text-muted-foreground">

        <section className="space-y-3">
          <p>A plataforma <strong className="text-foreground">ItaSuper</strong> é um serviço de intermediação digital que conecta consumidores, lojistas e entregadores para pedidos com entrega ou retirada. Inclui também o módulo <strong className="text-foreground">PDV (Ponto de Venda)</strong>, que permite ao lojista registrar vendas presenciais no próprio estabelecimento.</p>
          <p>Ao utilizar o ItaSuper, o Usuário declara que leu, compreendeu e concorda com estes Termos. Estes Termos regulam a relação entre o ItaSuper e os Usuários, nos termos do CDC (Lei nº 8.078/1990), Marco Civil da Internet (Lei nº 12.965/2014) e LGPD (Lei nº 13.709/2018).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">1. Definições</h2>
          <ul className="list-disc pl-4 space-y-2">
            <li><strong className="text-foreground">Plataforma:</strong> Aplicativo web e nativo ItaSuper e todos os serviços relacionados.</li>
            <li><strong className="text-foreground">Usuário:</strong> Qualquer pessoa que utilize a Plataforma (Cliente, Lojista, Entregador, Administrador).</li>
            <li><strong className="text-foreground">PDV (Ponto de Venda):</strong> Módulo para vendas presenciais com caixa registradora digital, gestão de turno, desconto, troco e histórico.</li>
            <li><strong className="text-foreground">Gateway de Pagamento:</strong> Empresa de processamento financeiro (atualmente Asaas Pagamentos S.A.).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">2. Acesso e Cadastro</h2>
          <p>2.1. O cadastro é gratuito para Clientes e Entregadores. Lojistas devem escolher um plano de assinatura.</p>
          <p>2.2. O Usuário deve ter no mínimo 18 anos. A Plataforma não é destinada a menores de 18 anos.</p>
          <p>2.3. Cada Usuário pode manter apenas uma conta ativa. Contas duplicadas serão removidas sem aviso.</p>
          <p>2.4. O Usuário é responsável pela confidencialidade de suas credenciais. Acessos não autorizados devem ser comunicados imediatamente.</p>
          <p>2.5. O ItaSuper implementa controle de sessão única: ao fazer login em novo dispositivo, sessões anteriores são encerradas automaticamente.</p>
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
          <p>4.2. Serviços incluem: cardápio digital, pagamentos PIX Online/PIX Maquininha/cartão/dinheiro, gestão de entregas com motoboy próprio, cupons, fidelidade, notificações, relatórios, extrato financeiro, <strong className="text-foreground">módulo PDV completo</strong>, sistema de suporte via tickets e Sales Coach (ferramenta de recomendação assistida por IA para lojistas).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">4-A. Canal de Suporte ao Usuário</h2>
          <div className="space-y-2 text-muted-foreground">
            <p>4-A.1. O ItaSuper disponibiliza sistema de suporte via tickets digitais, acessível a Clientes, Lojistas e Entregadores pelo painel da Plataforma.</p>
            <p>4-A.2. Cada ticket é registrado com identificação do usuário, data, hora, categoria e histórico completo de mensagens, com rastreabilidade do agente responsável.</p>
            <p>4-A.3. Prazo de primeira resposta: até 2 dias úteis. Tickets urgentes (bloqueio de conta, falha financeira) têm atendimento prioritário.</p>
            <p>4-A.4. O conteúdo das conversas constitui dado pessoal e está sujeito à Política de Privacidade e à LGPD.</p>
          </div>

          <h2 className="text-base font-bold text-foreground">5. Planos e Assinatura</h2>
          <ul className="list-disc pl-4 space-y-2">
            <li><strong className="text-foreground">Essencial (R$ 90/mês):</strong> 0% comissão sobre pedidos delivery. Taxa PIX Online: R$ 1,99/transação (descontada do repasse). Taxa de entrega: R$ 2,00/pedido (paga pelo cliente). PDV: R$ 1,00/venda presencial. <strong className="text-foreground">Plano dinâmico:</strong> após 2 meses consecutivos com faturamento superior a R$ 5.000, a mensalidade é reajustada automaticamente para R$ 180/mês.</li>
            <li><strong className="text-foreground">Crescimento (R$ 50/mês + 2,5%):</strong> 2,5% sobre subtotal delivery (sem taxa PIX adicional). Taxa de entrega: R$ 2,00/pedido. PDV: 1% sobre subtotal presencial (faturado mensalmente). <strong className="text-foreground">Plano dinâmico:</strong> após 2 meses consecutivos com faturamento superior a R$ 5.000, a mensalidade é reajustada automaticamente para R$ 100/mês.</li>
            <li><strong className="text-foreground">Comissão (sem mensalidade, 6%):</strong> 6% sobre subtotal delivery (sem taxa PIX adicional). Taxa de entrega: R$ 2,00/pedido. PDV: 2% sobre subtotal presencial (faturado mensalmente).</li>
            <li><strong className="text-foreground">Apoiador (R$ 75/mês — 10 vagas):</strong> Plano vitalício com mensalidade travada permanentemente. 0% comissão. Taxas: R$ 1,99 PIX Online, R$ 2,00/entrega (paga pelo cliente), R$ 1,00/venda PDV. Máximo 10 vagas — sem reajuste nunca.</li>
          </ul>
          <p>5.2. <strong className="text-foreground">Plano Dinâmico (Essencial e Crescimento):</strong> O faturamento mensal é apurado automaticamente todo dia 1º do mês considerando os pedidos finalizados no mês anterior. O reajuste ocorre apenas após 2 meses consecutivos acima do limite — meses não consecutivos não contam. O lojista é notificado com antecedência. Lojas cadastradas antes de 20/05/2025 mantêm os valores anteriores e não estão sujeitas ao plano dinâmico.</p>
          <p>5.3. <strong className="text-foreground">Comissão PDV:</strong> Incide sobre o subtotal das vendas presenciais. Acumulada ao longo do mês e incluída na fatura mensal junto à mensalidade.</p>
          <p>5.3. Planos Essencial e Crescimento incluem 7 dias de teste grátis. O plano Comissão pode ser utilizado imediatamente.</p>
          <p>5.4. Alterações de valor serão comunicadas com 30 dias de antecedência. Inadimplência superior a 30 dias pode resultar em desativação automática de delivery e PDV.</p>
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
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">8. Pagamentos e Repasses</h2>
          <p>8.1. <strong className="text-foreground">PIX Online:</strong> processado pelo Asaas com split automático entre plataforma e lojista. Disponível apenas para lojistas com conta Asaas configurada no painel.</p>
          <p>8.2. <strong className="text-foreground">Métodos físicos (Dinheiro, Cartão na entrega e PIX Maquininha):</strong> o cliente paga diretamente ao lojista ou ao entregador. A taxa da plataforma (R$ 2,00 por entrega para planos Essencial/Apoiador, ou % sobre subtotal para planos Crescimento/Comissão) é acumulada e cobrada via PIX toda <strong className="text-foreground">segunda-feira</strong>, quando o saldo pendente atingir <strong className="text-foreground">R$ 30,00</strong>. Saldo acima de R$ 150,00 suspende temporariamente o acesso ao painel até regularização. Inadimplência superior a 30 dias implica suspensão da loja.</p>
          <p>8.2. Pagamentos físicos (dinheiro/cartão) recebidos diretamente pelo Lojista ou Entregador.</p>
          <p>8.3. <strong className="text-foreground">PIX Maquininha:</strong> modalidade em que o cliente paga via PIX pelo leitor do lojista na entrega, sem integração com Asaas. Tratado como pagamento físico para fins de cobrança de repasse.</p>
          <p>8.4. Vendas PDV: plataforma não intermedia valores presenciais — apenas cobra comissão PDV na fatura mensal.</p>
          <p>8.5. Cancelamentos com PIX Online: reembolso automático via Asaas em até 7 dias úteis, creditado como saldo na carteira da plataforma. Pedidos pagos em dinheiro, cartão ou PIX Maquininha não são elegíveis para reembolso automático — a resolução é entre cliente e lojista.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">9. Taxas Detalhadas</h2>
          <p>9.1. Comissão delivery incide apenas sobre o <strong className="text-foreground">subtotal dos produtos</strong> (excluindo entrega, desconto e taxa PIX).</p>
          <p>9.2. Comissão PDV percentual incide sobre o subtotal da venda presencial (6% plano Comissão, 2% plano Crescimento). Para planos Essencial e Apoiador não há comissão percentual — aplica-se taxa fixa de <strong className="text-foreground">R$ 1,00 por venda PDV</strong>, incluída na fatura mensal.</p>
          <p>9.3. Taxa PIX (R$ 1,99): cobrada por transação PIX Online <strong className="text-foreground">apenas nos planos Essencial e Apoiador</strong>, descontada automaticamente do valor repassado ao lojista. Nos planos Crescimento e Comissão, a comissão percentual já cobre os custos operacionais do PIX — não há cobrança adicional de R$ 1,99.</p>
          <p>9.4. Taxa de entrega (R$ 2,00): somada à taxa base definida pelo lojista, paga pelo cliente no checkout. Aplica-se a todos os planos e a todos os métodos de pagamento (PIX Online, PIX Maquininha, Cartão e Dinheiro).</p>
          <p>9.5. O lojista pode configurar quais métodos de pagamento aceita através do painel de configurações da loja. A ativação do PIX Online requer conta Asaas configurada. PIX Maquininha, Cartão e Dinheiro estão disponíveis por padrão.</p>
          <p>9.5. Todas as taxas são consultáveis no painel financeiro da loja.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">10. Cancelamentos e Reembolsos</h2>
          <p>10.1. Cancelamentos pelo Cliente antes da confirmação do Lojista: sem ônus.</p>
          <p>10.2. Após confirmação: depende de acordo entre as partes. ItaSuper pode mediar.</p>
          <p>10.3. Vendas PDV finalizadas no caixa: reembolso é responsabilidade do Lojista conforme CDC.</p>
          <p>10.4. O ItaSuper reserva-se o direito de cancelar pedidos suspeitos de fraude.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">10-A. Prevenção a Fraudes e Bloqueio Automático</h2>
          <div className="space-y-2 text-muted-foreground">
            <p>10-A.1. O ItaSuper utiliza sistemas automatizados de detecção de fraudes. Pedidos com endereço em cidade divergente da área de cobertura da loja ou a distância superior ao raio máximo podem ser bloqueados automaticamente.</p>
            <p>10-A.2. Tentativas de fraude são registradas e podem resultar em suspensão, bloqueio permanente e comunicação às autoridades (Art. 171 do Código Penal).</p>
            <p>10-A.3. O Usuário que considerar um bloqueio indevido pode solicitar revisão pelo sistema de suporte, apresentando comprovação de endereço válido.</p>
          </div>

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
          <p>12.2. Lojistas concedem licença de uso de suas marcas e imagens exclusivamente para divulgação na Plataforma.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">13. Limitação de Responsabilidade</h2>
          <p>O ItaSuper não se responsabiliza por: qualidade dos produtos, atrasos por força maior, dados incorretos fornecidos pelos Usuários, falhas de terceiros (Supabase, Asaas, Firebase), uso indevido de credenciais, ou conformidade fiscal das vendas PDV.</p>
          <p>A responsabilidade máxima limita-se ao valor pago à Plataforma nos últimos 30 dias.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">14. Privacidade e LGPD</h2>
          <p>14.1. O tratamento de dados é regido pela Política de Privacidade disponível na Plataforma, em conformidade com a LGPD (Lei nº 13.709/2018).</p>
          <p>14.2. Para exercer direitos LGPD, utilize o painel da Plataforma ou contate o suporte.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">15. Foro e Legislação</h2>
          <p>15.1. Foro de eleição: comarca de <strong className="text-foreground">Itatinga/SP</strong>, com renúncia a qualquer outro.</p>
          <p>15.2. Aplica-se o direito brasileiro: CDC (Lei nº 8.078/1990), Marco Civil (Lei nº 12.965/2014), LGPD (Lei nº 13.709/2018) e Decreto nº 7.962/2013.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">16. Alterações dos Termos</h2>
          <p>16.1. Alterações serão comunicadas com antecedência mínima de <strong className="text-foreground">30 dias</strong> via e-mail ou notificação na Plataforma.</p>
          <p>16.2. O uso continuado após as alterações implica aceitação dos novos Termos.</p>
        </section>

        <section className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground text-center">
            ItaSuper — Plataforma de Intermediação Digital · Itatinga/SP · Brasil<br />
            Última atualização: {dataAtualizacao} · Dúvidas: WhatsApp (14) 99162-4997
          </p>
        </section>

      </div>
    </div>
  );
};

export default TermosDeUso;
