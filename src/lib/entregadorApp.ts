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
  version: "2.4.4",
  sizeLabel: "19,3 MB",
  apkPath: "/apps/itasuper-entregador-2.4.4.apk",
  minAndroid: "7.0",
  whatsNew: [
    "Aceite a entrega direto na tela de aviso — tela única, sem abrir outra tela",
    "Nome e endereço da loja corretos no aviso de nova entrega",
    "Depois de aceitar, a entrega aparece na sua rota sem precisar recarregar",
  ],
} as const;
