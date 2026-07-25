import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.itasuper.cliente',
  appName: 'ItaSuper',
  webDir: 'dist',
  android: {
    // 🔒 Não permite recursos HTTP dentro de HTTPS
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    captureInput: true,
    backgroundColor: '#0B0F14',
    // Bridge nova (MessageChannel) — mais rápida que a legada.
    useLegacyBridge: false,
    // CDN identifica o app e serve Cache-Control agressivo.
    appendUserAgent: 'ItaSuperApp/1.25.64',
    // Não focar automaticamente inputs — evita reflow no boot.
    initialFocus: false,
  },
  server: {
    // 🚀 Bundle local servido pelo Capacitor (sem hot-reload remoto).
    // Atualizações de JS/CSS chegam via @capgo/capacitor-updater (OTA),
    // sem precisar gerar APK novo a cada release.
    hostname: 'itasuper.com.br',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'www.itasuper.com.br',
      'itasuper.com.br',
      '*.supabase.co',
      'qkjhguziuchqsbxzruea.supabase.co',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: '#FF6B00',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#FF6B00',
      sound: 'beep.wav',
    },
    BackgroundRunner: {
      label: 'app.itasuper.driver.background',
      src: 'runners/driverBackground.js',
      event: 'checkForOrders',
      repeat: true,
      // Android: 15 min é o mínimo permitido pelo JobScheduler.
      // iOS: BGTask só roda quando o sistema decide (~horas).
      interval: 15,
      autoStart: true,
    },
    CapacitorUpdater: {
      // OTA self-hosted no bucket `app-releases` do Supabase externo.
      // manifest.json é reescrito pelo workflow ota-release.yml a cada push
      // em main que altere código web. Sem custo, sem dependência do serviço
      // pago do Capgo — o plugin nativo cuida de download/checksum/rollback.
      autoUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      // ⚠️ directUpdate=false: NUNCA recarregar o webview no meio da sessão.
      // O bundle novo é aplicado somente no próximo cold start (após o app
      // ir pra background). Evita "reload no meio da rota" e sensação de
      // instabilidade. OTA continua funcionando — só chega 1 abertura depois.
      directUpdate: false,
      resetWhenUpdate: true,
      keepUrlPathAfterReload: true,
      defaultChannel: 'cliente',
      updateUrl:
        'https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/ota-update',
      // Estatísticas/canais do serviço pago desligados.
      statsUrl: '',
      channelUrl: '',
      // Sem assinatura RSA — validação por SHA-256 no manifest.
      publicKey: '',
    },
  },
};

export default config;
