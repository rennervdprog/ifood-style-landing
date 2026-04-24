import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Política de Privacidade</h1>
      </header>

      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
           <p className="text-xs text-muted-foreground">Última atualização: 24 de Abril de 2026 — Versão 3.1</p>

          <p className="text-sm text-muted-foreground">
            Esta Política de Privacidade descreve como o <strong className="text-foreground">ItaSuper</strong> coleta, utiliza, armazena e protege 
            os dados pessoais dos seus Usuários, em conformidade com a Lei Geral de Proteção de Dados Pessoais 
            (Lei nº 13.709/2018 — LGPD) e demais normas aplicáveis.
          </p>

          <h2 className="text-lg font-bold text-foreground">1. Controlador de Dados</h2>
          <p className="text-sm text-muted-foreground">
            O ItaSuper, na qualidade de controlador dos dados pessoais, é responsável pelas decisões referentes 
            ao tratamento dos dados pessoais coletados através da Plataforma. Para contato: WhatsApp (14) 99162-4997.
          </p>

          <h2 className="text-lg font-bold text-foreground">2. Dados Pessoais Coletados</h2>
          <p className="text-sm text-muted-foreground">Coletamos os seguintes dados conforme o tipo de Usuário:</p>
          
          <h3 className="text-base font-bold text-foreground">2.1. Clientes (Consumidores)</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>E-mail e senha (para autenticação com confirmação por e-mail)</li>
            <li>Nome completo</li>
            <li>Telefone/WhatsApp</li>
            <li>Endereços de entrega salvos (rua, número, bairro, CEP, complemento, ponto de referência) — podendo ter múltiplos endereços com um padrão definido</li>
            <li>Coordenadas de geolocalização (latitude/longitude) para cálculo de taxa de entrega, coletadas apenas durante o checkout</li>
            <li>Histórico de pedidos, itens e valores</li>
            <li>Avaliações e comentários sobre pedidos</li>
            <li>Pontos de fidelidade acumulados por loja</li>
            <li>Saldo da Carteira Digital (Wallet) e histórico de transações</li>
            <li>Mensagens enviadas no chat de pedidos</li>
            <li>Informações do dispositivo (user agent) para registro de aceite dos termos</li>
            <li>Identificador de dispositivo (device ID) para controle de sessão única</li>
          </ul>

          <h3 className="text-base font-bold text-foreground">2.2. Lojistas (Parceiros)</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>E-mail, nome completo e senha (com confirmação por e-mail)</li>
            <li>CPF ou CNPJ</li>
            <li>Data de nascimento</li>
            <li>WhatsApp/telefone</li>
            <li>Endereço completo do estabelecimento (CEP, rua, número, bairro, cidade, estado, complemento, ponto de referência)</li>
            <li>Coordenadas geográficas do estabelecimento (latitude/longitude)</li>
            <li>Dados financeiros: tipo de chave PIX (CPF, CNPJ, e-mail, telefone ou chave aleatória) e chave PIX para recebimento</li>
            <li>Nome, categoria e logotipo (imagem) da loja</li>
            <li>Slug personalizado para URL da loja</li>
             <li>Plano contratado e dados de assinatura (Essencial R$180/mês, Crescimento R$100/mês + 2,5%, Comissão 6% ou Apoiador)</li>
            <li>Dados de subconta nos gateways de pagamento (Asaas e/ou Mercado Pago) para processamento de transações PIX</li>
            <li>Configurações operacionais: horários de funcionamento por dia da semana, modo de entrega (plataforma/próprio), taxa de entrega própria, configurações de fidelidade</li>
            <li>Credenciais de integração WhatsApp (Z-API) quando ativada: instance ID, token e client token — armazenados em tabela protegida com acesso restrito ao próprio lojista</li>
            <li>Histórico financeiro: comissões, mensalidades, transações PIX, saldos pendentes</li>
          </ul>

          <h3 className="text-base font-bold text-foreground">2.3. Entregadores da Plataforma</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>E-mail, nome completo e senha (com confirmação por e-mail)</li>
            <li>CPF</li>
            <li>Telefone/WhatsApp</li>
            <li>Placa do veículo (formato antigo ABC-1234 ou Mercosul ABC1D23)</li>
            <li>Número da CNH (11 dígitos)</li>
            <li>Foto da CNH frente e verso — armazenada em bucket privado com acesso restrito ao administrador</li>
            <li>Selfie para verificação de identidade — armazenada em bucket privado</li>
            <li>Cidade de atuação</li>
            <li>Dados financeiros: tipo e chave PIX para recebimento de ganhos e saques</li>
            <li>Localização em tempo real (latitude, longitude, velocidade, direção, precisão) durante entregas ativas — publicada no canal Realtime para rastreamento pelo cliente e loja</li>
            <li>Histórico de ganhos por entrega e solicitações de saque</li>
          </ul>

          <h3 className="text-base font-bold text-foreground">2.4. Motoboys de Loja (Próprios)</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>E-mail, nome completo e senha (com confirmação por e-mail)</li>
            <li>Telefone/WhatsApp</li>
            <li>Tipo e modelo do veículo</li>
            <li>Vinculação à loja (realizada pelo dono do estabelecimento)</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">3. Base Legal para o Tratamento (Art. 7º LGPD)</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Execução de contrato</strong> (Art. 7º, V): processamento de pedidos, entregas, pagamentos, cálculo de comissões e mensalidades.</li>
             <li><strong className="text-foreground">Consentimento</strong> (Art. 7º, I): para notificações push, comunicações sobre pedidos e compartilhamento de localização em tempo real para fins de entrega.</li>
            <li><strong className="text-foreground">Cumprimento de obrigação legal</strong> (Art. 7º, II): retenção de dados fiscais, financeiros e registros de aceite de termos conforme legislação tributária e Marco Civil da Internet.</li>
            <li><strong className="text-foreground">Legítimo interesse</strong> (Art. 7º, IX): prevenção de fraudes, análise de conformidade, controle de sessão única (single-device login) e melhoria dos serviços.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">4. Finalidades do Tratamento</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Criação, autenticação e gerenciamento de contas de usuários</li>
            <li>Processamento, acompanhamento e gestão de pedidos em tempo real</li>
            <li>Processamento de pagamentos via PIX (Asaas e/ou Mercado Pago)</li>
            <li>Cálculo e cobrança de comissões e mensalidades conforme plano contratado</li>
            <li>Comunicação sobre status de pedidos (push notifications, alertas sonoros)</li>
            <li>Chat em tempo real entre cliente e loja sobre pedidos específicos</li>
            <li>Verificação de identidade de entregadores (análise de CNH e selfie) e aprovação de lojistas</li>
            <li>Rastreamento em tempo real de entregas via GPS do entregador</li>
            <li>Cálculo automático de taxa de entrega por bairro/distância (usando geolocalização)</li>
            <li>Programa de fidelidade (acúmulo e resgate de pontos por pedido por loja)</li>
            <li>Validação e aplicação de cupons de desconto</li>
            <li>Gestão de Carteira Digital (Wallet) — créditos, débitos e reembolsos</li>
            <li>Exibição de banners promocionais da loja</li>
            <li>Geração de relatórios financeiros e analíticos para lojistas</li>
            <li>Controle de sessão única para segurança da conta (single-device login)</li>
            <li>Envio de notificações via WhatsApp (Z-API) quando integração ativada pelo lojista</li>
            <li>Prevenção de fraudes e evasão de comissões</li>
            <li>Gestão de solicitações de reembolso</li>
            <li>Arquivamento de contas excluídas para cumprimento de obrigações legais</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">5. Compartilhamento de Dados</h2>
          <p className="text-sm text-muted-foreground">Compartilhamos dados pessoais apenas com:</p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Asaas e Mercado Pago (processadores de pagamento):</strong> CPF/CNPJ, nome, e-mail, data de nascimento, telefone e chave PIX do Lojista para criação de subconta e processamento de transações PIX.</li>
            <li><strong className="text-foreground">Lojista:</strong> nome, endereço de entrega, telefone e bairro do Cliente para preparação e entrega do pedido.</li>
            <li><strong className="text-foreground">Entregador:</strong> nome, endereço, telefone e coordenadas do Cliente para realização da entrega e cálculo de rota.</li>
            <li><strong className="text-foreground">Cliente:</strong> localização em tempo real do entregador durante a entrega ativa (latitude, longitude).</li>
            <li><strong className="text-foreground">Serviços de notificação push:</strong> tokens de dispositivo (Firebase Cloud Messaging / OneSignal) para envio de notificações sobre status de pedidos.</li>
            <li><strong className="text-foreground">Z-API (integração WhatsApp):</strong> dados do pedido e contato do cliente para envio automático de notificações via WhatsApp, quando ativado pelo lojista.</li>
            <li><strong className="text-foreground">Autoridades competentes:</strong> quando exigido por lei, decisão judicial ou requisição de autoridade.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">6. Armazenamento e Segurança</h2>
          <p className="text-sm text-muted-foreground">
            6.1. Os dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso.
          </p>
          <p className="text-sm text-muted-foreground">
            6.2. Documentos sensíveis de entregadores (CNH frente/verso, selfie) são armazenados em bucket privado ("partner-images") 
            com acesso restrito exclusivamente ao administrador da Plataforma. Fotos de produtos e logotipos de lojas são armazenados 
            em bucket público ("store-assets") para exibição no cardápio.
          </p>
          <p className="text-sm text-muted-foreground">
            6.3. Utilizamos Row Level Security (RLS) em todas as tabelas do banco de dados para garantir que cada Usuário 
            acesse apenas seus próprios dados. Views de segurança são utilizadas para restringir campos sensíveis 
            (dados financeiros, taxas, IDs de gateway) em consultas públicas.
          </p>
          <p className="text-sm text-muted-foreground">
            6.4. Senhas são armazenadas com hash criptográfico e nunca são acessíveis em texto plano.
          </p>
          <p className="text-sm text-muted-foreground">
            6.5. Credenciais de integração (tokens Z-API) são armazenadas em tabela dedicada ("store_secrets") com acesso 
            restrito exclusivamente ao próprio lojista e ao administrador.
          </p>
          <p className="text-sm text-muted-foreground">
            6.6. Dados financeiros sensíveis de lojas (IDs de subconta de pagamento, taxas de comissão) são protegidos 
            por views de segurança que limitam a exposição pública apenas aos campos estritamente necessários.
          </p>
          <p className="text-sm text-muted-foreground">
            6.7. O controle de sessão única garante que apenas um dispositivo esteja ativo por conta, reduzindo 
            o risco de acesso não autorizado.
          </p>

          <h2 className="text-lg font-bold text-foreground">7. Retenção de Dados</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Dados de conta:</strong> mantidos enquanto a conta estiver ativa.</li>
            <li><strong className="text-foreground">Histórico de pedidos:</strong> mantido por 5 anos para fins fiscais (Art. 173, CTN).</li>
            <li><strong className="text-foreground">Dados financeiros:</strong> mantidos por 5 anos conforme obrigações tributárias (comissões, mensalidades, transações).</li>
            <li><strong className="text-foreground">Documentos de entregadores:</strong> mantidos enquanto o cadastro estiver ativo, eliminados em até 30 dias após exclusão da conta.</li>
            <li><strong className="text-foreground">Registros de aceitação de termos:</strong> mantidos indefinidamente como comprovação legal (versão dos termos, versão da política, user agent, data de aceite).</li>
            <li><strong className="text-foreground">Contas excluídas:</strong> dados são arquivados na tabela "archived_accounts" com retenção de 5 anos conforme obrigação legal, incluindo: nome, e-mail, telefone, documento, endereço, PIX, quantidade de pedidos e total gasto. Após o período, são eliminados definitivamente.</li>
            <li><strong className="text-foreground">Localização de entregadores:</strong> dados de geolocalização são mantidos apenas durante a entrega ativa e sobrescritos a cada atualização.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">8. Direitos do Titular (Art. 18 LGPD)</h2>
          <p className="text-sm text-muted-foreground">O Usuário possui os seguintes direitos sobre seus dados pessoais:</p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Confirmação e acesso:</strong> saber se seus dados são tratados e acessá-los (disponível pelo perfil na Plataforma).</li>
            <li><strong className="text-foreground">Correção:</strong> corrigir dados incompletos, inexatos ou desatualizados (editável pelo perfil).</li>
            <li><strong className="text-foreground">Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários ou tratados em desconformidade.</li>
            <li><strong className="text-foreground">Portabilidade:</strong> transferir seus dados a outro fornecedor de serviço.</li>
            <li><strong className="text-foreground">Eliminação:</strong> solicitar a exclusão dos dados tratados com base no consentimento.</li>
            <li><strong className="text-foreground">Revogação do consentimento:</strong> retirar o consentimento a qualquer momento (ex: desativar notificações push).</li>
            <li><strong className="text-foreground">Oposição:</strong> opor-se ao tratamento em caso de descumprimento da LGPD.</li>
            <li><strong className="text-foreground">Exclusão de conta:</strong> solicitar a exclusão definitiva da conta diretamente pela seção "Minha Conta" → "Excluir minha conta". Os dados serão arquivados pelo prazo legal e depois eliminados.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Para exercer seus direitos, utilize as funcionalidades disponíveis no perfil da Plataforma ou entre em contato 
            pelo WhatsApp (14) 99162-4997. Responderemos em até 15 dias úteis, conforme Art. 18, §5º da LGPD.
          </p>

          <h2 className="text-lg font-bold text-foreground">9. Cookies e Tecnologias de Rastreamento</h2>
          <p className="text-sm text-muted-foreground">
            9.1. Utilizamos localStorage para armazenar preferências do Usuário (tema claro/escuro, dados de sessão, 
            carrinho de compras, loja selecionada, endereço selecionado).
          </p>
          <p className="text-sm text-muted-foreground">
            9.2. Tokens de autenticação são gerenciados de forma segura pelo sistema de autenticação da Plataforma, 
            com renovação automática e controle de sessão única.
          </p>
          <p className="text-sm text-muted-foreground">
            9.3. Tokens de push notification (Firebase Cloud Messaging / OneSignal) são armazenados para envio de 
            notificações sobre status de pedidos, novos pedidos para lojistas e atualizações de entrega.
          </p>
          <p className="text-sm text-muted-foreground">
            9.4. Identificadores de dispositivo são armazenados para o controle de sessão única (single-device login).
          </p>

          <h2 className="text-lg font-bold text-foreground">10. Transferência Internacional de Dados</h2>
          <p className="text-sm text-muted-foreground">
            Os dados podem ser processados em servidores localizados fora do Brasil (infraestrutura de nuvem). 
            Nestes casos, garantimos que os prestadores de serviço adotam padrões de segurança equivalentes aos 
            exigidos pela LGPD, conforme Art. 33.
          </p>

          <h2 className="text-lg font-bold text-foreground">11. Menores de Idade</h2>
          <p className="text-sm text-muted-foreground">
            A Plataforma não é destinada a menores de 18 anos. Caso identifiquemos dados de menores coletados 
            inadvertidamente, estes serão eliminados, conforme Art. 14 da LGPD.
          </p>

          <h2 className="text-lg font-bold text-foreground">12. Incidentes de Segurança</h2>
          <p className="text-sm text-muted-foreground">
            Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, 
            comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados em prazo razoável, 
            conforme Art. 48 da LGPD.
          </p>

          <h2 className="text-lg font-bold text-foreground">13. Alterações nesta Política</h2>
          <p className="text-sm text-muted-foreground">
            Esta Política pode ser atualizada periodicamente. Notificaremos os Usuários sobre alterações significativas 
            com antecedência mínima de 30 dias. O uso continuado após as alterações constitui aceitação.
          </p>

          <h2 className="text-lg font-bold text-foreground">14. Contato e Encarregado (DPO)</h2>
          <p className="text-sm text-muted-foreground">
            Para questões relacionadas à privacidade e proteção de dados, entre em contato pelo WhatsApp{" "}
            <strong className="text-foreground">(14) 99162-4997</strong> ou pelo e-mail de suporte. O encarregado pela proteção de dados pessoais (DPO) 
            pode ser contatado pelos mesmos canais.
          </p>

          <h2 className="text-lg font-bold text-foreground">15. Legislação e Foro</h2>
          <p className="text-sm text-muted-foreground">
            Esta Política é regida pela legislação brasileira, em especial a Lei nº 13.709/2018 (LGPD), 
            Lei nº 12.965/2014 (Marco Civil da Internet) e Lei nº 8.078/1990 (CDC). 
            O foro competente é o da comarca de Itatinga/SP.
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

export default PoliticaPrivacidade;
