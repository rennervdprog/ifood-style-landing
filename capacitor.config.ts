import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e8d28aded6334d74be2161c8dbe24765',
  appName: 'ItaSuper',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
   // ===============================================================
   // 🚀 MODO NATIVO HÍBRIDO (OFFLINE-FIRST)
   // ===============================================================
   // O app agora carrega os arquivos locais da pasta 'dist'.
   // Isso impede que ele abra o navegador externo e garante que
   // funcione como um app nativo real.
   // ===============================================================
  server: {
    androidScheme: 'https',
    url: 'https://www.itasuper.com.br',
    cleartext: true,
    // Permitir todas as navegações dentro do WebView para evitar que abra o navegador externo
    allowNavigation: [
      'www.itasuper.com.br',
      '*.supabase.co',
      'qkjhguziuchqsbxzruea.supabase.co',
      'lktzrqjvqoojlrhqnxuz.supabase.co',
      '*'
    ]
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
