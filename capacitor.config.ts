import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e8d28aded6334d74be2161c8dbe24765',
  appName: 'ItaSuper',
  webDir: 'dist',
  android: {
    // 🔒 Não permite recursos HTTP dentro de HTTPS
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  server: {
    // 📦 APK carrega o bundle empacotado em dist.
    // Evita mostrar UI antiga do domínio remoto depois de instalar APK novo.
    hostname: 'localhost',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'www.itasuper.com.br',
      'itasuper.com.br',
      '*.supabase.co',
      'qkjhguziuchqsbxzruea.supabase.co',
    ]
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
  },
};

export default config;
