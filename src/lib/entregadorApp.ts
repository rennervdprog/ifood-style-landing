// Página /download — app ItaSuper Entregador (Android).
//
// A CADA nova versão publicada do app do entregador:
//  1. atualizar `version` e `sizeLabel` abaixo;
//  2. substituir o arquivo em public/apps/ pelo APK ASSINADO da
//     publicação (o nome do arquivo carrega a versão).
// O teste src/lib/__tests__/entregadorApp.test.ts trava se o nome do
// arquivo e a versão saírem de sincronia.
export const ENTREGADOR_APP = {
  name: "ItaSuper Entregador",
  developer: "ItaSuper",
  version: "2.5.7",
  sizeLabel: "19,3 MB",
  apkPath: "/apps/itasuper-entregador-2.5.7.apk",
  minAndroid: "7.0",
  whatsNew: [
    "Som novo no alerta de pedido: o toque mudou — agora é o som estilo sirene do ItaSuper, mais alto e mais chamativo na rua",
    "Som próprio do ItaSuper: o alerta de pedido novo agora toca o som exclusivo do ItaSuper — o alarme padrão do aparelho ficou pra trás",
    "Permissões em etapas: a configuração inicial virou um passo a passo guiado — uma permissão por tela, com explicação curta e progresso",
    "Sobreposição virou opcional: sem ela você entra no app normalmente e o alerta de pedido novo chega pela notificação, sem travar na tela de permissões",
    "Aviso de versão nova: quando sai uma atualização, um aviso no app mostra a novidade com o botão de baixar — sem precisar caçar o link",
    "Concluídas de verdade: o cartão agora conta só as entregas de HOJE, não o histórico inteiro",
    "Cadastro com placa: motoboy novo já informa a placa do veículo junto com o modelo",
    "Presença mais leve: sua posição atualiza ao longo do turno gastando menos bateria",
    "Pedidos antigos com pagamento em dinheiro agora mostram a instrução certa no cartão: Dinheiro — cobrar na entrega",
    "Alerta que acorda: pedido novo toca som e vibra no padrão do app e acende a tela, mesmo com o celular bloqueado — e o valor vem escrito por extenso: Total do pedido",
    "Avisos na hora: pedido da sua rota cancelado, ou cliente que confirmou o recebimento pelo app dele, geram notificação — você não navega até a casa do cliente à toa",
    "Monte sua rota aos poucos: ficou pronto outro pedido da mesma loja enquanto você separa os primeiros? Aceite na hora — ele entra na mesma rota, sem precisar finalizar nada antes",
    "Pedido novo durante a entrega não atrapalha mais: com a rota na rua, você recebe só uma notificação discreta de que tem pedido esperando — ele entra na sua próxima rota quando você voltar à loja",
    "Google Maps abrindo de verdade: corrigido o defeito que fazia a navegação cair sempre no Waze, mesmo com o Maps escolhido",
    "Sua posição não some mais do mapa da loja quando você está parado — esperando na loja, no sinal ou falando com o cliente, o ponto continua lá",
    "Você no mapa da loja enquanto estiver ONLINE: agora sua posição aparece para suas lojas o turno inteiro — não só durante a entrega. Ficou offline, para na hora",
    "Saúde do rastreio no Perfil: um checklist mostra o que falta configurar no seu aparelho (localização o tempo todo, bateria sem restrição) para o mapa não perder você",
    "GPS mais preciso: sua posição agora atualiza a cada poucos segundos e o app só usa localização fina — a loja acompanha você no mapa sem aqueles pulos",
    "Abriu, entrou: com o login salvo, o app agora abre direto nas suas entregas — sem passar pela tela de login e sem digitar a senha de novo",
    "Login que fica: o app agora lembra de você — pode fechar e abrir de novo sem digitar a senha toda vez; a sessão fica salva no aparelho e se renova sozinha",
    "Fluxo da rota corrigido: primeiro Sair para entrega — o botão Navegar rota aparece depois da saída e navega só as entregas que já estão na rua",
    "Rota otimizada de verdade: as paradas são ordenadas automaticamente pela menor distância — quem já saiu é sequenciado a partir da sua posição, e cada parada mostra a distância do trecho",
    "Botão Navegar rota: abre o Google Maps com a rota inteira, todas as paradas na ordem certa",
    "Uma rota é de uma loja só: pedidos de lojas diferentes não se misturam mais na mesma rota — filtre por uma loja para aceitar todos os pedidos dela de uma vez",
    "A tela de aviso abre a entrega no app: toque em Ver entrega e aceite lá dentro — sem erro, mesmo com o app fechado",
  ],
} as const;
