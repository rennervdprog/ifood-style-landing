import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e8d28aded6334d74be2161c8dbe24765',
  appName: 'ItaSuper',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  // ============================================================
  // 🔧 MODO HÍBRIDO COM HOT-RELOAD DO LOVABLE
  // ============================================================
  // O app Android carrega direto do sandbox do Lovable.
  // Vantagem: vê mudanças em tempo real sem rebuild do APK.
  // Para PRODUÇÃO (Play Store): comente o bloco "server" abaixo
  // e o app passa a usar o HTML/JS empacotado em "webDir: dist".
  // ============================================================
  server: {
    url: 'https://e8d28ade-d633-4d74-be21-61c8dbe24765.lovableproject.com?forceHideBadge=true',
    cleartext: true,
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
