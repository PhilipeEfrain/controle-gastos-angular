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
    projectId: 'controle-gastos-app-36264',
    appId: '1:562686483207:web:8f8fb528069c1af4b083a2',
    storageBucket: 'controle-gastos-app-36264.firebasestorage.app',
    apiKey: 'AIzaSyDOg6-zXuE8W3w8Kr3Nyx_OLq7lFKBUeU0',
    authDomain: 'localhost',
    messagingSenderId: '562686483207'
  },
  adsense: {
    client: '',
    topDashboardSlot: '',
    enabled: false
  },
  adsterra: {
    enabled: false,
    banner728x90Key: 'f44c3704756583467ecc61b994d6f80f',
    banner300x250Key: 'dae845012d1ed3de4df9b34f05215bda',
    skyscraper160x300Key: '3c670e0edde6c164bd9cc6e60437bb25',
    nativePlacementId: '31396525',
    nativeContainerId: 'container-89feb5cfbf99143b86478f30d020af9a'
  }
};
