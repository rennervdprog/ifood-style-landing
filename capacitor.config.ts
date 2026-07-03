import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e8d28aded6334d74be2161c8dbe24765',
  appName: 'ItaSuper',
  webDir: 'dist',
  android: {
    // 🔒 Não permite recursos HTTP dentro de HTTPS
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    captureInput: true,
    backgroundColor: '#0B0F14',
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
      // Fallback máximo — na prática o App root chama hideSplash() assim que
      // a primeira rota monta (tipicamente 600-1200ms). Este valor evita
      // splash "preso" caso o JS crashe antes de chamar hideSplash.
      launchShowDuration: 3500,
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: '#FF6B00',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
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
      directUpdate: false,
      resetWhenUpdate: true,
      keepUrlPathAfterReload: true,
      updateUrl:
        'https://qkjhguziuchqsbxzruea.supabase.co/storage/v1/object/public/app-releases/manifest.json',
      // Estatísticas/canais do serviço pago desligados.
      statsUrl: '',
      channelUrl: '',
      // Sem assinatura RSA — validação por SHA-256 no manifest.
      publicKey: '',
    },
  },
};

export default config;
