import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();
  const dataAtualizacao = "10 de junho de 2026";

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-card border-b border-border z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Política de Privacidade</h1>
        <span className="text-xs text-muted-foreground ml-auto">Atualizado em {dataAtualizacao} · v4.2</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 text-sm text-muted-foreground">

        <section className="space-y-3">
          <p>O <strong className="text-foreground">ItaSuper</strong>, na qualidade de controlador dos dados pessoais (conforme Art. 5º, VI da LGPD), é responsável pelas decisões referentes ao tratamento dos dados coletados através da Plataforma, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).</p>
          <p><strong className="text-foreground">Controlador:</strong> ItaSuper · Itatinga/SP · Brasil · WhatsApp (22) 99279-6291.</p>
          <p><strong className="text-foreground">Encarregado pelo Tratamento de Dados (DPO — Art. 41 LGPD):</strong> Vinícius de Oliveira Vieira · e-mail dedicado <strong className="text-foreground">dpo@itasuper.app</strong> · WhatsApp (22) 99279-6291. O DPO é o canal oficial para o titular exercer seus direitos e para a ANPD em eventuais comunicações.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">1. Dados Coletados</h2>
          <p><strong className="text-foreground">1.1. Clientes:</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Nome completo, e-mail, telefone/WhatsApp</li>
            <li>Endereços de entrega (rua, número, bairro, CEP, complemento)</li>
            <li>Histórico de pedidos e avaliações</li>
            <li>Dados de dispositivo (token push, modelo, sistema operacional, IP)</li>
            <li>Dados de suporte: tickets abertos, mensagens trocadas com agentes de suporte</li>
            <li>Geolocalização aproximada (apenas para cálculo de frete, com consentimento)</li>
          </ul>
          <p><strong className="text-foreground">1.2. Lojistas:</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Nome completo, CPF/CNPJ, data de nascimento, e-mail, telefone</li>
            <li>Endereço comercial completo</li>
            <li>Dados bancários para subconta de pagamento (Asaas): nome, CPF/CNPJ, chave PIX, documentos de identidade</li>
            <li>Logotipo, imagens de produtos e informações do cardápio</li>
            <li>Dados financeiros: taxas de comissão, mensalidade, histórico de cobranças</li>
            <li>Dados de suporte: tickets abertos, conteúdo de mensagens trocadas com agentes, categoria e prioridade dos chamados</li>
            <li><strong className="text-foreground">Inteligência Artificial (Sales Coach):</strong> Os dados de vendas e pedidos do lojista (volumes, horários, produtos, ticket médio) são processados por modelo de IA para gerar recomendações de desempenho. O lojista pode desativar este recurso nas configurações da conta e tem direito à <strong className="text-foreground">revisão humana</strong> das recomendações geradas, mediante solicitação ao suporte (Art. 20 LGPD).</li>
            <li><strong className="text-foreground">Dados PDV:</strong> sessões de caixa (abertura, fechamento, valores), movimentações (vendas, sangrias, suprimentos), comissões pendentes</li>
            <li><strong className="text-foreground">WhatsApp Automático (Evolution API):</strong> nome da instância, status de conexão, templates de mensagem personalizados, log de envios (telefone destinatário, hash da mensagem, data/hora, tipo). Tokens e credenciais da instância são armazenados em tabela restrita, acessível apenas pelo lojista titular e pelo administrador.</li>
          </ul>
          <p><strong className="text-foreground">1.3. Entregadores:</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Nome completo, CPF, data de nascimento, e-mail, telefone</li>
            <li>Documentos: CNH (frente/verso), selfie com documento</li>
            <li>Geolocalização em tempo real durante entregas ativas</li>
            <li>Chave PIX para recebimento de repasses</li>
            <li>Histórico de entregas e avaliações</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">2. Finalidade e Base Legal do Tratamento</h2>
          <ul className="list-disc pl-4 space-y-2">
            <li><strong className="text-foreground">Execução de contrato (Art. 7º, V):</strong> Processamento de pedidos, pagamentos, repasses e cobranças de plano.</li>
            <li><strong className="text-foreground">Legítimo interesse (Art. 7º, IX):</strong> Envio de notificações sobre status de pedidos, segurança da conta (IP/dispositivo/sessão única), prevenção a fraudes, antifraude WhatsApp e auditoria de suporte. Base documentada em RIPD disponível mediante solicitação ao DPO.</li>
            <li><strong className="text-foreground">Consentimento (Art. 7º, I):</strong> Geolocalização para cálculo de frete, opção <em>"Quero receber atualizações do pedido por WhatsApp"</em> e comunicações de marketing (opt-in específico). O consentimento pode ser revogado a qualquer tempo, sem ônus.</li>
            <li><strong className="text-foreground">Obrigação legal (Art. 7º, II):</strong> Manutenção de registros de transações financeiras conforme legislação fiscal e regulatória.</li>
            <li><strong className="text-foreground">Dados PDV:</strong> Execução de contrato — as sessões e movimentações de caixa são necessárias para calcular a comissão presencial e gerar relatórios de turno ao lojista.</li>
            <li><strong className="text-foreground">WhatsApp Automático:</strong> Execução de contrato + consentimento (Art. 7º, V e I) — envio de mensagens transacionais ao cliente sobre o ciclo do pedido (aceito, em preparo, pronto, saiu para entrega, entregue, cancelado), mediante opt-in expresso no checkout/perfil. Mensagens promocionais exigem consentimento específico e adicional, de responsabilidade do Lojista.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">3. Compartilhamento de Dados</h2>
          <p>Os dados são compartilhados apenas quando necessário:</p>
          <ul className="list-disc pl-4 space-y-2">
            <li><strong className="text-foreground">Asaas Gestão Financeira Instituição de Pagamentos S.A. (CNPJ 19.540.550/0001-21):</strong> Instituição de pagamento autorizada pelo Banco Central do Brasil. Recebe os dados financeiros necessários para criação e operação da subconta de pagamento do lojista (nome, CPF/CNPJ, endereço, documentos).</li>
            <li><strong className="text-foreground">Firebase (Google):</strong> Token de dispositivo para envio de notificações push (sem dados pessoais identificáveis).</li>
            <li><strong className="text-foreground">Supabase:</strong> Infraestrutura de banco de dados e autenticação — dados armazenados com criptografia.</li>
            <li><strong className="text-foreground">Vercel:</strong> Infraestrutura de hospedagem da aplicação.</li>
            <li><strong className="text-foreground">Evolution API (WhatsApp):</strong> Servidor de integração com o WhatsApp utilizado para envio das mensagens automáticas. Recebe o número do destinatário e o conteúdo da mensagem, processados em servidor próprio da plataforma. O lojista é corresponsável pelo número conectado e pelo cumprimento dos Termos do WhatsApp/Meta.</li>
            <li><strong className="text-foreground">Entre usuários da plataforma:</strong> Lojistas veem nome e telefone do cliente para fins de entrega (apenas campos necessários via view de segurança). Clientes veem nome e avaliação da loja.</li>
            <li><strong className="text-foreground">Autoridades competentes:</strong> Quando exigido por lei ou ordem judicial.</li>
          </ul>
          <p>O ItaSuper <strong className="text-foreground">não vende dados pessoais</strong> a terceiros.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">4. Retenção de Dados</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Conta ativa:</strong> Dados mantidos enquanto a conta estiver ativa.</li>
            <li><strong className="text-foreground">Após exclusão:</strong> Dados pessoais eliminados em até 30 dias, exceto os necessários para obrigações legais ou fiscais (até 5 anos, conforme legislação tributária).</li>
            <li><strong className="text-foreground">Histórico de pedidos:</strong> Mantido por até 5 anos para fins contábeis e fiscais (Art. 195, parágrafo único, CTN).</li>
            <li><strong className="text-foreground">Dados PDV (sessões e movimentações):</strong> Mantidos por até 5 anos para fins de auditoria financeira e fiscal.</li>
            <li><strong className="text-foreground">Dados de suporte (tickets e mensagens):</strong> Mantidos por até 2 anos após o encerramento do ticket, com base em legítimo interesse para auditoria de atendimento, defesa em eventual processo judicial/administrativo e resolução de disputas, conforme avaliação de impacto disponível mediante solicitação ao DPO.</li>
            <li><strong className="text-foreground">Log de envios de WhatsApp:</strong> Mantido por até 12 meses com base em legítimo interesse para antifraude, deduplicação e controle de limites diários por chip. Após esse prazo é eliminado automaticamente.</li>
            <li><strong className="text-foreground">Documentos de identidade (entregadores):</strong> Mantidos enquanto o cadastro estiver ativo. Excluídos em até 30 dias após o encerramento da conta.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">5. Direitos do Titular (Art. 18 LGPD)</h2>
          <p>O Usuário tem direito a:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">Confirmação e acesso:</strong> Saber se seus dados são tratados e acessá-los.</li>
            <li><strong className="text-foreground">Correção:</strong> Atualizar dados incompletos, inexatos ou desatualizados.</li>
            <li><strong className="text-foreground">Anonimização, bloqueio ou eliminação:</strong> Para dados desnecessários, excessivos ou tratados em desconformidade.</li>
            <li><strong className="text-foreground">Portabilidade:</strong> Receber seus dados em formato estruturado.</li>
            <li><strong className="text-foreground">Eliminação:</strong> Solicitar a exclusão de dados tratados com consentimento.</li>
            <li><strong className="text-foreground">Revogação do consentimento:</strong> A qualquer momento, sem prejuízo dos tratamentos já realizados.</li>
            <li><strong className="text-foreground">Oposição:</strong> Opor-se a tratamentos realizados com base em legítimo interesse.</li>
            <li><strong className="text-foreground">Revisão de decisões automatizadas (Art. 20):</strong> Solicitar análise humana de decisões automatizadas (Sales Coach, antifraude, bloqueios), com resposta em até 48 horas úteis.</li>
          </ul>
          <p>Para exercer seus direitos: utilize as funcionalidades no perfil da Plataforma, escreva para <strong className="text-foreground">dpo@itasuper.app</strong> ou entre em contato pelo WhatsApp (22) 99279-6291. Responderemos em até <strong className="text-foreground">15 dias úteis</strong> (Art. 18, §5º da LGPD).</p>
          <p><strong className="text-foreground">Canal ANPD:</strong> Em caso de não atendimento, o titular pode apresentar reclamação à Autoridade Nacional de Proteção de Dados — <strong className="text-foreground">www.gov.br/anpd</strong>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">6. Segurança dos Dados</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Criptografia em trânsito (TLS/SSL) e em repouso em todos os dados.</li>
            <li>Row Level Security (RLS) em todas as tabelas do banco: cada usuário acessa apenas seus próprios dados.</li>
            <li>Documentos sensíveis de entregadores armazenados em bucket privado com acesso restrito ao administrador.</li>
            <li>Dados financeiros de lojas protegidos por views de segurança, limitando campos expostos.</li>
            <li>Senhas armazenadas com hash criptográfico — nunca em texto plano.</li>
            <li>Credenciais de integração (Evolution API e demais) em tabela dedicada com acesso restrito ao lojista titular e ao administrador da plataforma.</li>
            <li>Controle de sessão única por conta.</li>
            <li>Dados PDV (sessões, movimentações) acessíveis apenas pelo próprio lojista e pelo administrador da plataforma.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">7. Cookies e Armazenamento Local</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong className="text-foreground">localStorage:</strong> Preferências do usuário (tema, carrinho, loja selecionada, endereço).</li>
            <li><strong className="text-foreground">Tokens de autenticação:</strong> Gerenciados de forma segura pelo sistema de autenticação, com renovação automática.</li>
            <li><strong className="text-foreground">Tokens FCM:</strong> Para envio de notificações push sobre pedidos e alertas.</li>
            <li><strong className="text-foreground">Identificadores de dispositivo:</strong> Para controle de sessão única e antifraude.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">8. Transferência Internacional</h2>
          <p>Dados podem ser processados em servidores fora do Brasil (Supabase, Firebase, Vercel). As transferências ocorrem com base em <strong className="text-foreground">cláusulas contratuais específicas</strong> firmadas com os operadores (Art. 33, II da LGPD), que aderem a frameworks reconhecidos de segurança e privacidade (SOC 2, ISO 27001, GDPR), garantindo padrões equivalentes ou superiores aos exigidos pela LGPD.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">9. Menores de Idade</h2>
          <p>A Plataforma não é destinada a menores de 16 anos. Adolescentes entre 16 e 18 anos só podem utilizar com assistência dos responsáveis legais. Dados de menores de 16 anos coletados inadvertidamente serão eliminados imediatamente (Art. 14 da LGPD). Pais ou responsáveis podem solicitar a exclusão pelo suporte ou pelo DPO.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">10. Incidentes de Segurança</h2>
          <p>Em caso de incidente que possa acarretar risco relevante aos titulares, comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados em prazo razoável (até 3 dias úteis da ciência), conforme Art. 48 da LGPD e Resolução CD/ANPD nº 15/2024.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">11. Alterações desta Política</h2>
          <p>Alterações serão comunicadas via notificação na Plataforma ou e-mail com antecedência mínima de 30 dias. A versão vigente está sempre disponível na Plataforma.</p>
        </section>

        <section className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground text-center">
            ItaSuper — Controlador de Dados · Itatinga/SP · Brasil<br />
            Versão 4.2 · Última atualização: {dataAtualizacao}<br />
            Contato LGPD: dpo@itasuper.app · WhatsApp (22) 99279-6291
          </p>
        </section>

      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
