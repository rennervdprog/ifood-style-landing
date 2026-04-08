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
          <p className="text-xs text-muted-foreground">Última atualização: 08 de Abril de 2026 — Versão 1.0</p>

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
            <li><strong className="text-foreground">Cardápio Digital:</strong> Funcionalidade que permite lojistas de qualquer cidade do Brasil gerenciar e exibir seu cardápio online.</li>
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

          <h2 className="text-lg font-bold text-foreground">4. Serviços Oferecidos</h2>
          <p className="text-sm text-muted-foreground">
            4.1. A Plataforma atua como <strong className="text-foreground">intermediária</strong> entre Clientes, Lojistas e Entregadores, não sendo 
            responsável pela fabricação, qualidade ou entrega dos produtos, que é de responsabilidade exclusiva do Lojista e/ou Entregador.
          </p>
          <p className="text-sm text-muted-foreground">
            4.2. O ItaSuper oferece: (a) marketplace para compra e venda de produtos alimentícios e farmacêuticos; 
            (b) cardápio digital para lojistas de todo o Brasil; (c) sistema de entrega com motoboys cadastrados 
            (em cidades habilitadas); (d) pagamento online via PIX.
          </p>

          <h2 className="text-lg font-bold text-foreground">5. Obrigações do Cliente</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Fornecer endereço de entrega correto e completo.</li>
            <li>Estar disponível para receber o pedido no endereço informado.</li>
            <li>Efetuar o pagamento conforme método escolhido no checkout.</li>
            <li>Tratar lojistas e entregadores com respeito e cordialidade.</li>
            <li>Conferir o pedido no ato da entrega utilizando o código PIN de verificação.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">6. Obrigações do Lojista</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Manter o cardápio atualizado com preços e disponibilidade reais.</li>
            <li>Preparar os pedidos com qualidade e em tempo razoável.</li>
            <li>Cumprir todas as normas da Vigilância Sanitária (ANVISA) e legislação aplicável.</li>
            <li>Possuir alvarás e licenças necessários para operação do estabelecimento.</li>
            <li>Manter dados financeiros (CPF/CNPJ, chave PIX) atualizados.</li>
            <li>Pagar a comissão de 15% sobre vendas realizadas através da Plataforma.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">7. Obrigações do Entregador</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Possuir CNH válida e veículo em condições adequadas de uso.</li>
            <li>Realizar entregas de forma segura, respeitando as leis de trânsito (CTB).</li>
            <li>Manter a integridade dos produtos durante o transporte.</li>
            <li>Confirmar entrega utilizando o código PIN do cliente.</li>
            <li>Realizar acerto financeiro com o lojista quando aplicável.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">8. Pagamentos e Comissões</h2>
          <p className="text-sm text-muted-foreground">
            8.1. A Plataforma cobra uma comissão de <strong className="text-foreground">15% sobre o subtotal</strong> de cada pedido realizado.
          </p>
          <p className="text-sm text-muted-foreground">
            8.2. Para pagamentos via PIX online, o split de pagamento é automático via Asaas, onde o Lojista 
            recebe 85% diretamente e 15% é retido como comissão da Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            8.3. Para pagamentos em dinheiro ou cartão na entrega, a comissão é registrada como débito pendente 
            do Lojista junto à Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            8.4. A taxa de entrega é repassada integralmente ao Entregador designado.
          </p>

          <h2 className="text-lg font-bold text-foreground">9. Cancelamentos e Reembolsos</h2>
          <p className="text-sm text-muted-foreground">
            9.1. Pedidos podem ser cancelados antes do início da preparação, conforme o Código de Defesa do 
            Consumidor (Lei nº 8.078/1990).
          </p>
          <p className="text-sm text-muted-foreground">
            9.2. Após início da preparação, o cancelamento está sujeito à análise do administrador da Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            9.3. Reembolsos, quando aplicáveis, seguirão o mesmo método de pagamento utilizado.
          </p>

          <h2 className="text-lg font-bold text-foreground">10. Propriedade Intelectual</h2>
          <p className="text-sm text-muted-foreground">
            Todo o conteúdo da Plataforma (marca, layout, código-fonte, design) é propriedade do ItaSuper, 
            protegido pela Lei nº 9.610/1998 (Direitos Autorais) e Lei nº 9.279/1996 (Propriedade Industrial).
          </p>

          <h2 className="text-lg font-bold text-foreground">11. Limitação de Responsabilidade</h2>
          <p className="text-sm text-muted-foreground">
            11.1. O ItaSuper não se responsabiliza por: (a) qualidade dos produtos vendidos pelos Lojistas; 
            (b) atrasos causados por trânsito, clima ou força maior; (c) dados incorretos fornecidos pelos Usuários; 
            (d) indisponibilidade temporária da Plataforma para manutenção.
          </p>

          <h2 className="text-lg font-bold text-foreground">12. Suspensão e Exclusão</h2>
          <p className="text-sm text-muted-foreground">
            12.1. A Plataforma reserva-se o direito de suspender ou excluir contas que: (a) violem estes Termos; 
            (b) forneçam informações falsas; (c) pratiquem fraudes; (d) acumulem reclamações de outros Usuários.
          </p>

          <h2 className="text-lg font-bold text-foreground">13. Legislação Aplicável</h2>
          <p className="text-sm text-muted-foreground">
            Estes Termos são regidos pela legislação brasileira, em especial: Lei nº 8.078/1990 (CDC), 
            Lei nº 12.965/2014 (Marco Civil da Internet), Lei nº 13.709/2018 (LGPD) e Decreto nº 7.962/2013 
            (comércio eletrônico). Eventuais litígios serão dirimidos no foro da comarca de Itatinga/SP.
          </p>

          <h2 className="text-lg font-bold text-foreground">14. Alterações</h2>
          <p className="text-sm text-muted-foreground">
            O ItaSuper poderá alterar estes Termos a qualquer momento, notificando os Usuários com antecedência mínima de 
            30 dias. O uso continuado após as alterações implica aceitação das novas condições.
          </p>

          <h2 className="text-lg font-bold text-foreground">15. Contato</h2>
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
