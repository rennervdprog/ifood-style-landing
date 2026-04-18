import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.itasuper.cliente',
  appName: 'ItaSuper',
  webDir: 'dist',
  // Carrega o app a partir do domínio publicado.
  // androidScheme: 'https' permite cookies persistentes e cache de service worker
  // entre sessões — fundamental para o WebView não baixar tudo de novo no
  // segundo cold-start, reduzindo a "tela preta inicial".
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  server: {
    url: 'https://itasuper.com.br',
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      // Cobre o WebView enquanto o HTML/JS ainda está sendo baixado.
      // Sem isso, o usuário vê uma tela preta (cor de fundo da Activity).
      launchShowDuration: 3000,
      launchAutoHide: false, // ocultaremos manualmente quando o React montar
      launchFadeOutDuration: 200,
      backgroundColor: '#FF6B00', // cor da marca ItaSuper
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#FFFFFF',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
