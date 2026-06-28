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
      // Reduzido para 1000ms — o hide manual (hideSplash) está implementado
      // então esse valor só é o fallback máximo, não o tempo real exibido.
      launchShowDuration: 1000,
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
      // OTA de bundle JS sem precisar subir APK na Play Store.
      // O app baixa o bundle novo em background e aplica no próximo cold start.
      autoUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      directUpdate: false,
      resetWhenUpdate: true,
      keepUrlPathAfterReload: true,
    },
  },
};

export default config;
