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
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'www.itasuper.com.br',
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
  },
};

export default config;
