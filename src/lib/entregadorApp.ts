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
  version: "2.4.6",
  sizeLabel: "19,3 MB",
  apkPath: "/apps/itasuper-entregador-2.4.6.apk",
  minAndroid: "7.0",
  whatsNew: [
    "A tela de aviso agora abre a entrega no app: toque em Ver entrega e aceite lá dentro — sem erro, mesmo com o app fechado",
    "Inclui as melhorias da 2.4.4: nome e endereço da loja corretos no aviso e a entrega na rota sem precisar recarregar",
  ],
} as const;
