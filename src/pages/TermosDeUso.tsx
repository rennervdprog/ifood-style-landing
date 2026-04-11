import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermosDeUso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Termos de Uso</h1>
      </header>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-xs text-muted-foreground">Última atualização: 09 de Abril de 2026 — Versão 2.0</p>

          <h2 className="text-lg font-bold text-foreground">1. Identificação da Plataforma</h2>
          <p className="text-sm text-muted-foreground">
            A plataforma <strong className="text-foreground">ItaSuper</strong> é um serviço de intermediação digital que conecta consumidores, 
            estabelecimentos comerciais (lojistas) e entregadores (motoboys), operada por meio de aplicativo web progressivo (PWA). 
            Ao utilizar o ItaSuper, o Usuário declara que leu, compreendeu e concorda integralmente com estes Termos de Uso.
          </p>

          <h2 className="text-lg font-bold text-foreground">2. Definições</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Plataforma:</strong> O aplicativo web ItaSuper e seus serviços relacionados.</li>
            <li><strong className="text-foreground">Cliente/Consumidor:</strong> Pessoa física que utiliza a Plataforma para adquirir produtos.</li>
            <li><strong className="text-foreground">Lojista/Parceiro:</strong> Estabelecimento comercial cadastrado que oferece produtos através da Plataforma.</li>
            <li><strong className="text-foreground">Entregador/Motoboy:</strong> Pessoa física cadastrada para realizar entregas de pedidos.</li>
            <li><strong className="text-foreground">Pedido:</strong> Solicitação de compra realizada pelo Cliente através da Plataforma.</li>
            <li><strong className="text-foreground">Cardápio Digital:</strong> Funcionalidade que permite lojistas gerenciar e exibir seu cardápio online.</li>
            <li><strong className="text-foreground">Programa de Fidelidade:</strong> Sistema de pontos acumulados por pedidos que podem ser resgatados como desconto.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">3. Cadastro e Conta</h2>
          <p className="text-sm text-muted-foreground">
            3.1. Para utilizar os serviços da Plataforma, o Usuário deve criar uma conta fornecendo informações 
            verdadeiras, completas e atualizadas, conforme exigido pela Lei nº 12.965/2014 (Marco Civil da Internet).
          </p>
          <p className="text-sm text-muted-foreground">
            3.2. O Usuário é responsável pela segurança de sua conta e senha, devendo notificar imediatamente a 
            Plataforma sobre qualquer uso não autorizado.
          </p>
          <p className="text-sm text-muted-foreground">
            3.3. Para lojistas e entregadores, o cadastro está sujeito à análise e aprovação do administrador da Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            3.4. O Usuário deve ter pelo menos 18 anos ou possuir autorização dos responsáveis legais, nos termos 
            do Código Civil Brasileiro (Lei nº 10.406/2002).
          </p>
          <p className="text-sm text-muted-foreground">
            3.5. O Usuário pode solicitar a exclusão definitiva da sua conta e dados pessoais a qualquer momento 
            através da seção "Minha Conta" na Plataforma, conforme a LGPD (Art. 18).
          </p>

          <h2 className="text-lg font-bold text-foreground">4. Serviços Oferecidos</h2>
          <p className="text-sm text-muted-foreground">
            4.1. A Plataforma atua como <strong className="text-foreground">intermediária</strong> entre Clientes, Lojistas e Entregadores, não sendo 
            responsável pela fabricação, qualidade ou entrega dos produtos, que é de responsabilidade exclusiva do Lojista e/ou Entregador.
          </p>
          <p className="text-sm text-muted-foreground">
            4.2. O ItaSuper oferece: (a) marketplace para compra e venda de produtos alimentícios e farmacêuticos; 
            (b) cardápio digital para lojistas; (c) sistema de entrega com motoboys cadastrados 
            (conforme plano contratado); (d) pagamento online via PIX (Asaas ou Mercado Pago); (e) programa de fidelidade com acúmulo de pontos; (f) cupons de desconto; (g) banners promocionais.
          </p>

          <h2 className="text-lg font-bold text-foreground">5. Planos e Assinatura para Lojistas</h2>
          <p className="text-sm text-muted-foreground">
            5.1. O ItaSuper oferece três planos para lojistas:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Essencial (R$ 49,90/mês):</strong> Cardápio digital, pedidos ilimitados, até 3 cupons ativos, entrega com motoboy próprio. Sem comissão por pedido. Não inclui PIX online nem motoboy da plataforma.</li>
            <li><strong className="text-foreground">Crescimento (R$ 179,90/mês):</strong> Todas as funcionalidades do Essencial, mais: PIX online, motoboy da plataforma, cupons ilimitados, programa de fidelidade, banners promocionais, agendamento de pedidos e suporte prioritário. Sem comissão por pedido.</li>
            <li><strong className="text-foreground">Comissão (0% mensalidade + 5% por pedido):</strong> Todas as funcionalidades do Crescimento. A comissão de 5% é cobrada sobre o subtotal de cada pedido realizado.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            5.2. Os planos pagos (Essencial e Crescimento) incluem <strong className="text-foreground">7 dias de teste grátis</strong>. O plano Comissão não possui mensalidade. Após o período de teste dos planos pagos, a cobrança será realizada automaticamente via Asaas.
          </p>
          <p className="text-sm text-muted-foreground">
            5.3. O lojista pode solicitar a troca de plano a qualquer momento. Em caso de downgrade de um plano com mensalidade maior para um menor, será calculado um crédito pro-rata proporcional aos dias restantes do período já pago.
          </p>
          <p className="text-sm text-muted-foreground">
            5.4. A aprovação de troca de plano está sujeita à análise do administrador da Plataforma.
          </p>

          <h2 className="text-lg font-bold text-foreground">6. Obrigações do Cliente</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Fornecer endereço de entrega correto e completo.</li>
            <li>Estar disponível para receber o pedido no endereço informado.</li>
            <li>Efetuar o pagamento conforme método escolhido no checkout (PIX, dinheiro ou cartão na entrega).</li>
            <li>Tratar lojistas e entregadores com respeito e cordialidade.</li>
            <li>Conferir o pedido no ato da entrega utilizando o código PIN de verificação.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">7. Obrigações do Lojista</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Manter o cardápio atualizado com preços e disponibilidade reais.</li>
            <li>Preparar os pedidos com qualidade e em tempo razoável.</li>
            <li>Cumprir todas as normas da Vigilância Sanitária (ANVISA) e legislação aplicável.</li>
            <li>Possuir alvarás e licenças necessários para operação do estabelecimento.</li>
            <li>Manter dados financeiros (CPF/CNPJ, chave PIX) atualizados.</li>
            <li>Pagar a mensalidade e/ou comissão de acordo com o plano contratado.</li>
            <li>Gerenciar corretamente os horários de funcionamento na Plataforma.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">8. Obrigações do Entregador</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Possuir CNH válida e veículo em condições adequadas de uso.</li>
            <li>Realizar entregas de forma segura, respeitando as leis de trânsito (CTB).</li>
            <li>Manter a integridade dos produtos durante o transporte.</li>
            <li>Confirmar entrega utilizando o código PIN do cliente.</li>
            <li>Realizar acerto financeiro com o lojista quando aplicável.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">9. Pagamentos e Comissões</h2>
          <p className="text-sm text-muted-foreground">
            9.1. No plano Comissão, a Plataforma cobra <strong className="text-foreground">5% sobre o subtotal</strong> de cada pedido.
          </p>
          <p className="text-sm text-muted-foreground">
            9.2. Para pagamentos via PIX online, o split de pagamento é automático via Asaas ou Mercado Pago, onde o Lojista 
            recebe 95% diretamente e 5% é retido como comissão da Plataforma (quando aplicável ao plano).
          </p>
          <p className="text-sm text-muted-foreground">
            9.3. Para pagamentos em dinheiro ou cartão na entrega, a comissão (quando aplicável) é registrada como débito pendente 
            do Lojista junto à Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            9.4. A taxa de entrega é repassada integralmente ao Entregador designado.
          </p>
          <p className="text-sm text-muted-foreground">
            9.5. Nos planos Essencial e Crescimento, não há cobrança de comissão por pedido, apenas a mensalidade fixa.
          </p>

          <h2 className="text-lg font-bold text-foreground">10. Programa de Fidelidade</h2>
          <p className="text-sm text-muted-foreground">
            10.1. Lojistas dos planos Crescimento e Comissão podem ativar o programa de fidelidade, configurando a quantidade de pontos por real gasto e o valor do desconto por ponto.
          </p>
          <p className="text-sm text-muted-foreground">
            10.2. Pontos são creditados automaticamente ao cliente quando o pedido é finalizado.
          </p>
          <p className="text-sm text-muted-foreground">
            10.3. O resgate de pontos está sujeito ao mínimo configurado pelo lojista e ao percentual máximo de desconto sobre o pedido.
          </p>
          <p className="text-sm text-muted-foreground">
            10.4. Pontos não possuem valor monetário e não podem ser transferidos entre lojas ou usuários.
          </p>

          <h2 className="text-lg font-bold text-foreground">11. Cancelamentos e Reembolsos</h2>
          <p className="text-sm text-muted-foreground">
            11.1. Pedidos podem ser cancelados antes do início da preparação, conforme o Código de Defesa do 
            Consumidor (Lei nº 8.078/1990).
          </p>
          <p className="text-sm text-muted-foreground">
            11.2. Após início da preparação, o cancelamento está sujeito à análise do administrador da Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            11.3. Reembolsos, quando aplicáveis, seguirão o mesmo método de pagamento utilizado.
          </p>

          <h2 className="text-lg font-bold text-foreground">12. Propriedade Intelectual</h2>
          <p className="text-sm text-muted-foreground">
            Todo o conteúdo da Plataforma (marca, layout, código-fonte, design) é propriedade do ItaSuper, 
            protegido pela Lei nº 9.610/1998 (Direitos Autorais) e Lei nº 9.279/1996 (Propriedade Industrial).
          </p>

          <h2 className="text-lg font-bold text-foreground">13. Limitação de Responsabilidade</h2>
          <p className="text-sm text-muted-foreground">
            13.1. O ItaSuper não se responsabiliza por: (a) qualidade dos produtos vendidos pelos Lojistas; 
            (b) atrasos causados por trânsito, clima ou força maior; (c) dados incorretos fornecidos pelos Usuários; 
            (d) indisponibilidade temporária da Plataforma para manutenção.
          </p>

          <h2 className="text-lg font-bold text-foreground">14. Suspensão e Exclusão</h2>
          <p className="text-sm text-muted-foreground">
            14.1. A Plataforma reserva-se o direito de suspender ou excluir contas que: (a) violem estes Termos; 
            (b) forneçam informações falsas; (c) pratiquem fraudes; (d) acumulem reclamações de outros Usuários; 
            (e) possuam inadimplência de mensalidade ou comissão superior a 30 dias.
          </p>

          <h2 className="text-lg font-bold text-foreground">15. Legislação Aplicável</h2>
          <p className="text-sm text-muted-foreground">
            Estes Termos são regidos pela legislação brasileira, em especial: Lei nº 8.078/1990 (CDC), 
            Lei nº 12.965/2014 (Marco Civil da Internet), Lei nº 13.709/2018 (LGPD) e Decreto nº 7.962/2013 
            (comércio eletrônico). Eventuais litígios serão dirimidos no foro da comarca de Itatinga/SP.
          </p>

          <h2 className="text-lg font-bold text-foreground">16. Alterações</h2>
          <p className="text-sm text-muted-foreground">
            O ItaSuper poderá alterar estes Termos a qualquer momento, notificando os Usuários com antecedência mínima de 
            30 dias. O uso continuado após as alterações implica aceitação das novas condições.
          </p>

          <h2 className="text-lg font-bold text-foreground">17. Contato</h2>
          <p className="text-sm text-muted-foreground">
            Para dúvidas, reclamações ou exercício de direitos, entre em contato pelo WhatsApp disponível na Plataforma 
            ou pelo e-mail de suporte.
          </p>

          <div className="border-t border-border pt-4 mt-6">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} ItaSuper — Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermosDeUso;
