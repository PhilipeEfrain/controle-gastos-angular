// Service Worker limpo para PWA (Instalação e Notificações)
// Sem interceptação de requisições fetch para evitar bloqueios de CSP e problemas de cache com imagens de terceiros.

self.addEventListener('install', (event) => {
  // Força ativação imediata do novo Service Worker sem aguardar fechamento das abas
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Deleta TODOS os caches antigos para limpar qualquer lixo ou versão zumbi anterior
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Listener de mensagens para controle manual de ciclo de vida
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
