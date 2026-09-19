/**
 * Configuração de Ambiente Local / Desenvolvimento (Sandbox)
 *
 * 🛡️ SEGREGAÇÃO DE AMBIENTES:
 * 1. Emuladores Locais do Firebase (Recomendado para desenvolvimento 100% offline e isolado):
 *    - Defina `useEmulators: true` abaixo e inicie os emuladores com: `npm run emulators`
 *    - Auth: http://localhost:9099 | Firestore: http://localhost:8080 | UI: http://localhost:4000
 *
 * 2. Projeto Firebase na Nuvem Dedicado (Dev / Staging):
 *    - Defina `useEmulators: false` e configure os dados abaixo com as credenciais
 *      do seu projeto isolado no Firebase Console (ex: `controle-gastos-dev`).
 *
 * 3. Proteção do Google AdSense:
 *    - `adsense.enabled` está estritamente desativado (`false`) para blindar sua conta
 *      contra tráfego inválido gerado em localhost.
 */
export const environment = {
  production: false,
  useEmulators: true,
  firebase: {
    projectId: 'controle-gastos-dev',
    appId: '1:562686483207:web:dev-environment-placeholder',
    storageBucket: 'controle-gastos-dev.firebasestorage.app',
    apiKey: 'AIzaSy-DEV-KEY-EMULATORS-ACTIVE',
    authDomain: 'localhost',
    messagingSenderId: '562686483207'
  },
  adsense: {
    client: '',
    topDashboardSlot: '',
    enabled: false
  }
};
