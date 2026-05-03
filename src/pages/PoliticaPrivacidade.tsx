import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();
  const dataAtualizacao = "03 de maio de 2025";

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-card border-b border-border z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Política de Privacidade</h1>
        <span className="text-xs text-muted-foreground ml-auto">Atualizado em {dataAtualizacao}</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 text-sm text-muted-foreground">

        <section className="space-y-3">
          <p>O <strong className="text-foreground">ItaSuper</strong>, na qualidade de controlador dos dados pessoais (conforme Art. 5º, VI da LGPD), é responsável pelas decisões referentes ao tratamento dos dados coletados através da Plataforma, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).</p>
          <p>Contato do Controlador: WhatsApp (14) 99162-4997 · Itatinga/SP · Brasil.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">1. Dados Coletados</h2>
          <p><strong className="text-foreground">1.1. Clientes:</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Nome completo, e-mail, telefone/WhatsApp</li>
            <li>Endereços de entrega (rua, número, bairro, CEP, complemento)</li>
            <li>Histórico de pedidos e avaliações</li>
            <li>Dados de dispositivo (token push, modelo, sistema operacional)</li>
            <li>Geolocalização aproximada (apenas para cálculo de frete, com consentimento)</li>
          </ul>
          <p><strong className="text-foreground">1.2. Lojistas:</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Nome completo, CPF/CNPJ, data de nascimento, e-mail, telefone</li>
            <li>Endereço comercial completo</li>
            <li>Dados bancários para subconta de pagamento (Asaas): nome, CPF/CNPJ, chave PIX, documentos de identidade</li>
            <li>Logotipo, imagens de produtos e informações do cardápio</li>
            <li>Dados financeiros: taxas de comissão, mensalidade, histórico de cobranças</li>
            <li><strong className="text-foreground">Dados PDV:</strong> sessões de caixa (abertura, fechamento, valores), movimentações (vendas, sangrias, suprimentos), comissões pendentes</li>
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
            <li><strong className="text-foreground">Legítimo interesse (Art. 7º, IX):</strong> Envio de notificações sobre status de pedidos, segurança da conta, prevenção a fraudes.</li>
            <li><strong className="text-foreground">Consentimento (Art. 7º, I):</strong> Geolocalização para cálculo de frete, comunicações de marketing (opt-in).</li>
            <li><strong className="text-foreground">Obrigação legal (Art. 7º, II):</strong> Manutenção de registros de transações financeiras conforme legislação fiscal e regulatória.</li>
            <li><strong className="text-foreground">Dados PDV:</strong> Execução de contrato — as sessões e movimentações de caixa são necessárias para calcular a comissão presencial e gerar relatórios de turno ao lojista.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">3. Compartilhamento de Dados</h2>
          <p>Os dados são compartilhados apenas quando necessário:</p>
          <ul className="list-disc pl-4 space-y-2">
            <li><strong className="text-foreground">Asaas Pagamentos S.A.:</strong> Dados financeiros necessários para criação e operação da subconta de pagamento do lojista (nome, CPF/CNPJ, endereço, documentos).</li>
            <li><strong className="text-foreground">Firebase (Google):</strong> Token de dispositivo para envio de notificações push (sem dados pessoais identificáveis).</li>
            <li><strong className="text-foreground">Supabase:</strong> Infraestrutura de banco de dados e autenticação — dados armazenados com criptografia.</li>
            <li><strong className="text-foreground">Vercel:</strong> Infraestrutura de hospedagem da aplicação.</li>
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
            <li><strong className="text-foreground">Histórico de pedidos:</strong> Mantido por até 5 anos para fins contábeis e fiscais.</li>
            <li><strong className="text-foreground">Dados PDV (sessões e movimentações):</strong> Mantidos por até 5 anos para fins de auditoria financeira e fiscal.</li>
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
          </ul>
          <p>Para exercer seus direitos: utilize as funcionalidades no perfil da Plataforma ou entre em contato pelo WhatsApp (14) 99162-4997. Responderemos em até <strong className="text-foreground">15 dias úteis</strong> (Art. 18, §5º da LGPD).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">6. Segurança dos Dados</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>Criptografia em trânsito (TLS/SSL) e em repouso em todos os dados.</li>
            <li>Row Level Security (RLS) em todas as tabelas do banco: cada usuário acessa apenas seus próprios dados.</li>
            <li>Documentos sensíveis de entregadores armazenados em bucket privado com acesso restrito ao administrador.</li>
            <li>Dados financeiros de lojas protegidos por views de segurança, limitando campos expostos.</li>
            <li>Senhas armazenadas com hash criptográfico — nunca em texto plano.</li>
            <li>Credenciais de integração (tokens Z-API) em tabela dedicada com acesso restrito.</li>
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
            <li><strong className="text-foreground">Identificadores de dispositivo:</strong> Para controle de sessão única.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">8. Transferência Internacional</h2>
          <p>Dados podem ser processados em servidores fora do Brasil (Supabase, Firebase, Vercel). Garantimos que os prestadores adotam padrões equivalentes aos exigidos pela LGPD, conforme Art. 33.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">9. Menores de Idade</h2>
          <p>A Plataforma não é destinada a menores de 18 anos. Dados de menores coletados inadvertidamente serão eliminados imediatamente (Art. 14 da LGPD). Pais ou responsáveis podem solicitar a exclusão pelo suporte.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">10. Incidentes de Segurança</h2>
          <p>Em caso de incidente que possa acarretar risco relevante aos titulares, comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados em prazo razoável, conforme Art. 48 da LGPD.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">11. Alterações desta Política</h2>
          <p>Alterações serão comunicadas via notificação na Plataforma ou e-mail com antecedência mínima de 30 dias. A versão vigente está sempre disponível na Plataforma.</p>
        </section>

        <section className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground text-center">
            ItaSuper — Controlador de Dados · Itatinga/SP · Brasil<br />
            Última atualização: {dataAtualizacao}<br />
            Contato LGPD: WhatsApp (14) 99162-4997
          </p>
        </section>

      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
