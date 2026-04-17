import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.itasuper.cliente',
  appName: 'ItaSuper',
  webDir: 'dist',
  server: {
    url: 'https://itasuper.com.br',
    cleartext: false
  }
};

export default config;
