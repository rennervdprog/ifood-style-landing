import { useState, useEffect, useMemo } from "react";
import {
  GraduationCap, ChevronDown, ChevronUp, Search, X,
  LayoutDashboard, ListOrdered, UtensilsCrossed, Plus, CircleDot,
  Clock, Coins, BarChart3, CreditCard, Star, Bike, AlertTriangle, Settings,
  CheckCircle2, Rocket, HelpCircle, MessageCircle, Sparkles, BookOpen,
  PlayCircle, ArrowRight, Zap, Trophy, ShoppingCart, Tag, Users, Bell,
  Wallet, MapPin,
} from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { useAuth } from "@/contexts/AuthContext";

const SUPPORT_WHATSAPP = "22992796291";
const SUPPORT_MESSAGE = "Olá! Preciso de ajuda com o painel do lojista do ItaSuper.";

interface TutorialStep {
  title: string;
  content: string;
  tip?: string;
}

type TutorialCategory = "essencial" | "vendas" | "financeiro" | "operacao";

interface TutorialSection {
  id: string;
  icon: React.ElementType;
  title: string;
  shortDesc: string;
  color: string;
  bgColor: string;
  category: TutorialCategory;
  estimatedMinutes: number;
  steps: TutorialStep[];
}

const CATEGORIES: { id: TutorialCategory | "all"; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "Todos", icon: BookOpen },
  { id: "essencial", label: "Essencial", icon: Sparkles },
  { id: "vendas", label: "Vendas", icon: UtensilsCrossed },
  { id: "financeiro", label: "Financeiro", icon: Coins },
  { id: "operacao", label: "Operação", icon: Settings },
];

const TUTORIAIS: TutorialSection[] = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Visão Geral (Início)",
    shortDesc: "A primeira tela que você vê quando entra no painel",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "essencial",
    estimatedMinutes: 3,
    steps: [
      {
        title: "O que aparece aqui?",
        content: "Esta é a sua página inicial. Ela mostra um resumo de tudo que está acontecendo na sua loja AGORA: quantos pedidos novos chegaram hoje, quanto dinheiro você já fez no dia, quantos clientes pediram, e o status atual da sua loja (aberta ou fechada).",
      },
      {
        title: "Cartões coloridos no topo",
        content: "Cada cartão colorido mostra um número importante: pedidos do dia, faturamento do dia, ticket médio (valor médio dos pedidos) e clientes únicos. Você só olha e já sabe como está o dia.",
        tip: "Toque em cada cartão para ver mais detalhes da informação.",
      },
      {
        title: "Pedidos em andamento",
        content: "Logo abaixo aparece uma fileira com os pedidos que estão sendo preparados ou já saíram para entrega. Toque em qualquer um para ver os detalhes completos.",
      },
      {
        title: "Modo de Entrega",
        content: "Aqui você define se quer usar SEU motoboy próprio. Se escolher motoboy próprio, digite quanto cobra de taxa de entrega. O sistema mostra automaticamente quanto o cliente vai pagar (sua taxa + taxa da plataforma).",
        tip: "Veja sempre o quadro 'Como o cliente vai ver' para entender o valor final.",
      },
      {
        title: "Ações Rápidas",
        content: "Quatro botões grandes para acessar rapidamente: Cardápio, Finanças, Horários e Configurações. É só tocar para ir direto.",
      },
    ],
  },
  {
    id: "orders",
    icon: ListOrdered,
    title: "Pedidos",
    shortDesc: "Onde você gerencia tudo que o cliente pede",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "essencial",
    estimatedMinutes: 4,
    steps: [
      {
        title: "Como funciona?",
        content: "Quando um cliente faz um pedido, ele aparece aqui automaticamente com um som de alerta. Você precisa ACEITAR o pedido para começar a preparar.",
      },
      {
        title: "Status do pedido (passo a passo)",
        content: "1) PENDENTE: acabou de chegar, você precisa aceitar. 2) PREPARANDO: você está fazendo. 3) PRONTO PARA ENTREGA: comida pronta, esperando motoboy. 4) SAIU PARA ENTREGA: motoboy pegou. 5) ENTREGUE: cliente recebeu.",
        tip: "Sempre atualize o status para o cliente acompanhar em tempo real.",
      },
      {
        title: "Aceitar ou recusar pedido",
        content: "Quando aparecer um pedido novo, leia os itens e o endereço. Se você consegue preparar, toque em ACEITAR. Se não consegue (faltou ingrediente, está muito cheio), toque em RECUSAR e escreva o motivo.",
      },
      {
        title: "Imprimir pedido",
        content: "Se você tem impressora térmica conectada, aparece um botão IMPRIMIR. Toque para sair o pedido na impressora da cozinha.",
      },
      {
        title: "Conversar com o cliente",
        content: "Em cada pedido tem um botão de chat. Use para tirar dúvidas: 'Sem cebola mesmo?', 'Posso substituir?'. O cliente recebe a mensagem no app dele.",
      },
    ],
  },
  {
    id: "menu",
    icon: UtensilsCrossed,
    title: "Cardápio e Produtos",
    shortDesc: "Cadastre lanches, pizzas, bebidas e organize suas vendas",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "vendas",
    estimatedMinutes: 5,
    steps: [
      {
        title: "Organize por Categorias",
        content: "Crie categorias como 'Lanches', 'Bebidas' ou 'Pizzas'. Isso ajuda o cliente a encontrar o que deseja muito mais rápido.",
        tip: "Não crie categorias demais; agrupe itens semelhantes para facilitar a leitura.",
      },
      {
        title: "Cadastrando um Item",
        content: "Toque em ADICIONAR PRODUTO. Preencha o nome, descrição detalhada e o preço. Lembre-se: uma boa descrição evita dúvidas do cliente.",
        tip: "Use fotos reais e bem iluminadas. O cliente compra primeiro com os olhos!",
      },
      {
        title: "Produto disponível ou esgotado",
        content: "Cada produto tem um botão DISPONÍVEL/ESGOTADO. Se acabou um ingrediente, toque para marcar como esgotado. O cliente não consegue mais pedir até você reativar.",
      },
      {
        title: "Editar ou apagar produto",
        content: "Toque no produto para abrir e editar (mudar preço, foto, descrição). Para apagar, abra o produto e toque na lixeira vermelha.",
      },
      {
        title: "Ordem dos produtos",
        content: "Você pode arrastar os produtos para mudar a ordem que aparecem para o cliente. Coloque os mais vendidos primeiro.",
      },
    ],
  },
  {
    id: "addons",
    icon: Plus,
    title: "Opcionais e Adicionais",
    shortDesc: "Aumente seu lucro oferecendo extras como queijo, bacon ou molhos",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "vendas",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Como funcionam os grupos?",
        content: "Grupos organizam as escolhas. Exemplo: no grupo 'Turbine seu Lanche', você oferece Queijo Extra, Bacon ou Ovo. Isso aumenta o valor médio do seu pedido.",
      },
      {
        title: "Criar grupo",
        content: "Toque em NOVO GRUPO. Dê um nome (ex: 'Molhos'), defina mínimo e máximo de escolhas. Mínimo 0 = opcional. Máximo 3 = cliente pode escolher até 3.",
      },
      {
        title: "Adicionar opções no grupo",
        content: "Dentro do grupo, adicione cada opção com nome e preço. Se for grátis (tipo 'sem cebola'), coloque preço 0.",
      },
      {
        title: "Vincular ao produto",
        content: "Depois vá no produto (no Cardápio) e ligue o grupo a ele. Aí toda vez que o cliente pedir aquele produto, vai aparecer as opções extras.",
      },
    ],
  },
  {
    id: "bordas",
    icon: CircleDot,
    title: "Bordas (Pizzaria)",
    shortDesc: "Tipos de borda para pizza (catupiry, cheddar, comum...)",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "vendas",
    estimatedMinutes: 2,
    steps: [
      {
        title: "Para que serve?",
        content: "Se sua loja vende pizza, aqui você cadastra os tipos de borda: tradicional, catupiry, cheddar, chocolate, etc. Cada uma com seu preço.",
      },
      {
        title: "Adicionar borda",
        content: "Toque em NOVA BORDA, escreva o nome (ex: 'Borda Catupiry'), o preço extra (ex: R$8) e salve. Aparece automaticamente quando o cliente pedir pizza.",
      },
    ],
  },
  {
    id: "hours",
    icon: Clock,
    title: "Horários",
    shortDesc: "Quando sua loja está aberta para receber pedidos",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "operacao",
    estimatedMinutes: 2,
    steps: [
      {
        title: "Definir horário de cada dia",
        content: "Para cada dia da semana (segunda, terça...) você define a hora que abre e a hora que fecha. Ex: Segunda 18:00 às 23:00.",
      },
      {
        title: "Dia fechado",
        content: "Se fecha em algum dia (ex: terça é folga), marque a opção 'Fechado o dia todo'. Os clientes verão que está fechado.",
      },
      {
        title: "Fechar manualmente",
        content: "Tem um botão FECHAR LOJA AGORA no topo. Use quando quiser fechar fora do horário (lotou, ingrediente acabou). Lembre de reabrir depois!",
        tip: "Quando a loja está fechada, ninguém consegue fazer pedidos novos.",
      },
    ],
  },
  {
    id: "finance",
    icon: Coins,
    title: "Financeiro e Repasses",
    shortDesc: "Acompanhe suas vendas, saldos e pagamentos de forma clara",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "financeiro",
    estimatedMinutes: 4,
    steps: [
      {
        title: "Seu Dinheiro (PIX)",
        content: "Aqui você vê o saldo das vendas feitas via PIX no app. Esse valor é transferido automaticamente para sua conta conforme o cronograma.",
        tip: "Confira sempre se sua chave PIX está correta nas configurações.",
      },
      {
        title: "Comissão a pagar",
        content: "Se você está no plano Comissão, aqui mostra quanto você deve pagar para a plataforma referente aos pedidos em dinheiro/cartão.",
      },
      {
        title: "Como pagar a comissão?",
        content: "Aparece um botão PAGAR AGORA. Toque, gera um PIX, você paga e pronto. Sua loja continua ativa.",
        tip: "Se não pagar, sua loja pode ser bloqueada até regularizar.",
      },
      {
        title: "Histórico de pedidos",
        content: "Você vê a lista de todos os pedidos com data, valor, forma de pagamento e quanto você ganhou em cada um.",
      },
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Relatórios",
    shortDesc: "Gráficos para entender como está indo o negócio",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "financeiro",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Faturamento por dia",
        content: "Mostra um gráfico de barras: quanto você faturou cada dia da semana. Você descobre os dias mais fortes e mais fracos.",
      },
      {
        title: "Produtos mais vendidos",
        content: "Lista os produtos campeões de venda. Você sabe o que tá bombando e pode até subir o preço, ou criar combos.",
      },
      {
        title: "Horários de pico",
        content: "Mostra os horários que mais entram pedidos. Útil para você reforçar a equipe nos horários de movimento.",
      },
    ],
  },
  {
    id: "subscription",
    icon: CreditCard,
    title: "Assinatura (Plano)",
    shortDesc: "Qual plano você está e quando vence",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "financeiro",
    estimatedMinutes: 2,
    steps: [
      {
        title: "Tipos de plano",
        content: "FIXO: paga uma mensalidade e não paga comissão. COMISSÃO: não paga mensalidade, mas paga uma % de cada pedido. HÍBRIDO: paga mensalidade menor + comissão menor.",
      },
      {
        title: "Quando vence?",
        content: "Aparece a data da próxima cobrança. Pague antes para não bloquear a loja.",
      },
      {
        title: "Mudar de plano",
        content: "Toque em MUDAR PLANO. A administração analisa e aprova. Pode levar 1-2 dias.",
      },
    ],
  },
  {
    id: "loyalty",
    icon: Star,
    title: "Fidelidade e Retenção",
    shortDesc: "Crie motivos para seus clientes comprarem de você toda semana",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "vendas",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Por que usar fidelidade?",
        content: "Clientes que acumulam pontos têm 3x mais chances de comprar novamente. É a forma mais barata de manter sua loja cheia.",
        tip: "Dê pontos suficientes para que o cliente sinta que o benefício é real.",
      },
      {
        title: "Configurar pontos",
        content: "Defina: quantos pontos por real gasto (ex: 1 ponto por R$1), quantos pontos para começar a usar (ex: 50), e quanto vale cada ponto (ex: R$0,10).",
      },
      {
        title: "Limite de desconto",
        content: "Coloca um teto, tipo 'no máximo 20% de desconto por pedido'. Assim você não corre risco de cliente zerar a conta.",
      },
    ],
  },
  {
    id: "drivers",
    icon: Bike,
    title: "Motoboys",
    shortDesc: "Cadastrar e gerenciar seus entregadores próprios",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "operacao",
    estimatedMinutes: 4,
    steps: [
      {
        title: "Cadastrar motoboy",
        content: "Toque em ADICIONAR MOTOBOY e mande o link de cadastro para o entregador. Ele se cadastra com nome, CPF, foto e PIX.",
      },
      {
        title: "Aprovar motoboy",
        content: "Depois que o motoboy se cadastra, você recebe e aprova. Aí ele aparece online no painel quando tiver disponível.",
      },
      {
        title: "Pagar motoboy",
        content: "Aqui você vê quanto deve pagar para cada um. Pode pagar via PIX direto pelo app, ou marcar como pago se pagou em dinheiro.",
        tip: "Mantenha o pagamento em dia para o motoboy continuar trabalhando.",
      },
      {
        title: "Status online/offline",
        content: "O motoboy fica VERDE (online) quando está disponível para pegar entrega. Fica CINZA (offline) quando está em casa.",
      },
    ],
  },
  {
    id: "refunds",
    icon: AlertTriangle,
    title: "Reembolsos",
    shortDesc: "Pedidos de devolução de dinheiro do cliente",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "operacao",
    estimatedMinutes: 2,
    steps: [
      {
        title: "Quando aparece?",
        content: "Quando um cliente pede reembolso (ex: chegou errado, frio, atrasou muito), aparece aqui para você analisar.",
      },
      {
        title: "Aprovar ou negar",
        content: "Leia o motivo do cliente, veja as fotos (se mandou). Se procede, APROVE e o dinheiro volta para o cliente. Se não, NEGUE explicando o motivo.",
        tip: "Trate com educação. Cliente bem atendido volta, mesmo no erro.",
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Configurações",
    shortDesc: "Dados da loja, foto, endereço, PIX, WhatsApp",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    category: "essencial",
    estimatedMinutes: 4,
    steps: [
      {
        title: "Foto e nome da loja",
        content: "Coloque uma logo bonita (foto quadrada). Esse é o cartão de visita. Capriche para o cliente confiar.",
      },
      {
        title: "Endereço completo",
        content: "Preencha CEP, rua, número, bairro. Isso ajuda no cálculo da taxa de entrega correto para cada cliente.",
      },
      {
        title: "Chave PIX",
        content: "Coloque a chave PIX que você quer receber os repasses. Pode ser CPF, CNPJ, e-mail, telefone ou aleatória.",
        tip: "Confira BEM a chave. Se errar, o dinheiro vai para outra pessoa.",
      },
      {
        title: "WhatsApp",
        content: "Coloque seu número com DDD. Os clientes podem chamar você diretamente quando tiver alguma dúvida.",
      },
      {
        title: "Notificações",
        content: "Ative as notificações no celular. Quando chegar pedido novo, você recebe um aviso na hora, mesmo com o app fechado.",
      },
    ],
  },
  {
    id: "pdv",
    icon: ShoppingCart,
    title: "PDV — Vendas no Balcão",
    shortDesc: "Caixa profissional: abertura, vendas, sangria e fechamento cego",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "vendas",
    estimatedMinutes: 6,
    steps: [
      {
        title: "Abrir o caixa",
        content: "Antes de vender, abra o caixa informando o valor inicial (troco que está na gaveta). Sem caixa aberto, você não consegue finalizar vendas no PDV.",
        tip: "Conte o dinheiro da gaveta antes de digitar o valor inicial. Isso evita diferença no fechamento.",
      },
      {
        title: "Atalhos de teclado (mais rápido)",
        content: "F2 abre a busca de produtos. F3 aplica desconto. F4 alterna a forma de pagamento. F8 finaliza a venda. ESC limpa o carrinho. Use o teclado para vender em segundos.",
      },
      {
        title: "Leitor de código de barras",
        content: "Conecte um leitor USB no celular/tablet (via OTG) ou computador. O sistema detecta automaticamente — basta bipar o produto cadastrado e ele entra no carrinho.",
      },
      {
        title: "Pagamento dividido (split)",
        content: "Cliente quer pagar parte no PIX e parte no dinheiro? Toque em DIVIDIR PAGAMENTO, escolha as formas e os valores. O sistema valida que a soma bate com o total.",
      },
      {
        title: "Sangria e suprimento",
        content: "SANGRIA = retirar dinheiro do caixa (levar pro cofre, pagar fornecedor). SUPRIMENTO = colocar dinheiro (reforço de troco). Sempre selecione o motivo para o relatório ficar claro.",
        tip: "Faça sangria sempre que acumular muito dinheiro na gaveta — segurança em primeiro lugar.",
      },
      {
        title: "Fechamento cego (anti-fraude)",
        content: "Ao fechar o caixa, ative o FECHAMENTO CEGO: o operador conta o dinheiro físico SEM ver o valor que o sistema espera. Só depois você (gestor) compara e descobre se houve diferença.",
        tip: "Use a calculadora de cédulas (notas de R$2 a R$200 + moedas) para contar mais rápido e sem errar.",
      },
      {
        title: "Ver histórico e relatórios",
        content: "Na aba HISTÓRICO veja todas as vendas do PDV. Na aba RELATÓRIOS veja ticket médio, total por forma de pagamento e produtos mais vendidos do dia.",
      },
    ],
  },
  {
    id: "coupons",
    icon: Tag,
    title: "Cupons e Promoções",
    shortDesc: "Crie códigos de desconto para campanhas e clientes especiais",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "vendas",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Criar cupom",
        content: "Toque em NOVO CUPOM. Escolha um código fácil (ex: BEMVINDO10), o tipo (% ou R$ fixo) e o valor do desconto. Defina pedido mínimo se quiser.",
        tip: "Códigos curtos e em CAIXA ALTA são mais fáceis do cliente digitar.",
      },
      {
        title: "Validade e limite de uso",
        content: "Defina até quando o cupom funciona e quantas vezes pode ser usado no total (ex: 100 usos). Pode também limitar a 1 uso por cliente.",
      },
      {
        title: "Divulgar",
        content: "Compartilhe o código nas redes sociais, WhatsApp ou flyers. Ao finalizar o pedido, o cliente digita o código no checkout e o desconto aparece automático.",
      },
      {
        title: "Acompanhar resultados",
        content: "No painel você vê quantas vezes cada cupom foi usado e quanto faturou. Pause ou desative cupons que não estão dando retorno.",
      },
    ],
  },
  {
    id: "clients",
    icon: Users,
    title: "Clientes (CRM)",
    shortDesc: "Conheça quem compra de você e reative inativos",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "vendas",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Lista de clientes",
        content: "Aqui aparecem TODOS os clientes que já pediram na sua loja, com nome, telefone, total gasto e quantidade de pedidos.",
      },
      {
        title: "Clientes fiéis",
        content: "O sistema destaca os TOP clientes — os que mais pedem. Mande um WhatsApp agradecendo ou ofereça um cupom exclusivo pra eles.",
        tip: "Custa 5x mais conquistar cliente novo do que manter um antigo. Cuide dos fiéis!",
      },
      {
        title: "Clientes inativos",
        content: "Veja quem não pede há mais de 30 dias. Mande mensagem com cupom de retorno (ex: VOLTA15) — é a forma mais barata de reativar venda.",
      },
      {
        title: "Falar pelo WhatsApp",
        content: "Cada cliente tem um botão WhatsApp ao lado. Toque para abrir uma conversa direta com ele, já com o nome dele preenchido.",
      },
    ],
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notificações e Som de Pedido",
    shortDesc: "Garanta que você recebe o aviso na hora que chegar pedido novo",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "essencial",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Por que isso é crítico?",
        content: "Pedido perdido = dinheiro perdido + cliente irritado. Se você não receber a notificação, pode demorar pra aceitar e o cliente cancela.",
      },
      {
        title: "Permitir notificações no celular",
        content: "Na primeira vez que abre o app, ele pede permissão de notificações. Se você negou, vá em CONFIGURAÇÕES DO CELULAR → APPS → ItaSuper → Notificações e ATIVE tudo.",
        tip: "No iPhone, ative também 'Sons' e 'Banners persistentes' para o aviso ficar na tela até você ver.",
      },
      {
        title: "Não silenciar o app",
        content: "Verifique se o ItaSuper NÃO está em modo silencioso. Aumente o volume de mídia/notificação do celular ao máximo durante o expediente.",
      },
      {
        title: "Modo Não Perturbe",
        content: "Se você usa o modo Não Perturbe à noite, adicione o ItaSuper como exceção (apps permitidos) — assim você ainda recebe pedidos noturnos.",
      },
      {
        title: "Manter o app aberto",
        content: "Para máxima confiabilidade, deixe o app aberto em segundo plano e o celular conectado na tomada. Evita que o sistema do celular 'mate' o app por economia de bateria.",
        tip: "Em alguns Android (Xiaomi, Huawei), trave o app em 'Apps recentes' (cadeado) para não ser fechado automaticamente.",
      },
      {
        title: "Testar",
        content: "Faça um pedido de teste no app cliente (com outro número) e veja se o som toca e a notificação aparece. Se não funcionar, refaça os passos acima.",
      },
    ],
  },
];

// Tutoriais adicionados ao final para não embaralhar a ordem existente
TUTORIAIS.push(
  {
    id: "minimum-order",
    icon: Wallet,
    title: "Pedido Mínimo",
    shortDesc: "Defina um valor mínimo para liberar o checkout do cliente",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "operacao",
    estimatedMinutes: 2,
    steps: [
      {
        title: "Para que serve?",
        content: "O pedido mínimo evita pedidos muito pequenos que não compensam para você (ex: 1 refrigerante de R$5 sozinho). Garante margem e otimiza a entrega.",
      },
      {
        title: "Como configurar",
        content: "Vá em Configurações → seção Entrega → campo '💰 Pedido mínimo' e digite o valor (ex: R$ 20,00). Salve. Pronto.",
        tip: "Deixe vazio ou 0 para desabilitar — o cliente poderá fechar com qualquer valor.",
      },
      {
        title: "Como o cliente vê",
        content: "Se o subtotal do carrinho for menor que o mínimo, aparece um alerta âmbar com barra de progresso mostrando quanto falta. O botão 'Finalizar Pedido' fica desabilitado até atingir o valor.",
        tip: "Comece com um valor confortável (R$ 15-25). Se receber reclamações, ajuste pra baixo.",
      },
    ],
  },
  {
    id: "delivery-distance",
    icon: MapPin,
    title: "Taxa de Entrega por Distância (GPS)",
    shortDesc: "Como o sistema calcula a distância real até o cliente",
    color: "text-primary",
    bgColor: "bg-primary/10",
    category: "operacao",
    estimatedMinutes: 2,
    steps: [
      {
        title: "Como funciona",
        content: "O sistema usa o GPS do celular do cliente (quando ele permite) para calcular a distância exata da sua loja até o endereço de entrega — pela rota real de carro, não em linha reta.",
      },
      {
        title: "Faixas de distância",
        content: "Em Configurações → Entrega você cadastra faixas (ex: até 3km = R$5, até 6km = R$8, até 10km = R$12). O cliente vê a taxa correta automaticamente conforme o endereço dele.",
        tip: "Cadastre uma faixa máxima para evitar entregas fora da sua área de cobertura.",
      },
      {
        title: "Se o GPS divergir do CEP",
        content: "Se o cliente está logado mas o GPS aponta longe do endereço cadastrado, o sistema avisa no checkout pra ele confirmar. Evita fraude e endereço errado.",
      },
    ],
  },
);

// Início Rápido — passos para um lojista novo
const QUICK_START = [
  { id: "settings", label: "1. Configure sua Loja", icon: Settings },
  { id: "notifications", label: "2. Ative Notificações", icon: Bell },
  { id: "hours", label: "3. Defina Horários", icon: Clock },
  { id: "menu", label: "4. Monte seu Cardápio", icon: UtensilsCrossed },
  { id: "addons", label: "5. Crie Adicionais", icon: Plus },
  { id: "drivers", label: "6. Ative Motoboys", icon: Bike },
  { id: "orders", label: "7. Tudo Pronto para Vender!", icon: Trophy },
];

// FAQ — perguntas mais comuns
const FAQ = [
  {
    q: "Como recebo o dinheiro dos pedidos?",
    a: "Pedidos no PIX são repassados pela plataforma direto na sua chave PIX cadastrada. Pedidos em dinheiro/cartão você recebe na hora da entrega.",
  },
  {
    q: "Por que minha loja aparece como fechada?",
    a: "Verifique se está dentro do horário cadastrado em Horários. Confira também se você não fechou manualmente o botão FECHAR LOJA AGORA.",
  },
  {
    q: "O cliente reclama que não recebe notificações.",
    a: "Peça para ele abrir o app, ir em Perfil → Notificações e ativar. No iPhone, também precisa permitir nas configurações do celular.",
  },
  {
    q: "Posso ter mais de um motoboy?",
    a: "Sim! Em Motoboys você cadastra quantos quiser. Cada um recebe seu próprio acesso e fica online de forma independente.",
  },
  {
    q: "Esqueci de aceitar um pedido. O que acontece?",
    a: "Se demorar muito, o cliente pode cancelar. O sistema também avisa você com som e notificação. Sempre fique de olho no painel.",
  },
  {
    q: "Não estou recebendo o som de pedido novo. O que fazer?",
    a: "1) Verifique se permitiu notificações no celular. 2) Aumente o volume. 3) Saia do modo Não Perturbe ou adicione o ItaSuper como exceção. 4) Em Xiaomi/Huawei, trave o app em 'Apps recentes' para não ser fechado por economia de bateria.",
  },
  {
    q: "Como abrir e fechar o caixa do PDV?",
    a: "Vá na aba PDV → ABRIR CAIXA, digite o valor inicial (troco). Para fechar, toque em FECHAR CAIXA, conte o dinheiro físico. Recomendamos ativar o Fechamento Cego para evitar fraude.",
  },
  {
    q: "A diferença no fechamento do caixa deu negativa. E agora?",
    a: "Diferença pode ser troco errado, sangria não registrada ou retirada sem motivo. Use o relatório do PDV para conferir cada movimento. Sempre registre sangrias com motivo.",
  },
  {
    q: "Como mudar de plano (Fixo, Comissão, Híbrido)?",
    a: "Vá em Assinatura → Mudar Plano. A administração analisa em 1-2 dias. Você continua usando o plano atual até a aprovação.",
  },
  {
    q: "Como funciona a troca / reembolso para o cliente?",
    a: "Cliente abre o pedido em Reembolso e descreve o motivo (com foto, se quiser). Você recebe na aba Reembolsos e decide aprovar ou negar. Aprovado, o valor volta automaticamente para o cliente.",
  },
  {
    q: "Como criar um cupom de desconto?",
    a: "Vá na aba Cupons → Novo Cupom. Defina o código (ex: BEMVINDO10), o valor (% ou R$), validade e limite de uso. Compartilhe nas redes para o cliente usar no checkout.",
  },
];

const STORAGE_KEY_BASE = "tutorials_completed";

const TutoriaisPanel = () => {
  const { user } = useAuth();
  const storageKey = user?.id ? `${STORAGE_KEY_BASE}:${user.id}` : STORAGE_KEY_BASE;
  const [search, setSearch] = useState("");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<TutorialCategory | "all">("all");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  // Load completed tutorials from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setCompleted(new Set(JSON.parse(saved)));
      else setCompleted(new Set());
    } catch {}
  }, [storageKey]);

  const toggleCompleted = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const filteredTutoriais = useMemo(() => {
    return TUTORIAIS.filter((t) => {
      if (activeCategory !== "all" && t.category !== activeCategory) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.shortDesc.toLowerCase().includes(q) ||
        t.steps.some(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.content.toLowerCase().includes(q)
        )
      );
    });
  }, [search, activeCategory]);

  const progressPercent = Math.round((completed.size / TUTORIAIS.length) * 100);

  const openSectionById = (id: string) => {
    setOpenSection(id);
    setOpenStep(null);
    // scroll to section
    setTimeout(() => {
      const el = document.getElementById(`tutorial-section-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-8">
      {/* Header com progresso */}
      <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background border border-primary/20 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-foreground tracking-tight">Escola de Parceiros</h2>
            <p className="text-sm text-muted-foreground leading-tight">Domine as ferramentas para vender mais</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-bold">
              Concluído: {completed.size} de {TUTORIAIS.length} lições
            </span>
            <span className="text-primary font-black text-base">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent === 100 && (
            <p className="text-xs text-primary font-bold flex items-center gap-1 pt-1">
              <Trophy className="h-3.5 w-3.5" /> Parabéns! Você completou todos os tutoriais!
            </p>
          )}
        </div>
      </div>

      {/* Início Rápido */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/15 rounded-xl flex items-center justify-center">
            <Rocket className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Trilha do Sucesso</h3>
            <p className="text-xs text-muted-foreground">Siga estes passos para configurar sua loja</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {QUICK_START.map((q, idx) => {
            const Icon = q.icon;
            const isDone = completed.has(q.id);
            return (
              <button
                key={q.id}
                onClick={() => openSectionById(q.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors text-left group"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                  isDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className={`flex-1 text-sm font-bold ${isDone ? "text-muted-foreground/60 line-through" : "text-foreground"}`}>
                  {q.label}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Filters container */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="O que você deseja aprender?"
            className="w-full pl-10 pr-10 py-3 bg-muted/30 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-muted border border-transparent text-foreground hover:bg-muted/70"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>


      {/* Sections list */}
      <div className="space-y-3">
        {filteredTutoriais.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm bg-card border border-border rounded-2xl">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhum tutorial encontrado{search && ` para "${search}"`}
          </div>
        )}
        {filteredTutoriais.map((section) => {
          const Icon = section.icon;
          const isOpen = openSection === section.id;
          const isDone = completed.has(section.id);
          return (
            <div
              key={section.id}
              id={`tutorial-section-${section.id}`}
              className={`bg-card border rounded-2xl overflow-hidden transition-all ${
                isDone ? "border-primary/30" : "border-border"
              } ${isOpen ? "ring-2 ring-primary/20 shadow-lg" : ""}`}
            >
              <button
                onClick={() => {
                  setOpenSection(isOpen ? null : section.id);
                  setOpenStep(null);
                }}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className={`w-11 h-11 ${section.bgColor} rounded-xl flex items-center justify-center flex-shrink-0 relative`}>
                  <Icon className={`h-5 w-5 ${section.color}`} />
                  {isDone && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-card">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-black text-foreground text-base tracking-tight truncate">{section.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{section.shortDesc}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded-md">
                      <PlayCircle className="h-3 w-3 text-primary" />
                      {section.steps.length} etapas
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded-md">
                      <Clock className="h-3 w-3 text-primary" />
                      {section.estimatedMinutes} min
                    </span>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                  {section.steps.map((step, idx) => {
                    const stepKey = `${section.id}-${idx}`;
                    const stepOpen = openStep === stepKey;
                    return (
                      <div key={stepKey} className="bg-card rounded-xl border border-border overflow-hidden">
                        <button
                          onClick={() => setOpenStep(stepOpen ? null : stepKey)}
                          className={`w-full flex items-center gap-3 p-4 text-left transition-all ${
                            stepOpen ? "bg-primary/5" : "hover:bg-muted/20"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl ${section.bgColor} ${section.color} flex items-center justify-center text-xs font-black flex-shrink-0 shadow-sm`}>
                            {idx + 1}
                          </div>
                          <span className={`flex-1 text-sm font-black tracking-tight ${stepOpen ? "text-primary" : "text-foreground"}`}>
                            {step.title}
                          </span>
                          {stepOpen ? (
                            <ChevronUp className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                        {stepOpen && (
                          <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border/50">
                            <p className="text-sm text-foreground/90 leading-relaxed pt-3">
                              {step.content}
                            </p>
                            {step.tip && (
                              <div className="bg-muted border border-border rounded-lg p-2.5 flex gap-2 mt-2">
                                <span className="text-base flex-shrink-0">💡</span>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  <strong>Dica:</strong> {step.tip}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Botão marcar como concluído */}
                  <button
                    onClick={() => toggleCompleted(section.id)}
                    className={`w-full mt-2 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      isDone
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {isDone ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Tutorial concluído
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" /> Marcar como concluído
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/15 rounded-xl flex items-center justify-center">
            <HelpCircle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground">Perguntas Frequentes</h3>
            <p className="text-[11px] text-muted-foreground">As dúvidas mais comuns dos lojistas</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {FAQ.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx}>
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/20 transition-colors"
                >
                  <span className="text-primary font-black text-xs flex-shrink-0">
                    Q{idx + 1}
                  </span>
                  <span className="flex-1 text-sm font-bold text-foreground">{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-foreground/85 leading-relaxed pl-7">{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer help / contato suporte */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 text-center space-y-3">
        <div className="w-12 h-12 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto">
          <MessageCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-black text-foreground">Ainda com dúvida?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Nosso suporte está pronto para te ajudar.
          </p>
        </div>
        <button
          onClick={() => openWhatsApp(SUPPORT_WHATSAPP, SUPPORT_MESSAGE)}
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-black hover:bg-primary/90 active:scale-95 transition-all w-full"
        >
          <MessageCircle className="h-4 w-4" />
          Falar com Suporte
        </button>
      </div>
    </div>
  );
};

export default TutoriaisPanel;
