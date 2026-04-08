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
          <p className="text-xs text-muted-foreground">Última atualização: 08 de Abril de 2026 — Versão 1.0</p>

          <p className="text-sm text-muted-foreground">
            Esta Política de Privacidade descreve como o <strong className="text-foreground">ItaSuper</strong> coleta, utiliza, armazena e protege 
            os dados pessoais dos seus Usuários, em conformidade com a Lei Geral de Proteção de Dados Pessoais 
            (Lei nº 13.709/2018 — LGPD) e demais normas aplicáveis.
          </p>

          <h2 className="text-lg font-bold text-foreground">1. Controlador de Dados</h2>
          <p className="text-sm text-muted-foreground">
            O ItaSuper, na qualidade de controlador dos dados pessoais, é responsável pelas decisões referentes 
            ao tratamento dos dados pessoais coletados através da Plataforma.
          </p>

          <h2 className="text-lg font-bold text-foreground">2. Dados Pessoais Coletados</h2>
          <p className="text-sm text-muted-foreground">Coletamos os seguintes dados conforme o tipo de Usuário:</p>
          
          <h3 className="text-base font-bold text-foreground">2.1. Clientes (Consumidores)</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>E-mail e senha (para autenticação)</li>
            <li>Nome completo</li>
            <li>Endereço de entrega (rua, número, bairro, CEP, complemento, ponto de referência)</li>
            <li>Telefone/WhatsApp</li>
            <li>Histórico de pedidos e avaliações</li>
          </ul>

          <h3 className="text-base font-bold text-foreground">2.2. Lojistas (Parceiros)</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>E-mail, nome completo e senha</li>
            <li>CPF ou CNPJ</li>
            <li>Data de nascimento</li>
            <li>WhatsApp/telefone</li>
            <li>Endereço do estabelecimento (CEP, rua, bairro, cidade)</li>
            <li>Dados financeiros: tipo e chave PIX para recebimento de pagamentos</li>
            <li>Nome e categoria da loja</li>
            <li>Dados de subconta Asaas (ID da conta, ID da carteira) para processamento de pagamentos</li>
          </ul>

          <h3 className="text-base font-bold text-foreground">2.3. Entregadores (Motoboys)</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>E-mail, nome completo e senha</li>
            <li>Telefone/WhatsApp</li>
            <li>Placa do veículo</li>
            <li>Número da CNH</li>
            <li>Foto da CNH (frente e verso) — armazenada em bucket privado</li>
            <li>Selfie para verificação de identidade</li>
            <li>Cidade de atuação</li>
            <li>Dados financeiros para recebimento (chave PIX)</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">3. Base Legal para o Tratamento (Art. 7º LGPD)</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Execução de contrato</strong> (Art. 7º, V): processamento de pedidos, entregas e pagamentos.</li>
            <li><strong className="text-foreground">Consentimento</strong> (Art. 7º, I): para comunicações de marketing e notificações push (Firebase/OneSignal).</li>
            <li><strong className="text-foreground">Cumprimento de obrigação legal</strong> (Art. 7º, II): retenção de dados fiscais e financeiros conforme legislação tributária.</li>
            <li><strong className="text-foreground">Legítimo interesse</strong> (Art. 7º, IX): prevenção de fraudes, análise de conformidade e melhoria dos serviços.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">4. Finalidades do Tratamento</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li>Criação e gerenciamento de contas de usuários</li>
            <li>Processamento e acompanhamento de pedidos</li>
            <li>Processamento de pagamentos via PIX (split automático via Asaas)</li>
            <li>Cálculo e cobrança de comissões (15%)</li>
            <li>Comunicação sobre status de pedidos (push notifications)</li>
            <li>Verificação de identidade de entregadores e lojistas</li>
            <li>Prevenção de fraudes e evasão de comissões (compliance alerts)</li>
            <li>Cálculo de taxa de entrega por bairro</li>
            <li>Programa de fidelidade (pontos por pedido)</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">5. Compartilhamento de Dados</h2>
          <p className="text-sm text-muted-foreground">Compartilhamos dados pessoais apenas com:</p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Asaas (processador de pagamentos):</strong> CPF/CNPJ, nome, e-mail, telefone, cidade e chave PIX do Lojista para criação de subconta e processamento de split de pagamento.</li>
            <li><strong className="text-foreground">Lojista:</strong> nome, endereço de entrega, telefone do Cliente para preparação e entrega do pedido.</li>
            <li><strong className="text-foreground">Entregador:</strong> nome, endereço e telefone do Cliente para realização da entrega.</li>
            <li><strong className="text-foreground">Firebase/OneSignal:</strong> tokens de dispositivo para envio de notificações push.</li>
            <li><strong className="text-foreground">Autoridades competentes:</strong> quando exigido por lei, decisão judicial ou requisição de autoridade.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">6. Armazenamento e Segurança</h2>
          <p className="text-sm text-muted-foreground">
            6.1. Os dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso.
          </p>
          <p className="text-sm text-muted-foreground">
            6.2. Documentos sensíveis de entregadores (CNH, selfie) são armazenados em bucket privado com acesso 
            restrito exclusivamente ao administrador da Plataforma.
          </p>
          <p className="text-sm text-muted-foreground">
            6.3. Utilizamos Row Level Security (RLS) para garantir que cada Usuário acesse apenas seus próprios dados.
          </p>
          <p className="text-sm text-muted-foreground">
            6.4. Senhas são armazenadas com hash criptográfico e nunca são acessíveis em texto plano.
          </p>

          <h2 className="text-lg font-bold text-foreground">7. Retenção de Dados</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Dados de conta:</strong> mantidos enquanto a conta estiver ativa.</li>
            <li><strong className="text-foreground">Histórico de pedidos:</strong> mantido por 5 anos para fins fiscais (Art. 173, CTN).</li>
            <li><strong className="text-foreground">Dados financeiros:</strong> mantidos por 5 anos conforme obrigações tributárias.</li>
            <li><strong className="text-foreground">Documentos de entregadores:</strong> mantidos enquanto o cadastro estiver ativo, eliminados em até 30 dias após exclusão.</li>
            <li><strong className="text-foreground">Registros de aceitação de termos:</strong> mantidos indefinidamente como comprovação legal.</li>
          </ul>

          <h2 className="text-lg font-bold text-foreground">8. Direitos do Titular (Art. 18 LGPD)</h2>
          <p className="text-sm text-muted-foreground">O Usuário possui os seguintes direitos sobre seus dados pessoais:</p>
          <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Confirmação e acesso:</strong> saber se seus dados são tratados e acessá-los.</li>
            <li><strong className="text-foreground">Correção:</strong> corrigir dados incompletos, inexatos ou desatualizados.</li>
            <li><strong className="text-foreground">Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários ou tratados em desconformidade.</li>
            <li><strong className="text-foreground">Portabilidade:</strong> transferir seus dados a outro fornecedor de serviço.</li>
            <li><strong className="text-foreground">Eliminação:</strong> solicitar a exclusão dos dados tratados com base no consentimento.</li>
            <li><strong className="text-foreground">Revogação do consentimento:</strong> retirar o consentimento a qualquer momento.</li>
            <li><strong className="text-foreground">Oposição:</strong> opor-se ao tratamento em caso de descumprimento da LGPD.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Para exercer seus direitos, entre em contato pelo WhatsApp da Plataforma ou e-mail de suporte. 
            Responderemos em até 15 dias úteis, conforme Art. 18, §5º da LGPD.
          </p>

          <h2 className="text-lg font-bold text-foreground">9. Cookies e Tecnologias de Rastreamento</h2>
          <p className="text-sm text-muted-foreground">
            9.1. Utilizamos localStorage para armazenar preferências do Usuário (tema, sessão, carrinho).
          </p>
          <p className="text-sm text-muted-foreground">
            9.2. Tokens de autenticação são gerenciados pelo Supabase Auth de forma segura.
          </p>
          <p className="text-sm text-muted-foreground">
            9.3. Tokens de push notification (Firebase/OneSignal) são armazenados para envio de notificações.
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
            Para questões relacionadas à privacidade e proteção de dados, entre em contato pelo WhatsApp 
            disponível na Plataforma ou pelo e-mail de suporte. O encarregado pela proteção de dados pessoais (DPO) 
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
              © {new Date().getFullYear()} ItaSuper — Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
