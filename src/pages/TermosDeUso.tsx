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
            <p className="text-xs text-muted-foreground">Última atualização: 30 de Abril de 2026 — Versão 3.3</p>

          <h2 className="text-lg font-bold text-foreground">1. Identificação da Plataforma</h2>
           <p className="text-sm text-muted-foreground">
             A plataforma <strong className="text-foreground">ItaSuper</strong> é um serviço de intermediação digital que conecta consumidores, 
             estabelecimentos comerciais (lojistas) e entregadores (motoboys), operada por meio de aplicativo web progressivo (PWA). 
             O ItaSuper atua exclusivamente no modelo digital, não oferecendo suporte ou gestão para mesas físicas ou atendimento presencial (balcão). 
             Ao utilizar o ItaSuper, o Usuário declara que leu, compreendeu e concorda integralmente com estes Termos de Uso.
           </p>

          <h2 className="text-lg font-bold text-foreground">2. Definições</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Plataforma:</strong> O aplicativo web e nativo ItaSuper e todos os seus serviços relacionados.</li>
            <li><strong className="text-foreground">Cliente/Consumidor:</strong> Pessoa física que utiliza a Plataforma para adquirir produtos.</li>
            <li><strong className="text-foreground">Lojista/Parceiro:</strong> Estabelecimento comercial cadastrado que oferece produtos através da Plataforma.</li>
            <li><strong className="text-foreground">Entregador da Plataforma:</strong> Pessoa física cadastrada e aprovada pela Plataforma para realizar entregas de pedidos em geral, podendo atender múltiplas lojas.</li>
            <li><strong className="text-foreground">Motoboy de Loja (Motoboy Próprio):</strong> Pessoa física cadastrada e vinculada exclusivamente a uma loja específica pelo seu dono, realizando apenas entregas daquela loja.</li>
            <li><strong className="text-foreground">Pedido:</strong> Solicitação de compra realizada pelo Cliente através da Plataforma.</li>
            <li><strong className="text-foreground">Designação de Entregador:</strong> Recurso pelo qual o Lojista atribui um pedido a um motoboy específico (próprio ou da plataforma), tornando o pedido invisível aos demais entregadores.</li>
            <li><strong className="text-foreground">Código PIN de Entrega:</strong> Código numérico de 4 dígitos gerado pela Plataforma que o Cliente fornece ao Entregador no ato da entrega para confirmar o recebimento do pedido.</li>
            <li><strong className="text-foreground">Código de Coleta:</strong> Código gerado pela Plataforma para autenticar a coleta do pedido pelo Entregador junto ao Lojista.</li>
            <li><strong className="text-foreground">Acerto Financeiro:</strong> Procedimento periódico em que Lojista e Entregador conciliam valores recebidos em dinheiro/cartão na entrega, autenticado por código.</li>
            <li><strong className="text-foreground">Cardápio Digital:</strong> Funcionalidade que permite lojistas gerenciar e exibir seu cardápio online, com categorias (seções), produtos, adicionais e personalização de pizza meio a meio.</li>
            <li><strong className="text-foreground">Programa de Fidelidade:</strong> Sistema de pontos acumulados por pedidos que podem ser resgatados como desconto em compras futuras na mesma loja.</li>
            <li><strong className="text-foreground">Carteira Digital (Wallet):</strong> Saldo virtual do cliente dentro da Plataforma, utilizado para pagamentos e reembolsos.</li>
            <li><strong className="text-foreground">Retirada no Local:</strong> Modalidade em que o cliente retira o pedido diretamente no estabelecimento, sem taxa de entrega.</li>
            <li><strong className="text-foreground">Agendamento de Pedido:</strong> Funcionalidade que permite o cliente agendar um pedido para data e horário futuros.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">3. Cadastro e Conta</h2>
          <p className="text-sm text-muted-foreground">
            3.1. Para utilizar os serviços da Plataforma, o Usuário deve criar uma conta fornecendo informações 
            verdadeiras, completas e atualizadas, conforme exigido pela Lei nº 12.965/2014 (Marco Civil da Internet). 
            O cadastro exige confirmação por e-mail antes do primeiro acesso.
          </p>
          <p className="text-sm text-muted-foreground">
            3.2. O Usuário é responsável pela segurança de sua conta e senha, devendo notificar imediatamente a 
            Plataforma sobre qualquer uso não autorizado. A Plataforma utiliza controle de sessão única (single-device login), 
            permitindo apenas um dispositivo ativo por conta simultaneamente.
          </p>
          <p className="text-sm text-muted-foreground">
            3.3. Para lojistas e entregadores da plataforma, o cadastro está sujeito à análise e aprovação do administrador. 
            Entregadores da plataforma devem apresentar CNH válida, foto da CNH (frente e verso), selfie para verificação 
            de identidade e selecionar a cidade de atuação.
          </p>
          <p className="text-sm text-muted-foreground">
            3.4. Para motoboys de loja, o cadastro é feito de forma simplificada (nome, e-mail, telefone e veículo), 
            e a vinculação à loja é realizada pelo dono do estabelecimento.
          </p>
          <p className="text-sm text-muted-foreground">
            3.4.1. <strong className="text-foreground">Veracidade obrigatória dos dados financeiros:</strong> Todos os dados informados pelo Lojista no cadastro da subconta de pagamento (Asaas) — nome completo, CPF/CNPJ, data de nascimento, endereço, telefone, chave PIX e documentos enviados (RG, CNH, comprovante de residência, contrato social) — devem ser <strong className="text-foreground">reais, atuais e correspondentes ao titular da conta</strong>. Dados falsos, divergentes ou de terceiros configuram fraude (Art. 171 do Código Penal), acarretam reprovação imediata pelo gateway de pagamento, suspensão da loja e podem ser comunicados às autoridades competentes.
          </p>
          <p className="text-sm text-muted-foreground">
            3.5. O Usuário deve ter pelo menos 18 anos ou possuir autorização dos responsáveis legais, nos termos 
            do Código Civil Brasileiro (Lei nº 10.406/2002).
          </p>
          <p className="text-sm text-muted-foreground">
            3.6. O Usuário pode solicitar a exclusão definitiva da sua conta e dados pessoais a qualquer momento 
            através da seção "Minha Conta" na Plataforma, conforme a LGPD (Art. 18). Os dados serão arquivados 
            pelo prazo legal obrigatório de 5 anos e, após esse período, eliminados definitivamente.
          </p>

          <h2 className="text-lg font-bold text-foreground">4. Serviços Oferecidos</h2>
          <p className="text-sm text-muted-foreground">
            4.1. A Plataforma atua como <strong className="text-foreground">intermediária</strong> entre Clientes, Lojistas e Entregadores, não sendo 
            responsável pela fabricação, qualidade ou entrega dos produtos, que é de responsabilidade exclusiva do Lojista e/ou Entregador.
          </p>
          <p className="text-sm text-muted-foreground">
            4.2. O ItaSuper oferece os seguintes serviços e funcionalidades:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Marketplace:</strong> vitrine de lojas por categoria (lanches, pizzas, restaurante, adegas, japonesa, saudável, sobremesas, cafeteria, churrasco, farmácias, docerias) com busca e filtros.</li>
            <li><strong className="text-foreground">Cardápio digital:</strong> gestão de seções, produtos com fotos, descrições, preços, grupos de adicionais e sistema de pizza meio a meio com sabores e bordas personalizáveis.</li>
            <li><strong className="text-foreground">QR Code exclusivo:</strong> cada loja recebe um QR Code para divulgação e acesso direto ao cardápio.</li>
            <li><strong className="text-foreground">Importação de cardápio por CSV:</strong> lojistas podem importar produtos em massa via arquivo CSV.</li>
            <li><strong className="text-foreground">Sistema de pedidos:</strong> carrinho de compras, checkout com múltiplos métodos de pagamento, acompanhamento de status em tempo real, chat entre cliente e loja, avaliação com nota e comentário.</li>
            <li><strong className="text-foreground">Agendamento de pedidos:</strong> clientes podem agendar pedidos para data e horário futuros.</li>
            <li><strong className="text-foreground">Retirada no local:</strong> opção de retirar o pedido diretamente no estabelecimento.</li>
            <li><strong className="text-foreground">Pagamento online via PIX:</strong> processado através dos gateways Asaas e/ou Mercado Pago, com confirmação automática.</li>
            <li><strong className="text-foreground">Pagamento na entrega:</strong> dinheiro (com opção de troco) ou cartão de crédito/débito.</li>
            <li><strong className="text-foreground">Carteira digital (Wallet):</strong> saldo virtual para pagamentos e recebimento de reembolsos.</li>
            <li><strong className="text-foreground">Programa de fidelidade:</strong> sistema configurável de acúmulo de pontos por real gasto, com resgate como desconto.</li>
            <li><strong className="text-foreground">Cupons de desconto:</strong> cupons percentuais ou de valor fixo, com regras de valor mínimo, limite de uso e exclusividade para primeiro pedido.</li>
            <li><strong className="text-foreground">Banners promocionais:</strong> lojistas podem criar banners para destaque de produtos ou promoções.</li>
            <li><strong className="text-foreground">Sistema de entrega:</strong> entregadores da plataforma ou motoboys próprios da loja, com rastreamento em tempo real via GPS, código PIN de confirmação e cálculo automático de taxa de entrega por bairro/distância.</li>
            <li><strong className="text-foreground">Designação de entregador:</strong> o lojista pode atribuir um pedido a um motoboy específico; uma vez designado, o pedido deixa de aparecer para os demais entregadores.</li>
            <li><strong className="text-foreground">Identificação do entregador no histórico:</strong> o lojista visualiza o nome do entregador responsável por cada pedido em todos os estágios e no histórico de entregas finalizadas.</li>
            <li><strong className="text-foreground">Notificações em tempo real:</strong> push notifications e alertas sonoros para novos pedidos e atualizações de status.</li>
            <li><strong className="text-foreground">Relatórios financeiros:</strong> painel com receita bruta, pedidos, ticket médio, métodos de pagamento e filtros por período (7 dias, 30 dias, personalizado).</li>
            <li><strong className="text-foreground">Relatórios avançados:</strong> produtos mais vendidos, horários de pico, gráficos comparativos (disponível nos planos Crescimento e Essencial).</li>
            <li><strong className="text-foreground">Gestão de horários:</strong> configuração de horários de funcionamento por dia da semana, com fechamento forçado manual.</li>
            <li><strong className="text-foreground">Gestão de entregadores:</strong> lojistas podem adicionar e gerenciar motoboys próprios vinculados à loja.</li>
            <li><strong className="text-foreground">Painel de entregador:</strong> entregadores visualizam pedidos disponíveis, aceitam entregas, compartilham localização em tempo real e realizam acertos financeiros.</li>
            <li><strong className="text-foreground">Solicitação de reembolso:</strong> clientes e lojistas podem solicitar reembolso total ou parcial, com análise do administrador.</li>
            <li><strong className="text-foreground">WhatsApp integrado:</strong> notificações automáticas de pedidos via WhatsApp (Z-API) para lojistas que ativarem a integração.</li>
            <li><strong className="text-foreground">Impressão térmica:</strong> geração de comprovante para impressora térmica.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">5. Planos e Assinatura para Lojistas</h2>
          <p className="text-sm text-muted-foreground">
            5.1. O ItaSuper oferece três planos para lojistas:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-2">
              <li><strong className="text-foreground">Essencial (R$ 180/mês):</strong> 0% comissão sobre produtos. Taxas operacionais: <strong className="text-foreground">R$ 1,99 por pedido PIX</strong> e <strong className="text-foreground">R$ 2,00 adicionais por entrega</strong> (valor somado à taxa base do lojista e pago integralmente pelo cliente final).</li>
              <li><strong className="text-foreground">Crescimento (R$ 100/mês + 2,5% por pedido):</strong> Taxas operacionais: <strong className="text-foreground">R$ 1,99 por pedido PIX</strong> e <strong className="text-foreground">R$ 2,00 adicionais por entrega</strong> (pago pelo cliente).</li>
              <li><strong className="text-foreground">Comissão (6% por pedido):</strong> Sem mensalidade. Taxas operacionais: <strong className="text-foreground">R$ 1,99 por pedido PIX</strong> e <strong className="text-foreground">R$ 2,00 adicionais por entrega</strong> (pago pelo cliente).</li>
             <li><strong className="text-foreground">Apoiador:</strong> Plano especial destinado a parceiros estratégicos com condições diferenciadas de suporte e visibilidade.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            5.2. Os planos Essencial e Crescimento incluem <strong className="text-foreground">7 dias de teste grátis</strong>. O plano Comissão não possui mensalidade e pode ser utilizado imediatamente. Após o período de teste, a cobrança será realizada automaticamente.
          </p>
          <p className="text-sm text-muted-foreground">
            5.3. O lojista pode solicitar a troca de plano a qualquer momento pelo painel da loja. Em caso de downgrade, será calculado um crédito pro-rata proporcional aos dias restantes do período já pago.
          </p>
          <p className="text-sm text-muted-foreground">
            5.4. A aprovação de troca de plano está sujeita à análise do administrador da Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            5.5. Em caso de inadimplência de mensalidade superior a 30 dias, a loja poderá ser desativada automaticamente pela Plataforma.
          </p>

          <h2 className="text-lg font-bold text-foreground">6. Obrigações do Cliente</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Fornecer endereço de entrega correto e completo, incluindo rua, número, bairro, CEP, complemento e ponto de referência.</li>
            <li>Estar disponível para receber o pedido no endereço informado.</li>
            <li>Efetuar o pagamento conforme método escolhido no checkout (PIX online, dinheiro na entrega ou cartão na entrega).</li>
            <li>Tratar lojistas e entregadores com respeito e cordialidade.</li>
            <li>Conferir o pedido no ato da entrega utilizando o código PIN de verificação fornecido pela Plataforma.</li>
            <li>Manter seus dados cadastrais atualizados (nome, e-mail, telefone, endereços salvos).</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">7. Obrigações do Lojista</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Manter o cardápio atualizado com preços, disponibilidade e descrições reais.</li>
            <li>Preparar os pedidos com qualidade e em tempo razoável.</li>
            <li>Cumprir todas as normas da Vigilância Sanitária (ANVISA) e legislação aplicável.</li>
            <li>Possuir alvarás e licenças necessários para operação do estabelecimento.</li>
            <li>Manter dados financeiros atualizados (CPF/CNPJ, tipo e chave PIX, data de nascimento).</li>
            <li>Pagar a mensalidade e/ou comissão de acordo com o plano contratado.</li>
            <li>Gerenciar corretamente os horários de funcionamento na Plataforma.</li>
            <li>Confirmar, preparar e despachar pedidos dentro de um prazo razoável.</li>
            <li>Fornecer endereço completo do estabelecimento (CEP, rua, número, bairro, cidade, estado).</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">8. Obrigações do Entregador</h2>
          <p className="text-sm text-muted-foreground">
            8.1. <strong className="text-foreground">Entregadores da Plataforma</strong> devem:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Possuir CNH válida e veículo em condições adequadas de uso, com placa regularizada.</li>
            <li>Realizar entregas de forma segura, respeitando as leis de trânsito (CTB).</li>
            <li>Manter a integridade dos produtos durante o transporte.</li>
            <li>Confirmar entrega utilizando o código PIN do cliente.</li>
            <li>Compartilhar localização em tempo real durante entregas ativas.</li>
            <li>Realizar acerto financeiro com o lojista quando aplicável (pedidos em dinheiro/cartão).</li>
            <li>Selecionar a cidade de atuação dentre as disponíveis na Plataforma.</li>
            <li><strong className="text-foreground">Realizar apenas uma entrega ativa por vez:</strong> entregadores da plataforma só podem aceitar um novo pedido após finalizar a entrega em andamento, garantindo qualidade e tempo de entrega adequados.</li>
            <li>Respeitar a designação de entregador feita pelo lojista — pedidos atribuídos a um motoboy específico não podem ser aceitos por outros.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            8.2. <strong className="text-foreground">Motoboys de Loja (Próprios)</strong> devem:
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Estar vinculados a uma loja específica pelo dono do estabelecimento.</li>
            <li>Realizar apenas entregas da loja à qual estão vinculados.</li>
            <li>Seguir as mesmas regras de conduta e segurança dos entregadores da plataforma.</li>
            <li>Podem realizar múltiplas entregas simultâneas em rota (multi-stop), conforme organização da loja.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">9. Pagamentos e Comissões</h2>
          <p className="text-sm text-muted-foreground">
              9.1. No plano Comissão, a Plataforma cobra <strong className="text-foreground">6% sobre o subtotal</strong> de cada pedido. No plano Crescimento, a comissão é de <strong className="text-foreground">2,5% sobre o subtotal</strong>. No plano Essencial, não há comissão sobre o subtotal dos produtos.
          </p>
          <p className="text-sm text-muted-foreground">
            9.2. Para pagamentos via PIX online, o processamento é feito pelos gateways Asaas e/ou Mercado Pago. A comissão da Plataforma (quando aplicável ao plano) é calculada e registrada automaticamente.
          </p>
          <p className="text-sm text-muted-foreground">
            9.2.1. <strong className="text-foreground">Split automático de pagamentos:</strong> nos pedidos pagos via PIX online com subconta Asaas configurada, o valor é automaticamente dividido (split) no momento da liquidação entre Lojista, Plataforma e taxa de entrega, dispensando repasses manuais. Para lojas sem subconta ativa, o repasse ocorre por processo manual administrativo.
          </p>
          <p className="text-sm text-muted-foreground">
            9.3. Para pagamentos em dinheiro ou cartão na entrega, a comissão (quando aplicável) é registrada como débito pendente 
            do Lojista junto à Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
             9.4. A taxa de entrega é calculada automaticamente com base no bairro ou distância do cliente em relação ao estabelecimento. A plataforma opera em todo o território nacional, permitindo que cada lojista configure suas próprias regras de cobrança.
          </p>
          <p className="text-sm text-muted-foreground">
              9.5. Em todos os planos (Essencial, Crescimento e Comissão), à taxa de entrega definida pelo lojista, a plataforma soma automaticamente R$ 2,00 (dois reais) referentes à taxa operacional de intermediação da entrega, valor este pago pelo cliente final no ato do checkout.
          </p>
          <p className="text-sm text-muted-foreground">
            9.6. Para pedidos pagos via PIX, é cobrada uma taxa fixa de processamento de R$ 1,99 por transação. Pedidos pagos em dinheiro ou cartão não possuem esta taxa de processamento, mas geram o débito da comissão e da taxa de entrega plataforma para repasse posterior.
          </p>
          <p className="text-sm text-muted-foreground">
            9.7. Entregadores da plataforma acumulam ganhos por entrega e podem solicitar saque via PIX pelo painel, sujeito à aprovação do administrador.
          </p>
          <p className="text-sm text-muted-foreground">
            9.8. O cliente pode utilizar saldo da Carteira Digital (Wallet) para abater total ou parcialmente o valor do pedido.
          </p>

          <h2 className="text-lg font-bold text-foreground">10. Programa de Fidelidade</h2>
          <p className="text-sm text-muted-foreground">
            10.1. Lojistas de qualquer plano podem ativar o programa de fidelidade, configurando: quantidade de pontos por real gasto, valor do desconto por ponto, percentual máximo de desconto sobre o pedido e mínimo de pontos para resgate.
          </p>
          <p className="text-sm text-muted-foreground">
            10.2. Pontos são creditados automaticamente ao cliente quando o pedido é finalizado com sucesso.
          </p>
          <p className="text-sm text-muted-foreground">
            10.3. O resgate de pontos está sujeito ao mínimo configurado pelo lojista e ao percentual máximo de desconto sobre o pedido.
          </p>
          <p className="text-sm text-muted-foreground">
            10.4. Pontos não possuem valor monetário e não podem ser transferidos entre lojas ou usuários. Cada loja possui seu próprio saldo de pontos independente.
          </p>

          <h2 className="text-lg font-bold text-foreground">11. Cancelamentos e Reembolsos</h2>
          <p className="text-sm text-muted-foreground">
            11.1. Pedidos podem ser cancelados pelo cliente antes da confirmação pela loja, conforme o Código de Defesa do 
            Consumidor (Lei nº 8.078/1990).
          </p>
          <p className="text-sm text-muted-foreground">
            11.2. Após confirmação ou início da preparação, o cancelamento está sujeito à análise do administrador da Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            11.3. Para pedidos pagos via PIX ou Carteira Digital, reembolsos aprovados são creditados na Carteira Digital do cliente. 
            Para pedidos pagos em dinheiro ou cartão na entrega (não pré-pagos), não há crédito em carteira.
          </p>
          <p className="text-sm text-muted-foreground">
            11.4. Clientes e lojistas podem solicitar reembolso total ou parcial pelo painel, informando motivo (produto errado, 
            item faltante, qualidade inadequada, pedido atrasado, outro) e evidências opcionais. A análise é feita pelo administrador.
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
            (d) indisponibilidade temporária da Plataforma para manutenção; (e) disputas comerciais diretas entre cliente e lojista.
          </p>

          <h2 className="text-lg font-bold text-foreground">14. Suspensão e Exclusão</h2>
          <p className="text-sm text-muted-foreground">
            14.1. A Plataforma reserva-se o direito de suspender ou excluir contas que: (a) violem estes Termos; 
            (b) forneçam informações falsas; (c) pratiquem fraudes; (d) acumulem reclamações de outros Usuários; 
            (e) possuam inadimplência de mensalidade ou comissão superior a 30 dias.
          </p>
          <p className="text-sm text-muted-foreground">
            14.2. Lojas inativas por período prolongado ou com trial expirado sem contratação de plano podem ser 
            desativadas automaticamente.
          </p>

          <h2 className="text-lg font-bold text-foreground">15. Área de Atuação</h2>
          <p className="text-sm text-muted-foreground">
            15.1. A Plataforma opera em <strong className="text-foreground">todo o território nacional brasileiro</strong>, permitindo que cada lojista configure suas próprias regras de cobrança de entrega (por bairro ou por distância). A sede administrativa e o foro de eleição da Plataforma é a comarca de <strong className="text-foreground">Itatinga/SP</strong>.
          </p>

          <h2 className="text-lg font-bold text-foreground">16. Legislação Aplicável</h2>
          <p className="text-sm text-muted-foreground">
            Estes Termos são regidos pela legislação brasileira, em especial: Lei nº 8.078/1990 (CDC), 
            Lei nº 12.965/2014 (Marco Civil da Internet), Lei nº 13.709/2018 (LGPD) e Decreto nº 7.962/2013 
            (comércio eletrônico). Eventuais litígios serão dirimidos no foro da comarca de Itatinga/SP.
          </p>

          <h2 className="text-lg font-bold text-foreground">17. Alterações</h2>
          <p className="text-sm text-muted-foreground">
            O ItaSuper poderá alterar estes Termos a qualquer momento, notificando os Usuários com antecedência mínima de 
            30 dias. O uso continuado após as alterações implica aceitação das novas condições.
          </p>

          <h2 className="text-lg font-bold text-foreground">18. Contato</h2>
          <p className="text-sm text-muted-foreground">
            Para dúvidas, reclamações ou exercício de direitos, entre em contato pelo WhatsApp{" "}
            <strong className="text-foreground">(14) 99162-4997</strong> ou pelo e-mail de suporte disponível na Plataforma.
          </p>

          <div className="border-t border-border pt-4 mt-6">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} Itasuper — Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermosDeUso;
