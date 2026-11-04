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
  version: "2.4.8",
  sizeLabel: "19,3 MB",
  apkPath: "/apps/itasuper-entregador-2.4.8.apk",
  minAndroid: "7.0",
  whatsNew: [
    "Rota otimizada de verdade: as paradas são ordenadas automaticamente pela menor distância — quem já saiu é sequenciado a partir da sua posição, e cada parada mostra a distância do trecho",
    "Botão Navegar rota: abre o Google Maps com a rota inteira, todas as paradas na ordem certa",
    "Uma rota é de uma loja só: pedidos de lojas diferentes não se misturam mais na mesma rota — filtre por uma loja para aceitar todos os pedidos dela de uma vez",
    "A tela de aviso abre a entrega no app: toque em Ver entrega e aceite lá dentro — sem erro, mesmo com o app fechado",
  ],
} as const;
