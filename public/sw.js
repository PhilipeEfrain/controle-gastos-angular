/**
 * Service Worker Oficial do Quinzena App (CARD-075)
 * Suporte a PWA, Instalação Nativa, Cache do App Shell Offline e Blindagem Rigorosa de CSP.
 */

const CACHE_VERSION = 'quinzena-v2.0.0';
const APP_SHELL_CACHE = `quinzena-shell-${CACHE_VERSION}`;

// Recursos essenciais do App Shell cacheados no install para disponibilidade offline
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/icon.svg'
];

// Instalação: Pré-cache dos arquivos essenciais do App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pré-cache parcial do App Shell:', err);
        return self.skipWaiting();
      })
  );
});

// Ativação: Limpeza atômica de versões antigas e reivindicação imediata dos clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('quinzena-') && name !== APP_SHELL_CACHE)
          .map((name) => {
            console.info('[SW] Purgando cache legado:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições com Blindagem de CSP e Isolamento Estrito de Origem
self.addEventListener('fetch', (event) => {
  // 1. Apenas requisições GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 2. ISOLAMENTO RESTRITO: Nunca interceptar chamadas externas de terceiros!
  // Google Auth, AdSense, GTM, Analytics, APIs externas e avatares (lh3.googleusercontent.com)
  // seguem direto pela rede sem virar fetch() no SW, evitando violações de CSP connect-src.
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Ignora rotas de proxy ou API
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 4. Navegações de página (SPA Navigation): Network First com Fallback para /index.html em cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(APP_SHELL_CACHE);
          return (await cache.match('/index.html')) || (await cache.match('/'));
        })
    );
    return;
  }

  // 5. Assets estáticos do App Shell (JS, CSS, Imagens locais, SVGs): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Listener de mensagens para ativação sob demanda
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
